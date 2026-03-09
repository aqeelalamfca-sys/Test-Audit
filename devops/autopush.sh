#!/usr/bin/env bash
set -euo pipefail

INTERVAL="${1:-120}"
REPO="aqeelalamfca-sys/Test-Audit"

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN not set"
  exit 1
fi

PUSH_URL="https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${REPO}.git"

echo "════════════════════════════════════════"
echo "  AuditWise — Auto-Push Daemon"
echo "  Interval: every ${INTERVAL}s"
echo "  Press Ctrl+C to stop"
echo "════════════════════════════════════════"

PUSH_COUNT=0

while true; do
  CHANGES=$(git status --porcelain 2>/dev/null | wc -l)
  if [ "$CHANGES" -gt 0 ]; then
    git add -A
    git commit -m "Auto-sync from Replit $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || true
    if git push "$PUSH_URL" main 2>/dev/null; then
      PUSH_COUNT=$((PUSH_COUNT + 1))
      echo "[$(date '+%H:%M:%S')] Pushed $CHANGES file(s) to GitHub (push #${PUSH_COUNT})"
    else
      echo "[$(date '+%H:%M:%S')] Push failed — will retry next cycle"
    fi
  else
    echo "[$(date '+%H:%M:%S')] No changes — sleeping ${INTERVAL}s"
  fi
  sleep "$INTERVAL"
done
