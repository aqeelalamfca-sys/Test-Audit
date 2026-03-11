import { Router, Request, Response } from "express";
import { prisma } from "./db";
import type { CoAAccount } from "@prisma/client";

const router = Router();

router.get("/api/engagements/:engagementId/coa", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const accounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      orderBy: { accountCode: "asc" },
    });

    res.json(accounts);
  } catch (error) {
    console.error("Error fetching CoA accounts:", error);
    res.status(500).json({ error: "Failed to fetch Chart of Accounts" });
  }
});

router.post("/api/engagements/:engagementId/coa", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      accountCode,
      accountName,
      accountClass,
      accountSubclass,
      nature,
      tbGroup,
      fsLineItem,
      notesDisclosureRef,
      openingBalance,
      periodDr,
      periodCr,
      closingBalance,
    } = req.body;

    if (!accountCode || !accountName) {
      return res.status(400).json({ error: "Account code and name are required" });
    }

    const existing = await prisma.coAAccount.findUnique({
      where: {
        engagementId_accountCode: {
          engagementId,
          accountCode,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ error: "Account code already exists" });
    }

    const account = await prisma.coAAccount.create({
      data: {
        engagementId,
        accountCode,
        accountName,
        accountClass,
        accountSubclass,
        nature: nature || "DR",
        tbGroup,
        fsLineItem,
        notesDisclosureRef,
        openingBalance: openingBalance || 0,
        periodDr: periodDr || 0,
        periodCr: periodCr || 0,
        closingBalance: closingBalance || 0,
      },
    });

    res.status(201).json(account);
  } catch (error) {
    console.error("Error creating CoA account:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/api/engagements/:engagementId/coa/bulk", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { accounts } = req.body;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: "Accounts array is required" });
    }

    // Delete existing accounts for this engagement first (replace mode)
    const deleted = await prisma.coAAccount.deleteMany({
      where: { engagementId },
    });

    // Create all accounts in bulk using createMany for efficiency
    const accountsData = accounts.map((account: any) => ({
      engagementId,
      accountCode: account.accountCode || "",
      accountName: account.accountName || "",
      accountClass: account.accountClass || null,
      accountSubclass: account.accountSubclass || null,
      nature: account.nature === "CR" ? "CR" as const : "DR" as const,
      tbGroup: account.tbGroup || null,
      fsLineItem: account.fsLineItem || null,
      notesDisclosureRef: account.notesDisclosureRef || null,
      openingBalance: account.openingBalance || 0,
      periodDr: account.periodDr || 0,
      periodCr: account.periodCr || 0,
      closingBalance: account.closingBalance || 0,
    }));

    await prisma.coAAccount.createMany({
      data: accountsData,
    });

    // Fetch the created accounts to return them
    const createdAccounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      orderBy: { accountCode: "asc" },
    });

    res.status(201).json(createdAccounts);
  } catch (error) {
    console.error("Error bulk creating CoA accounts:", error);
    res.status(500).json({ error: "Failed to create accounts", details: String(error) });
  }
});

router.patch("/api/coa/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      accountCode,
      accountName,
      accountClass,
      accountSubclass,
      nature,
      tbGroup,
      fsLineItem,
      notesDisclosureRef,
      isOverridden,
      overrideLockedAt,
      openingBalance,
      periodDr,
      periodCr,
      closingBalance,
    } = req.body;

    const account = await prisma.coAAccount.update({
      where: { id },
      data: {
        ...(accountCode !== undefined && { accountCode }),
        ...(accountName !== undefined && { accountName }),
        ...(accountClass !== undefined && { accountClass }),
        ...(accountSubclass !== undefined && { accountSubclass }),
        ...(nature !== undefined && { nature }),
        ...(tbGroup !== undefined && { tbGroup }),
        ...(fsLineItem !== undefined && { fsLineItem }),
        ...(notesDisclosureRef !== undefined && { notesDisclosureRef }),
        ...(isOverridden !== undefined && { isOverridden }),
        ...(overrideLockedAt !== undefined && { overrideLockedAt: overrideLockedAt ? new Date(overrideLockedAt) : null }),
        ...(openingBalance !== undefined && { openingBalance }),
        ...(periodDr !== undefined && { periodDr }),
        ...(periodCr !== undefined && { periodCr }),
        ...(closingBalance !== undefined && { closingBalance }),
      },
    });

    res.json(account);
  } catch (error) {
    console.error("Error updating CoA account:", error);
    res.status(500).json({ error: "Failed to update account" });
  }
});

