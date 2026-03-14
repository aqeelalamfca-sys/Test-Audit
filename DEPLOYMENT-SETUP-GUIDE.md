# AuditWise — Complete Deployment Setup Guide
# VS Code → GitHub → Hostinger VPS

Generated: 2026-03-14

---

## OVERVIEW

This guide links three systems together so that every code change you push from
VS Code automatically builds and deploys to your live Hostinger VPS.

```
VS Code (local edit)
    ↓  git push origin main
GitHub (stores code + runs Actions)
    ↓  SSH into VPS
Hostinger VPS (runs Docker app — live)
```

---

## PHASE 1 — Generate SSH Key (Windows PC)

Open PowerShell and run:

```powershell
ssh-keygen -t ed25519 -C "github-actions-auditwise" -f "$HOME\.ssh\auditwise_actions" -N '""'
```

This creates two files:
- `C:\Users\HP\.ssh\auditwise_actions`      → PRIVATE key (goes to GitHub Secret)
- `C:\Users\HP\.ssh\auditwise_actions.pub`  → PUBLIC key  (goes to Hostinger VPS)

To view each file run:

```powershell
# View public key (copy this for Hostinger)
Get-Content "$HOME\.ssh\auditwise_actions.pub"

# View private key (copy this for GitHub Secret)
Get-Content "$HOME\.ssh\auditwise_actions"
```

---

## PHASE 2 — Add Public Key to Hostinger VPS

1. Log in to https://hpanel.hostinger.com
2. Go to VPS → click your server → SSH Access tab
3. Click "Add SSH Key"
4. Paste the full content of `auditwise_actions.pub`
5. Save

Alternatively, if you can already SSH in with a password:

```powershell
# From PowerShell — copy public key to VPS
$pubKey = Get-Content "$HOME\.ssh\auditwise_actions.pub"
ssh root@YOUR_VPS_IP "mkdir -p ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

---

## PHASE 3 — Add Secrets to GitHub

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret" for each of the following:

| Secret Name    | Value                                               |
|----------------|-----------------------------------------------------|
| VPS_HOST       | Your VPS IP address (hPanel → VPS → Details → IP) |
| VPS_USER       | root                                                |
| VPS_SSH_KEY    | Full private key content (see Phase 1 above)        |

REQUIRED secrets — the workflow will fail without all three.

OPTIONAL secrets (already have safe defaults in workflow):

| Secret Name | Default  | Override if needed  |
|-------------|----------|---------------------|
| VPS_PORT    | 22       | Set if non-standard |
| APP_DIR     | /opt/auditwise | Set if different path |

To get the private key content to paste:

```powershell
Get-Content "$HOME\.ssh\auditwise_actions"
```

Copy the ENTIRE output including:
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...
  -----END OPENSSH PRIVATE KEY-----

---

## PHASE 4 — One-Time VPS Bootstrap

### Step 4a — SSH into your VPS from PowerShell

```powershell
ssh -i "$HOME\.ssh\auditwise_actions" root@YOUR_VPS_IP
```

### Step 4b — Install prerequisites on VPS

Run these commands on the VPS:

```bash
apt update && apt install -y git curl docker.io docker-compose-plugin
systemctl enable docker
systemctl start docker
```

### Step 4c — Clone your repo onto VPS

```bash
mkdir -p /opt/auditwise
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git /opt/auditwise
cd /opt/auditwise
```

### Step 4d — Make scripts executable

```bash
chmod +x deploy/vps-bootstrap.sh
chmod +x deploy/vps-github-pull-deploy.sh
```

### Step 4e — Run the one-time bootstrap script

```bash
APP_DIR=/opt/auditwise BRANCH=main bash deploy/vps-bootstrap.sh
```

This script:
- Installs Nginx, Certbot, Docker dependencies
- Configures firewall (ufw)
- Installs systemd service for auto-start on reboot
- Sets up Nginx reverse proxy (HTTP, port 80 → Docker port 5000)
- Creates folder structure

### Step 4f — Create the production .env file

```bash
nano /opt/auditwise/.env
```

Paste and fill in these values:

```env
NODE_ENV=production
DATABASE_URL=postgresql://auditwise:YOURPASSWORD@auditwise-db:5432/auditwise
POSTGRES_PASSWORD=YOURPASSWORD
POSTGRES_USER=auditwise
POSTGRES_DB=auditwise
JWT_SECRET=replace-with-long-random-string-minimum-32-chars
ENCRYPTION_MASTER_KEY=replace-with-exactly-32-char-key
PORT=5000
```

Save: Ctrl+O then Enter, then Ctrl+X to exit nano.

### Step 4g — Start the application service

```bash
systemctl start auditwise
systemctl enable auditwise
systemctl status auditwise
```

### Step 4h — Verify app is running

```bash
curl -fsS http://127.0.0.1:5000/api/health
docker compose -f /opt/auditwise/docker-compose.vps.yml ps
```

---

## PHASE 5 — Connect VS Code to GitHub

### Step 5a — Verify git remote is set

In VS Code terminal (Ctrl+`) run:

