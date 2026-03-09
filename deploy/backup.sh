#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/auditwise/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
CONTAINER_NAME="${DB_CONTAINER:-auditwise-db}"
DB_NAME="${POSTGRES_DB:-auditwise}"
DB_USER="${POSTGRES_USER:-auditwise}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/auditwise_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] Starting PostgreSQL backup..."

docker exec "$CONTAINER_NAME" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date -Is)] Backup successful: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date -Is)] ERROR: Backup file is empty or missing"
  exit 1
fi

echo "[$(date -Is)] Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "auditwise_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

REMAINING=$(find "$BACKUP_DIR" -name "auditwise_*.sql.gz" | wc -l)
echo "[$(date -Is)] Backup complete. $REMAINING backup(s) retained."
