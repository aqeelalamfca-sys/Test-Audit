# AuditWise Workflow Migration Plan
## Old vs New Phase Mapping + Exact Files to Update

---

## PART 1: OLD vs NEW WORKFLOW MAPPING

### Current System (9 phases)
```
OLD PHASE              SIDEBAR KEY        ROUTE SLUG           BACKEND PHASE ENUM
─────────────────────  ─────────────────  ───────────────────  ──────────────────
1. Onboarding          (onboarding)       /onboarding          ONBOARDING
2. Pre-Planning        pre-planning       /pre-planning        PRE_PLANNING
3. Data Intake         requisition        /requisition          REQUISITION
4. Planning            planning           /planning             PLANNING
5. Execution           execution          /execution            EXECUTION
6. FS Heads            fs-heads           /fs-heads             (no enum — sub-module)
7. Evidence            evidence           /evidence             (no enum — sub-module)
8. Checklists          checklists         /checklists           (no enum — sub-module)
9. Finalization        finalization       /finalization         FINALIZATION
10. Deliverables       deliverables       /deliverables         REPORTING
11. EQCR               eqcr              /eqcr                 EQCR
12. Inspection         inspection         /inspection           INSPECTION
```

### Target System (19 phases)
```
TARGET PHASE                   OLD MODULE(S) TO MERGE                        ACTION
─────────────────────────────  ────────────────────────────────────────────   ──────────
1.  Client Creation            /clients/new, client-onboarding page          RETAIN
2.  Engagement Setup           /engagement/new, engagement-edit page         RETAIN
3.  Acceptance & Continuance   Pre-Planning (acceptance tab)                 SPLIT OUT from Pre-Planning
4.  Independence / Ethics      Pre-Planning (ethics tab), ethics page        SPLIT OUT from Pre-Planning
5.  TB / GL Upload             Requisition (tb/gl tabs), import-wizard       MERGE into new phase
6.  Validation & Parsing       Requisition (validation), data-quality        MERGE into new phase
7.  CoA / FS Mapping           Requisition (mapping/draft-fs tabs), fs-heads MERGE into new phase
8.  Materiality                Planning (materiality tab)                    SPLIT OUT from Planning
9.  Risk Assessment            Planning (risk tab)                           SPLIT OUT from Planning
10. Planning Strategy          Planning (strategy/analytics tabs)            SPLIT OUT from Planning
11. Procedures & Sampling      Execution (audit program), sampling           SPLIT OUT from Execution
12. Execution Testing          Execution (substantive/controls testing)      RETAIN (refocus)
13. Evidence Linking           Evidence vault page                           RETAIN (promote to phase)
14. Observations / Findings    Observations page, review-notes               MERGE into new phase
15. Adjustments / Misstatements Audit adjustments routes                     NEW phase (currently scattered)
16. Finalization               Finalization page                             RETAIN (refocus)
17. Opinion / Reports          Deliverables/outputs/print-view               MERGE into new phase
18. EQCR Review                EQCR page                                    RETAIN
19. Inspection Archive         Inspection page                               RETAIN
```

---

## PART 2: CURRENT SYSTEM INVENTORY

### A. Phase Definitions (3 parallel systems detected)

| System | File | Phases | Purpose |
|--------|------|--------|---------|
| **Audit Chain State Machine** | `server/services/auditChainStateMachine.ts` | 9 phases (ONBOARDING→INSPECTION) | High-level progression + gate checks |
| **Workflow Orchestrator** | `server/services/workflowOrchestrator.ts` | 8 stages (UPLOAD_PROFILE→COMPLETION) | Data-to-planning pipeline scoring |
| **Phase Engine** | `server/services/phaseEngine.ts` | 9 tabs (summary→draft-fs) | Data intake sub-tab dependencies |
| **Enforcement Engine** | `server/services/enforcementEngine.ts` | Phase locking + maker-checker | Compliance gate enforcement |
| **Workspace Context** | `client/src/lib/workspace-context.tsx` | 11 phases (WORKSPACE_PHASES) | Frontend sidebar navigation |

### B. Duplicate / Overlapping Modules