router.delete("/api/coa/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await prisma.coAAccount.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting CoA account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

router.post("/api/engagements/:engagementId/coa/ai-suggest", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const accounts = await prisma.coAAccount.findMany({
      where: { engagementId },
    });

    if (accounts.length === 0) {
      return res.json({ suggestions: [] });
    }

    const suggestions = accounts.map((account) => {
      const name = account.accountName.toLowerCase();
      const existingClass = account.accountClass || "";
      let tbGroup = "";
      let fsLineItem = "";
      let accountSubclass = "";
      let notesDisclosureRef = "";
      let confidence = 0.7;
      let rationale = "";

      // Comprehensive mapping based on account name patterns
      if (name.includes("cash") || name.includes("bank") || name.includes("petty cash")) {
        tbGroup = "CASH_BANK";
        fsLineItem = "CASH_EQUIVALENTS";
        accountSubclass = "CURRENT_ASSET";
        notesDisclosureRef = "Note 5";
        confidence = 0.95;
        rationale = "Account name contains cash/bank indicators typically mapped to Cash and Cash Equivalents.";
      } else if (name.includes("trade receivable") || name.includes("accounts receivable") || name.includes("debtors")) {
        tbGroup = "TRADE_RECEIVABLES";
        fsLineItem = "TRADE_RECEIVABLES";
        accountSubclass = "CURRENT_ASSET";
        notesDisclosureRef = "Note 6";
        confidence = 0.92;
        rationale = "Account indicates trade receivables based on naming convention.";
      } else if (name.includes("other receivable") || name.includes("advance") || name.includes("deposit")) {
        tbGroup = "OTHER_RECEIVABLES";
        fsLineItem = "OTHER_RECEIVABLES";
        accountSubclass = "CURRENT_ASSET";
        notesDisclosureRef = "Note 7";
        confidence = 0.88;
        rationale = "Other receivables/advances/deposits identified from naming pattern.";
      } else if (name.includes("prepaid") || name.includes("prepayment")) {
        tbGroup = "PREPAYMENTS";
        fsLineItem = "OTHER_CURRENT_ASSETS";
        accountSubclass = "CURRENT_ASSET";
        notesDisclosureRef = "Note 8";
        confidence = 0.90;
        rationale = "Prepayment account identified from naming pattern.";
      } else if (name.includes("inventory") || name.includes("stock") || name.includes("raw material") || name.includes("finished goods") || name.includes("work in progress")) {
        tbGroup = "INVENTORY";
        fsLineItem = "INVENTORIES";
        accountSubclass = "CURRENT_ASSET";
        notesDisclosureRef = "Note 7";
        confidence = 0.90;
        rationale = "Inventory-related account based on account name analysis.";
      } else if (name.includes("land") || name.includes("building") || name.includes("property") || name.includes("plant") || name.includes("machinery") || name.includes("equipment") || name.includes("vehicle") || name.includes("furniture") || name.includes("fixture")) {
        tbGroup = "FIXED_ASSETS";
        fsLineItem = "PPE";
        accountSubclass = "FIXED_ASSET";
        notesDisclosureRef = "Note 9";
        confidence = 0.88;
        rationale = "Fixed asset account identified from naming convention.";
      } else if (name.includes("accumulated depreciation") || name.includes("depreciation")) {
        tbGroup = "FIXED_ASSETS";
        fsLineItem = "PPE";
        accountSubclass = "FIXED_ASSET";
        notesDisclosureRef = "Note 9";
        confidence = 0.85;
        rationale = "Depreciation account typically linked to fixed assets.";
      } else if (name.includes("intangible") || name.includes("goodwill") || name.includes("patent") || name.includes("trademark") || name.includes("license") || name.includes("software")) {
        tbGroup = "INTANGIBLE_ASSETS";
        fsLineItem = "INTANGIBLE_ASSETS";
        accountSubclass = "INTANGIBLE_ASSET";
        notesDisclosureRef = "Note 10";
        confidence = 0.85;
        rationale = "Intangible asset identified from naming pattern.";
      } else if (name.includes("investment") || name.includes("securities") || name.includes("shares held") || name.includes("bonds held") || name.includes("equity investment")) {
        // Determine if short-term or long-term investment
        if (name.includes("short-term") || name.includes("short term") || name.includes("current") || name.includes("trading")) {
          tbGroup = "CURRENT_INVESTMENTS";
          fsLineItem = "SHORT_TERM_INVESTMENTS";
          accountSubclass = "CURRENT_ASSET";
          notesDisclosureRef = "Note 8";
          confidence = 0.85;
          rationale = "Short-term/current investment identified from naming pattern.";
        } else {
          tbGroup = "NON_CURRENT_INVESTMENTS";
          fsLineItem = "LONG_TERM_INVESTMENTS";
          accountSubclass = "NON_CURRENT_ASSET";
          notesDisclosureRef = "Note 10";
          confidence = 0.85;
          rationale = "Long-term investment identified from naming pattern.";
        }
      } else if (name.includes("right-of-use") || name.includes("right of use") || name.includes("rou asset") || name.includes("lease asset")) {
        tbGroup = "RIGHT_OF_USE_ASSETS";
        fsLineItem = "RIGHT_OF_USE_ASSETS";
        accountSubclass = "NON_CURRENT_ASSET";
        notesDisclosureRef = "Note 9";
        confidence = 0.88;
        rationale = "Right-of-use asset (IFRS 16) identified from naming pattern.";
      } else if (name.includes("allowance") || name.includes("provision for doubtful") || name.includes("impairment") || name.includes("expected credit loss") || name.includes("ecl")) {
        tbGroup = "TRADE_RECEIVABLES";
        fsLineItem = "TRADE_RECEIVABLES";
        accountSubclass = "CURRENT_ASSET";
        notesDisclosureRef = "Note 6";
        confidence = 0.88;
        rationale = "Allowance/impairment contra-asset identified from naming pattern.";
      } else if (name.includes("accrued income") || name.includes("interest receivable") || name.includes("unbilled revenue") || name.includes("contract asset")) {
        tbGroup = "OTHER_RECEIVABLES";
        fsLineItem = "OTHER_RECEIVABLES";
        accountSubclass = "CURRENT_ASSET";
        notesDisclosureRef = "Note 7";
        confidence = 0.85;
        rationale = "Accrued income/interest receivable identified from naming pattern.";
      } else if (name.includes("deferred tax asset")) {
        tbGroup = "DEFERRED_TAX_ASSETS";
        fsLineItem = "DEFERRED_TAX_ASSETS";
        accountSubclass = "NON_CURRENT_ASSET";
        notesDisclosureRef = "Note 16";
        confidence = 0.90;
        rationale = "Deferred tax asset identified from naming pattern.";
      } else if (name.includes("trade payable") || name.includes("accounts payable") || name.includes("creditors")) {
        tbGroup = "TRADE_PAYABLES";
        fsLineItem = "TRADE_PAYABLES";
        accountSubclass = "CURRENT_LIABILITY";
        notesDisclosureRef = "Note 11";
        confidence = 0.93;
        rationale = "Trade payables account identified from naming pattern.";
      } else if (name.includes("accrued") || name.includes("accrual")) {
        tbGroup = "ACCRUALS";
        fsLineItem = "OTHER_CURRENT_LIABILITIES";
        accountSubclass = "CURRENT_LIABILITY";
        notesDisclosureRef = "Note 12";
        confidence = 0.88;
        rationale = "Accrued expenses/liabilities identified from naming pattern.";
      } else if (name.includes("short-term loan") || name.includes("short term loan") || name.includes("overdraft") || name.includes("running finance")) {
        tbGroup = "BORROWINGS";
        fsLineItem = "SHORT_TERM_BORROWINGS";
        accountSubclass = "CURRENT_LIABILITY";
        notesDisclosureRef = "Note 13";
        confidence = 0.85;
        rationale = "Short-term borrowings identified from naming pattern.";
      } else if (name.includes("tax payable") || name.includes("sales tax") || name.includes("withholding tax") || name.includes("vat payable")) {
        tbGroup = "TAX_LIABILITIES";
        fsLineItem = "OTHER_CURRENT_LIABILITIES";
        accountSubclass = "CURRENT_LIABILITY";
        notesDisclosureRef = "Note 14";
        confidence = 0.90;
        rationale = "Tax liability account identified from naming pattern.";
      } else if (name.includes("long-term loan") || name.includes("long term loan") || name.includes("term finance") || name.includes("mortgage")) {
        tbGroup = "BORROWINGS";
        fsLineItem = "LONG_TERM_BORROWINGS";
        accountSubclass = "NON_CURRENT_LIABILITY";
        notesDisclosureRef = "Note 15";
        confidence = 0.85;
        rationale = "Long-term borrowings identified from naming pattern.";
      } else if (name.includes("lease liability") || name.includes("lease payable") || name.includes("finance lease")) {
        // Determine if short-term or long-term lease liability
        if (name.includes("current") || name.includes("short-term") || name.includes("short term")) {
          tbGroup = "LEASE_LIABILITIES";
          fsLineItem = "OTHER_CURRENT_LIABILITIES";
          accountSubclass = "CURRENT_LIABILITY";
          notesDisclosureRef = "Note 13";
          confidence = 0.88;
          rationale = "Current portion of lease liability (IFRS 16) identified from naming pattern.";
        } else {
          tbGroup = "LEASE_LIABILITIES";
          fsLineItem = "LONG_TERM_BORROWINGS";
          accountSubclass = "NON_CURRENT_LIABILITY";
          notesDisclosureRef = "Note 15";
          confidence = 0.88;
          rationale = "Non-current lease liability (IFRS 16) identified from naming pattern.";
        }
      } else if (name.includes("deferred tax")) {
        tbGroup = "DEFERRED_TAX";
        fsLineItem = "DEFERRED_TAX";
        accountSubclass = "NON_CURRENT_LIABILITY";
        notesDisclosureRef = "Note 16";
        confidence = 0.88;
        rationale = "Deferred tax liability identified from naming pattern.";
      } else if (name.includes("provision") && !name.includes("doubtful")) {
        tbGroup = "PROVISIONS";
        fsLineItem = "PROVISIONS";
        accountSubclass = "NON_CURRENT_LIABILITY";
        notesDisclosureRef = "Note 17";
        confidence = 0.82;
        rationale = "Provision account identified from naming pattern.";
      } else if (name.includes("share capital") || name.includes("ordinary shares") || name.includes("common stock") || name.includes("paid-up capital")) {
        tbGroup = "SHARE_CAPITAL";
        fsLineItem = "SHARE_CAPITAL";
        accountSubclass = "SHARE_CAPITAL";
        notesDisclosureRef = "Note 18";
        confidence = 0.92;
        rationale = "Share capital account identified from naming pattern.";
      } else if (name.includes("reserve") || name.includes("surplus") || name.includes("retained earnings")) {
        tbGroup = "RESERVES";
        fsLineItem = "RESERVES_SURPLUS";
        accountSubclass = "RESERVES";
        notesDisclosureRef = "Note 19";
        confidence = 0.88;
        rationale = "Reserves/surplus account identified from naming pattern.";
      } else if (name.includes("revenue") || name.includes("sales") || name.includes("service income") || name.includes("fee income") || name.includes("tuition") || (name.includes("income") && !name.includes("other income") && !name.includes("interest income") && !name.includes("dividend income") && !name.includes("tax"))) {
        tbGroup = "REVENUE";
        fsLineItem = "REVENUE_OPERATIONS";
        accountSubclass = "OPERATING_REVENUE";
        notesDisclosureRef = "Note 20";
        confidence = 0.90;
        rationale = "Revenue/income account based on naming analysis.";
      } else if (name.includes("other income") || name.includes("interest income") || name.includes("dividend income") || name.includes("gain on") || name.includes("miscellaneous income")) {
        tbGroup = "OTHER_INCOME";
        fsLineItem = "OTHER_INCOME";
        accountSubclass = "OTHER_INCOME";
        notesDisclosureRef = "Note 21";
        confidence = 0.85;
        rationale = "Other income account identified from naming pattern.";
      } else if (name.includes("cost of sales") || name.includes("cost of goods") || name.includes("direct cost") || name.includes("purchases") || name.includes("raw material consumed")) {
        tbGroup = "COST_OF_SALES";
        fsLineItem = "COST_MATERIALS";
        accountSubclass = "COST_OF_SALES";
        notesDisclosureRef = "Note 22";
        confidence = 0.90;
        rationale = "Cost of sales account identified from naming pattern.";
      } else if (name.includes("salary") || name.includes("wages") || name.includes("employee") || name.includes("staff cost") || name.includes("payroll")) {
        tbGroup = "OPERATING_EXPENSES";
        fsLineItem = "EMPLOYEE_BENEFITS";
        accountSubclass = "OPERATING_EXPENSE";
        notesDisclosureRef = "Note 23";
        confidence = 0.88;
        rationale = "Employee benefit expense identified from naming pattern.";
      } else if (name.includes("depreciation expense") || name.includes("amortization expense")) {
        tbGroup = "OPERATING_EXPENSES";
        fsLineItem = "DEPRECIATION_AMORTIZATION";
        accountSubclass = "OPERATING_EXPENSE";
        notesDisclosureRef = "Note 24";
        confidence = 0.88;
        rationale = "Depreciation/amortization expense identified from naming pattern.";
      } else if (name.includes("rent") || name.includes("utility") || name.includes("telephone") || name.includes("insurance") || name.includes("repair") || name.includes("maintenance") || name.includes("travel") || name.includes("office") || name.includes("admin") || name.includes("general expense")) {
        tbGroup = "OPERATING_EXPENSES";
        fsLineItem = "OTHER_EXPENSES";
        accountSubclass = "OPERATING_EXPENSE";
        notesDisclosureRef = "Note 24";
        confidence = 0.80;
        rationale = "Operating expense account identified from naming pattern.";
      } else if (name.includes("interest expense") || name.includes("finance cost") || name.includes("bank charge") || name.includes("markup")) {
        tbGroup = "FINANCE_COSTS";
        fsLineItem = "FINANCE_COSTS";
        accountSubclass = "FINANCE_COST";
        notesDisclosureRef = "Note 25";
        confidence = 0.90;
        rationale = "Finance cost/interest expense identified from naming pattern.";
      } else if (name.includes("income tax expense") || name.includes("tax expense") || name.includes("taxation")) {
        tbGroup = "TAXATION";
        fsLineItem = "TAX_EXPENSE";
        accountSubclass = "TAX_EXPENSE";
        notesDisclosureRef = "Note 26";
        confidence = 0.90;
        rationale = "Income tax expense identified from naming pattern.";
      } else if (name.includes("expense") || name.includes("cost")) {
        tbGroup = "OPERATING_EXPENSES";
        fsLineItem = "OTHER_EXPENSES";
        accountSubclass = "OPERATING_EXPENSE";
        notesDisclosureRef = "Note 24";
        confidence = 0.70;
        rationale = "General expense account - may require manual review for specific classification.";
      } else if (name.includes("loan") || name.includes("borrowing")) {
        tbGroup = "BORROWINGS";
        fsLineItem = "LONG_TERM_BORROWINGS";
        accountSubclass = "NON_CURRENT_LIABILITY";
        notesDisclosureRef = "Note 15";
        confidence = 0.75;
        rationale = "Borrowings account - review for short-term vs long-term classification.";
      } else if (name.includes("capital")) {
        tbGroup = "SHARE_CAPITAL";
        fsLineItem = "SHARE_CAPITAL";
        accountSubclass = "SHARE_CAPITAL";
        notesDisclosureRef = "Note 18";
        confidence = 0.80;
        rationale = "Capital account identified from naming pattern.";
      } else {
        // Try to infer from account class if name doesn't match
        if (existingClass === "ASSET") {
          tbGroup = "OTHER_ASSETS";
          fsLineItem = "OTHER_CURRENT_ASSETS";
          accountSubclass = "CURRENT_ASSET";
          notesDisclosureRef = "Note 8";
        } else if (existingClass === "LIABILITY") {
          tbGroup = "OTHER_LIABILITIES";
          fsLineItem = "OTHER_CURRENT_LIABILITIES";
          accountSubclass = "CURRENT_LIABILITY";
          notesDisclosureRef = "Note 12";
        } else if (existingClass === "EQUITY") {
          tbGroup = "RESERVES";
          fsLineItem = "RESERVES_SURPLUS";
          accountSubclass = "RESERVES";
          notesDisclosureRef = "Note 19";
        } else if (existingClass === "INCOME") {
          tbGroup = "OTHER_INCOME";
          fsLineItem = "OTHER_INCOME";
          accountSubclass = "OTHER_INCOME";
          notesDisclosureRef = "Note 21";
        } else if (existingClass === "EXPENSE") {
          tbGroup = "OPERATING_EXPENSES";
          fsLineItem = "OTHER_EXPENSES";
          accountSubclass = "OPERATING_EXPENSE";
          notesDisclosureRef = "Note 24";
        }
        confidence = 0.50;
        rationale = "Mapped based on account class. Manual review recommended for precise classification.";
      }

      return {
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        tbGroup,
        fsLineItem,
        accountSubclass,
        notesDisclosureRef,
        confidence,
        rationale,
      };
    });

    // Derive accountClass from accountSubclass
    const deriveAccountClass = (subclass: string): string => {
      if (subclass.includes("ASSET")) return "ASSET";
      if (subclass.includes("LIABILITY")) return "LIABILITY";
      if (subclass.includes("CAPITAL") || subclass.includes("RESERVES")) return "EQUITY";
      if (subclass.includes("REVENUE") || subclass.includes("INCOME")) return "INCOME";
      if (subclass.includes("EXPENSE") || subclass.includes("COST")) return "EXPENSE";
      return "";
    };

    // Update accounts with AI suggestions AND apply them to actual fields
    for (const suggestion of suggestions) {
      if (suggestion.tbGroup) {
        const accountClass = deriveAccountClass(suggestion.accountSubclass);
        await prisma.coAAccount.update({
          where: { id: suggestion.accountId },
          data: {
            // Apply to actual fields
            accountClass: accountClass,
            accountSubclass: suggestion.accountSubclass,
            tbGroup: suggestion.tbGroup,
            fsLineItem: suggestion.fsLineItem,
            notesDisclosureRef: suggestion.notesDisclosureRef,
            // Store AI suggestion metadata
            aiSuggestedTBGroup: suggestion.tbGroup,
            aiSuggestedFSLine: suggestion.fsLineItem,
            aiConfidence: suggestion.confidence,
            aiRationale: suggestion.rationale,
          },
        });
      }
    }

    res.json({
      suggestions: suggestions.filter((s) => s.tbGroup),
      message: `Generated AI suggestions for ${suggestions.filter((s) => s.tbGroup).length} accounts`,
    });
  } catch (error) {
    console.error("Error running AI suggest:", error);
    res.status(500).json({ error: "Failed to run AI suggestion" });
  }
});

