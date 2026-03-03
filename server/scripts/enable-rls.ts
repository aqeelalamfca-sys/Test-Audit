import { prisma } from "../db";

const DIRECT_FIRM_ID_TABLES = [
  "User",
  "Client",
  "Engagement",
  "Subscription",
  "AIUsageRecord",
  "FirmSettings",
  "AISettings",
  "ClientPortalContact",
  "RoleConfiguration",
  "DocumentTemplate",
  "ISQM1MonitoringEntry",
  "QualityManagementStructure",
  "MasterProcedureLibrary",
  "MaterialityBenchmarkConfig",
  "NonAuditService",
  "ComplianceScreening",
  "ConflictOfInterest",
  "LeadershipAffirmation",
  "FirmIndependenceDeclaration",
  "FinancialInterest",
  "GiftHospitality",
  "EthicsBreach",
  "StaffCompetency",
  "TrainingCPD",
  "ConsultationRegister",
  "DifferenceOfOpinion",
  "EQREligibility",
  "EQRAppointmentRegister",
  "EQRFinding",
  "MonitoringPlan",
  "FileInspection",
  "QualityDeficiency",
  "RemediationAction",
  "QualityObjective",
  "QualityRisk",
  "QualityRiskResponse",
  "QualityManual",
  "AnnualQualityEvaluation",
  "PolicyDocument",
  "PolicyAcknowledgment",
  "IndependenceBreach",
  "ClientFirmRelationship",
  "GLBatch",
  "TBBatch",
  "MappingSession",
  "FSStructure",
  "FSSnapshot",
  "MaterialityCalculation",
  "ClientMaster",
  "ClientOwner",
];

const ENGAGEMENT_SCOPED_TABLES = [
  "FinancialPeriod",
  "EngagementTeam",
  "PhaseProgress",
  "ChecklistItem",
  "ReviewNote",
  "Document",
  "AuditTrail",
  "AIInteractionLog",
  "EnforcementGate",
  "MakerCheckerWorkflow",
  "IndependenceDeclaration",
  "ThreatRegister",
  "Safeguard",
  "EthicsConfirmation",
  "EngagementLetter",
  "MaterialityAssessment",
  "RiskAssessment",
  "RiskOverrideRequest",
  "GoingConcernAssessment",
  "GoingConcernIndicator",
  "PlanningMemo",
  "InternalControl",
  "ControlWalkthrough",
  "ControlTest",
  "ControlDeficiency",
  "CycleRelianceConclusion",
  "SubstantiveTest",
  "SampleItem",
  "Misstatement",
  "TrialBalance",
  "TrialBalanceLine",
  "TBMapping",
  "AnalyticalProcedure",
  "RatioAnalysis",
  "EvidenceFile",
  "SubstantiveTestEvidence",
  "AuditFileAssembly",
  "SubsequentEvent",
  "WrittenRepresentation",
  "AuditReport",
  "ManagementLetter",
  "CompletionMemo",
  "ComplianceChecklist",
  "EQCRAssignment",
  "EQCRComment",
  "EQCRChecklistItem",
  "EQCRChecklistFile",
  "EQCRPartnerComment",
  "EQCRSignedReport",
  "InspectionReadiness",
  "ExportLog",
  "ReviewThread",
  "SectionSignOff",
  "EntityUnderstanding",
  "RelatedParty",
  "IndustryAnalysis",
  "AuditStrategy",
  "InternalControlAssessment",
  "ExternalConfirmation",
  "RevenueTest",
  "InventoryTest",
  "FixedAssetTest",
  "AccountingEstimate",
  "TestAnomalyFinding",
  "AssertionTest",
  "EngagementProcedure",
  "WorkpaperRegistry",
  "WorkpaperVersion",
  "WorkpaperEvidenceLink",
  "TabAttachment",
  "JournalEntryTest",
  "JournalEntryTestItem",
  "AuditAdjustment",
  "PhaseGateCheck",
  "EngagementFileLock",
  "QCRReadinessCheck",
  "EngagementUserProgress",
];

export async function enableRLS(): Promise<{ enabled: number; skipped: number; errors: string[] }> {
  let enabled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const tableName of DIRECT_FIRM_ID_TABLES) {
    try {
      const colCheck = await prisma.$queryRawUnsafe<any[]>(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'firmId'`,
        tableName
      );

      if (colCheck.length === 0) {
        skipped++;
        continue;
      }

      await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY`);

      await prisma.$executeRawUnsafe(
        `DROP POLICY IF EXISTS firm_isolation_policy ON "${tableName}"`
      );

      await prisma.$executeRawUnsafe(
        `CREATE POLICY firm_isolation_policy ON "${tableName}"
         USING ("firmId"::text = current_setting('app.firm_id', true))`
      );

      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "idx_${tableName}_firmId_rls" ON "${tableName}" ("firmId")`
      );

      enabled++;
    } catch (err: any) {
      errors.push(`${tableName}: ${err.message}`);
    }
  }

  for (const tableName of ENGAGEMENT_SCOPED_TABLES) {
    try {
      const tableCheck = await prisma.$queryRawUnsafe<any[]>(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = $1`,
        tableName
      );

      if (tableCheck.length === 0) {
        skipped++;
        continue;
      }

      const firmColCheck = await prisma.$queryRawUnsafe<any[]>(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'firmId'`,
        tableName
      );

      if (firmColCheck.length > 0) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY`);
        await prisma.$executeRawUnsafe(
          `DROP POLICY IF EXISTS firm_isolation_policy ON "${tableName}"`
        );
        await prisma.$executeRawUnsafe(
          `CREATE POLICY firm_isolation_policy ON "${tableName}"
           USING ("firmId"::text = current_setting('app.firm_id', true))`
        );
        enabled++;
        continue;
      }

      const engColCheck = await prisma.$queryRawUnsafe<any[]>(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'engagementId'`,
        tableName
      );

      if (engColCheck.length > 0) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY`);
        await prisma.$executeRawUnsafe(
          `DROP POLICY IF EXISTS firm_isolation_policy ON "${tableName}"`
        );
        await prisma.$executeRawUnsafe(
          `CREATE POLICY firm_isolation_policy ON "${tableName}"
           USING (
             EXISTS (
               SELECT 1 FROM "Engagement" e 
               WHERE e.id = "${tableName}"."engagementId" 
               AND e."firmId"::text = current_setting('app.firm_id', true)
             )
           )`
        );
        enabled++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      errors.push(`${tableName}: ${err.message}`);
    }
  }

  return { enabled, skipped, errors };
}

export async function checkRLSStatus(): Promise<{ table: string; rls_enabled: boolean }[]> {
  const result = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `;
  return result.map(r => ({ table: r.tablename, rls_enabled: r.rowsecurity }));
}
