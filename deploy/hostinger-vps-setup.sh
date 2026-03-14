#!/usr/bin/env bash
# =============================================================
# deploy/hostinger-vps-setup.sh
# End-to-end installer for AuditWise on a fresh Hostinger VPS
# (Ubuntu 22.04 / 24.04).
#
# Architecture installed by this script:
#   Host Nginx (ports 80/443, TLS via Let's Encrypt)
#     └─► 127.0.0.1:5000 ─► Docker: backend container
#                               ├─ Docker: postgres (internal)
#                               └─ Docker: redis (internal)
#
# Usage (as root on your VPS):
#   curl -fsSL https://raw.githubusercontent.com/aqeelalamfca-sys/Test-Audit/main/deploy/hostinger-vps-setup.sh | bash
# or:
#   git clone https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
#   bash /opt/auditwise/deploy/hostinger-vps-setup.sh
#
# The script is idempotent — safe to re-run for updates.
# =============================================================

set -euo pipefail

# ──────────────────────────────────────────────────────────────
# CONFIGURE THESE BEFORE FIRST RUN
# ──────────────────────────────────────────────────────────────
DOMAIN="${DOMAIN:-auditwise.tech}"
EMAIL="${EMAIL:-admin@auditwise.tech}"         # Let's Encrypt notifications
REPO="${REPO:-https://github.com/aqeelalamfca-sys/Test-Audit.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/auditwise}"
COMPOSE_FILE="docker-compose.vps.yml"
# ──────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[FATAL]${NC} $*" >&2; exit 1; }

# ──────────────────────────────────────────────────────────────
# 0. Pre-flight checks
# ──────────────────────────────────────────────────────────────
check_root() {
    [ "$(id -u)" -eq 0 ] || die "This script must be run as root. Use: sudo bash $0"
}

check_os() {
    if [ -f /etc/os-release ]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        case "${ID}" in
            ubuntu|debian) ;;
            *) warn "Tested on Ubuntu/Debian. Proceeding on ${PRETTY_NAME:-${ID}}…" ;;
        esac
    fi
}

# ──────────────────────────────────────────────────────────────
# 1. System prerequisites
# ──────────────────────────────────────────────────────────────
install_prerequisites() {
    info "Step 1/10 — Installing system prerequisites…"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y -q
    apt-get install -y -q \
        git curl ca-certificates gnupg lsb-release \
        ufw nginx certbot python3-certbot-nginx \
        logrotate fail2ban openssl dnsutils
    systemctl enable --now nginx
    success "Prerequisites installed."
}

# ──────────────────────────────────────────────────────────────
# 2. Docker + Compose plugin
# ──────────────────────────────────────────────────────────────
install_docker() {
    info "Step 2/10 — Installing Docker (with APT Signed-By conflict fix)…"

    rm -f /etc/apt/keyrings/docker.asc \
          /etc/apt/keyrings/docker.gpg \
          /usr/share/keyrings/docker-archive-keyring.gpg \
          2>/dev/null || true

    rm -f /etc/apt/sources.list.d/docker.list \
          /etc/apt/sources.list.d/docker.list.save \
          /etc/apt/sources.list.d/download_docker_com_linux_ubuntu.list \
          2>/dev/null || true

    for f in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
        [ -f "$f" ] || continue
        if grep -qi "download.docker.com" "$f" 2>/dev/null; then
            warn "Removing stale Docker source: $f"
            rm -f "$f"
        fi
    done

    install -m 0755 -d /etc/apt/keyrings

    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
    CODENAME=$(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}")

    echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update -y -qq

    apt-get install -y -qq \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin \
        2>/dev/null || {
            warn "apt install failed, trying get.docker.com fallback..."
            curl -fsSL https://get.docker.com | sh
        }

    systemctl enable --now docker

    if ! docker compose version &>/dev/null 2>&1; then
        die "Docker Compose plugin is not available after installation"
    fi

    success "Docker installed: $(docker --version), Compose: $(docker compose version --short)"
}

# ──────────────────────────────────────────────────────────────
# 3. System optimisations (swap, kernel params)
# ──────────────────────────────────────────────────────────────
configure_system() {
    info "Step 3/10 — Configuring system (swap, sysctl)…"

    # Create 2 GB swap if none exists
    if ! swapon --show | grep -q '/swapfile'; then
        if [ ! -f /swapfile ]; then
            fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
            chmod 600 /swapfile
            mkswap /swapfile -q
            swapon /swapfile
            grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
            success "Created 2 GB swapfile."
        fi
    else
        success "Swap already configured."
    fi

    # Reduce swap pressure for interactive workloads
    sysctl -w vm.swappiness=10 -q
    grep -q 'vm.swappiness' /etc/sysctl.conf \
        || echo 'vm.swappiness=10' >> /etc/sysctl.conf

    # Docker live-restore (keep containers running during daemon restart)
    if [ -f "${APP_DIR}/docker/daemon.json" ]; then
        mkdir -p /etc/docker
        cp -f "${APP_DIR}/docker/daemon.json" /etc/docker/daemon.json
        systemctl reload docker 2>/dev/null || true
    fi

    success "System configured."
}