router.post("/api/engagements/:engagementId/coa/auto-map-prior", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { clientId: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const priorEngagements = await prisma.engagement.findMany({
      where: { clientId: engagement.clientId, id: { not: engagementId } },
      orderBy: { periodEnd: "desc" },
      take: 3,
      select: { id: true },
    });

    if (priorEngagements.length === 0) {
      return res.json({ applied: 0, message: "No prior engagements found for this client" });
    }

    const priorAccounts = await prisma.coAAccount.findMany({
      where: {
        engagementId: { in: priorEngagements.map((e) => e.id) },
        fsLineItem: { not: null },
      },
      select: { accountCode: true, accountName: true, accountClass: true, accountSubclass: true, tbGroup: true, fsLineItem: true, notesDisclosureRef: true },
    });

    const priorMap = new Map<string, typeof priorAccounts[0]>();
    for (const pa of priorAccounts) {
      if (!priorMap.has(pa.accountCode)) {
        priorMap.set(pa.accountCode, pa);
      }
    }

    const currentAccounts = await prisma.coAAccount.findMany({
      where: { engagementId },
    });

    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId },
      select: { id: true, code: true },
    });
    const fsHeadByCode = new Map(fsHeads.map((h) => [h.code, h.id]));

    let applied = 0;
    for (const account of currentAccounts) {
      if (account.fsLineItem) continue;

      const prior = priorMap.get(account.accountCode);
      if (prior && prior.fsLineItem) {
        await prisma.coAAccount.update({
          where: { id: account.id },
          data: {
            accountClass: prior.accountClass || account.accountClass,
            accountSubclass: prior.accountSubclass || account.accountSubclass,
            tbGroup: prior.tbGroup || account.tbGroup,
            fsLineItem: prior.fsLineItem,
            notesDisclosureRef: prior.notesDisclosureRef || account.notesDisclosureRef,
            aiSuggestedTBGroup: prior.tbGroup,
            aiSuggestedFSLine: prior.fsLineItem,
            aiConfidence: 0.98,
            aiRationale: "Mapped from prior engagement for the same client",
          },
        });

        const headId = fsHeadByCode.get(prior.fsLineItem);
        if (headId) {
          await prisma.mappingAllocation.upsert({
            where: { engagementId_accountCode: { engagementId, accountCode: account.accountCode } },
            create: {
              engagementId,
              accountCode: account.accountCode,
              fsHeadId: headId,
              allocationPct: 100,
              status: "DRAFT",
              aiSuggested: true,
              aiConfidence: 0.98,
              aiRationale: "Applied from prior engagement mapping",
            },
            update: {
              fsHeadId: headId,
              aiSuggested: true,
              aiConfidence: 0.98,
              aiRationale: "Applied from prior engagement mapping",
            },
          });
        }

        applied++;
      }
    }

    res.json({
      applied,
      message: `Applied ${applied} mappings from prior engagements`,
      priorEngagementsChecked: priorEngagements.length,
    });
  } catch (error) {
    console.error("Error in auto-map-prior:", error);
    res.status(500).json({ error: "Failed to apply prior mappings" });
  }
});

