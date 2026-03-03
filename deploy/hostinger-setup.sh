#!/bin/bash
set -e

echo "============================================"
echo "  AuditWise - Hostinger VPS Setup"
echo "  Ubuntu 24.04 LTS"
echo "============================================"
echo ""

APP_DIR="/var/www/auditwise"
LOG_DIR="/var/log/auditwise"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "[STEP 0] Creating .env template — EDIT THIS before re-running!"
  mkdir -p "$APP_DIR"
  cat > "$APP_DIR/.env" << 'ENVEOF'
NODE_ENV=production
PORT=5000

# Database (local PostgreSQL)
DATABASE_URL=postgresql://auditwise:CHANGE_THIS_DB_PASSWORD@localhost:5432/auditwise?schema=public
DB_PASSWORD=CHANGE_THIS_DB_PASSWORD

# Security
SESSION_SECRET=CHANGE_THIS_TO_RANDOM_64_CHARS
JWT_SECRET=CHANGE_THIS_TO_RANDOM_64_CHARS

# SuperAdmin bootstrap
INITIAL_SUPER_ADMIN_EMAIL=superadmin@auditwise.pk
INITIAL_SUPER_ADMIN_PASSWORD=CHANGE_THIS_SUPER_ADMIN_PASSWORD

# Initial firm admin (first firm setup)
ADMIN_EMAIL=admin@yourfirm.com
ADMIN_PASSWORD=CHANGE_THIS_ADMIN_PASSWORD
FIRM_NAME=Your Audit Firm Name

# CORS — set to your domain(s)
CORS_ORIGINS=https://yourdomain.com

# AI (optional)
# OPENAI_API_KEY=sk-...

# Memory
NODE_HEAP_SIZE=2560
ENVEOF
  echo ""
  echo ">>> .env file created at $APP_DIR/.env"
  echo ">>> EDIT IT NOW: nano $APP_DIR/.env"
  echo ">>> Then re-run this script."
  echo ""
  exit 0
fi

source "$APP_DIR/.env"

echo "[1/8] Updating system packages..."
apt update -y && apt upgrade -y

echo "[2/8] Installing prerequisites..."
apt install -y curl git build-essential nginx certbot python3-certbot-nginx ufw

echo "[3/8] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node.js $(node --version)"
npm install -g pm2

echo "[4/8] Installing and configuring PostgreSQL 16..."
if ! command -v psql &> /dev/null; then
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
  apt update -y
  apt install -y postgresql-16
fi

systemctl enable postgresql
systemctl start postgresql

sudo -u postgres psql -c "CREATE USER auditwise WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "  DB user already exists"
sudo -u postgres psql -c "CREATE DATABASE auditwise OWNER auditwise;" 2>/dev/null || echo "  Database already exists"
sudo -u postgres psql -c "ALTER USER auditwise WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -d auditwise -c "ALTER SCHEMA public OWNER TO auditwise;" 2>/dev/null || true
echo "  PostgreSQL configured"

echo "[5/8] Installing application dependencies..."
cd "$APP_DIR"
npm ci --omit=dev

echo "[6/8] Running database migrations..."
set -a; source .env; set +a
NODE_OPTIONS="--max-old-space-size=4096" npx prisma generate
NODE_OPTIONS="--max-old-space-size=4096" npx prisma db push --skip-generate

echo "[7/8] Starting application with PM2..."
mkdir -p "$LOG_DIR"
pm2 delete auditwise 2>/dev/null || true
if [ -f ecosystem.config.cjs ]; then
  pm2 start ecosystem.config.cjs
else
  pm2 start dist/index.cjs --name auditwise --node-args="--max-old-space-size=${NODE_HEAP_SIZE:-2560}" -e "$LOG_DIR/error.log" -o "$LOG_DIR/out.log"
fi
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash 2>/dev/null || true

echo "[8/8] Configuring Nginx..."
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -f deploy/nginx/auditwise.conf ]; then
  cp deploy/nginx/auditwise.conf /etc/nginx/sites-available/auditwise
  sed -i "s/server_name _;/server_name $SERVER_IP _;/" /etc/nginx/sites-available/auditwise
else
  cat > /etc/nginx/sites-available/auditwise << 'NGINXEOF'
upstream auditwise_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}
server {
    listen 80;
    server_name _;
    client_max_body_size 50M;
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    location / {
        proxy_pass http://auditwise_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF
fi
ln -sf /etc/nginx/sites-available/auditwise /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx && systemctl enable nginx

echo ""
echo "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "============================================"
echo "  AuditWise is running!"
echo "============================================"
echo ""
echo "  URL:  http://$SERVER_IP"
echo ""
echo "  SuperAdmin: $INITIAL_SUPER_ADMIN_EMAIL"
echo ""
echo "  To add SSL with your domain:"
echo "    1. Point your domain DNS A record to $SERVER_IP"
echo "    2. Edit /etc/nginx/sites-available/auditwise"
echo "       Change 'server_name' to your domain"
echo "    3. Run: certbot --nginx -d yourdomain.com"
echo "    4. Update CORS_ORIGINS in .env to https://yourdomain.com"
echo "    5. pm2 restart auditwise"
echo ""
echo "  Useful commands:"
echo "    pm2 logs auditwise        — View logs"
echo "    pm2 restart auditwise     — Restart app"
echo "    pm2 status                — Check status"
echo "    pm2 monit                 — Live monitor"
echo ""
