#!/usr/bin/env bash
set -euo pipefail

SSH_DIR="$HOME/.ssh"
KEY_FILE="$SSH_DIR/vps_key"
PUB_FILE="/tmp/replit_deploy_key.pub"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ -f /tmp/replit_deploy_key ]; then
  cp /tmp/replit_deploy_key "$KEY_FILE"
elif [ -n "${VPS_SSH_KEY:-}" ] && echo "$VPS_SSH_KEY" | grep -q "BEGIN"; then
  echo "$VPS_SSH_KEY" > "$KEY_FILE"
else
  echo "ERROR: No valid SSH private key found."
  echo "Run: ssh-keygen -t ed25519 -C replit-deploy -f /tmp/replit_deploy_key -N ''"
  echo "Then add /tmp/replit_deploy_key.pub to your VPS SSH keys."
  exit 1
fi

chmod 600 "$KEY_FILE"

VPS_HOST="${VPS_HOST:-187.77.130.117}"
ssh-keyscan -T 5 "$VPS_HOST" >> "$SSH_DIR/known_hosts" 2>/dev/null || true

echo "SSH key configured at $KEY_FILE"
if [ -f "$PUB_FILE" ]; then
  echo ""
  echo "Public key (add to VPS if not already done):"
  cat "$PUB_FILE"
fi
