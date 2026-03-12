import { prisma } from "../db";
import { autoFixDeterministic } from "../services/reconIssuesEngine";
import { syncTbToFsMapping } from "../routes/reviewMappingRoutes";
import { DEMO_TB_DATA, DEMO_GL_ENTRIES, DEMO_COA, DEMO_AR_PARTIES, DEMO_AP_PARTIES, DEMO_BANK_MASTER, DEMO_BANK_BALANCES } from "../services/demoData";

const SEED_CLASSIFICATION: Record<string, { accountClass: string; accountSubclass: string; fsHeadKey: string }> = {
  "10001": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "CASH_EQUIVALENTS" },
  "10002": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "CASH_EQUIVALENTS" },
  "10003": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "CASH_EQUIVALENTS" },
  "10004": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "CASH_EQUIVALENTS" },
  "10005": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "CASH_EQUIVALENTS" },
  "10006": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "CASH_EQUIVALENTS" },
  "11001": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "TRADE_RECEIVABLES" },
  "11002": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "TRADE_RECEIVABLES" },
  "11003": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "TRADE_RECEIVABLES" },
  "11004": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "TRADE_RECEIVABLES" },
  "11005": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "OTHER_CURRENT_ASSETS" },
  "11006": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "OTHER_CURRENT_ASSETS" },
  "11007": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "OTHER_CURRENT_ASSETS" },
  "11008": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "OTHER_CURRENT_ASSETS" },
  "12001": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "INVENTORIES" },
  "12002": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "INVENTORIES" },
  "12003": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "INVENTORIES" },
  "12004": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "INVENTORIES" },
  "12005": { accountClass: "ASSET", accountSubclass: "CURRENT_ASSET", fsHeadKey: "INVENTORIES" },
  "13001": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "13002": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "13003": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "13004": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "13005": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "13006": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "13007": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "13008": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "14001": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "14002": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "14003": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "14004": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "14005": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "14006": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "14007": { accountClass: "ASSET", accountSubclass: "FIXED_ASSET", fsHeadKey: "PPE" },
  "15001": { accountClass: "ASSET", accountSubclass: "NON_CURRENT_ASSET", fsHeadKey: "INVESTMENTS" },
  "15002": { accountClass: "ASSET", accountSubclass: "NON_CURRENT_ASSET", fsHeadKey: "INVESTMENTS" },
  "15003": { accountClass: "ASSET", accountSubclass: "NON_CURRENT_ASSET", fsHeadKey: "INVESTMENTS" },
  "20001": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "TRADE_PAYABLES" },
  "20002": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "TRADE_PAYABLES" },
  "20003": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "TRADE_PAYABLES" },
  "20004": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "OTHER_CURRENT_LIABILITIES" },
  "20005": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "OTHER_CURRENT_LIABILITIES" },
  "20006": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "OTHER_CURRENT_LIABILITIES" },
  "20007": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "OTHER_CURRENT_LIABILITIES" },
  "20008": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "OTHER_CURRENT_LIABILITIES" },
  "21001": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "SHORT_TERM_BORROWINGS" },
  "21002": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "SHORT_TERM_BORROWINGS" },
  "21003": { accountClass: "LIABILITY", accountSubclass: "CURRENT_LIABILITY", fsHeadKey: "SHORT_TERM_BORROWINGS" },
  "22001": { accountClass: "LIABILITY", accountSubclass: "NON_CURRENT_LIABILITY", fsHeadKey: "LONG_TERM_BORROWINGS" },
  "22002": { accountClass: "LIABILITY", accountSubclass: "NON_CURRENT_LIABILITY", fsHeadKey: "LONG_TERM_BORROWINGS" },
  "22003": { accountClass: "LIABILITY", accountSubclass: "NON_CURRENT_LIABILITY", fsHeadKey: "LONG_TERM_BORROWINGS" },
  "22004": { accountClass: "LIABILITY", accountSubclass: "NON_CURRENT_LIABILITY", fsHeadKey: "LONG_TERM_BORROWINGS" },
  "30001": { accountClass: "EQUITY", accountSubclass: "SHARE_CAPITAL", fsHeadKey: "SHARE_CAPITAL" },
  "30002": { accountClass: "EQUITY", accountSubclass: "SHARE_CAPITAL", fsHeadKey: "SHARE_CAPITAL" },
  "30003": { accountClass: "EQUITY", accountSubclass: "RESERVES", fsHeadKey: "RESERVES_SURPLUS" },
  "30004": { accountClass: "EQUITY", accountSubclass: "RESERVES", fsHeadKey: "RESERVES_SURPLUS" },
  "30005": { accountClass: "EQUITY", accountSubclass: "RESERVES", fsHeadKey: "RESERVES_SURPLUS" },
  "40001": { accountClass: "INCOME", accountSubclass: "OPERATING_REVENUE", fsHeadKey: "REVENUE_OPERATIONS" },
  "40002": { accountClass: "INCOME", accountSubclass: "OPERATING_REVENUE", fsHeadKey: "REVENUE_OPERATIONS" },
  "40003": { accountClass: "INCOME", accountSubclass: "OPERATING_REVENUE", fsHeadKey: "REVENUE_OPERATIONS" },
  "40004": { accountClass: "INCOME", accountSubclass: "OPERATING_REVENUE", fsHeadKey: "REVENUE_OPERATIONS" },
  "40005": { accountClass: "INCOME", accountSubclass: "OPERATING_REVENUE", fsHeadKey: "REVENUE_OPERATIONS" },
  "50001": { accountClass: "EXPENSE", accountSubclass: "COST_OF_SALES", fsHeadKey: "COST_MATERIALS" },
  "50002": { accountClass: "EXPENSE", accountSubclass: "COST_OF_SALES", fsHeadKey: "COST_MATERIALS" },
  "50003": { accountClass: "EXPENSE", accountSubclass: "COST_OF_SALES", fsHeadKey: "COST_MATERIALS" },
  "50004": { accountClass: "EXPENSE", accountSubclass: "COST_OF_SALES", fsHeadKey: "COST_MATERIALS" },
  "50005": { accountClass: "EXPENSE", accountSubclass: "COST_OF_SALES", fsHeadKey: "COST_MATERIALS" },
  "51001": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "EMPLOYEE_BENEFITS" },
  "51002": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "EMPLOYEE_BENEFITS" },
  "51003": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "51004": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "51005": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "51006": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "51007": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "51008": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "51009": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "51010": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "52001": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "52002": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "52003": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "52004": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "52005": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "53001": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "DEPRECIATION" },
  "53002": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "DEPRECIATION" },
  "54001": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "54002": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "54003": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "54004": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "OTHER_EXPENSES" },
  "55001": { accountClass: "EXPENSE", accountSubclass: "FINANCE_COST", fsHeadKey: "FINANCE_COSTS" },
  "55002": { accountClass: "EXPENSE", accountSubclass: "FINANCE_COST", fsHeadKey: "FINANCE_COSTS" },
  "55003": { accountClass: "EXPENSE", accountSubclass: "FINANCE_COST", fsHeadKey: "FINANCE_COSTS" },
  "56001": { accountClass: "INCOME", accountSubclass: "OTHER_INCOME", fsHeadKey: "OTHER_INCOME" },
  "56002": { accountClass: "INCOME", accountSubclass: "OTHER_INCOME", fsHeadKey: "OTHER_INCOME" },
  "56003": { accountClass: "INCOME", accountSubclass: "OTHER_INCOME", fsHeadKey: "OTHER_INCOME" },
  "70001": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "TAX_EXPENSE" },
  "70002": { accountClass: "EXPENSE", accountSubclass: "OPERATING_EXPENSE", fsHeadKey: "TAX_EXPENSE" },
};

