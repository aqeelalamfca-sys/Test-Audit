---
title: Phase 1: Foundation & Core System Stabilization
---
# Foundation & Core System Stabilization

## What & Why
Scan the entire application architecture and fix core foundation issues before module-level work begins. This ensures routes, navigation, save/display logic, and shared components are stable so downstream phase fixes build on a solid base.

## Done looks like
- All broken routes return proper pages (no blank screens or 404s for defined sidebar links)
- Dead/orphan pages that aren't linked anywhere are removed or connected
- Sidebar navigation for both global and workspace modes links to correct routes
- All save/update/delete API endpoints respond correctly and persist to DB
- Page refresh preserves data (no state loss on reload)
- Duplicate action buttons on shared components are consolidated
- Button labels standardized: Save, Save Draft, Save & Next, Back, Update, Generate, Download, Preview, Mark Complete, Reopen
- Status labels standardized: Not Started, In Progress, Pending Review, Needs Update, Completed, Finalized
- No console errors on page load for any route

## Out of scope
- Module-specific business logic fixes (handled in later phases)
- Template extraction from ZIP files (separate task)
- AI help text additions (separate task)

## Tasks
1. **Route audit** — Map every route in App.tsx against sidebar links and verify each loads a real page. Remove or redirect any dead routes. Fix legacy redirects that point nowhere.
2. **Navigation consistency** — Ensure workspace sidebar phases (Pre-Planning, Data Intake, Planning, Execution, FS Heads, Evidence, Checklists, Finalization, Deliverables, QR, Inspection) all resolve to working pages. Fix any phase links that 404 or show blank content.
3. **Save/display/refresh audit** — Test save endpoints for key forms (client creation, engagement creation, firm settings, planning fields). Fix any that fail silently, don't persist, or lose data on refresh.
4. **Duplicate button cleanup** — Scan shared components for duplicate Save/Submit/Generate buttons on the same screen. Consolidate to one primary action per form.
5. **UI standardization** — Apply consistent button labels, status badge colors, and page header patterns across all pages. Ensure page-container, filter-bar, kpi-grid CSS classes are used consistently.
6. **Error handling** — Add proper error toasts for failed API calls instead of silent failures. Ensure 401/403 responses redirect to login.

## Relevant files
- `client/src/App.tsx`
- `client/src/components/app-sidebar.tsx`
- `client/src/lib/workspace-context.tsx`
- `server/routes.ts`
- `server/index.ts`
- `client/src/components/ui/button.tsx`
- `client/src/components/ui/badge.tsx`
- `client/src/index.css`