#!/bin/bash
set -e

echo "=== AuditWise Production Startup ==="
echo "Node.js $(node --version)"
echo "Environment: ${NODE_ENV:-development}"
echo "Started at: $(date -Is)"
echo ""

HEAP_SIZE="${NODE_HEAP_SIZE:-2560}"

echo "[1/4] Validating environment..."
ERRORS=0

if [ -z "$DATABASE_URL" ]; then
  echo "  FATAL: DATABASE_URL is not set."
  ERRORS=1
fi

if [ -n "$POSTGRES_PASSWORD" ] && [ -n "$DATABASE_URL" ]; then
  URL_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  DECODED_PASS=$(node -e "console.log(decodeURIComponent('$URL_PASS'))" 2>/dev/null || echo "$URL_PASS")
  if [ -n "$URL_PASS" ] && [ "$DECODED_PASS" != "$POSTGRES_PASSWORD" ]; then
    echo "  WARNING: DATABASE_URL password does not match POSTGRES_PASSWORD."
    echo "  This may cause authentication failures between app and PostgreSQL."
    echo "  Verify both values are identical in your .env file."
  fi
fi

if [ "$ERRORS" -eq 1 ]; then
  echo ""
  echo "FATAL: Environment validation failed. Cannot start."
  exit 1
fi
echo "  Environment validated."

echo "[2/4] Waiting for database to be ready..."
MAX_WAIT=90
ATTEMPT=0
DELAY=1

while [ "$ATTEMPT" -lt "$MAX_WAIT" ]; do
  ATTEMPT=$((ATTEMPT + 1))
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
    echo "  Database is reachable after ${ATTEMPT}s."
    break
  fi
  if [ "$ATTEMPT" -eq "$MAX_WAIT" ]; then
    echo "FATAL: Database not reachable after ${MAX_WAIT}s."
    echo "Check DATABASE_URL: ${DATABASE_URL:0:40}..."
    echo "Ensure PostgreSQL container is running and healthy."
    exit 1
  fi
  if [ "$((ATTEMPT % 10))" -eq 0 ]; then
    echo "  Still waiting for database... (${ATTEMPT}s)"
  fi
  sleep $DELAY
  if [ "$DELAY" -lt 3 ]; then
    DELAY=$((DELAY + 1))
  fi
done

echo "[3/4] Running database schema sync (prisma db push)..."
NODE_OPTIONS="--max-old-space-size=$HEAP_SIZE" npx prisma db push --skip-generate 2>&1 || {
  echo ""
  echo "FATAL: Database schema sync failed."
  echo "Possible causes:"
  echo "  - Authentication failure (check DATABASE_URL credentials)"
  echo "  - Schema has destructive changes (run manually with --accept-data-loss after backup)"
  echo "  - Database version incompatibility"
  echo ""
  echo "To debug, connect to the database container:"
  echo "  docker exec -it auditwise-db psql -U auditwise -d auditwise"
  exit 1
}
echo "  Database schema synced successfully."

echo "[4/4] Starting AuditWise on port ${PORT:-5000}..."
exec node --max-old-space-size=$HEAP_SIZE dist/index.cjs
