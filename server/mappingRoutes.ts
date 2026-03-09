import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";

const router = Router();

const TOLERANCE_PERCENTAGE = 0.01; // 1% tolerance for matching

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.includes(shorter)) return 0.8;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  const wordSimilarity = commonWords.length / Math.max(words1.length, words2.length);
  
  return wordSimilarity;
}

function toNumber(val: Decimal | number | null): number {
  if (val === null) return 0;
  if (typeof val === 'number') return val;
  return Number(val);
}

const CreateMappingSessionSchema = z.object({
  engagementId: z.string().uuid(),
  tbBatchId: z.string().uuid(),
  glBatchId: z.string().uuid().optional(),
  sessionName: z.string().optional(),
  toleranceAmount: z.number().optional().default(0),
});

router.post("/session", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateMappingSessionSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: data.engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const tbBatch = await prisma.tBBatch.findFirst({
      where: { id: data.tbBatchId, engagementId: data.engagementId },
      include: { entries: true },
    });

    if (!tbBatch) {
      return res.status(404).json({ error: "Trial Balance batch not found" });
    }

    let glBatch = null;
    let glEntries: any[] = [];
    
    if (data.glBatchId) {
      glBatch = await prisma.gLBatch.findFirst({
        where: { id: data.glBatchId, engagementId: data.engagementId },
        include: { entries: true },
      });

      if (!glBatch) {
        return res.status(404).json({ error: "GL batch not found" });
      }
      glEntries = glBatch.entries;
    }

    const existingSessionCount = await prisma.mappingSession.count({
      where: { engagementId: data.engagementId },
    });

    const tbTotalClosingDebit = tbBatch.entries.reduce((sum, e) => sum + toNumber(e.closingDebit), 0);
    const tbTotalClosingCredit = tbBatch.entries.reduce((sum, e) => sum + toNumber(e.closingCredit), 0);

    const glTotalDebit = glEntries.reduce((sum, e) => sum + toNumber(e.debit), 0);
    const glTotalCredit = glEntries.reduce((sum, e) => sum + toNumber(e.credit), 0);

    const session = await prisma.mappingSession.create({
      data: {
        engagementId: data.engagementId,
        firmId,
        tbBatchId: data.tbBatchId,
        glBatchId: data.glBatchId || null,
        sessionNumber: existingSessionCount + 1,
        sessionName: data.sessionName || `Mapping Session ${existingSessionCount + 1}`,
        status: "IN_PROGRESS",
        tbTotalClosingDebit,
        tbTotalClosingCredit,
        glTotalDebit,
        glTotalCredit,
        toleranceAmount: data.toleranceAmount || 0,
        createdById: userId,
      },
    });

    const tbByAccountCode = new Map<string, { 
      accountName: string;
      closingDebit: number;
      closingCredit: number;
      openingDebit: number;
      openingCredit: number;
    }>();

    for (const entry of tbBatch.entries) {
      const existing = tbByAccountCode.get(entry.accountCode) || {
        accountName: entry.accountName,
        closingDebit: 0,
        closingCredit: 0,
        openingDebit: 0,
        openingCredit: 0,
      };
      
      tbByAccountCode.set(entry.accountCode, {
        accountName: entry.accountName,
        closingDebit: existing.closingDebit + toNumber(entry.closingDebit),
        closingCredit: existing.closingCredit + toNumber(entry.closingCredit),
        openingDebit: existing.openingDebit + toNumber(entry.openingDebit),
        openingCredit: existing.openingCredit + toNumber(entry.openingCredit),
      });
    }

    const glByAccountCode = new Map<string, { 
      accountName: string;
      debit: number;
      credit: number;
      count: number;
    }>();

    for (const entry of glEntries) {
      const existing = glByAccountCode.get(entry.accountCode) || {
        accountName: entry.accountName,
        debit: 0,
        credit: 0,
        count: 0,
      };
      
      glByAccountCode.set(entry.accountCode, {
        accountName: entry.accountName,
        debit: existing.debit + toNumber(entry.debit),
        credit: existing.credit + toNumber(entry.credit),
        count: existing.count + 1,
      });
    }

    const reconciliationItems: any[] = [];
    const processedGLCodes = new Set<string>();
    
    let matchedCount = 0;
    let differenceCount = 0;
    let missingInGLCount = 0;
    let missingInTBCount = 0;
    let totalMatchedValue = 0;
    let totalTBValue = 0;

    for (const [accountCode, tbData] of tbByAccountCode) {
      totalTBValue += Math.abs(tbData.closingDebit - tbData.closingCredit);
      
      const glData = glByAccountCode.get(accountCode);
      
      if (glData) {
        processedGLCodes.add(accountCode);
        
        const differenceDebit = tbData.closingDebit - glData.debit;
        const differenceCredit = tbData.closingCredit - glData.credit;
        const totalDifference = Math.abs(differenceDebit) + Math.abs(differenceCredit);
        const toleranceValue = data.toleranceAmount || 0;
        
        let matchStatus: string;
        let matchConfidence = 1.0;
        
        if (totalDifference <= toleranceValue || totalDifference === 0) {
          matchStatus = "MATCHED";
          matchedCount++;
          totalMatchedValue += Math.abs(tbData.closingDebit - tbData.closingCredit);
        } else {
          matchStatus = "DIFFERENCE";
          differenceCount++;
          matchConfidence = 1 - (totalDifference / (Math.max(tbData.closingDebit + tbData.closingCredit, glData.debit + glData.credit) || 1));
        }
        
        reconciliationItems.push({
          sessionId: session.id,
          accountCode,
          accountName: tbData.accountName,
          tbClosingDebit: tbData.closingDebit,
          tbClosingCredit: tbData.closingCredit,
          tbOpeningDebit: tbData.openingDebit,
          tbOpeningCredit: tbData.openingCredit,
          glTotalDebit: glData.debit,
          glTotalCredit: glData.credit,
          glTransactionCount: glData.count,
          differenceDebit,
          differenceCredit,
          matchStatus,
          matchConfidence: Math.max(0, matchConfidence),
          matchMethod: "EXACT_CODE",
        });
      } else if (data.glBatchId) {
        let bestMatch: { code: string; data: any; similarity: number } | null = null;
        
        for (const [glCode, glAccountData] of glByAccountCode) {
          if (processedGLCodes.has(glCode)) continue;
          
          const similarity = calculateSimilarity(tbData.accountName, glAccountData.accountName);
          if (similarity >= 0.7 && (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { code: glCode, data: glAccountData, similarity };
          }
        }
        
        if (bestMatch) {
          processedGLCodes.add(bestMatch.code);
          
          const differenceDebit = tbData.closingDebit - bestMatch.data.debit;
          const differenceCredit = tbData.closingCredit - bestMatch.data.credit;
          const totalDifference = Math.abs(differenceDebit) + Math.abs(differenceCredit);
          const toleranceValue = data.toleranceAmount || 0;
          
          let matchStatus: string;
          if (totalDifference <= toleranceValue || totalDifference === 0) {
            matchStatus = "MATCHED";
            matchedCount++;
            totalMatchedValue += Math.abs(tbData.closingDebit - tbData.closingCredit);
          } else {
            matchStatus = "DIFFERENCE";
            differenceCount++;
          }
          
          reconciliationItems.push({
            sessionId: session.id,
            accountCode,
            accountName: tbData.accountName,
            tbClosingDebit: tbData.closingDebit,
            tbClosingCredit: tbData.closingCredit,
            tbOpeningDebit: tbData.openingDebit,
            tbOpeningCredit: tbData.openingCredit,
            glTotalDebit: bestMatch.data.debit,
            glTotalCredit: bestMatch.data.credit,
            glTransactionCount: bestMatch.data.count,
            differenceDebit,
            differenceCredit,
            matchStatus,
            matchConfidence: bestMatch.similarity,
            matchMethod: "FUZZY_NAME",
          });
        } else {
          missingInGLCount++;
          reconciliationItems.push({
            sessionId: session.id,
            accountCode,
            accountName: tbData.accountName,
            tbClosingDebit: tbData.closingDebit,
            tbClosingCredit: tbData.closingCredit,
            tbOpeningDebit: tbData.openingDebit,
            tbOpeningCredit: tbData.openingCredit,
            glTotalDebit: 0,
            glTotalCredit: 0,
            glTransactionCount: 0,
            differenceDebit: tbData.closingDebit,
            differenceCredit: tbData.closingCredit,
            matchStatus: "MISSING_IN_GL",
            matchConfidence: 0,
            matchMethod: null,
          });
        }
      } else {
        reconciliationItems.push({
          sessionId: session.id,
          accountCode,
          accountName: tbData.accountName,
          tbClosingDebit: tbData.closingDebit,
          tbClosingCredit: tbData.closingCredit,
          tbOpeningDebit: tbData.openingDebit,
          tbOpeningCredit: tbData.openingCredit,
          glTotalDebit: 0,
          glTotalCredit: 0,
          glTransactionCount: 0,
          differenceDebit: 0,
          differenceCredit: 0,
          matchStatus: "MATCHED",
          matchConfidence: 1,
          matchMethod: "TB_ONLY",
        });
        matchedCount++;
        totalMatchedValue += Math.abs(tbData.closingDebit - tbData.closingCredit);
      }
    }

    for (const [accountCode, glData] of glByAccountCode) {
      if (!processedGLCodes.has(accountCode)) {
        missingInTBCount++;
        reconciliationItems.push({
          sessionId: session.id,
          accountCode,
          accountName: glData.accountName,
          tbClosingDebit: 0,
          tbClosingCredit: 0,
          tbOpeningDebit: 0,
          tbOpeningCredit: 0,
          glTotalDebit: glData.debit,
          glTotalCredit: glData.credit,
          glTransactionCount: glData.count,
          differenceDebit: -glData.debit,
          differenceCredit: -glData.credit,
          matchStatus: "MISSING_IN_TB",
          matchConfidence: 0,
          matchMethod: null,
        });
      }
    }

    if (reconciliationItems.length > 0) {
      await prisma.reconciliationItem.createMany({
        data: reconciliationItems,
      });
    }

    const totalAccounts = tbByAccountCode.size + (missingInTBCount || 0);
    const mappingCoverage = totalAccounts > 0 ? (matchedCount / totalAccounts) * 100 : 0;
    const valueCoverage = totalTBValue > 0 ? (totalMatchedValue / totalTBValue) * 100 : 0;
    
    const reconciledDifference = Math.abs((tbTotalClosingDebit - tbTotalClosingCredit) - (glTotalDebit - glTotalCredit));
    const isReconciled = reconciledDifference <= (data.toleranceAmount || 0) || !data.glBatchId;
    const withinTolerance = reconciledDifference <= (data.toleranceAmount || 0);

    const updatedSession = await prisma.mappingSession.update({
      where: { id: session.id },
      data: {
        matchedCount,
        differenceCount,
        missingInGLCount,
        missingInTBCount,
        mappingCoverage,
        valueCoverage,
        isReconciled,
        reconciledDifference,
        withinTolerance,
        status: isReconciled ? "BALANCED" : "IN_PROGRESS",
      },
      include: {
        tbBatch: { select: { id: true, batchName: true } },
        glBatch: { select: { id: true, batchName: true } },
        reconciliationItems: true,
      },
    });

    await logAuditTrail(
      userId,
      "MAPPING_SESSION_CREATED",
      "MappingSession",
      session.id,
      null,
      { sessionId: session.id, matchedCount, differenceCount },
      data.engagementId,
      "TB↔GL mapping session created",
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json({
      success: true,
      session: updatedSession,
      summary: {
        matchedCount,
        differenceCount,
        missingInGLCount,
        missingInTBCount,
        mappingCoverage: mappingCoverage.toFixed(2),
        valueCoverage: valueCoverage.toFixed(2),
        isReconciled,
        reconciledDifference,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Create mapping session error:", error);
    res.status(500).json({ error: "Failed to create mapping session" });
  }
});

router.get("/session/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const session = await prisma.mappingSession.findFirst({
      where: { id: sessionId, firmId },
      include: {
        tbBatch: { 
          select: { 
            id: true, 
            batchName: true, 
            periodStart: true, 
            periodEnd: true,
            totalClosingDebit: true,
            totalClosingCredit: true,
          } 
        },
        glBatch: { 
          select: { 
            id: true, 
            batchName: true, 
            periodStart: true, 
            periodEnd: true,
            totalDebit: true,
            totalCredit: true,
          } 
        },
        reconciliationItems: {
          orderBy: { accountCode: 'asc' },
        },
        engagement: { 
          select: { 
            id: true, 
            engagementCode: true,
            client: { select: { id: true, name: true } },
          } 
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: "Mapping session not found" });
    }

    res.json(session);
  } catch (error) {
    console.error("Get mapping session error:", error);
    res.status(500).json({ error: "Failed to fetch mapping session" });
  }
});

