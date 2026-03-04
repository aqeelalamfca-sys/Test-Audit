[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] 5. Scan codebase for duplicates and cleanup
[x] 6. Remove unused AIAssistButton.tsx component (duplicate of ui/ai-assist-button.tsx)
[x] 7. Remove unused loading-skeleton.tsx component
[x] 8. Verify application still works after cleanup
[x] 9. Add complete demo client seeding endpoint
[x] 10. Seed complete demo client with two engagements (DEMO-COMPLETE-SA-2025-001 and DEMO-COMPLETE-SA-2024-001)
[x] 11. Seed includes: attachments, deliverables, EQCR, inspection readiness, checklists, sign-offs, CoA accounts
[x] 12. Health Check Scan - Fixed TypeScript errors in information-requisition.tsx, isaComplianceService.ts, materialityService.ts, trialBalanceRoutes.ts
[x] 13. Fixed broken linkages - Updated mappingData type, fixed status enum values, fixed model references
[x] 14. Created health check script (scripts/health-check.ts)
[x] 15. Created routing map documentation (docs/ROUTING_MAP.md)
[x] 16. Fixed database schema push and verified server running
[x] 17. Consolidated TB/GL Upload to single Trial Balance upload (removed General Ledger upload section)
[x] 18. Implemented ONE-CLICK Template + ONE-PASS Import for TB/GL Upload:
    - Created GET /api/audit/templates/workbook?type=TBGL_MULTI (blank template with 5 sheets)
    - Created GET /api/audit/templates/workbook?type=TBGL_DEMO (1100+ rows demo data)
    - Created POST /api/audit/engagements/:id/imports/workbook with VALIDATE_ONLY and COMMIT modes
    - Template sheets: TB_UPLOAD, GL_UPLOAD, MASTER_PARTIES, MASTER_BANK_ACCOUNTS, AR_AP_OPENITEMS
    - Validation with error codes: E_REQUIRED_SHEET_MISSING, E_REQUIRED_COLUMN_MISSING, E_DATE_PARSE_FAILED, E_GL_DRCR_BOTH_PRESENT, E_TB_GL_CODE_DUPLICATE, E_PARTY_ID_DUPLICATE
    - Updated UI with primary Upload Workbook card (Template, Demo Data, Select File, Validate, Import buttons)
    - Row counts display after validation, validation summary with errors/warnings
    - Import button gated on validation (blocked when errors exist)
    - COMMIT mode persists COA accounts (via upsert), TB lines, GL entries to database using Prisma
    - Advanced Options collapsible section with legacy TB-only upload for backwards compatibility
    - Fixed validation severity alignment (WARN -> WARNING) for consistent frontend/backend
[x] 19. Replit environment migration - npm install, prisma db push, workflow configured with webview output
[x] 20. ISA/ISQM-Compliant Audit Workflow Architecture (10-Step Implementation):
    - STEP 1: Added Observation, CoAFSMappingVersion, UpstreamImpact models to schema
    - STEP 2-5: Verified existing infrastructure (TBBatch, MappingAllocation, FSSnapshot, FSHeadWorkingPaper)
    - STEP 6: Created Observation Board with 10 API endpoints and frontend page
      - server/observationRoutes.ts: CRUD, management response, auditor conclusion, clear/waive
      - client/src/pages/observations.tsx: Full UI with filters, table, dialogs
    - STEP 7: Verified existing FSHeadAdjustment model for adjustments register
    - STEP 8: Created Impact/Recompute Engine
      - server/impactService.ts: Impact tracking functions (register, acknowledge, resolve, ignore)
      - server/impactRoutes.ts: 10 API endpoints for impact management
      - Fixed security issue: Added engagement scoping to check endpoint
    - STEP 9: Verified existing Review/EQCR/Inspection models
    - STEP 10: Updated documentation (replit.md)
