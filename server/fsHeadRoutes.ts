import { Router, Request, Response } from "express";
import { prisma } from "./db";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

const db = prisma as any;

const EVIDENCE_UPLOAD_DIR = path.join(process.cwd(), "uploads", "evidence");
if (!fs.existsSync(EVIDENCE_UPLOAD_DIR)) {
  fs.mkdirSync(EVIDENCE_UPLOAD_DIR, { recursive: true });
}

const evidenceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, EVIDENCE_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${nanoid()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const evidenceUpload = multer({
  storage: evidenceStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg", "image/png", "image/gif",
      "text/csv", "text/plain"
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

const procedureSchema = z.object({
  title: z.string().min(1, "Title is required"),
  isaReference: z.string().optional(),
  description: z.string().optional(),
});

const procedureUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  isaReference: z.string().optional(),
  description: z.string().optional(),
  conclusion: z.string().optional(),
  findings: z.string().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "NOT_APPLICABLE"]).optional(),
});

const fsProgramItemSchema = z.object({
  fsCaption: z.string().min(1, "FS Caption is required"),
  procedureType: z.enum(["Basic", "Standard", "Extended"]),
  description: z.string().optional(),
  riskLevel: z.enum(["LOW", "MODERATE", "HIGH", "SIGNIFICANT"]),
});

const fsProgramUpdateSchema = fsProgramItemSchema.partial().extend({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
});

const workingPaperUpdateSchema = z.object({
  notes: z.string().optional(),
  conclusion: z.string().optional(),
});

const reviewPointUpdateSchema = z.object({
  description: z.string().optional(),
  response: z.string().optional(),
  status: z.enum(["OPEN", "PENDING", "CLEARED"]).optional(),
  severity: z.enum(["HIGH", "MEDIUM", "LOW", "INFO"]).optional(),
});
const router = Router();

router.get("/api/engagements/:engagementId/fs-heads", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const dbFsHeads = await prisma.fSHead.findMany({
      where: { engagementId },
      include: { fsLines: true },
      orderBy: { sortOrder: 'asc' }
    });

    const existingWPs = await db.fSHeadWorkingPaper.findMany({
      where: { engagementId },
      select: {
        fsHeadKey: true,
        status: true,
        preparedById: true,
        reviewedById: true,
        approvedById: true
      }
    });
    const wpStatusMap = new Map(existingWPs.map((wp: any) => [wp.fsHeadKey, wp]));

    if (dbFsHeads.length > 0) {
      const stMap: Record<string, string> = { BS: "Balance Sheet", PL: "Profit & Loss", CF: "Cash Flow", SCE: "Statement of Changes in Equity" };
      const enrichedFsHeads = dbFsHeads.map(fh => {
        const wp = wpStatusMap.get(fh.code);
        return {
          key: fh.code,
          fsHeadKey: fh.code,
          name: fh.name,
          statementType: stMap[fh.statementType] || fh.statementType,
          accounts: (fh as any).fsLines?.map((l: any) => ({ code: l.code || l.id, name: l.name })) || [],
          status: wp?.status || "NOT_STARTED",
          workingPaper: wp || null
        };
      });
      return res.json({ success: true, fsHeads: enrichedFsHeads });
    }

    const coaAccounts = await prisma.coAAccount.findMany({
      where: {
        engagementId,
        fsLineItem: { not: null }
      },
      select: {
        fsLineItem: true,
        accountCode: true,
        accountName: true,
        accountClass: true,
        nature: true
      },
      orderBy: { accountCode: 'asc' }
    });
    
    const fsHeadMap = new Map<string, {
      key: string;
      name: string;
      statementType: string;
      accounts: { code: string; name: string }[];
    }>();
    
    for (const acc of coaAccounts) {
      if (!acc.fsLineItem) continue;
      
      const key = acc.fsLineItem.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      if (!fsHeadMap.has(key)) {
        let statementType = "Other";
        if (acc.accountClass?.toLowerCase().includes("asset")) statementType = "Assets";
        else if (acc.accountClass?.toLowerCase().includes("liab")) statementType = "Liabilities";
        else if (acc.accountClass?.toLowerCase().includes("equity")) statementType = "Equity";
        else if (acc.accountClass?.toLowerCase().includes("income") || acc.accountClass?.toLowerCase().includes("revenue")) statementType = "Income";
        else if (acc.accountClass?.toLowerCase().includes("expense")) statementType = "Expenses";
        
        fsHeadMap.set(key, {
          key,
          name: acc.fsLineItem,
          statementType,
          accounts: []
        });
      }
      
      const entry = fsHeadMap.get(key)!;
      entry.accounts.push({ code: acc.accountCode, name: acc.accountName });
    }
    
    const fsHeads = Array.from(fsHeadMap.values()).sort((a, b) => {
      const order = ["Assets", "Liabilities", "Equity", "Income", "Expenses", "Other"];
      return order.indexOf(a.statementType) - order.indexOf(b.statementType) || a.name.localeCompare(b.name);
    });
    
    const enrichedFsHeads = fsHeads.map(fh => {
      const wp = wpStatusMap.get(fh.key);
      return {
        ...fh,
        fsHeadKey: fh.key,
        status: wp?.status || "NOT_STARTED",
        workingPaper: wp || null
      };
    });
    
    res.json({ success: true, fsHeads: enrichedFsHeads });
  } catch (error) {
    console.error("Error fetching FS heads:", error);
    res.status(500).json({ error: "Failed to fetch FS heads" });
  }
});

