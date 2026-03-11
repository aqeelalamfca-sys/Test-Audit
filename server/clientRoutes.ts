import { Router, type Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, requireRoles, logAuditTrail, type AuthenticatedRequest, hashPassword } from "./auth";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withTenantContext } from "./middleware/tenantDbContext";

const router = Router();

const createClientSchema = z.object({
  name: z.string().min(1, "Legal name is required"),
  tradingName: z.string().optional(),
  secpNo: z.string().optional(),
  ntn: z.string().optional().or(z.literal("")),
  strn: z.string().optional(),
  entityType: z.string().min(1, "Entity type is required for ISA 210 compliance"),
  industry: z.string().min(1, "Industry is required for risk assessment"),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().optional(),
  dateOfIncorporation: z.string().optional(),
  regulatoryCategory: z.string().optional(),
  sizeClassification: z.string().optional(),
  specialEntityType: z.string().optional(),
  taxProfile: z.string().optional(),
  lifecycleStatus: z.string().optional(),
  ownershipStructure: z.string().optional(),
  ultimateBeneficialOwners: z.array(z.object({
    name: z.string().min(1, "UBO name is required"),
    nationality: z.string().optional(),
    ownershipPercentage: z.number().min(0).max(100).optional(),
    isPEP: z.boolean().default(false),
  })).optional().default([]),
  parentCompany: z.string().optional(),
  subsidiaries: z.array(z.string()).optional().default([]),
  focalPersonName: z.string().optional().or(z.literal("")),
  focalPersonMobile: z.string().optional().or(z.literal("")),
  focalPersonEmail: z.string().optional().or(z.literal("")),
  ceoName: z.string().optional(),
  ceoContact: z.string().optional(),
  cfoName: z.string().optional(),
  cfoContact: z.string().optional(),
  boardMembers: z.array(z.object({
    name: z.string().min(1, "Board member name is required"),
    designation: z.string().optional(),
    independentDirector: z.boolean().default(false),
  })).optional().default([]),
  priorAuditorName: z.string().optional(),
  priorAuditorContact: z.string().optional(),
  auditorChangeReason: z.string().optional(),
  priorAuditOpinion: z.string().optional(),
  portalContact: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    designation: z.string().optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }).optional(),
});

const screeningSchema = z.object({
  amlScreeningResult: z.string().optional(),
  amlRiskScore: z.number().min(0).max(100).optional(),
  sanctionsScreeningResult: z.string().optional(),
  pepCheckDone: z.boolean().optional(),
  pepCheckResult: z.string().optional(),
});

function calculateRiskScore(client: any): { score: number; category: "LOW" | "NORMAL" | "HIGH" | "PROHIBITED"; factors: string[] } {
  let score = 0;
  const factors: string[] = [];

  if (client.industry) {
    const highRiskIndustries = ["gambling", "crypto", "money services", "arms", "defense"];
    const mediumRiskIndustries = ["real estate", "construction", "jewelry", "art"];
    
    if (highRiskIndustries.some(i => client.industry.toLowerCase().includes(i))) {
      score += 30;
      factors.push("High-risk industry");
    } else if (mediumRiskIndustries.some(i => client.industry.toLowerCase().includes(i))) {
      score += 15;
      factors.push("Medium-risk industry");
    }
  }

  if (client.ownershipStructure) {
    if (client.ownershipStructure.toLowerCase().includes("complex") || 
        client.ownershipStructure.toLowerCase().includes("offshore")) {
      score += 25;
      factors.push("Complex ownership structure");
    }
  }

  if (client.ultimateBeneficialOwners) {
    const ubos = client.ultimateBeneficialOwners as any[];
    if (ubos.some(ubo => ubo.isPEP)) {
      score += 20;
      factors.push("PEP involvement");
    }
  }

  if (client.auditorChangeReason) {
    const concerningReasons = ["disagreement", "dispute", "fees", "opinion"];
    if (concerningReasons.some(r => client.auditorChangeReason.toLowerCase().includes(r))) {
      score += 15;
      factors.push("Concerning auditor change reason");
    }
  }

  if (client.priorAuditOpinion) {
    if (client.priorAuditOpinion.toLowerCase().includes("qualified") ||
        client.priorAuditOpinion.toLowerCase().includes("adverse") ||
        client.priorAuditOpinion.toLowerCase().includes("disclaimer")) {
      score += 20;
      factors.push("Modified prior audit opinion");
    }
  }

  if (client.amlRiskScore && client.amlRiskScore > 50) {
    score += 25;
    factors.push("High AML risk score");
  }

  let category: "LOW" | "NORMAL" | "HIGH" | "PROHIBITED";
  if (score >= 80) {
    category = "PROHIBITED";
  } else if (score >= 50) {
    category = "HIGH";
  } else if (score >= 25) {
    category = "NORMAL";
  } else {
    category = "LOW";
  }

  return { score, category, factors };
}

