set -euo pipefail

pnpm install --frozen-lockfile --filter asbplayer-docs
pnpm --filter asbplayer-docs build
