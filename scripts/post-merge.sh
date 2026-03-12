#!/bin/bash
set -euo pipefail
cd /home/runner/workspace

echo "[post-merge] Installing dependencies..."
npm install --legacy-peer-deps 2>&1
echo "[post-merge] npm install complete"

echo "[post-merge] Pushing schema to database..."
npx prisma db push --skip-generate 2>&1
echo "[post-merge] schema push complete"

echo "[post-merge] Generating Prisma client (background, 120s timeout)..."
timeout 120 npx prisma generate 2>&1 || echo "[post-merge] WARNING: prisma generate timed out or failed — restart workflow to retry"

echo "[post-merge] Done."
