import { Router, Response } from "express";
import { prisma } from "../db";
import { AuthenticatedRequest, requireAuth } from "../auth";
import { Decimal } from "@prisma/client/runtime/library";
import OpenAI from "openai";

const router = Router();

export async function syncTbToFsMapping(engagementId: string, userId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { entries: { orderBy: { accountCode: "asc" } } },
    });

    let entries: Array<{ accountCode: string; accountName: string; openingDebit: any; openingCredit: any; closingDebit: any; closingCredit: any; movementDebit?: any; movementCredit?: any }> = [];

    if (tbBatch && tbBatch.entries.length > 0) {
      entries = tbBatch.entries;
    } else {
      const importBalances = await prisma.importAccountBalance.findMany({
        where: { engagementId },
        orderBy: { accountCode: "asc" },
      });

      const mergedMap = new Map<string, any>();
      for (const d of importBalances) {
        if (!mergedMap.has(d.accountCode)) {
          mergedMap.set(d.accountCode, {
            accountCode: d.accountCode,
            accountName: d.accountName,
            openingDebit: 0,
            openingCredit: 0,
            closingDebit: 0,
            closingCredit: 0,
            movementDebit: 0,
            movementCredit: 0,
          });
        }
        const row = mergedMap.get(d.accountCode)!;
        if (d.balanceType === 'OB') {
          row.openingDebit = Number(d.debitAmount || 0);
          row.openingCredit = Number(d.creditAmount || 0);
        } else if (d.balanceType === 'CB') {
          row.closingDebit = Number(d.debitAmount || 0);
          row.closingCredit = Number(d.creditAmount || 0);
        }
      }

      for (const row of mergedMap.values()) {
        const openingNet = row.openingDebit - row.openingCredit;
        const closingNet = row.closingDebit - row.closingCredit;
        const movement = closingNet - openingNet;
        row.movementDebit = movement > 0 ? movement : 0;
        row.movementCredit = movement < 0 ? Math.abs(movement) : 0;
      }

      entries = Array.from(mergedMap.values());
    }

    if (entries.length === 0) return { success: true };

    const totalClosingDr = entries.reduce((sum: number, e: any) => sum + Number(e.closingDebit || 0), 0);
    const totalClosingCr = entries.reduce((sum: number, e: any) => sum + Number(e.closingCredit || 0), 0);
    if (Math.abs(totalClosingDr - totalClosingCr) >= 1) return { success: true };

    const distinctEntries = new Map<string, any>();
    for (const e of entries) {
      if (!distinctEntries.has(e.accountCode)) {
        distinctEntries.set(e.accountCode, {
          accountCode: e.accountCode,
          accountName: e.accountName,
          openingDebit: e.openingDebit,
          openingCredit: e.openingCredit,
          closingDebit: e.closingDebit,
          closingCredit: e.closingCredit,
          movementDebit: e.movementDebit,
          movementCredit: e.movementCredit,
        });
      }
    }

    const existingFSHead = await prisma.fSHead.findFirst({ where: { engagementId } });
    if (!existingFSHead) {
      const createdHeads = await prisma.$transaction(
        DEFAULT_FS_HEADS.map(head => prisma.fSHead.create({
          data: {
            engagementId,
            code: head.code,
            name: head.name,
            statementType: head.statementType as any,
            sortOrder: head.sortOrder,
          },
        }))
      );
      const headMap: Record<string, string> = {};
      createdHeads.forEach((created, i) => { headMap[DEFAULT_FS_HEADS[i].code] = created.id; });

      const parentUpdates = DEFAULT_FS_HEADS
        .filter(h => (h as any).parentCode && headMap[(h as any).parentCode])
        .map(h => prisma.fSHead.update({
          where: { id: headMap[h.code] },
          data: { parentId: headMap[(h as any).parentCode] },
        }));
      if (parentUpdates.length > 0) await prisma.$transaction(parentUpdates);

      const lineCreates = DEFAULT_FS_LINES
        .filter(line => headMap[line.headCode])
        .map(line => prisma.fSLine.create({
          data: {
            engagementId,
            fsHeadId: headMap[line.headCode],
            code: line.code,
            name: line.name,
            sortOrder: line.sortOrder,
          },
        }));
      if (lineCreates.length > 0) await prisma.$transaction(lineCreates);
    }

    const fsHeads = await prisma.fSHead.findMany({ where: { engagementId } });
    const fsHeadByCode = new Map(fsHeads.map(h => [h.code, h]));

    const allFsLines = await prisma.fSLine.findMany({ where: { engagementId } });
    const linesByHeadId = new Set(allFsLines.map(l => l.fsHeadId));
    const missingLineHeads = fsHeads.filter(h => !linesByHeadId.has(h.id));
    if (missingLineHeads.length > 0) {
      await prisma.$transaction(
        missingLineHeads.map(head => prisma.fSLine.create({
          data: {
            engagementId,
            fsHeadId: head.id,
            code: head.code + '_LINE',
            name: head.name,
            sortOrder: 1,
          },
        }))
      );
    }

    let skippedLocked = 0;
    const tbAccountCodes = [...distinctEntries.keys()];
    const existingAllocations = await prisma.mappingAllocation.findMany({
      where: { engagementId, accountCode: { in: tbAccountCodes } },
    });
    const existingByCode = new Map(existingAllocations.map(a => [a.accountCode, a]));

    const importRecords = await prisma.importAccountBalance.findMany({
      where: { engagementId, accountCode: { in: tbAccountCodes } },
    });
    const importByCode = new Map<string, any>();
    for (const rec of importRecords) {
      if (!importByCode.has(rec.accountCode)) importByCode.set(rec.accountCode, rec);
    }

    const FS_HEAD_KEY_MAP: Record<string, string> = {
      'CASH_EQUIVALENTS': 'CASH_AND_BANK_BALANCES',
      'TRADE_RECEIVABLES': 'TRADE_RECEIVABLES',
      'INVENTORIES': 'INVENTORIES',
      'OTHER_CURRENT_ASSETS': 'OTHER_RECEIVABLES',
      'INVESTMENTS': 'INTANGIBLE_ASSETS',
      'PPE': 'PROPERTY_PLANT_EQUIPMENT',
      'INTANGIBLE_ASSETS': 'INTANGIBLE_ASSETS',
      'TRADE_PAYABLES': 'TRADE_AND_OTHER_PAYABLES',
      'SHORT_TERM_BORROWINGS': 'SHORT_TERM_BORROWINGS',
      'OTHER_CURRENT_LIABILITIES': 'TRADE_AND_OTHER_PAYABLES',
      'LONG_TERM_BORROWINGS': 'LONG_TERM_BORROWINGS',
      'DEFERRED_TAX': 'TAXATION',
      'SHARE_CAPITAL': 'SHARE_CAPITAL',
      'RESERVES_SURPLUS': 'RESERVES_SURPLUS',
      'REVENUE_OPERATIONS': 'REVENUE',
      'OTHER_INCOME': 'OTHER_INCOME',
      'COST_MATERIALS': 'COST_OF_SALES',
      'EMPLOYEE_BENEFITS': 'EMPLOYEE_BENEFITS',
      'DEPRECIATION': 'ADMIN_EXPENSES',
      'OTHER_EXPENSES': 'SELLING_EXPENSES',
      'FINANCE_COSTS': 'FINANCE_COSTS',
      'TAX_EXPENSE': 'TAXATION',
    };

    let newAllocations = 0;

    const updatedFsLines = await prisma.fSLine.findMany({
      where: { engagementId },
      orderBy: { sortOrder: "asc" },
    });
    const firstLineByHeadId = new Map<string, string>();
    for (const line of updatedFsLines) {
      if (!firstLineByHeadId.has(line.fsHeadId)) {
        firstLineByHeadId.set(line.fsHeadId, line.id);
      }
    }

    const updateOps: Array<ReturnType<typeof prisma.mappingAllocation.update>> = [];
    const createOps: Array<ReturnType<typeof prisma.mappingAllocation.create>> = [];

    for (const accountCode of tbAccountCodes) {
      const existing = existingByCode.get(accountCode);
      if (existing) {
        if (existing.isLocked) {
          skippedLocked++;
        } else {
          updateOps.push(prisma.mappingAllocation.update({
            where: { id: existing.id },
            data: { status: "DRAFT" },
          }));
        }
      } else {
        const importRec = importByCode.get(accountCode) as any;
        const fsHeadKey = importRec?.fsHeadKey;
        const resolvedKey = fsHeadKey ? (FS_HEAD_KEY_MAP[fsHeadKey] || fsHeadKey) : null;
        const fsHead = resolvedKey ? fsHeadByCode.get(resolvedKey) : null;
        if (fsHead) {
          createOps.push(prisma.mappingAllocation.create({
            data: {
              engagementId,
              accountCode,
              fsHeadId: fsHead.id,
              fsLineId: firstLineByHeadId.get(fsHead.id) || null,
              status: "DRAFT",
              aiSuggested: true,
              aiConfidence: importRec?.classificationConfidence || 0,
              aiRationale: `Auto-mapped from classification: ${fsHeadKey}`,
            },
          }));
          newAllocations++;
        }
      }
    }

    if (updateOps.length > 0 || createOps.length > 0) {
      await prisma.$transaction([...updateOps, ...createOps]);
    }

    const allAllocations = await prisma.mappingAllocation.findMany({
      where: { engagementId, accountCode: { in: tbAccountCodes } },
    });
    const totalAccounts = distinctEntries.size;
    const mappedCount = allAllocations.length;
    const unmappedCount = totalAccounts - mappedCount;

    let mappingVersion = await prisma.coAFSMappingVersion.findFirst({
      where: { engagementId },
      orderBy: { versionNumber: "desc" },
    });

    if (!mappingVersion) {
      mappingVersion = await prisma.coAFSMappingVersion.create({
        data: {
          engagementId,
          versionNumber: 1,
          status: "DRAFT",
          totalAccounts,
          mappedCount,
          unmappedCount,
          allMappedOrExcluded: unmappedCount === 0,
        },
      });
    } else {
      mappingVersion = await prisma.coAFSMappingVersion.update({
        where: { id: mappingVersion.id },
        data: {
          totalAccounts,
          mappedCount,
          unmappedCount,
          allMappedOrExcluded: unmappedCount === 0,
        },
      });
    }

    if (userId) {
      await prisma.mappingChangeLog.create({
        data: {
          engagementId,
          entityType: "AUTO_SYNC_FROM_TB",
          entityId: mappingVersion.id,
          action: "PUSH",
          newValue: { totalAccounts, mappedCount, unmappedCount, timestamp: new Date().toISOString(), auto: true },
          performedById: userId,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error in syncTbToFsMapping:", error);
    return { success: false, error: String(error) };
  }
}

const DEFAULT_FS_HEADS = [
  { code: "ASSETS", name: "Assets", statementType: "BS", sortOrder: 1 },
  { code: "ASSETS_CURRENT", name: "Current Assets", statementType: "BS", sortOrder: 2, parentCode: "ASSETS" },
  { code: "ASSETS_NON_CURRENT", name: "Non-Current Assets", statementType: "BS", sortOrder: 3, parentCode: "ASSETS" },
  { code: "LIABILITIES", name: "Liabilities", statementType: "BS", sortOrder: 4 },
  { code: "LIABILITIES_CURRENT", name: "Current Liabilities", statementType: "BS", sortOrder: 5, parentCode: "LIABILITIES" },
  { code: "LIABILITIES_NON_CURRENT", name: "Non-Current Liabilities", statementType: "BS", sortOrder: 6, parentCode: "LIABILITIES" },
  { code: "EQUITY", name: "Equity", statementType: "BS", sortOrder: 7 },
  { code: "REVENUE", name: "Revenue", statementType: "PL", sortOrder: 8 },
  { code: "COST_OF_SALES", name: "Cost of Sales", statementType: "PL", sortOrder: 9 },
  { code: "OPERATING_EXPENSES", name: "Operating Expenses", statementType: "PL", sortOrder: 10 },
  { code: "OTHER_INCOME", name: "Other Income", statementType: "PL", sortOrder: 11 },
  { code: "FINANCE_COSTS", name: "Finance Costs", statementType: "PL", sortOrder: 12 },
  { code: "TAX", name: "Taxation", statementType: "PL", sortOrder: 13 },
];

const DEFAULT_FS_LINES: { code: string; name: string; headCode: string; sortOrder: number }[] = [
  { code: "CASH", name: "Cash and Cash Equivalents", headCode: "ASSETS_CURRENT", sortOrder: 1 },
  { code: "RECEIVABLES", name: "Trade Receivables", headCode: "ASSETS_CURRENT", sortOrder: 2 },
  { code: "INVENTORY", name: "Inventory", headCode: "ASSETS_CURRENT", sortOrder: 3 },
  { code: "PREPAYMENTS", name: "Prepayments", headCode: "ASSETS_CURRENT", sortOrder: 4 },
  { code: "OTHER_CURRENT_ASSETS", name: "Other Current Assets", headCode: "ASSETS_CURRENT", sortOrder: 5 },
  { code: "PPE", name: "Property, Plant and Equipment", headCode: "ASSETS_NON_CURRENT", sortOrder: 1 },
  { code: "INTANGIBLES", name: "Intangible Assets", headCode: "ASSETS_NON_CURRENT", sortOrder: 2 },
  { code: "INVESTMENTS", name: "Long-term Investments", headCode: "ASSETS_NON_CURRENT", sortOrder: 3 },
  { code: "PAYABLES", name: "Trade Payables", headCode: "LIABILITIES_CURRENT", sortOrder: 1 },
  { code: "ACCRUALS", name: "Accrued Liabilities", headCode: "LIABILITIES_CURRENT", sortOrder: 2 },
  { code: "SHORT_TERM_BORROWINGS", name: "Short-term Borrowings", headCode: "LIABILITIES_CURRENT", sortOrder: 3 },
  { code: "TAX_PAYABLE", name: "Tax Payable", headCode: "LIABILITIES_CURRENT", sortOrder: 4 },
  { code: "LONG_TERM_DEBT", name: "Long-term Debt", headCode: "LIABILITIES_NON_CURRENT", sortOrder: 1 },
  { code: "DEFERRED_TAX", name: "Deferred Tax Liabilities", headCode: "LIABILITIES_NON_CURRENT", sortOrder: 2 },
  { code: "SHARE_CAPITAL", name: "Share Capital", headCode: "EQUITY", sortOrder: 1 },
  { code: "RETAINED_EARNINGS", name: "Retained Earnings", headCode: "EQUITY", sortOrder: 2 },
  { code: "RESERVES", name: "Reserves", headCode: "EQUITY", sortOrder: 3 },
  { code: "SALES_REVENUE", name: "Sales Revenue", headCode: "REVENUE", sortOrder: 1 },
  { code: "SERVICE_REVENUE", name: "Service Revenue", headCode: "REVENUE", sortOrder: 2 },
  { code: "OTHER_REVENUE", name: "Other Operating Revenue", headCode: "REVENUE", sortOrder: 3 },
  { code: "DIRECT_MATERIALS", name: "Direct Materials", headCode: "COST_OF_SALES", sortOrder: 1 },
  { code: "DIRECT_LABOR", name: "Direct Labor", headCode: "COST_OF_SALES", sortOrder: 2 },
  { code: "MANUFACTURING_OH", name: "Manufacturing Overhead", headCode: "COST_OF_SALES", sortOrder: 3 },
  { code: "SALARIES", name: "Salaries and Wages", headCode: "OPERATING_EXPENSES", sortOrder: 1 },
  { code: "RENT", name: "Rent Expense", headCode: "OPERATING_EXPENSES", sortOrder: 2 },
  { code: "UTILITIES", name: "Utilities", headCode: "OPERATING_EXPENSES", sortOrder: 3 },
  { code: "DEPRECIATION", name: "Depreciation", headCode: "OPERATING_EXPENSES", sortOrder: 4 },
  { code: "ADMIN_EXPENSES", name: "Administrative Expenses", headCode: "OPERATING_EXPENSES", sortOrder: 5 },
  { code: "INTEREST_INCOME", name: "Interest Income", headCode: "OTHER_INCOME", sortOrder: 1 },
  { code: "DIVIDEND_INCOME", name: "Dividend Income", headCode: "OTHER_INCOME", sortOrder: 2 },
  { code: "INTEREST_EXPENSE", name: "Interest Expense", headCode: "FINANCE_COSTS", sortOrder: 1 },
  { code: "BANK_CHARGES", name: "Bank Charges", headCode: "FINANCE_COSTS", sortOrder: 2 },
  { code: "CURRENT_TAX", name: "Current Tax Expense", headCode: "TAX", sortOrder: 1 },
  { code: "DEFERRED_TAX_EXP", name: "Deferred Tax Expense", headCode: "TAX", sortOrder: 2 },
];

router.get("/fs-heads/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId, isActive: true },
      include: {
        fsLines: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    res.json({ fsHeads });
  } catch (error) {
    console.error("Error fetching FS heads:", error);
    res.status(500).json({ error: "Failed to fetch FS heads" });
  }
});

router.post("/fs-heads/initialize", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.body;

    const existing = await prisma.fSHead.findFirst({ where: { engagementId } });
    if (existing) {
      return res.json({ message: "FS taxonomy already initialized", initialized: false });
    }

    const headMap: Record<string, string> = {};
    for (const head of DEFAULT_FS_HEADS) {
      const created = await prisma.fSHead.create({
        data: {
          engagementId,
          code: head.code,
          name: head.name,
          statementType: head.statementType as any,
          sortOrder: head.sortOrder,
        },
      });
      headMap[head.code] = created.id;
    }

    for (const head of DEFAULT_FS_HEADS) {
      if ((head as any).parentCode && headMap[(head as any).parentCode]) {
        await prisma.fSHead.update({
          where: { id: headMap[head.code] },
          data: { parentId: headMap[(head as any).parentCode] },
        });
      }
    }

    for (const line of DEFAULT_FS_LINES) {
      const headId = headMap[line.headCode];
      if (headId) {
        await prisma.fSLine.create({
          data: {
            engagementId,
            fsHeadId: headId,
            code: line.code,
            name: line.name,
            sortOrder: line.sortOrder,
          },
        });
      }
    }

    res.json({ message: "FS taxonomy initialized", initialized: true, headsCreated: DEFAULT_FS_HEADS.length, linesCreated: DEFAULT_FS_LINES.length });
  } catch (error) {
    console.error("Error initializing FS taxonomy:", error);
    res.status(500).json({ error: "Failed to initialize FS taxonomy" });
  }
});

