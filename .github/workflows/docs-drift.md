---
name: "Agent: Docs drift audit"
description: |
  Weekly docs drift audit that verifies documentation correctness against the code and cross-checks duplicated documentation, reporting findings as a GitHub issue.

on:
  schedule:
    - cron: weekly on monday # Fuzzy schedule distributes execution times
  workflow_dispatch:

model: gpt-6-luna
max-ai-credits: -1 # Bypass built-in pricing table
engine:
  id: codex
  env:
    OPENAI_BASE_URL: https://opencode.ai/zen/go/v1
    OPENAI_API_KEY: ${{ secrets.OPENCODE_GO_API_KEY }}

network:
  allowed:
    - defaults
    - opencode.ai

permissions: read-all

safe-outputs:
  threat-detection: false
  create-issue:
    title-prefix: "[docs-drift] "
    labels: [documentation]
  allowed-domains:
    - docs.asbplayer.dev

tools:
  bash: true # Sandboxed by the AWF firewall; read-only usage only
  web-fetch:
  github:
    toolsets: [issues, repos] # Used only to check for an existing open docs-drift issue

timeout-minutes: 90

pre-agent-steps:
  - name: Fetch full history
    run: |
      set -euo pipefail
      # The compiled agent checkout is shallow (fetch-depth: 1); un-shallow it so the
      # full git history is available for the audit.
      if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
        git fetch --unshallow origin
      fi
      git fetch --no-tags origin main
  - name: Collect recent contributors
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      set -euo pipefail
      # Authors of merged PRs since the newest "Acknowledge" commit that touched the
      # acknowledgement files; the agent compares these against the contributor lists.
      last_ack=$(git log --format='%H' -1 --grep='^Acknowledge' origin/main -- README.md docs/docs/acknowledgements.md)
      if [ -n "$last_ack" ]; then
        bash scripts/release-notes/collect-authors.sh "$last_ack" origin/main recent-contributors.md
        echo "--- recent-contributors.md ---"
        cat recent-contributors.md
      else
        echo "No 'Acknowledge' commit found" > recent-contributors.md
      fi
  - name: Collect release info
    run: |
      set -euo pipefail
      {
        echo "## Latest extension version (extension/wxt.config.ts)"
        grep -n "const version" extension/wxt.config.ts || true
        echo
        echo "## Newest release blog posts"
        ls -1 docs/blog/*.mdx | tail -5
        echo
        echo "## Newest git tags"
        git tag --sort=-creatordate | head -5
      } > release-info.md
      echo "--- release-info.md ---"
      cat release-info.md

---

# Docs drift audit

You are auditing the asbplayer repository for drift between code and documentation, and between documentation files. You have read-only access: investigate only. Never edit files, never create branches or PRs, never comment on other issues. Your ONLY output action is calling the `create_issue` tool, exactly once (see Output).

## Input data

Pre-generated files in the workspace root:

- `recent-contributors.md`: one line per commit merged to main since the newest "Acknowledge..." commit that touched the acknowledgement files, formatted `short-sha|pr-number-or-dash|author-handle-or-name|subject`.
- `release-info.md`: latest extension version from `extension/wxt.config.ts`, newest release blog posts, newest git tags.

The full git history is available locally.

## Sources of truth

| Data | Source of truth |
| --- | --- |
| Key bindings (app) | `common/settings/settings.ts` `KeyBindSet` interface; default values in the `keyBindSet` block in `common/settings/settings-provider.ts` |
| Key bindings (extension) | `ChromeBoundKeyBindName` in `common/settings/settings.ts` and its usages (e.g. `chromeCommandBindsToKeyBinds`), plus the extension's command definitions |
| Settings and their defaults | `common/settings/settings.ts` `Settings` interface; defaults in `common/settings/settings-provider.ts`; UI labels/wording in `common/locales/en.json` and components under `common/components/`, `common/app/components/` |
| Released features | `docs/blog/*.mdx` release posts, git tags, and git history |
| Recent contributor data | `recent-contributors.md` |

## Documents to audit

Inventory everything first, then audit each: `README.md`, all of `docs/docs/**` (`intro.md`, `reference/settings.md`, `guides/*`, `common-issues.md`, `compatibility.md`, `contributing.md`, `acknowledgements.md`, `getting-started/*`), `docs/blog/*.mdx`, `plugins/anki/README.md`, and any other package READMEs.

## Detection procedure

Record every finding with evidence from BOTH sides (file:line for the doc, file:line for the code). Verify each finding by re-reading the current code before recording it; never rely on memory or on test fixtures. If a check is inconclusive, state why instead of guessing.

1. **Keyboard shortcut tables** in `docs/docs/reference/settings.md` (the `### ... keyboard shortcuts` tables). Compare bidirectionally:
   - Every `KeyBindSet` entry (and extension command) must appear as a table row; every table row must map to a real key bind. Report rows for binds that no longer exist and binds that have no row.
   - Each documented default must equal the code default. Code defaults are written `isMacOs ? '⇧+⌃+X' : 'ctrl+shift+X'`; the docs tables use the non-mac rendering (`Ctrl + Shift + X`). Normalize (⇧ = Shift, ⌃ = Ctrl) before comparing.
   - Rows with an empty documented default must correspond to binds whose code default is `''`, and vice versa.
   - Also verify shortcuts referenced elsewhere (README "Getting Started" step 6, `docs/docs/guides/mining-in-depth.md`, `docs/docs/guides/subtitle-timing.md`, `docs/docs/common-issues.md`) against the code defaults.

2. **Settings reference** (`docs/docs/reference/settings.md` vs code):
   - Every documented setting must exist in the `Settings` interface; report settings that were removed from code but are still documented.
   - Report user-visible settings that have no documentation (check UI components and `common/locales/en.json` keys against the reference).
   - Documented default values, option lists, and option labels must match code defaults and `en.json` strings.

3. **Released vs planned**:
   - In `README.md` and `docs/docs/intro.md`, for each item listed as planned/future ("Many more features for future releases!"), search the codebase and release blog posts. If it is implemented and shipped, report "advertised as upcoming but already released".
   - Also report notable shipped features missing from the README/intro feature lists (compare against recent release posts and `git log`).

4. **README ↔ docs duplication**: compare `README.md`'s feature bullet list against `docs/docs/intro.md` bullet-by-bullet; report any content divergence (missing bullets, different wording of the same feature).

5. **Acknowledgements**: compare the Contributors, Translators, and Sponsors lists between `README.md` and `docs/docs/acknowledgements.md` — sets AND order AND entry format (links, bold, plain names) must match exactly. Then compare the lists against `recent-contributors.md`: report contributors with merged PRs since the last "Acknowledge" commit who are missing from both lists. Ignore bot authors (`github-actions[bot]`, `dependabot[bot]`). If `killergerbah` appears missing, ignore them. They should not be added to the Contributors list.

6. **Cross-references and dead links**: verify anchors between `guides/*`, `common-issues.md`, and `reference/settings.md` headings (e.g. `#seek-keyboard-shortcuts`), internal doc links, image paths, and links to app URLs (`?view=...` routes must exist in the code).

7. **Stale facts**: anything checkable against the repo — version numbers (vs `release-info.md`), commands (`pnpm` vs `yarn`), file paths, build instructions in README "Notes for AMO source code reviewers" and `docs/docs/contributing.md`.

## Output

First, use the GitHub tools to check for an existing OPEN issue whose title contains `Docs drift report`. If one exists, do NOT create a new issue: end the run and state that an open report already exists.

Otherwise call the `create_issue` tool exactly once, titled `Docs drift report (<today's date>)`, with a body structured as:

```markdown
## Summary

<N> findings: <N> high, <N> medium, <N> low

## Findings

### <Category> — <short title> (severity: high|medium|low)

- **Docs:** <file>:<line(s)> — <what it currently says>
- **Code:** <file>:<line(s)> — <what it actually is>
- **Suggested fix:** <concrete edit>
```

Rules:

- Severity: **high** = factually wrong or missing (wrong keybind, removed setting still documented, missing acknowledged contributor); **medium** = incomplete (undocumented new setting, README/intro divergence, released-but-still-planned); **low** = cosmetic/stylistic drift.
- Findings must be backed by evidence you actually read. Do not invent settings, binds, contributors, or links. When unsure, mark severity **low** and note the uncertainty.
- Group findings by category (same category numbers as above).
- If there are zero findings, do NOT call `create_issue`; report "No docs drift found." and stop.
- Keep the issue body under 200 lines: no diffs, no speculation.