```powershell
git remote -v
```

Should show:
```
origin  https://github.com/YOUR_USERNAME/YOUR_REPO.git (fetch)
origin  https://github.com/YOUR_USERNAME/YOUR_REPO.git (push)
```

If not set, run:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

### Step 5b — Sign into GitHub in VS Code

1. Click your account icon (bottom-left of VS Code)
2. Click "Sign in with GitHub"
3. Follow browser prompts to authorize VS Code

### Step 5c — Install GitHub Pull Requests extension (optional but useful)

1. Press Ctrl+Shift+X (Extensions panel)
2. Search: "GitHub Pull Requests"
3. Install the extension by GitHub

---

## PHASE 6 — Connect VS Code to VPS via Remote SSH

### Step 6a — Install Remote - SSH extension

1. Press Ctrl+Shift+X
2. Search: "Remote - SSH"
3. Install the extension by Microsoft

### Step 6b — Configure SSH host

1. Press Ctrl+Shift+P
2. Type: Remote-SSH: Open Configuration File
3. Select: C:\Users\HP\.ssh\config

Add this block at the end of the file:

```
Host auditwise-vps
    HostName YOUR_VPS_IP
    User root
    IdentityFile ~/.ssh/auditwise_actions
    ServerAliveInterval 60
```

Save the file.

### Step 6c — Connect to VPS

1. Press Ctrl+Shift+P
2. Type: Remote-SSH: Connect to Host
3. Select: auditwise-vps

VS Code will open a new window with direct access to your VPS filesystem.
You can browse, edit, and run commands directly on the VPS from VS Code.

---

## PHASE 7 — Trigger First Auto-Deploy

### Step 7a — Push code from VS Code

In your local VS Code terminal:

```powershell
git add .
git commit -m "ci: production deploy pipeline live"
git push origin main
```

Or use VS Code Source Control panel (Ctrl+Shift+G):
1. Stage all changes (+ icon)
2. Type commit message
3. Click Commit
4. Click Sync / Push

### Step 7b — Watch the deployment

1. Go to your GitHub repo in browser
2. Click the Actions tab
3. You will see "Deploy To VPS" workflow running
4. Two jobs appear:
   - Build Check — installs deps, builds app, validates dist/
   - Deploy To Hostinger VPS — SSHs in, pulls code, rebuilds Docker, health checks

Green checkmarks = your app is live and deployed.

---

## PHASE 8 — Enable SSL / HTTPS (Optional, after DNS is pointed)

### Step 8a — Point your domain to the VPS

In Hostinger hPanel → Domains → DNS Zone:
- Add A record:  @  →  YOUR_VPS_IP
- Add A record:  www  →  YOUR_VPS_IP
- Wait 5–15 minutes for DNS propagation

### Step 8b — Install SSL Certificate on VPS

SSH into VPS and run:

```bash
DOMAIN=yourdomain.com \
EMAIL=admin@yourdomain.com \
APP_DIR=/opt/auditwise \
BRANCH=main \
bash /opt/auditwise/deploy/vps-bootstrap.sh
```

Certbot will obtain a Let's Encrypt certificate and Nginx will switch to HTTPS automatically.

---

## PHASE 9 — Hostinger Docker Manager (Deploy by URL Paste)

Use this phase when you want Hostinger to deploy directly from a pasted URL.

Important:
- Do NOT paste your repository page URL.
- Paste a direct raw URL to a compose file.

Use this URL format:

https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/main/docker-compose.hostinger.yml

Steps:

1. Open Hostinger hPanel → VPS → Docker Manager → Compose.
2. In URL, paste the raw URL above.
3. Set Project name: auditwise.
4. Click Deploy.

If the repo is private, Hostinger cannot fetch the file by raw GitHub URL. Use one of these:
- Make repo public, or
- Use GitHub raw content from a public mirror, or
- Deploy by SSH flow (recommended production path already configured).

