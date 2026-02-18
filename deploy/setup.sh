#!/bin/bash
set -e

# =============================================================================
# MSP Service Desk - VPS Setup Script
# Run on a fresh Ubuntu 22.04 VPS (Hostinger or any provider)
#
# Usage:
#   chmod +x deploy/setup.sh
#   sudo ./deploy/setup.sh
#
# The script will prompt you for:
#   - Your domain name (e.g., desk.digitalpanda.co.uk)
#   - Your email (for Let's Encrypt SSL)
#   - Database password
#   - Microsoft 365 credentials (optional)
#   - OpenAI API key (optional)
# =============================================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  MSP Service Desk - VPS Setup${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

# Check running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root: sudo ./deploy/setup.sh${NC}"
  exit 1
fi

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${GREEN}Project directory: ${PROJECT_DIR}${NC}"
echo ""

# =============================================================================
# Gather configuration
# =============================================================================

echo -e "${BOLD}--- Configuration ---${NC}"
echo ""

read -p "Enter your domain name (e.g., desk.digitalpanda.co.uk): " DOMAIN
read -p "Enter your email (for SSL certificates): " EMAIL

# Generate secure defaults
DEFAULT_DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
DEFAULT_AUTH_SECRET=$(openssl rand -base64 32)

read -p "Database password [auto-generated]: " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-$DEFAULT_DB_PASS}

echo ""
echo -e "${YELLOW}Microsoft 365 Integration (leave blank to skip):${NC}"
read -p "  Azure AD Client ID: " AZURE_AD_CLIENT_ID
read -p "  Azure AD Client Secret: " AZURE_AD_CLIENT_SECRET
read -p "  Azure AD Tenant ID: " AZURE_AD_TENANT_ID
read -p "  Graph API Client ID: " MS_GRAPH_CLIENT_ID
read -p "  Graph API Client Secret: " MS_GRAPH_CLIENT_SECRET
read -p "  Graph API Tenant ID: " MS_GRAPH_TENANT_ID
read -p "  Support mailbox (e.g., support@yourdomain.com): " MS_GRAPH_MAILBOX

echo ""
echo -e "${YELLOW}AI Features (leave blank to skip):${NC}"
read -p "  OpenAI API Key: " OPENAI_API_KEY

echo ""
echo -e "${GREEN}Configuration complete. Starting setup...${NC}"
echo ""

# =============================================================================
# Step 1: System updates and Docker installation
# =============================================================================

echo -e "${BOLD}[1/7] Installing system dependencies...${NC}"

apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  ufw \
  fail2ban

# Install Docker
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "Docker already installed."
fi

# Install Docker Compose (plugin)
if ! docker compose version &> /dev/null; then
  echo "Installing Docker Compose..."
  apt-get install -y -qq docker-compose-plugin
else
  echo "Docker Compose already installed."
fi

echo -e "${GREEN}[1/7] Done.${NC}"

# =============================================================================
# Step 2: Configure firewall
# =============================================================================

echo -e "${BOLD}[2/7] Configuring firewall...${NC}"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo -e "${GREEN}[2/7] Done.${NC}"

# =============================================================================
# Step 3: Configure fail2ban
# =============================================================================

echo -e "${BOLD}[3/7] Configuring fail2ban...${NC}"

cat > /etc/fail2ban/jail.local << 'JAIL'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
JAIL

systemctl enable fail2ban
systemctl restart fail2ban

echo -e "${GREEN}[3/7] Done.${NC}"

# =============================================================================
# Step 4: Create environment file
# =============================================================================

echo -e "${BOLD}[4/7] Creating environment configuration...${NC}"

cat > "$PROJECT_DIR/.env" << ENVFILE
# Database
DB_USER=mspdesk
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=msp_service_desk
DATABASE_URL=postgresql://mspdesk:${DB_PASSWORD}@db:5432/msp_service_desk

# NextAuth
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${DEFAULT_AUTH_SECRET}

# Microsoft 365 / Azure AD
AZURE_AD_CLIENT_ID=${AZURE_AD_CLIENT_ID}
AZURE_AD_CLIENT_SECRET=${AZURE_AD_CLIENT_SECRET}
AZURE_AD_TENANT_ID=${AZURE_AD_TENANT_ID}

