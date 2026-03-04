import { prisma } from "../db";

export interface SimulationFinding {
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  description: string;
  isaReference?: string;
  resolution: string;
}

export interface SimulationSection {
  name: string;
  status: "PASS" | "FAIL" | "WARNING" | "ERROR";
  findings: SimulationFinding[];
  score: number;
  maxScore: number;
  error?: string;
}

export interface SimulationResult {
  engagementId: string;
  runAt: string;
  overallScore: number;
  overallMaxScore: number;
  overallStatus: "PASS" | "FAIL" | "WARNING";
  sections: SimulationSection[];
}

async function safeQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const msg = error?.message || "Unknown database error";
    console.error(`[Simulation] ${label} query failed:`, msg);
    throw new Error(`${label}: ${msg}`);
  }
}

async function runISACoverageCheck(engagementId: string): Promise<SimulationSection> {
  const findings: SimulationFinding[] = [];
  let score = 0;
  const maxScore = 10;

  try {
    const workpapers = await safeQuery("WorkpaperRegistry", () =>
      prisma.workpaperRegistry.findMany({
        where: { engagementId },
        select: { id: true, title: true, workpaperRef: true, status: true, section: true },
      })
    );

    const checklistItems = await safeQuery("ChecklistItem", () =>
      prisma.checklistItem.findMany({
        where: { engagementId },
        select: { id: true, title: true, isaReference: true },
      })
    );

    const requiredISAs = [
      { code: "ISA 200", desc: "Overall Objectives" },
      { code: "ISA 220", desc: "Quality Management" },
      { code: "ISA 230", desc: "Audit Documentation" },
      { code: "ISA 240", desc: "Fraud" },
      { code: "ISA 265", desc: "Internal Control Deficiencies" },
      { code: "ISA 300", desc: "Planning" },
      { code: "ISA 315", desc: "Risk Identification & Assessment" },
      { code: "ISA 320", desc: "Materiality" },
      { code: "ISA 330", desc: "Responses to Assessed Risks" },
      { code: "ISA 450", desc: "Evaluation of Misstatements" },
      { code: "ISA 500", desc: "Audit Evidence" },
      { code: "ISA 520", desc: "Analytical Procedures" },
      { code: "ISA 530", desc: "Audit Sampling" },
      { code: "ISA 540", desc: "Accounting Estimates" },
      { code: "ISA 570", desc: "Going Concern" },
      { code: "ISA 700", desc: "Forming an Opinion" },
      { code: "ISA 720", desc: "Other Information" },
    ];

    const allRefs = [
      ...workpapers.map((w) => w.workpaperRef || w.section || "").filter(Boolean),
      ...checklistItems.map((a) => a.isaReference || a.title || "").filter(Boolean),
    ];
    const allRefsJoined = allRefs.join(" ").toUpperCase();

    const covered: string[] = [];
    const missing: string[] = [];

    for (const isa of requiredISAs) {
      const codePattern = isa.code.toUpperCase();
      const codeNum = isa.code.replace("ISA ", "");
      if (
        allRefsJoined.includes(codePattern) ||
        new RegExp(`\\bISA\\s*${codeNum}\\b`).test(allRefsJoined) ||
        new RegExp(`\\b${codeNum}\\b`).test(allRefsJoined)
      ) {
        covered.push(isa.code);
      } else {
        missing.push(isa.code);
      }
    }

    if (missing.length === 0) {
      score = maxScore;
    } else {
      score = Math.round((covered.length / requiredISAs.length) * maxScore);
    }

    if (missing.length > 0) {
      findings.push({
        category: "ISA Coverage",
        severity: missing.length > 5 ? "CRITICAL" : "HIGH",
        title: `Missing ISA references: ${missing.join(", ")}`,
        description: `${missing.length} of ${requiredISAs.length} required ISA standards have no working paper or audit program reference.`,
        resolution: "Create working papers or audit program steps referencing these standards.",
      });
    }

    if (workpapers.length === 0 && checklistItems.length === 0) {
      findings.push({
        category: "ISA Coverage",
        severity: "CRITICAL",
        title: "No working papers or audit programs found",
        description: "The engagement has no documented working papers or audit programs.",
        isaReference: "ISA 230",
        resolution: "Create audit programs and working papers for the engagement.",
      });
      score = 0;
    }

    const status = score === maxScore ? "PASS" : score >= maxScore * 0.6 ? "WARNING" : "FAIL";
    return { name: "ISA Coverage Gap Detection", status, findings, score, maxScore };
  } catch (error: any) {
    return {
      name: "ISA Coverage Gap Detection",
      status: "ERROR",
      findings: [],
      score: 0,
      maxScore,
      error: "Database query failed during ISA coverage check",
    };
  }
}

