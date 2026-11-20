# S01: Land NPO Start

Status: Done (2026-11-20)
Branch: `feat/npo-start-subtitles` (existing; 4 commits ahead of `main`, merges cleanly as of 2026-11-20)

## Problem
Most Dutch content is on NPO Start, which `main` doesn't support. The integration is already written on a branch and has a draft upstream PR (killergerbah/asbplayer #1491), but it isn't in the build being used.

## Scope
- In scope: verify the branch, fix anything found, and merge it into the fork's `main`.
- Out of scope: getting the upstream PR accepted. That can continue on its own.

## Acceptance criteria
- [x] On an NPO Start episode with Dutch subtitles, the subtitle track is detected automatically and shown in the overlay.
- [x] Mining a line on NPO Start creates a card with the sentence and audio.
- [x] YouTube and Netflix still work (smoke test).
- [~] `pnpm run verify` is green on the merged result. (Partly: see the verification log.)
- [x] `extension/src/pages/npo.test.ts` passes.

## Plan
1. Check out the branch and run `pnpm --filter @project/extension exec jest src/pages/npo.test.ts`.
2. Build the dev extension and test the acceptance criteria manually on NPO Start.
3. Merge into `main` (fast-forward or merge commit, your choice).

Risks: NPO Start requires a login, and its player or CDN format may have changed since the branch was written.

## Verification log
- Merged into `main` as a fast-forward to `43cc2b1c` and pushed to origin on 2026-11-20.
- `npo.test.ts`: 17/17 pass.
- `pnpm run verify` (Windows, `core.autocrlf=true`): typecheck, compile, Jest for common/client/extension, eslint, loc-keys and page-file-references all pass, and prettier is clean on the merged files. Failing for environment reasons, in paths the merge didn't touch:
  - `check:project` and `check:external-api` fail on CRLF drift.
  - `pretty:check` fails because cmd.exe can't parse the glob.
  - `test:scripts` has 3 failures and `ffmpeg verify:code` has 99.
  - Follow-up: rerun under Git Bash or WSL with LF line endings.
- Manual check: the user confirmed NPO Start works (subtitles and mining), along with the YouTube and Netflix smoke test.

## Retro
