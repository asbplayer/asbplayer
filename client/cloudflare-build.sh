set -euo pipefail

pnpm install --frozen-lockfile --filter @project/client --filter @project/common

if [ ! -f .env.production ]; then
    echo "VITE_APP_VERSION_REPO_PATH=commit/$(git rev-parse --short HEAD)" > .env.production
fi

pnpm --filter @project/client buildProduction
