#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../paths.sh"
cd "$package_root"

pnpm run verify:code
pnpm run verify:candidate
pnpm run test:native-wasm
pnpm run verify:reproducible

echo "FFmpeg release candidate passed all automated release checks"
