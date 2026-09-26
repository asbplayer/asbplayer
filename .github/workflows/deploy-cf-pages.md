---
description: |
  Prepares a deploy pull request from main to cf-pages with LLM-generated release notes and a follow-up commit linking the app version to the deploy PR.

on:
  workflow_dispatch:

concurrency:
  group: deploy-cf-pages
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
  edit:
  bash: true # Sandboxed by the AWF firewall; the agent job has no write-scoped token

timeout-minutes: 30

jobs:
  prepare:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: read
    outputs:
      should_run: ${{ steps.deploy.outputs.should_run }}
      pr_number: ${{ steps.deploy.outputs.pr_number }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Prepare deploy branch
        id: deploy
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          gh auth setup-git # The compiler forces persist-credentials: false on checkout; use gh as the git credential helper

          # Fetch all relevant branches; deploy/cf-pages may not exist yet on the first run
          git fetch origin main cf-pages --no-tags
          if git ls-remote --exit-code --heads origin deploy/cf-pages >/dev/null 2>&1; then
            git fetch origin deploy/cf-pages --no-tags
            base=origin/deploy/cf-pages
          else
            base=origin/cf-pages
          fi
          git checkout -B deploy/cf-pages "$base"

          # Skip if the deploy branch already contains main (deploy already prepared)
          if git merge-base --is-ancestor origin/main deploy/cf-pages; then
            echo "should_run=false" >> "$GITHUB_OUTPUT"
            echo "deploy/cf-pages already contains main; nothing to do."
            exit 0
          fi

          commit_count=$(git rev-list --count origin/cf-pages..origin/main)
          if [ "$commit_count" -eq 0 ]; then
            echo "should_run=false" >> "$GITHUB_OUTPUT"
            echo "No new commits on main since the last cf-pages deploy; nothing to do."
            exit 0
          fi
          echo "should_run=true" >> "$GITHUB_OUTPUT"
          echo "Deploying $commit_count new commit(s) from main"

          # Merge incrementally so pushes fast-forward: first catch up with cf-pages (loc
          # bumps etc. may have landed there directly), then merge the new main commits
          if ! git merge origin/cf-pages --no-edit || ! git merge origin/main --no-edit; then
            echo "Merge conflicts while preparing deploy branch. Conflicting files:"
            git diff --name-only --diff-filter=U || true
            git merge --abort 2>/dev/null || true
            exit 1
          fi

          existing=$(gh pr list --head deploy/cf-pages --base cf-pages --state open --json number -q '.[0].number // empty')
          echo "pr_number=$existing" >> "$GITHUB_OUTPUT"

          git push origin deploy/cf-pages

  agent:
    needs: [prepare]
    if: needs.prepare.outputs.should_run == 'true'

pre-agent-steps:
  - name: Fetch deploy refs
    run: |
      set -euo pipefail
      git fetch --no-tags origin main cf-pages deploy/cf-pages
  - name: Collect commit authors
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      bash scripts/release-notes/collect-authors.sh origin/cf-pages origin/deploy/cf-pages deploy-authors.md
      echo "--- deploy-authors.md ---"
      cat deploy-authors.md

safe-outputs:
  threat-detection: false
  jobs:
    finalize-deploy:
      description: >-
        Create or update the cf-pages deploy pull request with the generated release notes and
        push a follow-up commit linking the app version to the deploy PR. Call this tool exactly
        once, after composing the release notes.
      runs-on: ubuntu-latest
      permissions:
        contents: write
        pull-requests: write
      output: "Deploy pull request finalized"
      inputs:
        pr-body:
          description: Full release notes markdown for the deploy PR body
          required: true
          type: string
      steps:
        - name: Checkout deploy branch
          uses: actions/checkout@v4
          with:
            ref: deploy/cf-pages
            fetch-depth: 0
        - name: Finalize deploy PR
          env:
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          run: |
            set -euo pipefail
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            gh auth setup-git # The compiler forces persist-credentials: false on checkout; use gh as the git credential helper

            pr_body=$(cat "$GH_AW_AGENT_OUTPUT" | jq -r '.items[] | select(.type == "finalize_deploy") | (.pr_body // ."pr-body")' | head -n 1)
            if [ -z "$pr_body" ] || [ "$pr_body" = "null" ]; then
              echo "No finalize_deploy item found in agent output"
              exit 1
            fi
            echo "$pr_body" > release-notes.md

            existing=$(gh pr list --head deploy/cf-pages --base cf-pages --state open --json number -q '.[0].number // empty')
            if [ -n "$existing" ]; then
              gh pr edit "$existing" --body-file release-notes.md
              echo "Updated deploy PR #$existing"
              pr_number="$existing"
            else
              pr_url=$(gh pr create --base cf-pages --head deploy/cf-pages --title "Deploy cf-pages ($(date +%F))" --body-file release-notes.md)
              pr_number="${pr_url##*/}"
              echo "Created deploy PR #$pr_number"
            fi

            echo "VITE_APP_VERSION_REPO_PATH=pull/$pr_number" > client/.env.production
            git add client/.env.production
            if git diff --cached --quiet; then
              echo "Env file unchanged; skipping commit."
            else
              git commit -m "chore: link app version to deploy PR #$pr_number"
              git push origin deploy/cf-pages
            fi

---

# Deploy cf-pages release notes

You are generating release notes for an asbplayer webapp deploy. The deploy branch `deploy/cf-pages` merges `main` into `cf-pages`. Your release notes will become the body of the deploy pull request from `deploy/cf-pages` to `cf-pages`, which deploys the web app.

The existing deploy PR number is ${{ needs.prepare.outputs.pr_number || 'not yet created' }}.

## Input data

- `deploy-authors.md` in the workspace root: one line per commit, formatted `short-sha|pr-number-or-dash|author-handle-or-name|subject`, covering all commits in the deploy range.
- The full git history is available locally. The deploy range is `origin/cf-pages..origin/deploy/cf-pages`.

## Investigation

Use the allowed read-only git commands to examine the changes in the deploy range. You may look at commit subjects, per-commit diffs, and combined diffs.

IMPORTANT: Only changes under `common/` and `client/` are relevant. The web app is built from those directories; `extension/`, `docs/`, `scripts/`, `loc/`, and other paths are NOT deployed to the web app and must not appear in the release notes. Use `git diff --stat origin/cf-pages..origin/deploy/cf-pages -- common client` and per-commit path filtering to scope your analysis. Commits that touch only excluded paths must be omitted entirely. For mixed commits, describe only the portion relevant to `common/` and `client/`.

## Output

Once you have composed the release notes, call the `finalize_deploy` tool exactly once with a single input `pr-body` containing the complete release notes in exactly this structure (matching the style of the asbplayer extension release notes):

```markdown
## What's Changed
<one short paragraph summarizing the overall scope of the webapp changes>

### Enhancements
* <description> by [@handle](https://github.com/handle) in <link>

### Bug fixes
* <description> by [@handle](https://github.com/handle) in <link>

### QoL
* <description> by [@handle](https://github.com/handle) in <link>

## Contributors
* [@handle](https://github.com/handle) - <count> contribution(s)
```

Rules:

1. Group every relevant change under exactly one of `Enhancements` (new features or capabilities), `Bug fixes` (fix incorrect behavior), or `QoL` (quality-of-life improvements, refactors, dev tooling). Omit a section entirely if it has no entries. You may add `####` sub-groupings if several bullets clearly belong together (e.g. per-site subtitle detection).
2. Attribution and links: if the commit maps to a PR number (not `-`) in `deploy-authors.md`, link `https://github.com/asbplayer/asbplayer/pull/<number>`; otherwise link `https://github.com/asbplayer/asbplayer/commit/<full-or-short-sha>`. Use the handle from `deploy-authors.md` verbatim; if it is a plain name and email instead of a handle, render it as plain text with no link.
3. Write concise, user-facing descriptions (e.g. "Fix fullscreen subtitles becoming unselectable post mine"). Do not copy raw commit subjects when they are unclear; rephrase based on the actual diff.
4. `Contributors` lists each unique contributor across all bullets, sorted by contribution count descending. Count each bullet the contributor authored.
5. Never invent PR numbers, handles, or links — only use data present in `deploy-authors.md` or git output. If the deploy range contains no `common/` or `client/` changes, the release notes should be a single line: "No web app changes in this deploy." — still call the tool with it.
6. A change that spans multiple commits (including its merge commit) must appear as exactly one bullet, attributed once to its contributor — never count duplicate commits of the same PR separately.
7. Render handles as plain `@handle` links without code formatting, backticks, or escaping — including bot handles like `@dependabot[bot]`.
8. Keep the entire document under 60 lines.

You must call the `finalize_deploy` tool exactly once with the composed release notes; this is the only way the deploy PR is finalized. Do not use any commands other than the allowed read-only git commands. Do not attempt to push branches, create PRs via other means, or run any other commands.
