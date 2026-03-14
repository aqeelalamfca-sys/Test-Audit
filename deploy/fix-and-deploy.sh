#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/auditwise"
BRANCH="${1:-main}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
fail() { echo -e "${RED}[XX]${NC} $1"; exit 1; }

echo "======================================"
echo "  AuditWise — Fix & Deploy"
echo "  $(date -Is)"
echo "======================================"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root. Use: sudo bash deploy/fix-and-deploy.sh"
fi

cd "$APP_DIR" || fail "App directory not found at ${APP_DIR}"

echo "[0/5] Fixing Docker APT Signed-By conflict..."
rm -f /etc/apt/keyrings/docker.asc \
      /etc/apt/keyrings/docker.gpg \
      /usr/share/keyrings/docker-archive-keyring.gpg \
      2>/dev/null || true
rm -f /etc/apt/sources.list.d/docker.list \
      /etc/apt/sources.list.d/docker.list.save \
      /etc/apt/sources.list.d/download_docker_com_linux_ubuntu.list \
      2>/dev/null || true
for f in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
  [ -f "$f" ] || continue
  grep -qi "download.docker.com" "$f" 2>/dev/null && rm -f "$f"
done
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
CODENAME=$(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}")
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y -qq 2>/dev/null || true
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
systemctl enable --now docker
log "Docker APT fixed: $(docker --version 2>/dev/null)"

echo "[1/5] Pulling latest code from GitHub..."
git fetch --all -q
git reset --hard "origin/${BRANCH}" -q
log "Updated to: $(git log --oneline -1)"

echo "[2/5] Pre-deploy backup..."
mkdir -p backups
if docker ps --format '{{.Names}}' | grep -q "auditwise-db"; then
  BACKUP_FILE="backups/pre-deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
  docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null | gzip > "$BACKUP_FILE" \
    && log "Backup saved: $(du -h "$BACKUP_FILE" | cut -f1)" \
    || warn "Backup failed (non-fatal, continuing)"
else
  warn "Database container not running — skipping backup"
fi

echo "[3/5] Rebuilding all containers..."
docker compose down --remove-orphans 2>/dev/null || true

docker compose build --no-cache backend frontend 2>&1 | tail -5
log "Images built"

docker compose up -d
log "All containers starting"

echo "[4/5] Waiting for services to become healthy..."

echo "  Waiting for database..."
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U auditwise -d auditwise &>/dev/null; then
    log "Database ready (${i}s)"
    break
  fi
  [ "$i" -eq 60 ] && warn "Database still not ready after 60s"
  sleep 1
done

echo "  Waiting for backend (up to 4 min)..."
for i in $(seq 1 240); do
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "Backend healthy (${i}s)"
    break
  fi
  [ "$i" -eq 240 ] && warn "Backend not healthy after 240s"
  sleep 1
done

echo "  Waiting for frontend..."
for i in $(seq 1 120); do
  if docker exec auditwise-frontend curl -sf http://localhost/ > /dev/null 2>&1; then
    log "Frontend healthy (${i}s)"
    break
  fi
  [ "$i" -eq 120 ] && warn "Frontend not healthy after 120s"
  sleep 1
done

echo "  Checking nginx..."
sleep 5
NGINX_STATUS=$(docker inspect --format='{{.State.Status}}' auditwise-nginx 2>/dev/null || echo "missing")
if [ "$NGINX_STATUS" = "running" ]; then
  log "Nginx is running"
else
  warn "Nginx status: ${NGINX_STATUS} — checking logs..."
  docker logs --tail 20 auditwise-nginx 2>&1 || true
  echo ""
  echo "  Attempting to restart nginx..."
  docker compose restart nginx 2>/dev/null || docker compose up -d nginx 2>/dev/null || true
  sleep 10
  NGINX_STATUS=$(docker inspect --format='{{.State.Status}}' auditwise-nginx 2>/dev/null || echo "missing")
  if [ "$NGINX_STATUS" = "running" ]; then
    log "Nginx recovered"
  else
    warn "Nginx still not running. Backend is accessible on port 5000 directly."
    warn "Debug: docker logs auditwise-nginx"
  fi
fi

echo "[5/5] Verification..."
echo ""

HEALTH=$(curl -sf http://127.0.0.1:5000/api/health 2>/dev/null || echo '{"status":"error"}')
HOME_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null || echo "000")
NGINX_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:80/ 2>/dev/null || echo "000")

echo "  Backend health:  $(echo "$HEALTH" | head -c 80)"
echo "  Backend (5000):  HTTP ${HOME_CODE}"
echo "  Nginx (80):      HTTP ${NGINX_CODE}"
echo ""

echo "  Containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
echo ""

docker image prune -f > /dev/null 2>&1 || true

if echo "$HEALTH" | grep -q '"status":"ok"' && [ "$HOME_CODE" = "200" ]; then
  echo "======================================"
  echo -e "  ${GREEN}DEPLOYMENT SUCCESSFUL${NC}"
  echo ""
  if [ "$NGINX_CODE" = "200" ] || [ "$NGINX_CODE" = "301" ] || [ "$NGINX_CODE" = "302" ]; then
    echo "  Site is live at: http://187.77.130.117/"
    echo "  (Configure DNS for your domain to point here)"
  else
    echo "  Backend is live at: http://187.77.130.117:5000/"
    echo "  Nginx may need manual attention for port 80"
  fi
  echo "======================================"
else
  echo "======================================"
  echo -e "  ${YELLOW}PARTIAL DEPLOYMENT${NC}"
  echo ""
  echo "  Backend health returned: $HEALTH"
  echo "  Debug: docker compose logs --tail 50 backend"
  echo "======================================"
fi

echo ""
echo "  Next steps:"
echo "    docker compose logs -f           # live logs"
echo "    docker compose ps                # container status"
echo "    docker logs auditwise-nginx      # nginx logs"
echo "    docker logs auditwise-backend    # backend logs"
echo ""