router.get("/session/:id/reconciliation", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const session = await prisma.mappingSession.findFirst({
      where: { id: sessionId, firmId },
      include: {
        reconciliationItems: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: "Mapping session not found" });
    }

    const matched = session.reconciliationItems.filter(i => i.matchStatus === "MATCHED");
    const differences = session.reconciliationItems.filter(i => i.matchStatus === "DIFFERENCE");
    const missingInGL = session.reconciliationItems.filter(i => i.matchStatus === "MISSING_IN_GL");
    const missingInTB = session.reconciliationItems.filter(i => i.matchStatus === "MISSING_IN_TB");
    const manualMatches = session.reconciliationItems.filter(i => i.matchStatus === "MANUAL_MATCH");
    const excluded = session.reconciliationItems.filter(i => i.matchStatus === "EXCLUDED");

    const totalItems = session.reconciliationItems.length;
    
    res.json({
      sessionId: session.id,
      status: session.status,
      isReconciled: session.isReconciled,
      reconciledDifference: toNumber(session.reconciledDifference),
      withinTolerance: session.withinTolerance,
      toleranceAmount: toNumber(session.toleranceAmount),
      summary: {
        totalItems,
        matched: matched.length,
        differences: differences.length,
        missingInGL: missingInGL.length,
        missingInTB: missingInTB.length,
        manualMatches: manualMatches.length,
        excluded: excluded.length,
        mappingCoverage: toNumber(session.mappingCoverage),
        valueCoverage: toNumber(session.valueCoverage),
      },
      totals: {
        tbTotalClosingDebit: toNumber(session.tbTotalClosingDebit),
        tbTotalClosingCredit: toNumber(session.tbTotalClosingCredit),
        glTotalDebit: toNumber(session.glTotalDebit),
        glTotalCredit: toNumber(session.glTotalCredit),
      },
      breakdown: {
        matched,
        differences,
        missingInGL,
        missingInTB,
        manualMatches,
        excluded,
      },
    });
  } catch (error) {
    console.error("Get reconciliation breakdown error:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation breakdown" });
  }
});

