#!/usr/bin/env bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "══════════════════════════════════════════════════"
echo -e "  ${CYAN}AuditWise — System Health Report${NC}"
echo "  $(date -Is)"
echo "══════════════════════════════════════════════════"
echo ""

echo -e "${CYAN}[1/6] Docker Container Status${NC}"
echo "────────────────────────────────────────────────"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not running or not installed"
echo ""

echo -e "${CYAN}[2/6] Listening Ports${NC}"
echo "────────────────────────────────────────────────"
ss -tulpn 2>/dev/null | grep -E ':(80|443|3000|5000|5432|6379)\s' || echo "No relevant ports found"
echo ""

echo -e "${CYAN}[3/6] HTTP Connectivity${NC}"
echo "────────────────────────────────────────────────"

BACKEND_CODE=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:5000/api/health 2>/dev/null || echo "000")
if [ "$BACKEND_CODE" = "200" ]; then
  echo -e "  Backend  (port 5000):  ${GREEN}OK ($BACKEND_CODE)${NC}"
else
  echo -e "  Backend  (port 5000):  ${RED}FAIL ($BACKEND_CODE)${NC}"
fi

FRONTEND_CODE=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo "000")
if [ "$FRONTEND_CODE" = "200" ]; then
  echo -e "  Frontend (port 3000):  ${GREEN}OK ($FRONTEND_CODE)${NC}"
else
  echo -e "  Frontend (port 3000):  ${RED}FAIL ($FRONTEND_CODE)${NC}"
fi

NGINX_CODE=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost/ 2>/dev/null || echo "000")
if [ "$NGINX_CODE" = "200" ]; then
  echo -e "  Nginx    (port 80):    ${GREEN}OK ($NGINX_CODE)${NC}"
else
  echo -e "  Nginx    (port 80):    ${RED}FAIL ($NGINX_CODE)${NC}"
fi

HTTPS_CODE=$(curl -sf -o /dev/null -w '%{http_code}' --insecure https://localhost/ 2>/dev/null || echo "000")
if [ "$HTTPS_CODE" = "200" ]; then
  echo -e "  HTTPS    (port 443):   ${GREEN}OK ($HTTPS_CODE)${NC}"
else
  echo -e "  HTTPS    (port 443):   ${YELLOW}N/A ($HTTPS_CODE)${NC}"
fi
echo ""

echo -e "${CYAN}[4/6] Database & Redis${NC}"
echo "────────────────────────────────────────────────"
DB_STATUS=$(docker exec auditwise-db pg_isready -U auditwise -d auditwise -h localhost 2>/dev/null && echo "OK" || echo "FAIL")
if [ "$DB_STATUS" = "OK" ]; then
  echo -e "  PostgreSQL:  ${GREEN}accepting connections${NC}"
  DB_SIZE=$(docker exec auditwise-db psql -U auditwise -d auditwise -t -c "SELECT pg_size_pretty(pg_database_size('auditwise'));" 2>/dev/null | xargs)
  [ -n "$DB_SIZE" ] && echo "  Database size: $DB_SIZE"
else
  echo -e "  PostgreSQL:  ${RED}not responding${NC}"
fi

REDIS_STATUS=$(docker exec auditwise-redis redis-cli ping 2>/dev/null | grep -q "PONG" && echo "OK" || echo "FAIL")
if [ "$REDIS_STATUS" = "OK" ]; then
  echo -e "  Redis:       ${GREEN}PONG${NC}"
else
  echo -e "  Redis:       ${RED}not responding${NC}"
fi
echo ""

echo -e "${CYAN}[5/6] System Resources${NC}"
echo "────────────────────────────────────────────────"
echo "  CPU cores: $(nproc 2>/dev/null || echo 'unknown')"
echo "  Memory:"
free -h 2>/dev/null | head -2 | sed 's/^/    /'
echo "  Disk:"
df -h / 2>/dev/null | tail -1 | awk '{print "    Used: "$3" / "$2" ("$5" full)"}'
echo ""

echo -e "${CYAN}[6/6] Container Resources${NC}"
echo "────────────────────────────────────────────────"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || echo "Docker stats unavailable"

echo ""
echo "══════════════════════════════════════════════════"
TOTAL_CHECKS=0
PASSED=0
for code in "$BACKEND_CODE" "$FRONTEND_CODE" "$NGINX_CODE"; do
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  [ "$code" = "200" ] && PASSED=$((PASSED + 1))
done
[ "$DB_STATUS" = "OK" ] && PASSED=$((PASSED + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
[ "$REDIS_STATUS" = "OK" ] && PASSED=$((PASSED + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ "$PASSED" -eq "$TOTAL_CHECKS" ]; then
  echo -e "  ${GREEN}ALL $TOTAL_CHECKS CHECKS PASSED${NC}"
else
  echo -e "  ${YELLOW}${PASSED}/${TOTAL_CHECKS} checks passed${NC}"
fi
echo "══════════════════════════════════════════════════"
