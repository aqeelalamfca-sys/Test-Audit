import { prisma } from "../db";
import type { UserRole } from "@prisma/client";

type PrePlanningGateType = 
  | "CLIENT_ACCEPTANCE"
  | "CLIENT_CONTINUANCE"
  | "INDEPENDENCE_CONFIRMATION"
  | "ETHICS_COMPLIANCE"
  | "ENGAGEMENT_LETTER"
  | "TEAM_ALLOCATION"
  | "PARTNER_SIGNOFF"
  | "MANAGER_REVIEW";

type PrePlanningGateStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "PENDING_SIGNOFF"
  | "COMPLETED"
  | "BLOCKED";

interface GateDefinition {
  gateType: PrePlanningGateType;
  description: string;
  isaReference: string;
  isRequired: boolean;
  isBlocking: boolean;
  requiredRoleForSignOff: UserRole[];
}

const GATE_DEFINITIONS: GateDefinition[] = [
  {
    gateType: "CLIENT_ACCEPTANCE",
    description: "Client acceptance procedures including integrity assessment and risk evaluation",
    isaReference: "ISA 220, ISQM 1",
    isRequired: true,
    isBlocking: true,
    requiredRoleForSignOff: ["PARTNER", "MANAGING_PARTNER", "ADMIN"]
  },
  {
    gateType: "CLIENT_CONTINUANCE",
    description: "Continuance assessment for existing client relationships",
    isaReference: "ISA 220, ISQM 1",
    isRequired: false,
    isBlocking: true,
    requiredRoleForSignOff: ["PARTNER", "MANAGING_PARTNER", "ADMIN"]
  },
  {
    gateType: "INDEPENDENCE_CONFIRMATION",
    description: "Independence declarations from all team members",
    isaReference: "ISA 200, IESBA Code",
    isRequired: true,
    isBlocking: true,
    requiredRoleForSignOff: ["MANAGER", "PARTNER", "MANAGING_PARTNER", "ADMIN"]
  },
  {
    gateType: "ETHICS_COMPLIANCE",
    description: "Ethical requirements and conflict of interest assessment",
    isaReference: "ISA 200, IESBA Code",
    isRequired: true,
    isBlocking: true,
    requiredRoleForSignOff: ["MANAGER", "PARTNER", "MANAGING_PARTNER", "ADMIN"]
  },
  {
    gateType: "ENGAGEMENT_LETTER",
    description: "Engagement letter prepared, reviewed, and signed by client",
    isaReference: "ISA 210",
    isRequired: true,
    isBlocking: true,
    requiredRoleForSignOff: ["PARTNER", "MANAGING_PARTNER", "ADMIN"]
  },
  {
    gateType: "TEAM_ALLOCATION",
    description: "Audit team allocated with appropriate competencies",
    isaReference: "ISA 220, ISA 300",
    isRequired: true,
    isBlocking: true,
    requiredRoleForSignOff: ["MANAGER", "PARTNER", "MANAGING_PARTNER", "ADMIN"]
  },
  {
    gateType: "MANAGER_REVIEW",
    description: "Manager review of all pre-planning documentation",
    isaReference: "ISA 220, ISA 230",
    isRequired: true,
    isBlocking: true,
    requiredRoleForSignOff: ["MANAGER", "PARTNER", "MANAGING_PARTNER", "ADMIN"]
  },
  {
    gateType: "PARTNER_SIGNOFF",
    description: "Partner sign-off to proceed to Planning phase",
    isaReference: "ISA 220, ISA 230",
    isRequired: true,
    isBlocking: true,
    requiredRoleForSignOff: ["PARTNER", "MANAGING_PARTNER", "ADMIN"]
  }
];

interface AcceptanceChecklistSection {
  section: string;
  items: {
    title: string;
    description?: string;
    isaReference?: string;
    isRequired: boolean;
  }[];
}

