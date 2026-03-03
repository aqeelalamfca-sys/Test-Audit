#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/auditwise}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/auditwise_${TIMESTAMP}.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL backup..."
pg_dump "${DATABASE_URL}" --no-owner --no-acl | gzip > "${BACKUP_FILE}"
echo "[$(date)] Backup created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

echo "[$(date)] Pruning backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "${BACKUP_DIR}" -name "auditwise_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "[$(date)] Removed ${DELETED} old backup(s)."

echo "[$(date)] Backup complete."
