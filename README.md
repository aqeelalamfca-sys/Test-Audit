# AuditWise - Comprehensive Audit Management System

AuditWise is a professional-grade audit management platform built for audit firms and accounting professionals, complying with International Standards on Quality Management (ISQM 1/2) and International Standards on Auditing (ISA).

## Features

### Core Capabilities
- **Client & Engagement Management** - Complete lifecycle management
- **Quality Management (ISQM 1/2)** - Firm-wide quality controls, monitoring, and remediation
- **Risk Assessment** - Automated risk scoring and assessment procedures
- **Audit Planning** - Materiality calculations, analytics, and planning tools
- **Execution** - Tests of controls, substantive testing, and evidence management
- **EQCR (Engagement Quality Control Review)** - Multi-level review process
- **Reporting & Finalization** - Report generation and sign-off
- **Evidence Vault** - Secure document storage and management

### Technical Features
- Modern React frontend with TypeScript
- Node.js/Express backend
- PostgreSQL database with Prisma ORM
- Role-based access control (RBAC)
- AI-powered features (optional OpenAI integration)
- Responsive design for desktop and mobile
- Docker support for easy deployment

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm or yarn

### Local Development

```bash
# Clone repository
git clone https://github.com/mbq11190/Auditwise.git
cd Auditwise

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
npx prisma db push

# Start development server
npm run dev
```

Visit `http://localhost:5173`

Default admin credentials:
- Email: `admin@auditwise.pk`
- Password: `admin123` (change immediately!)

## Production Deployment

### Option 1: Docker (Recommended)

```bash
# On your server
git clone https://github.com/mbq11190/Auditwise.git
cd Auditwise

# Configure environment
cp .env.production .env
nano .env  # Set secure values

# Deploy
./deploy.sh
```

### Option 2: Manual Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Option 3: GitHub Actions Auto-Deploy (Recommended for VPS)

This repository includes a production CI/CD pipeline for Hostinger VPS:

- Workflow: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- VPS deploy script: [deploy/vps-github-pull-deploy.sh](deploy/vps-github-pull-deploy.sh)
- One-time VPS bootstrap: [deploy/vps-bootstrap.sh](deploy/vps-bootstrap.sh)
- VPS compose stack: [docker-compose.vps.yml](docker-compose.vps.yml)
- Host Nginx configs: [deploy/nginx/host-auditwise.http.conf](deploy/nginx/host-auditwise.http.conf) and [deploy/nginx/host-auditwise.conf](deploy/nginx/host-auditwise.conf)

Deployment flow on each push to main:

1. GitHub Actions builds the app to validate release integrity.
2. Workflow SSHs into VPS using GitHub Secrets.
3. VPS script fetches latest code and hard-resets to origin/main.
4. Existing production .env is preserved (never overwritten).
5. Docker Compose rebuilds/restarts services.
6. Health check runs on /api/health.
7. On failure, script rolls back to previous commit and retries.

## CI/CD Setup (One-Time)

### 1. VPS Bootstrap Commands (run on VPS once)

```bash
sudo mkdir -p /opt/auditwise
sudo chown -R $USER:$USER /opt/auditwise

git clone https://github.com/aqeelalamfca-sys/Test-Audit.git /opt/auditwise
cd /opt/auditwise

chmod +x deploy/vps-bootstrap.sh deploy/vps-github-pull-deploy.sh

# HTTP-first bootstrap (works before domain/SSL is ready)
sudo APP_DIR=/opt/auditwise BRANCH=main bash deploy/vps-bootstrap.sh

# Edit production secrets
sudo nano /opt/auditwise/.env

# Start stack after .env is ready
sudo systemctl start auditwise
sudo systemctl status auditwise --no-pager
```

If domain is already pointed to the VPS, install SSL by re-running bootstrap with DOMAIN and EMAIL:

```bash
cd /opt/auditwise
sudo DOMAIN=yourdomain.com EMAIL=admin@yourdomain.com APP_DIR=/opt/auditwise BRANCH=main bash deploy/vps-bootstrap.sh
```

### 2. GitHub Secrets Required

Set these in GitHub repository settings:

- VPS_HOST: VPS public IP or DNS name.
- VPS_USER: SSH user (for example root or deploy user).
- VPS_SSH_KEY: Private key content used by GitHub Actions.

Optional (workflow defaults are already set):

- VPS_PORT: SSH port (default: 22).
- APP_DIR: Deployment directory (default: /opt/auditwise).

Notes:

- Never store passwords in workflow files.
- Keep .env only on VPS and do not commit production secrets.

### 3. SSH Key Setup (Recommended)