router.post("/fs-lines", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsHeadId, code, name, description } = req.body;
    const userId = req.user!.id;

    const existing = await prisma.fSLine.findUnique({
      where: { engagementId_code: { engagementId, code } },
    });

    if (existing) {
      return res.status(400).json({ error: "FS line code already exists" });
    }

    const maxSort = await prisma.fSLine.aggregate({
      where: { fsHeadId },
      _max: { sortOrder: true },
    });

    const fsLine = await prisma.fSLine.create({
      data: {
        engagementId,
        fsHeadId,
        code,
        name,
        description,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    });

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "FS_LINE",
        entityId: fsLine.id,
        action: "CREATE",
        newValue: { code, name, fsHeadId },
        performedById: userId,
      },
    });

    res.json({ fsLine });
  } catch (error) {
    console.error("Error creating FS line:", error);
    res.status(500).json({ error: "Failed to create FS line" });
  }
});

router.post("/fs-lines/rename", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, fsLineId, newName } = req.body;
    const userId = req.user!.id;

    const fsLine = await prisma.fSLine.findUnique({ where: { id: fsLineId } });
    if (!fsLine) {
      return res.status(404).json({ error: "FS line not found" });
    }

    const oldName = fsLine.name;

    await prisma.fSLine.update({
      where: { id: fsLineId },
      data: { name: newName },
    });

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "FS_LINE",
        entityId: fsLineId,
        action: "RENAME",
        oldValue: { name: oldName },
        newValue: { name: newName },
        performedById: userId,
      },
    });

    res.json({ success: true, oldName, newName });
  } catch (error) {
    console.error("Error renaming FS line:", error);
    res.status(500).json({ error: "Failed to rename FS line" });
  }
});

router.post("/fs-lines/merge", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, sourceLineIds, targetLineId, reason } = req.body;
    const userId = req.user!.id;

    const targetLine = await prisma.fSLine.findUnique({ where: { id: targetLineId } });
    if (!targetLine) {
      return res.status(404).json({ error: "Target FS line not found" });
    }

    for (const sourceId of sourceLineIds) {
      if (sourceId === targetLineId) continue;

      await prisma.mappingAllocation.updateMany({
        where: { fsLineId: sourceId },
        data: { fsLineId: targetLineId },
      });

      await prisma.fSLine.update({
        where: { id: sourceId },
        data: {
          isActive: false,
          mergedIntoId: targetLineId,
          mergedAt: new Date(),
          mergedReason: reason,
        },
      });

      await prisma.mappingChangeLog.create({
        data: {
          engagementId,
          entityType: "FS_LINE",
          entityId: sourceId,
          action: "MERGE",
          oldValue: { sourceId },
          newValue: { mergedInto: targetLineId },
          reason,
          performedById: userId,
        },
      });
    }

    res.json({ success: true, mergedCount: sourceLineIds.length - 1, targetLineId });
  } catch (error) {
    console.error("Error merging FS lines:", error);
    res.status(500).json({ error: "Failed to merge FS lines" });
  }
});

router.get("/allocations/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: {
        entries: {
          orderBy: { accountCode: "asc" },
        },
      },
    });

    let rawEntries: Array<{ accountCode: string; accountName: string; accountType: string | null; openingDebit: number; openingCredit: number; closingDebit: number; closingCredit: number }> = [];

    if (tbBatch && tbBatch.entries.length > 0) {
      rawEntries = tbBatch.entries.map((e: any) => ({
        accountCode: e.accountCode,
        accountName: e.accountName,
        accountType: e.accountType || null,
        openingDebit: Number(e.openingDebit || 0),
        openingCredit: Number(e.openingCredit || 0),
        closingDebit: Number(e.closingDebit || 0),
        closingCredit: Number(e.closingCredit || 0),
      }));
    } else {
      const importBalances = await prisma.importAccountBalance.findMany({
        where: { engagementId },
        orderBy: { accountCode: "asc" },
      });

      if (importBalances.length === 0) {
        return res.json({ tbEntries: [], allocations: [], summary: { totalAccounts: 0, mappedAccounts: 0, unmappedAccounts: 0 } });
      }

      const mergedMap = new Map<string, any>();
      for (const d of importBalances) {
        if (!mergedMap.has(d.accountCode)) {
          mergedMap.set(d.accountCode, {
            accountCode: d.accountCode,
            accountName: d.accountName,
            accountType: (d as any).accountClass || null,
            openingDebit: 0,
            openingCredit: 0,
            closingDebit: 0,
            closingCredit: 0,
          });
        }
        const row = mergedMap.get(d.accountCode)!;
        if (d.balanceType === 'OB') {
          row.openingDebit = Number(d.debitAmount || 0);
          row.openingCredit = Number(d.creditAmount || 0);
        } else if (d.balanceType === 'CB') {
          row.closingDebit = Number(d.debitAmount || 0);
          row.closingCredit = Number(d.creditAmount || 0);
        }
      }
      rawEntries = Array.from(mergedMap.values()).sort((a: any, b: any) => a.accountCode.localeCompare(b.accountCode));
    }

    const allocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
      include: {
        fsHead: true,
        fsLine: true,
      },
    });

    const allocationMap = new Map(allocations.map((a: any) => [a.accountCode, a]));

    const tbWithMapping = rawEntries.map((entry: any) => {
      const allocation: any = allocationMap.get(entry.accountCode);
      return {
        id: entry.id || entry.accountCode,
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        accountType: entry.accountType,
        openingDebit: entry.openingDebit,
        openingCredit: entry.openingCredit,
        closingDebit: entry.closingDebit,
        closingCredit: entry.closingCredit,
        netBalance: Number(entry.closingDebit) - Number(entry.closingCredit),
        fsHeadId: allocation?.fsHeadId || null,
        fsHeadName: allocation?.fsHead?.name || null,
        fsLineId: allocation?.fsLineId || null,
        fsLineName: allocation?.fsLine?.name || null,
        allocationPct: allocation?.allocationPct ? Number(allocation.allocationPct) : 100,
        isMapped: !!allocation,
        isLocked: allocation?.isLocked || false,
        notes: allocation?.notes || null,
      };
    });

    const mappedCount = tbWithMapping.filter((t: any) => t.isMapped).length;
    const totalDr = tbWithMapping.reduce((sum: number, t: any) => sum + Number(t.closingDebit || 0), 0);
    const totalCr = tbWithMapping.reduce((sum: number, t: any) => sum + Number(t.closingCredit || 0), 0);

    res.json({
      tbEntries: tbWithMapping,
      summary: {
        totalAccounts: tbWithMapping.length,
        mappedAccounts: mappedCount,
        unmappedAccounts: tbWithMapping.length - mappedCount,
        completeness: tbWithMapping.length > 0 ? Math.round((mappedCount / tbWithMapping.length) * 100) : 0,
        totalDebit: totalDr,
        totalCredit: totalCr,
        isReconciled: Math.abs(totalDr - totalCr) < 1,
      },
    });
  } catch (error) {
    console.error("Error fetching allocations:", error);
    res.status(500).json({ error: "Failed to fetch allocations" });
  }
});

