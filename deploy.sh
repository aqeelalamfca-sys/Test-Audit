#!/usr/bin/env bash
set -euo pipefail

DOMAIN="auditwise.tech"
EMAIL="aqeelalam2010@gmail.com"
APP_DIR="/opt/auditwise"
REPO="https://github.com/aqeelalamfca-sys/Test-Audit.git"
BRANCH="${1:-main}"
SWAP_SIZE="4G"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
fail() { echo -e "${RED}[XX]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[--]${NC} $1"; }

echo ""
echo "================================================================"
echo "  AuditWise — Ultimate Production Deploy (All-in-Docker)"
echo "  Domain : ${DOMAIN}"
echo "  Branch : ${BRANCH}"
echo "  Target : ${APP_DIR}"
echo "  $(date -Is)"
echo "================================================================"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root. Use: sudo bash deploy.sh"
fi

echo "== Step 1/10: System dependencies =============================="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  ca-certificates curl git ufw certbot logrotate fail2ban > /dev/null 2>&1
log "System packages installed"

systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
apt-get remove -y nginx nginx-common 2>/dev/null || true
log "Host nginx removed (Nginx runs inside Docker)"

echo "== Step 2/10: Docker Engine ===================================="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  log "Docker installed"
else
  log "Docker already installed ($(docker --version | grep -oP '\d+\.\d+\.\d+'))"
fi
systemctl enable --now docker

if ! docker compose version &>/dev/null; then
  apt-get install -y -qq docker-compose-plugin > /dev/null 2>&1
fi
log "Docker Compose: $(docker compose version --short)"

echo "== Step 3/10: Swap & Firewall =================================="
if [ ! -f /swapfile ]; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "Swap (${SWAP_SIZE}) created"
else
  swapon /swapfile 2>/dev/null || true
  log "Swap already exists"
fi

sysctl -w vm.swappiness=10 > /dev/null 2>&1
grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

ufw allow OpenSSH > /dev/null 2>&1 || true
ufw allow 80/tcp  > /dev/null 2>&1 || true
ufw allow 443/tcp > /dev/null 2>&1 || true
ufw --force enable > /dev/null 2>&1 || true
log "Firewall configured (SSH + HTTP + HTTPS)"

echo "== Step 4/10: Fetch latest code ================================"
PREV_COMMIT=""
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
  git fetch --all -q
  git reset --hard "origin/${BRANCH}" -q
  log "Updated to $(git log --oneline -1)"
else
  rm -rf "$APP_DIR"
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
  log "Cloned branch ${BRANCH}"
fi
NEW_COMMIT=$(git rev-parse HEAD)

echo "== Step 5/10: Environment secrets =============================="
if [ ! -f .env ]; then
  DB_PASSWORD="${POSTGRES_PASSWORD:-Aqeel@123\$}"
  JWT_SECRET="$(openssl rand -hex 32)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  ENCRYPTION_KEY="$(openssl rand -hex 32)"
  SA_EMAIL="${INITIAL_SUPER_ADMIN_EMAIL:-aqeelalam2010@gmail.com}"
  SA_PASSWORD="${INITIAL_SUPER_ADMIN_PASSWORD:-Aqeel@123\$}"
  ENCODED_DB_PASS=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASSWORD}', safe=''))" 2>/dev/null || echo "${DB_PASSWORD}")

  cat > .env <<EOF
NODE_ENV=production
PORT=5000

POSTGRES_USER=auditwise
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=auditwise
POSTGRES_HOST=db
POSTGRES_PORT=5432

DATABASE_URL=postgresql://auditwise:${ENCODED_DB_PASS}@db:5432/auditwise?schema=public

REDIS_URL=redis://redis:6379

JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_MASTER_KEY=${ENCRYPTION_KEY}

INITIAL_SUPER_ADMIN_EMAIL=${SA_EMAIL}
INITIAL_SUPER_ADMIN_PASSWORD=${SA_PASSWORD}

SUPER_ADMIN_ALLOWED_IPS=
ADMIN_RESET=false

NODE_HEAP_SIZE=2560
EOF

  chmod 600 .env
  echo ""
  echo "  +-------------------------------------------+"
  echo "  |  SAVE THESE SECRETS (shown only once)      |"
  echo "  +-------------------------------------------+"
  echo "  |  DB_PASSWORD:     ${DB_PASSWORD}"
  echo "  |  JWT_SECRET:      ${JWT_SECRET:0:16}..."
  echo "  |  SESSION_SECRET:  ${SESSION_SECRET:0:16}..."
  echo "  |  ENCRYPTION_KEY:  ${ENCRYPTION_KEY:0:16}..."
  echo "  |  SuperAdmin:      ${SA_EMAIL}"
  echo "  |  SuperAdmin Pass: (see .env file)"
  echo "  +-------------------------------------------+"
  echo ""
  log "Production .env generated"
