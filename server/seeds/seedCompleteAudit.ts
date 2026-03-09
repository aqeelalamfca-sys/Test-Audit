import { prisma } from "../db";

export async function seedCompleteAudit() {
  const eng = await prisma.engagement.findFirst({ where: { engagementCode: "ENG-2026-003" } });
  if (!eng) { console.log("[seedCompleteAudit] ENG-2026-003 not found, skipping."); return; }

  const firm = await prisma.firm.findFirst();
  if (!firm) return;
  const users = await prisma.user.findMany({ where: { firmId: firm.id } });
  const u = (email: string) => users.find(x => x.email === email)!;
  const partner = u("partner@auditwise.pk");
  const manager = u("manager@auditwise.pk");
  const teamlead = u("teamlead@auditwise.pk");
  const senior = u("senior@auditwise.pk");
  const staff = u("staff@auditwise.pk");
  const eqcr = u("eqcr@auditwise.pk");
  if (!partner || !manager || !senior || !staff || !eqcr || !teamlead) {
    console.log("[seedCompleteAudit] Missing users, skipping."); return;
  }

  await ensureEnforcementGates(eng.id, partner.id);

  await ensureWorkingPapers(eng.id, senior.id, partner.id, manager.id);

  await ensureMaterialitySet(eng.id, senior.id, manager.id, partner.id);

  await ensureInternalControlsAndWalkthroughs(eng.id, senior.id, manager.id);

  await ensureTocData(eng.id, senior.id);

  await ensureTodData(eng.id, senior.id);

  await ensureAttachments(eng.id, senior.id);

  await ensureReviewPoints(eng.id, manager.id, senior.id);

  await ensureAdjustments(eng.id, senior.id, partner.id);

  await ensureSectionSignOffs(eng.id, senior.id, manager.id, partner.id);

  await ensureOutputsRegistry(eng.id, senior.id, manager.id, partner.id);

  await ensurePhaseProgressAndLocks(eng.id, partner.id);

  const existingGuard = await prisma.sectionSignOff.findFirst({ where: { engagementId: eng.id, section: "PRE_PLANNING_COMPLETE" } });
  if (existingGuard) {
    console.log("[seedCompleteAudit] Data completeness verified for ENG-2026-003.");
    return;
  }

  console.log("[seedCompleteAudit] Seeding complete audit file for ENG-2026-003...");

  const teamIds = [partner.id, manager.id, teamlead.id, senior.id, staff.id];
  for (const uid of teamIds) {
    await prisma.independenceDeclaration.upsert({
      where: { engagementId_userId: { engagementId: eng.id, userId: uid } },
      update: { status: "CONFIRMED" },
      create: {
        engagementId: eng.id, userId: uid, declarationType: "independence",
        hasFinancialInterest: false, hasBusinessRelationship: false, hasFamilyRelationship: false,
        hasPriorService: false, hasOtherThreat: false,
        status: "CONFIRMED",
        confirmationStatement: "I confirm that I am independent of the client in accordance with the IESBA Code of Ethics.",
        confirmedAtStart: true, confirmedAtStartDate: new Date("2025-10-15"),
        confirmedAtCompletion: true, confirmedAtCompletionDate: new Date("2026-06-30"),
        partnerId: partner.id, partnerApprovalDate: new Date("2025-10-16"),
      },
    });
  }

  await prisma.ethicsConfirmation.upsert({
    where: { engagementId: eng.id },
    update: { isLocked: true, allDeclarationsComplete: true, allThreatsResolved: true },
    create: {
      engagementId: eng.id,
      startConfirmedById: partner.id, startConfirmedDate: new Date("2025-10-15"),
      completionConfirmedById: partner.id, completionConfirmedDate: new Date("2026-06-30"),
      allDeclarationsComplete: true, allThreatsResolved: true,
      isLocked: true, lockedById: partner.id, lockedDate: new Date("2026-06-30"),
    },
  });

  const existingEL = await prisma.engagementLetter.findFirst({ where: { engagementId: eng.id } });
  if (existingEL) {
    await prisma.engagementLetter.update({ where: { id: existingEL.id }, data: { status: "ACCEPTED" } });
  } else {
    await prisma.engagementLetter.create({
      data: {
        engagementId: eng.id, letterReference: "EL-2026-003",
        auditObjective: "Express an opinion on the financial statements of Al-Baraka Textiles (Pvt.) Limited for FY ending 30 June 2026 in accordance with ISAs.",
        auditScope: "Statutory audit under Companies Act 2017 and ISAs as applicable in Pakistan. Framework: IFRS for SMEs.",
        managementResponsibilities: "Management is responsible for preparation and fair presentation of FS, internal controls, and providing access to records.",
        auditorResponsibilities: "Conduct audit per ISAs to obtain reasonable assurance. Report on FS and communicate significant matters.",
        proposedFee: 3200000, feeStructure: { type: "Fixed fee", details: "Inclusive of out-of-pocket expenses" },
        status: "ACCEPTED",
        sentToClientDate: new Date("2025-08-10"), clientAcceptedDate: new Date("2025-08-15"),
        clientSignatory: "Muhammad Tariq Hussain, CEO",
        preparedById: manager.id, partnerApprovedById: partner.id, partnerApprovalDate: new Date("2025-08-12"),
      },
    });
  }

  const gateTypes = ["CLIENT_ACCEPTANCE", "CLIENT_CONTINUANCE", "INDEPENDENCE_CONFIRMATION", "ETHICS_COMPLIANCE", "ENGAGEMENT_LETTER"] as const;
  for (const gt of gateTypes) {
    await prisma.prePlanningGate.updateMany({
      where: { engagementId: eng.id, gateType: gt },
      data: { status: "COMPLETED", completionPercentage: 100, completedAt: new Date("2025-11-30"), completedById: senior.id, reviewedAt: new Date("2025-12-01"), reviewedById: manager.id },
    });
  }
  console.log("  [Pre-Planning] Independence, ethics, gates, engagement letter seeded");

  const riskData = [
    { accountOrClass: "Revenue — Export Sales", fsArea: "REVENUE" as const, auditCycle: "REVENUE_CYCLE" as const, assertion: "OCCURRENCE" as const, assertionImpacts: ["OCCURRENCE" as const, "CUTOFF" as const, "COMPLETENESS" as const], inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "HIGH" as const, isSignificantRisk: true, isFraudRisk: true, riskDescription: "Revenue recognition fraud risk — export sales may be misstated through premature recognition or fictitious LC entries" },
    { accountOrClass: "Revenue — Local Sales", fsArea: "REVENUE" as const, auditCycle: "REVENUE_CYCLE" as const, assertion: "CUTOFF" as const, assertionImpacts: ["CUTOFF" as const, "ACCURACY" as const], inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "MODERATE" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Local sales cutoff errors near period end" },
    { accountOrClass: "Revenue — Sales Returns", fsArea: "REVENUE" as const, auditCycle: "REVENUE_CYCLE" as const, assertion: "COMPLETENESS" as const, assertionImpacts: ["COMPLETENESS" as const, "VALUATION" as const], inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "MODERATE" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Unrecorded sales returns and credit notes" },
    { accountOrClass: "Inventories — Raw Cotton", fsArea: "INVENTORIES" as const, auditCycle: "INVENTORY_CYCLE" as const, assertion: "EXISTENCE" as const, assertionImpacts: ["EXISTENCE" as const, "VALUATION" as const], inherentRisk: "HIGH" as const, controlRisk: "HIGH" as const, riskOfMaterialMisstatement: "HIGH" as const, isSignificantRisk: true, isFraudRisk: false, riskDescription: "Raw cotton inventory may not exist at reported quantities or NRV may be below cost" },
    { accountOrClass: "Inventories — WIP Yarn", fsArea: "INVENTORIES" as const, auditCycle: "INVENTORY_CYCLE" as const, assertion: "VALUATION" as const, assertionImpacts: ["VALUATION" as const, "EXISTENCE" as const], inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "HIGH" as const, isSignificantRisk: true, isFraudRisk: false, riskDescription: "WIP valuation involves significant judgment in stage of completion and cost allocation" },
    { accountOrClass: "Inventories — Finished Goods", fsArea: "INVENTORIES" as const, auditCycle: "INVENTORY_CYCLE" as const, assertion: "VALUATION" as const, assertionImpacts: ["VALUATION" as const, "RIGHTS_OBLIGATIONS" as const], inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "HIGH" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Finished goods NRV assessment and slow-moving obsolescence provision" },
    { accountOrClass: "PPE — Spinning Machinery", fsArea: "FIXED_ASSETS" as const, auditCycle: "FIXED_ASSETS_CYCLE" as const, assertion: "VALUATION" as const, assertionImpacts: ["VALUATION" as const, "EXISTENCE" as const], inherentRisk: "MODERATE" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "MODERATE" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Useful life estimates and impairment indicators for spinning plant" },
    { accountOrClass: "PPE — New Additions", fsArea: "FIXED_ASSETS" as const, auditCycle: "FIXED_ASSETS_CYCLE" as const, assertion: "EXISTENCE" as const, assertionImpacts: ["EXISTENCE" as const, "COMPLETENESS" as const, "VALUATION" as const], inherentRisk: "MODERATE" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Capital expenditure additions may not be properly authorized or capitalized" },
    { accountOrClass: "Capital WIP — Dyeing Plant", fsArea: "FIXED_ASSETS" as const, auditCycle: "FIXED_ASSETS_CYCLE" as const, assertion: "EXISTENCE" as const, assertionImpacts: ["EXISTENCE" as const, "VALUATION" as const], inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "MODERATE" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "CWIP may include items ready for capitalization or impaired costs" },
    { accountOrClass: "Trade Receivables — Export", fsArea: "RECEIVABLES" as const, auditCycle: "REVENUE_CYCLE" as const, assertion: "VALUATION" as const, assertionImpacts: ["VALUATION" as const, "EXISTENCE" as const, "RIGHTS_OBLIGATIONS" as const], inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "MODERATE" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "ECL provision for export receivables may be inadequate given aging and forex exposure" },
    { accountOrClass: "Trade Receivables — Local", fsArea: "RECEIVABLES" as const, auditCycle: "REVENUE_CYCLE" as const, assertion: "EXISTENCE" as const, assertionImpacts: ["EXISTENCE" as const, "COMPLETENESS" as const], inherentRisk: "MODERATE" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Local receivables existence confirmed via confirmations" },
    { accountOrClass: "Trade Payables — Import LCs", fsArea: "PAYABLES" as const, auditCycle: "PURCHASE_CYCLE" as const, assertion: "COMPLETENESS" as const, assertionImpacts: ["COMPLETENESS" as const, "CUTOFF" as const, "VALUATION" as const], inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "MODERATE" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Unrecorded liabilities from LC-based imports near period end" },
    { accountOrClass: "Trade Payables — Local", fsArea: "PAYABLES" as const, auditCycle: "PURCHASE_CYCLE" as const, assertion: "COMPLETENESS" as const, assertionImpacts: ["COMPLETENESS" as const, "CUTOFF" as const], inherentRisk: "MODERATE" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Search for unrecorded liabilities" },
    { accountOrClass: "Cash and Bank Balances", fsArea: "CASH_AND_BANK" as const, auditCycle: "TREASURY_CYCLE" as const, assertion: "EXISTENCE" as const, assertionImpacts: ["EXISTENCE" as const, "COMPLETENESS" as const], inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Bank balances confirmed via bank confirmations" },
    { accountOrClass: "Long Term Borrowings", fsArea: "BORROWINGS" as const, auditCycle: "FINANCING_CYCLE" as const, assertion: "COMPLETENESS" as const, assertionImpacts: ["COMPLETENESS" as const, "VALUATION" as const, "PRESENTATION_DISCLOSURE" as const], inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Loan balances confirmed; compliance with covenants reviewed" },
    { accountOrClass: "Share Capital & Reserves", fsArea: "EQUITY" as const, auditCycle: "FINANCING_CYCLE" as const, assertion: "EXISTENCE" as const, assertionImpacts: ["EXISTENCE" as const, "PRESENTATION_DISCLOSURE" as const], inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Verify share capital against SECP records" },
    { accountOrClass: "Cost of Sales — Raw Materials", fsArea: "COST_OF_SALES" as const, auditCycle: "INVENTORY_CYCLE" as const, assertion: "ACCURACY" as const, assertionImpacts: ["ACCURACY" as const, "CUTOFF" as const], inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "HIGH" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Raw material consumption computation and cost allocation accuracy" },
    { accountOrClass: "Cost of Sales — Labour", fsArea: "COST_OF_SALES" as const, auditCycle: "PAYROLL_CYCLE" as const, assertion: "OCCURRENCE" as const, assertionImpacts: ["OCCURRENCE" as const, "ACCURACY" as const], inherentRisk: "MODERATE" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Manufacturing wages allocation between COS and admin" },
    { accountOrClass: "Administrative Expenses", fsArea: "OPERATING_EXPENSES" as const, auditCycle: "PURCHASE_CYCLE" as const, assertion: "OCCURRENCE" as const, assertionImpacts: ["OCCURRENCE" as const, "CLASSIFICATION" as const], inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Admin expenses classification and occurrence" },
    { accountOrClass: "Finance Costs", fsArea: "FINANCE_COSTS" as const, auditCycle: "FINANCING_CYCLE" as const, assertion: "ACCURACY" as const, assertionImpacts: ["ACCURACY" as const, "COMPLETENESS" as const], inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Interest expense recalculation and completeness" },
    { accountOrClass: "Tax Expense & Deferred Tax", fsArea: "TAXATION" as const, auditCycle: "TAX_CYCLE" as const, assertion: "ACCURACY" as const, assertionImpacts: ["ACCURACY" as const, "VALUATION" as const, "PRESENTATION_DISCLOSURE" as const], inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "MODERATE" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Tax computation accuracy and deferred tax liability measurement" },
    { accountOrClass: "Employee Benefits — Gratuity", fsArea: "PAYABLES" as const, auditCycle: "PAYROLL_CYCLE" as const, assertion: "VALUATION" as const, assertionImpacts: ["VALUATION" as const, "COMPLETENESS" as const], inherentRisk: "MODERATE" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "Gratuity provision valuation assumptions" },
    { accountOrClass: "Related Party Transactions", fsArea: "REVENUE" as const, auditCycle: "REVENUE_CYCLE" as const, assertion: "PRESENTATION_DISCLOSURE" as const, assertionImpacts: ["PRESENTATION_DISCLOSURE" as const, "VALUATION" as const, "OCCURRENCE" as const], inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskOfMaterialMisstatement: "HIGH" as const, isSignificantRisk: true, isFraudRisk: false, riskDescription: "Related party transactions may not be at arm's length; disclosure completeness risk per ISA 550" },
    { accountOrClass: "Management Override of Controls", fsArea: "REVENUE" as const, auditCycle: "REVENUE_CYCLE" as const, assertion: "OCCURRENCE" as const, assertionImpacts: ["OCCURRENCE" as const, "VALUATION" as const], inherentRisk: "HIGH" as const, controlRisk: "HIGH" as const, riskOfMaterialMisstatement: "HIGH" as const, isSignificantRisk: true, isFraudRisk: true, riskDescription: "Presumed fraud risk per ISA 240 — journal entry manipulation, management estimates bias" },
    { accountOrClass: "Provisions — WPPF/WWF", fsArea: "PAYABLES" as const, auditCycle: "PAYROLL_CYCLE" as const, assertion: "ACCURACY" as const, assertionImpacts: ["ACCURACY" as const, "COMPLETENESS" as const], inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskOfMaterialMisstatement: "LOW" as const, isSignificantRisk: false, isFraudRisk: false, riskDescription: "WPPF/WWF calculation accuracy per Companies Act requirements" },
  ];
  const existingRiskCount = await prisma.riskAssessment.count({ where: { engagementId: eng.id } });
  if (existingRiskCount < 20) {
    for (const r of riskData) {
      const exists = await prisma.riskAssessment.findFirst({ where: { engagementId: eng.id, accountOrClass: r.accountOrClass } });
      if (!exists) {
        await prisma.riskAssessment.create({
          data: { engagementId: eng.id, ...r, assessedById: senior.id, assessedDate: new Date("2026-01-10"), plannedResponse: `Substantive testing and analytical procedures tailored to ${r.accountOrClass}` },
        });
      }
    }
  }
  console.log("  [Planning] Risk assessments seeded (25+)");

  const existingAP = await prisma.auditPlan.findFirst({ where: { engagementId: eng.id } });
  if (existingAP) {
    await prisma.auditPlan.update({ where: { id: existingAP.id }, data: { status: "APPROVED", isLocked: true, approvedById: partner.id, approvedAt: new Date("2026-02-01"), lockedAt: new Date("2026-02-02") } });
  } else {
    await prisma.auditPlan.create({
      data: {
        engagementId: eng.id, versionNumber: 1, status: "APPROVED",
        auditApproach: "COMBINED", auditTiming: "BOTH",
        scopeDescription: "Full-scope statutory audit of standalone financial statements under IFRS for SMEs. All material FS heads covered. Physical inventory observation at Korangi plant.",
        relianceOnControls: true, relianceOnInternalAudit: false, relianceOnIT: true,
        preparedById: manager.id, reviewedById: partner.id, approvedById: partner.id,
        approvedAt: new Date("2026-02-01"), isLocked: true, lockedAt: new Date("2026-02-02"),
      },
    });
  }

  const analyticsData = [
    { procedureReference: "AP-ABT-001", analyticalType: "RATIO_ANALYSIS" as const, fsArea: "REVENUE" as const, description: "Gross profit margin analysis", expectation: "Gross margin between 16-20% consistent with prior year and industry", expectedValue: 18.0, thresholdValue: 2.0, actualValue: 17.4, variance: -0.6, varianceStatus: "WITHIN_THRESHOLD" as const, conclusion: "Gross margin of 17.4% is within expected range. No further investigation required." },
    { procedureReference: "AP-ABT-002", analyticalType: "TREND_ANALYSIS" as const, fsArea: "OPERATING_EXPENSES" as const, description: "Operating expense trend analysis", expectation: "Admin expenses growth ≤ 15% YoY", expectedValue: 89700000, thresholdValue: 5000000, actualValue: 90000000, variance: 300000, varianceStatus: "WITHIN_THRESHOLD" as const, conclusion: "Admin expenses growth of 15.4% marginally above threshold but explained by salary increments." },
    { procedureReference: "AP-ABT-003", analyticalType: "REASONABLENESS_TEST" as const, fsArea: "RECEIVABLES" as const, description: "Days sales outstanding (DSO)", expectation: "DSO between 45-90 days for textile exporter", expectedValue: 70, thresholdValue: 15, actualValue: 74, variance: 4, varianceStatus: "WITHIN_THRESHOLD" as const, conclusion: "DSO of 74 days within normal range for LC-based export sales." },
    { procedureReference: "AP-ABT-004", analyticalType: "VARIANCE_ANALYSIS" as const, fsArea: "FIXED_ASSETS" as const, description: "Depreciation expense reasonableness", expectation: "Depreciation 5-8% of gross PPE", expectedValue: 72000000, thresholdValue: 10000000, actualValue: 60000000, variance: -12000000, varianceStatus: "WITHIN_THRESHOLD" as const, conclusion: "Depreciation at 5% of gross PPE — lower end but consistent with revised useful life estimates for new machinery." },
  ];
  for (const ap of analyticsData) {
    const exists = await prisma.analyticalProcedure.findFirst({ where: { engagementId: eng.id, procedureReference: ap.procedureReference } });
    if (!exists) {
      await prisma.analyticalProcedure.create({
        data: { engagementId: eng.id, ...ap, performedById: senior.id, performedDate: new Date("2026-02-15"), reviewedById: manager.id, reviewedDate: new Date("2026-02-18") },
      });
    }
  }

  const existingJET = await prisma.journalEntryTest.findFirst({ where: { engagementId: eng.id } });
  if (!existingJET) {
    await prisma.journalEntryTest.create({
      data: {
        engagementId: eng.id, workpaperRef: "WP-JET-001", testingPeriod: "FY2025-26",
        populationSize: 8500, populationValueTotal: 2450000000,
        samplingMethod: "Risk-based non-statistical sampling targeting high-risk entries",
        sampleSize: 55, selectionCriteria: { criteria: ["Entries posted by senior management", "Weekend/holiday entries", "Entries >PM (6.75M)", "Round-sum entries", "Manual journal entries to revenue accounts", "Related party entries"] },
        status: "APPROVED",
        conclusion: "No indicators of management override of controls identified. All sampled entries properly authorized, supported, and recorded.",
        exceptionsIdentified: 0,
        performedById: senior.id, performedAt: new Date("2026-08-10"),
        reviewedById: manager.id, reviewedAt: new Date("2026-08-12"),
      },
    });
  }
  console.log("  [Planning] Audit plan, analytics, JET seeded");

  const existingProcCount = await prisma.engagementProcedure.count({ where: { engagementId: eng.id } });
  if (existingProcCount < 100) {
    const procTemplates: { title: string; category: "PRE_PLANNING" | "PLANNING" | "EXECUTION" | "FINALIZATION"; procedureType: "CHECKLIST" | "TEST_OF_CONTROL" | "SUBSTANTIVE_ANALYTICAL" | "TEST_OF_DETAILS" | "WALKTHROUGH" | "INQUIRY" | "OBSERVATION" | "INSPECTION" | "CONFIRMATION" | "RECALCULATION"; isaRef: string }[] = [];
    const execFsHeads = ["REVENUE", "INVENTORIES", "PROPERTY_PLANT_EQUIPMENT", "TRADE_RECEIVABLES", "TRADE_AND_OTHER_PAYABLES", "CASH_AND_BANK_BALANCES", "LONG_TERM_BORROWINGS", "COST_OF_SALES", "SHARE_CAPITAL", "FINANCE_COSTS", "ADMIN_EXPENSES", "SELLING_EXPENSES", "RETAINED_EARNINGS"];
    const procTypes: Array<"TEST_OF_CONTROL" | "TEST_OF_DETAILS" | "SUBSTANTIVE_ANALYTICAL" | "INSPECTION" | "INQUIRY" | "CONFIRMATION" | "RECALCULATION" | "OBSERVATION"> = ["TEST_OF_CONTROL", "TEST_OF_DETAILS", "SUBSTANTIVE_ANALYTICAL", "INSPECTION", "INQUIRY", "CONFIRMATION", "RECALCULATION", "OBSERVATION"];

    for (const fh of execFsHeads) {
      const numProcs = fh === "REVENUE" || fh === "INVENTORIES" ? 12 : fh === "PROPERTY_PLANT_EQUIPMENT" || fh === "COST_OF_SALES" ? 10 : fh === "TRADE_RECEIVABLES" || fh === "TRADE_AND_OTHER_PAYABLES" ? 8 : 6;
      for (let i = 0; i < numProcs; i++) {
        const pt = procTypes[i % procTypes.length];
        procTemplates.push({ title: `${fh.replace(/_/g, " ")} — ${pt.replace(/_/g, " ").toLowerCase()} #${i + 1}`, category: "EXECUTION", procedureType: pt, isaRef: "ISA 330" });
      }
    }
    procTemplates.push(
      { title: "Engagement acceptance checklist", category: "PRE_PLANNING", procedureType: "CHECKLIST", isaRef: "ISA 210" },
      { title: "Independence confirmation review", category: "PRE_PLANNING", procedureType: "CHECKLIST", isaRef: "ISA 220" },
      { title: "Client understanding documentation", category: "PRE_PLANNING", procedureType: "INQUIRY", isaRef: "ISA 315" },
      { title: "Entity understanding — industry analysis", category: "PLANNING", procedureType: "INQUIRY", isaRef: "ISA 315" },
      { title: "Risk assessment procedures", category: "PLANNING", procedureType: "CHECKLIST", isaRef: "ISA 315" },
      { title: "Materiality computation and approval", category: "PLANNING", procedureType: "RECALCULATION", isaRef: "ISA 320" },
      { title: "Audit strategy determination", category: "PLANNING", procedureType: "CHECKLIST", isaRef: "ISA 300" },
      { title: "Control walkthrough — revenue cycle", category: "PLANNING", procedureType: "WALKTHROUGH", isaRef: "ISA 315" },
      { title: "Control walkthrough — purchase cycle", category: "PLANNING", procedureType: "WALKTHROUGH", isaRef: "ISA 315" },
      { title: "Control walkthrough — payroll cycle", category: "PLANNING", procedureType: "WALKTHROUGH", isaRef: "ISA 315" },
      { title: "Subsequent events review", category: "FINALIZATION", procedureType: "INQUIRY", isaRef: "ISA 560" },
      { title: "Going concern evaluation", category: "FINALIZATION", procedureType: "CHECKLIST", isaRef: "ISA 570" },
      { title: "Written representations review", category: "FINALIZATION", procedureType: "INSPECTION", isaRef: "ISA 580" },
      { title: "Final analytical procedures", category: "FINALIZATION", procedureType: "SUBSTANTIVE_ANALYTICAL", isaRef: "ISA 520" },
    );

    let idx = 0;
    for (const p of procTemplates) {
      idx++;
      await prisma.engagementProcedure.create({
        data: {
          engagementId: eng.id, workpaperRef: `EP-${idx.toString().padStart(3, "0")}`,
          title: p.title, description: `Perform ${p.title.toLowerCase()} per ${p.isaRef}`,
          category: p.category, procedureType: p.procedureType,
          isaReferences: [p.isaRef], assertions: [],
          status: "APPROVED", conclusion: "Completed satisfactorily. No exceptions noted.",
          performedById: senior.id, performedAt: new Date("2026-08-10"),
          reviewedById: manager.id, reviewedAt: new Date("2026-08-15"),
          managerApprovedById: manager.id, managerApprovedAt: new Date("2026-08-16"),
          partnerApprovedById: partner.id, partnerApprovedAt: new Date("2026-08-20"),
        },
      });
    }
    console.log(`  [Execution] Engagement procedures seeded: ${procTemplates.length}`);
  }

  const misstatements = [
    { ref: "MS-001", fsArea: "REVENUE" as const, accountName: "Revenue — Export Sales", type: "FACTUAL" as const, status: "ADJUSTED" as const, amount: 4200000, desc: "Export revenue recognized before shipment — 2 LC entries dated 28-29 June but goods shipped 1-2 July", cause: "Cutoff error", managementResponse: "Agreed. Correcting entry posted.", adjustmentReference: "AJ-ABT-001", isAboveTrivial: true, isAbovePM: false },
    { ref: "MS-002", fsArea: "INVENTORIES" as const, accountName: "Inventories — Finished Goods", type: "JUDGMENTAL" as const, status: "ADJUSTED" as const, amount: 2800000, desc: "NRV write-down on slow-moving denim inventory — 3 product lines with no orders > 6 months", cause: "Inadequate obsolescence review", managementResponse: "Agreed. Write-down posted.", adjustmentReference: "AJ-ABT-002", isAboveTrivial: true, isAbovePM: false },
    { ref: "MS-003", fsArea: "PAYABLES" as const, accountName: "Accrued Expenses", type: "FACTUAL" as const, status: "ADJUSTED" as const, amount: 1500000, desc: "Unrecorded June electricity and gas accrual", cause: "Late receipt of utility bills", managementResponse: "Agreed. Accrual recorded.", adjustmentReference: "AJ-ABT-003", isAboveTrivial: true, isAbovePM: false },
    { ref: "MS-004", fsArea: "INVENTORIES" as const, accountName: "Cost of Sales — Overhead Allocation", type: "PROJECTED" as const, status: "WAIVED" as const, amount: 380000, desc: "Minor overhead allocation variance — immaterial extrapolated amount", cause: "Rounding in allocation rate", managementResponse: "Noted. Amount is immaterial.", isAboveTrivial: false, isAbovePM: false },
  ];
  for (const ms of misstatements) {
    const exists = await prisma.misstatement.findFirst({ where: { engagementId: eng.id, misstatementReference: ms.ref } });
    if (!exists) {
      await prisma.misstatement.create({
        data: {
          engagementId: eng.id, misstatementReference: ms.ref, fsArea: ms.fsArea, accountName: ms.accountName,
          misstatementType: ms.type, status: ms.status, misstatementAmount: ms.amount,
          description: ms.desc, cause: ms.cause, managementResponse: ms.managementResponse,
          adjustmentReference: ms.status === "ADJUSTED" ? ms.adjustmentReference : undefined,
          adjustedDate: ms.status === "ADJUSTED" ? new Date("2026-08-25") : undefined,
          waivedJustification: ms.status === "WAIVED" ? "Amount below trivial threshold (PKR 450,000). Cumulative uncorrected misstatements remain below performance materiality." : undefined,
          waivedApprovedById: ms.status === "WAIVED" ? partner.id : undefined,
          waivedApprovalDate: ms.status === "WAIVED" ? new Date("2026-08-25") : undefined,
          isAboveTrivialThreshold: ms.isAboveTrivial, isAbovePM: ms.isAbovePM, isAboveOverallMateriality: false,
          identifiedById: senior.id, identifiedDate: new Date("2026-08-15"),
          reviewedById: manager.id, reviewedDate: new Date("2026-08-20"),
          impactOnOpinion: "No impact on audit opinion. Cumulative adjusted and unadjusted misstatements are below performance materiality.",
          affectedAssertions: ["ACCURACY", "CUTOFF"],
        },
      });
    }
  }

  const auditAdjs = [
    { ref: "AJ-ABT-001", type: "CORRECTED" as const, status: "AGREED_POSTED" as const, fsArea: "REVENUE" as const, accountCode: "4102", desc: "Revenue cutoff — reclassify 2 export shipments from June to July", debit: 4200000, credit: 0, netImpact: -4200000, isMaterial: false },
    { ref: "AJ-ABT-002", type: "CORRECTED" as const, status: "AGREED_POSTED" as const, fsArea: "INVENTORIES" as const, accountCode: "1303", desc: "NRV write-down on slow-moving finished goods", debit: 0, credit: 2800000, netImpact: -2800000, isMaterial: false },
    { ref: "AJ-ABT-003", type: "CORRECTED" as const, status: "AGREED_POSTED" as const, fsArea: "PAYABLES" as const, accountCode: "2103", desc: "Unrecorded utility accrual", debit: 1500000, credit: 0, netImpact: 1500000, isMaterial: false },
    { ref: "AJ-ABT-004", type: "UNCORRECTED" as const, status: "WAIVED" as const, fsArea: "INVENTORIES" as const, accountCode: "5103", desc: "Minor overhead allocation variance", debit: 380000, credit: 0, netImpact: 380000, isMaterial: false },
  ];
  for (const aj of auditAdjs) {
    const exists = await prisma.auditAdjustment.findFirst({ where: { engagementId: eng.id, adjustmentRef: aj.ref } });
    if (!exists) {
      await prisma.auditAdjustment.create({
        data: {
          engagementId: eng.id, adjustmentRef: aj.ref, adjustmentType: aj.type, status: aj.status,
          fsArea: aj.fsArea, accountCode: aj.accountCode, description: aj.desc,
          debitAmount: aj.debit, creditAmount: aj.credit, netImpact: aj.netImpact, isMaterial: aj.isMaterial,
          identifiedById: senior.id, identifiedAt: new Date("2026-08-15"),
          reviewedById: manager.id, reviewedAt: new Date("2026-08-20"),
          waivedById: aj.status === "WAIVED" ? partner.id : undefined,
          partnerApprovedWaiver: aj.status === "WAIVED",
        },
      });
    }
  }

  const confirmations = [
    { ref: "EC-BANK-001", type: "POSITIVE" as const, fsArea: "CASH_AND_BANK" as const, accountName: "Current Account — HBL", assertion: "EXISTENCE", party: "Habib Bank Limited", status: "CONFIRMED" as const, requestedAmt: 42000000, confirmedAmt: 42000000, diff: 0 },
    { ref: "EC-BANK-002", type: "POSITIVE" as const, fsArea: "CASH_AND_BANK" as const, accountName: "Current Account — MCB", assertion: "EXISTENCE", party: "MCB Bank Limited", status: "CONFIRMED" as const, requestedAmt: 28000000, confirmedAmt: 28000000, diff: 0 },
    { ref: "EC-BANK-003", type: "POSITIVE" as const, fsArea: "CASH_AND_BANK" as const, accountName: "Current Account — NBP", assertion: "EXISTENCE", party: "National Bank of Pakistan", status: "CONFIRMED" as const, requestedAmt: 18000000, confirmedAmt: 18000000, diff: 0 },
    { ref: "EC-AR-001", type: "POSITIVE" as const, fsArea: "RECEIVABLES" as const, accountName: "Trade Receivables — Export", assertion: "EXISTENCE", party: "European Fashion Group GmbH", status: "CONFIRMED" as const, requestedAmt: 45000000, confirmedAmt: 44200000, diff: 800000 },
    { ref: "EC-AR-002", type: "POSITIVE" as const, fsArea: "RECEIVABLES" as const, accountName: "Trade Receivables — Export", assertion: "EXISTENCE", party: "US Textile Imports LLC", status: "CONFIRMED" as const, requestedAmt: 32000000, confirmedAmt: 32000000, diff: 0 },
    { ref: "EC-AR-003", type: "POSITIVE" as const, fsArea: "RECEIVABLES" as const, accountName: "Trade Receivables — Local", assertion: "EXISTENCE", party: "Gulf Trading Co.", status: "CONFIRMED" as const, requestedAmt: 18000000, confirmedAmt: 17500000, diff: 500000 },
    { ref: "EC-AP-001", type: "POSITIVE" as const, fsArea: "PAYABLES" as const, accountName: "Trade Payables — Import", assertion: "COMPLETENESS", party: "Cotton Trading Corp.", status: "CONFIRMED" as const, requestedAmt: 35000000, confirmedAmt: 36200000, diff: 1200000 },
    { ref: "EC-AP-002", type: "POSITIVE" as const, fsArea: "PAYABLES" as const, accountName: "Trade Payables — Local", assertion: "COMPLETENESS", party: "Chemical Suppliers (Pvt.) Ltd", status: "CONFIRMED" as const, requestedAmt: 12000000, confirmedAmt: 12000000, diff: 0 },
    { ref: "EC-LEGAL-001", type: "POSITIVE" as const, fsArea: "PAYABLES" as const, accountName: "Provisions — Litigation", assertion: "COMPLETENESS", party: "Ali & Associates (Legal Counsel)", status: "CONFIRMED" as const, requestedAmt: 0, confirmedAmt: 0, diff: 0 },
  ];
  for (const ec of confirmations) {
    const exists = await prisma.externalConfirmation.findFirst({ where: { engagementId: eng.id, confirmationReference: ec.ref } });
    if (!exists) {
      await prisma.externalConfirmation.create({
        data: {
          engagementId: eng.id, confirmationReference: ec.ref, confirmationType: ec.type,
          fsArea: ec.fsArea, accountName: ec.accountName, assertion: ec.assertion,
          thirdPartyName: ec.party, status: ec.status,
          requestedAmount: ec.requestedAmt, confirmedAmount: ec.confirmedAmt,
          difference: ec.diff, differenceResolved: ec.diff > 0,
          differenceExplanation: ec.diff > 0 ? `Timing difference — payment in transit` : undefined,
          sentDate: new Date("2026-07-15"), responseReceivedDate: new Date("2026-08-05"),
          conclusion: ec.diff > 0 ? `Difference of PKR ${ec.diff.toLocaleString()} reconciled to timing differences (payments in transit).` : "Confirmed without exception.",
          conclusionSatisfactory: true,
          preparedById: senior.id,
        },
      });
    }
  }

  const deficiencies = [
    { ref: "CD-ABT-001", cycle: "REVENUE" as const, desc: "Revenue cycle — quarterly rather than monthly review of export LC documentation before recognition", severity: "SIGNIFICANT_DEFICIENCY" as const, root: "Staffing constraints in finance team", remediation: "Management to implement monthly LC review process with export department sign-off", remediationStatus: "REMEDIATION_IN_PROGRESS" as const },
    { ref: "CD-ABT-002", cycle: "INVENTORY" as const, desc: "Inventory — no formal NRV assessment process for slow-moving items", severity: "DEFICIENCY" as const, root: "Lack of formal slow-moving inventory policy", remediation: "Implement quarterly NRV review with marketing department input", remediationStatus: "OPEN" as const },
    { ref: "CD-ABT-003", cycle: "PURCHASES" as const, desc: "Purchase cycle — dual authorization not consistently enforced for purchases from preferred vendors under PKR 500,000", severity: "DEFICIENCY" as const, root: "System configuration gap in Oracle NetSuite", remediation: "IT to configure mandatory dual approval for all POs regardless of vendor status", remediationStatus: "REMEDIATION_IN_PROGRESS" as const },
  ];
  for (const cd of deficiencies) {
    const exists = await prisma.controlDeficiency.findFirst({ where: { engagementId: eng.id, deficiencyReference: cd.ref } });
    if (!exists) {
      await prisma.controlDeficiency.create({
        data: {
          engagementId: eng.id, deficiencyReference: cd.ref, cycle: cd.cycle,
          deficiencyDescription: cd.desc, severity: cd.severity,
          rootCause: cd.root, remediationPlan: cd.remediation, remediationStatus: cd.remediationStatus,
          identifiedById: senior.id, identifiedDate: new Date("2026-08-10"),
          reviewedById: manager.id, reviewedDate: new Date("2026-08-15"),
        },
      });
    }
  }
  console.log("  [Execution] Misstatements, adjustments, confirmations, deficiencies seeded");

  const seTemplates = [
    { ref: "SE-001", eventType: "TYPE_1_ADJUSTING" as const, desc: "Resolution of export receivable dispute with European buyer — PKR 800K difference settled at PKR 750K in July 2026", evaluation: "Adjusting event — confirms condition existing at period end. Difference immaterial, no adjustment required.", financialImpact: 50000 },
    { ref: "SE-002", eventType: "TYPE_2_NON_ADJUSTING" as const, desc: "Board approved PKR 150M investment in new weaving unit in August 2026", evaluation: "Non-adjusting event — post-period commitment. Disclosure in notes required.", financialImpact: 0 },
  ];
  for (const se of seTemplates) {
    const exists = await prisma.subsequentEvent.findFirst({ where: { engagementId: eng.id, eventReference: se.ref } });
    if (!exists) {
      await prisma.subsequentEvent.create({
        data: {
          engagementId: eng.id, eventReference: se.ref, eventDate: new Date("2026-07-15"),
          eventType: se.eventType, description: se.desc, evaluation: se.evaluation,
          financialImpact: se.financialImpact, status: "RESOLVED",
          identifiedById: senior.id, identifiedDate: new Date("2026-08-20"),
          reviewedById: manager.id, reviewedDate: new Date("2026-08-22"),
        },
      });
    }
  }

  await prisma.goingConcernAssessment.updateMany({
    where: { engagementId: eng.id },
    data: {
      auditConclusion: "Based on our audit procedures, no material uncertainty related to going concern exists. The entity has adequate resources to continue operations for at least 12 months from the reporting date.",
      materialUncertaintyExists: false,
      reviewedById: manager.id, reviewedDate: new Date("2026-08-22"),
      partnerApprovedById: partner.id, partnerApprovalDate: new Date("2026-08-25"),
    },
  });

  const existingWR = await prisma.writtenRepresentation.findFirst({ where: { engagementId: eng.id } });
  if (!existingWR) {
    await prisma.writtenRepresentation.create({
      data: {
        engagementId: eng.id, representationType: "MANAGEMENT",
        representationText: "We confirm that the financial statements are prepared in accordance with IFRS for SMEs and give a true and fair view. All transactions have been recorded and disclosed. We have provided access to all relevant records.",
        isStandard: true, managementAcknowledged: true,
        acknowledgmentDate: new Date("2026-08-28"), signatoryName: "Muhammad Tariq Hussain", signatoryTitle: "CEO",
        preparedById: manager.id, reviewedById: partner.id, reviewedDate: new Date("2026-08-25"),
      },
    });
  }

  await prisma.auditReport.upsert({
    where: { engagementId: eng.id },
    update: { opinionType: "UNMODIFIED", signedDate: new Date("2026-09-15"), releasedToClient: true },
    create: {
      engagementId: eng.id, reportReference: "AR-ABT-2026",
      reportDate: new Date("2026-09-15"), opinionType: "UNMODIFIED",
      opinionBasis: "We conducted our audit in accordance with International Standards on Auditing (ISAs). We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.",
      hasKeyAuditMatters: true,
      keyAuditMatters: [
        { matter: "Revenue recognition — export sales", response: "We tested export LC documentation, cutoff procedures, and confirmed material receivable balances." },
        { matter: "Inventory valuation", response: "We observed physical counts, tested NRV calculations, and reviewed obsolescence provisions." },
      ],
      hasEmphasisOfMatter: false, hasOtherMatter: false,
      draftedById: manager.id, managerReviewedById: manager.id, managerReviewDate: new Date("2026-09-10"),
      partnerApprovedById: partner.id, partnerApprovalDate: new Date("2026-09-12"),
      signedById: partner.id, signedDate: new Date("2026-09-15"),
      releasedToClient: true, releasedDate: new Date("2026-09-15"),
    },
  });

  const existingML = await prisma.managementLetter.findFirst({ where: { engagementId: eng.id } });
  if (!existingML) {
    await prisma.managementLetter.create({
      data: {
        engagementId: eng.id, letterReference: "ML-ABT-2026", letterDate: new Date("2026-09-15"),
        findings: [
          { finding: "Revenue cycle — LC documentation review frequency", severity: "SIGNIFICANT", recommendation: "Implement monthly review process" },
          { finding: "Inventory — no formal NRV assessment process", severity: "MODERATE", recommendation: "Quarterly NRV review with marketing input" },
          { finding: "Purchase cycle — dual authorization gap", severity: "MODERATE", recommendation: "Configure mandatory dual approval in Oracle NetSuite" },
        ],
        recommendations: [
          { area: "Revenue", recommendation: "Monthly LC documentation review before revenue recognition", priority: "HIGH" },
          { area: "Inventory", recommendation: "Implement formal NRV assessment and obsolescence policy", priority: "HIGH" },
          { area: "IT Controls", recommendation: "Configure dual approval for all POs in Oracle NetSuite", priority: "MEDIUM" },
        ],
        letterContent: "Dear Board of Directors,\n\nIn connection with our audit of the financial statements of Al-Baraka Textiles (Pvt.) Limited for the year ended 30 June 2026, we identified certain matters that we wish to bring to your attention...",
        draftedById: manager.id,
        partnerApprovedById: partner.id, partnerApprovalDate: new Date("2026-09-14"),
        deliveredToClient: true, deliveredDate: new Date("2026-09-15"),
      },
    });
  }

  await prisma.auditFileAssembly.upsert({
    where: { engagementId: eng.id },
    update: { assemblyStatus: "completed", finalFileGenerated: true },
    create: {
      engagementId: eng.id, assemblyStatus: "completed",
      assemblyStartDate: new Date("2026-09-01"), assemblyCompletedDate: new Date("2026-09-10"),
      assemblyDeadline: new Date("2026-11-15"),
      totalFiles: 245, indexedFiles: 245, reviewedFiles: 245,
      finalFileGenerated: true, finalFilePath: "audit-files/ENG-2026-003/final/audit-file-v1.zip",
      preparedById: senior.id, reviewedById: manager.id, approvedById: partner.id,
    },
  });

  const delivTypes = [
    { type: "AUDIT_REPORT" as const, opinionType: "UNMODIFIED" as const },
    { type: "MANAGEMENT_LETTER" as const, opinionType: undefined },
    { type: "ENGAGEMENT_SUMMARY" as const, opinionType: undefined },
  ];
  for (const dt of delivTypes) {
    const exists = await prisma.deliverable.findFirst({ where: { engagementId: eng.id, deliverableType: dt.type } });
    if (!exists) {
      await prisma.deliverable.create({
        data: {
          engagementId: eng.id, deliverableType: dt.type, opinionType: dt.opinionType,
          status: "ISSUED",
          preparedById: manager.id, reviewedById: partner.id,
          approvedById: partner.id, issuedById: partner.id,
          issuedAt: new Date("2026-09-15"),
        },
      });
    }
  }
  console.log("  [Finalization] Subsequent events, going concern, WR, report, ML, assembly, deliverables seeded");
  console.log("[seedCompleteAudit] Complete audit file seeded successfully for ENG-2026-003!");
}

const WP_DEFINITIONS = [
  { fsHeadKey: "REVENUE", fsHeadName: "Revenue", statementType: "PL" as const, currentYearBalance: 1150000000, priorYearBalance: 980000000, inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskLevel: "high" as const, workpaperRef: "WP-REV-001", indexReference: "P1", isaReference: "ISA 330/500", isMaterialHead: true },
  { fsHeadKey: "INVENTORIES", fsHeadName: "Inventories", statementType: "BS" as const, currentYearBalance: 368000000, priorYearBalance: 315000000, inherentRisk: "HIGH" as const, controlRisk: "HIGH" as const, riskLevel: "high" as const, workpaperRef: "WP-INV-001", indexReference: "C1", isaReference: "ISA 501/330", isMaterialHead: true },
  { fsHeadKey: "PROPERTY_PLANT_EQUIPMENT", fsHeadName: "Property, Plant & Equipment", statementType: "BS" as const, currentYearBalance: 857000000, priorYearBalance: 812000000, inherentRisk: "MODERATE" as const, controlRisk: "LOW" as const, riskLevel: "medium" as const, workpaperRef: "WP-PPE-001", indexReference: "B1", isaReference: "ISA 330", isMaterialHead: true },
  { fsHeadKey: "TRADE_RECEIVABLES", fsHeadName: "Trade Receivables", statementType: "BS" as const, currentYearBalance: 233500000, priorYearBalance: 200000000, inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskLevel: "medium" as const, workpaperRef: "WP-TR-001", indexReference: "D1", isaReference: "ISA 505/330", isMaterialHead: true },
  { fsHeadKey: "TRADE_AND_OTHER_PAYABLES", fsHeadName: "Trade and Other Payables", statementType: "BS" as const, currentYearBalance: 161000000, priorYearBalance: 132000000, inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskLevel: "medium" as const, workpaperRef: "WP-AP-001", indexReference: "E1", isaReference: "ISA 330", isMaterialHead: true },
  { fsHeadKey: "COST_OF_SALES", fsHeadName: "Cost of Sales", statementType: "PL" as const, currentYearBalance: 850000000, priorYearBalance: 720000000, inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskLevel: "high" as const, workpaperRef: "WP-COS-001", indexReference: "P2", isaReference: "ISA 330", isMaterialHead: true },
  { fsHeadKey: "CASH_AND_BANK_BALANCES", fsHeadName: "Cash and Bank Balances", statementType: "BS" as const, currentYearBalance: 88000000, priorYearBalance: 72000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, workpaperRef: "WP-CB-001", indexReference: "A1", isaReference: "ISA 330", isMaterialHead: true },
  { fsHeadKey: "LONG_TERM_BORROWINGS", fsHeadName: "Long Term Borrowings", statementType: "BS" as const, currentYearBalance: 280000000, priorYearBalance: 350000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, workpaperRef: "WP-LTB-001", indexReference: "F1", isaReference: "ISA 330", isMaterialHead: true },
  { fsHeadKey: "SHARE_CAPITAL", fsHeadName: "Share Capital", statementType: "BS" as const, currentYearBalance: 500000000, priorYearBalance: 500000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, workpaperRef: "WP-SC-001", indexReference: "G1", isaReference: "ISA 330", isMaterialHead: false },
  { fsHeadKey: "FINANCE_COSTS", fsHeadName: "Finance Costs", statementType: "PL" as const, currentYearBalance: 58000000, priorYearBalance: 48000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, workpaperRef: "WP-FC-001", indexReference: "P3", isaReference: "ISA 330", isMaterialHead: true },
  { fsHeadKey: "ADMIN_EXPENSES", fsHeadName: "Administrative Expenses", statementType: "PL" as const, currentYearBalance: 90000000, priorYearBalance: 78000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, workpaperRef: "WP-ADM-001", indexReference: "P4", isaReference: "ISA 330", isMaterialHead: false },
  { fsHeadKey: "SELLING_EXPENSES", fsHeadName: "Selling & Distribution Expenses", statementType: "PL" as const, currentYearBalance: 48000000, priorYearBalance: 42000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, workpaperRef: "WP-SDE-001", indexReference: "P5", isaReference: "ISA 330", isMaterialHead: false },
  { fsHeadKey: "RETAINED_EARNINGS", fsHeadName: "Retained Earnings", statementType: "BS" as const, currentYearBalance: 484300000, priorYearBalance: 340500000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, workpaperRef: "WP-RE-001", indexReference: "G2", isaReference: "ISA 330", isMaterialHead: false },
];

async function ensureWorkingPapers(engId: string, seniorId: string, partnerId: string, managerId: string) {
  const existing = await prisma.fSHeadWorkingPaper.findMany({ where: { engagementId: engId }, select: { fsHeadKey: true } });
  const existingKeys = new Set(existing.map(w => w.fsHeadKey));
  let created = 0;
  for (const wp of WP_DEFINITIONS) {
    if (!existingKeys.has(wp.fsHeadKey)) {
      await prisma.fSHeadWorkingPaper.create({
        data: {
          engagementId: engId, preparedById: seniorId,
          ...wp,
          status: "APPROVED", auditStatus: "COMPLETED",
          conclusion: `Based on the audit procedures performed, the evidence obtained is sufficient and appropriate. The ${wp.fsHeadName} balance of PKR ${Math.abs(wp.currentYearBalance).toLocaleString()} as at 30 June 2026 is fairly stated in all material respects.`,
          conclusionStatus: "FINAL",
          tocCompleted: true, todCompleted: true, analyticsCompleted: true,
          preparedAt: new Date("2026-08-15"),
          reviewedById: managerId, reviewedAt: new Date("2026-08-20"),
          approvedById: partnerId, approvedAt: new Date("2026-08-25"),
          isLocked: true, lockedAt: new Date("2026-08-26"), lockedById: partnerId,
        },
      });
      created++;
    }
  }
  await prisma.fSHeadWorkingPaper.updateMany({
    where: { engagementId: engId },
    data: {
      status: "APPROVED", auditStatus: "COMPLETED", conclusionStatus: "FINAL",
      tocCompleted: true, todCompleted: true, analyticsCompleted: true,
      isLocked: true,
    },
  });
  if (created > 0) console.log(`  [System] Created ${created} missing working papers (total: ${existing.length + created})`);
}

async function ensureMaterialitySet(engId: string, seniorId: string, managerId: string, partnerId: string) {
  const existing = await prisma.materialitySet.findFirst({ where: { engagementId: engId } });
  if (existing) return;
  await prisma.materialitySet.create({
    data: {
      engagementId: engId,
      versionId: 1,
      status: "LOCKED",
      benchmarkType: "PROFIT_BEFORE_TAX",
      benchmarkAmount: 180000000,
      percentApplied: 5.0,
      overallMateriality: 9000000,
      performanceMateriality: 6750000,
      trivialThreshold: 450000,
      rationale: "Materiality determined at 5% of PBT consistent with prior year and industry benchmarks. Conservative approach applied due to HIGH risk rating and first-year audit. Performance materiality at 75% of overall materiality. Trivial threshold at 5% of overall materiality.",
      preparedById: seniorId, preparedAt: new Date("2026-01-14"),
      reviewedById: managerId, reviewedAt: new Date("2026-01-16"),
      approvedById: partnerId, approvedAt: new Date("2026-01-18"),
      isLocked: true, lockedAt: new Date("2026-01-19"), lockedById: partnerId,
    },
  });
  console.log("  [System] MaterialitySet created (PKR 9M / 6.75M / 450K)");
}

async function ensureInternalControlsAndWalkthroughs(engId: string, seniorId: string, managerId: string) {
  const existingControls = await prisma.internalControl.count({ where: { engagementId: engId } });
  if (existingControls > 0) {
    const controlsWithoutWT = await prisma.internalControl.findMany({
      where: { engagementId: engId, walkthroughs: { none: {} } },
      select: { id: true, controlDescription: true },
    });
    for (const ctrl of controlsWithoutWT) {
      await prisma.controlWalkthrough.create({
        data: {
          controlId: ctrl.id, engagementId: engId,
          walkthroughDate: new Date("2025-11-20"),
          walkthroughNarrative: `Traced sample transaction through ${ctrl.controlDescription}. Verified authorization, recording, and reporting steps.`,
          designAssessment: "EFFECTIVE", implementationAssessment: "EFFECTIVE",
          designDeficiencyNoted: false,
          evidenceReferences: [`WP-CW-${ctrl.id.slice(0, 6)}`],
          performedById: seniorId, reviewedById: managerId, reviewedDate: new Date("2025-11-25"),
        },
      });
    }
    if (controlsWithoutWT.length > 0) console.log(`  [System] Created ${controlsWithoutWT.length} missing walkthroughs`);
    return;
  }

  const controlDefs = [
    { cycle: "REVENUE" as const, processName: "Revenue Recognition", controlId: "IC-REV-001", controlObjective: "Revenue is recorded only when performance obligations are satisfied", controlDescription: "Sales order authorization and credit approval before dispatch", controlType: "PREVENTIVE" as const, controlNature: "MANUAL" as const, frequency: "EACH_OCCURRENCE" as const, controlOwner: "Sales Manager", keyControl: true, relyOnControl: true, relatedAssertions: ["OCCURRENCE", "ACCURACY"] },
    { cycle: "REVENUE" as const, processName: "Revenue Recognition", controlId: "IC-REV-002", controlObjective: "Revenue is complete and recorded in the correct period", controlDescription: "Dispatch note to invoice matching and cutoff verification", controlType: "DETECTIVE" as const, controlNature: "IT_DEPENDENT_MANUAL" as const, frequency: "DAILY" as const, controlOwner: "Finance Manager", keyControl: true, relyOnControl: true, relatedAssertions: ["COMPLETENESS", "CUTOFF"] },
    { cycle: "REVENUE" as const, processName: "Export Revenue", controlId: "IC-REV-003", controlObjective: "Export revenue is recognized on valid LC documentation", controlDescription: "LC documentation review for export sales before recognition", controlType: "PREVENTIVE" as const, controlNature: "MANUAL" as const, frequency: "EACH_OCCURRENCE" as const, controlOwner: "Export Manager", keyControl: true, relyOnControl: true, relatedAssertions: ["OCCURRENCE", "RIGHTS_OBLIGATIONS"] },
    { cycle: "INVENTORY" as const, processName: "Inventory Receipt", controlId: "IC-INV-001", controlObjective: "Inventory receipts are properly recorded", controlDescription: "Goods receipt note (GRN) verification against PO and physical count", controlType: "PREVENTIVE" as const, controlNature: "MANUAL" as const, frequency: "EACH_OCCURRENCE" as const, controlOwner: "Store Manager", keyControl: true, relyOnControl: true, relatedAssertions: ["EXISTENCE", "COMPLETENESS"] },
    { cycle: "INVENTORY" as const, processName: "Inventory Valuation", controlId: "IC-INV-002", controlObjective: "Inventory is valued at lower of cost and NRV", controlDescription: "Production order and yield reconciliation with cost allocation", controlType: "DETECTIVE" as const, controlNature: "IT_DEPENDENT_MANUAL" as const, frequency: "MONTHLY" as const, controlOwner: "Cost Accountant", keyControl: true, relyOnControl: true, relatedAssertions: ["VALUATION", "ACCURACY"] },
    { cycle: "INVENTORY" as const, processName: "Physical Counts", controlId: "IC-INV-003", controlObjective: "Physical inventory agrees to book records", controlDescription: "Periodic physical count and adjustment procedure", controlType: "DETECTIVE" as const, controlNature: "MANUAL" as const, frequency: "QUARTERLY" as const, controlOwner: "Production Manager", keyControl: true, relyOnControl: true, relatedAssertions: ["EXISTENCE", "VALUATION"] },
    { cycle: "PURCHASES" as const, processName: "Purchase Authorization", controlId: "IC-PUR-001", controlObjective: "Purchases are properly authorized", controlDescription: "Three-way matching (PO-GRN-Invoice) before payment", controlType: "PREVENTIVE" as const, controlNature: "IT_DEPENDENT_MANUAL" as const, frequency: "EACH_OCCURRENCE" as const, controlOwner: "Procurement Manager", keyControl: true, relyOnControl: true, relatedAssertions: ["OCCURRENCE", "ACCURACY"] },
    { cycle: "PURCHASES" as const, processName: "Payment Processing", controlId: "IC-PUR-002", controlObjective: "Payments are properly authorized", controlDescription: "Payment authorization dual signatory requirement", controlType: "PREVENTIVE" as const, controlNature: "MANUAL" as const, frequency: "EACH_OCCURRENCE" as const, controlOwner: "CFO", keyControl: true, relyOnControl: true, relatedAssertions: ["OCCURRENCE", "COMPLETENESS"] },
    { cycle: "TREASURY" as const, processName: "Bank Reconciliation", controlId: "IC-TRE-001", controlObjective: "Bank balances are accurately reflected", controlDescription: "Monthly bank reconciliation with independent review", controlType: "DETECTIVE" as const, controlNature: "MANUAL" as const, frequency: "MONTHLY" as const, controlOwner: "Finance Manager", keyControl: true, relyOnControl: true, relatedAssertions: ["EXISTENCE", "COMPLETENESS"] },
    { cycle: "FIXED_ASSETS" as const, processName: "Capital Expenditure", controlId: "IC-FA-001", controlObjective: "Capital expenditure is properly authorized and capitalized", controlDescription: "Capital expenditure authorization (board approval >10M)", controlType: "PREVENTIVE" as const, controlNature: "MANUAL" as const, frequency: "EACH_OCCURRENCE" as const, controlOwner: "CEO/Board", keyControl: true, relyOnControl: true, relatedAssertions: ["EXISTENCE", "VALUATION"] },
    { cycle: "FIXED_ASSETS" as const, processName: "Asset Register", controlId: "IC-FA-002", controlObjective: "Fixed asset register is complete and accurate", controlDescription: "Fixed asset register reconciliation to GL quarterly", controlType: "DETECTIVE" as const, controlNature: "IT_DEPENDENT_MANUAL" as const, frequency: "QUARTERLY" as const, controlOwner: "Finance Manager", keyControl: true, relyOnControl: false, relatedAssertions: ["COMPLETENESS", "ACCURACY"] },
    { cycle: "PAYROLL" as const, processName: "Payroll Processing", controlId: "IC-PAY-001", controlObjective: "Payroll is accurately calculated and authorized", controlDescription: "Payroll computation review and approval by HR and Finance", controlType: "DETECTIVE" as const, controlNature: "IT_DEPENDENT_MANUAL" as const, frequency: "MONTHLY" as const, controlOwner: "HR Manager", keyControl: true, relyOnControl: true, relatedAssertions: ["OCCURRENCE", "ACCURACY"] },
    { cycle: "FINANCIAL_REPORTING" as const, processName: "Period-End Close", controlId: "IC-FR-001", controlObjective: "Financial statements are accurately prepared", controlDescription: "Month-end close checklist with review by CFO", controlType: "DETECTIVE" as const, controlNature: "MANUAL" as const, frequency: "MONTHLY" as const, controlOwner: "CFO", keyControl: true, relyOnControl: false, relatedAssertions: ["ACCURACY", "COMPLETENESS"] },
  ];

  for (const cd of controlDefs) {
    const ctrl = await prisma.internalControl.create({
      data: {
        engagementId: engId,
        cycle: cd.cycle, processName: cd.processName,
        controlId: cd.controlId, controlObjective: cd.controlObjective,
        controlDescription: cd.controlDescription,
        controlType: cd.controlType, controlNature: cd.controlNature,
        frequency: cd.frequency, controlOwner: cd.controlOwner,
        keyControl: cd.keyControl, relyOnControl: cd.relyOnControl,
        relatedRiskIds: [], relatedAssertions: cd.relatedAssertions,
        documentedById: seniorId, documentedDate: new Date("2025-11-15"),
      },
    });
    await prisma.controlWalkthrough.create({
      data: {
        controlId: ctrl.id, engagementId: engId,
        walkthroughDate: new Date("2025-11-20"),
        walkthroughNarrative: `Traced sample transaction through ${cd.controlDescription}. Verified authorization, recording, and reporting steps. Control operating as designed.`,
        designAssessment: "EFFECTIVE", implementationAssessment: "EFFECTIVE",
        designDeficiencyNoted: false,
        evidenceReferences: [`WP-CW-${cd.controlId}`],
        performedById: seniorId, reviewedById: managerId, reviewedDate: new Date("2025-11-25"),
      },
    });
  }
  console.log(`  [System] InternalControls (${controlDefs.length}) + walkthroughs created`);
}

const TOC_TEMPLATES = [
  { fsHead: "REVENUE", controls: [
    { ref: "TOC-REV-001", desc: "Sales order authorization and credit approval", assertions: ["OCCURRENCE", "ACCURACY"] },
    { ref: "TOC-REV-002", desc: "Dispatch note to invoice matching", assertions: ["COMPLETENESS", "CUTOFF"] },
    { ref: "TOC-REV-003", desc: "LC documentation review for export sales", assertions: ["OCCURRENCE", "RIGHTS_OBLIGATIONS"] },
  ]},
  { fsHead: "INVENTORIES", controls: [
    { ref: "TOC-INV-001", desc: "Goods receipt note (GRN) verification", assertions: ["EXISTENCE", "COMPLETENESS"] },
    { ref: "TOC-INV-002", desc: "Production order and yield reconciliation", assertions: ["VALUATION", "ACCURACY"] },
    { ref: "TOC-INV-003", desc: "Periodic physical count and adjustment", assertions: ["EXISTENCE", "VALUATION"] },
  ]},
  { fsHead: "PROPERTY_PLANT_EQUIPMENT", controls: [
    { ref: "TOC-PPE-001", desc: "Capital expenditure authorization (board approval >10M)", assertions: ["EXISTENCE", "VALUATION"] },
    { ref: "TOC-PPE-002", desc: "Fixed asset register reconciliation to GL", assertions: ["COMPLETENESS", "ACCURACY"] },
  ]},
  { fsHead: "TRADE_RECEIVABLES", controls: [
    { ref: "TOC-TR-001", desc: "Credit limit approval and monitoring", assertions: ["VALUATION", "RIGHTS_OBLIGATIONS"] },
    { ref: "TOC-TR-002", desc: "Monthly aging review and follow-up", assertions: ["VALUATION", "COMPLETENESS"] },
  ]},
  { fsHead: "TRADE_AND_OTHER_PAYABLES", controls: [
    { ref: "TOC-AP-001", desc: "Three-way matching (PO-GRN-Invoice)", assertions: ["OCCURRENCE", "ACCURACY"] },
    { ref: "TOC-AP-002", desc: "Payment authorization dual signatory", assertions: ["OCCURRENCE", "COMPLETENESS"] },
  ]},
  { fsHead: "CASH_AND_BANK_BALANCES", controls: [
    { ref: "TOC-CB-001", desc: "Bank reconciliation monthly review", assertions: ["EXISTENCE", "COMPLETENESS"] },
    { ref: "TOC-CB-002", desc: "Payment authorization limits", assertions: ["OCCURRENCE", "ACCURACY"] },
  ]},
  { fsHead: "COST_OF_SALES", controls: [
    { ref: "TOC-COS-001", desc: "Raw material issuance authorization", assertions: ["OCCURRENCE", "ACCURACY"] },
    { ref: "TOC-COS-002", desc: "Cost of production computation review", assertions: ["VALUATION", "ACCURACY"] },
  ]},
  { fsHead: "LONG_TERM_BORROWINGS", controls: [
    { ref: "TOC-LTB-001", desc: "Loan drawdown board approval", assertions: ["COMPLETENESS", "EXISTENCE"] },
  ]},
  { fsHead: "FINANCE_COSTS", controls: [
    { ref: "TOC-FC-001", desc: "Interest computation review", assertions: ["ACCURACY", "COMPLETENESS"] },
  ]},
];

async function ensureTocData(engId: string, seniorId: string) {
  const wps = await prisma.fSHeadWorkingPaper.findMany({ where: { engagementId: engId }, select: { id: true, fsHeadKey: true } });
  const wpMap = new Map(wps.map(w => [w.fsHeadKey, w.id]));
  let created = 0;
  for (const t of TOC_TEMPLATES) {
    const wpId = wpMap.get(t.fsHead);
    if (!wpId) continue;
    for (const c of t.controls) {
      const exists = await prisma.fSHeadTOC.findFirst({ where: { workingPaperId: wpId, tocRef: c.ref } });
      if (!exists) {
        await prisma.fSHeadTOC.create({
          data: {
            workingPaperId: wpId, tocRef: c.ref, controlDescription: c.desc, assertions: c.assertions,
            testSteps: `Selected sample of 25 transactions. Verified ${c.desc.toLowerCase()}. Traced to supporting documentation. Confirmed proper authorization.`,
            testSampleSize: 25, exceptionsFound: 0, result: "EFFECTIVE",
            conclusion: "Control operating effectively throughout the period. No exceptions noted.",
            testingPerformedById: seniorId, testingPerformedAt: new Date("2026-08-05"),
          },
        });
        created++;
      }
    }
  }
  if (created > 0) console.log(`  [System] TOC records created: ${created}`);
}

const TOD_TEMPLATES = [
  { fsHead: "REVENUE", tests: [
    { ref: "TOD-REV-001", desc: "Revenue cutoff testing — last 5 days pre/post period-end", assertions: ["CUTOFF"], popValue: 1235000000, sampleSize: 30 },
    { ref: "TOD-REV-002", desc: "Export LC documentation — trace to shipping docs and bank advice", assertions: ["OCCURRENCE", "ACCURACY"], popValue: 680000000, sampleSize: 25 },
    { ref: "TOD-REV-003", desc: "Local sales sampling — invoice to delivery note matching", assertions: ["OCCURRENCE"], popValue: 520000000, sampleSize: 20 },
    { ref: "TOD-REV-004", desc: "Sales returns testing — post-period credit notes", assertions: ["COMPLETENESS"], popValue: 35000000, sampleSize: 10 },
    { ref: "TOD-REV-005", desc: "Related party sales — arm's length pricing verification", assertions: ["VALUATION", "PRESENTATION_DISCLOSURE"], popValue: 205000000, sampleSize: 15 },
  ]},
  { fsHead: "INVENTORIES", tests: [
    { ref: "TOD-INV-001", desc: "Physical inventory observation — test counts at Korangi plant", assertions: ["EXISTENCE"], popValue: 368000000, sampleSize: 40 },
    { ref: "TOD-INV-002", desc: "Inventory valuation — cost vs NRV comparison", assertions: ["VALUATION"], popValue: 368000000, sampleSize: 25 },
    { ref: "TOD-INV-003", desc: "Raw material price testing — purchase invoice verification", assertions: ["VALUATION", "ACCURACY"], popValue: 210000000, sampleSize: 20 },
    { ref: "TOD-INV-004", desc: "WIP completion percentage — production records review", assertions: ["VALUATION"], popValue: 52000000, sampleSize: 10 },
    { ref: "TOD-INV-005", desc: "Obsolescence provision testing — slow-moving analysis", assertions: ["VALUATION"], popValue: 368000000, sampleSize: 15 },
  ]},
  { fsHead: "PROPERTY_PLANT_EQUIPMENT", tests: [
    { ref: "TOD-PPE-001", desc: "Additions testing — physical verification and authorization", assertions: ["EXISTENCE", "VALUATION"], popValue: 165000000, sampleSize: 15 },
    { ref: "TOD-PPE-002", desc: "Depreciation recalculation", assertions: ["VALUATION", "ACCURACY"], popValue: 1202000000, sampleSize: 20 },
    { ref: "TOD-PPE-003", desc: "Disposals testing — proceeds and gain/loss computation", assertions: ["COMPLETENESS", "ACCURACY"], popValue: 8000000, sampleSize: 5 },
    { ref: "TOD-PPE-004", desc: "Impairment indicator review", assertions: ["VALUATION"], popValue: 857000000, sampleSize: 10 },
  ]},
  { fsHead: "TRADE_RECEIVABLES", tests: [
    { ref: "TOD-TR-001", desc: "Receivables confirmation — positive confirmation for top 20 balances", assertions: ["EXISTENCE", "VALUATION"], popValue: 233500000, sampleSize: 20 },
    { ref: "TOD-TR-002", desc: "Aging analysis and ECL provision recalculation", assertions: ["VALUATION"], popValue: 233500000, sampleSize: 15 },
    { ref: "TOD-TR-003", desc: "Subsequent receipts testing", assertions: ["EXISTENCE"], popValue: 233500000, sampleSize: 15 },
  ]},
  { fsHead: "TRADE_AND_OTHER_PAYABLES", tests: [
    { ref: "TOD-AP-001", desc: "Supplier statement reconciliation", assertions: ["COMPLETENESS", "ACCURACY"], popValue: 161000000, sampleSize: 15 },
    { ref: "TOD-AP-002", desc: "Unrecorded liabilities search — post-period payments and invoices", assertions: ["COMPLETENESS"], popValue: 161000000, sampleSize: 20 },
    { ref: "TOD-AP-003", desc: "Accrued expenses reasonableness", assertions: ["VALUATION", "COMPLETENESS"], popValue: 28000000, sampleSize: 10 },
  ]},
  { fsHead: "CASH_AND_BANK_BALANCES", tests: [
    { ref: "TOD-CB-001", desc: "Bank confirmation — all 3 bank accounts", assertions: ["EXISTENCE", "COMPLETENESS"], popValue: 88000000, sampleSize: 3 },
    { ref: "TOD-CB-002", desc: "Bank reconciliation review and outstanding items", assertions: ["EXISTENCE", "ACCURACY"], popValue: 88000000, sampleSize: 10 },
  ]},
  { fsHead: "LONG_TERM_BORROWINGS", tests: [
    { ref: "TOD-LTB-001", desc: "Loan confirmation — HBL and MCB LTFF", assertions: ["EXISTENCE", "COMPLETENESS"], popValue: 280000000, sampleSize: 2 },
    { ref: "TOD-LTB-002", desc: "Covenant compliance review", assertions: ["PRESENTATION_DISCLOSURE"], popValue: 280000000, sampleSize: 2 },
  ]},
  { fsHead: "SHARE_CAPITAL", tests: [
    { ref: "TOD-SC-001", desc: "Share register reconciliation to SECP records", assertions: ["EXISTENCE", "PRESENTATION_DISCLOSURE"], popValue: 500000000, sampleSize: 1 },
  ]},
  { fsHead: "COST_OF_SALES", tests: [
    { ref: "TOD-COS-001", desc: "Cost of production computation — materials, labor, overheads", assertions: ["ACCURACY", "VALUATION"], popValue: 850000000, sampleSize: 25 },
    { ref: "TOD-COS-002", desc: "Purchase testing — raw material invoices to GRN", assertions: ["OCCURRENCE", "ACCURACY"], popValue: 480000000, sampleSize: 20 },
    { ref: "TOD-COS-003", desc: "Manufacturing overhead allocation reasonableness", assertions: ["VALUATION"], popValue: 205000000, sampleSize: 10 },
  ]},
  { fsHead: "FINANCE_COSTS", tests: [
    { ref: "TOD-FC-001", desc: "Interest expense recalculation — bank loans", assertions: ["ACCURACY"], popValue: 58000000, sampleSize: 5 },
    { ref: "TOD-FC-002", desc: "LC charges and bank charges verification", assertions: ["OCCURRENCE", "ACCURACY"], popValue: 12000000, sampleSize: 10 },
  ]},
  { fsHead: "ADMIN_EXPENSES", tests: [
    { ref: "TOD-ADM-001", desc: "Salary verification — payroll register to HR records", assertions: ["OCCURRENCE", "ACCURACY"], popValue: 55000000, sampleSize: 15 },
    { ref: "TOD-ADM-002", desc: "Insurance premium verification", assertions: ["OCCURRENCE", "VALUATION"], popValue: 8000000, sampleSize: 3 },
  ]},
  { fsHead: "SELLING_EXPENSES", tests: [
    { ref: "TOD-SDE-001", desc: "Export commission and freight documentation", assertions: ["OCCURRENCE", "ACCURACY"], popValue: 48000000, sampleSize: 10 },
  ]},
  { fsHead: "RETAINED_EARNINGS", tests: [
    { ref: "TOD-RE-001", desc: "Opening balance reconciliation and movement analysis", assertions: ["ACCURACY", "COMPLETENESS"], popValue: 484300000, sampleSize: 1 },
  ]},
];

async function ensureTodData(engId: string, seniorId: string) {
  const wps = await prisma.fSHeadWorkingPaper.findMany({ where: { engagementId: engId }, select: { id: true, fsHeadKey: true } });
  const wpMap = new Map(wps.map(w => [w.fsHeadKey, w.id]));
  let created = 0;
  for (const t of TOD_TEMPLATES) {
    const wpId = wpMap.get(t.fsHead);
    if (!wpId) continue;
    for (const d of t.tests) {
      const exists = await prisma.fSHeadTOD.findFirst({ where: { workingPaperId: wpId, todRef: d.ref } });
      if (!exists) {
        await prisma.fSHeadTOD.create({
          data: {
            workingPaperId: wpId, todRef: d.ref, procedureDescription: d.desc, assertions: d.assertions,
            populationValue: d.popValue, sampleSize: d.sampleSize,
            exceptionsFound: 0, projectedMisstatement: 0,
            result: "SATISFACTORY",
            conclusion: "Testing completed satisfactorily. No material exceptions noted. Results consistent with expectations.",
            testingPerformedById: seniorId, testingPerformedAt: new Date("2026-08-10"),
          },
        });
        created++;
      }
    }
  }
  if (created > 0) console.log(`  [System] TOD records created: ${created}`);
}

async function ensureAttachments(engId: string, seniorId: string) {
  const wps = await prisma.fSHeadWorkingPaper.findMany({ where: { engagementId: engId }, select: { id: true, fsHeadKey: true, fsHeadName: true } });
  const evidenceTypes = ["WORKING_PAPER", "CLIENT_DOCUMENT", "CONFIRMATION", "COMPUTATION", "SCHEDULE", "THIRD_PARTY", "EXTERNAL_REPORT"];
  let created = 0;
  for (const wp of wps) {
    const existingCount = await prisma.fSHeadAttachment.count({ where: { workingPaperId: wp.id } });
    if (existingCount > 0) continue;
    const numEvidence = wp.fsHeadKey === "REVENUE" || wp.fsHeadKey === "INVENTORIES" ? 20 :
      wp.fsHeadKey === "PROPERTY_PLANT_EQUIPMENT" || wp.fsHeadKey === "COST_OF_SALES" ? 18 :
      wp.fsHeadKey === "TRADE_RECEIVABLES" || wp.fsHeadKey === "TRADE_AND_OTHER_PAYABLES" ? 15 : 10;
    for (let i = 0; i < numEvidence; i++) {
      await prisma.fSHeadAttachment.create({
        data: {
          workingPaperId: wp.id,
          fileName: `${wp.fsHeadKey}_evidence_${i + 1}.pdf`,
          originalName: `${wp.fsHeadName} - Evidence ${i + 1}.pdf`,
          mimeType: "application/pdf", fileSize: 150000 + Math.floor(Math.random() * 500000),
          filePath: `uploads/evidence/${engId}/${wp.fsHeadKey}/${i + 1}.pdf`,
          description: `Evidence item ${i + 1} for ${wp.fsHeadName}`,
          evidenceType: evidenceTypes[i % evidenceTypes.length],
          uploadedById: seniorId,
        },
      });
      created++;
    }
  }
  if (created > 0) console.log(`  [System] Attachments created: ${created}`);
}

async function ensureReviewPoints(engId: string, managerId: string, seniorId: string) {
  const wps = await prisma.fSHeadWorkingPaper.findMany({ where: { engagementId: engId }, select: { id: true, fsHeadKey: true } });
  const wpMap = new Map(wps.map(w => [w.fsHeadKey, w.id]));
  const rpTemplates = [
    { fsHead: "REVENUE", points: ["Verify LC negotiation date vs recognition date for top 5 export shipments", "Confirm credit note treatment for returned goods in last week of June", "Check related party pricing against KCA spot rates"] },
    { fsHead: "INVENTORIES", points: ["Verify WIP completion percentages at count date", "Confirm obsolescence provision methodology change from prior year", "Check NRV for slow-moving finished goods > 180 days"] },
    { fsHead: "PROPERTY_PLANT_EQUIPMENT", points: ["Verify CWIP capitalization criteria for dyeing plant", "Confirm depreciation policy change for new looms"] },
    { fsHead: "TRADE_RECEIVABLES", points: ["Follow up on 3 unconfirmed export receivable balances", "Verify ECL model inputs against actual write-off history"] },
    { fsHead: "TRADE_AND_OTHER_PAYABLES", points: ["Verify completeness of accrued expenses for June utilities", "Check unrecorded LC liabilities for goods in transit"] },
    { fsHead: "COST_OF_SALES", points: ["Verify overhead allocation rate computation"] },
    { fsHead: "CASH_AND_BANK_BALANCES", points: ["Clear outstanding bank reconciliation items > 30 days"] },
  ];
  let created = 0;
  for (const rp of rpTemplates) {
    const wpId = wpMap.get(rp.fsHead);
    if (!wpId) continue;
    for (let i = 0; i < rp.points.length; i++) {
      const pointRef = `RP-${rp.fsHead.slice(0, 3)}-${(i + 1).toString().padStart(2, "0")}`;
      const exists = await prisma.fSHeadReviewPoint.findFirst({ where: { workingPaperId: wpId, pointRef } });
      if (!exists) {
        await prisma.fSHeadReviewPoint.create({
          data: {
            workingPaperId: wpId, pointRef,
            description: rp.points[i], severity: "MINOR",
            status: "RESOLVED", response: "Addressed — additional procedures performed and documented. Issue satisfactorily resolved.",
            raisedById: managerId, raisedAt: new Date("2026-08-18"),
            clearedById: seniorId, clearedAt: new Date("2026-08-22"),
          },
        });
        created++;
      }
    }
  }
  if (created > 0) console.log(`  [System] Review points created: ${created}`);
}

async function ensureAdjustments(engId: string, seniorId: string, partnerId: string) {
  const wps = await prisma.fSHeadWorkingPaper.findMany({ where: { engagementId: engId }, select: { id: true, fsHeadKey: true } });
  const wpMap = new Map(wps.map(w => [w.fsHeadKey, w.id]));
  const adjTemplates = [
    { fsHead: "REVENUE", ref: "ADJ-001", type: "CORRECTED" as const, desc: "Revenue cutoff correction — 2 export shipments recognized in wrong period", debit: 0, credit: 4200000, isMaterial: false, isPosted: true },
    { fsHead: "INVENTORIES", ref: "ADJ-002", type: "CORRECTED" as const, desc: "Inventory NRV write-down — slow-moving finished goods", debit: 0, credit: 2800000, isMaterial: false, isPosted: true },
    { fsHead: "TRADE_AND_OTHER_PAYABLES", ref: "ADJ-003", type: "CORRECTED" as const, desc: "Unrecorded accrual for utility bills", debit: 1500000, credit: 0, isMaterial: false, isPosted: true },
    { fsHead: "INVENTORIES", ref: "ADJ-004", type: "UNCORRECTED" as const, desc: "Minor overhead allocation variance — immaterial, waived", debit: 0, credit: 380000, isMaterial: false, isPosted: false },
  ];
  let created = 0;
  for (const adj of adjTemplates) {
    const wpId = wpMap.get(adj.fsHead);
    if (!wpId) continue;
    const exists = await prisma.fSHeadAdjustment.findFirst({ where: { workingPaperId: wpId, adjustmentRef: adj.ref } });
    if (!exists) {
      await prisma.fSHeadAdjustment.create({
        data: {
          workingPaperId: wpId, adjustmentRef: adj.ref, adjustmentType: adj.type,
          description: adj.desc, debitAmount: adj.debit, creditAmount: adj.credit,
          isMaterial: adj.isMaterial, isPosted: adj.isPosted,
          identifiedById: seniorId, approvedById: partnerId,
        },
      });
      created++;
    }
  }
  if (created > 0) console.log(`  [System] FSHead adjustments created: ${created}`);
}

async function ensureSectionSignOffs(engId: string, seniorId: string, managerId: string, partnerId: string) {
  const signOffSections = [
    { section: "PRE_PLANNING_COMPLETE", phase: "PRE_PLANNING" as const },
    { section: "ACCEPTANCE_CONTINUANCE", phase: "PRE_PLANNING" as const },
    { section: "ETHICS_INDEPENDENCE", phase: "PRE_PLANNING" as const },
    { section: "ENGAGEMENT_LETTER", phase: "PRE_PLANNING" as const },
    { section: "DATA_INTAKE_COMPLETE", phase: "REQUISITION" as const },
    { section: "ENTITY_UNDERSTANDING", phase: "PLANNING" as const },
    { section: "RISK_ASSESSMENT", phase: "PLANNING" as const },
    { section: "MATERIALITY", phase: "PLANNING" as const },
    { section: "AUDIT_STRATEGY", phase: "PLANNING" as const },
    { section: "AUDIT_PLAN", phase: "PLANNING" as const },
    { section: "PLANNING_COMPLETE", phase: "PLANNING" as const },
    { section: "EXECUTION_PROCEDURES", phase: "EXECUTION" as const },
    { section: "EVIDENCE_REVIEW", phase: "EXECUTION" as const },
    { section: "EXECUTION_COMPLETE", phase: "EXECUTION" as const },
    { section: "FINALIZATION_COMPLETE", phase: "FINALIZATION" as const },
    { section: "AUDIT_REPORT_ISSUED", phase: "REPORTING" as const },
    { section: "MANAGEMENT_LETTER_ISSUED", phase: "REPORTING" as const },
    { section: "EQCR_REVIEW", phase: "EQCR" as const },
    { section: "FILE_ASSEMBLY", phase: "INSPECTION" as const },
  ];
  let created = 0;
  for (const so of signOffSections) {
    const exists = await prisma.sectionSignOff.findFirst({ where: { engagementId: engId, section: so.section } });
    if (!exists) {
      await prisma.sectionSignOff.create({
        data: {
          engagementId: engId, section: so.section, phase: so.phase,
          preparedById: seniorId, preparedDate: new Date("2026-08-25"),
          reviewedById: managerId, reviewedDate: new Date("2026-08-28"),
          partnerApprovedById: partnerId, partnerApprovalDate: new Date("2026-09-01"),
          isComplete: true,
        },
      });
      created++;
    }
  }
  await prisma.sectionSignOff.updateMany({
    where: { engagementId: engId, partnerApprovedById: null },
    data: {
      preparedById: seniorId, preparedDate: new Date("2026-08-25"),
      reviewedById: managerId, reviewedDate: new Date("2026-08-28"),
      partnerApprovedById: partnerId, partnerApprovalDate: new Date("2026-09-01"),
      isComplete: true,
    },
  });
  if (created > 0) console.log(`  [System] Section sign-offs created: ${created}`);
}

async function ensureOutputsRegistry(engId: string, seniorId: string, managerId: string, partnerId: string) {
  const existing = await prisma.outputsRegistry.findMany({ where: { engagementId: engId }, select: { outputCode: true } });
  const existingCodes = new Set(existing.map(o => o.outputCode));
  const outputEntries = [
    { outputCode: "OUT-PP-001", outputName: "Engagement Acceptance Form", phase: "PRE_PLANNING" as const, outputFormat: "PDF", isaTag: "ISA 210", isDeliverable: false },
    { outputCode: "OUT-PP-002", outputName: "Independence Declarations Summary", phase: "PRE_PLANNING" as const, outputFormat: "PDF", isaTag: "ISA 220", isDeliverable: false },
    { outputCode: "OUT-PP-003", outputName: "Engagement Letter", phase: "PRE_PLANNING" as const, outputFormat: "PDF", isaTag: "ISA 210", isDeliverable: true },
    { outputCode: "OUT-PL-001", outputName: "Audit Strategy Memorandum", phase: "PLANNING" as const, outputFormat: "PDF", isaTag: "ISA 300", isDeliverable: false },
    { outputCode: "OUT-PL-002", outputName: "Risk Assessment Summary", phase: "PLANNING" as const, outputFormat: "PDF", isaTag: "ISA 315", isDeliverable: false },
    { outputCode: "OUT-PL-003", outputName: "Materiality Computation", phase: "PLANNING" as const, outputFormat: "XLSX", isaTag: "ISA 320", isDeliverable: false },
    { outputCode: "OUT-PL-004", outputName: "Audit Plan", phase: "PLANNING" as const, outputFormat: "PDF", isaTag: "ISA 300", isDeliverable: false },
    { outputCode: "OUT-PL-005", outputName: "Analytical Procedures Report", phase: "PLANNING" as const, outputFormat: "PDF", isaTag: "ISA 520", isDeliverable: false },
    { outputCode: "OUT-EX-001", outputName: "Working Paper Pack — All FS Heads", phase: "EXECUTION" as const, outputFormat: "PDF", isaTag: "ISA 230", isDeliverable: false },
    { outputCode: "OUT-EX-002", outputName: "Test of Controls Summary", phase: "EXECUTION" as const, outputFormat: "PDF", isaTag: "ISA 330", isDeliverable: false },
    { outputCode: "OUT-EX-003", outputName: "Test of Details Summary", phase: "EXECUTION" as const, outputFormat: "PDF", isaTag: "ISA 330", isDeliverable: false },
    { outputCode: "OUT-EX-004", outputName: "External Confirmations Log", phase: "EXECUTION" as const, outputFormat: "PDF", isaTag: "ISA 505", isDeliverable: false },
    { outputCode: "OUT-EX-005", outputName: "Misstatement Summary", phase: "EXECUTION" as const, outputFormat: "XLSX", isaTag: "ISA 450", isDeliverable: false },
    { outputCode: "OUT-EX-006", outputName: "Audit Adjustments Schedule", phase: "EXECUTION" as const, outputFormat: "XLSX", isaTag: "ISA 450", isDeliverable: false },
    { outputCode: "OUT-FI-001", outputName: "Subsequent Events Checklist", phase: "FINALIZATION" as const, outputFormat: "PDF", isaTag: "ISA 560", isDeliverable: false },
    { outputCode: "OUT-FI-002", outputName: "Going Concern Assessment", phase: "FINALIZATION" as const, outputFormat: "PDF", isaTag: "ISA 570", isDeliverable: false },
    { outputCode: "OUT-FI-003", outputName: "Written Representations Letter", phase: "FINALIZATION" as const, outputFormat: "PDF", isaTag: "ISA 580", isDeliverable: true },
    { outputCode: "OUT-RP-001", outputName: "Independent Auditor's Report", phase: "REPORTING" as const, outputFormat: "PDF", isaTag: "ISA 700", isDeliverable: true },
    { outputCode: "OUT-RP-002", outputName: "Management Letter", phase: "REPORTING" as const, outputFormat: "PDF", isaTag: "ISA 265", isDeliverable: true },
    { outputCode: "OUT-RP-003", outputName: "Engagement Completion Summary", phase: "REPORTING" as const, outputFormat: "PDF", isDeliverable: true },
    { outputCode: "OUT-QR-001", outputName: "EQCR Review Report", phase: "EQCR" as const, outputFormat: "PDF", isaTag: "ISA 220", isDeliverable: false },
    { outputCode: "OUT-IN-001", outputName: "Assembled Audit File Index", phase: "INSPECTION" as const, outputFormat: "PDF", isaTag: "ISA 230", isDeliverable: false },
  ];
  let created = 0;
  for (const o of outputEntries) {
    if (existingCodes.has(o.outputCode)) continue;
    await prisma.outputsRegistry.create({
      data: {
        engagementId: engId, outputCode: o.outputCode, outputName: o.outputName,
        phase: o.phase, outputFormat: o.outputFormat, isaTag: (o as any).isaTag,
        isDeliverable: o.isDeliverable,
        status: "Approved", version: 1,
        filePath: `outputs/${engId}/${o.outputCode}.${o.outputFormat.toLowerCase()}`,
        preparedById: seniorId, preparedAt: new Date("2026-08-25"),
        reviewedById: managerId, reviewedAt: new Date("2026-08-28"),
        approvedById: partnerId, approvedAt: new Date("2026-09-01"),
        deliveryStatus: o.isDeliverable ? "Delivered" : null,
        deliveryDate: o.isDeliverable ? new Date("2026-09-15") : null,
      },
    });
    created++;
  }
  if (created > 0) console.log(`  [System] OutputsRegistry created: ${created} entries`);
}

async function ensurePhaseProgressAndLocks(engId: string, partnerId: string) {
  const allPhases = ["ONBOARDING", "PRE_PLANNING", "REQUISITION", "PLANNING", "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"] as const;
  for (const phase of allPhases) {
    const ppData = {
      status: "COMPLETED" as const, completionPercentage: 100,
      startedAt: new Date("2025-10-15"),
      completedAt: new Date("2026-09-15"),
      lockedAt: new Date("2026-09-16"), lockedById: partnerId,
      approvedAt: new Date("2026-09-15"), approvedById: partnerId,
    };
    const existing = await prisma.phaseProgress.findFirst({ where: { engagementId: engId, phase } });
    if (existing) {
      await prisma.phaseProgress.update({ where: { id: existing.id }, data: ppData });
    } else {
      await prisma.phaseProgress.create({ data: { engagementId: engId, phase, ...ppData } });
    }
  }
  await prisma.engagement.update({
    where: { id: engId },
    data: {
      currentPhase: "INSPECTION",
      status: "ACTIVE",
      onboardingLocked: true, planningLocked: true, executionLocked: true, finalizationLocked: true,
      lastActivityAt: new Date("2026-09-15"),
    },
  });
}

async function ensureEnforcementGates(engagementId: string, partnerId: string) {
  const existingGates = await (prisma as any).enforcementGate.findMany({ where: { engagementId } });
  if (existingGates.length > 0) return;

  const enfGates = [
    { phase: "ADMINISTRATION", gateType: "CLIENT_ACCEPTANCE", description: "Client acceptance approved", isaReference: "ISA 210, ISQM 1" },
    { phase: "ADMINISTRATION", gateType: "ENGAGEMENT_LETTER", description: "Engagement letter signed", isaReference: "ISA 210" },
    { phase: "ADMINISTRATION", gateType: "INDEPENDENCE_CONFIRMED", description: "Independence confirmed by all team members", isaReference: "ISA 220, IESBA Code" },
    { phase: "PRE_PLANNING", gateType: "TEAM_ASSIGNED", description: "Audit team assigned", isaReference: "ISA 220" },
    { phase: "PRE_PLANNING", gateType: "PRIOR_YEAR_REVIEWED", description: "Prior year matters reviewed", isaReference: "ISA 315" },
    { phase: "PLANNING", gateType: "GL_UPLOADED", description: "General Ledger uploaded", isaReference: "ISA 230", subPhase: "GL_UPLOAD" },
    { phase: "PLANNING", gateType: "TB_COMPILED", description: "Trial Balance compiled from GL", isaReference: "ISA 230", subPhase: "TB_COMPILATION" },
    { phase: "PLANNING", gateType: "FS_PREPARED", description: "Financial Statements prepared from TB", isaReference: "ISA 320", subPhase: "FS_PREPARATION" },
    { phase: "PLANNING", gateType: "MATERIALITY_SET", description: "Materiality calculated and approved", isaReference: "ISA 320" },
    { phase: "PLANNING", gateType: "RISK_ASSESSMENT_COMPLETE", description: "Risk assessment completed and approved", isaReference: "ISA 315" },
    { phase: "EXECUTION", gateType: "PROCEDURES_COMPLETE", description: "All audit procedures completed", isaReference: "ISA 330" },
    { phase: "EXECUTION", gateType: "ADJUSTMENTS_REVIEWED", description: "Proposed adjustments reviewed", isaReference: "ISA 450", subPhase: "ADJUSTMENTS" },
    { phase: "EXECUTION", gateType: "ADJUSTMENTS_POSTED", description: "Approved adjustments posted to adjusted FS", isaReference: "ISA 450", subPhase: "ADJUSTED_FS" },
    { phase: "EVIDENCE", gateType: "EVIDENCE_COMPLETE", description: "All evidence collected and linked", isaReference: "ISA 500" },
    { phase: "EVIDENCE", gateType: "EVIDENCE_REVIEWED", description: "Evidence reviewed for sufficiency", isaReference: "ISA 500, ISA 520" },
    { phase: "FINALIZATION", gateType: "SUBSEQUENT_EVENTS", description: "Subsequent events reviewed", isaReference: "ISA 560" },
    { phase: "FINALIZATION", gateType: "GOING_CONCERN", description: "Going concern assessment complete", isaReference: "ISA 570" },
    { phase: "FINALIZATION", gateType: "REPRESENTATIONS_OBTAINED", description: "Written representations obtained", isaReference: "ISA 580" },
    { phase: "FINALIZATION", gateType: "CONCLUSION_FORMED", description: "Audit conclusion formed", isaReference: "ISA 700" },
    { phase: "DELIVERABLES", gateType: "REPORT_DRAFTED", description: "Audit report drafted", isaReference: "ISA 700" },
    { phase: "DELIVERABLES", gateType: "REPORT_APPROVED", description: "Audit report approved by Partner", isaReference: "ISA 700, ISA 220" },
    { phase: "DELIVERABLES", gateType: "REPORT_ISSUED", description: "Audit report issued", isaReference: "ISA 700" },
    { phase: "QR_EQCR", gateType: "EQCR_ASSIGNED", description: "EQCR reviewer assigned", isaReference: "ISA 220, ISQM 1" },
    { phase: "QR_EQCR", gateType: "EQCR_COMPLETE", description: "EQCR review completed", isaReference: "ISA 220, ISQM 1" },
    { phase: "INSPECTION", gateType: "FILE_ASSEMBLED", description: "Audit file assembled", isaReference: "ISA 230" },
    { phase: "INSPECTION", gateType: "FILE_LOCKED", description: "Audit file locked for inspection", isaReference: "ISA 230" },
  ];
  await (prisma as any).enforcementGate.createMany({
    data: enfGates.map(g => ({
      engagementId,
      phase: g.phase,
      subPhase: (g as any).subPhase || null,
      gateType: g.gateType,
      description: g.description,
      isaReference: g.isaReference,
      isBlocking: true,
      isPassed: true,
      passedById: partnerId,
      passedAt: new Date("2026-09-15"),
      passedComments: "Completed — full audit file ready for inspection",
      dependencies: [],
      blockedReason: null,
    })),
  });
  console.log("  [System] Enforcement gates seeded:", enfGates.length, "all PASSED");
}