router.post("/allocations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, accountCode, fsHeadId, fsLineId, notes } = req.body;
    const userId = req.user!.id;

    const existing = await prisma.mappingAllocation.findUnique({
      where: { engagementId_accountCode: { engagementId, accountCode } },
    });

    if (existing) {
      if (existing.isLocked) {
        return res.status(400).json({ error: "Allocation is locked" });
      }

      const updated = await prisma.mappingAllocation.update({
        where: { id: existing.id },
        data: {
          fsHeadId,
          fsLineId,
          notes,
          isUserOverride: true,
        },
        include: { fsHead: true, fsLine: true },
      });

      return res.json({ allocation: updated });
    }

    const allocation = await prisma.mappingAllocation.create({
      data: {
        engagementId,
        accountCode,
        fsHeadId,
        fsLineId,
        notes,
        status: "CONFIRMED",
      },
      include: { fsHead: true, fsLine: true },
    });

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "ALLOCATION",
        entityId: allocation.id,
        action: "CREATE",
        newValue: { accountCode, fsHeadId, fsLineId },
        performedById: userId,
      },
    });

    res.json({ allocation });
  } catch (error) {
    console.error("Error creating allocation:", error);
    res.status(500).json({ error: "Failed to create allocation" });
  }
});

router.post("/allocations/bulk", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, accountCodes, fsHeadId, fsLineId } = req.body;
    const userId = req.user!.id;

    let updated = 0;
    let created = 0;

    for (const accountCode of accountCodes) {
      const existing = await prisma.mappingAllocation.findUnique({
        where: { engagementId_accountCode: { engagementId, accountCode } },
      });

      if (existing) {
        if (!existing.isLocked) {
          await prisma.mappingAllocation.update({
            where: { id: existing.id },
            data: { fsHeadId, fsLineId, isUserOverride: true },
          });
          updated++;
        }
      } else {
        await prisma.mappingAllocation.create({
          data: {
            engagementId,
            accountCode,
            fsHeadId,
            fsLineId,
            status: "CONFIRMED",
          },
        });
        created++;
      }
    }

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "ALLOCATION",
        entityId: "bulk",
        action: "BULK_UPDATE",
        newValue: { accountCodes, fsHeadId, fsLineId, updated, created },
        performedById: userId,
      },
    });

    res.json({ success: true, updated, created });
  } catch (error) {
    console.error("Error bulk updating allocations:", error);
    res.status(500).json({ error: "Failed to bulk update allocations" });
  }
});

router.post("/ai-map", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.body;
    const userId = req.user!.id;

    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId, isActive: true },
      include: { fsLines: { where: { isActive: true } } },
    });

    const fsLines = fsHeads.flatMap((h: any) => h.fsLines);

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      include: { entries: true },
    });

    if (!tbBatch || tbBatch.entries.length === 0) {
      return res.status(400).json({ error: "No TB data available" });
    }

    const existingAllocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
    });
    const mappedCodes = new Set(existingAllocations.map((a: any) => a.accountCode));

    const keywordRules: { keywords: string[]; fsHeadCode: string; fsLineCode: string }[] = [
      { keywords: ["cash", "bank", "petty"], fsHeadCode: "ASSETS_CURRENT", fsLineCode: "CASH" },
      { keywords: ["receivable", "debtor", "ar "], fsHeadCode: "ASSETS_CURRENT", fsLineCode: "RECEIVABLES" },
      { keywords: ["inventory", "stock", "goods"], fsHeadCode: "ASSETS_CURRENT", fsLineCode: "INVENTORY" },
      { keywords: ["prepaid", "prepayment", "advance"], fsHeadCode: "ASSETS_CURRENT", fsLineCode: "PREPAYMENTS" },
      { keywords: ["property", "plant", "equipment", "ppe", "furniture", "vehicle", "machinery"], fsHeadCode: "ASSETS_NON_CURRENT", fsLineCode: "PPE" },
      { keywords: ["intangible", "goodwill", "patent", "trademark"], fsHeadCode: "ASSETS_NON_CURRENT", fsLineCode: "INTANGIBLES" },
      { keywords: ["investment", "securities"], fsHeadCode: "ASSETS_NON_CURRENT", fsLineCode: "INVESTMENTS" },
      { keywords: ["payable", "creditor", "ap ", "supplier"], fsHeadCode: "LIABILITIES_CURRENT", fsLineCode: "PAYABLES" },
      { keywords: ["accrued", "accrual"], fsHeadCode: "LIABILITIES_CURRENT", fsLineCode: "ACCRUALS" },
      { keywords: ["short-term loan", "overdraft", "short term borrowing"], fsHeadCode: "LIABILITIES_CURRENT", fsLineCode: "SHORT_TERM_BORROWINGS" },
      { keywords: ["tax payable", "income tax", "vat payable", "gst payable"], fsHeadCode: "LIABILITIES_CURRENT", fsLineCode: "TAX_PAYABLE" },
      { keywords: ["long-term loan", "long term debt", "mortgage", "bond payable"], fsHeadCode: "LIABILITIES_NON_CURRENT", fsLineCode: "LONG_TERM_DEBT" },
      { keywords: ["deferred tax liability"], fsHeadCode: "LIABILITIES_NON_CURRENT", fsLineCode: "DEFERRED_TAX" },
      { keywords: ["share capital", "common stock", "paid-in capital", "capital stock"], fsHeadCode: "EQUITY", fsLineCode: "SHARE_CAPITAL" },
      { keywords: ["retained earnings", "accumulated profit"], fsHeadCode: "EQUITY", fsLineCode: "RETAINED_EARNINGS" },
      { keywords: ["reserve", "revaluation"], fsHeadCode: "EQUITY", fsLineCode: "RESERVES" },
      { keywords: ["sales", "revenue", "income from operations"], fsHeadCode: "REVENUE", fsLineCode: "SALES_REVENUE" },
      { keywords: ["service income", "fee income", "consulting"], fsHeadCode: "REVENUE", fsLineCode: "SERVICE_REVENUE" },
      { keywords: ["cost of goods", "cost of sales", "cogs", "purchases"], fsHeadCode: "COST_OF_SALES", fsLineCode: "DIRECT_MATERIALS" },
      { keywords: ["salary", "wage", "payroll", "staff cost"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "SALARIES" },
      { keywords: ["rent", "lease"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "RENT" },
      { keywords: ["utility", "electric", "water", "gas"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "UTILITIES" },
      { keywords: ["depreciation", "amortization"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "DEPRECIATION" },
      { keywords: ["admin", "office", "general expense"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "ADMIN_EXPENSES" },
      { keywords: ["interest income", "finance income"], fsHeadCode: "OTHER_INCOME", fsLineCode: "INTEREST_INCOME" },
      { keywords: ["interest expense", "finance cost", "finance charge"], fsHeadCode: "FINANCE_COSTS", fsLineCode: "INTEREST_EXPENSE" },
      { keywords: ["bank charge", "bank fee"], fsHeadCode: "FINANCE_COSTS", fsLineCode: "BANK_CHARGES" },
      { keywords: ["tax expense", "income tax expense"], fsHeadCode: "TAX", fsLineCode: "CURRENT_TAX" },
    ];

    const headByCode = new Map(fsHeads.map((h: any) => [h.code, h]));
    const lineByCode = new Map(fsLines.map((l: any) => [l.code, l]));

    let suggestionsCreated = 0;

    for (const entry of tbBatch.entries) {
      if (mappedCodes.has(entry.accountCode)) continue;

      const accountNameLower = entry.accountName.toLowerCase();
      let matched = false;

      for (const rule of keywordRules) {
        if (rule.keywords.some((kw) => accountNameLower.includes(kw))) {
          const head = headByCode.get(rule.fsHeadCode);
          const line = lineByCode.get(rule.fsLineCode);

          if (head) {
            await prisma.mappingAllocation.create({
              data: {
                engagementId,
                accountCode: entry.accountCode,
                fsHeadId: head.id,
                fsLineId: line?.id || null,
                status: "DRAFT",
                aiSuggested: true,
                aiConfidence: 0.85,
                aiRationale: `Matched keyword rule: ${rule.keywords[0]}`,
              },
            });
            suggestionsCreated++;
            matched = true;
            break;
          }
        }
      }
    }

    res.json({ success: true, suggestionsCreated });
  } catch (error) {
    console.error("Error running AI mapping:", error);
    res.status(500).json({ error: "Failed to run AI mapping" });
  }
});

router.post("/recompute-rollup", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.body;

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      include: { entries: true },
    });

    if (!tbBatch) {
      return res.status(400).json({ error: "No approved TB found" });
    }

    const allocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
    });

    const entryMap = new Map(tbBatch.entries.map((e: any) => [e.accountCode, e]));

    const lineRollups: Record<string, { dr: number; cr: number; count: number }> = {};
    const headRollups: Record<string, { dr: number; cr: number; count: number }> = {};

    for (const alloc of allocations) {
      const entry = entryMap.get(alloc.accountCode);
      if (!entry) continue;

      const pct = Number(alloc.allocationPct || 100) / 100;
      const dr = Number(entry.closingDebit) * pct;
      const cr = Number(entry.closingCredit) * pct;

      if (alloc.fsLineId) {
        if (!lineRollups[alloc.fsLineId]) lineRollups[alloc.fsLineId] = { dr: 0, cr: 0, count: 0 };
        lineRollups[alloc.fsLineId].dr += dr;
        lineRollups[alloc.fsLineId].cr += cr;
        lineRollups[alloc.fsLineId].count++;
      }

      if (!headRollups[alloc.fsHeadId]) headRollups[alloc.fsHeadId] = { dr: 0, cr: 0, count: 0 };
      headRollups[alloc.fsHeadId].dr += dr;
      headRollups[alloc.fsHeadId].cr += cr;
      headRollups[alloc.fsHeadId].count++;
    }

    for (const [lineId, rollup] of Object.entries(lineRollups)) {
      await prisma.fSLine.update({
        where: { id: lineId },
        data: {
          totalDebit: new Decimal(rollup.dr),
          totalCredit: new Decimal(rollup.cr),
          netBalance: new Decimal(rollup.dr - rollup.cr),
          accountCount: rollup.count,
        },
      });
    }

    for (const [headId, rollup] of Object.entries(headRollups)) {
      await prisma.fSHead.update({
        where: { id: headId },
        data: {
          totalDebit: new Decimal(rollup.dr),
          totalCredit: new Decimal(rollup.cr),
          netBalance: new Decimal(rollup.dr - rollup.cr),
          accountCount: rollup.count,
        },
      });
    }

    res.json({ success: true, linesUpdated: Object.keys(lineRollups).length, headsUpdated: Object.keys(headRollups).length });
  } catch (error) {
    console.error("Error recomputing rollup:", error);
    res.status(500).json({ error: "Failed to recompute rollup" });
  }
});

