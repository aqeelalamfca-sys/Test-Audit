#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ACTION="${1:-help}"

case "$ACTION" in
  push)
    shift || true
    bash "$SCRIPT_DIR/push.sh" "$@"
    ;;

  deploy)
    shift || true
    bash "$SCRIPT_DIR/deploy.sh" "${1:-full}"
    ;;

  deploy-quick)
    bash "$SCRIPT_DIR/deploy.sh" quick
    ;;

  health)
    bash "$SCRIPT_DIR/health.sh"
    ;;

  status)
    bash "$SCRIPT_DIR/containers.sh" status
    ;;

  logs)
    shift || true
    bash "$SCRIPT_DIR/containers.sh" logs "${1:-backend}" "${2:-100}"
    ;;

  restart)
    shift || true
    bash "$SCRIPT_DIR/containers.sh" restart "${1:-}"
    ;;

  rebuild)
    shift || true
    bash "$SCRIPT_DIR/containers.sh" rebuild "${1:-backend}"
    ;;

  backup)
    bash "$SCRIPT_DIR/containers.sh" backup
    ;;

  autopush)
    shift || true
    bash "$SCRIPT_DIR/autopush.sh" "${1:-120}"
    ;;

  fix-docker)
    echo "Fixing Docker APT Signed-By conflict on VPS..."
    bash "$SCRIPT_DIR/ssh-cmd.sh" bash -s <<'REMOTE'
      set -e
      echo "[1/4] Removing conflicting Docker APT sources..."
      rm -f /etc/apt/keyrings/docker.asc /etc/apt/keyrings/docker.gpg /usr/share/keyrings/docker-archive-keyring.gpg 2>/dev/null || true
      rm -f /etc/apt/sources.list.d/docker.list /etc/apt/sources.list.d/docker.list.save /etc/apt/sources.list.d/download_docker_com_linux_ubuntu.list 2>/dev/null || true
      for f in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
        [ -f "$f" ] || continue
        grep -qi "download.docker.com" "$f" 2>/dev/null && rm -f "$f"
      done
      echo "[2/4] Importing fresh Docker GPG key..."
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      D_ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
      D_CODE=$(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}")
      echo "deb [arch=${D_ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${D_CODE} stable" > /etc/apt/sources.list.d/docker.list
      echo "[3/4] Updating APT and installing Docker..."
      apt-get update -y -qq
      apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
      systemctl enable --now docker
      echo "[4/4] Verification..."
      docker --version
      docker compose version
      echo "Docker APT fix complete."
REMOTE
    ;;

  ssh)
    bash "$SCRIPT_DIR/ssh-cmd.sh" "${2:-echo Connected to VPS}"
    ;;

  help|*)
    echo ""
    echo "  ╔════════════════════════════════════════════╗"
    echo "  ║   AuditWise — DevOps Control Center        ║"
    echo "  ╚════════════════════════════════════════════╝"
    echo ""
    echo "  Usage: bash devops/control.sh <command>"
    echo ""
    echo "  ── Code & Deployment ──────────────────────"
    echo "  push [msg]       Push code to GitHub"
    echo "  deploy           Full deploy (push → build → restart)"
    echo "  deploy-quick     Quick deploy (pull + restart backend)"
    echo "  autopush [sec]   Start auto-push daemon (default: 120s)"
    echo ""
    echo "  ── Container Management ───────────────────"
    echo "  status           Show all container status"
    echo "  logs [svc] [n]   View container logs"
    echo "  restart [svc]    Restart container(s)"
    echo "  rebuild [svc]    Rebuild & restart a service"
    echo "  backup           Create database backup"
    echo ""
    echo "  ── System ─────────────────────────────────"
    echo "  health           Full system health check"
    echo "  fix-docker       Fix Docker APT Signed-By conflict on VPS"
    echo "  ssh [cmd]        Run command on VPS"
    echo ""
    echo "  Services: backend, frontend, nginx, db, redis"
    echo ""
    ;;
esac
