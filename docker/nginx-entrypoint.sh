#!/bin/sh
set -e

BACKEND_HOST="${BACKEND_HOST:-backend}"
BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_HOST="${FRONTEND_HOST:-frontend}"
FRONTEND_PORT="${FRONTEND_PORT:-80}"
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

echo "[nginx-entrypoint] Waiting for frontend at ${FRONTEND_HOST}:${FRONTEND_PORT}..."
elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  if wget -q --spider "http://${FRONTEND_HOST}:${FRONTEND_PORT}/" 2>/dev/null; then
    echo "[nginx-entrypoint] Frontend is ready after ${elapsed}s"
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

if [ "$elapsed" -ge "$MAX_WAIT" ]; then
  echo "[nginx-entrypoint] WARNING: Frontend not ready after ${MAX_WAIT}s, starting nginx anyway"
fi

if [ -f /etc/nginx/ssl/fullchain.pem ] && [ -f /etc/nginx/ssl/privkey.pem ]; then
  echo "[nginx-entrypoint] SSL certificates found — enabling HTTPS"
  if [ -f /etc/nginx/nginx-ssl.conf ]; then
    cp /etc/nginx/nginx-ssl.conf /etc/nginx/conf.d/default.conf
    echo "[nginx-entrypoint] Switched to SSL config"
  fi
else
  echo "[nginx-entrypoint] No SSL certificates found — serving HTTP only"
  echo "[nginx-entrypoint] Mount certs to /etc/nginx/ssl/ and restart to enable HTTPS"
fi

echo "[nginx-entrypoint] Validating nginx config..."
nginx -t 2>&1 || {
  echo "[nginx-entrypoint] ERROR: nginx config test failed"
  exit 1
}

echo "[nginx-entrypoint] Starting nginx..."
exec nginx -g "daemon off;"
