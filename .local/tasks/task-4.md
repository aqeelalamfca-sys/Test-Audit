---
title: Phase 4: Planning, Risk Assessment & Materiality Fix
---
# Planning, Risk Assessment & Materiality Fix

## What & Why
Fix the Planning, Risk Assessment, and Materiality modules so they become practical, linked to engagement/intake data, and properly feed execution. These three modules are tightly coupled — planning identifies significant areas, risk assessment documents threats, and materiality sets thresholds. They must work together seamlessly.

## Done looks like
- Planning automatically pulls engagement data, client info, and financial data from intake/TB
- Planning sub-tabs (A-P) all load, save, and display correctly
- Risk assessment allows capturing inherent, control, fraud, significant, assertion-level, and account-level risks
- Risks link to FS heads, account balances, and planned procedures
- Materiality benchmark selection, calculation, PM, and trivial threshold all work correctly
- Materiality values are accessible from execution and sampling modules
- Duplicate planning screens, risk forms, and materiality calculators are removed
- AI help text added for planning memo drafting, risk descriptions, and materiality rationale
- Planning outputs feed risk assessment; risk outputs feed execution focus
- All save/update/display works after refresh

## Out of scope
- Execution module fixes (next phase)
- Internal controls deep fix (handled within execution context)

## Tasks
1. **Planning data flow** — Ensure planning dashboard pulls engagement data, intake status, and TB data automatically. Fix any API calls that return empty when data exists.
2. **Planning sub-tabs fix** — Test all 16 planning tabs (A-P). Fix save/load issues, remove duplicate narrative fields, and ensure tab navigation works smoothly.
3. **Risk assessment fix** — Test risk creation, editing, linking to FS accounts and assertions. Fix broken risk matrices and disconnected risk forms. Ensure risks propagate to execution.
4. **Materiality fix** — Test benchmark selection, calculation logic, PM, specific materiality, and trivial threshold. Fix save/display issues. Ensure materiality values are available in sampling and execution.
5. **AI narration** — Add preset narration and AI help for planning memo sections, risk description fields, and materiality rationale. Keep it short, editable, and practical.
6. **Cross-phase linking** — Verify planning→risk→materiality→execution data pipeline. Fix any broken links where downstream modules can't access upstream data.

## Relevant files
- `client/src/pages/planning.tsx`
- `client/src/components/planning/planning-dashboard.tsx`
- `client/src/components/planning/planning-progress-ribbon.tsx`
- `client/src/components/planning/significant-accounts-panel.tsx`
- `client/src/components/planning/fraud-risk-panel.tsx`
- `client/src/components/planning/going-concern-panel.tsx`
- `client/src/components/planning/planning-memo-panel.tsx`
- `server/planningRoutes.ts`
- `server/planningDashboardRoutes.ts`
- `server/planningAnalyticsRoutes.ts`
- `server/aiRiskAssessmentRoutes.ts`
- `server/materialityRoutes.ts`
- `server/isa320MaterialityRoutes.ts`
- `server/isa300StrategyRoutes.ts`
- `client/src/pages/pre-planning.tsx`
- `client/src/components/pre-planning/`