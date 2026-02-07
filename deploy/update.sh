#!/bin/bash
set -e

# =============================================================================
# MSP Service Desk - Update Script
#
# Usage:
#   sudo ./deploy/update.sh
#
# Pulls latest code, rebuilds the app, runs migrations, and restarts.
# =============================================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${BOLD}Updating MSP Service Desk...${NC}"

# Backup database first
echo "Creating backup before update..."
./deploy/backup.sh

# Pull latest code
echo "Pulling latest changes..."
git pull

# Rebuild and restart
echo "Rebuilding application..."
docker compose up -d --build app

# Wait for app to be healthy
echo "Waiting for application to start..."
sleep 10

# Run any new migrations
echo "Running database migrations..."
docker compose exec app npx prisma db push

# Reload nginx
docker compose exec nginx nginx -s reload

echo ""
echo -e "${GREEN}Update complete!${NC}"
echo "Check status: docker compose ps"
echo "View logs:    docker compose logs -f app"
