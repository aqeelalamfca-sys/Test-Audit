#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@" 2>&1 | grep -q . ; then
    echo -e "  ${GREEN}PASS${NC}  $label"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  $label"
    FAIL=$((FAIL + 1))
  fi
}

check_cmd() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo -e "  ${GREEN}PASS${NC}  $label"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "  AuditWise Deployment Verification"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================"
echo ""

echo "[1/4] Docker Status"
check "docker compose running" bash -c 'docker compose ps --status running -q | grep -q .'
check "auditwise-app container up" bash -c 'docker inspect --format="{{.State.Running}}" auditwise-app 2>/dev/null | grep -qx true'
check "auditwise-db container up" bash -c 'docker inspect --format="{{.State.Running}}" auditwise-db 2>/dev/null | grep -qx true'
echo ""

echo "[2/4] Local Health Checks"
check_cmd "GET /health (port 5000)" curl -sf --max-time 5 http://127.0.0.1:5000/health
check_cmd "GET /__healthz (liveness)" curl -sf --max-time 5 http://127.0.0.1:5000/__healthz
check "GET / returns HTML" bash -c 'curl -sf --max-time 5 http://127.0.0.1:5000/ | grep -q "<html"'
check "GET /login SPA route" bash -c 'curl -sf --max-time 5 http://127.0.0.1:5000/login | grep -q "<html"'
check_cmd "GET /api/health/full (deep)" curl -sf --max-time 10 http://127.0.0.1:5000/api/health/full
echo ""

echo "[3/4] NGINX & SSL (skip if not on VPS)"
DOMAIN="${DOMAIN:-auditwise.tech}"
if curl -sf --max-time 5 "https://${DOMAIN}/health" >/dev/null 2>&1; then
  check_cmd "HTTPS ${DOMAIN}/health" curl -sf --max-time 5 "https://${DOMAIN}/health"
  check "HTTPS ${DOMAIN}/ returns HTML" bash -c "curl -sf --max-time 5 https://${DOMAIN}/ | grep -q '<html'"
  check "HTTP→HTTPS redirect" bash -c "curl -sI --max-time 5 http://${DOMAIN}/ | grep -qi 'location.*https'"
else
  echo "  SKIP  HTTPS checks (not reachable from this host)"
fi
echo ""

echo "[4/4] Database"
check_cmd "PostgreSQL accepting connections" docker exec auditwise-db pg_isready -U auditwise -d auditwise
echo ""

echo "========================================"
echo "  Results: ${PASS} passed, ${FAIL} failed"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC}"
else
  echo -e "  ${RED}SOME CHECKS FAILED${NC}"
fi
echo "========================================"
exit "$FAIL"
