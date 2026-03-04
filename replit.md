# AuditWise - Statutory Audit Management Software

## Overview
AuditWise is a comprehensive full-stack statutory audit management platform designed to streamline the statutory audit process for firms. It aims to enhance efficiency, ensure compliance with regulatory standards (ISA 230, ISQM 1), and provide robust audit trail capabilities. The platform supports managing engagements, clients, risk assessments, and compliance through a phase-driven workflow, integrating AI-assisted functionalities with human oversight. It offers both a web application and a VS Code extension, focusing on high-level features for a complete audit lifecycle. The project's ambition is to provide a complete audit lifecycle management tool, improving audit quality and firm-wide consistency across the entire audit lifecycle.

## User Preferences
Not specified.

## System Architecture

### Core Platform
AuditWise employs a modern full-stack architecture. The frontend uses React 18, Vite, TailwindCSS, Radix UI, and React Query. The backend uses Express.js in TypeScript with PostgreSQL and Prisma ORM for data management. Session-based authentication is handled via Passport.js.

Key architectural patterns and features include:
- **Audit Enforcement Engine**: Global backend service ensuring compliance (ISA 230/ISQM-1) through phase sequencing, gate checks, and immutable audit logging.
- **Central Data Hub**: Manages critical audit data with versioning, integrity, and access control.
- **Administration Module**: Centralized control for RBAC, maker-checker settings, engagement flags, and functional document templates.
- **Data Ingestion & Analysis**: Modules for General Ledger upload and Trial Balance management with AI-assisted analysis, validation, and reconciliation.
- **Financial Statement Builder Module**: AI-assisted mapping of approved Trial Balance to Financial Statement captions and materiality handling.
- **Materiality Engine Module (ISA 320/450)**: Configurable materiality calculation with an 8-step AI-driven analysis.
- **Integrated Audit Workspace**: Features a Global EngagementContext, auto-save, AI Assistance, phase gates, Evidence Vault, and cross-phase data linking.
- **AI Audit Health Dashboard**: Comprehensive ISA/ISQM-1 compliance monitoring with weighted scoring.
- **Always-On AI Audit Co-Pilot**: Continuous, context-aware AI assistant providing analysis and suggestions.
- **Sign-Off Authority Matrix**: Role-based enforcement with locking and audit trail.
- **Reporting Module**: Provides 6 comprehensive reports.
- **Field Orchestration Engine**: Manages required fields with blueprints, auto-population, and RBAC enforcement.
- **Outputs Engine**: Central registry for all generated deliverables.
- **Observation Board (ISA 450)**: System for tracking audit findings.
- **Impact/Recompute Engine**: Tracks and manages the cascading impact of upstream data changes.
- **End-to-End Audit Linkage Engine**: Connects all audit artifacts, providing FS Head summaries, population management, sampling automation, and risk-procedure linking.
- **Complete Audit Workflow Hierarchy (ISA 315/330/530)**: Full end-to-end audit linkage from FS Line Item to Samples/Analytics.
- **AI Risk Assessment Engine (ISA 315/240/330)**: Automated risk identification and assessment engine for the Planning phase.
- **ISA 300/330 Audit Strategy & Approach Engine**: Comprehensive 9-step AI-driven audit strategy determination system.
- **ISA 530 Audit Sampling Engine**: Comprehensive 9-step AI-driven audit sampling system implementing ISA 530 requirements.
- **ISA 330 Audit Program & Procedure Engine**: Comprehensive 8-step AI-driven audit program generation system.
- **Audit Chain Integrity & Compliance Agent**: Comprehensive ISA-compliant chain validation and auto-repair service.
- **Dynamic Link Monitor + Auto-Repair Engine**: Continuous linkage integrity system maintaining the canonical audit chain.
- **Master Configuration Dictionary**: Comprehensive ISA-compliant options for the entire audit system.
- **IFRS/Local GAAP Notes & Disclosures Generator**: Rule-based generator for Notes to Financial Statements per Pakistan requirements.
- **Notes to Accounts AI Generation System**: Multi-file reference document upload with AI-powered Notes to Financial Statements generation using GPT-4o.
- **Live User Guide**: Auto-generated comprehensive user guide with 37 documented modules, per-module screenshot previews with zoom dialog, and Issues/Gaps feedback system.
- **Hard Controls API**: Unified hard controls validation endpoint providing 7 gate-blocking validations.
- **Engagement Health Panel**: Collapsible dashboard component showing hard controls status.
- **Unified SignOffBar Component (Maker-Checker-Approver)**: Reusable component enforcing role-based sign-offs with audit trail.
- **Finalization Control Board**: User-wise dashboard in Finalization phase featuring deterministic risk scoring, AI-assisted narrative risk analysis with GPT-4o-mini, role-scoped views, ISA 450 unadjusted differences, and Standards Gate blocking for partner approval.
- **`useModuleReadOnly` Hook**: Manages read-only states for approved modules.
- **Audit Chain State Machine**: Canonical 9-phase audit chain enforcer with gate validation.
- **Link-Integrity Engine**: Scans for orphan records, mapping tie-out breaks, and data completeness issues.
- **Phase Engine**: Per-tab status tracking with versioned outputs and dependency detection.
- **Data Health Dashboard**: Cross-module integrity controls implementing 6 ISA-compliant checks.
- **Four Pillars Coverage**: All workspace pages consistently implement AI Assist, ISA/ISQM-1 Compliance, Audit Trail, and Sign-off/Maker-Checker.
- **AI Assist Controlled Workflow**: AIProposal model with strict Proposed→Reviewed→Approved→Applied lifecycle.
- **Simplified UI & Auto-Live Backend**: Outputs and recomputations now auto-trigger on save.
- **ISA Compliance Engine**: Full ISA/ISQM-1 compliance monitoring system with a comprehensive frontend dashboard.
- **Execution Phase Redesign (ISA 330/500/520/230)**: Redesigned to a sequential wizard workflow per FS Head with integrated AI assistance.
- **Stepper + Accordion Hybrid UI Pattern**: App-wide architectural pattern for ISA-aligned workflow navigation.
- **Compliance Export API**: REST endpoints for ISA coverage matrix, ISQM register, RBAC matrix, security checklist, and QCR readiness data (MANAGER+ role-gated).
- **Regulatory Compliance Checklists**: Backend persistence for Companies Act 2017, FBR, and SECP checklists with engagement-scoped CRUD and export.
- **Compliance Simulation Engine**: Read-only sandbox simulation covering ISA coverage gaps, engagement file review, ISQM stress test, security checks, and AI governance validation. Results dashboard at `/workspace/:engagementId/compliance-simulation`.

