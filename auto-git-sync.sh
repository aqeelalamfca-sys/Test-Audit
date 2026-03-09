#!/bin/bash
LOGDIR="/home/runner/workspace/logs"
LOGFILE="${LOGDIR}/git-sync.log"
INTERVAL=120
LOCKFILE="/home/runner/workspace/.git/index.lock"
MAX_LOG_LINES=500

mkdir -p "$LOGDIR"

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
    if [ "$LOCK_AGE" -gt 15 ]; then
      rm -f "$LOCKFILE"
      log "Removed stale git lock file (age: ${LOCK_AGE}s)."
    else
      log "Git lock file exists (age: ${LOCK_AGE}s). Skipping this cycle."
      return 1
    fi
  fi
  return 0
}

ensure_on_main() {
  CURRENT=$(git branch --show-current 2>/dev/null)
  if [ "$CURRENT" != "main" ]; then
    log "Not on main branch (current: '${CURRENT}'). Fixing..."
    git rebase --abort 2>/dev/null || true
    git merge --abort 2>/dev/null || true
    git checkout main 2>/dev/null || git checkout -b main 2>/dev/null
    log "Switched to main branch."
  fi
}

cd /home/runner/workspace || exit 1

git config user.name "Aqeel Alam" 2>/dev/null
git config user.email "aqeelalamfca@gmail.com" 2>/dev/null

export GIT_TERMINAL_PROMPT=0

rm -f "$LOCKFILE" 2>/dev/null
git rebase --abort 2>/dev/null || true
git merge --abort 2>/dev/null || true
ensure_on_main

PUSH_URL=""
if [ -n "$GITHUB_TOKEN" ]; then
  PUSH_URL="https://${GITHUB_TOKEN}@github.com/aqeelalamfca-sys/Test-Audit.git"
  log "GitHub token found — authenticated push enabled."
else
  log "WARN: No GITHUB_TOKEN set. Commits will be saved locally only."
fi

CLEAN_REMOTE=$(git remote get-url origin 2>/dev/null | sed 's|https://[^@]*@|https://|')
log "=== Git Auto-Sync started (interval: ${INTERVAL}s) ==="
<<<<<<< HEAD
=======
log "Remote: ${CLEAN_REMOTE}"
>>>>>>> 9c37d86eea315abb16a12f97f6e302f1a85d138c
log "Branch: $(git branch --show-current 2>/dev/null)"
log "Push auth: $([ -n \"$PUSH_URL\" ] && echo 'token configured' || echo 'no token')"

PUSH_FAILURES=0

while true; do
  cd /home/runner/workspace || { log "ERROR: Cannot cd to workspace"; sleep "$INTERVAL"; continue; }

  if ! clear_stale_lock; then
    sleep "$INTERVAL"
    continue
  fi

  ensure_on_main

  CHANGES=$(git status --porcelain 2>/dev/null | grep -v "^?? logs/" | grep -v "^.. logs/")

  if [ -z "$CHANGES" ]; then
    if [ -n "$PUSH_URL" ] && [ "$PUSH_FAILURES" -gt 0 ]; then
      log "Retrying push of existing commits..."
    else
      log "No changes detected. Skipping."
      sleep "$INTERVAL"
      continue
    fi
  else
    CHANGED_COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
    log "Detected ${CHANGED_COUNT} changed file(s). Syncing..."

    git add -A 2>>"$LOGFILE"

    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    COMMIT_MSG="Auto-sync: ${TIMESTAMP} [${CHANGED_COUNT} file(s)]"

    git commit -m "$COMMIT_MSG" >>"$LOGFILE" 2>&1 || {
      log "WARN: Nothing to commit after staging."
      sleep "$INTERVAL"
      continue
    }
    log "Committed: ${COMMIT_MSG}"
  fi

<<<<<<< HEAD
  if [ -n "$PUSH_URL" ]; then
    PUSH_OUTPUT=$(timeout 30 git push "$PUSH_URL" main --force-with-lease 2>&1)
    PUSH_EXIT=$?
=======
      if [ -n "$PUSH_URL" ]; then
        PULL_OUTPUT=$(timeout 30 git pull --rebase --autostash "$PUSH_URL" main 2>&1)
        PULL_EXIT=$?
        if [ $PULL_EXIT -ne 0 ]; then
          PULL_ERROR=$(echo "$PULL_OUTPUT" | grep -v "token\|password\|ghp_" | tail -3)
          log "WARN: Pull --rebase failed: ${PULL_ERROR}. Trying push anyway..."
          git rebase --abort 2>/dev/null
        fi
>>>>>>> 9c37d86eea315abb16a12f97f6e302f1a85d138c

    if [ $PUSH_EXIT -eq 0 ]; then
      log "Pushed to GitHub successfully."
      PUSH_FAILURES=0
    else
      PUSH_FAILURES=$((PUSH_FAILURES + 1))
      CLEAN_OUTPUT=$(echo "$PUSH_OUTPUT" | grep -v "token\|password\|askpass\|ghp_" | tail -2)
      log "ERROR: Push failed (#${PUSH_FAILURES}): ${CLEAN_OUTPUT}"

      if [ $PUSH_FAILURES -ge 3 ]; then
        log "Multiple push failures. Attempting force push..."
        FORCE_OUTPUT=$(timeout 30 git push "$PUSH_URL" main --force 2>&1)
        if [ $? -eq 0 ]; then
          log "Force push succeeded."
          PUSH_FAILURES=0
        else
          FORCE_CLEAN=$(echo "$FORCE_OUTPUT" | grep -v "token\|password\|ghp_" | tail -2)
          log "ERROR: Force push also failed: ${FORCE_CLEAN}"
        fi
      fi
    fi
  else
    log "No GITHUB_TOKEN. Committed locally only."
  fi

  if [ -z "$PUSH_URL" ] && [ -n "$GITHUB_TOKEN" ]; then
    PUSH_URL="https://${GITHUB_TOKEN}@github.com/aqeelalamfca-sys/Test-Audit.git"
    log "GITHUB_TOKEN detected — enabling push next cycle."
  fi

  trim_log
  sleep "$INTERVAL"
done
