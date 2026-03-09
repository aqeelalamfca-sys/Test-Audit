#!/usr/bin/env bash
set -euo pipefail

DOMAIN="auditwise.tech"
EMAIL="aqeelalam2010@gmail.com"
APP_DIR="/opt/auditwise"
REPO="https://github.com/aqeelalamfca-sys/Test-Audit.git"
BRANCH="${1:-main}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

echo "══════════════════════════════════════════════"
echo "  AuditWise — Native VPS Deploy (PM2 + Nginx)"
echo "  Domain: ${DOMAIN}"
echo "  Branch: ${BRANCH}"
echo "  $(date -Is)"
echo "══════════════════════════════════════════════"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  fail "Must run as root. Use: sudo bash deploy/vps-native-deploy.sh"
fi

echo "[1/12] Checking system prerequisites..."
command -v node   &>/dev/null || fail "Node.js not installed. Install: curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
command -v npm    &>/dev/null || fail "npm not found"
command -v nginx  &>/dev/null || { apt-get update -qq && apt-get install -y -qq nginx; }
command -v pm2    &>/dev/null || npm install -g pm2

NODE_VER=$(node --version)
log "Node.js ${NODE_VER}, npm $(npm --version), PM2 $(pm2 --version 2>/dev/null || echo 'installing...')"

echo "[2/12] Setting up PostgreSQL..."
if ! command -v psql &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq postgresql postgresql-contrib
fi
systemctl enable --now postgresql

PG_RUNNING=$(systemctl is-active postgresql || true)
if [ "$PG_RUNNING" != "active" ]; then
  systemctl start postgresql
fi
log "PostgreSQL is running"

echo "[3/12] Configuring firewall..."
if command -v ufw &>/dev/null; then
  ufw allow OpenSSH > /dev/null 2>&1 || true
  ufw allow 80/tcp  > /dev/null 2>&1 || true
  ufw allow 443/tcp > /dev/null 2>&1 || true
  ufw --force enable > /dev/null 2>&1 || true
  log "Firewall: SSH + HTTP + HTTPS"
else
  warn "ufw not found — skipping firewall setup"
fi

echo "[4/12] Fetching latest code..."
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

echo "[5/12] Generating environment secrets..."
if [ ! -f .env ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 32)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  ENCRYPTION_KEY="$(openssl rand -hex 32)"
  SA_PASSWORD="${INITIAL_SUPER_ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)Aa1!}"

  cat > .env <<EOF
NODE_ENV=production
PORT=5000

POSTGRES_USER=auditwise
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=auditwise
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

DATABASE_URL=postgresql://auditwise:${DB_PASSWORD}@localhost:5432/auditwise?schema=public

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

get_env() { grep "^${1}=" .env 2>/dev/null | head -1 | cut -d= -f2-; }
DB_PASSWORD="$(get_env POSTGRES_PASSWORD)"
DATABASE_URL="$(get_env DATABASE_URL)"
export DATABASE_URL

echo "[6/12] Creating PostgreSQL database and user..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='auditwise'\" | grep -q 1" 2>/dev/null || \
  su - postgres -c "psql -c \"CREATE USER auditwise WITH PASSWORD '${DB_PASSWORD}' CREATEDB;\""

su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='auditwise'\" | grep -q 1" 2>/dev/null || \
  su - postgres -c "psql -c \"CREATE DATABASE auditwise OWNER auditwise ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;\""

su - postgres -c "psql -c \"ALTER USER auditwise WITH PASSWORD '${DB_PASSWORD}';\"" 2>/dev/null || true

PG_HBA=$(su - postgres -c "psql -t -c 'SHOW hba_file'" | xargs)
if [ -f "$PG_HBA" ]; then
  if ! grep -q "auditwise" "$PG_HBA" 2>/dev/null; then
    sed -i '1i\local   auditwise   auditwise   md5' "$PG_HBA"
    sed -i '2i\host    auditwise   auditwise   127.0.0.1/32   md5' "$PG_HBA"
    systemctl reload postgresql
  fi
