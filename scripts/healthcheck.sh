#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-127.0.0.1}"
PORT="${2:-5000}"
BASE="http://${HOST}:${PORT}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASS=0
TOTAL=0

check() {
  local desc="$1" url="$2" expect="$3"
  TOTAL=$((TOTAL + 1))
  HTTP_CODE=$(curl -so /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000")
  BODY=$(curl -sf "$url" 2>/dev/null || echo "")

  if [ "$HTTP_CODE" = "$expect" ]; then
    echo -e "  ${GREEN}✓${NC} ${desc} -> HTTP ${HTTP_CODE}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${desc} -> HTTP ${HTTP_CODE} (expected ${expect})"
  fi
}

check_body() {
  local desc="$1" url="$2" pattern="$3"
  TOTAL=$((TOTAL + 1))
  BODY=$(curl -sf "$url" 2>/dev/null || echo "")

  if echo "$BODY" | grep -q "$pattern"; then
    echo -e "  ${GREEN}✓${NC} ${desc} -> contains '${pattern}'"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${desc} -> missing '${pattern}'"
  fi
}

echo "AuditWise Health Check (${BASE})"
echo "────────────────────────────────"

check "GET /" "${BASE}/" "200"
check_body "GET / returns HTML" "${BASE}/" "<html"
check "GET /health" "${BASE}/health" "200"
check_body "/health status=ok" "${BASE}/health" '"status":"ok"'
check_body "/health has uptime" "${BASE}/health" '"uptime"'
check_body "/health has version" "${BASE}/health" '"version"'
check "GET /__healthz" "${BASE}/__healthz" "200"
check "GET /api/health/full" "${BASE}/api/health/full" "200"
check "GET /login (SPA)" "${BASE}/login" "200"
check "GET /dashboard (SPA)" "${BASE}/dashboard" "200"
check "GET /nonexistent (SPA fallback)" "${BASE}/some/random/path" "200"

echo ""
echo "────────────────────────────────"
if [ "$PASS" -eq "$TOTAL" ]; then
  echo -e "${GREEN}All ${TOTAL} checks passed${NC}"
  exit 0
else
  echo -e "${RED}${PASS}/${TOTAL} checks passed${NC}"
  exit 1
fi
