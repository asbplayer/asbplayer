---
name: 'Agent: Issue triage'
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
    add-comment:
    set-issue-type:
        allowed: [Bug, Feature, Task]
    allowed-domains:
        - docs.asbplayer.dev

tools:
    bash: false
    web-fetch:
    github:
        toolsets: [issues, repos]
        min-integrity: none # This workflow is allowed to examine and comment on any issues

timeout-minutes: 10
---

# Issue triager

Analyze issue #${{ github.event.issue.number || inputs.issue-number }}, and:

1. Find similar issues in this repository.
2. Find relevant documentation under docs using the `get_file_contents` tool.
3. Determine and set the issue type.

Do not make assumptions beyond what the issue content supports. Do not invent missing context.

## Step 1: Gather context

1. Retrieve the issue content using the `issue_read` tool.
2. Fetch any comments on the issue using the `issue_read` tool.
3. Search for similar issues using the `search_issues` tool.
4. List the `docs/docs` directory using the `get_file_contents` tool, then read the relevant documentation files that match the issue topic.

## Step 2: Triage and assist

- Review the similar issues found in Step 1.
- Classify matches as:
    - **Duplicate** (high confidence): the issue describes the same problem as an existing open issue. Include up to 3.
    - **Related**: (high confidence) similar domain or adjacent problem, but not a duplicate. Include up to 3.
- Determine whether the issue is a Bug, Feature, or Task.
- Find relevant documentation found that looks highly likely to assist in resolving the issue. The URL is of the format `https://docs.asbplayer.dev/<path>` where `<path>` is the relative path under the `docs` directory. If specific documentation is found, target it with the corresponding hash fragment if it exists. For example: `https://docs.asbplayer.dev/docs/common-issues#asbplayer-isnt-detecting-streaming-video`. Include up to 3 URLs.
- Only post a comment if: you are highly confident there is a duplicate or very related issue, or if there is relevant documentation that you are highly confident will resolve the issue. If neither of the above is true, then do not post a comment.

## Comment format

If you have determined that you should comment according to the rules above, then use the structure below for your comment.

If you found high-confidence duplicate or related issues:

```markdown
### Similar issues

- issue-url (duplicate/related) — [brief explanation]
```

If you found high-confidence relevant documentation:

```markdown
### Relevant documentation

- documentation-url - [brief explanation]
```

Comment with both sections in the same comment if you found material for both.
