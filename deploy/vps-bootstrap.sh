#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/auditwise}"
REPO_URL="${REPO_URL:-https://github.com/aqeelalamfca-sys/Test-Audit.git}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.vps.yml}"
SERVICE_NAME="${SERVICE_NAME:-auditwise.service}"
HTTP_NGINX_TEMPLATE="deploy/nginx/host-auditwise.http.conf"
SSL_NGINX_TEMPLATE="deploy/nginx/host-auditwise.conf"
NGINX_SITE_PATH="/etc/nginx/sites-available/auditwise.conf"
NGINX_SITE_LINK="/etc/nginx/sites-enabled/auditwise.conf"

log() {
  printf '[INFO] %s\n' "$*"
}

fail() {
  printf '[FATAL] %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "Run this script as root: sudo bash deploy/vps-bootstrap.sh"
  fi
}

install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y -qq
  apt-get install -y -qq ca-certificates curl git nginx certbot python3-certbot-nginx gnupg lsb-release >/dev/null
}

install_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable --now docker

  if ! docker compose version >/dev/null 2>&1; then
    apt-get install -y -qq docker-compose-plugin >/dev/null || true
  fi

  docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is not available"
}

sync_repo() {
  mkdir -p "$(dirname "$APP_DIR")"
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch origin "$BRANCH" --prune
    git -C "$APP_DIR" checkout "$BRANCH"
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
    git -C "$APP_DIR" clean -fd
  else
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
}

ensure_env_file() {
  if [ -f "$APP_DIR/.env" ]; then
    log "Preserving existing $APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    return
  fi

  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  log "Created $APP_DIR/.env from template"
  log "Edit $APP_DIR/.env before the first deploy and then rerun this script"
}

render_nginx_template() {
  local source_file="$1"
  local target_file="$2"
  local server_names="_"

  if [ -n "$DOMAIN" ]; then
    server_names="$DOMAIN www.$DOMAIN"
  fi

  sed \
    -e "s|__DOMAIN__|${DOMAIN:-example.com}|g" \
    -e "s|__SERVER_NAMES__|${server_names}|g" \
    "$APP_DIR/$source_file" > "$target_file"
}

install_http_nginx() {
  render_nginx_template "$HTTP_NGINX_TEMPLATE" "$NGINX_SITE_PATH"
  mkdir -p /var/www/certbot
  ln -sf "$NGINX_SITE_PATH" "$NGINX_SITE_LINK"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
}

install_service() {
  cp "$APP_DIR/docker/auditwise.service" "/etc/systemd/system/$SERVICE_NAME"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
}

start_stack_if_ready() {
  if ! grep -qE '^POSTGRES_PASSWORD=' "$APP_DIR/.env" || ! grep -qE '^JWT_SECRET=' "$APP_DIR/.env" || ! grep -qE '^ENCRYPTION_MASTER_KEY=' "$APP_DIR/.env"; then
    log "Required secrets are not fully configured in .env yet; skipping first start"
    return
  fi

  systemctl start "$SERVICE_NAME"

  local health_url="http://127.0.0.1:5000/api/health"
  for _ in $(seq 1 60); do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      log "Backend is healthy on $health_url"
      return
    fi
    sleep 2
  done

  fail "Stack did not become healthy after bootstrap"
}

install_ssl_if_ready() {
  if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    log "DOMAIN or EMAIL not set; leaving HTTP-only Nginx in place"
    return
  fi

  if ! certbot certonly --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring; then
    log "Certbot did not issue a certificate yet; leaving HTTP-only Nginx in place"
    return
  fi

  render_nginx_template "$SSL_NGINX_TEMPLATE" "$NGINX_SITE_PATH"
  nginx -t
  systemctl reload nginx
  log "SSL Nginx configuration enabled for $DOMAIN"
}

main() {
  require_root
  install_packages
  install_docker
  sync_repo
  ensure_env_file
  install_service
  install_http_nginx
  start_stack_if_ready
  install_ssl_if_ready

  log "Bootstrap complete"
  log "Repo: $APP_DIR"
  log "Service: $SERVICE_NAME"
  log "Compose file: $COMPOSE_FILE"
}

main "$@"
