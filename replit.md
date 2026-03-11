# AuditWise — Statutory Audit Management Platform

## Project Overview

AuditWise is a full-stack TypeScript web application built for Pakistani audit firms. It provides ISA 200-720 full coverage, ISQM-1 quality controls, and deep local regulatory integration.

## Architecture

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js (TypeScript) serving both the API and Vite dev middleware in development
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: JWT + session-based (Passport.js)
- **Single server**: In development, Vite runs as middleware inside Express. Both frontend and backend share port 5000.

## Project Structure

```
/client         - React frontend (Vite root)
/server         - Express backend + Vite dev middleware
/shared         - Shared TypeScript types and schema
/prisma         - Prisma schema and seed files
/dist           - Production build output
/devops         - DevOps control scripts (Replit → GitHub → VPS)
/deploy         - VPS deployment scripts (hostinger-deploy, backup, etc.)
/docker         - Dockerfiles (backend, frontend, nginx)
/nginx          - Nginx configuration files
/.github        - GitHub Actions CI/CD workflows
```

## Key Configuration

- **Port**: 5000 (both frontend and backend in dev)
- **Host**: 0.0.0.0 (required for Replit proxy)
- **Vite**: Runs in middleware mode inside Express (`server/vite.ts`)
- **AllowedHosts**: Set to `true` in Vite server options for Replit proxy compatibility

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (set by Replit)
- `SESSION_SECRET` - Express session secret (auto-generated if not set)
- `JWT_SECRET` - JWT signing secret (auto-generated or from `.jwt_secret` file)
- `OPENAI_API_KEY` - For AI features (optional)
- `GITHUB_PERSONAL_ACCESS_TOKEN` - GitHub PAT for pushing code
- `VPS_SSH_KEY` - SSH private key for VPS deployment
- `VPS_HOST` - VPS IP address (187.77.130.117)
- `VPS_USER` - VPS user (root)
- `DOMAIN_NAME` - Production domain (auditwise.tech)

## Database

Uses Prisma with PostgreSQL. Schema is in `prisma/schema.prisma`.

To push schema changes: `npx prisma db push`
To generate client: `npx prisma generate`

The app seeds data on startup:
- SuperAdmin: aqeelalam2010@gmail.com
- Demo users: partner, eqcr, manager, senior, staff (all with password `Test@123`)

## Development

The workflow runs: `NODE_OPTIONS='--max-old-space-size=1024' NODE_ENV=development npx tsx server/index.ts`

## Deployment (Replit Autoscale)

- Target: Autoscale
- Build: `npm run build`
- Run: `node dist/index.cjs`

## Engagement Allocation

The Engagement Allocation page (`/engagement-allocation`) provides:
- **Status filtering**: Tabs for All / Active / Completed engagements with status badges
- **Inline editing**: Click Edit on any row to get per-role dropdowns (Partner, Manager, Senior, Staff, EQCR) with Save/Cancel per row
- **Allocation history trail**: Expand any row to see who changed team allocations, when, and what changed (before→after with staff names)
- **Backend validation**: Team update endpoint validates all userIds belong to the same firm
- **Audit trail**: Team changes are logged with enriched snapshots (role + userId + fullName) for readable history
- Files: `client/src/pages/engagement-allocation.tsx`, backend in `server/routes.ts`
- API: `GET /api/engagements/:id/team-history`, `PUT /api/engagements/:id/team`

## User Management & Role Matrix

The User Management page (`/firm-admin/users`) has two tabs:
- **Users Tab**: List, search, create, edit users with role assignment. Status dropdown (Active/Suspended/Blocked) for each non-admin user — changes save immediately.
- **Role Matrix Tab**: Editable permission grid — roles as columns (Staff, Senior, Manager, EQCR, Partner, Admin), permissions grouped by category as expandable rows. Checkboxes toggle permissions per role in real-time. FIRM_ADMIN always has all permissions (disabled checkboxes). "Save & Close" button at bottom right.
- **User Status**: `UserStatus` enum with ACTIVE, SUSPENDED, BLOCKED, DELETED. Backend endpoint `POST /api/tenant/users/:id/set-status`. Blocked/Suspended users cannot log in.
- APIs: `GET /api/rbac/permissions`, `GET /api/rbac/permissions/roles`, `PUT /api/admin/role-permissions`
- Files: `client/src/pages/firm-admin/firm-users.tsx`, `server/permissionRoutes.ts`, `server/adminRoutes.ts`, `server/routes/tenantRoutes.ts`

## Client Creation

Shared `CreateClientDialog` component used everywhere (client list, dashboard, engagement dialog):
- Required fields: Legal Name, NTN/CNIC, Focal Person (Name, Mobile, Email)
- Optional: Trade Name, SECP No., Incorporation Date, City, Address, Email, Phone, Country, Entity Type, Industry
- File: `client/src/components/create-client-dialog.tsx`

## Engagement Dialog

Enhanced engagement creation/edit dialog (`client/src/components/create-engagement-dialog.tsx`):
- Tax Period dropdown (auto-sets periodStart/periodEnd)
- Authorized Capital, Paid-up Capital (replaces single Share Capital)
- Revenue (Last Year), Revenue (Year Before Last)
- No. of Employees, Company Category dropdown (Pakistani categories)
- DB columns: `authorizedCapital`, `paidUpCapital`, `companyCategory` on Engagement model

