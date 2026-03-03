#!/bin/bash
set -e

echo "============================================"
echo "  AuditWise - Update Deployment"
echo "============================================"
echo ""

APP_DIR="/var/www/auditwise"
cd "$APP_DIR"

set -a; source .env; set +a

echo "[1/4] Installing dependencies..."
npm ci --omit=dev

echo "[2/4] Generating Prisma client..."
NODE_OPTIONS="--max-old-space-size=4096" npx prisma generate

echo "[3/4] Syncing database schema..."
NODE_OPTIONS="--max-old-space-size=4096" npx prisma db push --skip-generate

echo "[4/4] Restarting application..."
if pm2 describe auditwise > /dev/null 2>&1; then
  pm2 restart auditwise
else
  if [ -f ecosystem.config.cjs ]; then
    pm2 start ecosystem.config.cjs
  else
    pm2 start dist/index.cjs --name auditwise --node-args="--max-old-space-size=${NODE_HEAP_SIZE:-2560}"
  fi
fi

echo ""
echo "Update complete! Checking status..."
sleep 5
pm2 status auditwise
echo ""
