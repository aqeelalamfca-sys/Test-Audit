#!/bin/bash
set -e

echo "=============================================="
echo "  AuditWise VPS Deployment Script"
echo "=============================================="
echo ""

DEPLOY_DIR="/var/www/auditwise"
REPO_URL="https://github.com/aqeelalamfca-sys/Test-Audit.git"
BRANCH="main"

command -v docker >/dev/null 2>&1 || { echo "FATAL: Docker is not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "FATAL: Git is not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || docker-compose version >/dev/null 2>&1 || { echo "FATAL: Docker Compose is not installed."; exit 1; }

echo "[1/7] Setting up project directory..."
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

if [ ! -d ".git" ]; then
  echo "  Cloning repository..."
  git clone "$REPO_URL" .
else
  echo "  Pulling latest changes..."
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

echo "[2/7] Creating .env file..."
if [ ! -f .env ]; then
  echo "  Generating .env from .env.example..."
  cp .env.example .env

  POSTGRES_PASS=$(openssl rand -hex 24)
  JWT_SEC=$(openssl rand -hex 32)
  SESSION_SEC=$(openssl rand -hex 32)
  ENCRYPTION_KEY=$(openssl rand -hex 32)

  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASS}|" .env
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SEC}|" .env
  sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SEC}|" .env
  sed -i "s|ENCRYPTION_MASTER_KEY=.*|ENCRYPTION_MASTER_KEY=${ENCRYPTION_KEY}|" .env
  sed -i "s|NODE_ENV=.*|NODE_ENV=production|" .env
  sed -i "s|DOMAIN=.*|DOMAIN=auditwise.tech|" .env
  sed -i "s|INITIAL_SUPER_ADMIN_EMAIL=.*|INITIAL_SUPER_ADMIN_EMAIL=aqeelalam2010@gmail.com|" .env
  sed -i "s|INITIAL_SUPER_ADMIN_PASSWORD=.*|INITIAL_SUPER_ADMIN_PASSWORD=Aqeel@123\$|" .env

  echo "  .env created with auto-generated secrets."
  echo "  IMPORTANT: Save POSTGRES_PASSWORD — you'll need it if recreating the database."
  echo "  Password: ${POSTGRES_PASS}"
else
  echo "  .env already exists — keeping existing configuration."
fi

echo "[3/7] Making entrypoint scripts executable..."
chmod +x docker/docker-entrypoint.sh docker/nginx-entrypoint.sh 2>/dev/null || true

echo "[4/7] Stopping any existing containers..."
docker compose down 2>/dev/null || true

echo "[5/7] Building and starting containers..."
docker compose up -d --build

echo "[6/7] Waiting for services to start (this takes 2-3 minutes)..."
echo "  Waiting for database..."
for i in $(seq 1 60); do
  if docker exec auditwise-db pg_isready -U auditwise -d auditwise -q 2>/dev/null; then
    echo "  Database ready after ${i}s"
    break
  fi
  sleep 2
done

echo "  Waiting for backend (may take 60-120s for Prisma schema sync)..."
for i in $(seq 1 90); do
  if curl -sf http://localhost:5000/api/health >/dev/null 2>&1; then
    echo "  Backend ready after $((i*2))s"
    break
  fi
  if [ "$i" -eq 90 ]; then
    echo "  WARNING: Backend not ready after 180s. Check logs: docker logs auditwise-backend"
  fi
  sleep 2
done

echo "  Waiting for nginx..."
for i in $(seq 1 30); do
  if curl -sf http://localhost/ >/dev/null 2>&1; then
    echo "  Nginx ready after $((i*2))s"
    break
  fi
  sleep 2
done

echo "[7/7] Validating deployment..."
echo ""
echo "--- Container Status ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -10
echo ""
echo "--- Port Listeners ---"
ss -tulpn 2>/dev/null | grep -E ":80|:443|:5000|:5432|:6379" || netstat -tulpn 2>/dev/null | grep -E ":80|:443|:5000|:5432|:6379"
echo ""
echo "--- Health Checks ---"
echo -n "  /health:     "; curl -sf http://localhost:5000/health | head -c 80 && echo "" || echo "FAILED"
echo -n "  /api/health: "; curl -sf http://localhost:5000/api/health | head -c 80 && echo "" || echo "FAILED"
echo -n "  Nginx (80):  "; curl -sf -o /dev/null -w "%{http_code}" http://localhost/ && echo "" || echo "FAILED"
echo ""
echo "=============================================="
echo "  Deployment complete!"
echo ""
echo "  HTTP:  http://auditwise.tech"
echo "  Local: http://localhost"
echo ""
echo "  Next steps for HTTPS:"
echo "  1. Install certbot: apt install certbot"
echo "  2. Get cert: certbot certonly --webroot -w /var/www/certbot -d auditwise.tech -d www.auditwise.tech"
echo "  3. Copy certs: mkdir -p ${DEPLOY_DIR}/nginx/ssl && cp /etc/letsencrypt/live/auditwise.tech/fullchain.pem ${DEPLOY_DIR}/nginx/ssl/ && cp /etc/letsencrypt/live/auditwise.tech/privkey.pem ${DEPLOY_DIR}/nginx/ssl/"
echo "  4. Restart nginx: docker restart auditwise-nginx"
echo "=============================================="
