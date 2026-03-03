#!/bin/bash
set -e

echo "=== AuditWise Production Startup ==="
echo "Node.js $(node --version)"
echo "Environment: ${NODE_ENV:-development}"
echo ""

HEAP_SIZE="${NODE_HEAP_SIZE:-2560}"

echo "[1/3] Waiting for database to be ready..."
for i in $(seq 1 60); do
  if node -e "
    const url = process.env.DATABASE_URL;
    if (!url) { process.exit(1); }
    const m = url.match(/\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    if (!m) { process.exit(1); }
    const net = require('net');
    const s = new net.Socket();
    s.setTimeout(2000);
    s.connect(parseInt(m[4]), m[3], () => { s.destroy(); process.exit(0); });
    s.on('error', () => process.exit(1));
    s.on('timeout', () => { s.destroy(); process.exit(1); });
  " 2>/dev/null; then
    echo "  Database is reachable."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "FATAL: Database not reachable after 60s."
    exit 1
  fi
  sleep 1
done

echo "[2/3] Running database schema sync..."
NODE_OPTIONS="--max-old-space-size=$HEAP_SIZE" npx prisma db push --skip-generate 2>&1 || {
  echo "FATAL: Database schema sync failed."
  echo "Verify DATABASE_URL is set and the database is reachable."
  exit 1
}
echo "Database schema synced successfully."

echo "[3/3] Starting AuditWise on port ${PORT:-5000}..."
exec node --max-old-space-size=$HEAP_SIZE dist/index.cjs
