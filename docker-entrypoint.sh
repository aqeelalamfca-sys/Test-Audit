#!/bin/bash
set -e

echo "=== AuditWise Production Startup ==="
echo "Node.js $(node --version)"
echo "Environment: ${NODE_ENV:-development}"
echo "Container memory: $(cat /sys/fs/cgroup/memory.max 2>/dev/null || cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo 'unknown')"
echo ""

HEAP_SIZE="${NODE_HEAP_SIZE:-2560}"

echo "[1/2] Running database schema sync..."
NODE_OPTIONS="--max-old-space-size=$HEAP_SIZE" npx prisma db push --skip-generate 2>&1 || {
  echo "FATAL: Database schema sync failed."
  echo "Verify DATABASE_URL is set and the database is reachable."
  echo "Connection format: postgresql://user:pass@host:5432/dbname?schema=public"
  exit 1
}
echo "Database schema synced successfully."

echo "[2/2] Starting AuditWise on port ${PORT:-5000}..."
exec node --max-old-space-size=$HEAP_SIZE dist/index.cjs
