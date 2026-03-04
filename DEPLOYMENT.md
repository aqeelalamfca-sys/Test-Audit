# AuditWise — Hostinger VPS Deployment Guide

## Architecture

```
                    ┌──────────────┐
  Browser ──HTTPS──▶│   NGINX      │
                    │  :80/:443    │
                    └──────┬───────┘
                           │ proxy_pass
                    ┌──────▼───────┐      ┌──────────────┐
                    │  Express App │──────▶│ PostgreSQL   │
                    │  :5000       │      │  :5432       │
                    │  (Node 20)   │      │  (internal)  │
                    └──────────────┘      └──────────────┘
                    Docker Compose network
```

- **Pattern**: Express backend serves React SPA statically (single process, single port)
- **Port**: 5000 (internal only), NGINX proxies 80/443 → 127.0.0.1:5000
- **Upstream**: NGINX uses named upstream `auditwise_backend` → `127.0.0.1:5000` (stable, no container IPs)
- **Stack**: Node 20 + PostgreSQL 16 via Docker Compose
- **Domain**: auditwise.tech (IP: 187.77.130.117)
- **DB**: Internal to Docker network only (not exposed on host)

## Quick Deploy (Single Command)

SSH into VPS as root:

```bash
cd /opt/auditwise && bash deploy.sh
```

Or first-time on a fresh VPS:

```bash
git clone -b main https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise && cd /opt/auditwise && bash deploy.sh
```

Alternative path (same script):

```bash
cd /opt/auditwise && bash scripts/deploy.sh
```

## What deploy.sh Does (Idempotent)

1. Installs system dependencies (git, docker, nginx, certbot)
2. Installs Docker Engine + Compose plugin
3. Creates 4GB swap (prevents OOM during build)
4. Configures firewall (SSH + HTTP + HTTPS)
5. Pulls latest code from GitHub
6. Generates `.env` with random secrets (first run only)
7. Builds Docker images (multi-stage: deps → UI build → server build → runtime)
8. Starts containers, waits for DB + app health
9. Configures NGINX reverse proxy (+ Super Admin IP allowlist)
10. Installs SSL certificate via certbot (non-fatal if fails)
11. Sets up daily backup cron (02:00 UTC)
12. Verifies all endpoints return expected responses
13. Prints **LIVE** only if all checks pass

## Manual Setup

### 1. Prerequisites

```bash
apt-get update && apt-get install -y git docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
systemctl enable --now docker
```

### 2. Swap (Prevents OOM)

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 3. Clone Repository

```bash
git clone -b main https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
cd /opt/auditwise
```

### 4. Create Environment File

```bash
# Auto-generate (recommended):
bash deploy.sh   # creates .env with random secrets

# Or manually:
cp .env.example .env && nano .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `postgresql://auditwise:PASSWORD@db:5432/auditwise?schema=public` |
| `DB_PASSWORD` | Postgres password (must match DATABASE_URL) |
| `JWT_SECRET` | Random 64-char hex (`openssl rand -hex 32`) |
| `SESSION_SECRET` | Random 64-char hex |
| `ENCRYPTION_MASTER_KEY` | Random 64-char hex |
| `INITIAL_SUPER_ADMIN_EMAIL` | Super admin email |
| `INITIAL_SUPER_ADMIN_PASSWORD` | Super admin password (min 10 chars, mixed case + number + special) |

### 5. Build & Start

```bash
docker compose up -d --build
```

First build takes 3-5 minutes. Monitor:

```bash
docker compose logs -f app
```

Wait for: `serving on 0.0.0.0:5000`

### 6. Configure NGINX