else
  log ".env already exists -- keeping existing secrets"
fi

echo "== Step 6/10: Pre-deploy backup ================================"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "auditwise-db"; then
  mkdir -p "${APP_DIR}/backups"
  BACKUP_FILE="${APP_DIR}/backups/pre-deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
  if docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null | gzip > "$BACKUP_FILE"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Pre-deploy backup saved: ${BACKUP_SIZE}"
  else
    warn "Pre-deploy backup failed (non-fatal, continuing)"
    rm -f "$BACKUP_FILE"
  fi

  BACKUP_COUNT=$(ls -1 "${APP_DIR}/backups/"*.sql.gz 2>/dev/null | wc -l)
  if [ "$BACKUP_COUNT" -gt 10 ]; then
    ls -1t "${APP_DIR}/backups/"*.sql.gz | tail -n +11 | xargs rm -f
    log "Pruned old backups (kept latest 10)"
  fi
else
  log "No running database -- skipping pre-deploy backup"
fi

echo "== Step 7/10: Prepare SSL directory ============================"
mkdir -p "${APP_DIR}/nginx/ssl"

if [ ! -f "${APP_DIR}/nginx/ssl/fullchain.pem" ]; then
  info "Generating self-signed SSL (will be replaced by Let's Encrypt)..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${APP_DIR}/nginx/ssl/privkey.pem" \
    -out "${APP_DIR}/nginx/ssl/fullchain.pem" \
    -subj "/CN=${DOMAIN}" 2>/dev/null
  log "Self-signed SSL certificate generated"
else
  log "SSL certificates already exist"
fi

echo "== Step 8/10: Docker build & start (all 5 containers) ========="
docker compose down --remove-orphans 2>/dev/null || true
docker image prune -f > /dev/null 2>&1 || true

info "Building images (5-10 min on first run)..."
if ! docker compose up -d --build 2>&1; then
  if [ -n "$PREV_COMMIT" ]; then
    warn "Build failed -- rolling back to previous commit ${PREV_COMMIT:0:8}"
    git reset --hard "$PREV_COMMIT" -q
    docker compose up -d --build 2>&1 || fail "Rollback build also failed"
    log "Rolled back to ${PREV_COMMIT:0:8}"
  fi
  fail "Docker build failed. Check Dockerfile and logs."
fi
log "All 5 containers started (db + redis + backend + frontend + nginx)"

info "Waiting for database..."
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U auditwise -d auditwise &>/dev/null; then
    log "Database healthy after ${i}s"
    break
  fi
  [ "$i" -eq 60 ] && fail "Database did not become healthy in 60s"
  sleep 1
done

info "Waiting for Redis..."
for i in $(seq 1 30); do
  if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    log "Redis healthy after ${i}s"
    break
  fi
  [ "$i" -eq 30 ] && warn "Redis did not respond (non-fatal)"
  sleep 1
done

info "Waiting for backend (up to 5 min for schema sync + seeding)..."
APP_HEALTHY=false
for i in $(seq 1 300); do
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "Backend healthy after ${i}s"
    APP_HEALTHY=true
    break
  fi
  if [ $((i % 30)) -eq 0 ]; then
    info "Still waiting... (${i}s, HTTP: ${HTTP_CODE})"
  fi
  sleep 1
done

if [ "$APP_HEALTHY" = "false" ]; then
  warn "Backend did not respond within 300s. Last HTTP code: ${HTTP_CODE}"
  echo "  Recent backend logs:"
  docker compose logs --tail 60 backend
  echo ""

  if [ -n "$PREV_COMMIT" ] && [ "$PREV_COMMIT" != "$NEW_COMMIT" ]; then
    warn "Rolling back to previous commit ${PREV_COMMIT:0:8}..."
    docker compose down 2>/dev/null || true
    git reset --hard "$PREV_COMMIT" -q
    docker compose up -d --build 2>&1 || true

    for i in $(seq 1 180); do
      ROLLBACK_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health 2>/dev/null || echo "000")
      if [ "$ROLLBACK_CODE" = "200" ]; then
        log "Rollback successful -- running on ${PREV_COMMIT:0:8}"
        break
      fi
      sleep 1
    done
  fi

  fail "Backend startup timeout -- deployment failed"
