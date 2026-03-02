import { prisma } from "../db";
import type { UserRole } from "@prisma/client";

type MakerCheckerMode = "DISABLED" | "TWO_TIER" | "THREE_TIER" | "CUSTOM";

export interface FirmSettingsInput {
  enforceRBAC?: boolean;
  allowRoleOverrides?: boolean;
  maxOverrideDurationDays?: number;
  requireOverrideApproval?: boolean;
  overrideApprovalRoles?: string[];
  makerCheckerMode?: MakerCheckerMode;
  makerCheckerEntities?: string[];
  allowSelfApproval?: boolean;
  requireDifferentApprovers?: boolean;
  defaultQRRequired?: boolean;
  defaultEQCRRequired?: boolean;
  eqcrThresholdAssets?: number;
  eqcrThresholdRevenue?: number;
  eqcrRequiredForPIE?: boolean;
  eqcrRequiredForHighRisk?: boolean;
  requireDigitalSignatures?: boolean;
  signOffExpiryDays?: number;
  requirePartnerPIN?: boolean;
  pinExpiryMinutes?: number;
  annualDeclarationRequired?: boolean;
  declarationRenewalMonths?: number;
  rotationPeriodYears?: number;
  coolingOffPeriodYears?: number;
  retentionPeriodYears?: number;
  archiveAfterMonths?: number;
  requireISAReferences?: boolean;
  aiEnabled?: boolean;
  aiRequiresHumanApproval?: boolean;
  aiOutputLabel?: string;
  logAllAIInteractions?: boolean;
  immutableAuditTrail?: boolean;
  logFieldChanges?: boolean;
  captureIPAddress?: boolean;
  captureDeviceInfo?: boolean;
}

export interface AdminAuditLogEntry {
  firmId: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  previousValue?: any;
  newValue?: any;
  changedFields?: string[];
  module?: string;
  screen?: string;
  isaReference?: string;
  userId: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
}

class AdministrationService {
  async getFirmSettings(firmId: string) {
    let settings = await (prisma as any).firmSettings?.findUnique({
      where: { firmId },
      include: {
        createdBy: { select: { id: true, fullName: true, role: true } },
        updatedBy: { select: { id: true, fullName: true, role: true } }
      }
    });

    if (!settings) {
      settings = await this.initializeFirmSettings(firmId);
    }

    return settings;
  }

  async initializeFirmSettings(firmId: string, userId?: string) {
    const settings = await (prisma as any).firmSettings?.create({
      data: {
        firmId,
        createdById: userId,
        updatedById: userId
      }
    });

    if (userId) {
      await this.logAdminAction({
        firmId,
        action: "CREATE",
        entityType: "FirmSettings",
        entityId: settings?.id,
        entityName: "Firm Settings",
        newValue: settings,
        module: "ADMINISTRATION",
        screen: "Settings",
        userId,
        userRole: "ADMIN"
      });
    }

    return settings;
  }

  async updateFirmSettings(
    firmId: string,
    updates: FirmSettingsInput,
    userId: string,
    userRole: string,
    changeReason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const currentSettings = await this.getFirmSettings(firmId);

    const changedFields: string[] = [];
    const previousValue: any = {};
    const newValue: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (currentSettings && currentSettings[key] !== value) {
        changedFields.push(key);
        previousValue[key] = currentSettings[key];
        newValue[key] = value;
      }
    }

    if (changedFields.length === 0) {
      return currentSettings;
    }

    const settingsSnapshot = { ...currentSettings };
    await (prisma as any).firmSettingsVersion?.create({
      data: {
        firmSettingsId: currentSettings.id,
        version: currentSettings.version,
        settingsSnapshot,
        changedFields,
        changeReason,
        changedById: userId,
        ipAddress,
        userAgent
      }
    });

    const updatedSettings = await (prisma as any).firmSettings?.update({
      where: { firmId },
      data: {
        ...updates,
        version: { increment: 1 },
        updatedById: userId
      }
    });

    await this.logAdminAction({
      firmId,
      action: "UPDATE",
      entityType: "FirmSettings",
      entityId: updatedSettings.id,
      entityName: "Firm Settings",
      previousValue,
      newValue,
      changedFields,
      module: "ADMINISTRATION",
      screen: "Settings",
      isaReference: "ISQM 1",
      userId,
      userRole,
      ipAddress,
      userAgent
    });

