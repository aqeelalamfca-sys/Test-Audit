import { Router, Request, Response } from "express";
import { prisma } from "./db";

const router = Router();

async function getFirmIdForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firmId: true }
  });
  return user?.firmId || null;
}

router.get("/search", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { ntn, name } = req.query;
    
    if (!ntn && !name) {
      return res.status(400).json({ error: "NTN or name is required for search" });
    }

    const where: any = {};
    if (ntn) {
      where.ntn = { contains: ntn as string, mode: "insensitive" };
    }
    if (name) {
      where.OR = [
        { legalName: { contains: name as string, mode: "insensitive" } },
        { tradeName: { contains: name as string, mode: "insensitive" } }
      ];
    }

    const clients = await prisma.clientMaster.findMany({
      where,
      include: {
        owners: true,
        directors: true,
        contacts: true,
        _count: {
          select: { engagements: true }
        }
      },
      orderBy: { legalName: "asc" },
      take: 20
    });

    res.json(clients);
  } catch (error: any) {
    console.error("Error searching clients:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/check-ntn/:ntn", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { ntn } = req.params;
    
    const existingClient = await prisma.clientMaster.findUnique({
      where: { ntn },
      include: {
        _count: {
          select: { engagements: true }
        }
      }
    });

    if (existingClient) {
      res.json({ exists: true, client: existingClient });
    } else {
      res.json({ exists: false });
    }
  } catch (error: any) {
    console.error("Error checking NTN:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, search, page = "1", limit = "20" } = req.query;
    
    const where: any = {};
    if (status && status !== "all") {
      where.acceptanceStatus = status;
    }
    if (search) {
      where.OR = [
        { legalName: { contains: search as string, mode: "insensitive" } },
        { tradeName: { contains: search as string, mode: "insensitive" } },
        { ntn: { contains: search as string, mode: "insensitive" } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [clients, total] = await Promise.all([
      prisma.clientMaster.findMany({
        where,
        include: {
          owners: true,
          directors: true,
          contacts: true,
          acceptanceApprovedBy: {
            select: { id: true, fullName: true }
          },
          _count: {
            select: { 
              engagements: true,
              documents: true
            }
          }
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.clientMaster.count({ where })
    ]);

    res.json({
      clients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    
    const client = await prisma.clientMaster.findUnique({
      where: { id },
      include: {
        owners: true,
        directors: true,
        contacts: true,
        documents: true,
        threats: true,
        firmRelationships: {
          include: {
            firm: { select: { id: true, name: true } }
          }
        },
        acceptanceApprovedBy: {
          select: { id: true, fullName: true }
        },
        onboardingLockedBy: {
          select: { id: true, fullName: true }
        },
        createdBy: {
          select: { id: true, fullName: true }
        },
        engagements: {
          select: {
            id: true,
            engagementCode: true,
            engagementType: true,
            periodStart: true,
            periodEnd: true,
            status: true,
            currentPhase: true
          },
          orderBy: { periodEnd: "desc" }
        },
        changeLog: {
          orderBy: { changedAt: "desc" },
          take: 50
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(client);
  } catch (error: any) {
    console.error("Error fetching client:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { ntn, legalName, registeredAddress, ...rest } = req.body;

    if (!ntn || !legalName || !registeredAddress) {
      return res.status(400).json({ error: "NTN, legal name, and registered address are required" });
    }

    const existingClient = await prisma.clientMaster.findUnique({
      where: { ntn }
    });

    if (existingClient) {
      return res.status(409).json({ 
        error: "Client with this NTN already exists", 
        existingClient: {
          id: existingClient.id,
          legalName: existingClient.legalName,
          ntn: existingClient.ntn
        }
      });
    }

    const client = await prisma.clientMaster.create({
      data: {
        ntn,
        legalName,
        registeredAddress,
        createdById: user.id,
        ...rest
      },
      include: {
        owners: true,
        directors: true,
        contacts: true
      }
    });

    await prisma.clientChangeLog.create({
      data: {
        clientMasterId: client.id,
        fieldName: "CREATE",
        newValue: JSON.stringify({ ntn, legalName }),
        changedById: user.id,
        reason: "Initial client creation"
      }
    });

    res.status(201).json(client);
  } catch (error: any) {
    console.error("Error creating client:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id/step/:step", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, step } = req.params;
    const data = req.body;

    const client = await prisma.clientMaster.findUnique({
      where: { id }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (client.onboardingLocked) {
      return res.status(403).json({ error: "Client onboarding is locked" });
    }

    const stepOrder = ["BASIC_INFO", "OWNERSHIP_MANAGEMENT", "PRIOR_AUDITOR", "AML_SCREENING", "ETHICS_INDEPENDENCE", "REVIEW_SUBMIT"];
    const currentStepIndex = stepOrder.indexOf(client.onboardingStep);
    const requestedStepIndex = stepOrder.indexOf(step);

    if (requestedStepIndex > currentStepIndex + 1) {
      return res.status(400).json({ error: "Cannot skip steps. Complete previous steps first." });
    }

    let updateData: any = { ...data };
    
    if (step === "BASIC_INFO") {
      const { tradeName, strn, cnicPassport, secpRegNo, legalForm, dateOfIncorporation,
              registeredCity, registeredProvince, registeredCountry, businessAddress,
              phone, email, website, industry, principalActivities,
              isListed, isPIE, isSection42, isNPOTrust, regulators } = data;
      
      updateData = {
        tradeName, strn, cnicPassport, secpRegNo, legalForm, dateOfIncorporation,
        registeredCity, registeredProvince, registeredCountry, businessAddress,
        phone, email, website, industry, principalActivities,
        isListed, isPIE, isSection42, isNPOTrust, regulators,
        onboardingStep: requestedStepIndex >= currentStepIndex ? step : client.onboardingStep
      };
      
      if (data.legalName && data.legalName !== client.legalName) {
        await prisma.clientChangeLog.create({
          data: {
            clientMasterId: id,
            fieldName: "legalName",
            oldValue: client.legalName,
            newValue: data.legalName,
            changedById: user.id
          }
        });
        updateData.legalName = data.legalName;
      }
      
      if (data.registeredAddress && data.registeredAddress !== client.registeredAddress) {
        updateData.registeredAddress = data.registeredAddress;
      }
    }
    
    if (step === "OWNERSHIP_MANAGEMENT") {
      const { owners, directors, contacts, uboIdentified } = data;
      
      updateData = { 
        uboIdentified,
        onboardingStep: requestedStepIndex >= currentStepIndex ? step : client.onboardingStep
      };
      
      if (owners && Array.isArray(owners)) {
        await prisma.clientOwner.deleteMany({ where: { clientMasterId: id } });
        if (owners.length > 0) {
          await prisma.clientOwner.createMany({
            data: owners.map((o: any) => ({ ...o, clientMasterId: id }))
          });
        }
      }
      
      if (directors && Array.isArray(directors)) {
        await prisma.clientDirector.deleteMany({ where: { clientMasterId: id } });
        if (directors.length > 0) {
          await prisma.clientDirector.createMany({
            data: directors.map((d: any) => ({ ...d, clientMasterId: id }))
          });
        }
      }
      
      if (contacts && Array.isArray(contacts)) {
        await prisma.clientContact.deleteMany({ where: { clientMasterId: id } });
        if (contacts.length > 0) {
          await prisma.clientContact.createMany({
            data: contacts.map((c: any) => ({ ...c, clientMasterId: id }))
          });
        }
      }
    }
    
    if (step === "PRIOR_AUDITOR") {
      const { priorAuditorName, priorAuditorFirm, priorAuditorReason,
              clearanceLetterSent, clearanceLetterDate, clearanceResponseReceived,
              clearanceResponseDate, clearanceRedFlags, clearanceRedFlagDetails } = data;
      
      updateData = {
        priorAuditorName, priorAuditorFirm, priorAuditorReason,
        clearanceLetterSent, clearanceLetterDate, clearanceResponseReceived,
        clearanceResponseDate, clearanceRedFlags, clearanceRedFlagDetails,
        onboardingStep: requestedStepIndex >= currentStepIndex ? step : client.onboardingStep
      };
    }
    
    if (step === "AML_SCREENING") {
      const { screeningPerformed, screeningTool, screeningDate, screeningResult,
              screeningRiskRating, screeningRationale, eddRequired, amlRiskRating } = data;
      
      updateData = {
        screeningPerformed, screeningTool, screeningDate, screeningResult,
        screeningRiskRating, screeningRationale, eddRequired, amlRiskRating,
        onboardingStep: requestedStepIndex >= currentStepIndex ? step : client.onboardingStep
      };
    }
    
    if (step === "ETHICS_INDEPENDENCE") {
      const { threats, firmRelationships, ethicsRiskRating } = data;
      
      updateData = {
        ethicsRiskRating,
        onboardingStep: requestedStepIndex >= currentStepIndex ? step : client.onboardingStep
      };
      
      if (threats && Array.isArray(threats)) {
        await prisma.clientThreat.deleteMany({ where: { clientMasterId: id } });
        if (threats.length > 0) {
          await prisma.clientThreat.createMany({
            data: threats.map((t: any) => ({ ...t, clientMasterId: id }))
          });
        }
      }
      
      if (firmRelationships && Array.isArray(firmRelationships)) {
        await prisma.clientFirmRelationship.deleteMany({ where: { clientMasterId: id } });
        if (firmRelationships.length > 0) {
          await prisma.clientFirmRelationship.createMany({
            data: firmRelationships.map((r: any) => ({ ...r, clientMasterId: id }))
          });
        }
      }
    }

    const updatedClient = await prisma.clientMaster.update({
      where: { id },
      data: updateData,
      include: {
        owners: true,
        directors: true,
        contacts: true,
        threats: true,
        firmRelationships: true
      }
    });

    res.json(updatedClient);
  } catch (error: any) {
    console.error("Error updating client step:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/completion-status", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    
    const client = await prisma.clientMaster.findUnique({
      where: { id },
      include: {
        owners: true,
        directors: true,
        contacts: true,
        documents: true,
        threats: true,
        firmRelationships: true
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const missingFields: string[] = [];
    const completedSteps: string[] = [];
    
    if (client.legalName && client.ntn && client.registeredAddress && client.industry) {
      completedSteps.push("BASIC_INFO");
    } else {
      if (!client.legalName) missingFields.push("Legal Name");
      if (!client.ntn) missingFields.push("NTN");
      if (!client.registeredAddress) missingFields.push("Registered Address");
      if (!client.industry) missingFields.push("Industry");
    }
    
    if (client.owners.length > 0 && client.directors.length > 0) {
      completedSteps.push("OWNERSHIP_MANAGEMENT");
    } else {
      if (client.owners.length === 0) missingFields.push("At least one owner/shareholder");
      if (client.directors.length === 0) missingFields.push("At least one director");
    }
    
    completedSteps.push("PRIOR_AUDITOR");
    
    if (client.screeningPerformed) {
      completedSteps.push("AML_SCREENING");
    } else {
      missingFields.push("AML/Sanctions screening");
    }
    
    if (client.threats.length > 0 || client.ethicsRiskRating) {
      completedSteps.push("ETHICS_INDEPENDENCE");
    }
    
    const totalFields = 10;
    const completedFields = totalFields - missingFields.length;
    const completionPercentage = Math.round((completedFields / totalFields) * 100);

    const requiredDocuments = [
      { type: "NTN_CERTIFICATE", label: "NTN Certificate" },
      { type: "INCORPORATION_CERTIFICATE", label: "Incorporation Certificate" }
    ];

    const uploadedDocTypes = client.documents.map(d => d.documentType);
    const missingDocuments = requiredDocuments.filter((d: { type: string; label: string }) => !uploadedDocTypes.includes(d.type));

    res.json({
      completionPercentage,
      completedSteps,
      missingFields,
      missingDocuments: missingDocuments.map(d => d.label),
      isReadyForSubmission: missingFields.length === 0 && missingDocuments.length === 0,
      currentStep: client.onboardingStep,
      isLocked: client.onboardingLocked
    });
  } catch (error: any) {
    console.error("Error getting completion status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/submit", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { decision, rationale, eqcrRequired, eqcrRationale, conditionNotes } = req.body;

    if (!decision || !rationale) {
      return res.status(400).json({ error: "Decision and rationale are required" });
    }

    if (!["ACCEPTED", "CONDITIONALLY_ACCEPTED", "DECLINED"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision. Must be ACCEPTED, CONDITIONALLY_ACCEPTED, or DECLINED" });
    }

    const client = await prisma.clientMaster.findUnique({
      where: { id }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (client.onboardingLocked) {
      return res.status(403).json({ error: "Client onboarding is already locked" });
    }

    const userDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true }
    });

    if (userDetails?.role !== "PARTNER" && userDetails?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only Partners or Admins can approve client acceptance" });
    }

    const updatedClient = await prisma.clientMaster.update({
      where: { id },
      data: {
        acceptanceStatus: decision,
        acceptanceApprovedById: user.id,
        acceptanceApprovedDate: new Date(),
        conditionNotes: decision === "CONDITIONALLY_ACCEPTED" ? conditionNotes : null,
        eqcrRequired: eqcrRequired || false,
        eqcrRationale,
        onboardingStep: "REVIEW_SUBMIT",
        onboardingLocked: decision === "ACCEPTED" || decision === "CONDITIONALLY_ACCEPTED",
        onboardingLockedById: decision === "ACCEPTED" || decision === "CONDITIONALLY_ACCEPTED" ? user.id : null,
        onboardingLockedDate: decision === "ACCEPTED" || decision === "CONDITIONALLY_ACCEPTED" ? new Date() : null
      },
      include: {
        acceptanceApprovedBy: {
          select: { id: true, fullName: true }
        }
      }
    });

    await prisma.clientChangeLog.create({
      data: {
        clientMasterId: id,
        fieldName: "acceptanceStatus",
        oldValue: client.acceptanceStatus,
        newValue: decision,
        changedById: user.id,
        reason: rationale
      }
    });

    res.json({
      client: updatedClient,
      message: `Client ${decision === "DECLINED" ? "declined" : "accepted"}. ${decision !== "DECLINED" ? "You can now create engagements for this client." : ""}`
    });
  } catch (error: any) {
    console.error("Error submitting client acceptance:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:clientId/engagements", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { clientId } = req.params;
    const { engagementType, periodStart, periodEnd, reportingFramework, applicableLaw,
            engagementPartnerId, isComponentAudit, isGroupAudit, overrideReason } = req.body;

    const client = await prisma.clientMaster.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (client.acceptanceStatus !== "ACCEPTED" && client.acceptanceStatus !== "CONDITIONALLY_ACCEPTED") {
      return res.status(403).json({ error: "Cannot create engagement. Client onboarding must be completed and accepted first." });
    }

    const firmId = await getFirmIdForUser(user.id);
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const existingEngagement = await prisma.engagement.findFirst({
      where: {
        clientMasterId: clientId,
        engagementType,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined
      }
    });

    if (existingEngagement && !overrideReason) {
      return res.status(409).json({ 
        error: "Duplicate engagement exists for same period and type",
        existingEngagement: {
          id: existingEngagement.id,
          engagementCode: existingEngagement.engagementCode,
          periodEnd: existingEngagement.periodEnd
        },
        requiresOverride: true
      });
    }

    const userDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true }
    });

    if (existingEngagement && overrideReason) {
      if (userDetails?.role !== "PARTNER" && userDetails?.role !== "ADMIN") {
        return res.status(403).json({ error: "Only Partners can override duplicate engagement creation" });
      }
    }

    const engagementCount = await prisma.engagement.count();
    const engagementCode = `ENG-${new Date().getFullYear()}-${String(engagementCount + 1).padStart(6, "0")}`;

    let legacyClient = await prisma.client.findFirst({
      where: { 
        firmId,
        ntn: client.ntn
      }
    });

    if (!legacyClient) {
      legacyClient = await prisma.client.create({
        data: {
          firmId,
          name: client.legalName,
          tradingName: client.tradeName,
          ntn: client.ntn,
          strn: client.strn,
          secpNo: client.secpRegNo,
          entityType: client.legalForm,
          industry: client.industry,
          address: client.registeredAddress,
          phone: client.phone,
          email: client.email,
          website: client.website,
          acceptanceStatus: "APPROVED",
          acceptanceDate: new Date(),
          acceptanceApprovedById: user.id
        }
      });
    }

    const engagement = await prisma.engagement.create({
      data: {
        firmId,
        clientId: legacyClient.id,
        clientMasterId: clientId,
        engagementCode,
        engagementType: engagementType || "statutory_audit",
        reportingFramework,
        applicableLaw,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        engagementPartnerId,
        isComponentAudit: isComponentAudit || false,
        isGroupAudit: isGroupAudit || false,
        duplicateOverrideReason: existingEngagement ? overrideReason : null,
        duplicateOverrideById: existingEngagement ? user.id : null,
        duplicateOverrideDate: existingEngagement ? new Date() : null,
        eqcrRequired: client.eqcrRequired,
        eqcrRationale: client.eqcrRationale
      },
      include: {
        clientMaster: {
          select: { id: true, legalName: true, ntn: true }
        }
      }
    });

    res.status(201).json(engagement);
  } catch (error: any) {
    console.error("Error creating engagement:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/documents", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { documentType, fileName, filePath, fileSize, mimeType, description } = req.body;

    const client = await prisma.clientMaster.findUnique({
      where: { id }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const document = await prisma.clientMasterDocument.create({
      data: {
        clientMasterId: id,
        documentType,
        fileName,
        filePath,
        fileSize,
        mimeType,
        description,
        uploadedById: user.id
      }
    });

    res.status(201).json(document);
  } catch (error: any) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/documents", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const documents = await prisma.clientMasterDocument.findMany({
      where: { clientMasterId: id },
      orderBy: { uploadedAt: "desc" }
    });

    res.json(documents);
  } catch (error: any) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id/documents/:documentId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, documentId } = req.params;

    await prisma.clientMasterDocument.delete({
      where: { 
        id: documentId,
        clientMasterId: id
      }
    });

    res.json({ message: "Document deleted" });
  } catch (error: any) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/unlock", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const userDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true }
    });

    if (userDetails?.role !== "PARTNER" && userDetails?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only Partners or Admins can unlock client onboarding" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Reason is required to unlock onboarding" });
    }

    const client = await prisma.clientMaster.update({
      where: { id },
      data: {
        onboardingLocked: false,
        onboardingLockedById: null,
        onboardingLockedDate: null
      }
    });

    await prisma.clientChangeLog.create({
      data: {
        clientMasterId: id,
        fieldName: "onboardingLocked",
        oldValue: "true",
        newValue: "false",
        changedById: user.id,
        reason
      }
    });

    res.json({ client, message: "Client onboarding unlocked" });
  } catch (error: any) {
    console.error("Error unlocking client:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats/summary", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [total, draft, underReview, accepted, conditionallyAccepted, declined] = await Promise.all([
      prisma.clientMaster.count(),
      prisma.clientMaster.count({ where: { acceptanceStatus: "DRAFT" } }),
      prisma.clientMaster.count({ where: { acceptanceStatus: "UNDER_REVIEW" } }),
      prisma.clientMaster.count({ where: { acceptanceStatus: "ACCEPTED" } }),
      prisma.clientMaster.count({ where: { acceptanceStatus: "CONDITIONALLY_ACCEPTED" } }),
      prisma.clientMaster.count({ where: { acceptanceStatus: "DECLINED" } })
    ]);

    res.json({
      total,
      byStatus: {
        draft,
        underReview,
        accepted,
        conditionallyAccepted,
        declined
      },
      activeClients: accepted + conditionallyAccepted
    });
  } catch (error: any) {
    console.error("Error fetching client stats:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
