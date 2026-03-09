#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/auditwise"
BRANCH="${1:-main}"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
info() { echo -e "${CYAN}[--]${NC} $1"; }
fail() { echo -e "${RED}[XX]${NC} $1"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root. Use: sudo bash quick-deploy.sh"
fi

cd "$APP_DIR" || fail "Directory $APP_DIR not found"

echo "=== AuditWise Quick Deploy ($(date -Is)) ==="

info "Backing up database..."
mkdir -p backups
docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null | gzip > "backups/pre-deploy_$(date +%Y%m%d_%H%M%S).sql.gz" && log "Backup saved" || echo "  (backup skipped — db not running)"

info "Pulling latest code from ${BRANCH}..."
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
git fetch --all -q
git reset --hard "origin/${BRANCH}" -q
NEW_COMMIT=$(git rev-parse HEAD)
log "Updated: ${PREV_COMMIT:0:8} -> ${NEW_COMMIT:0:8}"

info "Building containers..."
docker compose build backend frontend 2>&1

info "Starting containers..."
docker compose up -d 2>&1
log "Containers started"

info "Waiting for backend to become healthy (up to 3 min)..."
for i in $(seq 1 180); do
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "Backend healthy after ${i}s"
    break
  fi
  if [ $((i % 30)) -eq 0 ]; then
    info "Still waiting... (${i}s, HTTP: ${HTTP_CODE})"
  fi
  if [ "$i" -eq 180 ]; then
    fail "Backend did not become healthy in 180s. Check: docker compose logs --tail 60 backend"
  fi
  sleep 1
done

echo ""
docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""
echo -e "${GREEN}=== Deploy complete — https://auditwise.tech ===${NC}"
