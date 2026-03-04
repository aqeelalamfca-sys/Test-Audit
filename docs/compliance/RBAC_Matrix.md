# RBAC Matrix — AuditWise

> Role-Based Access Control matrix showing permissions across all system objects and actions.

## Role Hierarchy

| Level | Role | Description |
|---|---|---|
| 1 | STAFF | Junior audit staff, data entry |
| 2 | SENIOR | Senior auditor, team supervision |
| 3 | TEAM_LEAD | Team lead, execution oversight |
| 4 | MANAGER | Engagement manager, review authority |
| 5 | MANAGING_PARTNER | Managing partner |
| 6 | PARTNER | Engagement partner, approval authority |
| 7 | EQCR | Engagement quality control reviewer |
| 8 | ADMIN | Firm administrator |
| 9 | FIRM_ADMIN | Firm-level administrator |
| 99 | SUPER_ADMIN | Platform administrator (no firm data access) |

## Permissions Matrix

### Engagement Management

| Action | STAFF | SENIOR | TEAM_LEAD | MANAGER | PARTNER | EQCR | FIRM_ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|---|---|---|
| View engagements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create engagement | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit engagement | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete engagement | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Lock/Archive | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

### Sign-Off Authority

| Action | STAFF | SENIOR | TEAM_LEAD | MANAGER | PARTNER | EQCR |
|---|---|---|---|---|---|---|
| Prepare (sign-off) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Review (sign-off) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Approve (sign-off) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| EQCR Review | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Working Papers & Evidence

| Action | STAFF | SENIOR | TEAM_LEAD | MANAGER | PARTNER | EQCR |
|---|---|---|---|---|---|---|
| Create working paper | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit working paper | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Upload evidence | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete evidence | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| View locked docs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit locked docs | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### AI Features

| Action | STAFF | SENIOR | TEAM_LEAD | MANAGER | PARTNER | EQCR |
|---|---|---|---|---|---|---|
| Use AI field assist | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| AI risk assessment | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| AI audit utilities | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| AI copilot access | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI config (firm) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Administration

| Action | STAFF | SENIOR | TEAM_LEAD | MANAGER | PARTNER | EQCR | FIRM_ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|---|---|---|
| Manage users | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅* |
| Manage firm settings | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View audit logs | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage subscriptions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Platform config | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*SUPER_ADMIN can manage user activation/deactivation but CANNOT view firm engagement data

## Enforcement Points

| Layer | Mechanism | File |
|---|---|---|
| API Middleware | JWT + Role level check | server/middleware/rbacGuard.ts |
| Tenant Isolation | firmId scoping | server/middleware/tenantIsolation.ts |
| Super Admin Block | blockSuperAdmin middleware | server/middleware/tenantIsolation.ts |
| Sign-Off Authority | Role-level validation | server/services/signOffAuthority.ts |
| Phase Gates | Prerequisite validation | server/services/enforcementEngine.ts |
| Document Lock | Post-approval edit block | server/middleware/auditLock.ts |
| AI Governance | Prohibited action enforcement | server/services/aiGovernance.ts |
| Database RLS | PostgreSQL row-level security | server/scripts/enable-rls.ts |
