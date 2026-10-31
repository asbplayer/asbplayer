#!/bin/bash
# Collects the items (issues and pull requests) attached to an extension release
# milestone so that an agent can categorize them into draft release notes.
#
# Usage: collect-milestone-items.sh [version] [output-file]
#
#   version      Extension version without the tag prefix (e.g. 1.22.0). When
#                omitted or empty, it is read from project.json.
#   output-file  Where to write the item blocks (default: milestone-items.md).
#
# Also writes release-meta.json with the resolved version, milestone title/number
# and a best-effort Full Changelog compare URL.
#
# Only items attached to the milestone titled "Extension v<version>" are emitted.
# The generated compare URL is best-effort: the generate-notes API needs write
# access, so read-only runs normally leave it empty (the release job recomputes it).
#
# Requires the GH_TOKEN environment variable.

set -euo pipefail

INPUT_VERSION=${1:-}
OUTPUT_FILE=${2:-milestone-items.md}
META_FILE=release-meta.json

repo=${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}

# --- Resolve the extension version ---------------------------------------------

version=$INPUT_VERSION
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -z "$version" ]; then
    version=$(jq -r '.version' "$PROJECT_ROOT/project.json")
fi

if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Could not resolve a valid extension version (got '$version')." >&2
    exit 1
fi

tag=$(node --experimental-strip-types "$PROJECT_ROOT/scripts/extension-release-info.ts" tag "$version")
milestone_title="Extension v${version}"

# --- Resolve the milestone -----------------------------------------------------

milestone_number=$(gh api --paginate "repos/$repo/milestones?state=all&per_page=100" \
    --jq ".[] | select(.title == \"$milestone_title\") | .number" | head -n1)
if [ -z "$milestone_number" ]; then
    echo "No milestone titled '$milestone_title' exists." >&2
    exit 1
fi

echo "Milestone: $milestone_title (#$milestone_number)"

# --- Collect milestone items ---------------------------------------------------
# One compact JSON object per item (JSONL): multi-line bodies survive intact and
# empty fields (for example, an item with no labels) cannot shift the columns.
# Dependabot entries are dropped here so they cannot reach the release notes.

TMP_JSONL="${OUTPUT_FILE}.jsonl"
gh api --paginate "repos/$repo/issues?milestone=$milestone_number&state=all&per_page=100" \
    --jq '.[]
        | select(((.user.login // "") | ascii_downcase | contains("dependabot")) | not)
        | {
        number: (.number | tostring),
        kind: (if has("pull_request") then "pull request" else "issue" end),
        state: .state,
        merged: (.pull_request.merged_at // ""),
        author: (.user.login // ""),
        title: .title,
        url: .html_url,
        labels: ([.labels[].name] | join(", ")),
        body: ((.body // "") | gsub("[\\r\\n\\t]+"; " ") | .[0:600])
    }' > "$TMP_JSONL"

{
    echo "# Milestone: $milestone_title (#$milestone_number)"
    echo
    echo "One block per milestone item. Categorize only these items; do not add"
    echo "anything that is not listed here."
    echo
} > "$OUTPUT_FILE"

item_count=0
while IFS= read -r item; do
    [ -z "$item" ] && continue
    item_count=$((item_count + 1))

    number=$(jq -r '.number' <<< "$item")
    kind=$(jq -r '.kind' <<< "$item")
    state=$(jq -r '.state' <<< "$item")
    merged=$(jq -r '.merged' <<< "$item")
    author=$(jq -r '.author' <<< "$item")
    title=$(jq -r '.title' <<< "$item")
    url=$(jq -r '.url' <<< "$item")
    labels=$(jq -r '.labels' <<< "$item")
    body=$(jq -r '.body' <<< "$item")

    {
        echo "## #$number — $title"
        echo "- kind: $kind"
        echo "- state: $state"
        if [ "$kind" = "pull request" ]; then
            if [ -n "$merged" ]; then
                echo "- merged_at: $merged"
            else
                echo "- merged_at: (not merged)"
            fi
            files=$(gh api "repos/$repo/pulls/$number/files?per_page=100" \
                --jq '[.[] | .filename]' 2>/dev/null || echo '[]')
            file_count=$(printf '%s' "$files" | jq 'length' 2>/dev/null || echo 0)
            paths=$(printf '%s' "$files" | jq -r '.[0:15] | join(", ")' 2>/dev/null || echo "")
            echo "- changed_files: ${file_count}"
            echo "- paths: ${paths}"
        fi
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

# --- Full Changelog compare URL (best-effort) ----------------------------------

compare_url=""
generated_notes=$(gh api "repos/$repo/releases/generate-notes" \
    -f tag_name="$tag" -f target_commitish="${RELEASE_TARGET:-main}" \
    --jq '.body' 2>/dev/null || true)
if [ -n "$generated_notes" ]; then
    compare_url=$(printf '%s\n' "$generated_notes" \
        | grep -oE 'https://github.com/[^ )]+/compare/[^ )]+' | head -n1 || true)
fi

jq -n \
    --arg version "$version" \
    --arg milestone "$milestone_title" \
    --argjson milestone_number "$milestone_number" \
    --arg compare_url "$compare_url" \
    '{
        version: $version,
        milestone: $milestone,
        milestone_number: $milestone_number,
        compare_url: $compare_url
    }' > "$META_FILE"

echo "Collected $item_count item(s) into $OUTPUT_FILE"
echo "Wrote $META_FILE (version=$version, compare_url=${compare_url:-none})"
