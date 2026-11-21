# S03: Your own Dutch subtitles, transcribed by Whisper

Status: In progress (W1)
Branch: `slice/03-whisper-subtitles` (stacked on `slice/02a-sentence-mining`)

## Problem

On dubbed shows (e.g. Invincible on Prime with the Dutch dub) the Dutch subtitles are a translation of the original English script, not of the dub. What you read doesn't match what you hear, which makes watching frustrating and makes mined cards wrong. Prime has no CC track for dubs, so the audio is the only source of matching Dutch text.

A spike on 2026-11-20 (NOS Journaal in Makkelijke Taal, 8 min) showed that local Whisper large-v3 on the RTX 3070 matches 94.6% of the human captions' words, with timing within about 0.3 s, 134 of 136 lines being whole sentences, at about 10× real time. Most differences were Whisper being more literal than the human captions.

## Scope

Two sub-slices, each shippable on its own.

**W1: local transcriber and auto-loaded track.**

- A small local server, `transcriber/server.py`, built on faster-whisper:
    - It turns audio into a Dutch SRT made of whole-sentence lines, stored per video.
    - It serves stored SRTs to the extension.
    - It has a CLI to transcribe an audio file you already have.
- When the extension detects subtitles for a video and the server has a transcript for that video's name, the picker lists a **"Nederlands (Whisper)"** track. Auto-load prefers it.

**W2: capture pass in the extension.**

- A "Transcribe this episode" action plays the episode and captures the tab audio.
- The captured audio is tied to the video's own timeline: it follows pauses, and seeking aborts the pass.
- The audio is sent to the transcriber, and the track appears when it's done.

Out of scope:

- Live subtitles while watching.
- Bypassing DRM. Audio is only captured as it plays, as mining already does.
- Translation, and speaker labels.
- Running the server automatically on login. You start it by hand for now.

## Acceptance criteria

- [ ] W1: `python transcriber/server.py transcribe <audio> --key "<video name>"` writes an SRT whose lines are whole sentences, and `cues_from_words` has unit tests.
- [ ] W1: with the server running, opening that video lists "Nederlands (Whisper)" in the subtitle picker and auto-load picks it. Tested on the NOS YouTube video.
- [ ] W1: with the server off or no transcript stored, nothing changes and no errors are shown.
- [ ] W2: on a Prime Invincible episode in the Dutch dub, one capture pass produces a track that lines up with the dub audio, and mining from it gives cards whose sentence matches the audio.
- [ ] W2: after one "Transcribe this episode" click on S1E1, each episode Prime autoplays gets its own pass from 0:00 and its own `<episode>.srt`, until the viewer finishes or cancels, or a pass fails. Leaving an episode mid-pass still transcribes what was recorded.
- [ ] `pnpm run verify` checks pass (see the S1 note on Windows).

## Plan

**W1**

- `project.json` gets `services.transcriber` (127.0.0.1:8767), followed by `node scripts/sync-project-config.ts`.
- `transcriber/server.py` uses the stdlib HTTP server and one worker thread:
    - `GET /subtitles?key=` returns the SRT, or 404.
    - `POST /transcribe?key=&offset=` takes the audio as the request body and returns 202.
    - `GET /jobs?key=` returns the job's status.
    - Transcripts are stored in `~/asbplayer-transcripts/<sanitized key>.srt`.
- `transcriber/test_cues.py` holds the unit tests.
- Extension:
    - Add a `get-local-transcript` message and a background handler that fetches from the server. The background avoids the page's CORS and local-network checks that a content-script fetch would hit.
    - `VideoDataSyncController` adds the transcript as a `data:` URL track, first in the list, and auto-selects it.
- Key: the video name (`basename`) that the page script already reports, such as `Invincible.S3.E1 - <title>` on Prime and the video title on YouTube.

**W2**
Not planned yet. Read the offscreen recorder first. Risks:

- Keeping the audio aligned through pauses.
- Chrome muting captured tabs.
- Prime pausing in background tabs.

## Verification log

- `pnpm run verify`:
- Manual check (site, steps, result):

## Retro