async function runEngagementFileReview(engagementId: string): Promise<SimulationSection> {
  const findings: SimulationFinding[] = [];
  let score = 0;
  const maxScore = 10;
  let checks = 0;
  let passed = 0;

  try {
    checks++;
    const evidence = await safeQuery("Document", () =>
      prisma.document.findMany({
        where: { engagementId },
        select: { id: true, name: true },
      })
    );

    if (evidence.length > 0) {
      passed++;
    } else {
      findings.push({
        category: "Engagement File",
        severity: "HIGH",
        title: "No evidence documents uploaded",
        description: "The engagement has no supporting evidence documents.",
        isaReference: "ISA 500",
        resolution: "Upload supporting documents and evidence files.",
      });
    }

    checks++;
    const signOffs = await safeQuery("SectionSignOff", () =>
      prisma.sectionSignOff.findMany({
        where: { engagementId },
        select: { id: true, reviewedById: true, reviewedDate: true, partnerApprovedById: true, partnerApprovalDate: true, preparedDate: true },
      })
    );

    const reviewedSignOffs = signOffs.filter((s) => s.reviewedById || s.partnerApprovedById);
    if (reviewedSignOffs.length > 0) {
      passed++;
    } else {
      findings.push({
        category: "Engagement File",
        severity: "HIGH",
        title: "No review sign-offs found",
        description: "No sections have been reviewed or approved by a senior team member.",
        isaReference: "ISA 220",
        resolution: "Have a Manager or Partner review and sign off on completed sections.",
      });
    }

    checks++;
    const reviewNotes = await safeQuery("ReviewNote", () =>
      prisma.reviewNote.findMany({
        where: { engagementId, status: "OPEN" },
        select: { id: true, severity: true },
      })
    );

    const criticalNotes = reviewNotes.filter((n) => n.severity === "CRITICAL");
    if (criticalNotes.length === 0) {
      passed++;
    } else {
      findings.push({
        category: "Engagement File",
        severity: "CRITICAL",
        title: `${criticalNotes.length} critical review notes still open`,
        description: "Critical review notes must be resolved before engagement completion.",
        isaReference: "ISA 220.20",
        resolution: "Address and close all critical review notes.",
      });
    }

    checks++;
    const lateReviews = signOffs.filter((s) => {
      const dateToCheck = s.reviewedDate || s.preparedDate;
      if (!dateToCheck) return false;
      const signedDate = new Date(dateToCheck);
      const now = new Date();
      const daysDiff = (now.getTime() - signedDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 90;
    });

    if (lateReviews.length === 0) {
      passed++;
    } else {
      findings.push({
        category: "Engagement File",
        severity: "MEDIUM",
        title: `${lateReviews.length} sign-offs are older than 90 days`,
        description: "Some sign-offs were made more than 90 days ago and may need refreshing.",
        isaReference: "ISA 230.A21",
        resolution: "Re-review sections with stale sign-offs.",
      });
    }

    score = checks > 0 ? Math.round((passed / checks) * maxScore) : 0;
    const status = score === maxScore ? "PASS" : score >= maxScore * 0.6 ? "WARNING" : "FAIL";
    return { name: "Engagement File Review", status, findings, score, maxScore };
  } catch (error: any) {
    return {
      name: "Engagement File Review",
      status: "ERROR",
      findings: [],
      score: 0,
      maxScore,
      error: "Database query failed during engagement file review",
    };
  }
}

async function runISQMStressTest(engagementId: string): Promise<SimulationSection> {
  const findings: SimulationFinding[] = [];
  let score = 0;
  const maxScore = 10;
  let checks = 0;
  let passed = 0;

  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: {
        id: true,
        firmId: true,
        eqcrRequired: true,
        riskRating: true,
        engagementPartnerId: true,
        engagementManagerId: true,
      },
    });

    if (!engagement) {
      return { name: "ISQM Stress Test", status: "PASS", findings: [], score: 0, maxScore };
    }

    checks++;
    const team = await safeQuery("EngagementTeam", () =>
      prisma.engagementTeam.findMany({
        where: { engagementId },
        select: { userId: true, role: true },
      })
    );

    if (team.length >= 2) {
      passed++;
    } else {
      findings.push({
        category: "ISQM",
        severity: "HIGH",
        title: "Insufficient team assignment",
        description: "Engagement has fewer than 2 team members, risking inadequate segregation of duties.",
        isaReference: "ISQM 1.30",
        resolution: "Assign at least a partner and a manager to the engagement.",
      });
    }

    checks++;
    if (engagement.riskRating === "HIGH" && !engagement.eqcrRequired) {
      findings.push({
        category: "ISQM",
        severity: "CRITICAL",
        title: "High-risk engagement without EQCR",
        description: "High-risk engagements should require an Engagement Quality Control Review.",
        isaReference: "ISQM 1.34(f)",
        resolution: "Enable EQCR for this high-risk engagement.",
      });
    } else {
      passed++;
    }

    checks++;
    const independenceDeclarations = await safeQuery("IndependenceDeclaration", () =>
      prisma.independenceDeclaration.findMany({
        where: { engagementId },
        select: { id: true, status: true },
      })
    );

    if (independenceDeclarations.length > 0) {
      passed++;
    } else {
      findings.push({
        category: "ISQM",
        severity: "CRITICAL",
        title: "No independence assessment performed",
        description: "Engagement acceptance without independence evaluation violates ISQM requirements.",
        isaReference: "ISQM 1.28",
        resolution: "Complete the independence assessment in Pre-Planning.",
      });
    }

    checks++;
    if (engagement.engagementPartnerId) {
      passed++;
    } else {
      findings.push({
        category: "ISQM",
        severity: "HIGH",
        title: "No engagement partner assigned",
        description: "An engagement partner must be assigned for quality management oversight.",
        isaReference: "ISQM 1.30(a)",
        resolution: "Assign an engagement partner to this engagement.",
      });
    }

    score = checks > 0 ? Math.round((passed / checks) * maxScore) : 0;
    const status = score === maxScore ? "PASS" : score >= maxScore * 0.6 ? "WARNING" : "FAIL";
    return { name: "ISQM Stress Test", status, findings, score, maxScore };
  } catch (error: any) {
    return {
      name: "ISQM Stress Test",
      status: "ERROR",
      findings: [],
      score: 0,
      maxScore,
      error: "Database query failed during ISQM stress test",
    };
  }
}

