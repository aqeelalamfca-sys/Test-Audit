# ISQM-1 Firm-Wide Control Register — AuditWise

> Comprehensive quality management control register aligned with ISQM 1 (International Standard on Quality Management).

## 1. Governance & Leadership

| Control ID | Domain | Control Description | System Component | Status |
|---|---|---|---|---|
| ISQM-GOV-001 | Leadership | Quality management partner designation | isqmRoutes.ts - governance endpoints | ✅ Active |
| ISQM-GOV-002 | Leadership | Annual quality affirmation by leadership | isqmRoutes.ts - leadership affirmations | ✅ Active |
| ISQM-GOV-003 | Leadership | Quality management committee tracking | isqmRoutes.ts - committee management | ✅ Active |
| ISQM-GOV-004 | Leadership | Firm-wide quality policy documentation | Firm settings, policy storage | ✅ Active |

## 2. Ethical Requirements

| Control ID | Domain | Control Description | System Component | Status |
|---|---|---|---|---|
| ISQM-ETH-001 | Ethics | Independence declaration per engagement | Ethics & Independence module | ✅ Active |
| ISQM-ETH-002 | Ethics | Independence confirmation tracking | ethicsRoutes.ts | ✅ Active |
| ISQM-ETH-003 | Ethics | Conflict of interest screening | Pre-planning acceptance/continuance | ✅ Active |
| ISQM-ETH-004 | Ethics | Ethics breach monitoring dashboard | ISQM dashboard - ethics metrics | ✅ Active |

## 3. Acceptance & Continuance

| Control ID | Domain | Control Description | System Component | Status |
|---|---|---|---|---|
| ISQM-AC-001 | Client Acceptance | Client risk assessment before acceptance | Pre-planning gates, acceptance decisions | ✅ Active |
| ISQM-AC-002 | Client Acceptance | Independence clearance before engagement | Enforcement engine gate check | ✅ Active |
| ISQM-AC-003 | Client Acceptance | Partner approval for high-risk clients | Sign-off authority matrix | ✅ Active |
| ISQM-AC-004 | Client Acceptance | Annual continuance review | Engagement lifecycle state machine | ✅ Active |

## 4. Engagement Performance

| Control ID | Domain | Control Description | System Component | Status |
|---|---|---|---|---|
| ISQM-EP-001 | Performance | Phase-gated engagement workflow | auditChainStateMachine.ts (9 phases) | ✅ Active |
| ISQM-EP-002 | Performance | Mandatory sign-off at each level | signOffAuthority.ts (Prepared/Reviewed/Approved) | ✅ Active |
| ISQM-EP-003 | Performance | Partner review before finalization | Lock-gate system, enforcement engine | ✅ Active |
| ISQM-EP-004 | Performance | Immutable audit trail for all actions | auditLogService.ts, PlatformAuditLog | ✅ Active |
| ISQM-EP-005 | Performance | Document locking post-approval | auditLock.ts middleware | ✅ Active |
| ISQM-EP-006 | Performance | Evidence sufficiency monitoring | AI copilot evidence checks | ✅ Active |
| ISQM-EP-007 | Performance | Risk-response alignment | riskProcedureAutoMapper.ts, linkageEngineService.ts | ✅ Active |

## 5. Resources

| Control ID | Domain | Control Description | System Component | Status |
|---|---|---|---|---|
| ISQM-RES-001 | Resources | Team assignment with role enforcement | Engagement team management, RBAC | ✅ Active |
| ISQM-RES-002 | Resources | Training hours tracking | ISQM dashboard - training metrics | ✅ Active |
| ISQM-RES-003 | Resources | Technology resource management | Platform AI config, firm settings | ✅ Active |

## 6. Information & Communication

| Control ID | Domain | Control Description | System Component | Status |
|---|---|---|---|---|
| ISQM-IC-001 | Communication | Review notes and feedback system | Review notes module | ✅ Active |
| ISQM-IC-002 | Communication | Management letter generation | Management letter module | ✅ Active |
| ISQM-IC-003 | Communication | Audit report communication | Audit report module, deliverables | ✅ Active |

## 7. Monitoring & Remediation

| Control ID | Domain | Control Description | System Component | Status |
|---|---|---|---|---|
| ISQM-MON-001 | Monitoring | File inspection program | isqmRoutes.ts - file inspections | ✅ Active |
| ISQM-MON-002 | Monitoring | Inspection ratings (Satisfactory/Unsatisfactory) | isqmRoutes.ts - inspection results | ✅ Active |
| ISQM-MON-003 | Monitoring | Deficiency tracking and remediation | isqmRoutes.ts - monitoring deficiencies | ✅ Active |
| ISQM-MON-004 | Monitoring | Root cause analysis tracking | isqmRoutes.ts - remediation tracking | ✅ Active |
| ISQM-MON-005 | Monitoring | Annual monitoring plan | isqmRoutes.ts - monitoring plans | ✅ Active |

## 8. ISQM 2 / Engagement Quality Review

| Control ID | Domain | Control Description | System Component | Status |
|---|---|---|---|---|
| ISQM-EQR-001 | EQR | EQCR assignment and tracking | EQCR module, eqcrRoutes.ts | ✅ Active |
| ISQM-EQR-002 | EQR | EQCR checklist completion | EQCR checklist items | ✅ Active |
| ISQM-EQR-003 | EQR | EQCR comments and resolution | EQCR comments management | ✅ Active |
| ISQM-EQR-004 | EQR | EQR independence from engagement team | Role-based access control | ✅ Active |

## Register Statistics
- **Total Controls**: 33
- **Active**: 33 (100%)
- **Inactive**: 0
- **Missing**: 0
