# Field Engine Mapping Document

## Overview
This document maps existing infrastructure for the Field Registry + Fetch Engine system.

## Existing Tables/Services

### Database Tables (Prisma)

| Table | Purpose | Location |
|-------|---------|----------|
| `RequiredFieldBlueprint` | Field definitions/metadata | `prisma/schema.prisma:9633` |
| `RequiredFieldInstance` | Field values per engagement | `prisma/schema.prisma:9667` |
| `FieldAuditLog` | Audit trail for field changes | `prisma/schema.prisma:9722` |
| `ModuleReadiness` | Module completion tracking | `prisma/schema.prisma:9752` |
| `Engagement` | Main engagement entity | `prisma/schema.prisma:1010` |
| `FSHeadWorkingPaper` | FS Head working papers | `prisma/schema.prisma:9210` |
| `TrialBalance` / `TrialBalanceLine` | Trial Balance data | `prisma/schema.prisma` |
| `GLBatch` / `GLEntry` | General Ledger data | `prisma/schema.prisma` |
| `TBGLMapping` | TB to GL mapping | `prisma/schema.prisma` |
| `FSMapping` / `FSCaption` | FS mapping data | `prisma/schema.prisma` |
| `ExternalConfirmation` | AR/AP/Bank confirmations | `prisma/schema.prisma:3913` |
| `ImportBatch` / `ImportStagingRow` | Single-file import data | `prisma/schema.prisma` |

### Source Data Tables for Fetch Engine

| Source | Tables | Key Fields |
|--------|--------|------------|
| Trial Balance | `TBBatch`, `TBEntry` | accountCode, closingBalance, openingBalance |
| General Ledger | `GLBatch`, `GLEntry` | accountCode, debit, credit, voucherNo, date |
| FS Mapping | `TBGLMapping` | accountCode, fsHead, closingBalance |
| Parties | `ImportStagingRow` (CB_PARTY) | partyCode, partyType, closingDebit/Credit |
| Banks | `ImportStagingRow` (BANK_MASTER, CB_BANK) | bankCode, accountNumber, balance |
| Confirmations | `ExternalConfirmation` | confirmationType, balance, status |

### Phase Screens (UI)

| Phase | Page Component | Path |
|-------|---------------|------|
| Information Requisition | `InformationRequisition.tsx` | `client/src/pages/information-requisition.tsx` |
| Pre-Planning | `PrePlanning.tsx` | `client/src/pages/pre-planning.tsx` |
| Planning | `Planning.tsx` | `client/src/pages/planning.tsx` |
| Execution | `Execution.tsx` | `client/src/pages/execution.tsx` |
| FS Heads | `FsHeadWorkingPaper.tsx` | `client/src/pages/fs-head-working-paper.tsx` |
| Finalization | `Finalization.tsx` | `client/src/pages/finalization.tsx` |

### Existing Services

| Service | File | Purpose |
|---------|------|---------|
| Field Orchestration | `server/services/fieldOrchestrationService.ts` | Push router, readiness calculation |
| Field Blueprints | `server/fieldBlueprints.ts` | Field definition seeds |
| Field Routes | `server/fieldOrchestrationRoutes.ts` | API endpoints |

## Current Capabilities

### What Already Exists

1. **Field Definition System**
   - `RequiredFieldBlueprint`: module, tab, fieldKey, label, fieldType, required, dataSource
   - Supports: USER_INPUT, TB_UPLOAD, GL_UPLOAD, FS_MAPPING, COMPUTED

2. **Field Value Storage**
   - `RequiredFieldInstance`: stores values per engagement
   - Sign-off levels: NONE, PREPARED, REVIEWED, APPROVED
   - Override tracking with reason

3. **Push Router**
   - Auto-populates fields from TB/GL/Mapping data
   - Supports INFORMATION_REQUISITION, PRE_PLANNING, PLANNING, EXECUTION, FS_HEADS, FINALIZATION

4. **Module Readiness**
   - Calculates completion percentage per module
   - Tracks missing fields and blocks

### What Needs Enhancement

1. **Fetch Rules Table** (NEW)
   - Configurable data fetching rules (currently hardcoded)
   - Support for SQL/SERVICE/COMPUTED sources
   - Drilldown configuration

2. **Scope Types** (ENHANCE)
   - Add FS_HEAD, PROCEDURE, CONFIRMATION scopes
   - Current: Only ENGAGEMENT scope (via module/tab)

3. **Standard Fetch Rules** (NEW)
   - TB_OPENING_BY_ACCOUNT, TB_CLOSING_BY_ACCOUNT
   - GL_MOVEMENT_SUM, FS_HEAD_BALANCE
   - CONFIRMATION_POPULATION rules
   - YOY_VARIANCE, BENCHMARK_RATIOS

4. **UI Dynamic Rendering** (ENHANCE)
   - Load field definitions from API
   - Render forms dynamically
   - View Source / Drilldown links
   - Refresh button for auto fields

## Implementation Plan

### Phase 1: Schema Enhancement
- Add `FetchRule` model to Prisma
- Add `scopeType` and `scopeId` to field models
- Add drilldown configuration

### Phase 2: Fetch Engine
- Create standard fetch rules as seed data
- Implement computeFieldValue for each rule type
- Add refresh capability

### Phase 3: Field Definitions
- Seed comprehensive field definitions per phase
- Include FS_HEAD and CONFIRMATION scope fields

### Phase 4: UI Integration
- Create DynamicFieldRenderer component
- Add View Source / Drilldown functionality
- Integrate with phase pages

## Phase Codes

```typescript
enum AuditPhaseCode {
  INFORMATION_REQUISITION = "INFORMATION_REQUISITION",
  PRE_PLANNING = "PRE_PLANNING", 
  PLANNING = "PLANNING",
  EXECUTION = "EXECUTION",
  FS_HEADS = "FS_HEADS",
  FINALIZATION = "FINALIZATION"
}
```

## Scope Types

```typescript
enum FieldScopeType {
  ENGAGEMENT = "ENGAGEMENT",     // One per engagement
  FS_HEAD = "FS_HEAD",           // Repeat per FS head
  PROCEDURE = "PROCEDURE",       // Repeat per audit procedure
  CONFIRMATION = "CONFIRMATION"  // Repeat per confirmation
}
```
