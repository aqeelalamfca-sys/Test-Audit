# Objective
Perform a full technical and compliance audit of the AuditWise system across all 10 modules, security, and DevOps. Implement only what's genuinely missing or incomplete without breaking existing architecture. Generate compliance coverage matrix and all required reports.

## Gap Analysis Summary
After scanning all 10 modules with deep code exploration, the following status was determined:

| # | Module | Status | Gap |
|---|--------|--------|-----|
| 1 | ISA 200–720 Mapping Engine | ✅ Fully Implemented | None — standards-config.ts, isaComplianceService.ts, isaPhaseComplianceService.ts, linkageEngineService.ts all present |
| 2 | ISQM-1 Firm-Wide Controls | ✅ Fully Implemented | None — quality objectives, risk registry, monitoring, deficiency tracking, annual evaluation, dashboard all present |
| 3 | Automated Risk Assessment | ✅ Fully Implemented | None — materiality calculator, risk scoring, risk-procedure auto-mapper, AI narrative drafting, heatmap all present |
| 4 | Engagement Lifecycle | ✅ Fully Implemented | None — 9-phase state machine, relaxed/strict gates, role-based transitions, database locking all present |
| 5 | Digital Sign-Off | ✅ Fully Implemented | None — preparer/reviewer/partner hierarchy, immutable audit trail, IP capture, partner PIN, section sign-offs all present |
| 6 | AI Working Paper Drafting | ✅ Fully Implemented | None — AI service layer, prompt templates, ISA tagging, usage logging, governance controls, human validation gates all present |
| 7 | Secure Multi-Tenant Postgres | ✅ Fully Implemented | None — RLS policies, tenant middleware, encryption service, foreign key integrity all present |
| 8 | Companies Act 2017 | ⚠️ Mostly Implemented | Director Report Checklist is placeholder-level; needs a proper dedicated compliance checklist component |
| 9 | FBR Documentation | ⚠️ Partially Implemented | Tax templates exist in disclosure registry but no standalone FBR Documentation page for tax computations, WHT reconciliation, and export |
| 10 | SECP Compliance Dashboard | ⚠️ Partially Implemented | Tracked within ISA dashboard; no standalone SECP dashboard with regulatory checklist, opinion tracking, and XBRL readiness |

**Security Gaps:**
- 2FA: Frontend OTP UI exists but no backend TOTP verification logic
- Backup: Referenced in docs but no actual automated backup script

# Tasks

### T001: SECP Compliance Dashboard Page
- **Blocked By**: []
- **Details**:
  - Create `client/src/pages/secp-compliance.tsx` — standalone SECP compliance dashboard
  - Sections: Regulatory checklist (Companies Act 2017 key sections), engagement compliance status, opinion type tracker, XBRL readiness indicators, compliance export summary
  - Pull data from existing ISA compliance routes and deliverables routes
  - Add sidebar nav link
  - Files: `client/src/pages/secp-compliance.tsx`, `client/src/components/app-sidebar.tsx`, `client/src/App.tsx`
  - Acceptance: Page loads with compliance data, shows in sidebar under compliance section

### T002: FBR Documentation Module Page
- **Blocked By**: []
- **Details**:
  - Create `client/src/pages/fbr-documentation.tsx` — standalone FBR documentation page
  - Sections: Tax computation worksheet, WHT reconciliation tracker, advance tax computation, tax adjustment summaries, NTN/STRN validation status, export to Excel/PDF
  - Pull data from existing engagement data and disclosure registry
  - Add sidebar nav link
  - Files: `client/src/pages/fbr-documentation.tsx`, `client/src/components/app-sidebar.tsx`, `client/src/App.tsx`
  - Acceptance: Page loads with FBR documentation tools, export works

### T003: Companies Act 2017 Director Report Checklist
- **Blocked By**: []
- **Details**:
  - Create `client/src/components/compliance/companies-act-checklist.tsx` — director report checklist component
  - Cover key Companies Act 2017 sections: S.223 (Books of Account), S.225 (FS Preparation), S.226 (Auditor Rights), S.227 (Audit Report Requirements), S.228 (Auditor Qualifications), S.204-208 (Related Party), S.233-236 (Dividends/Reserves)
  - Each item: section reference, requirement description, compliance status (Met/Partial/Not Met), evidence link, notes
  - Integrate into finalization phase or as standalone tab
  - Files: `client/src/components/compliance/companies-act-checklist.tsx`
  - Acceptance: Checklist renders with all key sections, statuses can be toggled

### T004: Two-Factor Authentication Backend
- **Blocked By**: []
- **Details**:
  - Implement TOTP-based 2FA using otplib or similar
  - Add routes: POST /api/auth/2fa/setup (generate secret + QR), POST /api/auth/2fa/verify (verify code), POST /api/auth/2fa/disable
  - Add twoFactorSecret and twoFactorEnabled fields to User model in Prisma schema
  - Integrate into login flow — if 2FA enabled, require code after password
  - Add frontend 2FA setup UI in user settings
  - Files: `server/authRoutes.ts`, `prisma/schema.prisma`, `server/services/twoFactorService.ts`
  - Acceptance: User can enable 2FA, login requires OTP code when enabled

### T005: Compliance Coverage Matrix & Reports Generation
- **Blocked By**: [T001, T002, T003]
- **Details**:
  - Create `client/src/pages/compliance-reports.tsx` — unified compliance report center
  - Generate: ISA 200–720 Coverage Matrix, ISQM-1 Control Register summary, Engagement Workflow diagram, RBAC Matrix view, Security Checklist, QCR Readiness Mapping, Production Validation Summary
  - Each report section shows module status (Implemented/Active), key files, compliance percentage
  - Export capability (PDF)
  - Add route and sidebar link
  - Files: `client/src/pages/compliance-reports.tsx`, `client/src/App.tsx`, `client/src/components/app-sidebar.tsx`
  - Acceptance: All compliance reports render with accurate data, export works

### T006: Database Backup Automation Script
- **Blocked By**: []
- **Details**:
  - Create `server/scripts/backup.sh` — automated PostgreSQL backup script
  - Daily pg_dump with timestamped filenames, retention of last 30 days, compression
  - Add cron setup instructions
  - Files: `server/scripts/backup.sh`
  - Acceptance: Script runs, creates compressed backup file
