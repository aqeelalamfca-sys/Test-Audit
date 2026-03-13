# Objective
Post-canonical-phase cleanup: remove redundancies, fix duplicates, standardize UI, add UX polish across all phase pages.

# Tasks

### T001: Remove redundant components and consolidate duplicates — COMPLETE
- **Status**: DONE
- **Changes**:
  - PhaseApprovalControl/PhaseLockIndicator imports removed from planning, evidence-linking, evidence-vault, finalization
  - PhaseLockIndicator JSX removed from finalization (replaced by SignOffBar in PageShell)
  - Legacy `status-badge.tsx` converted to re-export bridge from `ui/status-badge.tsx`
  - All specialized badges (PhaseStatusBadge, ChecklistStatusBadge, RiskBadge, IsaReferenceBadge, RoleBadge) consolidated into `ui/status-badge.tsx`
  - visual-indicators StatusBadge renamed to EntityStatusBadge (alias kept for backward compat)

### T002: Fix duplicate save buttons and action bars — COMPLETE
- **Status**: DONE
- **Changes**:
  - Audited all pages — confirmed contextual section saves (EQCR conclusion, planning panels) are legitimate sub-section saves, not duplicates of PageShell action bar
  - No actual duplicate save buttons found; pages correctly use save bridges for PageShell integration

### T003: Standardize button naming, status chips, page titles, section naming — COMPLETE
- **Status**: DONE
- **Changes**:
  - engagement-control ROUTE_LABELS updated to all 18 canonical phase names
  - Badge components consolidated under canonical ui/status-badge.tsx

### T004: Update legacy internal links to canonical slugs — COMPLETE
- **Status**: DONE
- **Changes**:
  - Fixed backHref/nextHref in: pre-planning, execution, finalization, evidence-vault, tb-review, print-view
  - Server resumeRoute updated: default route changed from pre-planning to acceptance
  - Valid route patterns expanded to include all 18 canonical slugs
  - engagement-control ROUTE_LABELS updated to canonical slugs

### T005: UX polish — sticky headers, collapsible sections, empty states, validation — COMPLETE
- **Status**: DONE (PageShell already has sticky headers, EmptyState component already exists)
- **Changes**:
  - Verified PageShell has sticky header with backdrop blur
  - Verified EmptyState component exists with variants (NoData, NoItems, NoSearchResults, Error, skeleton loaders)
  - Observations page already has proper empty state handling
