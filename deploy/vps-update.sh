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
echo "  AuditWise Update"
echo "  $(date -Is)"
echo "══════════════════════════════════════════"

cd "$APP_DIR"

echo "[1/5] Pulling latest from GitHub (${BRANCH})..."
git fetch --all -q
git reset --hard "origin/${BRANCH}" -q
log "Commit: $(git log --oneline -1)"

echo "[2/5] Pre-deploy backup..."
if [ -f deploy/backup.sh ]; then
  bash deploy/backup.sh 2>/dev/null && log "Backup complete" || warn "Backup failed (non-fatal)"
fi

echo "[3/5] Rebuilding containers..."
docker compose up -d --build --force-recreate
log "Containers started"

echo "[4/5] Waiting for app to become healthy..."
for i in $(seq 1 240); do
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "App healthy after ${i}s"
    break
  fi
  if [ "$i" -eq 240 ]; then
    warn "App did not respond within 240s"
    docker compose logs --tail 30 app
    fail "App startup timeout"
  fi
  sleep 1
done

echo "[5/5] Verifying endpoints..."
HEALTH=$(curl -sf http://127.0.0.1:5000/health 2>/dev/null || echo '{"status":"error"}')
HOME_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null || echo "000")
HOME_HTML=$(curl -sf http://127.0.0.1:5000/ 2>/dev/null | grep -c '<html' || true)

echo ""
echo "  /health  -> $(echo "$HEALTH" | head -c 80)"
echo "  /        -> HTTP ${HOME_CODE} (HTML: ${HOME_HTML})"
echo ""

if echo "$HEALTH" | grep -q '"status":"ok"' && [ "$HOME_CODE" = "200" ] && [ "$HOME_HTML" -ge 1 ]; then
  echo -e "  ${GREEN}UPDATE SUCCESSFUL — LIVE${NC}"
else
  [ "$HOME_CODE" != "200" ] && warn "/ returned HTTP ${HOME_CODE} — check static file serving"
  echo "$HEALTH" | grep -q '"status":"ok"' || warn "/health not ok"
  echo ""
  echo "  Debug: docker compose logs --tail 50 app"
fi

echo ""
echo "  Containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
