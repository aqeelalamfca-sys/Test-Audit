#!/bin/bash
LOGFILE="/home/runner/workspace/git-sync.log"
INTERVAL=120
LOCKFILE="/home/runner/workspace/.git/index.lock"
MAX_LOG_LINES=500

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

trim_log() {
  if [ -f "$LOGFILE" ]; then
    LINE_COUNT=$(wc -l < "$LOGFILE")
    if [ "$LINE_COUNT" -gt "$MAX_LOG_LINES" ]; then
      tail -n "$MAX_LOG_LINES" "$LOGFILE" > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" "$LOGFILE"
    fi
  fi
}

clear_stale_lock() {
  if [ -f "$LOCKFILE" ]; then
    LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCKFILE" 2>/dev/null || echo "0") ))
    if [ "$LOCK_AGE" -gt 30 ]; then
      rm -f "$LOCKFILE"
      log "Removed stale git lock file (age: ${LOCK_AGE}s)."
    else
      log "Git lock file exists (age: ${LOCK_AGE}s). Waiting for other git process."
      return 1
    fi
  fi
  return 0
}

cd /home/runner/workspace || exit 1

git config user.name "Aqeel Alam" 2>/dev/null
git config user.email "aqeelalamfca@gmail.com" 2>/dev/null

export GIT_TERMINAL_PROMPT=0

PUSH_URL=""
if [ -n "$GITHUB_TOKEN" ]; then
  REPO_URL=$(git remote get-url origin 2>/dev/null)
  PUSH_URL=$(echo "$REPO_URL" | sed "s|https://github.com/|https://${GITHUB_TOKEN}@github.com/|")
  log "GitHub token found — authenticated push enabled."
else
  log "WARN: No GITHUB_TOKEN set. Commits will be saved locally."
  log "  Set GITHUB_TOKEN in Replit Secrets to enable auto-push."
  log "  Generate at: https://github.com/settings/tokens (scope: repo)"
fi

log "=== Git Auto-Sync started (interval: ${INTERVAL}s) ==="
log "Remote: $(git remote get-url origin 2>/dev/null)"
log "Branch: $(git branch --show-current 2>/dev/null)"

PUSH_FAILURES=0

while true; do
  cd /home/runner/workspace || { log "ERROR: Cannot cd to workspace"; sleep "$INTERVAL"; continue; }

  if ! clear_stale_lock; then
    sleep "$INTERVAL"
    continue
  fi

  CHANGES=$(git status --porcelain 2>/dev/null | grep -v "^?? git-sync.log$")

  if [ -z "$CHANGES" ]; then
    log "No changes detected. Skipping."
  else
    CHANGED_COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
    log "Detected ${CHANGED_COUNT} changed file(s). Syncing..."

    git add -A 2>>"$LOGFILE"

    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    COMMIT_MSG="Auto-sync: ${TIMESTAMP} [${CHANGED_COUNT} file(s)]"

    if git commit -m "$COMMIT_MSG" >>"$LOGFILE" 2>&1; then
      log "Committed: ${COMMIT_MSG}"

      if [ -n "$PUSH_URL" ]; then
        PUSH_OUTPUT=$(timeout 30 git push "$PUSH_URL" main 2>&1)
        PUSH_EXIT=$?

        if [ $PUSH_EXIT -eq 0 ]; then
          log "Pushed to GitHub successfully."
          PUSH_FAILURES=0
        else
          PUSH_FAILURES=$((PUSH_FAILURES + 1))
          CLEAN_OUTPUT=$(echo "$PUSH_OUTPUT" | grep -v "token\|password\|askpass" | tail -2)
          log "ERROR: Push failed (attempt #${PUSH_FAILURES}): ${CLEAN_OUTPUT}"
        fi
      else
        BEHIND=$(git rev-list --count HEAD@{upstream}..HEAD 2>/dev/null || echo "?")
        log "Committed locally (${BEHIND} commits ahead). Set GITHUB_TOKEN to enable push."
      fi
    else
      log "WARN: Commit failed (possibly no staged changes after filtering)."
    fi
  fi

  if [ -z "$PUSH_URL" ] && [ -n "$GITHUB_TOKEN" ]; then
    REPO_URL=$(git remote get-url origin 2>/dev/null)
    PUSH_URL=$(echo "$REPO_URL" | sed "s|https://github.com/|https://${GITHUB_TOKEN}@github.com/|")
    log "GITHUB_TOKEN detected — enabling push for next cycle."
  fi

  trim_log
  sleep "$INTERVAL"
done
