# Objective
Build a secure multi-tenant governance layer on top of the existing AuditWise application. Implement SuperAdmin (platform-wide), FirmAdmin (firm-scoped), and firm user roles with strict RBAC, tenant isolation, subscription guards, JWT+refresh auth, audit logging, and AI usage tracking. Separate API routes into /platform (SuperAdmin) and /tenant (firm-scoped). Prevent cross-tenant access at query level.

The existing app uses Express + React + Prisma + PostgreSQL. We will extend (not replace) the existing architecture.

# Tasks

### T001: Extend Prisma Schema with Multi-Tenant Models
- **Blocked By**: []
- **Details**:
  - Add new models to `prisma/schema.prisma`:
    - `Plan` (id, code [BASIC/PRO/ENTERPRISE], name, maxUsers, maxEngagements, allowCustomAi, featureFlags jsonb)
    - `Subscription` (id, firmId, planId, status [TRIAL/ACTIVE/PAST_DUE/SUSPENDED/CANCELED], trialStart, trialEnd, currentPeriodStart, currentPeriodEnd)
    - `Invoice` (id, subscriptionId, amount, currency, status [DRAFT/ISSUED/PAID/VOID/OVERDUE], issuedAt, paidAt)
    - `FirmSettings` (id, firmId unique, aiOverrideEnabled, aiApiKeyEncrypted, aiProvider, tokenLimitMonthly, customAiAllowed, uiBranding jsonb, logoUrl)
    - `PlatformNotification` (id, firmId nullable, scope [GLOBAL/FIRM/ENGAGEMENT], engagementId nullable, type [POPUP/BANNER/EMAIL], title, message, startAt, endAt, priority, createdBy)
    - `PlatformAuditLog` (id, firmId nullable, userId, action, entity, entityId, ip, userAgent, meta jsonb, createdAt)
    - `AIUsageRecord` (id, firmId, userId, engagementId nullable, model, tokensIn, tokensOut, costEstimate, provider, createdAt)
    - `RefreshToken` (id, userId, token, expiresAt, createdAt, revokedAt nullable)
  - Update `Firm` model: add status enum (TRIAL/ACTIVE/SUSPENDED/TERMINATED), suspendedAt, terminatedAt, createdById
  - Update `User` model: add status enum (ACTIVE/SUSPENDED/DELETED) to replace isActive boolean, update role enum to add SUPER_ADMIN and FIRM_ADMIN
  - Add relations between new models
  - Files: `prisma/schema.prisma`
  - Acceptance: Schema pushes successfully, no errors

### T002: JWT + Refresh Token Authentication System
- **Blocked By**: [T001]
- **Details**:
  - Replace session-based auth with JWT + refresh tokens in `server/auth.ts`
  - Create `server/middleware/jwtAuth.ts`:
    - Generate JWT with userId, role, firmId, email (15min expiry)
    - Generate refresh tokens (7-day expiry, stored in DB)
    - `POST /api/auth/refresh` endpoint to rotate refresh tokens
  - Update login flow to return JWT + refresh token
  - Update `authMiddleware` to validate JWT instead of session token
  - Keep backward compatibility with existing `requireAuth`, `requireRoles`, `requireMinRole`
  - Files: `server/auth.ts`, `server/authRoutes.ts`, `server/middleware/jwtAuth.ts`
  - Acceptance: Login returns JWT + refresh token, all existing endpoints still work

### T003: Tenant Isolation & Subscription Guard Middleware
- **Blocked By**: [T001]
- **Details**:
  - Create `server/middleware/tenantIsolation.ts`:
    - Extract firmId from JWT
    - Enforce firmId filter on all tenant-scoped queries
    - SuperAdmin bypasses tenant filter but must explicitly specify firmId when needed
  - Create `server/middleware/subscriptionGuard.ts`:
    - Check firm status (TRIAL/ACTIVE allowed, SUSPENDED/TERMINATED blocked with 403)
    - Check subscription status
    - Allow read-only for PAST_DUE, block writes
  - Create `server/middleware/rbacGuard.ts`:
    - Role hierarchy enforcement
    - Platform vs tenant route guards
    - SuperAdmin-only guard for /platform routes
    - FirmAdmin+ guard for /tenant admin routes
  - Files: `server/middleware/tenantIsolation.ts`, `server/middleware/subscriptionGuard.ts`, `server/middleware/rbacGuard.ts`
  - Acceptance: Cross-tenant access blocked, suspended firms get 403, role checks work

### T004: Platform API Routes (SuperAdmin)
- **Blocked By**: [T002, T003]
- **Details**:
  - Create `server/routes/platformRoutes.ts` mounted at `/api/platform`:
    - `GET/POST /firms` - List/Create firms
    - `GET/PATCH /firms/:id` - Get/Update firm details
    - `POST /firms/:id/suspend` - Suspend firm
    - `POST /firms/:id/activate` - Activate firm
    - `POST /firms/:id/terminate` - Terminate firm
    - `GET/POST /plans` - CRUD subscription plans
    - `GET/PATCH /subscriptions` - Manage subscriptions
    - `POST /firms/:id/trial` - Assign/extend trial
    - `GET/POST /notifications` - Global/firm notifications
    - `GET /audit-logs` - View all audit logs (filterable by firmId, userId, action, date range)
    - `GET/POST /ai-config` - Default AI API key management
    - `GET /analytics` - Platform analytics (firm count, revenue, AI usage)
    - `POST /firms/:id/reset-admin` - Reset firm admin credentials
  - All routes protected by SuperAdmin-only guard
  - Files: `server/routes/platformRoutes.ts`
  - Acceptance: All CRUD operations work, only SuperAdmin can access

