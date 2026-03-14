# Completion, Reporting & Final Deliverables Fix

## What & Why
Fix the Completion (Finalization) and Reporting modules so they properly close out the audit engagement and generate practical deliverables. Completion must aggregate unresolved matters, run final checks, and gate reporting. Reporting must pull correct data from all prior phases.

## Done looks like
- Completion checklists (ISA 500, 580, 220) work and track status
- Subsequent events (ISA 560) capture and classification works
- Going concern assessment (ISA 570) with indicators works
- Misstatement summary aggregates correctly from execution
- Representation letter preparation works
- Partner approval and EQCR clearance gates function
- Pre-report validation identifies blockers (open review notes, unapproved tests)
- Audit report drafting with AI assistance works
- Report generation pulls correct engagement data, client info, and conclusions
- Export/download of reports, working paper packs, and deliverables works
- Document naming follows standard format (firm, client, engagement, year-end)
- Duplicate report generation buttons and inactive report pages removed

## Out of scope
- ISQM quality management (separate task)
- Template vault (separate task)

## Tasks
1. **Completion workflow fix** — Test and fix completion checklists, subsequent events, going concern, and misstatement summary. Ensure they pull data from execution phase.
2. **Partner approval gate** — Fix partner approval, EQCR clearance, and pre-report validation. Ensure blockers prevent premature report generation.
3. **Report generation fix** — Test audit report generation. Ensure reports pull correct client name, period, opinion basis, key findings, and signatures. Fix broken or empty report sections.
4. **AI report drafting** — Fix AI-assisted report drafting and opinion engine. Ensure drafts are editable and ISA-compliant.
5. **Export & documents** — Fix PDF/Excel export for reports, working papers, management letters, and representation letters. Standardize file naming.
6. **Duplicate cleanup** — Remove duplicate report generation buttons, inactive report pages, and redundant completion screens.

## Relevant files
- `client/src/pages/finalization.tsx`
- `client/src/components/finalization/ai-opinion-engine.tsx`
- `client/src/pages/reports.tsx`
- `client/src/pages/outputs.tsx`
- `server/finalizationRoutes.ts`
- `server/finalizationBoardRoutes.ts`
- `server/reportingRoutes.ts`
- `server/opinionEngineRoutes.ts`
- `server/deliverablesRoutes.ts`
- `server/outputsRoutes.ts`
- `server/pdfDocumentationRoutes.ts`
- `server/services/reportingService.ts`
