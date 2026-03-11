import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";

const router = Router();

async function verifyEngagementAccess(engagementId: string, firmId: string): Promise<boolean> {
  const count = await prisma.engagement.count({ where: { id: engagementId, firmId } });
  return count > 0;
}

router.get("/:engagementId/readiness", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId, firmId },
      include: {
        client: true,
        team: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const [
      tbLines,
      glEntries,
      apRecords,
      arRecords,
      bankRecords,
      fsMappings,
      reconIssues,
      risks,
      materialityAssessment,
      goingConcern,
      planningMemo,
      auditStrategy,
      relatedParties,
    ] = await Promise.all([
      prisma.trialBalanceLine.count({ where: { trialBalance: { engagementId } } }),
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "GeneralLedgerEntry" WHERE "engagementId" = ${engagementId}`.catch(() => [{ count: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "APRecord" WHERE "engagementId" = ${engagementId}`.catch(() => [{ count: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "ARRecord" WHERE "engagementId" = ${engagementId}`.catch(() => [{ count: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "BankRecord" WHERE "engagementId" = ${engagementId}`.catch(() => [{ count: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "TBMapping" WHERE "engagementId" = ${engagementId}`.catch(() => [{ count: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "ReconIssue" WHERE "engagementId" = ${engagementId} AND "status" != 'resolved'`.catch(() => [{ count: 0 }]),
      prisma.riskAssessment.findMany({ where: { engagementId }, select: { id: true, inherentRisk: true, isSignificantRisk: true, isFraudRisk: true, fsArea: true } }),
      prisma.materialityAssessment.findFirst({ where: { engagementId }, orderBy: { createdAt: "desc" } }),
      prisma.goingConcernAssessment.findFirst({ where: { engagementId } }),
      prisma.planningMemo.findFirst({ where: { engagementId } }),
      prisma.auditStrategy.findFirst({ where: { engagementId } }),
      prisma.relatedParty.findMany({ where: { engagementId } }),
    ]);

    const tbCount = tbLines || 0;
    const glCount = Array.isArray(glEntries) && glEntries[0] ? (glEntries[0] as any).count : 0;
    const apCount = Array.isArray(apRecords) && apRecords[0] ? (apRecords[0] as any).count : 0;
    const arCount = Array.isArray(arRecords) && arRecords[0] ? (arRecords[0] as any).count : 0;
    const bankCount = Array.isArray(bankRecords) && bankRecords[0] ? (bankRecords[0] as any).count : 0;
    const mappingCount = Array.isArray(fsMappings) && fsMappings[0] ? (fsMappings[0] as any).count : 0;
    const openIssueCount = Array.isArray(reconIssues) && reconIssues[0] ? (reconIssues[0] as any).count : 0;

    let draftFsSummary: any = null;
    try {
      const draftFs = await prisma.$queryRaw`
        SELECT 
          COALESCE(SUM(CASE WHEN "fsCategory" = 'ASSETS' THEN COALESCE("closingBalance", 0) ELSE 0 END), 0) as "totalAssets",
          COALESCE(SUM(CASE WHEN "fsCategory" = 'LIABILITIES' THEN COALESCE("closingBalance", 0) ELSE 0 END), 0) as "totalLiabilities",
          COALESCE(SUM(CASE WHEN "fsCategory" = 'EQUITY' THEN COALESCE("closingBalance", 0) ELSE 0 END), 0) as "totalEquity",
          COALESCE(SUM(CASE WHEN "fsCategory" = 'INCOME' THEN COALESCE("closingBalance", 0) ELSE 0 END), 0) as "totalIncome",
          COALESCE(SUM(CASE WHEN "fsCategory" = 'EXPENSES' THEN COALESCE("closingBalance", 0) ELSE 0 END), 0) as "totalExpenses"
        FROM "TrialBalanceLine" tbl
        JOIN "TrialBalance" tb ON tbl."trialBalanceId" = tb.id
        WHERE tb."engagementId" = ${engagementId}
      `;
      if (Array.isArray(draftFs) && draftFs[0]) {
        draftFsSummary = draftFs[0];
      }
    } catch (e) {
      draftFsSummary = null;
    }

    const intakeReadiness = {
      tbUploaded: tbCount > 0,
      tbRecordCount: tbCount,
      glUploaded: glCount > 0,
      glRecordCount: glCount,
      apUploaded: apCount > 0,
      apRecordCount: apCount,
      arUploaded: arCount > 0,
      arRecordCount: arCount,
      bankUploaded: bankCount > 0,
      bankRecordCount: bankCount,
      fsMapped: mappingCount > 0,
      fsMappingCount: mappingCount,
      openIssueCount,
    };

    const intakeGatesPassed = [
      intakeReadiness.tbUploaded,
      intakeReadiness.fsMapped,
    ].filter(Boolean).length;
    const intakeGatesTotal = 2;

    const planningCompletion = {
      materialityDone: !!materialityAssessment,
      materialityApproved: !!materialityAssessment?.approvedById,
      riskAssessmentDone: risks.length > 0,
      significantRisksIdentified: risks.filter(r => r.isSignificantRisk).length,
      fraudRisksIdentified: risks.filter(r => r.isFraudRisk).length,
      goingConcernDone: !!goingConcern,
      strategyDone: !!auditStrategy?.overallStrategy,
      strategyApproved: !!auditStrategy?.partnerApprovedById,
      planningMemoDone: !!planningMemo,
      planningMemoApproved: !!planningMemo?.partnerApprovedById,
      relatedPartiesReviewed: relatedParties.length,
    };

    const totalSteps = 8;
    let completedSteps = 0;
    if (planningCompletion.materialityDone) completedSteps++;
    if (planningCompletion.materialityApproved) completedSteps++;
    if (planningCompletion.riskAssessmentDone) completedSteps++;
    if (planningCompletion.goingConcernDone) completedSteps++;
    if (planningCompletion.strategyDone) completedSteps++;
    if (planningCompletion.strategyApproved) completedSteps++;
    if (planningCompletion.planningMemoDone) completedSteps++;
    if (planningCompletion.planningMemoApproved) completedSteps++;

    const completionPercentage = Math.round((completedSteps / totalSteps) * 100);

    const riskSignals: string[] = [];
    if (openIssueCount > 0) riskSignals.push(`${openIssueCount} unresolved reconciliation issue(s)`);
    if (risks.filter(r => r.isSignificantRisk).length > 0) riskSignals.push(`${risks.filter(r => r.isSignificantRisk).length} significant risk(s) identified`);
    if (risks.filter(r => r.isFraudRisk).length > 0) riskSignals.push(`${risks.filter(r => r.isFraudRisk).length} fraud risk(s) flagged`);
    if (goingConcern?.materialUncertaintyExists) riskSignals.push("Material going concern uncertainty exists");
    if (goingConcern?.workingCapitalDeficit) riskSignals.push("Working capital deficit detected");

    const nextActions: { label: string; tab: string; priority: "high" | "medium" | "low" }[] = [];
    if (!intakeReadiness.tbUploaded) nextActions.push({ label: "Upload Trial Balance in Data Intake", tab: "financial-statements", priority: "high" });
    if (!intakeReadiness.fsMapped) nextActions.push({ label: "Complete FS Mapping in Data Intake", tab: "financial-statements", priority: "high" });
    if (!planningCompletion.materialityDone) nextActions.push({ label: "Calculate Materiality", tab: "materiality", priority: "high" });
    if (planningCompletion.materialityDone && !planningCompletion.materialityApproved) nextActions.push({ label: "Approve Materiality", tab: "materiality", priority: "high" });
    if (!planningCompletion.riskAssessmentDone) nextActions.push({ label: "Complete Risk Assessment", tab: "risk-assessment", priority: "high" });
    if (!planningCompletion.goingConcernDone) nextActions.push({ label: "Assess Going Concern", tab: "going-concern", priority: "medium" });
    if (!planningCompletion.strategyDone) nextActions.push({ label: "Define Audit Strategy", tab: "strategy-approach", priority: "medium" });
    if (!planningCompletion.planningMemoDone) nextActions.push({ label: "Prepare Planning Memo", tab: "planning-memo", priority: "medium" });
    if (planningCompletion.planningMemoDone && !planningCompletion.planningMemoApproved) nextActions.push({ label: "Approve Planning Memo", tab: "planning-memo", priority: "high" });

    const canCompletePlanning =
      intakeReadiness.tbUploaded &&
      intakeReadiness.fsMapped &&
      planningCompletion.materialityApproved &&
      planningCompletion.riskAssessmentDone &&
      planningCompletion.strategyApproved &&
      planningCompletion.planningMemoApproved;

    res.json({
      engagement: {
        id: engagement.id,
        engagementCode: engagement.engagementCode,
        engagementType: engagement.engagementType,
        status: engagement.status,
        currentPhase: engagement.currentPhase,
        yearEnd: engagement.yearEnd,
        reportingFramework: engagement.reportingFramework,
        isFirstYear: engagement.isFirstYear,
        periodStart: engagement.periodStart,
        periodEnd: engagement.periodEnd,
      },
      client: {
        id: engagement.client?.id,
        name: engagement.client?.name,
        industry: (engagement.client as any)?.industry,
      },
      team: engagement.team.map(t => ({
        userId: t.user.id,
        name: t.user.name,
        role: t.user.role,
        teamRole: t.role,
      })),
      intakeReadiness,
      intakeGatesPassed,
      intakeGatesTotal,
      draftFsSummary,
      planningCompletion,
      completionPercentage,
      riskSignals,
      nextActions,
      riskSummary: {
        totalRisks: risks.length,
        significantRisks: risks.filter(r => r.isSignificantRisk).length,
        fraudRisks: risks.filter(r => r.isFraudRisk).length,
        highRisks: risks.filter(r => r.inherentRisk === "HIGH" || r.inherentRisk === "SIGNIFICANT").length,
      },
      canCompletePlanning,
      lastSyncTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Planning dashboard error:", error);
    res.status(500).json({ error: "Failed to load planning dashboard", details: error.message });
  }
});

router.get("/:engagementId/significant-accounts", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await verifyEngagementAccess(engagementId, req.user!.firmId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const tbLines = await prisma.trialBalanceLine.findMany({
      where: { trialBalance: { engagementId } },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        closingBalance: true,
        openingBalance: true,
        debitMovement: true,
        creditMovement: true,
        fsCategory: true,
        fsLineItem: true,
      },
    });

    const materiality = await prisma.materialityAssessment.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    });

    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId },
      select: { fsArea: true, isSignificantRisk: true, isFraudRisk: true, accountOrClass: true },
    });

    const materialityThreshold = materiality?.overallMateriality || 0;
    const performanceMateriality = materiality?.performanceMateriality || 0;

    const significantAccounts = tbLines
      .map((line) => {
        const balance = Math.abs(line.closingBalance || 0);
        const movement = Math.abs((line.debitMovement || 0) + (line.creditMovement || 0));
        const change = line.openingBalance
          ? Math.abs((line.closingBalance || 0) - (line.openingBalance || 0))
          : 0;
        const changePercent = line.openingBalance && line.openingBalance !== 0
          ? ((change / Math.abs(line.openingBalance)) * 100)
          : 0;

        const isSignificantBySize = balance > performanceMateriality;
        const isSignificantByMovement = movement > performanceMateriality;
        const isSignificantByChange = changePercent > 20;
        const hasLinkedRisk = risks.some(
          (r) => r.accountOrClass === line.accountName || r.accountOrClass === line.accountCode
        );
        const hasFraudRisk = risks.some(
          (r) => r.isFraudRisk && (r.accountOrClass === line.accountName || r.accountOrClass === line.accountCode)
        );

        const isSignificant =
          isSignificantBySize || isSignificantByMovement || isSignificantByChange || hasLinkedRisk || hasFraudRisk;

        const reasons: string[] = [];
        if (isSignificantBySize) reasons.push("Exceeds performance materiality");
        if (isSignificantByMovement) reasons.push("High transaction volume");
        if (isSignificantByChange) reasons.push(`${changePercent.toFixed(0)}% year-on-year change`);
        if (hasLinkedRisk) reasons.push("Linked to identified risk");
        if (hasFraudRisk) reasons.push("Fraud risk indicator");

        return {
          accountCode: line.accountCode,
          accountName: line.accountName,
          fsCategory: line.fsCategory,
          fsLineItem: line.fsLineItem,
          closingBalance: line.closingBalance,
          openingBalance: line.openingBalance,
          movement,
          changeAmount: change,
          changePercent,
          isSignificant,
          reasons,
          hasFraudRisk,
          linkedRisks: hasLinkedRisk,
        };
      })
      .filter((a) => a.isSignificant)
      .sort((a, b) => Math.abs(b.closingBalance || 0) - Math.abs(a.closingBalance || 0));

    res.json({
      significantAccounts,
      totalAccounts: tbLines.length,
      significantCount: significantAccounts.length,
      materialityThreshold,
      performanceMateriality,
    });
  } catch (error: any) {
    console.error("Significant accounts error:", error);
    res.status(500).json({ error: "Failed to identify significant accounts", details: error.message });
  }
});

