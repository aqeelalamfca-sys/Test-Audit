# AuditWise — Statutory Audit Management Platform

## Project Overview

AuditWise is a full-stack TypeScript web application built for Pakistani audit firms. It provides ISA 200-720 full coverage, ISQM-1 quality controls, and deep local regulatory integration.

## UI/UX Design System

The application uses a clean, modern SaaS design with consistent patterns:
- **Page container**: `page-container` class (`px-5 py-5 space-y-6 max-w-[1400px] mx-auto w-full`), some pages use tighter `px-5 py-3 space-y-3` inline
- **Page headers**: `<h1 className="text-xl font-semibold tracking-tight">` — no icon-in-box patterns
- **Filter bars**: `filter-bar` class for search/filter rows
- **Cards**: `shadow-sm` standard, using `Card`/`CardContent` from shadcn
- **KPI grids**: `kpi-grid` class for metric card layouts
- **Tables**: Simplified to essential columns (e.g., clients 8 cols from 18, engagements 8 from 25)
- **Sticky header**: PageShell has `sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b`
- **Sidebar**: Compact header/footer (h-8 avatar, text-sm)
- **CSS file**: `client/src/index.css` contains all utility classes

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

## User Notification System

Real-time per-user notifications for review note events:
- **Database**: `UserNotification` model (userId, type, title, message, referenceId, referenceType, isRead, createdAt)
- **Backend**: `server/routes/userNotificationRoutes.ts` — mounted at `/api/notifications`
  - `GET /api/notifications` — list user's notifications with unread count
  - `PATCH /api/notifications/:id/read` — mark single notification as read
  - `PATCH /api/notifications/mark-all-read` — mark all as read
- **Notification triggers** (in `server/routes/reviewNoteRoutes.ts`):
  - `REVIEW_NOTE_ASSIGNED` — when a review note is created with assignees
  - `REVIEW_NOTE_STATUS` — when note status changes (addressed/cleared/reopened)
  - `REVIEW_NOTE_REPLY` — when a new message is posted on a note thread
- **Frontend**: Dynamic notification dropdown in `client/src/components/top-bar.tsx`
  - Polls every 30s, shows unread badge count
  - Clicking a review note notification navigates to `/review-notes`
  - "Mark all read" button, per-notification read indicators
- **Helper**: `createNotifications(userIds, data)` exported from userNotificationRoutes for reuse

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

## AI Opinion Engine (Finalization)

The AI Opinion Engine is a sub-tab in the Finalization phase between "Going Concern" and "Reports" tabs.
- **Database**: `OpinionEngine`, `OpinionFinding`, `OpinionAiRun` models with enums (`OpinionEngineStatus`, `OpinionCategory`, `FindingRiskLevel`, `ReviewerDecision`, `DataReliability`)
- **Backend**: `server/opinionEngineRoutes.ts` — registered at `/api/opinion-engine`
- **Frontend**: `client/src/components/finalization/ai-opinion-engine.tsx` — integrated via `finalization.tsx`
- **5 Sub-tabs**: Dashboard (overall score + AI recommendation + partner decision), Data Sources (6 ISA-mapped data feeds), Findings (AI-generated with reviewer workflow), Scores (section breakdown), Partner (sign-off + lock)
- **Analysis Engine**: Scans misstatements (ISA 450), going concern (ISA 570), significant risks (ISA 315/330), control deficiencies (ISA 265), subsequent events (ISA 560) — generates findings, scores, and opinion recommendation
- **Security**: Lock immutability enforced, finding ownership validated via engine ID, partner-sign/lock restricted to PARTNER role via `requireMinRole`, idempotent analysis runs (deletes previous findings in transaction)
- **Advisory Only**: Mandatory banner stating AI is advisory — final opinion requires partner professional judgment

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

## Data Intake Module

The Data Intake module provides a centralized, linked workflow for importing, validating, reconciling, and mapping financial data:

