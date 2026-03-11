#!/usr/bin/env bash
set -euo pipefail

echo "[post-merge] Installing dependencies..."
npm install --prefer-offline --no-audit --no-fund < /dev/null 2>&1 | tail -3

echo "[post-merge] Generating Prisma client..."
timeout 90 npx prisma generate < /dev/null 2>&1 | tail -3 || echo "[post-merge] Prisma generate timed out, continuing..."

echo "[post-merge] Pushing schema to database..."
npx prisma db push --skip-generate --accept-data-loss < /dev/null 2>&1 | tail -3 || echo "[post-merge] DB push skipped"

echo "[post-merge] Done."
