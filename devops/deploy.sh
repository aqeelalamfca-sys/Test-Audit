#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${DOMAIN_NAME:-auditwise.tech}"
APP_DIR="/opt/auditwise"

echo "════════════════════════════════════════"
echo "  AuditWise — Deploy to VPS"
echo "  Target: ${VPS_HOST:-187.77.130.117}"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════"

MODE="${1:-full}"

case "$MODE" in
  quick)
    echo "[Mode: Quick Deploy — pull + restart backend only]"
    bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s <<'REMOTE'
      set -e
      cd /opt/auditwise
      echo "[1/4] Pulling latest code..."
      git fetch --all -q
      git reset --hard origin/main -q
      echo "  Updated: $(git log --oneline -1)"

      echo "[2/4] Rebuilding backend..."
      docker compose build --no-cache backend 2>&1

      echo "[3/4] Restarting backend..."
      docker compose up -d --force-recreate backend 2>&1

      echo "[4/4] Waiting for health..."
      for i in $(seq 1 120); do
        HTTP=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health 2>/dev/null || echo "000")
        if [ "$HTTP" = "200" ]; then
          echo "  Backend healthy after ${i}s"
          break
        fi
        if [ "$i" -eq 120 ]; then
          echo "  FAILED: Backend not healthy after 120s"
          docker compose logs --tail 20 backend 2>/dev/null || true
          exit 1
        fi
        sleep 1
      done

      echo ""
      docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || docker compose ps
REMOTE
    ;;

  full)
    echo "[Mode: Full Deploy — push to GitHub, then deploy via SSH]"
    echo ""
    echo "Step 1: Push to GitHub..."
    bash "$SCRIPT_DIR/push.sh" "Deploy from Replit $(date '+%Y-%m-%d %H:%M')"
    echo ""
    echo "Step 2: Deploy on VPS..."
    bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s -- "$DOMAIN" <<'REMOTE'
      set -e
      DOMAIN="$1"
      APP_DIR="/opt/auditwise"
      cd "$APP_DIR"

      echo "[1/6] Pre-deploy backup..."
      mkdir -p backups
      if docker exec auditwise-db pg_isready -U auditwise -d auditwise -h localhost &>/dev/null; then
        docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null \
          | gzip > "backups/pre-deploy_$(date +%Y%m%d_%H%M%S).sql.gz" && \
          echo "  Backup saved" || echo "  Backup skipped"
      else
        echo "  Database not running — skipping backup"
      fi

      echo "[2/6] Pulling latest code..."
      PREV_COMMIT=$(git rev-parse HEAD)
      git fetch --all -q
      git reset --hard origin/main -q
      echo "  Updated: $(git log --oneline -1)"

      echo "[3/6] Rebuilding containers..."
      docker compose build --no-cache backend frontend nginx 2>&1

      echo "[4/6] Restarting all containers..."
      docker compose up -d --force-recreate --remove-orphans 2>&1

      echo "[5/6] Waiting for health (max 4 min)..."
      HEALTHY=false
      for i in $(seq 1 240); do
        HTTP=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health 2>/dev/null || echo "000")
        if [ "$HTTP" = "200" ]; then
          echo "  Backend healthy after ${i}s"
          HEALTHY=true
          break
        fi
        [ "$((i % 30))" -eq 0 ] && echo "  Still waiting... (${i}s, HTTP: $HTTP)"
        sleep 1
      done

      if [ "$HEALTHY" = "false" ]; then
        echo "  DEPLOY FAILED — rolling back..."
        docker compose stop backend frontend nginx || true
        git reset --hard "$PREV_COMMIT" -q
        docker compose build --no-cache backend frontend nginx 2>&1
        docker compose up -d --force-recreate 2>&1
        exit 1
      fi

      echo "[6/6] Cleanup..."
      docker image prune -f >/dev/null 2>&1 || true
      find backups -name "*.sql.gz" -mtime +30 -delete 2>/dev/null || true

      echo ""
      echo "════════════════════════════════════════"
      echo "  DEPLOY COMPLETE"
      echo "  Commit: $(git log --oneline -1)"
      echo "  URL:    https://${DOMAIN}"
      echo ""
      docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || docker compose ps
      echo "════════════════════════════════════════"
REMOTE
    ;;

  restart)
    echo "[Mode: Restart — restart containers without rebuild]"
    bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s <<'REMOTE'
      set -e
      cd /opt/auditwise
      docker compose up -d --force-recreate
      echo "All containers restarted"
      sleep 5
      docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || docker compose ps
REMOTE
    ;;

  *)
    echo "Usage: bash devops/deploy.sh [full|quick|restart]"
    echo "  full    — Push to GitHub + full rebuild on VPS (default)"
    echo "  quick   — Pull latest code + rebuild backend only"
    echo "  restart — Restart all containers without rebuild"
    exit 1
    ;;
esac
