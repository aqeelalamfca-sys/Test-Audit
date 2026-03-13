# Firm Setup, Client Master & Engagement Setup Fix

## What & Why
Fix the Firm Setup, Client Master, and Engagement Setup modules so users can reliably create, edit, and manage clients and engagements. These are the foundation records that all downstream audit phases depend on — they must work flawlessly.

## Done looks like
- Firm profile saves and displays correctly after refresh
- Client creation works and new clients appear immediately in the list without page refresh
- Client editing and deletion work correctly
- Clients persist after logout/login
- Engagement creation links to selected client and saves all fields (type, period, year-end, team, scope)
- Engagement edit/reopen/update works
- Duplicate client or engagement forms/buttons are removed
- Engagement data (client name, period, team) is available for downstream modules (planning, execution, reporting)
- Short field guidance added to key client and engagement fields

## Out of scope
- Data intake module fixes (next phase)
- Template integration

## Tasks
1. **Client CRUD fix** — Test and fix client creation, editing, listing, and deletion. Ensure newly created clients appear in real-time without requiring refresh. Fix any state management issues.
2. **Engagement CRUD fix** — Test and fix engagement creation, editing, team assignment, and status management. Ensure engagement links correctly to selected client.
3. **Duplicate removal** — Remove duplicate client creation dialogs, duplicate engagement forms, or repeated action buttons.
4. **Data propagation** — Ensure engagement data (client info, period, team, scope) is correctly available via API for planning, execution, and reporting modules.
5. **Field guidance** — Add short helper text for key fields: NTN/CNIC format, engagement type description, reporting framework explanation.

## Relevant files
- `client/src/pages/client-list.tsx`
- `client/src/pages/client-detail.tsx`
- `client/src/components/create-client-dialog.tsx`
- `client/src/pages/engagements.tsx`
- `client/src/pages/new-engagement.tsx`
- `client/src/pages/engagement-detail.tsx`
- `client/src/pages/engagement-edit.tsx`
- `client/src/components/create-engagement-dialog.tsx`
- `server/clientRoutes.ts`
- `server/routes.ts`
- `server/firmRoutes.ts`
- `client/src/pages/firm-admin/firm-settings.tsx`