### T005: Tenant API Routes (Firm-Scoped)
- **Blocked By**: [T002, T003]
- **Details**:
  - Create `server/routes/tenantRoutes.ts` mounted at `/api/tenant`:
    - `GET/POST /users` - List/create users within firm (FirmAdmin only)
    - `PATCH /users/:id` - Update user (FirmAdmin only)
    - `POST /users/:id/suspend` - Suspend user (FirmAdmin only)
    - `POST /users/:id/activate` - Activate user (FirmAdmin only)
    - `GET/PATCH /settings` - Firm settings (FirmAdmin only)
    - `POST /settings/ai-key` - Set firm AI API key override (encrypted)
    - `GET /audit-logs` - Firm-scoped audit logs
    - `GET /ai-usage` - Firm AI usage stats
    - `GET /subscription` - Current subscription details
  - All routes enforce tenant isolation (firmId from JWT)
  - Files: `server/routes/tenantRoutes.ts`
  - Acceptance: FirmAdmin can manage their firm, cross-tenant access blocked

### T006: Audit Logging Service
- **Blocked By**: [T001]
- **Details**:
  - Create `server/services/auditLogService.ts`:
    - `logPlatformAction(userId, firmId, action, entity, entityId, ip, userAgent, meta)` - logs to PlatformAuditLog
    - Middleware that auto-logs all POST/PATCH/DELETE requests
  - Update AI service to log usage to AIUsageRecord table
  - Files: `server/services/auditLogService.ts`
  - Acceptance: All write actions logged, AI usage tracked per firm/user

### T007: SuperAdmin Dashboard Frontend
- **Blocked By**: [T004]
- **Details**:
  - Create `client/src/pages/platform/` directory with:
    - `platform-dashboard.tsx` - Overview with KPIs (total firms, active/trial/suspended, revenue, AI usage)
    - `firm-management.tsx` - Firms table with create/edit/suspend/terminate actions
    - `plan-management.tsx` - Plans CRUD
    - `platform-notifications.tsx` - Global/firm notification management
    - `platform-audit-logs.tsx` - Searchable audit log viewer
    - `platform-ai-config.tsx` - Default AI key config
  - Add `/platform/*` routes to App.tsx with SuperAdmin guard
  - Create platform layout with sidebar navigation
  - Files: `client/src/pages/platform/*.tsx`, `client/src/App.tsx`
  - Acceptance: SuperAdmin can access all platform features, non-super users get redirected

### T008: Firm Admin Panel Frontend
- **Blocked By**: [T005]
- **Details**:
  - Create `client/src/pages/firm-admin/` directory with:
    - `firm-users.tsx` - User management (create/edit/suspend/activate)
    - `firm-settings.tsx` - Firm settings + AI key override
    - `firm-ai-usage.tsx` - AI usage analytics
    - `firm-audit-logs.tsx` - Firm-scoped audit logs
  - Add `/firm-admin/*` routes to App.tsx with FirmAdmin guard
  - Files: `client/src/pages/firm-admin/*.tsx`, `client/src/App.tsx`
  - Acceptance: FirmAdmin can manage their firm's users and settings

### T009: Update Frontend Auth for JWT + Role-Based Navigation
- **Blocked By**: [T002, T007, T008]
- **Details**:
  - Update `client/src/lib/auth.tsx` to handle JWT + refresh token flow
  - Update `client/src/lib/fetchWithAuth.ts` to auto-refresh expired JWT
  - Update navigation to show platform/firm-admin links based on role
  - Update login page to route SuperAdmin to /platform, FirmAdmin to /firm-admin
  - Files: `client/src/lib/auth.tsx`, `client/src/lib/fetchWithAuth.ts`, `client/src/App.tsx`
  - Acceptance: Auth flow works with JWT, correct navigation per role

### T010: Seed SuperAdmin & Demo Data
- **Blocked By**: [T001, T002]
- **Details**:
  - Create `server/seeds/seedSuperAdmin.ts` - seeds SuperAdmin user (no firmId)
  - Create `server/seeds/seedPlans.ts` - seeds default plans (Basic, Pro, Enterprise)
  - Update startup to run these seeds
  - Ensure existing demo data still works with new schema
  - Files: `server/seeds/seedSuperAdmin.ts`, `server/seeds/seedPlans.ts`, `server/index.ts`
  - Acceptance: SuperAdmin can log in, plans exist, existing functionality intact

### T011: Integration Testing & Verification
- **Blocked By**: [T004, T005, T006, T007, T008, T009, T010]
- **Details**:
  - Verify SuperAdmin login and platform dashboard
  - Verify FirmAdmin user management
  - Verify tenant isolation (cross-firm access blocked)
  - Verify subscription guards work
  - Verify audit logging
  - Verify existing audit workflow still functions
  - Take screenshots to confirm UI
  - Update replit.md with new architecture documentation
  - Files: `replit.md`
  - Acceptance: All features working, no regressions