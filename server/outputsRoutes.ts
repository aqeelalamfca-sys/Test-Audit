import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { generatePhase2Outputs, generatePhase3Outputs, generatePhase4Outputs, generatePhase5Outputs } from "./services/outputGenerator";

const router = Router();

const createOutputSchema = z.object({
  outputCode: z.string().min(1),
  outputName: z.string().min(1),
  phase: z.enum(["ONBOARDING", "PRE_PLANNING", "PLANNING", "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"]),
  triggerButton: z.string().optional().nullable(),
  sourceSheets: z.array(z.string()).default([]),
  fsHeadId: z.string().optional().nullable(),
  isaTag: z.string().optional().nullable(),
  templateFile: z.string().optional().nullable(),
  outputFormat: z.string().min(1),
  status: z.string().default("Draft"),
  filePath: z.string().optional().nullable(),
  fileSize: z.number().optional().nullable(),
});

const updateOutputSchema = z.object({
  outputName: z.string().optional(),
  triggerButton: z.string().optional().nullable(),
  sourceSheets: z.array(z.string()).optional(),
  fsHeadId: z.string().optional().nullable(),
  isaTag: z.string().optional().nullable(),
  templateFile: z.string().optional().nullable(),
  outputFormat: z.string().optional(),
  status: z.string().optional(),
  filePath: z.string().optional().nullable(),
  fileSize: z.number().optional().nullable(),
  preparedById: z.string().optional().nullable(),
  reviewedById: z.string().optional().nullable(),
  approvedById: z.string().optional().nullable(),
});

router.get("/engagements/:engagementId/outputs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, fsHeadId, status } = req.query;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const where: any = { engagementId };
    if (phase) where.phase = phase as string;
    if (fsHeadId) where.fsHeadId = fsHeadId as string;
    if (status) where.status = status as string;

    const outputs = await prisma.outputsRegistry.findMany({
      where,
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ phase: "asc" }, { outputCode: "asc" }],
    });

    res.json(outputs);
  } catch (error) {
    console.error("Error fetching outputs:", error);
    res.status(500).json({ error: "Failed to fetch outputs" });
  }
});

router.post("/engagements/:engagementId/outputs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const validation = createOutputSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }

    const data = validation.data;

    const existingOutput = await prisma.outputsRegistry.findFirst({
      where: {
        engagementId,
        outputCode: data.outputCode,
      },
      orderBy: { version: "desc" },
    });

    const version = existingOutput ? existingOutput.version + 1 : 1;

    const output = await prisma.outputsRegistry.create({
      data: {
        engagementId,
        outputCode: data.outputCode,
        outputName: data.outputName,
        phase: data.phase,
        triggerButton: data.triggerButton,
        sourceSheets: data.sourceSheets,
        fsHeadId: data.fsHeadId,
        isaTag: data.isaTag,
        templateFile: data.templateFile,
        outputFormat: data.outputFormat,
        status: data.status,
        filePath: data.filePath,
        fileSize: data.fileSize,
        version,
        preparedById: req.user!.id,
        preparedAt: new Date(),
      },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });

    logAuditTrail(req.user!.id, "OUTPUT_CREATED", "outputs_registry", output.id, null, { outputCode: data.outputCode, version }, engagementId, `Created output ${data.outputCode} v${version}`).catch(err => console.error("Audit trail error:", err));

    res.status(201).json(output);
  } catch (error) {
    console.error("Error creating output:", error);
    res.status(500).json({ error: "Failed to create output" });
  }
});

router.get("/engagements/:engagementId/outputs/:outputId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, outputId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const output = await prisma.outputsRegistry.findFirst({
      where: { id: outputId, engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });

    if (!output) {
      return res.status(404).json({ error: "Output not found" });
    }

    res.json(output);
  } catch (error) {
    console.error("Error fetching output:", error);
    res.status(500).json({ error: "Failed to fetch output" });
  }
});