router.get("/api/engagements/:engagementId/coa/mapping-stats", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const accounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      select: { id: true, accountCode: true, accountName: true, fsLineItem: true, closingBalance: true, nature: true },
    });

    const total = accounts.length;
    const mapped = accounts.filter((a) => a.fsLineItem);
    const unmapped = accounts.filter((a) => !a.fsLineItem);

    const mappedAmount = mapped.reduce((s, a) => s + Math.abs(Number(a.closingBalance || 0)), 0);
    const unmappedAmount = unmapped.reduce((s, a) => s + Math.abs(Number(a.closingBalance || 0)), 0);
    const totalAmount = mappedAmount + unmappedAmount;

    res.json({
      totalAccounts: total,
      mappedAccounts: mapped.length,
      unmappedAccounts: unmapped.length,
      mappedPct: total > 0 ? Math.round((mapped.length / total) * 100) : 0,
      mappedAmount,
      unmappedAmount,
      totalAmount,
      amountCoveragePct: totalAmount > 0 ? Math.round((mappedAmount / totalAmount) * 100) : 0,
      unmappedList: unmapped.map((a) => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: Number(a.closingBalance || 0),
        nature: a.nature,
      })),
    });
  } catch (error) {
    console.error("Error fetching mapping stats:", error);
    res.status(500).json({ error: "Failed to fetch mapping stats" });
  }
});

export default router;
