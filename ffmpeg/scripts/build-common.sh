#!/bin/bash
set -euo pipefail

# Prepare the inputs and Docker arguments shared by runtime builds and native/WASM tests.
prepare_build() {
    local ffmpeg_package_root="$1"
    node "$ffmpeg_package_root/scripts/prepare-sources.mjs"
    node "$ffmpeg_package_root/scripts/generate-build-inputs.mjs"

    docker_arguments=()
    while IFS= read -r argument; do
        docker_arguments+=(--build-arg "$argument")
    done < "$ffmpeg_package_root/.cache/build/docker-build-args"
    build_platform="$(<"$ffmpeg_package_root/.cache/build/platform")"
}
