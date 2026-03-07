# AuditWise — Production Deployment Guide

## Architecture

```
Replit (Dev) → GitHub (Source) → GitHub Actions (CI/CD) → GHCR (Docker Images) → Hostinger VPS → Docker Compose → Nginx → SSL → AuditWise SaaS
```

```
                    ┌──────────────────┐
  Browser ──HTTPS──▶│  Nginx Proxy     │
                    │  :80 / :443      │
                    └──┬───────────┬───┘
                       │           │
            /api/*     │           │  /*
                       ▼           ▼
              ┌──────────┐  ┌──────────┐
              │ Backend  │  │ Frontend │
              │ :5000    │  │ :80      │
              │ Node 20  │  │ Nginx    │
              └────┬─────┘  └──────────┘
                   │
              ┌────▼─────┐
              │ Postgres │
              │ :5432    │
              │ (internal)│
              └──────────┘
         Docker Compose network: auditwise
```

- **4 services**: `db` (PostgreSQL 16), `backend` (Node.js + Prisma), `frontend` (React SPA via Nginx), `nginx` (reverse proxy)
- **Domain**: auditwise.tech (IP: 187.77.130.117)
- **Images**: `ghcr.io/aqeelalamfca-sys/auditwise-backend:latest`, `ghcr.io/aqeelalamfca-sys/auditwise-frontend:latest`
- **Startup order**: db (healthy) → backend (runs migrations, healthy) → frontend (healthy) → nginx

## Quick Deploy (First Time)

```bash
ssh root@187.77.130.117

git clone -b main https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
cd /opt/auditwise
sudo bash deploy.sh
```

The script handles everything: system deps, Docker, swap, firewall, `.env` generation, Docker build, database migrations, Nginx, SSL certificates, cron jobs, and health verification.

## Quick Deploy (Updates)

```bash
cd /opt/auditwise
sudo bash deploy.sh
```

Or manually:

```bash
cd /opt/auditwise
docker compose down --remove-orphans
git pull origin main
docker compose up -d --build --force-recreate
```

## Pull Pre-Built Images from GHCR

GitHub Actions builds and pushes images automatically on merge to main:

```bash
cd /opt/auditwise

# Login to GitHub Container Registry
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Pull latest images
docker compose pull backend frontend

# Restart
docker compose down --remove-orphans
docker compose up -d

# Verify
docker compose ps
curl -sf http://localhost:5000/api/health
```

## Environment Setup

```bash
cp .env.example .env
nano .env

# Generate secrets
openssl rand -hex 24  # → POSTGRES_PASSWORD
openssl rand -hex 32  # → JWT_SECRET
openssl rand -hex 32  # → SESSION_SECRET
openssl rand -hex 32  # → ENCRYPTION_MASTER_KEY
```

Required variables:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Database password |
| `DATABASE_URL` | `postgresql://auditwise:PASSWORD@db:5432/auditwise?schema=public` |
| `JWT_SECRET` | Random 64-char hex |
| `SESSION_SECRET` | Random 64-char hex |
| `ENCRYPTION_MASTER_KEY` | Random 64-char hex |
| `INITIAL_SUPER_ADMIN_EMAIL` | Super admin email |
| `INITIAL_SUPER_ADMIN_PASSWORD` | Super admin password |
| `NODE_ENV` | `production` |

## Services

| Service | Container | Port | Image | Description |
|---------|-----------|------|-------|-------------|
| PostgreSQL 15 | auditwise-db | 5432 | `postgres:15` | Database with persistent volume |
| Backend | auditwise-backend | 5000 | `ghcr.io/.../auditwise-backend` | Node.js + Express + Prisma |
| Frontend | auditwise-frontend | 3000→80 | `ghcr.io/.../auditwise-frontend` | React SPA via Nginx Alpine (container port 80) |
| Nginx Proxy | auditwise-nginx | 80/443 | `nginx:alpine` | Reverse proxy + SSL termination |

## What deploy.sh Does (10 Steps, Idempotent)

1. Installs system dependencies (git, docker, nginx, certbot)
2. Installs Docker Engine + Compose plugin
3. Creates 4GB swap + configures firewall (SSH, HTTP, HTTPS)
4. Pulls latest code from GitHub
5. Generates `.env` with random secrets (first run only)
6. Pre-deploy database backup
7. Docker build + start (with auto-rollback on failure)
8. Configures host NGINX reverse proxy
9. Installs SSL certificate via certbot
10. Sets up cron (daily backup, weekly prune, 5-min health monitor)

## Backend Startup Sequence (docker-entrypoint.sh)