### Backend Services & Routes
- **`server/services/dataIntakeStatusService.ts`**: Centralized status service computing live status for all sub-modules (Import, TB, GL, AR, AP, Bank, Confirmations, FS Mapping, Draft FS). Returns completion %, exception counts, reconciliation gate statuses, and completion blockers.
- **`server/dataIntakeRoutes.ts`**: API routes for `/api/engagements/:id/data-intake/status` (GET) and `/api/engagements/:id/data-intake/reconcile` (POST)
- **`server/services/reconIssuesEngine.ts`**: Full reconciliation scan engine (TB balance, GL balance, TB↔GL tie-out, AP/AR/Bank control account reconciliation). Persists issues to `ReconIssue` table with blocking flags.
- **`server/coaRoutes.ts`**: Includes `POST /api/engagements/:id/coa/auto-map-prior` (maps accounts using prior engagement data for the same client, writes to both CoAAccount and MappingAllocation), `GET /api/engagements/:id/coa/mapping-stats` (mapped/unmapped counts and amounts)
- **`server/fsDraftRoutes.ts`**: Includes `GET /api/fs-draft/:id/validate` (integrity checks: mapping coverage, TB↔GL reconciliation, BS footing, retained earnings linkage, blocking exceptions)

### Frontend Components
- **`client/src/components/data-intake-progress-ribbon.tsx`**: Top ribbon showing per-module status with record counts, quality score, exception counts, and labeled reconciliation gate icons. Added to information-requisition, import-wizard, tb-review, and review-mapping pages.
- **`client/src/components/data-intake-checks-panel.tsx`**: Overall readiness summary card (readiness %, gates passed, open/blocking issues), plus three collapsible sections: Reconciliation Gates (9 gates with pass/fail), Draft FS Integrity Checks (6 validation checks with blocking indicators), Open Exceptions table (filterable, resolvable). Includes "Run Full Scan" button.
- **`client/src/pages/information-requisition/DataTabSection.tsx`**: Enhanced with empty states showing contextual guidance and "Go to Upload" navigation for each data type (TB, GL, AP, AR, Bank). Summary metrics use vertical layout with uppercase labels.
- **`client/src/pages/information-requisition/ReviewCoaSection.tsx`**: Sub-tab navigation enhanced with icons per tab (Upload, TB, GL, AP, AR, Bank, Confirmations, FS Mapping, Draft FS, Checks), horizontal scroll on narrow screens, and improved styling.
- **FsMappingSection**: "Prior Year" button calls auto-map-prior to apply mappings from prior engagements

### Validation Workbook Export
- **`server/services/validationWorkbookService.ts`**: Generates `AuditWise_Data_Validation_Workbook.xlsx` with 5 sheets: Control_Summary, TB_Validation, GL_vs_TB_Validation, Subledger_Validation, Exceptions_Report. Queries ImportAccountBalance (OB/CB), ImportJournalLine (GL), ImportPartyBalance (AR/AP), ImportBankAccount/ImportBankBalance. Uses net movement comparison `(CB_net - OB_net) vs (GL_DR - GL_CR)` for accurate TB↔GL tie-out.
- **API**: `GET /api/import/:engagementId/validation-workbook` in `importRoutes.ts`
- **Frontend**: "Validation Workbook" button in SummaryTab next to "Export Output.xlsx", visible when `hasSummary` is true

### Auto-Reconciliation
- After data import, `triggerPostImportReconciliation()` in `importRoutes.ts` automatically runs the full reconciliation scan, updating gate statuses and generating exception records.

## Compliance Checklists

Regulatory compliance checklists per engagement (`/compliance-checklists/:engagementId`):

- **Backend**: `server/routes/regulatoryComplianceRoutes.ts` mounted at `/api/compliance/checklists`
- **Frontend**: `client/src/pages/compliance-checklists.tsx`
- **Checklist types**: Companies Act 2017, FBR Tax, FBR WHT, FBR NTN, SECP, SECP XBRL, ISA Documentation, ISQM Quality Control, Custom
- **Features**:
  - **Bulk Excel/CSV upload**: Column auto-detection (law/regulation, section/rule, applicability, requirement, status, evidence, remarks). Empty rows filtered. Status auto-mapped (Compliant→COMPLETED, Non-Compliant→IN_PROGRESS, etc.)
  - **Template download**: Per-type Excel template with styled header + instructions sheet. Uses ExcelJS
  - **Evidence attachments**: Per-row file upload (PDF, images, Word, Excel, CSV, text — max 15MB). Files stored in `uploads/checklist-evidence/`. Inline display with download/delete. Stored as JSON array `evidenceAttachments` in each checklist item
  - **Role guards**: All mutating endpoints require `SENIOR` role minimum
  - **Auth**: File uploads use `fetchWithAuth` for proper auth token handling (token key: `auditwise_token`)