router.get("/api/engagements/:engagementId/fs-heads-summary", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    const coaAccounts = await prisma.coAAccount.findMany({
      where: {
        engagementId,
        fsLineItem: { not: null }
      },
      select: {
        fsLineItem: true,
        accountCode: true,
        accountName: true,
        accountClass: true
      }
    });

    const importBalancesCB = await prisma.importAccountBalance.findMany({
      where: { engagementId, balanceType: 'CB' },
      select: { accountCode: true, debitAmount: true, creditAmount: true }
    });

    const importBalancesOB = await prisma.importAccountBalance.findMany({
      where: { engagementId, balanceType: 'OB' },
      select: { accountCode: true, debitAmount: true, creditAmount: true }
    });

    const currentBalanceMap = new Map<string, number>();
    const priorBalanceMap = new Map<string, number>();

    if (importBalancesCB.length > 0) {
      for (const ib of importBalancesCB) {
        currentBalanceMap.set(ib.accountCode, Number(ib.debitAmount || 0) - Number(ib.creditAmount || 0));
      }
      for (const ib of importBalancesOB) {
        priorBalanceMap.set(ib.accountCode, Number(ib.debitAmount || 0) - Number(ib.creditAmount || 0));
      }
    } else {
      const tbLines = await prisma.trialBalanceLine.findMany({
        where: { trialBalance: { engagementId } },
        select: { accountCode: true, closingBalance: true, openingBalance: true }
      });
      for (const tl of tbLines) {
        currentBalanceMap.set(tl.accountCode, Number(tl.closingBalance) || 0);
        priorBalanceMap.set(tl.accountCode, Number(tl.openingBalance) || 0);
      }
    }

    const existingWPs = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId },
      select: {
        fsHeadKey: true,
        status: true,
        riskLevel: true,
        _count: {
          select: {
            testOfControls: true,
            testOfDetails: true,
            analyticalProcedures: true
          }
        }
      }
    });

    const wpMap = new Map<string, any>(existingWPs.map((wp) => [wp.fsHeadKey, wp]));

    const fsHeadMap = new Map<string, {
      fsHeadKey: string;
      name: string;
      currentYearBalance: number;
      priorYearBalance: number;
      accountCodes: string[];
    }>();

    for (const acc of coaAccounts) {
      if (!acc.fsLineItem) continue;

      const key = acc.fsLineItem.toLowerCase().replace(/[^a-z0-9]/g, '-');

      if (!fsHeadMap.has(key)) {
        fsHeadMap.set(key, {
          fsHeadKey: key,
          name: acc.fsLineItem,
          currentYearBalance: 0,
          priorYearBalance: 0,
          accountCodes: []
        });
      }

      const entry = fsHeadMap.get(key)!;
      entry.accountCodes.push(acc.accountCode);
      entry.currentYearBalance += currentBalanceMap.get(acc.accountCode) || 0;
      entry.priorYearBalance += priorBalanceMap.get(acc.accountCode) || 0;
    }

    const fsHeadsSummary = Array.from(fsHeadMap.values()).map(fh => {
      const wp = wpMap.get(fh.fsHeadKey);
      const tocCount = wp?._count?.testOfControls || 0;
      const todCount = wp?._count?.testOfDetails || 0;
      const analyticsCount = wp?._count?.analyticalProcedures || 0;
      const proceduresCount = tocCount + todCount + analyticsCount;

      let completionPercent = 0;
      if (wp?.status === "APPROVED") completionPercent = 100;
      else if (wp?.status === "REVIEWED") completionPercent = 80;
      else if (wp?.status === "COMPLETED") completionPercent = 60;
      else if (wp?.status === "IN_PROGRESS") completionPercent = 30;
      else if (proceduresCount > 0) completionPercent = 10;

      return {
        fsHeadKey: fh.fsHeadKey,
        name: fh.name,
        balance: Math.abs(fh.currentYearBalance),
        currentYearBalance: fh.currentYearBalance,
        priorYearBalance: fh.priorYearBalance,
        riskLevel: wp?.riskLevel || "medium",
        proceduresCount,
        completionPercent,
        status: wp?.status || "NOT_STARTED"
      };
    });

    fsHeadsSummary.sort((a, b) => Math.abs(b.currentYearBalance) - Math.abs(a.currentYearBalance));

    res.json({ success: true, fsHeads: fsHeadsSummary });
  } catch (error) {
    console.error("Error fetching FS heads summary:", error);
    res.status(500).json({ error: "Failed to fetch FS heads summary" });
  }
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    let workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: {
        engagementId_fsHeadKey: { engagementId, fsHeadKey }
      },
      include: {
        procedures: {
          orderBy: { orderIndex: 'asc' },
          include: { performedBy: { select: { fullName: true } } }
        },
        reviewPoints: {
          orderBy: { createdAt: 'desc' },
          include: {
            raisedBy: { select: { fullName: true } },
            clearedBy: { select: { fullName: true } }
          }
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: { uploadedBy: { select: { fullName: true } } }
        },
        testOfControls: { select: { id: true } },
        testOfDetails: { select: { id: true } },
        analyticalProcedures: { select: { id: true } },
        preparedBy: { select: { fullName: true } },
        reviewedBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } }
      }
    });
    
    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId, fsLineItem: { not: null } },
      select: { 
        id: true,
        fsLineItem: true, 
        accountCode: true, 
        accountName: true,
        accountClass: true,
        nature: true
      }
    });
    
    const fsLineItem = coaAccounts.find(a => 
      a.fsLineItem?.toLowerCase().replace(/[^a-z0-9]/g, '-') === fsHeadKey
    )?.fsLineItem;
    
    const accountCodes = coaAccounts
      .filter(a => a.fsLineItem?.toLowerCase().replace(/[^a-z0-9]/g, '-') === fsHeadKey)
      .map(a => ({ 
        code: a.accountCode, 
        name: a.accountName,
        accountClass: a.accountClass || '',
        nature: a.nature || 'DR'
      }));
    
    if (!workingPaper && fsLineItem) {
      workingPaper = await db.fSHeadWorkingPaper.create({
        data: {
          engagementId,
          fsHeadKey,
          fsHeadName: fsLineItem,
          status: 'DRAFT'
        },
        include: {
          procedures: { orderBy: { orderIndex: 'asc' }, include: { performedBy: { select: { fullName: true } } } },
          reviewPoints: { orderBy: { createdAt: 'desc' }, include: { raisedBy: { select: { fullName: true } }, clearedBy: { select: { fullName: true } } } },
          attachments: { orderBy: { createdAt: 'desc' }, include: { uploadedBy: { select: { fullName: true } } } },
          preparedBy: { select: { fullName: true } },
          reviewedBy: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } }
        }
      });
    }
    
    let completionPercentage = 0;
    if (workingPaper) {
      const wp = workingPaper as any;
      if (wp.status === 'APPROVED') completionPercentage = 100;
      else if (wp.status === 'REVIEWED') completionPercentage = 80;
      else if (wp.status === 'PREPARED') completionPercentage = 60;
      else if (wp.status === 'IN_PROGRESS') completionPercentage = 40;
      else {
        const totalExecProcedures = (wp.testOfControls?.length || 0) + (wp.testOfDetails?.length || 0) + (wp.analyticalProcedures?.length || 0) + (wp.procedures?.length || 0);
        const hasAttachments = (wp.attachments?.length || 0) > 0;
        const hasConclusion = !!wp.conclusion && wp.conclusion.trim().length > 0;
        if (hasConclusion) completionPercentage = 30;
        else if (hasAttachments) completionPercentage = 25;
        else if (totalExecProcedures > 0) completionPercentage = 15;
      }
    }

    const wpResult = workingPaper ? { ...workingPaper, notes: (workingPaper as any).scope || '' } : workingPaper;
    res.json({ 
      success: true, 
      workingPaper: wpResult, 
      accounts: accountCodes,
      fsHeadName: fsLineItem || fsHeadKey,
      completionPercentage,
    });
  } catch (error) {
    console.error("Error fetching FS head working paper:", error);
    res.status(500).json({ error: "Failed to fetch FS head working paper" });
  }
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/related-data", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId, fsLineItem: { not: null } },
      select: { fsLineItem: true, accountCode: true, accountClass: true, id: true }
    });
    
    const matchingAccounts = coaAccounts.filter(a => 
      a.fsLineItem?.toLowerCase().replace(/[^a-z0-9]/g, '-') === fsHeadKey
    );
    const matchingAccountIds = matchingAccounts.map(a => a.id);
    const fsLineItem = matchingAccounts[0]?.fsLineItem || '';
    
    let auditProgram: any[] = [];
    if (matchingAccountIds.length > 0) {
      const procedures = await prisma.engagementProcedure.findMany({
        where: {
          engagementId,
          linkedAccountIds: { hasSome: matchingAccountIds }
        },
        orderBy: { workpaperRef: 'asc' }
      });
      
      auditProgram = procedures.map(p => ({
        id: p.id,
        procedureRef: p.workpaperRef || '',
        description: p.description || p.title || '',
        type: p.procedureType || 'SUBSTANTIVE',
        isaReference: p.isaReferences?.join(', ') || '',
        status: p.status || 'NOT_STARTED',
        assertions: p.assertions || [],
        conclusion: p.conclusion
      }));
    }
    
    let fsProgram: any[] = [];
    // Map fsHeadKey to FSArea enum for proper filtering
    const fsAreaMapping: Record<string, string> = {
      'cash': 'CASH_AND_BANK',
      'receivables': 'RECEIVABLES',
      'inventory': 'INVENTORIES',
      'payables': 'PAYABLES',
      'revenue': 'REVENUE',
      'expenses': 'OPERATING_EXPENSES',
      'ppe': 'FIXED_ASSETS',
      'provisions': 'PROVISIONS',
      'equity': 'EQUITY',
      'investments': 'INVESTMENTS',
      'borrowings': 'BORROWINGS',
      'intangibles': 'INTANGIBLES'
    };
    const mappedFsArea = fsAreaMapping[fsHeadKey.toLowerCase()] || null;
    
    // Find FS Program items by fsArea OR by accountOrClass matching fsLineItem
    const riskAssessments = await prisma.riskAssessment.findMany({
      where: {
        engagementId,
        OR: [
          ...(mappedFsArea ? [{ fsArea: mappedFsArea as any }] : []),
          ...(fsLineItem ? [{ accountOrClass: { equals: fsLineItem, mode: 'insensitive' as const } }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    
    fsProgram = riskAssessments.map(r => ({
      id: r.id,
      fsCaption: r.accountOrClass || '',
      procedureType: r.inherentRisk === 'HIGH' ? 'Extended' : r.inherentRisk === 'SIGNIFICANT' ? 'Standard' : 'Basic',
      description: r.riskDescription || '',
      status: 'PENDING',
      riskLevel: r.inherentRisk || 'MODERATE'
    }));
    
    let controls: any[] = [];
    const internalControls = await prisma.internalControl.findMany({
      where: {
        engagementId,
        relatedRiskIds: { isEmpty: false }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    controls = internalControls.map(c => ({
      id: c.id,
      controlRef: c.controlId || c.id.slice(0, 8),
      controlName: c.controlDescription || c.processName || '',
      controlType: c.controlNature || 'MANUAL',
      frequency: c.frequency || 'PERIODIC',
      owner: c.controlOwner || 'Unassigned',
      status: c.keyControl ? 'KEY_CONTROL' : 'STANDARD'
    }));
    
    let substantiveTests: any[] = [];
    if (fsLineItem) {
      const tests = await prisma.substantiveTest.findMany({
        where: {
          engagementId,
          accountName: { contains: fsLineItem.split(' ')[0], mode: 'insensitive' }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      
      substantiveTests = tests.map(t => ({
        id: t.id,
        testType: t.testingType || 'DETAIL',
        assertion: t.assertion || '',
        description: t.testObjective || '',
        sampleSize: t.sampleSize || 0,
        exceptionsFound: t.exceptionsFound || 0,
        conclusion: t.conclusion || '',
        status: t.exceptionsFound > 0 ? 'EXCEPTION' : 'COMPLETED'
      }));
    }
    
    let riskAreas: any[] = [];
    if (fsLineItem) {
      const risks = await prisma.riskAssessment.findMany({
        where: {
          engagementId,
          accountOrClass: { contains: fsLineItem.split(' ')[0], mode: 'insensitive' }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      
      riskAreas = risks.map(r => ({
        id: r.id,
        riskTitle: r.accountOrClass || '',
        riskLevel: r.inherentRisk || 'MODERATE',
        assertions: r.assertionImpacts || [],
        status: 'IDENTIFIED',
        response: r.significantRiskReason || ''
      }));
    }
    
    res.json({
      success: true,
      auditProgram,
      fsProgram,
      controls,
      substantiveTests,
      riskAreas
    });
  } catch (error) {
    console.error("Error fetching FS head related data:", error);
    res.json({
      success: true,
      auditProgram: [],
      fsProgram: [],
      controls: [],
      substantiveTests: [],
      riskAreas: []
    });
  }
});

// FS Program Item CRUD
router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/fs-program", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    // Validate input
    const validation = fsProgramItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message || "Invalid input" });
    }
    const { fsCaption, procedureType, description, riskLevel } = validation.data;
    
    const userId = (req as any).session?.passport?.user;
    
    // Get a default assessor if no user in session
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { engagementPartnerId: true, engagementManagerId: true }
    });
    const assessedById = userId || engagement?.engagementManagerId || engagement?.engagementPartnerId;
    if (!assessedById) {
      return res.status(400).json({ error: "No assessor available" });
    }
    
    // Create as RiskAssessment linked to this FS Head
    const item = await prisma.riskAssessment.create({
      data: {
        engagementId,
        accountOrClass: fsCaption,
        riskDescription: description || '',
        inherentRisk: riskLevel,
        controlRisk: 'MODERATE',
        riskOfMaterialMisstatement: riskLevel,
        assertion: 'EXISTENCE',
        plannedResponse: procedureType === 'Extended' ? 'Extended substantive procedures' : 'Standard audit procedures',
        assessedById,
      }
    });
    
    res.json({ 
      success: true, 
      item: {
        id: item.id,
        fsCaption: item.accountOrClass,
        procedureType: procedureType || 'Standard',
        description: item.riskDescription,
        status: 'PENDING',
        riskLevel: item.inherentRisk
      }
    });
  } catch (error) {
    console.error("Error creating FS program item:", error);
    res.status(500).json({ error: "Failed to create FS program item" });
  }
});

router.patch("/api/engagements/:engagementId/fs-heads/:fsHeadKey/fs-program/:itemId", async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    
    // Validate input
    const validation = fsProgramUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message || "Invalid input" });
    }
    const { fsCaption, procedureType, description, riskLevel } = validation.data;
    
    const updateData: any = { updatedAt: new Date() };
    if (fsCaption) updateData.accountOrClass = fsCaption;
    if (description !== undefined) updateData.riskDescription = description;
    if (riskLevel) {
      updateData.inherentRisk = riskLevel;
      updateData.riskOfMaterialMisstatement = riskLevel;
    }
    if (procedureType) {
      updateData.plannedResponse = procedureType === 'Extended' ? 'Extended substantive procedures' : 'Standard audit procedures';
    }
    
    const item = await prisma.riskAssessment.update({
      where: { id: itemId },
      data: updateData
    });
    
    res.json({ 
      success: true, 
      item: {
        id: item.id,
        fsCaption: item.accountOrClass,
        procedureType: procedureType || 'Standard',
        description: item.riskDescription,
        status: 'PENDING',
        riskLevel: item.inherentRisk
      }
    });
  } catch (error) {
    console.error("Error updating FS program item:", error);
    res.status(500).json({ error: "Failed to update FS program item" });
  }
});

