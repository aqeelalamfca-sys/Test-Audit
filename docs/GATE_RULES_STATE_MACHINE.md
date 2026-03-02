# Gate Rules & State Machine — Canonical Audit Chain

**Project:** AuditWise Portal
**Date:** 2026-02-08
**Source:** `server/services/auditChainStateMachine.ts`, `server/middleware/auditLock.ts`, `server/services/enforcementEngine.ts`

---

## 1. Canonical Phase Order

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ ONBOARDING  │───>│ PRE_PLANNING │───>│ REQUISITION │───>│ PLANNING │
│   (Phase 0) │    │   (Phase 1)  │    │  (Phase 2)  │    │(Phase 3) │
└─────────────┘    └──────────────┘    └─────────────┘    └────┬─────┘
                                                               │
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───┴──────┐
│ INSPECTION  │<───│     EQCR     │<───│  REPORTING   │<───│EXECUTION │
│   (Phase 8) │    │   (Phase 7)  │    │  (Phase 6)   │    │(Phase 4) │
└─────────────┘    └──────────────┘    └──────────────┘    └───┬──────┘
                                                               │
                                       ┌──────────────┐       │
                                       │ FINALIZATION  │<──────┘
                                       │   (Phase 5)   │
                                       └───────────────┘
```

**AuditPhase Enum Values:** `ONBOARDING`, `PRE_PLANNING`, `REQUISITION`, `PLANNING`, `EXECUTION`, `FINALIZATION`, `REPORTING`, `EQCR`, `INSPECTION`

---

## 2. Phase Status Lifecycle

Each phase tracks status via the `PhaseProgress` model:

```
              start()              review()            approve()           lock()
NOT_STARTED ─────────> IN_PROGRESS ────────> UNDER_REVIEW ────────> COMPLETED ────────> LOCKED
                            │                                           │
                            └──────────── reopen() <────────────────────┘
                                        (Partner only)
