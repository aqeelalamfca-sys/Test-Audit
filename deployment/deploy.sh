#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/auditwise"
DEPLOY_DIR="$PROJECT_DIR/deployment"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "══════════════════════════════════════════"
echo "  AuditWise — Production Deploy"
echo "  $(date -Is)"
echo "══════════════════════════════════════════"
echo ""

cd "$PROJECT_DIR" || fail "Cannot cd to $PROJECT_DIR"

if [ ! -f "$DEPLOY_DIR/.env" ]; then
  if [ -f "$DEPLOY_DIR/.env.example" ]; then
    warn "No .env found. Creating from .env.example..."
    cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
    echo ""
    echo "  IMPORTANT: Edit deployment/.env with your production values before continuing."
    echo "  Required changes:"
    echo "    - POSTGRES_PASSWORD (generate: openssl rand -hex 24)"
    echo "    - JWT_SECRET (generate: openssl rand -hex 32)"
    echo "    - ENCRYPTION_MASTER_KEY (generate: openssl rand -hex 32)"
    echo "    - INITIAL_SUPER_ADMIN_PASSWORD"
    echo ""
    echo "  Then run this script again."
    exit 1
  else
    fail "No .env or .env.example found in deployment/"
  fi
fi

echo "[1/6] Pulling latest code from GitHub..."
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
git pull origin main || fail "git pull failed"
NEW_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  log "Already up to date ($NEW_COMMIT)"
else
  log "Updated: ${PREV_COMMIT:0:8} → ${NEW_COMMIT:0:8}"
fi

echo "[2/6] Pre-deploy database backup..."
mkdir -p "$PROJECT_DIR/backups"
if docker exec auditwise-db pg_isready -U auditwise -d auditwise -h localhost &>/dev/null; then
  BACKUP_FILE="backups/pre-deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
  docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null \
    | gzip > "$BACKUP_FILE"
  log "Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  warn "Database not running — skipping backup"
fi

echo "[3/6] Stopping existing containers..."
cd "$DEPLOY_DIR"
docker compose down --remove-orphans 2>/dev/null || true
log "Containers stopped"

echo "[4/6] Building and starting all services..."
docker compose up -d --build
log "Containers starting"

echo "[5/6] Waiting for services to become healthy..."

echo "  Waiting for database..."
for i in $(seq 1 60); do
  if docker exec auditwise-db pg_isready -U auditwise -d auditwise -h localhost &>/dev/null; then
    log "Database healthy (${i}s)"
    break
  fi
  [ "$i" -eq 60 ] && fail "Database not healthy after 60s"
  sleep 1
done

BACKEND_PORT=$(grep -E '^APP_PORT=' "$DEPLOY_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "5000")
BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONT_PORT=$(grep -E '^FRONTEND_PORT=' "$DEPLOY_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "3000")
FRONT_PORT="${FRONT_PORT:-3000}"

echo "  Waiting for backend on port ${BACKEND_PORT} (up to 4 min)..."
for i in $(seq 1 240); do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" &>/dev/null; then
    log "Backend healthy (${i}s)"
    break
  fi
  [ "$i" -eq 240 ] && {
    warn "Backend not healthy after 240s. Checking logs..."
    docker compose logs --tail 30 backend
    fail "Backend failed to start"
  }
  sleep 1
done

echo "  Waiting for frontend on port ${FRONT_PORT}..."
for i in $(seq 1 120); do
  if curl -sf "http://127.0.0.1:${FRONT_PORT}/" &>/dev/null; then
    log "Frontend healthy (${i}s)"
    break
  fi
  [ "$i" -eq 120 ] && warn "Frontend not responding after 120s"
  sleep 1
done

echo "  Waiting for nginx on port 80..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:80/api/health &>/dev/null; then
    log "Nginx healthy (${i}s)"
    break
  fi
  [ "$i" -eq 60 ] && warn "Nginx not responding after 60s"
  sleep 1
done

echo "[6/6] Running health check..."
echo ""
bash "$DEPLOY_DIR/healthcheck.sh" || true

echo ""
echo "══════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo ""
echo "  App:   http://localhost:80"
echo "  API:   http://localhost:5000/api/health"
echo ""
echo "  Commands:"
echo "    docker compose -f deployment/docker-compose.yml logs -f"
echo "    docker compose -f deployment/docker-compose.yml ps"
echo "    bash deployment/healthcheck.sh"
echo "══════════════════════════════════════════"

find "$PROJECT_DIR/backups" -name "*.sql.gz" -mtime +30 -delete 2>/dev/null || true
docker image prune -f &>/dev/null || true
