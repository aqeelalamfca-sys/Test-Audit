# Review Notes, AI Field Help & Final E2E QA

## What & Why
Fix the Review Notes supervisory workflow, add AI help text across all key modules, and run a final end-to-end validation of the entire system. This is the final polish pass ensuring everything works together from client setup to reporting.

## Done looks like
- Review notes can be raised, assigned, tracked, cleared, and reopened
- Review notes link to specific working papers, procedures, and FS areas
- Review note statuses are standardized and practically usable
- AI help text added in key fields across all modules (short, editable, practical)
- Full E2E flow works: login → client → engagement → intake → planning → risk → materiality → execution → completion → reporting
- No remaining broken links, dead pages, or duplicate buttons
- No console errors on any page
- Performance is acceptable (no slow queries or excessive re-renders)
- All data persists correctly after refresh
- Role-based visibility works correctly for all user types

## Out of scope
- VPS deployment (separate concern)
- Mobile responsiveness optimization

## Tasks
1. **Review notes fix** — Test and fix review note creation, assignment, status transitions, clearing, and reopening. Link notes to working papers and procedures. Standardize statuses.
2. **AI field help** — Add short, practical AI help text and preset narration to key fields across: planning memo, risk descriptions, control narratives, procedure wording, conclusions, review notes, completion summaries, and report drafts.
3. **E2E flow test** — Walk through the complete audit workflow testing each phase transition. Fix any data flow breaks between phases.
4. **Performance audit** — Identify and fix slow page loads, duplicate API calls, unnecessary re-renders, and heavy database queries.
5. **Cleanup sweep** — Remove any remaining duplicate buttons, dead pages, empty placeholders, and non-functional demo elements.
6. **Final validation** — Verify save/update/delete/display across all modules. Confirm role-based access works. Test login/logout persistence.

## Relevant files
- `client/src/pages/review-notes.tsx`
- `server/routes/reviewNoteRoutes.ts`
- `server/routes/userNotificationRoutes.ts`
- `client/src/components/ai-help.tsx`
- `client/src/components/ai-field-wrapper.tsx`
- `client/src/components/ai-assist-banner.tsx`
- `client/src/App.tsx`
- `server/index.ts`
- `server/routes.ts`
