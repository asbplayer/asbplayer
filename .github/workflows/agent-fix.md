---
description: |
  Bug-fix agent triggered by a `/agent` maintainer comment on an issue. Attempts a
  low-complexity, low-risk fix, verifies it offline with the repo's check scripts,
  and opens a PR containing the change and the plan used to produce it. Declines
  (comment only) when no such fix is found.

on:
  slash_command:
    name: agent
    events: [issue_comment]
  roles: [admin, maintain]
  reaction: eyes
  workflow_dispatch:
    inputs:
      issue-number:
        description: Issue to fix (manual/test runs)
        required: false
        type: string

model: gpt-6-luna
max-ai-credits: -1 # Bypass built-in pricing table
engine:
  id: codex
  env:
    OPENAI_BASE_URL: https://opencode.ai/zen/go/v1
    OPENAI_API_KEY: ${{ secrets.OPENCODE_GO_API_KEY }}

timeout-minutes: 60

network:
  allowed:
    - defaults
    - opencode.ai

permissions: read-all

safe-outputs:
  threat-detection: false
  create-pull-request:
    title-prefix: "[ai] "
    branch-prefix: "agent"
    allowed-files:
      - "client/**"
      - "common/**"
      - "extension/**"
  add-comment:
    max: 1

tools:
  bash: ["*"] # codex engine does not support bash allow-listing; network sandbox + safe-outputs bound this
  github:
    toolsets: [issues, repos]
    min-integrity: none # This workflow is allowed to examine and act on any issues

pre-agent-steps:
  - name: Setup Node.js and pnpm
    uses: ./.github/actions/setup-node-pnpm

  - name: Install workspace dependencies
    run: |
      pnpm install --filter @project/extension --filter @project/common --filter @project/client

  - name: Capture requesting maintainer
    env:
      AW_COMMENT_ID: ${{ github.event.comment.id }}
      AW_REPO: ${{ github.repository }}
      AW_FALLBACK_LOGIN: ${{ github.actor }}
      GH_TOKEN: ${{ github.token }}
    run: |
      # Comment-triggered runs: resolve the /agent commenter via the API
      # (the raw event payload is not accessible in this job on gh-aw).
      # Manual dispatch runs: fall back to the actor.
      ok=0
      if [ -n "$AW_COMMENT_ID" ]; then
        gh api "repos/$AW_REPO/issues/comments/$AW_COMMENT_ID" \
          --jq '(.user) as $u | {login: ($u.login // ""), id: ($u.id // 0)}' \
          > .agent-requesting-maintainer.json && ok=1
      fi
      if [ "$ok" = "0" ] || [ ! -s .agent-requesting-maintainer.json ]; then
        echo "{\"login\": \"$AW_FALLBACK_LOGIN\", \"id\": 0}" > .agent-requesting-maintainer.json
      fi
      cat .agent-requesting-maintainer.json
---

# Bug-fix agent

You were invoked by the `/agent` command on issue #${{ github.event.issue.number || inputs.issue-number }}.

Commented by: the maintainer who invoked `/agent`. Their login/id are in
`.agent-requesting-maintainer.json` at the repo root (do not commit this file).

## Your task

Read the issue and attempt to fix the reported problem **only if a low-complexity,
low-risk fix exists**. Otherwise, post a comment explaining your findings and why a
fix should not be attempted. Never invent scope: you fix bugs reported in the
issue, nothing more.

DO NOT post the same high-level narrative twice. Be brief in comments.

## Step 1: Investigate

1. Read the issue and its comments for linking context.
2. Reproduce the cause from the code. Referenced layout:
   - `common` (`@project/common`) — shared library used by both apps
   - `client` (`@project/client`) — web app
   - `extension` (`@project/extension`) — MV3 browser extension
3. Do not explore unrelated areas. Refer only to what touches the reported cause.
4. You may run read-only investigation commands.

## Step 2: Risk gate

Propose a change only if **all** of these hold. If any fail, go to "Decline":

- The fix is localized: at most a few files, small line count.
- No public-facing behavior or API change beyond fixing the bug.
- No changes to security-sensitive surfaces: authentication, permissions,
  network requests, storage, build configuration, CI configuration.
- The correct resolution is clearly deducible from the issue report and the
  codebase. If multiple plausible designs exist, fall to "Decline".

## Step 3: Implement and verify

Edit the minimum required files.

Verify offline (dependencies are pre-installed in `node_modules`). Run the
relevant subset of the repo's `verify` script. Match the tool(s) you changed:

```sh
pnpm --filter @project/common run typecheck
pnpm --filter @project/common run test
pnpm --filter @project/client run typecheck
pnpm --filter @project/client run test
pnpm --filter @project/extension run typecheck
pnpm --filter @project/extension run test
pnpm eslint common extension/src client/src
pnpm run pretty:check
```

Rules:

- Network access is blocked in this environment. Dependencies are already
  installed; don't install anything else. If a check fails due to the sandbox
  (e.g. it requires network), record it as "not verified" instead of trying to
  work around it.
- Only run checks relevant to the files you changed; prefer running full checks
  when affordable.
- If a verification failure reveals your fix is not low-risk or you cannot make
  checks behave correctly, abandon the attempt and go to "Decline", commenting
  the findings so far.

## Step 4: Emit PR

When `create-pull-request` is configured, git commands (`branch`, `switch`,
`add`, `commit`) are automatically available to you.

1. Commit your change on a new branch with a conventional-commit style message:
   imperative subject like `fix: prevent word wrap on double-width glyphs`, and
   in the message footer:

```text
Co-authored-by: <maintainer-login> <<maintainer-id>+<maintainer-login>@users.noreply.github.com>
```

`<maintainer-login>` is the commenting user shown at the top and
`<maintainer-id>` comes from the issue/comment payload. The trailer records the
requesting maintainer as co-author for provenance — keep it whenever the ID is
available; omit it if not (then the commit is bot-authored only, which is
acceptable).

If the co-author trailer fails for any reason, still emit the PR; the trailer
is best-effort and the maintainers can see the run that created it.

Emit a `create_pull_request` output with:

- `title`: `<short imperative description>` (the `[ai] ` prefix is applied
  automatically).
- `body`: must contain exactly these sections:

```markdown
## Plan

### Root cause

<the cause of the bug based on the issue>

### Approach

<the approach in >=3 bullets>

### Files changed

- `<path>` — <one-line reason>

### Verification

- [x] `<command>` — passed
- [ ] `<command>` — not verified (<reason>)

### Risk assessment

<why this is low-complexity and low-risk>
```

- `branch`: pattern `agent/<short>` e.g., `agent/fix-word-wrap`.

`auto-close-issue` is enabled, so "Fixes #N" is appended automatically when the
command was issued on an issue.

## Decline

If the risk gate fails, verification fails, or the bug isn't reproducible from the
issue, post exactly one comment that:

1. summarizes the diagnosis (or that no diagnosis could be reached),
2. states why no fix was attempted (not low-risk / not low-complexity /
   ambiguous / not reproducible), and
3. optionally suggests follow-ups the maintainers can do.
