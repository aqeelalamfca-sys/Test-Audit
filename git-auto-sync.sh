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

      PUSH_OUTPUT=$(git push origin main 2>&1)
      PUSH_EXIT=$?

      if [ $PUSH_EXIT -eq 0 ]; then
        log "Pushed to GitHub successfully."
        PUSH_FAILURES=0
      else
        PUSH_FAILURES=$((PUSH_FAILURES + 1))
        log "ERROR: Push failed (attempt #${PUSH_FAILURES}). Changes committed locally."
        if [ $PUSH_FAILURES -eq 1 ]; then
          log "  Push error: $(echo "$PUSH_OUTPUT" | grep -v "askpass" | tail -1)"
          log "  Tip: Use Replit's Git panel to push manually, or push will auto-retry."
        fi
      fi
    else
      log "WARN: Commit failed (possibly no staged changes after filtering)."
    fi
  fi

  trim_log
  sleep "$INTERVAL"
done
