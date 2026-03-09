# AuditWise — Replit DevOps Controller Setup Prompt

Copy everything below and paste it as your first message when creating a new Replit workspace.

---

## Prompt

I am setting up Replit as the central DevOps controller for my project AuditWise.

### Repository

GitHub: https://github.com/aqeelalamfca-sys/Test-Audit
Branch: main

### Infrastructure (already running — do not recreate)

- VPS: Hostinger, IP 187.77.130.117, Ubuntu 24.04, root access
- Domain: auditwise.tech (DNS points to VPS)
- Docker: 5 containers running (auditwise-backend, auditwise-frontend, auditwise-nginx, auditwise-db, auditwise-redis)
- SSL: Let's Encrypt certificates active
- CI/CD: GitHub Actions auto-deploys on push to main

### Required Secrets

Set these in Replit Secrets before starting:

| Secret Name | Description | How to get it |
|---|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub PAT with repo scope | GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic) → Select `repo` scope |
| `VPS_SSH_KEY` | SSH private key for VPS access | Generate: `ssh-keygen -t ed25519 -C "replit-deploy" -f replit_key -N ""` then paste contents of `replit_key` file here. Add `replit_key.pub` to VPS (Hostinger panel → Settings → SSH keys) |

### Environment Variables

Set these as regular environment variables:

```
VPS_HOST=187.77.130.117
VPS_USER=root
DOMAIN_NAME=auditwise.tech
DOCKER_CONTAINER_NAME=auditwise
```

### What Replit must configure

1. Clone the GitHub repository
2. Install all npm dependencies
3. Generate Prisma client and push schema to Replit's built-in PostgreSQL
4. Configure the dev server on port 5000 with host 0.0.0.0
5. Allow all hosts in Vite dev server (for Replit iframe proxy)
6. Set up the following DevOps control scripts in a `devops/` directory:

#### devops/control.sh — Unified CLI

```
bash devops/control.sh push [msg]       — Commit and push code to GitHub
bash devops/control.sh deploy           — Full deploy: push to GitHub → SSH to VPS → pull → rebuild Docker → restart
bash devops/control.sh deploy-quick     — Quick deploy: SSH to VPS → pull latest → rebuild backend only
bash devops/control.sh health           — Full system health check (GitHub, SSH, Docker, ports, domain)
bash devops/control.sh status           — Show all Docker container status and resource usage
bash devops/control.sh logs [svc] [n]   — View container logs (services: backend, frontend, nginx, db, redis)
bash devops/control.sh restart [svc]    — Restart container(s) on VPS
bash devops/control.sh rebuild [svc]    — Rebuild and restart a specific service
bash devops/control.sh backup           — Create PostgreSQL database backup on VPS
bash devops/control.sh autopush [sec]   — Start auto-push daemon (default: every 120 seconds)
bash devops/control.sh ssh [cmd]        — Run arbitrary command on VPS via SSH
```

#### devops/ssh-cmd.sh — SSH wrapper

Uses `$VPS_SSH_KEY` secret to connect to VPS. Must:
- Write key to ~/.ssh/vps_key with chmod 600
- Use StrictHostKeyChecking=accept-new
- Use BatchMode=yes for non-interactive operation

#### devops/push.sh — GitHub push

- Stage all changes, commit with message, push to origin main
- Use GITHUB_PERSONAL_ACCESS_TOKEN for authentication via push URL (not stored in git config)
- Never use --force flag

#### devops/deploy.sh — VPS deployment

Modes:
- `full`: Push to GitHub first, then SSH to VPS → backup DB → pull code → rebuild all containers → health check → rollback on failure
- `quick`: SSH to VPS → pull code → rebuild backend only → health check
- `restart`: SSH to VPS → restart all containers without rebuild

Must exit non-zero if health check fails.

#### devops/containers.sh — Container management

- Validate service names (whitelist: backend, frontend, nginx, db, redis)
- Validate numeric inputs
- Pass arguments safely via heredoc with positional parameters (no string interpolation into remote commands)

#### devops/health.sh — System health check

Check all of:
1. GitHub API connectivity and code sync status
2. VPS SSH connectivity
3. Docker container status (all 5 containers)
4. Ports 80, 443, 5000 listening on VPS
5. HTTPS response from auditwise.tech
6. API health endpoint response

#### devops/autopush.sh — Auto-sync daemon

- Push changes to GitHub every N seconds (default 120)
- Only push when there are uncommitted changes
- Use push URL with token (not stored in git config)

### Pipeline architecture

```
Developer edits code in Replit
    ↓
Replit pushes to GitHub (manual or auto-push)
    ↓
GitHub Actions CI/CD triggers on push to main
    ↓
VPS pulls latest code
    ↓
Docker rebuilds containers
    ↓
Nginx reverse proxy serves traffic
    ↓
auditwise.tech is live
```

OR for direct deployment:

```
Replit SSH → VPS → pull + rebuild + restart → live
```

### Security requirements

- Never store tokens in git config — use push URL inline
- Validate/whitelist all service names before passing to remote commands
- Use heredoc with positional parameters for remote SSH execution
- SSH: StrictHostKeyChecking=accept-new (not =no)
- All deploy scripts must exit non-zero on health check failure

### After setup is complete

1. Configure Replit deployment (autoscale, build: npm run build, run: node dist/index.cjs)
2. Verify the local dev server works on port 5000
3. Test `bash devops/control.sh health` to verify all connections
4. The system should be fully operational with no manual VPS commands needed