router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const clients = await withTenantContext(firmId, (tx) =>
      tx.client.findMany({
        where: { firmId },
        include: {
          acceptanceApprovedBy: { select: { id: true, fullName: true } },
          _count: { select: { engagements: true } },
        },
        orderBy: { name: "asc" },
      })
    );

    res.json(clients);
  } catch (error) {
    console.error("Get clients error:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.get("/check-duplicate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const { name, secpNo, ntn } = req.query;

    const orConditions: Prisma.ClientWhereInput[] = [];
    if (name) orConditions.push({ name: { contains: name as string, mode: "insensitive" as const } });
    if (secpNo) orConditions.push({ secpNo: secpNo as string });
    if (ntn) orConditions.push({ ntn: ntn as string });

    const duplicates = await withTenantContext(firmId, (tx) =>
      tx.client.findMany({
        where: {
          firmId,
          ...(orConditions.length > 0 ? { OR: orConditions } : {}),
        },
        select: {
          id: true,
          name: true,
          secpNo: true,
          ntn: true,
          acceptanceStatus: true,
        },
      })
    );

    res.json({
      hasDuplicates: duplicates.length > 0,
      duplicates,
    });
  } catch (error) {
    console.error("Check duplicate error:", error);
    res.status(500).json({ error: "Failed to check duplicates" });
  }
});