router.delete("/api/engagements/:engagementId/fs-heads/:fsHeadKey/fs-program/:itemId", async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    await prisma.riskAssessment.delete({ where: { id: itemId } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting FS program item:", error);
    res.status(500).json({ error: "Failed to delete FS program item" });
  }
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/fs-program/ai-generate", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const userId = (req as any).session?.passport?.user;
    
    // Get a default assessor if no user in session
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { engagementPartnerId: true, engagementManagerId: true }
    });
    const assessedById = userId || engagement?.engagementManagerId || engagement?.engagementPartnerId;
    if (!assessedById) {
      return res.status(400).json({ error: "No assessor available" });
    }
    
    // Get FS Head name from key
    const fsHeadName = fsHeadKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // AI-generated suggestions based on FS Head type
    const suggestions: { fsCaption: string; procedureType: string; description: string; riskLevel: string }[] = [];
    
    const commonSuggestions: Record<string, { fsCaption: string; procedureType: string; description: string; riskLevel: string }[]> = {
      'revenue': [
        { fsCaption: 'Revenue Recognition', procedureType: 'Extended', description: 'Verify revenue is recognized in accordance with IFRS 15 / ISA 240 (presumed fraud risk)', riskLevel: 'HIGH' },
        { fsCaption: 'Cut-off Testing', procedureType: 'Extended', description: 'Test sales transactions around period end for proper cut-off per ISA 500', riskLevel: 'HIGH' },
        { fsCaption: 'Related Party Sales', procedureType: 'Standard', description: 'Identify and test related party revenue transactions per ISA 550', riskLevel: 'MODERATE' }
      ],
      'receivables': [
        { fsCaption: 'Existence & Valuation', procedureType: 'Extended', description: 'Confirm balances with debtors and assess recoverability per ISA 505', riskLevel: 'HIGH' },
        { fsCaption: 'Allowance for Doubtful Accounts', procedureType: 'Standard', description: 'Evaluate adequacy of provision based on aging and historical experience', riskLevel: 'MODERATE' },
        { fsCaption: 'Rights & Obligations', procedureType: 'Standard', description: 'Verify entity has legal right to collect receivables', riskLevel: 'MODERATE' }
      ],
      'inventory': [
        { fsCaption: 'Physical Existence', procedureType: 'Extended', description: 'Attend physical inventory count and perform test counts per ISA 501', riskLevel: 'HIGH' },
        { fsCaption: 'Valuation (NRV)', procedureType: 'Extended', description: 'Test inventory is valued at lower of cost or net realizable value', riskLevel: 'HIGH' },
        { fsCaption: 'Obsolescence Review', procedureType: 'Standard', description: 'Assess provision for slow-moving or obsolete inventory', riskLevel: 'MODERATE' }
      ],
      'payables': [
        { fsCaption: 'Completeness', procedureType: 'Extended', description: 'Search for unrecorded liabilities through subsequent payments review', riskLevel: 'HIGH' },
        { fsCaption: 'Cut-off Testing', procedureType: 'Standard', description: 'Test purchase transactions around period end for proper cut-off', riskLevel: 'MODERATE' },
        { fsCaption: 'Supplier Confirmations', procedureType: 'Standard', description: 'Confirm material supplier balances per ISA 505', riskLevel: 'MODERATE' }
      ],
      'cash': [
        { fsCaption: 'Bank Reconciliations', procedureType: 'Extended', description: 'Review bank reconciliations and investigate reconciling items', riskLevel: 'HIGH' },
        { fsCaption: 'Bank Confirmations', procedureType: 'Extended', description: 'Obtain direct confirmations from all banks per ISA 505', riskLevel: 'HIGH' },
        { fsCaption: 'Restricted Cash', procedureType: 'Standard', description: 'Identify any restrictions on cash balances for disclosure', riskLevel: 'MODERATE' }
      ],
      'ppe': [
        { fsCaption: 'Additions & Disposals', procedureType: 'Standard', description: 'Vouch significant additions and verify proper authorization', riskLevel: 'MODERATE' },
        { fsCaption: 'Depreciation Review', procedureType: 'Standard', description: 'Test depreciation calculations and assess useful life estimates', riskLevel: 'MODERATE' },
        { fsCaption: 'Impairment Assessment', procedureType: 'Extended', description: 'Evaluate indicators of impairment per IAS 36', riskLevel: 'HIGH' }
      ],
      'expenses': [
        { fsCaption: 'Classification & Completeness', procedureType: 'Standard', description: 'Test expense classification and search for unrecorded expenses', riskLevel: 'MODERATE' },
        { fsCaption: 'Related Party Expenses', procedureType: 'Extended', description: 'Identify and scrutinize related party expense transactions', riskLevel: 'HIGH' },
        { fsCaption: 'Unusual Items', procedureType: 'Standard', description: 'Investigate unusual or non-recurring expense items', riskLevel: 'MODERATE' }
      ],
      'provisions': [
        { fsCaption: 'Completeness of Provisions', procedureType: 'Extended', description: 'Review for unrecorded provisions and contingent liabilities per IAS 37', riskLevel: 'HIGH' },
        { fsCaption: 'Measurement & Estimates', procedureType: 'Extended', description: 'Evaluate management estimates and assumptions per ISA 540', riskLevel: 'HIGH' },
        { fsCaption: 'Legal Claims', procedureType: 'Standard', description: 'Obtain legal confirmations for pending litigation', riskLevel: 'MODERATE' }
      ]
    };
    
    const key = fsHeadKey.toLowerCase().replace(/-/g, '');
    const matched = commonSuggestions[key] || commonSuggestions['revenue'];
    
    // Map fsHeadKey to FSArea enum for linking
    const fsAreaMapping: Record<string, string> = {
      'cash': 'CASH_AND_BANK',
      'receivables': 'RECEIVABLES',
      'inventory': 'INVENTORIES',
      'payables': 'PAYABLES',
      'revenue': 'REVENUE',
      'expenses': 'OPERATING_EXPENSES',
      'ppe': 'FIXED_ASSETS',
      'provisions': 'PROVISIONS',
      'equity': 'EQUITY',
      'investments': 'INVESTMENTS',
      'borrowings': 'BORROWINGS',
      'intangibles': 'INTANGIBLES'
    };
    const mappedFsArea = fsAreaMapping[key] || 'REVENUE';
    
    // Create the suggestions as RiskAssessment records linked to the FS Head via fsArea
    const createdItems = [];
    for (const suggestion of matched) {
      const item = await prisma.riskAssessment.create({
        data: {
          engagementId,
          accountOrClass: suggestion.fsCaption,
          riskDescription: suggestion.description,
          inherentRisk: suggestion.riskLevel as any,
          controlRisk: 'MODERATE',
          riskOfMaterialMisstatement: suggestion.riskLevel as any,
          assertion: 'EXISTENCE',
          fsArea: mappedFsArea as any,
          plannedResponse: suggestion.procedureType === 'Extended' ? 'Extended substantive procedures' : 'Standard audit procedures',
          assessedById,
        }
      });
      createdItems.push({
        id: item.id,
        fsCaption: item.accountOrClass,
        procedureType: suggestion.procedureType,
        description: item.riskDescription,
        status: 'PENDING',
        riskLevel: item.inherentRisk
      });
    }
    
    res.json({ success: true, items: createdItems, aiGenerated: true });
  } catch (error) {
    console.error("Error generating AI FS program items:", error);
    res.status(500).json({ error: "Failed to generate AI suggestions" });
  }
});

router.patch("/api/engagements/:engagementId/fs-heads/:fsHeadKey", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const validation = workingPaperUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message || "Invalid input" });
    }
    const updates = validation.data;
    
    const workingPaper = await db.fSHeadWorkingPaper.update({
      where: {
        engagementId_fsHeadKey: { engagementId, fsHeadKey }
      },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });
    
    res.json({ success: true, workingPaper });
  } catch (error) {
    console.error("Error updating FS head working paper:", error);
    res.status(500).json({ error: "Failed to update working paper" });
  }
});

router.patch("/api/engagements/:engagementId/fs-heads/:fsHeadKey/working-paper", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { notes, conclusion, completionStatus } = req.body;

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: "notes must be a string" });
    }
    if (conclusion !== undefined && typeof conclusion !== 'string') {
      return res.status(400).json({ error: "conclusion must be a string" });
    }
    if (completionStatus !== undefined && typeof completionStatus !== 'string') {
      return res.status(400).json({ error: "completionStatus must be a string" });
    }

    const updateData: any = { updatedAt: new Date() };
    if (notes !== undefined) updateData.scope = notes;
    if (conclusion !== undefined) updateData.conclusion = conclusion;
    if (completionStatus !== undefined) updateData.conclusionStatus = completionStatus;

    const workingPaper = await db.fSHeadWorkingPaper.upsert({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } },
      update: updateData,
      create: {
        engagementId,
        fsHeadKey,
        fsHeadName: fsHeadKey,
        status: 'DRAFT',
        ...updateData
      }
    });

    const result = { ...workingPaper, notes: workingPaper.scope || '' };
    res.json({ success: true, workingPaper: result });
  } catch (error) {
    console.error("Error updating working paper:", error);
    res.status(500).json({ error: "Failed to update working paper" });
  }
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/procedures", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const validation = procedureSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message || "Invalid input" });
    }
    const procedureData = validation.data;
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }
    
    const maxOrder = await db.fSHeadProcedure.aggregate({
      where: { workingPaperId: workingPaper.id },
      _max: { orderIndex: true }
    });
    
    const procedure = await db.fSHeadProcedure.create({
      data: {
        workingPaperId: workingPaper.id,
        title: procedureData.title,
        isaReference: procedureData.isaReference || null,
        description: procedureData.description || null,
        orderIndex: (maxOrder._max.orderIndex || 0) + 1
      }
    });
    
    res.json({ success: true, procedure });
  } catch (error) {
    console.error("Error creating procedure:", error);
    res.status(500).json({ error: "Failed to create procedure" });
  }
});

router.patch("/api/fs-head-procedures/:procedureId", async (req: Request, res: Response) => {
  try {
    const { procedureId } = req.params;
    
    const validation = procedureUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message || "Invalid input" });
    }
    const updates = validation.data;
    
    const procedure = await db.fSHeadProcedure.update({
      where: { id: procedureId },
      data: updates
    });
    
    res.json({ success: true, procedure });
  } catch (error) {
    console.error("Error updating procedure:", error);
    res.status(500).json({ error: "Failed to update procedure" });
  }
});

router.delete("/api/fs-head-procedures/:procedureId", async (req: Request, res: Response) => {
  try {
    const { procedureId } = req.params;
    
    await db.fSHeadProcedure.delete({
      where: { id: procedureId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting procedure:", error);
    res.status(500).json({ error: "Failed to delete procedure" });
  }
});

router.patch("/api/fs-head-review-points/:reviewPointId", async (req: Request, res: Response) => {
  try {
    const { reviewPointId } = req.params;
    
    const validation = reviewPointUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message || "Invalid input" });
    }
    const updates = validation.data;
    
    const reviewPoint = await db.fSHeadReviewPoint.update({
      where: { id: reviewPointId },
      data: updates
    });
    
    res.json({ success: true, reviewPoint });
  } catch (error) {
    console.error("Error updating review point:", error);
    res.status(500).json({ error: "Failed to update review point" });
  }
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/signoff", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const { action, reason } = req.body;
    
    const authUser = (req as any).user;
    if (!authUser) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const userId = authUser.id;
    const userRole = authUser.role;
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }
    
    let updateData: any = {};
    
    if (action === 'prepare') {
      if (!['STAFF', 'SENIOR'].includes(userRole)) {
        return res.status(403).json({ error: "Only Associate/Senior can mark as prepared" });
      }
      if (workingPaper.status !== 'DRAFT') {
        return res.status(400).json({ error: "Working paper must be in draft status to prepare" });
      }
      updateData = { preparedById: userId, preparedAt: new Date(), status: 'PREPARED' };
    } else if (action === 'review') {
      if (userRole !== 'MANAGER') {
        return res.status(403).json({ error: "Only Manager can mark as reviewed" });
      }
      if (workingPaper.status !== 'PREPARED') {
        return res.status(400).json({ error: "Working paper must be prepared before review" });
      }
      updateData = { reviewedById: userId, reviewedAt: new Date(), status: 'REVIEWED' };
    } else if (action === 'approve') {
      if (userRole !== 'PARTNER') {
        return res.status(403).json({ error: "Only Partner can approve" });
      }
      if (workingPaper.status !== 'REVIEWED') {
        return res.status(400).json({ error: "Working paper must be reviewed before approval" });
      }
      updateData = { approvedById: userId, approvedAt: new Date(), status: 'APPROVED', isLocked: true, lockedAt: new Date(), lockedById: userId };
    } else if (action === 'unlock') {
      if (userRole !== 'PARTNER') {
        return res.status(403).json({ error: "Only Partner can unlock" });
      }
      if (!reason) {
        return res.status(400).json({ error: "Unlock reason is required" });
      }
      updateData = { isLocked: false, unlockReason: reason, status: 'REVIEWED' };
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
    
    const updated = await db.fSHeadWorkingPaper.update({
      where: { id: workingPaper.id },
      data: updateData
    });
    
    res.json({ success: true, workingPaper: updated });
  } catch (error) {
    console.error("Error signing off:", error);
    res.status(500).json({ error: "Failed to process sign-off" });
  }
});

router.get("/api/engagements/:engagementId/tb-lines", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!tbBatch) {
      return res.json({ success: true, tbLines: [], message: "No approved TB found" });
    }
    
    const tbLines = await prisma.tBEntry.findMany({
      where: { batchId: tbBatch.id },
      orderBy: { accountCode: 'asc' }
    });
    
    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId },
      select: { accountCode: true, fsLineItem: true }
    });
    
    const fsLineMap = new Map(coaAccounts.map(c => [c.accountCode, c.fsLineItem]));
    
    const enrichedLines = tbLines.map((line: any) => ({
      id: line.id,
      accountCode: line.accountCode,
      accountName: line.accountName,
      openingBalance: line.openingBalance,
      closingBalance: line.closingBalance,
      debit: line.movementDebit,
      credit: line.movementCredit,
      fsLineItem: fsLineMap.get(line.accountCode) || null,
      fsHeadKey: fsLineMap.get(line.accountCode)?.toLowerCase().replace(/[^a-z0-9]/g, '-') || null
    }));
    
    res.json({ success: true, tbLines: enrichedLines });
  } catch (error) {
    console.error("Error fetching TB lines:", error);
    res.status(500).json({ error: "Failed to fetch TB lines" });
  }
});

const tocSchema = z.object({
  controlDescription: z.string().min(1, "Control description required"),
  controlOwner: z.string().optional(),
  controlFrequency: z.string().optional(),
  controlType: z.string().optional(),
  assertions: z.array(z.string()).optional(),
  testSteps: z.string().optional(),
  testSampleSize: z.number().optional(),
  testPopulation: z.string().optional(),
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/toc", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.json({ success: true, toc: [] });
    }
    
    const toc = await db.fSHeadTOC.findMany({
      where: { workingPaperId: workingPaper.id },
      orderBy: { orderIndex: 'asc' },
      include: { testingPerformedBy: { select: { fullName: true } } }
    });
    
    res.json({ success: true, toc });
  } catch (error) {
    console.error("Error fetching TOC:", error);
    res.status(500).json({ error: "Failed to fetch TOC" });
  }
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/toc", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const validation = tocSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message });
    }
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }
    
    const maxOrder = await db.fSHeadTOC.aggregate({
      where: { workingPaperId: workingPaper.id },
      _max: { orderIndex: true }
    });
    
    const tocCount = await db.fSHeadTOC.count({ where: { workingPaperId: workingPaper.id } });
    
    const toc = await db.fSHeadTOC.create({
      data: {
        workingPaperId: workingPaper.id,
        tocRef: `TOC-${String(tocCount + 1).padStart(3, '0')}`,
        ...validation.data,
        orderIndex: (maxOrder._max.orderIndex || 0) + 1
      }
    });
    
    res.json({ success: true, toc });
  } catch (error) {
    console.error("Error creating TOC:", error);
    res.status(500).json({ error: "Failed to create TOC" });
  }
});

