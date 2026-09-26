---
description: |
  Triage assistant for pull requests that scores pull request review priority based on useful metrics.

on:
  workflow_dispatch:
    inputs:
      pr-number:
        description: 'Optional PR number. If not specified triages all PRs.'
        type: string
      retriage:
        description: 'Ignore existing priority labels and retriage target PRs.'
        type: boolean

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
  add-labels:
    allowed: ["pr-p1", "pr-p2", "pr-p3"]
    max: 50
  remove-labels:
    allowed: ["pr-p1", "pr-p2", "pr-p3"]
    max: 50

tools:
  bash: false
  web-fetch:
  github:
    toolsets: [pull_requests, repos]
    min-integrity: none

timeout-minutes: 60
---

# Pull request triager

Analyze pull request #${{ inputs.pr-number || 0 }}. If the pull request number is 0, analyze all open pull requests in this repo. The retriage flag is ${{ inputs.retriage }}. If it is `true` then ignore existing priority labels and retriage the target PRs. Assign each target PR (whether it's a specific PR or all of the open PRs) a score in the range of 0-100 inclusive using the following formula:

```
score = maintainer + benefit + confidence + momentum
```

The variables are defined as follows:
  - `maintainer`: Value of 50 if the PR is authored by a user with `author_association` equal to `MEMBER`, `COLLABORATOR`, or `OWNER`. 0 otherwise. Use the `search_pull_requests` tool to obtain the `author_association`.
  - `benefit`: Value in the closed interval of 0-20. Highly beneficial PRs benefit either users or developers in a way that's aligned with the purpose of the asbplayer project. Read `docs/docs/intro.md`, and other documentation under `docs/docs`, using the `get_file_contents` tool to understand what asbplayer is and what features already exist.
  - `confidence`: Value in the closed interval of 0-20. Represents the likelihood that the PR is of high quality and will require less effort to review. Skim the PR diff to inform this value. Before fetching a PR's diff, check its size. A single `list_pull_requests` call with `fields: [number, additions, deletions, changed_files]` returns sizes for all open PRs. If a PR's `additions + deletions` exceeds 5000 lines, do not fetch its diff - the response will crash the tooling. Score that PR from its metadata with a lower `confidence` value and note the limitation in the label rationale.
  - `momentum`: Value in the closed interval of 0-10. Represents the likelihood that the author will respond. For example, old PRs, and PRs where a maintainer has commented and the author has not responded in a long time, have less momentum. Recent PRs created by active contributors have more momentum. 

Use the score to assign the PR one of the following labels:
 - `pr-p1`: 60 <= score <= 100
 - `pr-p2`: 30 <= score < 60
 - `pr-p3`: 0 <= score < 30
  
Each PR should have exactly one of the above labels. If it already has one of the above labels, it should be removed first. If it already has the desired label then you can skip removing and adding the same label, as an optimization.

## Handling read failures

If a PR's diff cannot be retrieved despite the size pre-check, do not stop and do not abandon the remaining PRs. Score that PR from its available metadata (title, body, changed files, checks, comments) with a lower `confidence` value, note the uncertainty in the label rationale, and continue with the remaining PRs. Do not give up on reading the remaining PR diffs because of a single failure - future reads on different PRs may succeed. Label every PR you scored, even if some could not be fully analyzed. Only call `missing_tool` or `missing_data` if reads fail for all PRs.