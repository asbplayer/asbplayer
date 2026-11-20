# Product spec: personal asbplayer fork

Status: draft v1 (2026-11-20). This is a living document, and the roadmap is re-ranked after every slice.

## 1. Vision

The fork is a Chrome extension for learning Dutch from streaming video. A line you want to keep becomes a clean Anki card (sentence, audio and target word) in a few keystrokes. An agent fills in the definition later. Nothing on screen or in the settings exists unless this workflow uses it.

## 2. User and context

- One user, learning Dutch (a European language, so no furigana, readings or word segmentation are needed).
- Uses the browser extension on streaming sites in Chromium (Chrome, Edge or Brave). Doesn't use the web app with local files, the side panel, Firefox, or mobile.
- Sites: YouTube, Netflix, Amazon Prime, Disney+, NPO Start, and Stremio (maybe; it has little Dutch content).
- Anki through AnkiConnect. Card fields used: **sentence, audio clip, target word**. An external agent writes the **definition**, so the extension does not look anything up.

## 3. Problems to solve, ranked

1. **The Anki dialog is cluttered and mouse-driven.** It shows too many fields and controls (image, source, URL, three track fields, tags, a timestamp slider, three export buttons), picking the target word is awkward, and exporting needs the mouse.
2. **Settings overload.** There are about 126 settings keys and 77 key binds across 9 tabs, and most serve features this user doesn't use.
3. **NPO Start isn't supported on `main`.** The work exists on `feat/npo-start-subtitles`.
4. **Codebase weight.** The web app, side panel, Firefox and mobile code, about 25 unused site integrations, the dictionary and annotation system, the external API and 13 locales all make every change slower and riskier.

## 4. Goals and success metrics

| Goal | Metric | Baseline (measured in S0) | Target |
|---|---|---|---|
| Fast mining | Actions from "I want this line" to a card in Anki, including picking the word | measure in S0 | 3 or fewer: shortcut, pick word, Enter |
| No mouse needed | Can mine a card with the keyboard only | No | Yes |
| Calm dialog | Controls visible in the dialog by default | count in S0 | Sentence, word, audio, actions |
| Small settings | Settings shown on the default settings screen | about 126 keys over 9 tabs | 20 or fewer on one screen, the rest under Advanced |
| Dutch content works | NPO Start subtitles load and can be mined | No (not on main) | Yes |
| Lighter codebase | Lines in `extension/src` + `common` | measure in S0 | Trend down every pruning slice |

## 5. Requirements

### Must keep

- Subtitle detection and overlay on YouTube, Netflix, Amazon Prime, Disney+, NPO Start, and Stremio (Stremio pending a decision).
- Loading subtitle files manually and adjusting subtitle offset and sync.
- Mining: audio recording with padding, the sentence, the target word, and exporting or updating cards through AnkiConnect.
- Mining history. **Open question:** where should it be viewed once the side panel is gone? The popup, or a small extension page?
- Subtitle appearance settings: font, size, position, and showing or blurring the subtitles.
- Basic playback key binds: seek to previous or next subtitle, toggle subtitles, adjust the offset.

### Change

- **Anki dialog:** by default it shows only the sentence, word and audio. Clicking a word in the sentence sets it as the target word (and optionally highlights it in the sentence field). The dialog is fully keyboard-driven, with Enter to export and Esc to cancel. Everything else sits behind a collapsed "More" section, or is deleted.
- **Settings:** one Essentials screen (AnkiConnect URL, deck, note type, field mapping, audio padding, the mining shortcut, subtitle appearance, and per-site toggles), with an Advanced screen behind it. Settings for deleted features are deleted.

### Add

- **Agent hand-off contract (S4):** mined cards are recognizable and complete enough for the definition agent to process them. One possibility is a `needs-definition` tag plus the word in the word field. The details depend on the open questions below.

### Remove (candidates; each one is its own slice, confirmed before deleting)

