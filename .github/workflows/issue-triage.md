---
description: |
  Triage assistant that categorizes issues, finds duplicate issues, and provides initial assistance from documentation.

on:
  issues:
    types: [opened]
  roles: all
  reaction: none
  workflow_dispatch:
    inputs:
      issue-number:
        description: Issue number to triage
        required: true
        type: string

model: gpt-5.6-luna
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
  add-comment:
  set-issue-type:
    allowed: [Bug, Feature, Task]
  allowed-domains:
    - docs.asbplayer.dev

tools:
  bash: false
  web-fetch:
  github:
    toolsets: [issues]
    min-integrity: none # This workflow is allowed to examine and comment on any issues

timeout-minutes: 10
---

# Issue triager

Analyze issue #${{ github.event.issue.number || inputs.issue-number }}, and:

1. Find similar issues in this repository.
2. Find relevant documentation under docs.
3. Determine and set the issue type.

Do not make assumptions beyond what the issue content supports. Do not invent missing context.

## Step 1: Gather context

1. Retrieve the issue content using the `get_issue` tool.
2. Fetch any comments on the issue using the `get_issue_comments` tool.
3. Search for similar issues using the `search_issues` tool.
4. Find relevant documentation under docs.

## Step 2: Triage and assist

- Review the similar issues found in Step 1.
- Classify matches as:
  - **Duplicate** (high confidence): the issue describes the same problem as an existing open issue. Include up to 3.
  - **Related**: similar domain or adjacent problem, but not a duplicate. Include up to 3.
- Determine whether the issue is a Bug, Feature, or Task.
- Calculate the documentation URLs for any relevant documentation found. The URL is of the format `https://docs.asbplayer.dev/<path>` where `<path>` is the relative path under the `docs` directory. If specific documentation is found, target it with the corresponding hash fragment if it exists. For example: `https://docs.asbplayer.dev/docs/common-issues#asbplayer-isnt-detecting-streaming-video`. Include up to 3 URLs.

## Comment format

Use this structure for your duplicate issues comment

```markdown
### 🔗 Similar issues

- issue-url (duplicate/related) — [brief explanation]

### Relevant documentation

- documentation-url - [brief explanation]

```

```markdown

```

If no similar issues were found, comment that no duplicates were found. If no documentation was found, comment that no relevant documentation was found. If you were unable to categorize the issue as a Bug, Feature, or Task, comment that issue triage failed.
