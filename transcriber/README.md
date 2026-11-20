# transcriber

This is a local Whisper server that writes Dutch subtitles matching what is actually spoken. It's useful for dubbed shows, whose subtitles were translated from the original script. When a transcript exists for a video, the extension lists it as **Nederlands (Whisper)** and auto-loads it.

## Setup (once)

You need an NVIDIA GPU. The large-v3 model needs about 4 GB of VRAM, and it downloads (about 3 GB) on the first run.

```bash
python -m venv transcriber/.venv
transcriber/.venv/Scripts/python -m pip install -r transcriber/requirements.txt
```

## Use

In Chrome, open the asbplayer toolbar popup on the episode tab, then go to **Open Side Panel → Load Subtitles → Transcribe this episode**. The extension records from the current position at 1× and loads the generated track after the episode ends. To test a short excerpt, reopen **Load Subtitles** and choose **Finish and transcribe**. The server must be running before you start.

On Windows, you can launch the server without a terminal by creating a shortcut to `transcriber/.venv/Scripts/pythonw.exe` with the full path to `transcriber/server.py` as its argument.

```bash
transcriber/.venv/Scripts/python transcriber/server.py        # serve on 127.0.0.1:8767
transcriber/.venv/Scripts/python transcriber/server.py transcribe episode.m4a --key "<video name>"
```

- **The key** is the video name asbplayer reports for the video, which the subtitle picker suggests as the file name. Examples: `Invincible.S3.E1 - <title>` on Prime, or the video title on YouTube.
- **Storage:** transcripts go to `~/asbplayer-transcripts/<key>.srt`. Set `ASB_TRANSCRIPTS_DIR` to change the folder, `ASB_WHISPER_MODEL` to change the model, and `ASB_WHISPER_LANGUAGE` to change the language.

## Definitions

The Anki dialog fills its definition field with the target word's English meaning as used in the sentence, e.g. _zet_ in "Hij zet de koffie op tafel." becomes "puts (zetten)". It does this by asking this server, which runs a logged-in subscription CLI, so there is no API key and no per-token billing:

- **Default:** Codex (`codex login` with your ChatGPT plan), using `gpt-6.1-terra` on the Fast tier.
- **Alternative:** set `ASB_DEFINE_PROVIDER=claude` to use Claude Code on your Claude plan, with `claude-opus-5-5`.
- **Other settings:** `ASB_DEFINE_MODEL` picks another model, and `ASB_DEFINE_LANGUAGE` translates into a language other than English.

A lookup takes about 5 seconds. Lookups are cached while the server runs, and a definition you typed yourself is never overwritten.

To enable lookups in Chromium, generate a token with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Set `ASB_LOOKUP_TOKEN` to that token before starting the server, then enter the same value in the extension's **Anki → Local lookup token** setting and click **Save**. See the [setup guide](../docs/docs/guides/local-whisper.md#set-up-automatic-anki-lookups) for shell commands and field mapping.

The dialog also translates the full sentence independently of the target word. Add an asbplayer custom field named exactly `Sentence Translation` and map it to the desired field in your Anki note type to enable the translation box. Both lookups use the configured provider and subscription quota.

## Tests

```bash
cd transcriber && python -m unittest test_server
```