const ManualMatchSchema = z.object({
  reconciliationItemId: z.string().uuid(),
  targetAccountCode: z.string().optional(),
  note: z.string().optional(),
  markAsMatched: z.boolean().default(true),
});

router.post("/session/:id/manual-match", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const data = ManualMatchSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const session = await prisma.mappingSession.findFirst({
      where: { id: sessionId, firmId },
    });

    if (!session) {
      return res.status(404).json({ error: "Mapping session not found" });
    }

    if (session.status === "LOCKED" || session.status === "APPROVED") {
      return res.status(400).json({ error: "Cannot modify locked or approved session" });
    }

    const item = await prisma.reconciliationItem.findFirst({
      where: { id: data.reconciliationItemId, sessionId },
    });

    if (!item) {
      return res.status(404).json({ error: "Reconciliation item not found" });
    }

    const updatedItem = await prisma.reconciliationItem.update({
      where: { id: data.reconciliationItemId },
      data: {
        matchStatus: data.markAsMatched ? "MANUAL_MATCH" : item.matchStatus,
        isManualMatch: true,
        manualMatchedById: userId,
        manualMatchedAt: new Date(),
        manualMatchNote: data.note,
      },
    });

    const allItems = await prisma.reconciliationItem.findMany({
      where: { sessionId },
    });

    const matchedCount = allItems.filter(i => 
      i.matchStatus === "MATCHED" || i.matchStatus === "MANUAL_MATCH"
    ).length;
    const differenceCount = allItems.filter(i => i.matchStatus === "DIFFERENCE").length;
    const missingInGLCount = allItems.filter(i => i.matchStatus === "MISSING_IN_GL").length;
    const missingInTBCount = allItems.filter(i => i.matchStatus === "MISSING_IN_TB").length;

    const isReconciled = differenceCount === 0 && missingInGLCount === 0 && missingInTBCount === 0;

    await prisma.mappingSession.update({
      where: { id: sessionId },
      data: {
        matchedCount,
        differenceCount,
        missingInGLCount,
        missingInTBCount,
        isReconciled,
        status: isReconciled ? "BALANCED" : session.status,
      },
    });

    await logAuditTrail(
      userId,
      "MANUAL_MATCH_APPLIED",
      "ReconciliationItem",
      data.reconciliationItemId,
      { matchStatus: item.matchStatus },
      { matchStatus: updatedItem.matchStatus },
      session.engagementId,
      data.note || "Manual match applied",
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      item: updatedItem,
      sessionStatus: isReconciled ? "BALANCED" : session.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Manual match error:", error);
    res.status(500).json({ error: "Failed to apply manual match" });
  }
});