router.post("/lock", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.body;
    const userId = req.user!.id;

    const allocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
    });

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      include: { entries: true },
    });

    if (!tbBatch) {
      return res.status(400).json({ error: "No approved TB found" });
    }

    const mappedCodes = new Set(allocations.map((a: any) => a.accountCode));
    const unmappedCount = tbBatch.entries.filter((e: any) => !mappedCodes.has(e.accountCode)).length;

    if (unmappedCount > 0) {
      return res.status(400).json({ error: `Cannot lock: ${unmappedCount} unmapped accounts`, unmappedCount });
    }

    await prisma.mappingAllocation.updateMany({
      where: { engagementId },
      data: { isLocked: true, lockedById: userId, lockedAt: new Date() },
    });

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "SESSION",
        entityId: engagementId,
        action: "LOCK",
        newValue: { lockedAt: new Date() },
        performedById: userId,
      },
    });

    res.json({ success: true, message: "Mapping locked successfully" });
  } catch (error) {
    console.error("Error locking mapping:", error);
    res.status(500).json({ error: "Failed to lock mapping" });
  }
});

router.post("/unlock", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.body;
    const userId = req.user!.id;

    await prisma.mappingAllocation.updateMany({
      where: { engagementId },
      data: { isLocked: false, lockedById: null, lockedAt: null },
    });

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "MappingAllocation",
        entityId: engagementId,
        action: "UNLOCK",
        reason: "Bulk unlock of all mappings",
        performedById: userId,
      },
    });

    res.json({ success: true, message: "Mapping unlocked successfully" });
  } catch (error) {
    console.error("Error unlocking mapping:", error);
    res.status(500).json({ error: "Failed to unlock mapping" });
  }
});

router.post("/push-forward", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.body;
    const userId = req.user!.id;

    const engagement = await prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId, isActive: true },
      include: { fsLines: { where: { isActive: true } } },
    });

    const targets: string[] = [];
    const targetResults: Record<string, any> = {};

    // --- Classify FS Heads by category based on code and statementType ---
    const liabilityCodes = ['TRADE_AND_OTHER_PAYABLES', 'SHORT_TERM_BORROWINGS', 'LONG_TERM_BORROWINGS', 'PROVISIONS', 'DEFERRED_TAX_LIABILITY', 'LEASE_LIABILITIES', 'OTHER_PAYABLES'];
    const equityCodes = ['SHARE_CAPITAL', 'RESERVES_SURPLUS', 'RETAINED_EARNINGS', 'OTHER_EQUITY', 'REVALUATION_SURPLUS'];
    const revenueCodes = ['REVENUE', 'OTHER_INCOME', 'FINANCE_INCOME'];
    const expenseCodes = ['COST_OF_SALES', 'ADMIN_EXPENSES', 'SELLING_EXPENSES', 'FINANCE_COSTS', 'OTHER_EXPENSES', 'TAX_EXPENSE', 'DEPRECIATION', 'AMORTIZATION'];

    function classifyFsHead(h: { code: string; statementType: string }) {
      const code = h.code.toUpperCase();
      if (h.statementType === 'PL') {
        if (revenueCodes.some(rc => code.includes(rc)) || code.includes('REVENUE') || code.includes('INCOME')) return 'REVENUE';
        return 'EXPENSE';
      }
      if (liabilityCodes.some(lc => code.includes(lc)) || code.includes('PAYABLE') || code.includes('BORROWING') || code.includes('PROVISION') || code.includes('LIABILITY')) return 'LIABILITY';
      if (equityCodes.some(ec => code.includes(ec)) || code.includes('CAPITAL') || code.includes('RESERVE') || code.includes('EQUITY') || code.includes('RETAINED')) return 'EQUITY';
      return 'ASSET';
    }

    // --- Compute aggregates ---
    const totalAssets = fsHeads
      .filter(h => classifyFsHead(h) === "ASSET")
      .reduce((sum, h) => sum + Math.abs(Number(h.netBalance || 0)), 0);
    const totalRevenue = fsHeads
      .filter(h => classifyFsHead(h) === "REVENUE")
      .reduce((sum, h) => sum + Math.abs(Number(h.netBalance || 0)), 0);
    const totalExpenses = fsHeads
      .filter(h => classifyFsHead(h) === "EXPENSE")
      .reduce((sum, h) => sum + Math.abs(Number(h.netBalance || 0)), 0);
    const profitBeforeTax = fsHeads
      .filter(h => h.statementType === "PL")
      .reduce((sum, h) => sum + Number(h.netBalance || 0), 0);
    const totalLiabilities = fsHeads
      .filter(h => classifyFsHead(h) === "LIABILITY")
      .reduce((sum, h) => sum + Math.abs(Number(h.netBalance || 0)), 0);
    const totalEquity = fsHeads
      .filter(h => classifyFsHead(h) === "EQUITY")
      .reduce((sum, h) => sum + Math.abs(Number(h.netBalance || 0)), 0);

    // --- 1. Push to Draft FS: persist FS snapshot with aggregated balances ---
    const draftFsData = fsHeads
      .filter(h => h.accountCount > 0)
      .map(h => ({
        fsHeadCode: h.code,
        fsHeadName: h.name,
        statementType: h.statementType,
        totalDebit: Number(h.totalDebit || 0),
        totalCredit: Number(h.totalCredit || 0),
        netBalance: Number(h.netBalance || 0),
        accountCount: h.accountCount,
        lines: h.fsLines.map(l => ({
          code: l.code,
          name: l.name,
          netBalance: Number(l.netBalance || 0),
          accountCount: l.accountCount,
        })),
      }));

    const mappedCount = fsHeads.reduce((s, h) => s + h.accountCount, 0);
    await prisma.phaseProgress.upsert({
      where: { engagementId_phase: { engagementId, phase: "REQUISITION" } },
      update: { status: "IN_PROGRESS", completionPercentage: 100, updatedAt: new Date() },
      create: { engagementId, phase: "REQUISITION", status: "IN_PROGRESS", completionPercentage: 100, startedAt: new Date() },
    });
    targets.push("Draft FS");
    targetResults.draftFs = { headCount: draftFsData.length, mappedAccounts: mappedCount };

    // --- 2. Push to Planning: persist materiality benchmark inputs ---
    const planningInputs = {
      totalAssets,
      totalRevenue,
      totalExpenses,
      profitBeforeTax,
      totalLiabilities,
      totalEquity,
      fsHeadPopulations: fsHeads
        .filter(h => h.accountCount > 0)
        .map(h => ({
          fsHeadKey: h.code,
          fsHeadName: h.name,
          population: Math.abs(Number(h.netBalance || 0)),
          accountCount: h.accountCount,
        })),
    };

    await prisma.engagement.update({
      where: { id: engagementId },
      data: {
        lastYearRevenue: totalRevenue,
      },
    });

    await prisma.phaseProgress.upsert({
      where: { engagementId_phase: { engagementId, phase: "PLANNING" } },
      update: { status: "NOT_STARTED", updatedAt: new Date() },
      create: { engagementId, phase: "PLANNING", status: "NOT_STARTED" },
    });
    targets.push("Planning");
    targetResults.planning = planningInputs;

    // --- 3. Gather GL transaction counts per FS Head for sampling ---
    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      select: { accountCode: true, fsLineItem: true },
    });

    const accountToFsHead = new Map<string, string>();
    for (const acct of coaAccounts) {
      if (acct.fsLineItem) accountToFsHead.set(acct.accountCode, acct.fsLineItem);
    }

    const glBatches = await prisma.gLBatch.findMany({
      where: { engagementId },
      select: { id: true },
    });
    const batchIds = glBatches.map(b => b.id);

    const glTransactionCounts = new Map<string, number>();
    if (batchIds.length > 0) {
      const glCounts = await prisma.gLEntry.groupBy({
        by: ['accountCode'],
        where: { engagementId, batchId: { in: batchIds } },
        _count: { id: true },
      });
      for (const gc of glCounts) {
        const fsHead = accountToFsHead.get(gc.accountCode);
        if (fsHead) {
          glTransactionCounts.set(fsHead, (glTransactionCounts.get(fsHead) || 0) + gc._count.id);
        }
      }
    }

    // --- 4. Gather AP/AR/Bank sub-ledger populations for confirmation tracking ---
    const [apData, arData, bankCount] = await Promise.all([
      prisma.importPartyBalance.aggregate({
        where: { engagementId, partyType: 'VENDOR' },
        _count: { id: true },
        _sum: { balance: true },
      }),
      prisma.importPartyBalance.aggregate({
        where: { engagementId, partyType: 'CUSTOMER' },
        _count: { id: true },
        _sum: { balance: true },
      }),
      prisma.importBankAccount.count({ where: { engagementId } }),
    ]);

    const bankBalanceData = await prisma.importBankBalance.aggregate({
      where: { engagementId },
      _sum: { closingBalance: true },
    });

    const confirmationPopulations = {
      ap: { count: apData._count.id, totalBalance: Number(apData._sum.balance || 0) },
      ar: { count: arData._count.id, totalBalance: Number(arData._sum.balance || 0) },
      bank: { count: bankCount, totalBalance: Number(bankBalanceData._sum.closingBalance || 0) },
    };

    // --- 5. Push to Execution: create/update FS Head Working Papers with enriched data ---
    let wpCreated = 0;
    let wpUpdated = 0;

    const fsHeadLinkedAccounts = new Map<string, string[]>();
    for (const [code, fsHead] of accountToFsHead) {
      if (!fsHeadLinkedAccounts.has(fsHead)) fsHeadLinkedAccounts.set(fsHead, []);
      fsHeadLinkedAccounts.get(fsHead)!.push(code);
    }

    for (const head of fsHeads) {
      if (head.accountCount === 0) continue;

      const linkedAccounts = fsHeadLinkedAccounts.get(head.code) || [];
      const txnCount = glTransactionCounts.get(head.code) || 0;
      const balance = Math.abs(Number(head.netBalance || 0));
      let inherentRisk = 'MEDIUM';
      if (balance > totalAssets * 0.1 || txnCount > 500) inherentRisk = 'HIGH';
      else if (balance < totalAssets * 0.01 && txnCount < 10) inherentRisk = 'LOW';

      const existing = await prisma.fSHeadWorkingPaper.findFirst({
        where: { engagementId, fsHeadKey: head.code },
      });

      if (!existing) {
        await prisma.fSHeadWorkingPaper.create({
          data: {
            engagementId,
            fsHeadKey: head.code,
            fsHeadName: head.name,
            statementType: head.statementType,
            currentYearBalance: head.netBalance,
            isMaterialHead: Number(head.netBalance) !== 0,
            linkedAccountIds: linkedAccounts,
            inherentRisk,
            riskLevel: inherentRisk,
          },
        });
        wpCreated++;
      } else {
        await prisma.fSHeadWorkingPaper.update({
          where: { id: existing.id },
          data: {
            fsHeadName: head.name,
            currentYearBalance: head.netBalance,
            linkedAccountIds: linkedAccounts,
            inherentRisk: existing.inherentRisk || inherentRisk,
            riskLevel: existing.riskLevel || inherentRisk,
          },
        });
        wpUpdated++;
      }
    }

    // --- 6. Upsert confirmation populations ---
    let confirmationsCreated = 0;
    for (const [type, pop] of Object.entries(confirmationPopulations)) {
      if (pop.count === 0) continue;
      const confType = type.toUpperCase();
      const existing = await prisma.confirmationPopulation.findFirst({
        where: { engagementId, confirmationType: confType },
      });
      if (!existing) {
        await prisma.confirmationPopulation.create({
          data: {
            engagementId,
            confirmationType: confType,
            balancePerBooks: pop.totalBalance,
            totalParties: pop.count,
          },
        });
        confirmationsCreated++;
      } else {
        await prisma.confirmationPopulation.update({
          where: { id: existing.id },
          data: {
            balancePerBooks: pop.totalBalance,
            totalParties: pop.count,
          },
        });
      }
    }

    await prisma.phaseProgress.upsert({
      where: { engagementId_phase: { engagementId, phase: "EXECUTION" } },
      update: { status: "NOT_STARTED", updatedAt: new Date() },
      create: { engagementId, phase: "EXECUTION", status: "NOT_STARTED" },
    });
    targets.push("Execution");
    targetResults.execution = { workingPapersCreated: wpCreated, workingPapersUpdated: wpUpdated };

    if (confirmationsCreated > 0) {
      targets.push("Confirmations");
    }

    const pushedAt = new Date().toISOString();

    const riskSummary = fsHeads
      .filter(h => h.accountCount > 0)
      .map(h => ({
        fsHeadKey: h.code,
        fsHeadName: h.name,
        balance: Math.abs(Number(h.netBalance || 0)),
        transactionCount: glTransactionCounts.get(h.code) || 0,
        inherentRisk: (() => {
          const bal = Math.abs(Number(h.netBalance || 0));
          const txn = glTransactionCounts.get(h.code) || 0;
          if (bal > totalAssets * 0.1 || txn > 500) return 'HIGH';
          if (bal < totalAssets * 0.01 && txn < 10) return 'LOW';
          return 'MEDIUM';
        })(),
      }));

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "SESSION",
        entityId: engagementId,
        action: "PUSH_FORWARD",
        newValue: {
          targets,
          draftFs: targetResults.draftFs,
          planning: planningInputs,
          execution: targetResults.execution,
          confirmations: confirmationPopulations,
          riskSummary,
          pushedAt,
        },
        performedById: userId,
      },
    });

    res.json({
      success: true,
      targets,
      draftFs: {
        headCount: draftFsData.length,
        heads: draftFsData,
      },
      planning: planningInputs,
      execution: {
        workingPapersCreated: wpCreated,
        workingPapersUpdated: wpUpdated,
      },
      confirmations: confirmationPopulations,
      riskSummary,
      pushedAt,
    });
  } catch (error) {
    console.error("Error pushing forward:", error);
    res.status(500).json({ error: "Failed to push forward" });
  }
});

