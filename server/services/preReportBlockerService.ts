import { prisma } from "../db";

export interface PreReportIssue {
  type: string;
  count?: number;
  message: string;
}

export async function computePreDraftBlockers(engagementId: string): Promise<{ readyForDraft: boolean; issues: PreReportIssue[] }> {
  const [openNotes, unapprovedTests, incompleteMemo, eqcr] = await Promise.all([
    prisma.reviewNote.count({ where: { engagementId, status: "OPEN" } }),
    prisma.substantiveTest.count({ where: { engagementId, managerApprovedById: null } }),
    prisma.completionMemo.findUnique({ where: { engagementId } }),
    prisma.eQCRAssignment.findUnique({ where: { engagementId } }),
  ]);

  const issues: PreReportIssue[] = [];
  if (openNotes > 0) issues.push({ type: "OPEN_REVIEW_NOTES", count: openNotes, message: `${openNotes} open review notes` });
  if (unapprovedTests > 0) issues.push({ type: "UNAPPROVED_TESTS", count: unapprovedTests, message: `${unapprovedTests} unapproved substantive tests` });
  if (!incompleteMemo?.partnerApprovedById) issues.push({ type: "COMPLETION_MEMO", message: "Completion memo not approved" });
  if (eqcr?.isRequired && eqcr.status !== "CLEARED") issues.push({ type: "EQCR", message: "EQCR clearance required" });

  return { readyForDraft: issues.length === 0, issues };
}

export async function computePreReportBlockers(engagementId: string): Promise<{ readyForRelease: boolean; issues: PreReportIssue[] }> {
  const [draftCheck, report] = await Promise.all([
    computePreDraftBlockers(engagementId),
    prisma.auditReport.findUnique({ where: { engagementId } }),
  ]);

  const issues = [...draftCheck.issues];
  if (!report?.partnerApprovedById) issues.push({ type: "REPORT", message: "Audit report not approved" });

  return { readyForRelease: issues.length === 0, issues };
}
