---
title: Phase 3: Data Intake, TB/GL Import & FS Mapping Fix
---
# Data Intake, Trial Balance, GL Import & FS Mapping Fix

## What & Why
Fix the Data Intake pipeline so financial data flows cleanly from upload through TB/GL import, mapping, and into downstream planning/execution modules. This is the critical data backbone of the audit — broken imports or disconnected mappings make the entire system unusable.

## Done looks like
- Document upload works reliably with drag-and-drop and file selection
- File status tracking (uploaded, validated, imported) works correctly
- TB and GL imports parse correctly with proper column mapping
- GL codes remain unique and differences are clearly highlighted
- FS mapping links TB accounts to financial statement line items
- Mapped balances flow correctly into FS Heads, planning, and execution
- Duplicate upload buttons and confusing sub-tabs are removed
- Reconciliation gates (TB↔GL, sub-ledger control accounts) work
- Data intake status ribbon shows accurate progress
- Validation workbook export works

## Out of scope
- Planning module fixes (next phase)
- Working paper template integration (separate task)

## Tasks
1. **Upload flow fix** — Test and fix file upload across all data intake sub-tabs (TB, GL, AP, AR, Bank). Remove duplicate upload buttons. Ensure files persist and status updates correctly.
2. **TB/GL import fix** — Test column mapping, balance parsing, and import validation. Fix any issues where imported data doesn't match expected formats or loses precision.
3. **FS mapping fix** — Ensure account-to-FS-line mapping works, auto-mapping from prior periods works, and mapped data is accessible downstream.
4. **Reconciliation fix** — Test and fix TB↔GL reconciliation, sub-ledger control account matching, and exception tracking. Ensure blocking gates prevent progression when reconciliation fails.
5. **Status & progress** — Fix the data intake progress ribbon to show accurate completion percentages and gate statuses.
6. **Downstream flow** — Verify that imported/mapped data is accessible from planning dashboard, execution, and FS heads APIs.

## Relevant files
- `client/src/pages/information-requisition.tsx`
- `client/src/pages/information-requisition/DataTabSection.tsx`
- `client/src/pages/information-requisition/FsMappingSection.tsx`
- `client/src/pages/information-requisition/ReviewCoaSection.tsx`
- `client/src/pages/information-requisition/SummaryTab.tsx`
- `client/src/pages/import-wizard.tsx`
- `client/src/pages/tb-review.tsx`
- `client/src/pages/review-mapping.tsx`
- `client/src/components/data-intake-progress-ribbon.tsx`
- `client/src/components/data-intake-checks-panel.tsx`
- `server/importRoutes.ts`
- `server/tbRoutes.ts`
- `server/glRoutes.ts`
- `server/fsRoutes.ts`
- `server/coaRoutes.ts`
- `server/dataIntakeRoutes.ts`
- `server/syncRoutes.ts`
- `server/templateRoutes.ts`