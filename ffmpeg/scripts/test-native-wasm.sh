#!/bin/bash
set -euo pipefail

package_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$package_root/.."

node "$package_root/scripts/prepare-sources.mjs"
node "$package_root/scripts/generate-build-inputs.mjs"

docker_arguments=()
while IFS= read -r argument; do
    docker_arguments+=(--build-arg "$argument")
done < "$package_root/.cache/build/docker-build-args"
build_platform="$(<"$package_root/.cache/build/platform")"
runtime_version="$(node "$package_root/scripts/release-info.mjs" version)"
ffmpeg_version="$(node -p "require('$package_root/build-config.json').ffmpeg.version")"

docker buildx build \
    --platform "$build_platform" \
    --target wasm-test \
    --build-arg "ASB_RUNTIME_VERSION=$runtime_version" \
    --build-arg "ASB_FFMPEG_VERSION=$ffmpeg_version" \
    "${docker_arguments[@]}" \
    "$package_root"

echo "Docker C++ and WASM tests passed for asbplayer $runtime_version with FFmpeg $ffmpeg_version"