| Duplication | Files | Issue |
|-------------|-------|-------|
| FS Heads vs Requisition mapping | `fs-heads.tsx` + requisition `FsMappingSection.tsx` | Both do CoA/FS mapping |
| Materiality standalone vs Planning tab | `isa320-materiality-panel.tsx` + planning materiality tab | Same feature in two places |
| Evidence vault vs execution workpaper attachments | `evidence-vault.tsx` + execution evidence links | Overlapping evidence management |
| Observations vs Review Notes | `observations.tsx` + `review-notes.tsx` | Both capture audit findings |
| Outputs vs Deliverables vs Print View | `outputs.tsx` + `print-view.tsx` | Same report generation purpose |
| Sign-off routes duplication | `signOffRoutes.ts` + `sectionSignOffRoutes.ts` | Two sign-off systems |
| TB routes duplication | `tbRoutes.ts` + `trialBalanceRoutes.ts` | Two TB API layers |

### C. Server Route Files (90+ files)
See full list in codebase. Key duplications:
- `signOffRoutes.ts` AND `sectionSignOffRoutes.ts`
- `tbRoutes.ts` AND `trialBalanceRoutes.ts`
- `substantiveRoutes.ts` AND `substantiveTestingRoutes.ts`
- `finalizationRoutes.ts` AND `finalizationBoardRoutes.ts`

### D. Existing AI Integration Points
- `aiService.ts` — Multi-provider abstraction (OpenAI/Gemini/DeepSeek/Anthropic)
- `aiCopilotService.ts` — Gap analysis, quality scoring
- `aiAuditUtilities.ts` — Evidence sufficiency, documentation completeness
- `aiGovernance.ts` — Prohibited actions enforcement
- `aiGuidanceService.ts` — Client-facing guidance
- `aiWorkflowService.ts` — Proposal-based AI workflow
- `fsHeadAIService.ts` — Procedure generation for FS heads
- Frontend: `ai-copilot-panel.tsx`, `ai-assist-button.tsx`, `ai-field-wrapper.tsx`, `ai-opinion-engine.tsx`, `ai-rephrase-modal.tsx`

### E. Save / Autosave Mechanisms
- `use-save-engine.ts` — Core debounced autosave (3s) with beacon flush
- `use-*-save-bridge.ts` — Per-section save bridges (planning, execution, etc.)
- `global-save-indicator.tsx` — Aggregate save status display
- `workspace-context.tsx` — Route/phase progress persistence

### F. Sign-off / Approval System
- `signOffAuthority.ts` — Role-based permissions (PREPARED→REVIEWED→APPROVED)
- `sectionSignOffRoutes.ts` — Hierarchical sign-off with SoD enforcement
- `sign-off-bar.tsx` — UI component
- `phase-approval-control.tsx` — Phase-level approval UI

---

## PART 3: EXACT FILES TO UPDATE

### Phase 1: Create Canonical Phase Registry (NEW)

**New files to create:**
```
server/services/canonicalPhaseRegistry.ts     — Single source of truth for 19 phases
shared/phases.ts                               — Shared phase types/constants
client/src/lib/phase-registry.ts              — Frontend phase registry consumer
```

**Files to modify:**
```
server/services/auditChainStateMachine.ts     — Refactor to use new registry (RETAIN as progression engine)
server/services/enforcementEngine.ts          — Refactor gates to use new registry
server/services/workflowOrchestrator.ts       — Refactor to align with new phases
server/services/phaseEngine.ts                — Merge tab logic into new registry
client/src/lib/workspace-context.tsx          — Replace WORKSPACE_PHASES with new registry
shared/schema.ts                              — Update AuditPhase enum if needed
```

### Phase 2: Update Database Schema

**Files to modify:**
```
prisma/schema.prisma                          — Add new AuditPhase enum values (ACCEPTANCE, INDEPENDENCE, TB_GL_UPLOAD, VALIDATION, COA_MAPPING, MATERIALITY, RISK_ASSESSMENT, PLANNING_STRATEGY, PROCEDURES_SAMPLING, EVIDENCE_LINKING, OBSERVATIONS, ADJUSTMENTS, OPINION_REPORTS)
shared/schema.ts                              — Mirror new phases in Drizzle schema
```

