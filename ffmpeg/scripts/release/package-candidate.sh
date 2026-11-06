#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../paths.sh"

node "$package_root/scripts/release/generate-manifest.mjs"
node "$package_root/scripts/release/package-release.mjs"

echo "Packaged FFmpeg release candidate"
