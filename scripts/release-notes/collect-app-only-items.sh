#!/bin/bash
# Collects the webapp-only pull requests since the previous extension release
# for the extension draft release notes.
#
# A pull request qualifies when it:
#   - was merged to main after the previous extension release was published
#   - is attached to no "Extension v*" milestone (those are collected by
#     collect-milestone-items.sh)
#   - touches client/ or common/ but not extension/
#   - is not authored by dependabot
#
# Usage: collect-app-only-items.sh [version] [output-file]
#
#   version      Current extension version (e.g. 1.23.0). Defaults to the
#                version in project.json.
#   output-file  Defaults to webapp-only-items.md.
#
# The first output line is the section title; the agent uses it verbatim.
#
# Requires GH_TOKEN.

set -euo pipefail

INPUT_VERSION=${1:-}
OUTPUT_FILE=${2:-webapp-only-items.md}

repo=${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}

# --- Resolve the current extension version ---------------------------------------

version=$INPUT_VERSION
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -z "$version" ]; then
    version=$(jq -r '.version' "$PROJECT_ROOT/project.json")
fi

if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Could not resolve a valid extension version (got '$version')." >&2
    exit 1
fi

# --- Resolve the previous published extension release -----------------------------
# Extension tags are v<semver>, so component releases (app-v*, ffmpeg-v*,
# ankiaddon-v*) never match. The current version is excluded so re-drafting an
# already published version still finds the release before it.

prev=$(gh api "repos/$repo/releases?per_page=100" \
    --jq "[.[]
        | select(.draft == false)
        | select(.tag_name != \"$version\" and .tag_name != \"v$version\")
        | select(.tag_name | test(\"^v?[0-9]+[.][0-9]+[.][0-9]+$\"))
        | select(.published_at != null)]
        | sort_by(.published_at) | reverse | .[0]
        | [.tag_name, .published_at]
        | @tsv")

if [ -z "$prev" ] || [ "$prev" = "null" ]; then
    echo "No previous published extension release found." >&2
    exit 1
fi

prev_tag=$(cut -f1 <<< "$prev")
prev_published_at=$(cut -f2 <<< "$prev")
prev_version="v${prev_tag#v}"
cutoff=$(cut -dT -f1 <<< "$prev_published_at")

echo "Previous extension release: $prev_tag (published $prev_published_at)"

# --- List candidate merged PRs ----------------------------------------------------
# The search qualifier only filters by day; the timestamp comparison below is
# exact to the publish time.

pr_list=$(gh pr list --repo "$repo" --state merged --base main \
    --search "merged:>=$cutoff" --limit 200 \
    --json number,title,author,labels,milestone,mergedAt,url)

# One JSON object per PR (JSONL), like collect-milestone-items.sh: multi-line
# bodies survive intact.
TMP_JSONL="${OUTPUT_FILE}.jsonl"
jq -c --arg published_at "$prev_published_at" '.[]
    | select((.mergedAt // "") >= $published_at)
    | select(((.author.login // "") | ascii_downcase | contains("dependabot")) | not)
    | select(((.milestone.title // "") | startswith("Extension v")) | not)
    | {
        number: (.number | tostring),
        title: .title,
        author: (.author.login // ""),
        labels: ([.labels[].name] | join(", ")),
        merged_at: (.mergedAt // ""),
        url: .url,
        body: ((.body // "") | gsub("[\\r\\n\\t]+"; " ") | .[0:600])
    }' <<< "$pr_list" > "$TMP_JSONL"

{
    echo "# Webapp-only changes since $prev_version"
    echo
    echo "One block per pull request. These pull requests affect the web app but"
    echo "are attached to no extension milestone, so they never appear in the"
    echo "curated extension release notes. Do not add anything that is not listed"
    echo "here."
    echo
} > "$OUTPUT_FILE"

item_count=0
while IFS= read -r item; do
    [ -z "$item" ] && continue

    number=$(jq -r '.number' <<< "$item")

    # The web app is built from client/ and common/. A PR touching extension/
    # affects the extension too, so it is not webapp-only.
    files=$(gh api "repos/$repo/pulls/$number/files?per_page=100" \
        --jq '[.[].filename]' 2>/dev/null || echo '[]')
    touches_app=$(jq -r 'any(.[]; test("^(client|common)/"))' <<< "$files")
    touches_extension=$(jq -r 'any(.[]; test("^extension/"))' <<< "$files")
    if [ "$touches_app" != "true" ] || [ "$touches_extension" = "true" ]; then
        continue
    fi

    title=$(jq -r '.title' <<< "$item")
    author=$(jq -r '.author' <<< "$item")
    labels=$(jq -r '.labels' <<< "$item")
    merged_at=$(jq -r '.merged_at' <<< "$item")
    url=$(jq -r '.url' <<< "$item")
    body=$(jq -r '.body' <<< "$item")
    file_count=$(jq 'length' <<< "$files")
    paths=$(jq -r '.[0:15] | join(", ")' <<< "$files")

    item_count=$((item_count + 1))

    {
        echo "## #$number — $title"
        echo "- merged_at: $merged_at"
        echo "- changed_files: ${file_count}"
        echo "- paths: ${paths}"
        echo "- author: ${author:-unknown}"
        echo "- labels: ${labels:-none}"
        echo "- url: $url"
        if [ -n "$body" ]; then
            echo "- body: $body"
        fi
        echo
    } >> "$OUTPUT_FILE"
done < "$TMP_JSONL"
rm -f "$TMP_JSONL"

echo "Collected $item_count pull request(s) into $OUTPUT_FILE (previous release $prev_tag)"