router.patch("/api/fs-head-toc/:tocId", async (req: Request, res: Response) => {
  try {
    const { tocId } = req.params;
    const { result, conclusion, exceptionsFound, exceptionDetails, testingPerformedById } = req.body;
    
    const toc = await db.fSHeadTOC.update({
      where: { id: tocId },
      data: {
        result,
        conclusion,
        exceptionsFound,
        exceptionDetails,
        testingPerformedById,
        testingPerformedAt: testingPerformedById ? new Date() : undefined
      }
    });
    
    res.json({ success: true, toc });
  } catch (error) {
    console.error("Error updating TOC:", error);
    res.status(500).json({ error: "Failed to update TOC" });
  }
});

router.patch("/api/engagements/:engagementId/fs-heads/:fsHeadKey/toc/:tocId", async (req: Request, res: Response) => {
  try {
    const { tocId } = req.params;
    const data = req.body;
    
    const toc = await db.fSHeadTOC.update({
      where: { id: tocId },
      data: {
        tocRef: data.tocRef,
        controlDescription: data.controlDescription,
        controlOwner: data.controlOwner,
        controlFrequency: data.controlFrequency,
        controlType: data.controlType,
        testSteps: data.testSteps,
        result: data.result,
        conclusion: data.conclusion
      }
    });
    
    res.json({ success: true, toc });
  } catch (error) {
    console.error("Error updating TOC:", error);
    res.status(500).json({ error: "Failed to update TOC" });
  }
});

router.delete("/api/engagements/:engagementId/fs-heads/:fsHeadKey/toc/:tocId", async (req: Request, res: Response) => {
  try {
    const { tocId } = req.params;
    
    await db.fSHeadTOC.delete({
      where: { id: tocId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting TOC:", error);
    res.status(500).json({ error: "Failed to delete TOC" });
  }
});

const todSchema = z.object({
  procedureDescription: z.string().min(1, "Procedure description required"),
  assertions: z.array(z.string()).optional(),
  populationDescription: z.string().optional(),
  populationValue: z.number().optional(),
  populationCount: z.number().optional(),
  sampleSize: z.number().optional(),
  samplingRationale: z.string().optional(),
  samplingMethod: z.string().optional(),
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/tod", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.json({ success: true, tod: [] });
    }
    
    const tod = await db.fSHeadTOD.findMany({
      where: { workingPaperId: workingPaper.id },
      orderBy: { orderIndex: 'asc' },
      include: { testingPerformedBy: { select: { fullName: true } } }
    });
    
    res.json({ success: true, tod });
  } catch (error) {
    console.error("Error fetching TOD:", error);
    res.status(500).json({ error: "Failed to fetch TOD" });
  }
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/tod", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const validation = todSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message });
    }
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }
    
    const maxOrder = await db.fSHeadTOD.aggregate({
      where: { workingPaperId: workingPaper.id },
      _max: { orderIndex: true }
    });
    
    const todCount = await db.fSHeadTOD.count({ where: { workingPaperId: workingPaper.id } });
    
    const tod = await db.fSHeadTOD.create({
      data: {
        workingPaperId: workingPaper.id,
        todRef: `TOD-${String(todCount + 1).padStart(3, '0')}`,
        ...validation.data,
        orderIndex: (maxOrder._max.orderIndex || 0) + 1
      }
    });
    
    res.json({ success: true, tod });
  } catch (error) {
    console.error("Error creating TOD:", error);
    res.status(500).json({ error: "Failed to create TOD" });
  }
});

router.patch("/api/fs-head-tod/:todId", async (req: Request, res: Response) => {
  try {
    const { todId } = req.params;
    const { result, conclusion, exceptionsFound, exceptionDetails, exceptionAmount, projectedMisstatement, testingPerformedById } = req.body;
    
    const tod = await db.fSHeadTOD.update({
      where: { id: todId },
      data: {
        result,
        conclusion,
        exceptionsFound,
        exceptionDetails,
        exceptionAmount,
        projectedMisstatement,
        testingPerformedById,
        testingPerformedAt: testingPerformedById ? new Date() : undefined
      }
    });
    
    res.json({ success: true, tod });
  } catch (error) {
    console.error("Error updating TOD:", error);
    res.status(500).json({ error: "Failed to update TOD" });
  }
});

router.patch("/api/engagements/:engagementId/fs-heads/:fsHeadKey/tod/:todId", async (req: Request, res: Response) => {
  try {
    const { todId } = req.params;
    const data = req.body;
    
    const tod = await db.fSHeadTOD.update({
      where: { id: todId },
      data: {
        todRef: data.todRef,
        procedureDescription: data.procedureDescription,
        populationCount: data.populationCount,
        sampleSize: data.sampleSize,
        samplingMethod: data.samplingMethod,
        testSteps: data.testSteps,
        result: data.result,
        conclusion: data.conclusion,
        exceptionsFound: data.exceptionsFound
      }
    });
    
    res.json({ success: true, tod });
  } catch (error) {
    console.error("Error updating TOD:", error);
    res.status(500).json({ error: "Failed to update TOD" });
  }
});

router.delete("/api/engagements/:engagementId/fs-heads/:fsHeadKey/tod/:todId", async (req: Request, res: Response) => {
  try {
    const { todId } = req.params;
    
    await db.fSHeadTOD.delete({
      where: { id: todId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting TOD:", error);
    res.status(500).json({ error: "Failed to delete TOD" });
  }
});

const analyticalSchema = z.object({
  analyticalType: z.string().min(1, "Analytical type required"),
  description: z.string().min(1, "Description required"),
  assertions: z.array(z.string()).optional(),
  expectation: z.string().optional(),
  expectationBasis: z.string().optional(),
  thresholdPercentage: z.number().optional(),
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/analytics", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.json({ success: true, analytics: [] });
    }
    
    const analytics = await db.fSHeadAnalyticalProcedure.findMany({
      where: { workingPaperId: workingPaper.id },
      orderBy: { orderIndex: 'asc' },
      include: { performedBy: { select: { fullName: true } } }
    });
    
    res.json({ success: true, analytics });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/analytics", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const validation = analyticalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message });
    }
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }
    
    const maxOrder = await db.fSHeadAnalyticalProcedure.aggregate({
      where: { workingPaperId: workingPaper.id },
      _max: { orderIndex: true }
    });
    
    const count = await db.fSHeadAnalyticalProcedure.count({ where: { workingPaperId: workingPaper.id } });
    
    const analytical = await db.fSHeadAnalyticalProcedure.create({
      data: {
        workingPaperId: workingPaper.id,
        procedureRef: `ANA-${String(count + 1).padStart(3, '0')}`,
        ...validation.data,
        currentYearValue: workingPaper.currentYearBalance,
        priorYearValue: workingPaper.priorYearBalance,
        orderIndex: (maxOrder._max.orderIndex || 0) + 1
      }
    });
    
    res.json({ success: true, analytical });
  } catch (error) {
    console.error("Error creating analytical procedure:", error);
    res.status(500).json({ error: "Failed to create analytical procedure" });
  }
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/analytics/auto-generate", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }
    
    const existingCount = await db.fSHeadAnalyticalProcedure.count({ where: { workingPaperId: workingPaper.id } });
    
    const autoAnalytics = [
      {
        analyticalType: 'PY_VS_CY',
        description: 'Prior Year vs Current Year Comparison',
        expectation: 'Balance should be consistent with prior year unless known changes',
        thresholdPercentage: 10
      },
      {
        analyticalType: 'MOVEMENT_ANALYSIS',
        description: 'Year-on-Year Movement Analysis',
        expectation: 'Movement should be explainable by known business activities',
        thresholdPercentage: 15
      },
      {
        analyticalType: 'RATIO_ANALYSIS',
        description: 'Key Ratio Analysis',
        expectation: 'Ratios should be within industry norms',
        thresholdPercentage: 20
      }
    ];
    
    const created = [];
    for (let i = 0; i < autoAnalytics.length; i++) {
      const item = autoAnalytics[i];
      const analytical = await db.fSHeadAnalyticalProcedure.create({
        data: {
          workingPaperId: workingPaper.id,
          procedureRef: `ANA-${String(existingCount + i + 1).padStart(3, '0')}`,
          analyticalType: item.analyticalType,
          description: item.description,
          expectation: item.expectation,
          thresholdPercentage: item.thresholdPercentage,
          currentYearValue: workingPaper.currentYearBalance,
          priorYearValue: workingPaper.priorYearBalance,
          isAISuggested: true,
          aiConfidence: 0.85,
          orderIndex: existingCount + i + 1
        }
      });
      created.push(analytical);
    }
    
    res.json({ success: true, analytics: created, message: "Auto-generated 3 analytical procedures" });
  } catch (error) {
    console.error("Error auto-generating analytics:", error);
    res.status(500).json({ error: "Failed to auto-generate analytics" });
  }
});

router.patch("/api/engagements/:engagementId/fs-heads/:fsHeadKey/analytics/:analyticsId", async (req: Request, res: Response) => {
  try {
    const { analyticsId } = req.params;
    const data = req.body;
    
    const analytical = await db.fSHeadAnalyticalProcedure.update({
      where: { id: analyticsId },
      data: {
        procedureRef: data.procedureRef,
        analyticalType: data.analyticalType,
        description: data.description,
        thresholdPercentage: data.thresholdPercentage,
        currentYearValue: data.currentYearValue,
        priorYearValue: data.priorYearValue,
        variancePercentage: data.variancePercentage,
        conclusion: data.conclusion
      }
    });
    
    res.json({ success: true, analytical });
  } catch (error) {
    console.error("Error updating analytical procedure:", error);
    res.status(500).json({ error: "Failed to update analytical procedure" });
  }
});

router.delete("/api/engagements/:engagementId/fs-heads/:fsHeadKey/analytics/:analyticsId", async (req: Request, res: Response) => {
  try {
    const { analyticsId } = req.params;
    
    await db.fSHeadAnalyticalProcedure.delete({
      where: { id: analyticsId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting analytical procedure:", error);
    res.status(500).json({ error: "Failed to delete analytical procedure" });
  }
});

const adjustmentSchema = z.object({
  description: z.string().min(1, "Description required"),
  reason: z.string().optional(),
  debitAccountCode: z.string().optional(),
  debitAccountName: z.string().optional(),
  debitAmount: z.number().optional(),
  creditAccountCode: z.string().optional(),
  creditAccountName: z.string().optional(),
  creditAmount: z.number().optional(),
  adjustmentType: z.enum(['ADJUSTING', 'RECLASSIFICATION', 'CORRECTING', 'PROPOSED']).optional(),
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/adjustments", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.json({ success: true, adjustments: [] });
    }
    
    const adjustments = await db.fSHeadAdjustment.findMany({
      where: { workingPaperId: workingPaper.id },
      orderBy: { orderIndex: 'asc' },
      include: {
        identifiedBy: { select: { fullName: true } },
        reviewedBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } },
        postedBy: { select: { fullName: true } }
      }
    });
    
    const totals = adjustments.reduce((acc: { totalDebit: number; totalCredit: number; totalNetImpact: number }, adj: any) => ({
      totalDebit: acc.totalDebit + Number(adj.debitAmount || 0),
      totalCredit: acc.totalCredit + Number(adj.creditAmount || 0),
      totalNetImpact: acc.totalNetImpact + Number(adj.netImpact || 0)
    }), { totalDebit: 0, totalCredit: 0, totalNetImpact: 0 });
    
    res.json({ success: true, adjustments, totals, materialityThreshold: workingPaper.overallMateriality });
  } catch (error) {
    console.error("Error fetching adjustments:", error);
    res.status(500).json({ error: "Failed to fetch adjustments" });
  }
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/adjustments", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const userId = (req as any).session?.userId;
    
    const validation = adjustmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message });
    }
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });
    
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }
    
    const count = await db.fSHeadAdjustment.count({ where: { workingPaperId: workingPaper.id } });
    const data = validation.data;
    
    const netImpact = (data.debitAmount || 0) - (data.creditAmount || 0);
    const isMaterial = workingPaper.overallMateriality ? Math.abs(netImpact) >= Number(workingPaper.overallMateriality) : false;
    
    const adjustment = await db.fSHeadAdjustment.create({
      data: {
        workingPaperId: workingPaper.id,
        adjustmentRef: `AJE-${String(count + 1).padStart(3, '0')}`,
        adjustmentType: data.adjustmentType || 'ADJUSTING',
        description: data.description,
        reason: data.reason,
        debitAccountCode: data.debitAccountCode,
        debitAccountName: data.debitAccountName,
        debitAmount: data.debitAmount,
        creditAccountCode: data.creditAccountCode,
        creditAccountName: data.creditAccountName,
        creditAmount: data.creditAmount,
        netImpact,
        isMaterial,
        identifiedById: userId,
        identifiedAt: new Date(),
        orderIndex: count + 1
      }
    });
    
    res.json({ success: true, adjustment });
  } catch (error) {
    console.error("Error creating adjustment:", error);
    res.status(500).json({ error: "Failed to create adjustment" });
  }
});

