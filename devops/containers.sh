#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VALID_SERVICES="backend frontend nginx db redis"

validate_service() {
  local svc="$1"
  if [ -z "$svc" ]; then return 0; fi
  for valid in $VALID_SERVICES; do
    if [ "$svc" = "$valid" ]; then return 0; fi
  done
  echo "ERROR: Invalid service '$svc'. Valid: $VALID_SERVICES"
  exit 1
}

validate_number() {
  local val="$1" name="$2"
  if ! [[ "$val" =~ ^[0-9]+$ ]]; then
    echo "ERROR: $name must be a number, got '$val'"
    exit 1
  fi
}

ACTION="${1:-status}"

case "$ACTION" in
  status)
    echo "Docker Container Status:"
    echo "────────────────────────"
    bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s <<'REMOTE'
      cd /opt/auditwise
      docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
      echo ""
      echo "Resource Usage:"
      docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true
REMOTE
    ;;

  logs)
    SERVICE="${2:-backend}"
    LINES="${3:-100}"
    validate_service "$SERVICE"
    validate_number "$LINES" "line count"
    echo "Logs for ${SERVICE} (last ${LINES} lines):"
    echo "────────────────────────"
    bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s -- "$SERVICE" "$LINES" <<'REMOTE'
      cd /opt/auditwise && docker compose logs --tail "$2" "$1"
REMOTE
    ;;

  restart)
    SERVICE="${2:-}"
    if [ -n "$SERVICE" ]; then
      validate_service "$SERVICE"
    fi
    if [ -z "$SERVICE" ]; then
      echo "Restarting all containers..."
      bash "$SCRIPT_DIR/ssh-cmd.sh" "cd /opt/auditwise && docker compose up -d --force-recreate"
    else
      echo "Restarting ${SERVICE}..."
      bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s -- "$SERVICE" <<'REMOTE'
        cd /opt/auditwise && docker compose up -d --force-recreate "$1"
REMOTE
    fi
    sleep 3
    bash "$SCRIPT_DIR/ssh-cmd.sh" "cd /opt/auditwise && docker compose ps --format 'table {{.Name}}\t{{.Status}}'"
    ;;

  stop)
    SERVICE="${2:-}"
    if [ -n "$SERVICE" ]; then
      validate_service "$SERVICE"
    fi
    if [ -z "$SERVICE" ]; then
      echo "Stopping all containers..."
      bash "$SCRIPT_DIR/ssh-cmd.sh" "cd /opt/auditwise && docker compose down"
    else
      echo "Stopping ${SERVICE}..."
      bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s -- "$SERVICE" <<'REMOTE'
        cd /opt/auditwise && docker compose stop "$1"
REMOTE
    fi
    ;;

  rebuild)
    SERVICE="${2:-backend}"
    validate_service "$SERVICE"
    echo "Rebuilding ${SERVICE}..."
    bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s -- "$SERVICE" <<'REMOTE'
      cd /opt/auditwise
      docker compose build --no-cache "$1"
      docker compose up -d --force-recreate "$1"
      echo ""
      echo "Waiting for health..."
      sleep 10
      docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || docker compose ps
REMOTE
    ;;

  backup)
    echo "Creating database backup..."
    bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s <<'REMOTE'
      cd /opt/auditwise
      mkdir -p backups
      TIMESTAMP=$(date +%Y%m%d_%H%M%S)
      if docker exec auditwise-db pg_isready -U auditwise -d auditwise -h localhost &>/dev/null; then
        docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null \
          | gzip > "backups/manual_${TIMESTAMP}.sql.gz"
        SIZE=$(du -h "backups/manual_${TIMESTAMP}.sql.gz" | cut -f1)
        echo "Backup saved: backups/manual_${TIMESTAMP}.sql.gz (${SIZE})"
        echo ""
        echo "Available backups:"
        ls -lh backups/*.sql.gz 2>/dev/null | tail -10
      else
        echo "ERROR: Database not running"
        exit 1
      fi
REMOTE
    ;;

  *)
    echo "AuditWise Container Manager"
    echo "════════════════════════════"
    echo "Usage: bash devops/containers.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  status              Show all container status & resource usage"
    echo "  logs [service] [n]  Show logs (default: backend, 100 lines)"
    echo "  restart [service]   Restart container(s)"
    echo "  stop [service]      Stop container(s)"
    echo "  rebuild [service]   Rebuild and restart a service"
    echo "  backup              Create database backup"
    echo ""
    echo "Services: backend, frontend, nginx, db, redis"
    exit 1
    ;;
esac
