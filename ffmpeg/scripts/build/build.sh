#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../paths.sh"
runtime_version="$(node "$package_root/scripts/release/release-info.mjs" version)"
output="$package_root/dist/$runtime_version"
docker_output="$package_root/.cache/docker-output"

source "$package_root/scripts/build/build-common.sh"
prepare_build "$package_root"
rm -rf "$docker_output" "$output"
mkdir -p "$docker_output" "$output/notices"
if [[ "${ASB_FFMPEG_NO_CACHE:-0}" == "1" ]]; then
    docker_arguments+=(--no-cache)
fi
docker buildx build \
    --platform "$build_platform" \
    "${docker_arguments[@]}" \
    --output "type=local,dest=$docker_output" \
    "$package_root"

node "$package_root/scripts/build/verify-system-notices.mjs" "$docker_output/ffmpeg-core.map" "$docker_output/notices"

cp "$docker_output/ffmpeg-core.js" "$docker_output/ffmpeg-core.wasm" "$output/"
pnpm --filter @project/ffmpeg exec rolldown "$package_root/src/worker.ts" \
    --format=esm --platform=browser --transform.target=es2022 \
    --file="$output/ffmpeg-worker.js"

node "$package_root/scripts/build/copy-notices.mjs"

echo "Built FFmpeg runtime $runtime_version in $output"