router.get("/push-forward-status/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const lastPush = await prisma.mappingChangeLog.findFirst({
      where: { engagementId, action: "PUSH_FORWARD" },
      orderBy: { performedAt: "desc" },
    });

    if (!lastPush) {
      return res.json({ hasPushed: false });
    }

    const pushData = lastPush.newValue as any;
    const wpCount = await prisma.fSHeadWorkingPaper.count({ where: { engagementId } });
    const confCount = await prisma.confirmationPopulation.count({ where: { engagementId } });

    let pushedByName = 'Unknown';
    if (lastPush.performedById) {
      const user = await prisma.user.findUnique({ where: { id: lastPush.performedById }, select: { fullName: true } });
      if (user) pushedByName = user.fullName;
    }

    return res.json({
      hasPushed: true,
      pushedAt: pushData?.pushedAt || lastPush.performedAt?.toISOString(),
      pushedBy: pushedByName,
      targets: pushData?.targets || [],
      summary: {
        fsHeadCount: pushData?.draftFs?.headCount || 0,
        workingPapersCount: wpCount,
        confirmationPopulations: confCount,
        planningInputs: pushData?.planning ? {
          totalAssets: pushData.planning.totalAssets,
          totalRevenue: pushData.planning.totalRevenue,
          profitBeforeTax: pushData.planning.profitBeforeTax,
        } : null,
        riskSummary: pushData?.riskSummary || [],
      },
    });
  } catch (error) {
    console.error("Error fetching push forward status:", error);
    return res.status(500).json({ error: "Failed to fetch push forward status" });
  }
});

router.get("/summary/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId, isActive: true },
      include: { fsLines: { where: { isActive: true } } },
    });

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      include: { entries: true },
    });

    const allocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
    });

    const totalAccounts = tbBatch?.entries.length || 0;
    const mappedAccounts = allocations.length;
    const lockedAllocations = allocations.filter((a: any) => a.isLocked).length;

    const totalDr = tbBatch?.entries.reduce((sum: number, e: any) => sum + Number(e.closingDebit), 0) || 0;
    const totalCr = tbBatch?.entries.reduce((sum: number, e: any) => sum + Number(e.closingCredit), 0) || 0;
    const fsDr = fsHeads.reduce((sum: number, h: any) => sum + Number(h.totalDebit), 0);
    const fsCr = fsHeads.reduce((sum: number, h: any) => sum + Number(h.totalCredit), 0);

    res.json({
      completeness: totalAccounts > 0 ? Math.round((mappedAccounts / totalAccounts) * 100) : 0,
      isReconciled: Math.abs(totalDr - fsDr) < 1 && Math.abs(totalCr - fsCr) < 1,
      isLocked: lockedAllocations === mappedAccounts && mappedAccounts > 0,
      tbTotals: { debit: totalDr, credit: totalCr },
      fsTotals: { debit: fsDr, credit: fsCr },
      fsHeadCount: fsHeads.length,
      fsLineCount: fsHeads.reduce((sum: number, h: any) => sum + h.fsLines.length, 0),
      totalAccounts,
      mappedAccounts,
      unmappedAccounts: totalAccounts - mappedAccounts,
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

router.post("/push-from-tb", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: {
        entries: {
          orderBy: { accountCode: "asc" },
        },
      },
    });

    const entries = tbBatch?.entries || [];

    const errors: any[] = [];

    if (entries.length === 0) {
      errors.push({
        code: "TB_NOT_FOUND",
        message: "No Trial Balance data uploaded",
        tab: "tb",
        field: "data",
      });
    }

    if (entries.length > 0) {
      const totalClosingDr = entries.reduce((sum: number, e: any) => sum + Number(e.closingDebit || 0), 0);
      const totalClosingCr = entries.reduce((sum: number, e: any) => sum + Number(e.closingCredit || 0), 0);
      const closingDiff = Math.abs(totalClosingDr - totalClosingCr);
      if (closingDiff >= 1) {
        errors.push({
          code: "TB_NOT_BALANCED_CY",
          message: `Current Year TB is not balanced (Dr: ${totalClosingDr.toFixed(2)}, Cr: ${totalClosingCr.toFixed(2)}, Diff: ${closingDiff.toFixed(2)})`,
          tab: "tb",
          field: "closingDebit/closingCredit",
        });
      }

      const totalOpeningDr = entries.reduce((sum: number, e: any) => sum + Number(e.openingDebit || 0), 0);
      const totalOpeningCr = entries.reduce((sum: number, e: any) => sum + Number(e.openingCredit || 0), 0);
      const openingDiff = Math.abs(totalOpeningDr - totalOpeningCr);
      if (openingDiff >= 1) {
        errors.push({
          code: "TB_NOT_BALANCED_PY",
          message: `Prior Year TB is not balanced (Dr: ${totalOpeningDr.toFixed(2)}, Cr: ${totalOpeningCr.toFixed(2)}, Diff: ${openingDiff.toFixed(2)})`,
          tab: "tb",
          field: "openingDebit/openingCredit",
        });
      }

      const codeCounts = new Map<string, number>();
      for (const e of entries) {
        codeCounts.set(e.accountCode, (codeCounts.get(e.accountCode) || 0) + 1);
      }
      const duplicates = [...codeCounts.entries()].filter(([, count]) => count > 1).map(([code]) => code);
      if (duplicates.length > 0) {
        errors.push({
          code: "DUPLICATE_GL_CODES",
          message: `Duplicate GL codes found: ${duplicates.join(", ")}`,
          tab: "tb",
          duplicates,
        });
      }

      const missingFieldRows = entries.filter((e: any) => !e.accountCode || !e.accountName).length;
      if (missingFieldRows > 0) {
        errors.push({
          code: "MISSING_REQUIRED_FIELDS",
          message: `Missing required fields on ${missingFieldRows} rows`,
          tab: "tb",
          field: "accountCode/accountName",
        });
      }
    }

    if (errors.length > 0) {
      return res.status(422).json({ success: false, errors });
    }

    const distinctEntries = new Map<string, any>();
    for (const e of entries) {
      if (!distinctEntries.has(e.accountCode)) {
        distinctEntries.set(e.accountCode, {
          accountCode: e.accountCode,
          accountName: e.accountName,
          openingDebit: e.openingDebit,
          openingCredit: e.openingCredit,
          closingDebit: e.closingDebit,
          closingCredit: e.closingCredit,
          movementDebit: e.movementDebit,
          movementCredit: e.movementCredit,
        });
      }
    }

    const existingFSHead = await prisma.fSHead.findFirst({ where: { engagementId } });
    if (!existingFSHead) {
      const headMap: Record<string, string> = {};
      for (const head of DEFAULT_FS_HEADS) {
        const created = await prisma.fSHead.create({
          data: {
            engagementId,
            code: head.code,
            name: head.name,
            statementType: head.statementType as any,
            sortOrder: head.sortOrder,
          },
        });
        headMap[head.code] = created.id;
      }
      for (const head of DEFAULT_FS_HEADS) {
        if ((head as any).parentCode && headMap[(head as any).parentCode]) {
          await prisma.fSHead.update({
            where: { id: headMap[head.code] },
            data: { parentId: headMap[(head as any).parentCode] },
          });
        }
      }
      for (const line of DEFAULT_FS_LINES) {
        const headId = headMap[line.headCode];
        if (headId) {
          await prisma.fSLine.create({
            data: {
              engagementId,
              fsHeadId: headId,
              code: line.code,
              name: line.name,
              sortOrder: line.sortOrder,
            },
          });
        }
      }
    }

    let skippedLocked = 0;
    let updatedCount = 0;

    const tbAccountCodes = [...distinctEntries.keys()];
    const existingAllocations = await prisma.mappingAllocation.findMany({
      where: { engagementId, accountCode: { in: tbAccountCodes } },
    });
    const existingByCode = new Map(existingAllocations.map(a => [a.accountCode, a]));

    for (const accountCode of tbAccountCodes) {
      const existing = existingByCode.get(accountCode);
      if (existing) {
        if (existing.isLocked) {
          skippedLocked++;
        } else {
          await prisma.mappingAllocation.update({
            where: { id: existing.id },
            data: { status: "DRAFT" },
          });
          updatedCount++;
        }
      }
    }

    const totalAccounts = distinctEntries.size;
    const mappedCount = existingAllocations.length;
    const unmappedCount = totalAccounts - mappedCount;

    let mappingVersion = await prisma.coAFSMappingVersion.findFirst({
      where: { engagementId },
      orderBy: { versionNumber: "desc" },
    });

    if (!mappingVersion) {
      mappingVersion = await prisma.coAFSMappingVersion.create({
        data: {
          engagementId,
          versionNumber: 1,
          status: "DRAFT",
          totalAccounts,
          mappedCount,
          unmappedCount,
          allMappedOrExcluded: unmappedCount === 0,
        },
      });
    } else {
      mappingVersion = await prisma.coAFSMappingVersion.update({
        where: { id: mappingVersion.id },
        data: {
          totalAccounts,
          mappedCount,
          unmappedCount,
          allMappedOrExcluded: unmappedCount === 0,
        },
      });
    }

    const pushedAt = new Date().toISOString();

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "PUSH_FROM_TB",
        entityId: mappingVersion.id,
        action: "PUSH",
        newValue: { totalAccounts, mappedCount, unmappedCount, timestamp: pushedAt },
        performedById: userId,
      },
    });

    const mappingProgress = totalAccounts > 0 ? Math.round((mappedCount / totalAccounts) * 100) : 0;

    res.json({
      success: true,
      mappingVersionId: mappingVersion.id,
      totalAccounts,
      mappedAccounts: mappedCount,
      unmappedAccounts: unmappedCount,
      mappingProgress,
      skippedLocked,
      pushedAt,
      pushedBy: user?.fullName || "Unknown",
    });
  } catch (error) {
    console.error("Error pushing from TB:", error);
    res.status(500).json({ error: "Failed to push from TB" });
  }
});

