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

## Definitions

The Anki dialog fills its definition field with the target word's English meaning as used in the sentence, e.g. *zet* in "Hij zet de koffie op tafel." becomes "puts (zetten)". It does this by asking this server, which runs a logged-in subscription CLI, so there is no API key and no per-token billing:

- **Default:** Codex (`codex login` with your ChatGPT plan), using `gpt-6.1-terra` on the Fast tier.
- **Alternative:** set `ASB_DEFINE_PROVIDER=claude` to use Claude Code on your Claude plan, with `claude-opus-5-5`.
- **Other settings:** `ASB_DEFINE_MODEL` picks another model, and `ASB_DEFINE_LANGUAGE` translates into a language other than English.

A lookup takes about 5 seconds. Lookups are cached while the server runs, and a definition you typed yourself is never overwritten.

The dialog also translates the full sentence independently of the target word. To export it, create a custom Anki field in asbplayer named exactly `Sentence Translation` and map it to the desired field in your Anki note type. Edits to the translation are preserved. Both lookups use the configured provider and subscription quota.

## Tests

```bash
cd transcriber && python -m unittest test_server
```
