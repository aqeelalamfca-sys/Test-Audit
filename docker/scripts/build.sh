#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_ROOT"

IMAGE_NAME="${DOCKER_IMAGE:-ghcr.io/aqeelalamfca-sys/auditwise}"
TAG="${DOCKER_TAG:-latest}"

echo "Building AuditWise Docker image..."
echo "  Image: ${IMAGE_NAME}:${TAG}"
echo "  Context: $PROJECT_ROOT"
echo ""

docker build \
  -f docker/Dockerfile \
  -t "${IMAGE_NAME}:${TAG}" \
  --build-arg APP_VERSION="${TAG}" \
  .

echo ""
echo "Build complete: ${IMAGE_NAME}:${TAG}"
echo "Image size: $(docker image inspect "${IMAGE_NAME}:${TAG}" --format='{{.Size}}' | numfmt --to=iec 2>/dev/null || echo 'unknown')"
