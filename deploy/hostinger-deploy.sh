#!/usr/bin/env bash
set -euo pipefail

DOMAIN="auditwise.tech"
EMAIL="aqeelalam2010@gmail.com"
APP_DIR="/opt/auditwise"
REPO="https://github.com/aqeelalamfca-sys/Test-Audit.git"
BRANCH="main"

echo "=========================================="
echo "  AuditWise Production Deploy"
echo "  Domain: ${DOMAIN}"
echo "=========================================="

# ── 1. System dependencies ──
echo "[1/9] Installing system dependencies..."
apt-get update -y -qq
apt-get install -y -qq ca-certificates curl git nginx ufw certbot python3-certbot-nginx > /dev/null

# ── 2. Docker Engine + Compose v2 ──
echo "[2/9] Setting up Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# ── 3. Firewall ──
echo "[3/9] Configuring firewall..."
ufw allow OpenSSH   > /dev/null 2>&1 || true
ufw allow 80/tcp    > /dev/null 2>&1 || true
ufw allow 443/tcp   > /dev/null 2>&1 || true
ufw --force enable  > /dev/null 2>&1 || true

# ── 4. Clone / pull latest code ──
echo "[4/9] Fetching latest code..."
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
  echo "[5/9] Generating production secrets..."
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

INITIAL_SUPER_ADMIN_EMAIL=superadmin@auditwise.pk
INITIAL_SUPER_ADMIN_PASSWORD=Admin@2024!Secure

# Optional: set your OpenAI key for AI features
# OPENAI_API_KEY=sk-...
EOF

  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║  SAVE THESE SECRETS (shown only once)    ║"
  echo "╠══════════════════════════════════════════╣"
  echo "║  DB_PASSWORD:     ${DB_PASSWORD}"
  echo "║  JWT_SECRET:      ${JWT_SECRET}"
  echo "║  SESSION_SECRET:  ${SESSION_SECRET}"
  echo "║  ENCRYPTION_KEY:  ${ENCRYPTION_KEY}"
  echo "║  SuperAdmin:      superadmin@auditwise.pk"
  echo "║  SuperAdmin Pass: Admin@2024!Secure"
  echo "╚══════════════════════════════════════════╝"
  echo ""
  echo "⚠  Change the SuperAdmin password after first login!"
  echo ""
else
  echo "[5/9] .env already exists — keeping existing secrets."
fi

# ── 6. Build & start containers ──
echo "[6/9] Building and starting containers (this may take 3-5 minutes)..."
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
for i in $(seq 1 120); do
  if curl -sf http://127.0.0.1:5000/health &>/dev/null; then
    echo "    App is running on port 5000."
    break
  fi
  [ "$i" -eq 120 ] && { echo "ERROR: App did not start within 120s. Check: docker compose logs app"; exit 1; }
  sleep 1
done

# ── 7. Nginx reverse proxy ──
echo "[7/9] Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

cat > /etc/nginx/sites-available/auditwise <<'NGINX'
upstream auditwise_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

server {
    listen 80;
    server_name auditwise.tech www.auditwise.tech;

    client_max_body_size 50M;

    location / {
        proxy_pass http://auditwise_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/auditwise /etc/nginx/sites-enabled/auditwise
nginx -t
systemctl reload nginx

# ── 8. SSL certificate ──
echo "[8/9] Setting up SSL certificate..."
certbot --nginx \
  -d "${DOMAIN}" -d "www.${DOMAIN}" \
  --non-interactive --agree-tos -m "${EMAIL}" \
  --redirect 2>&1 || echo "    SSL setup failed — site will work on HTTP. Run certbot manually later."
systemctl reload nginx

# ── 9. Verify ──
echo "[9/9] Verifying deployment..."
echo ""

HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' "http://127.0.0.1:5000/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "╔══════════════════════════════════════════╗"
  echo "║  ✅ DEPLOYMENT SUCCESSFUL                ║"
  echo "║                                          ║"
  echo "║  🌐 https://${DOMAIN}/              ║"
  echo "║  🔧 Port: 5000 (internal)               ║"
  echo "║  📦 Docker: auditwise + auditwise-db    ║"
  echo "╚══════════════════════════════════════════╝"
else
  echo "⚠  App returned HTTP ${HTTP_CODE}. Check logs:"
  echo "   docker compose -f ${APP_DIR}/docker-compose.yml logs --tail 50 app"
fi

echo ""
echo "Useful commands:"
echo "  cd ${APP_DIR}"
echo "  docker compose ps              # container status"
echo "  docker compose logs -f app     # app logs (live)"
echo "  docker compose logs -f db      # database logs"
echo "  docker compose restart app     # restart app"
echo "  docker compose down && docker compose up -d  # full restart"
echo ""
echo "To update (after pushing to GitHub):"
echo "  cd ${APP_DIR} && git pull && docker compose up -d --build"
