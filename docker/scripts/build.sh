#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_ROOT"

BACKEND_IMAGE="${DOCKER_BACKEND_IMAGE:-ghcr.io/aqeelalamfca-sys/auditwise-backend}"
FRONTEND_IMAGE="${DOCKER_FRONTEND_IMAGE:-ghcr.io/aqeelalamfca-sys/auditwise-frontend}"
TAG="${DOCKER_TAG:-latest}"

echo "=== AuditWise Docker Build ==="
echo "Context: $PROJECT_ROOT"
echo ""

echo "[1/2] Building backend image..."
docker build \
  -f docker/backend.Dockerfile \
  -t "${BACKEND_IMAGE}:${TAG}" \
  .
echo "  Backend: ${BACKEND_IMAGE}:${TAG}"

echo "[2/2] Building frontend image..."
docker build \
  -f docker/frontend.Dockerfile \
  -t "${FRONTEND_IMAGE}:${TAG}" \
  .
echo "  Frontend: ${FRONTEND_IMAGE}:${TAG}"

echo ""
echo "=== Build Complete ==="
echo "Run: docker compose up -d"
