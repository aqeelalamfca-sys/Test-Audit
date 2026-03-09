#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-187.77.130.117}"
VPS_USER="${VPS_USER:-root}"
KEY_FILE="$HOME/.ssh/vps_key"

if [ ! -f "$KEY_FILE" ]; then
  bash "$(dirname "$0")/setup-ssh.sh"
fi

ssh -i "$KEY_FILE" \
  -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=15 \
  -o BatchMode=yes \
  -o ServerAliveInterval=30 \
  "${VPS_USER}@${VPS_HOST}" "$@"
