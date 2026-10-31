# Anki add-on for one-click mining support

## Requirements

- At least Anki 25.02 for Qt6 support (https://github.com/ankitects/anki/releases/tag/25.02)

## To manually install the add-on:

1. In Anki, go to Tools -> Add-ons -> View Files
2. Copy/paste the asbplayer-addon folder into this directory
3. Restart Anki

## Development setup

The add-on only ever runs inside Anki, which supplies `aqt`, `anki` and `PyQt6` itself. To
get type checking and editor completion for those APIs while working on it outside of Anki,
in this directory run:

```sh
cd ../..
pnpm sync:project
cd plugins/anki
uv sync
```

This creates `.venv/` containing the Anki and Qt packages. The type checker is configured
under `[tool.basedpyright]` in `pyproject.toml`. The dependencies in `.venv/` are only for
type checking. If dependencies not included in Anki are needed, they need to be vendored
into the `asbplayer-addon/` folder before zipping/publishing the add-on.

## To zip and publish the add-on:

1. Set `releases.ankiAddon.version` in the repository's `project.json`. From the repository root, synchronize the generated metadata and regenerate the uv lockfile:

```sh
pnpm sync:project
uv lock --project plugins/anki
```

The configured version supplies both `manifest.json`'s `human_version` and `pyproject.toml`'s project version. The configured `package` supplies the manifest's package identity and the Python project's name. uv generates `uv.lock` for the development environment. CI checks the generated files and lockfile for drift. Commit these changes before releasing.

`releases.ankiAddon.minPointVersion` is a readable Anki version such as `"25.02"` or `"25.02.1"`. Sync converts it to the manifest's `min_point_version` using Anki's `YYMMPP` integer format (`250200` or `250201`, respectively). The manifest's `homepage` comes from `urls.repo`.

2. Run **Release Anki add-on** in GitHub Actions for the committed branch. The workflow checks metadata, tests packaging, and publishes the archive using `releases.ankiAddon`.

To build the same archive locally without publishing:

```sh
bash plugins/anki/package.sh
```

3. Upload the same `.ankiaddon` file to AnkiWeb: https://ankiweb.net/shared/upload

(https://addon-docs.ankiweb.net/sharing.html)