router.patch("/engagements/:engagementId/outputs/:outputId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, outputId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingOutput = await prisma.outputsRegistry.findFirst({
      where: { id: outputId, engagementId },
    });

    if (!existingOutput) {
      return res.status(404).json({ error: "Output not found" });
    }

    const validation = updateOutputSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }

    const data = validation.data;
    const updateData: any = { ...data };

    if (data.status === "Reviewed" && !existingOutput.reviewedById) {
      updateData.reviewedById = req.user!.id;
      updateData.reviewedAt = new Date();
    }

    if (data.status === "Approved" && !existingOutput.approvedById) {
      updateData.approvedById = req.user!.id;
      updateData.approvedAt = new Date();
    }

    const output = await prisma.outputsRegistry.update({
      where: { id: outputId },
      data: updateData,
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });

    logAuditTrail(req.user!.id, "OUTPUT_UPDATED", "outputs_registry", outputId, null, data, engagementId, `Updated output ${output.outputCode}`).catch(err => console.error("Audit trail error:", err));

    res.json(output);
  } catch (error) {
    console.error("Error updating output:", error);
    res.status(500).json({ error: "Failed to update output" });
  }
});

router.delete("/engagements/:engagementId/outputs/:outputId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, outputId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const output = await prisma.outputsRegistry.findFirst({
      where: { id: outputId, engagementId },
    });

    if (!output) {
      return res.status(404).json({ error: "Output not found" });
    }

    if (output.status === "Final" || output.status === "Approved") {
      return res.status(400).json({ error: "Cannot delete finalized or approved outputs" });
    }

    await prisma.outputsRegistry.delete({
      where: { id: outputId },
    });

    logAuditTrail(req.user!.id, "OUTPUT_DELETED", "outputs_registry", outputId, null, { outputCode: output.outputCode }, engagementId, `Deleted output ${output.outputCode}`).catch(err => console.error("Audit trail error:", err));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting output:", error);
    res.status(500).json({ error: "Failed to delete output" });
  }
});

router.get("/engagements/:engagementId/outputs/:outputId/download", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, outputId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const output = await prisma.outputsRegistry.findFirst({
      where: { id: outputId, engagementId },
    });

    if (!output) {
      return res.status(404).json({ error: "Output not found" });
    }

    if (!output.filePath) {
      return res.status(404).json({ error: "No file associated with this output" });
    }

    const filePath = path.resolve(output.filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    const filename = `${output.outputCode}-v${output.version}.${output.outputFormat.toLowerCase()}`;
    
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error("Error downloading output:", error);
    res.status(500).json({ error: "Failed to download output" });
  }
});

router.post("/engagements/:engagementId/outputs/generate-phase2", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const result = await generatePhase2Outputs(engagementId, req.user!.id);

    logAuditTrail(
      req.user!.id, "PHASE2_OUTPUTS_GENERATED", "outputs_registry", undefined,
      null, { outputsCreated: result.outputsCreated, outputsSkipped: result.outputsSkipped }, engagementId,
      `Generated ${result.outputsCreated} Pre-Planning outputs, skipped ${result.outputsSkipped}`
    ).catch(err => console.error("Audit trail error:", err));

    res.json({
      success: result.success,
      message: `Created ${result.outputsCreated} outputs, skipped ${result.outputsSkipped} existing outputs`,
      outputsCreated: result.outputsCreated,
      outputsSkipped: result.outputsSkipped,
      details: result.details,
    });
  } catch (error) {
    console.error("Error generating Phase 2 outputs:", error);
    res.status(500).json({ error: "Failed to generate Pre-Planning outputs" });
  }
});

router.post("/engagements/:engagementId/outputs/generate-phase3", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { tabId } = req.body;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const result = await generatePhase3Outputs(engagementId, tabId || null, req.user!.id);

    const tabLabel = tabId ? ` for tab "${tabId}"` : "";
    logAuditTrail(
      req.user!.id, "PHASE3_OUTPUTS_GENERATED", "outputs_registry", undefined,
      null, { outputsCreated: result.outputsCreated, outputsSkipped: result.outputsSkipped, tabId }, engagementId,
      `Generated ${result.outputsCreated} Planning outputs${tabLabel}, skipped ${result.outputsSkipped}`
    ).catch(err => console.error("Audit trail error:", err));

    res.json({
      success: result.success,
      message: `Created ${result.outputsCreated} outputs, skipped ${result.outputsSkipped} existing outputs`,
      outputsCreated: result.outputsCreated,
      outputsSkipped: result.outputsSkipped,
      details: result.details,
    });
  } catch (error) {
    console.error("Error generating Phase 3 outputs:", error);
    res.status(500).json({ error: "Failed to generate Planning outputs" });
  }
});