router.get("/authorized", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const clients = await withTenantContext(firmId, (tx) =>
      tx.client.findMany({
        where: {
          firmId,
          engagements: {
            some: {
              team: { some: { userId: req.user!.id } }
            }
          }
        },
        select: { id: true, name: true, tradingName: true, ntn: true }
      })
    );

    res.json(clients);
  } catch (error) {
    console.error("Authorized clients error:", error);
    res.status(500).json({ error: "Failed to fetch authorized clients" });
  }
});

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const client = await withTenantContext(firmId, (tx) =>
      tx.client.findUnique({
        where: { id: req.params.id },
        include: {
          acceptanceApprovedBy: { select: { id: true, fullName: true, role: true } },
          engagements: {
            include: {
              phases: true,
              _count: { select: { reviewNotes: { where: { status: "OPEN" } } } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      })
    );

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (client.firmId !== firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(client);
  } catch (error) {
    console.error("Get client error:", error);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

router.post("/", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const data = createClientSchema.parse(req.body);
    const { portalContact, ...clientData } = data;

    const result = await withTenantContext(firmId, async (tx) => {
      const existingDuplicates = await tx.client.findMany({
        where: {
          firmId,
          OR: [
            data.secpNo ? { secpNo: data.secpNo } : {},
            data.ntn ? { ntn: data.ntn } : {},
          ].filter(o => Object.keys(o).length > 0),
        },
      });

      if (existingDuplicates.length > 0) {
        return { error: true, status: 400, body: {
          error: "Potential duplicate client detected",
          duplicates: existingDuplicates.map(d => ({ id: d.id, name: d.name })),
        }};
      }

      const riskAssessment = calculateRiskScore(clientData);

      const year = new Date().getFullYear();
      const prefix = `CLT-${year}-`;
      const lastClient = await tx.client.findFirst({
        where: { firmId, clientCode: { startsWith: prefix } },
        orderBy: { clientCode: "desc" },
        select: { clientCode: true },
      });
      let nextSeq = 1;
      if (lastClient?.clientCode) {
        const lastSeq = parseInt(lastClient.clientCode.replace(prefix, ""), 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }
      const clientCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;

      const client = await tx.client.create({
        data: {
          firmId,
          clientCode,
          ...clientData,
          dateOfIncorporation: clientData.dateOfIncorporation ? new Date(clientData.dateOfIncorporation) : null,
          email: clientData.email || null,
          subsidiaries: clientData.subsidiaries || [],
          riskScore: riskAssessment.score,
          riskCategory: riskAssessment.category,
          riskFactors: riskAssessment.factors,
        },
      });

      let portalContactCreated = null;
      if (portalContact) {
        const existingContact = await tx.clientPortalContact.findFirst({
          where: { email: portalContact.email, firmId }
        });

        if (existingContact) {
          await tx.client.delete({ where: { id: client.id } });
          return { error: true, status: 400, body: { 
            error: `A portal contact with email ${portalContact.email} already exists`
          }};
        }

        const passwordHash = await hashPassword(portalContact.password);
        portalContactCreated = await tx.clientPortalContact.create({
          data: {
            firmId,
            clientId: client.id,
            firstName: portalContact.firstName,
            lastName: portalContact.lastName,
            email: portalContact.email,
            designation: portalContact.designation || null,
            portalPasswordHash: passwordHash,
            portalAccessEnabled: true,
            isPrimaryContact: true,
          }
        });
      }

      return { error: false, client, portalContactCreated };
    });

    if ('error' in result && result.error === true) {
      return res.status((result as any).status).json((result as any).body);
    }

    const { client, portalContactCreated } = result as { error: false; client: any; portalContactCreated: any };

    if (portalContactCreated) {
      await logAuditTrail(
        req.user!.id,
        "PORTAL_CONTACT_CREATED",
        "portal_contact",
        portalContactCreated.id,
        null,
        { email: portalContactCreated.email, clientId: client.id },
        undefined,
        "Portal contact created with client",
        req.ip,
        req.get("user-agent")
      );
    }

    await logAuditTrail(
      req.user!.id,
      "CLIENT_CREATED",
      "client",
      client.id,
      null,
      { name: client.name, riskCategory: client.riskCategory, hasPortalAccess: !!portalContact },
      undefined,
      "New client onboarding initiated",
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json({ 
      ...client, 
      portalContact: portalContactCreated ? { 
        id: portalContactCreated.id, 
        email: portalContactCreated.email 
      } : null 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Create client error:", error);
    res.status(500).json({ error: "Failed to create client" });
  }
});

router.patch("/:id", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const existing = await withTenantContext(firmId, (tx) =>
      tx.client.findUnique({ where: { id: req.params.id } })
    );

    if (!existing) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (existing.firmId !== firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (existing.acceptanceStatus === "APPROVED") {
      const allowedFields = ["phone", "email", "address", "ceoContact", "cfoContact"];
      const updateKeys = Object.keys(req.body);
      const hasRestrictedFields = updateKeys.some(k => !allowedFields.includes(k));
      
      if (hasRestrictedFields && req.user!.role !== "PARTNER" && req.user!.role !== "FIRM_ADMIN") {
        return res.status(403).json({ error: "Cannot modify approved client without Partner approval" });
      }
    }

    const parsedData = createClientSchema.partial().parse(req.body);
    const { portalContact, ...clientData } = parsedData;
    
    const riskAssessment = calculateRiskScore({ ...existing, ...clientData });

    const txResult = await withTenantContext(firmId, async (tx) => {
      const client = await tx.client.update({
        where: { id: req.params.id },
        data: {
          ...clientData,
          dateOfIncorporation: clientData.dateOfIncorporation ? new Date(clientData.dateOfIncorporation) : undefined,
          riskScore: riskAssessment.score,
          riskCategory: riskAssessment.category,
          riskFactors: riskAssessment.factors,
        },
      });

      let portalContactResult = null;
      if (portalContact) {
        const existingContact = await tx.clientPortalContact.findFirst({
          where: { email: portalContact.email, firmId }
        });

        if (existingContact && existingContact.clientId !== client.id) {
          return { error: true, status: 400, body: { 
            error: `A portal contact with email ${portalContact.email} already exists for another client`
          }};
        }

        if (existingContact && existingContact.clientId === client.id) {
          portalContactResult = await tx.clientPortalContact.update({
            where: { id: existingContact.id },
            data: {
              firstName: portalContact.firstName,
              lastName: portalContact.lastName,
              designation: portalContact.designation || null,
              ...(portalContact.password && { portalPasswordHash: await hashPassword(portalContact.password) }),
            }
          });
        } else {
          const passwordHash = await hashPassword(portalContact.password);
          portalContactResult = await tx.clientPortalContact.create({
            data: {
              firmId,
              clientId: client.id,
              firstName: portalContact.firstName,
              lastName: portalContact.lastName,
              email: portalContact.email,
              designation: portalContact.designation || null,
              portalPasswordHash: passwordHash,
              portalAccessEnabled: true,
              isPrimaryContact: true,
            }
          });
        }
      }

      return { error: false, client, portalContactResult };
    });

    if ('error' in txResult && txResult.error === true) {
      return res.status((txResult as any).status).json((txResult as any).body);
    }

    const { client, portalContactResult } = txResult as { error: false; client: any; portalContactResult: any };

    await logAuditTrail(
      req.user!.id,
      "CLIENT_UPDATED",
      "client",
      client.id,
      existing,
      client,
      undefined,
      req.body.justification || "Client information updated",
      req.ip,
      req.get("user-agent")
    );

    res.json({
      ...client,
      portalContact: portalContactResult ? {
        id: portalContactResult.id,
        email: portalContactResult.email
      } : null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Update client error:", error);
    res.status(500).json({ error: "Failed to update client" });
  }
});

router.post("/:id/screening", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await withTenantContext(firmId, (tx) =>
      tx.client.findUnique({ where: { id: req.params.id } })
    );

    if (!existing || existing.firmId !== firmId) {
      return res.status(404).json({ error: "Client not found" });
    }

    const data = screeningSchema.parse(req.body);

    const now = new Date();
    const updateData: any = { ...data };
    
    if (data.amlScreeningResult) {
      updateData.amlScreeningDate = now;
    }
    if (data.sanctionsScreeningResult) {
      updateData.sanctionsScreeningDate = now;
    }

    const riskAssessment = calculateRiskScore({ ...existing, ...updateData });

    const client = await withTenantContext(firmId, (tx) =>
      tx.client.update({
        where: { id: req.params.id },
        data: {
          ...updateData,
          riskScore: riskAssessment.score,
          riskCategory: riskAssessment.category,
          riskFactors: riskAssessment.factors,
        },
      })
    );

    await logAuditTrail(
      req.user!.id,
      "CLIENT_SCREENING_UPDATED",
      "client",
      client.id,
      { amlScreeningResult: existing.amlScreeningResult, sanctionsScreeningResult: existing.sanctionsScreeningResult },
      { amlScreeningResult: client.amlScreeningResult, sanctionsScreeningResult: client.sanctionsScreeningResult },
      undefined,
      "AML/Sanctions screening completed",
      req.ip,
      req.get("user-agent")
    );

    res.json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Update screening error:", error);
    res.status(500).json({ error: "Failed to update screening" });
  }
});

router.post("/:id/approve", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await withTenantContext(firmId, (tx) =>
      tx.client.findUnique({ where: { id: req.params.id } })
    );

    if (!existing || existing.firmId !== firmId) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (existing.acceptanceStatus === "APPROVED") {
      return res.status(400).json({ error: "Client already approved" });
    }

    if (existing.riskCategory === "PROHIBITED") {
      return res.status(400).json({ error: "Cannot approve client with PROHIBITED risk category" });
    }

    if (!existing.amlScreeningDate || !existing.sanctionsScreeningDate) {
      return res.status(400).json({ error: "AML and Sanctions screening must be completed before approval" });
    }

    const acceptanceMemo = generateAcceptanceMemo(existing, req.user!);

    const client = await withTenantContext(firmId, (tx) =>
      tx.client.update({
        where: { id: req.params.id },
        data: {
          acceptanceStatus: "APPROVED",
          acceptanceDate: new Date(),
          acceptanceApprovedById: req.user!.id,
          acceptanceMemo,
        },
      })
    );

    await logAuditTrail(
      req.user!.id,
      "CLIENT_ACCEPTANCE_APPROVED",
      "client",
      client.id,
      { acceptanceStatus: existing.acceptanceStatus },
      { acceptanceStatus: client.acceptanceStatus, approvedBy: req.user!.fullName },
      undefined,
      req.body.justification || "Client acceptance approved by Partner",
      req.ip,
      req.get("user-agent")
    );

    res.json(client);
  } catch (error) {
    console.error("Approve client error:", error);
    res.status(500).json({ error: "Failed to approve client" });
  }
});

router.post("/:id/reject", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await withTenantContext(firmId, (tx) =>
      tx.client.findUnique({ where: { id: req.params.id } })
    );

    if (!existing || existing.firmId !== firmId) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (existing.acceptanceStatus === "APPROVED") {
      return res.status(400).json({ error: "Cannot reject an already approved client" });
    }

    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const client = await withTenantContext(firmId, (tx) =>
      tx.client.update({
        where: { id: req.params.id },
        data: {
          acceptanceStatus: "REJECTED",
          acceptanceDate: new Date(),
          acceptanceApprovedById: req.user!.id,
          acceptanceMemo: `REJECTED: ${reason}`,
          isActive: false,
        },
      })
    );

    await logAuditTrail(
      req.user!.id,
      "CLIENT_ACCEPTANCE_REJECTED",
      "client",
      client.id,
      { acceptanceStatus: existing.acceptanceStatus },
      { acceptanceStatus: client.acceptanceStatus, rejectedBy: req.user!.fullName, reason },
      undefined,
      reason,
      req.ip,
      req.get("user-agent")
    );

    res.json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Reject client error:", error);
    res.status(500).json({ error: "Failed to reject client" });
  }
});

router.get("/:id/acceptance-memo", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const client = await withTenantContext(firmId, (tx) =>
      tx.client.findUnique({
        where: { id: req.params.id },
        include: {
          acceptanceApprovedBy: { select: { fullName: true, role: true } },
          firm: true,
        },
      })
    );

    if (!client || client.firmId !== firmId) {
      return res.status(404).json({ error: "Client not found" });
    }

    const memo = client.acceptanceMemo || generateAcceptanceMemo(client, req.user!);

    res.json({ memo, client });
  } catch (error) {
    console.error("Get acceptance memo error:", error);
    res.status(500).json({ error: "Failed to generate acceptance memo" });
  }
});