### AI Audit Utilities Module
- **AI Service Integration**: Uses Replit AI Integrations (OpenAI-compatible) with multi-provider failover.
- **Evidence Sufficiency Analysis**: ISA 500-compliant analysis of audit evidence adequacy.
- **Risk-Response Gap Detection**: ISA 330 linkage analysis identifying unaddressed risks.
- **Documentation Completeness Check**: ISA 230 compliance assessment.
- **Draft Memo Generation**: ISA-compliant memo generation.
- **AI Output Storage**: All AI outputs stored in `AIUsageLog` with metadata and disclaimer.
- **AI Rate Limiting**: 20 requests/minute per user on all AI endpoints.
- **AI Risk Assessment Persistence**: `POST /api/ai-risk-assessment/:engagementId/persist` saves AI-generated assertion-level risks to the `RiskAssessment` table. Maps assertion types, risk levels, fraud risk indicators, FS areas, and ISA 315 factors to Prisma enum values. Runs in a transaction with per-risk error handling.

### Unified Sign-Off Bar & Read-Only Locking
- **SignOffBar component**: Single horizontal bar with Draft→Prepared→Reviewed→Approved workflow, PKT timestamps, RBAC enforcement, and "Approved – Read Only" locked badge.
- **`useModuleReadOnly` hook**: Used by Planning, Execution, FS Heads, and Finalization pages to disable inputs when module is approved/locked.
- **Comprehensive audit trail**: Every sign-off transition logs `ipAddress`, `deviceInfo`, `beforeValue`, `afterValue` to AuditTrail.

