---
name: "Agent: Translate docs"
description: |
  Translates documentation. Only changed English source files are translated.
  A target language can be optionally specified. Otherwise all supported languages are targeted.

on:
  push:
    branches: [main]
    paths:
      - docs/docs/**
      - docs/src/pages/**
      - docs/docusaurus.config.ts
  workflow_dispatch:
    inputs:
      locales:
        description: "Comma-separated Docusaurus locales to translate (default: all)"
        required: false
        type: string

model: gpt-6-luna
max-ai-credits: 10000 # AWF's hard cap; a bootstrap run translating a full locale (~18k words) should fit, incremental runs use far less
engine:
  id: codex
  env:
    OPENAI_BASE_URL: https://opencode.ai/zen/go/v1
    OPENAI_API_KEY: ${{ secrets.OPENCODE_GO_API_KEY }}

checkout:
  # Full history: the create_pull_request merge-base computation needs origin/main
  # ancestry; shallow clones (.git/shallow) break it.
  fetch-depth: 0

network:
  allowed:
    - defaults
    - opencode.ai

permissions: read-all

safe-outputs:
  threat-detection: false
  create-pull-request:
    title-prefix: "[i18n] "
    branch-prefix: "docs-i18n"
    allowed-files:
      - "docs/i18n/**"

tools:
  bash: ["*"] # codex engine does not support bash allow-listing; network sandbox + safe-outputs bound this

timeout-minutes: 90

pre-agent-steps:
  - name: Setup Node.js and pnpm
    uses: ./.github/actions/setup-node-pnpm

  - name: Install docs dependencies
    run: pnpm install --filter asbplayer-docs

  - name: Generate translation JSON skeletons
    env:
      DOCS_TRANSLATE_LOCALES: ${{ inputs.locales }}
    run: |
      set -euo pipefail
      # write-translations needs the docs package's node_modules, so skeletons
      # are generated here (deterministically) instead of by the agent. It
      # merges new keys and preserves already-translated values, so reruns are
      # safe; running it unconditionally is what surfaces renamed sidebar
      # labels as new untranslated keys. Only the targeted locales are
      # generated: untranslated skeletons for other locales must stay out of
      # the workspace or they risk being committed before translation.
      if [ -n "${DOCS_TRANSLATE_LOCALES:-}" ]; then
        LOCALES=$(node scripts/docs-translation-worklist.ts --locales="${DOCS_TRANSLATE_LOCALES}" --print-locales)
      else
        LOCALES=$(node scripts/docs-translation-worklist.ts --print-locales)
      fi
      for locale in ${LOCALES}; do
        pnpm --filter asbplayer-docs exec docusaurus write-translations --locale "${locale}"
      done

  - name: Compute translation worklist
    env:
      DOCS_TRANSLATE_LOCALES: ${{ inputs.locales }}
    run: |
      set -euo pipefail
      if [ -n "${DOCS_TRANSLATE_LOCALES:-}" ]; then
        node scripts/docs-translation-worklist.ts --locales="${DOCS_TRANSLATE_LOCALES}"
      else
        node scripts/docs-translation-worklist.ts
      fi
---

# Docs translation agent

You translate asbplayer's English documentation into the locales listed in
`translation-worklist.json` at the repo root, then open a PR. This repo's
docs localization is agent-sourced by design: Crowdin handles only app and
extension strings.

## Terminology (read before translating anything)

1. `loc/glossary.json` is the primary reference. Apply every entry's
   `description` guidance:
   - "Do not translate" / "Keep as-is" entries (Anki, AnkiConnect, asbplayer,
     Jimaku, MeCab, WaniKani, Yomitan, i+1, Regex) survive verbatim.
   - "Use X's own localization" entries (Deck, Note type, Side panel) use
     that product's established terminology in the target language.
2. For every other glossary term, look up the target locale's established
   rendering in `common/locales/<app-code>.json` (`pt_BR.json`, `zh_CN.json`,
   …; the app code differs from the Docusaurus locale only for `pt-BR` →
   `pt_BR` and `zh-CN` → `zh_CN`) and reuse it exactly. If that value is
   still the English text (identical to the same key's value in
   `common/locales/en.json`), the app has not translated the string yet:
   use your best judgment instead, and apply that same rendering
   consistently everywhere the term appears in this run.
3. Keep the tone of the English source: instructional, concise, user-facing.
   The translation must read like the source, not like machine prose in the
   target language. In particular:
   - Translate at the source's confidence. Do not add intensifiers, hedges,
     or enthusiasm that the English sentence does not carry.
   - Preserve the source's sentence rhythm and structure within the norms of
     the target language; do not rebuild sentences into formulaic patterns.
   - Do not add attention hooks, rhetorical flourishes, or "engaging"
     phrasing the source does not have.
   - The source is already reviewed human writing; when in doubt, mirror it
     rather than improving it.
4. Reread each finished translation as a native reader of the target
   locale would, and fix literal-translation artifacts before committing:
   wrong or calqued particles in Japanese, article and case slips in German
   and Russian, English attribution formulas rendered word-for-word, and
   English word order kept anywhere the target language would reorder.

## Work

Read `translation-worklist.json`. If `translate`, `theme`, `deleted`, and
`sidebar` are all empty, there is no work: report "No docs translation
work." and stop without creating a PR.

### 1. Translate prose files

For each entry in `translate`, translate `<locale>/<file>` in place under
`docs/i18n/<locale>/docusaurus-plugin-content-docs/current/`. Translate body
prose only. The following must stay byte-identical to the English source:

- Frontmatter keys and all values except `title` and `description`.
- Fenced code blocks, MDX `import`/`export` statements, and JSX/HTML tags.
- Admonition types (`:::note` etc.; translate only their content), link
  targets, image paths, heading anchors (`{#...}`), file names and paths.

### 2. Sidebar labels

For each locale in `sidebar`, translate the label values in that locale's
`docs/i18n/<locale>/docusaurus-plugin-content-docs/current.json`: category
keys (`sidebar.tutorialSidebar.category.*`) and link keys
(`sidebar.tutorialSidebar.link.*`). Do not touch JSON keys. Never edit the
locale trees' `_category_.json` files: they are structural and kept
byte-identical to English by `pnpm sync:project`; category labels
translate through current.json only.

### 3. Deletions

For each entry in `deleted`, delete the listed files from the locale tree.

### 4. Theme strings

For each locale in `theme`, translate the `message` values (never the
keys) in that locale's `code.json`, `docusaurus-theme-classic/navbar.json`,
`docusaurus-theme-classic/footer.json`, and
`docusaurus-plugin-content-blog/options.json`; the skeleton files are
already generated in the workspace. `code.json` also carries the home
page's strings (`homepage.*` keys): translate those values too. The
blog's posts stay untranslated; only the plugin label strings above
localize. Some values may already be translated (a locale can be
partially done): leave translated values untouched and translate only
those still in English. Edit the values in place and keep each file's
existing formatting and key order; reformatting the file creates diff
churn and re-dirties the locale. Apply the same terminology rules as
above.

## Verification

Run the repo's docs i18n check and fix every reported violation before
continuing:

```sh
node scripts/check-docs-i18n.ts
```

Re-run until it passes. Node is available in the sandbox; no package
installation is needed for this check. If a failure looks like a check bug
rather than a translation error, stop and report it rather than editing
files to satisfy the check.

## Emit PR

`create_pull_request` is the only way your work reaches GitHub. It is the
tool exposed by the `safeoutputs` MCP server. Do not try anything else:
the sandbox has no git credentials, so `git push` fails, `gh` is
unavailable, and this workflow's GitHub MCP tools are read-only. Plain git
for local staging works and is expected:

1. Create the PR branch from the base branch:

   ```sh
   git switch -c docs-i18n/<short> origin/main
   ```

2. Commit exactly the files you changed under `docs/i18n/` (stage them
   individually) with a commit message matching the PR title below. Two
   exclusions: do not commit `translation-worklist.json`, and do not commit
   generated-but-untranslated files for locales outside this run's
   worklist; those skeletons are what keep such locales pending.

3. Call the `create_pull_request` tool with:

   - `title`: compare the locales in `translation-worklist.json` against
     `project.json`'s `languages`. If the worklist covers every language, no
     locale filter was specified: the title is just `Translate docs` and the
     locale list is omitted. If it targets one locale (a bootstrap run),
     `Translate docs into <locale>`. Any other subset: `Translate docs
     (<locales>)`.
   - `body`: exactly these sections:

   ```markdown
   ## Worklist

   - Translate: <"all supported locales, N files each" when no locale filter
     was specified; otherwise each locale with its file count>
   - Theme strings: <locales or "none">
   - Delete: <files or "none">
   - Sidebar labels: <locales or "none">

   ## Verification

   - [x] `node scripts/check-docs-i18n.ts`: passed
   ```

   - `branch`: the `docs-i18n/<short>` branch you created above.

The tool refuses patches touching anything outside `docs/i18n/`. If it
rejects your patch, remove the offending files rather than retrying.
