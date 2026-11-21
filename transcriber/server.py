"""Local Whisper transcriber for asbplayer: turns episode audio into Dutch subtitles that match what is spoken.

    python transcriber/server.py                                  # serve on 127.0.0.1:8767
    python transcriber/server.py transcribe <audio> --key "<name>"  # transcribe a file you already have
    python transcriber/server.py translate --key "<name>"           # translate a stored transcript

It also translates each transcript into English (<key>.en.ai.srt) and serves GET /translate?sentence=, which the Anki
dialog uses to fill the sentence translation field. Translation runs your logged-in Codex CLI (ChatGPT plan) or, with ASB_DEFINE_PROVIDER=claude, Claude
Code (Claude plan), so it uses your subscription rather than per-token API billing.

Transcripts are stored as <ASB_TRANSCRIPTS_DIR or ~/asbplayer-transcripts>/<key>.srt, where the key is the video
name asbplayer reports (e.g. "Invincible.S3.E1 - ...").
"""

import argparse
import glob
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST = "127.0.0.1"
PORT = 8767  # project.json services.transcriber
MODEL = os.environ.get("ASB_WHISPER_MODEL", "large-v3")
LANGUAGE = os.environ.get("ASB_WHISPER_LANGUAGE", "nl")
# Shows Whisper that speakers mix in English slang, so "het is weird, man" isn't heard as Dutch ("het is weer het, man").
PROMPT = os.environ.get("ASB_WHISPER_PROMPT", "Ja man, dat is echt weird. Oké, nice, chill, sorry, whatever.")
TRANSCRIPTS_DIR = Path(os.environ.get("ASB_TRANSCRIPTS_DIR", Path.home() / "asbplayer-transcripts"))

DEFINE_PROVIDER = os.environ.get("ASB_DEFINE_PROVIDER", "codex")
LOOKUP_TOKEN = os.environ.get("ASB_LOOKUP_TOKEN", "")
DEFINE_LANGUAGE = os.environ.get("ASB_DEFINE_LANGUAGE", "English")
DEFINE_TIMEOUT = 60
# The prompt goes in on stdin ("-" for codex). Run with no tools and no saved session: this is a lookup, not an agent.
# Defaults are the most accurate of each plan's models on context-dependent Dutch words, measured 2026-11-20.
DEFINE_COMMANDS = {
    # "priority" is Codex's Fast tier (1.5x on gpt-6.1-terra, no extra usage listed).
    "codex": ["codex", "exec", "--ephemeral", "--skip-git-repo-check", "-s", "read-only", "-m", "{model}",
              "-c", "model_reasoning_effort=low", "-c", 'service_tier="priority"', "-o", "{out}", "-"],
    "claude": ["claude", "-p", "--model", "{model}", "--effort", "low", "--tools", "", "--no-session-persistence"],
}
DEFINE_MODEL = os.environ.get("ASB_DEFINE_MODEL", {"codex": "gpt-6.1-terra", "claude": "claude-opus-5-5"}.get(DEFINE_PROVIDER))

MAX_CHARS = 90  # about two subtitle lines
MAX_SECONDS = 7.0
MAX_PAUSE = 1.0
HOLD = 0.4  # keep a line on screen briefly after its last word
# Whisper often times the first word after a pause late (a long compound gets squeezed into its last syllables), so
# start each line up to this early, never before the previous line's speech ends; clicking a line then catches its start.
LEAD = 1.0
ORPHAN_WORDS = 3  # stretch a line rather than leave this many words of a sentence on their own
FRAGMENT_PAUSE = 2.0  # a longer pause is a deliberate break, even mid-sentence


def ends_sentence(word):
    return re.search(r"[.?!][\"')\]]*$", word["word"].strip()) is not None


def cues_from_words(words):
    """Groups Whisper words ({word, start, end} in seconds) into subtitle lines that are whole sentences where possible."""
    cues, current = [], []

    def flush():
        if current:
            cues.append(
                {
                    "start": current[0]["start"],
                    "end": current[-1]["end"],
                    "text": "".join(w["word"] for w in current).strip(),
                }
            )
            current.clear()

    for index, word in enumerate(words):
        if current:
            too_long = (
                len("".join(w["word"] for w in current) + word["word"]) > MAX_CHARS
                or word["end"] - current[0]["start"] > MAX_SECONDS
            )
            sentence_ends_soon = any(ends_sentence(w) for w in words[index : index + ORPHAN_WORDS])

            if word["start"] - current[-1]["end"] > MAX_PAUSE or (too_long and not sentence_ends_soon):
                flush()

        current.append(word)

        if ends_sentence(word):
            flush()

    flush()
    cues = merge_fragments(cues)

    speech_end = 0.0
    for cue in cues:
        cue["start"], speech_end = max(cue["start"] - LEAD, speech_end, 0.0), cue["end"]

    for cue, following in zip(cues, cues[1:] + [None]):
        cue["end"] = min(cue["end"] + HOLD, following["start"]) if following else cue["end"] + HOLD

    return cues