- **Data model**: `ComplianceChecklist` with `items` JSON array, unique per `(engagementId, checklistType)`
- **APIs**: GET list, POST upsert, GET template/:type, POST bulk-upload, POST evidence-upload/:type/:ref, DELETE evidence/:type/:ref/:id, GET evidence-download/:type/:ref/:id, GET export

## Planning Module (ISA-Linked A-P Tabs)

The Planning module (`/planning/:engagementId`) is restructured into 16 ISA-linked tabs (A-P):

### Tab Structure
- **A**: Planning Dashboard — readiness overview, intake status, risk signals, next actions
- **B**: Financial Statements — FS review and analysis
- **C**: Entity Controls — entity understanding sections
- **D**: Analytical Procedures (ISA 520) — full analytics dashboard with horizontal/vertical/ratio/reasonableness analysis, fluctuation flags, risk linkage, editable narration, export. Backend: `server/planningAnalyticsRoutes.ts`, Frontend: `client/src/components/planning/analytical-procedures-panel.tsx`, Types: `shared/models/planningAnalyticsTypes.ts`. Auto-loads saved analytics on page load, shows read-only when planning locked. CR accounts sign-normalized.
- **E**: Materiality — ISA 320 guided 10-step materiality workflow. Backend: `server/isa320MaterialityRoutes.ts` (mounted at `/api/isa320-materiality`), Frontend: `client/src/components/planning/isa320-materiality-panel.tsx`. Features: auto-pull source data from TB/GL/FS, smart benchmark recommendation engine, qualitative factor assessment, specific materiality, partner override with audit trail + revert, strict status transitions (DRAFT→PENDING_REVIEW→PENDING_APPROVAL→APPROVED→LOCKED), ISA 320 memo generation/print, push-downstream to risk/sampling, stale-status detection. Firm-ownership verified on all endpoints. `MaterialitySet` model extended with JSON fields: sourceDataSnapshot, qualitativeFactors, riskAdjustments, overrideHistory, documentationMemo, pmPercentage, trivialPercentage, benchmarkJustification, stepProgress, isStale/staleReason
- **F**: Significant Accounts — auto-identified from TB/FS data
- **G**: Risk Assessment — ISA 315 risk identification
- **H**: Fraud Risk — ISA 240 fraud risk assessment with brainstorming
- **I**: Internal Controls — process understanding and walkthroughs
- **J**: Related Parties — ISA 550 related party identification
- **K**: Laws & Regulations — ISA 250 compliance planning
- **L**: Going Concern — ISA 570 assessment with auto-computed indicators
- **M**: Team Planning — budget, timelines, team allocation
- **N**: Strategy & Approach — ISA 300 audit strategy
- **O**: Audit Program — program generation
- **P**: Planning Memo — final approval and sign-off

### Backend API
- **Route prefix**: `/api/planning-dashboard`
- **File**: `server/planningDashboardRoutes.ts`
- **Endpoints** (all GET, all require auth + firmId verification):
  - `/:engagementId/readiness` — intake status, risk signals, completion gates
  - `/:engagementId/significant-accounts` — auto-identified from TB balances
  - `/:engagementId/analytical-review` — TB trend analysis with change %
  - `/:engagementId/fraud-indicators` — ISA 240 fraud risks
  - `/:engagementId/control-cycles` — control cycle groupings from TB
  - `/:engagementId/going-concern-indicators` — financial ratio indicators
  - `/:engagementId/planning-completion` — section completion status

### Frontend Components
- `client/src/components/planning/planning-dashboard.tsx` — Tab A dashboard
- `client/src/components/planning/planning-progress-ribbon.tsx` — top-of-page status bar
- `client/src/components/planning/significant-accounts-panel.tsx` — Tab F
- `client/src/components/planning/fraud-risk-panel.tsx` — Tab H
- `client/src/components/planning/internal-controls-panel.tsx` — Tab I
- `client/src/components/planning/laws-regulations-panel.tsx` — Tab K
- `client/src/components/planning/going-concern-panel.tsx` — Tab L
- `client/src/components/planning/team-planning-panel.tsx` — Tab M
- `client/src/components/planning/planning-memo-panel.tsx` — Tab P

### Data Flow
- New tab components use `extendedPlanningData` state for persistence
- `handleExtendedFieldChange(field, value)` writes to extended data and signals save bridge
- On load, unknown keys from persisted data are hydrated into `extendedPlanningData`
- Dashboard/Ribbon components fetch live data from planning-dashboard API endpoints

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