# Microsoft Graph API
MS_GRAPH_CLIENT_ID=${MS_GRAPH_CLIENT_ID}
MS_GRAPH_CLIENT_SECRET=${MS_GRAPH_CLIENT_SECRET}
MS_GRAPH_TENANT_ID=${MS_GRAPH_TENANT_ID}
MS_GRAPH_MAILBOX=${MS_GRAPH_MAILBOX}

# OpenAI
OPENAI_API_KEY=${OPENAI_API_KEY}

# App
NEXT_PUBLIC_APP_NAME=MSP Service Desk
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
ENVFILE

chmod 600 "$PROJECT_DIR/.env"

echo -e "${GREEN}[4/7] Done.${NC}"

# =============================================================================
# Step 5: Configure Nginx for domain and get SSL cert
# =============================================================================

echo -e "${BOLD}[5/7] Setting up SSL certificate...${NC}"

# Start with HTTP-only config
cp "$PROJECT_DIR/deploy/nginx/conf.d/default-initial.conf" \
   "$PROJECT_DIR/deploy/nginx/conf.d/active.conf"

# Build and start services (HTTP only first)
docker compose up -d db app nginx

echo "Waiting for services to start..."
sleep 10

# Get SSL certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Switch to SSL config
sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" \
  "$PROJECT_DIR/deploy/nginx/conf.d/default.conf" > \
  "$PROJECT_DIR/deploy/nginx/conf.d/active.conf"

# Reload nginx with SSL
docker compose exec nginx nginx -s reload

echo -e "${GREEN}[5/7] Done.${NC}"

# =============================================================================
# Step 6: Run database migrations and seed
# =============================================================================

echo -e "${BOLD}[6/7] Setting up database...${NC}"

# Run Prisma migrations
docker compose exec app npx prisma db push

# Seed with demo data
docker compose exec app npx prisma db seed

echo -e "${GREEN}[6/7] Done.${NC}"

# =============================================================================
# Step 7: Set up email sync cron job
# =============================================================================

echo -e "${BOLD}[7/7] Setting up email sync cron job...${NC}"

# Create the email sync cron script
cat > /etc/cron.d/msp-email-sync << CRON
# Sync emails every 5 minutes
*/5 * * * * root curl -s -X POST http://127.0.0.1:3000/api/email/sync > /dev/null 2>&1
CRON

# Create SSL renewal cron
cat > /etc/cron.d/msp-ssl-renew << CRON
# Renew SSL certificate twice daily
0 */12 * * * root cd ${PROJECT_DIR} && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload
CRON

echo -e "${GREEN}[7/7] Done.${NC}"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  Setup Complete!${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo -e "${GREEN}Your MSP Service Desk is live at:${NC}"
echo ""
echo -e "  Admin Dashboard:  ${BOLD}https://${DOMAIN}/dashboard${NC}"
echo -e "  Client Portal:    ${BOLD}https://${DOMAIN}/portal${NC}"
echo -e "  Login:            ${BOLD}https://${DOMAIN}/login${NC}"
echo ""
echo -e "${YELLOW}Demo credentials (from seed data):${NC}"
echo -e "  Admin:      luke@digital-panda.co.uk / cocacola123*"
echo -e "  Admin:      admin@digitalpanda.co.uk / demo"
echo -e "  Manager:    sarah@digitalpanda.co.uk / demo"
echo -e "  Technician: james@digitalpanda.co.uk / demo"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  View logs:        docker compose logs -f app"
echo -e "  Restart:          docker compose restart"
echo -e "  Stop:             docker compose down"
echo -e "  Update:           git pull && docker compose up -d --build"
echo -e "  DB shell:         docker compose exec db psql -U mspdesk msp_service_desk"
echo -e "  Prisma Studio:    docker compose exec app npx prisma studio"
echo ""
echo -e "${YELLOW}Security notes:${NC}"
echo -e "  - Firewall: only SSH, 80, 443 open"
echo -e "  - fail2ban: protecting SSH (3 attempts then ban)"
echo -e "  - SSL: auto-renews via cron"
echo -e "  - DB: only accessible from Docker network (not exposed)"
echo -e "  - .env file permissions: 600 (root only)"
echo ""
echo -e "${GREEN}Database password saved in .env - keep this safe!${NC}"
echo ""
