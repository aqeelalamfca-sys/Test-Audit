#!/usr/bin/env bash
set -euo pipefail

DOMAIN="auditwise.tech"
EMAIL="aqeelalam2010@gmail.com"
APP_DIR="/opt/auditwise"
REPO="https://github.com/aqeelalamfca-sys/Test-Audit.git"
BRANCH="main"
BACKUP_DIR="${APP_DIR}/backups"

echo "=========================================="
echo "  AuditWise Production Deploy"
echo "  Domain: ${DOMAIN}"
echo "=========================================="

# ── 1. System dependencies ──
echo "[1/10] Installing system dependencies..."
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl git nginx ufw certbot python3-certbot-nginx > /dev/null

# ── 2. Docker Engine + Compose v2 ──
echo "[2/10] Setting up Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# ── 3. Firewall ──
echo "[3/10] Configuring firewall..."
ufw allow OpenSSH   > /dev/null 2>&1 || true
ufw allow 80/tcp    > /dev/null 2>&1 || true
ufw allow 443/tcp   > /dev/null 2>&1 || true
ufw --force enable  > /dev/null 2>&1 || true

# ── 4. Clone / pull latest code ──
echo "[4/10] Fetching latest code..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch --all -q
  git reset --hard "origin/${BRANCH}" -q
else
  rm -rf "$APP_DIR"
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 5. Generate production .env (only on first deploy) ──
if [ ! -f .env ]; then
  echo "[5/10] Generating production secrets..."
  DB_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 32)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  ENCRYPTION_KEY="$(openssl rand -hex 32)"

  cat > .env <<EOF
NODE_ENV=production
PORT=5000

DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://auditwise:${DB_PASSWORD}@db:5432/auditwise?schema=public

JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_MASTER_KEY=${ENCRYPTION_KEY}

INITIAL_SUPER_ADMIN_EMAIL=aqeelalam2010@gmail.com
INITIAL_SUPER_ADMIN_PASSWORD=Aqeel@123\$

# Comma-separated IPs allowed for Super Admin login
# Add your static IP here, e.g.: SUPER_ADMIN_ALLOWED_IPS=203.0.113.50,198.51.100.25
SUPER_ADMIN_ALLOWED_IPS=

ADMIN_RESET=false

# Optional: set your OpenAI key for AI features
# OPENAI_API_KEY=sk-...
EOF

  chmod 600 .env

  echo ""
  echo "============================================"
  echo "  SAVE THESE SECRETS (shown only once)"
  echo "============================================"
  echo "  DB_PASSWORD:     ${DB_PASSWORD}"
  echo "  JWT_SECRET:      ${JWT_SECRET}"
  echo "  SESSION_SECRET:  ${SESSION_SECRET}"
  echo "  ENCRYPTION_KEY:  ${ENCRYPTION_KEY}"
  echo "  SuperAdmin:      aqeelalam2010@gmail.com"
  echo "  SuperAdmin Pass: Aqeel@123\$"
  echo "============================================"
  echo ""
  echo "  Change the SuperAdmin password after first login!"
  echo "  Set SUPER_ADMIN_ALLOWED_IPS in .env to your IP!"
  echo ""
else
  echo "[5/10] .env already exists -- keeping existing secrets."
fi

# ── 6. Build & start containers ──
echo "[6/10] Building and starting containers (this may take 3-5 minutes)..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build --force-recreate

echo "    Waiting for database to be healthy..."
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U auditwise -d auditwise &>/dev/null; then
    echo "    Database ready."
    break
  fi
  [ "$i" -eq 30 ] && { echo "ERROR: Database did not become healthy in 30s"; exit 1; }
  sleep 1
done

echo "    Waiting for app to start..."
for i in $(seq 1 180); do
  if curl -sf http://127.0.0.1:5000/health &>/dev/null; then
    echo "    App is running on port 5000."
    break
  fi
  [ "$i" -eq 180 ] && { echo "ERROR: App did not start within 180s. Check: docker compose logs app"; exit 1; }
  sleep 1
done

# ── 7. Nginx reverse proxy ──
echo "[7/10] Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

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
    if [ -n "$ip" ]; then
      GEO_ENTRIES="${GEO_ENTRIES}    ${ip}/32    1;\n"
    fi
  done
  if [ -n "$GEO_ENTRIES" ]; then
    sed -i "/# Example: 203.0.113.50\/32 1;/a\\${GEO_ENTRIES}" /etc/nginx/sites-available/auditwise
    echo "    Super Admin IP allowlist configured in NGINX."
  fi
fi

ln -sf /etc/nginx/sites-available/auditwise /etc/nginx/sites-enabled/auditwise
nginx -t
systemctl reload nginx

# ── 8. SSL certificate ──
echo "[8/10] Setting up SSL certificate..."
certbot --nginx \
  -d "${DOMAIN}" -d "www.${DOMAIN}" \
  --non-interactive --agree-tos -m "${EMAIL}" \
  --redirect 2>&1 || echo "    SSL setup failed -- site will work on HTTP. Run certbot manually later."
systemctl reload nginx

# ── 9. Daily backup cron ──
echo "[9/10] Setting up daily database backups..."
mkdir -p "$BACKUP_DIR"
chmod +x "${APP_DIR}/deploy/backup.sh" 2>/dev/null || true

CRON_JOB="0 2 * * * BACKUP_DIR=${BACKUP_DIR} DB_CONTAINER=auditwise-db ${APP_DIR}/deploy/backup.sh >> ${APP_DIR}/logs/backup.log 2>&1"
mkdir -p "${APP_DIR}/logs"

(crontab -l 2>/dev/null | grep -v "deploy/backup.sh" ; echo "$CRON_JOB") | crontab -
echo "    Daily backup scheduled at 02:00 UTC."

# ── 10. Verify ──
echo "[10/10] Verifying deployment..."
echo ""

HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' "http://127.0.0.1:5000/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "============================================"
  echo "  DEPLOYMENT SUCCESSFUL"
  echo ""
  echo "  URL:     https://${DOMAIN}/"
  echo "  Port:    5000 (internal)"
  echo "  Docker:  auditwise-app + auditwise-db"
  echo "  Backups: Daily at 02:00 UTC -> ${BACKUP_DIR}/"
  echo "============================================"
else
  echo "  App returned HTTP ${HTTP_CODE}. Check logs:"
  echo "   docker compose -f ${APP_DIR}/docker-compose.yml logs --tail 50 app"
fi

echo ""
echo "Useful commands:"
echo "  cd ${APP_DIR}"
echo "  docker compose ps              # container status"
echo "  docker compose logs -f app     # app logs (live)"
echo "  docker compose logs -f db      # database logs"
echo "  docker compose restart app     # restart app"
echo "  ./deploy/backup.sh             # manual backup"
echo ""
echo "To update (after pushing to GitHub):"
echo "  cd ${APP_DIR} && bash deploy/vps-update.sh"
