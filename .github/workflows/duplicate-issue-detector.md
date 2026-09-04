---
description: |
  Triage assistant that finds duplicate issues.

on:
  issues:
    types: [opened]
  reaction: eyes
  workflow_dispatch:
    inputs:
      issue-number:
        description: Issue number to analyze for duplicates
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

tools:
  bash: false
  web-fetch:
  github:
    toolsets: [issues]
    min-integrity: none # This workflow is allowed to examine and comment on any issues

timeout-minutes: 10
---

# Duplicate issue detector

Analyze issue #${{ github.event.issue.number || inputs.issue-number }}, and find similar issues in this repository.

Do not make assumptions beyond what the issue content supports. Do not invent missing context.

## Step 1: Gather context

1. Retrieve the issue content using the `get_issue` tool.
2. Fetch any comments on the issue using the `get_issue_comments` tool.
3. Search for similar issues using the `search_issues` tool.


## Step 2: Detect duplicates and related issues

- Review the similar issues found in Step 1.
- Classify matches as:
  - **Duplicate** (high confidence): the issue describes the same problem as an existing open issue. Include up to 3.
  - **Related**: similar domain or adjacent problem, but not a duplicate. Include up to 3.

## Comment format

Use this structure for your duplicate issues comment

```markdown
### 🔗 Similar issues

- issue-url (duplicate/related) — [brief explanation]
```

If no similar issues were found, comment that no duplicates were found.
