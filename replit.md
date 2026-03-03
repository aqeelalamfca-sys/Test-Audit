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
- **Live User Guide**: Auto-generated comprehensive user guide with 30+ documented modules covering all platform features.
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

### AI Audit Utilities Module
- **AI Service Integration**: Uses Replit AI Integrations (OpenAI-compatible) with multi-provider failover.
- **Evidence Sufficiency Analysis**: ISA 500-compliant analysis of audit evidence adequacy.
- **Risk-Response Gap Detection**: ISA 330 linkage analysis identifying unaddressed risks.
- **Documentation Completeness Check**: ISA 230 compliance assessment.
- **Draft Memo Generation**: ISA-compliant memo generation.
- **AI Output Storage**: All AI outputs stored in `AIUsageLog` with metadata and disclaimer.
- **AI Rate Limiting**: 20 requests/minute per user on all AI endpoints.

### Unified Sign-Off Bar & Read-Only Locking
- **SignOffBar component**: Single horizontal bar with Draft→Prepared→Reviewed→Approved workflow, PKT timestamps, RBAC enforcement, and "Approved – Read Only" locked badge.
- **`useModuleReadOnly` hook**: Used by Planning, Execution, FS Heads, and Finalization pages to disable inputs when module is approved/locked.
- **Comprehensive audit trail**: Every sign-off transition logs `ipAddress`, `deviceInfo`, `beforeValue`, `afterValue` to AuditTrail.

### Finalization Control Board
- **Risk scoring engine**: Deterministic 0-100 score based on pending items, severity issues, missing evidence, unadjusted misstatements vs materiality.
- **Role-scoped views**: Associates see own items, Managers see team, Partners see executive summary.
- **Standards gate**: Blocks finalization approval if HIGH risk with unresolved issues, pending execution items, or missing evidence (ISA 500).

### Multi-Tenant SaaS Architecture
- **Tenant Isolation**: All tenant-scoped queries enforce `firmId` from authenticated user. SuperAdmin bypasses but must specify firmId explicitly.
- **Role Hierarchy**: STAFF(1) → SENIOR(2) → TEAM_LEAD(3) → MANAGER(5) → PARTNER(6) → MANAGING_PARTNER(7) → ADMIN(7) → FIRM_ADMIN(8) → SUPER_ADMIN(99)
- **New Roles**: `SUPER_ADMIN` (platform-wide, no firmId), `FIRM_ADMIN` (firm-scoped admin)
- **Subscription Plans**: BASIC ($49/mo, 5 users, 10 engagements), PRO ($199/mo, 25 users, 100 engagements), ENTERPRISE ($499/mo, 999 users, 9999 engagements)
- **Firm Status Guards**: ACTIVE/TRIAL allowed, SUSPENDED/TERMINATED blocked with 403. PAST_DUE blocks writes only.
- **Platform API** (`/api/platform/*`): SuperAdmin-only routes for firm CRUD, plan management, global notifications, audit logs, AI config, analytics
- **Tenant API** (`/api/tenant/*`): Firm-scoped routes for user management, settings, AI key override, audit logs, AI usage
- **Middleware Stack**: `tenantIsolation.ts` (firm scope), `subscriptionGuard.ts` (status checks), `rbacGuard.ts` (role hierarchy)
- **AI Key Encryption**: Firm AI API keys encrypted at rest using AES-256-GCM (`server/services/encryptionService.ts`)
- **Platform Audit Logging**: All write actions logged to `PlatformAuditLog` via `server/services/platformAuditService.ts`
- **AI Usage Tracking**: Per-firm/user token consumption tracked in `AIUsageRecord`
- **SuperAdmin Credentials**: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` env vars (default: superadmin@auditwise.pk / SuperAdmin@123)
- **Frontend Routes**: `/platform/*` (SuperAdmin dashboard, firms, plans, notifications, audit logs, AI config), `/firm-admin/*` (user management, settings, audit logs, AI usage)
- **Sidebar Navigation**: Role-aware - shows Platform Admin section for SUPER_ADMIN, Firm Administration section for FIRM_ADMIN

### Security & Access Control
- **Rate Limiting Middleware**: Per-user/IP rate limiting for auth, AI, and general API endpoints.
- **Role-Based AI Access**: AI utility endpoints require SENIOR role minimum.
- **Enforcement Engine Enhancements**: Validates prerequisite phase completion, open review notes, and role requirements for approvals.
- **Engagement Versioning**: Version field on Engagement model incremented on post-approval edits.

### Standardized Auth Pattern
- **All API calls use `fetchWithAuth`**: Automatically adds Bearer token, active client/period headers, credentials, and timeout.
- **`apiRequest`**: Handles auth for mutations (POST/PATCH/DELETE via TanStack Query).
- **Default queryFn** in QueryClient uses `getAuthHeaders()` for TanStack Query default fetching.

### Performance Optimizations
- **Lazy Loading**: Most pages are lazy-loaded via React.lazy() with Suspense boundaries.
- **Response Compression**: Express compression middleware for API responses.
- **Database Indexing**: 35+ indexes added across schema for query optimization.
- **Connection Pooling**: Prisma configured for optimal database utilization.
- **Database Retry Resilience**: `withRetry()` wrapper for failed database operations.
- **Auto-Save System**: 3-second debounced auto-save for changes as drafts.
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