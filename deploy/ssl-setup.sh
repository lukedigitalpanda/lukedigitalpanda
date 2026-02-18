#!/bin/bash
set -e

# =============================================================================
# SSL Setup Script - Add HTTPS to an already-running MSP Service Desk
#
# Prerequisites:
#   - App already running via docker compose
#   - DNS A record for your domain pointing to this server's IP
#   - Ports 80 and 443 open in firewall
#
# Usage:
#   sudo ./deploy/ssl-setup.sh desk.digital-panda.co.uk luke@digital-panda.co.uk
# =============================================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  SSL Setup for ${DOMAIN}${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

# Check running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root: sudo $0 $DOMAIN $EMAIL${NC}"
  exit 1
fi

# Step 1: Ensure firewall allows 80 and 443
echo -e "${BOLD}[1/5] Checking firewall...${NC}"
if command -v ufw &> /dev/null; then
  ufw allow 80/tcp 2>/dev/null || true
  ufw allow 443/tcp 2>/dev/null || true
  echo "  Ports 80 and 443 open."
else
  echo "  ufw not found - make sure ports 80 and 443 are open manually."
fi
echo -e "${GREEN}[1/5] Done.${NC}"

# Step 2: Create SSL directory and set HTTP-only nginx config
echo -e "${BOLD}[2/5] Configuring nginx for HTTP (initial cert request)...${NC}"
mkdir -p "$PROJECT_DIR/deploy/nginx/ssl"

cp "$PROJECT_DIR/deploy/nginx/conf.d/default-initial.conf" \
   "$PROJECT_DIR/deploy/nginx/conf.d/active.conf"

# Make sure nginx is running with HTTP-only config
docker compose up -d nginx
sleep 3
echo -e "${GREEN}[2/5] Done.${NC}"

# Step 3: Request SSL certificate from Let's Encrypt
echo -e "${BOLD}[3/5] Requesting SSL certificate from Let's Encrypt...${NC}"
echo "  Domain: ${DOMAIN}"
echo "  Email:  ${EMAIL}"
echo ""

docker compose run --rm --entrypoint "certbot" certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo -e "${GREEN}[3/5] Done.${NC}"

# Step 4: Switch nginx to HTTPS config
echo -e "${BOLD}[4/5] Switching nginx to HTTPS...${NC}"

sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" \
  "$PROJECT_DIR/deploy/nginx/conf.d/default.conf" > \
  "$PROJECT_DIR/deploy/nginx/conf.d/active.conf"

docker compose exec nginx nginx -s reload
echo -e "${GREEN}[4/5] Done.${NC}"

# Step 5: Update .env with HTTPS URL
echo -e "${BOLD}[5/5] Updating .env for HTTPS...${NC}"

if [ -f "$PROJECT_DIR/.env" ]; then
  # Update NEXTAUTH_URL to https
  sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://${DOMAIN}|" "$PROJECT_DIR/.env"
  sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://${DOMAIN}|" "$PROJECT_DIR/.env"
  echo "  Updated NEXTAUTH_URL and NEXT_PUBLIC_APP_URL in .env"
else
  echo -e "${YELLOW}  No .env file found - make sure NEXTAUTH_URL=https://${DOMAIN} is set${NC}"
fi

# Restart app to pick up new env
docker compose up -d --build app
echo -e "${GREEN}[5/5] Done.${NC}"

# Set up auto-renewal cron
echo ""
echo -e "${BOLD}Setting up auto-renewal...${NC}"
cat > /etc/cron.d/msp-ssl-renew << CRON
# Renew SSL certificate twice daily
0 */12 * * * root cd ${PROJECT_DIR} && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload
CRON
echo "  SSL auto-renewal cron installed."

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${GREEN}  SSL Setup Complete!${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo -e "Your site is now live at: ${BOLD}https://${DOMAIN}${NC}"
echo ""
echo -e "${YELLOW}If login doesn't work, restart the app to pick up the new .env:${NC}"
echo -e "  docker compose restart app"
echo ""
