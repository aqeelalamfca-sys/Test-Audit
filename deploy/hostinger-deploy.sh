#!/usr/bin/env bash
set -euo pipefail

DOMAIN="auditwise.tech"
EMAIL="aqeelalam2010@gmail.com"
APP_DIR="/opt/auditwise"
REPO="https://github.com/aqeelalamfca-sys/Test-Audit.git"
BRANCH="${1:-main}"
BACKUP_DIR="${APP_DIR}/backups"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "══════════════════════════════════════════"
echo "  AuditWise — Hostinger VPS Deploy"
echo "  Domain: ${DOMAIN}"
echo "  Branch: ${BRANCH}"
echo "  $(date -Is)"
echo "══════════════════════════════════════════"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root. Use: sudo bash deploy/hostinger-deploy.sh"
fi

echo "[1/10] Installing system dependencies..."
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl git nginx ufw certbot python3-certbot-nginx logrotate > /dev/null 2>&1
log "System packages installed"

echo "[2/10] Setting up Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  log "Docker installed"
else
  log "Docker already present"
fi
systemctl enable --now docker

if ! docker compose version &>/dev/null; then
  apt-get install -y docker-compose-plugin 2>/dev/null || fail "Cannot install Docker Compose"
fi
log "Docker Compose ready"

echo "[3/10] Configuring firewall..."
ufw allow OpenSSH   > /dev/null 2>&1 || true
ufw allow 80/tcp    > /dev/null 2>&1 || true
ufw allow 443/tcp   > /dev/null 2>&1 || true
ufw --force enable  > /dev/null 2>&1 || true
log "Firewall active (SSH + HTTP + HTTPS)"

echo "[4/10] Fetching latest code..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch --all -q
  git reset --hard "origin/${BRANCH}" -q
  log "Updated to $(git log --oneline -1)"
else
  rm -rf "$APP_DIR"
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
  log "Cloned branch ${BRANCH}"
fi

echo "[5/10] Generating production secrets..."
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
  echo "  Change the SuperAdmin password after first login!"
  echo "  Set SUPER_ADMIN_ALLOWED_IPS in .env to your IP!"
  echo ""
  log "Secrets generated"
else
  log ".env already exists — keeping existing secrets"
fi

echo "[6/10] Building and starting containers..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build --force-recreate

echo "  Waiting for database..."
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U auditwise -d auditwise &>/dev/null; then
    log "Database healthy"
    break
  fi
  [ "$i" -eq 60 ] && fail "Database did not become healthy in 60s"
  sleep 1
done

echo "  Waiting for app (up to 4 min)..."
for i in $(seq 1 240); do
  if curl -sf http://127.0.0.1:5000/health &>/dev/null; then
    log "App healthy after ${i}s"
    break
  fi
  [ "$i" -eq 240 ] && fail "App did not start within 240s. Check: docker compose logs app"
  sleep 1
done

echo "[7/10] Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
mkdir -p /var/www/certbot 2>/dev/null || true

cp deploy/nginx/auditwise.conf /etc/nginx/sites-available/auditwise

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
  [ -n "$GEO_ENTRIES" ] && sed -i "/# Example: 203.0.113.50\/32 1;/a\\${GEO_ENTRIES}" /etc/nginx/sites-available/auditwise
fi

ln -sf /etc/nginx/sites-available/auditwise /etc/nginx/sites-enabled/auditwise
nginx -t && systemctl reload nginx
log "NGINX configured"

echo "[8/10] Setting up SSL certificate..."
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  log "SSL certificate already exists"
  cp deploy/nginx/auditwise-ssl.conf /etc/nginx/sites-available/auditwise
  if [ -n "$SA_IPS" ]; then
    GEO_ENTRIES=""
    IFS=',' read -ra IP_ARRAY <<< "$SA_IPS"
    for ip in "${IP_ARRAY[@]}"; do
      ip=$(echo "$ip" | xargs)
      [ -n "$ip" ] && GEO_ENTRIES="${GEO_ENTRIES}    ${ip}/32    1;\n"
    done
    [ -n "$GEO_ENTRIES" ] && sed -i "/# Example: 203.0.113.50\/32 1;/a\\${GEO_ENTRIES}" /etc/nginx/sites-available/auditwise
  fi
  nginx -t 2>&1 && systemctl reload nginx
  log "SSL config active"
else
  certbot --nginx \
    -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "${EMAIL}" \
    --redirect 2>&1 || warn "SSL setup failed — site works on HTTP. Run certbot manually later."
  systemctl reload nginx
fi

echo "[9/10] Setting up backups & log rotation..."
mkdir -p "$BACKUP_DIR" "${APP_DIR}/logs"
chmod +x "${APP_DIR}/deploy/backup.sh" 2>/dev/null || true

CRON_JOB="0 2 * * * BACKUP_DIR=${BACKUP_DIR} DB_CONTAINER=auditwise-db ${APP_DIR}/deploy/backup.sh >> ${APP_DIR}/logs/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "deploy/backup.sh" ; echo "$CRON_JOB") | crontab -
log "Daily backup at 02:00 UTC"

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
log "Log rotation configured"

echo "[10/10] Verifying deployment..."
echo ""

HEALTH=$(curl -sf http://127.0.0.1:5000/health 2>/dev/null || echo '{}')
HOME_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null || echo "000")

if echo "$HEALTH" | grep -q '"status":"ok"' && [ "$HOME_CODE" = "200" ]; then
  echo "══════════════════════════════════════════"
  echo "  DEPLOYMENT SUCCESSFUL"
  echo ""
  echo "  URL:     https://${DOMAIN}/"
  echo "  Login:   $(grep INITIAL_SUPER_ADMIN_EMAIL .env 2>/dev/null | cut -d= -f2 || echo "$EMAIL")"
  echo "  Pass:    (see .env INITIAL_SUPER_ADMIN_PASSWORD)"
  echo ""
  echo "  Containers:"
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
  echo "══════════════════════════════════════════"
else
  warn "App returned HTTP ${HOME_CODE}. Check: docker compose logs --tail 50 app"
fi

echo ""
echo "  Commands:"
echo "    cd ${APP_DIR}"
echo "    docker compose logs -f app     # live logs"
echo "    docker compose ps              # container status"
echo "    bash deploy/vps-update.sh      # update from GitHub"
echo "    bash deploy/backup.sh          # manual backup"
echo ""
