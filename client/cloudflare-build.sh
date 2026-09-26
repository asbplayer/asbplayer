set -euo pipefail

pnpm install --frozen-lockfile --filter @project/client --filter @project/common
pnpm --filter @project/client buildFast
