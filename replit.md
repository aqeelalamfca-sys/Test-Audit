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

## Deployment

- Target: autoscale
- Build: `npm run build`
- Run: `node dist/index.cjs`

## Phase Architecture (19-Phase System)

The canonical audit workflow uses 19 phases defined in `shared/phases.ts` (single source of truth). The phases are grouped into 6 categories:

- **Onboarding** (0-3): client-creation, engagement-setup, acceptance, independence
- **Data Import** (4-6): tb-gl-upload, validation, coa-mapping
- **Planning** (7-9): materiality, risk-assessment, planning-strategy
- **Fieldwork** (10-14): procedures-sampling, execution-testing, evidence-linking, observations, adjustments
- **Completion** (15-16): finalization, opinion-reports
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

### AI Phase Orchestration
- `server/services/aiPhaseOrchestrator.ts` — Maps each canonical phase to AI capabilities
- API: `GET /api/ai/phase/:phaseKey/capabilities`, `GET /api/ai/phases/capabilities`, `POST /api/ai/phase/:phaseKey/generate`
- Frontend: `client/src/hooks/use-phase-ai.ts` — `usePhaseAI(phaseKey)` hook for phase-aware AI
- 18 phases have AI capabilities (only inspection does not)
- Existing AI services retained: `aiService.ts`, `aiCopilotService.ts`, `aiAuditUtilities.ts`

### Legacy Engines (Deprecated, Retained)
- `server/services/auditChainStateMachine.ts` — @deprecated, use phaseGateEngine.ts
- `server/services/enforcementEngine.ts` — @deprecated, use phaseGateEngine.ts
- `server/services/workflowOrchestrator.ts` — @deprecated, use phaseGateEngine.ts
- `server/services/phaseEngine.ts` — @deprecated, use phaseGateEngine.ts

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

## Feature Status

- ISA 320 Materiality: Complete
- ISA 520 Analytical Procedures: Complete
- Compliance Checklists: Complete (bulk Excel/CSV upload, template download, evidence attachments)
- Data Intake: Complete (TB, GL, AR, AP, Bank import with reconciliation)
- Planning Module: 16 ISA-linked tabs (A-P)
- Execution Module: Working paper system with FS head mapping
- Review Notes: Complete with notifications
- Document Management: Complete with S3/local storage
- Multi-tenant: Firm-based isolation with RLS
- Acceptance & Continuance: Complete (8-section form, partner approval, AI, audit trail)
- Independence / Ethics: Complete (8-section form, declaration tracking, partner approval, AI, audit trail)