router.patch("/api/engagements/:engagementId/fs-heads/:fsHeadKey/adjustments/:adjustmentId", async (req: Request, res: Response) => {
  try {
    const { adjustmentId } = req.params;
    const data = req.body;
    
    const adjustment = await db.fSHeadAdjustment.update({
      where: { id: adjustmentId },
      data: {
        adjustmentRef: data.adjustmentRef,
        adjustmentType: data.adjustmentType,
        description: data.description,
        debitAmount: data.debitAmount,
        creditAmount: data.creditAmount,
        netImpact: data.netImpact,
        isPosted: data.isPosted
      }
    });
    
    res.json({ success: true, adjustment });
  } catch (error) {
    console.error("Error updating adjustment:", error);
    res.status(500).json({ error: "Failed to update adjustment" });
  }
});

router.delete("/api/engagements/:engagementId/fs-heads/:fsHeadKey/adjustments/:adjustmentId", async (req: Request, res: Response) => {
  try {
    const { adjustmentId } = req.params;
    
    await db.fSHeadAdjustment.delete({
      where: { id: adjustmentId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting adjustment:", error);
    res.status(500).json({ error: "Failed to delete adjustment" });
  }
});

router.patch("/api/fs-head-adjustments/:adjustmentId/post", async (req: Request, res: Response) => {
  try {
    const { adjustmentId } = req.params;
    const userId = (req as any).session?.userId;
    
    const adjustment = await db.fSHeadAdjustment.update({
      where: { id: adjustmentId },
      data: {
        isPosted: true,
        postedAt: new Date(),
        postedById: userId
      }
    });
    
    res.json({ success: true, adjustment, message: "Adjustment posted successfully" });
  } catch (error) {
    console.error("Error posting adjustment:", error);
    res.status(500).json({ error: "Failed to post adjustment" });
  }
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/balances", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId, fsLineItem: { not: null } },
      select: { accountCode: true, fsLineItem: true }
    });
    
    const accountCodes = coaAccounts
      .filter(a => a.fsLineItem?.toLowerCase().replace(/[^a-z0-9]/g, '-') === fsHeadKey)
      .map(a => a.accountCode);
    
    if (accountCodes.length === 0) {
      return res.json({ success: true, balances: null, message: "No accounts found for this FS head" });
    }
    
    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!tbBatch) {
      return res.json({ success: true, balances: null, message: "No approved trial balance found" });
    }
    
    const tbEntries = await prisma.tBEntry.findMany({
      where: {
        batchId: tbBatch.id,
        accountCode: { in: accountCodes }
      }
    });
    
    const currentYearBalance = tbEntries.reduce((sum: number, e: any) => sum + Number(e.closingBalance || 0), 0);
    const priorYearBalance = tbEntries.reduce((sum: number, e: any) => sum + Number(e.openingBalance || 0), 0);
    const movement = currentYearBalance - priorYearBalance;
    const movementPercentage = priorYearBalance !== 0 ? ((movement / Math.abs(priorYearBalance)) * 100) : 0;
    
    const materiality = await prisma.materialityCalculation.findFirst({
      where: { engagementId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      success: true,
      balances: {
        currentYearBalance,
        priorYearBalance,
        movement,
        movementPercentage,
        accountCount: accountCodes.length
      },
      materiality: materiality ? {
        overallMateriality: materiality.overallMateriality,
        performanceMateriality: materiality.performanceMateriality,
        trivialThreshold: materiality.trivialThreshold
      } : null
    });
  } catch (error) {
    console.error("Error fetching FS head balances:", error);
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/validation", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    
    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } },
      include: {
        procedures: true,
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true,
        adjustments: true,
        reviewPoints: { where: { status: 'OPEN' } },
        attachments: true
      }
    });
    
    if (!workingPaper) {
      return res.json({ success: true, validation: null });
    }
    
    const issues: string[] = [];
    let canComplete = true;
    
    if (!workingPaper.tocCompleted && workingPaper.testOfControls.length === 0) {
      issues.push("No Test of Controls performed");
    }
    
    const incompleteTOC = workingPaper.testOfControls.filter((t: any) => t.result === 'PENDING');
    if (incompleteTOC.length > 0) {
      issues.push(`${incompleteTOC.length} TOC procedures incomplete`);
      canComplete = false;
    }
    
    if (!workingPaper.todCompleted && workingPaper.testOfDetails.length === 0) {
      issues.push("No Test of Details performed");
    }
    
    const incompleteTOD = workingPaper.testOfDetails.filter((t: any) => t.result === 'PENDING');
    if (incompleteTOD.length > 0) {
      issues.push(`${incompleteTOD.length} TOD procedures incomplete`);
      canComplete = false;
    }
    
    if (!workingPaper.analyticsCompleted && workingPaper.analyticalProcedures.length === 0) {
      issues.push("No Analytical Procedures performed");
    }
    
    const openReviewPoints = workingPaper.reviewPoints.length;
    if (openReviewPoints > 0) {
      issues.push(`${openReviewPoints} review points uncleared`);
      canComplete = false;
    }
    
    if (workingPaper.attachments.length === 0) {
      issues.push("No evidence attached");
    }
    
    if (!workingPaper.conclusion) {
      issues.push("No conclusion documented");
      canComplete = false;
    }
    
    const unpostedAdjustments = workingPaper.adjustments.filter((a: any) => !a.isPosted);
    if (unpostedAdjustments.length > 0) {
      issues.push(`${unpostedAdjustments.length} adjustments not posted`);
    }
    
    res.json({
      success: true,
      validation: {
        canComplete,
        issues,
        summary: {
          tocCount: workingPaper.testOfControls.length,
          todCount: workingPaper.testOfDetails.length,
          analyticsCount: workingPaper.analyticalProcedures.length,
          adjustmentsCount: workingPaper.adjustments.length,
          attachmentsCount: workingPaper.attachments.length,
          openReviewPoints
        }
      }
    });
  } catch (error) {
    console.error("Error validating FS head:", error);
    res.status(500).json({ error: "Failed to validate" });
  }
});

const fsHeadGenerateSchema = z.object({
  regenerate: z.boolean().optional().default(false),
});

const FS_HEAD_TEMPLATES: Record<string, { name: string; fsType: string; defaultRisk: string; presumedRisk: boolean; assertions: string[] }> = {
  "cash-and-bank": { name: "Cash & Bank", fsType: "BS", defaultRisk: "LOW", presumedRisk: false, assertions: ["EXISTENCE", "COMPLETENESS", "VALUATION"] },
  "trade-receivables": { name: "Trade Receivables", fsType: "BS", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["EXISTENCE", "VALUATION", "RIGHTS"] },
  "inventory": { name: "Inventory", fsType: "BS", defaultRisk: "HIGH", presumedRisk: false, assertions: ["EXISTENCE", "VALUATION", "RIGHTS", "COMPLETENESS"] },
  "prepayments": { name: "Prepayments", fsType: "BS", defaultRisk: "LOW", presumedRisk: false, assertions: ["EXISTENCE", "VALUATION", "CLASSIFICATION"] },
  "fixed-assets": { name: "Fixed Assets", fsType: "BS", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["EXISTENCE", "VALUATION", "RIGHTS", "COMPLETENESS"] },
  "intangibles": { name: "Intangibles", fsType: "BS", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["EXISTENCE", "VALUATION", "COMPLETENESS"] },
  "investments": { name: "Investments", fsType: "BS", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["EXISTENCE", "VALUATION", "RIGHTS"] },
  "trade-payables": { name: "Trade Payables", fsType: "BS", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["COMPLETENESS", "VALUATION", "OBLIGATIONS"] },
  "accruals-provisions": { name: "Accruals & Provisions", fsType: "BS", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["COMPLETENESS", "VALUATION", "OBLIGATIONS"] },
  "borrowings": { name: "Borrowings", fsType: "BS", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["COMPLETENESS", "VALUATION", "OBLIGATIONS", "CLASSIFICATION"] },
  "equity": { name: "Equity", fsType: "BS", defaultRisk: "LOW", presumedRisk: false, assertions: ["EXISTENCE", "COMPLETENESS", "VALUATION"] },
  "revenue": { name: "Revenue", fsType: "PL", defaultRisk: "HIGH", presumedRisk: true, assertions: ["OCCURRENCE", "COMPLETENESS", "ACCURACY", "CUTOFF"] },
  "cost-of-sales": { name: "Cost of Sales", fsType: "PL", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["OCCURRENCE", "COMPLETENESS", "ACCURACY"] },
  "administrative-expenses": { name: "Administrative Expenses", fsType: "PL", defaultRisk: "LOW", presumedRisk: false, assertions: ["OCCURRENCE", "COMPLETENESS", "CLASSIFICATION"] },
  "selling-distribution": { name: "Selling & Distribution", fsType: "PL", defaultRisk: "LOW", presumedRisk: false, assertions: ["OCCURRENCE", "COMPLETENESS", "CLASSIFICATION"] },
  "finance-cost": { name: "Finance Cost", fsType: "PL", defaultRisk: "LOW", presumedRisk: false, assertions: ["COMPLETENESS", "ACCURACY", "CLASSIFICATION"] },
  "other-income": { name: "Other Income", fsType: "PL", defaultRisk: "MEDIUM", presumedRisk: false, assertions: ["OCCURRENCE", "COMPLETENESS", "ACCURACY"] },
};

const TOC_TEMPLATES: Record<string, { control: string; frequency: string; type: string }[]> = {
  "revenue": [
    { control: "Sales order authorization by authorized personnel", frequency: "Per Transaction", type: "PREVENTIVE" },
    { control: "Credit limit approval before sales processing", frequency: "Per Transaction", type: "PREVENTIVE" },
    { control: "Monthly revenue reconciliation to sub-ledger", frequency: "Monthly", type: "DETECTIVE" },
  ],
  "trade-receivables": [
    { control: "Customer credit checks before account opening", frequency: "Per Customer", type: "PREVENTIVE" },
    { control: "Monthly aging analysis review by management", frequency: "Monthly", type: "DETECTIVE" },
  ],
  "inventory": [
    { control: "Physical inventory counts supervised by management", frequency: "Annually", type: "DETECTIVE" },
    { control: "Goods receipt verification against purchase orders", frequency: "Per Receipt", type: "PREVENTIVE" },
  ],
  "trade-payables": [
    { control: "Three-way matching before payment (PO, GRN, Invoice)", frequency: "Per Transaction", type: "PREVENTIVE" },
    { control: "Monthly payables reconciliation to supplier statements", frequency: "Monthly", type: "DETECTIVE" },
  ],
  "cash-and-bank": [
    { control: "Dual authorization for payments above threshold", frequency: "Per Transaction", type: "PREVENTIVE" },
    { control: "Monthly bank reconciliation by independent person", frequency: "Monthly", type: "DETECTIVE" },
  ],
  "fixed-assets": [
    { control: "Capital expenditure authorization per budget", frequency: "Per Transaction", type: "PREVENTIVE" },
    { control: "Annual physical verification of fixed assets", frequency: "Annually", type: "DETECTIVE" },
  ],
};