### Critical Project Rules

- **Prisma generate** times out on Replit due to 13k+ line schema — use `npx prisma db push --skip-generate` instead
- **Never change primary key ID column types** in the database
- **logAuditTrail** in `server/auth.ts` uses raw Prisma — never call it inside `withTenantContext` transactions
- Demo users all use password `Test@123`. SuperAdmin: `aqeelalam2010@gmail.com`
- **SSH deploy key**: The key file at `/tmp/vps_deploy_key` is the correctly formatted key. Use `cp /tmp/vps_deploy_key /tmp/deploy_key && chmod 600 /tmp/deploy_key` before SSH commands
- **GitHub push**: `git push "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/aqeelalamfca-sys/Test-Audit.git" main`
- **VPS deploy**: Write key to `/tmp/deploy_key`, chmod 600, then `ssh -i /tmp/deploy_key -o StrictHostKeyChecking=no root@187.77.130.117`

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

## Execution Module — Enhanced Working Paper Engine

The Execution module's FS Heads wizard has been upgraded into a fully linked, ISA-based working paper engine:

### Key Services
- **`server/services/fsHeadExecutionService.ts`** — Centralized aggregation service that pulls Data Intake (TB balances, sub-line items) + Planning (risks, assertions, audit programs, materiality) data per FS head. Returns enriched `ExecutionContext` with materiality, linked risks, assertion matrix, audit program, planning flags, team assignment, completion %, procedure/evidence/issue/review summaries.
- **`server/services/fsHeadEnforcement.ts`** — ISA enforcement rules per FS head template
- **`server/services/fsHeadProcedureTemplates.ts`** — Procedure templates with ISA references

### Wizard Steps (fs-heads.tsx)
1. **Context** — Lead schedule with variance %, materiality comparison vs PM, planning flags (fraud/significant/going concern/ISA 540), weighted completion checklist (6 gates), linked risks
2. **Assertions** — Assertion coverage matrix with visual per-assertion cards (risk count + procedure count), ROMM column, fraud/significant flags, linked audit program list
3. **Procedures** — Planning audit program inheritance display, enhanced TOC/TOD/Analytics with linked risk info. TOC forms: control ref, type, frequency, owner, description, result dropdown. TOD forms: population count/value, sample size, exceptions found, conclusion. Analytics forms: CY/PY values, conclusion. Delete confirmations on all procedure types.
4. **Evidence** — Drag-and-drop upload zone, colored file type badges (PDF=red, XLS=green, DOC=blue, IMG=purple), download endpoint with file streaming, delete confirmation, ISA 500 sufficiency assessment, AI evidence analysis
5. **Conclusions** — Auto-filled work summary with procedure outcomes, completion progress bar, ISA compliance checklist, AI conclusion drafting, structured conclusion form dialog, working notes
6. **Review** — Review point cards with resolve/respond functionality (response text + status update), return-for-rework button (PREPARED→IN_PROGRESS, REVIEWED→PREPARED), weighted completion gates (ISA references per gate), sign-off workflow (DRAFT→PREPARED→REVIEWED→APPROVED), approved state display

### Execution Dashboard (execution.tsx)
- Metrics ribbon: Total Procedures, Open Procedures, Review Points, Evidence Files, High Risk Pending, ISA Compliance %
- Search/filter bar: text search + status filter (All/Not Started/In Progress/Approved) + risk filter (All/High/Medium/Low)
- FS Head cards: fraud/significant badges, evidence count, open review points
- FS Heads navigator sidebar: search/filter input for quick FS head finding
- Rule-based completion: context(10%) + assertions(15%) + procedures(30%) + evidence(20%) + conclusion(15%) + review(10%)

### API Endpoints
- `GET /api/engagements/:id/fs-heads/:key/execution-context` — Enhanced execution context with full cross-phase data
- `GET /api/engagements/:id/execution-compliance-summary` — Aggregate metrics across all FS heads
- `GET /api/engagements/:id/execution-summary` — High-level execution summary
- `PATCH /api/engagements/:id/fs-heads/:key/review-points/:rpId` — Resolve/respond to review points (Zod-validated, ownership-scoped)
- `GET /api/engagements/:id/fs-heads/:key/attachments/:attId/download` — File download with streaming
- `POST /api/engagements/:id/fs-heads/:key/attachments` — Evidence file upload (multer)
- `DELETE /api/engagements/:id/fs-heads/:key/attachments/:attId` — Evidence deletion

