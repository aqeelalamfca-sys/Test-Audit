#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${DOMAIN_NAME:-auditwise.tech}"
VPS="${VPS_HOST:-187.77.130.117}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local name="$1" result="$2"
  if [ "$result" = "OK" ]; then
    echo -e "  ${GREEN}✓${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $name — $result"
    FAIL=$((FAIL + 1))
  fi
}

echo "════════════════════════════════════════"
echo "  AuditWise — System Health Check"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════"
echo ""

echo -e "${CYAN}[1/5] GitHub Connectivity${NC}"
GH_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' "https://api.github.com/repos/aqeelalamfca-sys/Test-Audit" \
  -H "Authorization: Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN:-}" 2>/dev/null || echo "000")
if [ "$GH_STATUS" = "200" ]; then
  check "GitHub API" "OK"
  LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null | head -c 7 || echo "unknown")
  REMOTE_COMMIT=$(curl -sf "https://api.github.com/repos/aqeelalamfca-sys/Test-Audit/commits/main" \
    -H "Authorization: Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN:-}" 2>/dev/null | grep -o '"sha":"[^"]*"' | head -1 | cut -d'"' -f4 | head -c 7 || echo "unknown")
  if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    check "Code in sync (${LOCAL_COMMIT})" "OK"
  else
    check "Code sync" "Local: ${LOCAL_COMMIT}, Remote: ${REMOTE_COMMIT}"
  fi
else
  check "GitHub API" "HTTP $GH_STATUS"
fi
echo ""

echo -e "${CYAN}[2/5] VPS SSH Connectivity${NC}"
SSH_RESULT=$(bash "$SCRIPT_DIR/ssh-cmd.sh" "echo OK" 2>&1 || echo "FAIL")
if echo "$SSH_RESULT" | grep -q "OK"; then
  check "SSH to ${VPS}" "OK"
else
  check "SSH to ${VPS}" "Connection failed"
fi
echo ""

echo -e "${CYAN}[3/5] Docker Containers${NC}"
if echo "$SSH_RESULT" | grep -q "OK"; then
  CONTAINER_STATUS=$(bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s 2>/dev/null <<'REMOTE'
    CONTAINERS="auditwise-backend auditwise-frontend auditwise-nginx auditwise-db auditwise-redis"
    for c in $CONTAINERS; do
      STATUS=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo "missing")
      HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "none")
      echo "${c}|${STATUS}|${HEALTH}"
    done
REMOTE
  )
  while IFS='|' read -r name status health; do
    [ -z "$name" ] && continue
    if [ "$status" = "running" ]; then
      if [ "$health" = "healthy" ] || [ "$health" = "none" ]; then
        check "$name" "OK"
      else
        check "$name" "running but $health"
      fi
    else
      check "$name" "$status"
    fi
  done <<< "$CONTAINER_STATUS"
else
  check "Docker status" "Cannot check — SSH failed"
fi
echo ""

echo -e "${CYAN}[4/5] Ports & Services${NC}"
if echo "$SSH_RESULT" | grep -q "OK"; then
  PORT_STATUS=$(bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s 2>/dev/null <<'REMOTE'
    for port in 80 443 5000; do
      if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
        echo "${port}|listening"
      else
        echo "${port}|closed"
      fi
    done
REMOTE
  )
  while IFS='|' read -r port status; do
    [ -z "$port" ] && continue
    if [ "$status" = "listening" ]; then
      check "Port $port" "OK"
    else
      check "Port $port" "not listening"
    fi
  done <<< "$PORT_STATUS"
else
  check "Port check" "Cannot check — SSH failed"
fi
echo ""

echo -e "${CYAN}[5/5] Domain & HTTP Response${NC}"
DOMAIN_HTTP=$(curl -sf -o /dev/null -w '%{http_code}' "https://${DOMAIN}/" --max-time 10 2>/dev/null || echo "000")
if [ "$DOMAIN_HTTP" = "200" ] || [ "$DOMAIN_HTTP" = "301" ] || [ "$DOMAIN_HTTP" = "302" ]; then
  check "https://${DOMAIN}" "OK"
else
  check "https://${DOMAIN}" "HTTP $DOMAIN_HTTP"
fi

DOMAIN_API=$(curl -sf -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/health" --max-time 10 2>/dev/null || echo "000")
if [ "$DOMAIN_API" = "200" ]; then
  check "https://${DOMAIN}/api/health" "OK"
else
  check "https://${DOMAIN}/api/health" "HTTP $DOMAIN_API"
fi

echo ""
echo "════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL ${TOTAL} CHECKS PASSED${NC}"
else
  echo -e "  ${GREEN}${PASS}${NC} passed, ${RED}${FAIL}${NC} failed (of ${TOTAL})"
fi
echo "════════════════════════════════════════"

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
