#!/bin/bash
set -euo pipefail

BACKEND_URL="${1:-http://localhost:5000}"
FRONTEND_URL="${2:-http://localhost:3000}"
NGINX_URL="${3:-http://localhost:80}"

echo "=== AuditWise Health Check ==="
echo ""

echo -n "Backend API ($BACKEND_URL/api/health): "
if RESPONSE=$(curl -sf "$BACKEND_URL/api/health" 2>/dev/null); then
  STATUS=$(echo "$RESPONSE" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).status))" 2>/dev/null || echo "unknown")
  UPTIME=$(echo "$RESPONSE" | node -e "process.stdin.on('data',d=>console.log(Math.floor(JSON.parse(d).uptime)+'s'))" 2>/dev/null || echo "unknown")
  echo "OK (status=$STATUS, uptime=$UPTIME)"
else
  echo "FAILED"
fi

echo -n "Frontend ($FRONTEND_URL): "
if curl -sf "$FRONTEND_URL/" > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
fi

echo -n "Nginx proxy ($NGINX_URL/api/health): "
if curl -sf "$NGINX_URL/api/health" > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
fi

echo -n "Full health ($BACKEND_URL/api/health/full): "
if RESPONSE=$(curl -sf "$BACKEND_URL/api/health/full" 2>/dev/null); then
  DB_STATUS=$(echo "$RESPONSE" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).checks.database.status))" 2>/dev/null || echo "unknown")
  echo "OK (db=$DB_STATUS)"
else
  echo "FAILED"
fi

echo ""
echo "Docker containers:"
docker compose ps 2>/dev/null || echo "  (docker compose not available)"
