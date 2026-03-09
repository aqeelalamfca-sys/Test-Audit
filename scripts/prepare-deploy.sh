#!/bin/bash
set -e

echo "============================================"
echo "  AuditWise Deployment Package Builder"
echo "============================================"
echo ""

DEPLOY_DIR="/tmp/auditwise-deploy"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

echo "[1/6] Building application..."
NODE_OPTIONS="--max-old-space-size=8192" npm run build 2>&1 | tail -10

echo "[2/6] Copying production files..."
cp -r dist "$DEPLOY_DIR/"
cp -r prisma "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/" 2>/dev/null || true
cp ecosystem.config.cjs "$DEPLOY_DIR/" 2>/dev/null || true

echo "[3/6] Copying deployment scripts..."
mkdir -p "$DEPLOY_DIR/deploy/nginx"
cp deploy/hostinger-setup.sh "$DEPLOY_DIR/deploy/" 2>/dev/null || true
cp deploy/hostinger-update.sh "$DEPLOY_DIR/deploy/" 2>/dev/null || true
cp deploy/nginx/auditwise.conf "$DEPLOY_DIR/deploy/nginx/" 2>/dev/null || true
chmod +x "$DEPLOY_DIR/deploy/"*.sh 2>/dev/null || true

echo "[4/6] Copying Docker files..."
cp Dockerfile "$DEPLOY_DIR/" 2>/dev/null || true
cp docker-compose.yml "$DEPLOY_DIR/" 2>/dev/null || true
cp docker-entrypoint.sh "$DEPLOY_DIR/" 2>/dev/null || true
cp -r aws "$DEPLOY_DIR/" 2>/dev/null || true

echo "[5/6] Creating .env template..."
cat > "$DEPLOY_DIR/.env.example" << 'ENVEOF'
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://auditwise:YOUR_DB_PASSWORD@localhost:5432/auditwise?schema=public
DB_PASSWORD=YOUR_DB_PASSWORD

# Security
SESSION_SECRET=GENERATE_RANDOM_64_CHARS
JWT_SECRET=GENERATE_RANDOM_64_CHARS

# SuperAdmin (platform administrator)
INITIAL_SUPER_ADMIN_EMAIL=superadmin@auditwise.pk
INITIAL_SUPER_ADMIN_PASSWORD=YOUR_SECURE_PASSWORD

# Initial Firm Admin
ADMIN_EMAIL=admin@yourfirm.com
ADMIN_PASSWORD=YOUR_SECURE_PASSWORD
FIRM_NAME=Your Audit Firm Name

# CORS (comma-separated domains)
CORS_ORIGINS=https://yourdomain.com

# AI (optional)
# OPENAI_API_KEY=sk-...

# Memory allocation (MB)
NODE_HEAP_SIZE=2560
ENVEOF

echo "[6/6] Creating deployment package..."
cd /tmp
rm -f auditwise-deploy.tar.gz auditwise-deploy.zip
cd auditwise-deploy
tar -czf /tmp/auditwise-deploy.tar.gz --exclude="node_modules" .
zip -r /tmp/auditwise-deploy.zip . -x "node_modules/*" > /dev/null 2>&1 || true

SIZE_TAR=$(du -sh /tmp/auditwise-deploy.tar.gz | cut -f1)
echo ""
echo "============================================"
echo "  Deployment package ready!"
echo "============================================"
echo ""
echo "  File: /tmp/auditwise-deploy.tar.gz ($SIZE_TAR)"
echo ""
echo "  === HOSTINGER VPS DEPLOYMENT ==="
echo "  1. Upload:  scp /tmp/auditwise-deploy.tar.gz root@YOUR_SERVER_IP:/root/"
echo "  2. SSH in:  ssh root@YOUR_SERVER_IP"
echo "  3. Extract: mkdir -p /var/www/auditwise && cd /var/www/auditwise"
echo "              tar -xzf /root/auditwise-deploy.tar.gz"
echo "  4. Setup:   bash deploy/hostinger-setup.sh"
echo "              (First run creates .env — edit it, then re-run)"
echo ""
echo "  === AWS ECS DEPLOYMENT ==="
echo "  1. Configure AWS CLI: aws configure"
echo "  2. Set env vars: AWS_REGION, AWS_ACCOUNT_ID"
echo "  3. Run: bash aws/deploy.sh"
echo ""
echo "  === DOCKER COMPOSE (any VPS) ==="
echo "  1. Copy .env.example to .env and fill values"
echo "  2. Run: docker compose up -d"
echo ""