    return updatedSettings;
  }

  async getFirmSettingsHistory(firmId: string, limit = 50) {
    const settings = await this.getFirmSettings(firmId);
    if (!settings) return [];

    return (prisma as any).firmSettingsVersion?.findMany({
      where: { firmSettingsId: settings.id },
      orderBy: { version: "desc" },
      take: limit,
      include: {
        changedBy: { select: { id: true, fullName: true, role: true } }
      }
    }) || [];
  }

  async getRoleConfigurations(firmId: string) {
    let configs = await (prisma as any).roleConfiguration?.findMany({
      where: { firmId, isActive: true },
      orderBy: { hierarchyLevel: "asc" }
    });

    if (!configs || configs.length === 0) {
      configs = await this.initializeRoleConfigurations(firmId);
    }

    return configs || [];
  }

  async initializeRoleConfigurations(firmId: string) {
    const defaultConfigs = [
      {
        firmId,
        role: "STAFF",
        displayName: "Staff Auditor",
        description: "Entry-level audit staff performing basic procedures",
        hierarchyLevel: 1,
        canApproveOwnWork: false,
        canOverrideControls: false,
        accessiblePhases: ["PLANNING", "EXECUTION", "EVIDENCE"],
        signOffCategories: [],
        makerCheckerPosition: "PREPARER",
        canActAsReviewer: false,
        canActAsApprover: false
      },
      {
        firmId,
        role: "SENIOR",
        displayName: "Senior Auditor",
        description: "Experienced auditor supervising staff and reviewing work",
        hierarchyLevel: 2,
        canApproveOwnWork: false,
        canOverrideControls: false,
        accessiblePhases: ["PLANNING", "EXECUTION", "EVIDENCE", "FINALIZATION"],
        signOffCategories: ["PROCEDURE_COMPLETION"],
        makerCheckerPosition: "PREPARER",
        canActAsReviewer: true,
        canActAsApprover: false
      },
      {
        firmId,
        role: "TEAM_LEAD",
        displayName: "Team Lead",
        description: "Team leader coordinating fieldwork and first-level review",
        hierarchyLevel: 3,
        canApproveOwnWork: false,
        canOverrideControls: false,
        accessiblePhases: ["ADMINISTRATION", "PRE_PLANNING", "PLANNING", "EXECUTION", "EVIDENCE", "FINALIZATION"],
        signOffCategories: ["PROCEDURE_COMPLETION"],
        makerCheckerPosition: "REVIEWER",
        canActAsReviewer: true,
        canActAsApprover: false
      },
      {
        firmId,
        role: "MANAGER",
        displayName: "Audit Manager",
        description: "Manager responsible for engagement oversight and quality",
        hierarchyLevel: 4,
        canApproveOwnWork: false,
        canOverrideControls: false,
        accessiblePhases: ["ADMINISTRATION", "PRE_PLANNING", "PLANNING", "EXECUTION", "EVIDENCE", "FINALIZATION", "DELIVERABLES"],
        signOffCategories: ["PROCEDURE_COMPLETION", "RISK_ASSESSMENT"],
        makerCheckerPosition: "REVIEWER",
        canActAsReviewer: true,
        canActAsApprover: true
      },
      {
        firmId,
        role: "PARTNER",
        displayName: "Engagement Partner",
        description: "Partner with final sign-off authority for engagement",
        hierarchyLevel: 5,
        canApproveOwnWork: false,
        canOverrideControls: true,
        requiresPartnerPIN: true,
        accessiblePhases: ["ADMINISTRATION", "PRE_PLANNING", "PLANNING", "EXECUTION", "EVIDENCE", "FINALIZATION", "DELIVERABLES", "QR_EQCR"],
        signOffCategories: ["FINANCIAL_STATEMENTS", "RISK_ASSESSMENT", "PROCEDURE_COMPLETION", "ADJUSTMENTS_POSTING", "CONCLUSIONS_OPINION", "DELIVERABLES"],
        makerCheckerPosition: "APPROVER",
        canActAsReviewer: true,
        canActAsApprover: true
      },
      {
        firmId,
        role: "MANAGING_PARTNER",
        displayName: "Managing Partner",
        description: "Senior partner with firm-wide oversight authority",
        hierarchyLevel: 5,
        canApproveOwnWork: false,
        canOverrideControls: true,
        requiresPartnerPIN: true,
        accessiblePhases: ["ADMINISTRATION", "PRE_PLANNING", "PLANNING", "EXECUTION", "EVIDENCE", "FINALIZATION", "DELIVERABLES", "QR_EQCR", "INSPECTION"],
        signOffCategories: ["FINANCIAL_STATEMENTS", "RISK_ASSESSMENT", "PROCEDURE_COMPLETION", "ADJUSTMENTS_POSTING", "CONCLUSIONS_OPINION", "DELIVERABLES", "QR_EQCR"],
        makerCheckerPosition: "APPROVER",
        canActAsReviewer: true,
        canActAsApprover: true
      },
      {
        firmId,
        role: "EQCR",
        displayName: "EQCR Reviewer",
        description: "Engagement Quality Control Reviewer (independent review)",
        hierarchyLevel: 6,
        canApproveOwnWork: false,
        canOverrideControls: false,
        accessiblePhases: ["QR_EQCR", "INSPECTION"],
        signOffCategories: ["QR_EQCR"],
        makerCheckerPosition: "APPROVER",
        canActAsReviewer: true,
        canActAsApprover: true
      },
      {
        firmId,
        role: "ADMIN",
        displayName: "System Administrator",
        description: "System administrator with full configuration access",
        hierarchyLevel: 99,
        canApproveOwnWork: false,
        canOverrideControls: true,
        accessiblePhases: ["ADMINISTRATION", "PRE_PLANNING", "PLANNING", "EXECUTION", "EVIDENCE", "FINALIZATION", "DELIVERABLES", "QR_EQCR", "INSPECTION"],
        signOffCategories: [],
        makerCheckerPosition: "APPROVER",
        canActAsReviewer: true,
        canActAsApprover: true
      }
    ];

    const created = [];
    for (const config of defaultConfigs) {
      const existing = await (prisma as any).roleConfiguration?.findUnique({
        where: { firmId_role: { firmId, role: config.role } }
      });
      if (!existing) {
        const result = await (prisma as any).roleConfiguration?.create({ data: config });
        created.push(result);
      }
    }

    return created.length > 0 ? created : await (prisma as any).roleConfiguration?.findMany({
      where: { firmId, isActive: true },
      orderBy: { hierarchyLevel: "asc" }
    });
  }

  async updateRoleConfiguration(
    firmId: string,
    role: UserRole,
    updates: any,
    userId: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const current = await (prisma as any).roleConfiguration?.findUnique({
      where: { firmId_role: { firmId, role } }
    });

    const changedFields: string[] = [];
    const previousValue: any = {};
    const newValue: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (current && JSON.stringify(current[key]) !== JSON.stringify(value)) {
        changedFields.push(key);
        previousValue[key] = current[key];
        newValue[key] = value;
      }
    }

    const updated = await (prisma as any).roleConfiguration?.update({
      where: { firmId_role: { firmId, role } },
      data: {
        ...updates,
        updatedById: userId
      }
    });

    if (changedFields.length > 0) {
      await this.logAdminAction({
        firmId,
        action: "UPDATE",
        entityType: "RoleConfiguration",
        entityId: updated?.id,
        entityName: `Role: ${role}`,
        previousValue,
        newValue,
        changedFields,
        module: "ADMINISTRATION",
        screen: "Role Configuration",
        isaReference: "ISQM 1",
        userId,
        userRole,
        ipAddress,
        userAgent
      });
    }

    return updated;
  }

  async getGovernancePolicies(firmId: string) {
    return (prisma as any).governancePolicy?.findMany({
      where: { firmId, isActive: true },
      orderBy: [{ policyCategory: "asc" }, { policyCode: "asc" }]
    }) || [];
  }

  async createGovernancePolicy(
    firmId: string,
    policy: any,
    userId: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const created = await (prisma as any).governancePolicy?.create({
      data: {
        firmId,
        ...policy,
        createdById: userId,
        updatedById: userId
      }
    });

    await this.logAdminAction({
      firmId,
      action: "CREATE",
      entityType: "GovernancePolicy",
      entityId: created?.id,
      entityName: policy.policyName,
      newValue: created,
      module: "ADMINISTRATION",
      screen: "Governance Policies",
      isaReference: policy.isaReferences?.[0],
      userId,
      userRole,
      ipAddress,
      userAgent
    });

    return created;
  }

  async updateGovernancePolicy(
    firmId: string,
    policyCode: string,
    updates: any,
    userId: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const current = await (prisma as any).governancePolicy?.findUnique({
      where: { firmId_policyCode: { firmId, policyCode } }
    });

    const changedFields: string[] = [];
    const previousValue: any = {};
    const newValue: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (current && JSON.stringify(current[key]) !== JSON.stringify(value)) {
        changedFields.push(key);
        previousValue[key] = current[key];
        newValue[key] = value;
      }
    }

    const updated = await (prisma as any).governancePolicy?.update({
      where: { firmId_policyCode: { firmId, policyCode } },
      data: {
        ...updates,
        version: { increment: 1 },
        updatedById: userId
      }
    });

    if (changedFields.length > 0) {
      await this.logAdminAction({
        firmId,
        action: "UPDATE",
        entityType: "GovernancePolicy",
        entityId: updated?.id,
        entityName: current?.policyName,
        previousValue,
        newValue,
        changedFields,
        module: "ADMINISTRATION",
        screen: "Governance Policies",
        isaReference: updated?.isaReferences?.[0],
        userId,
        userRole,
        ipAddress,
        userAgent
      });
    }

    return updated;
  }

  async getDocumentTemplates(firmId: string, category?: string) {
    const where: any = { firmId, isActive: true };
    if (category) where.templateCategory = category;

    return (prisma as any).documentTemplate?.findMany({
      where,
      orderBy: [{ templateCategory: "asc" }, { templateName: "asc" }]
    }) || [];
  }

  async createDocumentTemplate(
    firmId: string,
    template: any,
    userId: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const created = await (prisma as any).documentTemplate?.create({
      data: {
        firmId,
        ...template,
        createdById: userId,
        updatedById: userId
      }
    });

    await this.logAdminAction({
      firmId,
      action: "CREATE",
      entityType: "DocumentTemplate",
      entityId: created?.id,
      entityName: template.templateName,
      newValue: created,
      module: "ADMINISTRATION",
      screen: "Document Templates",
      userId,
      userRole,
      ipAddress,
      userAgent
    });

    return created;
  }

  async updateDocumentTemplate(
    firmId: string,
    templateCode: string,
    updates: any,
    userId: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const current = await (prisma as any).documentTemplate?.findUnique({
      where: { firmId_templateCode: { firmId, templateCode } }
    });

    const changedFields: string[] = [];
    const previousValue: any = {};
    const newValue: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (current && JSON.stringify(current[key]) !== JSON.stringify(value)) {
        changedFields.push(key);
        previousValue[key] = current[key];
        newValue[key] = value;
      }
    }

    const updated = await (prisma as any).documentTemplate?.update({
      where: { firmId_templateCode: { firmId, templateCode } },
      data: {
        ...updates,
        version: { increment: 1 },
        updatedById: userId
      }
    });

    if (changedFields.length > 0) {
      await this.logAdminAction({
        firmId,
        action: "UPDATE",
        entityType: "DocumentTemplate",
        entityId: updated?.id,
        entityName: current?.templateName,
        previousValue,
        newValue,
        changedFields,
        module: "ADMINISTRATION",
        screen: "Document Templates",
        userId,
        userRole,
        ipAddress,
        userAgent
      });
    }

    return updated;
  }

  async getEngagementFlagConfigs(firmId: string) {
    return (prisma as any).engagementFlagConfig?.findMany({
      where: { firmId, isActive: true },
      orderBy: { flagCode: "asc" }
    }) || [];
  }

  async createEngagementFlagConfig(
    firmId: string,
    config: any,
    userId: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const created = await (prisma as any).engagementFlagConfig?.create({
      data: {
        firmId,
        ...config,
        createdById: userId,
        updatedById: userId
      }
    });

    await this.logAdminAction({
      firmId,
      action: "CREATE",
      entityType: "EngagementFlagConfig",
      entityId: created?.id,
      entityName: config.flagName,
      newValue: created,
      module: "ADMINISTRATION",
      screen: "Engagement Flags",
      userId,
      userRole,
      ipAddress,
      userAgent
    });

    return created;
  }

  async updateEngagementFlagConfig(
    firmId: string,
    flagCode: string,
    updates: any,
    userId: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const current = await (prisma as any).engagementFlagConfig?.findUnique({
      where: { firmId_flagCode: { firmId, flagCode } }
    });

    const changedFields: string[] = [];
    const previousValue: any = {};
    const newValue: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (current && JSON.stringify(current[key]) !== JSON.stringify(value)) {
        changedFields.push(key);
        previousValue[key] = current[key];
        newValue[key] = value;
      }
    }

    const updated = await (prisma as any).engagementFlagConfig?.update({
      where: { firmId_flagCode: { firmId, flagCode } },
      data: {
        ...updates,
        updatedById: userId
      }
    });

    if (changedFields.length > 0) {
      await this.logAdminAction({
        firmId,
        action: "UPDATE",
        entityType: "EngagementFlagConfig",
        entityId: updated?.id,
        entityName: current?.flagName,
        previousValue,
        newValue,
        changedFields,
        module: "ADMINISTRATION",
        screen: "Engagement Flags",
        userId,
        userRole,
        ipAddress,
        userAgent
      });
    }

    return updated;
  }

  async logAdminAction(entry: AdminAuditLogEntry) {
    return (prisma as any).adminAuditLog?.create({
      data: entry
    });
  }

  async getAdminAuditLog(firmId: string, filters?: {
    entityType?: string;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const where: any = { firmId };
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return (prisma as any).adminAuditLog?.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: filters?.limit || 100,
      include: {
        user: { select: { id: true, fullName: true, role: true } }
      }
    }) || [];
  }

  async getUsersWithRoles(firmId: string) {
    return prisma.user.findMany({
      where: { firmId, isActive: true },
      orderBy: [{ role: "desc" }, { fullName: "asc" }],
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true
      }
    });
  }

  async updateUserRole(
    firmId: string,
    userId: string,
    newRole: UserRole,
    adminUserId: string,
    adminRole: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, role: true, firmId: true }
    });

    if (!user || user.firmId !== firmId) {
      throw new Error("User not found in this firm");
    }

    const previousRole = user.role;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole }
    });

    await this.logAdminAction({
      firmId,
      action: "UPDATE_ROLE",
      entityType: "User",
      entityId: userId,
      entityName: user.fullName,
      previousValue: { role: previousRole },
      newValue: { role: newRole },
      changedFields: ["role"],
      module: "ADMINISTRATION",
      screen: "User Management",
      isaReference: "ISQM 1",
      userId: adminUserId,
      userRole: adminRole,
      ipAddress,
      userAgent
    });

    return updated;
  }

  async createPermissionOverride(
    firmId: string,
    targetUserId: string,
    permissionId: string,
    isGranted: boolean,
    grantedById: string,
    grantedByRole: string,
    reason: string,
    expiresAt?: Date,
    ipAddress?: string,
    userAgent?: string
  ) {
    const settings = await this.getFirmSettings(firmId);
    
    if (!settings?.allowRoleOverrides) {
      throw new Error("Role overrides are disabled for this firm");
    }

    const override = await prisma.userPermissionOverride.upsert({
      where: {
        userId_permissionId: { userId: targetUserId, permissionId }
      },
      update: {
        isGranted,
        grantedById,
        reason,
        expiresAt
      },
      create: {
        userId: targetUserId,
        permissionId,
        isGranted,
        grantedById,
        reason,
        expiresAt
      }
    });

    await this.logAdminAction({
      firmId,
      action: isGranted ? "GRANT_PERMISSION" : "REVOKE_PERMISSION",
      entityType: "UserPermissionOverride",
      entityId: override.id,
      entityName: `Permission Override for User ${targetUserId}`,
      newValue: { permissionId, isGranted, reason, expiresAt },
      module: "ADMINISTRATION",
      screen: "Permission Overrides",
      userId: grantedById,
      userRole: grantedByRole,
      ipAddress,
      userAgent
    });

    return override;
  }

  async getPermissionOverridesForUser(userId: string) {
    return prisma.userPermissionOverride.findMany({
      where: { userId },
      include: {
        permission: true,
        grantedBy: { select: { id: true, fullName: true } }
      }
    });
  }

  async checkMakerCheckerRequired(firmId: string, entityType: string): Promise<boolean> {
    const settings = await this.getFirmSettings(firmId);
    if (!settings) return true;
    if (settings.makerCheckerMode === "DISABLED") return false;
    return settings.makerCheckerEntities?.includes(entityType) ?? true;
  }

  async getMakerCheckerMode(firmId: string): Promise<MakerCheckerMode> {
    const settings = await this.getFirmSettings(firmId);
    return settings?.makerCheckerMode || "THREE_TIER";
  }

  async getRoleHierarchy(firmId: string, role: UserRole): Promise<number> {
    const config = await (prisma as any).roleConfiguration?.findUnique({
      where: { firmId_role: { firmId, role } }
    });
    return config?.hierarchyLevel ?? 1;
  }

  async canUserApprove(firmId: string, userRole: UserRole, entityType: string): Promise<boolean> {
    const config = await (prisma as any).roleConfiguration?.findUnique({
      where: { firmId_role: { firmId, role: userRole } }
    });
    return config?.canActAsApprover ?? false;
  }

  async evaluateEngagementFlags(
    firmId: string,
    engagementData: {
      totalAssets?: number;
      totalRevenue?: number;
      riskLevel?: string;
      entityType?: string;
      industry?: string;
      isPIE?: boolean;
    }
  ): Promise<{
    requiresQR: boolean;
    requiresEQCR: boolean;
    requiresPartnerReview: boolean;
    triggeredFlags: string[];
  }> {
    const settings = await this.getFirmSettings(firmId);
    const flagConfigs = await this.getEngagementFlagConfigs(firmId);

    let requiresQR = settings?.defaultQRRequired ?? true;
    let requiresEQCR = settings?.defaultEQCRRequired ?? false;
    let requiresPartnerReview = false;
    const triggeredFlags: string[] = [];

    if (settings?.eqcrRequiredForPIE && engagementData.isPIE) {
      requiresEQCR = true;
      triggeredFlags.push("PIE_EQCR");
    }

    if (settings?.eqcrRequiredForHighRisk && engagementData.riskLevel === "HIGH") {
      requiresEQCR = true;
      triggeredFlags.push("HIGH_RISK_EQCR");
    }

    if (settings?.eqcrThresholdAssets && engagementData.totalAssets) {
      if (engagementData.totalAssets >= Number(settings.eqcrThresholdAssets)) {
        requiresEQCR = true;
        triggeredFlags.push("ASSET_THRESHOLD_EQCR");
      }
    }

    if (settings?.eqcrThresholdRevenue && engagementData.totalRevenue) {
      if (engagementData.totalRevenue >= Number(settings.eqcrThresholdRevenue)) {
        requiresEQCR = true;
        triggeredFlags.push("REVENUE_THRESHOLD_EQCR");
      }
    }

    for (const config of flagConfigs) {
      let triggered = false;

      if (config.riskLevelTrigger?.includes(engagementData.riskLevel)) {
        triggered = true;
      }
      if (config.entityTypeTrigger?.includes(engagementData.entityType)) {
        triggered = true;
      }
      if (config.industryTrigger?.includes(engagementData.industry)) {
        triggered = true;
      }
      if (config.assetThreshold && engagementData.totalAssets) {
        if (engagementData.totalAssets >= Number(config.assetThreshold)) {
          triggered = true;
        }
      }
      if (config.revenueThreshold && engagementData.totalRevenue) {
        if (engagementData.totalRevenue >= Number(config.revenueThreshold)) {
          triggered = true;
        }
      }

      if (triggered) {
        triggeredFlags.push(config.flagCode);
        if (config.requiresQR) requiresQR = true;
        if (config.requiresEQCR) requiresEQCR = true;
        if (config.requiresPartnerReview) requiresPartnerReview = true;
      }
    }

    return { requiresQR, requiresEQCR, requiresPartnerReview, triggeredFlags };
  }
}

export const administrationService = new AdministrationService();
