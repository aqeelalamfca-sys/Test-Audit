#!/bin/bash
LOGFILE="/home/runner/workspace/git-sync.log"
INTERVAL=120
LOCKFILE="/home/runner/workspace/.git/index.lock"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
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

git config user.name "Aqeel Alam" 2>/dev/null
git config user.email "aqeelalamfca@gmail.com" 2>/dev/null

log "=== Git Auto-Sync started (interval: ${INTERVAL}s) ==="

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

      if git push origin main >>"$LOGFILE" 2>&1; then
        log "Pushed to GitHub successfully."
      else
        log "ERROR: Push failed. Will retry next cycle."
      fi
    else
      log "WARN: Commit failed (possibly no staged changes after filtering)."
    fi
  fi

  sleep "$INTERVAL"
done