```bash
cp deploy/nginx/auditwise.conf /etc/nginx/conf.d/auditwise.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 7. SSL Certificate

```bash
certbot --nginx -d auditwise.tech -d www.auditwise.tech --non-interactive --agree-tos -m YOUR_EMAIL --redirect
```

### 8. Verify

```bash
bash scripts/healthcheck.sh
```

## Endpoints

| Endpoint | Method | Expected Response | Description |
|----------|--------|-------------------|-------------|
| `/` | GET | `200` + HTML (`<html lang="en">`) | Login page (React SPA) |
| `/login` | GET | `200` + HTML | SPA route (serves index.html) |
| `/dashboard` | GET | `200` + HTML | SPA route (serves index.html) |
| `/any/deep/link` | GET | `200` + HTML | SPA fallback (all non-API paths → index.html) |
| `/health` | GET | `200` + JSON `{"status":"ok","uptime":...,"version":"...","timestamp":"..."}` | Readiness check |
| `/__healthz` | GET | `200` + JSON | Liveness check (Docker) |
| `/api/health/full` | GET | `200` + JSON | Deep health with DB ping |
| `/api/auth/login` | POST | `200` + JSON | Authentication |
| `/api/*` | Various | JSON responses | All API routes namespaced under /api |

### Example Responses

```bash
# Health check
$ curl -sf https://auditwise.tech/health
{"status":"ok","timestamp":"2026-03-04T08:45:25.997Z","uptime":19.96,"version":"v20.20.0","memory":{...}}

# Homepage (returns SPA HTML)
$ curl -sI https://auditwise.tech/
HTTP/2 200
content-type: text/html; charset=UTF-8

# API (returns JSON)
$ curl -sI https://auditwise.tech/api/health/full
HTTP/2 200
content-type: application/json
```

## Updating

After pushing to GitHub:

```bash
cd /opt/auditwise && bash deploy/vps-update.sh
```

What it does: git pull → backup → rebuild containers → wait for health → verify homepage → print status.

## Rollback

If a deploy breaks something:

```bash
cd /opt/auditwise && bash scripts/rollback.sh
```

This will:
1. Create a pre-rollback database backup
2. Revert to the previous git commit
3. Rebuild and restart containers
4. Verify health + homepage
5. Print rollback status

To rollback N commits:

```bash
bash scripts/rollback.sh 3   # rollback 3 commits
```

To undo a rollback:

```bash
cd /opt/auditwise && git pull && bash deploy/vps-update.sh
```

## Troubleshooting

### Quick Diagnostics

```bash
# Container status
docker compose ps

# App logs (last 50 lines)
docker compose logs --tail 50 app

# DB logs
docker compose logs --tail 20 db

# Check if frontend exists inside container
docker compose exec app ls -la /app/dist/public/index.html

# Check NODE_ENV
docker compose exec app printenv NODE_ENV

# Test NGINX config
nginx -t

# Test endpoints from VPS
curl -I http://127.0.0.1:5000/
curl -sf http://127.0.0.1:5000/health
curl -I https://auditwise.tech/
```

### Symptom → Cause → Fix

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| **`Cannot GET /`** | `esbuild.build()` was async (exited before writing `dist/index.cjs`), so server started without static file serving | Fixed: uses `esbuild.buildSync()`. Rebuild: `docker compose up -d --build` |
| **`Cannot GET /login`** | Same as above — SPA fallback not loaded because server bundle was empty | Same fix: rebuild with `buildSync` |
| **404 on `/`** | `NODE_ENV` not set to `production` in container, so `serveStatic()` is skipped | Check: `docker compose exec app printenv NODE_ENV` — must be `production`. Set in `docker-compose.yml` environment section |
| **502 Bad Gateway** | NGINX can't reach app on port 5000; app not started or crashed | Check: `curl http://127.0.0.1:5000/health` from VPS. If fails: `docker compose logs --tail 30 app` |
| **Connection refused on port 443** | SSL not configured / certbot not run | Run: `certbot --nginx -d auditwise.tech -d www.auditwise.tech --non-interactive --agree-tos -m EMAIL --redirect` |
| **Connection reset by peer** | App crashed during request (OOM or unhandled error) | Check: `docker compose logs app \| grep -i "error\|kill\|oom"`. Ensure swap exists: `swapon --show` |
| **`npm ci` fails in Docker build** | `package-lock.json` missing or out of sync | Dockerfile has fallback: uses `npm install` if no lockfile. To fix permanently: run `npm install` locally, commit `package-lock.json` |
| **Docker build OOM (exit code 137)** | VPS has insufficient RAM for Vite build | Create swap: `fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`. Dockerfile already splits build into 2 steps with reduced heap |
| **`npm run build` exit code 1** | TypeScript or import error in source | Check build output: `docker compose logs app \| grep -i "error"`. Common: missing `attached_assets` (ensure `.dockerignore` doesn't exclude it) |
| **Missing `dist/public`** | Vite build failed silently or `.dockerignore` excluded source files | Check `.dockerignore` doesn't list `attached_assets`, `client`, or `shared`. Rebuild: `docker compose up -d --build` |
| **Wrong paths (`/var/www` vs `/opt`)** | Code lives at `/opt/auditwise`, not `/var/www` | All scripts use `/opt/auditwise`. NGINX proxies to app (no static file serving from NGINX) |
| **App unhealthy in `docker compose ps`** | DB migration failed or seeding error | Check: `docker compose logs app \| grep -i "fatal\|error"`. If DB issue: `docker compose restart db && docker compose restart app` |
| **`FATAL: Database not reachable`** | DB container not healthy or wrong `DATABASE_URL` | Check: `docker compose ps db`. URL must use `db` as host (Docker service name), not `localhost` |
| **API returns 401** | JWT expired, frontend didn't auto-refresh | Clear browser localStorage, re-login. If persistent: check `JWT_SECRET` matches between deploys |
| **`ENOSPC` during build** | Disk full from old Docker images | Clean: `docker system prune -af` (safe — doesn't touch volumes) |
| **SSL certificate renewal fails** | certbot can't reach port 80 | Ensure: `ufw allow 80/tcp` and NGINX is running on port 80 |
| **SuperAdmin can't login** | IP not in allowlist or wrong password | Check `SUPER_ADMIN_ALLOWED_IPS` in `.env` (empty = allow all). Reset password: set `ADMIN_RESET=true` in `.env` and restart |

## Backup & Restore

Daily automatic backups at 02:00 UTC to `/opt/auditwise/backups/`.

```bash
# Manual backup
bash /opt/auditwise/deploy/backup.sh

# List backups
ls -la /opt/auditwise/backups/

# Restore from backup
docker compose exec -T db psql -U auditwise -d auditwise < backups/auditwise_YYYYMMDD_HHMMSS.sql
```

## Docker Commands

```bash
docker compose ps                    # container status (must show "healthy")
docker compose logs -f app           # live app logs
docker compose logs -f db            # live db logs
docker compose restart app           # restart app only
docker compose down                  # stop all (preserves data)
docker compose up -d --build         # rebuild and start
docker image prune -f                # clean unused images (safe)
docker system prune -af              # clean all unused (safe, preserves volumes)
```

## File Structure

```
/opt/auditwise/
├── deploy.sh                  # Canonical deploy script (idempotent)
├── DEPLOYMENT.md              # This file
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # App + DB stack (single port: 5000)
├── docker-entrypoint.sh       # Runtime: DB wait → prisma push → start
├── .env                       # Production secrets (not in git)
├── deploy/
│   ├── hostinger-deploy.sh    # Legacy deploy script
│   ├── vps-update.sh          # Update script (git pull → rebuild → verify)
│   ├── backup.sh              # Database backup (pg_dump, 30-day retention)
│   └── nginx/
│       ├── auditwise.conf     # HTTP NGINX config (pre-SSL)
│       └── auditwise-ssl.conf # HTTPS NGINX config (post-SSL)
├── scripts/
│   ├── deploy.sh              # Alias for ../deploy.sh
│   ├── healthcheck.sh         # 10-point endpoint verification
│   └── rollback.sh            # Revert to previous commit + rebuild
└── [inside Docker container]
    /app/
    ├── dist/
    │   ├── index.cjs           # Server bundle (esbuild output)
    │   └── public/             # Frontend assets (Vite output)
    │       └── index.html      # SPA entry point
    ├── node_modules/           # Production dependencies
    └── prisma/                 # Schema + migrations
```

## Build Process (Inside Docker)

```
Stage 1 (deps):    npm ci → prisma generate
Stage 2 (build):   vite build → dist/public/   (frontend, 2GB heap)
                    esbuild.buildSync → dist/index.cjs  (backend, 1GB heap)
                    verify: ls dist/index.cjs dist/public/index.html
Stage 3 (runtime): copy dist + node_modules + prisma → /app
                    entrypoint: DB wait → prisma db push → node dist/index.cjs
```

## Verification Commands (Run on VPS)

```bash
# All checks at once
bash scripts/healthcheck.sh

# Individual checks
nginx -t                                           # NGINX config valid
docker compose ps                                  # Both containers healthy
curl -sf http://127.0.0.1:5000/health              # App health (direct)
curl -sf http://127.0.0.1:5000/ | grep '<html'     # Homepage returns HTML
curl -sI https://auditwise.tech/                   # HTTPS works
curl -sI https://auditwise.tech/health             # Health via NGINX
curl -sI https://auditwise.tech/api/health/full    # API via NGINX
```
