#!/bin/bash
set -e

echo "=== AuditWise Production Startup ==="
echo "Node.js $(node --version)"
echo "Environment: ${NODE_ENV:-development}"
echo "Started at: $(date -Is)"
echo ""

TOTAL_MEM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}' || echo "2048")
if [ "$TOTAL_MEM_MB" -lt 1024 ] 2>/dev/null; then
  HEAP_SIZE="512"
elif [ "$TOTAL_MEM_MB" -lt 2048 ] 2>/dev/null; then
  HEAP_SIZE="1024"
else
  HEAP_SIZE="${NODE_HEAP_SIZE:-1536}"
fi
echo "  Memory available: ${TOTAL_MEM_MB}MB, Node heap: ${HEAP_SIZE}MB"

echo "[1/5] Validating environment..."
ERRORS=0

if [ -z "$DB_PASSWORD" ] && [ -n "$POSTGRES_PASSWORD" ]; then
  export DB_PASSWORD="$POSTGRES_PASSWORD"
fi
if [ -z "$POSTGRES_PASSWORD" ] && [ -n "$DB_PASSWORD" ]; then
  export POSTGRES_PASSWORD="$DB_PASSWORD"
fi

if [ -z "$DATABASE_URL" ]; then
  if [ -n "$DB_PASSWORD" ]; then
    PG_USER="${POSTGRES_USER:-auditwise}"
    PG_DB="${POSTGRES_DB:-auditwise}"
    PG_HOST="${POSTGRES_HOST:-db}"
    PG_PORT="${POSTGRES_PORT:-5432}"
    ENCODED_PASS=$(node -e "console.log(encodeURIComponent(process.env.DB_PASSWORD))")
    export DATABASE_URL="postgresql://${PG_USER}:${ENCODED_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=public"
    echo "  DATABASE_URL constructed from component vars (password URL-encoded)."
  else
    echo "  FATAL: Neither DATABASE_URL nor DB_PASSWORD/POSTGRES_PASSWORD is set."
    ERRORS=1
  fi
fi

if [ -n "$DATABASE_URL" ]; then
  node -e "try { new URL(process.env.DATABASE_URL); } catch(e) { console.error('  FATAL: DATABASE_URL is not a valid URL:', e.message); process.exit(1); }" || ERRORS=1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "  WARN: JWT_SECRET is not set. Auto-generating (tokens will not persist across restarts)."
  export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fi

if [ -z "$SESSION_SECRET" ]; then
  export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fi

if [ -z "$ENCRYPTION_MASTER_KEY" ]; then
  if [ "$NODE_ENV" = "production" ]; then
    echo "  FATAL: ENCRYPTION_MASTER_KEY is not set. Required in production."
    echo "  Generate with: openssl rand -hex 32"
    ERRORS=1
  else
    echo "  WARN: ENCRYPTION_MASTER_KEY is not set. Auto-generating (dev only)."
    export ENCRYPTION_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  fi
fi

if [ "$ERRORS" -eq 1 ]; then
  echo ""
  echo "FATAL: Environment validation failed. Cannot start."
  exit 1
fi
echo "  Environment validated."

echo "[2/5] Waiting for database to be ready..."
MAX_WAIT=90
ATTEMPT=0
DELAY=1

while [ "$ATTEMPT" -lt "$MAX_WAIT" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  if node -e "
    const url = new URL(process.env.DATABASE_URL);
    const net = require('net');
    const s = new net.Socket();
    s.setTimeout(2000);
    s.connect(parseInt(url.port) || 5432, url.hostname, () => { s.destroy(); process.exit(0); });
    s.on('error', () => process.exit(1));
    s.on('timeout', () => { s.destroy(); process.exit(1); });
  " 2>/dev/null; then
    echo "  Database is reachable after ${ATTEMPT}s."
    break
  fi
  if [ "$ATTEMPT" -eq "$MAX_WAIT" ]; then
    echo "FATAL: Database not reachable after ${MAX_WAIT}s."
    echo "Check DATABASE_URL and ensure PostgreSQL container is running and healthy."
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

echo "[3/5] Generating Prisma client..."
NODE_OPTIONS="--max-old-space-size=$HEAP_SIZE" npx prisma generate 2>&1 || {
  echo "  WARN: Prisma generate failed (may already be generated)."
}
echo "  Prisma client ready."

echo "[4/5] Running database migrations..."
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "  Found prisma/migrations — running prisma migrate deploy..."
  NODE_OPTIONS="--max-old-space-size=$HEAP_SIZE" npx prisma migrate deploy 2>&1 || {
    echo "  WARN: prisma migrate deploy failed. Falling back to prisma db push..."
    NODE_OPTIONS="--max-old-space-size=$HEAP_SIZE" npx prisma db push --skip-generate 2>&1 || {
      echo "FATAL: Database schema sync failed."
      exit 1
    }
  }
else
  echo "  No migrations directory — running prisma db push..."
  NODE_OPTIONS="--max-old-space-size=$HEAP_SIZE" npx prisma db push --skip-generate 2>&1 || {
    echo ""
    echo "FATAL: Database schema sync failed."
    echo "Possible causes:"
    echo "  - Authentication failure (check DATABASE_URL credentials)"
    echo "  - Schema has destructive changes (run manually with --accept-data-loss after backup)"
    echo "  - Database version incompatibility"
    exit 1
  }
fi
echo "  Database schema synced successfully."

echo "[5/5] Starting AuditWise on port ${PORT:-5000}..."
exec node --max-old-space-size=$HEAP_SIZE dist/index.cjs