### Production Infrastructure

- VPS: Hostinger (187.77.130.117), Ubuntu 24.04, 8 CPU, 32GB RAM
- Docker: 5 containers (backend, frontend, nginx, db, redis)
- SSL: Let's Encrypt for auditwise.tech
- Domain: https://auditwise.tech (live and verified)
- CI/CD: GitHub Actions (.github/workflows/deploy.yml) auto-deploys on push to main
- GitHub repo: aqeelalamfca-sys/Test-Audit (branch: main)

### Phase Locking

- **Firm Settings → Locking Phases tab** (`/firm-admin/settings`, tab `locking-phases`): Firm Admin toggle for `phaseLockingEnabled` (default: `true`)
- `FirmSettings.phaseLockingEnabled` (Prisma) controls whether workspace phase gating is enforced
- **Public endpoint**: `GET /api/tenant/settings/public` — returns `{ phaseLockingEnabled }` for all authenticated users (not admin-gated)
- **Admin endpoint**: `PATCH /api/tenant/settings` with `{ phaseLockingEnabled: boolean }` — admin-only write
- `workspace-ribbon.tsx` reads the public endpoint; when `phaseLockingEnabled === false`, `isPhaseGated()` returns `false` for all phases
- "Data Intake" (requisition) tab is always accessible regardless of locking status

### Known Schema Mapping Notes

- **TrialBalanceLine** uses `fsArea` (enum: REVENUE, FIXED_ASSETS, RECEIVABLES, etc.) — NOT fsCategory. The `debits` and `credits` fields hold movements (NOT debitMovement/creditMovement). No `fsLineItem` field exists — use CoA mapping or accountName instead.
- **TBReconciliation** uses `isResolved` (boolean, not `status`), `varianceAmount` (not `difference`), and `tbEntry` relation (not `tbItem`).
- **TBValidationError** uses `isResolved` and `isBlocking` (not `resolved`/`severity`), `batch` relation (not `tbBatch`), `entry` relation (not `tbItem`).
- **GLValidationError** uses `isResolved` (not `resolved`), `entry` relation for GLEntry.
- **ImportBatch** uses `processedRows` and `errorCount` (not `validRows`/`errorRows`).
- **TBEntry** has `movementDebit`, `movementCredit`, `closingDebit`, `closingCredit` — not simple `debit`/`credit`.
- `fsAreaToCategory()` helper maps FSArea enum values to high-level categories (ASSETS, LIABILITIES, EQUITY, INCOME, EXPENSES) for planning dashboard analytics.

## Template Vault (Task 7)

- **Backend**: `server/templateVaultRoutes.ts` — mounted at `/api/template-vault`
  - `GET /catalog` — returns 76 classified templates with search/filter support
  - `GET /download/:templateId` — streams files with path traversal protection
  - `GET /stats` — category/phase/fileType breakdown
- **Template files**: `server/template-vault/working-papers/` (57 files) and `server/template-vault/isqm/` (19 files)
- **Categories**: WORKING_PAPER (BS.01-BS.28, PL.01-PL.08, AE.01-AE.04), PLANNING (PR.00-PR.06), REPORTING (RP.07-RP.FS), CONFIRMATION (CF.BK-CF.AR), ISQM, ISQM_REFERENCE, OTHER
- **Frontend**: Template Library tab in `evidence-vault.tsx` — grouped by sub-category, searchable, filterable, one-click download

## Post-Merge Setup

Script: `scripts/post-merge.sh` (configured in `.replit` [postMerge] section, timeout 300s)
Runs automatically after task agent merges: `npm install`, `prisma db push --skip-generate` (no `--accept-data-loss`), `prisma generate` (with 120s timeout, non-fatal on timeout).

## Data Intake Module (Task Merge Notes)

- AP reconciliation sign: `drcr === 'CR' ? -balance : balance` (CR negative, DR positive)
- Bank balance seed stores `Math.abs(bookBalance)` with separate `drcr` flag
- `syncImportDataToCore` called after import POST `/post` to sync TB/GL data
- ConfirmationPopulation auto-created for DEBTORS/CREDITORS/BANK during seed and import posting