router.post("/engagements/:engagementId/outputs/generate-phase4", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { fsHeadTab } = req.body;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const result = await generatePhase4Outputs(engagementId, fsHeadTab || undefined, req.user!.id);

    const tabLabel = fsHeadTab ? ` for FS Head "${fsHeadTab}"` : "";
    logAuditTrail(
      req.user!.id, "PHASE4_OUTPUTS_GENERATED", "outputs_registry", undefined,
      null, { outputsCreated: result.outputsCreated, outputsSkipped: result.outputsSkipped, fsHeadTab }, engagementId,
      `Generated ${result.outputsCreated} Execution Working Paper outputs${tabLabel}, skipped ${result.outputsSkipped}`
    ).catch(err => console.error("Audit trail error:", err));

    res.json({
      success: result.success,
      message: `Created ${result.outputsCreated} Working Paper outputs, skipped ${result.outputsSkipped} existing outputs`,
      outputsCreated: result.outputsCreated,
      outputsSkipped: result.outputsSkipped,
      details: result.details,
    });
  } catch (error) {
    console.error("Error generating Phase 4 outputs:", error);
    res.status(500).json({ error: "Failed to generate Execution Working Paper outputs" });
  }
});

router.post("/engagements/:engagementId/outputs/generate-phase5", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const result = await generatePhase5Outputs(engagementId, req.user!.id);

    logAuditTrail(
      req.user!.id, "PHASE5_OUTPUTS_GENERATED", "outputs_registry", undefined,
      null, { outputsCreated: result.outputsCreated, outputsSkipped: result.outputsSkipped }, engagementId,
      `Generated ${result.outputsCreated} Finalization outputs, skipped ${result.outputsSkipped}`
    ).catch(err => console.error("Audit trail error:", err));

    res.json({
      success: result.success,
      message: `Created ${result.outputsCreated} Finalization outputs, skipped ${result.outputsSkipped} existing outputs`,
      outputsCreated: result.outputsCreated,
      outputsSkipped: result.outputsSkipped,
      details: result.details,
    });
  } catch (error) {
    console.error("Error generating Phase 5 outputs:", error);
    res.status(500).json({ error: "Failed to generate Finalization outputs" });
  }
});

router.post("/engagements/:engagementId/outputs/:outputId/link-evidence", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, outputId } = req.params;
    const { evidenceId, linkType, notes } = req.body;

    if (!evidenceId) {
      return res.status(400).json({ error: "evidenceId is required" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const output = await prisma.outputsRegistry.findFirst({
      where: { id: outputId, engagementId },
    });

    if (!output) {
      return res.status(404).json({ error: "Output not found" });
    }

    const evidence = await prisma.evidenceFile.findFirst({
      where: { id: evidenceId, engagementId },
    });

    if (!evidence) {
      return res.status(404).json({ error: "Evidence file not found" });
    }

    const existingLink = await prisma.outputEvidence.findFirst({
      where: { outputId, evidenceId },
    });

    if (existingLink) {
      return res.status(400).json({ error: "Link already exists" });
    }

    const link = await prisma.outputEvidence.create({
      data: {
        outputId,
        evidenceId,
        linkedById: req.user!.id,
        linkType: linkType || null,
        notes: notes || null,
      },
      include: {
        evidence: { select: { id: true, fileName: true, fileReference: true, fileType: true } },
        linkedBy: { select: { id: true, fullName: true } },
      },
    });

    logAuditTrail(req.user!.id, "OUTPUT_EVIDENCE_LINKED", "output_evidence", link.id, null, { outputCode: output.outputCode, evidenceFile: evidence.fileName }, engagementId, `Linked output ${output.outputCode} to evidence ${evidence.fileName}`).catch(err => console.error("Audit trail error:", err));

    res.status(201).json(link);
  } catch (error) {
    console.error("Error linking evidence:", error);
    res.status(500).json({ error: "Failed to link evidence" });
  }
});