# ──────────────────────────────────────────────────────────────
# 4. Clone / update repository
# ──────────────────────────────────────────────────────────────
clone_or_update_repo() {
    info "Step 4/10 — Fetching application code…"
    if [ -d "${APP_DIR}/.git" ]; then
        info "Repository already present at ${APP_DIR}. Pulling latest…"
        git -C "${APP_DIR}" fetch origin
        git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
        git -C "${APP_DIR}" clean -fd
    else
        git clone --depth 1 --branch "${BRANCH}" "${REPO}" "${APP_DIR}"
    fi
    success "Code is at commit: $(git -C "${APP_DIR}" rev-parse --short HEAD)."
}

# ──────────────────────────────────────────────────────────────
# 5. Environment configuration
# ──────────────────────────────────────────────────────────────
setup_env() {
    info "Step 5/10 — Configuring environment variables…"
    ENV_FILE="${APP_DIR}/.env"

    if [ ! -f "${ENV_FILE}" ]; then
        # Copy from root .env.example (canonical template)
        if [ -f "${APP_DIR}/.env.example" ]; then
            cp "${APP_DIR}/.env.example" "${ENV_FILE}"
        elif [ -f "${APP_DIR}/deployment/.env.example" ]; then
            cp "${APP_DIR}/deployment/.env.example" "${ENV_FILE}"
        else
            die "No .env.example found in ${APP_DIR}. Cannot create .env."
        fi
        info ".env created from template."
    else
        info ".env already exists — skipping overwrite."
    fi

    # Auto-generate missing secrets (never use known defaults in production)
    gen_secret() { openssl rand -hex 32; }
    gen_password() { openssl rand -base64 18 | tr -dc 'A-Za-z0-9!@#%^&*' | head -c 20; }

    set_if_placeholder() {
        local key="$1" gen_fn="$2" placeholder_pattern="$3"
        local current
        current=$(grep -E "^${key}=" "${ENV_FILE}" | cut -d= -f2- | head -1)
        if [ -z "${current}" ] || echo "${current}" | grep -qiE "${placeholder_pattern}"; then
            local new_val
            new_val=$($gen_fn)
            # Replace the line (or append if key is missing)
            if grep -qE "^${key}=" "${ENV_FILE}"; then
                sed -i "s|^${key}=.*|${key}=${new_val}|" "${ENV_FILE}"
            else
                echo "${key}=${new_val}" >> "${ENV_FILE}"
            fi
            echo "    Generated new value for ${key}."
        fi
    }

    set_if_placeholder "POSTGRES_PASSWORD" gen_password "CHANGE_ME|generate-with|your-"
    set_if_placeholder "JWT_SECRET"        gen_secret   "CHANGE_ME|generate-with|your-"
    set_if_placeholder "SESSION_SECRET"    gen_secret   "CHANGE_ME|generate-with|your-"
    set_if_placeholder "ENCRYPTION_MASTER_KEY" gen_secret "CHANGE_ME|generate-with|your-"

    # Update DATABASE_URL to reflect potentially new password
    PG_USER=$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | cut -d= -f2- | head -1)
    PG_USER="${PG_USER:-auditwise}"
    PG_DB=$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | cut -d= -f2- | head -1)
    PG_DB="${PG_DB:-auditwise}"
    PG_PASS=$(grep -E '^POSTGRES_PASSWORD=' "${ENV_FILE}" | cut -d= -f2- | head -1)
    ENCODED_PASS=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=''))" "${PG_PASS}" 2>/dev/null \
                  || node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "${PG_PASS}" 2>/dev/null \
                  || printf '%s' "${PG_PASS}")

    if grep -qE '^DATABASE_URL=' "${ENV_FILE}"; then
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${PG_USER}:${ENCODED_PASS}@db:5432/${PG_DB}?schema=public|" "${ENV_FILE}"
    else
        echo "DATABASE_URL=postgresql://${PG_USER}:${ENCODED_PASS}@db:5432/${PG_DB}?schema=public" >> "${ENV_FILE}"
    fi

    # Ensure DOMAIN is set
    if grep -qE '^DOMAIN=' "${ENV_FILE}"; then
        sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" "${ENV_FILE}"
    else
        echo "DOMAIN=${DOMAIN}" >> "${ENV_FILE}"
    fi

    chmod 600 "${ENV_FILE}"
    success ".env is ready at ${ENV_FILE}."
    echo ""
    echo -e "${YELLOW}  ▶ ACTION REQUIRED: Review and complete ${ENV_FILE}${NC}"
    echo "    Minimum required fields:"
    echo "      INITIAL_SUPER_ADMIN_EMAIL"
    echo "      INITIAL_SUPER_ADMIN_PASSWORD (change after first login)"
    echo "      SMTP_* (optional, for email notifications)"
    echo ""
    read -rp "  Press ENTER to continue once you have reviewed .env …" _
}