Generate key pair locally:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/auditwise_actions
```

Install public key on VPS:

```bash
ssh-copy-id -i ~/.ssh/auditwise_actions.pub user@your-vps-ip
```

Add private key to GitHub secret VPS_SSH_KEY:

```bash
cat ~/.ssh/auditwise_actions
```

## Local Development to Production Flow

```bash
# Local work in VS Code
git checkout -b feature/my-change
# edit files
git add .
git commit -m "feat: your change"
git push origin feature/my-change

# Create PR and merge to main
# OR push directly to main if your process allows it
```

When main is updated, [.github/workflows/deploy.yml](.github/workflows/deploy.yml) auto-runs deployment.

## Manual Deployment / Rollback

Manual deploy on VPS:

```bash
cd /opt/auditwise
APP_DIR=/opt/auditwise BRANCH=main COMPOSE_FILE=docker-compose.vps.yml bash deploy/vps-github-pull-deploy.sh
```

Manual rollback to previous commit:

```bash
cd /opt/auditwise
PREV_COMMIT=$(git rev-parse HEAD~1)
git reset --hard "$PREV_COMMIT"
docker compose -f docker-compose.vps.yml up -d --build --remove-orphans
curl -fsS http://127.0.0.1:5000/api/health
```

## Logs, Health, and Troubleshooting

Health checks:

```bash
curl -fsS http://127.0.0.1:5000/api/health
curl -I http://127.0.0.1/__healthz
```

Service and container status:

```bash
sudo systemctl status auditwise --no-pager
docker compose -f /opt/auditwise/docker-compose.vps.yml ps
```

Live logs:

```bash
docker compose -f /opt/auditwise/docker-compose.vps.yml logs -f backend
docker compose -f /opt/auditwise/docker-compose.vps.yml logs -f db
sudo journalctl -u auditwise -f
sudo tail -f /var/log/nginx/error.log
```

Re-run failed GitHub deploy:

- GitHub -> Actions -> Deploy To VPS -> Re-run jobs.
- Or trigger workflow_dispatch manually.

### Quick Deploy Commands

```bash
# Initial deployment
./deploy.sh

# Update production
./update-production.sh

# Backup data
./backup.sh

# Restore from backup
./restore.sh
```

## Configuration

### Required Environment Variables

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/auditwise
SESSION_SECRET=your_random_secret_key
```

### Optional Features

```env
# AI Features (OpenAI)
AI_INTEGRATIONS_OPENAI_API_KEY=sk-your-key-here

# GitHub Webhooks
WEBHOOK_SECRET=your_webhook_secret
```

## Security

- All passwords hashed with bcrypt
- Session-based authentication
- CSRF protection
- SQL injection prevention (Prisma)
- XSS protection
- HTTPS enforced in production
- Role-based access control

## Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- TanStack Query for data fetching
- Radix UI for components
- Tailwind CSS for styling

**Backend:**
- Node.js with Express
- Prisma ORM
- PostgreSQL database
- Express sessions
- Multer for file uploads

**Infrastructure:**
- Docker & Docker Compose
- Nginx reverse proxy
- Let's Encrypt SSL

## Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions
- [Production Checklist](./PRODUCTION-CHECKLIST.md) - Pre-deployment verification
- [API Documentation](./API.md) - API endpoints (if available)

## Project Structure

```
auditwise/
├── client/          # React frontend
│   ├── src/
│   │   ├── pages/   # Page components
│   │   ├── components/  # Reusable components
│   │   ├── lib/     # Utilities and helpers
│   │   └── hooks/   # Custom React hooks
├── server/          # Express backend
│   ├── routes/      # API routes
│   ├── auth.ts      # Authentication logic
│   └── index.ts     # Server entry point
├── prisma/          # Database schema and migrations
├── shared/          # Shared types and schemas
├── public/          # Static files
└── uploads/         # User-uploaded files
```

## Maintenance

### Database Backups

Automated daily backups (configured via cron):
```bash
0 2 * * * /opt/auditwise/backup.sh
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (Docker)
docker compose up -d --build

# Or for manual deployment
npm ci --only=production
npm run build
pm2 restart auditwise
```

### Monitoring

```bash
# View Docker logs
docker compose logs -f

# Check container status
docker compose ps

# Monitor resources
docker stats auditwise-app
```

## Support & Troubleshooting

### Common Issues

**Port Conflict:**
- Change PORT in .env to avoid conflicts
- macOS: Port 5000 used by AirPlay (use 3000 or 3001)

**Database Connection:**
- Verify DATABASE_URL format
- Check PostgreSQL is running
- Ensure database exists

**Build Errors:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist`

### Logs

```bash
# Application logs
docker compose logs -f app

# Database logs
docker compose logs -f postgres

# Nginx logs (if using)
sudo tail -f /var/log/nginx/auditwise-error.log
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - See LICENSE file for details

## Credits

Developed for audit professionals to streamline engagement management and ensure compliance with international auditing standards.

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Production Ready ✅