### Finalization Control Board
- **Risk scoring engine**: Deterministic 0-100 score based on pending items, severity issues, missing evidence, unadjusted misstatements vs materiality.
- **Role-scoped views**: Associates see own items, Managers see team, Partners see executive summary.
- **Standards gate**: Blocks finalization approval if HIGH risk with unresolved issues, pending execution items, or missing evidence (ISA 500).

### Multi-Tenant SaaS Architecture (STRICT Isolation)
- **Strict Tenant Isolation**: SuperAdmin CANNOT access any firm's audit data. Platform admins are hard-blocked from all `/api/*` routes except `/api/platform/*`, `/api/auth/*`, `/api/health/*`, and `/api/logs/*` via global middleware in `server/index.ts`.
- **Postgres Row-Level Security (RLS)**: Enabled on 98+ tenant tables. Uses `set_config('app.firm_id', ...)` session variable. Even if application code has a bug, the database blocks cross-firm access. RLS enabled at startup via `server/scripts/enable-rls.ts`.
- **Tenant DB Context**: `server/middleware/tenantDbContext.ts` provides `withTenantContext(firmId, fn)` helper that wraps Prisma queries in a transaction with `SET LOCAL app.firm_id`.
- **`blockSuperAdmin` Middleware**: Exported from `server/middleware/tenantIsolation.ts`. SuperAdmin gets 403 on `enforceFirmScope`, `requireTenantScope`, and `blockSuperAdmin` calls.
- **RBAC Guards**: `requireFirmAdmin`, `requirePlatformOrFirmAdmin`, `requireMinRoleLevel` all reject SUPER_ADMIN to prevent platform admins from accessing tenant resources.
- **Invite-Based Onboarding**: SuperAdmin creates firm + sends invite link (48-hour expiry). Firm admin sets own password via `/invite/:token` page. SuperAdmin never sees tenant passwords.
  - Model: `FirmInvite` (id, firmId, email, role, token, expiresAt, acceptedAt, revokedAt, createdBy)
  - API: `POST /api/platform/firms/:id/invite-admin`, `GET/DELETE /api/platform/firms/:id/invites`, `GET /api/auth/invite/:token` (validate), `POST /api/auth/invite/:token/accept` (create account)
  - Frontend: `/invite/:token` public page (`client/src/pages/invite-accept.tsx`)