const TOD_TEMPLATES: Record<string, { procedure: string; method: string }[]> = {
  "revenue": [
    { procedure: "Test sample of sales invoices to supporting documents (contracts, delivery notes)", method: "VOUCHING" },
    { procedure: "Test cutoff of revenue transactions around period end", method: "CUTOFF_TESTING" },
    { procedure: "Confirm major customer balances and transactions", method: "EXTERNAL_CONFIRMATION" },
  ],
  "trade-receivables": [
    { procedure: "Send direct confirmations to sample of debtors", method: "EXTERNAL_CONFIRMATION" },
    { procedure: "Test subsequent receipts for recoverability", method: "SUBSEQUENT_EVENTS" },
    { procedure: "Review aging and allowance for expected credit losses", method: "ANALYTICAL" },
  ],
  "inventory": [
    { procedure: "Attend physical inventory count and perform test counts", method: "OBSERVATION" },
    { procedure: "Test inventory valuation (lower of cost and NRV)", method: "RECOMPUTATION" },
    { procedure: "Vouch purchase costs to supplier invoices", method: "VOUCHING" },
  ],
  "cash-and-bank": [
    { procedure: "Obtain and test bank confirmations", method: "EXTERNAL_CONFIRMATION" },
    { procedure: "Review bank reconciliations for unusual items", method: "INSPECTION" },
  ],
  "fixed-assets": [
    { procedure: "Vouch sample of additions to supporting documents", method: "VOUCHING" },
    { procedure: "Test depreciation calculations for accuracy", method: "RECOMPUTATION" },
    { procedure: "Inspect significant assets physically", method: "OBSERVATION" },
  ],
  "trade-payables": [
    { procedure: "Request supplier statement confirmations", method: "EXTERNAL_CONFIRMATION" },
    { procedure: "Search for unrecorded liabilities after year end", method: "SUBSEQUENT_EVENTS" },
  ],
  "borrowings": [
    { procedure: "Confirm loan balances with lenders", method: "EXTERNAL_CONFIRMATION" },
    { procedure: "Review loan agreements for terms and covenants", method: "INSPECTION" },
  ],
};

router.post("/api/engagements/:engagementId/fs-heads/generate", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const body = fsHeadGenerateSchema.parse(req.body || {});
    const userId = (req as any).session?.passport?.user;
    
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: { select: { name: true } },
        firm: { select: { id: true } }
      }
    });
    
    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }
    
    const approvedTB = await db.tBBatch.findFirst({
      where: { engagementId, status: "APPROVED" },
      orderBy: { createdAt: 'desc' }
    });
    
    const hasImportBalances = !approvedTB ? (await prisma.importAccountBalance.count({
      where: { engagementId, balanceType: "CLOSING" }
    })) > 0 : false;
    
    if (!approvedTB && !hasImportBalances && !body.regenerate) {
      return res.status(400).json({ 
        error: "No Trial Balance data", 
        message: "Trial Balance data is required before generating FS Heads. Please upload Trial Balance data first."
      });
    }
    
    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId, fsLineItem: { not: null } },
      orderBy: { accountCode: 'asc' }
    });
    
    const existingFsHeads = coaAccounts.length === 0 ? await prisma.fSHead.findMany({
      where: { engagementId },
      include: { fsLines: true }
    }) : [];
    
    if (coaAccounts.length === 0 && existingFsHeads.length === 0) {
      return res.status(400).json({ 
        error: "No Chart of Accounts found",
        message: "Please set up the Chart of Accounts with FS Line Item mappings before generating FS Heads."
      });
    }
    
    if (coaAccounts.length === 0 && existingFsHeads.length > 0) {
      return res.json({
        success: true,
        message: "FS Heads already exist from seeded data",
        generated: existingFsHeads.length,
        fsHeads: existingFsHeads.map(fh => fh.code)
      });
    }
    
    const materiality = await db.materialityCalculation.findFirst({
      where: { engagementId, status: "APPROVED" },
      orderBy: { version: 'desc' }
    });
    
    const overallMateriality = materiality?.overallMateriality || null;
    const performanceMateriality = materiality?.performanceMateriality || null;
    const trivialThreshold = materiality?.trivialThreshold || null;
    
    const existingRisks = await prisma.riskAssessment.findMany({
      where: { engagementId },
      select: { id: true, accountOrClass: true, riskDescription: true, assertionImpacts: true, riskOfMaterialMisstatement: true }
    });
    
    const tbEntries = approvedTB ? await db.tBEntry.findMany({
      where: { batchId: approvedTB.id },
      select: { accountCode: true, closingBalance: true, openingBalance: true }
    }) : [];
    
    const tbBalanceMap = new Map<string, { accountCode: string; closingBalance: any; openingBalance: any }>(
      tbEntries.map((t: any) => [t.accountCode, t])
    );
    
    const fsHeadMap = new Map<string, {
      key: string;
      name: string;
      fsType: string;
      statementType: string;
      accounts: { code: string; name: string }[];
      currentBalance: number;
      priorBalance: number;
    }>();
    
    for (const acc of coaAccounts) {
      if (!acc.fsLineItem) continue;
      
      const key = acc.fsLineItem.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const tb = tbBalanceMap.get(acc.accountCode);
      
      if (!fsHeadMap.has(key)) {
        let statementType = "Other";
        let fsType = "BS";
        if (acc.accountClass?.toLowerCase().includes("asset")) { statementType = "Assets"; fsType = "BS"; }
        else if (acc.accountClass?.toLowerCase().includes("liab")) { statementType = "Liabilities"; fsType = "BS"; }
        else if (acc.accountClass?.toLowerCase().includes("equity")) { statementType = "Equity"; fsType = "BS"; }
        else if (acc.accountClass?.toLowerCase().includes("income") || acc.accountClass?.toLowerCase().includes("revenue")) { statementType = "Income"; fsType = "PL"; }
        else if (acc.accountClass?.toLowerCase().includes("expense")) { statementType = "Expenses"; fsType = "PL"; }
        
        fsHeadMap.set(key, {
          key,
          name: acc.fsLineItem,
          fsType,
          statementType,
          accounts: [],
          currentBalance: 0,
          priorBalance: 0
        });
      }
      
      const entry = fsHeadMap.get(key)!;
      entry.accounts.push({ code: acc.accountCode, name: acc.accountName });
      if (tb) {
        entry.currentBalance += parseFloat(tb.closingBalance || "0");
        entry.priorBalance += parseFloat(tb.openingBalance || "0");
      }
    }
    
    const fsHeadsList = Array.from(fsHeadMap.values());
    const generatedItems: any[] = [];
    
    for (const fsHead of fsHeadsList) {
      const template = FS_HEAD_TEMPLATES[fsHead.key] || {
        name: fsHead.name,
        fsType: fsHead.fsType,
        defaultRisk: "MEDIUM",
        presumedRisk: false,
        assertions: ["EXISTENCE", "COMPLETENESS", "VALUATION"]
      };
      
      const movement = fsHead.currentBalance - fsHead.priorBalance;
      const movementPct = fsHead.priorBalance !== 0 ? (movement / Math.abs(fsHead.priorBalance)) * 100 : 0;
      
      let materialityRelevance = "LOW";
      if (overallMateriality) {
        const omValue = parseFloat(overallMateriality.toString());
        const headValue = Math.abs(fsHead.currentBalance);
        if (headValue >= omValue) materialityRelevance = "HIGH";
        else if (headValue >= omValue * 0.5) materialityRelevance = "MEDIUM";
      }
      
      const existingWP = await db.fSHeadWorkingPaper.findUnique({
        where: { engagementId_fsHeadKey: { engagementId, fsHeadKey: fsHead.key } }
      });
      
      let workingPaper;
      if (existingWP && !body.regenerate) {
        workingPaper = existingWP;
      } else {
        if (existingWP) {
          await db.fSHeadTOC.deleteMany({ where: { workingPaperId: existingWP.id } });
          await db.fSHeadTOD.deleteMany({ where: { workingPaperId: existingWP.id } });
          await db.fSHeadAnalyticalProcedure.deleteMany({ where: { workingPaperId: existingWP.id } });
          await db.fSHeadWorkingPaper.delete({ where: { id: existingWP.id } });
        }
        
        workingPaper = await db.fSHeadWorkingPaper.create({
          data: {
            engagementId,
            fsHeadKey: fsHead.key,
            fsHeadName: fsHead.name,
            statementType: fsHead.statementType,
            fsType: fsHead.fsType,
            linkedAccountIds: fsHead.accounts.map((a: { code: string }) => a.code),
            currentYearBalance: fsHead.currentBalance,
            priorYearBalance: fsHead.priorBalance,
            movement: movement,
            movementPercentage: movementPct,
            overallMateriality: overallMateriality,
            performanceMateriality: performanceMateriality,
            trivialThreshold: trivialThreshold,
            materialityRelevance: materialityRelevance,
            isMaterialHead: materialityRelevance === "HIGH",
            riskLevel: template.defaultRisk,
            inherentRisk: template.defaultRisk,
            controlRisk: "MEDIUM",
            status: "DRAFT",
            tocCompleted: false,
            todCompleted: false,
            analyticsCompleted: false,
            conclusion: `Based on the audit procedures performed, the balance of ${fsHead.name} is / is not fairly stated in all material respects.`,
          }
        });
        
        const tocTemplates = TOC_TEMPLATES[fsHead.key] || [];
        for (let i = 0; i < tocTemplates.length; i++) {
          await db.fSHeadTOC.create({
            data: {
              workingPaperId: workingPaper.id,
              tocRef: `TOC-${fsHead.key.toUpperCase().substring(0,3)}-${String(i+1).padStart(2,'0')}`,
              controlDescription: tocTemplates[i].control,
              controlFrequency: tocTemplates[i].frequency,
              controlType: tocTemplates[i].type,
              assertions: template.assertions.slice(0, 2),
              result: "PENDING",
              isAISuggested: true,
              aiConfidence: 0.85,
            }
          });
        }
        
        const todTemplates = TOD_TEMPLATES[fsHead.key] || [
          { procedure: `Vouch sample of ${fsHead.name} transactions to supporting documents`, method: "VOUCHING" }
        ];
        for (let i = 0; i < todTemplates.length; i++) {
          await db.fSHeadTOD.create({
            data: {
              workingPaperId: workingPaper.id,
              todRef: `TOD-${fsHead.key.toUpperCase().substring(0,3)}-${String(i+1).padStart(2,'0')}`,
              procedureDescription: todTemplates[i].procedure,
              samplingMethod: todTemplates[i].method,
              assertions: template.assertions,
              result: "PENDING",
              isAISuggested: true,
              aiConfidence: 0.85,
            }
          });
        }
        
        const pyVal = fsHead.priorBalance;
        const cyVal = fsHead.currentBalance;
        const movementVal = cyVal - pyVal;
        const movementPctVal = pyVal !== 0 ? (movementVal / Math.abs(pyVal)) * 100 : null;
        
        await db.fSHeadAnalyticalProcedure.create({
          data: {
            workingPaperId: workingPaper.id,
            procedureRef: `ANA-${fsHead.key.toUpperCase().substring(0,3)}-01`,
            analyticalType: "TREND",
            description: `Year-over-year movement analysis for ${fsHead.name}`,
            priorYearValue: pyVal,
            currentYearValue: cyVal,
            variance: movementVal,
            variancePercentage: movementPctVal,
            thresholdPercentage: 10,
            isWithinThreshold: Math.abs(movementPctVal || 0) <= 10,
            investigationRequired: Math.abs(movementPctVal || 0) > 10,
            isAISuggested: true,
            aiConfidence: 0.90,
          }
        });
        
        if (Math.abs(fsHead.currentBalance) > 0 && overallMateriality) {
          await db.fSHeadAnalyticalProcedure.create({
            data: {
              workingPaperId: workingPaper.id,
              procedureRef: `ANA-${fsHead.key.toUpperCase().substring(0,3)}-02`,
              analyticalType: "RATIO",
              description: `Materiality significance ratio for ${fsHead.name}`,
              currentYearValue: Math.abs(fsHead.currentBalance),
              budgetValue: overallMateriality,
              variance: Math.abs(fsHead.currentBalance) - parseFloat(overallMateriality.toString()),
              expectation: "Balance compared to overall materiality threshold",
              isAISuggested: true,
              aiConfidence: 0.88,
            }
          });
        }
        
        // Create RiskAssessment records (ISA 315)
        const riskDescription = template.presumedRisk 
          ? `Presumed risk of material misstatement for ${fsHead.name} due to revenue recognition susceptibility to fraud.`
          : `Inherent risk assessment for ${fsHead.name} based on account nature and movement analysis.`;
        
        const assertionType = template.assertions[0] as any || "EXISTENCE";
        
        // Map template risk levels to valid enum values (LOW, MODERATE, HIGH, SIGNIFICANT)
        const mapRiskLevel = (risk: string) => {
          if (risk === "MEDIUM") return "MODERATE";
          if (["LOW", "MODERATE", "HIGH", "SIGNIFICANT"].includes(risk)) return risk;
          return "MODERATE";
        };
        
        await prisma.riskAssessment.create({
          data: {
            engagementId,
            accountOrClass: fsHead.name,
            riskDescription,
            assertion: assertionType,
            assertionImpacts: template.assertions as any[],
            inherentRisk: mapRiskLevel(template.defaultRisk) as any,
            controlRisk: "MODERATE" as any,
            riskOfMaterialMisstatement: mapRiskLevel(template.defaultRisk) as any,
            isSignificantRisk: template.presumedRisk || template.defaultRisk === "HIGH",
            significantRiskReason: template.presumedRisk ? "Presumed risk - Revenue recognition" : (template.defaultRisk === "HIGH" ? "High inherent risk due to account nature" : null),
            isFraudRisk: template.presumedRisk,
            fraudRiskType: template.presumedRisk ? "REVENUE_RECOGNITION" as any : null,
            assessedById: userId || engagement.engagementPartnerId || engagement.engagementManagerId,
          }
        });
        
        // Create presumed management override risk for all material FS heads
        if (materialityRelevance === "HIGH" && !template.presumedRisk) {
          await prisma.riskAssessment.create({
            data: {
              engagementId,
              accountOrClass: fsHead.name,
              riskDescription: `Management override of controls risk for ${fsHead.name} - presumed risk per ISA 240.`,
              assertion: "OCCURRENCE" as any,
              assertionImpacts: ["OCCURRENCE", "EXISTENCE", "VALUATION"] as any[],
              inherentRisk: "HIGH" as any,
              controlRisk: "MODERATE" as any,
              riskOfMaterialMisstatement: "HIGH" as any,
              isSignificantRisk: true,
              significantRiskReason: "Presumed risk - Management override of controls (ISA 240)",
              isFraudRisk: true,
              fraudRiskType: "MANAGEMENT_OVERRIDE" as any,
              assessedById: userId || engagement.engagementPartnerId || engagement.engagementManagerId,
            }
          });
        }
        
        // Initialize Adjusting Entries Register (ISA 450)
        await db.fSHeadAdjustment.create({
          data: {
            workingPaperId: workingPaper.id,
            adjustmentRef: `ADJ-${fsHead.key.toUpperCase().substring(0,3)}-INIT`,
            adjustmentType: "PLACEHOLDER",
            description: `[Placeholder] Adjusting entries register for ${fsHead.name}`,
            reason: "System-generated placeholder for adjusting entries tracking",
            netImpact: 0,
            fsImpact: "NONE",
            isPosted: false,
            isMaterial: false,
          }
        });
      }
      
      const risksCreated = 1 + (materialityRelevance === "HIGH" && !template.presumedRisk ? 1 : 0);
      
      generatedItems.push({
        fsHeadKey: fsHead.key,
        fsHeadName: fsHead.name,
        fsType: fsHead.fsType,
        workingPaperId: workingPaper.id,
        status: workingPaper.status,
        materialityRelevance,
        riskLevel: template.defaultRisk,
        isPresumedRisk: template.presumedRisk,
        accountsLinked: fsHead.accounts.length,
        currentBalance: fsHead.currentBalance,
        priorBalance: fsHead.priorBalance,
        movement: movement,
        tocGenerated: TOC_TEMPLATES[fsHead.key]?.length || 0,
        todGenerated: TOD_TEMPLATES[fsHead.key]?.length || 1,
        analyticsGenerated: 2,
        risksCreated: risksCreated,
        adjustingEntriesInitialized: 1,
      });
    }
    
    res.json({
      success: true,
      message: `Successfully generated ${generatedItems.length} FS Head working papers with risks, procedures, and adjusting entries registers.`,
      aiDisclaimer: "AI-assisted procedures are subject to professional judgment and reviewer approval. All AI suggestions require human review before finalization.",
      summary: {
        totalFsHeads: generatedItems.length,
        balanceSheetHeads: generatedItems.filter(i => i.fsType === "BS").length,
        profitLossHeads: generatedItems.filter(i => i.fsType === "PL").length,
        highRiskHeads: generatedItems.filter(i => i.riskLevel === "HIGH" || i.isPresumedRisk).length,
        materialHeads: generatedItems.filter(i => i.materialityRelevance === "HIGH").length,
        risksGenerated: generatedItems.reduce((sum, i) => sum + i.risksCreated, 0),
        tocProcedures: generatedItems.reduce((sum, i) => sum + i.tocGenerated, 0),
        todProcedures: generatedItems.reduce((sum, i) => sum + i.todGenerated, 0),
        analyticsProcedures: generatedItems.reduce((sum, i) => sum + i.analyticsGenerated, 0),
        adjustingEntriesRegisters: generatedItems.reduce((sum, i) => sum + i.adjustingEntriesInitialized, 0),
      },
      generatedItems,
      materialityApplied: {
        overallMateriality: overallMateriality?.toString() || null,
        performanceMateriality: performanceMateriality?.toString() || null,
        trivialThreshold: trivialThreshold?.toString() || null,
      },
      hardControls: {
        noCompletionWithout: [
          "Risks addressed",
          "Procedures completed",
          "Evidence attached",
          "Conclusion written"
        ],
        noReportIssuanceIf: [
          "Any high-risk FS Head incomplete",
          "Aggregate misstatement exceeds PM",
          "EQCR pending (if required)"
        ]
      }
    });
  } catch (error) {
    console.error("Error generating FS heads:", error);
    res.status(500).json({ error: "Failed to generate FS heads", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/execution-context", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;

    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });

    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId, fsLineItem: { not: null } },
      select: { fsLineItem: true, accountCode: true, id: true }
    });
    const matchingAccounts = coaAccounts.filter((a: any) =>
      a.fsLineItem?.toLowerCase().replace(/[^a-z0-9]/g, '-') === fsHeadKey
    );
    const fsLineItem = matchingAccounts[0]?.fsLineItem || '';
    const matchingAccountIds = matchingAccounts.map((a: any) => a.id);

    const linkedRisks = await prisma.riskAssessment.findMany({
      where: {
        engagementId,
        OR: [
          ...(fsLineItem ? [{ accountOrClass: { contains: fsLineItem.split(' ')[0], mode: 'insensitive' as const } }] : []),
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    const risks = linkedRisks.map((r: any) => ({
      id: r.id,
      accountOrClass: r.accountOrClass,
      riskDescription: r.riskDescription,
      inherentRisk: r.inherentRisk,
      controlRisk: r.controlRisk,
      riskOfMaterialMisstatement: r.riskOfMaterialMisstatement,
      assertion: r.assertion,
      assertionImpacts: r.assertionImpacts || [],
      isSignificantRisk: r.isSignificantRisk,
      isFraudRisk: r.isFraudRisk,
      plannedResponse: r.plannedResponse
    }));

    let materiality = {
      overallMateriality: workingPaper?.overallMateriality ? Number(workingPaper.overallMateriality) : null,
      performanceMateriality: workingPaper?.performanceMateriality ? Number(workingPaper.performanceMateriality) : null,
      trivialThreshold: workingPaper?.trivialThreshold ? Number(workingPaper.trivialThreshold) : null,
    };

    if (!materiality.overallMateriality) {
      const matAssessment = await prisma.materialityAssessment.findFirst({
        where: { engagementId },
        orderBy: { createdAt: 'desc' }
      });
      if (matAssessment) {
        materiality = {
          overallMateriality: matAssessment.overallMateriality,
          performanceMateriality: matAssessment.performanceMateriality,
          trivialThreshold: matAssessment.amptThreshold,
        };
      }
    }

    const samplingFrames = await prisma.samplingRun.findMany({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        runNumber: true,
        runName: true,
        samplingMethod: true,
        populationCount: true,
        populationValue: true,
        sampleSize: true,
        sampleValue: true,
        coveragePercentage: true,
        status: true,
      }
    });

    const assertionLabels = ['EXISTENCE', 'COMPLETENESS', 'ACCURACY', 'VALUATION', 'RIGHTS_AND_OBLIGATIONS', 'CLASSIFICATION', 'CUT_OFF', 'PRESENTATION'];
    const assertionMatrix = assertionLabels.map(a => {
      const matchingRisks = risks.filter((r: any) =>
        r.assertion === a || (r.assertionImpacts && r.assertionImpacts.includes(a))
      );
      return {
        assertion: a,
        riskCount: matchingRisks.length,
        highestRisk: matchingRisks.length > 0 ?
          matchingRisks.reduce((max: string, r: any) => {
            const order: Record<string, number> = { LOW: 1, MODERATE: 2, HIGH: 3, SIGNIFICANT: 4 };
            return (order[r.inherentRisk] || 0) > (order[max] || 0) ? r.inherentRisk : max;
          }, 'LOW') : null,
        covered: matchingRisks.length > 0,
      };
    });

    const priorPeriodData = {
      currentYearBalance: workingPaper?.currentYearBalance ? Number(workingPaper.currentYearBalance) : null,
      priorYearBalance: workingPaper?.priorYearBalance ? Number(workingPaper.priorYearBalance) : null,
      movement: workingPaper?.movement ? Number(workingPaper.movement) : null,
      movementPercentage: workingPaper?.movementPercentage ? Number(workingPaper.movementPercentage) : null,
    };

    res.json({
      success: true,
      linkedRisks: risks,
      materiality,
      samplingFrames,
      assertionMatrix,
      priorPeriodData,
      fsHeadName: fsLineItem || fsHeadKey,
      workingPaperStatus: workingPaper?.status || 'NOT_STARTED',
    });
  } catch (error) {
    console.error("Error fetching execution context:", error);
    res.status(500).json({ error: "Failed to fetch execution context" });
  }
});

