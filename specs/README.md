# Specs

This fork is a personal hard fork of asbplayer. It is reshaped in small vertical slices instead of one big rewrite.

- [`product-spec.md`](product-spec.md) covers the vision, the user, the requirements, and the slice roadmap.
- `slices/` holds one file per slice, written just before it is built. Only the next one or two slices are fully specced, so later slices can change based on what we learn.

## The loop for each slice

1. **Spec.** Copy `slices/_template.md` and fill in the problem, the scope, the out-of-scope list and the acceptance criteria. Agree on it before writing code.
2. **Plan.** Add a short implementation plan to the slice file: the files to touch, the risks and the test approach.
3. **Build.** Work on branch `slice/NN-short-name`. Make small commits, each with an `Assisted-by:` trailer when AI-assisted.
4. **Verify.** Run `pnpm run verify`, then do the manual acceptance check in Chrome on YouTube and Netflix and record the result in the slice file.
5. **Ship.** Open a PR into `main` on the fork, merge it, and reload the unpacked extension.
6. **Review.** Spend 5 minutes writing what you learned at the bottom of the slice file, then re-rank the roadmap in `product-spec.md`.

## Definition of done

- All acceptance criteria pass, and the evidence is noted in the slice file.
- New logic has tests beside the source (`*.test.ts`).
- `pnpm run verify` is green.
- Deleted features leave no dead settings, locale keys, manifest entries or imports behind.
- The slice status below is updated.

## Slice board

| # | Slice | Status |
|---|---|---|
| S0 | Baseline and fork conventions | Specced |
| S1 | Land NPO Start (branch `feat/npo-start-subtitles`) | Done |
| S2 | Lean Anki dialog | Planned |
| S3 | Click a word to make it the target word | Planned |
| S4 | Keyboard-first dialog | Planned |
| S5 | Agent hand-off contract | Planned, has open questions |
| S6 | Chrome-only: remove Firefox and mobile | Planned |
| S7 | Prune site integrations | Planned |
| S8–S11 | Remove unused subsystems, one per slice | Planned |
| S12 | Settings: Essentials and Advanced | Planned |

See the roadmap in [`product-spec.md`](product-spec.md#9-slice-roadmap-re-ranked-after-each-slice) for each slice's scope.