const KEYWORD_RULES: { keywords: string[]; fsHeadCode: string; fsLineCode: string }[] = [
  { keywords: ["cash", "bank", "petty"], fsHeadCode: "ASSETS_CURRENT", fsLineCode: "CASH" },
  { keywords: ["receivable", "debtor", "ar "], fsHeadCode: "ASSETS_CURRENT", fsLineCode: "RECEIVABLES" },
  { keywords: ["inventory", "stock", "goods"], fsHeadCode: "ASSETS_CURRENT", fsLineCode: "INVENTORY" },
  { keywords: ["prepaid", "prepayment", "advance"], fsHeadCode: "ASSETS_CURRENT", fsLineCode: "PREPAYMENTS" },
  { keywords: ["property", "plant", "equipment", "ppe", "furniture", "vehicle", "machinery"], fsHeadCode: "ASSETS_NON_CURRENT", fsLineCode: "PPE" },
  { keywords: ["intangible", "goodwill", "patent", "trademark"], fsHeadCode: "ASSETS_NON_CURRENT", fsLineCode: "INTANGIBLES" },
  { keywords: ["investment", "securities"], fsHeadCode: "ASSETS_NON_CURRENT", fsLineCode: "INVESTMENTS" },
  { keywords: ["payable", "creditor", "ap ", "supplier"], fsHeadCode: "LIABILITIES_CURRENT", fsLineCode: "PAYABLES" },
  { keywords: ["accrued", "accrual"], fsHeadCode: "LIABILITIES_CURRENT", fsLineCode: "ACCRUALS" },
  { keywords: ["short-term loan", "overdraft", "short term borrowing"], fsHeadCode: "LIABILITIES_CURRENT", fsLineCode: "SHORT_TERM_BORROWINGS" },
  { keywords: ["tax payable", "income tax", "vat payable", "gst payable"], fsHeadCode: "LIABILITIES_CURRENT", fsLineCode: "TAX_PAYABLE" },
  { keywords: ["long-term loan", "long term debt", "mortgage", "bond payable"], fsHeadCode: "LIABILITIES_NON_CURRENT", fsLineCode: "LONG_TERM_DEBT" },
  { keywords: ["deferred tax liability"], fsHeadCode: "LIABILITIES_NON_CURRENT", fsLineCode: "DEFERRED_TAX" },
  { keywords: ["share capital", "common stock", "paid-in capital", "capital stock"], fsHeadCode: "EQUITY", fsLineCode: "SHARE_CAPITAL" },
  { keywords: ["retained earnings", "accumulated profit"], fsHeadCode: "EQUITY", fsLineCode: "RETAINED_EARNINGS" },
  { keywords: ["reserve", "revaluation"], fsHeadCode: "EQUITY", fsLineCode: "RESERVES" },
  { keywords: ["sales", "revenue", "income from operations"], fsHeadCode: "REVENUE", fsLineCode: "SALES_REVENUE" },
  { keywords: ["service income", "fee income", "consulting"], fsHeadCode: "REVENUE", fsLineCode: "SERVICE_REVENUE" },
  { keywords: ["cost of goods", "cost of sales", "cogs", "purchases"], fsHeadCode: "COST_OF_SALES", fsLineCode: "DIRECT_MATERIALS" },
  { keywords: ["salary", "wage", "payroll", "staff cost"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "SALARIES" },
  { keywords: ["rent", "lease"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "RENT" },
  { keywords: ["utility", "electric", "water", "gas"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "UTILITIES" },
  { keywords: ["depreciation", "amortization"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "DEPRECIATION" },
  { keywords: ["admin", "office", "general expense"], fsHeadCode: "OPERATING_EXPENSES", fsLineCode: "ADMIN_EXPENSES" },
  { keywords: ["interest income", "finance income"], fsHeadCode: "OTHER_INCOME", fsLineCode: "INTEREST_INCOME" },
  { keywords: ["interest expense", "finance cost", "finance charge"], fsHeadCode: "FINANCE_COSTS", fsLineCode: "INTEREST_EXPENSE" },
  { keywords: ["bank charge", "bank fee"], fsHeadCode: "FINANCE_COSTS", fsLineCode: "BANK_CHARGES" },
  { keywords: ["tax expense", "income tax expense"], fsHeadCode: "TAX", fsLineCode: "CURRENT_TAX" },
];

const TYPICALLY_CR_HEADS = ["LIABILITIES", "LIABILITIES_CURRENT", "LIABILITIES_NON_CURRENT", "EQUITY", "REVENUE", "OTHER_INCOME"];
const TYPICALLY_DR_HEADS = ["ASSETS", "ASSETS_CURRENT", "ASSETS_NON_CURRENT", "COST_OF_SALES", "OPERATING_EXPENSES", "FINANCE_COSTS", "TAX"];

router.get("/exceptions/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { entries: true },
    });

    if (!tbBatch) {
      return res.json({ exceptions: [], summary: { total: 0, high: 0, medium: 0, low: 0 } });
    }

    const allocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
      include: { fsHead: true, fsLine: true },
    });

    const entryMap = new Map(tbBatch.entries.map((e: any) => [e.accountCode, e]));
    const allocByCode = new Map(allocations.map((a: any) => [a.accountCode, a]));

    const exceptions: any[] = [];
    let exId = 0;

    const headAllocMap = new Map<string, string[]>();
    for (const alloc of allocations) {
      const existing = headAllocMap.get(alloc.accountCode) || [];
      existing.push(alloc.fsHeadId);
      headAllocMap.set(alloc.accountCode, existing);
    }

    for (const [accountCode, headIds] of headAllocMap.entries()) {
      const uniqueHeads = [...new Set(headIds)];
      if (uniqueHeads.length > 1) {
        const entry = entryMap.get(accountCode);
        const alloc = allocByCode.get(accountCode);
        exceptions.push({
          id: `DUPLICATE_${accountCode}`,
          type: "DUPLICATE",
          severity: "HIGH",
          accountCode,
          accountName: entry?.accountName || "",
          message: `Account ${accountCode} is mapped to ${uniqueHeads.length} different FS heads`,
          suggestedFix: "Remove duplicate mappings and keep only the correct one",
          status: "OPEN",
          fsHeadId: alloc?.fsHeadId || null,
          fsHeadName: alloc?.fsHead?.name || null,
        });
      }
    }

    for (const alloc of allocations) {
      const entry = entryMap.get(alloc.accountCode);
      if (!entry || !alloc.fsHead) continue;

      const headCode = alloc.fsHead.code;
      const closingDr = Number(entry.closingDebit || 0);
      const closingCr = Number(entry.closingCredit || 0);
      const netBalance = closingDr - closingCr;

      const isCrHead = TYPICALLY_CR_HEADS.includes(headCode);
      const isDrHead = TYPICALLY_DR_HEADS.includes(headCode);

      if (isDrHead && netBalance < 0 && Math.abs(netBalance) > 1) {
        exceptions.push({
          id: `SIGN_MISMATCH_${alloc.accountCode}`,
          type: "SIGN_MISMATCH",
          severity: "MEDIUM",
          accountCode: alloc.accountCode,
          accountName: entry.accountName,
          message: `Credit balance (${netBalance.toFixed(2)}) mapped to typically-DR head "${alloc.fsHead.name}"`,
          suggestedFix: `Review if this account should be mapped to a liability or equity head instead`,
          status: "OPEN",
          fsHeadId: alloc.fsHeadId,
          fsHeadName: alloc.fsHead.name,
        });
      } else if (isCrHead && netBalance > 0 && Math.abs(netBalance) > 1) {
        exceptions.push({
          id: `SIGN_MISMATCH_${alloc.accountCode}`,
          type: "SIGN_MISMATCH",
          severity: "MEDIUM",
          accountCode: alloc.accountCode,
          accountName: entry.accountName,
          message: `Debit balance (${netBalance.toFixed(2)}) mapped to typically-CR head "${alloc.fsHead.name}"`,
          suggestedFix: `Review if this account should be mapped to an asset or expense head instead`,
          status: "OPEN",
          fsHeadId: alloc.fsHeadId,
          fsHeadName: alloc.fsHead.name,
        });
      }
    }

    const suspenseKeywords = ["suspense", "clearing", "control"];
    for (const entry of tbBatch.entries) {
      const nameLower = (entry.accountName || "").toLowerCase();
      const isSuspenseType = suspenseKeywords.some(kw => nameLower.includes(kw));
      if (isSuspenseType && !allocByCode.has(entry.accountCode)) {
        exceptions.push({
          id: `SUSPENSE_${entry.accountCode}`,
          type: "SUSPENSE",
          severity: "HIGH",
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          message: `Suspense/clearing/control account "${entry.accountName}" is unmapped`,
          suggestedFix: "Map this account to the appropriate FS head or investigate the balance",
          status: "OPEN",
          fsHeadId: null,
          fsHeadName: null,
        });
      }
    }

    const allocsByAccount = new Map<string, any[]>();
    for (const alloc of allocations) {
      const arr = allocsByAccount.get(alloc.accountCode) || [];
      arr.push(alloc);
      allocsByAccount.set(alloc.accountCode, arr);
    }
    for (const [accountCode, allocs] of allocsByAccount.entries()) {
      if (allocs.length > 1) {
        const totalPct = allocs.reduce((sum: number, a: any) => sum + Number(a.allocationPct || 100), 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          const entry = entryMap.get(accountCode);
          exceptions.push({
            id: `SPLIT_REQUIRED_${accountCode}`,
            type: "SPLIT_REQUIRED",
            severity: "MEDIUM",
            accountCode,
            accountName: entry?.accountName || "",
            message: `Split allocations total ${totalPct.toFixed(2)}% instead of 100%`,
            suggestedFix: "Adjust allocation percentages to sum to exactly 100%",
            status: "OPEN",
            fsHeadId: allocs[0]?.fsHeadId || null,
            fsHeadName: allocs[0]?.fsHead?.name || null,
          });
        }
      }
    }

    const tbTotalDr = tbBatch.entries.reduce((sum: number, e: any) => sum + Number(e.closingDebit || 0), 0);
    const tbTotalCr = tbBatch.entries.reduce((sum: number, e: any) => sum + Number(e.closingCredit || 0), 0);

    let mappedDr = 0;
    let mappedCr = 0;
    for (const alloc of allocations) {
      const entry = entryMap.get(alloc.accountCode);
      if (!entry) continue;
      const pct = Number(alloc.allocationPct || 100) / 100;
      mappedDr += Number(entry.closingDebit || 0) * pct;
      mappedCr += Number(entry.closingCredit || 0) * pct;
    }

    const drDiff = Math.abs(tbTotalDr - mappedDr);
    const crDiff = Math.abs(tbTotalCr - mappedCr);

    if (drDiff > 1 || crDiff > 1) {
      exceptions.push({
        id: `CONTROL_TOTAL_DR_CR`,
        type: "CONTROL_TOTAL",
        severity: "HIGH",
        accountCode: "",
        accountName: "",
        message: `Control total mismatch - DR diff: ${drDiff.toFixed(2)}, CR diff: ${crDiff.toFixed(2)}`,
        suggestedFix: "Ensure all TB accounts are mapped and allocation percentages are correct",
        status: "OPEN",
        fsHeadId: null,
        fsHeadName: null,
      });
    }

    const high = exceptions.filter((e: any) => e.severity === "HIGH").length;
    const medium = exceptions.filter((e: any) => e.severity === "MEDIUM").length;
    const low = exceptions.filter((e: any) => e.severity === "LOW").length;

    res.json({
      exceptions,
      summary: { total: exceptions.length, high, medium, low },
    });
  } catch (error) {
    console.error("Error fetching exceptions:", error);
    res.status(500).json({ error: "Failed to fetch mapping exceptions" });
  }
});

router.post("/exceptions/resolve", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, exceptionId, resolution, fsHeadId, fsLineId, splitAllocations } = req.body;
    const userId = req.user!.id;

    const parts = exceptionId.split("_");
    const type = parts[0];
    const accountCode = parts.slice(1).join("_");

    if (resolution === "FIX") {
      if (!fsHeadId) {
        return res.status(400).json({ error: "fsHeadId is required for FIX resolution" });
      }

      const existing = await prisma.mappingAllocation.findUnique({
        where: { engagementId_accountCode: { engagementId, accountCode } },
      });

      if (existing) {
        await prisma.mappingAllocation.update({
          where: { id: existing.id },
          data: { fsHeadId, fsLineId: fsLineId || null, isUserOverride: true },
        });
      } else {
        await prisma.mappingAllocation.create({
          data: {
            engagementId,
            accountCode,
            fsHeadId,
            fsLineId: fsLineId || null,
            status: "CONFIRMED",
            isUserOverride: true,
          },
        });
      }

      await prisma.mappingChangeLog.create({
        data: {
          engagementId,
          entityType: "EXCEPTION",
          entityId: exceptionId,
          action: "RESOLVE_FIX",
          oldValue: { exceptionId, type },
          newValue: { fsHeadId, fsLineId, resolution },
          reason: `Exception ${exceptionId} resolved via FIX`,
          performedById: userId,
        },
      });
    } else if (resolution === "APPROVE") {
      await prisma.mappingChangeLog.create({
        data: {
          engagementId,
          entityType: "EXCEPTION",
          entityId: exceptionId,
          action: "RESOLVE_APPROVE",
          newValue: { exceptionId, type, resolution, approvedBy: userId },
          reason: `Exception ${exceptionId} approved by partner`,
          performedById: userId,
        },
      });
    } else if (resolution === "SPLIT") {
      if (!splitAllocations || !Array.isArray(splitAllocations) || splitAllocations.length === 0) {
        return res.status(400).json({ error: "splitAllocations array is required for SPLIT resolution" });
      }

      await prisma.mappingAllocation.deleteMany({
        where: { engagementId, accountCode },
      });

      for (const split of splitAllocations) {
        await prisma.mappingAllocation.create({
          data: {
            engagementId,
            accountCode,
            fsHeadId: split.fsHeadId,
            fsLineId: split.fsLineId || null,
            allocationPct: new Decimal(split.allocationPct),
            status: "CONFIRMED",
            isUserOverride: true,
          },
        });
      }

      await prisma.mappingChangeLog.create({
        data: {
          engagementId,
          entityType: "EXCEPTION",
          entityId: exceptionId,
          action: "RESOLVE_SPLIT",
          newValue: { exceptionId, type, resolution, splits: splitAllocations },
          reason: `Exception ${exceptionId} resolved via SPLIT`,
          performedById: userId,
        },
      });
    } else {
      return res.status(400).json({ error: "Invalid resolution type. Must be FIX, APPROVE, or SPLIT" });
    }

    res.json({ success: true, exceptionId, resolution });
  } catch (error) {
    console.error("Error resolving exception:", error);
    res.status(500).json({ error: "Failed to resolve exception" });
  }
});

