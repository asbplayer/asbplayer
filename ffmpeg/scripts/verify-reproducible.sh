#!/bin/bash
set -euo pipefail

package_root="$(cd "$(dirname "$0")/.." && pwd)"
repository_root="$(cd "$package_root/.." && pwd)"
rebuilt="$(mktemp -d)"
trap 'rm -rf "$rebuilt"' EXIT

runtime_version="$(node "$package_root/scripts/release-info.mjs" version)"
runtime_name="$(node "$package_root/scripts/release-info.mjs" runtimeArchive)"
sources_name="$(node "$package_root/scripts/release-info.mjs" sourcesArchive)"
test -f "$package_root/release/$runtime_name"
test -f "$package_root/release/$sources_name"

# Rebuild from what the release offers as source: the repository files at the release commit
# (GitHub's source archive; uncommitted files when run locally) plus the published upstream tarballs.
if [[ -e "$repository_root/.git" ]]; then
    (
        cd "$repository_root"
        git ls-files -z --cached --others --exclude-standard |
            while IFS= read -r -d '' source_path; do
                # Skip locally deleted files; retain dangling symlinks as source entries.
                if [[ -e "$source_path" || -L "$source_path" ]]; then
                    printf '%s\0' "$source_path"
                fi
            done |
            tar --null -T - -cf -
    ) |
        tar -xf - -C "$rebuilt"
else
    # Source archives have no Git metadata. Exclude dependencies and generated build inputs.
    tar --exclude=node_modules --exclude=./ffmpeg/.cache --exclude=./ffmpeg/dist --exclude=./ffmpeg/release \
        -cf - -C "$repository_root" . |
        tar -xf - -C "$rebuilt"
fi
mkdir -p "$rebuilt/ffmpeg/.cache/archives"
tar -xzf "$package_root/release/$sources_name" --strip-components=1 -C "$rebuilt/ffmpeg/.cache/archives"

build_into() {
    local destination="$1"
    (cd "$destination" && pnpm install --frozen-lockfile --filter @project/ffmpeg \
        && pnpm --filter @project/ffmpeg run build:candidate \
        && pnpm --filter @project/ffmpeg run test:native-wasm)
}

ASB_FFMPEG_NO_CACHE=1 build_into "$rebuilt"
for path in \
    "ffmpeg/dist/$runtime_version/ffmpeg-core.js" \
    "ffmpeg/dist/$runtime_version/ffmpeg-core.wasm" \
    "ffmpeg/dist/$runtime_version/ffmpeg-worker.js" \
    "ffmpeg/dist/$runtime_version/manifest.json" \
    "ffmpeg/release/$runtime_name" \
    "ffmpeg/release/$sources_name"; do
    cmp "$rebuilt/$path" "$repository_root/$path"
done
diff -r "$rebuilt/ffmpeg/release" "$package_root/release"
echo "The published source reproduces the FFmpeg release"