fi

info "Waiting for Nginx proxy..."
for i in $(seq 1 30); do
  NGINX_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1/api/health 2>/dev/null || echo "000")
  if [ "$NGINX_CODE" = "200" ]; then
    log "Nginx proxy healthy after ${i}s"
    break
  fi
  [ "$i" -eq 30 ] && warn "Nginx did not respond on port 80 (may still be starting)"
  sleep 1
done

echo "== Step 9/10: SSL certificate (Let's Encrypt) =================="
SERVER_IP=$(curl -sf ifconfig.me 2>/dev/null || curl -sf icanhazip.com 2>/dev/null || echo "unknown")

DNS_IP=$(dig +short "${DOMAIN}" 2>/dev/null | head -1 || echo "unknown")

if [ "$DNS_IP" = "$SERVER_IP" ] && [ "$DNS_IP" != "unknown" ]; then
  log "DNS verified: ${DOMAIN} -> ${SERVER_IP}"

  if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    log "Let's Encrypt certificate already exists"
    cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${APP_DIR}/nginx/ssl/fullchain.pem"
    cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${APP_DIR}/nginx/ssl/privkey.pem"
    docker compose restart nginx 2>/dev/null || true
  else
    info "Requesting SSL certificate from Let's Encrypt..."
    docker compose stop nginx 2>/dev/null || true
    sleep 2

    if certbot certonly --standalone -d "${DOMAIN}" -d "www.${DOMAIN}" \
         --non-interactive --agree-tos -m "${EMAIL}" 2>&1; then
      log "SSL certificate obtained"
      cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${APP_DIR}/nginx/ssl/fullchain.pem"
      cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${APP_DIR}/nginx/ssl/privkey.pem"

      if [ -f "${APP_DIR}/nginx/nginx-ssl.conf" ]; then
        cp "${APP_DIR}/nginx/nginx-ssl.conf" "${APP_DIR}/nginx/default.conf"
        log "Switched Nginx to SSL config"
      fi
    else
      warn "SSL setup failed -- site works on HTTP with self-signed cert"
      echo "  Run manually after DNS is pointing to this server:"
      echo "  cd ${APP_DIR} && docker compose stop nginx"
      echo "  certbot certonly --standalone -d ${DOMAIN} -d www.${DOMAIN} --agree-tos -m ${EMAIL}"
      echo "  cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem nginx/ssl/"
      echo "  cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem nginx/ssl/"
      echo "  cp nginx/nginx-ssl.conf nginx/default.conf"
      echo "  docker compose up -d nginx"
    fi

    docker compose up -d nginx 2>/dev/null || true
    sleep 3
  fi
else
  warn "DNS not pointing to this server yet (${DOMAIN} -> ${DNS_IP}, server -> ${SERVER_IP})"
  echo "  Site works on HTTP via IP. After DNS is set, run:"
  echo "  cd ${APP_DIR} && docker compose stop nginx"
  echo "  certbot certonly --standalone -d ${DOMAIN} -d www.${DOMAIN} --agree-tos -m ${EMAIL}"
  echo "  cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem nginx/ssl/"
  echo "  cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem nginx/ssl/"
  echo "  cp nginx/nginx-ssl.conf nginx/default.conf"
  echo "  docker compose up -d nginx"
fi

echo "== Step 10/10: Cron, logs & verification ======================="
mkdir -p "${APP_DIR}/backups" "${APP_DIR}/logs"

CRON_BACKUP="0 2 * * * cd ${APP_DIR} && docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null | gzip > backups/daily_\$(date +\\%Y\\%m\\%d).sql.gz 2>&1"
CRON_PRUNE="0 3 * * 0 cd ${APP_DIR} && ls -1t backups/*.sql.gz 2>/dev/null | tail -n +15 | xargs rm -f 2>/dev/null"
CRON_HEALTH="*/5 * * * * curl -sf http://127.0.0.1:5000/api/health > /dev/null || (cd ${APP_DIR} && docker compose restart backend 2>/dev/null)"
CRON_CERTBOT="0 4 * * 1 certbot renew --quiet --deploy-hook 'cd ${APP_DIR} && cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem nginx/ssl/ && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem nginx/ssl/ && docker compose restart nginx' 2>/dev/null"
CRON_DOCKER_PRUNE="0 4 * * 0 docker image prune -af --filter 'until=168h' 2>/dev/null"

