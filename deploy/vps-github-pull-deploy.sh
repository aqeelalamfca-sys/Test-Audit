#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/aqeelalamfca-sys/Test-Audit.git}"
APP_DIR="${APP_DIR:-/opt/auditwise}"
BRANCH="${1:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.vps.yml}"

echo "== AuditWise VPS Pull + Deploy =="
echo "Repo:    ${REPO_URL}"
echo "Branch:  ${BRANCH}"
echo "App dir: ${APP_DIR}"
echo "Compose: ${COMPOSE_FILE}"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "FATAL: Docker is not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "FATAL: Docker Compose plugin is not available."
  exit 1
fi

mkdir -p "$(dirname "${APP_DIR}")"

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "Cloning repository..."
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

echo "Pulling latest code from origin/${BRANCH}..."
git fetch origin "${BRANCH}" --prune
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

if [ ! -f ".env" ]; then
  echo "FATAL: .env is missing in ${APP_DIR}."
  echo "Create it first (required: POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_MASTER_KEY)."
  exit 1
fi

echo "Building backend image..."
docker compose -f "${COMPOSE_FILE}" build backend

echo "Starting stack..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "Waiting for backend health..."
for i in $(seq 1 90); do
  if curl -sf http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
    echo "SUCCESS: Backend is healthy."
    docker compose -f "${COMPOSE_FILE}" ps
    exit 0
  fi
  sleep 2
done

echo "FATAL: Backend health check failed after 180s."
docker compose -f "${COMPOSE_FILE}" logs --tail=120 backend
exit 1
