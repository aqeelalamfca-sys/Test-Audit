#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PASS=0
WARN=0
FAIL=0

ok() {
  echo -e "${GREEN}PASS${NC}  $1"
  PASS=$((PASS + 1))
}

warn() {
  echo -e "${YELLOW}WARN${NC}  $1"
  WARN=$((WARN + 1))
}

fail() {
  echo -e "${RED}FAIL${NC}  $1"
  FAIL=$((FAIL + 1))
}

require_cmd() {
  local cmd="$1"
  local label="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$label"
  else
    fail "$label (missing command: $cmd)"
  fi
}

echo "========================================"
echo "  AuditWise Deployment Preflight"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================"
echo ""

echo "[1/6] Tooling"
require_cmd git "git available"
require_cmd docker "docker available"
if docker compose version >/dev/null 2>&1; then
  ok "docker compose plugin available"
elif command -v docker-compose >/dev/null 2>&1; then
  ok "docker-compose standalone available"
else
  fail "docker compose not available"
fi
require_cmd openssl "openssl available"
require_cmd curl "curl available"
echo ""

echo "[2/6] Git Clone Access"
if git ls-remote --heads https://github.com/aqeelalamfca-sys/Test-Audit.git >/dev/null 2>&1; then
  ok "repository is reachable from this machine"
else
  fail "cannot reach repository over git https (network/auth/DNS issue)"
fi
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ok "current folder is a git repository"
else
  fail "current folder is not a git repository"
fi
echo ""

echo "[3/6] Compose File Integrity"
if docker compose config >/dev/null 2>&1; then
  ok "docker-compose.yml is valid"
else
  fail "docker-compose.yml has interpolation or syntax errors"
fi
for f in docker/backend.Dockerfile docker/frontend.Dockerfile docker/nginx.Dockerfile docker/docker-entrypoint.sh docker/nginx-entrypoint.sh deploy/nginx/proxy.conf deploy/nginx/proxy-ssl.conf; do
  if [ -f "$f" ]; then
    ok "$f exists"
  else
    fail "$f is missing"
  fi
done
echo ""

echo "[4/6] Environment"
if [ -f .env ]; then
  ok ".env exists"
else
  fail ".env missing (copy from .env.example)"
fi

required_vars=(POSTGRES_PASSWORD JWT_SECRET ENCRYPTION_MASTER_KEY)
for key in "${required_vars[@]}"; do
  if [ -n "${!key:-}" ]; then
    ok "$key is set in shell"
  elif [ -f .env ] && grep -qE "^${key}=" .env; then
    val="$(grep -E "^${key}=" .env | head -1 | cut -d'=' -f2-)"
    if [ -z "$val" ] || echo "$val" | grep -qiE 'generate-with-openssl|change-this|your_|example|replace_me'; then
      fail "$key in .env looks like a placeholder"
    else
      ok "$key is set in .env"
    fi
  else
    fail "$key is not set (.env or shell)"
  fi
done
echo ""

echo "[5/6] Known Go-Live Risks"
if grep -q "external: true" docker-compose.yml 2>/dev/null; then
  warn "docker-compose.yml uses external volumes (ensure they exist before up)"
else
  ok "no hard dependency on external docker volumes"
fi
if [ -f .env ] && grep -qE '^POSTGRES_PASSWORD=.*[@:/#? ]' .env; then
  warn "POSTGRES_PASSWORD has special chars; prefer DATABASE_URL generated in entrypoint"
else
  ok "POSTGRES_PASSWORD format looks safe"
fi
echo ""

echo "[6/6] Summary"
echo "Passed:  ${PASS}"
echo "Warnings:${WARN}"
echo "Failed:  ${FAIL}"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Preflight failed. Fix FAIL items before running deployment."
  exit 1
fi

echo ""
echo "Preflight passed. Safe to continue with docker compose build/up."