router.post("/session/:id/approve", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const session = await prisma.mappingSession.findFirst({
      where: { id: sessionId, firmId },
    });

    if (!session) {
      return res.status(404).json({ error: "Mapping session not found" });
    }

    if (session.status === "LOCKED" || session.status === "APPROVED") {
      return res.status(400).json({ error: "Session is already approved or locked" });
    }

    if (!session.isReconciled && !session.partnerOverrideAllowed) {
      return res.status(400).json({ 
        error: "Cannot approve unreconciled session without partner override",
        requiresOverride: true,
      });
    }

    const updatedSession = await prisma.mappingSession.update({
      where: { id: sessionId },
      data: {
        status: "APPROVED",
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        tbBatch: { select: { id: true, batchName: true } },
        glBatch: { select: { id: true, batchName: true } },
      },
    });

    await logAuditTrail(
      userId,
      "MAPPING_SESSION_APPROVED",
      "MappingSession",
      sessionId,
      { status: session.status },
      { status: "APPROVED" },
      session.engagementId,
      "Mapping session approved by Partner",
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      session: updatedSession,
      message: "Mapping session approved successfully",
    });
  } catch (error) {
    console.error("Approve mapping session error:", error);
    res.status(500).json({ error: "Failed to approve mapping session" });
  }
});