# ──────────────────────────────────────────────────────────────
# 6. Pre-deploy database backup (if container is running)
# ──────────────────────────────────────────────────────────────
backup_database() {
    info "Step 6/10 — Pre-deploy database backup…"
    if docker ps --format '{{.Names}}' | grep -q 'auditwise-db'; then
        if bash "${APP_DIR}/deploy/backup.sh"; then
            success "Database backup completed."
        else
            warn "Database backup failed — continuing deployment."
        fi
    else
        info "Database container not running — skipping backup."
    fi
}

# ──────────────────────────────────────────────────────────────
# 7. Docker Compose: build and start 3-container stack
# ──────────────────────────────────────────────────────────────
start_containers() {
    info "Step 7/10 — Building and starting containers (this may take 5–10 min on first run)…"
    cd "${APP_DIR}"

    # Pull any pre-built images from GHCR first (saves build time if available)
    docker compose -f "${COMPOSE_FILE}" pull --ignore-pull-failures 2>/dev/null || true

    docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans

    info "Waiting for backend health check (up to 3 minutes)…"
    WAIT=0
    until curl -sf http://127.0.0.1:5000/api/health >/dev/null 2>&1 || [ "$WAIT" -ge 180 ]; do
        sleep 5
        WAIT=$((WAIT + 5))
        [ $((WAIT % 30)) -eq 0 ] && info "  Still waiting… (${WAIT}s)"
    done

    if curl -sf http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
        success "Backend is healthy at http://127.0.0.1:5000/api/health"
    else
        warn "Backend health check did not pass within 3 minutes."
        warn "Check logs: docker compose -f ${COMPOSE_FILE} logs backend"
    fi
}

