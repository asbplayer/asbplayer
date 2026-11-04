#!/bin/bash
# Collects author information for commits between two refs, resolving GitHub handles.
#
# Usage: collect-authors.sh <base-ref> <head-ref> <output-file>
#
# For each commit in the range (oldest to newest), emits a line of the form:
#
#     <short-sha>|<pr-number|->|<handle-or-name>|<subject>
#
# At most MAX_COMMITS commits are emitted; when the range is longer, the newest
# commits are kept.
#
# Handle resolution priority:
#   1. Author of the PR containing the commit (via the commits/{sha}/pulls API)
#   2. GitHub user attached to the commit author email (via the commits/{sha} API)
#   3. Plain git author name and email, if no GitHub account can be resolved
#
# Requires the GH_TOKEN environment variable when GitHub API resolution is needed.
set -euo pipefail

BASE_REF=$1
HEAD_REF=$2
OUTPUT_FILE=$3

API_RATE_LIMIT_DELAY_SECONDS=1
# Bounds the per-commit API calls; raise it if release or deploy ranges routinely
# exceed this many commits.
MAX_COMMITS=100

repo_full_name() {
    gh repo view --json nameWithOwner -q .nameWithOwner
}

resolve_pr_number() {
    local sha=$1
    gh api "repos/$repo/commits/$sha/pulls" --jq '.[0].number // empty' 2>/dev/null || true
}

resolve_commit_author_login() {
    local sha=$1
    gh api "repos/$repo/commits/$sha" --jq '.author.login // empty' 2>/dev/null || true
}

resolve_email_login() {
    local email=$1
    gh api "search/users?q=$email in:email" --jq '.items[0].login // empty' 2>/dev/null || true
}

truncate_subject() {
    local subject=$1
    if [ "${#subject}" -gt 80 ]; then
        echo "${subject:0:77}..."
    else
        echo "$subject"
    fi
}

repo=$(repo_full_name)

# --reverse with --max-count keeps the newest MAX_COMMITS in oldest-to-newest order.
# Do not pipe through `head`: it exits early, `git log` dies of SIGPIPE, and
# pipefail turns that into a failed step once the range exceeds the cap.
commits=$(git log --format='%H%x09%an%x09%ae%x09%s' --reverse --max-count="$MAX_COMMITS" "$BASE_REF..$HEAD_REF")

> "$OUTPUT_FILE"

while IFS=$'\t' read -r full_sha author_name author_email subject; do
    [ -z "$full_sha" ] && continue
    if ! [[ "$full_sha" =~ ^[0-9a-f]{40}$ ]]; then
        echo "Skipping malformed commit line: $full_sha" >&2
        continue
    fi
    short_sha=${full_sha:0:8}

    pr_number=$(resolve_pr_number "$full_sha")
    if ! [[ "$pr_number" =~ ^[0-9]+$ ]]; then
        pr_number=""
    fi

    display=""
    is_valid_login() {
        [[ "$1" =~ ^[a-zA-Z0-9-]+(\[bot\])?$ ]]
    }
    if [ -n "$pr_number" ]; then
        login=$(gh api "repos/$repo/pulls/$pr_number" --jq '.user.login // empty' 2>/dev/null || true)
        if is_valid_login "$login"; then
            display="$login"
        fi
    fi

    if [ -z "$display" ]; then
        login=$(resolve_commit_author_login "$full_sha")
        if is_valid_login "$login"; then
            display="$login"
        else
            login=$(resolve_email_login "$author_email")
            if is_valid_login "$login"; then
                display="$login"
            else
                display="$author_name ($author_email)"
            fi
        fi
        sleep "$API_RATE_LIMIT_DELAY_SECONDS"
    fi

    printf '%s|%s|%s|%s\n' "$short_sha" "${pr_number:--}" "$display" "$(truncate_subject "$subject")" >> "$OUTPUT_FILE"
done <<< "$commits"