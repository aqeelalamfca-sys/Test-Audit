#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/auditwise"
BRANCH="${1:-main}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "══════════════════════════════════════════"
echo "  AuditWise — Native Update (PM2)"
echo "  $(date -Is)"
echo "══════════════════════════════════════════"
echo ""

cd "$APP_DIR"
get_env() { grep "^${1}=" .env 2>/dev/null | head -1 | cut -d= -f2-; }
export DATABASE_URL="$(get_env DATABASE_URL)"

PREV_COMMIT=$(git rev-parse HEAD)

echo "[1/7] Pre-update backup..."
mkdir -p backups
DB_PASSWORD="$(get_env POSTGRES_PASSWORD)"
if [ -n "$DB_PASSWORD" ]; then
  BACKUP_FILE="backups/pre-update_$(date +%Y%m%d_%H%M%S).sql.gz"
  if PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U auditwise auditwise --no-owner --no-privileges 2>/dev/null | gzip > "$BACKUP_FILE"; then
    log "Backup: $(du -h "$BACKUP_FILE" | cut -f1)"
  else
    warn "Backup failed (non-fatal)"
    rm -f "$BACKUP_FILE"
  fi
else
  warn "No POSTGRES_PASSWORD in .env — skipping backup"
fi

echo "[2/7] Pulling latest code..."
git fetch --all -q
git reset --hard "origin/${BRANCH}" -q
NEW_COMMIT=$(git rev-parse HEAD)
log "Commit: $(git log --oneline -1)"

if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  warn "No new commits. Rebuilding anyway."
fi

echo "[3/7] Installing dependencies..."
export NODE_OPTIONS="--max-old-space-size=4096"
npm ci --maxsockets 5 2>&1 | tail -3
log "Dependencies installed"

echo "[4/7] Generating Prisma client..."
npx prisma generate 2>&1 | tail -3

echo "[5/7] Building application..."
npm run build 2>&1 | tail -5
[ -f dist/index.cjs ] || fail "Build failed — dist/index.cjs not found"
cp -rn public/* dist/public/ 2>/dev/null || true
log "Build complete"

echo "[6/8] Migrating role data (pre-schema)..."
if [ -f deploy/migrate-roles.sql ]; then
  DB_PASSWORD="$(get_env POSTGRES_PASSWORD)"
  DB_NAME="$(echo "$DATABASE_URL" | sed -n 's|.*\/\([^?]*\).*|\1|p')"
  DB_USER="$(echo "$DATABASE_URL" | sed -n 's|.*\/\/\([^:]*\):.*|\1|p')"
  if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" "$DB_NAME" -f deploy/migrate-roles.sql 2>/dev/null; then
    log "Role migration complete"
  else
    warn "Role migration skipped (may already be done)"
  fi
fi

echo "[7/8] Syncing database schema..."
npx prisma db push --skip-generate 2>&1 | tail -3
log "Database schema synced"

echo "[8/8] Restarting PM2..."
pm2 restart auditwise || pm2 start ecosystem.config.cjs
pm2 save

APP_HEALTHY=false
for i in $(seq 1 120); do
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "App healthy after ${i}s"
    APP_HEALTHY=true
    break
  fi
  sleep 1
done

if [ "$APP_HEALTHY" = "false" ]; then
  warn "App not healthy. Rolling back to ${PREV_COMMIT:0:8}..."
  git reset --hard "$PREV_COMMIT" -q
  npm ci --maxsockets 5 2>&1 | tail -1
  npx prisma generate 2>&1 | tail -1
  npm run build 2>&1 | tail -1
  cp -rn public/* dist/public/ 2>/dev/null || true
  pm2 restart auditwise

  for i in $(seq 1 90); do
    ROLLBACK_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health 2>/dev/null || echo "000")
    if [ "$ROLLBACK_CODE" = "200" ]; then
      log "Rollback successful — running on ${PREV_COMMIT:0:8}"
      break
    fi
    sleep 1
  done
  fail "Update failed — rolled back to ${PREV_COMMIT:0:8}"
fi

HEALTH=$(curl -sf http://127.0.0.1:5000/api/health 2>/dev/null || echo '{}')

echo ""
echo "  /health -> $(echo "$HEALTH" | head -c 60)"
echo "  Commit: ${NEW_COMMIT:0:8} (was: ${PREV_COMMIT:0:8})"
echo ""

pm2 status
echo ""
echo -e "  ${GREEN}UPDATE SUCCESSFUL${NC}"
