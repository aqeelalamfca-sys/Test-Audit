#!/bin/sh
set -e

BACKEND_HOST="${BACKEND_HOST:-backend}"
BACKEND_PORT="${BACKEND_PORT:-5000}"
MAX_WAIT="${BACKEND_WAIT_TIMEOUT:-120}"

echo "[nginx-entrypoint] Waiting for backend at ${BACKEND_HOST}:${BACKEND_PORT} (max ${MAX_WAIT}s)..."

elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  if wget -q --spider "http://${BACKEND_HOST}:${BACKEND_PORT}/api/health" 2>/dev/null; then
    echo "[nginx-entrypoint] Backend is ready after ${elapsed}s"
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

if [ "$elapsed" -ge "$MAX_WAIT" ]; then
  echo "[nginx-entrypoint] WARNING: Backend not ready after ${MAX_WAIT}s, starting nginx anyway"
fi

echo "[nginx-entrypoint] Starting nginx..."
exec nginx -g "daemon off;"
