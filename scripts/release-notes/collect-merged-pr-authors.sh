#!/bin/bash
# Lists every GitHub login that authored a merged pull request in the repository.
#
# Usage: collect-merged-pr-authors.sh [repo]
#
# One login per line, sorted, bots excluded. The repository defaults to
# GITHUB_REPOSITORY, or the current checkout's repository.
#
# Only PR authors are covered: commits pushed directly, and commits authored by
# someone other than the PR author, do not appear here.
#
# Requires the GH_TOKEN environment variable.
set -euo pipefail

repo=${1:-${GITHUB_REPOSITORY:-}}
if [ -z "$repo" ]; then
    repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
fi

# state=closed returns merged and rejected PRs; merged_at keeps only the merged ones.
# GitHub Apps report type "Bot" (their login also ends in "[bot]").
gh api --paginate "repos/$repo/pulls?state=closed&per_page=100" \
    --jq '.[] | select(.merged_at != null) | select(.user != null) | select(.user.type != "Bot") | .user.login' \
    | sort -u