def merge_fragments(cues):
    """Cleans Whisper's lines: joins sentence fragments and drops the filler it invents over music and silence."""

    def ends(cue):
        return re.search(r"[.?!][\"')\]]*$", cue["text"]) is not None

    def short(cue):
        return len(cue["text"].split()) < ORPHAN_WORDS

    merged = []
    for cue in cues:
        # Whisper's filler: "MUZIEK" captions and one word looped ("nou nou nou nou nou").
        text = re.sub(r"^(?:[A-Z]{4,}\b\s*)+", "", cue["text"]).strip()
        if not text or re.search(r"\b(\w+)(?: \1\b){4,}", text, re.I):
            continue
        cue = {**cue, "text": text}
        previous = merged[-1] if merged else None
        if previous is None:
            merged.append(cue)
            continue
        gap = cue["start"] - previous["end"]
        # A fragment that starts a sentence joins what follows; one that ends a sentence joins what came before. A
        # lowercase continuation belongs to the fragment however far apart Whisper put them: its silence filter can
        # push a sentence's first word back into the previous stretch of speech, so the continuation's time is right.
        continues = text[:1].islower() or text[:1] == "-"
        if not ends(previous) and (short(previous) or short(cue)) and (gap <= FRAGMENT_PAUSE or continues):
            start = previous["start"]
            if gap > FRAGMENT_PAUSE:
                floor = merged[-2]["end"] if len(merged) > 1 else 0.0
                start = max(cue["start"] - (previous["end"] - previous["start"]), floor)
            merged[-1] = {"start": start, "end": cue["end"], "text": f"{previous['text']} {cue['text']}"}
        else:
            merged.append(cue)

    # The same line three or more times in a row is Whisper looping (often over end credits): keep one.
    result = []
    for cue in merged:
        run = [c for c in result[-2:] if c["text"] == cue["text"]]
        if len(result) >= 2 and len(run) == 2 and cue["start"] - result[-1]["end"] <= FRAGMENT_PAUSE:
            result.pop()
            result[-1]["end"] = cue["end"]
            result[-1]["looped"] = True
        elif result and result[-1].get("looped") and result[-1]["text"] == cue["text"]:
            result[-1]["end"] = cue["end"]
        else:
            result.append(cue)
    for cue in result:
        cue.pop("looped", None)
    return result


def clean_transcript(key):
    """Rewrites a stored transcript with fragments merged, for transcripts made before merge_fragments existed."""
    path = transcript_path(key)
    cues = parse_srt(path.read_text(encoding="utf-8"))
    merged = merge_fragments(cues)
    path.write_text(to_srt(merged), encoding="utf-8")
    return f"{path}: {len(cues)} -> {len(merged)} lines"