router.post("/approve-lock", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.body;
    const userId = req.user!.id;

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { entries: true },
    });

    if (!tbBatch) {
      return res.status(400).json({ error: "No approved TB found" });
    }

    const allocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
      include: { fsHead: true },
    });

    const mappedCodes = new Set(allocations.map((a: any) => a.accountCode));
    const unmappedEntries = tbBatch.entries.filter((e: any) => !mappedCodes.has(e.accountCode));

    if (unmappedEntries.length > 0) {
      return res.status(400).json({
        error: `Cannot approve & lock: ${unmappedEntries.length} accounts are unmapped`,
        unmappedCount: unmappedEntries.length,
        unmappedAccounts: unmappedEntries.slice(0, 10).map((e: any) => ({
          accountCode: e.accountCode,
          accountName: e.accountName,
        })),
      });
    }

    const entryMap = new Map(tbBatch.entries.map((e: any) => [e.accountCode, e]));
    const highExceptions: string[] = [];

    const headAllocMap = new Map<string, string[]>();
    for (const alloc of allocations) {
      const existing = headAllocMap.get(alloc.accountCode) || [];
      existing.push(alloc.fsHeadId);
      headAllocMap.set(alloc.accountCode, existing);
    }
    for (const [accountCode, headIds] of headAllocMap.entries()) {
      if ([...new Set(headIds)].length > 1) {
        highExceptions.push(`Duplicate mapping: ${accountCode}`);
      }
    }

    for (const entry of tbBatch.entries) {
      const nameLower = (entry.accountName || "").toLowerCase();
      if (["suspense", "clearing", "control"].some(kw => nameLower.includes(kw)) && !mappedCodes.has(entry.accountCode)) {
        highExceptions.push(`Unmapped suspense/clearing account: ${entry.accountCode}`);
      }
    }

    const tbTotalDr = tbBatch.entries.reduce((sum: number, e: any) => sum + Number(e.closingDebit || 0), 0);
    const tbTotalCr = tbBatch.entries.reduce((sum: number, e: any) => sum + Number(e.closingCredit || 0), 0);
    let mappedDr = 0, mappedCr = 0;
    for (const alloc of allocations) {
      const entry = entryMap.get(alloc.accountCode);
      if (!entry) continue;
      const pct = Number(alloc.allocationPct || 100) / 100;
      mappedDr += Number(entry.closingDebit || 0) * pct;
      mappedCr += Number(entry.closingCredit || 0) * pct;
    }
    if (Math.abs(tbTotalDr - mappedDr) > 1 || Math.abs(tbTotalCr - mappedCr) > 1) {
      highExceptions.push("Control total mismatch between TB and mapped amounts");
    }

    const approvedExceptions = await prisma.mappingChangeLog.findMany({
      where: {
        engagementId,
        action: "RESOLVE_APPROVE",
        entityType: "EXCEPTION",
      },
    });
    const approvedIds = new Set(approvedExceptions.map((a: any) => {
      const val = a.newValue as any;
      return val?.exceptionId || "";
    }));

    const unresolvedHigh = highExceptions.filter(msg => {
      const code = msg.split(": ")[1] || "";
      return !approvedIds.has(`DUPLICATE_${code}`) && !approvedIds.has(`SUSPENSE_${code}`) && !approvedIds.has(`CONTROL_TOTAL_DR_CR`);
    });

    if (unresolvedHigh.length > 0) {
      return res.status(400).json({
        error: "Cannot approve & lock: HIGH severity exceptions remain open",
        highExceptions: unresolvedHigh,
      });
    }

    const latestVersion = await prisma.coAFSMappingVersion.findFirst({
      where: { engagementId },
      orderBy: { versionNumber: "desc" },
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;
    const totalAccounts = tbBatch.entries.length;
    const mappedCount = allocations.length;

    const version = await prisma.coAFSMappingVersion.create({
      data: {
        engagementId,
        versionNumber: newVersionNumber,
        status: "LOCKED",
        totalAccounts,
        mappedCount,
        unmappedCount: 0,
        allMappedOrExcluded: true,
        lockedAt: new Date(),
        lockedById: userId,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    await prisma.mappingAllocation.updateMany({
      where: { engagementId },
      data: { isLocked: true, lockedById: userId, lockedAt: new Date() },
    });

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "VERSION",
        entityId: version.id,
        action: "APPROVE_LOCK",
        newValue: { versionNumber: newVersionNumber, totalAccounts, mappedCount, lockedAt: new Date().toISOString() },
        reason: `Mapping approved and locked as version ${newVersionNumber}`,
        performedById: userId,
      },
    });

    res.json({
      success: true,
      version: {
        id: version.id,
        versionNumber: newVersionNumber,
        status: "LOCKED",
        totalAccounts,
        mappedCount,
        lockedAt: version.lockedAt,
        approvedAt: version.approvedAt,
      },
    });
  } catch (error) {
    console.error("Error in approve-lock:", error);
    res.status(500).json({ error: "Failed to approve and lock mapping" });
  }
});

router.get("/version-trail/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const currentVersion = await prisma.coAFSMappingVersion.findFirst({
      where: { engagementId },
      orderBy: { versionNumber: "desc" },
    });

    const changeLog = await prisma.mappingChangeLog.findMany({
      where: { engagementId },
      orderBy: { performedAt: "desc" },
      take: 50,
    });

    const performerIds = [...new Set(changeLog.map((e: any) => e.performedById).filter(Boolean))];
    const performers = performerIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: performerIds } }, select: { id: true, fullName: true } })
      : [];
    const performerMap = new Map(performers.map((p: any) => [p.id, p.fullName]));

    const logEntries = changeLog.map((entry: any) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      reason: entry.reason,
      performedAt: entry.performedAt,
      performedById: entry.performedById,
      performedByName: performerMap.get(entry.performedById) || null,
    }));

    res.json({
      currentVersion: currentVersion ? {
        id: currentVersion.id,
        versionNumber: currentVersion.versionNumber,
        status: currentVersion.status,
        totalAccounts: currentVersion.totalAccounts,
        mappedCount: currentVersion.mappedCount,
        unmappedCount: currentVersion.unmappedCount,
        allMappedOrExcluded: currentVersion.allMappedOrExcluded,
        lockedAt: currentVersion.lockedAt,
        approvedAt: currentVersion.approvedAt,
        submittedAt: currentVersion.submittedAt,
      } : null,
      changeLog: logEntries,
    });
  } catch (error) {
    console.error("Error fetching version trail:", error);
    res.status(500).json({ error: "Failed to fetch version trail" });
  }
});

router.get("/reconciliation-ribbon/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { entries: true },
    });

    let tbEntries: Array<{ accountCode: string; accountName: string; closingDebit: number; closingCredit: number }> = [];

    if (tbBatch && tbBatch.entries.length > 0) {
      tbEntries = tbBatch.entries.map((e: any) => ({
        accountCode: e.accountCode,
        accountName: e.accountName,
        closingDebit: Number(e.closingDebit || 0),
        closingCredit: Number(e.closingCredit || 0),
      }));
    } else {
      const importBalances = await prisma.importAccountBalance.findMany({
        where: { engagementId, balanceType: "CB" },
      });
      if (importBalances.length > 0) {
        tbEntries = importBalances.map((ib: any) => ({
          accountCode: ib.accountCode,
          accountName: ib.accountName,
          closingDebit: Number(ib.debitAmount || 0),
          closingCredit: Number(ib.creditAmount || 0),
        }));
      }
    }

    if (tbEntries.length === 0) {
      return res.json({
        tbTotal: 0,
        mappedTotal: 0,
        unmappedTotal: 0,
        difference: 0,
        unmappedAccounts: [],
        mappedByHead: [],
      });
    }

    const allocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
      include: { fsHead: true },
    });

    const allocByCode = new Map(allocations.map((a: any) => [a.accountCode, a]));

    let tbTotal = 0;
    let mappedTotal = 0;
    let unmappedTotal = 0;
    const unmappedAccounts: any[] = [];
    const headTotals = new Map<string, { fsHeadId: string; fsHeadName: string; total: number; accountCount: number }>();

    for (const entry of tbEntries) {
      const netBalance = entry.closingDebit - entry.closingCredit;
      const absBalance = Math.abs(netBalance);
      tbTotal += absBalance;
      const alloc = allocByCode.get(entry.accountCode);

      if (alloc) {
        const pct = Number(alloc.allocationPct || 100) / 100;
        const allocatedBalance = absBalance * pct;
        mappedTotal += allocatedBalance;

        const headId = alloc.fsHeadId;
        const existing = headTotals.get(headId) || {
          fsHeadId: headId,
          fsHeadName: alloc.fsHead?.name || "",
          total: 0,
          accountCount: 0,
        };
        existing.total += allocatedBalance;
        existing.accountCount++;
        headTotals.set(headId, existing);
      } else {
        unmappedTotal += absBalance;
        unmappedAccounts.push({
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          balance: netBalance,
        });
      }
    }

    res.json({
      tbTotal,
      mappedTotal,
      unmappedTotal,
      difference: tbTotal - mappedTotal,
      unmappedAccounts,
      mappedByHead: Array.from(headTotals.values()),
    });
  } catch (error) {
    console.error("Error fetching reconciliation ribbon:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation data" });
  }
});