1. Validate environment variables (auto-construct DATABASE_URL with URL-encoded password)
2. Wait for database TCP connection (90s timeout)
3. `npx prisma generate`
4. `npx prisma migrate deploy` (or `prisma db push` fallback)
5. Start application: `node dist/index.cjs`

## Health Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Lightweight readiness check |
| `/api/health/full` | GET | Deep health with DB ping |
| `/health` | GET | Legacy health endpoint |
| `/__healthz` | GET | Docker/k8s liveness probe |

## Common Commands

```bash
cd /opt/auditwise

# Container status
docker compose ps

# Live logs
docker compose logs -f backend
docker compose logs -f --tail=50 backend

# Restart a single service
docker compose restart backend

# Full restart
docker compose down && docker compose up -d

# Rebuild after code changes
docker compose up -d --build --force-recreate

# Database backup
docker exec auditwise-db pg_dump -U auditwise -d auditwise --no-owner | gzip > backup_$(date +%Y%m%d).sql.gz

# Database restore
gunzip -c backup_20260101.sql.gz | docker exec -i auditwise-db psql -U auditwise -d auditwise

# Enter database shell
docker exec -it auditwise-db psql -U auditwise -d auditwise

# Check backend health
curl -sf http://localhost:5000/api/health | jq

# SSL certificate
certbot --nginx -d auditwise.tech -d www.auditwise.tech --non-interactive --agree-tos -m aqeelalam2010@gmail.com --redirect

# Clean up Docker resources
docker system prune -af
```

## GitHub Actions CI/CD Pipeline

Triggers on push to `main` branch. 4-job pipeline:

1. **Lint** — `npm ci` + `prisma generate` + type check
2. **Build** — `npm run build` + verify `dist/index.cjs` + `dist/public/index.html`
3. **Docker** — Build + push backend/frontend images to GHCR
4. **Deploy** — SSH to VPS, backup DB, pull code, pull images, restart containers, health check

### GitHub Actions Secrets Required

Set in GitHub repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `187.77.130.117` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | SSH private key content |
| `VPS_PORT` | `22` |
| `GHCR_PAT` | GitHub Personal Access Token (optional, for private images) |

## Automated Maintenance (via cron)

- **Daily 2:00 AM** — Database backup to `/opt/auditwise/backups/`
- **Weekly Sunday 3:00 AM** — Prune old backups (keep 14)
- **Every 5 minutes** — Health check, auto-restart backend if unhealthy

## File Structure

```
/opt/auditwise/
├── deploy.sh                    # 10-step VPS provisioning (idempotent)
├── docker-compose.yml           # 4-service stack
├── .env                         # Production secrets (not in git)
├── .env.example                 # Template with all variables
├── DEPLOYMENT.md                # This file
├── docker/
│   ├── backend.Dockerfile       # Multi-stage: Node 20 Alpine
│   ├── frontend.Dockerfile      # Multi-stage: Node 20 Alpine → Nginx Alpine
│   ├── docker-entrypoint.sh     # Runtime: env validate → DB wait → migrate → start
│   ├── frontend-nginx.conf      # Frontend static file server (port 80)
│   └── scripts/
│       ├── build.sh
│       ├── deploy.sh
│       └── healthcheck.sh
├── nginx/
│   ├── default.conf             # HTTP Nginx config (mounted by compose)
│   ├── nginx-ssl.conf           # HTTPS config (copied when SSL ready)
│   └── ssl/                     # SSL certs (not in git)
├── .github/workflows/
│   └── deploy.yml               # CI/CD pipeline
└── prisma/
    └── schema.prisma            # Database schema
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Backend won't start | `docker compose logs --tail=100 backend` |
| Database connection issues | `docker compose exec db pg_isready -U auditwise` |
| 502 Bad Gateway | `curl http://127.0.0.1:5000/api/health` — if fails, check backend logs |
| SSL not working | `certbot --nginx -d auditwise.tech -d www.auditwise.tech` |
| OOM during build | Ensure swap: `swapon --show` (4GB recommended) |
| Disk full | `docker system prune -af` |
| SuperAdmin can't login | Check `SUPER_ADMIN_ALLOWED_IPS` in `.env` (empty = allow all) |
| DB migration failed | `docker compose logs backend \| grep -i "fatal\|error"` |

## Verification (Run on VPS)

```bash
docker compose ps                                  # All containers healthy
curl -sf http://127.0.0.1:5000/api/health          # Backend health
curl -sf http://127.0.0.1:5000/ | grep '<html'     # Frontend serves HTML
curl -sI https://auditwise.tech/                   # HTTPS works
curl -sI https://auditwise.tech/api/health         # API via Nginx
```
