# Security Checklist — AuditWise

> Comprehensive security controls inventory with implementation status.

## Authentication & Session Management

| # | Control | Status | Implementation | File |
|---|---------|--------|---------------|------|
| 1 | JWT-based authentication | ✅ Active | Access tokens (15min) + refresh tokens (7d) | server/middleware/jwtAuth.ts |
| 2 | Password policy enforcement | ✅ Active | Min 10 chars, mixed case, numbers, special chars, blacklist | server/utils/passwordPolicy.ts |
| 3 | Account lockout | ✅ Active | Temporary IP/account blocking after failed attempts | server/middleware/accountLockout.ts |
| 4 | Two-factor authentication (TOTP) | ✅ Active | TOTP via otplib, QR code setup | server/services/twoFactorService.ts |
| 5 | Refresh token rotation | ✅ Active | Tokens rotated on use, old tokens revoked | server/middleware/jwtAuth.ts |
| 6 | Session timeout | ✅ Active | 15-minute access token expiry, 7-day refresh | server/middleware/jwtAuth.ts |

## Authorization & Access Control

| # | Control | Status | Implementation | File |
|---|---------|--------|---------------|------|
| 7 | Role-based access control (RBAC) | ✅ Active | 10-level role hierarchy with middleware guards | server/middleware/rbacGuard.ts |
| 8 | Object-level permissions | ✅ Active | 61 granular permissions seeded | server/seeds/ |
| 9 | Tenant isolation middleware | ✅ Active | firmId scoping on all API routes | server/middleware/tenantIsolation.ts |
| 10 | Super Admin data isolation | ✅ Active | blockSuperAdmin prevents firm data access | server/middleware/tenantIsolation.ts |
| 11 | Database row-level security | ✅ Active | PostgreSQL RLS on 97 tables | server/scripts/enable-rls.ts |
| 12 | Sign-off authority enforcement | ✅ Active | Role-level validation for sign-offs | server/services/signOffAuthority.ts |
| 13 | Post-approval edit blocking | ✅ Active | Locked documents cannot be modified | server/middleware/auditLock.ts |

## API Protection

| # | Control | Status | Implementation | File |
|---|---------|--------|---------------|------|
| 14 | Global rate limiting | ✅ Active | 100 req/min per IP for all /api/ routes | server/middleware/rateLimiter.ts |
| 15 | Auth rate limiting | ✅ Active | 5 login attempts per 15 minutes | server/middleware/rateLimiter.ts |
| 16 | AI rate limiting | ✅ Active | 20 req/min for AI endpoints | server/middleware/rateLimiter.ts |
| 17 | Input sanitization | ✅ Active | SQL injection, XSS, path traversal detection | server/middleware/inputSanitizer.ts |
| 18 | Request body size limit | ✅ Active | 50MB JSON body limit | server/index.ts |
| 19 | CORS configuration | ✅ Active | Dynamic origin validation | server/index.ts |

## Security Headers

| # | Control | Status | Implementation | File |
|---|---------|--------|---------------|------|
| 20 | Content-Security-Policy | ✅ Active | CSP header configured | server/index.ts |
| 21 | Strict-Transport-Security | ✅ Active | HSTS enabled | server/index.ts |
| 22 | X-Content-Type-Options | ✅ Active | nosniff | server/index.ts |
| 23 | X-Frame-Options | ✅ Active | DENY | server/index.ts |
| 24 | X-XSS-Protection | ✅ Active | 1; mode=block | server/index.ts |

## Audit & Logging

| # | Control | Status | Implementation | File |
|---|---------|--------|---------------|------|
| 25 | API audit logging | ✅ Active | All POST/PUT/PATCH/DELETE logged | server/services/auditLogService.ts |
| 26 | Security event logging | ✅ Active | Login attempts, permission changes | server/services/auditLogService.ts |
| 27 | Entity-level change tracking | ✅ Active | Before/after values in audit trail | server/auth.ts |
| 28 | AI usage logging | ✅ Active | Prompts, outputs, edits, approvals | AIUsageLog, AIInteractionLog |
| 29 | Immutable audit trail | ✅ Active | Append-only PlatformAuditLog | Database + service layer |
| 30 | Request ID tracking | ✅ Active | X-Request-Id on all requests | server/index.ts |

## Data Protection

| # | Control | Status | Implementation | File |
|---|---------|--------|---------------|------|
| 31 | Password hashing | ✅ Active | bcryptjs with salt rounds | server/services/auth.ts |
| 32 | Sensitive field encryption | ✅ Active | AES-256 encryption service | server/services/encryptionService.ts |
| 33 | Environment secrets protection | ✅ Active | .env not committed, env vars for secrets | .gitignore |

## AI Governance Security

| # | Control | Status | Implementation | File |
|---|---------|--------|---------------|------|
| 34 | Prohibited AI actions | ✅ Active | Blocks conclusion, sign-off, opinion generation | server/services/aiGovernance.ts |
| 35 | AI output review requirement | ✅ Active | Human review tracked in AIUsageLog | server/services/aiGovernance.ts |
| 36 | Prohibited AI fields | ✅ Active | auditOpinion, materialityAmount, sampleSize blocked | Frontend + Backend |
| 37 | AI confidence indicators | ✅ Active | Low/Medium/High with ISA references | server/services/aiGovernance.ts |

## Summary
- **Total Controls**: 37
- **Active**: 37 (100%)
- **Critical Missing**: None
