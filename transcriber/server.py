"""Local Whisper transcriber for asbplayer: turns episode audio into Dutch subtitles that match what is spoken.

    python transcriber/server.py                                  # serve on 127.0.0.1:8767
    python transcriber/server.py transcribe <audio> --key "<name>"  # transcribe a file you already have

It also serves GET /define?word=&sentence= (the word's English meaning in context), which the Anki dialog uses to fill
the definition field. It runs your logged-in Codex CLI (ChatGPT plan) or, with ASB_DEFINE_PROVIDER=claude, Claude
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
DEFINE_PROMPT = (
    "You write the definition field of a language-learning flashcard. You get a sentence and one word or phrase from "
    f"it. Reply with only its {DEFINE_LANGUAGE} meaning as used in that sentence, in at most 12 words. If it is an "
    "inflected or separable form, add the dictionary form in parentheses, e.g. 'shared (delen, past tense)'. "
    "No quotes, no preamble, no explanation.\n\nSentence: {sentence}\nWord: {word}"
)
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

    speech_end = 0.0
    for cue in cues:
        cue["start"], speech_end = max(cue["start"] - LEAD, speech_end, 0.0), cue["end"]

    for cue, following in zip(cues, cues[1:] + [None]):
        cue["end"] = min(cue["end"] + HOLD, following["start"]) if following else cue["end"] + HOLD

    return cues


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


_definitions = {}  # (word, sentence) -> definition, so retyping or reopening a card costs nothing
_lookup_requests = threading.BoundedSemaphore(4)
_lookup_workers = threading.BoundedSemaphore(2)


def define(word, sentence):
    """The word's meaning as used in the sentence, in DEFINE_LANGUAGE, from the subscription CLI in DEFINE_PROVIDER."""
    cache_key = (word.strip().lower(), sentence.strip())

    if cache_key in _definitions:
        return _definitions[cache_key]

    if not _lookup_requests.acquire(blocking=False):
        raise DefineError(429, "Local lookup is busy")

    try:
        with _lookup_workers:
            if cache_key in _definitions:
                return _definitions[cache_key]
            return _lookup_definition(word, sentence, cache_key)
    finally:
        _lookup_requests.release()


def _lookup_definition(word, sentence, cache_key):
    command = DEFINE_COMMANDS[DEFINE_PROVIDER]
    executable = shutil.which(command[0])  # npm installs .cmd shims on Windows

    if executable is None:
        raise DefineError(503, f"{command[0]} CLI not found; install it and log in")

    with tempfile.TemporaryDirectory() as workdir:  # nothing for the CLI to look at
        out = os.path.join(workdir, "out.txt")

        try:
            result = subprocess.run(
                [executable, *(arg.replace("{out}", out).replace("{model}", DEFINE_MODEL) for arg in command[1:])],
                input=(DEFINE_PROMPT.format(word=word, sentence=sentence) if word else
                       f"Translate the following sentence into {DEFINE_LANGUAGE}. Reply only with the translation, "
                       f"without quotes or explanation.\n\nSentence: {sentence}"),
                capture_output=True,
                text=True,
                encoding="utf-8",
                cwd=workdir,
                timeout=DEFINE_TIMEOUT,
            )
        except subprocess.TimeoutExpired as e:
            raise DefineError(504, f"{command[0]} took longer than {DEFINE_TIMEOUT} s") from e

        if result.returncode != 0:
            raise DefineError(502, f"{command[0]} failed: {(result.stderr or result.stdout).strip()[-300:]}")

        definition = (Path(out).read_text(encoding="utf-8") if os.path.exists(out) else result.stdout).strip()

    if not definition:
        raise DefineError(502, f"{command[0]} returned nothing")

    _definitions[cache_key] = definition
    return definition


jobs = {}  # key ->{"state": queued|running|done|error, "progress": 0..1, "error"?: str}
jobs_lock = threading.Lock()
job_semaphore = threading.Semaphore(1)  # one GPU job at a time


def run_job(key, audio_path, offset):
    def progress(value):
        with jobs_lock:
            jobs[key]["progress"] = round(value, 3)

    try:
        with job_semaphore:
            with jobs_lock:
                jobs[key]["state"] = "running"

            transcribe(audio_path, key, offset, progress)

        with jobs_lock:
            jobs[key] = {"state": "done", "progress": 1.0}
    except Exception as e:
        traceback.print_exc()

        with jobs_lock:
            jobs[key] = {"state": "error", "progress": 0, "error": str(e)}
    finally:
        os.unlink(audio_path)


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
            elif url.path == "/define":
                expected = f"Bearer {LOOKUP_TOKEN}".encode("utf-8")
                supplied = self.headers.get("Authorization", "").encode("utf-8")
                if len(LOOKUP_TOKEN) < 32 or not hmac.compare_digest(supplied, expected):
                    self._send(401, json.dumps({"error": "Local lookup requires a valid token"}).encode())
                    return

                word = query.get("word", [""])[0].strip()
                sentence = query.get("sentence", [""])[0].strip()

                if not sentence:
                    raise ValueError("sentence is required")

                self._send(200, json.dumps({"definition": define(word, sentence)}).encode())
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

        if url.path != "/transcribe":
            self._send(404)
            return

        try:
            key = self._key(query)
            offset = float(query.get("offset", ["0"])[0])
            length = int(self.headers.get("Content-Length", "0"))

            if length <= 0:
                raise ValueError("no audio")
        except ValueError as e:
            self._send(400, json.dumps({"error": str(e)}).encode())
            return

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

        with jobs_lock:
            if jobs.get(key, {}).get("state") in ("queued", "running"):
                os.unlink(f.name)
                self._send(409, json.dumps({"error": "episode is already being transcribed"}).encode())
                return
            jobs[key] = {"state": "queued", "progress": 0}

        threading.Thread(target=run_job, args=(key, f.name, offset), daemon=True).start()
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
    args = parser.parse_args()

    if args.command == "transcribe":
        print(transcribe(args.audio, args.key, args.offset))
        return

    print(f"[transcriber] serving on http://{HOST}:{PORT}, transcripts in {TRANSCRIPTS_DIR}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
