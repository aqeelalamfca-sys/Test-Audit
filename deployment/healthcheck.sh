#!/usr/bin/env bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local name="$1"
  local result="$2"
  local expected="${3:-0}"

  if [ "$result" -eq "$expected" ]; then
    echo -e "${GREEN}[PASS]${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}[FAIL]${NC} $name"
    FAIL=$((FAIL + 1))
  fi
}

warn_check() {
  local name="$1"
  local result="$2"

  if [ "$result" -eq 0 ]; then
    echo -e "${GREEN}[PASS]${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "${YELLOW}[WARN]${NC} $name"
    WARN=$((WARN + 1))
  fi
}

BACKEND_PORT="${APP_PORT:-5000}"
FRONT_PORT="${FRONTEND_PORT:-3000}"

if [ -f "$(dirname "$0")/.env" ]; then
  source <(grep -E '^(APP_PORT|FRONTEND_PORT)=' "$(dirname "$0")/.env" 2>/dev/null || true)
  BACKEND_PORT="${APP_PORT:-5000}"
  FRONT_PORT="${FRONTEND_PORT:-3000}"
fi

echo "══════════════════════════════════════════"
echo "  AuditWise — Production Health Check"
echo "  $(date -Is)"
echo "══════════════════════════════════════════"
echo ""

echo "--- Container Status ---"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
echo ""

echo "--- Service Health Checks ---"

DB_READY=$(docker exec auditwise-db pg_isready -U auditwise -d auditwise -h localhost 2>/dev/null && echo 0 || echo 1)
check "PostgreSQL accepting connections" "$DB_READY"

REDIS_READY=$(docker exec auditwise-redis redis-cli ping 2>/dev/null | grep -q "PONG" && echo 0 || echo 1)
check "Redis responding to PING" "$REDIS_READY"

BACKEND_HEALTH=$(curl -sf -o /dev/null -w '%{http_code}' "http://127.0.0.1:${BACKEND_PORT}/api/health" 2>/dev/null || echo "000")
check "Backend /api/health returns 200 (port ${BACKEND_PORT})" "$([ "$BACKEND_HEALTH" = "200" ] && echo 0 || echo 1)"

FRONTEND_HEALTH=$(curl -sf -o /dev/null -w '%{http_code}' "http://127.0.0.1:${FRONT_PORT}/" 2>/dev/null || echo "000")
check "Frontend returns 200 (port ${FRONT_PORT})" "$([ "$FRONTEND_HEALTH" = "200" ] && echo 0 || echo 1)"

NGINX_HTTP=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:80/api/health 2>/dev/null || echo "000")
check "Nginx proxy /api/health returns 200" "$([ "$NGINX_HTTP" = "200" ] && echo 0 || echo 1)"

NGINX_FRONTEND=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:80/ 2>/dev/null || echo "000")
check "Nginx proxy / returns 200" "$([ "$NGINX_FRONTEND" = "200" ] && echo 0 || echo 1)"

echo ""
echo "--- SSL Check ---"
NGINX_HTTPS=$(curl -sf -o /dev/null -w '%{http_code}' --insecure https://127.0.0.1:443/api/health 2>/dev/null || echo "000")
warn_check "HTTPS endpoint (443)" "$([ "$NGINX_HTTPS" = "200" ] && echo 0 || echo 1)"

echo ""
echo "--- Resource Usage ---"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || echo "Stats unavailable"

echo ""
echo "--- Disk Usage ---"
echo "  Volumes:"
docker system df -v 2>/dev/null | grep -A 20 "VOLUME NAME" | head -10 || echo "  Unable to check"
echo ""
echo "  Database size:"
docker exec auditwise-db psql -U auditwise -d auditwise -t -c "SELECT pg_size_pretty(pg_database_size('auditwise'));" 2>/dev/null || echo "  Unable to check"

echo ""
echo "══════════════════════════════════════════"
echo -e "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${WARN} warnings${NC}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}UNHEALTHY — check failed services above${NC}"
  exit 1
else
  echo -e "  ${GREEN}ALL SERVICES HEALTHY${NC}"
  exit 0
fi