router.delete("/engagements/:engagementId/outputs/:outputId/unlink-evidence/:evidenceId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, outputId, evidenceId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const output = await prisma.outputsRegistry.findFirst({
      where: { id: outputId, engagementId },
    });

    if (!output) {
      return res.status(404).json({ error: "Output not found in this engagement" });
    }

    const evidence = await prisma.evidenceFile.findFirst({
      where: { id: evidenceId, engagementId },
    });

    if (!evidence) {
      return res.status(404).json({ error: "Evidence not found in this engagement" });
    }

    const link = await prisma.outputEvidence.findFirst({
      where: { outputId, evidenceId },
    });

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    await prisma.outputEvidence.delete({
      where: { id: link.id },
    });

    logAuditTrail(req.user!.id, "OUTPUT_EVIDENCE_UNLINKED", "output_evidence", undefined, null, { outputId, evidenceId }, engagementId, `Unlinked output ${outputId} from evidence ${evidenceId}`).catch(err => console.error("Audit trail error:", err));

    res.json({ success: true });
  } catch (error) {
    console.error("Error unlinking evidence:", error);
    res.status(500).json({ error: "Failed to unlink evidence" });
  }
});

router.get("/engagements/:engagementId/outputs/:outputId/linked-evidence", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, outputId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const output = await prisma.outputsRegistry.findFirst({
      where: { id: outputId, engagementId },
    });

    if (!output) {
      return res.status(404).json({ error: "Output not found" });
    }

    const links = await prisma.outputEvidence.findMany({
      where: { outputId },
      include: {
        evidence: { 
          select: { 
            id: true, 
            fileName: true, 
            fileReference: true, 
            fileType: true, 
            phase: true,
            description: true,
            fileSize: true,
            uploadedDate: true,
          } 
        },
        linkedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { linkedAt: "desc" },
    });

    res.json(links);
  } catch (error) {
    console.error("Error fetching linked evidence:", error);
    res.status(500).json({ error: "Failed to fetch linked evidence" });
  }
});

router.get("/engagements/:engagementId/evidence/:evidenceId/linked-outputs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, evidenceId } = req.params;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const evidence = await prisma.evidenceFile.findFirst({
      where: { id: evidenceId, engagementId },
    });

    if (!evidence) {
      return res.status(404).json({ error: "Evidence file not found" });
    }

    const links = await prisma.outputEvidence.findMany({
      where: { evidenceId },
      include: {
        output: { 
          select: { 
            id: true, 
            outputCode: true, 
            outputName: true, 
            phase: true,
            status: true,
            isDeliverable: true,
            deliveryStatus: true,
          } 
        },
        linkedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { linkedAt: "desc" },
    });

    res.json(links);
  } catch (error) {
    console.error("Error fetching linked outputs:", error);
    res.status(500).json({ error: "Failed to fetch linked outputs" });
  }
});

router.get("/engagements/:engagementId/deliverables", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { status } = req.query;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const where: any = { engagementId, isDeliverable: true };
    if (status) where.deliveryStatus = status as string;

    const deliverables = await prisma.outputsRegistry.findMany({
      where,
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        evidenceLinks: {
          include: {
            evidence: { select: { id: true, fileName: true, fileReference: true } },
          },
        },
      },
      orderBy: [{ deliveryDate: "asc" }, { outputCode: "asc" }],
    });

    res.json(deliverables);
  } catch (error) {
    console.error("Error fetching deliverables:", error);
    res.status(500).json({ error: "Failed to fetch deliverables" });
  }
});

router.patch("/engagements/:engagementId/outputs/:outputId/deliverable-status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, outputId } = req.params;
    const { isDeliverable, deliveryStatus, deliveryDate } = req.body;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId: req.user!.firmId! },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const output = await prisma.outputsRegistry.findFirst({
      where: { id: outputId, engagementId },
    });

    if (!output) {
      return res.status(404).json({ error: "Output not found" });
    }

    const updateData: any = {};
    if (isDeliverable !== undefined) updateData.isDeliverable = isDeliverable;
    if (deliveryStatus !== undefined) updateData.deliveryStatus = deliveryStatus;
    if (deliveryDate !== undefined) updateData.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;

    const updated = await prisma.outputsRegistry.update({
      where: { id: outputId },
      data: updateData,
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });

    logAuditTrail(req.user!.id, "OUTPUT_DELIVERABLE_STATUS", "outputs_registry", outputId, null, { isDeliverable, deliveryStatus, deliveryDate }, engagementId, `Updated deliverable status for ${output.outputCode}`).catch(err => console.error("Audit trail error:", err));

    res.json(updated);
  } catch (error) {
    console.error("Error updating deliverable status:", error);
    res.status(500).json({ error: "Failed to update deliverable status" });
  }
});

export default router;