const ACCEPTANCE_CHECKLIST: AcceptanceChecklistSection[] = [
  {
    section: "Client Integrity",
    items: [
      { title: "Management integrity assessment completed", isaReference: "ISA 220", isRequired: true },
      { title: "Background checks on key management personnel", isaReference: "ISQM 1", isRequired: true },
      { title: "Prior auditor communication (if applicable)", isaReference: "ISA 300", isRequired: false },
      { title: "Assessment of litigation/regulatory matters", isaReference: "ISA 220", isRequired: true }
    ]
  },
  {
    section: "Risk Assessment",
    items: [
      { title: "Engagement risk level determined", isaReference: "ISA 315", isRequired: true },
      { title: "Money laundering risk assessment", isaReference: "AML Regulations", isRequired: true },
      { title: "Sanctions screening completed", isaReference: "OFAC/UN", isRequired: true },
      { title: "PEP (Politically Exposed Persons) check", isaReference: "AML Regulations", isRequired: true }
    ]
  },
  {
    section: "Competence & Resources",
    items: [
      { title: "Firm has necessary competence for engagement", isaReference: "ISA 220", isRequired: true },
      { title: "Sufficient time and resources available", isaReference: "ISA 220", isRequired: true },
      { title: "Industry expertise available", isaReference: "ISA 220", isRequired: true },
      { title: "IT audit capabilities confirmed (if required)", isaReference: "ISA 315", isRequired: false }
    ]
  }
];

const INDEPENDENCE_CHECKLIST: AcceptanceChecklistSection[] = [
  {
    section: "Financial Interests",
    items: [
      { title: "No direct financial interests in client", isaReference: "IESBA 510", isRequired: true },
      { title: "No indirect material financial interests", isaReference: "IESBA 510", isRequired: true },
      { title: "No loans to/from client or management", isaReference: "IESBA 511", isRequired: true }
    ]
  },
  {
    section: "Business Relationships",
    items: [
      { title: "No business relationships with client", isaReference: "IESBA 520", isRequired: true },
      { title: "No close business relationships with management", isaReference: "IESBA 520", isRequired: true }
    ]
  },
  {
    section: "Family & Personal",
    items: [
      { title: "No family relationships with key management", isaReference: "IESBA 521", isRequired: true },
      { title: "No immediate family at client in key positions", isaReference: "IESBA 521", isRequired: true }
    ]
  },
  {
    section: "Non-Audit Services",
    items: [
      { title: "Non-audit services reviewed for threats", isaReference: "IESBA 600", isRequired: true },
      { title: "Management responsibilities not assumed", isaReference: "IESBA 600", isRequired: true },
      { title: "Safeguards in place for permitted services", isaReference: "IESBA 600", isRequired: false }
    ]
  }
];

const ETHICS_CHECKLIST: AcceptanceChecklistSection[] = [
  {
    section: "Fundamental Principles",
    items: [
      { title: "Integrity - No compromise on professional standards", isaReference: "IESBA 110", isRequired: true },
      { title: "Objectivity - No bias, conflicts of interest", isaReference: "IESBA 120", isRequired: true },
      { title: "Professional Competence - Adequate knowledge maintained", isaReference: "IESBA 130", isRequired: true },
      { title: "Confidentiality - Client information protected", isaReference: "IESBA 140", isRequired: true },
      { title: "Professional Behavior - Compliance with laws/regulations", isaReference: "IESBA 150", isRequired: true }
    ]
  }
];

