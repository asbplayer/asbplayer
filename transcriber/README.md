# transcriber

This is a local Whisper server that writes Dutch subtitles matching what is actually spoken. It's useful for dubbed shows, whose subtitles were translated from the original script. When a transcript exists for a video, the extension lists it as **Nederlands (Whisper)** and auto-loads it.

## Setup (once)

You need an NVIDIA GPU. The large-v3 model needs about 4 GB of VRAM, and it downloads (about 3 GB) on the first run.

```bash
python -m venv transcriber/.venv
transcriber/.venv/Scripts/python -m pip install -r transcriber/requirements.txt
```

## Use

```bash
transcriber/.venv/Scripts/python transcriber/server.py        # serve on 127.0.0.1:8767
transcriber/.venv/Scripts/python transcriber/server.py transcribe episode.m4a --key "<video name>"
```

- **The key** is the video name asbplayer reports for the video, which the subtitle picker suggests as the file name. Examples: `Invincible.S3.E1 - <title>` on Prime, or the video title on YouTube.
- **Storage:** transcripts go to `~/asbplayer-transcripts/<key>.srt`. Set `ASB_TRANSCRIPTS_DIR` to change the folder, `ASB_WHISPER_MODEL` to change the model, and `ASB_WHISPER_LANGUAGE` to change the language.

## Tests

```bash
cd transcriber && python -m unittest test_server
```
