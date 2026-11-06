#!/bin/bash
set -euo pipefail

if [[ "$#" -ne 3 ]]; then
    echo "Usage: $0 ARCHIVE.tar.gz DIRECTORY ENTRY" >&2
    exit 2
fi

package_root="$(cd "$(dirname "$0")/.." && pwd)"
repository_root="$(cd "$package_root/.." && pwd)"
archive="$1"
directory="$2"
entry="$3"

container_path() {
    local path="$1"
    case "$path" in
        "$repository_root"/*) echo "/workspace/${path#"$repository_root"/}" ;;
        *)
            echo "Path must be inside the repository: $path" >&2
            exit 2
            ;;
    esac
}

packaging_image="$(node -p "require('$package_root/build-config.json').toolchain.container")"
packaging_platform="$(node -p "require('$package_root/build-config.json').toolchain.platform")"
archive_in_container="$(container_path "$archive")"
directory_in_container="$(container_path "$directory")"

# The image is digest-pinned in build-config.json, so tar and its compressors
# are fixed together with the Emscripten toolchain used to build the runtime.
# Plain ustar keeps the archive readable by the app's minimal browser-side tar reader.
docker run --rm --platform "$packaging_platform" \
    --volume "$repository_root:/workspace" \
    "$packaging_image" \
    tar --format=ustar --sort=name --mtime='UTC 2020-01-01' --owner=0 --group=0 --numeric-owner \
        --mode='a+rX,u+w,go-w' \
        -czf "$archive_in_container" \
        -C "$directory_in_container" "$entry"
