#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/auditwise"
BRANCH="${1:-main}"

echo "=========================================="
echo "  AuditWise Update"
echo "  $(date -Is)"
echo "=========================================="

cd "$APP_DIR"

echo "[1/5] Pulling latest from GitHub (${BRANCH})..."
git fetch --all -q
git reset --hard "origin/${BRANCH}" -q
echo "    Commit: $(git log --oneline -1)"

echo "[2/5] Running pre-deploy backup..."
if [ -f deploy/backup.sh ]; then
  bash deploy/backup.sh || echo "    Backup failed (non-fatal), continuing..."
fi

echo "[3/5] Rebuilding and restarting containers..."
docker compose up -d --build --force-recreate

echo "[4/5] Waiting for app to become healthy..."
for i in $(seq 1 180); do
  if curl -sf http://127.0.0.1:5000/health &>/dev/null; then
    echo "    App healthy after ${i}s."
    break
  fi
  [ "$i" -eq 180 ] && { echo "ERROR: App did not start within 180s"; docker compose logs --tail 30 app; exit 1; }
  sleep 1
done

echo "[5/5] Verifying endpoints..."
HEALTH=$(curl -sf http://127.0.0.1:5000/health 2>/dev/null || echo '{"status":"error"}')
LOGIN_CODE=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:5000/ 2>/dev/null || echo "000")

echo ""
echo "  /health  -> ${HEALTH}"
echo "  /        -> HTTP ${LOGIN_CODE}"
echo ""

if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "  UPDATE SUCCESSFUL"
else
  echo "  WARNING: Health check returned unexpected response"
  echo "  Run: docker compose logs --tail 50 app"
fi

echo ""
echo "  Containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
