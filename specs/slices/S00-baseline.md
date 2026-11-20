# S00: Baseline and fork conventions

Status: Specced
Branch: `slice/00-baseline`

## Problem
Before changing anything we need proof that the fork builds and mines a card end to end in Chrome, plus starting numbers so later slices can show improvement. AGENTS.md also still describes upstream rules (docs updates, web-app backward compatibility, Crowdin) that will stop applying.

## Scope
- In scope:
  - Build and load the Chrome dev extension.
  - Mine one card on YouTube and one on Netflix.
  - Record the baseline metrics.
  - Add a "Fork conventions" section to AGENTS.md.
- Out of scope: any change to the product code.

## Acceptance criteria
- [ ] `pnpm i` and `pnpm --filter @project/extension dev` produce `extension/.output/chrome-mv3-dev`, and it loads unpacked in Chrome without errors.
- [ ] A card with sentence, audio and word is created in Anki from YouTube and from Netflix using the current flow.
- [ ] Baseline metrics are recorded below: actions per card, seconds per card, controls visible in the dialog, settings tabs and keys, and LOC in `extension/src` and `common`.
- [ ] `pnpm run verify` result is recorded (green, or the failures listed).
- [ ] AGENTS.md has a "Fork conventions" section covering:
  - this is a hard fork
  - `specs/` drives the work
  - Chrome is the only target
  - docs, Crowdin and web-app compatibility rules are suspended for removed areas

## Plan
The only change is documentation. Counting LOC can be scripted (`git ls-files | xargs wc -l` filtered by path).

## Verification log
- `pnpm run verify`:
- Manual check:

## Baseline metrics
| Metric | Value |
|---|---|
| Actions per card (word included) | |
| Seconds per card | |
| Controls visible in the Anki dialog | |
| Settings tabs / keys | 9 / about 126 (plus 77 key binds) |
| LOC `extension/src` + `common` | |

## Retro
