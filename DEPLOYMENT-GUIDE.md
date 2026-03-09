# AuditWise Deployment Guide

## Architecture

```
Replit (development)
  ↓ git push
GitHub (source control)
  ↓ GitHub Actions CI/CD
Hostinger VPS (production)
  ├── Host Nginx (SSL termination + reverse proxy, ports 80/443)
  │     ↓ proxy_pass to 127.0.0.1:5000
  └── Docker Containers
        ├── auditwise-db (PostgreSQL 16, port 5432 internal)
        ├── auditwise-redis (Redis 7, port 6379 internal)
        └── auditwise-backend (Express API, port 5000 exposed to host)
              ↓ serves both API + static frontend
https://auditwise.tech
```

**Note:** Host-level Nginx handles SSL certificates (via Certbot/Let's Encrypt) and
proxies all traffic to the backend container on port 5000. The backend serves both the
API endpoints and the pre-built React frontend as static files. The Docker Compose file
also includes `frontend` and `nginx` containers for fully containerized local testing,
but they are NOT used in production deployment.

---

## Prerequisites

| Item | Details |
|------|---------|
| Hostinger VPS | Ubuntu 22.04+, 4GB RAM minimum, 2 vCPU |
| Domain | `auditwise.tech` pointed to VPS IP |
| GitHub repo | `aqeelalamfca-sys/Test-Audit` |
| SSH access | Root or sudo user on VPS |

---

## Step 1: DNS Configuration

Point your domain to your Hostinger VPS IP address:

| Record | Host | Value | TTL |
|--------|------|-------|-----|
| A | `@` | `YOUR_VPS_IP` | 3600 |
| A | `www` | `YOUR_VPS_IP` | 3600 |

Set this in your domain registrar's DNS management panel.
Verify with: `dig auditwise.tech +short`

---

## Step 2: Generate SSH Key Pair

On your local machine (not the VPS):

```bash
ssh-keygen -t ed25519 -C "auditwise-deploy" -f ~/.ssh/auditwise_deploy
```

This creates two files:
- `~/.ssh/auditwise_deploy` (private key — for GitHub)
- `~/.ssh/auditwise_deploy.pub` (public key — for VPS)

Copy the public key to your VPS:

```bash
ssh-copy-id -i ~/.ssh/auditwise_deploy.pub root@YOUR_VPS_IP
```

Or manually:

```bash
ssh root@YOUR_VPS_IP
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "YOUR_PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Test the connection:

```bash
ssh -i ~/.ssh/auditwise_deploy root@YOUR_VPS_IP "echo 'SSH works'"
```

---

## Step 3: GitHub Repository Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

Add these **4 required secrets**:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `VPS_HOST` | Your Hostinger VPS IP address | `154.38.xxx.xxx` |
| `VPS_USER` | SSH username | `root` |
| `VPS_SSH_KEY` | Contents of `~/.ssh/auditwise_deploy` (the PRIVATE key) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_PORT` | SSH port (usually 22) | `22` |

To get the private key content:

```bash
cat ~/.ssh/auditwise_deploy
```

Copy the **entire** output including the `-----BEGIN` and `-----END` lines.

---

## Step 4: First-Time VPS Setup

SSH into your VPS and run the one-command deploy:

```bash
ssh root@YOUR_VPS_IP
```

### Option A: Docker Deployment (Recommended)

```bash
apt-get update && apt-get install -y git
git clone -b main https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
cd /opt/auditwise
sudo bash deploy/hostinger-deploy.sh
```

This script automatically:
1. Installs Docker, Nginx, Certbot, UFW
2. Configures firewall (SSH + HTTP + HTTPS only)
3. Generates all production secrets (`.env`)
4. Builds and starts all 5 Docker containers
5. Configures Nginx reverse proxy
6. Obtains SSL certificate from Let's Encrypt
7. Sets up daily database backups (02:00 UTC)
8. Verifies everything is running

### Option B: Native PM2 Deployment (No Docker)

```bash
apt-get update && apt-get install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs postgresql
npm install -g pm2

git clone -b main https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
cd /opt/auditwise
sudo bash deploy/vps-native-deploy.sh
```

---

## Step 5: Verify Deployment

After the deploy script finishes:

```bash
cd /opt/auditwise

# Check containers (Docker mode)
docker compose ps

# Check app health
curl -s http://127.0.0.1:5000/health | jq .

# Check Nginx
curl -so /dev/null -w '%{http_code}' http://127.0.0.1:80/

# Check SSL
curl -so /dev/null -w '%{http_code}' https://auditwise.tech/

# Check all endpoints
curl -s https://auditwise.tech/api/health | jq .
```

Expected output for each: HTTP 200

---

## Step 6: Automatic Deployments via GitHub Actions

After the first-time setup, every push to `main` automatically deploys:

```
git push origin main
→ GitHub Actions builds and verifies the code
→ SSHs into VPS
→ Pulls latest code
→ Rebuilds Docker containers
→ Verifies health
→ Reloads Nginx
→ Cleans up old images
```

You can also trigger a manual deploy from GitHub → Actions → "Deploy to Hostinger VPS" → Run workflow.

---

## Production Credentials

After first deploy, the script generates and displays these credentials:

| Credential | Location |
|------------|----------|
| Super Admin email | `.env` → `INITIAL_SUPER_ADMIN_EMAIL` |
| Super Admin password | `.env` → `INITIAL_SUPER_ADMIN_PASSWORD` |
| Database password | `.env` → `POSTGRES_PASSWORD` |
| JWT Secret | `.env` → `JWT_SECRET` |
| Encryption Key | `.env` → `ENCRYPTION_MASTER_KEY` |

**Change the Super Admin password after first login.**

To view credentials:

```bash
cat /opt/auditwise/.env
```

---

## Production Container Architecture (Docker Mode)

In production, only 3 Docker containers run. Host-level Nginx handles SSL and routing.

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `auditwise-db` | `postgres:16` | 5432 (internal) | PostgreSQL database |
| `auditwise-redis` | `redis:7-alpine` | 6379 (internal) | Session cache |
| `auditwise-backend` | Custom | 5000 (exposed to host) | Express API + static frontend |

| Host Service | Port | Purpose |
|--------------|------|---------|
| Nginx | 80, 443 | SSL termination, reverse proxy to :5000 |
| Certbot | - | Let's Encrypt certificate management |

The `frontend` and `nginx` containers in `docker-compose.yml` are for local/development
testing only and are not started in production.

---

## Management Commands

### Docker Mode

```bash
cd /opt/auditwise

# View logs
docker compose logs -f backend        # backend logs
docker compose logs -f db             # database logs
docker compose logs -f redis          # redis logs
sudo tail -f /var/log/nginx/error.log # host nginx logs

# Container status
docker compose ps

# Restart backend
docker compose restart backend

# Rebuild and restart (production services only)
docker compose build backend
docker compose up -d db redis backend

# Host Nginx status
sudo systemctl status nginx
sudo nginx -t

# Database backup
bash deploy/backup.sh

# Update from GitHub
bash deploy/vps-update.sh

# Database shell
docker exec -it auditwise-db psql -U auditwise -d auditwise
```

### PM2 Native Mode

```bash
cd /opt/auditwise

# View logs
pm2 logs auditwise

# Process status
pm2 status

# Restart
pm2 restart auditwise

# Update from GitHub
bash deploy/vps-native-update.sh

# Database shell
sudo -u postgres psql auditwise
```

---

## SSL Certificate Renewal

Let's Encrypt certificates auto-renew via certbot's systemd timer.

To manually renew:

```bash
certbot renew --nginx
systemctl reload nginx
```

To check renewal status:

```bash
certbot certificates
systemctl list-timers | grep certbot
```

---

## Troubleshooting

### App won't start

```bash
# Check Docker logs
docker compose logs --tail 100 backend

# Check if database is ready
docker compose exec db pg_isready -U auditwise

# Check .env configuration
cat /opt/auditwise/.env

# Rebuild from scratch
docker compose down
docker compose up -d --build
```

### SSL not working

```bash
# Verify DNS points to VPS
dig auditwise.tech +short

# Check Nginx config
nginx -t

# Re-request SSL
certbot --nginx -d auditwise.tech -d www.auditwise.tech \
  --non-interactive --agree-tos -m aqeelalam2010@gmail.com --redirect
```

### Database issues

```bash
# Check database container
docker compose logs db

# Connect to database
docker exec -it auditwise-db psql -U auditwise -d auditwise

# Restore from backup
gunzip -c backups/LATEST_BACKUP.sql.gz \
  | docker exec -i auditwise-db psql -U auditwise -d auditwise
```

---

## Security Checklist

- [ ] Change Super Admin password after first login
- [ ] Set `SUPER_ADMIN_ALLOWED_IPS` in `.env` to your office IP
- [ ] Generate strong secrets: `openssl rand -hex 32`
- [ ] Keep `.env` file permissions at 600: `chmod 600 .env`
- [ ] UFW firewall active with only SSH/HTTP/HTTPS open
- [ ] SSL certificate installed and auto-renewing
- [ ] Daily backups configured and verified
- [ ] SSH key authentication (disable password auth in `/etc/ssh/sshd_config`)

---

## Quick Deploy (deployment/ folder)

For a clean containerized deployment using only the `deployment/` folder:

```bash
cd /opt/auditwise

cp deployment/.env.example deployment/.env
nano deployment/.env

bash deployment/deploy.sh
```

The `deployment/` folder contains everything needed:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | 5-service production stack (db, redis, backend, frontend, nginx) |
| `nginx.conf` | Nginx reverse proxy (gzip, caching, security headers, rate limiting) |
| `.env.example` | Environment variable template with all required placeholders |
| `deploy.sh` | One-command deploy: git pull → stop → build → start → health check |
| `healthcheck.sh` | Comprehensive health check across all 5 services |

Build and start:

```bash
cd deployment
docker compose up -d --build
```

Run health check:

```bash
bash deployment/healthcheck.sh
```
