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

1. Set `artifacts.ankiAddon.version` in the repository's `project.json`. From the repository root, synchronize the generated metadata and regenerate the uv lockfile:

```sh
pnpm sync:project
uv lock --project plugins/anki
```

The configured version supplies both `manifest.json`'s `human_version` and `pyproject.toml`'s project version. The configured `package` supplies the manifest's package identity and the Python project's name. uv generates `uv.lock` from the Python metadata. CI checks the generated files and lockfile for drift. Commit these changes before releasing.

2. Run **Release Anki add-on** in GitHub Actions for the committed branch. The workflow checks metadata, tests packaging, and publishes the archive using `artifacts.ankiAddon`:

   - Archive: `<package>-<version>.ankiaddon`.
   - Release title: `<package>-v<version>`.
   - Release tag: `<tagPrefix><version>`.

Keep `artifacts.ankiAddon.package` stable: it identifies the installed add-on. The workflow rejects an existing tag and leaves the app's latest release selection unchanged.

To build the same archive locally without publishing:

```sh
bash plugins/anki/package.sh
```

3. Upload the same `.ankiaddon` file to AnkiWeb: https://ankiweb.net/shared/upload

(https://addon-docs.ankiweb.net/sharing.html)