const PartnerOverrideSchema = z.object({
  overrideNotes: z.string().min(10, "Override notes must be at least 10 characters"),
  acknowledgeDifferences: z.boolean().refine(val => val === true, {
    message: "Must acknowledge differences to proceed with override",
  }),
});

router.post("/session/:id/partner-override", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const data = PartnerOverrideSchema.parse(req.body);
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const session = await prisma.mappingSession.findFirst({
      where: { id: sessionId, firmId },
    });

    if (!session) {
      return res.status(404).json({ error: "Mapping session not found" });
    }

    if (session.status === "LOCKED" || session.status === "APPROVED") {
      return res.status(400).json({ error: "Cannot override locked or approved session" });
    }

    const updatedSession = await prisma.mappingSession.update({
      where: { id: sessionId },
      data: {
        partnerOverrideAllowed: true,
        partnerOverrideNotes: data.overrideNotes,
        partnerOverrideById: userId,
        partnerOverrideAt: new Date(),
        status: "DIFFERENCES_ACKNOWLEDGED",
      },
      include: {
        tbBatch: { select: { id: true, batchName: true } },
        glBatch: { select: { id: true, batchName: true } },
        reconciliationItems: true,
      },
    });

    await logAuditTrail(
      userId,
      "PARTNER_OVERRIDE_APPLIED",
      "MappingSession",
      sessionId,
      { status: session.status, partnerOverrideAllowed: session.partnerOverrideAllowed },
      { status: "DIFFERENCES_ACKNOWLEDGED", partnerOverrideAllowed: true },
      session.engagementId,
      `Partner override: ${data.overrideNotes}`,
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      session: updatedSession,
      message: "Partner override applied successfully. Session can now be approved.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Partner override error:", error);
    res.status(500).json({ error: "Failed to apply partner override" });
  }
});

router.get("/sessions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    const engagementId = req.query.engagementId as string;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const sessions = await prisma.mappingSession.findMany({
      where: {
        firmId,
        ...(engagementId && { engagementId }),
      },
      include: {
        tbBatch: { select: { id: true, batchName: true } },
        glBatch: { select: { id: true, batchName: true } },
        engagement: { 
          select: { 
            id: true, 
            engagementCode: true,
            client: { select: { name: true } },
          } 
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(sessions);
  } catch (error) {
    console.error("Get mapping sessions error:", error);
    res.status(500).json({ error: "Failed to fetch mapping sessions" });
  }
});

export default router;