function generateAcceptanceMemo(client: any, approver: any): string {
  const now = new Date();
  const memo = `
CLIENT ACCEPTANCE MEMORANDUM
============================

Date: ${now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}

CLIENT INFORMATION
------------------
Legal Name: ${client.name}
Trading Name: ${client.tradingName || "N/A"}
SECP Registration No: ${client.secpNo || "N/A"}
NTN: ${client.ntn || "N/A"}
STRN: ${client.strn || "N/A"}
Entity Type: ${client.entityType || "N/A"}
Industry: ${client.industry || "N/A"}

MANAGEMENT
----------
CEO: ${client.ceoName || "N/A"}
CFO: ${client.cfoName || "N/A"}

PRIOR AUDITOR
-------------
Name: ${client.priorAuditorName || "N/A"}
Reason for Change: ${client.auditorChangeReason || "N/A"}
Prior Audit Opinion: ${client.priorAuditOpinion || "N/A"}

RISK ASSESSMENT
---------------
Risk Category: ${client.riskCategory}
Risk Score: ${client.riskScore || 0}/100
Risk Factors: ${(client.riskFactors as string[])?.join(", ") || "None identified"}

SCREENING RESULTS
-----------------
AML Screening Date: ${client.amlScreeningDate ? new Date(client.amlScreeningDate).toLocaleDateString() : "Not completed"}
AML Screening Result: ${client.amlScreeningResult || "Pending"}
AML Risk Score: ${client.amlRiskScore || "N/A"}

Sanctions Screening Date: ${client.sanctionsScreeningDate ? new Date(client.sanctionsScreeningDate).toLocaleDateString() : "Not completed"}
Sanctions Screening Result: ${client.sanctionsScreeningResult || "Pending"}

PEP Check: ${client.pepCheckDone ? "Completed" : "Pending"}
PEP Check Result: ${client.pepCheckResult || "N/A"}

CONCLUSION
----------
Based on the above assessment, the client ${client.riskCategory === "PROHIBITED" ? "DOES NOT MEET" : "meets"} our firm's client acceptance criteria.

${client.riskCategory === "HIGH" ? "NOTE: This is a HIGH-RISK client and requires enhanced due diligence procedures." : ""}

APPROVAL
--------
Approved By: ${approver.fullName}
Role: ${approver.role}
Date: ${now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}

This memorandum is prepared in compliance with:
- ISA 220 (Quality Management for an Audit of Financial Statements)
- ISQM 1 (Quality Management for Firms)
- IESBA Code of Ethics
- Companies Act 2017 (Pakistan)
`.trim();

  return memo;
}

async function backfillClientCodes() {
  try {
    const clients = await prisma.client.findMany({
      where: { clientCode: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, firmId: true },
    });
    if (clients.length === 0) return;
    const year = new Date().getFullYear();
    const firmCounts: Record<string, number> = {};
    for (const client of clients) {
      const existing = await prisma.client.count({
        where: { firmId: client.firmId, clientCode: { not: null } },
      });
      firmCounts[client.firmId] = (firmCounts[client.firmId] ?? existing) + 1;
      const seq = String(firmCounts[client.firmId]).padStart(4, "0");
      await prisma.client.update({
        where: { id: client.id },
        data: { clientCode: `CLT-${year}-${seq}` },
      });
    }
    console.log(`[ClientRoutes] Backfilled ${clients.length} client codes`);
  } catch (e) {
    console.error("[ClientRoutes] Client code backfill error:", e);
  }
}
backfillClientCodes();

export default router;