class PrePlanningService {
  async initializeGates(engagementId: string, isNewClient: boolean): Promise<void> {
    const existingGates = await (prisma as any).prePlanningGate.findMany({
      where: { engagementId }
    });

    if (existingGates.length > 0) {
      return;
    }

    const gatesToCreate = GATE_DEFINITIONS.filter(gate => {
      if (gate.gateType === "CLIENT_CONTINUANCE" && isNewClient) return false;
      if (gate.gateType === "CLIENT_ACCEPTANCE" && !isNewClient) return false;
      return true;
    });

    for (const gate of gatesToCreate) {
      const createdGate = await (prisma as any).prePlanningGate.create({
        data: {
          engagementId,
          gateType: gate.gateType,
          status: "NOT_STARTED",
          isRequired: gate.isRequired,
          isBlocking: gate.isBlocking,
          isaReference: gate.isaReference,
          description: gate.description
        }
      });

      let checklistItems: AcceptanceChecklistSection[] = [];
      if (gate.gateType === "CLIENT_ACCEPTANCE" || gate.gateType === "CLIENT_CONTINUANCE") {
        checklistItems = ACCEPTANCE_CHECKLIST;
      } else if (gate.gateType === "INDEPENDENCE_CONFIRMATION") {
        checklistItems = INDEPENDENCE_CHECKLIST;
      } else if (gate.gateType === "ETHICS_COMPLIANCE") {
        checklistItems = ETHICS_CHECKLIST;
      }

      let orderIndex = 0;
      for (const section of checklistItems) {
        for (const item of section.items) {
          await (prisma as any).prePlanningChecklistItem.create({
            data: {
              gateId: createdGate.id,
              engagementId,
              section: section.section,
              title: item.title,
              description: item.description,
              isaReference: item.isaReference,
              isRequired: item.isRequired,
              orderIndex: orderIndex++
            }
          });
        }
      }
    }
  }

