#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/auditwise}"
BRANCH="${BRANCH:-${1:-main}}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.vps.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5000/api/health}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

log() {
  printf '[INFO] %s\n' "$*"
}

fail() {
  printf '[FATAL] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

health_check() {
  local max_wait="${1:-180}"
  local i

  for i in $(seq 1 "$max_wait"); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      log "Health check passed: $HEALTH_URL"
      return 0
    fi
    sleep 1
  done

  return 1
}

ensure_repo() {
  [ -d "$APP_DIR/.git" ] || fail "Missing git repository at $APP_DIR. Run deploy/vps-bootstrap.sh first."
}

ensure_env() {
  [ -f "$APP_DIR/.env" ] || fail "Missing $APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"

  for key in POSTGRES_PASSWORD JWT_SECRET ENCRYPTION_MASTER_KEY; do
    if ! grep -qE "^${key}=.+" "$APP_DIR/.env"; then
      fail "Missing required variable in .env: $key"
    fi
  done
}

backup_database_if_running() {
  local backup_dir="$APP_DIR/backups"
  local stamp
  local backup_file

  mkdir -p "$backup_dir"

  if docker ps --format '{{.Names}}' | grep -q '^auditwise-db$'; then
    stamp="$(date +%Y%m%d_%H%M%S)"
    backup_file="$backup_dir/predeploy_${stamp}.sql.gz"

    if docker exec auditwise-db pg_isready -U auditwise -d auditwise >/dev/null 2>&1; then
      if docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner --no-privileges 2>/dev/null | gzip >"$backup_file"; then
        log "Database backup created: $backup_file"
      else
        log "Database backup failed; continuing deploy"
        rm -f "$backup_file"
      fi
    else
      log "Database container is running but not ready; skipping backup"
    fi
  else
    log "Database container not running; skipping backup"
  fi

  ls -1t "$backup_dir"/*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
}

main() {
  require_cmd git
  require_cmd docker
  require_cmd curl
  docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is required"

  ensure_repo
  cd "$APP_DIR"
  ensure_env

  local prev_commit
  prev_commit="$(git rev-parse HEAD)"
  log "Current commit: $prev_commit"

  backup_database_if_running

  git fetch origin "$BRANCH" --prune
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"

  local new_commit
  new_commit="$(git rev-parse HEAD)"
  log "Target commit:  $new_commit"

  if [ ! -f "$COMPOSE_FILE" ]; then
    fail "Compose file not found: $COMPOSE_FILE"
  fi

  export APP_VERSION="$new_commit"

  docker compose -f "$COMPOSE_FILE" config >/dev/null
  docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures || true
  docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

  if ! health_check 240; then
    log "New release failed health check. Rolling back to $prev_commit"
    git reset --hard "$prev_commit"
    export APP_VERSION="$prev_commit"
    docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

    if ! health_check 180; then
      fail "Rollback failed; service is unhealthy"
    fi

    fail "Deployment rolled back due to failed health check"
  fi

  docker image prune -f >/dev/null 2>&1 || true

  log "Deployment succeeded"
  docker compose -f "$COMPOSE_FILE" ps
}

main "$@"
