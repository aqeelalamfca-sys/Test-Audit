import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireRoles, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { z } from "zod";

const router = Router();

const generatePDFSchema = z.object({
  engagementId: z.string().uuid(),
  withAttachments: z.boolean(),
  partnerPIN: z.string().optional(),
});

router.get("/history/:engagementId", requireAuth, requireRoles("ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const history = await prisma.pDFGenerationLog.findMany({
      where: { engagementId },
      include: {
        generatedBy: {
          select: {
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: { generatedAt: "desc" },
    });

    res.json(history);
  } catch (error) {
    console.error("Error fetching PDF generation history:", error);
    res.status(500).json({ error: "Failed to fetch generation history" });
  }
});

router.post("/generate", requireAuth, requireRoles("ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = generatePDFSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const { engagementId, withAttachments, partnerPIN } = validation.data;
    const user = req.user!;

    if (user.role === "PARTNER" && !partnerPIN) {
      return res.status(400).json({ error: "Partner PIN is required for authorization" });
    }

    if (user.role === "PARTNER" && partnerPIN) {
      const userWithPin = await prisma.user.findUnique({
        where: { id: user.id },
        select: { partnerPin: true },
      });

      if (!userWithPin?.partnerPin || userWithPin.partnerPin !== partnerPIN) {
        await logAuditTrail(
          user.id,
          "PDF_GENERATION_FAILED",
          "PDFGenerationLog",
          engagementId,
          null,
          { reason: "Invalid Partner PIN", engagementId }
        );
        return res.status(403).json({ error: "Invalid Partner PIN" });
      }
    }

    const engagement = await prisma.engagement.findFirst({
      where: { 
        id: engagementId,
        firmId: user.firmId!,
      },
      include: {
        client: true,
        firm: true,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const latestVersion = await prisma.pDFGenerationLog.findFirst({
      where: { engagementId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const newVersion = (latestVersion?.version || 0) + 1;

    const clientName = engagement.client?.name?.replace(/[^a-zA-Z0-9]/g, "") || "Client";
    const fiscalYear = engagement.fiscalYearEnd 
      ? `FY${new Date(engagement.fiscalYearEnd).getFullYear()}`
      : "FYUnknown";
    const attachmentSuffix = withAttachments ? "WithAttachments" : "WithoutAttachments";
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    
    const fileName = `${clientName}_${fiscalYear}_FullAuditFile_${attachmentSuffix}_${dateStr}.pdf`;

    const log = await prisma.pDFGenerationLog.create({
      data: {
        engagementId,
        clientName: engagement.client?.name || "Unknown Client",
        auditPeriod: fiscalYear,
        pdfType: withAttachments ? "WITH_ATTACHMENTS" : "WITHOUT_ATTACHMENTS",
        generatedById: user.id,
        storageReference: fileName,
        version: newVersion,
      },
      include: {
        generatedBy: {
          select: {
            fullName: true,
            role: true,
          },
        },
      },
    });

    await logAuditTrail(
      user.id,
      "PDF_GENERATED",
      "PDFGenerationLog",
      log.id,
      null,
      {
        engagementId,
        clientName: engagement.client?.name,
        auditPeriod: fiscalYear,
        pdfType: withAttachments ? "WITH_ATTACHMENTS" : "WITHOUT_ATTACHMENTS",
        version: newVersion,
        fileName,
      }
    );

    res.json({
      success: true,
      logId: log.id,
      fileName,
      version: newVersion,
      message: "PDF generated successfully",
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

export default router;