  async getPrePlanningStatus(engagementId: string): Promise<{
    isComplete: boolean;
    completionPercentage: number;
    gates: any[];
    blockedReasons: { gate: string; reason: string; isaReference?: string }[];
    pendingSignOffs: { gate: string; requiredRole: string; isaReference?: string }[];
  }> {
    const gates = await (prisma as any).prePlanningGate.findMany({
      where: { engagementId },
      include: {
        checklistItems: true,
        signOffs: {
          include: { signedOffBy: { select: { id: true, fullName: true, role: true } } }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (gates.length === 0) {
      return {
        isComplete: false,
        completionPercentage: 0,
        gates: [],
        blockedReasons: [{ gate: "INITIALIZATION", reason: "Pre-planning gates not initialized", isaReference: "ISA 220" }],
        pendingSignOffs: []
      };
    }

    const blockedReasons: { gate: string; reason: string; isaReference?: string }[] = [];
    const pendingSignOffs: { gate: string; requiredRole: string; isaReference?: string }[] = [];
    let completedGates = 0;
    let totalRequiredGates = 0;

    for (const gate of gates) {
      if (gate.isRequired) {
        totalRequiredGates++;
        if (gate.status === "COMPLETED") {
          completedGates++;
        } else if (gate.isBlocking) {
          blockedReasons.push({
            gate: gate.gateType,
            reason: gate.status === "BLOCKED" 
              ? gate.blockedReason || "Gate is blocked"
              : `${gate.gateType.replace(/_/g, " ")} not completed`,
            isaReference: gate.isaReference
          });
        }

        if (gate.status === "PENDING_SIGNOFF") {
          const definition = GATE_DEFINITIONS.find(d => d.gateType === gate.gateType);
          pendingSignOffs.push({
            gate: gate.gateType,
            requiredRole: definition?.requiredRoleForSignOff[0] || "PARTNER",
            isaReference: gate.isaReference
          });
        }
      }
    }

    const completionPercentage = totalRequiredGates > 0 
      ? Math.round((completedGates / totalRequiredGates) * 100)
      : 0;

    return {
      isComplete: completedGates === totalRequiredGates && totalRequiredGates > 0,
      completionPercentage,
      gates,
      blockedReasons,
      pendingSignOffs
    };
  }

  async canProceedToPlanning(engagementId: string): Promise<{
    allowed: boolean;
    reason?: string;
    blockers: { gate: string; reason: string; isaReference?: string }[];
  }> {
    const status = await this.getPrePlanningStatus(engagementId);

    if (!status.isComplete) {
      return {
        allowed: false,
        reason: "Pre-planning phase not complete",
        blockers: status.blockedReasons
      };
    }

    const partnerSignOffGate = status.gates.find(
      (g: any) => g.gateType === "PARTNER_SIGNOFF"
    );

    if (!partnerSignOffGate || partnerSignOffGate.status !== "COMPLETED") {
      return {
        allowed: false,
        reason: "Partner sign-off required before proceeding to Planning",
        blockers: [{
          gate: "PARTNER_SIGNOFF",
          reason: "Partner must sign off on pre-planning completion",
          isaReference: "ISA 220, ISA 230"
        }]
      };
    }

    return {
      allowed: true,
      blockers: []
    };
  }

  async updateChecklistItem(
    itemId: string,
    userId: string,
    data: {
      isCompleted?: boolean;
      isNotApplicable?: boolean;
      notApplicableReason?: string;
      response?: string;
      notes?: string;
      documentIds?: string[];
    }
  ): Promise<any> {
    const item = await (prisma as any).prePlanningChecklistItem.findUnique({
      where: { id: itemId },
      include: { gate: true }
    });

    if (!item) {
      throw new Error("Checklist item not found");
    }

    const updated = await (prisma as any).prePlanningChecklistItem.update({
      where: { id: itemId },
      data: {
        ...data,
        completedAt: data.isCompleted ? new Date() : null,
        completedById: data.isCompleted ? userId : null
      }
    });

    await this.recalculateGateCompletion(item.gateId);

    return updated;
  }

  async recalculateGateCompletion(gateId: string): Promise<void> {
    const gate = await (prisma as any).prePlanningGate.findUnique({
      where: { id: gateId },
      include: { checklistItems: true }
    });

    if (!gate) return;

    const totalItems = gate.checklistItems.filter((item: any) => item.isRequired && !item.isNotApplicable).length;
    const completedItems = gate.checklistItems.filter((item: any) => 
      (item.isCompleted || item.isNotApplicable) && item.isRequired
    ).length;

    const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 100;

    let status: PrePlanningGateStatus = gate.status;
    if (completionPercentage === 0) {
      status = "NOT_STARTED";
    } else if (completionPercentage < 100) {
      status = "IN_PROGRESS";
    } else if (completionPercentage === 100 && gate.status !== "COMPLETED") {
      status = "PENDING_SIGNOFF";
    }

    await (prisma as any).prePlanningGate.update({
      where: { id: gateId },
      data: {
        completionPercentage,
        status
      }
    });
  }

  async signOffGate(
    gateId: string,
    userId: string,
    userRole: UserRole,
    options: {
      comments?: string;
      partnerPinUsed?: boolean;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<any> {
    const gate = await (prisma as any).prePlanningGate.findUnique({
      where: { id: gateId }
    });

    if (!gate) {
      throw new Error("Gate not found");
    }

    const definition = GATE_DEFINITIONS.find(d => d.gateType === gate.gateType);
    if (definition && !definition.requiredRoleForSignOff.includes(userRole)) {
      throw new Error(`Role ${userRole} not authorized to sign off on ${gate.gateType}`);
    }

    if (gate.completionPercentage < 100 && gate.status !== "PENDING_SIGNOFF") {
      throw new Error("Gate checklist items not complete");
    }

    const signOff = await (prisma as any).prePlanningSignOff.create({
      data: {
        gateId,
        engagementId: gate.engagementId,
        signOffType: "GATE_COMPLETION",
        signOffCategory: gate.gateType,
        signedOffById: userId,
        signedOffRole: userRole,
        comments: options.comments,
        partnerPinUsed: options.partnerPinUsed || false,
        isaReference: gate.isaReference,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      }
    });

    await (prisma as any).prePlanningGate.update({
      where: { id: gateId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: userId
      }
    });

    await this.logAuditTrail(gate.engagementId, "GATE_SIGNOFF", userId, userRole, {
      gateType: gate.gateType,
      gateId,
      signOffId: signOff.id
    });

    return signOff;
  }

  async reviewGate(
    gateId: string,
    userId: string,
    userRole: UserRole,
    approved: boolean,
    comments?: string
  ): Promise<any> {
    const gate = await (prisma as any).prePlanningGate.findUnique({
      where: { id: gateId }
    });

    if (!gate) {
      throw new Error("Gate not found");
    }

    const allowedRoles: UserRole[] = ["SENIOR", "MANAGER", "PARTNER", "MANAGING_PARTNER", "ADMIN"];
    if (!allowedRoles.includes(userRole)) {
      throw new Error("User not authorized to review");
    }

    if (gate.completedById === userId) {
      throw new Error("Reviewer cannot be the same as preparer (maker-checker control)");
    }

    const updated = await (prisma as any).prePlanningGate.update({
      where: { id: gateId },
      data: {
        status: approved ? "PENDING_SIGNOFF" : "IN_PROGRESS",
        reviewedAt: new Date(),
        reviewedById: userId,
        reviewerComments: comments
      }
    });

    await this.logAuditTrail(gate.engagementId, "GATE_REVIEW", userId, userRole, {
      gateType: gate.gateType,
      gateId,
      approved,
      comments
    });

    return updated;
  }

  private async logAuditTrail(
    engagementId: string,
    action: string,
    userId: string,
    userRole: UserRole,
    details: any
  ): Promise<void> {
    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        userRole,
        action,
        entityType: "PRE_PLANNING",
        entityId: engagementId,
        afterValue: details,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent
      }
    });
  }

  async getGateDetails(gateId: string): Promise<any> {
    return (prisma as any).prePlanningGate.findUnique({
      where: { id: gateId },
      include: {
        checklistItems: {
          orderBy: { orderIndex: "asc" },
          include: {
            completedBy: { select: { id: true, fullName: true, role: true } }
          }
        },
        signOffs: {
          include: {
            signedOffBy: { select: { id: true, fullName: true, role: true } }
          }
        },
        completedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } }
      }
    });
  }

  async getAcceptanceContinuanceDecision(engagementId: string): Promise<any> {
    return (prisma as any).acceptanceContinuanceDecision.findUnique({
      where: { engagementId },
      include: {
        decisionBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
        managingPartnerApprovedBy: { select: { id: true, fullName: true, role: true } }
      }
    });
  }

  async updateAcceptanceContinuanceDecision(
    engagementId: string,
    firmId: string,
    userId: string,
    data: any
  ): Promise<any> {
    const existing = await (prisma as any).acceptanceContinuanceDecision.findUnique({
      where: { engagementId }
    });

    if (existing) {
      return (prisma as any).acceptanceContinuanceDecision.update({
        where: { engagementId },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
    }

    return (prisma as any).acceptanceContinuanceDecision.create({
      data: {
        engagementId,
        firmId,
        ...data
      }
    });
  }

  async finalizePrePlanning(
    engagementId: string,
    userId: string,
    userRole: UserRole,
    options: {
      comments?: string;
      partnerPinUsed?: boolean;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<{ success: boolean; message: string }> {
    const allowedRoles: UserRole[] = ["PARTNER", "MANAGING_PARTNER", "ADMIN"];
    if (!allowedRoles.includes(userRole)) {
      throw new Error("Only Partner or above can finalize pre-planning");
    }

    const canProceed = await this.canProceedToPlanning(engagementId);
    if (!canProceed.allowed) {
      throw new Error(canProceed.reason || "Cannot finalize pre-planning");
    }

    await prisma.engagement.update({
      where: { id: engagementId },
      data: {
        currentPhase: "PLANNING",
        onboardingLocked: true
      }
    });

    await this.logAuditTrail(engagementId, "PRE_PLANNING_FINALIZED", userId, userRole, {
      finalizedAt: new Date(),
      ...options
    });

    return {
      success: true,
      message: "Pre-planning phase finalized. Engagement has progressed to Planning phase."
    };
  }
}

export const prePlanningService = new PrePlanningService();