[x] 21. Replit environment re-migration - Installed tsx, regenerated Prisma client, pushed schema, verified server running
[x] 22. Draft FS Page Enhancement with Drilldown:
    - Implemented 2-column BS+P&L side-by-side layout (stacks on mobile)
    - Added 6 KPI tiles: Total Assets, Total Equity, Total Liabilities, Total Income, Total Expenses, Net Profit
    - Added Out of Balance banner when assets != equity + liabilities
    - Added P&L to Equity linkage indicator
    - Made all FS line item amounts clickable with hover:underline cursor-pointer styling
    - Created right-side Sheet/Drawer with 3 tabs:
      - Accounts & Balances: GL Code, GL Name, Opening, Period Dr, Period Cr, Closing
      - Population: KPIs, transaction table, filters (date, amount, party), pagination (50/page), CSV export
      - Mapping: FS Head, Class, Sub-Class, mapped GL count badges
    - Added GET /api/fs-draft/:engagementId/drilldown/:fsLineItem endpoint with pagination and filtering
    - Fixed LSP errors in fsDraftRoutes.ts (null accountCode guards)
[x] 23. Final Replit migration - Installed tsx package, pushed database schema, regenerated Prisma client, verified application running on port 5000
[x] 24. Environment migration complete - Application fully functional with database seeding completed successfully
[x] 25. Latest Replit migration - Created PostgreSQL database, regenerated Prisma client (with NODE_OPTIONS for large schema), pushed schema, verified app running on port 5000 with login page visible
[x] 26. Final Replit environment migration - npm install, Prisma generate, db push, database seeded, app running on port 5000
[x] 27. Latest Replit environment migration - npm install, Prisma db push (synced + regenerated client), workflow configured with webview on port 5000, app running successfully
[x] 28. Fixed production build errors - Restored empty server/tsconfig.json, added @shared alias to esbuild config in script/build.ts, build now succeeds
[x] 29. Fixed deployment promote failure - Added missing server deps (bcryptjs, cookie-parser, csv-parse, docx, exceljs, p-limit, p-retry) to esbuild bundle allowlist so they're included in dist/index.cjs
[x] 30. Seeded demo client "Meridian Technologies (Pvt.) Limited" with 2 engagements (ENG-2025-001, ENG-2025-002), full audit workflow data including phases, teams, risk assessments, controls, TB/GL, FSHead mappings, EQCR, and more
[x] 31. Latest Replit migration - npm install, Prisma generate (128s for 12k-line schema), db push, app running on port 5000 with login page verified
[x] 32. Current migration - Installed tsx, patched Prisma generator-build to skip TypeScript type generation (reducing generation from timeout to 4.87s), pushed DB schema, regenerated Prisma client, seeded all demo data, app running on port 5000
[x] 33. Session migration - Installed tsx package, regenerated Prisma client (~62s), pushed DB schema, app running successfully on port 5000 with login page verified
[x] 34. Codebase scan and optimization:
    - Removed 156MB of unreferenced attached_assets/ (1,038 files)
    - Removed stale dist/ directory (12MB)
    - Removed Docker/deployment files (Dockerfile, docker-compose.yml, nginx.conf, auditwise.service)
    - Removed 6 unused shell scripts (backup.sh, restore.sh, deploy.sh, migrate-to-new-version.sh, update-production.sh, verify-production.sh)
    - Removed 7 obsolete markdown docs (DEPLOYMENT.md, PRODUCTION-CHECKLIST.md, PRODUCTION-READY.md, MIGRATION-GUIDE.md, QUICKSTART.md, UI_UX_CHANGES.md, CHANGELOG.md)
    - Removed 4 stale planning docs from docs/ (ERROR_BREAK_REGISTER.md, FIX_PLAN.md, UI_CONSOLIDATION_PLAN.md, REGRESSION_CHECKLIST.md)
    - Removed unused VS Code extension directory (auditwise-vscode-extension/)
    - Removed empty nohup.out
    - Removed 12 unused components: ThemeSelector.tsx, data-hub-mode-toggle.tsx, why-blocked-panel.tsx, standard-table.tsx, enhanced-input.tsx, sign-off-checkbox.tsx, ai-text-field.tsx, ai-assisted-field.tsx, tabs-with-indicators.tsx, indicators-index.ts, field-help-configs.ts, field-help.tsx
    - Updated replit.md: removed VS Code extension references and SQLite dependency
    - Source files reduced from 479 to 445
    - Verified all imports clean - no broken references
    - App confirmed running successfully on port 5000
