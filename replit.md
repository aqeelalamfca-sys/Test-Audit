# AuditWise

AI-enabled full-stack audit management platform for statutory audit execution.

## Architecture

- **Full-stack TypeScript** monorepo — single port 5000 serves both API and frontend
- **Backend**: Express.js (`server/`) with Vite middleware in dev, static serving in production
- **Frontend**: React 18 + Vite (`client/`) with Tailwind CSS + shadcn/ui + TanStack Query
- **Database**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`) + Drizzle ORM (`shared/schema.ts`)
- **Auth**: JWT + session-based (Passport.js), token stored as `auditwise_token` in localStorage
- **Production build**: `npm run build` → `dist/index.cjs` (backend+frontend) + `dist/public/` (static assets)
- **Production run**: `node dist/index.cjs`

## Project Structure

```
client/          React + Vite frontend (root at client/index.html)
server/          Express backend — routes, services, seeds, middleware
shared/          Shared types, Drizzle schema
prisma/          Prisma schema and seed
migrations/      Drizzle migrations
deploy/          VPS deployment scripts
docker/          Docker build files and entrypoints
```

## Key Dependencies

- **ORM**: Prisma (primary) + Drizzle ORM (shared schema definitions)
- **Auth**: Passport.js + JWT + express-session
- **AI**: OpenAI integration (optional, via OPENAI_API_KEY)
- **Storage**: Local filesystem or AWS S3 (optional)
- **Email**: Nodemailer/SMTP (optional)

## Critical Rules

- **Prisma on Replit**: Always use `npx prisma db push --skip-generate`. Never run `npx prisma generate` standalone — it can time out.
- **Auth token**: Stored in localStorage under key `auditwise_token`. Use `getAuthToken()` from `client/src/lib/auth.tsx` or `fetchWithAuth()` from `client/src/lib/fetchWithAuth.ts`.
- **No `as any`**: Use `as unknown as T` instead.
- **Client model**: Uses field `name` (NOT `companyName`).
- **MaterialityAllocation.materialityId**: References `MaterialityCalculation`, NOT `MaterialitySet`.
- **Audit trail**: `logAuditTrail(userId, action, entityType, entityId?, beforeValue?, afterValue?, engagementId?)` — always call with `.catch(...)`, never blocking.
- **Production builds**: `import.meta.url` does NOT work in production CJS bundle — use `process.cwd()` for file paths instead.
- **Template vault**: Template files live in `server/template-vault/`.

## AI Audit Copilot (Enhanced)

The workspace shell includes a page-aware AI Copilot panel that provides:
- **Page Profiles**: 15+ route-aware profiles with objectives, expected outputs, review rules, field hints, and suggestion templates (`server/services/pageProfiles.ts`)
- **Standards Library**: 30+ ISA/ISQM/Ethics standards with key paragraphs, audit implications, and page-to-standards mapping (`server/services/standardsLibrary.ts`)
- **Backend Endpoints**: `/api/ai/copilot-enhanced/` — page-context, field-suggestions, section-draft, page-review, page-assistant, standards lookup, next-steps, seed-conclusion (`server/routes/aiCopilotEnhancedRoutes.ts`)
- **Frontend**: 5-tab panel (Overview, Standards, AI Actions, Review, Next Steps) integrated into `engagement-workspace-shell.tsx` via `AICopilotEnhanced` component
- **Hook**: `use-page-ai-context.ts` — extracts `pageId` from current route, maps slug to profile key, fetches context from backend

## Page-Aware AI Assistant Drawer

A universal slide-in drawer (`client/src/components/ai-assistant-drawer.tsx`) that auto-analyzes the current page:
- **Page Context Engine**: `client/src/hooks/use-page-form-data.ts` — extracts live form data from DOM (inputs, textareas, selects, checkboxes, radios), captures labels/values/completion status, identifies narrative fields, scoped to page container (never falls back to document.body)
- **Backend**: `POST /api/ai/copilot-enhanced/page-assistant` — accepts structured page context (pageId, engagementId, formData with field values), enriches with backend engagement data (client, materiality, risks, observations), calls AI with structured prompt, returns categorized JSON (pageSummary, guidance, inputSuggestions, missingFields, standardsReferences, procedures, reviewNotes, nextActions), falls back to template-based output when AI unavailable. Server-side Zod validation with max field/string limits.
- **Two tabs**: "Analysis" (auto-runs on open, shows collapsible categorized sections) and "Smart Actions" (Seed Conclusion, Draft Summary, Missing Fields, Review Section, Fill Narratives)
- **Context badges**: Shows fields detected, completion %, active tab, AI/template indicator
- **Text injection**: Insert/Replace/Append generated text into Page Conclusion panel via CustomEvent

## Universal Page Conclusion System

Every engagement workspace page has a collapsible "Conclusion" section at the bottom:
- **Backend**: `server/routes/pageConclusionRoutes.ts` — GET/POST/PATCH endpoints using raw SQL (`prisma.$queryRaw/$executeRaw`) since PageConclusion model was added after Prisma client generation
- **Database**: `PageConclusion` table with engagementId, pageKey, userId, userName, userRole, authorityLevel, status, conclusionText, isSuperseded, supersededById, timestamps
- **Frontend**: `client/src/components/page-conclusion-panel.tsx` — collapsible panel with text area, status dropdown (Satisfactory/Unsatisfactory/Satisfactory with Recommendation/N/A), save, re-edit, conclusion trail
- **Integration**: Mounted in `engagement-workspace-shell.tsx` after `{children}`, auto-derives pageKey from phaseSlug or route
- **Authority model**: Each role has an authority level (STAFF=1, SENIOR=2, MANAGER=3, EQCR=4, PARTNER=5, FIRM_ADMIN=6). Multiple users can add their own conclusions on the same page. Same user's re-save supersedes their previous entry (with history preserved)
- **Audit trail**: All conclusion actions logged via `logAuditTrail()`

## Universal AI Assistant Drawer

A slide-in drawer accessible from every workspace page via the "AI Assistant" button in the workspace shell header:
- **Component**: `client/src/components/ai-assistant-drawer.tsx` — uses shadcn Sheet (Radix Dialog) for right-side slide-in
- **Backend**: `POST /api/ai/copilot-enhanced/seed-conclusion` — gathers page data, engagement context, materiality, risks, existing conclusions, and generates professional audit text via AI (with template fallback)
- **Modes**: `draft` (seed conclusion), `summary` (draft summary), `missing-fields` (completeness check), `review-section` (reviewer assessment), `fill-narratives` (narrative generation)
- **Text injection**: Dispatches `ai-conclusion-text` CustomEvent with `{text, action, pageKey}`. Actions: insert, replace, append. The `PageConclusionPanel` listens and auto-opens the editor with the text
- **Context-aware**: Uses `usePageAIContext` hook for route detection, page profiles, and standards
- **Standards panel**: Shows applicable ISA/ISQM standards for the current page
- **Page templates**: Displays page-specific suggestion templates from page profiles
- **Integration**: Mounted in `engagement-workspace-shell.tsx` alongside existing Copilot panel. Per-page inline AI panels (acceptance, ethics) replaced by this universal drawer

## Sidebar Navigation (Accordion)

The workspace sidebar uses collapsible accordion menus for phase groups:
- **Component**: `WorkspaceAccordionNav` in `client/src/components/app-sidebar.tsx`
- **Primitives**: Radix `Collapsible` from `client/src/components/ui/collapsible.tsx`
- **Groups**: ONBOARDING, DATA IMPORT, PLANNING, FIELDWORK, COMPLETION, QUALITY & ARCHIVE — each collapses independently
- **Per-user persistence**: Open/closed state saved to `localStorage` keyed by `auditwise_sidebar_accordion_{userId}`; rehydrates on user change
- **Auto-expand**: Group containing the active route auto-expands on navigation
- **Animation**: `collapsible-down/up` keyframes in `tailwind.config.ts` using `--radix-collapsible-content-height`
- **Chevron indicator**: Rotates 90° on collapse, smooth CSS transition

## Tab UI System

All tabs across audit phases use a unified design system:
- **Base primitives** (`client/src/components/ui/tabs.tsx`): Flex-based horizontal scroll, `shrink-0` triggers, subtle border/shadow active state, hidden scrollbar via `scrollbar-none` utility
- **SimpleTabNavigation / NumberedTabNavigation** (`client/src/components/numbered-tab-navigation.tsx`): Custom tab navs with matching style, status dots, numbered steps
- **Phase pages** use `<TabsList className="w-full">` with `<TabsTrigger>` containing icon + label. For 8+ tab pages (acceptance, ethics), triggers use `flex-col` layout (icon above text)
- **AI Copilot sidebar**: Layout uses `flex gap-2.5` with `flex-1 min-w-0` on content area — tabs scroll horizontally when sidebar opens instead of compressing

## Demo Users

- `admin@auditwise.pk` / `Test@123`
- `teamlead@auditwise.pk` / `Test@123`
- `staff@auditwise.pk` / `Test@123`
- Account lockout uses in-memory store — restart server to clear.

## Development

```bash
npm run dev          # Start development server (tsx server/index.ts)
npm run build        # Build for production
npx prisma db push --skip-generate   # Push Prisma schema changes
npm run db:push      # Push Drizzle schema changes
```

## Environment Variables

Required:
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)

Optional:
- `SESSION_SECRET` — Express session secret (auto-generated in dev)
- `JWT_SECRET` — JWT signing secret (auto-generated in dev)
- `OPENAI_API_KEY` — AI copilot features
- `SMTP_*` — Email notifications
- `AWS_*` / `S3_*` — S3 file storage

## Workflow

- **Start application**: `NODE_OPTIONS='--max-old-space-size=1024' NODE_ENV=development npx tsx server/index.ts` on port 5000

## Replit Deployment (Autoscale)

- Target: autoscale
- Build: `npm run build`
- Run: `node dist/index.cjs`

## Production Deployment (Hostinger VPS)

- **Domain**: auditwise.tech
- **VPS IP**: 187.77.130.117
- **VPS app path**: /opt/auditwise
- **Architecture**: Docker Compose (backend + frontend + nginx + postgres + redis)

### Required Replit Secrets for VPS Deployment

- `GITHUB_PERSONAL_ACCESS_TOKEN` — GitHub PAT with repo push access
- `VPS_SSH_KEY` — Private SSH key for VPS root access
- `VPS_HOST` — VPS IP (187.77.130.117)
- `VPS_USER` — SSH user (root)

### DevOps Commands (from Replit shell)

```bash
bash devops/init.sh                    # Initialize SSH + Git credentials
bash devops/control.sh help            # Show all available commands
bash devops/control.sh push [msg]      # Push code to GitHub
bash devops/control.sh deploy          # Full deploy: push → build → restart on VPS
bash devops/control.sh deploy-quick    # Quick deploy: pull + restart backend only
bash devops/control.sh health          # Full system health check
bash devops/control.sh status          # Show container status
bash devops/control.sh logs [svc] [n]  # View container logs
bash devops/control.sh restart [svc]   # Restart container(s)
bash devops/control.sh rebuild [svc]   # Rebuild & restart a service
bash devops/control.sh backup          # Create database backup
bash devops/control.sh ssh [cmd]       # Run command on VPS
```

### Docker Nginx Entrypoint
- The nginx container uses a custom entrypoint script (`docker/nginx-entrypoint.sh`) baked into the image via `docker/nginx.Dockerfile`
- The Dockerfile runs `dos2unix` + `chmod +x` + `chown root:root` on the entrypoint to prevent permission-denied errors regardless of host OS line endings
- `.gitattributes` enforces LF line endings for all `.sh` files
- All compose files (`docker-compose.yml`, `docker-compose.prod.yml`, `deployment/docker-compose.yml`) build from the Dockerfile rather than bind-mounting the script

### Docker APT Signed-By Fix

The Hostinger VPS had conflicting Docker repository signing key references (`docker.gpg` vs `docker.asc`) causing APT failures. All deploy/bootstrap scripts now include an idempotent fix that:
1. Removes ALL old Docker keyring files and source lists
2. Re-imports the Docker GPG key into a single `/etc/apt/keyrings/docker.gpg`
3. Creates a clean `/etc/apt/sources.list.d/docker.list` with one `signed-by` reference
4. Installs docker-ce, docker-ce-cli, containerd.io, docker-buildx-plugin, docker-compose-plugin

Standalone fix: `bash deploy/fix-docker-apt.sh` (run on VPS as root)

### VPS Bootstrap (first-time setup)

```bash
bash deploy/hostinger-vps-setup.sh     # Full VPS setup with SSL
bash deploy/vps-bootstrap.sh           # Lightweight bootstrap
bash deploy/hostinger-deploy.sh        # Deploy with secrets generation
```

### Rollback

If deployment fails, the deploy scripts auto-rollback to the previous commit. Manual rollback on VPS:
```bash
cd /opt/auditwise
git log --oneline -5                   # Find target commit
git reset --hard <commit>
docker compose build --no-cache backend frontend
docker compose up -d --force-recreate
```

## Phase Architecture (19-Phase System)

The canonical audit workflow uses 19 phases defined in `shared/phases.ts` (single source of truth). The phases are grouped into 6 categories:

- **Onboarding** (0-3): client-creation, engagement-setup, acceptance, independence
- **Data Import** (4-6): tb-gl-upload, validation, coa-mapping
- **Planning** (7-9): materiality, risk-assessment, planning-strategy
- **Fieldwork** (10-14): procedures-sampling, execution-testing, evidence-linking, observations, adjustments
- **Completion** (15-16): finalization (11-section completion phase with enhanced gate enforcement), opinion-reports (9-tab reporting phase with ISA 700/701/705/706/265 coverage)
- **Quality & Archive** (17-18): eqcr, inspection

Key files:
- `shared/phases.ts` — Canonical phase registry with gates, roles, AI capabilities, ISA refs, descriptions
- `server/services/phaseGateEngine.ts` — Backend gate evaluation engine
- `server/services/phaseStateService.ts` — Unified phase-state service (read/update progress, status transitions, initialization)
- `server/routes/phaseStateRoutes.ts` — Phase state API (`/api/phase-state/...`)
- `server/routes.ts` — Phase gate API endpoints (`/api/phase-gates/:engagementId`)
- `client/src/lib/workspace-context.tsx` — Frontend phase routing (imports from shared/phases.ts)
- `client/src/lib/navigation.ts` — Smart routing and phase helpers
- `client/src/lib/form-constants.ts` — Shared form dropdown options (cities, entity types, industries, frameworks, etc.)
- `client/src/components/app-sidebar.tsx` — Sidebar with grouped 19-phase navigation
- `client/src/components/engagement-workspace-shell.tsx` — Unified workspace shell (header, breadcrumbs, progress ribbon, prev/next, AI panel, gate alerts)
- `client/src/hooks/use-phase-role-guard.ts` — Role-based phase guard hook (canView/canEdit/canReview/canApprove/canReopen/canArchive/isReadOnly)
- `client/src/components/sign-off-bar.tsx` — Section sign-off bar (prepare/review/approve/return flow) with contextual action labels
- `server/sectionSignOffRoutes.ts` — Sign-off API endpoints (prepare/review/approve/return/lock/unlock)
- `server/services/signOffAuthority.ts` — Role authority matrix for sign-off actions
- `client/src/App.tsx` — All workspace routes (canonical + legacy backward-compat)

**Engagement Workspace Shell**: All workspace routes render inside `EngagementWorkspaceShell`, which provides:
- Canonical breadcrumbs: Home > Engagements > [Client] > [Phase Group] > [Phase]
- Horizontal progress ribbon showing all 17 workspace phases with status icons and tooltips
- Header with client name, engagement code, period, blocker count, completion stats, progress bar
- Prev/next phase navigation in sticky bottom bar
- AI capabilities side panel (toggle via bot icon)
- Gate blocker/warning alerts above page content
- Smart resume redirect: bare `/workspace/:id` redirects to first in-progress or incomplete phase

Old route slugs (pre-planning, requisition, planning, execution, etc.) are now **redirects** to canonical slugs. Legacy workspace routes (`/workspace/:id/requisition`, `/workspace/:id/pre-planning`, etc.) redirect to their canonical equivalents. Standalone tool routes (checklists, audit-health, workflow-health, standards-matrix, compliance-simulation, qcr-dashboard) are also wrapped in the shell for consistent UX.

**Phase order derivation**: All frontend UI components (workspace-ribbon, global-status-bar, phase-gates-panel, global-progress-panel, standards-matrix) now reference the canonical 19-phase system. Backend PHASE_ORDER arrays remain aligned with Prisma's `AuditPhase` enum (8 high-level storage phases) with cross-reference comments to `shared/phases.ts`.

### Role-Based Sign-Off System
All 18 workspace phase pages use a standardized prepare → review → approve workflow:
- **`usePhaseRoleGuard(phaseKey, signOffPhase)`** — Single hook returning `{ canView, canEdit, canReview, canApprove, canReopen, canArchive, isReadOnly, userRole, phaseKey }` based on `shared/phases.ts` rolePermissions + lock status
- **`SignOffBar`** — Contextual action bar showing "Send for Review" / "Mark Reviewed" / "Approve" / "Return for Rework" per role and status
- **PageShell pages** receive `signoffPhase`, `signoffSection`, `readOnly={roleGuard.isReadOnly}` props
- **Non-PageShell pages** render `<SignOffBar phase="..." section="..." />` directly
- Role hierarchy: STAFF(1) → SENIOR(2) → MANAGER(3) → EQCR(4) → PARTNER(5) → FIRM_ADMIN(6)
- `useModuleReadOnly` (in sign-off-bar.tsx) is now only used internally by `usePhaseRoleGuard`

### AI Native Assistant (Unified Across All Phases)
- **Orchestrator**: `server/services/aiPhaseOrchestrator.ts` — Registry of AI capabilities per phase (all 19 phases)
- **Generation API**: `POST /api/ai/phase/:phaseKey/generate` — generates content AND persists to `AISuggestion` + `AIAuditLog`
- **Suggestions API**: `GET /api/ai/phase-suggestions/:engagementId/:phaseKey` — fetch stored suggestions + audit trail per phase
- **Accept/Reject API**: `POST /api/ai/phase-suggestions/:engagementId/:phaseKey/accept|reject` — human-in-the-loop approval
- **Capabilities API**: `GET /api/ai/phase/:phaseKey/capabilities`, `GET /api/ai/phases/capabilities`
- **Field-level suggestions**: `server/routes/ai-suggest.ts` — `/suggest`, `/override`, `/revert`, `/suggestions/:engagementId/:phase/:section`
- **Frontend Hooks**: `use-phase-ai.ts` (capabilities + generation), `use-ai-suggestions.ts` (stored suggestions + accept/reject)
- **UI Component**: `client/src/components/ai-assistant-panel.tsx` — unified panel integrated into all 16 phase pages with:
  - Phase-specific AI capability buttons (generate drafts, analysis, summaries)
  - Stored suggestion history with status badges (AI Draft / User Edited / Rejected)
  - Confidence badges + low-confidence warnings (< 60%)
  - AI-generated content clearly labeled with "AI-Generated Draft" + "Subject to Professional Judgment"
  - Human-in-the-loop enforcement: Professional Judgment Confirmation checkbox required before accepting
  - Edit/Accept/Reject/Regenerate workflow with audit trail
  - AI Audit Trail section (collapsible history of all AI interactions)
- **Storage Models**: `AISuggestion` (unique per engagementId+phase+section+fieldKey), `AIAuditLog` (immutable interaction log)
- **Existing AI services retained**: `aiService.ts`, `aiCopilotService.ts`, `aiAuditUtilities.ts`, `ai-suggest.ts`

### Legacy Engines (Deprecated, Retained)
- `server/services/auditChainStateMachine.ts` — @deprecated, use phaseGateEngine.ts
- `server/services/enforcementEngine.ts` — @deprecated, use phaseGateEngine.ts
- `server/services/workflowOrchestrator.ts` — @deprecated, use phaseGateEngine.ts
- `server/services/phaseEngine.ts` — @deprecated, use phaseGateEngine.ts

### UI Component Consolidation
- **Canonical StatusBadge**: `client/src/components/ui/status-badge.tsx` — single source of truth for all badge types
  - Generic: `StatusBadge` (pass/warn/fail/info/neutral/pending)
  - Phase: `PhaseStatusBadge` (not_started/in_progress/under_review/completed/locked)
  - Checklist: `ChecklistStatusBadge` (pending/in_progress/completed/not_applicable)
  - Risk: `RiskBadge` (low/medium/high)
  - ISA: `IsaReferenceBadge` (reference string)
  - Role: `RoleBadge` (super_admin through client)
  - Presets: `AuditStatusBadges` (Balanced, Matched, Approved, etc.)
- **EntityStatusBadge**: `client/src/components/ui/visual-indicators.tsx` — workflow status (DRAFT/PREPARED/REVIEWED/APPROVED) with tooltip support
- **Legacy bridge**: `client/src/components/status-badge.tsx` — re-exports from `ui/status-badge.tsx`
- **EmptyState**: `client/src/components/empty-state.tsx` — reusable variants (NoData, NoItems, NoSearchResults, Error, TableSkeleton, CardSkeleton)

### Cleanup Report
- Full cleanup report at `docs/CLEANUP_REPORT.md`

### Acceptance & Continuance (Phase 2)
- **Page**: `client/src/pages/acceptance-continuance.tsx` — dedicated standalone page with 8 tabs
- **Tabs**: Prospective/Recurring, Acceptance Factors, Management Integrity, Competence & Resources, Preconditions, Engagement Letter Readiness, Continuance Assessment, Acceptance Conclusion
- **Features**: Completeness tracker, auto-save, AI assistant panel, mandatory partner approval dialog with audit trail
- **Backend**: `server/ethicsRoutes.ts` — acceptance-data GET/PUT, acceptance-approve PATCH endpoints
- **Model**: `AcceptanceContinuanceDecision` (Prisma)
- **Gates**: acceptance-checklist (hard), continuance-assessed (hard), engagement-letter-issued (hard), acceptance-approved (hard)

### Independence / Ethics (Phase 3)
- **Page**: `client/src/pages/ethics-independence.tsx` — dedicated standalone page with 8 tabs
- **Tabs**: Independence Confirmations, Conflicts of Interest, Non-Audit Services, Safeguards, Ethics Compliance, Restricted Relationships, Partner/Staff Declarations, Ethics Conclusion
- **Features**: Real-time declaration tracking from backend, threat/safeguard display, completeness tracker, AI assistant panel, partner approval & lock dialog with audit trail
- **Backend**: `server/ethicsRoutes.ts` — existing declaration/threat/conflict endpoints + ethics-approve PATCH
- **Models**: `IndependenceDeclaration`, `ThreatRegister`, `Safeguard`, `EthicsConfirmation`, `ConflictOfInterest` (Prisma)
- **Gates**: independence-confirmed (hard), conflicts-resolved (hard), ethics-declarations (hard), ethics-approved (hard)
- **Gate enforcement**: TB/GL Upload (phase 4) requires BOTH acceptance AND independence phases to be approved

### TB/GL Upload (Phase 4)
- **Page**: `client/src/pages/information-requisition.tsx` — refactored as focused upload page
- **Tabs**: Upload Wizard, Trial Balance, General Ledger, AP, AR, Bank, Import Logs
- **Features**: File type selection, source/period tagging, batch tracking with batch IDs, template checks, import logs via BatchTrackingTable
- **Backend**: `server/importRoutes.ts` — GET `/api/import/:engagementId/batches` returns batch tracking data
- **Sub-components**: `information-requisition/SummaryTab.tsx` (upload wizard with tagging), `information-requisition/ReviewCoaSection.tsx` (tab routing + BatchTrackingTable)
- **Gates**: tb-uploaded (hard), gl-uploaded (hard), batch-tracked (hard), template-checked (hard)

### Validation & Parsing (Phase 5)
- **Page**: `client/src/pages/post-upload-workflow.tsx` — refactored with structured validation results panel
- **Features**: ValidationResultsPanel at top showing passed checks (green), warnings (amber), blockers (red) from backend; parser summary stats (TB rows, GL entries, pass rate); AI analysis section for corrective actions and data quality; pipeline dashboard below for workflow tracking
- **Backend**: `server/importRoutes.ts` — GET `/api/import/:engagementId/validation-results` returns structured { passedChecks, warnings, blockers, parserSummary }
- **Gates**: tb-validated (hard), gl-reconciled (hard), duplicates-cleared (hard), blockers-resolved (hard)
- **Gate enforcement**: Validation blockers prevent COA Mapping and Materiality completion (recursive prerequisite checks in phaseGateEngine.ts)

### CoA/FS Mapping (Phase 6)
- **Page**: `client/src/pages/fs-heads.tsx` — MappingOverviewPanel + FSHeadsContent
- **Features**: Mapping completeness score, 5 stat cards (total/mapped/unmapped/flagged/FS heads), 4 sub-tabs (FS Head Groups, Unmapped, Lead Schedules, Prior Year), AI analysis
- **Backend**: `server/importRoutes.ts` — GET `/api/import/:engagementId/coa-accounts`, GET `/api/import/:engagementId/mapping-stats`
- **Gates**: coa-mapped, fs-heads-mapped, lead-schedules-grouped (soft), unmapped-reviewed, mapping-score-met (95% threshold)

### Materiality (Phase 7)
- **Page**: `client/src/pages/planning.tsx` (materiality tab) — MaterialityPhaseOverview + ISA320MaterialityPanelNew
- **Features**: Route-aware defaulting (/materiality → materiality tab), dynamic page title, overview card with benchmark/calculation/qualitative/approval sections, AI support badges, downstream linkage badges
- **Gates**: benchmark-selected, materiality-calculated, qualitative-assessed (soft), materiality-approved

### Risk Assessment (Phase 8)
- **Page**: `client/src/pages/planning.tsx` (risk-assessment route) — RiskAssessmentPhaseHeader + focused tabs
- **Tabs**: Entity & FS-Level Risks, Significant Accounts & Assertions, Fraud Risk, Related Controls Awareness, Analytical Triggers, Related Parties, Going Concern, Laws & Regulations
- **Features**: Status overview header with risk coverage %, unmapped areas, high-risk pending counts; route-aware tab filtering; AI support for risk drafting from analytics, fraud risk prompts, missing linkage warnings
- **Backend**: `server/planningRoutes.ts` — GET `/api/planning/:engagementId/risk-stats`
- **Gates**: entity-risks-documented, fs-level-risks-mapped, assertion-risks-linked, significant-risks-identified, fraud-risks-assessed, risk-register-complete (soft), risk-conclusion-documented
- **Prerequisite**: Materiality phase must be complete

### Planning Strategy (Phase 9)
- **Page**: `client/src/pages/planning.tsx` (planning-strategy route) — PlanningStrategyPhaseHeader + focused tabs
- **Tabs**: Audit Strategy Memo, Scope & Component Coverage, Team Allocation & Timing, Internal Control Reliance, Use of Analytics, Substantive Approach & Programs, Planning Conclusion & Memo
- **Features**: Status overview with strategy/scope/team/memo completion status; prerequisite enforcement (requires risk assessment); AI support for planning memo draft and missing linkage warnings
- **Backend**: `server/planningRoutes.ts` — GET `/api/planning/:engagementId/strategy-stats`
- **Gates**: strategy-documented, scope-defined, team-allocated (soft), planning-memo-complete
- **Prerequisite**: Risk assessment phase must have documented risks

### Procedures & Sampling (Phase 10)
- **Page**: `client/src/pages/procedures-sampling.tsx` — dedicated standalone page with 4 tabs
- **Tabs**: Risk-Procedure Matrix, Audit Program, Sampling, Assertions
- **Features**: Phase overview header with 6 stat cards (total/linked/assertions/high-risk/sampling/reviewed), coverage % composite score, gate warnings for ISA 330/530/220/315 compliance, prerequisite enforcement, AI support badges, downstream linkage to execution/evidence/conclusions
- **Backend**: `server/planningRoutes.ts` — GET `/api/planning/:engagementId/procedures-stats` returns comprehensive procedure/risk/sampling statistics with FS area coverage breakdown
- **Gates**: procedures-linked (hard), high-risk-procedures-exist (hard), assertions-covered (hard), sampling-populations-defined (hard), sampling-rationale-documented (soft), reviewer-status-clear (soft)
- **AI capabilities**: procedure-suggestions, sample-rationale-wording, missing-procedure-coverage
- **Prerequisite**: Planning strategy phase must be complete

### Execution Testing (Phase 11)
- **Page**: `client/src/pages/execution-testing.tsx` — dedicated standalone page with 5 tabs
- **Tabs**: Dashboard, Procedures, Testing, Workpapers, Review
- **Features**: Phase overview header with 6 stat cards (total/completed/in-progress/not-started/workpapers/exceptions), execution % composite, gate warnings for ISA 230/330/450/500/220 compliance; FS area execution progress; per-procedure detail with risk/assertion/sample linkage; control vs substantive testing breakdown; workpaper documentation status with missing workpaper alerts; reviewer panel with awaiting-review/missing-conclusions/review-note tracking
- **Backend**: `server/planningRoutes.ts` — GET `/api/planning/:engagementId/execution-stats` returns procedure execution progress, test counts, misstatements, review notes, evidence files, FS area execution breakdown, and full procedure details
- **Gates**: procedures-executed (hard), workpapers-documented (hard), critical-exceptions-resolved (hard), conclusions-documented (hard), review-notes-cleared (soft), evidence-attached (soft)
- **AI capabilities**: execution-documentation-narration, test-result-summary, exception-wording, conclusion-draft
- **Prerequisite**: Procedures & Sampling phase must be complete

### Evidence Linking (Phase 12)
- **Page**: `client/src/pages/evidence-linking.tsx` — dedicated standalone page with 6 tabs
- **Tabs**: Dashboard, Evidence Vault, Procedure Linkage, Categorization, Version History, Reviewer Panel
- **Features**: Phase overview header with 6 stat cards (active files/linked procs/WP links/categorized/sufficient/linkage%), gate warnings for ISA 500/230/220 compliance; evidence-by-source-type breakdown (ISA 500 hierarchy); sufficiency assessment dashboard; missing evidence alerts for unlinked procedures; drag/drop file upload zone; filterable evidence table with source type/sufficiency/phase filters; procedure-evidence linkage matrix showing linked/unlinked status; workpaper-evidence link tracking; categorization with auto-categorize AI button; file version history with supersession tracking; traceability chips showing where each file is used (procedures/workpapers/assertions); reviewer panel with review status/sufficiency ratings/unaddressed comments
- **Backend**: `server/planningRoutes.ts` — GET `/api/planning/:engagementId/evidence-linking-stats` returns evidence file counts, linked/unlinked procedures, workpaper evidence links, sufficiency ratings, source type breakdown, version stats, by-phase and by-sufficiency breakdowns, and full evidence list with linked procedures/workpapers
- **Gates**: evidence-linked (hard), evidence-categorized (hard), sufficiency-confirmed (hard), version-history-maintained (soft), reviewer-comments-addressed (soft)
- **AI capabilities**: evidence-sufficiency-prompts, missing-evidence-alerts, evidence-description-suggestions
- **Prerequisite**: Execution Testing phase must be complete

### Observations & Findings (Phase 13)
- **Page**: `client/src/pages/observations.tsx` — dedicated standalone page
- **Features**: Full CRUD for observations, management response/auditor conclusion workflow, severity/type/status badges, FS head linkage, effect amount tracking, filter/sort/search, waiver workflow, ISA 265/450 compliance badge
- **Extended Types**: MISSTATEMENT, CONTROL_DEFICIENCY, MATERIAL_WEAKNESS, SIGNIFICANT_DEFICIENCY, AUDIT_FINDING, PJE_RECLASS, MANAGEMENT_POINT, COMPLIANCE_ISSUE, OTHER
- **Extended Statuses**: OPEN, UNDER_REVIEW, MGMT_RESPONDED, PENDING_CLEARANCE, CLEARED, ADJUSTED, CARRIED_FORWARD, WAIVED, CLOSED
- **New Fields**: title (optional descriptive heading), riskImplication, recommendation
- **Backend**: `server/observationRoutes.ts` — CRUD, management-response, auditor-conclusion, clear, waive, review, delete endpoints
- **Gates**: critical-findings-resolved (hard), observation-evidence-linked (hard), management-responses-obtained (hard), observations-reviewed (soft), observations-partner-approved (hard)
- **AI capabilities**: recommendation-wording
- **Prerequisite**: Evidence Linking phase must be complete

### Adjustments & Misstatements (Phase 14)
- **Page**: `client/src/pages/adjustments.tsx` — dedicated standalone page with 4 tabs
- **Tabs**: Dashboard, Journal Entries, SAD Summary, Review
- **Features**: Adjustment CRUD with journal entry format (debit/credit), misstatement classification (Factual/Judgmental/Projected per ISA 450), clearly trivial threshold assessment, materiality comparison with progress bar, management acceptance/dispute workflow, reviewer panel, phase gate compliance warnings, cumulative effect assessment, SAD (Summary of Audit Differences) split view
- **Backend**: `server/auditAdjustmentRoutes.ts` — CRUD, management-accept, review, stats/summary endpoints
- **API mount**: `/api/audit-adjustments`
- **Stats endpoint**: `GET /api/audit-adjustments/:engagementId/stats/summary` (registered before `/:id` to avoid route conflict)
- **Gates**: adjustments-summarized (hard), sad-classified (hard), sad-reviewed (hard), management-acceptance-recorded (hard), cumulative-effect-assessed (hard), adjustments-reviewed (soft), adjustments-partner-approved (hard)
- **AI capabilities**: adjustment-narrative, sad-summary-narration
- **Prerequisite**: Observations phase must be complete

### Finalization / Completion (Phase 15)
- **Page**: `client/src/pages/finalization.tsx` — comprehensive completion phase with 14 tabs
- **Tabs**: Control Board (with completion dashboard), Adjusted FS, Completion Checklist, Subsequent Events, Going Concern, Legal & Claims, Related Parties, Disclosure Review, Representation Letter, Final Analytics, Final Conclusion, Completion Memo, Partner Review Readiness, Lock Gate
- **Backend**: `server/finalizationRoutes.ts` — CRUD for subsequent events, going concern, representations, completion memo, checklists + finalization-stats endpoint
- **Stats endpoint**: `GET /api/finalization/:engagementId/finalization-stats` (completion progress, findings/adjustments status, report readiness)
- **Gates**: completion-checklist, subsequent-events, going-concern, representation-letter, findings-addressed, required-signoffs, disclosure-reviewed, final-analytics-done, completion-memo-done, partner-review-ready (10 gates total)
- **AI capabilities**: completion-memo-drafting, subsequent-events-narration, going-concern-wording, unresolved-matters-summary
- **Enhanced gate enforcement**: checks observations/adjustments status, required manager+partner sign-offs, checklist completion

### Opinion / Reports (Phase 16)
- **Page**: `client/src/pages/opinion-reports.tsx` — dedicated 9-tab reporting phase
- **Tabs**: Dashboard, Report Type & Opinion (ISA 700/705), Emphasis/Other Matter (ISA 706/720), Key Audit Matters (ISA 701), FS Pack Readiness, Management Letter (ISA 265), Deliverables Checklist, Report Package, Release Controls
- **Backend**: `server/opinionEngineRoutes.ts` — opinion engine, deliverables CRUD, opinion-reports-stats endpoint
- **Stats endpoint**: `GET /api/opinion-engine/:engagementId/opinion-reports-stats` (opinion status, deliverables progress, KAMs, control deficiencies, release readiness)
- **Gates**: finalization-approved, opinion-determined, basis-documented, kam-documented, fs-pack-ready, management-letter-done, deliverables-checklist-complete, report-package-generated, release-approved (9 gates)
- **AI capabilities**: report-drafting-support, basis-paragraph-support, management-letter-wording, deliverable-summary
- **Features**: AI Opinion Engine (reused from finalization), deliverables register with CRUD/upload/approval/issuance workflow, readiness checklist, release controls with partner-only issuance
- **Routing**: `App.tsx` routes `/workspace/:engagementId/opinion-reports` to `OpinionReportsPage` (previously routed to `PrintView`/print-view.tsx)

### EQCR Review (Phase 17)
- **Page**: `client/src/pages/eqcr.tsx` — 7-tab EQCR review phase (Dashboard, Open Matters, Report Pack Review, Key Judgments, Independence Summary, EQCR Checklist, Clearance & Conclusion)
- **Backend**: `server/eqcrRoutes.ts` — EQCR CRUD, assignment, checklist items, comments (IDOR-protected), partner comments, signed report upload, AI summary generation, unresolved issues summary, stats endpoint
- **Stats endpoint**: `GET /api/eqcr/:engagementId/stats` (completion progress, open comments, clearance status, finalization state)
- **Gates**: report-pack-frozen (real: checks finalized deliverables), eqcr-issues-resolved (real: checks open comments + unremarked NO items), eqcr-release (real: checks isFinalized + clearance status)
- **AI capabilities**: eqcr-readiness-summary, eqcr-unresolved-issues-summary
- **Security**: All mutating routes enforce finalization lock server-side; comment respond/clear routes verify comment belongs to engagement's assignment (IDOR protection)
- **Navigation**: backHref → opinion-reports, nextHref → inspection

### Inspection Archive (Phase 18)
- **Page**: `client/src/pages/inspection.tsx` — 8-tab archive phase (Dashboard, Final Reports, Key Documents, Audit Trail, Working Papers, Review History, Archive Index, Export & Release)
- **Backend**: `server/inspectionRoutes.ts` — stats, readiness scoring, archive lifecycle (build/seal/release), archive index generation, final reports, review history, working papers, audit trail, export logs, AI analysis endpoints
- **Prisma models**: `ArchivePackage` (status: PENDING→BUILDING→SEALED→RELEASED, archiveIndex, packageManifest, frozenSnapshot, packageHash), reuses `InspectionReadiness`, `ExportLog`
- **Gates**: eqcr-released (real), archive-readiness-checked (real: ≥80% readiness), archive-sealed (real: checks archive status), archive-index-generated (soft), archive-released (real: checks RELEASED status)
- **AI capabilities**: archive-completeness-analysis, inspection-gap-summary
- **Immutability**: After seal, all mutating routes blocked via `enforceArchiveImmutability()`; release transitions engagement status to ARCHIVED
- **Archive Index**: Structured by sections (A-F) with ISA references for AOB/ICAP regulator retrieval
- **Navigation**: backHref → eqcr (final phase in workflow)

## Feature Status

- ISA 320 Materiality: Complete
- ISA 520 Analytical Procedures: Complete
- Compliance Checklists: Complete (bulk Excel/CSV upload, template download, evidence attachments)
- Data Intake: Complete (TB, GL, AR, AP, Bank import with reconciliation)
- Risk Assessment: Complete (8-tab focused view, status overview, AI support, 7 gates)
- Planning Strategy: Complete (7-tab focused view, status overview, prerequisite enforcement, AI support, 4 gates)
- Procedures & Sampling: Complete (4-tab focused view, risk-procedure matrix, audit program designer, ISA 530 sampling, assertion coverage, 6 gates)
- Execution Testing: Complete (5-tab focused view, procedure execution, control/substantive testing, workpapers, reviewer panel, 6 gates, 4 AI capabilities)
- Evidence Linking: Complete (6-tab focused view, evidence vault, procedure linkage, categorization, version history, reviewer panel, 5 gates, 3 AI capabilities)
- Observations & Findings: Complete (extended 9-type/9-status system, title/risk/recommendation fields, management response workflow, 5 gates, 1 AI capability)
- Adjustments & Misstatements: Complete (4-tab view, journal entries, SAD summary, misstatement classification, trivial threshold, management acceptance, materiality comparison, 7 gates, 2 AI capabilities)
- Execution Module: Working paper system with FS head mapping
- Review Notes: Complete with notifications
- Document Management: Complete with S3/local storage
- Multi-tenant: Firm-based isolation with RLS
- Acceptance & Continuance: Complete (8-section form, partner approval, AI, audit trail)
- Independence / Ethics: Complete (8-section form, declaration tracking, partner approval, AI, audit trail)
- TB/GL Upload: Complete (batch tracking, source/period tagging, import logs, template checks)
- Validation & Parsing: Complete (structured results panel, AI analysis, blocker enforcement)
- Finalization / Completion: Complete (11-section completion phase, 14-tab UI, completion dashboard, enhanced gate enforcement with 10 gates, 4 AI capabilities, partner review readiness tracking)
- Opinion / Reports: Complete (9-tab reporting phase, ISA 700/701/705/706/265 coverage, AI opinion engine, deliverables register, 9 gates, 4 AI capabilities, release controls)
- EQCR Review: Complete (7-tab focused view: Dashboard, Open Matters, Report Pack, Key Judgments, Independence, EQCR Checklist, Clearance & Conclusion; 3 real gate evaluators, 2 AI capabilities, IDOR-protected comment routes, finalization lock enforcement)
- Inspection Archive: Complete (8-tab view: Dashboard, Final Reports, Key Documents, Audit Trail, Working Papers, Review History, Archive Index, Export & Release; 5 real gate evaluators, 2 AI capabilities, immutable archive lifecycle PENDING→BUILDING→SEALED→RELEASED, archive indexing for regulators, active/archived engagement separation)
