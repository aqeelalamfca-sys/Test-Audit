# AuditWise — Replit Agent Setup Prompt

Copy everything below this line and paste it as your first message when creating a new Replit project.

---

## Project: AuditWise — Full-Stack Audit Management Platform

### GitHub Repository
- **Repo**: `https://github.com/aqeelalamfca-sys/Test-Audit.git`
- **Branch**: `main`
- Clone this repo into the Replit workspace as the project root.

### VPS (Hostinger)
- **IP**: `187.77.130.117`
- **SSH User**: `root`
- **SSH Port**: `22`
- **App directory on VPS**: `/opt/auditwise`
- **Domain**: `auditwise.tech`
- **Docker Compose project**: 5 containers (auditwise-backend, auditwise-db, auditwise-frontend, auditwise-nginx, auditwise-redis)

### Required Secrets (add to Replit Secrets)
Set these in Replit environment secrets before starting:

| Secret Name | Description |
|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub PAT with repo push access. Used for: `git push "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/aqeelalamfca-sys/Test-Audit.git" main` |
| `VPS_SSH_KEY` | SSH **private** key (starts with `-----BEGIN OPENSSH PRIVATE KEY-----`). Must be the private key, NOT the public key. The matching public key must be in `/root/.ssh/authorized_keys` on the VPS. |
| `DATABASE_URL` | Replit's built-in PostgreSQL connection string (auto-provided if you add a PostgreSQL database to the Repl) |

### Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui + TanStack Query
- **Backend**: Express.js (TypeScript) on port 5000
- **Database**: PostgreSQL via Prisma ORM (schema at `prisma/schema.prisma`)
- **Auth**: JWT + session-based (Passport.js), token key `auditwise_token` in localStorage
- **Monolith**: In development, Vite runs as Express middleware — both frontend and backend share port 5000
- **Production build**: `npm run build` → outputs `dist/index.cjs` (backend+frontend bundle) and `dist/public/` (static assets)
- **Production run**: `node dist/index.cjs`

### Replit Workflow Configuration
Create one workflow:
- **Name**: `Start application`
- **Command**: `NODE_OPTIONS='--max-old-space-size=1024' NODE_ENV=development npx tsx server/index.ts`

### How to Deploy to VPS
After making changes and pushing to GitHub:

```bash
# 1. Push code to GitHub
git add -A && git commit -m "your message"
git push "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/aqeelalamfca-sys/Test-Audit.git" main

# 2. SSH into VPS and deploy
ssh -o StrictHostKeyChecking=no -i ~/.ssh/vps_key root@187.77.130.117

# On VPS:
cd /opt/auditwise
sudo bash deploy/fix-and-deploy.sh
```

**SSH setup in Replit** (run once at start of each session):
```bash
mkdir -p ~/.ssh
echo "$VPS_SSH_KEY" > ~/.ssh/vps_key
chmod 600 ~/.ssh/vps_key
```

**One-liner deploy from Replit**:
```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/vps_key root@187.77.130.117 "cd /opt/auditwise && git pull origin main && bash deploy/fix-and-deploy.sh"
```

### Docker Architecture on VPS
The VPS runs 5 Docker containers via `docker-compose.prod.yml`:

| Container | Image | Ports | Purpose |
|---|---|---|---|
| `auditwise-backend` | Custom (docker/backend.Dockerfile) | 5000:5000 | Express API + serves static frontend |
| `auditwise-frontend` | Custom (docker/frontend.Dockerfile) | 3000:80 | Nginx serving built React SPA |
| `auditwise-nginx` | nginx:alpine | 80:80, 443:443 | Reverse proxy, SSL termination, rate limiting |
| `auditwise-db` | postgres:16 | 5432:5432 | PostgreSQL database |
| `auditwise-redis` | redis:7-alpine | (internal) | Session cache |

### Key Files
- `docker-compose.prod.yml` — Production Docker Compose
- `docker/backend.Dockerfile` — Backend multi-stage build
- `docker/frontend.Dockerfile` — Frontend multi-stage build
- `docker/docker-entrypoint.sh` — Backend startup (env validation, prisma generate, db push, start)
- `docker/nginx-entrypoint.sh` — Nginx startup (waits for backend/frontend, SSL detection)
- `nginx/default.conf` — Nginx config (HTTP)
- `nginx/nginx-ssl.conf` — Nginx config (HTTPS)
- `deploy/fix-and-deploy.sh` — Full rebuild + deploy script
- `deploy/vps-update.sh` — Quick update (pull + rebuild + rollback on failure)
- `deploy/hostinger-deploy.sh` — First-time VPS setup (Docker, firewall, secrets, SSL)
- `deploy/backup.sh` — Database backup
- `prisma/schema.prisma` — Database schema (use `npx prisma db push --skip-generate`, NEVER `npx prisma generate` alone — it times out on Replit)
- `server/index.ts` — Express app entry point
- `client/src/` — React frontend source

### Critical Rules
1. **Prisma**: Always use `npx prisma db push --skip-generate` on Replit. Never run `npx prisma generate` standalone — it times out.
2. **Auth token**: The app stores JWT in `localStorage` under key `auditwise_token`. Use `getAuthToken()` from `client/src/lib/auth.tsx` or `fetchWithAuth()` from `client/src/lib/fetchWithAuth.ts` for API calls that need auth.
3. **No `as any`**: Use `as unknown as T` instead.
4. **Client model**: The Client model uses field `name` (NOT `companyName`).
5. **MaterialityAllocation.materialityId** references `MaterialityCalculation`, NOT `MaterialitySet`.
6. **Audit trail**: `logAuditTrail(userId, action, entityType, entityId?, beforeValue?, afterValue?, engagementId?)` — always call with `.catch(...)`, never blocking.
7. **Demo users**: `admin@auditwise.pk` / `teamlead@auditwise.pk` / `staff@auditwise.pk` — all use password `Test@123`
8. **Account lockout**: In-memory store — restart server to clear lockout if rate-limited during testing.
9. **Production build**: `import.meta.url` does NOT work in production CJS bundle — use `process.cwd()` for file paths instead.
10. **Template vault**: Template files live in `server/template-vault/` and are copied into Docker image at `/app/server/template-vault/`.

### Current Feature Status
- ISA 320 Materiality: Complete (10-step guided workflow, partner override, memo generation)
- ISA 520 Analytical Procedures: Complete
- Compliance Checklists: Complete (bulk Excel/CSV upload, template download, evidence attachments)
- Data Intake: Complete (TB, GL, AR, AP, Bank import with reconciliation)
- Planning Module: 16 ISA-linked tabs (A-P)
- Execution Module: Working paper system with FS head mapping
- Review Notes: Complete with notifications
- Document Management: Complete with S3/local storage
- Multi-tenant: Firm-based isolation with RLS

### What I Need You To Do
You are my development environment. Your responsibilities:
1. **Develop features** — Write code, test locally on Replit, fix bugs
2. **Push to GitHub** — Commit and push all changes to the main branch
3. **Deploy to VPS** — SSH into the VPS and run the deploy script to make changes live
4. **Monitor** — Check Docker container health, read logs, fix production issues
5. **Maintain** — Keep `replit.md` updated with architectural changes

Always push to GitHub AND deploy to VPS after completing work. The app should be live after every task.
