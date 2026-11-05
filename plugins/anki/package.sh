#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
node --experimental-strip-types ../../scripts/sync-project-config.ts
ARTIFACT_NAME=$(node --experimental-strip-types ../../scripts/anki-release-info.ts filename)
cd asbplayer-addon
rm -f "../$ARTIFACT_NAME"
zip -r "../$ARTIFACT_NAME" * -x '*__pycache__*'