router.get("/api/engagements/:engagementId/fs-heads/:fsHeadKey/compliance-check", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;

    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } },
      include: {
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true,
        attachments: true,
        reviewPoints: true,
        procedures: true,
      }
    });

    if (!workingPaper) {
      return res.json({
        success: true,
        overallPass: false,
        checks: {
          isa500: { pass: false, label: 'ISA 500 — Audit Evidence', details: 'No working paper found' },
          isa230: { pass: false, label: 'ISA 230 — Audit Documentation', details: 'No working paper found' },
          isa330: { pass: false, label: 'ISA 330 — Responses to Assessed Risks', details: 'No working paper found' },
        }
      });
    }

    const totalProcedures = (workingPaper.testOfControls?.length || 0)
      + (workingPaper.testOfDetails?.length || 0)
      + (workingPaper.analyticalProcedures?.length || 0);

    const proceduresWithEvidence = (workingPaper.attachments || []).filter((a: any) => a.procedureId).length;
    const allProceduresHaveEvidence = totalProcedures > 0 && proceduresWithEvidence >= totalProcedures;
    const hasAnyEvidence = (workingPaper.attachments || []).length > 0;

    const isa500 = {
      pass: totalProcedures > 0 && hasAnyEvidence,
      label: 'ISA 500 — Audit Evidence',
      details: totalProcedures === 0
        ? 'No procedures executed yet'
        : !hasAnyEvidence
          ? `${totalProcedures} procedure(s) but no evidence attached`
          : allProceduresHaveEvidence
            ? `All ${totalProcedures} procedure(s) have evidence attached`
            : `${proceduresWithEvidence}/${totalProcedures} procedure(s) have linked evidence`,
      procedureCount: totalProcedures,
      evidenceCount: (workingPaper.attachments || []).length,
    };

    const hasConclusion = !!workingPaper.conclusion && workingPaper.conclusion.trim().length > 0;
    const openReviewPoints = (workingPaper.reviewPoints || []).filter((rp: any) => rp.status === 'OPEN').length;
    const allReviewPointsCleared = openReviewPoints === 0;
    const hasSignOff = !!workingPaper.preparedById;

    const isa230 = {
      pass: hasConclusion && allReviewPointsCleared && hasSignOff,
      label: 'ISA 230 — Audit Documentation',
      details: !hasConclusion
        ? 'Conclusion not yet written'
        : openReviewPoints > 0
          ? `${openReviewPoints} open review point(s) remain`
          : !hasSignOff
            ? 'Preparer sign-off not completed'
            : 'Documentation complete — conclusion, review points cleared, sign-off done',
      conclusionWritten: hasConclusion,
      reviewPointsOpen: openReviewPoints,
      signOffDone: hasSignOff,
    };

    const coaAccounts = await prisma.coAAccount.findMany({
      where: { engagementId, fsLineItem: { not: null } },
      select: { fsLineItem: true, id: true }
    });
    const fsLineItem = coaAccounts.find((a: any) =>
      a.fsLineItem?.toLowerCase().replace(/[^a-z0-9]/g, '-') === fsHeadKey
    )?.fsLineItem || '';

    const linkedRisks = fsLineItem ? await prisma.riskAssessment.findMany({
      where: {
        engagementId,
        accountOrClass: { contains: fsLineItem.split(' ')[0], mode: 'insensitive' }
      }
    }) : [];

    const risksWithProcedures = linkedRisks.filter((r: any) => {
      const hasLinkedProcedure = (workingPaper.procedures || []).some((p: any) =>
        p.riskLevel || (p.assertions && p.assertions.length > 0)
      );
      return hasLinkedProcedure;
    });

    const isa330 = {
      pass: linkedRisks.length === 0 || risksWithProcedures.length >= linkedRisks.length,
      label: 'ISA 330 — Responses to Assessed Risks',
      details: linkedRisks.length === 0
        ? 'No risks identified for this FS Head'
        : risksWithProcedures.length >= linkedRisks.length
          ? `All ${linkedRisks.length} risk(s) have linked procedures`
          : `${risksWithProcedures.length}/${linkedRisks.length} risk(s) have linked procedures`,
      totalRisks: linkedRisks.length,
      risksWithProcedures: risksWithProcedures.length,
    };

    const overallPass = isa500.pass && isa230.pass && isa330.pass;

    res.json({
      success: true,
      overallPass,
      checks: { isa500, isa230, isa330 },
    });
  } catch (error) {
    console.error("Error checking compliance:", error);
    res.status(500).json({ error: "Failed to check compliance" });
  }
});

