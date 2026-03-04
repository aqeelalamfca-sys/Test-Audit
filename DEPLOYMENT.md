# AuditWise — Hostinger VPS Deployment Guide

## Architecture

- **Type**: Express backend serves React SPA statically (single process)
- **Port**: 5000 (internal), NGINX proxies 80/443 → 5000
- **Stack**: Node 20 + PostgreSQL 16 via Docker Compose
- **Domain**: auditwise.tech (IP: 187.77.130.117)

## Quick Deploy (Single Command)

SSH into VPS as root, then:

```bash
curl -sf https://raw.githubusercontent.com/aqeelalamfca-sys/Test-Audit/main/deploy.sh | bash
```

Or if code is already cloned:

```bash
cd /opt/auditwise && bash deploy.sh
```

## Manual Setup

### 1. Prerequisites

```bash
apt-get update && apt-get install -y git docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
systemctl enable --now docker
```

### 2. Clone Repository

```bash
git clone -b main https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
cd /opt/auditwise
```

### 3. Create Environment File

```bash
cp .env.example .env   # or let deploy.sh auto-generate
nano .env               # edit secrets
```

Required variables:
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `postgresql://auditwise:PASSWORD@db:5432/auditwise?schema=public` |
| `DB_PASSWORD` | Postgres password (must match DATABASE_URL) |
| `JWT_SECRET` | Random 64-char hex |
| `SESSION_SECRET` | Random 64-char hex |
| `ENCRYPTION_MASTER_KEY` | Random 64-char hex |
| `INITIAL_SUPER_ADMIN_EMAIL` | Super admin email |
| `INITIAL_SUPER_ADMIN_PASSWORD` | Super admin password (min 10 chars) |

### 4. Build & Start

```bash
docker compose up -d --build
```

First build takes 3-5 minutes. Monitor:

```bash
docker compose logs -f app
```

Wait for: `serving on 0.0.0.0:5000`

### 5. Configure NGINX

```bash
cp deploy/nginx/auditwise.conf /etc/nginx/conf.d/auditwise.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 6. SSL Certificate

```bash
certbot --nginx -d auditwise.tech -d www.auditwise.tech --non-interactive --agree-tos -m YOUR_EMAIL --redirect
```

### 7. Verify

```bash
bash scripts/healthcheck.sh
```

## Endpoints

| Endpoint | Method | Expected | Description |
|----------|--------|----------|-------------|
| `/` | GET | 200 + HTML | Login page (React SPA) |
| `/health` | GET | 200 + JSON `{"status":"ok"}` | Health check with uptime + version |
| `/__healthz` | GET | 200 + JSON | Internal health (Docker) |
| `/api/health/full` | GET | 200 + JSON | Full health with DB status |
| `/api/auth/login` | POST | 200 + JSON | Authentication |
| `/dashboard` | GET | 200 + HTML | SPA route (returns index.html) |
| `/login` | GET | 200 + HTML | SPA route (returns index.html) |

## Updating

After pushing to GitHub:

```bash
cd /opt/auditwise && bash deploy/vps-update.sh
```

Or the full single-line:

```bash
cd /opt/auditwise && git pull && docker compose up -d --build && sleep 120 && bash scripts/healthcheck.sh && echo "LIVE"
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot GET /` | Frontend not built or `NODE_ENV` not set | Rebuild: `docker compose up -d --build` |
| `404` on `/` | `serveStatic` not loading (missing `dist/public`) | Check: `docker compose exec app ls /app/dist/public/index.html` |
| Connection refused on 443 | SSL not configured | Run certbot command above |
| `npm ci` error in build | Lockfile mismatch | Delete `node_modules`, run `npm install` locally, commit `package-lock.json` |
| Connection reset by peer | App crashed during startup | Check: `docker compose logs --tail 50 app` |
| App unhealthy in `docker compose ps` | DB sync or seeding failed | Check: `docker compose logs app \| grep -i error` |
| `ENOSPC` during build | Disk full | `docker system prune -af` to clear old images |
| Out of memory during build | VPS RAM too low | Ensure 4GB swap: `fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` |
| `FATAL: Database not reachable` | DB container not healthy | Check: `docker compose ps db` and `docker compose logs db` |
| API returns 401 | Token expired | Frontend auto-refreshes; if not, clear localStorage and re-login |

## Backup & Restore

Daily automatic backups at 02:00 UTC to `/opt/auditwise/backups/`.

Manual backup:

```bash
bash /opt/auditwise/deploy/backup.sh
```

Restore from backup:

```bash
docker compose exec -T db psql -U auditwise -d auditwise < backups/auditwise_YYYYMMDD_HHMMSS.sql
```

## Docker Commands

```bash
docker compose ps                    # container status
docker compose logs -f app           # live app logs
docker compose logs -f db            # live db logs
docker compose restart app           # restart app only
docker compose down                  # stop all
docker compose up -d --build         # rebuild and start
docker system prune -af              # clean unused images
```

## File Structure

```
/opt/auditwise/
├── deploy.sh                  # First-time deploy script
├── deploy/
│   ├── hostinger-deploy.sh    # Legacy deploy script
│   ├── vps-update.sh          # Update script (git pull → rebuild)
│   ├── backup.sh              # Database backup script
│   └── nginx/
│       ├── auditwise.conf     # HTTP-only NGINX config
│       └── auditwise-ssl.conf # HTTPS NGINX config
├── scripts/
│   └── healthcheck.sh         # Endpoint verification
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # App + DB stack
├── docker-entrypoint.sh       # Runtime startup (DB wait → migrate → start)
├── .env                       # Production secrets (not in git)
└── dist/                      # Built output (inside container)
    ├── index.cjs              # Server bundle
    └── public/                # Frontend assets
        └── index.html         # SPA entry point
```
