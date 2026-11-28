# asbplayer e2e

Playwright harness that runs the built extension in Chromium and drives it with real
input. One library of scenarios is shared by CI tests, demo recordings, and documentation
images or videos.

## Modes

Modes are Playwright projects. The same specs can run under different modes.

- **test**: headless, assertions on, no artifacts. Part of `pnpm verify`.
- **demo**: headless, records video, injects a visible cursor, paces interactions.
- **shots**: headless, produces stills and data for the docs.

Scenarios are mode-agnostic. The mode is a project-level option that fixtures read.

## Scenarios

A scenario is a function that performs a flow and makes no assertions. Specs combine a
scenario with assertions (tests) or with capture (shots). The demo mode runs the test
specs.

## Determinism

- Extension language, first-run state, and settings are seeded before pages open.
- Media and pages are local. Nothing depends on external sites.
- Video is paused at a cue before asserting or capturing, and animations are disabled
  for screenshots.
- Transient UI, such as notifications, is waited out rather than hidden with CSS.
- The browser context has a fixed viewport, and screenshots emulate a color scheme.

## Selectors

Prefer, in order:

1. Role plus accessible name, or an existing label.
2. An `aria-label` added to the product, for an icon-only control.
3. A stable hook (`data-testid`, `data-alert-key`, a class on a UI iframe), for elements
   with no name or role.

Do not depend on MUI class names, icon internals, element order, or frame scanning.

## Outputs

- Tests produce no files.
- Shots write documentation images and data under the docs site's generated folders.
- Demo specs may save recordings or derived videos under the docs site's generated folders.

## Requirements

- Playwright's Chromium: `pnpm --filter @project/e2e exec playwright install chromium`.
  Branded Chrome blocks unpacked extensions, so the harness loads Chromium in both
  headed and headless mode.
- Extension and web app builds. The global setup builds either one when it is missing.
- ffmpeg, for cropping and trimming demo videos.

## Limitations

- Chromium only. Firefox and Android builds are not covered.
- The side panel is browser chrome, so it is opened as a page in a tab. Shots that need a
  panel-sized page pass a narrow viewport.
- `activeTab` cannot be granted from automation, which rules out the extension's media
  capture. Mining a video file in the web app captures the frame and audio without it.
- Toolbar buttons, native menus, and command shortcuts are browser UI. They cannot be
  clicked or captured.
- Headed runs do not render the extension's Anki dialog UI. Record demos headless.
