#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_DIR="$HOME/.ssh"
KEY_FILE="$SSH_DIR/vps_key"
VPS_HOST="${VPS_HOST:-187.77.130.117}"

echo "[DevOps] Initializing pipeline..."

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ ! -f "$KEY_FILE" ]; then
  if [ -n "${VPS_SSH_KEY:-}" ] && echo "$VPS_SSH_KEY" | grep -q "BEGIN"; then
    echo "$VPS_SSH_KEY" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    echo "[DevOps] SSH key loaded from secret"
  elif [ -f /tmp/replit_deploy_key ]; then
    cp /tmp/replit_deploy_key "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    echo "[DevOps] SSH key loaded from /tmp"
  else
    echo "[DevOps] WARNING: No SSH key found (VPS_SSH_KEY secret missing)"
  fi
else
  echo "[DevOps] SSH key already present"
fi

ssh-keyscan -T 5 "$VPS_HOST" >> "$SSH_DIR/known_hosts" 2>/dev/null || true

if [ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  git config --global credential.helper store 2>/dev/null || true
  git config --global user.email "deploy@auditwise.tech" 2>/dev/null || true
  git config --global user.name "AuditWise Deploy" 2>/dev/null || true
  echo "[DevOps] Git configured"
else
  echo "[DevOps] WARNING: GITHUB_PERSONAL_ACCESS_TOKEN not set"
fi

READY=0
if [ -f "$KEY_FILE" ]; then
  READY=$((READY + 1))
  echo "[DevOps] ✓ VPS SSH key ready"
fi
if [ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  READY=$((READY + 1))
  echo "[DevOps] ✓ GitHub token ready"
fi

if [ "$READY" -eq 2 ]; then
  echo "[DevOps] Pipeline fully connected: Replit → GitHub → VPS → Docker → auditwise.tech"
else
  echo "[DevOps] Pipeline partially configured ($READY/2 secrets)"
fi
