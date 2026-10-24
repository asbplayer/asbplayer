---
name: 'Agent: Draft extension release'
description: |
    Drafts a GitHub release for the current extension version with categorized
    release notes composed strictly from the version's milestone. Runs as a dry
    run by default, previewing the notes without creating the release.

on:
    workflow_dispatch:
        inputs:
            version:
                description: 'Extension version without the tag prefix (blank = read project.json)'
                required: false
                type: string
            target:
                description: 'Commitish the release tag points at (blank = main)'
                required: false
                type: string
                default: ''
            dry-run:
                description: 'Preview the release notes without creating a draft release'
                required: true
                type: boolean
                default: true

concurrency:
    group: draft-extension-release
    cancel-in-progress: false

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

tools:
    bash: true # Read-only usage only; sandboxed by the AWF firewall
    github:
        toolsets: [issues, pull_requests, repos]
        min-integrity: none

pre-agent-steps:
    - name: Setup Node.js
      uses: actions/setup-node@v7
      with:
          node-version-file: '.nvmrc'
    - name: Collect milestone items
      env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          INPUT_VERSION: ${{ inputs.version }}
          RELEASE_TARGET: ${{ inputs.target }}
      run: |
          bash scripts/release-notes/collect-milestone-items.sh "$INPUT_VERSION" milestone-items.md
          echo "--- milestone-items.md ---"
          cat milestone-items.md
          echo "--- release-meta.json ---"
          cat release-meta.json