(crontab -l 2>/dev/null | grep -v "auditwise-db pg_dump" | grep -v "backups/.*sql.gz.*tail" | grep -v "api/health.*docker compose restart" | grep -v "certbot renew" | grep -v "docker image prune"; echo "$CRON_BACKUP"; echo "$CRON_PRUNE"; echo "$CRON_HEALTH"; echo "$CRON_CERTBOT"; echo "$CRON_DOCKER_PRUNE") | crontab -
log "Cron: daily backup 2AM, weekly prune, 5-min health monitor, SSL renew, Docker cleanup"

cat > /etc/logrotate.d/auditwise <<LOGROTATE
${APP_DIR}/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
LOGROTATE
log "Log rotation configured (14 days)"

echo ""
info "Running endpoint verification..."

HEALTH_RESP=$(curl -sf http://127.0.0.1:5000/api/health 2>/dev/null || echo '{}')
HEALTH_OK=$(echo "$HEALTH_RESP" | grep -c '"status":"ok"' || true)

NGINX_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1/api/health 2>/dev/null || echo "000")
NGINX_FRONT=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1/ 2>/dev/null || echo "000")

REDIS_OK=$(docker exec auditwise-redis redis-cli ping 2>/dev/null || echo "FAIL")

echo ""
echo "  +---------------------------------------------------+"
echo "  |  Container Status                                  |"
echo "  +---------------------------------------------------+"
docker compose ps --format "  |  {{.Name}}\t{{.Status}}" 2>/dev/null || true
echo "  +---------------------------------------------------+"
echo ""
echo "  +---------------------------------------------------+"
echo "  |  Endpoint Verification                             |"
echo "  +---------------------------------------------------+"
echo "  |  Backend  :5000/api/health  -> $([ "$HEALTH_OK" -ge 1 ] && echo 'OK' || echo 'FAIL')"
echo "  |  Nginx    :80/api/health    -> HTTP ${NGINX_CODE}"
echo "  |  Nginx    :80/              -> HTTP ${NGINX_FRONT}"
echo "  |  Redis    :6379             -> ${REDIS_OK}"
echo "  |  Commit                     -> ${NEW_COMMIT:0:8}"
echo "  +---------------------------------------------------+"
echo ""

if [ "$HEALTH_OK" -ge 1 ] && [ "$NGINX_CODE" = "200" ]; then
  echo "================================================================"
  echo -e "  ${GREEN}DEPLOYMENT SUCCESSFUL — ALL CONTAINERS RUNNING${NC}"
  echo ""
  echo "  URL:      http://${DOMAIN}/"
  echo "  IP:       http://${SERVER_IP}/"
  echo "  Login:    $(grep INITIAL_SUPER_ADMIN_EMAIL .env 2>/dev/null | cut -d= -f2 || echo "$EMAIL")"
  echo "  Password: (see .env INITIAL_SUPER_ADMIN_PASSWORD)"
  echo ""
  echo "  Containers (5):"
  echo "    auditwise-db        PostgreSQL 15     :5432 (internal)"
  echo "    auditwise-redis     Redis 7           :6379 (internal)"
  echo "    auditwise-backend   Node.js API       :5000"
  echo "    auditwise-frontend  React SPA/Nginx   :80 (internal)"
  echo "    auditwise-nginx     Reverse Proxy     :80 :443"
  echo ""
  echo "  Quick commands:"
  echo "    cd ${APP_DIR}"
  echo "    docker compose ps                    # all container status"
  echo "    docker compose logs -f backend       # live backend logs"
  echo "    docker compose logs -f nginx         # live nginx logs"
  echo "    docker compose restart backend       # restart backend"
  echo "    docker compose down && docker compose up -d --build  # full rebuild"
  echo "    sudo bash deploy.sh                  # full redeploy"
  echo "================================================================"
else
  echo "================================================================"
  echo -e "  ${YELLOW}DEPLOYMENT WARNING${NC}"
  echo ""
  [ "$HEALTH_OK" -lt 1 ]       && echo "  [XX] Backend /api/health did not return status=ok"
  [ "$NGINX_CODE" != "200" ]   && echo "  [XX] Nginx :80 returned HTTP ${NGINX_CODE} instead of 200"
  echo ""
  echo "  Debug:"
  echo "    docker compose logs --tail 80 backend"
  echo "    docker compose logs --tail 40 nginx"
  echo "    docker compose logs --tail 40 frontend"
  echo "    docker compose ps"
  echo "    ss -tlnp | grep -E '80|443|5000|6379'"
  echo "================================================================"
  exit 1
fi