# ──────────────────────────────────────────────────────────────
# 8. Host Nginx site configuration
# ──────────────────────────────────────────────────────────────
install_nginx_config() {
    info "Step 8/10 — Installing host Nginx configuration…"

    NGINX_CONF_SRC="${APP_DIR}/deploy/nginx/host-auditwise.conf"
    NGINX_AVAILABLE="/etc/nginx/sites-available/auditwise.conf"
    NGINX_ENABLED="/etc/nginx/sites-enabled/auditwise.conf"

    # Substitute the actual domain into the config
    sed "s/auditwise\.tech/${DOMAIN}/g" "${NGINX_CONF_SRC}" > "${NGINX_AVAILABLE}"

    # Enable site
    ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

    # Disable default site if it conflicts on port 80/443
    [ -f /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default && info "Removed default Nginx site."

    # Create certbot webroot
    mkdir -p /var/www/certbot

    # Verify configuration
    nginx -t || die "Nginx configuration test failed. Check ${NGINX_AVAILABLE}"
    systemctl reload nginx
    success "Nginx configured and reloaded for ${DOMAIN}."
}

# ──────────────────────────────────────────────────────────────
# 9. SSL certificate via Let's Encrypt
# ──────────────────────────────────────────────────────────────
setup_ssl() {
    info "Step 9/10 — Obtaining SSL certificate for ${DOMAIN}…"

    # Check DNS before attempting (avoid rate-limit failures)
    VPS_IP=$(curl -sf https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    DOMAIN_IP=$(dig +short "${DOMAIN}" A 2>/dev/null | tail -1)
    if [ "${DOMAIN_IP}" != "${VPS_IP}" ]; then
        warn "DNS check: ${DOMAIN} resolves to ${DOMAIN_IP:-<unresolved>}, VPS IP is ${VPS_IP}."
        warn "DNS may not have propagated yet. Certbot will attempt anyway."
    fi

    if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
        info "Certificate already exists for ${DOMAIN}. Renewing if needed…"
        certbot renew --quiet --nginx || warn "Certbot renewal failed — certificate may still be valid."
    else
        certbot --nginx \
            -d "${DOMAIN}" \
            -d "www.${DOMAIN}" \
            --email "${EMAIL}" \
            --agree-tos \
            --non-interactive \
            --redirect \
            || warn "Certbot failed — site will run on HTTP only until DNS propagates and you re-run: certbot --nginx -d ${DOMAIN}"
    fi

    success "SSL setup complete."
}

# ──────────────────────────────────────────────────────────────
# 10. Firewall (UFW)
# ──────────────────────────────────────────────────────────────
setup_firewall() {
    info "Step 10/10 — Configuring UFW firewall…"
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow OpenSSH
    ufw allow 80/tcp    comment 'HTTP'
    ufw allow 443/tcp   comment 'HTTPS'
    ufw --force enable
    success "Firewall configured: SSH + 80 + 443 allowed; all else denied."
}

# ──────────────────────────────────────────────────────────────
# Cron: daily database backup
# ──────────────────────────────────────────────────────────────
setup_backup_cron() {
    info "Setting up daily database backup cron…"
    CRON_LINE="0 2 * * * root bash ${APP_DIR}/deploy/backup.sh >> /var/log/auditwise-backup.log 2>&1"
    CRON_FILE="/etc/cron.d/auditwise-backup"
    if [ ! -f "${CRON_FILE}" ] || ! grep -qF "deploy/backup.sh" "${CRON_FILE}"; then
        echo "${CRON_LINE}" > "${CRON_FILE}"
        chmod 644 "${CRON_FILE}"
        success "Backup cron installed at ${CRON_FILE} (runs daily at 02:00)."
    else
        success "Backup cron already installed."
    fi
}

# Cron: certbot auto-renewal check (twice daily per Let's Encrypt recommendation)
setup_certbot_cron() {
    CRON_FILE="/etc/cron.d/auditwise-certbot"
    if [ ! -f "${CRON_FILE}" ]; then
        cat > "${CRON_FILE}" <<'EOF'
0 0,12 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
EOF
        chmod 644 "${CRON_FILE}"
        success "Certbot renewal cron installed (runs at 00:00 and 12:00 daily)."
    else
        success "Certbot cron already installed."
    fi
}

# ──────────────────────────────────────────────────────────────
# Health verification
# ──────────────────────────────────────────────────────────────
verify_health() {
    echo ""
    echo "────────────────────────────────────────────────"
    info "Running health checks…"

    PASS=0; FAIL=0

    check() {
        local label="$1" url="$2"
        if curl -sf --max-time 10 "${url}" >/dev/null 2>&1; then
            success "${label}: ${url}"
            PASS=$((PASS + 1))
        else
            warn "FAIL ${label}: ${url}"
            FAIL=$((FAIL + 1))
        fi
    }

    check "Backend health"   "http://127.0.0.1:5000/api/health"
    check "HTTP (redirect)"  "http://${DOMAIN}/api/health"
    check "HTTPS"            "https://${DOMAIN}/api/health"

    echo "────────────────────────────────────────────────"
    echo ""
    if [ "$FAIL" -eq 0 ]; then
        success "All health checks passed."
    else
        warn "${FAIL} check(s) failed. Inspect logs:"
        echo "  docker compose -f ${APP_DIR}/${COMPOSE_FILE} logs --tail=50 backend"
        echo "  sudo journalctl -u nginx --no-pager -n 30"
    fi
}

# ──────────────────────────────────────────────────────────────
# Post-install summary
# ──────────────────────────────────────────────────────────────
print_summary() {
    ADMIN_EMAIL=$(grep -E '^INITIAL_SUPER_ADMIN_EMAIL=' "${APP_DIR}/.env" | cut -d= -f2-)
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  AuditWise deployed successfully!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo "  URL          : https://${DOMAIN}"
    echo "  Admin login  : ${ADMIN_EMAIL:-see .env INITIAL_SUPER_ADMIN_EMAIL}"
    echo "  App dir      : ${APP_DIR}"
    echo "  Compose file : ${APP_DIR}/${COMPOSE_FILE}"
    echo ""
    echo "  Useful commands:"
    echo "    docker compose -f ${APP_DIR}/${COMPOSE_FILE} ps"
    echo "    docker compose -f ${APP_DIR}/${COMPOSE_FILE} logs -f backend"
    echo "    docker compose -f ${APP_DIR}/${COMPOSE_FILE} restart backend"
    echo "    bash ${APP_DIR}/deploy/backup.sh"
    echo ""
    echo "  To update:"
    echo "    bash ${APP_DIR}/deploy/hostinger-vps-setup.sh"
    echo ""
}

# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────
main() {
    echo -e "${CYAN}"
    echo "═══════════════════════════════════════════════════"
    echo "  AuditWise — Hostinger VPS Installer"
    echo "  Domain  : ${DOMAIN}"
    echo "  Repo    : ${REPO} (${BRANCH})"
    echo "  App dir : ${APP_DIR}"
    echo "═══════════════════════════════════════════════════"
    echo -e "${NC}"

    check_root
    check_os
    install_prerequisites
    install_docker
    configure_system
    clone_or_update_repo
    setup_env
    backup_database
    start_containers
    install_nginx_config
    setup_ssl
    setup_firewall
    setup_backup_cron
    setup_certbot_cron
    verify_health
    print_summary
}

main "$@"
