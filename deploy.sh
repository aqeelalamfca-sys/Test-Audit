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
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "══════════════════════════════════════════"
echo "  AuditWise Production Deploy"
echo "  Domain: ${DOMAIN}"
echo "  Branch: ${BRANCH}"
echo "  $(date -Is)"
echo "══════════════════════════════════════════"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root. Use: sudo bash deploy.sh"
fi

echo "── Step 1/10: System dependencies ──"
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl git nginx ufw certbot python3-certbot-nginx logrotate > /dev/null 2>&1
log "System packages installed"

echo "── Step 2/10: Docker Engine ──"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  log "Docker installed"
else
  log "Docker already installed ($(docker --version | grep -oP '\d+\.\d+\.\d+'))"
fi
systemctl enable --now docker

if ! docker compose version &>/dev/null; then
  fail "Docker Compose plugin not found. Install: apt-get install -y docker-compose-plugin"
fi
log "Docker Compose: $(docker compose version --short)"

echo "── Step 3/10: Swap & Firewall ──"
if [ ! -f /swapfile ]; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "Swap (${SWAP_SIZE}) created"
else
  log "Swap already exists"
fi

sysctl -w vm.swappiness=10 > /dev/null 2>&1
grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

ufw allow OpenSSH > /dev/null 2>&1 || true
ufw allow 80/tcp  > /dev/null 2>&1 || true
ufw allow 443/tcp > /dev/null 2>&1 || true
ufw --force enable > /dev/null 2>&1 || true
log "Firewall configured (SSH + HTTP + HTTPS)"

echo "── Step 4/10: Fetch latest code ──"
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

echo "── Step 5/10: Environment secrets ──"
if [ ! -f .env ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 32)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  ENCRYPTION_KEY="$(openssl rand -hex 32)"
  SA_PASSWORD="${INITIAL_SUPER_ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)Aa1!}"

  cat > .env <<EOF
NODE_ENV=production
PORT=5000

DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://auditwise:${DB_PASSWORD}@db:5432/auditwise?schema=public

JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_MASTER_KEY=${ENCRYPTION_KEY}

INITIAL_SUPER_ADMIN_EMAIL=${EMAIL}
INITIAL_SUPER_ADMIN_PASSWORD=${SA_PASSWORD}

SUPER_ADMIN_ALLOWED_IPS=
ADMIN_RESET=false

NODE_HEAP_SIZE=2560

# OPENAI_API_KEY=sk-proj-...
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=
EOF

  chmod 600 .env
  echo ""
  echo "  ┌─────────────────────────────────────────┐"
  echo "  │  SAVE THESE SECRETS (shown only once)    │"
  echo "  ├─────────────────────────────────────────┤"
  echo "  │  DB_PASSWORD:     ${DB_PASSWORD}"
  echo "  │  JWT_SECRET:      ${JWT_SECRET:0:16}..."
  echo "  │  SESSION_SECRET:  ${SESSION_SECRET:0:16}..."
  echo "  │  ENCRYPTION_KEY:  ${ENCRYPTION_KEY:0:16}..."
  echo "  │  SuperAdmin:      ${EMAIL}"
  echo "  │  SuperAdmin Pass: (see .env file)"
  echo "  └─────────────────────────────────────────┘"
  echo ""
  log "Production .env generated"
else
  log ".env already exists — keeping existing secrets"
fi

echo "── Step 6/10: Pre-deploy backup ──"
if docker ps --format '{{.Names}}' | grep -q "auditwise-db"; then
  mkdir -p "${APP_DIR}/backups"
  BACKUP_FILE="${APP_DIR}/backups/pre-deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
  if docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null | gzip > "$BACKUP_FILE"; then
    log "Pre-deploy backup saved: $(du -h "$BACKUP_FILE" | cut -f1)"
  else
    warn "Pre-deploy backup failed (non-fatal, continuing)"
    rm -f "$BACKUP_FILE"
  fi
else
  log "No running database — skipping pre-deploy backup"
fi

echo "── Step 7/10: Docker build & start ──"
docker compose down --remove-orphans 2>/dev/null || true
docker image prune -f 2>/dev/null || true

echo "  Building images (3-8 min on first run)..."
if ! docker compose up -d --build --force-recreate 2>&1; then
  if [ -n "$PREV_COMMIT" ]; then
    warn "Build failed — rolling back to previous commit ${PREV_COMMIT:0:8}"
    git reset --hard "$PREV_COMMIT" -q
    docker compose up -d --build --force-recreate 2>&1 || fail "Rollback build also failed"
    log "Rolled back to ${PREV_COMMIT:0:8}"
  fi
  fail "Docker build failed. Check Dockerfile and logs."
fi
log "Containers started"

echo "  Waiting for database..."
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U auditwise -d auditwise &>/dev/null; then
    log "Database healthy"
    break
  fi
  [ "$i" -eq 60 ] && fail "Database did not become healthy in 60s"
  sleep 1
done

echo "  Waiting for app (up to 4 min for DB sync + seeding)..."
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
  warn "App did not respond within 240s. Last HTTP code: ${HTTP_CODE}"
  echo "  Recent logs:"
  docker compose logs --tail 40 app
  echo ""

  if [ -n "$PREV_COMMIT" ] && [ "$PREV_COMMIT" != "$NEW_COMMIT" ]; then
    warn "Rolling back to previous commit ${PREV_COMMIT:0:8}..."
    docker compose down 2>/dev/null || true
    git reset --hard "$PREV_COMMIT" -q
    docker compose up -d --build --force-recreate 2>&1 || true

    for i in $(seq 1 180); do
      ROLLBACK_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/health 2>/dev/null || echo "000")
      if [ "$ROLLBACK_CODE" = "200" ]; then
        log "Rollback successful — running on ${PREV_COMMIT:0:8}"
        break
      fi
      sleep 1
    done
  fi

  fail "App startup timeout — deployment failed"