### Phase 3: Update Frontend Routes

**Files to modify:**
```
client/src/App.tsx                            — Add routes for all 19 phases, update legacy redirects
client/src/components/app-sidebar.tsx         — Update WORKSPACE_PHASE_ICONS for 19 phases
client/src/lib/workspace-context.tsx          — Update WORKSPACE_PHASES array to 19 items
client/src/lib/navigation.ts                  — Update navigation helpers
```

### Phase 4: Split Pre-Planning into 2 phases

**Files to modify:**
```
client/src/pages/pre-planning.tsx             — Split into Acceptance page and Independence page
server/prePlanningRoutes.ts                   — Split API endpoints by new phase
server/services/prePlanningService.ts         — Split service logic
```

**New files to create:**
```
client/src/pages/acceptance.tsx               — Phase 3: Acceptance & Continuance
client/src/pages/independence.tsx             — Phase 4: Independence / Ethics
```

### Phase 5: Split Requisition into 3 phases

**Files to modify:**
```
client/src/pages/information-requisition.tsx  — Refocus as TB/GL Upload only
client/src/pages/information-requisition/FsMappingSection.tsx — Move to CoA/FS Mapping phase
client/src/pages/information-requisition/workflow-spec.ts     — Update phase references
server/dataIntakeRoutes.ts                    — Split endpoints by new phase
server/services/phaseEngine.ts                — Update tab assignments
```

**New files to create:**
```
client/src/pages/validation-parsing.tsx       — Phase 6: Validation & Parsing
client/src/pages/coa-mapping.tsx              — Phase 7: CoA / FS Mapping
```

### Phase 6: Split Planning into 3 phases

**Files to modify:**
```
client/src/pages/planning.tsx                 — Refocus as Planning Strategy only
client/src/components/isa320-materiality-panel.tsx — Promote to standalone phase page
client/src/components/planning/risk-assessment-panel.tsx — Promote to standalone phase page
server/planningRoutes.ts                      — Split endpoints
server/isa320MaterialityRoutes.ts             — Associate with Materiality phase
server/aiRiskAssessmentRoutes.ts              — Associate with Risk Assessment phase
```

**New files to create:**
```
client/src/pages/materiality.tsx              — Phase 8: Materiality
client/src/pages/risk-assessment.tsx          — Phase 9: Risk Assessment
```

### Phase 7: Split Execution into 2 phases

**Files to modify:**
```
client/src/pages/execution.tsx                — Refocus as testing-only
client/src/components/audit-program-panel.tsx  — Move to Procedures & Sampling phase
server/samplingRoutes.ts                      — Associate with Procedures phase
server/auditProgramRoutes.ts                  — Associate with Procedures phase
server/substantiveTestingRoutes.ts            — Associate with Execution Testing phase
```

**New files to create:**
```
client/src/pages/procedures-sampling.tsx      — Phase 11: Procedures & Sampling
```

### Phase 8: Promote sub-modules to phases

**Files to modify:**
```
client/src/pages/evidence-vault.tsx           — Promote to Phase 13: Evidence Linking
client/src/pages/observations.tsx             — Merge with review-notes → Phase 14: Observations/Findings
client/src/pages/review-notes.tsx             — Merge into observations phase
server/observationRoutes.ts                   — Unified observations API
```

**New files to create:**
```
client/src/pages/adjustments.tsx              — Phase 15: Adjustments / Misstatements
server/adjustmentPhaseRoutes.ts               — (or extend auditAdjustmentRoutes.ts)
```

### Phase 9: Merge Outputs/Deliverables

**Files to modify:**
```
client/src/pages/outputs.tsx                  — Merge into Opinion / Reports phase
client/src/pages/print-view.tsx               — Merge into Opinion / Reports phase
server/outputsRoutes.ts                       — Consolidate
server/deliverablesRoutes.ts                  — Consolidate
server/reportingRoutes.ts                     — Consolidate
```

**New files to create:**
```
client/src/pages/opinion-reports.tsx          — Phase 17: Opinion / Reports
```

### Phase 10: Phase Gate Engine

