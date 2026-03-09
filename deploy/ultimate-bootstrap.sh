#!/bin/bash

set -e

APP="auditwise"
APP_DIR="/opt/$APP"
REPO="https://github.com/aqeelalamfca-sys/Test-Audit.git"
DOMAIN="auditwise.tech"

echo "Updating server..."
apt update -y && apt upgrade -y

echo "Installing required packages..."
apt install -y docker.io docker-compose nginx git certbot python3-certbot-nginx ufw

systemctl enable docker
systemctl start docker

echo "Configuring firewall..."
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

echo "Cloning application..."

mkdir -p $APP_DIR

if [ ! -d "$APP_DIR/.git" ]; then
    git clone $REPO $APP_DIR
else
    cd $APP_DIR
    git pull origin main
fi

cd $APP_DIR

echo "Starting docker containers..."

docker compose down || true
docker compose up -d --build

echo "Configuring Nginx..."

cat > /etc/nginx/sites-available/$APP <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$APP /etc/nginx/sites-enabled/$APP

nginx -t
systemctl restart nginx

echo "Installing SSL..."

certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN || true

echo "AuditWise server setup completed."
