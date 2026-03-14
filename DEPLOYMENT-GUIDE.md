# AuditWise Deployment Guide

## Recommended Architecture (Hostinger VPS)

```
Replit (development)
  ↓ git push
GitHub (source control)
  ↓ GitHub Actions CI/CD
Hostinger VPS (production)
  ├── Host Nginx (SSL termination + reverse proxy, ports 80/443)
  │     ↓ proxy_pass to 127.0.0.1:5000
  └── Docker Containers  [docker-compose.vps.yml — 3 services]
        ├── auditwise-db (PostgreSQL 16, port 5432 internal only)
        ├── auditwise-redis (Redis 7, port 6379 internal only)
        └── auditwise-backend (Express API, port 5000 → host loopback)
              ↓ serves both REST API + pre-built React SPA
https://auditwise.tech
```

**Why this shape?**
- Host Nginx handles TLS (Let's Encrypt) and acts as the only public-facing process.
- Only 3 Docker containers run in production — less RAM, faster restarts, simpler logs.
- The backend (`dist/index.cjs`) serves the Vite-built React SPA from `dist/public` — no
  separate frontend container required.
- PostgreSQL and Redis are never exposed outside the Docker network.

> **Local / full-containerized mode** (all 5 containers including Nginx and frontend)
> is supported via `docker-compose.prod.yml` and is documented at the end of this
> guide. Use it for local testing or when you want a fully self-contained Docker stack.

---

## Quick Start — Fresh VPS (Recommended)

For a brand-new Ubuntu 22.04/24.04 VPS, one script installs everything end-to-end:

```bash
# 1. SSH into your VPS
ssh root@YOUR_VPS_IP

# 2. Set your domain and email, then run the installer
DOMAIN=auditwise.tech EMAIL=admin@auditwise.tech \
  bash <(curl -fsSL https://raw.githubusercontent.com/aqeelalamfca-sys/Test-Audit/main/deploy/hostinger-vps-setup.sh)
```

Or, if you already have the repo cloned:

```bash
git clone https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
DOMAIN=auditwise.tech EMAIL=admin@auditwise.tech \
  bash /opt/auditwise/deploy/hostinger-vps-setup.sh
```

The installer (`deploy/hostinger-vps-setup.sh`) performs these steps automatically:

| Step | What it does |
|------|-------------|
| 1 | Installs `git`, `curl`, `ufw`, `nginx`, `certbot`, `python3-certbot-nginx` |
| 2 | Installs Docker Engine + Compose plugin |
| 3 | Creates 2 GB swap, tunes `vm.swappiness` |
| 4 | Clones / updates repo to `/opt/auditwise` |
| 5 | Creates `.env` from `.env.example`, auto-generates secrets, prompts for review |
| 6 | Pre-deploy database backup (if a previous deployment exists) |
| 7 | Builds and starts 3 containers via `docker-compose.vps.yml` |
| 8 | Installs `deploy/nginx/host-auditwise.conf` and reloads Nginx |
| 9 | Obtains Let's Encrypt certificate via Certbot |
| 10 | Configures UFW (allow SSH + 80 + 443, deny all else) |
| + | Installs daily DB backup cron and twice-daily Certbot renewal cron |
| + | Runs a post-install health check on all endpoints |

---

## Key Files for VPS Deployment

| File | Purpose |
|------|---------|
| `docker-compose.vps.yml` | **3-service** production stack (db, redis, backend) |
| `deploy/nginx/host-auditwise.conf` | Host Nginx config (HTTP→HTTPS, WebSocket, SSE, asset caching) |
| `deploy/hostinger-vps-setup.sh` | End-to-end VPS installer / updater |
| `.env.example` | Canonical environment variable template |
| `deploy/backup.sh` | Standalone PostgreSQL backup utility |

---

## Environment Variables

Copy and edit `.env` before first start:

```bash
cp .env.example .env
nano .env   # or vim, vi …
```

Required fields:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong random password (`openssl rand -hex 24`) |
| `JWT_SECRET` | 32-byte hex secret (`openssl rand -hex 32`) |
| `ENCRYPTION_MASTER_KEY` | 32-byte hex secret (`openssl rand -hex 32`) |
| `INITIAL_SUPER_ADMIN_EMAIL` | First admin account email |
| `INITIAL_SUPER_ADMIN_PASSWORD` | First admin password (change after login) |

Optional performance tuning (safe defaults already set):

| Variable | Default | Notes |
|----------|---------|-------|
| `NODE_HEAP_SIZE` | `1536` | MB; lower to `1024` for 2 GB VPS |
| `REDIS_MAXMEMORY` | `256mb` | ~10% of RAM; raise for larger VPS |
| `PG_SHARED_BUFFERS` | `256MB` | ~25% of RAM available to Postgres |
| `PG_EFFECTIVE_CACHE_SIZE` | `768MB` | ~75% of RAM for Postgres planner |

---

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

### Option A: Recommended — Host Nginx + 3 Containers (`docker-compose.vps.yml`)

Use the new end-to-end installer (see **Quick Start** section above for the one-liner):

```bash
apt-get update && apt-get install -y git
git clone -b main https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
cd /opt/auditwise
DOMAIN=auditwise.tech EMAIL=admin@auditwise.tech bash deploy/hostinger-vps-setup.sh
```

This script automatically:
1. Installs Docker, Nginx, Certbot, UFW
2. Configures firewall (SSH + HTTP + HTTPS only)
3. Generates all production secrets (`.env`)
4. Builds and starts **3 Docker containers** (`docker-compose.vps.yml`)
5. Installs host Nginx config (`deploy/nginx/host-auditwise.conf`)
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
curl -s http://127.0.0.1:5000/api/health | jq .

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

### Docker VPS Mode (`docker-compose.vps.yml`)

```bash
cd /opt/auditwise

# View logs
docker compose -f docker-compose.vps.yml logs -f backend   # backend logs
docker compose -f docker-compose.vps.yml logs -f db        # database logs
docker compose -f docker-compose.vps.yml logs -f redis     # redis logs
sudo tail -f /var/log/nginx/error.log                      # host nginx logs

# Container status
docker compose -f docker-compose.vps.yml ps

# Restart backend
docker compose -f docker-compose.vps.yml restart backend

# Rebuild and restart (all 3 services)
docker compose -f docker-compose.vps.yml up -d --build

# Host Nginx status
sudo systemctl status nginx
sudo nginx -t

# Database backup
bash deploy/backup.sh

# Update from GitHub (re-runs the installer — idempotent)
DOMAIN=auditwise.tech EMAIL=admin@auditwise.tech \
  bash /opt/auditwise/deploy/hostinger-vps-setup.sh

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

## Legacy / Local Testing: Full Containerized Stack

> **Note:** The following modes run all 5 containers (db, redis, backend, frontend, nginx)
> inside Docker, including a containerized Nginx. This is useful for **local development**
> and **testing the full stack** without a host Nginx. It is **not recommended for
> production VPS** because it uses more RAM, adds complexity, and the containerized
> Nginx cannot easily integrate with Let's Encrypt on a host that already runs Nginx.

### `docker-compose.prod.yml` (5-service legacy mode)

```bash
cd /opt/auditwise
cp .env.example .env && nano .env
docker compose -f docker-compose.prod.yml up -d --build
```

### `deployment/` folder (self-contained deployment)

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