fi

if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U auditwise -d auditwise -c "SELECT 1" &>/dev/null; then
  log "PostgreSQL database 'auditwise' ready and accessible"
else
  warn "Database created but password auth may need pg_hba.conf adjustment"
  info "Trying peer auth via unix socket..."
fi

echo "[7/12] Installing Node.js dependencies..."
cd "$APP_DIR"
export NODE_OPTIONS="--max-old-space-size=4096"
npm ci --maxsockets 5 2>&1 | tail -5
log "Dependencies installed"

echo "[8/12] Generating Prisma client..."
npx prisma generate 2>&1 | tail -3
log "Prisma client generated"

echo "[9/12] Building application..."
info "This may take 2-5 minutes on first build..."
npm run build 2>&1 | tail -10

if [ ! -f dist/index.cjs ]; then
  fail "Build failed — dist/index.cjs not found"
fi

cp -rn public/* dist/public/ 2>/dev/null || true
log "Build complete: $(ls -lh dist/index.cjs | awk '{print $5}') server bundle"

echo "[10/12] Running database migrations..."
export DATABASE_URL
npx prisma db push --skip-generate 2>&1 | tail -5
log "Database schema synced"

echo "[11/12] Starting app with PM2..."
mkdir -p "${APP_DIR}/logs" "${APP_DIR}/uploads/logos" "${APP_DIR}/uploads/notifications"

pm2 delete auditwise 2>/dev/null || true

cd "$APP_DIR"
pm2 start ecosystem.config.cjs
pm2 save

pm2 startup systemd -u root --hp /root 2>/dev/null || true
log "PM2 process started"

info "Waiting for app to become healthy..."
APP_HEALTHY=false
for i in $(seq 1 120); do
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    log "App healthy after ${i}s"
    APP_HEALTHY=true
    break
  fi
  if [ "$((i % 15))" -eq 0 ]; then
    info "Still waiting... (${i}s)"
  fi
  sleep 1
done

if [ "$APP_HEALTHY" = "false" ]; then
  warn "App not healthy after 120s. Checking PM2 logs..."
  pm2 logs auditwise --lines 30 --nostream
  echo ""
  fail "App failed to start. Check logs above and .env configuration."
fi

echo "[12/12] Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
mkdir -p /var/www/certbot 2>/dev/null || true

cp deploy/nginx/auditwise.conf /etc/nginx/sites-available/auditwise
ln -sf /etc/nginx/sites-available/auditwise /etc/nginx/sites-enabled/auditwise

SA_IPS=$(grep -oP 'SUPER_ADMIN_ALLOWED_IPS=\K.*' .env 2>/dev/null || true)
if [ -n "$SA_IPS" ]; then
  GEO_ENTRIES=""
  IFS=',' read -ra IP_ARRAY <<< "$SA_IPS"
  for ip in "${IP_ARRAY[@]}"; do
    ip=$(echo "$ip" | xargs)
    [ -n "$ip" ] && GEO_ENTRIES="${GEO_ENTRIES}    ${ip}/32    1;\n"
  done
  [ -n "$GEO_ENTRIES" ] && sed -i "/# Example: 203.0.113.50\/32 1;/a\\${GEO_ENTRIES}" /etc/nginx/sites-available/auditwise
fi

if nginx -t 2>&1; then
  systemctl enable --now nginx
  systemctl reload nginx
  log "Nginx configured and running"
else
  fail "Nginx config test failed. Check: nginx -t"
fi

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
  log "SSL config activated"
else
  info "Requesting SSL certificate from Let's Encrypt..."
  if command -v certbot &>/dev/null; then
    if certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
       --non-interactive --agree-tos -m "${EMAIL}" --redirect 2>&1; then
      log "SSL certificate installed"
    else
      warn "SSL setup failed — site works on HTTP"
      info "Run manually later: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    fi
  else
    warn "certbot not installed — skipping SSL"
    info "Install: apt-get install -y certbot python3-certbot-nginx"
  fi
fi

mkdir -p "${APP_DIR}/backups" "${APP_DIR}/logs"
CRON_LINE="0 2 * * * cd ${APP_DIR} && PGPASSWORD=\$(grep POSTGRES_PASSWORD .env | cut -d= -f2) pg_dump -h localhost -U auditwise auditwise --no-owner --no-privileges 2>/dev/null | gzip > ${APP_DIR}/backups/daily_\$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz && find ${APP_DIR}/backups -name '*.sql.gz' -mtime +30 -delete"
(crontab -l 2>/dev/null | grep -v "pg_dump.*auditwise" ; echo "$CRON_LINE") | crontab -
log "Daily backup cron at 02:00 UTC (30-day retention)"

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

echo ""
echo "  ┌─────────────────────────────────────────────────┐"
echo "  │  Endpoint Verification                           │"
echo "  ├─────────────────────────────────────────────────┤"

HEALTH=$(curl -sf http://127.0.0.1:5000/health 2>/dev/null || echo '{}')
HOME_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null || echo "000")
HOME_HTML=$(curl -sf http://127.0.0.1:5000/ 2>/dev/null | grep -c '<html' || true)
NGINX_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:80/ 2>/dev/null || echo "000")

echo "  │  App /health     -> $(echo "$HEALTH" | head -c 50)"
echo "  │  App /            -> HTTP ${HOME_CODE} (HTML: ${HOME_HTML})"
echo "  │  Nginx / (port 80) -> HTTP ${NGINX_CODE}"
echo "  └─────────────────────────────────────────────────┘"
echo ""

PM2_STATUS=$(pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const a=JSON.parse(d);const p=a.find(x=>x.name==='auditwise');console.log(p?p.pm2_env.status:'unknown')}catch(e){console.log('unknown')}})" 2>/dev/null || echo "unknown")

if echo "$HEALTH" | grep -q '"status":"ok"' && [ "$HOME_CODE" = "200" ] && [ "$NGINX_CODE" = "200" ]; then
  echo "══════════════════════════════════════════════"
  echo -e "  ${GREEN}DEPLOYMENT SUCCESSFUL — SITE IS LIVE${NC}"
  echo ""
  echo "  URL:      https://${DOMAIN}/"
  echo "  Also:     http://${DOMAIN}/"
  echo "  Login:    $(grep INITIAL_SUPER_ADMIN_EMAIL .env 2>/dev/null | cut -d= -f2 || echo "$EMAIL")"
  echo "  Password: (see .env INITIAL_SUPER_ADMIN_PASSWORD)"
  echo ""
  echo "  PM2 Status: ${PM2_STATUS}"
  echo ""
  echo "  Management Commands:"
  echo "    cd ${APP_DIR}"
  echo "    pm2 logs auditwise          # live logs"
  echo "    pm2 status                  # process status"
  echo "    pm2 restart auditwise       # restart app"
  echo "    bash deploy/vps-native-update.sh  # update from GitHub"
  echo "══════════════════════════════════════════════"
else
  echo "══════════════════════════════════════════════"
  echo -e "  ${YELLOW}DEPLOYMENT WARNING${NC}"
  echo ""
  [ "$HOME_CODE" != "200" ] && echo "  [!] App returned HTTP ${HOME_CODE}"
  [ "$NGINX_CODE" != "200" ] && echo "  [!] Nginx returned HTTP ${NGINX_CODE} (check: nginx -t)"
  echo "$HEALTH" | grep -q '"status":"ok"' || echo "  [!] /health not ok"
  echo ""
  echo "  Debug:"
  echo "    pm2 logs auditwise --lines 50"
  echo "    tail -50 /var/log/nginx/error.log"
  echo "    cat ${APP_DIR}/.env"
  echo "══════════════════════════════════════════════"
  exit 1
fi