def srt_time(seconds):
    ms = max(0, round(seconds * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def to_srt(cues):
    return "".join(
        f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n\n" for i, c in enumerate(cues, 1)
    )


def transcript_path(key):
    # Windows-safe file name; keys are video names, so keep them readable.
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", key).strip(" .")[:150]
    if not safe:
        raise ValueError("empty key")
    return TRANSCRIPTS_DIR / f"{safe}.srt"


_model = None
_model_lock = threading.Lock()


def load_model():
    global _model

    with _model_lock:
        if _model is None:
            # CTranslate2 on Windows loads cuBLAS/cuDNN from the pip-installed nvidia packages.
            for directory in glob.glob(os.path.join(sys.prefix, "Lib", "site-packages", "nvidia", "*", "bin")):
                os.add_dll_directory(directory)
                os.environ["PATH"] = directory + os.pathsep + os.environ["PATH"]

            from faster_whisper import WhisperModel

            _model = WhisperModel(MODEL, device="cuda", compute_type="float16")

    return _model


def transcribe(audio_path, key, offset=0.0, on_progress=None):
    """Transcribes audio_path and stores the SRT for key. offset is the video time (s) where the audio starts."""
    segments, info = load_model().transcribe(
        str(audio_path), language=LANGUAGE, initial_prompt=PROMPT or None, word_timestamps=True, vad_filter=True, beam_size=5
    )
    words = []

    for segment in segments:
        words.extend({"word": w.word, "start": w.start + offset, "end": w.end + offset} for w in segment.words)

        if on_progress and info.duration:
            on_progress(min(1.0, segment.end / info.duration))

    if not words:
        raise ValueError('Whisper found no speech in the recording. Check that the episode audio is audible.')

    path = transcript_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(to_srt(cues_from_words(words)), encoding="utf-8")
    return path


class DefineError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


_translations = {}  # sentence -> translation, so reopening a card costs nothing
_lookup_requests = threading.BoundedSemaphore(4)
_lookup_workers = threading.BoundedSemaphore(2)


def translate(sentence):
    """The sentence in DEFINE_LANGUAGE: from a stored English SRT if possible, else from the CLI in DEFINE_PROVIDER."""
    cache_key = sentence.strip()

    if stored := stored_translation(sentence):
        return stored

    if cache_key in _translations:
        return _translations[cache_key]

    if not _lookup_requests.acquire(blocking=False):
        raise DefineError(429, "Local lookup is busy")

    try:
        with _lookup_workers:
            if cache_key not in _translations:
                _translations[cache_key] = run_cli(
                    f"Translate the following sentence into {DEFINE_LANGUAGE}. Reply only with the translation, "
                    f"without quotes or explanation.\n\nSentence: {sentence}",
                    DEFINE_TIMEOUT,
                )
            return _translations[cache_key]
    finally:
        _lookup_requests.release()


def run_cli(prompt, timeout):
    command = DEFINE_COMMANDS[DEFINE_PROVIDER]
    executable = shutil.which(command[0])  # npm installs .cmd shims on Windows

    if executable is None:
        raise DefineError(503, f"{command[0]} CLI not found; install it and log in")

    with tempfile.TemporaryDirectory() as workdir:  # nothing for the CLI to look at
        out = os.path.join(workdir, "out.txt")

        try:
            result = subprocess.run(
                [executable, *(arg.replace("{out}", out).replace("{model}", DEFINE_MODEL) for arg in command[1:])],
                input=prompt,
                capture_output=True,
                text=True,
                encoding="utf-8",
                cwd=workdir,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as e:
            raise DefineError(504, f"{command[0]} took longer than {timeout} s") from e

        if result.returncode != 0:
            raise DefineError(502, f"{command[0]} failed: {(result.stderr or result.stdout).strip()[-300:]}")

        answer = (Path(out).read_text(encoding="utf-8") if os.path.exists(out) else result.stdout).strip()

    if not answer:
        raise DefineError(502, f"{command[0]} returned nothing")

    return answer


TRANSLATE_CHUNK = 60  # lines per CLI call: enough context, short enough to come back intact
TRANSLATE_TIMEOUT = 300
TRANSLATE_PROMPT = (
    f"Translate these numbered Dutch subtitle lines into natural {DEFINE_LANGUAGE}, using the surrounding lines for "
    "context. Reply with every line as 'number. translation', one per line, same numbers, nothing else.\n\n"
)


def translation_paths(key):
    """(an English SRT you supply, the AI translation made when there is none); the first that exists is used."""
    path = transcript_path(key)
    lang = DEFINE_LANGUAGE.lower()[:2]
    return path.with_name(f"{path.stem}.{lang}.srt"), path.with_name(f"{path.stem}.{lang}.ai.srt")


def parse_srt(text):
    """[{start, end, text}] with times in seconds, in file order."""
    def seconds(stamp):
        h, m, rest = stamp.strip().replace(",", ".").split(":")
        return int(h) * 3600 + int(m) * 60 + float(rest)

    cues = []
    for block in re.split(r"\n\s*\n", text.replace("\r", "").strip()):
        lines = block.strip().splitlines()
        timing = next((i for i, line in enumerate(lines[:2]) if " --> " in line), None)
        if timing is not None and lines[timing + 1 :]:
            start, end = lines[timing].split(" --> ")
            cues.append({"start": seconds(start), "end": seconds(end.split()[0]), "text": "\n".join(lines[timing + 1 :])})
    return cues


def translate_transcript(key):
    """Writes <key>.<lang>.ai.srt, a line-by-line translation of the transcript, unless you supplied <key>.<lang>.srt."""
    supplied, target = translation_paths(key)
    if supplied.exists():
        return supplied

    source = parse_srt(transcript_path(key).read_text(encoding="utf-8"))
    target.unlink(missing_ok=True)  # an old translation is of the old wording
    translated = {}

    for first in range(0, len(source), TRANSLATE_CHUNK):
        chunk = list(enumerate(source[first : first + TRANSLATE_CHUNK], first + 1))
        answer = run_cli(TRANSLATE_PROMPT + "\n".join(f"{i}. {c['text']}" for i, c in chunk), TRANSLATE_TIMEOUT)
        numbers = {i for i, _ in chunk}
        for match in re.finditer(r"^\s*(\d+)[.):]\s*(.+?)\s*$", answer, re.M):
            if int(match[1]) in numbers:
                translated[int(match[1])] = match[2]

    target.write_text(
        to_srt([{**c, "text": translated[i]} for i, c in enumerate(source, 1) if i in translated]), encoding="utf-8"
    )
    return target


def _normalize(line):
    return " ".join(line.split()).lower()


def matching_lines(cue, english):
    """The English lines spoken during the Dutch cue: those mostly inside it, or covering its midpoint."""
    middle = (cue["start"] + cue["end"]) / 2
    return [
        e["text"]
        for e in english
        if e["start"] <= middle < e["end"]
        or min(cue["end"], e["end"]) - max(cue["start"], e["start"]) > (e["end"] - e["start"]) / 2
    ]


def stored_translation(sentence):
    """The sentence's English from a stored English SRT, if every line of it is a transcript line."""
    lines = [_normalize(line) for line in sentence.splitlines() if line.strip()]
    found = {}

    # shortcut: rereads the transcripts per lookup; fine for dozens of episodes, index them if it gets slow.
    for source in TRANSCRIPTS_DIR.glob("*.srt"):
        if source.stem.rsplit(".", 1)[-1] in ("ai", DEFINE_LANGUAGE.lower()[:2]):
            continue  # a translation, not a transcript
        english_path = next((p for p in translation_paths(source.stem) if p.exists()), None)
        if english_path is None:
            continue
        english = parse_srt(english_path.read_text(encoding="utf-8"))
        for cue in parse_srt(source.read_text(encoding="utf-8")):
            if _normalize(cue["text"]) in lines and (match := matching_lines(cue, english)):
                found[_normalize(cue["text"])] = " ".join(" ".join(m.split()) for m in match)

    if lines and all(line in found for line in lines):
        return "\n".join(dict.fromkeys(found[line] for line in lines))  # one English line can span two Dutch ones
    return None


jobs = {}  # key ->{"state": queued|running|done|error, "progress": 0..1, "error"?: str}
jobs_lock = threading.Lock()
job_semaphore = threading.Semaphore(1)  # one GPU job at a time


def keep_audio(key, audio_path):
    """Moves an upload to <transcripts>/audio/, so a failed or long multi-episode recording can be redone or split."""
    folder = TRANSCRIPTS_DIR / "audio"
    folder.mkdir(parents=True, exist_ok=True)
    kept = folder / f"{transcript_path(key).stem} {time.strftime('%Y%m%d-%H%M%S')}.webm"
    shutil.move(audio_path, kept)
    return kept


def streamed_audio_path(key, session):
    """Where /append collects a recording as it happens, so a browser crash loses at most the last chunk."""
    if not re.fullmatch(r"[0-9a-f-]{8,64}", session):
        raise ValueError("invalid session")
    folder = TRANSCRIPTS_DIR / "audio"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{transcript_path(key).stem} {session}.webm"


def run_job(key, audio_path, offset, keep=True):
    def progress(value):
        with jobs_lock:
            jobs[key]["progress"] = round(value, 3)

    if keep:
        audio_path = keep_audio(key, audio_path)
    try:
        with job_semaphore:
            with jobs_lock:
                jobs[key]["state"] = "running"

            transcribe(audio_path, key, offset, progress)

        with jobs_lock:
            jobs[key] = {"state": "done", "progress": 1.0}

        try:
            translate_transcript(key)
        except Exception:
            traceback.print_exc()  # sentence lookups fall back to one CLI call each
    except Exception as e:
        traceback.print_exc()

        with jobs_lock:
            jobs[key] = {"state": "error", "progress": 0, "error": str(e)}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body=b"", content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _key(self, query):
        key = query.get("key", [""])[0]
        transcript_path(key)  # validates
        return key

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)

        try:
            if url.path == "/subtitles":
                path = transcript_path(self._key(query))

                if path.exists():
                    self._send(200, path.read_bytes(), "text/plain; charset=utf-8")
                else:
                    self._send(404)
            elif url.path == "/translate":
                expected = f"Bearer {LOOKUP_TOKEN}".encode("utf-8")
                supplied = self.headers.get("Authorization", "").encode("utf-8")
                if len(LOOKUP_TOKEN) < 32 or not hmac.compare_digest(supplied, expected):
                    self._send(401, json.dumps({"error": "Local lookup requires a valid token"}).encode())
                    return

                sentence = query.get("sentence", [""])[0].strip()

                if not sentence:
                    raise ValueError("sentence is required")

                self._send(200, json.dumps({"translation": translate(sentence)}).encode())
            elif url.path == "/jobs":
                key = self._key(query)

                with jobs_lock:
                    job = jobs.get(key) or ({"state": "done", "progress": 1.0} if transcript_path(key).exists() else None)

                self._send(200 if job else 404, json.dumps(job or {}).encode())
            else:
                self._send(404)
        except DefineError as e:
            self._send(e.status, json.dumps({"error": str(e)}).encode())
        except ValueError as e:
            self._send(400, json.dumps({"error": str(e)}).encode())

    def do_POST(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)

        if url.path not in ("/transcribe", "/append"):
            self._send(404)
            return

        try:
            key = self._key(query)
            offset = float(query.get("offset", ["0"])[0])
            length = int(self.headers.get("Content-Length", "0"))
            session = query.get("session", [""])[0]
            streamed = streamed_audio_path(key, session) if session else None

            if url.path == "/append" and (streamed is None or length <= 0):
                raise ValueError("session and audio are required")
            if length <= 0 and not (streamed and streamed.exists()):
                raise ValueError("no audio")
        except ValueError as e:
            self._send(400, json.dumps({"error": str(e)}).encode())
            return

        if url.path == "/append":
            chunk = self.rfile.read(length)  # whole chunk first: a partial append would corrupt the rest of the file

            if len(chunk) != length:
                self._send(400, json.dumps({"error": "incomplete audio upload"}).encode())
                return

            with open(streamed, "ab") as f:
                f.write(chunk)

            self._send(204)
            return

        audio_path, keep = streamed, False

        if length > 0:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as f:
                remaining = length

                while remaining > 0:
                    chunk = self.rfile.read(min(remaining, 1 << 20))

                    if not chunk:
                        break

                    f.write(chunk)
                    remaining -= len(chunk)

            if remaining:
                os.unlink(f.name)
                self._send(400, json.dumps({"error": "incomplete audio upload"}).encode())
                return

            audio_path, keep = f.name, True

        with jobs_lock:
            if jobs.get(key, {}).get("state") in ("queued", "running"):
                if keep:
                    os.unlink(audio_path)
                self._send(409, json.dumps({"error": "episode is already being transcribed"}).encode())
                return
            jobs[key] = {"state": "queued", "progress": 0}

        threading.Thread(target=run_job, args=(key, audio_path, offset, keep), daemon=True).start()
        self._send(202, json.dumps(jobs[key]).encode())

    def log_request(self, code="-", size="-"):
        self.log_message('"%s %s %s" %s %s', self.command, urlparse(self.path).path, self.request_version, code, size)

    def log_message(self, format, *args):
        if sys.stderr is not None:  # pythonw.exe has no console streams
            sys.stderr.write(f"[transcriber] {self.address_string()} {format % args}\n")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")
    file_parser = sub.add_parser("transcribe", help="transcribe an audio file")
    file_parser.add_argument("audio")
    file_parser.add_argument("--key", required=True, help="the video name asbplayer shows for this episode")
    file_parser.add_argument("--offset", type=float, default=0.0, help="video time in seconds where the audio starts")
    translate_parser = sub.add_parser("translate", help="translate a stored transcript for sentence lookups")
    translate_parser.add_argument("--key", required=True)
    clean_parser = sub.add_parser("clean", help="merge pause-split fragments in a stored transcript")
    clean_parser.add_argument("--key", required=True)
    args = parser.parse_args()

    if args.command == "transcribe":
        print(transcribe(args.audio, args.key, args.offset))
        return

    if args.command == "clean":
        print(clean_transcript(args.key))
        return

    if args.command == "translate":
        print(translate_transcript(args.key))
        return

    if sys.stderr is None:  # pythonw.exe has no console: keep requests and tracebacks for debugging
        TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
        sys.stderr = open(TRANSCRIPTS_DIR / "server.log", "a", encoding="utf-8", buffering=1)

    print(f"[transcriber] serving on http://{HOST}:{PORT}, transcripts in {TRANSCRIPTS_DIR}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
