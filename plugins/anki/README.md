# Anki asbplayer plugin for one-click mining support

## Requirements

- At least Anki 25.02 for Qt6 support (https://github.com/ankitects/anki/releases/tag/25.02)

## To manually install the plugin:

1. In Anki, go to Tools -> Add-ons -> View Files
2. Copy/paste the asbplayer-plugin folder into this directory
3. Restart Anki

## Development setup

The plugin only ever runs inside Anki, which supplies `aqt`, `anki` and `PyQt6` itself. To
get type checking and editor completion for those APIs while working on it outside of Anki:

```sh
cd plugins/anki
uv sync
```

This creates `.venv/` containing the real Anki and Qt packages (both ship `py.typed`, and
PyQt6 ships `.pyi` stubs). The type checker is configured under `[tool.basedpyright]` in
`pyproject.toml` and points at that venv.

**`.venv/` exists only for the type checker.** It is never imported by the plugin and never
shipped — the `.ankiaddon` is built from the `asbplayer-plugin/` folder only.

## To publish the plugin to AnkiWeb:

1. Run:

```sh
cd asbplayer-plugin && zip -r ../asbplayer-plugin.ankiaddon * -x '*__pycache__*'
```

2. Upload the ankiaddon file: https://ankiweb.net/shared/upload

(https://addon-docs.ankiweb.net/sharing.html)
