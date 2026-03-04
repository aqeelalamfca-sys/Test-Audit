#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/auditwise"
STEPS="${1:-1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root. Use: sudo bash scripts/rollback.sh"
fi

cd "$APP_DIR" || fail "Directory $APP_DIR not found"

CURRENT_COMMIT=$(git rev-parse --short HEAD)
TARGET_COMMIT=$(git rev-parse --short "HEAD~${STEPS}")

echo "══════════════════════════════════════════"
echo "  AuditWise Rollback"
echo "  Current: ${CURRENT_COMMIT}"
echo "  Target:  ${TARGET_COMMIT} (${STEPS} commit(s) back)"
echo "  $(date -Is)"
echo "══════════════════════════════════════════"
echo ""

read -rp "Proceed with rollback to ${TARGET_COMMIT}? (y/N): " CONFIRM
if [ "${CONFIRM,,}" != "y" ]; then
  echo "Rollback cancelled."
  exit 0
fi

echo "[1/5] Creating pre-rollback backup..."
if [ -f deploy/backup.sh ]; then
  bash deploy/backup.sh 2>/dev/null && log "Backup complete" || warn "Backup failed (non-fatal)"
fi

echo "[2/5] Reverting to commit ${TARGET_COMMIT}..."
git reset --hard "HEAD~${STEPS}"
log "Now at: $(git log --oneline -1)"

echo "[3/5] Rebuilding containers..."
docker compose up -d --build --force-recreate
log "Containers restarted"

echo "[4/5] Waiting for app to become healthy..."
for i in $(seq 1 240); do
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "App healthy after ${i}s"
    break
  fi
  if [ "$i" -eq 240 ]; then
    warn "App did not respond within 240s"
    docker compose logs --tail 20 app
    fail "Rollback may have failed — app not healthy"
  fi
  sleep 1
done

echo "[5/5] Verifying..."
HEALTH=$(curl -sf http://127.0.0.1:5000/health 2>/dev/null || echo '{}')
HOME_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null || echo "000")

echo ""
if echo "$HEALTH" | grep -q '"status":"ok"' && [ "$HOME_CODE" = "200" ]; then
  echo -e "  ${GREEN}ROLLBACK SUCCESSFUL${NC}"
  echo "  Rolled back from ${CURRENT_COMMIT} to ${TARGET_COMMIT}"
  echo "  /health -> ok"
  echo "  /       -> HTTP ${HOME_CODE}"
  echo ""
  echo "  To undo this rollback:"
  echo "    cd ${APP_DIR} && git pull && bash deploy/vps-update.sh"
else
  warn "Rollback completed but verification failed"
  echo "  /health -> $(echo "$HEALTH" | head -c 60)"
  echo "  /       -> HTTP ${HOME_CODE}"
  echo "  Debug: docker compose logs --tail 50 app"
fi