export async function seedDemoData() {
  console.log("Seeding demo data...");

  try {
    const existingClient = await prisma.client.findFirst({
      where: { name: "Meridian Technologies (Pvt.) Limited" },
    });
    if (existingClient) {
      console.log("Demo data already exists, checking second client...");
      const firm = await prisma.firm.findFirst();
      if (firm) {
        await prisma.aISettings.upsert({
          where: { firmId: firm.id },
          create: {
            firmId: firm.id,
            aiEnabled: true,
            preferredProvider: "openai",
            providerPriority: ["openai", "gemini", "deepseek"],
            openaiEnabled: true,
            geminiEnabled: false,
            deepseekEnabled: false,
            maxTokensPerResponse: 2000,
            autoSuggestionsEnabled: true,
            manualTriggerOnly: false,
            requestTimeout: 30000,
          },
          update: {
            aiEnabled: true,
            openaiEnabled: true,
            autoSuggestionsEnabled: true,
            manualTriggerOnly: false,
          },
        });
      }
      await seedSecondClient();
      await seedAlBarakaFinancialData();
      await seedAllPhaseData();
      await seedLinkageData();
      await ensureImportData();
      const { seedCompleteAudit } = await import("./seedCompleteAudit");
      await seedCompleteAudit();
      return;
    }

    const firm = await prisma.firm.findFirst();
    if (!firm) throw new Error("No firm found. Run seedUsers first.");

    await prisma.aISettings.upsert({
      where: { firmId: firm.id },
      create: {
        firmId: firm.id,
        aiEnabled: true,
        preferredProvider: "openai",
        providerPriority: ["openai", "gemini", "deepseek"],
        openaiEnabled: true,
        geminiEnabled: false,
        deepseekEnabled: false,
        maxTokensPerResponse: 2000,
        autoSuggestionsEnabled: true,
        manualTriggerOnly: false,
        requestTimeout: 30000,
      },
      update: {
        aiEnabled: true,
        openaiEnabled: true,
        autoSuggestionsEnabled: true,
        manualTriggerOnly: false,
      },
    });

    const users = await prisma.user.findMany({ where: { firmId: firm.id } });
    const getUser = (email: string) => {
      const u = users.find((u) => u.email === email);
      if (!u) throw new Error(`User ${email} not found. Run seedUsers first.`);
      return u;
    };

    const partner = getUser("partner@auditwise.pk");
    const manager = getUser("manager@auditwise.pk");
    const teamlead = getUser("teamlead@auditwise.pk");
    const senior = getUser("senior@auditwise.pk");
    const staff = getUser("staff@auditwise.pk");
    const eqcrUser = getUser("eqcr@auditwise.pk");
    const admin = getUser("admin@auditwise.pk");

    console.log("  Creating client...");
    const client = await prisma.client.create({
      data: {
        firmId: firm.id,
        name: "Meridian Technologies (Pvt.) Limited",
        tradingName: "Meridian Tech",
        industry: "Technology / Software Development",
        entityType: "PVT_LTD",
        address: "Plot 42, Software Technology Park, I-9/3, Islamabad",
        city: "Islamabad",
        country: "Pakistan",
        phone: "+92-51-2890456",
        email: "info@meridiantech.pk",
        website: "https://www.meridiantech.pk",
        dateOfIncorporation: new Date("2015-06-15"),
        estimatedTurnover: 478500000,
        estimatedAssets: 1047500000,
        employeeCount: 320,
        reportingCurrency: "PKR",
        ceoName: "Ahmad Raza Khan",
        ceoContact: "+92-300-1234567",
        cfoName: "Fatima Zahra",
        cfoContact: "+92-301-2345678",
        ownershipStructure: "Private Limited Company with 3 shareholders",
        erpSystemUsed: "SAP Business One",
        cloudBasedAccounting: true,
        auditCommittee: true,
        internalAuditFunction: true,
        governanceStructure: "Board of Directors with Audit Committee",
        riskCategory: "NORMAL",
        acceptanceStatus: "APPROVED",
        acceptanceDate: new Date("2024-11-15"),
        acceptanceApprovedById: partner.id,
        isActive: true,
        isDemo: true,
      },
    });

    console.log("  Creating engagements...");
    const eng1 = await prisma.engagement.create({
      data: {
        firmId: firm.id,
        clientId: client.id,
        engagementCode: "ENG-2025-001",
        engagementType: "statutory_audit",
        reportingFramework: "IFRS",
        currentPhase: "EXECUTION",
        status: "ACTIVE",
        riskRating: "MEDIUM",
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-12-31"),
        fiscalYearEnd: new Date("2024-12-31"),
        reportDeadline: new Date("2025-03-31"),
        fieldworkStartDate: new Date("2025-01-15"),
        fieldworkEndDate: new Date("2025-03-15"),
        budgetHours: 2100,
        engagementPartnerId: partner.id,
        engagementManagerId: manager.id,
        teamLeadId: teamlead.id,
        preconditionsMet: true,
        managementAcknowledges: true,
        termsAgreed: true,
        engagementLetterGenerated: true,
        engagementLetterSigned: true,
        engagementLetterSignedDate: new Date("2024-12-01"),
        independenceCleared: true,
        resourceCapabilityConfirmed: true,
        acceptanceDecision: "ACCEPTED",
        eqcrRequired: true,
        eqcrRationale: "Significant public interest entity",
        isDemo: true,
        startedAt: new Date("2024-11-20"),
        lastActivityAt: new Date("2025-02-15"),
      },
    });

    const eng2 = await prisma.engagement.create({
      data: {
        firmId: firm.id,
        clientId: client.id,
        engagementCode: "ENG-2025-002",
        engagementType: "statutory_audit",
        reportingFramework: "IFRS",
        currentPhase: "PLANNING",
        status: "ACTIVE",
        riskRating: "MEDIUM",
        periodStart: new Date("2025-01-01"),
        periodEnd: new Date("2025-12-31"),
        fiscalYearEnd: new Date("2025-12-31"),
        reportDeadline: new Date("2026-03-31"),
        budgetHours: 2100,
        engagementPartnerId: partner.id,
        engagementManagerId: manager.id,
        teamLeadId: teamlead.id,
        preconditionsMet: true,
        managementAcknowledges: true,
        termsAgreed: true,
        engagementLetterGenerated: true,
        engagementLetterSigned: true,
        engagementLetterSignedDate: new Date("2025-11-01"),
        independenceCleared: true,
        resourceCapabilityConfirmed: true,
        acceptanceDecision: "ACCEPTED",
        isDemo: true,
        startedAt: new Date("2025-11-15"),
        lastActivityAt: new Date("2025-12-20"),
      },
    });

    const phases: Array<"ONBOARDING" | "PRE_PLANNING" | "REQUISITION" | "PLANNING" | "EXECUTION" | "FINALIZATION" | "REPORTING" | "EQCR" | "INSPECTION"> = [
      "ONBOARDING", "PRE_PLANNING", "REQUISITION", "PLANNING", "EXECUTION",
      "FINALIZATION", "REPORTING", "EQCR", "INSPECTION",
    ];

    console.log("  Creating phase progress...");
    const eng1PhaseStatuses: Record<string, { status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; pct: number }> = {
      ONBOARDING: { status: "COMPLETED", pct: 100 },
      PRE_PLANNING: { status: "COMPLETED", pct: 100 },
      REQUISITION: { status: "COMPLETED", pct: 100 },
      PLANNING: { status: "COMPLETED", pct: 100 },
      EXECUTION: { status: "IN_PROGRESS", pct: 65 },
      FINALIZATION: { status: "NOT_STARTED", pct: 0 },
      REPORTING: { status: "NOT_STARTED", pct: 0 },
      EQCR: { status: "NOT_STARTED", pct: 0 },
      INSPECTION: { status: "NOT_STARTED", pct: 0 },
    };

    const eng2PhaseStatuses: Record<string, { status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; pct: number }> = {
      ONBOARDING: { status: "COMPLETED", pct: 100 },
      PRE_PLANNING: { status: "COMPLETED", pct: 100 },
      REQUISITION: { status: "COMPLETED", pct: 100 },
      PLANNING: { status: "IN_PROGRESS", pct: 40 },
      EXECUTION: { status: "NOT_STARTED", pct: 0 },
      FINALIZATION: { status: "NOT_STARTED", pct: 0 },
      REPORTING: { status: "NOT_STARTED", pct: 0 },
      EQCR: { status: "NOT_STARTED", pct: 0 },
      INSPECTION: { status: "NOT_STARTED", pct: 0 },
    };

    for (const phase of phases) {
      const e1s = eng1PhaseStatuses[phase];
      const e2s = eng2PhaseStatuses[phase];
      await prisma.phaseProgress.createMany({
        data: [
          {
            engagementId: eng1.id,
            phase,
            status: e1s.status,
            completionPercentage: e1s.pct,
            startedAt: e1s.status !== "NOT_STARTED" ? new Date("2024-12-01") : undefined,
            completedAt: e1s.status === "COMPLETED" ? new Date("2025-01-31") : undefined,
          },
          {
            engagementId: eng2.id,
            phase,
            status: e2s.status,
            completionPercentage: e2s.pct,
            startedAt: e2s.status !== "NOT_STARTED" ? new Date("2025-11-15") : undefined,
            completedAt: e2s.status === "COMPLETED" ? new Date("2025-12-15") : undefined,
          },
        ],
      });
    }

    console.log("  Creating engagement teams...");
    const teamMembers = [
      { userId: partner.id, role: "Engagement Partner", isLead: true, hoursAllocated: 200 },
      { userId: manager.id, role: "Engagement Manager", isLead: false, hoursAllocated: 400 },
      { userId: teamlead.id, role: "Team Lead", isLead: false, hoursAllocated: 500 },
      { userId: senior.id, role: "Senior Auditor", isLead: false, hoursAllocated: 600 },
      { userId: staff.id, role: "Staff Auditor", isLead: false, hoursAllocated: 400 },
    ];

    for (const eng of [eng1, eng2]) {
      await prisma.engagementTeam.createMany({
        data: teamMembers.map((m) => ({
          engagementId: eng.id,
          userId: m.userId,
          role: m.role,
          isLead: m.isLead,
          hoursAllocated: m.hoursAllocated,
        })),
      });
    }

    console.log("  Creating pre-planning gates...");
    const gateTypes: Array<"CLIENT_ACCEPTANCE" | "CLIENT_CONTINUANCE" | "INDEPENDENCE_CONFIRMATION" | "ETHICS_COMPLIANCE" | "ENGAGEMENT_LETTER"> = [
      "CLIENT_ACCEPTANCE", "CLIENT_CONTINUANCE", "INDEPENDENCE_CONFIRMATION",
      "ETHICS_COMPLIANCE", "ENGAGEMENT_LETTER",
    ];
    const gateDescriptions: Record<string, string> = {
      CLIENT_ACCEPTANCE: "Client acceptance procedures per ISQM 1",
      CLIENT_CONTINUANCE: "Annual client continuance assessment",
      INDEPENDENCE_CONFIRMATION: "Independence confirmation per IESBA Code",
      ETHICS_COMPLIANCE: "Ethics and professional standards compliance",
      ENGAGEMENT_LETTER: "Engagement letter preparation and signing",
    };

    for (const gateType of gateTypes) {
      await prisma.prePlanningGate.createMany({
        data: [
          {
            engagementId: eng1.id,
            gateType,
            status: "COMPLETED",
            isRequired: true,
            isBlocking: true,
            description: gateDescriptions[gateType],
            completionPercentage: 100,
            completedAt: new Date("2024-12-10"),
            completedById: senior.id,
          },
          {
            engagementId: eng2.id,
            gateType,
            status: gateType === "ENGAGEMENT_LETTER" || gateType === "ETHICS_COMPLIANCE" ? "IN_PROGRESS" : "COMPLETED",
            isRequired: true,
            isBlocking: true,
            description: gateDescriptions[gateType],
            completionPercentage: gateType === "ENGAGEMENT_LETTER" || gateType === "ETHICS_COMPLIANCE" ? 60 : 100,
            completedAt: gateType === "ENGAGEMENT_LETTER" || gateType === "ETHICS_COMPLIANCE" ? undefined : new Date("2025-11-20"),
            completedById: gateType === "ENGAGEMENT_LETTER" || gateType === "ETHICS_COMPLIANCE" ? undefined : senior.id,
          },
        ],
      });
    }

    console.log("  Creating acceptance/continuance decisions...");
    await prisma.acceptanceContinuanceDecision.createMany({
      data: [
        {
          engagementId: eng1.id,
          firmId: firm.id,
          isNewClient: true,
          isReengagement: false,
          clientIntegrityRating: "SATISFACTORY",
          clientIntegrityNotes: "Management demonstrates integrity and ethical business practices",
          managementIntegrityRating: "SATISFACTORY",
          engagementRiskLevel: "MEDIUM",
          engagementRiskFactors: [
            { factor: "Technology industry volatility", impact: "MEDIUM" },
            { factor: "Revenue recognition complexity", impact: "HIGH" },
          ],
          competenceConfirmed: true,
          competenceNotes: "Team has adequate IT audit and technology sector experience",
          resourcesAvailable: true,
          independenceCleared: true,
          independenceClearanceDate: new Date("2024-11-15"),
          ethicalRequirementsMet: true,
          decision: "ACCEPTED",
          decisionRationale: "Client meets acceptance criteria. Adequate resources and competence available.",
          decisionDate: new Date("2024-11-15"),
          decisionById: partner.id,
          partnerApprovedAt: new Date("2024-11-16"),
          partnerApprovedById: partner.id,
        },
        {
          engagementId: eng2.id,
          firmId: firm.id,
          isNewClient: false,
          isReengagement: true,
          clientIntegrityRating: "SATISFACTORY",
          clientIntegrityNotes: "No changes in management integrity assessment from prior year",
          managementIntegrityRating: "SATISFACTORY",
          engagementRiskLevel: "MEDIUM",
          engagementRiskFactors: [
            { factor: "Technology industry volatility", impact: "MEDIUM" },
            { factor: "Revenue recognition complexity", impact: "HIGH" },
            { factor: "Growth in operations", impact: "MEDIUM" },
          ],
          competenceConfirmed: true,
          resourcesAvailable: true,
          independenceCleared: true,
          independenceClearanceDate: new Date("2025-11-10"),
          ethicalRequirementsMet: true,
          decision: "ACCEPTED",
          decisionRationale: "Continuance approved. No significant changes in risk profile.",
          decisionDate: new Date("2025-11-10"),
          decisionById: partner.id,
          partnerApprovedAt: new Date("2025-11-11"),
          partnerApprovedById: partner.id,
        },
      ],
    });

    console.log("  Creating information requests...");
    const irHeads: Array<"CORPORATE_DOCUMENTS" | "FINANCIAL_STATEMENTS" | "BANK_INFORMATION" | "FIXED_ASSETS" | "INVENTORY" | "TAXATION"> = [
      "CORPORATE_DOCUMENTS", "FINANCIAL_STATEMENTS", "BANK_INFORMATION",
      "FIXED_ASSETS", "INVENTORY", "TAXATION",
    ];
    const irTitles = [
      "Corporate Registration & Board Resolutions",
      "Annual Financial Statements & Trial Balance",
      "Bank Statements & Reconciliations",
      "Fixed Asset Register & Depreciation Schedule",
      "Inventory Listing & Valuation Report",
      "Tax Returns & Compliance Documents",
    ];
    const irDescriptions = [
      "Memorandum & Articles, Board/AGM minutes, shareholder register, SECP filings",
      "Complete set of financial statements, trial balance, general ledger for FY",
      "Bank statements for all accounts, bank reconciliation statements, bank confirmations",
      "Complete fixed asset register with additions, disposals, depreciation schedule",
      "Inventory count sheets, valuation reports, NRV assessments, obsolescence analysis",
      "Income tax returns, sales tax returns, withholding tax statements, tax assessments",
    ];
    const priorities: Array<"LOW" | "MEDIUM" | "HIGH"> = ["HIGH", "HIGH", "MEDIUM", "MEDIUM", "MEDIUM", "LOW"];
    const eng2Statuses: Array<"COMPLETED" | "IN_PROGRESS" | "SUBMITTED" | "PENDING" | "UNDER_REVIEW"> = [
      "COMPLETED", "SUBMITTED", "IN_PROGRESS", "PENDING", "PENDING", "PENDING",
    ];

    const irData = [];
    for (let i = 0; i < 6; i++) {
      irData.push({
        firmId: firm.id,
        engagementId: eng1.id,
        clientId: client.id,
        requestCode: `IR-ENG1-00${i + 1}`,
        srNumber: i + 1,
        requestTitle: irTitles[i],
        headOfAccounts: irHeads[i],
        description: irDescriptions[i],
        status: "COMPLETED" as const,
        priority: priorities[i],
        dueDate: new Date("2025-01-15"),
        isDemo: true,
        createdById: manager.id,
      });
      irData.push({
        firmId: firm.id,
        engagementId: eng2.id,
        clientId: client.id,
        requestCode: `IR-ENG2-00${i + 1}`,
        srNumber: i + 1,
        requestTitle: irTitles[i],
        headOfAccounts: irHeads[i],
        description: irDescriptions[i],
        status: eng2Statuses[i],
        priority: priorities[i],
        dueDate: new Date("2026-01-15"),
        isDemo: true,
        createdById: manager.id,
      });
    }
    await prisma.informationRequest.createMany({ data: irData });

    console.log("  Creating materiality assessments...");
    const materialityData = {
      benchmark: "REVENUE" as const,
      benchmarkAmount: 478500000,
      benchmarkPercentage: 1.5,
      overallMateriality: 7177500,
      performanceMateriality: 5383125,
      performanceMatPercentage: 75,
      amptThreshold: 358875,
      amptPercentage: 5,
      justification: "Revenue selected as the appropriate benchmark as the entity is a growth-stage technology company where revenue is the primary metric used by stakeholders. Profit before tax is volatile due to R&D investment cycles, making revenue a more stable and relevant benchmark per ISA 320.",
      approvedById: partner.id,
      approvedDate: new Date("2025-01-20"),
    };
    await prisma.materialityAssessment.createMany({
      data: [
        { engagementId: eng1.id, ...materialityData },
        { engagementId: eng2.id, ...materialityData, approvedDate: new Date("2025-12-15") },
      ],
    });

    console.log("  Creating risk assessments...");
    const riskTemplates = [
      {
        accountOrClass: "Revenue and Service Income",
        fsArea: "REVENUE" as const,
        auditCycle: "REVENUE_CYCLE" as const,
        assertion: "OCCURRENCE" as const,
        assertionImpacts: ["OCCURRENCE" as const, "COMPLETENESS" as const, "ACCURACY" as const],
        inherentRisk: "HIGH" as const,
        controlRisk: "MODERATE" as const,
        riskOfMaterialMisstatement: "HIGH" as const,
        isSignificantRisk: true,
        significantRiskReason: "Revenue recognition involves significant management judgment regarding percentage of completion for software development contracts",
        riskDescription: "Risk that revenue from software development contracts may be overstated due to premature recognition or inappropriate allocation across periods",
        plannedResponse: "Detailed testing of revenue recognition for software contracts, cutoff testing, and analytical review of revenue trends",
      },
      {
        accountOrClass: "Trade Receivables",
        fsArea: "RECEIVABLES" as const,
        auditCycle: "REVENUE_CYCLE" as const,
        assertion: "EXISTENCE" as const,
        assertionImpacts: ["EXISTENCE" as const, "VALUATION" as const, "RIGHTS_OBLIGATIONS" as const],
        inherentRisk: "HIGH" as const,
        controlRisk: "LOW" as const,
        riskOfMaterialMisstatement: "MODERATE" as const,
        isSignificantRisk: false,
        riskDescription: "Risk that trade receivables may include fictitious balances or may not be recoverable at carrying amounts",
        plannedResponse: "External confirmations, subsequent receipts testing, and allowance for doubtful debts assessment",
      },
      {
        accountOrClass: "Property, Plant and Equipment",
        fsArea: "FIXED_ASSETS" as const,
        auditCycle: "FIXED_ASSETS_CYCLE" as const,
        assertion: "VALUATION" as const,
        assertionImpacts: ["VALUATION" as const, "EXISTENCE" as const, "COMPLETENESS" as const],
        inherentRisk: "MODERATE" as const,
        controlRisk: "LOW" as const,
        riskOfMaterialMisstatement: "LOW" as const,
        isSignificantRisk: false,
        riskDescription: "Risk that fixed assets may not be correctly valued, including depreciation calculations and impairment considerations",
        plannedResponse: "Recalculation of depreciation, physical verification on sample basis, review of capital vs revenue expenditure classification",
      },
      {
        accountOrClass: "Inventories - Software Licenses and Hardware",
        fsArea: "INVENTORIES" as const,
        auditCycle: "INVENTORY_CYCLE" as const,
        assertion: "EXISTENCE" as const,
        assertionImpacts: ["EXISTENCE" as const, "VALUATION" as const, "COMPLETENESS" as const],
        inherentRisk: "HIGH" as const,
        controlRisk: "MODERATE" as const,
        riskOfMaterialMisstatement: "HIGH" as const,
        isSignificantRisk: true,
        significantRiskReason: "Technology inventory subject to rapid obsolescence and NRV write-downs",
        riskDescription: "Risk that inventory of hardware components and software licenses may be overstated due to obsolescence or incorrect NRV assessment",
        plannedResponse: "Inventory count observation, NRV testing, obsolescence review, and slow-moving inventory analysis",
      },
    ];

    const eng1Risks = [];
    const eng2Risks = [];
    for (const eng of [eng1, eng2]) {
      for (const rt of riskTemplates) {
        const created = await prisma.riskAssessment.create({
          data: {
            engagementId: eng.id,
            ...rt,
            assessedById: senior.id,
            assessedDate: eng === eng1 ? new Date("2025-01-15") : new Date("2025-12-10"),
            reviewedById: manager.id,
            reviewedDate: eng === eng1 ? new Date("2025-01-18") : undefined,
          },
        });
        if (eng === eng1) eng1Risks.push(created);
        else eng2Risks.push(created);
      }
    }

    console.log("  Creating going concern assessments...");
    const gcData = {
      managementAssessmentPeriod: 12,
      currentRatio: 2.1,
      quickRatio: 1.5,
      debtEquityRatio: 0.4,
      interestCoverage: 8.5,
      netProfitLossTrend: "Consistent profitability over the past 3 years with growing margins",
      cashFlowTrend: "Positive operating cash flows with healthy free cash flow generation",
      workingCapitalDeficit: false,
      defaultOnLoans: false,
      adverseKeyRatios: false,
      lossOfKeyCustomer: false,
      lossOfKeySupplier: false,
      laborDifficulties: false,
      legalProceedings: false,
      regulatoryNonCompliance: false,
      managementPlans: "Continued focus on software product development and market expansion into Middle East region",
      managementPlansFeasibility: "Plans are realistic given current market position and financial strength",
      auditEvidence: "Reviewed cash flow forecasts, bank facilities, order book, and management representations",
      auditConclusion: "No material uncertainty identified regarding the entity's ability to continue as a going concern. The entity has adequate financial resources, positive cash flows, and a strong order book supporting its going concern assumption.",
      materialUncertaintyExists: false,
      preparedById: senior.id,
      preparedDate: new Date("2025-01-25"),
      reviewedById: manager.id,
      reviewedDate: new Date("2025-01-28"),
      partnerApprovedById: partner.id,
      partnerApprovalDate: new Date("2025-01-30"),
    };
    await prisma.goingConcernAssessment.create({ data: { engagementId: eng1.id, ...gcData } });
    await prisma.goingConcernAssessment.create({
      data: {
        engagementId: eng2.id,
        ...gcData,
        preparedDate: new Date("2025-12-15"),
        reviewedDate: undefined,
        reviewedById: undefined,
        partnerApprovedById: undefined,
        partnerApprovalDate: undefined,
      },
    });

    console.log("  Creating entity understanding...");
    const entityData = {
      entityName: "Meridian Technologies (Pvt.) Limited",
      legalStructure: "Private Limited Company incorporated under the Companies Act, 2017",
      ownershipStructure: "Three founding shareholders: Ahmad Raza Khan (45%), Bilal Mahmood (30%), Sarah Ahmed (25%)",
      managementStructure: "CEO-led management with CTO, CFO, and VP Operations reporting directly",
      governanceStructure: "Board of 5 Directors including 2 independent directors. Audit Committee meets quarterly.",
      natureOfBusiness: "Enterprise software development, IT consulting, and managed cloud services",
      principalActivities: "Custom software development for financial services sector, cloud migration services, cybersecurity solutions, and managed IT infrastructure",
      revenueStreams: [
        { stream: "Software Development Contracts", percentage: 45, type: "Project-based" },
        { stream: "Managed Cloud Services", percentage: 25, type: "Recurring subscription" },
        { stream: "IT Consulting", percentage: 20, type: "Time & materials" },
        { stream: "Cybersecurity Solutions", percentage: 10, type: "Mixed" },
      ],
      keyProducts: [
        { name: "MeridianERP", description: "Cloud-based ERP for mid-size companies" },
        { name: "SecureShield", description: "Cybersecurity monitoring platform" },
        { name: "CloudBridge", description: "Cloud migration and management tool" },
      ],
      keyMarkets: "Pakistan, UAE, Saudi Arabia, with expansion plans for Southeast Asia",
      competitivePosition: "Leading position in Pakistani enterprise software market with growing regional presence",
      regulatoryEnvironment: "Subject to SECP regulations, Income Tax Ordinance 2001, Sales Tax Act, and data protection requirements",
      applicableLaws: [
        { law: "Companies Act, 2017", relevance: "Corporate governance and reporting" },
        { law: "Income Tax Ordinance, 2001", relevance: "Tax compliance and planning" },
        { law: "Sales Tax Act, 1990", relevance: "Service tax obligations" },
      ],
      itEnvironment: "SAP Business One for ERP, custom-built project management system, Azure cloud infrastructure",
      keyITSystems: [
        { system: "SAP Business One", purpose: "Financial accounting and reporting" },
        { system: "Jira", purpose: "Project management and time tracking" },
        { system: "Azure DevOps", purpose: "Software development lifecycle" },
        { system: "Salesforce", purpose: "CRM and sales pipeline" },
      ],
      keyPerformanceIndicators: [
        { kpi: "Revenue Growth Rate", value: "22%", benchmark: "Industry avg 15%" },
        { kpi: "Gross Margin", value: "42%", benchmark: "Industry avg 35%" },
        { kpi: "Employee Utilization", value: "78%", benchmark: "Target 80%" },
        { kpi: "Client Retention Rate", value: "92%", benchmark: "Industry avg 85%" },
      ],
      strategicObjectives: "Expand SaaS offerings, enter Middle East market, achieve ISO 27001 certification, develop AI-powered solutions",
      businessRisks: [
        { risk: "Technology talent retention in competitive market", impact: "HIGH" },
        { risk: "Client concentration - top 5 clients represent 60% of revenue", impact: "MEDIUM" },
        { risk: "Currency exposure on USD-denominated contracts", impact: "MEDIUM" },
        { risk: "Cybersecurity threats to client data", impact: "HIGH" },
      ],
    };
    await prisma.entityUnderstanding.create({ data: { engagementId: eng1.id, ...entityData } });
    await prisma.entityUnderstanding.create({ data: { engagementId: eng2.id, ...entityData } });

    console.log("  Creating audit strategies...");
    const strategyData = {
      overallStrategy: "Combined audit approach utilizing a mix of controls testing and substantive procedures. Given the technology-intensive nature of the client, emphasis will be placed on IT general controls and application controls testing, supplemented by substantive analytical procedures and tests of details for significant account balances.",
      auditApproach: "Risk-based approach per ISA 315 (Revised 2019). The audit will focus on identified significant risks in revenue recognition and inventory valuation, with tailored responses for each significant account area.",
      controlsReliance: "PARTIAL",
      controlsRelianceRationale: "Partial reliance on internal controls is appropriate given the mature control environment and established IT systems. Controls over revenue recognition require enhanced testing due to the complexity of software development contracts.",
      planToTestControls: true,
      controlsTestingScope: [
        { cycle: "Revenue", controls: "Authorization, recording, completeness" },
        { cycle: "Purchases", controls: "Approval, three-way matching" },
        { cycle: "Payroll", controls: "Authorization, calculation, disbursement" },
      ],
      substantiveApproach: "Substantive analytical procedures supplemented by tests of details for material account balances. Enhanced substantive testing for significant risk areas.",
      substantiveProcedures: [
        { area: "Revenue", procedures: "Contract testing, cutoff analysis, analytical review" },
        { area: "Receivables", procedures: "Confirmations, subsequent receipts, aging analysis" },
        { area: "Fixed Assets", procedures: "Physical verification, depreciation recalculation" },
        { area: "Inventory", procedures: "Count observation, NRV testing, obsolescence review" },
      ],
      timingOfProcedures: "Interim testing in January 2025, final testing in February-March 2025",
      interimTestingPlanned: true,
      interimTestingScope: "Controls testing and preliminary analytical procedures",
      periodEndTestingScope: "Substantive testing of year-end balances and cutoff procedures",
      teamComposition: [
        { role: "Engagement Partner", name: "Audit Partner", hours: 200 },
        { role: "Engagement Manager", name: "Audit Manager", hours: 400 },
        { role: "Team Lead", name: "Team Lead", hours: 500 },
        { role: "Senior Auditor", name: "Senior Auditor", hours: 600 },
        { role: "Staff Auditor", name: "Staff Auditor", hours: 400 },
      ],
      materialityConsiderations: "Overall materiality set at PKR 12.75M based on 1.5% of revenue. Performance materiality at 75% of overall.",
      samplingApproach: "Monetary unit sampling for substantive tests, attribute sampling for controls testing",
      preparedById: manager.id,
      preparedDate: new Date("2025-01-10"),
      managerReviewedById: manager.id,
      managerReviewDate: new Date("2025-01-12"),
      partnerApprovedById: partner.id,
      partnerApprovalDate: new Date("2025-01-15"),
    };
    await prisma.auditStrategy.create({ data: { engagementId: eng1.id, ...strategyData } });
    await prisma.auditStrategy.create({
      data: {
        engagementId: eng2.id,
        ...strategyData,
        preparedDate: new Date("2025-12-10"),
        managerReviewDate: undefined,
        managerReviewedById: undefined,
        partnerApprovedById: undefined,
        partnerApprovalDate: undefined,
      },
    });

    console.log("  Creating planning memos...");
    await prisma.planningMemo.create({
      data: {
        engagementId: eng1.id,
        entityBackground: "Meridian Technologies is a leading Pakistani technology company specializing in enterprise software development, IT consulting, and managed cloud services. Founded in 2015, the company has grown to 320 employees with annual revenue of PKR 850M. The company serves primarily financial services and enterprise clients across Pakistan and the Middle East region.",
        industryAnalysis: "The Pakistan IT sector continues to experience strong growth driven by digital transformation. Key industry risks include talent retention, rapid technological change, and currency fluctuations on export revenue.",
        accountingPolicies: "The company follows IFRS with revenue recognition under IFRS 15 for software development contracts using percentage of completion method. Significant accounting estimates relate to contract cost estimation and receivables impairment under IFRS 9.",
        internalControlSummary: "The entity maintains a reasonably effective control environment with SAP Business One as the primary financial system. Key controls exist over revenue cycle, purchases, and payroll. IT general controls are maintained over the SAP environment.",
        keyAuditMatters: [
          "Revenue recognition on long-term software development contracts",
          "Valuation of trade receivables and expected credit loss provision",
          "Capitalization and amortization of internally developed software",
        ],
        significantRisks: [
          "Revenue recognition - percentage of completion estimation",
          "Inventory obsolescence - technology hardware and software licenses",
        ],
        relatedParties: [
          "TechVentures Holdings (Pvt.) Ltd - common directorship",
          "Digital Solutions LLC, Dubai - common ownership",
        ],
        auditApproach: "Risk-based combined approach with partial reliance on internal controls",
        samplingMethodology: "Monetary unit sampling for substantive tests, attribute sampling for controls",
        teamBriefingDone: true,
        teamBriefingDate: new Date("2025-01-12"),
        teamBriefingNotes: "Team briefed on engagement objectives, significant risks, and timeline. Emphasized importance of professional skepticism in revenue recognition testing.",
        preparedById: senior.id,
        preparedDate: new Date("2025-01-10"),
        managerReviewedById: manager.id,
        managerReviewedDate: new Date("2025-01-14"),
        partnerApprovedById: partner.id,
        partnerApprovalDate: new Date("2025-01-16"),
      },
    });
    await prisma.planningMemo.create({
      data: {
        engagementId: eng2.id,
        entityBackground: "Meridian Technologies is a leading Pakistani technology company specializing in enterprise software development, IT consulting, and managed cloud services. The company has grown to 320 employees with annual revenue exceeding PKR 850M. FY2025 engagement follows a successful FY2024 audit.",
        industryAnalysis: "Pakistan IT sector growth continues with increasing demand for cloud services and cybersecurity solutions. The company is expanding into Middle East markets.",
        keyAuditMatters: [
          "Revenue recognition on long-term software development contracts",
          "Valuation of trade receivables",
        ],
        significantRisks: [
          "Revenue recognition - percentage of completion estimation",
          "Inventory obsolescence - technology components",
        ],
        relatedParties: [
          "TechVentures Holdings (Pvt.) Ltd",
          "Digital Solutions LLC, Dubai",
        ],
        preparedById: senior.id,
        preparedDate: new Date("2025-12-12"),
      },
    });

    console.log("  Creating internal control assessments...");
    const icaData = {
      controlEnvironment: "The entity maintains a strong control environment with tone at the top set by management. Code of ethics is established and communicated to all employees. Clear organizational structure with defined responsibilities.",
      controlEnvironmentRating: "EFFECTIVE",
      entityRiskAssessment: "Management conducts periodic risk assessments. Business risks are identified and evaluated through quarterly management meetings and annual strategic planning sessions.",
      entityRiskAssessmentRating: "EFFECTIVE",
      informationSystems: "SAP Business One serves as the primary financial information system. Integrated with project management (Jira) and CRM (Salesforce) systems. IT general controls include access controls, change management, and backup procedures.",
      informationSystemsRating: "EFFECTIVE",
      controlActivities: "Key control activities include authorization matrices for transactions, segregation of duties in financial processes, three-way matching for purchases, and automated controls in SAP for journal entry approvals.",
      controlActivitiesRating: "EFFECTIVE",
      monitoringActivities: "Internal audit function performs periodic reviews. Management reviews monthly financial reports and KPIs. Audit committee meets quarterly to review financial reporting and internal controls.",
      monitoringActivitiesRating: "EFFECTIVE",
      overallAssessment: "The overall internal control environment is considered effective for the purpose of the audit. Partial reliance on controls is appropriate, with enhanced substantive testing in significant risk areas.",
      overallRating: "EFFECTIVE",
      significantDeficiencies: [],
      materialWeaknesses: [],
      impactOnAuditStrategy: "The effective control environment supports a combined audit approach with partial reliance on controls, allowing reduced substantive testing in certain areas while maintaining enhanced procedures for significant risks.",
      preparedById: senior.id,
      preparedDate: new Date("2025-01-20"),
    };
    await prisma.internalControlAssessment.create({ data: { engagementId: eng1.id, ...icaData } });
    await prisma.internalControlAssessment.create({
      data: { engagementId: eng2.id, ...icaData, preparedDate: new Date("2025-12-12") },
    });

    console.log("  Creating internal controls...");
    const controlTemplates = [
      {
        cycle: "REVENUE" as const,
        processName: "Revenue Recognition",
        controlId: "IC-001",
        controlObjective: "Ensure revenue is recognized in accordance with IFRS 15 and only for valid transactions",
        controlDescription: "All software development contracts require partner approval before revenue recognition. Project managers submit percentage of completion reports monthly which are reviewed by the CFO before revenue is recorded in SAP.",
        controlType: "PREVENTIVE" as const,
        controlNature: "MANUAL" as const,
        frequency: "MONTHLY" as const,
        controlOwner: "CFO - Fatima Zahra",
        controlOwnerTitle: "Chief Financial Officer",
        keyControl: true,
        relyOnControl: true,
      },
      {
        cycle: "PURCHASES" as const,
        processName: "Procurement and Payments",
        controlId: "IC-002",
        controlObjective: "Ensure all purchases are properly authorized, received, and recorded",
        controlDescription: "Three-way matching of purchase order, goods receipt note, and vendor invoice is performed in SAP before payment processing. All payments above PKR 500,000 require dual authorization.",
        controlType: "PREVENTIVE" as const,
        controlNature: "IT_DEPENDENT_MANUAL" as const,
        frequency: "CONTINUOUS" as const,
        controlOwner: "Finance Manager",
        controlOwnerTitle: "Finance Manager",
        keyControl: true,
        relyOnControl: true,
      },
      {
        cycle: "PAYROLL" as const,
        processName: "Payroll Processing",
        controlId: "IC-003",
        controlObjective: "Ensure payroll is accurately calculated, properly authorized, and completely recorded",
        controlDescription: "HR department maintains employee master data with maker-checker controls. Monthly payroll is calculated by HR, reviewed by Finance Manager, and approved by CFO before processing. Payroll reconciliation is performed monthly.",
        controlType: "DETECTIVE" as const,
        controlNature: "MANUAL" as const,
        frequency: "MONTHLY" as const,
        controlOwner: "HR Manager",
        controlOwnerTitle: "HR Manager",
        keyControl: true,
        relyOnControl: true,
      },
    ];

    const eng1Controls = [];
    for (const ct of controlTemplates) {
      const ctrl = await prisma.internalControl.create({
        data: {
          engagementId: eng1.id,
          ...ct,
          documentedById: senior.id,
          documentedDate: new Date("2025-01-22"),
        },
      });
      eng1Controls.push(ctrl);
    }

    for (const ct of controlTemplates) {
      await prisma.internalControl.create({
        data: {
          engagementId: eng2.id,
          ...ct,
          documentedById: senior.id,
          documentedDate: new Date("2025-12-15"),
        },
      });
    }

    console.log("  Creating control tests (eng1)...");
    const controlTestTemplates = [
      {
        testingObjective: "Test operating effectiveness of revenue recognition controls",
        testingProcedure: "Selected a sample of 25 contracts and verified partner approval, completion reports, and CFO review for each month of the period",
        populationDescription: "All software development contracts with revenue recognized during the period",
        populationSize: 48,
        sampleSize: 25,
        samplingMethod: "RANDOM",
        exceptionsNoted: 0,
        operatingEffectiveness: "EFFECTIVE" as const,
        operatingEffectivenessComments: "No exceptions noted. Controls operated effectively throughout the period.",
        controlRelianceConclusion: true,
        relianceJustification: "Controls over revenue recognition are effective and can be relied upon to reduce the extent of substantive testing",
      },
      {
        testingObjective: "Test operating effectiveness of purchase authorization and three-way matching",
        testingProcedure: "Selected 30 purchase transactions and verified PO, GRN, and invoice matching, and dual authorization for payments above threshold",
        populationDescription: "All purchase transactions during the audit period",
        populationSize: 1240,
        sampleSize: 30,
        samplingMethod: "MONETARY_UNIT",
        exceptionsNoted: 1,
        exceptionDetails: "One transaction of PKR 450,000 was processed without GRN prior to payment. Subsequently matched and no misstatement identified.",
        operatingEffectiveness: "EFFECTIVE" as const,
        operatingEffectivenessComments: "One minor exception noted but not indicative of a control failure. Control is effective overall.",
        controlRelianceConclusion: true,
        relianceJustification: "Controls over procurement are effective with one minor exception that does not affect overall reliance",
      },
      {
        testingObjective: "Test operating effectiveness of payroll processing controls",
        testingProcedure: "Selected 3 months and reperformed payroll calculation, verified authorization chain, and reconciled payroll to GL postings",
        populationDescription: "Monthly payroll processing for all 12 months",
        populationSize: 12,
        sampleSize: 3,
        samplingMethod: "RANDOM",
        exceptionsNoted: 0,
        operatingEffectiveness: "EFFECTIVE" as const,
        operatingEffectivenessComments: "No exceptions noted in payroll processing, authorization, or reconciliation.",
        controlRelianceConclusion: true,
        relianceJustification: "Payroll controls are effective and can be relied upon",
      },
    ];

    for (let i = 0; i < 3; i++) {
      await prisma.controlTest.create({
        data: {
          controlId: eng1Controls[i].id,
          engagementId: eng1.id,
          ...controlTestTemplates[i],
          testingPeriodStart: new Date("2024-01-01"),
          testingPeriodEnd: new Date("2024-12-31"),
          performedById: staff.id,
          performedDate: new Date("2025-02-01"),
          reviewedById: senior.id,
          reviewedDate: new Date("2025-02-05"),
        },
      });
    }

    console.log("  Creating substantive tests (eng1)...");
    const substantiveTemplates = [
      {
        testReference: "ST-REV-001",
        fsArea: "REVENUE" as const,
        accountName: "Revenue from Software Development Contracts",
        assertion: "OCCURRENCE",
        testingType: "DETAIL" as const,
        testObjective: "Verify that recorded revenue transactions have occurred and relate to valid contracts",
        testProcedure: "Selected sample of revenue transactions, agreed to signed contracts, verified milestone completion reports, confirmed customer acknowledgment of deliverables",
        samplingMethod: "MONETARY_UNIT_SAMPLING" as const,
        populationDescription: "All revenue transactions during FY2024",
        populationCount: 856,
        sampleSize: 40,
        conclusion: "Revenue transactions are fairly stated. No material misstatements identified.",
        conclusionSatisfactory: true,
      },
      {
        testReference: "ST-REC-001",
        fsArea: "RECEIVABLES" as const,
        accountName: "Trade Receivables",
        assertion: "EXISTENCE",
        testingType: "DETAIL" as const,
        testObjective: "Confirm existence and accuracy of trade receivable balances at year end",
        testProcedure: "Sent positive confirmations to selected debtors, performed alternative procedures for non-responses including subsequent receipts testing and agreement to invoices",
        samplingMethod: "MONETARY_UNIT_SAMPLING" as const,
        populationDescription: "Trade receivables balance at December 31, 2024",
        populationCount: 145,
        sampleSize: 35,
        conclusion: "Trade receivables balances confirmed. ECL provision is adequate.",
        conclusionSatisfactory: true,
      },
      {
        testReference: "ST-FA-001",
        fsArea: "FIXED_ASSETS" as const,
        accountName: "Property, Plant and Equipment",
        assertion: "VALUATION",
        testingType: "ANALYTICAL" as const,
        testObjective: "Verify that fixed assets are correctly valued including depreciation calculations",
        testProcedure: "Recalculated depreciation for sample of assets, compared expected vs actual depreciation charge, reviewed capital vs revenue expenditure classification for additions",
        samplingMethod: "NON_STATISTICAL_JUDGMENTAL" as const,
        populationDescription: "Fixed asset register at December 31, 2024",
        populationCount: 423,
        sampleSize: 25,
        conclusion: "Fixed assets are fairly stated. Depreciation calculations are accurate.",
        conclusionSatisfactory: true,
      },
      {
        testReference: "ST-INV-001",
        fsArea: "INVENTORIES" as const,
        accountName: "Inventories - Hardware and Software Licenses",
        assertion: "EXISTENCE",
        testingType: "DETAIL" as const,
        testObjective: "Verify existence and valuation of inventory at year end",
        testProcedure: "Attended physical inventory count, performed test counts, reviewed NRV assessments for slow-moving items, tested valuation of software licenses",
        samplingMethod: "STATISTICAL_RANDOM" as const,
        populationDescription: "Inventory items at December 31, 2024",
        populationCount: 312,
        sampleSize: 50,
        conclusion: "Inventory quantities and valuation are fairly stated. NRV write-down of PKR 1.2M appropriately recorded.",
        conclusionSatisfactory: true,
      },
    ];

    for (let i = 0; i < 4; i++) {
      await prisma.substantiveTest.create({
        data: {
          engagementId: eng1.id,
          ...substantiveTemplates[i],
          riskId: eng1Risks[i].id,
          testingPeriodStart: new Date("2025-01-15"),
          testingPeriodEnd: new Date("2025-03-10"),
          performedById: staff.id,
          performedDate: new Date("2025-02-15"),
          reviewedById: senior.id,
          reviewedDate: new Date("2025-02-20"),
          managerApprovedById: manager.id,
          managerApprovalDate: new Date("2025-02-22"),
        },
      });
    }

    console.log("  Creating misstatements (eng1)...");
    await prisma.misstatement.createMany({
      data: [
        {
          engagementId: eng1.id,
          misstatementReference: "MS-001",
          fsArea: "REVENUE",
          accountName: "Revenue from Software Contracts",
          misstatementType: "FACTUAL",
          status: "ADJUSTED",
          bookValue: 15200000,
          auditedValue: 14800000,
          misstatementAmount: 400000,
          description: "Revenue of PKR 400,000 recognized for contract milestone not yet achieved at year end. Client invoiced ahead of actual completion.",
          cause: "Premature milestone billing before deliverable acceptance",
          affectedAssertions: ["OCCURRENCE", "CUTOFF"],
          managementResponse: "Agreed to adjust. Revenue will be deferred to next period.",
          adjustmentReference: "AJE-001",
          adjustedDate: new Date("2025-02-25"),
          isAboveTrivialThreshold: false,
          identifiedById: staff.id,
          identifiedDate: new Date("2025-02-10"),
          reviewedById: senior.id,
          reviewedDate: new Date("2025-02-12"),
        },
        {
          engagementId: eng1.id,
          misstatementReference: "MS-002",
          fsArea: "RECEIVABLES",
          accountName: "Trade Receivables - ECL Provision",
          misstatementType: "JUDGMENTAL",
          status: "UNADJUSTED",
          bookValue: 3500000,
          auditedValue: 4100000,
          misstatementAmount: 600000,
          description: "Expected credit loss provision understated by PKR 600,000 based on auditor's independent assessment of historical loss rates for the technology sector.",
          cause: "Management used lower historical loss rates that did not fully reflect recent economic conditions",
          affectedAssertions: ["VALUATION"],
          managementResponse: "Management considers existing provision adequate based on specific customer analysis",
          isAboveTrivialThreshold: false,
          isAbovePM: false,
          impactOnOpinion: "Below performance materiality - no impact on opinion",
          identifiedById: senior.id,
          identifiedDate: new Date("2025-02-18"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-02-20"),
        },
      ],
    });

    console.log("  Creating subsequent events (eng1)...");
    await prisma.subsequentEvent.createMany({
      data: [
        {
          engagementId: eng1.id,
          eventReference: "SE-001",
          eventDate: new Date("2025-01-15"),
          identifiedDate: new Date("2025-02-20"),
          eventType: "TYPE_1_ADJUSTING",
          status: "EVALUATED",
          description: "Settlement of legal claim filed in November 2024 for PKR 2.5M. The claim related to a contract dispute with a former client. Settlement amount of PKR 1.8M was agreed in January 2025.",
          financialImpact: 1800000,
          affectedAccounts: ["Provisions", "Legal Expenses"],
          evaluation: "The legal claim existed at the reporting date and the settlement provides additional evidence of conditions at year end. Provision adjusted accordingly.",
          actionTaken: "Provision adjusted from PKR 2.5M to PKR 1.8M in the financial statements",
          adjustmentReference: "AJE-003",
          identifiedById: senior.id,
          reviewedById: manager.id,
          reviewedDate: new Date("2025-02-22"),
          partnerApprovedById: partner.id,
          partnerApprovalDate: new Date("2025-02-25"),
        },
        {
          engagementId: eng1.id,
          eventReference: "SE-002",
          eventDate: new Date("2025-02-10"),
          identifiedDate: new Date("2025-02-25"),
          eventType: "TYPE_2_NON_ADJUSTING",
          status: "EVALUATED",
          description: "Board approved a major acquisition of a cybersecurity startup for PKR 120M in February 2025. The acquisition is expected to close in Q2 2025.",
          financialImpact: 120000000,
          affectedAccounts: ["Investments", "Goodwill"],
          evaluation: "The acquisition decision was made after the reporting date and does not provide evidence of conditions at year end. Disclosure in notes is required.",
          actionTaken: "Adequate disclosure included in notes to the financial statements",
          disclosureReference: "Note 32 - Subsequent Events",
          identifiedById: senior.id,
          reviewedById: manager.id,
          reviewedDate: new Date("2025-02-27"),
          partnerApprovedById: partner.id,
          partnerApprovalDate: new Date("2025-02-28"),
        },
      ],
    });

    console.log("  Creating written representations (eng1)...");
    await prisma.writtenRepresentation.createMany({
      data: [
        {
          engagementId: eng1.id,
          representationType: "Financial Statements Responsibility",
          representationText: "We confirm that the financial statements have been prepared in accordance with International Financial Reporting Standards (IFRS) and give a true and fair view of the financial position, financial performance, and cash flows of the company.",
          isStandard: true,
          isRequired: true,
          managementAcknowledged: true,
          acknowledgmentDate: new Date("2025-03-10"),
          signatoryName: "Ahmad Raza Khan",
          signatoryTitle: "Chief Executive Officer",
          preparedById: senior.id,
          preparedDate: new Date("2025-03-01"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-03-05"),
        },
        {
          engagementId: eng1.id,
          representationType: "Internal Controls",
          representationText: "We acknowledge our responsibility for the design, implementation, and maintenance of internal controls relevant to the preparation of financial statements that are free from material misstatement, whether due to fraud or error.",
          isStandard: true,
          isRequired: true,
          managementAcknowledged: true,
          acknowledgmentDate: new Date("2025-03-10"),
          signatoryName: "Ahmad Raza Khan",
          signatoryTitle: "Chief Executive Officer",
          preparedById: senior.id,
          preparedDate: new Date("2025-03-01"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-03-05"),
        },
        {
          engagementId: eng1.id,
          representationType: "Completeness of Information",
          representationText: "We have provided you with access to all information of which we are aware that is relevant to the preparation of the financial statements, and we have disclosed to you all significant facts relating to any fraud or suspected fraud known to us.",
          isStandard: true,
          isRequired: true,
          managementAcknowledged: true,
          acknowledgmentDate: new Date("2025-03-10"),
          signatoryName: "Fatima Zahra",
          signatoryTitle: "Chief Financial Officer",
          preparedById: senior.id,
          preparedDate: new Date("2025-03-01"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-03-05"),
        },
      ],
    });

    console.log("  Creating audit report (eng1)...");
    await prisma.auditReport.create({
      data: {
        engagementId: eng1.id,
        reportReference: "AR-MER-2024",
        reportDate: new Date("2025-03-15"),
        opinionType: "UNMODIFIED",
        opinionBasis: "We conducted our audit in accordance with International Standards on Auditing (ISAs). Our responsibilities under those standards are further described in the Auditor's Responsibilities section. We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.",
        hasKeyAuditMatters: true,
        keyAuditMatters: [
          {
            matter: "Revenue Recognition from Software Development Contracts",
            description: "Revenue from long-term software contracts involves significant judgment in estimating completion percentages",
            auditResponse: "We tested the revenue recognition methodology, verified milestone completion, and assessed the reasonableness of cost estimates",
          },
        ],
        hasEmphasisOfMatter: false,
        goingConcernUncertainty: false,
        draftedById: senior.id,
        draftedDate: new Date("2025-03-10"),
        managerReviewedById: manager.id,
        managerReviewDate: new Date("2025-03-12"),
        partnerApprovedById: partner.id,
        partnerApprovalDate: new Date("2025-03-14"),
        signedById: partner.id,
        signedDate: new Date("2025-03-15"),
      },
    });

    console.log("  Creating management letter (eng1)...");
    await prisma.managementLetter.create({
      data: {
        engagementId: eng1.id,
        letterReference: "ML-MER-2024",
        letterDate: new Date("2025-03-20"),
        findings: [
          {
            finding: "Inadequate segregation of duties in IT administrator access",
            risk: "MEDIUM",
            recommendation: "Implement privileged access management with periodic review",
            area: "IT Controls",
          },
          {
            finding: "Contract management documentation gaps for smaller engagements",
            risk: "LOW",
            recommendation: "Standardize contract documentation for all engagement sizes",
            area: "Revenue Cycle",
          },
          {
            finding: "Inventory count procedures could be enhanced for software licenses",
            risk: "LOW",
            recommendation: "Implement automated license tracking system",
            area: "Inventory Management",
          },
        ],
        recommendations: [
          {
            priority: "HIGH",
            area: "IT Security",
            recommendation: "Implement multi-factor authentication for all financial system access",
            timeline: "Q2 2025",
          },
          {
            priority: "MEDIUM",
            area: "Financial Reporting",
            recommendation: "Enhance monthly close procedures to include analytical review of key ratios",
            timeline: "Q3 2025",
          },
        ],
        draftedById: senior.id,
        draftedDate: new Date("2025-03-15"),
        partnerApprovedById: partner.id,
        partnerApprovalDate: new Date("2025-03-18"),
        deliveredDate: new Date("2025-03-20"),
        deliveredToClient: true,
      },
    });

    console.log("  Creating completion memo (eng1)...");
    await prisma.completionMemo.create({
      data: {
        engagementId: eng1.id,
        summaryOfAudit: "The audit of Meridian Technologies for FY2024 has been completed in accordance with ISAs. All planned procedures were performed and sufficient appropriate audit evidence was obtained.",
        significantFindings: "One factual misstatement of PKR 400,000 identified in revenue recognition was adjusted by management. One judgmental misstatement of PKR 600,000 in ECL provision remains unadjusted but is below performance materiality.",
        significantJudgments: "Key judgments related to revenue recognition percentage of completion estimates and expected credit loss provisioning. Management's estimates were found to be within an acceptable range.",
        misstatementSummary: "Total adjusted misstatements: PKR 400,000. Total unadjusted misstatements: PKR 600,000. Total unadjusted is below performance materiality of PKR 9,562,500.",
        totalUncorrectedMisstatements: 600000,
        misstatementConclusion: "Unadjusted misstatements are not material individually or in aggregate. No impact on audit opinion.",
        goingConcernConclusion: "No material uncertainty regarding going concern. Entity has adequate resources and positive outlook.",
        subsequentEventsConclusion: "Two subsequent events identified - one adjusting (legal settlement) and one non-adjusting (acquisition). Appropriately reflected/disclosed.",
        overallConclusion: "Based on the audit procedures performed, we have obtained reasonable assurance that the financial statements of Meridian Technologies for FY2024 are free from material misstatement. An unmodified opinion is recommended.",
        opinionRecommendation: "UNMODIFIED",
        preparedById: senior.id,
        preparedDate: new Date("2025-03-08"),
        managerReviewedById: manager.id,
        managerReviewDate: new Date("2025-03-10"),
        partnerApprovedById: partner.id,
        partnerApprovalDate: new Date("2025-03-12"),
      },
    });

    console.log("  Creating compliance checklists (eng1)...");
    await prisma.complianceChecklist.createMany({
      data: [
        {
          engagementId: eng1.id,
          checklistType: "ISA_COMPLIANCE",
          checklistReference: "CL-ISA-001",
          items: [
            { item: "ISA 200 - Overall objectives agreed", status: "COMPLETED", notes: "Documented in engagement letter" },
            { item: "ISA 210 - Terms of engagement agreed", status: "COMPLETED", notes: "Engagement letter signed" },
            { item: "ISA 220 - Quality management applied", status: "COMPLETED", notes: "EQCR performed" },
            { item: "ISA 240 - Fraud risk assessment", status: "COMPLETED", notes: "Fraud risks assessed and documented" },
            { item: "ISA 250 - Laws and regulations considered", status: "COMPLETED", notes: "Applicable laws identified" },
            { item: "ISA 300 - Audit planned", status: "COMPLETED", notes: "Planning memo approved" },
            { item: "ISA 315 - Risks identified and assessed", status: "COMPLETED", notes: "Risk assessment completed" },
            { item: "ISA 320 - Materiality determined", status: "COMPLETED", notes: "Materiality set and approved" },
            { item: "ISA 330 - Responses to assessed risks", status: "COMPLETED", notes: "Audit procedures designed" },
            { item: "ISA 450 - Misstatements evaluated", status: "COMPLETED", notes: "Misstatement summary prepared" },
          ],
          totalItems: 10,
          completedItems: 10,
          notApplicableItems: 0,
          isComplete: true,
          preparedById: senior.id,
          preparedDate: new Date("2025-03-05"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-03-07"),
        },
        {
          engagementId: eng1.id,
          checklistType: "COMPANIES_ACT_COMPLIANCE",
          checklistReference: "CL-CA-001",
          items: [
            { item: "Section 223 - Preparation of financial statements", status: "COMPLETED" },
            { item: "Section 225 - Directors report included", status: "COMPLETED" },
            { item: "Section 227 - Auditor's report requirements", status: "COMPLETED" },
            { item: "Section 249 - Audit committee requirements", status: "COMPLETED" },
            { item: "Fourth Schedule - Disclosure requirements", status: "COMPLETED" },
          ],
          totalItems: 5,
          completedItems: 5,
          notApplicableItems: 0,
          isComplete: true,
          preparedById: senior.id,
          preparedDate: new Date("2025-03-05"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-03-07"),
        },
      ],
    });

    console.log("  Creating EQCR assignment (eng1)...");
    const eqcrAssignment = await prisma.eQCRAssignment.create({
      data: {
        engagementId: eng1.id,
        isRequired: true,
        requirementReason: "Listed entity audit requiring engagement quality review per ISQM 2",
        status: "CLEARED",
        assignedReviewerId: eqcrUser.id,
        assignedDate: new Date("2025-02-01"),
        assignedById: partner.id,
        reviewStartDate: new Date("2025-03-01"),
        reviewCompletedDate: new Date("2025-03-12"),
        significantJudgmentsReviewed: [
          { area: "Revenue recognition", conclusion: "Appropriate judgment applied" },
          { area: "ECL provision", conclusion: "Reasonable estimate within acceptable range" },
          { area: "Going concern", conclusion: "No material uncertainty - appropriate conclusion" },
        ],
        conclusionsReviewed: [
          { area: "Overall audit conclusion", conclusion: "Unmodified opinion appropriate" },
          { area: "Materiality assessment", conclusion: "Benchmark and percentages reasonable" },
        ],
        overallConclusion: "Based on my review, I concur with the engagement team's conclusions. The significant judgments made are appropriate and the proposed audit opinion is supported by sufficient appropriate evidence.",
        clearanceDate: new Date("2025-03-12"),
        clearanceComments: "All matters satisfactorily addressed. Engagement quality review cleared.",
      },
    });

    console.log("  Creating EQCR comments (eng1)...");
    await prisma.eQCRComment.createMany({
      data: [
        {
          eqcrAssignmentId: eqcrAssignment.id,
          commentReference: "EQCR-C-001",
          area: "Revenue Recognition",
          comment: "Please provide additional documentation supporting the percentage of completion estimates for the three largest contracts.",
          severity: "WARNING",
          status: "CLEARED",
          response: "Additional supporting documentation including project manager estimates and client acceptance certificates provided.",
          respondedById: senior.id,
          respondedDate: new Date("2025-03-05"),
          clearedById: eqcrUser.id,
          clearedDate: new Date("2025-03-08"),
          createdById: eqcrUser.id,
        },
        {
          eqcrAssignmentId: eqcrAssignment.id,
          commentReference: "EQCR-C-002",
          area: "Unadjusted Misstatements",
          comment: "Confirm that the unadjusted misstatement of PKR 600,000 in ECL provision has been communicated to those charged with governance.",
          severity: "INFO",
          status: "CLEARED",
          response: "Communication with audit committee confirmed. Minutes of discussion available in workpapers.",
          respondedById: manager.id,
          respondedDate: new Date("2025-03-06"),
          clearedById: eqcrUser.id,
          clearedDate: new Date("2025-03-09"),
          createdById: eqcrUser.id,
        },
      ],
    });

    console.log("  Creating EQCR checklist items (eng1)...");
    const eqcrChecklistAreas = [
      { area: "Independence and Ethics", desc: "Verified independence declarations from all team members and confirmed no threats identified" },
      { area: "Significant Risks", desc: "Reviewed audit responses to significant risks including revenue recognition and inventory valuation" },
      { area: "Materiality", desc: "Assessed appropriateness of materiality benchmark, percentages, and performance materiality" },
      { area: "Key Audit Matters", desc: "Reviewed the identification and communication of key audit matters in the auditor's report" },
      { area: "Overall Conclusion", desc: "Evaluated the sufficiency and appropriateness of audit evidence supporting the unmodified opinion" },
    ];
    await prisma.eQCRChecklistItem.createMany({
      data: eqcrChecklistAreas.map((item, i) => ({
        eqcrAssignmentId: eqcrAssignment.id,
        srNo: i + 1,
        checklistArea: item.area,
        descriptionOfReview: item.desc,
        response: "YES" as const,
        remarks: `Satisfactorily reviewed - ${item.area.toLowerCase()} requirements met`,
        reviewedById: eqcrUser.id,
        reviewedAt: new Date("2025-03-10"),
      })),
    });

    console.log("  Creating inspection readiness (eng1)...");
    await prisma.inspectionReadiness.create({
      data: {
        engagementId: eng1.id,
        lastCheckedDate: new Date("2025-03-15"),
        lastCheckedById: manager.id,
        overallReadiness: 85,
        openItemsCount: 3,
        auditTrailIntegrity: true,
        phaseLockStatus: {
          onboarding: "LOCKED",
          prePlanning: "LOCKED",
          planning: "LOCKED",
          execution: "IN_PROGRESS",
          finalization: "NOT_STARTED",
        },
        checklistCompletion: {
          isaCompliance: { total: 10, completed: 10 },
          companiesActCompliance: { total: 5, completed: 5 },
        },
        riskToProcedureMapping: {
          totalRisks: 4,
          mappedRisks: 4,
          unmappedRisks: 0,
          coveragePercentage: 100,
        },
        readinessIssues: [
          { issue: "3 execution workpapers pending manager review", severity: "LOW", area: "Execution" },
          { issue: "Evidence filing for 2 controls tests incomplete", severity: "LOW", area: "Controls Testing" },
          { issue: "Final analytical review pending", severity: "MEDIUM", area: "Finalization" },
        ],
      },
    });

    console.log("  Creating deliverables (eng1)...");
    await prisma.deliverable.createMany({
      data: [
        {
          engagementId: eng1.id,
          deliverableType: "AUDIT_REPORT",
          opinionType: "UNMODIFIED",
          status: "ISSUED",
          remarks: "Independent auditor's report on the financial statements of Meridian Technologies for FY2024",
          deliveredDate: new Date("2025-03-15"),
          preparedById: senior.id,
          preparedAt: new Date("2025-03-10"),
          reviewedById: manager.id,
          reviewedAt: new Date("2025-03-12"),
          approvedById: partner.id,
          approvedAt: new Date("2025-03-14"),
          issuedById: partner.id,
          issuedAt: new Date("2025-03-15"),
        },
        {
          engagementId: eng1.id,
          deliverableType: "MANAGEMENT_LETTER",
          status: "FINAL",
          remarks: "Management letter with observations and recommendations for FY2024",
          deliveredDate: new Date("2025-03-20"),
          preparedById: senior.id,
          preparedAt: new Date("2025-03-15"),
          reviewedById: manager.id,
          reviewedAt: new Date("2025-03-17"),
          approvedById: partner.id,
          approvedAt: new Date("2025-03-18"),
        },
        {
          engagementId: eng1.id,
          deliverableType: "ENGAGEMENT_SUMMARY",
          status: "FINAL",
          remarks: "Comprehensive engagement summary report including time analysis and key findings",
          preparedById: manager.id,
          preparedAt: new Date("2025-03-18"),
          reviewedById: partner.id,
          reviewedAt: new Date("2025-03-19"),
        },
      ],
    });

    console.log("  Creating sign-off register (eng1)...");
    const signOffTypes: Array<{ type: "ENGAGEMENT_ACCEPTANCE" | "PLANNING_APPROVAL" | "RISK_ASSESSMENT_APPROVAL" | "MATERIALITY_APPROVAL" | "REPORT_APPROVAL"; phase: "ONBOARDING" | "PLANNING" | "EXECUTION" | "REPORTING"; desc: string }> = [
      { type: "ENGAGEMENT_ACCEPTANCE", phase: "ONBOARDING", desc: "Engagement acceptance and client onboarding sign-off" },
      { type: "PLANNING_APPROVAL", phase: "PLANNING", desc: "Audit planning phase completion and approval" },
      { type: "RISK_ASSESSMENT_APPROVAL", phase: "PLANNING", desc: "Risk assessment methodology and results approval" },
      { type: "MATERIALITY_APPROVAL", phase: "PLANNING", desc: "Materiality determination and allocation approval" },
      { type: "REPORT_APPROVAL", phase: "REPORTING", desc: "Final audit report review and issuance approval" },
    ];
    await prisma.signOffRegister.createMany({
      data: signOffTypes.map((so) => ({
        engagementId: eng1.id,
        signOffType: so.type,
        phase: so.phase,
        description: so.desc,
        status: "APPROVED" as const,
        requiredRole: "PARTNER" as const,
        isBlocking: true,
        preparedById: senior.id,
        preparedAt: new Date("2025-01-20"),
        reviewedById: manager.id,
        reviewedAt: new Date("2025-01-22"),
        approvedById: partner.id,
        approvedAt: new Date("2025-01-25"),
        evidenceRequired: true,
        evidenceProvided: true,
      })),
    });

    console.log("  Creating section sign-offs (eng1)...");
    await prisma.sectionSignOff.createMany({
      data: [
        {
          engagementId: eng1.id,
          section: "Revenue and Receivables",
          phase: "EXECUTION",
          preparedById: staff.id,
          preparedDate: new Date("2025-02-20"),
          reviewedById: senior.id,
          reviewedDate: new Date("2025-02-22"),
          partnerApprovedById: partner.id,
          partnerApprovalDate: new Date("2025-02-25"),
          isComplete: true,
        },
        {
          engagementId: eng1.id,
          section: "Fixed Assets and Depreciation",
          phase: "EXECUTION",
          preparedById: staff.id,
          preparedDate: new Date("2025-02-22"),
          reviewedById: senior.id,
          reviewedDate: new Date("2025-02-24"),
          partnerApprovedById: partner.id,
          partnerApprovalDate: new Date("2025-02-26"),
          isComplete: true,
        },
        {
          engagementId: eng1.id,
          section: "Inventory and Cost of Sales",
          phase: "EXECUTION",
          preparedById: staff.id,
          preparedDate: new Date("2025-02-25"),
          reviewedById: senior.id,
          reviewedDate: new Date("2025-02-27"),
          isComplete: false,
        },
      ],
    });

    console.log("  Creating industry analysis...");
    const industryData = {
      industryCode: "6201",
      industrySector: "Information Technology",
      industrySubsector: "Software Development and IT Services",
      marketConditions: "Pakistan's IT sector growing at 25%+ annually with strong export demand. Government initiatives like IT parks and tax incentives support growth. Digital transformation driving enterprise software demand.",
      competitiveEnvironment: "Highly competitive with both local players (Systems Limited, NetSol, TRG) and international firms (Accenture, IBM). Key differentiator is domain expertise in financial services technology.",
      regulatoryFactors: "Subject to SECP regulations for corporate governance, SBP regulations for fintech products, and PTA regulations for telecom-related services. Data protection regulations under development.",
      technologicalChanges: "Rapid adoption of cloud computing, AI/ML integration, and DevOps practices. Shift from project-based to SaaS revenue models. Cybersecurity becoming a critical focus area.",
      economicFactors: "Currency depreciation impacts export revenue positively but increases imported technology costs. Inflation affects operational costs including salaries and office expenses.",
      industryRisks: [
        { risk: "Talent acquisition and retention", impact: "HIGH", likelihood: "HIGH" },
        { risk: "Technology obsolescence", impact: "MEDIUM", likelihood: "MEDIUM" },
        { risk: "Client concentration risk", impact: "HIGH", likelihood: "MEDIUM" },
        { risk: "Currency fluctuation", impact: "MEDIUM", likelihood: "HIGH" },
      ],
      typicalFraudSchemes: [
        { scheme: "Premature revenue recognition on contracts", frequency: "COMMON" },
        { scheme: "Fictitious project expenses", frequency: "UNCOMMON" },
        { scheme: "Ghost employees in payroll", frequency: "RARE" },
      ],
      industryBenchmarks: [
        { metric: "Revenue growth rate", benchmark: "15-25%", source: "PASHA Annual Report" },
        { metric: "Gross margin", benchmark: "35-45%", source: "Listed IT companies" },
        { metric: "Employee revenue", benchmark: "PKR 2.5-4M per employee", source: "Industry average" },
        { metric: "Receivable days", benchmark: "60-90 days", source: "Industry average" },
      ],
      industryTrends: "Shift to cloud-first strategies, increasing demand for cybersecurity, growth in fintech, and AI-powered solutions",
      riskImplications: "Revenue recognition requires careful assessment of contract terms and completion percentages. Inventory of technology products subject to rapid obsolescence.",
      auditImplications: "Enhanced focus on IT controls testing, revenue recognition judgments, and technology inventory valuation. Consider IT audit specialist involvement.",
    };
    await prisma.industryAnalysis.create({ data: { engagementId: eng1.id, ...industryData } });
    await prisma.industryAnalysis.create({ data: { engagementId: eng2.id, ...industryData } });

    console.log("  Creating related parties (eng1)...");
    await prisma.relatedParty.createMany({
      data: [
        {
          engagementId: eng1.id,
          partyName: "TechVentures Holdings (Pvt.) Ltd",
          partyType: "Associated Company",
          relationshipType: "Common Directorship",
          natureOfRelationship: "CEO Ahmad Raza Khan is also a director of TechVentures Holdings, which provides venture capital funding to technology startups",
          ownershipPercentage: 30,
          isControlling: false,
          isKeyManagement: true,
          transactionTypes: [
            { type: "Consulting services provided", amount: 5000000 },
            { type: "Office space sub-lease", amount: 1200000 },
          ],
          transactionValue: 6200000,
          balanceOutstanding: 1500000,
          armLengthAssessment: "Transactions reviewed and confirmed to be at arm's length based on comparable market rates",
          disclosureRequired: true,
          disclosureAdequate: true,
          riskAssessment: "Low risk - transactions are routine and at market rates",
          identifiedById: senior.id,
          identifiedDate: new Date("2025-01-20"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-01-25"),
        },
        {
          engagementId: eng1.id,
          partyName: "Digital Solutions LLC, Dubai",
          partyType: "Foreign Subsidiary",
          relationshipType: "Common Ownership",
          natureOfRelationship: "Wholly-owned subsidiary established in Dubai for Middle East operations. Ahmad Raza Khan and Bilal Mahmood hold 60% and 40% respectively.",
          ownershipPercentage: 100,
          isControlling: true,
          isKeyManagement: false,
          transactionTypes: [
            { type: "Intercompany software development services", amount: 25000000 },
            { type: "Management fee", amount: 3000000 },
          ],
          transactionValue: 28000000,
          balanceOutstanding: 8500000,
          armLengthAssessment: "Transfer pricing documentation reviewed. Transactions are at arm's length per transfer pricing study by independent advisor.",
          disclosureRequired: true,
          disclosureAdequate: true,
          riskAssessment: "Medium risk - significant intercompany transactions require transfer pricing compliance",
          identifiedById: senior.id,
          identifiedDate: new Date("2025-01-20"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-01-25"),
        },
      ],
    });

    await seedSecondClient();
    await seedAllPhaseData();
    await seedLinkageData();
    await seedWorkflowDemoData();
    const { seedCompleteAudit } = await import("./seedCompleteAudit");
    await seedCompleteAudit();

    console.log("Demo data seeded successfully!");
  } catch (error) {
    console.error("Error seeding demo data:", error);
    throw error;
  }
}

async function seedAllPhaseData() {
  console.log("Checking all-phase data completeness...");

  const eng1 = await prisma.engagement.findFirst({ where: { engagementCode: "ENG-2025-001" } });
  if (!eng1) { console.log("  ENG-2025-001 not found, skipping all-phase data."); return; }

  const existingPlan = await prisma.auditPlan.count({ where: { engagementId: eng1.id } });
  if (existingPlan > 0) {
    console.log("  All-phase data already seeded, skipping...");
    return;
  }

  const firm = await prisma.firm.findFirst();
  if (!firm) return;
  const users = await prisma.user.findMany({ where: { firmId: firm.id } });
  const getUser = (email: string) => users.find((u) => u.email === email)!;

  const partner = getUser("partner@auditwise.pk");
  const manager = getUser("manager@auditwise.pk");
  const teamlead = getUser("teamlead@auditwise.pk");
  const senior = getUser("senior@auditwise.pk");
  const staff = getUser("staff@auditwise.pk");
  const eqcrUser = getUser("eqcr@auditwise.pk");

  const skipIfExists = async (model: string, where: any) => {
    try { return (await (prisma as any)[model].count({ where })) > 0; } catch { return false; }
  };

  if (!await skipIfExists("independenceDeclaration", { engagementId: eng1.id })) {
    console.log("  Seeding independence declarations...");
    await prisma.independenceDeclaration.createMany({
      data: [partner, manager, teamlead, senior, staff].map(u => ({
        engagementId: eng1.id,
        userId: u.id,
        declarationType: "independence",
        hasFinancialInterest: false,
        hasBusinessRelationship: false,
        hasFamilyRelationship: false,
        hasPriorService: false,
        hasOtherThreat: false,
        confirmationStatement: `I, ${u.fullName}, confirm that I am independent of Meridian Technologies (Pvt.) Limited and have no conflicts of interest that would impair my objectivity or independence in relation to this engagement.`,
        status: "CONFIRMED" as const,
        confirmedAtStart: true,
        confirmedAtStartDate: new Date("2025-01-10"),
        confirmedAtCompletion: u.id === partner.id || u.id === manager.id,
        confirmedAtCompletionDate: u.id === partner.id || u.id === manager.id ? new Date("2025-03-10") : null,
      })),
    });
  }

  if (!await skipIfExists("ethicsConfirmation", { engagementId: eng1.id })) {
    console.log("  Seeding ethics confirmation...");
    await prisma.ethicsConfirmation.create({
      data: {
        engagementId: eng1.id,
        startConfirmedById: partner.id,
        startConfirmedDate: new Date("2025-01-10"),
        startConfirmationNotes: "All team members have confirmed independence. No threats identified. IESBA Code requirements satisfied.",
        completionConfirmedById: partner.id,
        completionConfirmedDate: new Date("2025-03-10"),
        completionConfirmationNotes: "Independence maintained throughout engagement. No new threats arose during the audit.",
        allDeclarationsComplete: true,
        allThreatsResolved: true,
        isLocked: true,
        lockedById: partner.id,
        lockedDate: new Date("2025-03-10"),
      },
    });
  }

  if (!await skipIfExists("engagementLetter", { engagementId: eng1.id })) {
    console.log("  Seeding engagement letter...");
    await prisma.engagementLetter.create({
      data: {
        engagementId: eng1.id,
        letterReference: "EL-2025-001",
        version: 1,
        auditObjective: "To express an opinion on whether the financial statements of Meridian Technologies (Pvt.) Limited for the year ended December 31, 2024 are prepared, in all material respects, in accordance with the International Financial Reporting Standards (IFRS) as adopted in Pakistan.",
        auditScope: "Audit of the complete set of financial statements comprising the statement of financial position, statement of profit or loss and other comprehensive income, statement of changes in equity, statement of cash flows, and notes to the financial statements.",
        managementResponsibilities: "Preparation and fair presentation of financial statements in accordance with IFRS. Design, implementation and maintenance of internal control. Providing access to all information relevant to the audit.",
        auditorResponsibilities: "Conduct audit in accordance with International Standards on Auditing (ISAs). Obtain reasonable assurance about whether financial statements are free from material misstatement. Communicate significant findings to those charged with governance.",
        reportingRequirements: "Audit report on financial statements per ISA 700. Management letter on internal control observations. Communication with those charged with governance per ISA 260.",
        proposedFee: 4500000,
        paymentTerms: "50% upon commencement of fieldwork, 50% upon delivery of audit report",
        engagementStartDate: new Date("2025-01-15"),
        engagementEndDate: new Date("2025-03-15"),
        reportingDeadline: new Date("2025-03-31"),
        specialTerms: "Access to client premises during normal business hours. Timely provision of requested documents and information.",
        status: "ACCEPTED" as const,
        preparedById: manager.id,
        preparedDate: new Date("2024-12-01"),
        partnerApprovedById: partner.id,
        partnerApprovalDate: new Date("2024-12-05"),
      },
    });
  }

  const controls = await prisma.internalControl.findMany({ where: { engagementId: eng1.id } });

  if (controls.length > 0 && !await skipIfExists("controlWalkthrough", { engagementId: eng1.id })) {
    console.log("  Seeding control walkthroughs...");
    await prisma.controlWalkthrough.createMany({
      data: controls.map((ctrl, idx) => ({
        controlId: ctrl.id,
        engagementId: eng1.id,
        walkthroughDate: new Date("2025-02-05"),
        walkthroughNarrative: `Walkthrough performed for ${ctrl.controlObjective?.substring(0, 50)}. Traced a sample transaction through the complete process flow, verified authorization levels, documentation, and system controls. Inquired of personnel responsible for the control.`,
        designAssessment: "EFFECTIVE" as const,
        designComments: "Control is properly designed to address the relevant assertion risk. Appropriate segregation of duties observed.",
        designDeficiencyNoted: false,
        implementationAssessment: idx < 2 ? ("EFFECTIVE" as const) : ("EFFECTIVE" as const),
        implementationComments: "Control is operating as designed. Evidence of consistent application observed.",
        implementationDeficiencyNoted: false,
        evidenceReferences: [`WP-CW-${String(idx + 1).padStart(3, "0")}`, `EV-WT-${String(idx + 1).padStart(3, "0")}`],
        performedById: senior.id,
        performedDate: new Date("2025-02-05"),
        reviewedById: manager.id,
        reviewedDate: new Date("2025-02-10"),
        reviewerComments: "Walkthrough procedures adequately performed. Concur with assessment.",
      })),
    });

    console.log("  Seeding control deficiencies...");
    await prisma.controlDeficiency.createMany({
      data: [
        {
          engagementId: eng1.id,
          controlId: controls[0]?.id || null,
          deficiencyReference: "CD-001",
          cycle: "REVENUE" as const,
          deficiencyDescription: "Revenue recognition review for contracts spanning multiple periods is performed only quarterly instead of monthly. This creates a risk that revenue cut-off errors may not be detected timely.",
          rootCause: "Staffing constraints in the finance team and lack of automated monthly close procedures for long-term contracts.",
          severity: "SIGNIFICANT_DEFICIENCY" as const,
          affectedAssertions: ["CUTOFF", "ACCURACY"],
          affectedAccounts: ["Revenue", "Deferred Revenue", "Trade Receivables"],
          hasCompensatingControl: true,
          compensatingControlDescription: "Management performs a detailed year-end review of all multi-period contracts with CFO sign-off.",
          compensatingControlEffective: true,
          remediationPlan: "Implement monthly revenue recognition review for all contracts exceeding PKR 5 million. Automate cut-off checking within SAP Business One.",
          remediationResponsible: "CFO - Fatima Zahra",
          remediationTargetDate: new Date("2025-06-30"),
          remediationStatus: "OPEN" as const,
          identifiedById: senior.id,
          identifiedDate: new Date("2025-02-10"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-02-15"),
        },
        {
          engagementId: eng1.id,
          controlId: controls[1]?.id || null,
          deficiencyReference: "CD-002",
          cycle: "PURCHASES" as const,
          deficiencyDescription: "Purchase orders above PKR 500,000 require dual authorization, but the system does not enforce this for certain vendor categories marked as 'preferred suppliers'.",
          rootCause: "System configuration oversight when preferred supplier module was implemented. Authorization rules were not updated to include preferred vendors.",
          severity: "DEFICIENCY" as const,
          affectedAssertions: ["EXISTENCE", "COMPLETENESS"],
          affectedAccounts: ["Trade Payables", "Operating Expenses"],
          hasCompensatingControl: true,
          compensatingControlDescription: "Monthly review of all purchase orders by procurement manager regardless of vendor category.",
          compensatingControlEffective: true,
          remediationPlan: "Update SAP authorization matrix to enforce dual approval for all purchase orders above threshold regardless of vendor category.",
          remediationResponsible: "IT Manager",
          remediationTargetDate: new Date("2025-04-30"),
          remediationStatus: "REMEDIATION_IN_PROGRESS" as const,
          identifiedById: senior.id,
          identifiedDate: new Date("2025-02-12"),
          reviewedById: manager.id,
          reviewedDate: new Date("2025-02-15"),
        },
      ],
    });
  }

  if (!await skipIfExists("analyticalProcedure", { engagementId: eng1.id })) {
  console.log("  Seeding analytical procedures...");
  await prisma.analyticalProcedure.createMany({
    data: [
      {
        engagementId: eng1.id,
        procedureReference: "AP-001",
        analyticalType: "RATIO_ANALYSIS" as const,
        fsArea: "REVENUE" as const,
        description: "Gross profit margin analysis - compare current year GP% to prior year and industry average",
        expectation: "Gross profit margin expected to be between 42-48% based on prior year (45.2%) and industry benchmarks (43-47%)",
        expectationBasis: "Prior year audited financial statements and ICAP sector report for Technology companies Q4 2024",
        actualValue: 46.8,
        expectedValue: 45.2,
        variance: 1.6,
        variancePercentage: 3.5,
        varianceStatus: "WITHIN_THRESHOLD" as const,
        investigationRequired: false,
        corroboratingEvidence: "Increase consistent with new high-margin SaaS contracts signed in Q3/Q4 2024. Verified against contract listing.",
        performedById: senior.id,
        performedDate: new Date("2025-02-15"),
        reviewedById: manager.id,
        reviewedDate: new Date("2025-02-20"),
      },
      {
        engagementId: eng1.id,
        procedureReference: "AP-002",
        analyticalType: "TREND_ANALYSIS" as const,
        fsArea: "OPERATING_EXPENSES" as const,
        description: "Month-on-month operating expense trend analysis for consistency and unusual fluctuations",
        expectation: "Monthly operating expenses expected to fluctuate within 10% of monthly average (approx. PKR 18M/month based on PKR 216M annual)",
        expectationBasis: "Prior year expense pattern showing seasonal stability with Q4 typically 5-8% higher due to year-end bonuses",
        actualValue: 225000000,
        expectedValue: 216000000,
        variance: 9000000,
        variancePercentage: 4.2,
        varianceStatus: "INVESTIGATED" as const,
        investigationRequired: true,
        investigationNarrative: "Increase driven by one-time recruitment costs (PKR 4.5M) for new development team and increased cloud hosting costs (PKR 3.2M) aligned with business expansion. Both items verified to supporting documentation.",
        corroboratingEvidence: "Recruitment invoices and AWS billing statements reviewed. Increase reasonable given 15% headcount growth.",
        managementExplanation: "Operating expenses increased due to strategic investment in team expansion and cloud infrastructure to support new SaaS products.",
        performedById: senior.id,
        performedDate: new Date("2025-02-15"),
        reviewedById: manager.id,
        reviewedDate: new Date("2025-02-20"),
      },
      {
        engagementId: eng1.id,
        procedureReference: "AP-003",
        analyticalType: "REASONABLENESS_TEST" as const,
        fsArea: "RECEIVABLES" as const,
        description: "Days sales outstanding analysis and aging comparison to prior year",
        expectation: "DSO expected to be between 35-50 days based on prior year (42 days) and payment terms (30-45 days net)",
        expectationBasis: "Standard payment terms in client contracts and prior year DSO calculation",
        actualValue: 48,
        expectedValue: 42,
        variance: 6,
        variancePercentage: 14.3,
        varianceStatus: "EXPLAINED" as const,
        investigationRequired: true,
        investigationNarrative: "DSO increase attributable to two large government contracts with extended 60-day payment terms totaling PKR 35M. Excluding these, DSO is 41 days, consistent with prior year.",
        corroboratingEvidence: "Government contract terms verified. Subsequent receipt of PKR 28M confirmed in January 2025 bank statements.",
        managementExplanation: "Government contracts have longer payment cycles. All amounts are collectible and no impairment is required.",
        performedById: senior.id,
        performedDate: new Date("2025-02-18"),
        reviewedById: manager.id,
        reviewedDate: new Date("2025-02-22"),
      },
      {
        engagementId: eng1.id,
        procedureReference: "AP-004",
        analyticalType: "VARIANCE_ANALYSIS" as const,
        fsArea: "FIXED_ASSETS" as const,
        description: "Depreciation expense reasonableness test against asset base",
        expectation: "Depreciation expense expected to be approximately PKR 32-38M based on net book value and useful life policies",
        expectationBasis: "Weighted average depreciation rate of 18-22% applied to average carrying amount of PPE",
        actualValue: 35200000,
        expectedValue: 34800000,
        variance: 400000,
        variancePercentage: 1.1,
        varianceStatus: "WITHIN_THRESHOLD" as const,
        investigationRequired: false,
        corroboratingEvidence: "Depreciation recalculated on a sample basis and confirmed to be within acceptable range.",
        performedById: staff.id,
        performedDate: new Date("2025-02-20"),
        reviewedById: senior.id,
        reviewedDate: new Date("2025-02-22"),
      },
    ],
  });
  }

  console.log("  Seeding audit plan...");
  await prisma.auditPlan.create({
    data: {
      engagementId: eng1.id,
      versionNumber: 1,
      status: "APPROVED" as const,
      auditApproach: "CONTROLS_AND_SUBSTANTIVE" as const,
      auditTiming: "FINAL" as const,
      scopeDescription: "Full scope statutory audit of complete financial statements of Meridian Technologies (Pvt.) Limited for the year ended 31 December 2024, prepared in accordance with IFRS as adopted in Pakistan.",
      relianceOnControls: true,
      relianceOnInternalAudit: true,
      relianceOnExperts: false,
      relianceOnIT: true,
      relianceDetails: {
        controls: "Reliance on revenue cycle and purchase cycle controls where design and implementation assessed as effective",
        internalAudit: "Internal audit reports reviewed for IT general controls and physical inventory count procedures",
        it: "IT general controls assessed for SAP Business One including access controls, change management, and backup procedures",
      },
      finalStartDate: new Date("2025-01-15"),
      finalEndDate: new Date("2025-03-15"),
      reportDeadline: new Date("2025-03-31"),
      preparedById: manager.id,
      preparedAt: new Date("2025-01-12"),
      reviewedById: partner.id,
      reviewedAt: new Date("2025-01-14"),
      approvedById: partner.id,
      approvedAt: new Date("2025-01-14"),
    },
  });

  console.log("  Seeding journal entry testing...");
  await prisma.journalEntryTest.create({
    data: {
      engagementId: eng1.id,
      workpaperRef: "WP-JET-001",
      testingPeriod: "January 2024 - December 2024",
      populationSource: "SAP Business One General Ledger - All manual journal entries and system-generated entries meeting risk criteria",
      populationSize: 4850,
      populationValueTotal: 2450000000,
      selectionCriteria: {
        criteria: [
          "Entries posted by senior management",
          "Entries posted on weekends or after business hours",
          "Entries with round amounts > PKR 1,000,000",
          "Entries with unusual account combinations",
          "Year-end and month-end entries",
          "Entries with no supporting description",
        ],
      },
      samplingMethod: "risk_based_selection",
      sampleSize: 45,
      riskFactorsConsidered: [
        "Management override of controls (ISA 240)",
        "Revenue recognition fraud risk",
        "Manual adjustments to automated processes",
        "Period-end close entries",
      ],
      fraudIndicatorsUsed: [
        "Entries to unusual accounts",
        "Round amount journal entries",
        "Off-hours posting",
        "Entries without adequate description",
        "Entries reversing prior period adjustments",
      ],
      status: "REVIEWED" as const,
      conclusion: "Based on testing of 45 selected journal entries, no indicators of management override or fraudulent financial reporting were identified. All entries tested were supported by adequate documentation and had legitimate business purposes. Two entries required additional explanation from management which was satisfactorily provided.",
      exceptionsIdentified: 0,
      performedById: senior.id,
      performedAt: new Date("2025-02-25"),
      reviewedById: manager.id,
      reviewedAt: new Date("2025-03-01"),
    },
  });

  console.log("  Seeding audit adjustments...");
  await prisma.auditAdjustment.createMany({
    data: [
      {
        engagementId: eng1.id,
        adjustmentRef: "AJ-001",
        adjustmentType: "CORRECTED" as const,
        status: "AGREED_POSTED" as const,
        fsArea: "REVENUE",
        accountCode: "40001",
        accountName: "Product Revenue",
        description: "Revenue cut-off adjustment: PKR 3.2M revenue recognized in December 2024 relates to software delivered in January 2025. Contract terms specify delivery-based recognition.",
        auditImpact: "Overstated revenue by PKR 3,200,000 and understated deferred revenue by the same amount.",
        debitAmount: 3200000,
        creditAmount: 3200000,
        netImpact: 3200000,
        isMaterial: false,
        materialityImpact: "Below performance materiality of PKR 7.17M. Individually immaterial but corrected by management.",
        identifiedById: senior.id,
        identifiedAt: new Date("2025-02-28"),
        reviewedById: manager.id,
        reviewedAt: new Date("2025-03-02"),
      },
      {
        engagementId: eng1.id,
        adjustmentRef: "AJ-002",
        adjustmentType: "CORRECTED" as const,
        status: "AGREED_POSTED" as const,
        fsArea: "FIXED_ASSETS",
        accountCode: "13001",
        accountName: "Computer Equipment",
        description: "Reclassification of PKR 1.8M expense to fixed assets: cloud server hardware purchased in Q3 2024 expensed as IT expense but meets capitalization criteria (useful life > 1 year, cost > PKR 500K).",
        auditImpact: "Understated PPE by PKR 1,800,000 and overstated operating expenses by PKR 1,800,000 (net of depreciation adjustment of PKR 300,000).",
        debitAmount: 1800000,
        creditAmount: 1800000,
        netImpact: 1500000,
        isMaterial: false,
        materialityImpact: "Below performance materiality. Corrected by management per ISA 450.",
        identifiedById: staff.id,
        identifiedAt: new Date("2025-02-20"),
        reviewedById: senior.id,
        reviewedAt: new Date("2025-02-22"),
      },
      {
        engagementId: eng1.id,
        adjustmentRef: "AJ-003",
        adjustmentType: "UNCORRECTED" as const,
        status: "AGREED_NOT_POSTED" as const,
        fsArea: "RECEIVABLES",
        accountCode: "11001",
        accountName: "Trade Receivables - Local",
        description: "Additional ECL provision of PKR 850,000 for receivables aged 90-120 days based on historical loss rates. Management's ECL model uses a lower loss rate for this aging bucket.",
        auditImpact: "Trade receivables potentially overstated by PKR 850,000. Provision for expected credit losses potentially understated by the same amount.",
        debitAmount: 850000,
        creditAmount: 850000,
        netImpact: 850000,
        isMaterial: false,
        materialityImpact: "Well below performance materiality. Individually and in aggregate with other uncorrected misstatements (PKR 850K total uncorrected) below materiality threshold.",
        identifiedById: senior.id,
        identifiedAt: new Date("2025-03-01"),
        reviewedById: manager.id,
        reviewedAt: new Date("2025-03-03"),
      },
    ],
  });

  console.log("  Seeding external confirmations...");
  await prisma.externalConfirmation.createMany({
    data: [
      {
        engagementId: eng1.id,
        confirmationReference: "EC-BANK-001",
        confirmationType: "POSITIVE" as const,
        status: "CONFIRMED" as const,
        fsArea: "CASH_AND_BANK" as const,
        accountName: "HBL Current Account",
        assertion: "EXISTENCE",
        thirdPartyName: "Habib Bank Limited",
        thirdPartyAddress: "Main Branch, Blue Area, Islamabad",
        thirdPartyContact: "Branch Manager - Confirmations Dept",
        requestDate: new Date("2025-01-20"),
        sentDate: new Date("2025-01-22"),
        responseReceivedDate: new Date("2025-02-05"),
        responseDeadline: new Date("2025-02-20"),
        requestedAmount: 45200000,
        confirmedAmount: 45200000,
        difference: 0,
        differenceResolved: true,
        preparedById: staff.id,
        reviewedById: senior.id,
        reviewedDate: new Date("2025-02-07"),
      },
      {
        engagementId: eng1.id,
        confirmationReference: "EC-BANK-002",
        confirmationType: "POSITIVE" as const,
        status: "CONFIRMED" as const,
        fsArea: "CASH_AND_BANK" as const,
        accountName: "MCB Savings Account",
        assertion: "EXISTENCE",
        thirdPartyName: "MCB Bank Limited",
        thirdPartyAddress: "Corporate Branch, F-6, Islamabad",
        thirdPartyContact: "Confirmations Department",
        requestDate: new Date("2025-01-20"),
        sentDate: new Date("2025-01-22"),
        responseReceivedDate: new Date("2025-02-08"),
        responseDeadline: new Date("2025-02-20"),
        requestedAmount: 78500000,
        confirmedAmount: 78500000,
        difference: 0,
        differenceResolved: true,
        preparedById: staff.id,
        reviewedById: senior.id,
        reviewedDate: new Date("2025-02-10"),
      },
      {
        engagementId: eng1.id,
        confirmationReference: "EC-AR-001",
        confirmationType: "POSITIVE" as const,
        status: "CONFIRMED" as const,
        fsArea: "RECEIVABLES" as const,
        accountName: "Trade Receivables - TechCorp International",
        assertion: "EXISTENCE",
        thirdPartyName: "TechCorp International LLC",
        thirdPartyAddress: "Dubai Internet City, Building 5, Dubai, UAE",
        thirdPartyEmail: "accounts@techcorp.ae",
        thirdPartyContact: "Finance Manager",
        requestDate: new Date("2025-01-25"),
        sentDate: new Date("2025-01-27"),
        responseReceivedDate: new Date("2025-02-15"),
        responseDeadline: new Date("2025-02-25"),
        requestedAmount: 12500000,
        confirmedAmount: 12200000,
        difference: 300000,
        differenceResolved: true,
        differenceExplanation: "Difference of PKR 300,000 relates to payment in transit at year end. Confirmed by reviewing January 2025 bank statement showing receipt on 3 January 2025.",
        preparedById: staff.id,
        reviewedById: senior.id,
        reviewedDate: new Date("2025-02-18"),
      },
      {
        engagementId: eng1.id,
        confirmationReference: "EC-AP-001",
        confirmationType: "POSITIVE" as const,
        status: "CONFIRMED" as const,
        fsArea: "PAYABLES" as const,
        accountName: "Trade Payables - AWS Pakistan",
        assertion: "COMPLETENESS",
        thirdPartyName: "Amazon Web Services Pakistan (Pvt.) Ltd",
        thirdPartyAddress: "Plot 49, Jinnah Avenue, Blue Area, Islamabad",
        thirdPartyEmail: "ar-confirmations@aws.pk",
        thirdPartyContact: "Accounts Receivable Team",
        requestDate: new Date("2025-01-25"),
        sentDate: new Date("2025-01-28"),
        responseReceivedDate: new Date("2025-02-12"),
        responseDeadline: new Date("2025-02-25"),
        requestedAmount: 8750000,
        confirmedAmount: 8750000,
        difference: 0,
        differenceResolved: true,
        preparedById: staff.id,
        reviewedById: senior.id,
        reviewedDate: new Date("2025-02-14"),
      },
      {
        engagementId: eng1.id,
        confirmationReference: "EC-LEGAL-001",
        confirmationType: "POSITIVE" as const,
        status: "RECEIVED" as const,
        fsArea: "CONTINGENCIES" as const,
        accountName: "Legal Matters and Contingencies",
        assertion: "COMPLETENESS",
        thirdPartyName: "Hashmi & Associates (Legal Counsel)",
        thirdPartyAddress: "Suite 401, Islamabad Stock Exchange Tower, Islamabad",
        thirdPartyContact: "Senior Partner - Adv. Rashid Hashmi",
        requestDate: new Date("2025-01-25"),
        sentDate: new Date("2025-01-28"),
        responseReceivedDate: new Date("2025-02-20"),
        responseDeadline: new Date("2025-02-28"),
        requestedAmount: 0,
        confirmedAmount: 0,
        preparedById: staff.id,
        reviewedById: manager.id,
        reviewedDate: new Date("2025-02-22"),
      },
    ],
  });

  console.log("  Seeding audit file assembly...");
  await prisma.auditFileAssembly.create({
    data: {
      engagementId: eng1.id,
      assemblyStatus: "in_progress",
      assemblyStartDate: new Date("2025-03-10"),
      assemblyDeadline: new Date("2025-05-31"),
      totalFiles: 85,
      indexedFiles: 72,
      reviewedFiles: 60,
      preparedById: senior.id,
      reviewedById: manager.id,
    },
  });

  console.log("  Seeding additional section sign-offs...");
  const signoffPhases = [
    { phase: "PRE_PLANNING", section: "engagement_setup", status: "APPROVED" },
    { phase: "PRE_PLANNING", section: "risk_assessment_initial", status: "APPROVED" },
    { phase: "PRE_PLANNING", section: "independence_ethics", status: "APPROVED" },
    { phase: "PRE_PLANNING", section: "engagement_letter", status: "APPROVED" },
    { phase: "PLANNING", section: "materiality_assessment", status: "APPROVED" },
    { phase: "PLANNING", section: "risk_assessment_detailed", status: "APPROVED" },
    { phase: "PLANNING", section: "audit_strategy", status: "REVIEWED" },
    { phase: "PLANNING", section: "entity_understanding", status: "REVIEWED" },
    { phase: "EXECUTION", section: "substantive_testing", status: "PREPARED" },
    { phase: "EXECUTION", section: "controls_testing", status: "PREPARED" },
    { phase: "EXECUTION", section: "analytical_procedures", status: "REVIEWED" },
    { phase: "FINALIZATION", section: "subsequent_events", status: "PREPARED" },
    { phase: "FINALIZATION", section: "going_concern_final", status: "PREPARED" },
    { phase: "FINALIZATION", section: "management_representations", status: "PREPARED" },
    { phase: "REPORTING", section: "audit_report_draft", status: "PREPARED" },
    { phase: "REPORTING", section: "management_letter_draft", status: "PREPARED" },
  ];

  for (const sp of signoffPhases) {
    const existing = await prisma.sectionSignOff.findFirst({
      where: { engagementId: eng1.id, phase: sp.phase, section: sp.section },
    });
    if (existing) continue;

    const isApproved = sp.status === "APPROVED";
    const isReviewed = sp.status === "REVIEWED" || isApproved;
    const isPrepared = sp.status === "PREPARED" || isReviewed;

    await prisma.sectionSignOff.create({
      data: {
        engagementId: eng1.id,
        phase: sp.phase,
        section: sp.section,
        preparedById: isPrepared ? senior.id : manager.id,
        preparedDate: isPrepared ? new Date("2025-02-15") : new Date("2025-02-15"),
        reviewedById: isReviewed ? manager.id : null,
        reviewedDate: isReviewed ? new Date("2025-02-20") : null,
        partnerApprovedById: isApproved ? partner.id : null,
        partnerApprovalDate: isApproved ? new Date("2025-02-25") : null,
        isComplete: isApproved,
      },
    });
  }

  console.log("  All-phase data seeded successfully!");
}

async function seedSecondClient() {
  console.log("Checking second client (Al-Baraka Textiles)...");

  const existingEng = await prisma.engagement.findFirst({
    where: { engagementCode: "ENG-2026-003" },
  });
  if (existingEng) {
    console.log("  Second client engagement already exists, skipping...");
    return;
  }

  const firm = await prisma.firm.findFirst();
  if (!firm) { console.log("  No firm found, skipping second client."); return; }

  const users = await prisma.user.findMany({ where: { firmId: firm.id } });
  const getUser = (email: string) => users.find((u) => u.email === email);

  const partner = getUser("partner@auditwise.pk");
  const manager = getUser("manager@auditwise.pk");
  const teamlead = getUser("teamlead@auditwise.pk");
  const senior = getUser("senior@auditwise.pk");
  const staff = getUser("staff@auditwise.pk");
  const eqcrUser = getUser("eqcr@auditwise.pk");
  if (!partner || !manager || !teamlead || !senior || !staff || !eqcrUser) {
    console.log("  Required users not found, skipping second client.");
    return;
  }

  console.log("  Creating second client: Al-Baraka Textiles...");
  const client2 = await prisma.client.create({
    data: {
      firmId: firm.id,
      name: "Al-Baraka Textiles (Pvt.) Limited",
      tradingName: "Al-Baraka Textiles",
      industry: "Manufacturing / Textile & Apparel",
      entityType: "PVT_LTD",
      address: "Plot 18-B, SITE Industrial Area, Korangi Creek",
      city: "Karachi",
      country: "Pakistan",
      phone: "+92-21-3508-7777",
      email: "info@albarakatextiles.pk",
      website: "https://www.albarakatextiles.pk",
      dateOfIncorporation: new Date("2008-03-22"),
      estimatedTurnover: 1250000000,
      estimatedAssets: 2800000000,
      employeeCount: 1800,
      reportingCurrency: "PKR",
      ceoName: "Muhammad Tariq Hussain",
      ceoContact: "+92-300-8234567",
      cfoName: "Amina Bibi Shah",
      cfoContact: "+92-321-4567890",
      ownershipStructure: "Family-owned private company, Hussain family (70%), institutional investors (30%)",
      erpSystemUsed: "Oracle NetSuite",
      cloudBasedAccounting: false,
      auditCommittee: true,
      internalAuditFunction: true,
      governanceStructure: "Board of 7 Directors including 3 independent directors. Audit Committee chaired by independent director.",
      riskCategory: "NORMAL",
      acceptanceStatus: "APPROVED",
      acceptanceDate: new Date("2025-10-01"),
      acceptanceApprovedById: partner.id,
      isActive: true,
      isDemo: true,
    },
  });

  console.log("  Creating engagement ENG-2026-003 under Al-Baraka Textiles...");
  const eng3 = await prisma.engagement.create({
    data: {
      firmId: firm.id,
      clientId: client2.id,
      engagementCode: "ENG-2026-003",
      engagementType: "statutory_audit",
      reportingFramework: "IFRS",
      currentPhase: "PRE_PLANNING",
      status: "ACTIVE",
      riskRating: "HIGH",
      periodStart: new Date("2025-07-01"),
      periodEnd: new Date("2026-06-30"),
      fiscalYearEnd: new Date("2026-06-30"),
      reportDeadline: new Date("2026-09-30"),
      fieldworkStartDate: new Date("2026-07-15"),
      fieldworkEndDate: new Date("2026-09-15"),
      budgetHours: 3200,
      engagementPartnerId: partner.id,
      engagementManagerId: manager.id,
      teamLeadId: teamlead.id,
      preconditionsMet: true,
      managementAcknowledges: true,
      termsAgreed: true,
      engagementLetterGenerated: true,
      engagementLetterSigned: false,
      independenceCleared: true,
      resourceCapabilityConfirmed: true,
      acceptanceDecision: "ACCEPTED",
      eqcrRequired: true,
      eqcrRationale: "High risk engagement — manufacturing sector with significant inventory, export revenue, and forex exposure",
      isDemo: true,
      startedAt: new Date("2025-10-15"),
      lastActivityAt: new Date("2026-01-20"),
    },
  });

  const phases: Array<"ONBOARDING" | "PRE_PLANNING" | "REQUISITION" | "PLANNING" | "EXECUTION" | "FINALIZATION" | "REPORTING" | "EQCR" | "INSPECTION"> = [
    "ONBOARDING", "PRE_PLANNING", "REQUISITION", "PLANNING", "EXECUTION",
    "FINALIZATION", "REPORTING", "EQCR", "INSPECTION",
  ];
  const eng3PhaseStatuses: Record<string, { status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; pct: number }> = {
    ONBOARDING: { status: "COMPLETED", pct: 100 },
    PRE_PLANNING: { status: "IN_PROGRESS", pct: 55 },
    REQUISITION: { status: "NOT_STARTED", pct: 0 },
    PLANNING: { status: "NOT_STARTED", pct: 0 },
    EXECUTION: { status: "NOT_STARTED", pct: 0 },
    FINALIZATION: { status: "NOT_STARTED", pct: 0 },
    REPORTING: { status: "NOT_STARTED", pct: 0 },
    EQCR: { status: "NOT_STARTED", pct: 0 },
    INSPECTION: { status: "NOT_STARTED", pct: 0 },
  };

  await prisma.phaseProgress.createMany({
    data: phases.map((phase) => {
      const s = eng3PhaseStatuses[phase];
      return {
        engagementId: eng3.id,
        phase,
        status: s.status,
        completionPercentage: s.pct,
        startedAt: s.status !== "NOT_STARTED" ? new Date("2025-10-15") : undefined,
        completedAt: s.status === "COMPLETED" ? new Date("2025-11-30") : undefined,
      };
    }),
  });

  const teamMembers = [
    { userId: partner.id, role: "Engagement Partner", isLead: true, hoursAllocated: 300 },
    { userId: manager.id, role: "Engagement Manager", isLead: false, hoursAllocated: 600 },
    { userId: teamlead.id, role: "Team Lead", isLead: false, hoursAllocated: 700 },
    { userId: senior.id, role: "Senior Auditor", isLead: false, hoursAllocated: 900 },
    { userId: staff.id, role: "Staff Auditor", isLead: false, hoursAllocated: 700 },
  ];
  await prisma.engagementTeam.createMany({
    data: teamMembers.map((m) => ({
      engagementId: eng3.id,
      userId: m.userId,
      role: m.role,
      isLead: m.isLead,
      hoursAllocated: m.hoursAllocated,
    })),
  });

  const gateTypes: Array<"CLIENT_ACCEPTANCE" | "CLIENT_CONTINUANCE" | "INDEPENDENCE_CONFIRMATION" | "ETHICS_COMPLIANCE" | "ENGAGEMENT_LETTER"> = [
    "CLIENT_ACCEPTANCE", "CLIENT_CONTINUANCE", "INDEPENDENCE_CONFIRMATION",
    "ETHICS_COMPLIANCE", "ENGAGEMENT_LETTER",
  ];
  const gateDescriptions: Record<string, string> = {
    CLIENT_ACCEPTANCE: "Client acceptance procedures per ISQM 1",
    CLIENT_CONTINUANCE: "Annual client continuance assessment",
    INDEPENDENCE_CONFIRMATION: "Independence confirmation per IESBA Code",
    ETHICS_COMPLIANCE: "Ethics and professional standards compliance",
    ENGAGEMENT_LETTER: "Engagement letter preparation and signing",
  };
  await prisma.prePlanningGate.createMany({
    data: gateTypes.map((gateType) => ({
      engagementId: eng3.id,
      gateType,
      status: gateType === "CLIENT_ACCEPTANCE" || gateType === "INDEPENDENCE_CONFIRMATION" ? "COMPLETED" as const : "IN_PROGRESS" as const,
      isRequired: true,
      isBlocking: true,
      description: gateDescriptions[gateType],
      completionPercentage: gateType === "CLIENT_ACCEPTANCE" || gateType === "INDEPENDENCE_CONFIRMATION" ? 100 : 40,
      completedAt: gateType === "CLIENT_ACCEPTANCE" || gateType === "INDEPENDENCE_CONFIRMATION" ? new Date("2025-10-20") : undefined,
      completedById: gateType === "CLIENT_ACCEPTANCE" || gateType === "INDEPENDENCE_CONFIRMATION" ? senior.id : undefined,
    })),
  });

  await prisma.acceptanceContinuanceDecision.create({
    data: {
      engagementId: eng3.id,
      firmId: firm.id,
      isNewClient: true,
      isReengagement: false,
      clientIntegrityRating: "SATISFACTORY",
      clientIntegrityNotes: "Well-established family business with strong market reputation. Management responsive to audit requirements.",
      managementIntegrityRating: "SATISFACTORY",
      engagementRiskLevel: "HIGH",
      engagementRiskFactors: [
        { factor: "Significant inventory requiring physical count observation", impact: "HIGH" },
        { factor: "Export revenue with multiple currencies", impact: "HIGH" },
        { factor: "Related party transactions with family-owned entities", impact: "MEDIUM" },
        { factor: "Complex manufacturing cost allocation", impact: "MEDIUM" },
      ],
      competenceConfirmed: true,
      competenceNotes: "Team has manufacturing sector experience. Will engage inventory specialist for count observation.",
      resourcesAvailable: true,
      independenceCleared: true,
      independenceClearanceDate: new Date("2025-10-05"),
      ethicalRequirementsMet: true,
      decision: "ACCEPTED",
      decisionRationale: "Client meets acceptance criteria despite HIGH risk rating. Adequate resources allocated including specialist support.",
      decisionDate: new Date("2025-10-01"),
      decisionById: partner.id,
      partnerApprovedAt: new Date("2025-10-02"),
      partnerApprovedById: partner.id,
    },
  });

  const irHeads: Array<"CORPORATE_DOCUMENTS" | "FINANCIAL_STATEMENTS" | "BANK_INFORMATION" | "FIXED_ASSETS" | "INVENTORY" | "TAXATION"> = [
    "CORPORATE_DOCUMENTS", "FINANCIAL_STATEMENTS", "BANK_INFORMATION",
    "FIXED_ASSETS", "INVENTORY", "TAXATION",
  ];
  const irTitles = [
    "Corporate Registration & Board Resolutions",
    "Annual Financial Statements & Trial Balance",
    "Bank Statements & Reconciliations",
    "Fixed Asset Register & Depreciation Schedule",
    "Inventory Listing & Valuation Report",
    "Tax Returns & Compliance Documents",
  ];
  const irDescriptions = [
    "Memorandum & Articles, Board/AGM minutes, shareholder register, SECP filings",
    "Complete set of financial statements, trial balance, general ledger for FY2025-26",
    "Bank statements for all accounts, bank reconciliation statements, LC documentation",
    "Complete fixed asset register including plant & machinery, additions, disposals, depreciation",
    "Raw material, WIP, and finished goods inventory listing, valuation reports, NRV assessments",
    "Income tax returns, sales tax returns, customs duty documentation, SRO exemptions",
  ];
  const priorities: Array<"LOW" | "MEDIUM" | "HIGH"> = ["HIGH", "HIGH", "HIGH", "MEDIUM", "HIGH", "MEDIUM"];

  await prisma.informationRequest.createMany({
    data: irHeads.map((head, i) => ({
      firmId: firm.id,
      engagementId: eng3.id,
      clientId: client2.id,
      requestCode: `IR-ENG3-00${i + 1}`,
      srNumber: i + 1,
      requestTitle: irTitles[i],
      headOfAccounts: head,
      description: irDescriptions[i],
      status: i < 2 ? "SUBMITTED" as const : "PENDING" as const,
      priority: priorities[i],
      dueDate: new Date("2026-07-15"),
      isDemo: true,
      createdById: manager.id,
    })),
  });

  await prisma.materialityAssessment.create({
    data: {
      engagementId: eng3.id,
      benchmark: "REVENUE",
      benchmarkAmount: 1250000000,
      benchmarkPercentage: 1.0,
      overallMateriality: 12500000,
      performanceMateriality: 9375000,
      performanceMatPercentage: 75,
      amptThreshold: 625000,
      amptPercentage: 5,
      justification: "Revenue selected as benchmark for this manufacturing entity. Lower 1% percentage applied due to HIGH risk rating and first-year audit engagement per ISA 320. Multiple risk factors (inventory valuation, forex exposure, related parties) warrant conservative materiality.",
      approvedById: partner.id,
      approvedDate: new Date("2026-01-15"),
    },
  });

  const riskTemplates = [
    {
      accountOrClass: "Revenue — Export Sales & Local Sales",
      fsArea: "REVENUE" as const,
      auditCycle: "REVENUE_CYCLE" as const,
      assertion: "OCCURRENCE" as const,
      assertionImpacts: ["OCCURRENCE" as const, "COMPLETENESS" as const, "CUTOFF" as const],
      inherentRisk: "HIGH" as const,
      controlRisk: "MODERATE" as const,
      riskOfMaterialMisstatement: "HIGH" as const,
      isSignificantRisk: true,
      significantRiskReason: "Export revenue recognition involves complex LC terms, shipping documentation, and multiple currency conversions",
      riskDescription: "Risk that export revenue may be misstated due to cutoff errors at shipment vs LC negotiation date, or incorrect forex conversion rates",
      plannedResponse: "Test LC documentation, shipping records, cutoff testing at period-end, independent forex rate verification",
    },
    {
      accountOrClass: "Inventories — Raw Materials, WIP, Finished Goods",
      fsArea: "INVENTORIES" as const,
      auditCycle: "INVENTORY_CYCLE" as const,
      assertion: "EXISTENCE" as const,
      assertionImpacts: ["EXISTENCE" as const, "VALUATION" as const, "COMPLETENESS" as const],
      inherentRisk: "HIGH" as const,
      controlRisk: "HIGH" as const,
      riskOfMaterialMisstatement: "HIGH" as const,
      isSignificantRisk: true,
      significantRiskReason: "Large multi-location inventory with complex manufacturing cost allocation and significant WIP valuation judgment",
      riskDescription: "Risk that inventory may be overstated due to incorrect cost allocation, obsolescence not identified, or NRV below cost for finished goods",
      plannedResponse: "Physical count observation at all locations, cost recalculation, NRV testing, obsolescence analysis, WIP completion percentage verification",
    },
    {
      accountOrClass: "Property, Plant & Equipment — Manufacturing Plant",
      fsArea: "FIXED_ASSETS" as const,
      auditCycle: "FIXED_ASSETS_CYCLE" as const,
      assertion: "VALUATION" as const,
      assertionImpacts: ["VALUATION" as const, "EXISTENCE" as const],
      inherentRisk: "MODERATE" as const,
      controlRisk: "LOW" as const,
      riskOfMaterialMisstatement: "MODERATE" as const,
      isSignificantRisk: false,
      riskDescription: "Risk that plant & machinery may not be correctly valued, including useful life estimates and impairment indicators",
      plannedResponse: "Depreciation recalculation, physical verification of major additions, review of useful life estimates and impairment indicators",
    },
    {
      accountOrClass: "Trade Payables & Accrued Expenses",
      fsArea: "PAYABLES" as const,
      auditCycle: "PURCHASE_CYCLE" as const,
      assertion: "COMPLETENESS" as const,
      assertionImpacts: ["COMPLETENESS" as const, "VALUATION" as const, "CUTOFF" as const],
      inherentRisk: "MODERATE" as const,
      controlRisk: "MODERATE" as const,
      riskOfMaterialMisstatement: "MODERATE" as const,
      isSignificantRisk: false,
      riskDescription: "Risk that trade payables may be understated, particularly around period-end with goods received but invoices not yet recorded",
      plannedResponse: "Supplier statement reconciliations, subsequent payment testing, unrecorded liabilities search, cutoff testing",
    },
  ];

  for (const rt of riskTemplates) {
    await prisma.riskAssessment.create({
      data: {
        engagementId: eng3.id,
        ...rt,
        assessedById: senior.id,
        assessedDate: new Date("2026-01-10"),
      },
    });
  }

  await prisma.goingConcernAssessment.create({
    data: {
      engagementId: eng3.id,
      managementAssessmentPeriod: 12,
      currentRatio: 1.3,
      quickRatio: 0.7,
      debtEquityRatio: 1.2,
      interestCoverage: 3.5,
      netProfitLossTrend: "Profitable but margins under pressure due to raw material cost increases and energy costs",
      cashFlowTrend: "Positive operating cash flows but significant capex for plant modernization",
      workingCapitalDeficit: false,
      defaultOnLoans: false,
      adverseKeyRatios: false,
      lossOfKeyCustomer: false,
      lossOfKeySupplier: false,
      laborDifficulties: true,
      legalProceedings: false,
      regulatoryNonCompliance: false,
      managementPlans: "Plant modernization program, expansion of value-added product lines, cost optimization through vertical integration",
      managementPlansFeasibility: "Plans supported by committed bank financing and strong order book from European buyers",
      preparedById: senior.id,
      preparedDate: new Date("2026-01-18"),
    },
  });

  await prisma.entityUnderstanding.create({
    data: {
      engagementId: eng3.id,
      entityName: "Al-Baraka Textiles (Pvt.) Limited",
      legalStructure: "Private Limited Company incorporated under the Companies Act, 2017",
      ownershipStructure: "Hussain family (70%), institutional investors (30%)",
      managementStructure: "CEO-led with COO, CFO, VP Manufacturing, VP Exports reporting to CEO",
      governanceStructure: "Board of 7 Directors including 3 independent. Audit Committee chaired by independent director. Risk Committee established.",
      natureOfBusiness: "Vertically integrated textile manufacturing — spinning, weaving, dyeing, finishing, and garment manufacturing",
      principalActivities: "Manufacturing and export of cotton yarn, denim fabric, home textiles, and ready-made garments. Major markets: EU, USA, Middle East.",
      revenueStreams: [
        { stream: "Denim Fabric Exports", percentage: 35, type: "LC-based" },
        { stream: "Home Textiles", percentage: 25, type: "Contract manufacturing" },
        { stream: "Ready-Made Garments", percentage: 20, type: "Brand partnerships" },
        { stream: "Cotton Yarn (Local Sales)", percentage: 15, type: "Spot and contract" },
        { stream: "Waste & By-products", percentage: 5, type: "Spot sales" },
      ],
      keyProducts: [
        { name: "Premium Denim", description: "High-quality denim fabric for international fashion brands" },
        { name: "Home Textiles", description: "Bed linen, towels, and kitchen textiles for European retailers" },
        { name: "Cotton Yarn", description: "Ring-spun and open-end yarn for domestic weavers" },
      ],
      keyMarkets: "European Union (45%), USA (25%), Middle East (15%), Pakistan domestic (15%)",
      competitivePosition: "Among top 25 textile exporters in Pakistan with strong relationships with European retail chains",
      regulatoryEnvironment: "Subject to SECP regulations, SBP export financing rules, Customs & SRO framework, EOBI/WWF/SESSI labor regulations",
      applicableLaws: [
        { law: "Companies Act, 2017", relevance: "Corporate governance and financial reporting" },
        { law: "Income Tax Ordinance, 2001", relevance: "Tax compliance including export tax benefits" },
        { law: "Customs Act, 1969", relevance: "Import of raw materials under various SROs" },
        { law: "DLTL/FBTL Schemes", relevance: "Export incentive and drawback claims" },
      ],
      itEnvironment: "Oracle NetSuite for ERP, separate production planning system, Excel-based costing",
      keyITSystems: [
        { system: "Oracle NetSuite", purpose: "Financial accounting and supply chain" },
        { system: "ProTex MES", purpose: "Manufacturing execution and production tracking" },
        { system: "Excel", purpose: "Job costing and variance analysis" },
      ],
      keyPerformanceIndicators: [
        { kpi: "Revenue Growth", value: "8%", benchmark: "Industry avg 5%" },
        { kpi: "Gross Margin", value: "18%", benchmark: "Industry avg 15%" },
        { kpi: "Export Share", value: "85%", benchmark: "Industry avg 70%" },
        { kpi: "Inventory Turnover", value: "4.2x", benchmark: "Industry avg 3.5x" },
      ],
      strategicObjectives: "Plant modernization, increase value-added product share, achieve OEKO-TEX and GOTS certifications, reduce energy costs through solar installation",
      businessRisks: [
        { risk: "Cotton price volatility", impact: "HIGH", likelihood: "HIGH" },
        { risk: "Energy cost fluctuations (gas/electricity)", impact: "HIGH", likelihood: "HIGH" },
        { risk: "Currency risk on USD/EUR denominated export proceeds", impact: "HIGH", likelihood: "MEDIUM" },
        { risk: "Supply chain disruption for imported dyes/chemicals", impact: "MEDIUM", likelihood: "LOW" },
        { risk: "Labour compliance and unionization risks", impact: "MEDIUM", likelihood: "MEDIUM" },
      ],
    },
  });

  await prisma.industryAnalysis.create({
    data: {
      engagementId: eng3.id,
      industryCode: "1710",
      industrySector: "Manufacturing",
      industrySubsector: "Textile Manufacturing and Export",
      marketConditions: "Pakistan textile sector is the largest manufacturing industry, contributing ~8% of GDP and ~60% of total exports. Facing challenges from energy costs, cotton price volatility, and regional competition from Bangladesh and Vietnam.",
      competitiveEnvironment: "Highly competitive with major players (Nishat, Gul Ahmed, Interloop, Sapphire) and numerous SME mills. Key differentiators are product quality, compliance certifications, and buyer relationships.",
      regulatoryFactors: "Subject to SBP export refinancing rules, customs duty and SRO regime, DLTL/FBTL export incentives, SECP compliance, and increasingly stringent environmental regulations.",
      technologicalChanges: "Shift to automated looms, AI-based quality inspection, solar power adoption, water recycling systems, and ERP integration for real-time production monitoring.",
      economicFactors: "PKR depreciation benefits exporters but increases raw material import costs. Energy tariff subsidies for exporters partially offset high energy costs. Gas curtailment remains a seasonal risk.",
      industryRisks: [
        { risk: "Cotton price volatility", impact: "HIGH", likelihood: "HIGH" },
        { risk: "Energy supply disruption", impact: "HIGH", likelihood: "MEDIUM" },
        { risk: "International buyer payment delays", impact: "MEDIUM", likelihood: "MEDIUM" },
        { risk: "Environmental compliance costs", impact: "MEDIUM", likelihood: "HIGH" },
      ],
      typicalFraudSchemes: [
        { scheme: "Understated inventory obsolescence/write-downs", frequency: "COMMON" },
        { scheme: "Over-invoicing of raw material purchases from related parties", frequency: "UNCOMMON" },
        { scheme: "Fictitious export invoices for duty drawback claims", frequency: "RARE" },
      ],
      industryBenchmarks: [
        { metric: "Gross margin", benchmark: "15-22%", source: "Listed textile companies" },
        { metric: "Inventory days", benchmark: "75-120 days", source: "Industry average" },
        { metric: "Receivable days", benchmark: "45-90 days", source: "Export LC norms" },
        { metric: "Energy cost ratio", benchmark: "15-25% of COGS", source: "APTMA data" },
      ],
      industryTrends: "Increasing focus on sustainability, vertical integration, value-added exports, and compliance with EU due diligence regulations",
      riskImplications: "Inventory valuation requires careful assessment of NRV, cost allocation accuracy, and obsolescence provisions. Export revenue involves LC and forex complexities.",
      auditImplications: "Physical inventory observation at multiple locations, export documentation testing, forex rate verification, related party transaction scrutiny, and energy cost allocation review.",
    },
  });

  await prisma.relatedParty.createMany({
    data: [
      {
        engagementId: eng3.id,
        partyName: "Hussain Trading Company (Pvt.) Ltd",
        partyType: "Associated Company",
        relationshipType: "Common Ownership",
        natureOfRelationship: "Cotton trading company owned by Hussain family. Supplies raw cotton to Al-Baraka Textiles.",
        ownershipPercentage: 0,
        isControlling: false,
        isKeyManagement: true,
        transactionTypes: [
          { type: "Raw cotton purchases", amount: 180000000 },
          { type: "Advance payments for cotton", amount: 25000000 },
        ],
        transactionValue: 205000000,
        balanceOutstanding: 35000000,
        armLengthAssessment: "Requires detailed transfer pricing analysis — cotton purchased at rates to be compared with Karachi Cotton Association spot rates",
        disclosureRequired: true,
        disclosureAdequate: false,
        riskAssessment: "HIGH risk — significant purchase volume from related party, potential for non-arm's length pricing",
        identifiedById: senior.id,
        identifiedDate: new Date("2026-01-10"),
      },
      {
        engagementId: eng3.id,
        partyName: "Baraka Energy (Pvt.) Ltd",
        partyType: "Associated Company",
        relationshipType: "Common Directorship",
        natureOfRelationship: "Captive power generation company supplying electricity and steam to Al-Baraka Textiles manufacturing units.",
        ownershipPercentage: 60,
        isControlling: true,
        isKeyManagement: true,
        transactionTypes: [
          { type: "Electricity and steam supply", amount: 95000000 },
        ],
        transactionValue: 95000000,
        balanceOutstanding: 12000000,
        armLengthAssessment: "Pricing based on cost-plus model — needs comparison with NEPRA tariffs and market rates",
        disclosureRequired: true,
        disclosureAdequate: false,
        riskAssessment: "MEDIUM risk — captive power arrangement common in textile sector but pricing needs arm's length verification",
        identifiedById: senior.id,
        identifiedDate: new Date("2026-01-10"),
      },
    ],
  });

  console.log("  Second client and ENG-2026-003 seeded successfully!");
}

async function seedAlBarakaFinancialData() {
  const eng3 = await prisma.engagement.findFirst({ where: { engagementCode: "ENG-2026-003" } });
  if (!eng3) { console.log("  ENG-2026-003 not found, skipping financial data."); return; }

  const firm = await prisma.firm.findFirst();
  if (!firm) return;
  const staff = await prisma.user.findFirst({ where: { email: "staff@auditwise.pk" } });
  const senior = await prisma.user.findFirst({ where: { email: "senior@auditwise.pk" } });
  const manager = await prisma.user.findFirst({ where: { email: "manager@auditwise.pk" } });
  const partner = await prisma.user.findFirst({ where: { email: "partner@auditwise.pk" } });
  if (!staff || !senior || !manager || !partner) return;

  const existingTB = await prisma.tBBatch.findFirst({ where: { engagementId: eng3.id } });
  if (!existingTB) {
  console.log("  Seeding Al-Baraka Textiles financial data...");

  const upload = await prisma.uploadVersion.create({
    data: {
      engagementId: eng3.id,
      version: 1,
      fileName: "AlBaraka_Textiles_FY2026_Workbook.xlsx",
      fileHash: "sha256:b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7",
      fileSize: 5242880,
      status: "ACTIVE",
      uploadedById: staff.id,
    },
  });

  const tbEntries = [
    { accountCode: "1101", accountName: "Cash at Bank - HBL", openingDebit: 35000000, openingCredit: 0, closingDebit: 42000000, closingCredit: 0 },
    { accountCode: "1102", accountName: "Cash at Bank - MCB", openingDebit: 22000000, openingCredit: 0, closingDebit: 28000000, closingCredit: 0 },
    { accountCode: "1103", accountName: "Cash at Bank - NBP (LC Account)", openingDebit: 15000000, openingCredit: 0, closingDebit: 18000000, closingCredit: 0 },
    { accountCode: "1201", accountName: "Trade Receivables - Local", openingDebit: 85000000, openingCredit: 0, closingDebit: 95000000, closingCredit: 0 },
    { accountCode: "1202", accountName: "Trade Receivables - Export", openingDebit: 120000000, openingCredit: 0, closingDebit: 145000000, closingCredit: 0 },
    { accountCode: "1203", accountName: "Provision for Doubtful Debts", openingDebit: 0, openingCredit: 5000000, closingDebit: 0, closingCredit: 6500000 },
    { accountCode: "1301", accountName: "Raw Cotton Inventory", openingDebit: 180000000, openingCredit: 0, closingDebit: 210000000, closingCredit: 0 },
    { accountCode: "1302", accountName: "Work-in-Progress - Yarn", openingDebit: 45000000, openingCredit: 0, closingDebit: 52000000, closingCredit: 0 },
    { accountCode: "1303", accountName: "Finished Goods - Fabric", openingDebit: 65000000, openingCredit: 0, closingDebit: 78000000, closingCredit: 0 },
    { accountCode: "1304", accountName: "Stores and Spares", openingDebit: 25000000, openingCredit: 0, closingDebit: 28000000, closingCredit: 0 },
    { accountCode: "1401", accountName: "Advances to Suppliers", openingDebit: 18000000, openingCredit: 0, closingDebit: 22000000, closingCredit: 0 },
    { accountCode: "1402", accountName: "Prepayments & Deposits", openingDebit: 8000000, openingCredit: 0, closingDebit: 9500000, closingCredit: 0 },
    { accountCode: "1501", accountName: "Land & Building", openingDebit: 350000000, openingCredit: 0, closingDebit: 350000000, closingCredit: 0 },
    { accountCode: "1502", accountName: "Plant & Machinery - Spinning", openingDebit: 420000000, openingCredit: 0, closingDebit: 480000000, closingCredit: 0 },
    { accountCode: "1503", accountName: "Plant & Machinery - Weaving", openingDebit: 280000000, openingCredit: 0, closingDebit: 320000000, closingCredit: 0 },
    { accountCode: "1504", accountName: "Vehicles & Transport", openingDebit: 35000000, openingCredit: 0, closingDebit: 38000000, closingCredit: 0 },
    { accountCode: "1505", accountName: "Furniture & Fixtures", openingDebit: 12000000, openingCredit: 0, closingDebit: 14000000, closingCredit: 0 },
    { accountCode: "1506", accountName: "Accumulated Depreciation", openingDebit: 0, openingCredit: 285000000, closingDebit: 0, closingCredit: 345000000 },
    { accountCode: "1601", accountName: "Capital WIP - Dyeing Plant", openingDebit: 75000000, openingCredit: 0, closingDebit: 120000000, closingCredit: 0 },
    { accountCode: "2101", accountName: "Trade Payables - Local Suppliers", openingDebit: 0, openingCredit: 65000000, closingDebit: 0, closingCredit: 78000000 },
    { accountCode: "2102", accountName: "Trade Payables - Import (LCs)", openingDebit: 0, openingCredit: 45000000, closingDebit: 0, closingCredit: 55000000 },
    { accountCode: "2103", accountName: "Accrued Expenses", openingDebit: 0, openingCredit: 22000000, closingDebit: 0, closingCredit: 28000000 },
    { accountCode: "2201", accountName: "Workers Profit Participation Fund", openingDebit: 0, openingCredit: 8000000, closingDebit: 0, closingCredit: 9500000 },
    { accountCode: "2202", accountName: "Workers Welfare Fund", openingDebit: 0, openingCredit: 3500000, closingDebit: 0, closingCredit: 4200000 },
    { accountCode: "2301", accountName: "Current Portion - Long Term Loan", openingDebit: 0, openingCredit: 40000000, closingDebit: 0, closingCredit: 40000000 },
    { accountCode: "2401", accountName: "Tax Payable", openingDebit: 0, openingCredit: 18000000, closingDebit: 0, closingCredit: 22000000 },
    { accountCode: "2501", accountName: "Long Term Loan - HBL", openingDebit: 0, openingCredit: 200000000, closingDebit: 0, closingCredit: 160000000 },
    { accountCode: "2502", accountName: "Long Term Loan - MCB (LTFF)", openingDebit: 0, openingCredit: 150000000, closingDebit: 0, closingCredit: 120000000 },
    { accountCode: "2601", accountName: "Deferred Tax Liability", openingDebit: 0, openingCredit: 35000000, closingDebit: 0, closingCredit: 42000000 },
    { accountCode: "2701", accountName: "Employees Gratuity - Payable", openingDebit: 0, openingCredit: 28000000, closingDebit: 0, closingCredit: 35000000 },
    { accountCode: "3101", accountName: "Authorized & Paid-up Share Capital", openingDebit: 0, openingCredit: 500000000, closingDebit: 0, closingCredit: 500000000 },
    { accountCode: "3201", accountName: "Retained Earnings", openingDebit: 0, openingCredit: 340500000, closingDebit: 0, closingCredit: 484300000 },
    { accountCode: "3301", accountName: "Revaluation Surplus on PPE", openingDebit: 0, openingCredit: 45000000, closingDebit: 0, closingCredit: 45000000 },
    { accountCode: "4101", accountName: "Revenue - Local Sales", openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 520000000 },
    { accountCode: "4102", accountName: "Revenue - Export Sales", openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 680000000 },
    { accountCode: "4103", accountName: "Revenue - Waste Sales", openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 35000000 },
    { accountCode: "4201", accountName: "Sales Tax on Revenue", openingDebit: 0, openingCredit: 0, closingDebit: 85000000, closingCredit: 0 },
    { accountCode: "5101", accountName: "Raw Materials Consumed", openingDebit: 0, openingCredit: 0, closingDebit: 480000000, closingCredit: 0 },
    { accountCode: "5102", accountName: "Manufacturing Wages", openingDebit: 0, openingCredit: 0, closingDebit: 120000000, closingCredit: 0 },
    { accountCode: "5103", accountName: "Factory Overheads", openingDebit: 0, openingCredit: 0, closingDebit: 95000000, closingCredit: 0 },
    { accountCode: "5104", accountName: "Power & Fuel", openingDebit: 0, openingCredit: 0, closingDebit: 110000000, closingCredit: 0 },
    { accountCode: "5105", accountName: "Depreciation - Manufacturing", openingDebit: 0, openingCredit: 0, closingDebit: 45000000, closingCredit: 0 },
    { accountCode: "5201", accountName: "Salaries & Benefits - Admin", openingDebit: 0, openingCredit: 0, closingDebit: 55000000, closingCredit: 0 },
    { accountCode: "5202", accountName: "Office Rent & Utilities", openingDebit: 0, openingCredit: 0, closingDebit: 12000000, closingCredit: 0 },
    { accountCode: "5203", accountName: "Depreciation - Admin", openingDebit: 0, openingCredit: 0, closingDebit: 15000000, closingCredit: 0 },
    { accountCode: "5204", accountName: "Insurance", openingDebit: 0, openingCredit: 0, closingDebit: 8000000, closingCredit: 0 },
    { accountCode: "5301", accountName: "Export Commission & Freight", openingDebit: 0, openingCredit: 0, closingDebit: 42000000, closingCredit: 0 },
    { accountCode: "5302", accountName: "Marketing Expenses", openingDebit: 0, openingCredit: 0, closingDebit: 6000000, closingCredit: 0 },
    { accountCode: "5401", accountName: "Finance Cost - Bank Loans", openingDebit: 0, openingCredit: 0, closingDebit: 38000000, closingCredit: 0 },
    { accountCode: "5402", accountName: "Finance Cost - LC Charges", openingDebit: 0, openingCredit: 0, closingDebit: 12000000, closingCredit: 0 },
    { accountCode: "5403", accountName: "Exchange Loss / (Gain)", openingDebit: 0, openingCredit: 0, closingDebit: 8000000, closingCredit: 0 },
    { accountCode: "5501", accountName: "WPPF & WWF Expense", openingDebit: 0, openingCredit: 0, closingDebit: 5200000, closingCredit: 0 },
    { accountCode: "5601", accountName: "Tax Expense", openingDebit: 0, openingCredit: 0, closingDebit: 28000000, closingCredit: 0 },
    { accountCode: "6101", accountName: "Other Income - Scrap Sales", openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 4200000 },
  ];

  const totalOpeningDR = tbEntries.reduce((s, e) => s + e.openingDebit, 0);
  const totalOpeningCR = tbEntries.reduce((s, e) => s + e.openingCredit, 0);
  const totalClosingDR = tbEntries.reduce((s, e) => s + e.closingDebit, 0);
  const totalClosingCR = tbEntries.reduce((s, e) => s + e.closingCredit, 0);

  const tbBatch = await prisma.tBBatch.create({
    data: {
      engagementId: eng3.id,
      firmId: firm.id,
      batchNumber: 1,
      batchName: "FY2026 Trial Balance - Al-Baraka Textiles",
      version: 1,
      periodStart: new Date("2025-07-01"),
      periodEnd: new Date("2026-06-30"),
      fiscalYear: 2026,
      sourceType: "CLIENT_PROVIDED",
      entryCount: tbEntries.length,
      totalOpeningDebit: totalOpeningDR,
      totalOpeningCredit: totalOpeningCR,
      totalClosingDebit: totalClosingDR,
      totalClosingCredit: totalClosingCR,
      isBalanced: true,
      status: "APPROVED",
      uploadedById: staff.id,
    },
  });

  const totalMovementDR = tbEntries.reduce((s, e) => {
    const mv = Math.max(0, e.closingDebit - e.openingDebit + e.openingCredit - e.closingCredit);
    return s + mv;
  }, 0);
  const totalMovementCR = tbEntries.reduce((s, e) => {
    const mv = Math.max(0, e.openingDebit - e.closingDebit + e.closingCredit - e.openingCredit);
    return s + mv;
  }, 0);

  const glBatch = await prisma.gLBatch.create({
    data: {
      engagementId: eng3.id,
      firmId: firm.id,
      batchNumber: 1,
      batchName: "FY2026 General Ledger - Al-Baraka Textiles",
      version: 1,
      periodStart: new Date("2025-07-01"),
      periodEnd: new Date("2026-06-30"),
      fiscalYear: 2026,
      entryCount: 8500,
      totalDebits: totalMovementDR,
      totalCredits: totalMovementCR,
      isBalanced: true,
      status: "APPROVED",
      uploadedById: staff.id,
    },
  });

  await prisma.tBEntry.createMany({
    data: tbEntries.map((e, idx) => {
      const movementDebit = Math.max(0, e.closingDebit - e.openingDebit + e.openingCredit - e.closingCredit);
      const movementCredit = Math.max(0, e.openingDebit - e.closingDebit + e.closingCredit - e.openingCredit);
      return {
        batchId: tbBatch.id,
        engagementId: eng3.id,
        rowNumber: idx + 1,
        accountCode: e.accountCode,
        accountName: e.accountName,
        openingDebit: e.openingDebit,
        openingCredit: e.openingCredit,
        closingDebit: e.closingDebit,
        closingCredit: e.closingCredit,
        closingBalance: e.closingDebit - e.closingCredit,
        openingBalance: e.openingDebit - e.openingCredit,
        movementDebit,
        movementCredit,
      };
    }),
  });

  const fsLineMap: Record<string, string> = {
    "1101": "Cash and Bank Balances", "1102": "Cash and Bank Balances", "1103": "Cash and Bank Balances",
    "1201": "Trade Receivables", "1202": "Trade Receivables", "1203": "Trade Receivables",
    "1301": "Inventories", "1302": "Inventories", "1303": "Inventories", "1304": "Inventories",
    "1401": "Advances and Prepayments", "1402": "Advances and Prepayments",
    "1501": "Property, Plant and Equipment", "1502": "Property, Plant and Equipment",
    "1503": "Property, Plant and Equipment", "1504": "Property, Plant and Equipment",
    "1505": "Property, Plant and Equipment", "1506": "Property, Plant and Equipment",
    "1601": "Capital Work-in-Progress",
    "2101": "Trade and Other Payables", "2102": "Trade and Other Payables", "2103": "Trade and Other Payables",
    "2201": "Provisions", "2202": "Provisions",
    "2301": "Current Portion of Long Term Loans", "2401": "Current Tax Liabilities",
    "2501": "Long Term Borrowings", "2502": "Long Term Borrowings",
    "2601": "Deferred Tax Liability", "2701": "Employee Benefits",
    "3101": "Share Capital", "3201": "Retained Earnings", "3301": "Revaluation Surplus",
    "4101": "Revenue", "4102": "Revenue", "4103": "Revenue", "4201": "Sales Tax",
    "5101": "Cost of Sales", "5102": "Cost of Sales", "5103": "Cost of Sales", "5104": "Cost of Sales", "5105": "Cost of Sales",
    "5201": "Administrative Expenses", "5202": "Administrative Expenses", "5203": "Administrative Expenses", "5204": "Administrative Expenses",
    "5301": "Selling and Distribution Expenses", "5302": "Selling and Distribution Expenses",
    "5401": "Finance Costs", "5402": "Finance Costs", "5403": "Finance Costs",
    "5501": "Other Charges", "5601": "Tax Expense",
    "6101": "Other Income",
  };
  const classMap: Record<string, string> = { "1": "Assets", "2": "Liabilities", "3": "Equity", "4": "Revenue", "5": "Expenses", "6": "Income" };

  for (const e of tbEntries) {
    await prisma.coAAccount.upsert({
      where: { engagementId_accountCode: { engagementId: eng3.id, accountCode: e.accountCode } },
      update: { fsLineItem: fsLineMap[e.accountCode] || null },
      create: {
        engagementId: eng3.id,
        accountCode: e.accountCode,
        accountName: e.accountName,
        accountClass: classMap[e.accountCode[0]] || "Other",
        nature: (e.closingDebit > 0 ? "DR" : "CR") as "DR" | "CR",
        fsLineItem: fsLineMap[e.accountCode] || null,
        openingBalance: e.openingDebit - e.openingCredit,
        periodDr: e.closingDebit > e.openingDebit ? e.closingDebit - e.openingDebit : 0,
        periodCr: e.closingCredit > e.openingCredit ? e.closingCredit - e.openingCredit : 0,
        closingBalance: e.closingDebit - e.closingCredit,
      },
    });
  }

  const importBatch = await prisma.importBatch.create({
    data: {
      engagementId: eng3.id,
      batchNumber: "1",
      fileName: "AlBaraka_Textiles_FY2026_Workbook.xlsx",
      status: "POSTED",
      totalRows: tbEntries.length * 3,
      uploadedById: staff.id,
      obAccountCount: tbEntries.length,
      cbAccountCount: tbEntries.length,
    },
  });

  const obBalances = tbEntries.map(e => ({
    batchId: importBatch.id,
    engagementId: eng3.id,
    accountCode: e.accountCode,
    accountName: e.accountName,
    balanceType: "OB",
    asOfDate: new Date("2025-07-01"),
    debitAmount: e.openingDebit,
    creditAmount: e.openingCredit,
  }));
  const cbBalances = tbEntries.map(e => ({
    batchId: importBatch.id,
    engagementId: eng3.id,
    accountCode: e.accountCode,
    accountName: e.accountName,
    balanceType: "CB",
    asOfDate: new Date("2026-06-30"),
    debitAmount: e.closingDebit,
    creditAmount: e.closingCredit,
  }));
  await prisma.importAccountBalance.createMany({ data: [...obBalances, ...cbBalances] });

  const journalLines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
  for (const e of tbEntries) {
    const movement = (e.closingDebit - e.closingCredit) - (e.openingDebit - e.openingCredit);
    if (Math.abs(movement) < 0.01) continue;
    if (movement > 0) {
      journalLines.push({ accountCode: e.accountCode, accountName: e.accountName, debit: movement, credit: 0 });
    } else {
      journalLines.push({ accountCode: e.accountCode, accountName: e.accountName, debit: 0, credit: Math.abs(movement) });
    }
  }

  let totalJournalDebit = journalLines.reduce((s, l) => s + l.debit, 0);
  let totalJournalCredit = journalLines.reduce((s, l) => s + l.credit, 0);
  const balancingDiff = totalJournalDebit - totalJournalCredit;
  if (Math.abs(balancingDiff) >= 0.01) {
    if (balancingDiff > 0) {
      journalLines.push({ accountCode: "9999", accountName: "Suspense / Balancing", debit: 0, credit: balancingDiff });
      totalJournalCredit += balancingDiff;
    } else {
      journalLines.push({ accountCode: "9999", accountName: "Suspense / Balancing", debit: Math.abs(balancingDiff), credit: 0 });
      totalJournalDebit += Math.abs(balancingDiff);
    }
  }

  const journalHeader = await prisma.importJournalHeader.create({
    data: {
      batchId: importBatch.id,
      engagementId: eng3.id,
      journalId: "JV-ABT-001",
      voucherNo: "JV-ABT-001",
      voucherType: "General",
      voucherDate: new Date("2026-06-30"),
      periodKey: "2026-06",
      sourceModule: "GL",
      totalDebit: totalJournalDebit,
      totalCredit: totalJournalCredit,
      isBalanced: true,
      lineCount: journalLines.length,
    },
  });

  await prisma.importJournalLine.createMany({
    data: journalLines.map((l, idx) => ({
      journalHeaderId: journalHeader.id,
      lineNo: idx + 1,
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.debit,
      credit: l.credit,
    })),
  });

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: { glLineCount: journalLines.length },
  });

  await prisma.summaryRun.create({
    data: {
      engagementId: eng3.id,
      uploadVersionId: upload.id,
      runNumber: 1,
      tbRowCount: tbEntries.length,
      glEntryCount: 8500,
      tbOpeningDebitTotal: totalOpeningDR,
      tbOpeningCreditTotal: totalOpeningCR,
      tbClosingDebitTotal: totalClosingDR,
      tbClosingCreditTotal: totalClosingCR,
      tbMovementDebitTotal: totalMovementDR,
      tbMovementCreditTotal: totalMovementCR,
      glDebitTotal: totalMovementDR,
      glCreditTotal: totalMovementCR,
      tbArithmeticStatus: "PASS",
      tbArithmeticMessage: "TB debits equal credits for both opening and closing balances",
      glDrCrStatus: "PASS",
      glDrCrMessage: "GL debits equal credits",
      tbGlTieOutStatus: "PASS",
      tbGlTieOutMessage: "TB movements reconcile to GL totals within tolerance",
      tbGlMovementDiff: 0,
      tbGlTotalsStatus: "PASS",
      tbGlTotalsMessage: "TB and GL totals are consistent",
      tbTotalDebit: totalClosingDR,
      tbTotalCredit: totalClosingCR,
      deltaDR: 0,
      deltaCR: 0,
      roundingTolerance: 1,
      overallStatus: "PASS",
      exceptionCount: 0,
      criticalExceptionCount: 0,
      createdById: staff.id,
    },
  });

  await prisma.mappingSession.create({
    data: {
      engagementId: eng3.id,
      firmId: firm.id,
      sessionNumber: 1,
      sessionName: "FY2026 TB-GL Reconciliation - Al-Baraka",
      tbBatchId: tbBatch.id,
      glBatchId: glBatch.id,
      status: "APPROVED",
      tbTotalClosingDebit: totalClosingDR,
      tbTotalClosingCredit: totalClosingCR,
      glTotalDebit: totalMovementDR,
      glTotalCredit: totalMovementCR,
      isReconciled: true,
      reconciledDifference: 0,
      toleranceAmount: 1,
      withinTolerance: true,
      matchedCount: tbEntries.length,
      differenceCount: 0,
      missingInGLCount: 0,
      missingInTBCount: 0,
      createdById: manager.id,
      reviewedById: manager.id,
      reviewedAt: new Date("2026-01-15"),
      approvedById: partner.id,
      approvedAt: new Date("2026-01-18"),
    },
  });

  try {
    const syncResult = await syncTbToFsMapping(eng3.id, staff.id);
    console.log(`  Al-Baraka FS Mapping sync: ${syncResult.success ? 'success' : syncResult.error}`);
  } catch (e) {
    console.log("  Al-Baraka FS Mapping sync skipped");
  }
  } else {
    console.log("  Al-Baraka TB data already exists, skipping TB/GL/CoA seeding...");
  }

  const existingWP = await prisma.fSHeadWorkingPaper.findFirst({ where: { engagementId: eng3.id } });
  if (existingWP) {
    console.log("  [ENG-2026-003] FSHead/WP data already exists, skipping...");
    return;
  }

  const eng3FSHeads = [
    { code: "CASH_AND_BANK_BALANCES", name: "Cash and Bank Balances", statementType: "BS" as const, sortOrder: 1, totalDebit: 88000000, totalCredit: 0, netBalance: 88000000, accountCount: 3 },
    { code: "TRADE_RECEIVABLES", name: "Trade Receivables", statementType: "BS" as const, sortOrder: 2, totalDebit: 240000000, totalCredit: 6500000, netBalance: 233500000, accountCount: 3 },
    { code: "INVENTORIES", name: "Inventories", statementType: "BS" as const, sortOrder: 3, totalDebit: 368000000, totalCredit: 0, netBalance: 368000000, accountCount: 4 },
    { code: "ADVANCES_PREPAYMENTS", name: "Advances and Prepayments", statementType: "BS" as const, sortOrder: 4, totalDebit: 31500000, totalCredit: 0, netBalance: 31500000, accountCount: 2 },
    { code: "PROPERTY_PLANT_EQUIPMENT", name: "Property, Plant & Equipment", statementType: "BS" as const, sortOrder: 5, totalDebit: 1202000000, totalCredit: 345000000, netBalance: 857000000, accountCount: 6 },
    { code: "CAPITAL_WIP", name: "Capital Work-in-Progress", statementType: "BS" as const, sortOrder: 6, totalDebit: 120000000, totalCredit: 0, netBalance: 120000000, accountCount: 1 },
    { code: "TRADE_AND_OTHER_PAYABLES", name: "Trade and Other Payables", statementType: "BS" as const, sortOrder: 7, totalDebit: 0, totalCredit: 161000000, netBalance: -161000000, accountCount: 3 },
    { code: "PROVISIONS", name: "Provisions", statementType: "BS" as const, sortOrder: 8, totalDebit: 0, totalCredit: 13700000, netBalance: -13700000, accountCount: 2 },
    { code: "CURRENT_PORTION_LTL", name: "Current Portion of Long Term Loans", statementType: "BS" as const, sortOrder: 9, totalDebit: 0, totalCredit: 40000000, netBalance: -40000000, accountCount: 1 },
    { code: "CURRENT_TAX_LIABILITIES", name: "Current Tax Liabilities", statementType: "BS" as const, sortOrder: 10, totalDebit: 0, totalCredit: 22000000, netBalance: -22000000, accountCount: 1 },
    { code: "LONG_TERM_BORROWINGS", name: "Long Term Borrowings", statementType: "BS" as const, sortOrder: 11, totalDebit: 0, totalCredit: 280000000, netBalance: -280000000, accountCount: 2 },
    { code: "DEFERRED_TAX", name: "Deferred Tax Liability", statementType: "BS" as const, sortOrder: 12, totalDebit: 0, totalCredit: 42000000, netBalance: -42000000, accountCount: 1 },
    { code: "EMPLOYEE_BENEFITS", name: "Employee Benefits", statementType: "BS" as const, sortOrder: 13, totalDebit: 0, totalCredit: 35000000, netBalance: -35000000, accountCount: 1 },
    { code: "SHARE_CAPITAL", name: "Share Capital", statementType: "BS" as const, sortOrder: 14, totalDebit: 0, totalCredit: 500000000, netBalance: -500000000, accountCount: 1 },
    { code: "RETAINED_EARNINGS", name: "Retained Earnings", statementType: "BS" as const, sortOrder: 15, totalDebit: 0, totalCredit: 484300000, netBalance: -484300000, accountCount: 1 },
    { code: "REVALUATION_SURPLUS", name: "Revaluation Surplus", statementType: "BS" as const, sortOrder: 16, totalDebit: 0, totalCredit: 45000000, netBalance: -45000000, accountCount: 1 },
    { code: "REVENUE", name: "Revenue", statementType: "PL" as const, sortOrder: 17, totalDebit: 85000000, totalCredit: 1235000000, netBalance: -1150000000, accountCount: 4 },
    { code: "COST_OF_SALES", name: "Cost of Sales", statementType: "PL" as const, sortOrder: 18, totalDebit: 850000000, totalCredit: 0, netBalance: 850000000, accountCount: 5 },
    { code: "ADMIN_EXPENSES", name: "Administrative Expenses", statementType: "PL" as const, sortOrder: 19, totalDebit: 90000000, totalCredit: 0, netBalance: 90000000, accountCount: 4 },
    { code: "SELLING_EXPENSES", name: "Selling & Distribution Expenses", statementType: "PL" as const, sortOrder: 20, totalDebit: 48000000, totalCredit: 0, netBalance: 48000000, accountCount: 2 },
    { code: "FINANCE_COSTS", name: "Finance Costs", statementType: "PL" as const, sortOrder: 21, totalDebit: 58000000, totalCredit: 0, netBalance: 58000000, accountCount: 3 },
    { code: "OTHER_CHARGES", name: "Other Charges", statementType: "PL" as const, sortOrder: 22, totalDebit: 5200000, totalCredit: 0, netBalance: 5200000, accountCount: 1 },
    { code: "TAXATION", name: "Taxation", statementType: "PL" as const, sortOrder: 23, totalDebit: 28000000, totalCredit: 0, netBalance: 28000000, accountCount: 1 },
    { code: "OTHER_INCOME", name: "Other Income", statementType: "PL" as const, sortOrder: 24, totalDebit: 0, totalCredit: 4200000, netBalance: -4200000, accountCount: 1 },
  ];

  for (const h of eng3FSHeads) {
    await prisma.fSHead.upsert({
      where: { engagementId_code: { engagementId: eng3.id, code: h.code } },
      update: { totalDebit: h.totalDebit, totalCredit: h.totalCredit, netBalance: h.netBalance, accountCount: h.accountCount },
      create: { engagementId: eng3.id, code: h.code, name: h.name, statementType: h.statementType, sortOrder: h.sortOrder, totalDebit: h.totalDebit, totalCredit: h.totalCredit, netBalance: h.netBalance, accountCount: h.accountCount },
    });
  }
  console.log("  [ENG-2026-003] FSHead records seeded:", eng3FSHeads.length);

  const wpBase3 = { engagementId: eng3.id, preparedById: senior.id };
  const eng3WPs = [
    { fsHeadKey: "REVENUE", fsHeadName: "Revenue", statementType: "PL" as const, currentYearBalance: 1150000000, priorYearBalance: 980000000, inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskLevel: "high" as const, status: "IN_PROGRESS", auditStatus: "IN_PROGRESS", isMaterialHead: true, workpaperRef: "WP-REV-001", indexReference: "P1", isaReference: "ISA 330/500", tocCompleted: true, todCompleted: false, analyticsCompleted: true },
    { fsHeadKey: "INVENTORIES", fsHeadName: "Inventories", statementType: "BS" as const, currentYearBalance: 368000000, priorYearBalance: 315000000, inherentRisk: "HIGH" as const, controlRisk: "HIGH" as const, riskLevel: "high" as const, status: "IN_PROGRESS", auditStatus: "IN_PROGRESS", isMaterialHead: true, workpaperRef: "WP-INV-001", indexReference: "C1", isaReference: "ISA 501/330", tocCompleted: true, todCompleted: true, analyticsCompleted: false },
    { fsHeadKey: "PROPERTY_PLANT_EQUIPMENT", fsHeadName: "Property, Plant & Equipment", statementType: "BS" as const, currentYearBalance: 857000000, priorYearBalance: 812000000, inherentRisk: "MODERATE" as const, controlRisk: "LOW" as const, riskLevel: "medium" as const, status: "PREPARED", auditStatus: "IN_PROGRESS", isMaterialHead: true, workpaperRef: "WP-PPE-001", indexReference: "B1", isaReference: "ISA 330", tocCompleted: true, todCompleted: true, analyticsCompleted: true },
    { fsHeadKey: "TRADE_RECEIVABLES", fsHeadName: "Trade Receivables", statementType: "BS" as const, currentYearBalance: 233500000, priorYearBalance: 200000000, inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskLevel: "medium" as const, status: "DRAFT", auditStatus: "IN_PROGRESS", isMaterialHead: true, workpaperRef: "WP-TR-001", indexReference: "D1", isaReference: "ISA 505/330", tocCompleted: false, todCompleted: false, analyticsCompleted: false },
    { fsHeadKey: "TRADE_AND_OTHER_PAYABLES", fsHeadName: "Trade and Other Payables", statementType: "BS" as const, currentYearBalance: 161000000, priorYearBalance: 132000000, inherentRisk: "MODERATE" as const, controlRisk: "MODERATE" as const, riskLevel: "medium" as const, status: "DRAFT", auditStatus: "NOT_STARTED", isMaterialHead: true, workpaperRef: "WP-AP-001", indexReference: "E1", isaReference: "ISA 330", tocCompleted: false, todCompleted: false, analyticsCompleted: false },
    { fsHeadKey: "COST_OF_SALES", fsHeadName: "Cost of Sales", statementType: "PL" as const, currentYearBalance: 850000000, priorYearBalance: 720000000, inherentRisk: "HIGH" as const, controlRisk: "MODERATE" as const, riskLevel: "high" as const, status: "DRAFT", auditStatus: "NOT_STARTED", isMaterialHead: true, workpaperRef: "WP-COS-001", indexReference: "P2", isaReference: "ISA 330", tocCompleted: false, todCompleted: false, analyticsCompleted: false },
    { fsHeadKey: "CASH_AND_BANK_BALANCES", fsHeadName: "Cash and Bank Balances", statementType: "BS" as const, currentYearBalance: 88000000, priorYearBalance: 72000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, status: "REVIEWED", auditStatus: "IN_PROGRESS", isMaterialHead: true, workpaperRef: "WP-CB-001", indexReference: "A1", isaReference: "ISA 330", tocCompleted: true, todCompleted: true, analyticsCompleted: true },
    { fsHeadKey: "LONG_TERM_BORROWINGS", fsHeadName: "Long Term Borrowings", statementType: "BS" as const, currentYearBalance: 280000000, priorYearBalance: 350000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, status: "APPROVED", auditStatus: "COMPLETED", isMaterialHead: true, workpaperRef: "WP-LTB-001", indexReference: "F1", isaReference: "ISA 330", tocCompleted: true, todCompleted: true, analyticsCompleted: true },
    { fsHeadKey: "SHARE_CAPITAL", fsHeadName: "Share Capital", statementType: "BS" as const, currentYearBalance: 500000000, priorYearBalance: 500000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, status: "APPROVED", auditStatus: "COMPLETED", isMaterialHead: false, workpaperRef: "WP-SC-001", indexReference: "G1", isaReference: "ISA 330", tocCompleted: true, todCompleted: true, analyticsCompleted: true },
    { fsHeadKey: "FINANCE_COSTS", fsHeadName: "Finance Costs", statementType: "PL" as const, currentYearBalance: 58000000, priorYearBalance: 48000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, status: "PREPARED", auditStatus: "IN_PROGRESS", isMaterialHead: true, workpaperRef: "WP-FC-001", indexReference: "P3", isaReference: "ISA 330", tocCompleted: true, todCompleted: true, analyticsCompleted: true },
    { fsHeadKey: "ADMIN_EXPENSES", fsHeadName: "Administrative Expenses", statementType: "PL" as const, currentYearBalance: 90000000, priorYearBalance: 78000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, status: "DRAFT", auditStatus: "NOT_STARTED", isMaterialHead: false, workpaperRef: "WP-ADM-001", indexReference: "P4", isaReference: "ISA 330", tocCompleted: false, todCompleted: false, analyticsCompleted: false },
    { fsHeadKey: "SELLING_EXPENSES", fsHeadName: "Selling & Distribution Expenses", statementType: "PL" as const, currentYearBalance: 48000000, priorYearBalance: 42000000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, status: "DRAFT", auditStatus: "NOT_STARTED", isMaterialHead: false, workpaperRef: "WP-SDE-001", indexReference: "P5", isaReference: "ISA 330", tocCompleted: false, todCompleted: false, analyticsCompleted: false },
    { fsHeadKey: "RETAINED_EARNINGS", fsHeadName: "Retained Earnings", statementType: "BS" as const, currentYearBalance: 484300000, priorYearBalance: 340500000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "low" as const, status: "DRAFT", auditStatus: "NOT_STARTED", isMaterialHead: false, workpaperRef: "WP-RE-001", indexReference: "G2", isaReference: "ISA 330", tocCompleted: false, todCompleted: false, analyticsCompleted: false },
  ];

  for (const wp of eng3WPs) {
    await prisma.fSHeadWorkingPaper.upsert({
      where: { engagementId_fsHeadKey: { engagementId: eng3.id, fsHeadKey: wp.fsHeadKey } },
      update: {},
      create: { ...wpBase3, ...wp },
    });
  }
  console.log("  [ENG-2026-003] Working papers seeded:", eng3WPs.length);

  try {
    await prisma.materialityCalculation.create({
      data: {
        engagementId: eng3.id,
        firmId: firm.id,
        fiscalYear: 2026,
        periodStart: new Date("2025-07-01"),
        periodEnd: new Date("2026-06-30"),
        primaryBenchmarkId: "PBT",
        primaryBenchmarkType: "PROFIT_BEFORE_TAX",
        primaryBenchmarkValue: 180000000,
        appliedPercentage: 5.0,
        overallMateriality: 9000000,
        performanceMaterialityPct: 75,
        performanceMateriality: 6750000,
        trivialThresholdPct: 5,
        trivialThreshold: 450000,
        revenueValue: 1150000000,
        totalAssetsValue: 1698000000,
        pbtValue: 180000000,
        grossProfitValue: 300000000,
        totalEquityValue: 1029300000,
        calculationNotes: "Materiality determined at 5% of PBT consistent with prior year and industry benchmarks. Conservative approach applied due to HIGH risk rating and first-year audit. Performance materiality at 75% of overall materiality. Trivial threshold at 5% of overall materiality.",
        riskFactorsConsidered: [
          "First-year audit engagement",
          "Significant inventory valuation judgment",
          "Export revenue with multiple currencies",
          "Related party transactions",
          "Complex manufacturing cost allocation",
        ],
        status: "APPROVED",
        preparedById: senior.id,
        reviewedById: manager.id,
        reviewedAt: new Date("2026-01-16"),
        approvedById: partner.id,
        approvedAt: new Date("2026-01-18"),
      },
    });
    console.log("  [ENG-2026-003] MaterialityCalculation seeded (PKR 9M / 6.75M / 450K)");
  } catch (e: any) {
    console.log("  [ENG-2026-003] MaterialityCalculation skipped:", e.message?.slice(0, 80));
  }

  await prisma.engagement.update({
    where: { id: eng3.id },
    data: {
      currentPhase: "EXECUTION",
      engagementLetterSigned: true,
      engagementLetterSignedDate: new Date("2025-08-15"),
    },
  });

  await prisma.phaseProgress.updateMany({
    where: { engagementId: eng3.id, phase: "PRE_PLANNING" },
    data: { status: "COMPLETED", completionPercentage: 100, completedAt: new Date("2025-12-15") },
  });
  await prisma.phaseProgress.updateMany({
    where: { engagementId: eng3.id, phase: "REQUISITION" },
    data: { status: "COMPLETED", completionPercentage: 100, startedAt: new Date("2025-12-16"), completedAt: new Date("2026-01-05") },
  });
  await prisma.phaseProgress.updateMany({
    where: { engagementId: eng3.id, phase: "PLANNING" },
    data: { status: "COMPLETED", completionPercentage: 100, startedAt: new Date("2026-01-06"), completedAt: new Date("2026-02-01") },
  });
  await prisma.phaseProgress.updateMany({
    where: { engagementId: eng3.id, phase: "EXECUTION" },
    data: { status: "IN_PROGRESS", completionPercentage: 35, startedAt: new Date("2026-02-05") },
  });
  console.log("  [ENG-2026-003] Phase progress updated to EXECUTION phase");

  console.log(`  Al-Baraka financial data seeded: ${eng3FSHeads.length} FS Heads, ${eng3WPs.length} Working Papers`);
}

export async function seedLinkageData() {
  const eng1 = await prisma.engagement.findFirst({ where: { engagementCode: "ENG-2025-001" } });
  const eng2 = await prisma.engagement.findFirst({ where: { engagementCode: "ENG-2025-002" } });
  if (!eng1 || !eng2) {
    console.log("Engagements not found, skipping linkage data...");
    return;
  }

  const existingFSHeadCount = await prisma.fSHead.count({ where: { engagementId: eng1.id } });
  if (existingFSHeadCount > 0) {
    console.log("Linkage data already exists, skipping...");
    return;
  }

  const adminUser = await prisma.user.findFirst({ where: { email: "admin@auditwise.pk" } });
  if (!adminUser) {
    console.log("Admin user not found, skipping linkage data...");
    return;
  }

  console.log("Seeding linkage data (FSHead, MappingAllocation, TrialBalance, FSHeadWorkingPaper)...");

  const allFSHeads = [
    { code: "CASH_AND_BANK_BALANCES", name: "Cash and Bank Balances", statementType: "BS" as const, sortOrder: 1 },
    { code: "TRADE_RECEIVABLES", name: "Trade Receivables", statementType: "BS" as const, sortOrder: 2 },
    { code: "OTHER_RECEIVABLES", name: "Other Receivables", statementType: "BS" as const, sortOrder: 3 },
    { code: "INVENTORIES", name: "Inventories", statementType: "BS" as const, sortOrder: 4 },
    { code: "PROPERTY_PLANT_EQUIPMENT", name: "Property, Plant & Equipment", statementType: "BS" as const, sortOrder: 5 },
    { code: "INTANGIBLE_ASSETS", name: "Intangible Assets", statementType: "BS" as const, sortOrder: 6 },
    { code: "TRADE_AND_OTHER_PAYABLES", name: "Trade and Other Payables", statementType: "BS" as const, sortOrder: 7 },
    { code: "SHORT_TERM_BORROWINGS", name: "Short-Term Borrowings", statementType: "BS" as const, sortOrder: 8 },
    { code: "LONG_TERM_BORROWINGS", name: "Long-Term Borrowings", statementType: "BS" as const, sortOrder: 9 },
    { code: "PROVISIONS", name: "Provisions", statementType: "BS" as const, sortOrder: 10 },
    { code: "SHARE_CAPITAL", name: "Share Capital", statementType: "BS" as const, sortOrder: 11 },
    { code: "RESERVES_SURPLUS", name: "Reserves & Surplus", statementType: "BS" as const, sortOrder: 12 },
    { code: "REVENUE", name: "Revenue", statementType: "PL" as const, sortOrder: 13 },
    { code: "COST_OF_SALES", name: "Cost of Sales", statementType: "PL" as const, sortOrder: 14 },
    { code: "ADMIN_EXPENSES", name: "Administrative Expenses", statementType: "PL" as const, sortOrder: 15 },
    { code: "SELLING_EXPENSES", name: "Selling & Distribution Expenses", statementType: "PL" as const, sortOrder: 16 },
    { code: "OTHER_INCOME", name: "Other Income", statementType: "PL" as const, sortOrder: 17 },
    { code: "FINANCE_COSTS", name: "Finance Costs", statementType: "PL" as const, sortOrder: 18 },
    { code: "TAXATION", name: "Taxation", statementType: "PL" as const, sortOrder: 19 },
    { code: "EMPLOYEE_BENEFITS", name: "Employee Benefits", statementType: "PL" as const, sortOrder: 20 },
  ];

  const eng2FSHeads = allFSHeads.slice(0, 16);

  for (const h of allFSHeads) {
    await prisma.fSHead.upsert({
      where: { engagementId_code: { engagementId: eng1.id, code: h.code } },
      update: {},
      create: { engagementId: eng1.id, code: h.code, name: h.name, statementType: h.statementType, sortOrder: h.sortOrder },
    });
  }

  for (const h of eng2FSHeads) {
    await prisma.fSHead.upsert({
      where: { engagementId_code: { engagementId: eng2.id, code: h.code } },
      update: {},
      create: { engagementId: eng2.id, code: h.code, name: h.name, statementType: h.statementType, sortOrder: h.sortOrder },
    });
  }

  const coaUpdates = [
    { codes: ["1101", "1102", "1103", "1104", "1105"], fsLineItem: "CASH_AND_BANK_BALANCES", nature: "DR" as const },
    { codes: ["1301"], fsLineItem: "TRADE_RECEIVABLES", nature: "DR" as const },
    { codes: ["2101"], fsLineItem: "TRADE_AND_OTHER_PAYABLES", nature: "CR" as const },
    { codes: ["3101"], fsLineItem: "SHARE_CAPITAL", nature: "CR" as const },
    { codes: ["4101"], fsLineItem: "REVENUE", nature: "CR" as const },
    { codes: ["5101"], fsLineItem: "COST_OF_SALES", nature: "DR" as const },
  ];

  for (const u of coaUpdates) {
    await prisma.coAAccount.updateMany({
      where: { engagementId: eng2.id, accountCode: { in: u.codes } },
      data: { fsLineItem: u.fsLineItem, nature: u.nature },
    });
  }

  const eng1FSHeadRecords = await prisma.fSHead.findMany({ where: { engagementId: eng1.id } });
  const fsHeadMap = new Map(eng1FSHeadRecords.map(h => [h.code, h.id]));

  const eng2FSHeadRecords = await prisma.fSHead.findMany({ where: { engagementId: eng2.id } });
  const eng2FSHeadMap = new Map(eng2FSHeadRecords.map(h => [h.code, h.id]));

  const mappingAllocations = [
    { accountCode: "1101", fsHeadCode: "CASH_AND_BANK_BALANCES" },
    { accountCode: "1102", fsHeadCode: "CASH_AND_BANK_BALANCES" },
    { accountCode: "1103", fsHeadCode: "CASH_AND_BANK_BALANCES" },
    { accountCode: "1104", fsHeadCode: "CASH_AND_BANK_BALANCES" },
    { accountCode: "1105", fsHeadCode: "CASH_AND_BANK_BALANCES" },
    { accountCode: "1301", fsHeadCode: "TRADE_RECEIVABLES" },
    { accountCode: "2101", fsHeadCode: "TRADE_AND_OTHER_PAYABLES" },
    { accountCode: "3101", fsHeadCode: "SHARE_CAPITAL" },
    { accountCode: "4101", fsHeadCode: "REVENUE" },
    { accountCode: "5101", fsHeadCode: "COST_OF_SALES" },
  ];

  for (const m of mappingAllocations) {
    const fsHeadId = fsHeadMap.get(m.fsHeadCode);
    if (!fsHeadId) continue;
    await prisma.mappingAllocation.upsert({
      where: { engagementId_accountCode: { engagementId: eng1.id, accountCode: m.accountCode } },
      update: {},
      create: {
        engagementId: eng1.id,
        accountCode: m.accountCode,
        fsHeadId,
        allocationPct: 100,
        status: "APPROVED",
        isLocked: true,
      },
    });
  }

  for (const m of mappingAllocations) {
    const fsHeadId = eng2FSHeadMap.get(m.fsHeadCode);
    if (!fsHeadId) continue;
    await prisma.mappingAllocation.upsert({
      where: { engagementId_accountCode: { engagementId: eng2.id, accountCode: m.accountCode } },
      update: {},
      create: {
        engagementId: eng2.id,
        accountCode: m.accountCode,
        fsHeadId,
        allocationPct: 100,
        status: "APPROVED",
        isLocked: true,
      },
    });
  }

  let trialBalance = await prisma.trialBalance.findFirst({ where: { engagementId: eng1.id } });
  if (!trialBalance) {
    trialBalance = await prisma.trialBalance.create({
      data: {
        engagementId: eng1.id,
        importedById: adminUser.id,
        periodEnd: new Date("2025-12-31"),
        periodType: "current",
        isFinalized: true,
        totalAssets: 6200000,
        totalLiabilities: 500000,
        totalEquity: 2500000,
        totalRevenue: 8700000,
        totalExpenses: 5500000,
        netIncome: 3200000,
      },
    });

    await prisma.trialBalanceLine.createMany({
      data: [
        { trialBalanceId: trialBalance.id, accountCode: "1101", accountName: "Cash at Bank - HBL", openingBalance: 0, debits: 5100000, credits: 0, closingBalance: 5100000, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: trialBalance.id, accountCode: "1102", accountName: "Cash at Bank - UBL", openingBalance: 0, debits: 0, credits: 0, closingBalance: 0, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: trialBalance.id, accountCode: "1103", accountName: "Cash at Bank - MCB (USD)", openingBalance: 0, debits: 0, credits: 0, closingBalance: 0, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: trialBalance.id, accountCode: "1104", accountName: "Cash at Bank - ABL", openingBalance: 0, debits: 0, credits: 0, closingBalance: 0, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: trialBalance.id, accountCode: "1105", accountName: "Cash at Bank - Alfalah", openingBalance: 0, debits: 0, credits: 0, closingBalance: 0, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: trialBalance.id, accountCode: "1301", accountName: "Trade Receivables", openingBalance: 0, debits: 1100000, credits: 0, closingBalance: 1100000, fsArea: "RECEIVABLES" },
        { trialBalanceId: trialBalance.id, accountCode: "2101", accountName: "Trade Payables", openingBalance: 0, debits: 0, credits: 500000, closingBalance: -500000, fsArea: "PAYABLES" },
        { trialBalanceId: trialBalance.id, accountCode: "3101", accountName: "Share Capital", openingBalance: 0, debits: 0, credits: 2500000, closingBalance: -2500000, fsArea: "EQUITY" },
        { trialBalanceId: trialBalance.id, accountCode: "4101", accountName: "Sales Revenue", openingBalance: 0, debits: 0, credits: 8700000, closingBalance: -8700000, fsArea: "REVENUE" },
        { trialBalanceId: trialBalance.id, accountCode: "5101", accountName: "Cost of Goods Sold", openingBalance: 0, debits: 5500000, credits: 0, closingBalance: 5500000, fsArea: "COST_OF_SALES" },
      ],
    });
  }

  const wpBase = { engagementId: eng1.id, preparedById: adminUser.id };

  await prisma.fSHeadWorkingPaper.upsert({
    where: { engagementId_fsHeadKey: { engagementId: eng1.id, fsHeadKey: "CASH_AND_BANK_BALANCES" } },
    update: {},
    create: {
      ...wpBase,
      fsHeadKey: "CASH_AND_BANK_BALANCES",
      fsHeadName: "Cash and Bank Balances",
      statementType: "BS",
      currentYearBalance: 5100000,
      inherentRisk: "LOW",
      controlRisk: "LOW",
      riskLevel: "LOW",
      status: "REVIEWED",
      auditStatus: "IN_PROGRESS",
      isMaterialHead: true,
      tocCompleted: true,
      todCompleted: true,
      analyticsCompleted: true,
      workpaperRef: "WP-CB-001",
      indexReference: "C",
      isaReference: "ISA 330",
    },
  });

  await prisma.fSHeadWorkingPaper.upsert({
    where: { engagementId_fsHeadKey: { engagementId: eng1.id, fsHeadKey: "TRADE_RECEIVABLES" } },
    update: {},
    create: {
      ...wpBase,
      fsHeadKey: "TRADE_RECEIVABLES",
      fsHeadName: "Trade Receivables",
      statementType: "BS",
      currentYearBalance: 1100000,
      inherentRisk: "MEDIUM",
      controlRisk: "LOW",
      riskLevel: "MEDIUM",
      status: "REVIEWED",
      auditStatus: "IN_PROGRESS",
      isMaterialHead: true,
      tocCompleted: true,
      todCompleted: false,
      workpaperRef: "WP-TR-001",
      indexReference: "D",
    },
  });

  await prisma.fSHeadWorkingPaper.upsert({
    where: { engagementId_fsHeadKey: { engagementId: eng1.id, fsHeadKey: "TRADE_AND_OTHER_PAYABLES" } },
    update: {},
    create: {
      ...wpBase,
      fsHeadKey: "TRADE_AND_OTHER_PAYABLES",
      fsHeadName: "Trade and Other Payables",
      statementType: "BS",
      currentYearBalance: 500000,
      inherentRisk: "LOW",
      controlRisk: "LOW",
      riskLevel: "LOW",
      status: "DRAFT",
      auditStatus: "IN_PROGRESS",
      isMaterialHead: false,
      workpaperRef: "WP-AP-001",
      indexReference: "E",
    },
  });

  await prisma.fSHeadWorkingPaper.upsert({
    where: { engagementId_fsHeadKey: { engagementId: eng1.id, fsHeadKey: "REVENUE" } },
    update: {},
    create: {
      ...wpBase,
      fsHeadKey: "REVENUE",
      fsHeadName: "Revenue",
      statementType: "PL",
      currentYearBalance: 8700000,
      inherentRisk: "HIGH",
      controlRisk: "MEDIUM",
      riskLevel: "HIGH",
      status: "DRAFT",
      auditStatus: "NOT_STARTED",
      isMaterialHead: true,
      workpaperRef: "WP-REV-001",
      indexReference: "F",
    },
  });

  await prisma.fSHeadWorkingPaper.upsert({
    where: { engagementId_fsHeadKey: { engagementId: eng1.id, fsHeadKey: "COST_OF_SALES" } },
    update: {},
    create: {
      ...wpBase,
      fsHeadKey: "COST_OF_SALES",
      fsHeadName: "Cost of Sales",
      statementType: "PL",
      currentYearBalance: 5500000,
      inherentRisk: "MEDIUM",
      controlRisk: "LOW",
      riskLevel: "MEDIUM",
      status: "DRAFT",
      auditStatus: "NOT_STARTED",
      isMaterialHead: true,
      workpaperRef: "WP-COS-001",
      indexReference: "G",
    },
  });

  await prisma.fSHeadWorkingPaper.upsert({
    where: { engagementId_fsHeadKey: { engagementId: eng1.id, fsHeadKey: "SHARE_CAPITAL" } },
    update: {},
    create: {
      ...wpBase,
      fsHeadKey: "SHARE_CAPITAL",
      fsHeadName: "Share Capital",
      statementType: "BS",
      currentYearBalance: 2500000,
      inherentRisk: "LOW",
      controlRisk: "LOW",
      riskLevel: "LOW",
      status: "DRAFT",
      auditStatus: "NOT_STARTED",
      isMaterialHead: false,
      workpaperRef: "WP-SC-001",
      indexReference: "H",
    },
  });

  const balanceUpdates = [
    { code: "CASH_AND_BANK_BALANCES", totalDebit: 5100000, totalCredit: 0, netBalance: 5100000, accountCount: 5 },
    { code: "TRADE_RECEIVABLES", totalDebit: 1100000, totalCredit: 0, netBalance: 1100000, accountCount: 1 },
    { code: "TRADE_AND_OTHER_PAYABLES", totalDebit: 0, totalCredit: 500000, netBalance: -500000, accountCount: 1 },
    { code: "SHARE_CAPITAL", totalDebit: 0, totalCredit: 2500000, netBalance: -2500000, accountCount: 1 },
    { code: "REVENUE", totalDebit: 0, totalCredit: 8700000, netBalance: -8700000, accountCount: 1 },
    { code: "COST_OF_SALES", totalDebit: 5500000, totalCredit: 0, netBalance: 5500000, accountCount: 1 },
  ];

  for (const bu of balanceUpdates) {
    await prisma.fSHead.update({
      where: { engagementId_code: { engagementId: eng1.id, code: bu.code } },
      data: { totalDebit: bu.totalDebit, totalCredit: bu.totalCredit, netBalance: bu.netBalance, accountCount: bu.accountCount },
    });
    await prisma.fSHead.update({
      where: { engagementId_code: { engagementId: eng2.id, code: bu.code } },
      data: { totalDebit: bu.totalDebit, totalCredit: bu.totalCredit, netBalance: bu.netBalance, accountCount: bu.accountCount },
    });
  }

  let eng2TB = await prisma.trialBalance.findFirst({ where: { engagementId: eng2.id } });
  if (!eng2TB) {
    eng2TB = await prisma.trialBalance.create({
      data: {
        engagementId: eng2.id,
        importedById: adminUser.id,
        periodEnd: new Date("2025-12-31"),
        periodType: "current",
        isFinalized: false,
        totalAssets: 6200000,
        totalLiabilities: 500000,
        totalEquity: 2500000,
        totalRevenue: 8700000,
        totalExpenses: 5500000,
        netIncome: 3200000,
      },
    });

    await prisma.trialBalanceLine.createMany({
      data: [
        { trialBalanceId: eng2TB.id, accountCode: "1101", accountName: "Cash at Bank - HBL", openingBalance: 0, debits: 5100000, credits: 0, closingBalance: 5100000, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: eng2TB.id, accountCode: "1102", accountName: "Cash at Bank - UBL", openingBalance: 0, debits: 0, credits: 0, closingBalance: 0, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: eng2TB.id, accountCode: "1103", accountName: "Cash at Bank - MCB (USD)", openingBalance: 0, debits: 0, credits: 0, closingBalance: 0, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: eng2TB.id, accountCode: "1104", accountName: "Cash at Bank - ABL", openingBalance: 0, debits: 0, credits: 0, closingBalance: 0, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: eng2TB.id, accountCode: "1105", accountName: "Cash at Bank - Alfalah", openingBalance: 0, debits: 0, credits: 0, closingBalance: 0, fsArea: "CASH_AND_BANK" },
        { trialBalanceId: eng2TB.id, accountCode: "1301", accountName: "Trade Receivables", openingBalance: 0, debits: 1100000, credits: 0, closingBalance: 1100000, fsArea: "RECEIVABLES" },
        { trialBalanceId: eng2TB.id, accountCode: "2101", accountName: "Trade Payables", openingBalance: 0, debits: 0, credits: 500000, closingBalance: -500000, fsArea: "PAYABLES" },
        { trialBalanceId: eng2TB.id, accountCode: "3101", accountName: "Share Capital", openingBalance: 0, debits: 0, credits: 2500000, closingBalance: -2500000, fsArea: "EQUITY" },
        { trialBalanceId: eng2TB.id, accountCode: "4101", accountName: "Sales Revenue", openingBalance: 0, debits: 0, credits: 8700000, closingBalance: -8700000, fsArea: "REVENUE" },
        { trialBalanceId: eng2TB.id, accountCode: "5101", accountName: "Cost of Goods Sold", openingBalance: 0, debits: 5500000, credits: 0, closingBalance: 5500000, fsArea: "COST_OF_SALES" },
      ],
    });
  }

  const eng2WPBase = { engagementId: eng2.id, preparedById: adminUser.id };

  const eng2WorkingPapers = [
    { fsHeadKey: "CASH_AND_BANK_BALANCES", fsHeadName: "Cash and Bank Balances", statementType: "BS" as const, currentYearBalance: 5100000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "LOW" as const, status: "DRAFT" as const, auditStatus: "NOT_STARTED", isMaterialHead: true, workpaperRef: "WP-CB-001", indexReference: "C" },
    { fsHeadKey: "TRADE_RECEIVABLES", fsHeadName: "Trade Receivables", statementType: "BS" as const, currentYearBalance: 1100000, inherentRisk: "MEDIUM" as const, controlRisk: "LOW" as const, riskLevel: "MEDIUM" as const, status: "DRAFT" as const, auditStatus: "NOT_STARTED", isMaterialHead: true, workpaperRef: "WP-TR-001", indexReference: "D" },
    { fsHeadKey: "TRADE_AND_OTHER_PAYABLES", fsHeadName: "Trade and Other Payables", statementType: "BS" as const, currentYearBalance: 500000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "LOW" as const, status: "DRAFT" as const, auditStatus: "NOT_STARTED", isMaterialHead: false, workpaperRef: "WP-AP-001", indexReference: "E" },
    { fsHeadKey: "REVENUE", fsHeadName: "Revenue", statementType: "PL" as const, currentYearBalance: 8700000, inherentRisk: "HIGH" as const, controlRisk: "MEDIUM" as const, riskLevel: "HIGH" as const, status: "DRAFT" as const, auditStatus: "NOT_STARTED", isMaterialHead: true, workpaperRef: "WP-REV-001", indexReference: "F" },
    { fsHeadKey: "COST_OF_SALES", fsHeadName: "Cost of Sales", statementType: "PL" as const, currentYearBalance: 5500000, inherentRisk: "MEDIUM" as const, controlRisk: "LOW" as const, riskLevel: "MEDIUM" as const, status: "DRAFT" as const, auditStatus: "NOT_STARTED", isMaterialHead: true, workpaperRef: "WP-COS-001", indexReference: "G" },
    { fsHeadKey: "SHARE_CAPITAL", fsHeadName: "Share Capital", statementType: "BS" as const, currentYearBalance: 2500000, inherentRisk: "LOW" as const, controlRisk: "LOW" as const, riskLevel: "LOW" as const, status: "DRAFT" as const, auditStatus: "NOT_STARTED", isMaterialHead: false, workpaperRef: "WP-SC-001", indexReference: "H" },
  ];

  for (const wp of eng2WorkingPapers) {
    await prisma.fSHeadWorkingPaper.upsert({
      where: { engagementId_fsHeadKey: { engagementId: eng2.id, fsHeadKey: wp.fsHeadKey } },
      update: {},
      create: { ...eng2WPBase, ...wp },
    });
  }

  console.log("Linkage data seeded successfully!");
}

export async function seedWorkflowDemoData() {
  console.log("Seeding workflow demo data...");

  const eng1 = await prisma.engagement.findFirst({ where: { engagementCode: "ENG-2025-001" } });
  if (!eng1) {
    console.log("  ENG-2025-001 not found, skipping workflow demo data.");
    return;
  }

  const existingUpload = await prisma.uploadVersion.findFirst({ where: { engagementId: eng1.id } });
  if (existingUpload) {
    console.log("  Workflow demo data already exists, skipping.");
    return;
  }

  const firm = await prisma.firm.findFirst();
  if (!firm) return;

  const staff = await prisma.user.findFirst({ where: { email: "staff@auditwise.pk" } });
  const senior = await prisma.user.findFirst({ where: { email: "senior@auditwise.pk" } });
  const manager = await prisma.user.findFirst({ where: { email: "manager@auditwise.pk" } });
  const partner = await prisma.user.findFirst({ where: { email: "partner@auditwise.pk" } });
  if (!staff || !senior || !manager || !partner) return;

  console.log("  Creating upload version...");
  const upload = await prisma.uploadVersion.create({
    data: {
      engagementId: eng1.id,
      version: 1,
      fileName: "Meridian_Tech_FY2024_Workbook.xlsx",
      fileHash: "sha256:a3b9c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5",
      fileSize: 4825600,
      status: "ACTIVE",
      uploadedById: staff.id,
    },
  });

  console.log("  Creating TB batch...");
  const tbBatch = await prisma.tBBatch.create({
    data: {
      engagementId: eng1.id,
      firmId: firm.id,
      batchNumber: 1,
      batchName: "FY2024 Trial Balance",
      version: 1,
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-12-31"),
      fiscalYear: 2024,
      sourceType: "CLIENT_PROVIDED",
      entryCount: 36,
      totalOpeningDebit: 490000000,
      totalOpeningCredit: 490000000,
      totalClosingDebit: 1047500000,
      totalClosingCredit: 1047500000,
      isBalanced: true,
      status: "APPROVED",
      uploadedById: staff.id,
    },
  });

  console.log("  Creating GL batch...");
  const glBatch = await prisma.gLBatch.create({
    data: {
      engagementId: eng1.id,
      firmId: firm.id,
      batchNumber: 1,
      batchName: "FY2024 General Ledger",
      version: 1,
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-12-31"),
      fiscalYear: 2024,
      entryCount: 12840,
      totalDebits: 567500000,
      totalCredits: 567500000,
      isBalanced: true,
      status: "APPROVED",
      uploadedById: staff.id,
    },
  });

  console.log("  Creating TB entries...");
  const tbEntries = [
    { accountCode: "1101", accountName: "Cash at Bank - HBL", openingDebit: 45000000, openingCredit: 0, closingDebit: 52000000, closingCredit: 0 },
    { accountCode: "1102", accountName: "Cash at Bank - UBL", openingDebit: 18000000, openingCredit: 0, closingDebit: 22000000, closingCredit: 0 },
    { accountCode: "1103", accountName: "Cash at Bank - MCB (USD)", openingDebit: 12000000, openingCredit: 0, closingDebit: 15000000, closingCredit: 0 },
    { accountCode: "1104", accountName: "Cash at Bank - ABL", openingDebit: 8000000, openingCredit: 0, closingDebit: 10000000, closingCredit: 0 },
    { accountCode: "1105", accountName: "Cash at Bank - Alfalah", openingDebit: 5000000, openingCredit: 0, closingDebit: 6000000, closingCredit: 0 },
    { accountCode: "1201", accountName: "Short Term Investments", openingDebit: 25000000, openingCredit: 0, closingDebit: 30000000, closingCredit: 0 },
    { accountCode: "1301", accountName: "Trade Receivables", openingDebit: 95000000, openingCredit: 0, closingDebit: 110000000, closingCredit: 0 },
    { accountCode: "1302", accountName: "Allowance for Doubtful Debts", openingDebit: 0, openingCredit: 3500000, closingDebit: 0, closingCredit: 4100000 },
    { accountCode: "1401", accountName: "Prepayments and Advances", openingDebit: 12000000, openingCredit: 0, closingDebit: 14000000, closingCredit: 0 },
    { accountCode: "1501", accountName: "Inventory - Hardware", openingDebit: 35000000, openingCredit: 0, closingDebit: 42000000, closingCredit: 0 },
    { accountCode: "1502", accountName: "Inventory - Software Licenses", openingDebit: 18000000, openingCredit: 0, closingDebit: 20000000, closingCredit: 0 },
    { accountCode: "1601", accountName: "Office Equipment", openingDebit: 45000000, openingCredit: 0, closingDebit: 52000000, closingCredit: 0 },
    { accountCode: "1602", accountName: "Computer Equipment", openingDebit: 85000000, openingCredit: 0, closingDebit: 95000000, closingCredit: 0 },
    { accountCode: "1603", accountName: "Vehicles", openingDebit: 22000000, openingCredit: 0, closingDebit: 22000000, closingCredit: 0 },
    { accountCode: "1604", accountName: "Accumulated Depreciation", openingDebit: 0, openingCredit: 48000000, closingDebit: 0, closingCredit: 62000000 },
    { accountCode: "1701", accountName: "Internally Developed Software", openingDebit: 65000000, openingCredit: 0, closingDebit: 78000000, closingCredit: 0 },
    { accountCode: "1702", accountName: "Amortization - Software", openingDebit: 0, openingCredit: 20000000, closingDebit: 0, closingCredit: 28000000 },
    { accountCode: "2101", accountName: "Trade Payables", openingDebit: 0, openingCredit: 42000000, closingDebit: 0, closingCredit: 48000000 },
    { accountCode: "2102", accountName: "Accrued Expenses", openingDebit: 0, openingCredit: 18000000, closingDebit: 0, closingCredit: 22000000 },
    { accountCode: "2201", accountName: "Tax Payable", openingDebit: 0, openingCredit: 15000000, closingDebit: 0, closingCredit: 18000000 },
    { accountCode: "2301", accountName: "Long Term Loan - HBL", openingDebit: 0, openingCredit: 50000000, closingDebit: 0, closingCredit: 40000000 },
    { accountCode: "3101", accountName: "Share Capital", openingDebit: 0, openingCredit: 100000000, closingDebit: 0, closingCredit: 100000000 },
    { accountCode: "3201", accountName: "Retained Earnings", openingDebit: 0, openingCredit: 193500000, closingDebit: 0, closingCredit: 246900000 },
    { accountCode: "4101", accountName: "Software Development Revenue", openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 250000000 },
    { accountCode: "4102", accountName: "Cloud Services Revenue", openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 135000000 },
    { accountCode: "4103", accountName: "IT Consulting Revenue", openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 65000000 },
    { accountCode: "4104", accountName: "Cybersecurity Solutions Revenue", openingDebit: 0, openingCredit: 0, closingDebit: 0, closingCredit: 28500000 },
    { accountCode: "5101", accountName: "Employee Salaries & Benefits", openingDebit: 0, openingCredit: 0, closingDebit: 320000000, closingCredit: 0 },
    { accountCode: "5102", accountName: "Subcontractor Costs", openingDebit: 0, openingCredit: 0, closingDebit: 55000000, closingCredit: 0 },
    { accountCode: "5201", accountName: "Office Rent", openingDebit: 0, openingCredit: 0, closingDebit: 26000000, closingCredit: 0 },
    { accountCode: "5202", accountName: "Utilities & Internet", openingDebit: 0, openingCredit: 0, closingDebit: 9000000, closingCredit: 0 },
    { accountCode: "5301", accountName: "Depreciation Expense", openingDebit: 0, openingCredit: 0, closingDebit: 14000000, closingCredit: 0 },
    { accountCode: "5302", accountName: "Amortization Expense", openingDebit: 0, openingCredit: 0, closingDebit: 8000000, closingCredit: 0 },
    { accountCode: "5401", accountName: "Marketing & Business Development", openingDebit: 0, openingCredit: 0, closingDebit: 18000000, closingCredit: 0 },
    { accountCode: "5501", accountName: "Finance Costs", openingDebit: 0, openingCredit: 0, closingDebit: 4000000, closingCredit: 0 },
    { accountCode: "5601", accountName: "Tax Expense", openingDebit: 0, openingCredit: 0, closingDebit: 25500000, closingCredit: 0 },
  ];

  await prisma.tBEntry.createMany({
    data: tbEntries.map((e, idx) => {
      const movementDebit = Math.max(0, e.closingDebit - e.openingDebit + e.openingCredit - e.closingCredit);
      const movementCredit = Math.max(0, e.openingDebit - e.closingDebit + e.closingCredit - e.openingCredit);
      return {
        batchId: tbBatch.id,
        engagementId: eng1.id,
        rowNumber: idx + 1,
        accountCode: e.accountCode,
        accountName: e.accountName,
        openingDebit: e.openingDebit,
        openingCredit: e.openingCredit,
        closingDebit: e.closingDebit,
        closingCredit: e.closingCredit,
        closingBalance: e.closingDebit - e.closingCredit,
        openingBalance: e.openingDebit - e.openingCredit,
        movementDebit,
        movementCredit,
      };
    }),
  });

  console.log("  Creating ImportBatch and ImportAccountBalance/JournalLine for reconciliation...");
  const importBatch = await prisma.importBatch.create({
    data: {
      engagementId: eng1.id,
      batchNumber: "1",
      fileName: "Meridian_Tech_FY2024_Workbook.xlsx",
      status: "POSTED",
      totalRows: tbEntries.length * 2 + tbEntries.length,
      uploadedById: staff.id,
      obAccountCount: tbEntries.length,
      cbAccountCount: tbEntries.length,
    },
  });

  const obBalances = tbEntries.map(e => {
    const cls = SEED_CLASSIFICATION[e.accountCode];
    return {
      batchId: importBatch.id,
      engagementId: eng1.id,
      accountCode: e.accountCode,
      accountName: e.accountName,
      balanceType: "OB",
      asOfDate: new Date("2024-01-01"),
      debitAmount: e.openingDebit,
      creditAmount: e.openingCredit,
      ...(cls ? { accountClass: cls.accountClass, accountSubclass: cls.accountSubclass, fsHeadKey: cls.fsHeadKey, classificationSource: "RULE", classificationConfidence: 95.0 } : {}),
    };
  });
  const cbBalances = tbEntries.map(e => {
    const cls = SEED_CLASSIFICATION[e.accountCode];
    return {
      batchId: importBatch.id,
      engagementId: eng1.id,
      accountCode: e.accountCode,
      accountName: e.accountName,
      balanceType: "CB",
      asOfDate: new Date("2024-12-31"),
      debitAmount: e.closingDebit,
      creditAmount: e.closingCredit,
      ...(cls ? { accountClass: cls.accountClass, accountSubclass: cls.accountSubclass, fsHeadKey: cls.fsHeadKey, classificationSource: "RULE", classificationConfidence: 95.0 } : {}),
    };
  });
  await prisma.importAccountBalance.createMany({ data: [...obBalances, ...cbBalances] });

  const journalLines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
  for (const e of tbEntries) {
    const movement = (e.closingDebit - e.closingCredit) - (e.openingDebit - e.openingCredit);
    if (Math.abs(movement) < 0.01) continue;
    if (movement > 0) {
      journalLines.push({ accountCode: e.accountCode, accountName: e.accountName, debit: movement, credit: 0 });
    } else {
      journalLines.push({ accountCode: e.accountCode, accountName: e.accountName, debit: 0, credit: Math.abs(movement) });
    }
  }

  let totalJournalDebit = journalLines.reduce((s, l) => s + l.debit, 0);
  let totalJournalCredit = journalLines.reduce((s, l) => s + l.credit, 0);

  const balancingDiff = totalJournalDebit - totalJournalCredit;
  if (Math.abs(balancingDiff) >= 0.01) {
    if (balancingDiff > 0) {
      journalLines.push({ accountCode: "9999", accountName: "Suspense / Balancing", debit: 0, credit: balancingDiff });
      totalJournalCredit += balancingDiff;
    } else {
      journalLines.push({ accountCode: "9999", accountName: "Suspense / Balancing", debit: Math.abs(balancingDiff), credit: 0 });
      totalJournalDebit += Math.abs(balancingDiff);
    }
  }

  const journalHeader = await prisma.importJournalHeader.create({
    data: {
      batchId: importBatch.id,
      engagementId: eng1.id,
      journalId: "JV-SEED-001",
      voucherNo: "JV-SEED-001",
      voucherType: "General",
      voucherDate: new Date("2024-12-31"),
      periodKey: "2024-12",
      sourceModule: "GL",
      totalDebit: totalJournalDebit,
      totalCredit: totalJournalCredit,
      isBalanced: true,
      lineCount: journalLines.length,
    },
  });

  await prisma.importJournalLine.createMany({
    data: journalLines.map((l, idx) => ({
      journalHeaderId: journalHeader.id,
      lineNo: idx + 1,
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.debit,
      credit: l.credit,
    })),
  });

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: { glLineCount: journalLines.length },
  });

  console.log(`  Created ImportBatch with ${obBalances.length} OB + ${cbBalances.length} CB balances and ${journalLines.length} journal lines`);

  try {
    const syncResult = await syncTbToFsMapping(eng1.id, staff.id);
    console.log(`  FS Mapping sync completed: ${syncResult.success ? 'success' : syncResult.error}`);
  } catch (e) {
    console.log("  FS Mapping sync skipped");
  }

  console.log("  Creating Chart of Accounts (all mapped)...");
  const coaAccounts = tbEntries.map(e => {
    const fsLineMap: Record<string, string> = {
      "1101": "Cash and Bank Balances", "1102": "Cash and Bank Balances", "1103": "Cash and Bank Balances",
      "1104": "Cash and Bank Balances", "1105": "Cash and Bank Balances",
      "1201": "Short Term Investments",
      "1301": "Trade Receivables", "1302": "Trade Receivables",
      "1401": "Prepayments and Advances",
      "1501": "Inventories", "1502": "Inventories",
      "1601": "Property, Plant and Equipment", "1602": "Property, Plant and Equipment",
      "1603": "Property, Plant and Equipment", "1604": "Property, Plant and Equipment",
      "1701": "Intangible Assets", "1702": "Intangible Assets",
      "2101": "Trade and Other Payables", "2102": "Trade and Other Payables",
      "2201": "Current Tax Liabilities",
      "2301": "Long Term Borrowings",
      "3101": "Share Capital", "3201": "Retained Earnings",
      "4101": "Revenue", "4102": "Revenue", "4103": "Revenue", "4104": "Revenue",
      "5101": "Employee Costs", "5102": "Cost of Services",
      "5201": "Administrative Expenses", "5202": "Administrative Expenses",
      "5301": "Depreciation", "5302": "Amortization",
      "5401": "Selling and Distribution Expenses",
      "5501": "Finance Costs", "5601": "Tax Expense",
    };
    const classMap: Record<string, string> = {
      "1": "Assets", "2": "Liabilities", "3": "Equity", "4": "Revenue", "5": "Expenses",
    };
    return {
      engagementId: eng1.id,
      accountCode: e.accountCode,
      accountName: e.accountName,
      accountClass: classMap[e.accountCode[0]] || "Other",
      nature: (e.closingDebit > 0 ? "DR" : "CR") as "DR" | "CR",
      fsLineItem: fsLineMap[e.accountCode] || null,
      openingBalance: e.openingDebit - e.openingCredit,
      periodDr: e.closingDebit > e.openingDebit ? e.closingDebit - e.openingDebit : 0,
      periodCr: e.closingCredit > e.openingCredit ? e.closingCredit - e.openingCredit : 0,
      closingBalance: e.closingDebit - e.closingCredit,
    };
  });

  for (const coa of coaAccounts) {
    await prisma.coAAccount.upsert({
      where: { engagementId_accountCode: { engagementId: eng1.id, accountCode: coa.accountCode } },
      update: { fsLineItem: coa.fsLineItem },
      create: coa,
    });
  }

  console.log("  Creating summary run (all checks passing)...");
  await prisma.summaryRun.create({
    data: {
      engagementId: eng1.id,
      uploadVersionId: upload.id,
      runNumber: 1,
      tbRowCount: 36,
      glEntryCount: 12840,
      tbOpeningDebitTotal: 490000000,
      tbOpeningCreditTotal: 490000000,
      tbClosingDebitTotal: 1047500000,
      tbClosingCreditTotal: 1047500000,
      tbMovementDebitTotal: 567500000,
      tbMovementCreditTotal: 567500000,
      glDebitTotal: 567500000,
      glCreditTotal: 567500000,
      tbArithmeticStatus: "PASS",
      tbArithmeticMessage: "TB debits equal credits for both opening and closing balances",
      glDrCrStatus: "PASS",
      glDrCrMessage: "GL debits equal credits",
      tbGlTieOutStatus: "PASS",
      tbGlTieOutMessage: "TB movements reconcile to GL totals within tolerance",
      tbGlMovementDiff: 0,
      tbGlTotalsStatus: "PASS",
      tbGlTotalsMessage: "TB and GL totals are consistent",
      tbTotalDebit: 1047500000,
      tbTotalCredit: 1047500000,
      deltaDR: 0,
      deltaCR: 0,
      roundingTolerance: 1,
      overallStatus: "PASS",
      exceptionCount: 0,
      criticalExceptionCount: 0,
      createdById: staff.id,
    },
  });

  console.log("  Creating mapping session (reconciled)...");
  await prisma.mappingSession.create({
    data: {
      engagementId: eng1.id,
      firmId: firm.id,
      sessionNumber: 1,
      sessionName: "FY2024 TB-GL Reconciliation",
      tbBatchId: tbBatch.id,
      glBatchId: glBatch.id,
      status: "APPROVED",
      tbTotalClosingDebit: 1047500000,
      tbTotalClosingCredit: 1047500000,
      glTotalDebit: 567500000,
      glTotalCredit: 567500000,
      isReconciled: true,
      reconciledDifference: 0,
      toleranceAmount: 1,
      withinTolerance: true,
      matchedCount: 36,
      differenceCount: 0,
      missingInGLCount: 0,
      missingInTBCount: 0,
      createdById: manager.id,
      reviewedById: manager.id,
      reviewedAt: new Date("2025-01-20"),
      approvedById: partner.id,
      approvedAt: new Date("2025-01-22"),
    },
  });

  console.log("  Creating materiality set (approved)...");
  await prisma.materialitySet.create({
    data: {
      engagementId: eng1.id,
      versionId: 1,
      status: "APPROVED",
      benchmarkType: "REVENUE",
      benchmarkAmount: 478500000,
      percentApplied: 1.5,
      overallMateriality: 7177500,
      performanceMateriality: 5383125,
      trivialThreshold: 358875,
      rationale: "Revenue selected as benchmark: stable measure for growth-stage technology company per ISA 320. 1.5% applied given low-to-medium risk profile.",
      isaReference: "ISA 320",
      preparedById: senior.id,
      preparedAt: new Date("2025-01-15"),
      reviewedById: manager.id,
      reviewedAt: new Date("2025-01-18"),
      approvedById: partner.id,
      approvedAt: new Date("2025-01-20"),
    },
  });

  console.log("  Creating populations and samples...");
  const populationTemplates = [
    {
      name: "Revenue Transactions - FY2024",
      sourceType: "GL_JOURNAL" as const,
      accountCodes: ["4101", "4102", "4103", "4104"],
      populationCount: 856,
      populationValue: 478500000,
      status: "COMPLETED" as const,
      sampleMethod: "MONETARY_UNIT_SAMPLING" as const,
      targetSize: 40,
      actualSize: 40,
      sampleStatus: "APPROVED",
    },
    {
      name: "Trade Receivables Confirmations",
      sourceType: "CONFIRMATION_AR" as const,
      accountCodes: ["1301"],
      populationCount: 145,
      populationValue: 110000000,
      status: "COMPLETED" as const,
      sampleMethod: "MONETARY_UNIT_SAMPLING" as const,
      targetSize: 35,
      actualSize: 35,
      sampleStatus: "APPROVED",
    },
    {
      name: "Fixed Assets - Additions FY2024",
      sourceType: "GL_JOURNAL" as const,
      accountCodes: ["1601", "1602", "1603"],
      populationCount: 423,
      populationValue: 169000000,
      status: "COMPLETED" as const,
      sampleMethod: "NON_STATISTICAL_JUDGMENTAL" as const,
      targetSize: 25,
      actualSize: 25,
      sampleStatus: "APPROVED",
    },
    {
      name: "Inventory - Year-End Count",
      sourceType: "SUBLEDGER" as const,
      accountCodes: ["1501", "1502"],
      populationCount: 312,
      populationValue: 62000000,
      status: "COMPLETED" as const,
      sampleMethod: "STATISTICAL_RANDOM" as const,
      targetSize: 50,
      actualSize: 50,
      sampleStatus: "APPROVED",
    },
  ];

  for (const pt of populationTemplates) {
    const pop = await prisma.populationDefinition.create({
      data: {
        engagementId: eng1.id,
        name: pt.name,
        sourceType: pt.sourceType,
        accountCodes: pt.accountCodes,
        dateRangeStart: new Date("2024-01-01"),
        dateRangeEnd: new Date("2024-12-31"),
        populationCount: pt.populationCount,
        populationValue: pt.populationValue,
        status: pt.status,
        builtAt: new Date("2025-01-25"),
        builtById: senior.id,
        validatedAt: new Date("2025-01-28"),
        validatedById: manager.id,
        isaReference: "ISA 530",
      },
    });

    await prisma.sample.create({
      data: {
        populationId: pop.id,
        engagementId: eng1.id,
        sampleRef: `SMP-${pt.accountCodes[0]}-001`,
        method: pt.sampleMethod,
        targetSize: pt.targetSize,
        actualSize: pt.actualSize,
        confidenceLevel: 95,
        status: pt.sampleStatus,
        generatedAt: new Date("2025-01-28"),
        generatedById: senior.id,
        exceptionsCount: 0,
        conclusion: "Sample testing completed with no exceptions noted.",
        conclusionDate: new Date("2025-02-15"),
        conclusionById: manager.id,
        isaReference: "ISA 530",
      },
    });
  }

  console.log("  Workflow demo data seeded successfully!");
}

async function reseedEngagementImportData(engagementId: string, engagementCode: string, staffId: string) {
  console.log(`  [${engagementCode}] Force-reseeding import data from DEMO_TB_DATA/DEMO_GL_ENTRIES...`);

  await prisma.mappingSession.deleteMany({ where: { engagementId } }).catch(() => {});
  await prisma.fSMappingSuggestion.deleteMany({ where: { engagementId } }).catch(() => {});
  await prisma.gLEntry.deleteMany({ where: { engagementId } });
  await prisma.gLBatch.deleteMany({ where: { engagementId } });
  await prisma.tBEntry.deleteMany({ where: { engagementId } });
  await prisma.tBBatch.deleteMany({ where: { engagementId } });
  await prisma.coAAccount.deleteMany({ where: { engagementId } });
  await prisma.importBankBalance.deleteMany({ where: { engagementId } });
  await prisma.importBankAccount.deleteMany({ where: { engagementId } });
  await prisma.importPartyBalance.deleteMany({ where: { engagementId } });
  await prisma.importJournalLine.deleteMany({
    where: { journalHeader: { engagementId } },
  });
  await prisma.importJournalHeader.deleteMany({ where: { engagementId } });
  await prisma.importAccountBalance.deleteMany({ where: { engagementId } });
  await prisma.summaryRun.deleteMany({ where: { engagementId } });
  await prisma.uploadVersion.deleteMany({ where: { engagementId } });
  await prisma.mappingAllocation.deleteMany({ where: { engagementId } });
  await prisma.coAFSMappingVersion.deleteMany({ where: { engagementId } });
  await prisma.draftFSSnapshot.deleteMany({ where: { engagementId } });
  await prisma.fSLine.deleteMany({ where: { engagementId } });
  await prisma.fSHead.deleteMany({ where: { engagementId } });
  await prisma.reconIssue.deleteMany({ where: { engagementId } });
  await prisma.reconGateStatus.deleteMany({ where: { engagementId } }).catch(() => {});
  await prisma.importBatch.deleteMany({ where: { engagementId } });

  const importBatch = await prisma.importBatch.create({
    data: {
      engagementId,
      batchNumber: "1",
      fileName: "Meridian_Tech_FY2024_Workbook.xlsx",
      status: "POSTED",
      totalRows: DEMO_TB_DATA.length * 2 + DEMO_GL_ENTRIES.length,
      uploadedById: staffId,
      obAccountCount: DEMO_TB_DATA.length,
      cbAccountCount: DEMO_TB_DATA.length,
      glLineCount: DEMO_GL_ENTRIES.length,
    },
  });

  const obBalances: any[] = [];
  for (const tb of DEMO_TB_DATA) {
    const ob = tb.openingBalance;
    const cls = SEED_CLASSIFICATION[tb.glCode];
    obBalances.push({
      batchId: importBatch.id,
      engagementId,
      accountCode: tb.glCode,
      accountName: tb.glName,
      balanceType: "OB",
      asOfDate: new Date("2024-01-01"),
      debitAmount: ob >= 0 ? ob : 0,
      creditAmount: ob < 0 ? Math.abs(ob) : 0,
      ...(cls ? { accountClass: cls.accountClass, accountSubclass: cls.accountSubclass, fsHeadKey: cls.fsHeadKey, classificationSource: "RULE", classificationConfidence: 95.0 } : {}),
    });
  }

  const cbBalances: any[] = [];
  for (const tb of DEMO_TB_DATA) {
    const cls = SEED_CLASSIFICATION[tb.glCode];
    cbBalances.push({
      batchId: importBatch.id,
      engagementId,
      accountCode: tb.glCode,
      accountName: tb.glName,
      balanceType: "CB",
      asOfDate: new Date("2024-12-31"),
      debitAmount: tb.closingDebit,
      creditAmount: tb.closingCredit,
      ...(cls ? { accountClass: cls.accountClass, accountSubclass: cls.accountSubclass, fsHeadKey: cls.fsHeadKey, classificationSource: "RULE", classificationConfidence: 95.0 } : {}),
    });
  }

  await prisma.importAccountBalance.createMany({ data: [...obBalances, ...cbBalances] });

  const journalGroups = new Map<string, typeof DEMO_GL_ENTRIES>();
  for (const gl of DEMO_GL_ENTRIES) {
    if (!journalGroups.has(gl.voucherNo)) journalGroups.set(gl.voucherNo, []);
    journalGroups.get(gl.voucherNo)!.push(gl);
  }

  for (const [voucherNo, lines] of journalGroups) {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    const firstLine = lines[0];
    const dateParts = firstLine.postingDate.split('/');
    const voucherDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]));

    const header = await prisma.importJournalHeader.create({
      data: {
        batchId: importBatch.id,
        engagementId,
        journalId: voucherNo,
        voucherNo,
        voucherType: firstLine.voucherType || "General",
        voucherDate,
        periodKey: `${voucherDate.getFullYear()}-${String(voucherDate.getMonth() + 1).padStart(2, '0')}`,
        sourceModule: "GL",
        totalDebit,
        totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        lineCount: lines.length,
      },
    });

    await prisma.importJournalLine.createMany({
      data: lines.map((l, idx) => ({
        journalHeaderId: header.id,
        lineNo: idx + 1,
        accountCode: l.glCode,
        accountName: l.glName,
        debit: l.debit,
        credit: l.credit,
      })),
    });
  }

  console.log(`  [${engagementCode}] Reseeded ImportBatch with ${obBalances.length} OB + ${cbBalances.length} CB balances and ${DEMO_GL_ENTRIES.length} GL lines (${journalGroups.size} vouchers)`);

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { periodEnd: true },
  });
  const periodEnd = engagement?.periodEnd || new Date("2024-12-31");

  await prisma.importPartyBalance.deleteMany({ where: { engagementId } });
  const arPartyData = DEMO_AR_PARTIES.map(ar => {
    const netBalance = ar.closingDebit - ar.closingCredit;
    return {
      batchId: importBatch.id,
      engagementId,
      partyCode: ar.customerId,
      partyName: ar.customerName,
      partyType: "CUSTOMER" as const,
      controlAccountCode: ar.glCode,
      balance: Math.abs(netBalance),
      drcr: netBalance >= 0 ? "DR" as const : "CR" as const,
      balanceType: "CB",
      asOfDate: periodEnd,
      partyEmail: ar.email,
    };
  });
  const apPartyData = DEMO_AP_PARTIES.map(ap => {
    const netBalance = ap.closingDebit - ap.closingCredit;
    return {
      batchId: importBatch.id,
      engagementId,
      partyCode: ap.vendorId,
      partyName: ap.vendorName,
      partyType: "VENDOR" as const,
      controlAccountCode: ap.glCode,
      balance: Math.abs(netBalance),
      drcr: netBalance >= 0 ? "DR" as const : "CR" as const,
      balanceType: "CB",
      asOfDate: periodEnd,
      partyEmail: ap.email,
    };
  });
  await prisma.importPartyBalance.createMany({ data: [...arPartyData, ...apPartyData] });
  console.log(`  [${engagementCode}] Seeded ${arPartyData.length} AR + ${apPartyData.length} AP party balances`);

  await prisma.importBankBalance.deleteMany({ where: { engagementId } });
  await prisma.importBankAccount.deleteMany({ where: { engagementId } });
  for (const bank of DEMO_BANK_MASTER) {
    await prisma.importBankAccount.create({
      data: {
        batchId: importBatch.id,
        engagementId,
        bankAccountCode: bank.bankAccountId,
        bankName: bank.bankName,
        accountNo: bank.accountNumber,
        accountTitle: `${bank.bankName} - ${bank.accountType}`,
        branchName: bank.branch,
        currency: bank.currency,
      },
    });
  }
  for (const bal of DEMO_BANK_BALANCES) {
    const master = DEMO_BANK_MASTER.find(m => m.bankAccountId === bal.bankAccountId);
    if (master) {
      await prisma.importBankBalance.create({
        data: {
          batchId: importBatch.id,
          engagementId,
          bankAccountCode: bal.bankAccountId,
          glBankAccountCode: master.glCode,
          closingBalance: Math.abs(bal.bookBalance),
          drcr: bal.bookBalance >= 0 ? "DR" : "CR",
          asOfDate: periodEnd,
        },
      });
    }
  }
  console.log(`  [${engagementCode}] Seeded ${DEMO_BANK_MASTER.length} bank accounts + ${DEMO_BANK_BALANCES.length} bank balances`);

  await prisma.confirmationPopulation.deleteMany({ where: { engagementId } });
  const arByControl = new Map<string, { total: number; count: number; name: string }>();
  for (const ar of arPartyData) {
    const existing = arByControl.get(ar.controlAccountCode) || { total: 0, count: 0, name: '' };
    const signed = ar.drcr === 'CR' ? -ar.balance : ar.balance;
    existing.total += signed;
    existing.count += 1;
    existing.name = 'Trade Receivables';
    arByControl.set(ar.controlAccountCode, existing);
  }
  const apByControl = new Map<string, { total: number; count: number; name: string }>();
  for (const ap of apPartyData) {
    const existing = apByControl.get(ap.controlAccountCode) || { total: 0, count: 0, name: '' };
    const signed = ap.drcr === 'CR' ? -ap.balance : ap.balance;
    existing.total += signed;
    existing.count += 1;
    existing.name = 'Trade Payables';
    apByControl.set(ap.controlAccountCode, existing);
  }
  const confirmationData: any[] = [];
  for (const [code, data] of arByControl) {
    confirmationData.push({
      engagementId,
      confirmationType: "DEBTORS",
      balancePerBooks: data.total,
      controlAccountCode: code,
      controlAccountName: data.name,
      totalParties: data.count,
      status: "DRAFT",
    });
  }
  for (const [code, data] of apByControl) {
    confirmationData.push({
      engagementId,
      confirmationType: "CREDITORS",
      balancePerBooks: Math.abs(data.total),
      controlAccountCode: code,
      controlAccountName: data.name,
      totalParties: data.count,
      status: "DRAFT",
    });
  }
  for (const bankBal of DEMO_BANK_BALANCES) {
    const master = DEMO_BANK_MASTER.find(m => m.bankAccountId === bankBal.bankAccountId);
    if (master) {
      confirmationData.push({
        engagementId,
        confirmationType: "BANK",
        balancePerBooks: Math.abs(bankBal.bookBalance),
        controlAccountCode: master.glCode,
        controlAccountName: `${master.bankName} - ${master.accountType}`,
        totalParties: 1,
        status: "DRAFT",
      });
    }
  }
  if (confirmationData.length > 0) {
    await prisma.confirmationPopulation.createMany({ data: confirmationData });
  }
  console.log(`  [${engagementCode}] Auto-created ${confirmationData.length} confirmation populations (AR/AP/Bank)`);

  await prisma.uploadVersion.deleteMany({ where: { engagementId } });
  await prisma.uploadVersion.create({
    data: {
      engagementId,
      version: 1,
      fileName: "Meridian_Tech_FY2024_Workbook.xlsx",
      status: "ACTIVE",
      uploadedById: staffId,
    },
  });

  const tbObDr = obBalances.reduce((s: number, b: any) => s + (b.debitAmount || 0), 0);
  const tbObCr = obBalances.reduce((s: number, b: any) => s + (b.creditAmount || 0), 0);
  const tbCbDr = cbBalances.reduce((s: number, b: any) => s + (b.debitAmount || 0), 0);
  const tbCbCr = cbBalances.reduce((s: number, b: any) => s + (b.creditAmount || 0), 0);
  const glDr = DEMO_GL_ENTRIES.reduce((s, e) => s + e.debit, 0);
  const glCr = DEMO_GL_ENTRIES.reduce((s, e) => s + e.credit, 0);
  const tbMvtDr = tbCbDr - tbObDr;
  const tbMvtCr = tbCbCr - tbObCr;
  const uploadVersion = await prisma.uploadVersion.findFirst({ where: { engagementId } });

  await prisma.summaryRun.deleteMany({ where: { engagementId } });
  await prisma.summaryRun.create({
    data: {
      engagementId,
      uploadVersionId: uploadVersion!.id,
      runNumber: 1,
      tbRowCount: DEMO_TB_DATA.length,
      glEntryCount: DEMO_GL_ENTRIES.length,
      apRowCount: apPartyData.length,
      arRowCount: arPartyData.length,
      bankRowCount: DEMO_BANK_BALANCES.length,
      partyCount: arPartyData.length + apPartyData.length,
      tbOpeningDebitTotal: tbObDr,
      tbOpeningCreditTotal: tbObCr,
      tbClosingDebitTotal: tbCbDr,
      tbClosingCreditTotal: tbCbCr,
      tbMovementDebitTotal: tbMvtDr > 0 ? tbMvtDr : 0,
      tbMovementCreditTotal: tbMvtCr > 0 ? tbMvtCr : 0,
      glDebitTotal: glDr,
      glCreditTotal: glCr,
      tbArithmeticStatus: Math.abs(tbCbDr - tbCbCr) < 1 && Math.abs(tbObDr - tbObCr) < 1 ? "PASS" : "FAIL",
      glDrCrStatus: Math.abs(glDr - glCr) < 1 ? "PASS" : "FAIL",
      tbGlTieOutStatus: "PASS",
      tbGlTotalsStatus: "PASS",
      overallStatus: "PASS",
      createdById: staffId,
    },
  });
  console.log(`  [${engagementCode}] Created SummaryRun and UploadVersion`);

  try {
    const { syncImportDataToCore } = await import("../services/importSyncService");
    const syncCoreResult = await syncImportDataToCore(engagementId, staffId);
    console.log(`  [${engagementCode}] Core sync: TB=${syncCoreResult.counts.tbEntries} entries, GL=${syncCoreResult.counts.glEntries} entries, CoA=${syncCoreResult.counts.coaAccounts}`);
  } catch (e) {
    console.error(`  [${engagementCode}] Core sync failed:`, e);
  }

  try {
    const fixResult = await autoFixDeterministic(engagementId, staffId);
    console.log(`  [${engagementCode}] Auto-fix completed: fixed=${fixResult.fixed}, needsReview=${fixResult.needsReview}`);
  } catch (e) {
    console.log(`  [${engagementCode}] Auto-fix skipped`);
  }

  try {
    const syncResult = await syncTbToFsMapping(engagementId, staffId);
    console.log(`  [${engagementCode}] FS Mapping sync completed: ${syncResult.success ? 'success' : syncResult.error}`);
  } catch (e) {
    console.log(`  [${engagementCode}] FS Mapping sync skipped`);
  }

  console.log(`  [${engagementCode}] Import data reseed complete!`);
}