- **Role Hierarchy**: STAFF(1) → SENIOR(2) → TEAM_LEAD(3) → MANAGER(4) → PARTNER(5) → MANAGING_PARTNER(5) → EQCR(6) → ADMIN(7) → FIRM_ADMIN(8) → SUPER_ADMIN(99)
- **Subscription Plans**: STARTER (PKR 4,900/mo, 5 users, 1 office, 15 eng, 5GB), GROWTH (PKR 14,900/mo, 20 users, 3 offices, 75 eng, 25GB), PROFESSIONAL (PKR 34,900/mo, 60 users, 7 offices, 250 eng, 100GB), ENTERPRISE (PKR 79,900/mo, unlimited, 500GB, dedicated support)
- **Overage Pricing**: Per-plan overage rates for extra users/offices/engagements (stored in Plan model: userOveragePkr, officeOveragePkr, engagementPackSize, engagementPackPkr)
- **Default Currency**: PKR (Pakistani Rupee). Multi-currency supported: PKR, USD, GBP, EUR, AED, SAR, CAD, AUD, INR, BDT
- **Firm Status Guards**: ACTIVE/TRIAL allowed, SUSPENDED/TERMINATED blocked with 403. PAST_DUE/GRACE blocks writes only. DORMANT: only FIRM_ADMIN can log in, all writes blocked except `/api/auth/*`, `/api/tenant/subscription`, `/api/tenant/activate`, `/api/billing/*`. Non-FIRM_ADMIN users get 403 on login.
- **Subscription Guard Applied Globally**: `subscriptionGuard` middleware applied as global middleware in `server/routes.ts` `registerRoutes()` for ALL `/api/*` routes except `/api/auth`, `/api/platform`, `/api/health`, `/api/logs`, `/__healthz`. Uses `req.originalUrl` for path matching. Covers routes in both `routes.ts` and `index.ts` route mounts.
- **DORMANT Lifecycle**: Trial expires (unactivated) → `billingService.ts` transitions firm+subscription to DORMANT status (with `dormantAt` timestamp). FIRM_ADMIN activates via `POST /api/tenant/activate` → restores to ACTIVE. Platform dashboard shows dormant count.
- **Platform API** (`/api/platform/*`): SuperAdmin-only routes for firm CRUD, plan management, invoices, billing lifecycle, notifications, audit logs, AI config, analytics, invite management. Shows ONLY safe metadata (counts, plan info, status) — no tenant content.
- **Tenant API** (`/api/tenant/*`): Firm-scoped routes for user management, settings, AI key override, audit logs, AI usage
- **Billing Service** (`server/services/billingService.ts`): Monthly invoice generation with overage line items, subscription lifecycle enforcement (TRIAL→PAST_DUE→GRACE→SUSPENDED), scheduled invoice processing. Runs hourly via setInterval in server startup.
- **Middleware Stack**: `tenantIsolation.ts` (firm scope + SuperAdmin block), `tenantDbContext.ts` (RLS session var), `subscriptionGuard.ts` (status checks), `rbacGuard.ts` (role hierarchy + SuperAdmin block)
- **AI Key Encryption**: Firm AI API keys encrypted at rest using AES-256-GCM (`server/services/encryptionService.ts`)
- **Platform Audit Logging**: All write actions logged to `PlatformAuditLog` via `server/services/platformAuditService.ts`
- **AI Usage Tracking**: Per-firm/user token consumption tracked in `AIUsageRecord`
- **SuperAdmin Credentials**: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` env vars (default: superadmin@auditwise.pk / SuperAdmin@123)
- **Frontend Routes**: `/platform/*` (SuperAdmin dashboard, firms, plans, notifications, audit logs, AI config, firm feedback), `/firm-admin/*` (user management, settings, audit logs, AI usage), `/invite/:token` (public invite acceptance)
- **Firm Feedback System**: Database-backed (`FirmFeedback` Prisma model) issue/gap/feedback tracking with firm scoping. Firm users submit via Issues/Gaps tab in User Guide page. Priority levels: low/medium/high/critical. Status: open/in_review/acknowledged/resolved/fixed. SuperAdmin views all feedback at `/platform/feedback` with real-time 15s auto-refresh, firm-wise grouping, status/priority filters, and inline status updates. Backend: firm-scoped CRUD at `/api/guide-issues`, SuperAdmin endpoints at `/api/platform/feedback`, `/api/platform/feedback/by-firm`, `PATCH /api/platform/feedback/:id/status`. Files: `client/src/pages/platform/platform-feedback.tsx`, `client/src/pages/user-guide.tsx`.
- **Firm Logo System**: Upload via signup, Firm Admin settings, or SuperAdmin firm management. Uses `sharp` for image processing — auto-converts non-SVG to optimized PNG, resizes to max 600x200px canvas, rejects >300KB after optimization. Accepts SVG/PNG/JPG/JPEG/WEBP. Stored per-firm in `uploads/logos/`. Display: max-height 50px (sidebar), 80px (login/invite), width auto, object-fit contain. PDF: 130px width, proportional height. Backend routes: `POST /api/platform/firms/:id/logo` (SuperAdmin), `POST /api/admin/firm-logo` (FirmAdmin), `POST /api/admin/firm-logo/delete` (FirmAdmin). Processor: `server/utils/logoProcessor.ts`. PDF helper: `client/src/lib/pdf-logo.ts` (async, converts logo to base64 data URL for reliable html2pdf.js embedding). Server DOCX helper: `server/utils/docxLogo.ts` (reads logo PNG from disk for docx ImageRun). Client DOCX helper: `client/src/lib/docx-logo.ts` (fetches logo via URL, converts to Uint8Array for client-side docx ImageRun). Logo/name appears in ALL exports: Print View PDFs, Inspection Archive PDFs, EQCR Report PDFs, Report Viewer print + CSV, Information Request Letter DOCX, Bank/AR/AP/Legal/Tax Confirmation Letter DOCX, Independence Declaration DOCX, Consent Letter DOCX, User Guide PDF (cover page + footer), Notes to FS Excel export (firm name header row in Notes + Index sheets, firm-prefixed filename), Import Summary Excel export (firm name header row + firm-prefixed filename), Sampling Run CSV export (firm name preamble header + firm-prefixed filename), Trial Balance CSV export (firm name header + filename), General Ledger CSV export (firm name header + filename), ISA Compliance Matrix CSV (firm name header + filename), FS Population Drilldown CSV (firm name header + filename), Notes Disclosure TXT draft (firm name header + filename), Inspection Full Package JSON (firmName + firmLogoUrl metadata), Linkage Monitor Report JSON (firmName + firmLogoUrl metadata), TB-GL Reconciliation CSV (firm name header + filename, server-side), TB Mapping Excel export (firm name header rows + firm-prefixed filename), ISA 530 Sampling clipboard CSV (firm name preamble header), ISA 330 Audit Program clipboard CSV (firm name preamble header). All exports prefer `displayName` over `name` with "AuditWise" fallback.
- **Sidebar Navigation**: Role-aware - shows Platform Admin section for SUPER_ADMIN, Firm Administration section for FIRM_ADMIN. Displays firm logo alongside AuditWise branding if uploaded.
- **Role-Based Theme Engine**: Automatic color theming based on user role hierarchy. CSS custom properties (`--primary`, `--sidebar-primary`) override globally via `role-{color}` classes on `<html>`. RoleThemeProvider applies theme inside AuthProvider. Mapping: SUPER_ADMIN→Red, FIRM_ADMIN→Orange, PARTNER/EQCR/MANAGING_PARTNER→Purple, MANAGER/ADMIN→Blue, SENIOR/TEAM_LEAD→Teal, STAFF→Green, READ_ONLY/CLIENT→Gray. All `bg-primary`, `text-primary` automatically adapt. Files: `client/src/lib/role-theme.ts`, `client/src/components/role-theme-provider.tsx`, `client/src/index.css` (role theme CSS section)

### Security & Access Control
- **Password Policy**: Minimum 10 characters, uppercase letter, lowercase letter, number, special character required. Common password blocking, sequential character detection, repeated character prevention. Password strength scoring (weak/fair/strong/very_strong). Validated on signup, invite accept, password change, and user creation.
- **Input Sanitization**: Deep recursive XSS and SQL injection detection on all request bodies, query params, and URL params. Path traversal prevention. Password fields excluded from sanitization to preserve special characters. Blocks requests with detected injection patterns (returns 400).
- **Security Headers**: X-Content-Type-Options, X-Frame-Options (DENY), X-XSS-Protection, Referrer-Policy, Permissions-Policy (camera/microphone/geolocation/payment/usb disabled), X-DNS-Prefetch-Control, X-Download-Options, X-Permitted-Cross-Domain-Policies. HSTS and CSP in production.
- **Audit Log Service**: `server/services/auditLogService.ts` auto-logs all POST/PUT/PATCH/DELETE requests via `res.finish` event. Security events logged separately (failed logins, lockouts, injection attempts).
- **Account Lockout**: 5 failed login attempts locks account for 15 minutes. Combined email+IP lockout keys. Security events logged to PlatformAuditLog.
- **Rate Limiting Middleware**: Per-user/IP rate limiting for auth (30/15min), login (5/15min), AI (20/min), API (200/min), global (100/min).
- **Role-Based AI Access**: AI utility endpoints require SENIOR role minimum.
- **Enforcement Engine Enhancements**: Validates prerequisite phase completion, open review notes, and role requirements for approvals.
- **Engagement Versioning**: Version field on Engagement model incremented on post-approval edits.

### JWT + Refresh Token Authentication
- **JWT Access Tokens**: 15-minute expiry, signed with `JWT_SECRET` env var (auto-generated if not set). Contains `userId`, `email`, `role`, `firmId`.
- **Refresh Tokens**: 7-day expiry, stored in `RefreshToken` table, rotated on each use (old token revoked).
- **Token Refresh Endpoint**: `POST /api/auth/refresh` accepts `{ refreshToken }`, returns new access + refresh token pair.
- **Backward Compatibility**: Auth middleware (`jwtAuthMiddleware` in `server/middleware/jwtAuth.ts`) tries JWT verification first, then falls back to session token lookup for legacy compatibility.
- **Auto-Refresh on Frontend**: `queryClient.ts` uses `fetchWithAutoRefresh()` that automatically refreshes expired JWT on 401 response. `auth.tsx` schedules proactive refresh 1 minute before expiry.
- **Logout**: Revokes all refresh tokens for the user via `revokeAllRefreshTokens()`.
- **Storage**: Access token in `localStorage` as `auditwise_token`, refresh token as `auditwise_refresh_token`.
- **Files**: `server/middleware/jwtAuth.ts`, `server/auth.ts` (re-exports), `server/authRoutes.ts` (login/refresh/logout), `client/src/lib/auth.tsx`, `client/src/lib/queryClient.ts`

### Standardized Auth Pattern
- **All API calls use `fetchWithAutoRefresh`**: Automatically adds Bearer token, retries with refreshed token on 401.
- **`apiRequest`**: Handles auth for mutations (POST/PATCH/DELETE via TanStack Query).
- **Default queryFn** in QueryClient uses `fetchWithAutoRefresh()` for TanStack Query default fetching.

### Performance Optimizations
- **Lazy Loading**: Most pages are lazy-loaded via React.lazy() with Suspense boundaries.
- **Response Compression**: Express compression middleware for API responses.
- **Database Indexing**: 35+ indexes added across schema for query optimization.
- **Connection Pooling**: Prisma configured for optimal database utilization.
- **Database Retry Resilience**: `withRetry()` wrapper for failed database operations.
- **Auto-Save System**: 10-second debounced silent auto-save across all workspace modules (Planning, Pre-Planning, Execution). Saves drafts automatically without toast notifications. Manual saves still show confirmation. Global save indicator shows real-time status (Saving/Unsaved/Saved). Uses signature-based change detection to avoid redundant saves. Save engine default auto-save enabled for all modules.
- **Batched DB Operations**: N+1 query patterns converted to batched operations.
- **Optimized Duplicate Detection**: GL duplicate detection uses accountCode-grouped comparison.
- **Phase Progress Caching**: In-memory cache for phase progress lookups.
- **Targeted Query Invalidation**: Frontend workspace context uses targeted query invalidation.
- **Retry Dynamic Imports**: Lazy-loaded pages wrapped with `retryImport()` for chunk failure resilience.
- **Composite Database Indexes**: Added composite indexes for query optimization.
- **API Cache Headers**: GET API responses include `Cache-Control` for browser-level caching.
- **Static Asset Caching**: Production static files served with 1-year immutable cache headers.
- **Async File I/O**: All synchronous file operations replaced with async equivalents.
- **QueryClient Optimization**: `staleTime=Infinity`, `refetchOnWindowFocus=false` prevents unnecessary re-fetches.

### Deployment & Production Readiness
- **Production Seeding**: `server/index.ts` conditionally seeds for production and development.
- **Initial Admin**: `server/seeds/seedInitialAdmin.ts` requires `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars in production.
- **Multi-Platform Guide**: In-app deployment guide at `/deployment-guide` with tabbed interface covering 9 platforms.
- **`Dockerfile`**: Multi-stage build with `docker-entrypoint.sh` that runs `prisma db push` on startup.
- **`DEPLOYMENT-GUIDE.md`**: Markdown AWS deployment reference.
- **Live User Guide**: At `/user-guide`, auto-generated from `user-guide-registry.ts`.
- **Build Process**: `npm run build` → `dist/index.cjs` (backend) + `dist/public/` (frontend).
- **Production Environment**: `NODE_ENV=production` for optimized runtime. Required env vars: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FIRM_NAME`.
- **Env Templates**: `.env.example` has all vars documented. `.env.production` is a minimal template.

### Settings Page (All Tabs Functional)
- **Profile**: Saves full name via `PATCH /api/auth/me`.
- **Notifications**: Saves to localStorage.
- **Preferences**: Saves language/dateFormat/timezone to localStorage.
- **AI Configuration** (Admin only): Full CRUD via `/api/ai/settings`, test via `/api/ai/test-connection`.
- **Security**: Password change via `POST /api/auth/change-password`.
- **Backup** (Admin only): Download full firm backup as JSON via `GET /api/admin/backup/download`; restore from backup file via `POST /api/admin/backup/restore` (multipart upload, validates AuditWise format, merges without duplicates).

### AI Configuration
- **Admin Settings**: Allows configuration of OpenAI/Gemini/DeepSeek API keys and provider priority.
- **Environment Variable Fallback**: `aiService.ts` checks database-stored key, then `OPENAI_API_KEY`, then `AI_INTEGRATIONS_OPENAI_API_KEY`.

### Standard Audit Templates (68 ISA/ISQM Templates)
- Auto-seeded on startup via `server/seeds/seedTemplates.ts` (idempotent, skips existing)
- Categories: Pre-Engagement, Requisition, Planning, Execution, Working Papers BS, Working Papers PL, Finalization, Reporting, Quality Review, ISQM, Documentation
- Each template includes ISA/IFRS references, applicable audit phases, and required/optional status
- Managed in Administration > Templates tab with full CRUD

### Production Deployment
- **Docker**: Multi-stage Dockerfile with non-root user, `docker-entrypoint.sh` (auto-migrate + start)
- **AWS ECS/Fargate**: `aws/task-definition.json` (1 vCPU, 4GB) + `aws/deploy.sh` for automated deployment with task definition registration
- **Required Env Vars**: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FIRM_NAME`
- **Recommended Env Vars**: `CORS_ORIGINS` (comma-separated allowed origins for production CORS)
- **Optional Env Vars**: `OPENAI_API_KEY`, `NODE_HEAP_SIZE` (default 2560MB)
- **Seeding**: Production runs `seedPermissions()` + `seedInitialAdmin()` + `seedTemplates()` only (no demo data)
- **Startup Validation**: Production crashes immediately if `DATABASE_URL` or `SESSION_SECRET` missing
- **Security**: Non-root Docker user, CORS origin allowlist in production, 500 errors sanitized, unhandled rejections cause exit

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **Prisma ORM**: Object-Relational Mapper for database interaction.
- **Passport.js**: Authentication middleware.
- **OpenAI API**: For AI-powered functionalities (e.g., GPT-5.1, GPT-4o for mapping, classification, risk assessment, procedure generation, notes generation, and compliance checks).