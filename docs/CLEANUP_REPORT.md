# AuditWise Workflow Cleanup Report

## Overview
This report documents the consolidation of the AuditWise codebase from multiple parallel workflow systems into a single canonical 19-phase architecture.

## Canonical System (Single Source of Truth)
| File | Purpose |
|------|---------|
| `shared/phases.ts` | 19-phase registry with gates, roles, AI capabilities, ISA refs |
| `server/services/phaseGateEngine.ts` | Data-driven backend gate evaluation |
| `server/services/aiPhaseOrchestrator.ts` | AI capability mapping per phase |
| `client/src/lib/workspace-context.tsx` | Frontend phase context (derived from registry) |
| `client/src/lib/navigation.ts` | Smart routing with canonical slugs |
| `client/src/components/app-sidebar.tsx` | Grouped sidebar (6 groups, 17 workspace phases) |

## Deprecated Modules (Marked @deprecated, Retained for Backward Compat)

### Phase Engines
| File | Status | Reason Retained |
|------|--------|-----------------|
| `server/services/auditChainStateMachine.ts` | @deprecated | Some chain integrity routes still reference it |
| `server/services/enforcementEngine.ts` | @deprecated | Maker-checker sign-off routes still consume it |
| `server/services/workflowOrchestrator.ts` | @deprecated | Dashboard score/exception views still use it |
| `server/services/phaseEngine.ts` | @deprecated | Information-requisition tab management |

### Overlapping Components (Retained, Consolidation Planned)
| Component | Overlaps With | Notes |
|-----------|---------------|-------|
| `client/src/components/sign-off-bar.tsx` | `phase-approval-control.tsx` | sign-off-bar is generic; phase-approval-control uses enforcement engine |
| `client/src/components/phase-approval-control.tsx` | `sign-off-bar.tsx` | Will migrate to use phaseGateEngine |
| `client/src/pages/tb-review.tsx` | `review-mapping.tsx` | Both handle TB/CoA review; tb-review is more comprehensive |
| `client/src/pages/review-mapping.tsx` | `tb-review.tsx` | Focused on FS head taxonomy; retained for allocations view |
| `client/src/pages/outputs.tsx` | `print-view.tsx`, `pdf-documentation.tsx` | All handle report generation differently |

## Merged / Consolidated

### Routing
- All legacy `/engagement/:id/*` routes now redirect to canonical workspace slugs
- `createLegacyRedirect()` updated: `pre-planning` → `acceptance`, `requisition` → `tb-gl-upload`, `planning` → `materiality`, `execution` → `execution-testing`, `evidence` → `evidence-linking`, `outputs`/`deliverables` → `opinion-reports`, etc.
- `engagement-link.tsx` default route: `acceptance` (was `pre-planning`)
- `create-engagement-dialog.tsx` fallback: `acceptance` (was `pre-planning`)
- `navigation.ts` all fallbacks updated to canonical slugs
- `action-registry.ts` phase configs updated to canonical slugs
- `use-keyboard-shortcuts.ts` phase keys updated to canonical slugs

### Navigation
- Sidebar groups: Onboarding, Data Import, Planning, Fieldwork, Completion, Quality & Archive
- Each group uses distinct icons per phase
- `WORKSPACE_PHASES` and `PHASE_ROUTES_ALL` derived dynamically from `shared/phases.ts`

### AI Integration
- `aiPhaseOrchestrator.ts` maps each phase to its AI capabilities from the canonical registry
- 17 distinct AI capabilities across 15 phases (client-creation and inspection have none)
- API endpoints: `/api/ai/phase/:phaseKey/capabilities`, `/api/ai/phases/capabilities`, `/api/ai/phase/:phaseKey/generate`
- Frontend hook: `usePhaseAI(phaseKey)` provides capabilities, generate function, and loading state
- Existing AI services retained: `aiService.ts`, `aiCopilotService.ts`, `aiAuditUtilities.ts`, `fsHeadAIService.ts`

## Legacy Route Redirect Map

| Old Route | New Canonical Slug |
|-----------|--------------------|
| `pre-planning` | `acceptance` |
| `requisition` | `tb-gl-upload` |
| `information-requisition` | `tb-gl-upload` |
| `import` | `tb-gl-upload` |
| `planning` | `materiality` |
| `execution` | `execution-testing` |
| `controls` | `execution-testing` |
| `substantive` | `execution-testing` |
| `analytical` | `execution-testing` |
| `fs-heads` | `coa-mapping` |
| `tb-review` | `validation` |
| `evidence` | `evidence-linking` |
| `evidence-vault` | `evidence-linking` |
| `outputs` | `opinion-reports` |
| `deliverables` | `opinion-reports` |
| `print` | `opinion-reports` |
| `onboarding` | `acceptance` |
| `control` | `acceptance` |
| `ethics` | `independence` |
| `audit-health` | `execution-testing` |
| `workflow-health` | `execution-testing` |
| `post-upload-workflow` | `validation` |
| `qcr-dashboard` | `inspection` |

## Files NOT Modified (Working, No Changes Needed)
- `client/src/components/page-shell.tsx` — workspace shell already well-structured
- `client/src/components/page-action-bar.tsx` — action bar works correctly
- All individual phase page components (pre-planning.tsx, planning.tsx, etc.) — retained as-is, mounted on canonical routes
- All AI service files — retained, orchestrator delegates to them
- All save bridge hooks — retained, phase-specific save logic works

## QA Checklist
- [ ] All 17 workspace routes render without errors
- [ ] Phase gate API returns correct evaluation for all phases
- [ ] AI capabilities endpoint returns config for AI-enabled phases
- [ ] Legacy `/engagement/:id/*` routes redirect to canonical workspace slugs
- [ ] Sidebar shows 6 grouped sections with correct phase icons
- [ ] Keyboard shortcuts (Alt+1-8) navigate to canonical phases
- [ ] EngagementLink component navigates to `/acceptance` by default
- [ ] Create engagement dialog navigates to `/acceptance` after creation
- [ ] Smart workspace route returns canonical slugs
