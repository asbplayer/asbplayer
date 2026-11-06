#!/bin/bash
set -euo pipefail

package_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$package_root"

pnpm run verify:code
pnpm run verify:candidate
pnpm run test:native-wasm
pnpm run verify:reproducible

echo "FFmpeg release candidate passed all automated release checks"
