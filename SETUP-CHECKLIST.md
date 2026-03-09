# AuditWise — Production Deployment Checklist

## VPS Details (Confirmed)
- **IP**: 187.77.130.117
- **Hostname**: srv1447906.hstgr.cloud
- **OS**: Ubuntu 24.04 LTS
- **User**: root
- **Specs**: 8 CPU, 32 GB RAM, 400 GB disk

## Step 1: Fix DNS Nameservers (CRITICAL)

Your domain `auditwise.tech` currently uses **parking nameservers** (`ns1.dns-parking.com`).
These will NOT route traffic to your VPS.

**In Hostinger Domain settings → DNS/Nameservers → Change Nameservers:**

Set to Hostinger's nameservers:
```
ns1.dns-hosting.info
ns2.dns-hosting.info
```

Then verify DNS records exist:
- A record `@` → `187.77.130.117`
- A record `www` → `187.77.130.117`
- (Optional) A record `app` → `187.77.130.117`

DNS propagation takes 5-30 minutes.

## Step 2: Set GitHub Actions Secrets

Go to: https://github.com/aqeelalamfca-sys/Test-Audit/settings/secrets/actions

Add these 4 repository secrets:

| Secret Name | Value |
|---|---|
| `VPS_HOST` | `187.77.130.117` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | *(private key of your `github-actions-deploy` keypair — see below)* |
| `VPS_PORT` | `22` |

### About VPS_SSH_KEY

Your VPS already has the **public key** for `github-actions-deploy` (ssh-ed25519).
You need the **private key** that matches it.

If you still have the private key file, paste its entire contents into the `VPS_SSH_KEY` secret.
It should look like:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vb... (many lines)
-----END OPENSSH PRIVATE KEY-----
```

If you lost the private key, generate a new keypair:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key -N ""
```
Then:
1. Copy `~/.ssh/github_deploy_key` contents → paste into GitHub secret `VPS_SSH_KEY`
2. Copy `~/.ssh/github_deploy_key.pub` contents → add to VPS SSH Keys in Hostinger panel

## Step 3: Push from Replit to GitHub

In the Replit Shell, run:
```bash
bash scripts/push-to-github.sh
```

This will push your code to GitHub using your Personal Access Token.
GitHub Actions will automatically trigger and deploy to your VPS.

## Step 4: Monitor Deployment

Watch the deployment at:
https://github.com/aqeelalamfca-sys/Test-Audit/actions

The pipeline will:
1. Build & verify the code
2. SSH into your VPS
3. Clone the repo (first time) or pull updates
4. Install Docker, Nginx, Certbot, firewall (first time)
5. Build and start containers (db, redis, backend)
6. Configure Nginx reverse proxy
7. Set up SSL certificate
8. Run health checks

## Step 5: Verify

After deployment completes:
```
https://auditwise.tech
```

Login with Super Admin:
- Email: aqeelalam2010@gmail.com
- Password: (shown in VPS `.env` file after first deploy)

## Ongoing Deployments

After initial setup, every `git push` to `main` automatically deploys:
1. Edit code in Replit
2. Run `bash scripts/push-to-github.sh` in Shell
3. GitHub Actions deploys automatically
4. Site updates at auditwise.tech within ~5 minutes