- Firefox MV2 and Firefox Android builds, mobile overlay and gestures, and the Firefox audio-recorder path.
- Site integrations other than the six above.
- Side panel and its use of `common/app`.
- The web app (`client/`, `ffmpeg/`, the Vite shell, `common/app` where the extension doesn't use it), and the docs site `docs/`.
- WebSocket and external API (`external-api/`, `common/external-commands`, `scripts/web-socket-server`).
- Dictionary, annotations, Yomitan, WaniKani and statistics (`common/dictionary-db`, `annotations`, `yomitan`, `wanikani`, `dictionary-statistics`, the statistics overlays).
- Localization other than English, and the Crowdin workflow.
- Tutorials and first-run screens, recipes, settings profiles, bulk export, animated WebP, manual recording (the last one to be confirmed).
- `plugins/anki` (the Python add-on).

## 6. Non-goals (for now)

- Renaming or rebranding the fork.
- Publishing to the Chrome Web Store. The extension is loaded unpacked.
- Building definitions or any LLM into the extension. The agent handles that outside it.
- Keeping upstream merges easy. Upstream fixes are cherry-picked by hand when wanted. **Exception:** the NPO work also has an upstream draft PR (killergerbah/asbplayer #1491). It can be finished upstream independently, and the fork doesn't wait on it.

## 7. Constraints and conventions

- AGENTS.md's upstream rules about docs updates, web-app/extension backward compatibility and Crowdin stop applying once the related code is deleted. S0 adds a "Fork conventions" section to AGENTS.md saying this.
- `pnpm run verify` stays the gate. Pruning slices update the verify scripts when they remove packages.
- Every slice leaves the extension working in Chrome on YouTube and Netflix. That's the smoke test.

## 8. Open questions

1. **Agent contract:** how does your agent find new cards? By tag, by an empty definition field, by deck, or by a list you hand it? What note type and field names does it expect? Should the extension mark the target word inside the sentence (for example `<b>word</b>`)?
2. **Mining history:** do you use it? If you do, where should it live once the side panel is gone?
3. **Screenshots:** they're off for your cards. Should screenshots and image capture be deleted entirely, or kept in the code but disabled?
4. **Second subtitle track:** do you ever load an English track alongside the Dutch one?
5. **Stremio:** keep it or drop it?
6. **NPO upstream PR:** will you keep pursuing upstream PR #1491, or is the fork now the only place this lives?

## 9. Slice roadmap (re-ranked after each slice)

The order puts quick wins on your daily workflow first, then pruning, which shrinks the settings for free, then consolidating what's left.

| # | Slice | Value | Size |
|---|---|---|---|
| S0 | **Baseline and fork conventions.** Build, load unpacked, mine one card on YouTube and Netflix, record the metrics in section 4, add fork conventions to AGENTS.md. | Safety net, numbers to compare against | S |
| S1 | **Land NPO Start.** Merge `feat/npo-start-subtitles` into `main` after a manual check on NPO Start. | Dutch content works | S |
| S2 | **Lean Anki dialog.** The default view is sentence, word and audio. Tags, slider, source, URL, image and tracks go under "More". Actions are reduced to Export and Update last. | Fixes clutter | M |
| S3 | **Click a word to make it the target word.** Clicking or selecting a word in the sentence sets the Word field. Marking it in the sentence is optional. | Fixes word picking | M |
| S4 | **Keyboard-first dialog.** Focus starts on the sentence. Arrow keys move between words, Space picks a word, Enter exports, Shift+Enter updates the last card, Esc cancels. | No mouse | M |
| S5 | **Agent hand-off contract** (blocked on open question 1). | Definitions flow | S–M |
| S6 | **Chrome-only.** Remove the Firefox and Android targets, the mobile overlay and the Firefox recorder. | Pruning | M |
| S7 | **Prune sites.** Keep the six sites, delete the rest along with their `PageSettings`, favicons and manifest entries. | Pruning, fewer settings | M |
| S8 | **Remove the dictionary, annotations, Yomitan, WaniKani and statistics.** | Pruning; DictionarySettingsTab alone is 2.4k lines | L |
| S9 | **Remove the external API and WebSocket.** | Pruning | S |
| S10 | **Remove the side panel** (and relocate mining history, see open question 2). | Pruning | M |
| S11 | **Remove the web app, ffmpeg, docs, plugins, and non-English locales.** | Pruning | L |
| S12 | **Settings: Essentials and Advanced** on what's left. | Fixes overload | M |