safe-outputs:
    threat-detection: false
    staged: ${{ inputs.dry-run }}
    jobs:
        create-draft-release:
            description: >-
                Create or update the draft GitHub release for the extension version using the
                composed release notes. Call this tool exactly once, after composing the notes.
            runs-on: ubuntu-latest
            permissions:
                contents: write
            inputs:
                version:
                    description: 'Extension version without the tag prefix (e.g. 1.22.0)'
                    required: true
                    type: string
                body:
                    description: 'Release notes markdown, without the Full Changelog line or installation footer'
                    required: true
                    type: string
            steps:
                - name: Read project metadata
                  uses: actions/checkout@v7
                  with:
                      persist-credentials: false
                      sparse-checkout: |
                          project.json
                          .nvmrc
                          scripts/extension-release-info.ts
                      sparse-checkout-cone-mode: false
                - name: Setup Node.js
                  uses: actions/setup-node@v7
                  with:
                      node-version-file: '.nvmrc'
                - name: Create or preview draft release
                  env:
                      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                      GH_REPO: ${{ github.repository }}
                      TARGET: ${{ inputs.target }}
                      DRY_RUN: ${{ inputs.dry-run }}
                  run: |
                      set -euo pipefail

                      out="${GH_AW_AGENT_OUTPUT:-}"
                      if [ -z "$out" ] || [ ! -f "$out" ]; then
                        echo "::error::No agent output found"
                        exit 1
                      fi

                      version=$(jq -r '[.items[] | select(.type == "create_draft_release")] | last | (.version // empty)' "$out")
                      body=$(jq -r '[.items[] | select(.type == "create_draft_release")] | last | (.body // empty)' "$out")

                      if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                        echo "::error::Invalid or missing version in agent output: '$version'"
                        exit 1
                      fi
                      if [ -z "$body" ] || [ "$body" = "null" ]; then
                        echo "::error::No release notes body in agent output"
                        exit 1
                      fi

                      tag=$(node --experimental-strip-types scripts/extension-release-info.ts tag "$version")
                      title=$(node --experimental-strip-types scripts/extension-release-info.ts title "$version")
                      target=${TARGET:-main}

                      # Full Changelog compare URL. generate-notes needs write access, which this
                      # job has; fall back to the most recent other release if it fails.
                      compare_url=""
                      notes=$(gh api "repos/$GH_REPO/releases/generate-notes" \
                        -f tag_name="$tag" -f target_commitish="$target" --jq '.body' 2>/dev/null || true)
                      if [ -n "$notes" ]; then
                        compare_url=$(printf '%s\n' "$notes" \
                          | grep -oE 'https://github.com/[^ )]+/compare/[^ )]+' | head -n1 || true)
                      fi
                      if [ -z "$compare_url" ]; then
                        prev=$(gh api "repos/$GH_REPO/releases?per_page=30" \
                          --jq "[.[].tag_name] | map(select(. != \"$tag\")) | .[0] // empty" 2>/dev/null || true)
                        if [ -n "$prev" ]; then
                          compare_url="https://github.com/$GH_REPO/compare/${prev}...${tag}"
                        fi
                      fi

                      chrome_store_url=$(jq -r '.extension.chrome.storeUrl' project.json)
                      firefox_store_url=$(jq -r '.extension.firefox.storeUrl' project.json)
                      firefox_android_store_url=$(jq -r '.extension.firefoxAndroid.storeUrl' project.json)
                      docs_url=$(jq -r '.urls.docs' project.json)

                      # Final body: agent notes + Full Changelog + installation footer from project metadata.
                      {
                        printf '%s\n' "$body"
                        echo
                        if [ -n "$compare_url" ]; then
                          echo "**Full Changelog**: $compare_url"
                          echo
                        fi
                        cat <<FOOTER
                      ## Installation on Chromium-based browsers
                      Install from the [Chrome web store listing]($chrome_store_url).

                      ## Installation on Firefox
                      > [!WARNING]
                      > The Firefox version cannot record audio from DRM-protected video streams.

                      Install from the [addon page]($firefox_store_url).

                      ## Installation on Firefox for Android
                      > [!WARNING]
                      > The Firefox version of asbplayer has an even smaller feature-set than the Firefox version. In addition to all of the features the Firefox version is missing, it is also missing the side panel, keyboard shortcuts and screenshot capture. Anki integration can be achieved using [AnkiConnect for Android](https://github.com/KamWithK/AnkiconnectAndroid).

                      Install from the [addon page]($firefox_android_store_url).

                      ## Usage
                      See the [user guide]($docs_url).
                      FOOTER
                      } > full-body.md

                      # Dry run: preview the body, never touch the GitHub releases API. The
                      # staged flag is set by the workflow input via safe-outputs.staged.
                      if [ "${GH_AW_SAFE_OUTPUTS_STAGED:-}" = "true" ] || [ "${DRY_RUN:-}" = "true" ]; then
                        {
                          echo "## Staged Mode: Draft extension release preview"
                          echo
                          echo "Would create or update a draft release:"
                          echo
                          echo "- tag: \`$tag\`"
                          echo "- title: \`$title\`"
                          echo "- target: \`$target\`"
                          echo
                          echo "### Release body"
                          echo
                          cat full-body.md
                        } >> "$GITHUB_STEP_SUMMARY"
                        echo "Dry run: no release was created or modified."
                        exit 0
                      fi

                      existing_is_draft=$(gh release view "$tag" --json isDraft -q .isDraft 2>/dev/null || echo "missing")

                      if [ "$existing_is_draft" = "false" ]; then
                        echo "::error::A published release already exists for $tag. Refusing to modify it."
                        exit 1
                      fi

                      if [ "$existing_is_draft" = "true" ]; then
                        gh release edit "$tag" --draft --title "$title" --notes-file full-body.md
                        echo "Updated existing draft release $tag"
                      else
                        gh release create "$tag" --draft --target "$target" --title "$title" --notes-file full-body.md
                        echo "Created draft release $tag"
                      fi

timeout-minutes: 30
---

# Draft extension release notes

You are composing the body of a **draft** GitHub release for the asbplayer browser
extension. A human maintainer reviews the draft, writes the release summary, and
publishes it. Your job is only the categorized change lists.

## Input data

- `milestone-items.md` in the workspace root: every issue and pull request attached
  to the milestone `Extension v<version>`. Each block lists the number, kind, state,
  merge status, author, labels, changed files (for pull requests) and a truncated body.
- `release-meta.json`: the resolved `version`, `milestone`, `milestone_number` and a
  best-effort `compare_url`.

The milestone is the **only** source of items. Do not derive items from the git
history, from GitHub's auto-generated release notes, or from anything that is not in
`milestone-items.md`.

## Choosing items

1. Include every **merged** pull request in the milestone (its block has a
   `merged_at` value). Exclude pull requests closed without merging (`merged_at:
   (not merged)`).
2. Issues: include an issue only when no milestone pull request implements it. Most
   issue/pull request pairs describe the same change, so prefer the pull request
   line. If you are unsure whether an issue is covered by a pull request, omit the
   issue.
3. Exclude Dependabot. Never include an item whose author contains `dependabot`, or
   any dependency-upgrade pull request. These must not appear in the release notes
   even when they are part of the milestone.
4. Never add an item that is not in `milestone-items.md`, and never invent numbers,
   handles, or links.

## Categorization

Group every included item under exactly one of these sections:

- `### Enhancements` — new user-facing features or capabilities.
- `### Bug fixes` — corrections to incorrect behavior.
- `### QoL` — quality-of-life improvements, refactors, developer tooling, logging,
  performance, build and release plumbing, and internal documentation.

Labels are hints, not the final word: a `bug`-labeled change that is really a
refactor belongs under QoL, and a `documentation` change may be QoL. Decide from the
title, body and changed file paths. Only when the category is genuinely ambiguous,
use the read-only GitHub tools (for example `pull_request_read` or
`search_pull_requests`) to look at a pull request's diff; skip that if the diff is
very large (more than roughly 5000 changed lines) and categorize from metadata
instead.

You may add `####` sub-groupings under a section when several bullets clearly belong
together (for example, per-site subtitle detection). Omit a section entirely when it
has no entries.

## Formatting

Every bullet must match the existing release style exactly:

```text
- <concise user-facing description> by @<author> in https://github.com/asbplayer/asbplayer/pull/<number>
```

- Rephrase unclear pull request titles into short, user-facing descriptions. Do not
  copy a title verbatim when it is not understandable.
- Use the author handle from `milestone-items.md` verbatim; do not rewrite it.
- For an included issue that has no implementing pull request, link the issue URL
  instead of a pull request URL.

## New contributors

Add a `## New Contributors` section when any author of an included bullet made their
first contribution to this repository in this milestone. For each unique author,
find their earliest merged pull request using the read-only GitHub search tools; if
it belongs to this milestone, add a line:

```text
* @handle made their first contribution in <url>
```

Ignore bots. Omit the whole section when you can determine no new contributors.

## Output

- Do **not** write any summary prose. Leave the placeholder comment below the
  `## What's Changed` heading exactly as shown for the human to replace.
- Do **not** include a Full Changelog line or the installation/usage sections — the
  release job appends them.
- Compose the body in exactly this structure (omit any section that is empty):

```markdown
## What's Changed

<!-- Human: write the release summary here. Do not auto-generate. -->

### Enhancements
- ...

### Bug fixes
- ...

### QoL
- ...

## New Contributors
* ...
```

Then call the `create_draft_release` tool exactly once with:

- `version`: the `version` value from `release-meta.json`.
- `body`: the composed markdown.

Call the tool exactly once even when the workflow is a dry run; the release job
handles the dry-run preview. If `milestone-items.md` contains no eligible merged
items, still call the tool with a body that says the milestone had no merged changes.