**New files to create:**
```
server/services/phaseGateEngine.ts            — Centralized hard/soft gate evaluator
server/routes/phaseGateRoutes.ts              — API for gate status queries
client/src/components/phase-gate-panel.tsx     — UI for gate status display
```

**Files to modify:**
```
server/services/auditChainStateMachine.ts     — Delegate gate checks to new engine
server/services/enforcementEngine.ts          — Delegate to new engine
client/src/components/phase-gates-panel.tsx    — Refactor to use new engine
```

### Phase 11: Engagement Workspace Shell

**Files to modify:**
```
client/src/components/engagement-status-header.tsx  — Add phase progress ribbon, AI readiness
client/src/components/page-action-bar.tsx            — Standardize prev/next/save/validate/complete buttons
client/src/components/page-shell.tsx                 — Add sticky action bar, gate display
client/src/components/global-status-bar.tsx           — Add blocker count, AI readiness score
client/src/components/sign-off-bar.tsx                — Standardize across all phases
```

### Phase 12: AI Integration by Phase

**Files to modify:**
```
server/services/aiCopilotService.ts           — Add per-phase AI capability mapping
server/services/aiAuditUtilities.ts           — Add missing phase-specific AI functions
server/services/aiWorkflowService.ts          — Align proposals with new phase structure
client/src/components/ai-copilot-panel.tsx     — Phase-aware AI suggestions
client/src/components/ai-assist-button.tsx     — Phase-context awareness
```

### Phase 13: Cleanup Duplicates

**Files to consolidate/deprecate:**
```
server/signOffRoutes.ts                       — DEPRECATE (keep sectionSignOffRoutes.ts only)
server/trialBalanceRoutes.ts                  — MERGE into tbRoutes.ts, then DEPRECATE
server/substantiveRoutes.ts                   — MERGE into substantiveTestingRoutes.ts, then DEPRECATE
server/finalizationBoardRoutes.ts             — MERGE into finalizationRoutes.ts
client/src/pages/fs-heads.tsx                 — MERGE into coa-mapping.tsx (Phase 7)
```

---

## PART 4: CHANGE SUMMARY COUNTS

| Category | Count |
|----------|-------|
| New files to create | ~12 |
| Existing files to modify | ~45 |
| Files to deprecate/merge | ~8 |
| New database enum values | ~13 |
| Route changes (frontend) | ~19 new + ~12 legacy redirects |
| Route changes (backend) | ~6 new route files |

---

## PART 5: RECOMMENDED EXECUTION ORDER

```
Step 1:  Canonical Phase Registry + shared types          (foundation — no UI changes)
Step 2:  Database schema migration (new enum values)      (non-destructive addition)
Step 3:  Phase Gate Engine                                 (backend service)
Step 4:  Split Pre-Planning → Acceptance + Independence   (first UI refactor)
Step 5:  Split Requisition → Upload + Validation + Mapping (data flow refactor)
Step 6:  Split Planning → Materiality + Risk + Strategy   (planning refactor)
Step 7:  Split Execution → Procedures + Testing           (execution refactor)
Step 8:  Promote Evidence, Observations, Adjustments      (new phase pages)
Step 9:  Merge Outputs/Deliverables → Opinion/Reports     (reporting consolidation)
Step 10: Update sidebar, routes, workspace context        (navigation overhaul)
Step 11: Workspace shell + action bar standardization     (UX unification)
Step 12: AI integration per phase                         (AI enhancement)
Step 13: Legacy route redirects + cleanup                 (backward compat + cleanup)
Step 14: End-to-end testing                               (verification)
```

---

## PART 6: RISK ASSESSMENT

| Risk | Mitigation |
|------|------------|
| Breaking existing engagement data | Add new enum values additively; never remove old ones until migration complete |
| Frontend route breakage | Keep all legacy redirects active throughout migration |
| Autosave disruption | Preserve save-engine hooks; only change which phase they report to |
| Sign-off chain breakage | Retain sectionSignOffRoutes.ts as-is; extend to cover new phases |
| AI service disruption | AI services are phase-agnostic; only add new phase mappings |
| Database migration failures | Use Prisma's additive `db push` (new enum values are non-destructive) |