router.get("/:engagementId/analytical-review", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await verifyEngagementAccess(engagementId, req.user!.firmId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const tbLines = await prisma.trialBalanceLine.findMany({
      where: { trialBalance: { engagementId } },
      select: {
        accountCode: true,
        accountName: true,
        closingBalance: true,
        openingBalance: true,
        debitMovement: true,
        creditMovement: true,
        fsCategory: true,
        fsLineItem: true,
      },
    });

    const categories: Record<string, { current: number; prior: number }> = {};
    tbLines.forEach((line) => {
      const cat = line.fsCategory || "UNCLASSIFIED";
      if (!categories[cat]) categories[cat] = { current: 0, prior: 0 };
      categories[cat].current += line.closingBalance || 0;
      categories[cat].prior += line.openingBalance || 0;
    });

    const totalAssets = categories["ASSETS"]?.current || 0;
    const totalLiabilities = categories["LIABILITIES"]?.current || 0;
    const totalEquity = categories["EQUITY"]?.current || 0;
    const totalIncome = Math.abs(categories["INCOME"]?.current || 0);
    const totalExpenses = Math.abs(categories["EXPENSES"]?.current || 0);
    const priorAssets = categories["ASSETS"]?.prior || 0;
    const priorLiabilities = categories["LIABILITIES"]?.prior || 0;
    const priorIncome = Math.abs(categories["INCOME"]?.prior || 0);
    const priorExpenses = Math.abs(categories["EXPENSES"]?.prior || 0);

    const currentRatio = totalLiabilities !== 0 ? totalAssets / Math.abs(totalLiabilities) : 0;
    const debtEquityRatio = totalEquity !== 0 ? Math.abs(totalLiabilities) / Math.abs(totalEquity) : 0;
    const grossProfit = totalIncome - totalExpenses;
    const grossProfitMargin = totalIncome !== 0 ? (grossProfit / totalIncome) * 100 : 0;
    const netProfit = totalIncome - totalExpenses;
    const netProfitMargin = totalIncome !== 0 ? (netProfit / totalIncome) * 100 : 0;

    const priorGrossProfit = priorIncome - priorExpenses;
    const priorGrossMargin = priorIncome !== 0 ? (priorGrossProfit / priorIncome) * 100 : 0;

    const ratios = {
      currentRatio: { current: currentRatio, prior: priorAssets !== 0 && priorLiabilities !== 0 ? priorAssets / Math.abs(priorLiabilities) : 0 },
      debtEquityRatio: { current: debtEquityRatio, prior: 0 },
      grossProfitMargin: { current: grossProfitMargin, prior: priorGrossMargin },
      netProfitMargin: { current: netProfitMargin, prior: 0 },
    };

    const fluctuations = Object.entries(categories).map(([category, values]) => {
      const change = values.current - values.prior;
      const changePercent = values.prior !== 0 ? (change / Math.abs(values.prior)) * 100 : (values.current !== 0 ? 100 : 0);
      return {
        category,
        currentYear: values.current,
        priorYear: values.prior,
        change,
        changePercent,
        isSignificant: Math.abs(changePercent) > 10,
        isUnusual: Math.abs(changePercent) > 25,
      };
    });

    const accountFluctuations = tbLines
      .map((line) => {
        const change = (line.closingBalance || 0) - (line.openingBalance || 0);
        const changePercent = line.openingBalance && line.openingBalance !== 0
          ? (change / Math.abs(line.openingBalance)) * 100
          : (line.closingBalance !== 0 ? 100 : 0);
        return {
          accountCode: line.accountCode,
          accountName: line.accountName,
          fsCategory: line.fsCategory,
          closingBalance: line.closingBalance,
          openingBalance: line.openingBalance,
          change,
          changePercent,
          isUnusual: Math.abs(changePercent) > 25 && Math.abs(line.closingBalance || 0) > 0,
          isNegativeBalance: (line.closingBalance || 0) < 0 && (line.fsCategory === "ASSETS" || line.fsCategory === "INCOME"),
          isDormant: (line.closingBalance || 0) === 0 && (line.openingBalance || 0) !== 0,
        };
      })
      .filter((a) => a.isUnusual || a.isNegativeBalance || a.isDormant)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 50);

    const anomalies: string[] = [];
    if (currentRatio < 1) anomalies.push("Current ratio below 1 — potential liquidity concern");
    if (debtEquityRatio > 3) anomalies.push("High debt-to-equity ratio — leverage risk");
    if (grossProfitMargin < 0) anomalies.push("Negative gross profit — operational concern");
    if (Math.abs(grossProfitMargin - priorGrossMargin) > 5) anomalies.push(`Gross margin shift of ${(grossProfitMargin - priorGrossMargin).toFixed(1)}%`);
    if (totalEquity < 0) anomalies.push("Negative equity — going concern indicator");

    const negativeBalances = tbLines.filter(l =>
      (l.closingBalance || 0) < 0 && (l.fsCategory === "ASSETS" || l.fsCategory === "INCOME")
    ).length;
    if (negativeBalances > 0) anomalies.push(`${negativeBalances} unexpected negative balance(s)`);

    res.json({
      fsSummary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalIncome,
        totalExpenses,
        netProfit,
      },
      ratios,
      categoryFluctuations: fluctuations,
      accountFluctuations,
      anomalies,
      hasData: tbLines.length > 0,
    });
  } catch (error: any) {
    console.error("Analytical review error:", error);
    res.status(500).json({ error: "Failed to generate analytical review", details: error.message });
  }
});

