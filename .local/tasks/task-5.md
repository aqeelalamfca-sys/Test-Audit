---
title: Phase 5: Execution, FS Heads & Working Papers Fix
---
# Execution, FS Heads & Working Papers Fix

## What & Why
Fix the Execution module so audit procedures, evidence collection, results, conclusions, and review flow all work properly. FS Heads working papers must correctly receive mapped balances, linked risks, materiality thresholds, and planned procedures from upstream modules. This is where the core audit work happens.

## Done looks like
- Execution dashboard shows correct FS head status, completion %, and ISA compliance metrics
- Each FS Head working paper receives mapped TB balances, related risks, materiality thresholds, assertions, and planned procedures
- Procedures (TOC, TOD, Analytics) can be created, edited, assigned, completed, and reviewed
- Evidence upload/download works for each FS head
- Conclusions can be drafted (with AI assist) and saved
- Review workflow (DRAFT→PREPARED→REVIEWED→APPROVED) functions correctly
- Return-for-rework button works
- Duplicate procedure buttons and repeated forms are removed
- Working paper completion gates are enforced (procedures, evidence, conclusions, review)
- FS Heads navigator sidebar search/filter works

## Out of scope
- Finalization/completion fixes (next phase)
- Template vault build (separate task)

## Tasks
1. **Execution dashboard fix** — Fix FS head summary loading, completion calculations, and ISA compliance tracking. Remove duplicate or misleading metric cards.
2. **FS Head wizard fix** — Test all 6 wizard steps (Context, Assertions, Procedures, Evidence, Conclusions, Review) for each FS head type. Fix save/load issues.
3. **Procedure workflow fix** — Ensure TOC/TOD/Analytics procedures can be created, edited, and completed. Fix form validation, save logic, and status transitions.
4. **Evidence management fix** — Test file upload, download, and deletion for FS head attachments. Fix broken file streaming or missing files after refresh.
5. **Review workflow fix** — Test sign-off transitions (DRAFT→PREPARED→REVIEWED→APPROVED) and return-for-rework. Fix any status transition bugs.
6. **Upstream data linking** — Verify execution receives correct data from planning (risks, audit program), materiality (thresholds), and data intake (TB balances). Fix broken API calls or empty data scenarios.
7. **AI assistance** — Add AI-assisted conclusion drafting and procedure narration where appropriate.

## Relevant files
- `client/src/pages/execution.tsx`
- `client/src/pages/fs-heads.tsx`
- `server/fsHeadRoutes.ts`
- `server/services/fsHeadExecutionService.ts`
- `server/services/fsHeadEnforcement.ts`
- `server/services/fsHeadProcedureTemplates.ts`
- `server/substantiveRoutes.ts`
- `server/substantiveTestingRoutes.ts`
- `server/samplingRoutes.ts`
- `server/isa530SamplingRoutes.ts`
- `server/auditProgramRoutes.ts`
- `server/evidenceRoutes.ts`
- `server/controlsRoutes.ts`