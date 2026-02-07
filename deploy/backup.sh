#!/bin/bash
set -e

# =============================================================================
# MSP Service Desk - Database Backup Script
#
# Usage:
#   sudo ./deploy/backup.sh
#
# Saves a timestamped PostgreSQL dump to /var/backups/msp-service-desk/
# Add to cron for daily backups:
#   0 2 * * * /path/to/deploy/backup.sh
# =============================================================================

BACKUP_DIR="/var/backups/msp-service-desk"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$BACKUP_DIR"

cd "$PROJECT_DIR"

echo "Starting database backup..."

docker compose exec -T db pg_dump \
  -U mspdesk \
  -d msp_service_desk \
  --clean \
  --if-exists \
  | gzip > "$BACKUP_DIR/msp_desk_${TIMESTAMP}.sql.gz"

echo "Backup saved to: $BACKUP_DIR/msp_desk_${TIMESTAMP}.sql.gz"

# Keep only last 30 backups
ls -tp "$BACKUP_DIR"/msp_desk_*.sql.gz | tail -n +31 | xargs -I {} rm -- {}

echo "Cleanup complete. Keeping last 30 backups."
echo "Done."
