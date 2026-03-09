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
    echo "  ssh [cmd]        Run command on VPS"
    echo ""
    echo "  Services: backend, frontend, nginx, db, redis"
    echo ""
    ;;
esac
