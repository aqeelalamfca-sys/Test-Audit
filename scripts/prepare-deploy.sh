#!/bin/bash
set -e

echo "=== AuditWise Deployment Package Builder ==="
echo ""

DEPLOY_DIR="/tmp/auditwise-deploy"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

echo "[1/5] Building application..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build 2>&1 | tail -5

echo "[2/5] Copying production files..."
cp -r dist "$DEPLOY_DIR/"
cp -r prisma "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/" 2>/dev/null || true

echo "[3/5] Creating setup script..."
cat > "$DEPLOY_DIR/setup.sh" << 'SETUP_EOF'
#!/bin/bash
set -e

echo "=== AuditWise Server Setup ==="
echo ""

if [ ! -f .env ]; then
  echo "Creating .env file — EDIT THIS with your actual values!"
  cat > .env << 'ENV_EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://auditwise:CHANGE_THIS_PASSWORD@localhost:5432/auditwise?schema=public
SESSION_SECRET=CHANGE_THIS_TO_RANDOM_64_CHARS
ADMIN_EMAIL=admin@yourfirm.com
ADMIN_PASSWORD=CHANGE_THIS_PASSWORD
FIRM_NAME=Your Audit Firm Name
CORS_ORIGINS=https://yourdomain.com
ENV_EOF
  echo ""
  echo ">>> IMPORTANT: Edit .env before continuing!"
  echo ">>> Run: nano .env"
  echo ""
  exit 0
fi

echo "[1/6] Installing system packages..."
apt update -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs postgresql postgresql-contrib nginx certbot python3-certbot-nginx
npm install -g pm2

echo "[2/6] Setting up PostgreSQL..."
DB_PASS=$(grep DATABASE_URL .env | sed 's/.*:\/\/auditwise:\(.*\)@.*/\1/')
sudo -u postgres psql -c "CREATE USER auditwise WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "CREATE DATABASE auditwise OWNER auditwise;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "ALTER USER auditwise WITH PASSWORD '$DB_PASS';"

echo "[3/6] Installing Node.js dependencies..."
npm ci --omit=dev

echo "[4/6] Setting up database schema..."
set -a; source .env; set +a
NODE_OPTIONS="--max-old-space-size=4096" npx prisma generate
NODE_OPTIONS="--max-old-space-size=4096" npx prisma db push

echo "[5/6] Starting application with PM2..."
pm2 delete auditwise 2>/dev/null || true
pm2 start dist/index.cjs --name auditwise --node-args="--max-old-space-size=2560"
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

echo "[6/6] Configuring Nginx..."
SERVER_IP=$(hostname -I | awk '{print $1}')
cat > /etc/nginx/sites-available/auditwise << NGINX_EOF
server {
    listen 80;
    server_name $SERVER_IP _;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/auditwise /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo ""
echo "=== DONE! ==="
echo "AuditWise is running at: http://$SERVER_IP"
echo ""
echo "Login with the ADMIN_EMAIL and ADMIN_PASSWORD from your .env file."
echo ""
echo "To add SSL later, point your domain to $SERVER_IP and run:"
echo "  certbot --nginx -d yourdomain.com"
echo ""
echo "Useful commands:"
echo "  pm2 logs auditwise    — View application logs"
echo "  pm2 restart auditwise — Restart the application"
echo "  pm2 status            — Check if running"
SETUP_EOF
chmod +x "$DEPLOY_DIR/setup.sh"

cat > "$DEPLOY_DIR/update.sh" << 'UPDATE_EOF'
#!/bin/bash
set -e
echo "=== Updating AuditWise ==="
set -a; source .env; set +a
npm ci --omit=dev
NODE_OPTIONS="--max-old-space-size=4096" npx prisma generate
NODE_OPTIONS="--max-old-space-size=4096" npx prisma db push
pm2 restart auditwise
echo "Update complete!"
UPDATE_EOF
chmod +x "$DEPLOY_DIR/update.sh"

echo "[4/5] Creating zip file..."
cd /tmp
rm -f auditwise-deploy.zip
cd auditwise-deploy
zip -r /tmp/auditwise-deploy.zip . -x "node_modules/*" > /dev/null

SIZE=$(du -sh /tmp/auditwise-deploy.zip | cut -f1)
echo "[5/5] Done!"
echo ""
echo "=== Deployment package ready ==="
echo "File: /tmp/auditwise-deploy.zip ($SIZE)"
echo ""
echo "Next steps:"
echo "  1. Download the zip file"
echo "  2. Upload to your VPS: scp /tmp/auditwise-deploy.zip root@YOUR_SERVER_IP:/root/"
echo "  3. On VPS: cd /var/www && mkdir auditwise && cd auditwise"
echo "  4. On VPS: unzip /root/auditwise-deploy.zip"
echo "  5. On VPS: bash setup.sh  (first run creates .env — edit it)"
echo "  6. On VPS: nano .env      (set your passwords)"
echo "  7. On VPS: bash setup.sh  (second run installs everything)"