router.post("/ai-suggest-mapping", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, accountCode, accountName, netBalance, accountType } = req.body;

    if (!engagementId || !accountCode || !accountName) {
      return res.status(400).json({ error: "engagementId, accountCode, and accountName are required" });
    }

    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId, isActive: true },
      include: { fsLines: { where: { isActive: true } } },
    });

    if (fsHeads.length === 0) {
      return res.status(400).json({ error: "No FS taxonomy initialized" });
    }

    const taxonomy = fsHeads.map((h: any) => ({
      id: h.id, code: h.code, name: h.name, type: h.statementType,
      lines: h.fsLines.map((l: any) => ({ id: l.id, code: l.code, name: l.name })),
    }));

    const existingMappings = await prisma.mappingAllocation.findMany({
      where: { engagementId },
      take: 20,
    });
    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      include: { entries: { take: 5, where: { accountCode: { not: accountCode } } } },
    });
    const contextExamples = existingMappings.slice(0, 8).map((m: any) => {
      const head = fsHeads.find((h: any) => h.id === m.fsHeadId);
      const line = head?.fsLines?.find((l: any) => l.id === m.fsLineId);
      return `${m.accountCode} → ${head?.name || 'Unknown'}${line ? ' / ' + line.name : ''}`;
    });

    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      return res.status(503).json({ error: "AI service not configured" });
    }

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const systemPrompt = `You are an expert statutory auditor helping map Trial Balance accounts to Financial Statement heads/lines.

Given an account from a Trial Balance, suggest the best FS Head and optionally an FS Line from the available taxonomy.

Available FS taxonomy:
${JSON.stringify(taxonomy, null, 2)}

${contextExamples.length > 0 ? `Existing mappings for context:\n${contextExamples.join('\n')}` : ''}

Respond ONLY with valid JSON in this exact format:
{
  "fsHeadId": "<id of the best matching FS Head>",
  "fsHeadName": "<name of the FS Head>",
  "fsLineId": "<id of the best matching FS Line, or null>",
  "fsLineName": "<name of the FS Line, or null>",
  "confidence": <0.0-1.0>,
  "rationale": "<brief explanation of why this mapping is appropriate>",
  "alternativeHeadId": "<id of second-best FS Head if applicable, or null>",
  "alternativeHeadName": "<name of second-best FS Head, or null>"
}`;

    const userPrompt = `Map this Trial Balance account:
- Account Code: ${accountCode}
- Account Name: ${accountName}
- Net Balance: ${netBalance ?? 'Unknown'}
- Account Type: ${accountType ?? 'Unknown'}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "AI returned invalid response format" });
    }

    const suggestion = JSON.parse(jsonMatch[0]);

    const validHead = fsHeads.find((h: any) => h.id === suggestion.fsHeadId);
    if (!validHead) {
      const fallbackHead = fsHeads.find((h: any) =>
        h.name.toLowerCase().includes(suggestion.fsHeadName?.toLowerCase()?.split(' ')[0] || '')
      );
      if (fallbackHead) {
        suggestion.fsHeadId = fallbackHead.id;
        suggestion.fsHeadName = fallbackHead.name;
        const fallbackLine = fallbackHead.fsLines?.find((l: any) =>
          l.name.toLowerCase().includes(suggestion.fsLineName?.toLowerCase()?.split(' ')[0] || '')
        );
        if (fallbackLine) {
          suggestion.fsLineId = fallbackLine.id;
          suggestion.fsLineName = fallbackLine.name;
        } else {
          suggestion.fsLineId = null;
          suggestion.fsLineName = null;
        }
      } else {
        suggestion.confidence = 0.3;
        suggestion.rationale = "AI suggestion could not be validated against taxonomy";
      }
    }

    res.json({ suggestion });
  } catch (error) {
    console.error("Error in AI suggest mapping:", error);
    res.status(500).json({ error: "Failed to get AI mapping suggestion" });
  }
});

router.post("/ai-suggest-batch", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, accounts } = req.body;

    if (!engagementId || !accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: "engagementId and accounts array required" });
    }

    const batchSize = Math.min(accounts.length, 25);
    const batch = accounts.slice(0, batchSize);

    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId, isActive: true },
      include: { fsLines: { where: { isActive: true } } },
    });

    if (fsHeads.length === 0) {
      return res.status(400).json({ error: "No FS taxonomy initialized" });
    }

    const taxonomy = fsHeads.map((h: any) => ({
      id: h.id, code: h.code, name: h.name, type: h.statementType,
      lines: h.fsLines.map((l: any) => ({ id: l.id, code: l.code, name: l.name })),
    }));

    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      return res.status(503).json({ error: "AI service not configured" });
    }

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const accountsList = batch.map((a: any) =>
      `- ${a.accountCode}: ${a.accountName} (Balance: ${a.netBalance ?? 'N/A'})`
    ).join('\n');

    const systemPrompt = `You are an expert statutory auditor mapping Trial Balance accounts to Financial Statement heads/lines.

Available FS taxonomy:
${JSON.stringify(taxonomy, null, 2)}

For EACH account, respond with a JSON array. Each element:
{
  "accountCode": "<the account code>",
  "fsHeadId": "<best matching FS Head id>",
  "fsHeadName": "<FS Head name>",
  "fsLineId": "<best FS Line id or null>",
  "fsLineName": "<FS Line name or null>",
  "confidence": <0.0-1.0>,
  "rationale": "<brief reason>"
}

Respond ONLY with the JSON array, no other text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Map these accounts:\n${accountsList}` },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "AI returned invalid response format" });
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    const validSuggestions = suggestions.map((s: any) => {
      const validHead = fsHeads.find((h: any) => h.id === s.fsHeadId);
      if (!validHead) {
        const fallback = fsHeads.find((h: any) =>
          h.name.toLowerCase().includes((s.fsHeadName || '').toLowerCase().split(' ')[0])
        );
        if (fallback) {
          s.fsHeadId = fallback.id;
          s.fsHeadName = fallback.name;
          const fLine = fallback.fsLines?.find((l: any) =>
            l.name.toLowerCase().includes((s.fsLineName || '').toLowerCase().split(' ')[0])
          );
          s.fsLineId = fLine?.id || null;
          s.fsLineName = fLine?.name || null;
        } else {
          s.confidence = 0.3;
        }
      }
      return s;
    });

    res.json({ suggestions: validSuggestions });
  } catch (error) {
    console.error("Error in AI batch suggest:", error);
    res.status(500).json({ error: "Failed to get AI batch suggestions" });
  }
});

router.post("/auto-map-enhanced", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, mode } = req.body;

    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId, isActive: true },
      include: { fsLines: { where: { isActive: true } } },
    });

    const fsLines = fsHeads.flatMap((h: any) => h.fsLines);

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      include: { entries: true },
    });

    let entries: Array<{ accountCode: string; accountName: string; closingDebit?: any; closingCredit?: any }> = [];

    if (tbBatch && tbBatch.entries.length > 0) {
      entries = tbBatch.entries;
    } else {
      const importBalances = await prisma.importAccountBalance.findMany({
        where: { engagementId, balanceType: 'CB' },
      });

      if (importBalances.length === 0) {
        return res.status(400).json({ error: "No TB data available" });
      }

      entries = importBalances.map((ib: any) => ({
        accountCode: ib.accountCode,
        accountName: ib.accountName,
        closingDebit: Number(ib.debitAmount || 0),
        closingCredit: Number(ib.creditAmount || 0),
      }));
    }

    const existingAllocations = await prisma.mappingAllocation.findMany({
      where: { engagementId },
    });
    const mappedCodes = new Set(existingAllocations.map((a: any) => a.accountCode));

    const headByCode = new Map(fsHeads.map((h: any) => [h.code, h]));
    const lineByCode = new Map(fsLines.map((l: any) => [l.code, l]));

    const suggestions: any[] = [];

    for (const entry of entries) {
      if (mappedCodes.has(entry.accountCode)) continue;

      const accountNameLower = entry.accountName.toLowerCase();
      let bestMatch: { rule: typeof KEYWORD_RULES[0]; confidence: number; reason: string } | null = null;

      for (const rule of KEYWORD_RULES) {
        for (const kw of rule.keywords) {
          let confidence = 0;
          let reason = "";

          if (accountNameLower === kw) {
            confidence = 0.95;
            reason = `Exact name match with keyword "${kw}"`;
          } else if (accountNameLower.startsWith(kw)) {
            confidence = 0.90;
            reason = `Account name starts with keyword "${kw}"`;
          } else if (accountNameLower.includes(kw)) {
            confidence = 0.80;
            reason = `Account name contains keyword "${kw}"`;
          } else {
            const kwWords = kw.split(/\s+/);
            const nameWords = accountNameLower.split(/\s+/);
            const matchCount = kwWords.filter(w => nameWords.some(nw => nw.includes(w))).length;
            if (matchCount > 0 && matchCount >= kwWords.length * 0.5) {
              confidence = 0.65;
              reason = `Partial match with keyword "${kw}" (${matchCount}/${kwWords.length} words)`;
            }
          }

          if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
            bestMatch = { rule, confidence, reason };
          }
        }
      }

      const head = bestMatch ? headByCode.get(bestMatch.rule.fsHeadCode) : null;
      const line = bestMatch ? lineByCode.get(bestMatch.rule.fsLineCode) : null;

      const finalConfidence = bestMatch ? bestMatch.confidence : 0.35;
      const finalReason = bestMatch ? bestMatch.reason : "No keyword match found - manual review required";

      suggestions.push({
        entryId: (entry as any).id || entry.accountCode,
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        suggestedFsHeadId: head?.id || null,
        suggestedFsHeadName: head?.name || null,
        suggestedFsLineId: line?.id || null,
        suggestedFsLineName: line?.name || null,
        confidence: finalConfidence,
        reason: finalReason,
        isException: finalConfidence < 0.65,
      });
    }

    suggestions.sort((a: any, b: any) => b.confidence - a.confidence);

    const exceptionsCount = suggestions.filter((s: any) => s.isException).length;

    res.json({
      suggestions,
      totalSuggestions: suggestions.length,
      exceptionsCount,
      mode: mode || "RULES_ONLY",
    });
  } catch (error) {
    console.error("Error in enhanced auto-map:", error);
    res.status(500).json({ error: "Failed to run enhanced auto-map" });
  }
});

router.post("/auto-map-apply", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, mappings } = req.body;
    const userId = req.user!.id;

    if (!engagementId || typeof engagementId !== "string") {
      return res.status(400).json({ error: "engagementId is required" });
    }
    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ error: "mappings array is required" });
    }

    const validMappings = mappings.filter(
      (m: any) => m.accountCode && typeof m.accountCode === "string" && m.fsHeadId && typeof m.fsHeadId === "string"
    );
    if (validMappings.length === 0) {
      return res.status(400).json({ error: "No valid mappings provided (each must have accountCode and fsHeadId)" });
    }

    const requestedFsHeadIds = [...new Set(validMappings.map((m: any) => m.fsHeadId as string))];
    const requestedFsLineIds = [...new Set(validMappings.filter((m: any) => m.fsLineId).map((m: any) => m.fsLineId as string))];

    const validFsHeads = await prisma.fSHead.findMany({
      where: { id: { in: requestedFsHeadIds }, engagementId },
      select: { id: true },
    });
    const validHeadIdSet = new Set(validFsHeads.map(h => h.id));

    let validLineIdSet = new Set<string>();
    if (requestedFsLineIds.length > 0) {
      const validFsLines = await prisma.fSLine.findMany({
        where: { id: { in: requestedFsLineIds }, engagementId },
        select: { id: true },
      });
      validLineIdSet = new Set(validFsLines.map(l => l.id));
    }

    const accountCodes = validMappings.map((m: any) => m.accountCode as string);
    const existingAllocations = await prisma.mappingAllocation.findMany({
      where: { engagementId, accountCode: { in: accountCodes } },
      select: { id: true, accountCode: true, isLocked: true },
    });
    const existingMap = new Map(existingAllocations.map(e => [e.accountCode, e]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 50;
    for (let i = 0; i < validMappings.length; i += BATCH_SIZE) {
      const batch = validMappings.slice(i, i + BATCH_SIZE);
      const ops: any[] = [];

      for (const mapping of batch) {
        const { accountCode, fsHeadId, fsLineId } = mapping;

        if (!validHeadIdSet.has(fsHeadId)) {
          errors.push(`${accountCode}: fsHeadId "${fsHeadId}" not found`);
          skipped++;
          continue;
        }

        const resolvedFsLineId = fsLineId && validLineIdSet.has(fsLineId) ? fsLineId : null;
        const existing = existingMap.get(accountCode);

        if (existing) {
          if (existing.isLocked) {
            skipped++;
            continue;
          }
          ops.push(
            prisma.mappingAllocation.update({
              where: { id: existing.id },
              data: {
                fsHeadId,
                fsLineId: resolvedFsLineId,
                status: "CONFIRMED",
                aiSuggested: true,
              },
            })
          );
          updated++;
        } else {
          ops.push(
            prisma.mappingAllocation.create({
              data: {
                engagementId,
                accountCode,
                fsHeadId,
                fsLineId: resolvedFsLineId,
                status: "CONFIRMED",
                aiSuggested: true,
              },
            })
          );
          created++;
        }
      }

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }
    }

    await prisma.mappingChangeLog.create({
      data: {
        engagementId,
        entityType: "ALLOCATION",
        entityId: "auto-map-apply",
        action: "AUTO_MAP_APPLY",
        newValue: { totalApplied: created + updated, created, updated, skipped, errors: errors.slice(0, 10) },
        performedById: userId,
      },
    });

    res.json({ success: true, created, updated, skipped, totalApplied: created + updated, errors: errors.length > 0 ? errors.slice(0, 10) : undefined });
  } catch (error) {
    console.error("Error applying auto-map:", error);
    const message = error instanceof Error ? error.message : "Failed to apply auto-map suggestions";
    res.status(500).json({ error: message });
  }
});

export default router;
