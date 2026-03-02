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
