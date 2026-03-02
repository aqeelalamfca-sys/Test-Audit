import { prisma } from "../db";
import type { UserRole } from "@prisma/client";
import crypto from "crypto";

type DataHubEntityType = 
  | "LEDGER"
  | "TRIAL_BALANCE"
  | "FINANCIAL_STATEMENTS"
  | "RISK_ASSESSMENT"
  | "AUDIT_PROCEDURE"
  | "ADJUSTMENT"
  | "EVIDENCE"
  | "SIGNOFF"
  | "PDF_PACK";

type DataHubVersionStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SUPERSEDED"
  | "REJECTED";

interface DataHubReadOptions {
  preferDraft?: boolean;
  versionId?: string;
  versionNumber?: number;
}

interface DataHubWriteOptions {
  changeDescription?: string;
  isaReference?: string;
}

interface DataHubApprovalOptions {
  comments?: string;
  partnerPinUsed?: boolean;
  digitalSignature?: string;
  ipAddress?: string;
  userAgent?: string;
}

class DataHubService {
  private generateDataHash(data: any): string {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash("sha256").update(jsonString).digest("hex");
  }

  private async logAccess(params: {
    entityId: string;
    versionId?: string;
    accessType: string;
    accessMode: string;
    isDraftAccess: boolean;
    userId: string;
    userRole: string;
    module?: string;
    screen?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await (prisma as any).dataHubAccessLog.create({
      data: params
    });
  }

  async getOrCreateEntity(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    entityName: string,
    userId: string,
    description?: string,
    isaReference?: string
  ) {
    let entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      }
    });

    if (!entity) {
      entity = await (prisma as any).dataHubEntity.create({
        data: {
          engagementId,
          entityType,
          entityCode,
          entityName,
          description,
          isaReference,
          createdById: userId
        }
      });
    }

    return entity;
  }

  async read(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    userId: string,
    userRole: string,
    options: DataHubReadOptions = {}
  ): Promise<{ data: any; version: any; isDraft: boolean } | null> {
    const entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" }
        }
      }
    });

    if (!entity) {
      return null;
    }

    let version: any = null;
    let isDraft = false;

    if (options.versionId) {
      version = entity.versions.find((v: any) => v.id === options.versionId);
    } else if (options.versionNumber !== undefined) {
      version = entity.versions.find((v: any) => v.versionNumber === options.versionNumber);
    } else if (options.preferDraft && entity.hasDraft) {
      const hasDraftPermission = await this.hasDraftPermission(engagementId, userId, entityType, entity.id);
      if (hasDraftPermission) {
        version = entity.versions.find((v: any) => v.status === "DRAFT");
        isDraft = true;
      }
    }
    
    if (!version) {
      version = entity.versions.find((v: any) => v.status === "APPROVED");
    }

    if (!version) {
      return null;
    }

    await this.logAccess({
      entityId: entity.id,
      versionId: version.id,
      accessType: "READ",
      accessMode: isDraft ? "DRAFT" : "APPROVED",
      isDraftAccess: isDraft,
      userId,
      userRole
    });

    return {
      data: version.data,
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        createdAt: version.createdAt,
        approvedAt: version.approvedAt
      },
      isDraft
    };
  }

  async getLatestApproved(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    userId: string,
    userRole: string
  ): Promise<{ data: any; version: any } | null> {
    const result = await this.read(engagementId, entityType, entityCode, userId, userRole, {
      preferDraft: false
    });

    if (result && !result.isDraft) {
      return { data: result.data, version: result.version };
    }

    return null;
  }

  async hasDraftPermission(
    engagementId: string,
    userId: string,
    entityType?: DataHubEntityType,
    entityId?: string
  ): Promise<boolean> {
    const now = new Date();
    
    const permission = await (prisma as any).dataHubDraftPermission.findFirst({
      where: {
        engagementId,
        userId,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ],
        AND: [
          {
            OR: [
              { entityType: null },
              { entityType }
            ]
          },
          {
            OR: [
              { entityId: null },
              { entityId }
            ]
          }
        ]
      }
    });

    return !!permission;
  }

  async grantDraftPermission(
    engagementId: string,
    userId: string,
    grantedById: string,
    entityType?: DataHubEntityType,
    entityId?: string,
    expiresAt?: Date,
    reason?: string
  ) {
    return (prisma as any).dataHubDraftPermission.create({
      data: {
        engagementId,
        userId,
        grantedById,
        entityType,
        entityId,
        expiresAt,
        reason
      }
    });
  }

  async revokeDraftPermission(
    permissionId: string,
    revokedById: string,
    reason?: string
  ) {
    return (prisma as any).dataHubDraftPermission.update({
      where: { id: permissionId },
      data: {
        revokedAt: new Date(),
        revokedById,
        revocationReason: reason
      }
    });
  }

  async startDraft(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    entityName: string,
    initialData: any,
    userId: string,
    userRole: string,
    options: DataHubWriteOptions = {}
  ) {
    const hasPerm = await this.hasDraftPermission(engagementId, userId, entityType);
    if (!hasPerm) {
      throw new Error("User does not have permission to create drafts for this entity type");
    }

    const entity = await this.getOrCreateEntity(
      engagementId,
      entityType,
      entityCode,
      entityName,
      userId,
      undefined,
      options.isaReference
    );

    if (entity.hasDraft) {
      throw new Error("A draft already exists for this entity. Complete or discard the existing draft first.");
    }

    const latestVersion = await (prisma as any).dataHubVersion.findFirst({
      where: { entityId: entity.id },
      orderBy: { versionNumber: "desc" }
    });

    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const dataHash = this.generateDataHash(initialData);

    const changedFields = latestVersion 
      ? this.detectChangedFields(latestVersion.data, initialData)
      : Object.keys(initialData);

    const version = await (prisma as any).dataHubVersion.create({
      data: {
        entityId: entity.id,
        versionNumber: newVersionNumber,
        status: "DRAFT",
        data: initialData,
        dataHash,
        changeDescription: options.changeDescription,
        changedFields,
        previousVersionId: latestVersion?.id,
        isDraft: true,
        draftStartedAt: new Date(),
        draftStartedById: userId,
        isaReference: options.isaReference,
        createdById: userId
      }
    });

    await (prisma as any).dataHubEntity.update({
      where: { id: entity.id },
      data: {
        hasDraft: true,
        currentVersionId: version.id
      }
    });

    await this.logAccess({
      entityId: entity.id,
      versionId: version.id,
      accessType: "CREATE_DRAFT",
      accessMode: "DRAFT",
      isDraftAccess: true,
      userId,
      userRole
    });

    return { entity, version };
  }

  async updateDraft(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    data: any,
    userId: string,
    userRole: string,
    changeDescription?: string
  ) {
    const hasPerm = await this.hasDraftPermission(engagementId, userId, entityType);
    if (!hasPerm) {
      throw new Error("User does not have permission to edit drafts");
    }

    const entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      }
    });

    if (!entity || !entity.hasDraft) {
      throw new Error("No draft exists for this entity");
    }

    const draftVersion = await (prisma as any).dataHubVersion.findFirst({
      where: {
        entityId: entity.id,
        status: "DRAFT"
      }
    });

    if (!draftVersion) {
      throw new Error("Draft version not found");
    }

    const dataHash = this.generateDataHash(data);
    const changedFields = this.detectChangedFields(draftVersion.data, data);

    const updated = await (prisma as any).dataHubVersion.update({
      where: { id: draftVersion.id },
      data: {
        data,
        dataHash,
        changedFields,
        changeDescription: changeDescription || draftVersion.changeDescription
      }
    });

    await this.logAccess({
      entityId: entity.id,
      versionId: updated.id,
      accessType: "UPDATE_DRAFT",
      accessMode: "DRAFT",
      isDraftAccess: true,
      userId,
      userRole
    });

    return updated;
  }

  async submitForReview(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    userId: string,
    userRole: string
  ) {
    const entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      }
    });

    if (!entity || !entity.hasDraft) {
      throw new Error("No draft exists to submit for review");
    }

    const draftVersion = await (prisma as any).dataHubVersion.findFirst({
      where: {
        entityId: entity.id,
        status: "DRAFT"
      }
    });

    if (!draftVersion) {
      throw new Error("Draft version not found");
    }

    const updated = await (prisma as any).dataHubVersion.update({
      where: { id: draftVersion.id },
      data: {
        status: "PENDING_REVIEW",
        isDraft: false,
        submittedForReviewAt: new Date(),
        submittedForReviewById: userId
      }
    });

    await this.logAccess({
      entityId: entity.id,
      versionId: updated.id,
      accessType: "SUBMIT_FOR_REVIEW",
      accessMode: "DRAFT",
      isDraftAccess: false,
      userId,
      userRole
    });

    return updated;
  }

  async review(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    approved: boolean,
    userId: string,
    userRole: UserRole,
    options: DataHubApprovalOptions = {}
  ) {
    const allowedRoles: UserRole[] = ["SENIOR", "MANAGER", "PARTNER", "MANAGING_PARTNER", "EQCR", "ADMIN"];
    if (!allowedRoles.includes(userRole)) {
      throw new Error("User role not authorized to review");
    }

    const entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      }
    });

    if (!entity) {
      throw new Error("Entity not found");
    }

    const pendingVersion = await (prisma as any).dataHubVersion.findFirst({
      where: {
        entityId: entity.id,
        status: "PENDING_REVIEW"
      }
    });

    if (!pendingVersion) {
      throw new Error("No version pending review");
    }

    if (pendingVersion.submittedForReviewById === userId) {
      throw new Error("Reviewer cannot be the same as the submitter (maker-checker control)");
    }

    if (approved) {
      const updated = await (prisma as any).dataHubVersion.update({
        where: { id: pendingVersion.id },
        data: {
          status: "PENDING_APPROVAL",
          reviewedAt: new Date(),
          reviewedById: userId,
          reviewerComments: options.comments
        }
      });

      await this.createSignOff(pendingVersion.id, "REVIEW", "PROCEDURE_COMPLETION", userId, userRole, options);

      return updated;
    } else {
      const updated = await (prisma as any).dataHubVersion.update({
        where: { id: pendingVersion.id },
        data: {
          status: "DRAFT",
          isDraft: true,
          reviewedAt: new Date(),
          reviewedById: userId,
          reviewerComments: options.comments
        }
      });

      await (prisma as any).dataHubEntity.update({
        where: { id: entity.id },
        data: { hasDraft: true }
      });

      return updated;
    }
  }

  async approve(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    approved: boolean,
    userId: string,
    userRole: UserRole,
    options: DataHubApprovalOptions = {}
  ) {
    const allowedRoles: UserRole[] = ["PARTNER", "MANAGING_PARTNER", "ADMIN"];
    if (!allowedRoles.includes(userRole)) {
      throw new Error("User role not authorized to approve (Partner+ required)");
    }

    const entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      }
    });

    if (!entity) {
      throw new Error("Entity not found");
    }

    const pendingVersion = await (prisma as any).dataHubVersion.findFirst({
      where: {
        entityId: entity.id,
        status: "PENDING_APPROVAL"
      }
    });

    if (!pendingVersion) {
      throw new Error("No version pending approval");
    }

    if (pendingVersion.submittedForReviewById === userId || pendingVersion.reviewedById === userId) {
      throw new Error("Approver cannot be the same as submitter or reviewer (maker-checker control)");
    }

    if (approved) {
      if (entity.currentApprovedVersionId) {
        await (prisma as any).dataHubVersion.update({
          where: { id: entity.currentApprovedVersionId },
          data: {
            status: "SUPERSEDED",
            supersededAt: new Date(),
            supersededById: userId
          }
        });
      }

      const updated = await (prisma as any).dataHubVersion.update({
        where: { id: pendingVersion.id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: userId,
          approverComments: options.comments
        }
      });

      await (prisma as any).dataHubEntity.update({
        where: { id: entity.id },
        data: {
          hasDraft: false,
          currentApprovedVersionId: updated.id,
          currentVersionId: updated.id
        }
      });

      await this.createSignOff(pendingVersion.id, "APPROVAL", "FINANCIAL_STATEMENTS", userId, userRole, options);

      await this.logAccess({
        entityId: entity.id,
        versionId: updated.id,
        accessType: "APPROVE",
        accessMode: "APPROVED",
        isDraftAccess: false,
        userId,
        userRole
      });

      return updated;
    } else {
      const updated = await (prisma as any).dataHubVersion.update({
        where: { id: pendingVersion.id },
        data: {
          status: "REJECTED",
          rejectedAt: new Date(),
          rejectedById: userId,
          rejectionReason: options.comments
        }
      });

      await (prisma as any).dataHubEntity.update({
        where: { id: entity.id },
        data: { hasDraft: false }
      });

      return updated;
    }
  }

  private async createSignOff(
    versionId: string,
    signOffType: string,
    signOffCategory: string,
    userId: string,
    userRole: UserRole,
    options: DataHubApprovalOptions
  ) {
    return (prisma as any).dataHubSignOff.create({
      data: {
        versionId,
        signOffType,
        signOffCategory,
        signedOffById: userId,
        signedOffRole: userRole,
        comments: options.comments,
        digitalSignature: options.digitalSignature,
        partnerPinUsed: options.partnerPinUsed || false,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      }
    });
  }

  private detectChangedFields(oldData: any, newData: any): string[] {
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    
    for (const key of allKeys) {
      if (JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key])) {
        changedFields.push(key);
      }
    }
    
    return changedFields;
  }

  async discardDraft(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    userId: string,
    userRole: string,
    reason?: string
  ) {
    const entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      }
    });

    if (!entity || !entity.hasDraft) {
      throw new Error("No draft exists to discard");
    }

    const draftVersion = await (prisma as any).dataHubVersion.findFirst({
      where: {
        entityId: entity.id,
        status: "DRAFT"
      }
    });

    if (draftVersion) {
      await (prisma as any).dataHubVersion.update({
        where: { id: draftVersion.id },
        data: {
          status: "REJECTED",
          rejectedAt: new Date(),
          rejectedById: userId,
          rejectionReason: reason || "Draft discarded by user"
        }
      });
    }

    await (prisma as any).dataHubEntity.update({
      where: { id: entity.id },
      data: { hasDraft: false }
    });

    await this.logAccess({
      entityId: entity.id,
      versionId: draftVersion?.id,
      accessType: "DISCARD_DRAFT",
      accessMode: "DRAFT",
      isDraftAccess: true,
      userId,
      userRole
    });

    return { success: true };
  }

  async getVersionHistory(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string,
    limit: number = 20
  ) {
    const entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: limit,
          include: {
            createdBy: { select: { id: true, fullName: true, role: true } },
            reviewedBy: { select: { id: true, fullName: true, role: true } },
            approvedBy: { select: { id: true, fullName: true, role: true } },
            signOffs: {
              include: {
                signedOffBy: { select: { id: true, fullName: true, role: true } }
              }
            }
          }
        }
      }
    });

    if (!entity) {
      return [];
    }

    return entity.versions;
  }

  async getEntityStatus(
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string
  ) {
    const entity = await (prisma as any).dataHubEntity.findUnique({
      where: {
        engagementId_entityType_entityCode: {
          engagementId,
          entityType,
          entityCode
        }
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 2
        }
      }
    });

    if (!entity) {
      return null;
    }

    const latestApproved = entity.versions.find((v: any) => v.status === "APPROVED");
    const currentDraft = entity.versions.find((v: any) => 
      ["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL"].includes(v.status)
    );

    return {
      entityId: entity.id,
      entityType: entity.entityType,
      entityCode: entity.entityCode,
      entityName: entity.entityName,
      hasDraft: entity.hasDraft,
      latestApprovedVersion: latestApproved ? {
        id: latestApproved.id,
        versionNumber: latestApproved.versionNumber,
        approvedAt: latestApproved.approvedAt
      } : null,
      currentDraft: currentDraft ? {
        id: currentDraft.id,
        versionNumber: currentDraft.versionNumber,
        status: currentDraft.status,
        createdAt: currentDraft.createdAt
      } : null
    };
  }

  async listEntities(
    engagementId: string,
    entityType?: DataHubEntityType
  ) {
    const where: any = { engagementId };
    if (entityType) {
      where.entityType = entityType;
    }

    const entities = await (prisma as any).dataHubEntity.findMany({
      where,
      include: {
        versions: {
          where: { status: "APPROVED" },
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return entities.map((entity: any) => ({
      id: entity.id,
      entityType: entity.entityType,
      entityCode: entity.entityCode,
      entityName: entity.entityName,
      hasDraft: entity.hasDraft,
      hasApprovedVersion: entity.versions.length > 0,
      latestApprovedVersion: entity.versions[0]?.versionNumber
    }));
  }
}

export const dataHub = new DataHubService();
