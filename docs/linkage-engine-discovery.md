# Linkage Engine Discovery Document

## Executive Summary
This document maps existing entities in AuditWise and identifies gaps for implementing the End-to-End Audit Linkage Engine that connects FS Heads → TB/GL → Risks → Materiality → Procedures → Sampling → Evidence → Adjustments → Final FS.

## Existing Entities

### 1. FS Head Structure
| Entity | Status | Notes |
|--------|--------|-------|
| `FSHeadWorkingPaper` | EXISTS | Comprehensive model with balances, materiality refs, risk levels, procedure completion flags |
| `FSHeadProcedure` | EXISTS | Generic procedure with assertions, risk level, results, conclusion |
| `FSHeadTOC` | EXISTS | Test of Controls specific fields |
| `FSHeadTOD` | EXISTS | Test of Details specific fields |
| `FSHeadAnalyticalProcedure` | EXISTS | Analytics with expectation, variance, threshold |
| `FSHeadAdjustment` | EXISTS | Adjustments linked to FS heads with maker-checker |
| `FSHeadReviewPoint` | EXISTS | Review comments per FS head |
| `FSHeadAttachment` | EXISTS | Evidence attachments |

### 2. Materiality
| Entity | Status | Notes |
|--------|--------|-------|
| `MaterialityAssessment` | EXISTS | Engagement-level materiality with benchmarks |
| `MaterialityCalculation` | EXISTS | Calculation details with PM, trivial threshold |
| `MaterialityOverride` | EXISTS | Partner override capability |
| `MaterialityAuditLog` | EXISTS | Audit trail for materiality changes |
| **Materiality Allocation per FS Head** | PARTIAL | FSHeadWorkingPaper has PM fields but no dedicated allocation table |

### 3. Risk Assessment
| Entity | Status | Notes |
|--------|--------|-------|
| `RiskAssessment` | EXISTS | Risk register with inherent/control risk, assertions, fraud risk |
| `RiskOverrideRequest` | EXISTS | Risk override workflow |
| **Risk-to-Procedure Linking** | GAP | No explicit linked_risk_ids on procedures |

### 4. Sampling & Population
| Entity | Status | Notes |
|--------|--------|-------|
| `SampleItem` | EXISTS | Individual sample items |
| `SubstantiveTest` | EXISTS | Test with sample size, method |
| **PopulationDefinition** | GAP | No dedicated population definition table with query/filter storage |
| **Population-to-GL Linking** | GAP | Sample items not linked to GL journal lines |

### 5. External Confirmations
| Entity | Status | Notes |
|--------|--------|-------|
| `ExternalConfirmation` | EXISTS | Confirmation with party, balance, status, follow-ups |
| **Confirmation Population** | GAP | No auto-population from CB_PARTY/CB_BANK |

### 6. Adjustments & Misstatements
| Entity | Status | Notes |
|--------|--------|-------|
| `Misstatement` | EXISTS | Misstatement register with source, amount |
| `AuditAdjustment` | EXISTS | Adjustment entries |
| `FSHeadAdjustment` | EXISTS | FS head level adjustments |
| **Adjusted TB/FS Computation** | GAP | No automatic flow to adjusted balances |

### 7. Trial Balance & GL
| Entity | Status | Notes |
|--------|--------|-------|
| `TrialBalance` | EXISTS | TB header |
| `TrialBalanceLine` | EXISTS | TB line items |
| `TBMapping` | EXISTS | Account to FS mapping |
| `FSMapping` | EXISTS | FS structure mapping |
| `ImportJournalHeader/Line` | EXISTS | GL journal entries |
| `GLBatch` | EXISTS | GL batches |

### 8. Audit Trail & Approvals
| Entity | Status | Notes |
|--------|--------|-------|
| `AuditTrail` | EXISTS | Comprehensive audit logging |
| `SignOffRegister` | EXISTS | Prepared/Reviewed/Approved workflow |
| `SectionSignOff` | EXISTS | Section-level sign-offs |
| `MakerCheckerWorkflow` | EXISTS | Maker-checker controls |

