# AGENTS.md

Guidance for coding agents (Claude Code, Codex, opencode, etc.) working in this repository.

asbplayer is a subtitle player for language learners. It has two halves: a web app (app.asbplayer.dev) and a browser extension (Chrome MV3, Firefox MV2, Firefox for Android). Both mine subtitle lines into Anki cards via AnkiConnect.

## Toolchain

- pnpm workspace. Node and pnpm versions are pinned in `project.json` → `development` (Node 24, pnpm 11) and enforced by `devEngines` in `package.json`.
- Several scripts are bash (`scripts/loc/loc-keys-match`, `scripts/page-file-references-are-correct`) or use POSIX env-var syntax (`client` `start`/`build`). On Windows, run them from Git Bash/WSL.

## Commands

```bash
pnpm i                                          # install
pnpm --filter @project/client run start         # web app dev server (localhost:3000)
pnpm --filter @project/extension dev            # Chromium extension -> extension/.output/chrome-mv3-dev
pnpm --filter @project/extension dev:firefox    # Firefox -> extension/.output/firefox-mv2-dev
pnpm --filter @project/extension dev:firefox-android  # then ./scripts/push-firefox-android to a connected device
pnpm --filter @project/extension build          # production build (also build:firefox, build:firefox-android)

pnpm run verify          # full pre-merge check (what CI runs: verify:app + test:scripts + ffmpeg verify:code); run before opening a PR
pnpm run pretty          # prettier write
pnpm eslint common extension/src client/src

# Per-package checks (verify:app runs these)
pnpm --filter @project/common run typecheck
pnpm --filter @project/client run compile       # tsc --noEmit
pnpm --filter @project/extension run compile
pnpm --filter @project/{common,client,extension} run test

# Single test file / single test (Jest, jsdom)
pnpm --filter @project/common exec jest settings/settings-provider.test.ts
pnpm --filter @project/extension exec jest src/services/binding.test.ts -t "name of test"

pnpm run test:scripts    # node:test suites for scripts/*.test.ts
```

`common` Jest uses ts-jest with `isolatedModules` (no type checking in tests), so run `typecheck` separately. `common`'s `typecheck` excludes `common/app` (it needs Vite-only ambient types). The app UI is type-checked only by the `client` and `extension` `compile` scripts, so run those after changing `common/app`. Tests sit beside the source as `*.test.ts(x)`.

## Generated files and sync steps

`pnpm verify` fails if any of these are stale:

- **`project.json`** is the single source of truth for version, URLs, service ports, store IDs and supported languages. After editing it, run `pnpm sync:project` and commit the regenerated files (including `.nvmrc`, `package.json` engines and `common/extension.json`). Never edit `common/extension.json` by hand. Code imports it as `@project/common/project`; docs import it as `@site/src/project`. If tool version checks block the sync, run `node scripts/sync-project-config.ts` directly. Maintainers update `releases.extension.publishedVersion` and the per-language `languages[].version` (via `pnpm bump:loc`), so leave them alone in feature work.
- **`external-api/openrpc.json`** is generated from the zod schemas in `common/external-commands/external-api.ts`. Run `pnpm run generate:external-api`.
- **Localization**: add new keys to `common/locales/en.json` first, then run `cd scripts/loc && node ./merge-loc-from-en.js` to copy them to every other locale. `loc-keys-match` requires identical key sets. Translations come from Crowdin, so don't hand-translate other locales.
- **`version`** in `project.json` is the extension version. Bump it only when a runtime compatibility check needs a new version (minor, never major). Most changes leave it alone.

## Architecture

### Packages

- `common/` (`@project/common`) holds almost all of the logic and UI: subtitle parsing (`subtitle-reader`), Anki export (`anki`), settings (`settings`), key bindings (`key-binder`), audio/image capture (`audio-clip`, `src/media-fragment`), annotations/dictionary (`annotations`, `dictionary-db`, `yomitan`), and the React player app itself (`common/app`). It is imported by subpath, e.g. `@project/common/settings`.
- `client/` is a thin Vite shell around `common/app` (`client/src/components/WebsiteApp.tsx`) plus the FFmpeg runtime loader and localStorage-backed storage implementations.
- `extension/` is a [WXT](https://wxt.dev) extension. `@/` maps to `extension/src`.
- `ffmpeg/` is an independently versioned FFmpeg WASM runtime. Normal dev downloads a prebuilt artifact pinned in `ffmpeg/artifact-lock.json`, so neither Docker nor an FFmpeg build is needed.
- `docs/` is the Docusaurus site for docs.asbplayer.dev. Update it when adding user-facing features.
- `plugins/anki` is a Python Anki add-on (uv). `scripts/web-socket-server` is a Go WebSocket broker for external control.

### Storage abstraction

The same code runs in the web app, in the extension's side panel, and inside extension iframes, so persistence sits behind interfaces with one implementation per environment. For example, `SettingsProvider` is backed by `client/src/local-settings-storage.ts`, `extension/src/services/extension-settings-storage.ts`, or `common/app/services/app-extension-settings-storage.ts` (the app asking the extension). Global state, logs, the dictionary DB and copy history follow the same pattern. When adding persisted data, implement every backend.

### Extension runtime and messaging

Several contexts communicate through typed `Command<Message>` envelopes defined in `common/src/command.ts` and `common/src/message.ts`. The envelope's `sender`/direction (e.g. `VideoToExtensionCommand`, `ExtensionToAsbPlayerCommand`, `AsbPlayerToVideoCommandV2`) determines routing:

- **Background** (`entrypoints/background.ts`) registers a list of `CommandHandler`s from `src/handlers/<sender>/`. Each handler declares its `sender` and `command`. `TabRegistry` (`services/tab-registry.ts`) tracks video elements and asbplayer instances across tabs. To add a message, define it in `common/src/message.ts`, add a handler, and register it in `background.ts`.
- **`video.content`** (`entrypoints/video.content/`) runs in every frame. `services/binding.ts` (`Binding`) attaches to each `<video>` element and drives subtitle rendering (`controllers/subtitle-controller.ts`), recording, mining and overlays.
- **`page.content`** + **page scripts**: `src/pages.json` maps host regexes to `entrypoints/<site>-page.ts`, which get injected into the page's own JS context to discover subtitle tracks (shared helpers live in `src/pages/`). `base-generic-page`/`aggressive-generic-page` are the fallbacks.
- **Extension UIs** (popup, side panel, Anki dialog, notifications, etc.) live in `src/ui` and are rendered in iframes. They talk to the content script through `src/ui/bridge.ts`.
- **App ↔ extension**: the web app and side panel reach the extension through `common/app/services/chrome-extension.ts` (window `postMessage` relayed by `asbplayer.content.ts`). Webapp changes must stay backwards compatible with older extensions, because the two deploy independently. Gate new behavior on the extension's reported version.

### Adding a streaming-site integration

See commit `75bd81fb` for an example. A new site touches:

- `extension/src/pages.json`
- a new `extension/src/entrypoints/<site>-page.ts`
- `extension/wxt.config.ts`
- the `PageSettings` entries in `common/settings/settings.ts` and `settings-provider.ts`
- `common/pages/index.ts` (with a unique `disableCspRuleId`)
- a favicon in `extension/public/page-favicons/`
- `docs/docs/compatibility.md`

## Contribution conventions (from CONTRIBUTING.md)

- AI-assisted commits must carry a trailer such as `Assisted-by: Claude:claude-opus-5-5`.
- Discuss large features with maintainers (GitHub issue or Discord) before opening a big PR.
- Make sure `pnpm run verify` passes before opening a PR.
