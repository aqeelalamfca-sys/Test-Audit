#!/usr/bin/env bash
set -e

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN not set in Replit Secrets"
  exit 1
fi

REPO="aqeelalamfca-sys/Test-Audit"
REMOTE_URL="https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${REPO}.git"

echo "════════════════════════════════════════"
echo "  AuditWise — Push to GitHub"
echo "  $(date -Is)"
echo "════════════════════════════════════════"

echo "[1/3] Configuring git remote..."
git remote set-url origin "$REMOTE_URL" 2>/dev/null || git remote add origin "$REMOTE_URL" 2>/dev/null
echo "  Remote configured (token-authenticated)"

echo "[2/3] Setting upstream tracking..."
git branch --set-upstream-to=origin/main main 2>/dev/null || true

echo "[3/3] Pushing to GitHub..."
git push origin main --force

echo ""
echo "════════════════════════════════════════"
echo "  PUSH COMPLETE"
echo "  Repository: github.com/${REPO}"
echo "  Branch: main"
echo ""
echo "  GitHub Actions will now automatically"
echo "  deploy to your VPS."
echo "════════════════════════════════════════"
