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
  echo "ERROR: No .env file found."
  echo "  cp .env.example .env"
  echo "  # Edit .env with your production values"
  exit 1
fi

echo "[1/6] Pulling latest images..."
docker compose -f "$COMPOSE_FILE" pull db

echo "[2/6] Building backend and frontend..."
docker compose -f "$COMPOSE_FILE" build backend frontend

echo "[3/6] Starting database..."
docker compose -f "$COMPOSE_FILE" up -d db
echo "  Waiting for database health check..."
sleep 5
docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U auditwise -d auditwise -h localhost 2>/dev/null || sleep 10

echo "[4/6] Starting backend..."
docker compose -f "$COMPOSE_FILE" up -d backend
echo "  Waiting for backend health check (up to 2 minutes)..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if docker compose -f "$COMPOSE_FILE" exec -T backend curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "  Backend healthy after ${ELAPSED}s"
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done
if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "  WARNING: Backend health check timed out after ${TIMEOUT}s"
  echo "  Check logs: docker compose -f $COMPOSE_FILE logs backend"
fi

echo "[5/6] Starting frontend..."
docker compose -f "$COMPOSE_FILE" up -d frontend

echo "[6/6] Starting nginx reverse proxy..."
docker compose -f "$COMPOSE_FILE" up -d nginx

echo ""
echo "=== Deployment Complete ==="
echo "  Backend:  http://localhost:5000/api/health"
echo "  Frontend: http://localhost:3000"
echo "  Nginx:    http://localhost:80"
echo ""
echo "Commands:"
echo "  Logs:     docker compose -f $COMPOSE_FILE logs -f"
echo "  Status:   docker compose -f $COMPOSE_FILE ps"
echo "  Stop:     docker compose -f $COMPOSE_FILE down"
echo "  Restart:  docker compose -f $COMPOSE_FILE restart"