After first successful deploy, immediately replace default secrets in Docker Manager environment variables:
- POSTGRES_PASSWORD
- JWT_SECRET
- SESSION_SECRET
- ENCRYPTION_MASTER_KEY

Then redeploy from Docker Manager.

---

## HOW IT ALL WORKS — Full Flow

```
1. You write/edit code in VS Code
             ↓
2. You push: git push origin main
             ↓
3. GitHub Actions triggers "Deploy To VPS" workflow automatically
             ↓
4. GitHub runner (ubuntu-latest):
   - Checks out your code
   - Runs npm ci + prisma generate + npm run build
   - Validates dist/index.cjs and dist/public/index.html exist
             ↓
5. GitHub runner SSHs into your Hostinger VPS using VPS_SSH_KEY secret
             ↓
6. On VPS: vps-github-pull-deploy.sh runs:
   - Backs up database
   - git pull latest code
   - docker compose build + up
   - Health check polls /api/health for up to 240 seconds
   - On failure: auto-rollback to previous commit
             ↓
7. App is live at http://YOUR_VPS_IP:5000 (or https://yourdomain.com with SSL)
```

---

## QUICK REFERENCE — Important Files in This Repo

| File | Purpose |
|------|---------|
| .github/workflows/deploy.yml | GitHub Actions CI/CD pipeline |
| docker-compose.hostinger.yml | URL-paste compose for Hostinger Docker Manager |
| deploy/vps-bootstrap.sh | One-time VPS setup (run manually once) |
| deploy/vps-github-pull-deploy.sh | Server-side deploy script (run by Actions) |
| deploy/nginx/host-auditwise.conf | Nginx SSL configuration template |
| deploy/nginx/host-auditwise.http.conf | Nginx HTTP-only configuration template |
| docker/auditwise.service | systemd service definition |
| docker-compose.vps.yml | Production Docker stack (3 containers) |
| scripts/verify.ps1 | Windows health check script |
| scripts/diagnose.ps1 | Windows diagnostics script |

---

## QUICK REFERENCE — GitHub Secrets Summary

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| VPS_HOST | YES | none | VPS IP address |
| VPS_USER | YES | none | SSH username (root) |
| VPS_SSH_KEY | YES | none | SSH private key content |
| VPS_PORT | no | 22 | SSH port |
| APP_DIR | no | /opt/auditwise | App install path on VPS |

---

## QUICK REFERENCE — Useful Commands

### Local (PowerShell in VS Code)

```powershell
# Push and trigger auto-deploy
git push origin main

# Run Windows health check
npm run verify:windows

# Run Windows diagnostics
npm run diagnose:windows

# Run deployment preflight check
npm run deploy:preflight
```

### On VPS (via SSH or Remote-SSH terminal)

```bash
# Check service status
systemctl status auditwise

# View live logs
docker compose -f /opt/auditwise/docker-compose.vps.yml logs -f backend

# Restart app
systemctl restart auditwise

# Manual deploy (without GitHub Actions)
APP_DIR=/opt/auditwise BRANCH=main bash /opt/auditwise/deploy/vps-github-pull-deploy.sh

# Check health
curl http://127.0.0.1:5000/api/health

# Check all containers
docker compose -f /opt/auditwise/docker-compose.vps.yml ps
```

---

## CHECKLIST

### One-time setup
- [ ] Phase 1: SSH key generated on Windows
- [ ] Phase 2: Public key added to Hostinger VPS SSH Keys
- [ ] Phase 3: VPS_HOST, VPS_USER, VPS_SSH_KEY secrets added to GitHub
- [ ] Phase 4a: Can SSH into VPS from PowerShell
- [ ] Phase 4b: Docker installed on VPS
- [ ] Phase 4c: Repo cloned to /opt/auditwise on VPS
- [ ] Phase 4d: Scripts made executable on VPS
- [ ] Phase 4e: Bootstrap script run on VPS
- [ ] Phase 4f: .env file created and filled in on VPS
- [ ] Phase 4g: auditwise systemd service started and enabled
- [ ] Phase 4h: curl health check returns 200 on VPS
- [ ] Phase 5: VS Code signed into GitHub
- [ ] Phase 6: Remote-SSH extension installed, VPS host configured in ssh/config

### Every deploy (automatic after setup)
- [ ] Phase 7: git push origin main from VS Code
- [ ] Phase 7: GitHub Actions workflow goes green

### Optional
- [ ] Phase 8: Domain DNS A record pointed to VPS IP
- [ ] Phase 8: SSL certificate installed via bootstrap script