async function ensureImportData() {
  const staff = await prisma.user.findFirst({ where: { email: "staff@auditwise.pk" } });
  if (!staff) {
    console.log("  Staff user not found, skipping import data seeding");
    return;
  }

  const engagements = await prisma.engagement.findMany({
    where: { engagementCode: { in: ["ENG-2025-001", "ENG-2025-002"] } },
    select: { id: true, engagementCode: true },
  });

  for (const eng of engagements) {
    try {
      const hasPartyData = await prisma.importPartyBalance.count({ where: { engagementId: eng.id } });
      const hasBankData = await prisma.importBankBalance.count({ where: { engagementId: eng.id } });
      const hasUploadVersion = await prisma.uploadVersion.count({ where: { engagementId: eng.id } });
      const hasCorrectFsHeads = await prisma.fSHead.count({ where: { engagementId: eng.id, code: "ASSETS_CURRENT" } });
      const passingSnapshot = await prisma.draftFSSnapshot.findFirst({ where: { engagementId: eng.id, bsFootingPass: true } });
      if (hasPartyData > 0 && hasBankData > 0 && hasUploadVersion > 0 && hasCorrectFsHeads > 0 && passingSnapshot) {
        console.log(`  [${eng.engagementCode}] Import data already exists, skipping...`);
        continue;
      }
      console.log(`  [${eng.engagementCode}] Seeding import data (party/bank/sync)...`);
      await reseedEngagementImportData(eng.id, eng.engagementCode, staff.id);
    } catch (err) {
      console.error(`  [${eng.engagementCode}] Failed to seed import data:`, err);
    }
  }

  const eng3 = await prisma.engagement.findFirst({
    where: { engagementCode: "ENG-2026-003" },
    select: { id: true },
  });
  if (eng3) {
    const eng3ImportCount = await prisma.importBatch.count({ where: { engagementId: eng3.id } });
    if (eng3ImportCount > 0) {
      console.log("  [ENG-2026-003] Import data already exists, skipping...");
    } else {
      console.log("  [ENG-2026-003] Import data will be seeded via seedAlBarakaFinancialData");
    }
  }
}

export async function reseedImportData() {
  console.log("Reseeding import data for clean TB-GL reconciliation...");

  const staff = await prisma.user.findFirst({ where: { email: "staff@auditwise.pk" } });
  if (!staff) return;

  const engagements = await prisma.engagement.findMany({
    where: { engagementCode: { in: ["ENG-2025-001", "ENG-2025-002"] } },
    select: { id: true, engagementCode: true },
  });

  for (const eng of engagements) {
    await reseedEngagementImportData(eng.id, eng.engagementCode, staff.id);
  }

  console.log("  Import data reseed complete for all engagements!");
}