router.get("/:engagementId/fraud-indicators", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await verifyEngagementAccess(engagementId, req.user!.firmId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId, isFraudRisk: true },
      select: {
        id: true,
        riskDescription: true,
        accountOrClass: true,
        fsArea: true,
        fraudRiskType: true,
        fraudRiskIndicators: true,
        fraudResponse: true,
        inherentRisk: true,
        isSignificantRisk: true,
      },
    });

    let suspiciousJournals = 0;
    let periodEndEntries = 0;
    let relatedPartyTransactions = 0;
    try {
      const journalAnalysis: any[] = await prisma.$queryRaw`
        SELECT 
          COUNT(CASE WHEN "isManualEntry" = true THEN 1 END)::int as "manualEntries",
          COUNT(CASE WHEN "entryDate" >= (SELECT "periodEnd" FROM "Engagement" WHERE id = ${engagementId}) - interval '30 days' THEN 1 END)::int as "periodEndEntries"
        FROM "GeneralLedgerEntry"
        WHERE "engagementId" = ${engagementId}
      `;
      if (journalAnalysis[0]) {
        suspiciousJournals = (journalAnalysis[0] as any).manualEntries || 0;
        periodEndEntries = (journalAnalysis[0] as any).periodEndEntries || 0;
      }
    } catch (e) {}

    try {
      const rpCount: any[] = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "RelatedParty" WHERE "engagementId" = ${engagementId}
      `;
      relatedPartyTransactions = rpCount[0]?.count || 0;
    } catch (e) {}

    const fraudTriangle = {
      incentivePressure: "",
      opportunity: "",
      rationalization: "",
    };

    const presumedRisks = [
      {
        area: "Revenue Recognition",
        isa: "ISA 240.26",
        presumed: true,
        rebutted: false,
        rebuttalReason: null,
      },
      {
        area: "Management Override of Controls",
        isa: "ISA 240.31",
        presumed: true,
        rebutted: false,
        rebuttalReason: null,
      },
    ];

    res.json({
      fraudRisks: risks,
      suspiciousJournals,
      periodEndEntries,
      relatedPartyTransactions,
      fraudTriangle,
      presumedRisks,
      brainstormingNotes: "",
      managementOverrideResponse: "",
    });
  } catch (error: any) {
    console.error("Fraud indicators error:", error);
    res.status(500).json({ error: "Failed to load fraud indicators", details: error.message });
  }
});

router.get("/:engagementId/control-cycles", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await verifyEngagementAccess(engagementId, req.user!.firmId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const tbLines = await prisma.trialBalanceLine.findMany({
      where: { trialBalance: { engagementId } },
      select: { fsCategory: true, closingBalance: true, fsLineItem: true },
    });

    const materiality = await prisma.materialityAssessment.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    });

    const performanceMateriality = materiality?.performanceMateriality || 0;

    const categoryTotals: Record<string, number> = {};
    tbLines.forEach((line) => {
      const cat = line.fsCategory || "UNCLASSIFIED";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(line.closingBalance || 0);
    });

    const cycles = [
      { id: "revenue", name: "Revenue & Receivables", relatedCategories: ["INCOME"], relatedLineItems: ["Revenue", "Sales", "Receivable", "Trade Debtor"] },
      { id: "purchases", name: "Purchases & Payables", relatedCategories: ["EXPENSES"], relatedLineItems: ["Payable", "Trade Creditor", "Purchase", "Cost of Sales"] },
      { id: "payroll", name: "Payroll & Employee Benefits", relatedCategories: ["EXPENSES"], relatedLineItems: ["Salary", "Wages", "Payroll", "Staff", "Employee", "Benefit"] },
      { id: "treasury", name: "Treasury / Bank & Cash", relatedCategories: ["ASSETS"], relatedLineItems: ["Bank", "Cash", "Treasury"] },
      { id: "inventory", name: "Inventory", relatedCategories: ["ASSETS"], relatedLineItems: ["Inventory", "Stock", "Work in Progress", "Raw Material"] },
      { id: "fixed-assets", name: "Fixed Assets / PPE", relatedCategories: ["ASSETS"], relatedLineItems: ["Property", "Plant", "Equipment", "Fixed Asset", "PPE", "Depreciation"] },
      { id: "tax", name: "Taxation", relatedCategories: ["LIABILITIES", "EXPENSES"], relatedLineItems: ["Tax", "Income Tax", "Deferred Tax"] },
      { id: "journal-entries", name: "Journal Entries / Closing Process", relatedCategories: [], relatedLineItems: [] },
    ];

    const cycleData = cycles.map((cycle) => {
      const relatedAccounts = tbLines.filter((line) =>
        cycle.relatedCategories.includes(line.fsCategory || "") ||
        cycle.relatedLineItems.some((item) =>
          (line.fsLineItem || "").toLowerCase().includes(item.toLowerCase())
        )
      );
      const totalBalance = relatedAccounts.reduce((sum, acc) => sum + Math.abs(acc.closingBalance || 0), 0);
      const isMaterial = totalBalance > performanceMateriality;

      return {
        ...cycle,
        accountCount: relatedAccounts.length,
        totalBalance,
        isMaterial,
        requiredInPlanning: isMaterial,
        processDescription: "",
        keyControls: "",
        walkthroughStatus: "not-started" as const,
        reliancePlanned: false,
        controlDeficiencies: "",
        itDependencies: "",
      };
    });

    res.json({ cycles: cycleData, performanceMateriality });
  } catch (error: any) {
    console.error("Control cycles error:", error);
    res.status(500).json({ error: "Failed to load control cycles", details: error.message });
  }
});

router.get("/:engagementId/going-concern-indicators", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await verifyEngagementAccess(engagementId, req.user!.firmId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const tbLines = await prisma.trialBalanceLine.findMany({
      where: { trialBalance: { engagementId } },
      select: { closingBalance: true, openingBalance: true, fsCategory: true, fsLineItem: true },
    });

    const categories: Record<string, number> = {};
    tbLines.forEach((line) => {
      const cat = line.fsCategory || "UNCLASSIFIED";
      categories[cat] = (categories[cat] || 0) + (line.closingBalance || 0);
    });

    const totalAssets = categories["ASSETS"] || 0;
    const totalLiabilities = categories["LIABILITIES"] || 0;
    const totalEquity = categories["EQUITY"] || 0;
    const totalIncome = Math.abs(categories["INCOME"] || 0);
    const totalExpenses = Math.abs(categories["EXPENSES"] || 0);
    const netResult = totalIncome - totalExpenses;

    const indicators: { type: string; description: string; severity: string; detected: boolean }[] = [];

    indicators.push({
      type: "FINANCIAL",
      description: "Recurring losses",
      severity: netResult < 0 ? "HIGH" : "LOW",
      detected: netResult < 0,
    });

    indicators.push({
      type: "FINANCIAL",
      description: "Negative equity / net liability position",
      severity: totalEquity < 0 ? "HIGH" : "LOW",
      detected: totalEquity < 0,
    });

    const currentRatio = totalLiabilities !== 0 ? totalAssets / Math.abs(totalLiabilities) : 999;
    indicators.push({
      type: "FINANCIAL",
      description: "Weak liquidity (current ratio below 1)",
      severity: currentRatio < 1 ? "HIGH" : currentRatio < 1.2 ? "MEDIUM" : "LOW",
      detected: currentRatio < 1,
    });

    indicators.push({
      type: "FINANCIAL",
      description: "Working capital deficit",
      severity: (totalAssets + totalLiabilities) < 0 ? "HIGH" : "LOW",
      detected: (totalAssets + totalLiabilities) < 0,
    });

    const debtRatio = totalEquity !== 0 ? Math.abs(totalLiabilities) / Math.abs(totalEquity) : 999;
    indicators.push({
      type: "FINANCIAL",
      description: "Heavy financing dependence (debt-equity ratio > 3)",
      severity: debtRatio > 3 ? "HIGH" : debtRatio > 2 ? "MEDIUM" : "LOW",
      detected: debtRatio > 3,
    });

    const detectedCount = indicators.filter((i) => i.detected).length;

    res.json({
      indicators,
      detectedCount,
      totalIndicators: indicators.length,
      autoAssessment: detectedCount >= 3 ? "HIGH" : detectedCount >= 1 ? "MEDIUM" : "LOW",
      financialSummary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        netResult,
        currentRatio,
        debtRatio,
      },
    });
  } catch (error: any) {
    console.error("Going concern indicators error:", error);
    res.status(500).json({ error: "Failed to load going concern indicators", details: error.message });
  }
});

router.get("/:engagementId/planning-completion", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!await verifyEngagementAccess(engagementId, req.user!.firmId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [materiality, risks, goingConcern, strategy, memo, relatedParties] = await Promise.all([
      prisma.materialityAssessment.findFirst({ where: { engagementId }, orderBy: { createdAt: "desc" } }),
      prisma.riskAssessment.findMany({ where: { engagementId } }),
      prisma.goingConcernAssessment.findFirst({ where: { engagementId } }),
      prisma.auditStrategy.findFirst({ where: { engagementId } }),
      prisma.planningMemo.findFirst({ where: { engagementId } }),
      prisma.relatedParty.findMany({ where: { engagementId } }),
    ]);

    const sections = [
      { id: "materiality", label: "Materiality (ISA 320)", status: materiality?.approvedById ? "approved" : materiality ? "draft" : "not-started" },
      { id: "risk-assessment", label: "Risk Assessment (ISA 315)", status: risks.length > 0 ? (risks.some(r => r.partnerApprovedById) ? "approved" : "draft") : "not-started" },
      { id: "significant-accounts", label: "Significant Accounts", status: risks.length > 0 ? "draft" : "not-started" },
      { id: "fraud-risk", label: "Fraud Risk (ISA 240)", status: risks.some(r => r.isFraudRisk) ? "draft" : "not-started" },
      { id: "going-concern", label: "Going Concern (ISA 570)", status: goingConcern?.partnerApprovedById ? "approved" : goingConcern ? "draft" : "not-started" },
      { id: "strategy-approach", label: "Audit Strategy (ISA 300)", status: strategy?.partnerApprovedById ? "approved" : strategy?.overallStrategy ? "draft" : "not-started" },
      { id: "related-parties", label: "Related Parties (ISA 550)", status: relatedParties.length > 0 ? "draft" : "not-started" },
      { id: "planning-memo", label: "Planning Memo", status: memo?.partnerApprovedById ? "approved" : memo ? "draft" : "not-started" },
    ];

    const completed = sections.filter(s => s.status === "approved").length;
    const inProgress = sections.filter(s => s.status === "draft").length;
    const notStarted = sections.filter(s => s.status === "not-started").length;

    res.json({
      sections,
      completed,
      inProgress,
      notStarted,
      totalSections: sections.length,
      completionPercentage: Math.round((completed / sections.length) * 100),
      isComplete: completed === sections.length,
    });
  } catch (error: any) {
    console.error("Planning completion error:", error);
    res.status(500).json({ error: "Failed to load planning completion", details: error.message });
  }
});

export default router;