async function runSecuritySimulation(engagementId: string): Promise<SimulationSection> {
  const findings: SimulationFinding[] = [];
  let score = 0;
  const maxScore = 10;
  let checks = 0;
  let passed = 0;

  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, firmId: true },
    });

    if (!engagement) {
      return { name: "Security Simulation", status: "PASS", findings: [], score: 0, maxScore };
    }

    checks++;
    const team = await safeQuery("EngagementTeam-security", () =>
      prisma.engagementTeam.findMany({
        where: { engagementId },
        include: { user: { select: { id: true, role: true, firmId: true } } },
      })
    );

    const crossFirmMembers = team.filter((t) => t.user.firmId !== engagement.firmId);
    if (crossFirmMembers.length === 0) {
      passed++;
    } else {
      findings.push({
        category: "Security",
        severity: "CRITICAL",
        title: `${crossFirmMembers.length} cross-firm team member(s) detected`,
        description: "Team members from other firms have access to this engagement, violating tenant isolation.",
        resolution: "Remove cross-firm members from the engagement team immediately.",
      });
    }

    checks++;
    const secSignOffs = await safeQuery("SectionSignOff-security", () =>
      prisma.sectionSignOff.findMany({
        where: { engagementId },
        include: { partnerApprovedBy: { select: { id: true, role: true } } },
      })
    );

    const escalatedSignOffs = secSignOffs.filter((s) => {
      if (s.partnerApprovedById && s.partnerApprovedBy) {
        return !["PARTNER", "MANAGING_PARTNER", "ADMIN"].includes(s.partnerApprovedBy.role);
      }
      return false;
    });

    if (escalatedSignOffs.length === 0) {
      passed++;
    } else {
      findings.push({
        category: "Security",
        severity: "CRITICAL",
        title: `${escalatedSignOffs.length} unauthorized approval sign-off(s)`,
        description: "Approval-level sign-offs were made by users without Partner/Admin role.",
        isaReference: "ISA 220",
        resolution: "Investigate and revoke unauthorized approvals.",
      });
    }

    checks++;
    const auditLogs = await safeQuery("AuditTrail-security", () =>
      prisma.auditTrail.findMany({
        where: { engagementId },
        select: { id: true, action: true, userId: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    );

    if (auditLogs.length > 0) {
      passed++;
    } else {
      findings.push({
        category: "Security",
        severity: "MEDIUM",
        title: "No audit trail entries found",
        description: "The engagement has no audit trail, making forensic review impossible.",
        resolution: "Ensure all actions are logged via the audit trail system.",
      });
    }

    score = checks > 0 ? Math.round((passed / checks) * maxScore) : 0;
    const status = score === maxScore ? "PASS" : score >= maxScore * 0.6 ? "WARNING" : "FAIL";
    return { name: "Security Simulation", status, findings, score, maxScore };
  } catch (error: any) {
    return {
      name: "Security Simulation",
      status: "ERROR",
      findings: [],
      score: 0,
      maxScore,
      error: "Database query failed during security simulation",
    };
  }
}

async function runAIGovernanceCheck(engagementId: string): Promise<SimulationSection> {
  const findings: SimulationFinding[] = [];
  let score = 0;
  const maxScore = 10;
  let checks = 0;
  let passed = 0;

  try {
    checks++;
    const aiLogs = await safeQuery("AIInteractionLog", () =>
      prisma.aIInteractionLog.findMany({
        where: { engagementId },
        select: { id: true, action: true, outputText: true, editedOutput: true, userId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    );

    const unreviewed = aiLogs.filter(
      (log) => log.action !== "ACCEPT" && log.action !== "REJECT" && log.action !== "EDIT"
    );

    if (unreviewed.length === 0 || aiLogs.length === 0) {
      passed++;
    } else {
      findings.push({
        category: "AI Governance",
        severity: unreviewed.length > 10 ? "HIGH" : "MEDIUM",
        title: `${unreviewed.length} AI output(s) not reviewed by human`,
        description: "AI-generated content should be explicitly accepted, rejected, or edited by audit staff.",
        resolution: "Review all pending AI suggestions and take an explicit action.",
      });
    }

    checks++;
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { finalizationLocked: true, planningLocked: true, executionLocked: true },
    });

    if (engagement) {
      const lockedPhases: string[] = [];
      if (engagement.planningLocked) lockedPhases.push("PLANNING");
      if (engagement.executionLocked) lockedPhases.push("EXECUTION");
      if (engagement.finalizationLocked) lockedPhases.push("FINALIZATION");

      if (lockedPhases.length > 0 && aiLogs.length > 0) {
        const lockCheckDate = new Date();
        lockCheckDate.setDate(lockCheckDate.getDate() - 7);
        const recentAIInLockedPhase = aiLogs.filter(
          (log) => new Date(log.createdAt) > lockCheckDate
        );

        if (recentAIInLockedPhase.length === 0) {
          passed++;
        } else {
          findings.push({
            category: "AI Governance",
            severity: "MEDIUM",
            title: `${recentAIInLockedPhase.length} recent AI interaction(s) in locked phases`,
            description: "AI interactions occurred recently while phases are locked. Verify no unauthorized edits.",
            resolution: "Review audit trail to confirm no post-lock changes were applied.",
          });
        }
      } else {
        passed++;
      }
    } else {
      passed++;
    }

    checks++;
    const acceptedWithoutEdit = aiLogs.filter((log) => log.action === "ACCEPT" && !log.editedOutput);
    const totalAccepted = aiLogs.filter((log) => log.action === "ACCEPT" || log.action === "EDIT");
    const blindAcceptRate = totalAccepted.length > 0
      ? acceptedWithoutEdit.length / totalAccepted.length
      : 0;

    if (blindAcceptRate < 0.8 || totalAccepted.length === 0) {
      passed++;
    } else {
      findings.push({
        category: "AI Governance",
        severity: "MEDIUM",
        title: `High blind acceptance rate: ${Math.round(blindAcceptRate * 100)}%`,
        description: "Over 80% of AI outputs were accepted without editing, suggesting insufficient professional skepticism.",
        resolution: "Encourage staff to review and edit AI outputs rather than accepting them blindly.",
      });
    }

    score = checks > 0 ? Math.round((passed / checks) * maxScore) : 0;
    const status = score === maxScore ? "PASS" : score >= maxScore * 0.6 ? "WARNING" : "FAIL";
    return { name: "AI Governance Check", status, findings, score, maxScore };
  } catch (error: any) {
    return {
      name: "AI Governance Check",
      status: "ERROR",
      findings: [],
      score: 0,
      maxScore,
      error: "Database query failed during AI governance check",
    };
  }
}

export async function runComplianceSimulation(engagementId: string): Promise<SimulationResult> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true },
  });

  if (!engagement) {
    throw new Error("Engagement not found");
  }

  const sections = await Promise.all([
    runISACoverageCheck(engagementId),
    runEngagementFileReview(engagementId),
    runISQMStressTest(engagementId),
    runSecuritySimulation(engagementId),
    runAIGovernanceCheck(engagementId),
  ]);

  const validSections = sections.filter((s) => s.status !== "ERROR");
  const overallScore = validSections.reduce((sum, s) => sum + s.score, 0);
  const overallMaxScore = validSections.reduce((sum, s) => sum + s.maxScore, 0);
  const hasErrors = sections.some((s) => s.status === "ERROR");
  const overallPct = overallMaxScore > 0 ? overallScore / overallMaxScore : 0;
  const overallStatus: "PASS" | "FAIL" | "WARNING" =
    hasErrors ? "WARNING" : overallPct >= 0.8 ? "PASS" : overallPct >= 0.5 ? "WARNING" : "FAIL";

  return {
    engagementId,
    runAt: new Date().toISOString(),
    overallScore,
    overallMaxScore,
    overallStatus,
    sections,
  };
}
