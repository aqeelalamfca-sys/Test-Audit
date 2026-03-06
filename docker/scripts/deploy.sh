#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

echo "=== AuditWise Deployment ==="
echo "Compose file: $COMPOSE_FILE"
echo "Started at: $(date -Is)"
echo ""

if [ ! -f .env ]; then
  echo "WARNING: No .env file found. Copy .env.example to .env and configure it."
  echo "  cp .env.example .env"
  exit 1
fi

echo "[1/5] Pulling latest images..."
docker compose -f "$COMPOSE_FILE" pull

echo "[2/5] Building application..."
docker compose -f "$COMPOSE_FILE" build --no-cache app

echo "[3/5] Starting database..."
docker compose -f "$COMPOSE_FILE" up -d db
echo "  Waiting for database health check..."
docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U auditwise -d auditwise -h localhost 2>/dev/null || sleep 10

echo "[4/5] Starting application..."
docker compose -f "$COMPOSE_FILE" up -d app
echo "  Waiting for app health check (up to 2 minutes)..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if docker compose -f "$COMPOSE_FILE" exec -T app curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "  App is healthy after ${ELAPSED}s"
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done
if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "  WARNING: App health check timed out after ${TIMEOUT}s"
  echo "  Check logs: docker compose logs app"
fi

echo "[5/5] Starting nginx..."
docker compose -f "$COMPOSE_FILE" up -d nginx

echo ""
echo "=== Deployment Complete ==="
echo "  Backend:  http://localhost:${BACKEND_PORT:-5000}"
echo "  Frontend: http://localhost:${FRONTEND_PORT:-3000}"
echo "  Health:   http://localhost:${FRONTEND_PORT:-3000}/api/health"
echo ""
echo "Commands:"
echo "  Logs:     docker compose logs -f"
echo "  Status:   docker compose ps"
echo "  Stop:     docker compose down"
