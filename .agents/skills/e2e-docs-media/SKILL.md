---
name: e2e docs media
description: Use when adding or changing documentation screenshots, images, or demo recordings produced by the Playwright harness in e2e/.
---

# e2e docs media

Produce committed documentation media with the Playwright harness in `e2e/`. Read
`e2e/README.md` for structure and conventions.

## Pick the output

- **Docs image or data**: a spec in `e2e/shots/`, run with
  `pnpm --filter @project/e2e shots`.
- **Demo video**: a demo-mode test spec, run with
  `pnpm --filter @project/e2e demo`.
- **Behavior coverage**: a spec in `e2e/tests/`, run with
  `pnpm --filter @project/e2e test` (part of `pnpm verify`).

Reuse `e2e/scenarios/` for the flow. A scenario performs steps and asserts nothing. Specs
add assertions, capture, or both.

## Steps

1. Read the docs section the media illustrates. Note the UI state for each step.
2. Reuse or add a scenario. Keep mode-specific behavior out of it.
3. Add a spec.
   - Screenshots: measure with `boundingBox()` and capture a clipped
     `page.screenshot`; see `paddedScreenshot` in `shots/mining-in-depth.spec.ts`.
     Build docs images with the `Screenshot` component. Do not inject fake UI.
   - Video: perform the flow, then in demo mode close the page before
     `video.saveAs()`, and crop with `cropVideo()` from `fixtures/video.ts`.
4. Run the spec and check the artifact: dimensions, duration, and that no transient UI is
   missing or clipped. Add an assertion for anything a screenshot depends on.
5. Wire it into the MDX with `Screenshot` or `Video` at the artifact's native width.
   Image-map data lives in `docs/src/generated`.
6. Verify with `pnpm --filter asbplayer-docs run build:en`.

## Pitfalls

- The controls overlay exists only when subtitles are loaded and the video is paused.
- `page.setViewportSize` resizes the shared window and distorts recordings. Pass
  `panelViewport` only when a panel-sized page is the artifact.
- `video.saveAs()` waits for the page to close. Close the page first.
- The overlay control carousel advances only on fractional wheel deltas.
- Element screenshots include parent-page overlays above an iframe, such as snackbars.
  Wait for transient UI through a stable hook, for example
  `[data-alert-key="app-alert"]`.
- Extension media capture needs an `activeTab` grant that automation cannot provide.
  Mine a video file in the web app to capture the frame and audio.
- Headed runs do not render the extension's Anki dialog UI. Record demos headless.
- If a locator for an icon button fails, add an `aria-label` to the control and use
  `getByLabel`, rather than falling back to icon internals or CSS classes.
- Only build the `en` docs locale while translations are out of date, and do not run
  `scripts/check-docs-i18n.ts` in that period.