[x] 35. Startup stability optimization:
    - Fixed startup crash caused by reseedImportData running on every boot (heavy delete+create of 1000+ records)
    - Created ensureImportData() that only seeds import data when ImportBatch doesn't exist for an engagement
    - Added per-engagement try/catch to prevent one failure from blocking others
    - Moved staff user lookup outside the loop to avoid redundant queries
    - App now starts in ~5s instead of 60+s, memory usage reduced from 537MB to 427MB RSS
    - App confirmed stable and viewable on port 5000
[x] 36. Session migration - Installed tsx package, pushed Prisma schema to new PostgreSQL database, fixed seedDemoData.ts (removed invalid nodeType/status/preparedByName fields from SectionSignOff.create calls to match actual schema), app running on port 5000 with login page verified
[x] 37. Full Technical Audit & Optimization:
    - SCAN & FIX: Fixed SectionSignOff seed data schema mismatch, fixed enforcementEngine.checkPhaseAccess (was returning {allowed:true} unconditionally)
    - OPTIMIZE: Removed unused components (attachment-uploader.tsx, StatusChip.tsx, progress-bar.tsx), consolidated glRoutes.ts auth helpers with centralized auth.ts
    - DATABASE: Added 35+ indexes across schema (engagementId, phase+engagement composites, status composites, AI output queries)
    - WORKFLOW INTEGRITY: Implemented checkPhaseAccess with prerequisite validation + open review notes check, validateApprovalPrerequisites, trackPostApprovalEdit with version bumping
    - AI MODULE: Created aiAuditUtilities.ts (evidence sufficiency, risk-response gaps, documentation completeness, draft memo generation), created aiUtilityRoutes.ts with role-based access (SENIOR+)
    - SECURITY: Created rateLimiter.ts middleware (auth: 15/15min, AI: 20/min, API: 200/min), applied to auth/AI routes
    - SCHEMA: Added version field to Engagement model, added modelVersion/disclaimer/processingTimeMs to AIUsageLog
    - DOCS: Updated replit.md with AI Utilities Module, Security & Access Control sections
[x] 38. Current session migration - npm install, Prisma db push (schema synced), fixed otplib ESM import breaking change (v13 -> new API), updated verifyTwoFactorToken to async, app running on port 5000 with login page verified
[x] 39. Full System Scan & Gap Analysis + Compliance Implementation:
    - SCAN: Complete 6-layer system scan (frontend 60+ routes, backend 60+ route groups, 180+ DB models, AI multi-provider, security 37 controls, compliance ISA/ISQM/SECP/FBR)
    - GAP ANALYSIS: Classified all components as ✅ Implemented / 🟡 Partial / 🟠 Inactive / ❌ Missing
    - T001: Generated 8 compliance deliverable documents in docs/compliance/
    - T002: Created server/routes/complianceExportRoutes.ts with 5 MANAGER+ role-gated API endpoints
    - T003: Created server/routes/regulatoryComplianceRoutes.ts for Companies Act/FBR/SECP checklist persistence
    - T004: Created Compliance Simulation Engine
    - T005: Standards Matrix Enhancement
[x] 40. Animated "Agents are helping" loading system
[x] 41. Firm Control Compliance Log
[x] 42. ISQM Route Compliance Logging Integration
[x] 43. Sidebar Navigation Update
[x] 44. Compliance Deliverable Documents (8 files in docs/compliance/)
[x] 45. Updated replit.md with Compliance Log and Deliverable Documents entries
[x] 46. Replit migration complete - Fixed tsx path issue in start.sh, pushed Prisma schema, app verified running on port 5000 with login page confirmed