fi

echo "── Step 8/10: NGINX reverse proxy ──"
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/certbot 2>/dev/null || true

if [ -d /etc/nginx/sites-available ]; then
  cp deploy/nginx/auditwise.conf /etc/nginx/sites-available/auditwise
  NGINX_CONF="/etc/nginx/sites-available/auditwise"
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/auditwise
else
  cp deploy/nginx/auditwise.conf /etc/nginx/conf.d/auditwise.conf
  NGINX_CONF="/etc/nginx/conf.d/auditwise.conf"
fi

SA_IPS=""
if [ -f .env ]; then
  SA_IPS=$(grep -oP 'SUPER_ADMIN_ALLOWED_IPS=\K.*' .env 2>/dev/null || true)
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
  log "NGINX configured and reloaded"
else
  fail "NGINX config invalid. Check: nginx -t"
fi

echo "── Step 9/10: SSL certificate ──"
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  log "SSL certificate already exists"
  if [ -f deploy/nginx/auditwise-ssl.conf ]; then
    cp deploy/nginx/auditwise-ssl.conf "$NGINX_CONF"
    if [ -n "$SA_IPS" ]; then
      GEO_ENTRIES=""
      IFS=',' read -ra IP_ARRAY <<< "$SA_IPS"
      for ip in "${IP_ARRAY[@]}"; do
        ip=$(echo "$ip" | xargs)
        [ -n "$ip" ] && GEO_ENTRIES="${GEO_ENTRIES}    ${ip}/32    1;\n"
      done
      [ -n "$GEO_ENTRIES" ] && sed -i "/# Example: 203.0.113.50\/32 1;/a\\${GEO_ENTRIES}" "$NGINX_CONF"
    fi
    nginx -t 2>&1 && systemctl reload nginx
    log "Switched to SSL config"
  fi
else
  if certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect 2>&1; then
    log "SSL certificate installed"
  else
    warn "SSL setup failed — site works on HTTP. Run manually:"
    echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m ${EMAIL} --redirect"
  fi
fi

echo "── Step 10/10: Backups, log rotation & verification ──"
mkdir -p "${APP_DIR}/backups" "${APP_DIR}/logs"
chmod +x deploy/backup.sh 2>/dev/null || true

CRON_LINE="0 2 * * * BACKUP_DIR=${APP_DIR}/backups DB_CONTAINER=auditwise-db ${APP_DIR}/deploy/backup.sh >> ${APP_DIR}/logs/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "deploy/backup.sh"; echo "$CRON_LINE") | crontab -
log "Daily backup cron at 02:00 UTC"

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

HEALTH_RESP=$(curl -sf http://127.0.0.1:5000/health 2>/dev/null || echo '{}')
HEALTH_OK=$(echo "$HEALTH_RESP" | grep -c '"status":"ok"' || true)

HOME_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null || echo "000")
HOME_HTML=$(curl -sf http://127.0.0.1:5000/ 2>/dev/null | grep -c '<html' || true)

API_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health/full 2>/dev/null || echo "000")

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  Endpoint Verification                   │"
echo "  ├─────────────────────────────────────────┤"
echo "  │  GET /         -> HTTP ${HOME_CODE} (HTML: ${HOME_HTML})"
echo "  │  GET /health   -> ${HEALTH_RESP:0:60}"
echo "  │  GET /api/...  -> HTTP ${API_CODE}"
echo "  │  Commit:       -> ${NEW_COMMIT:0:8}"
echo "  └─────────────────────────────────────────┘"
echo ""

if [ "$HEALTH_OK" -ge 1 ] && [ "$HOME_CODE" = "200" ] && [ "$HOME_HTML" -ge 1 ]; then
  echo "══════════════════════════════════════════"
  echo "  DEPLOYMENT SUCCESSFUL — LIVE"
  echo ""
  echo "  URL:      https://${DOMAIN}/"
  echo "  Login:    $(grep INITIAL_SUPER_ADMIN_EMAIL .env 2>/dev/null | cut -d= -f2 || echo "$EMAIL")"
  echo "  Password: (see .env INITIAL_SUPER_ADMIN_PASSWORD)"
  echo ""
  echo "  Containers:"
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "  Commands:"
  echo "    cd ${APP_DIR}"
  echo "    docker compose logs -f app    # live logs"
  echo "    docker compose ps             # status"
  echo "    bash deploy/vps-update.sh     # update from GitHub"
  echo "    bash deploy/backup.sh         # manual backup"
  echo "══════════════════════════════════════════"
else
  echo "══════════════════════════════════════════"
  echo "  DEPLOYMENT WARNING"
  echo ""
  [ "$HEALTH_OK" -lt 1 ] && echo "  [✗] /health did not return status=ok"
  [ "$HOME_CODE" != "200" ] && echo "  [✗] / returned HTTP ${HOME_CODE} instead of 200"
  [ "$HOME_HTML" -lt 1 ] && echo "  [✗] / did not return HTML content"
  echo ""
  echo "  Debug: docker compose logs --tail 50 app"
  echo "══════════════════════════════════════════"
  exit 1
fi
