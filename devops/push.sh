#!/usr/bin/env bash
set -euo pipefail

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN not set in Replit Secrets"
  exit 1
fi

REPO="aqeelalamfca-sys/Test-Audit"

echo "════════════════════════════════════════"
echo "  AuditWise — Push to GitHub"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════"

CHANGES=$(git status --porcelain 2>/dev/null | wc -l)
if [ "$CHANGES" -gt 0 ]; then
  echo "[1/2] Staging $CHANGES changed file(s)..."
  git add -A
  COMMIT_MSG="${1:-Auto-sync from Replit $(date '+%Y-%m-%d %H:%M')}"
  git commit -m "$COMMIT_MSG" 2>/dev/null || echo "  Nothing new to commit"
else
  echo "[1/2] No local changes to commit"
fi

echo "[2/2] Pushing to GitHub..."
PUSH_URL="https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${REPO}.git"
git push "$PUSH_URL" main 2>&1

echo ""
echo "════════════════════════════════════════"
echo "  PUSH COMPLETE"
echo "  Repository: github.com/${REPO}"
echo "  Commit:     $(git log --oneline -1)"
echo "  GitHub Actions will auto-deploy to VPS"
echo "════════════════════════════════════════"