## Audit Log PDF Export

The Audit Logs page (`/firm-admin/audit-logs`) has an "Export PDF" button that:
- Fetches ALL filtered logs (up to 5000 entries) regardless of current page
- Generates a formatted landscape A4 PDF with jspdf + jspdf-autotable
- Includes header with firm name, generation timestamp, active filters, and entry count
- Table columns: Timestamp, User, Role, Action, Entity, IP Address
- Footer shows page numbers and "AuditWise - ISA Compliant Audit Platform"
- File: `client/src/pages/firm-admin/firm-audit-logs.tsx`

## AI Integration

The AI Integration page (`/firm-admin/ai-usage`) provides multi-provider AI management:
- **Providers Tab**: Configure OpenAI, Anthropic Claude, Google Gemini, DeepSeek with encrypted API keys, enable/disable toggles, and connection testing
- **Configuration Tab**: Global AI settings (enable/disable AI, preferred provider, token limits, timeout, auto-suggestions, manual trigger mode)
- **Usage Analytics Tab**: Token usage stats, provider breakdown, recent AI activity log
- **AI Governance**: Audit trail logging, AI-assisted labeling, prohibited field protection, AES-256-GCM key encryption
- Backend routes: `GET/PUT /api/tenant/ai-settings`, `POST/DELETE /api/tenant/ai-settings/provider-key`, `POST /api/tenant/ai-settings/provider-toggle`, `POST /api/tenant/ai-settings/test-provider`
- Key decryption handled at runtime via `safeDecrypt()` in `aiService.ts` with plaintext fallback for legacy keys
- Files: `client/src/pages/firm-admin/firm-ai-usage.tsx`, `server/routes/tenantRoutes.ts`, `server/services/aiService.ts`

## Platform Admin Dashboard

The Platform Dashboard (`/platform/dashboard`) shows real-time VPS metrics via SSH:
- **Server Resources**: CPU, Memory, Disk usage from VPS (batched single SSH session)
- **Health Probes**: HTTP/API probes hit `https://auditwise.tech`, DB/Nginx probes run Docker commands on VPS
- **Services**: Docker container statuses normalized to active/inactive
- **Deploy Pipeline**: Git Pull → Install → Build → Migrate → Restart (runs on VPS via SSH)
- **Source Repository**: Git branch/commit/status from VPS `/opt/auditwise`
- SSH key resolution: checks `VPS_SSH_PRIVATE_KEY` env → `VPS_SSH_KEY` env → `~/.ssh/vps_key` file → `/tmp/replit_deploy_key` file
- Backend: `server/routes/systemHealthRoutes.ts`
- Frontend: `client/src/pages/platform/platform-dashboard.tsx`

## Legal Acceptance Feature

Signup captures legal acceptance with Terms of Service and Privacy Policy:
- **Signup page** (`client/src/pages/signup.tsx`): Required checkbox with clickable "Terms of Service" and "Privacy Policy" links that open PDF modals
- **PDF files**: `client/public/legal/terms-of-service.pdf` and `client/public/legal/privacy-policy.pdf` (version 1.0)
- **Database table**: `LegalAcceptance` stores firm_name, admin_name, email, mobile, IP address, timestamps, and document versions
- **Backend**: Legal acceptance record created inside the signup transaction (`server/authRoutes.ts`)
- **Super Admin dashboard**: `/platform/legal-acceptances` page with search, pagination, and detail view
- **API**: `GET /api/platform/legal-acceptances` and `GET /api/platform/legal-acceptances/:id` (super admin only)

## DevOps Control Center (devops/)

Replit serves as the central DevOps controller for the entire deployment pipeline:

```
Replit → GitHub → VPS (187.77.130.117) → Docker → auditwise.tech
```

### Secrets Required

| Secret | Controls |
|--------|----------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub pushes, code sync, CI/CD trigger |
| `VPS_SSH_KEY` | VPS access, Docker management, deployments, backups |
| `VPS_HOST` | VPS IP (187.77.130.117) |
| `VPS_USER` | VPS user (root) |

### Quick Commands

```bash
bash devops/setup-ssh.sh             # Setup SSH key from secret (run once per session)
bash devops/control.sh push          # Push code to GitHub
bash devops/control.sh deploy        # Full deploy (push + build + restart)
bash devops/control.sh deploy-quick  # Quick deploy (pull + restart backend)
bash devops/control.sh health        # Full system health check (13 checks)
bash devops/control.sh status        # Container status + resource usage
bash devops/control.sh logs backend  # View backend logs
bash devops/control.sh restart       # Restart all containers
bash devops/control.sh backup        # Database backup
bash devops/control.sh autopush      # Start auto-push daemon (2 min interval)
```

### Production Infrastructure

- VPS: Hostinger (187.77.130.117), Ubuntu 24.04, 8 CPU, 32GB RAM
- Docker: 5 containers (backend, frontend, nginx, db, redis)
- SSL: Let's Encrypt for auditwise.tech
- Domain: https://auditwise.tech (live and verified)
- CI/CD: GitHub Actions (.github/workflows/deploy.yml) auto-deploys on push to main
- GitHub repo: aqeelalamfca-sys/Test-Audit (branch: main)