### 9. Procedure Library
| Entity | Status | Notes |
|--------|--------|-------|
| `MasterProcedureLibrary` | EXISTS | Template procedures |
| `EngagementProcedure` | EXISTS | Engagement-specific procedures |
| **FS Head-Specific Templates** | PARTIAL | Need ISA-aligned templates per FS head/assertion |

## Identified Gaps

### A. Population Management (Priority: HIGH)
```prisma
model PopulationDefinition {
  id                String   @id @default(uuid())
  engagementId      String
  procedureId       String?
  fsHeadId          String?
  
  sourceType        PopulationSourceType  // GL, TB, SUBLEDGER, CONFIRMATION
  filterJson        Json                   // Account codes, date range, party type
  queryHash         String?                // For reproducibility
  
  populationCount   Int?
  populationValue   Decimal?
  
  builtAt           DateTime?
  builtById         String?
}

model PopulationItem {
  id                String   @id @default(uuid())
  populationId      String
  
  sourceType        String   // GL_LINE, TB_LINE, PARTY, BANK
  sourceId          String   // Reference to source record
  amount            Decimal
  documentRef       String?
  
  isSelected        Boolean  @default(false)  // For sampling
}
```

### B. Linkage Keys Enhancement (Priority: HIGH)
Add to existing models:
- `linked_risk_ids[]` on FSHeadProcedure, FSHeadTOC, FSHeadTOD
- `linked_procedure_id` on SampleItem, EvidenceFile, Misstatement
- `source_refs_json` on all artifacts for drilldown support
- `population_id` on Sample-related entities

### C. Materiality Allocation (Priority: MEDIUM)
```prisma
model MaterialityAllocation {
  id                String   @id @default(uuid())
  engagementId      String
  fsHeadId          String
  
  allocatedPM       Decimal
  allocatedPercent  Decimal?
  rationale         String?
  
  isAutoCalculated  Boolean  @default(true)
  overrideById      String?
  overrideReason    String?
}
```

### D. Analytics Test Enhancement (Priority: MEDIUM)
Extend FSHeadAnalyticalProcedure with:
- `linked_risk_ids[]`
- `linked_misstatement_id` (if variance leads to misstatement)
- `source_refs_json` for expectation data sources

### E. Confirmation Population (Priority: MEDIUM)
Add confirmation population builder from:
- CB_PARTY for AR/AP confirmations
- CB_BANK/BANK_MASTER for bank confirmations
- Reconciliation to TB control accounts

## Proposed Re-use vs New Tables

### RE-USE (Extend Existing)
1. `FSHeadWorkingPaper` - Add population_id, linked_risk_ids[]
2. `FSHeadProcedure` - Add linked_risk_ids[], population_id
3. `FSHeadAnalyticalProcedure` - Add linked_risk_ids[], source_refs_json
4. `SampleItem` - Add population_item_id, linked_procedure_id
5. `ExternalConfirmation` - Add population_id, reconciled_amount
6. `Misstatement` - Add source_procedure_id, source_sample_item_id

### NEW TABLES (Minimal)
1. `PopulationDefinition` - Population query and metadata
2. `PopulationItem` - Individual items in a population
3. `MaterialityAllocation` - Per-FS-head PM allocation
4. `LinkageRegistry` - Central registry of all linkages for quick lookups

## Implementation Priority

1. **Phase 1**: Population Management + Linkage Keys
2. **Phase 2**: LinkageEngine Service Core Methods
3. **Phase 3**: UI Integration (Linked Panels)
4. **Phase 4**: Quality Gates + Auto-linking Rules
5. **Phase 5**: Procedure Library Seeding

## API Routes (Existing to Extend)
- `/api/fs-heads` - fsHeadRoutes.ts
- `/api/sampling` - samplingRoutes.ts
- `/api/planning` - planningRoutes.ts (materiality, risk)
- `/api/substantive` - substantiveRoutes.ts
- `/api/evidence` - evidenceRoutes.ts
- `/api/finalization` - finalizationRoutes.ts

## UI Pages (Existing to Extend)
- `fs-heads.tsx` - Main FS head execution page
- `planning.tsx` - Risk and materiality
- `execution.tsx` - Procedures execution
- `finalization.tsx` - Final checks and lock