const reviewPointCreateSchema = z.object({
  description: z.string().min(1, "Description is required"),
  severity: z.enum(["HIGH", "MEDIUM", "LOW", "INFO"]).optional(),
  stepIndex: z.number().optional(),
});

router.post("/api/engagements/:engagementId/fs-heads/:fsHeadKey/review-points", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;

    const validation = reviewPointCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message || "Invalid input" });
    }

    let workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } }
    });

    if (!workingPaper) {
      workingPaper = await db.fSHeadWorkingPaper.create({
        data: {
          engagementId,
          fsHeadKey,
          fsHeadName: fsHeadKey.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          status: 'DRAFT'
        }
      });
    }

    const userId = (req as any).session?.passport?.user || null;

    const rpCount = await db.fSHeadReviewPoint.count({ where: { workingPaperId: workingPaper.id } });

    const reviewPoint = await db.fSHeadReviewPoint.create({
      data: {
        workingPaperId: workingPaper.id,
        pointRef: `RP-${String(rpCount + 1).padStart(3, '0')}`,
        description: validation.data.description,
        severity: validation.data.severity || 'INFO',
        status: 'OPEN',
        raisedById: userId,
        raisedAt: new Date(),
      },
      include: {
        raisedBy: { select: { fullName: true } },
        clearedBy: { select: { fullName: true } },
      }
    });

    res.json({ success: true, reviewPoint });
  } catch (error) {
    console.error("Error creating review point:", error);
    res.status(500).json({ error: "Failed to create review point" });
  }
});

const statusTransitionSchema = z.object({
  status: z.enum(["DRAFT", "IN_PROGRESS", "PREPARED", "REVIEWED", "APPROVED"]),
  reason: z.string().optional(),
});

router.patch("/api/engagements/:engagementId/fs-heads/:fsHeadKey/status", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;

    const validation = statusTransitionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0]?.message || "Invalid status" });
    }

    const { status: newStatus, reason } = validation.data;
    const userId = (req as any).session?.passport?.user || null;

    const workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } },
      include: {
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true,
        attachments: true,
        reviewPoints: true,
      }
    });

    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }

    const currentStatus = workingPaper.status;
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['IN_PROGRESS', 'PREPARED'],
      IN_PROGRESS: ['PREPARED', 'DRAFT'],
      PREPARED: ['REVIEWED', 'IN_PROGRESS'],
      REVIEWED: ['APPROVED', 'PREPARED'],
      APPROVED: ['REVIEWED'],
    };

    if (!(validTransitions[currentStatus] || []).includes(newStatus)) {
      return res.status(400).json({
        error: `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${(validTransitions[currentStatus] || []).join(', ')}`
      });
    }

    if (newStatus === 'PREPARED') {
      const totalProcedures = (workingPaper.testOfControls?.length || 0)
        + (workingPaper.testOfDetails?.length || 0)
        + (workingPaper.analyticalProcedures?.length || 0);
      if (totalProcedures === 0) {
        return res.status(400).json({ error: "Cannot mark as Prepared — at least one procedure must be executed" });
      }
    }

    if (newStatus === 'REVIEWED') {
      const openRPs = (workingPaper.reviewPoints || []).filter((rp: any) => rp.status === 'OPEN').length;
      if (openRPs > 0) {
        return res.status(400).json({ error: `Cannot mark as Reviewed — ${openRPs} open review point(s) must be resolved first` });
      }
    }

    if (newStatus === 'APPROVED') {
      if (!workingPaper.conclusion || workingPaper.conclusion.trim().length === 0) {
        return res.status(400).json({ error: "Cannot approve — conclusion must be written" });
      }
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'PREPARED') {
      updateData.preparedById = userId;
      updateData.preparedAt = new Date();
    } else if (newStatus === 'REVIEWED') {
      updateData.reviewedById = userId;
      updateData.reviewedAt = new Date();
    } else if (newStatus === 'APPROVED') {
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    }

    const updated = await db.fSHeadWorkingPaper.update({
      where: { id: workingPaper.id },
      data: updateData,
      include: {
        preparedBy: { select: { fullName: true } },
        reviewedBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } },
      }
    });

    if (userId) {
      try {
        await prisma.auditTrail.create({
          data: {
            engagementId,
            userId,
            action: 'STATUS_CHANGE',
            entityType: 'FSHeadWorkingPaper',
            entityId: workingPaper.id,
            field: 'status',
            beforeValue: currentStatus,
            afterValue: newStatus,
            reason: reason || `Status changed from ${currentStatus} to ${newStatus}`,
            isaReference: 'ISA 230',
            module: 'EXECUTION',
            screen: 'FS_HEADS',
          }
        });
      } catch (auditError) {
        console.error("Audit trail logging failed (non-critical):", auditError);
      }
    }

    res.json({
      success: true,
      workingPaper: updated,
      transition: { from: currentStatus, to: newStatus },
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.get("/api/engagements/:engagementId/execution-compliance-summary", async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    const allWPs = await db.fSHeadWorkingPaper.findMany({
      where: { engagementId },
      include: {
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true,
        attachments: true,
        reviewPoints: true,
        preparedBy: { select: { fullName: true } },
      }
    });

    const perHead = allWPs.map((wp: any) => {
      const tocCount = wp.testOfControls?.length || 0;
      const todCount = wp.testOfDetails?.length || 0;
      const analyticsCount = wp.analyticalProcedures?.length || 0;
      const totalProcedures = tocCount + todCount + analyticsCount;
      const hasEvidence = (wp.attachments || []).length > 0;
      const hasConclusion = !!wp.conclusion && wp.conclusion.trim().length > 0;
      const openReviewPoints = (wp.reviewPoints || []).filter((rp: any) => rp.status === 'OPEN').length;

      let completionPercent = 0;
      if (wp.status === 'APPROVED') completionPercent = 100;
      else if (wp.status === 'REVIEWED') completionPercent = 80;
      else if (wp.status === 'PREPARED') completionPercent = 60;
      else if (wp.status === 'IN_PROGRESS') completionPercent = 40;
      else if (totalProcedures > 0) completionPercent = 20;

      const hasSignOff = !!wp.preparedById;
      const isa500Pass = totalProcedures > 0 && hasEvidence;
      const isa230Pass = hasConclusion && openReviewPoints === 0 && hasSignOff;
      const isa330Pass = totalProcedures > 0;

      let trafficLight: 'green' | 'amber' | 'red' = 'red';
      if (wp.status === 'APPROVED' && isa500Pass && isa230Pass && isa330Pass) trafficLight = 'green';
      else if (['IN_PROGRESS', 'PREPARED', 'REVIEWED'].includes(wp.status) || totalProcedures > 0) trafficLight = 'amber';

      return {
        fsHeadKey: wp.fsHeadKey,
        fsHeadName: wp.fsHeadName,
        status: wp.status,
        completionPercent,
        trafficLight,
        procedureCount: totalProcedures,
        hasEvidence,
        hasConclusion,
        openReviewPoints,
        riskLevel: wp.riskLevel || 'MEDIUM',
        isaCompliance: {
          isa500: isa500Pass,
          isa230: isa230Pass,
          isa330: isa330Pass,
        },
      };
    });

    const totalHeads = perHead.length;
    const approvedHeads = perHead.filter((h: any) => h.status === 'APPROVED').length;
    const overallCompletion = totalHeads > 0
      ? Math.round(perHead.reduce((sum: number, h: any) => sum + h.completionPercent, 0) / totalHeads)
      : 0;

    const allHaveEvidence = perHead.every((h: any) => h.hasEvidence);
    const allHaveConclusions = perHead.every((h: any) => h.hasConclusion);
    const noOpenReviewPoints = perHead.every((h: any) => h.openReviewPoints === 0);
    const allApproved = totalHeads > 0 && approvedHeads === totalHeads;

    const canProceedToFinalization = allApproved;

    const finalizationBlockers: string[] = [];
    if (!allApproved) finalizationBlockers.push(`${totalHeads - approvedHeads} FS Head(s) not yet approved`);
    if (!allHaveEvidence) finalizationBlockers.push('Some FS Heads lack evidence attachments');
    if (!allHaveConclusions) finalizationBlockers.push('Some FS Heads lack written conclusions');
    if (!noOpenReviewPoints) finalizationBlockers.push('Open review points remain');

    res.json({
      success: true,
      summary: {
        totalHeads,
        approvedHeads,
        overallCompletion,
        canProceedToFinalization,
        finalizationBlockers,
        isaCompliance: {
          allHeadsHaveEvidence: allHaveEvidence,
          allRisksLinked: true,
          allConclusionsWritten: allHaveConclusions,
          allReviewPointsCleared: noOpenReviewPoints,
        },
      },
      perHead,
    });
  } catch (error) {
    console.error("Error fetching execution compliance summary:", error);
    res.status(500).json({ error: "Failed to fetch execution compliance summary" });
  }
});

router.post("/engagements/:engagementId/fs-heads/:fsHeadKey/attachments", evidenceUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const workingPaper = await db.fSHeadWorkingPaper.findFirst({
      where: { engagementId, fsHeadKey }
    });
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }

    const description = typeof req.body?.description === "string" ? req.body.description : "";
    const evidenceType = typeof req.body?.evidenceType === "string" ? req.body.evidenceType : "supporting";
    const procedureId = typeof req.body?.procedureId === "string" ? req.body.procedureId : null;

    const attachment = await db.fSHeadAttachment.create({
      data: {
        workingPaperId: workingPaper.id,
        procedureId: procedureId || undefined,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        description,
        evidenceType,
        uploadedById: (req as any).user?.id || null,
      },
      include: { uploadedBy: { select: { fullName: true } } }
    });

    res.json({ success: true, attachment });
  } catch (error) {
    console.error("Error uploading evidence:", error);
    res.status(500).json({ error: "Failed to upload evidence" });
  }
});

router.delete("/engagements/:engagementId/fs-heads/:fsHeadKey/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const { engagementId, fsHeadKey, attachmentId } = req.params;

    const workingPaper = await db.fSHeadWorkingPaper.findFirst({
      where: { engagementId, fsHeadKey }
    });
    if (!workingPaper) {
      return res.status(404).json({ error: "Working paper not found" });
    }

    const attachment = await db.fSHeadAttachment.findFirst({
      where: { id: attachmentId, workingPaperId: workingPaper.id }
    });
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (attachment.filePath && fs.existsSync(attachment.filePath)) {
      fs.unlinkSync(attachment.filePath);
    }

    await db.fSHeadAttachment.delete({ where: { id: attachmentId } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

export default router;