```

| Status | Meaning | Editable | Can Advance |
|--------|---------|----------|-------------|
| `NOT_STARTED` | Phase has not begun | No | No |
| `IN_PROGRESS` | Active work underway | Yes | No |
| `UNDER_REVIEW` | Submitted for review | Read-only for preparer | No |
| `COMPLETED` | Approved and finalized | No (without unlock) | Yes |
| `LOCKED` | Permanently sealed | No | Yes |

---

## 3. Gate Rules by Phase Transition

### Gate Prerequisite Table

| Target Phase | Required Predecessor Status | Data Prerequisites | Gate Check Logic |
|-------------|---------------------------|--------------------|--------------------|
| ONBOARDING | None | None | Always allowed (entry point) |
| PRE_PLANNING | ONBOARDING = IN_PROGRESS or COMPLETED | Client master record exists | Onboarding active or complete |
| REQUISITION | PRE_PLANNING = IN_PROGRESS or COMPLETED | Pre-planning tabs signed off | Pre-planning active or complete |
| PLANNING | REQUISITION = IN_PROGRESS or COMPLETED | Trial balance uploaded; FS Heads mapped | Trial balance data present in DB |
| EXECUTION | PLANNING = COMPLETED | Materiality set; Risk assessment done; Audit procedures generated; Sampling plan defined | Planning must be fully COMPLETED (not just in-progress) |
| FINALIZATION | EXECUTION = COMPLETED | All procedures have conclusions; Evidence linked to all procedures | Execution fully complete |
| REPORTING | FINALIZATION = COMPLETED | FS draft compiled; AJE/RJE posted; Notes & disclosures prepared | Finalization fully complete |
| EQCR | REPORTING = COMPLETED | Audit report drafted; All sign-offs obtained | EQCR reviewer assigned; Reporting complete |
| INSPECTION | EQCR = COMPLETED | EQCR checklist completed; No open findings | All prior phases COMPLETED or LOCKED |

### Relaxed vs Strict Gates

- **Phases 0-3 (ONBOARDING → PLANNING):** Use "relaxed" gates — predecessor need only be `IN_PROGRESS` or `COMPLETED`. This allows parallel work.
- **Phases 4-8 (EXECUTION → INSPECTION):** Use "strict" gates — predecessor must be `COMPLETED` or `LOCKED`. Sequential completion required.

---

## 4. Enforcement Middleware Reference

### `server/middleware/auditLock.ts`

| Middleware | Purpose | Usage |
|-----------|---------|-------|
| `requirePhaseUnlocked(phase)` | Blocks writes if phase is LOCKED or COMPLETED | Apply to PUT/POST/DELETE routes that modify phase data |
| `requirePhaseInProgress(phase)` | Blocks writes if phase is NOT_STARTED or LOCKED | Apply to active-work endpoints |
| `requirePreviousPhasesCompleted(phase)` | Blocks access if any earlier phase is incomplete | Apply to phase entry endpoints |

### `server/middleware/enforcementMiddleware.ts`

| Middleware | Purpose | Usage |
|-----------|---------|-------|
| `requirePhaseAccess(phase)` | Full access check: phase gates + role + inspection mode | Primary gate for all phase-specific routes |
| `requireSignOff(action, entityType)` | Checks if user role can perform sign-off actions | Apply to FINALIZE, APPROVE, SIGN_OFF, POST, ISSUE actions |
| `requireMakerChecker(entityType)` | Enforces separation of duties (preparer != reviewer) | Apply to entities requiring dual approval |

---

## 5. Role-Based Access Rules

### Phase Access by Role

| Role | Phases Accessible | Special Permissions |
|------|------------------|-------------------|
| `ADMIN` | All phases | Can access even in inspection mode |
| `MANAGING_PARTNER` | All phases | Sign-off authority on all categories |
| `PARTNER` | All phases | Sign-off: FS, Risk, Adjustments, Conclusions, Deliverables |
| `EQCR` | EQCR, INSPECTION | Sign-off: QR/EQCR only |
| `MANAGER` | ONBOARDING → REPORTING | Sign-off: Procedure completion |
| `SENIOR` | ONBOARDING → FINALIZATION | Sign-off: Procedure completion |
| `STAFF` | ONBOARDING → EXECUTION | No sign-off authority |
| `TRAINEE` | ONBOARDING → EXECUTION | No sign-off authority, read-heavy |

### Sign-Off Authority Matrix

| Sign-Off Category | Authorized Roles |
|-------------------|-----------------|
| `FINANCIAL_STATEMENTS` | PARTNER, MANAGING_PARTNER, ADMIN |
| `RISK_ASSESSMENT` | PARTNER, MANAGING_PARTNER, ADMIN |
| `PROCEDURE_COMPLETION` | SENIOR, MANAGER, PARTNER, MANAGING_PARTNER, ADMIN |
| `ADJUSTMENTS_POSTING` | PARTNER, MANAGING_PARTNER, ADMIN |
| `CONCLUSIONS_OPINION` | PARTNER, MANAGING_PARTNER, ADMIN |
| `DELIVERABLES` | PARTNER, MANAGING_PARTNER, ADMIN |
| `QR_EQCR` | EQCR, ADMIN |

---

## 6. API Endpoints for Gate Status

### Audit Chain State Machine

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/link-integrity/:engId/chain` | Full chain validation: all 9 phase gate results, current phase, next available phase |
| GET | `/api/link-integrity/:engId/chain/:phase/gate` | Single phase gate check: allowed flag, blockers list, prerequisites |

### Phase Progress CRUD

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/progress/:engId` | All phase statuses for engagement |
| PATCH | `/api/progress/:engId/:phase` | Update phase status |
| POST | `/api/progress/:engId/:phase/lock` | Lock a phase (Partner+ only) |
| POST | `/api/progress/:engId/:phase/unlock` | Unlock a phase (Partner+ only) |

### Response Shapes

**Chain Validation Response:**
```json
{
  "engagementId": "uuid",
  "timestamp": "2026-02-08T...",
  "isValid": true,
  "currentPhase": "PLANNING",
  "nextAvailablePhase": "EXECUTION",
  "phases": [
    {
      "phase": "PLANNING",
      "allowed": true,
      "blockers": [],
      "prerequisites": []
    },
    {
      "phase": "EXECUTION",
      "allowed": false,
      "blockers": ["PLANNING must be COMPLETED"],
      "prerequisites": [
        { "phase": "PLANNING", "required": "COMPLETED", "current": "IN_PROGRESS" }
      ]
    }
  ]
}
```

**Single Gate Check Response:**
```json
{
  "allowed": false,
  "phase": "EXECUTION",
  "blockers": [
    "PLANNING must be COMPLETED",
    "Risk assessment not finalized"
  ],
  "prerequisites": [
    { "phase": "PLANNING", "required": "COMPLETED", "current": "IN_PROGRESS" }
  ]
}
```

---

## 7. Inspection Mode

When engagement reaches INSPECTION phase:
- All prior phases become **read-only**
- Only `ADMIN` role can access non-INSPECTION phases
- All write operations return `403` with `"Engagement is in inspection mode (read-only)"`
- ISA 230 reference: Documentation must be locked after report date
