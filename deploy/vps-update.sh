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
PREV_COMMIT=$(git rev-parse HEAD)

echo "[1/6] Pre-deploy backup..."
mkdir -p backups
if docker ps --format '{{.Names}}' | grep -q "auditwise-db"; then
  BACKUP_FILE="backups/pre-update_$(date +%Y%m%d_%H%M%S).sql.gz"
  docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null | gzip > "$BACKUP_FILE" \
    && log "Backup: $(du -h "$BACKUP_FILE" | cut -f1)" \
    || warn "Backup failed (non-fatal)"
fi

echo "[2/6] Pulling latest from GitHub (${BRANCH})..."
git fetch --all -q
git reset --hard "origin/${BRANCH}" -q
NEW_COMMIT=$(git rev-parse HEAD)
log "Commit: $(git log --oneline -1)"

if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  warn "No new commits. Rebuilding anyway."
fi

echo "[3/6] Rebuilding containers..."
docker compose build --no-cache 2>&1
docker compose up -d --force-recreate
log "Containers started"

echo "[4/6] Waiting for app to become healthy..."
APP_HEALTHY=false
for i in $(seq 1 240); do
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "App healthy after ${i}s"
    APP_HEALTHY=true
    break
  fi
  sleep 1
done

if [ "$APP_HEALTHY" = "false" ]; then
  warn "App failed to start. Rolling back to ${PREV_COMMIT:0:8}..."
  docker compose logs --tail 40 app
  echo ""
  docker compose down 2>/dev/null || true
  git reset --hard "$PREV_COMMIT" -q
  docker compose build --no-cache 2>&1
  docker compose up -d --force-recreate

  for i in $(seq 1 180); do
    ROLLBACK_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/health 2>/dev/null || echo "000")
    if [ "$ROLLBACK_CODE" = "200" ]; then
      log "Rollback successful — running on ${PREV_COMMIT:0:8}"
      break
    fi
    sleep 1
  done
  fail "Deployment failed — rolled back to ${PREV_COMMIT:0:8}"
fi

echo "[5/6] Updating NGINX config..."
SA_IPS=""
if [ -f .env ]; then
  SA_IPS=$(grep -oP 'SUPER_ADMIN_ALLOWED_IPS=\K.*' .env 2>/dev/null || true)
fi

NGINX_CONF=""
if [ -f /etc/nginx/sites-available/auditwise ]; then
  NGINX_CONF="/etc/nginx/sites-available/auditwise"
elif [ -f /etc/nginx/conf.d/auditwise.conf ]; then
  NGINX_CONF="/etc/nginx/conf.d/auditwise.conf"
fi

if [ -n "$NGINX_CONF" ]; then
  if [ -f "/etc/letsencrypt/live/auditwise.tech/fullchain.pem" ] && [ -f deploy/nginx/auditwise-ssl.conf ]; then
    cp deploy/nginx/auditwise-ssl.conf "$NGINX_CONF"
  elif [ -f deploy/nginx/auditwise.conf ]; then
    cp deploy/nginx/auditwise.conf "$NGINX_CONF"
  fi

  if [ -n "$SA_IPS" ]; then
    GEO_ENTRIES=""
    IFS=',' read -ra IP_ARRAY <<< "$SA_IPS"
    for ip in "${IP_ARRAY[@]}"; do
      ip=$(echo "$ip" | xargs)
      [ -n "$ip" ] && GEO_ENTRIES="${GEO_ENTRIES}    ${ip}/32    1;\n"
    done
    [ -n "$GEO_ENTRIES" ] && sed -i "/# Example: 203.0.113.50\/32 1;/a\\${GEO_ENTRIES}" "$NGINX_CONF"
  fi

  if nginx -t 2>&1; then
    systemctl reload nginx
    log "NGINX updated and reloaded"
  else
    warn "NGINX config test failed — keeping previous config"
  fi
else
  warn "No NGINX config found — skipping"
fi

echo "[6/6] Verifying endpoints..."
HEALTH=$(curl -sf http://127.0.0.1:5000/health 2>/dev/null || echo '{"status":"error"}')
HOME_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null || echo "000")
HOME_HTML=$(curl -sf http://127.0.0.1:5000/ 2>/dev/null | grep -c '<html' || true)

echo ""
echo "  /health  -> $(echo "$HEALTH" | head -c 80)"
echo "  /        -> HTTP ${HOME_CODE} (HTML: ${HOME_HTML})"
echo ""

docker image prune -f > /dev/null 2>&1 || true

if echo "$HEALTH" | grep -q '"status":"ok"' && [ "$HOME_CODE" = "200" ] && [ "$HOME_HTML" -ge 1 ]; then
  echo -e "  ${GREEN}UPDATE SUCCESSFUL — LIVE${NC}"
  echo "  Commit: ${NEW_COMMIT:0:8} (was: ${PREV_COMMIT:0:8})"
else
  [ "$HOME_CODE" != "200" ] && warn "/ returned HTTP ${HOME_CODE}"
  echo "$HEALTH" | grep -q '"status":"ok"' || warn "/health not ok"
  echo "  Debug: docker compose logs --tail 50 app"
fi

echo ""
echo "  Containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
