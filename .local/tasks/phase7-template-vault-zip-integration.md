# Template Vault Build & ZIP File Integration

## What & Why
Extract all templates from the two attached ZIP files (Model FS & Working Papers with 59 files, ISQM with 19 files), classify them by audit phase, remove duplicates, and build a searchable Template Vault. Link templates to their correct modules, enable prefill where possible, and create missing practical templates where required.

## Done looks like
- All 59 working paper templates extracted and classified (BS.01-BS.28, PL.01-PL.08, AE.01-AE.04, plus planning/controls/confirmations)
- All 19 ISQM documents extracted and classified (policies, forms, guides)
- Model FS template (SSE Model FS 2023) extracted and linked to FS mapping/reporting
- Template Vault page shows all templates organized by category with search/filter
- Each template linked to its relevant audit phase (planning, execution, completion, etc.)
- Prefill enabled where practical (firm name, client name, engagement period, year-end)
- Duplicate templates between ZIPs identified and resolved
- Missing practical templates identified and created (e.g., audit completion checklist, sampling worksheet)
- Template download works for all files
- Template register/index maintained showing source, category, linked module

## Out of scope
- Deep module-level fixes (handled in earlier phases)

## Tasks
1. **ZIP extraction** — Extract both ZIP files into organized server-side directories. Classify files by type (working paper, FS template, confirmation, letter, ISQM form, checklist).
2. **Template classification** — Map each template to audit phase: BS/PL working papers → Execution/FS Heads, planning templates → Planning, controls checklist → Internal Controls, confirmations → Evidence, ISQM → Quality Management.
3. **Template Vault UI** — Build or enhance the evidence-vault page to include a Template Library tab with search, filter by category, preview, and download functionality.
4. **Module linking** — Connect templates to their relevant modules so users can access the right template from within each phase (e.g., BS.09 Trade Debts template accessible from FS Heads > Receivables).
5. **Prefill integration** — Enable dynamic prefill for templates that support it (firm name, client name, period, materiality, team members).
6. **ISQM module** — Build a Quality Management section using extracted ISQM documents. Include policies, forms (trainee admission, appointment letter, evaluation, survey, performance feedback), and compliance guides.
7. **Template register** — Create an internal register listing all extracted templates, their source ZIP, category, linked module, and prefill capability.

## Relevant files
- `attached_assets/Aqeel_Alam_&_Co._-_Model_FS_and_Working_Papers__1772389544535.zip`
- `attached_assets/ISQM_1772389539824.zip`
- `client/src/pages/evidence-vault.tsx`
- `server/evidenceRoutes.ts`
- `server/templateRoutes.ts`
- `server/services/templateGenerator.ts`
- `server/isqmRoutes.ts`
