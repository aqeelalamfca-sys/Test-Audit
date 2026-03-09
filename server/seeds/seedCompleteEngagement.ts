import { prisma } from "../db";

export async function completeEngagementSeed() {
  console.log("Running complete engagement seed...");

  try {
    const engagement = await prisma.engagement.findFirst({
      where: { engagementCode: "ENG-2025-001" },
    });

    if (!engagement) {
      console.log("  ENG-2025-001 not found, skipping complete engagement seed.");
      return;
    }

    const existingPhases = await prisma.phaseProgress.findMany({
      where: { engagementId: engagement.id },
    });
    const allCompleted = existingPhases.every((p) => p.status === "COMPLETED");
    if (engagement.currentPhase === "INSPECTION" && allCompleted) {
      console.log("  ENG-2025-001 already fully completed, skipping.");
      return;
    }

    console.log("  Updating engagement record to COMPLETED...");
    await prisma.engagement.update({
      where: { id: engagement.id },
      data: {
        currentPhase: "INSPECTION",
        status: "COMPLETED",
        onboardingLocked: true,
        planningLocked: true,
        executionLocked: true,
        finalizationLocked: true,
        actualHours: 1950,
        lastActivityAt: new Date("2025-03-20"),
      },
    });

    console.log("  Updating all phase progress records to COMPLETED/100%...");
    const phases = [
      "ONBOARDING",
      "PRE_PLANNING",
      "REQUISITION",
      "PLANNING",
      "EXECUTION",
      "FINALIZATION",
      "REPORTING",
      "EQCR",
      "INSPECTION",
    ] as const;

    const phaseDates: Record<string, { startedAt: string; completedAt: string }> = {
      ONBOARDING: { startedAt: "2024-12-01", completedAt: "2024-12-15" },
      PRE_PLANNING: { startedAt: "2024-12-10", completedAt: "2024-12-20" },
      REQUISITION: { startedAt: "2024-12-15", completedAt: "2025-01-10" },
      PLANNING: { startedAt: "2025-01-05", completedAt: "2025-01-31" },
      EXECUTION: { startedAt: "2025-01-15", completedAt: "2025-02-28" },
      FINALIZATION: { startedAt: "2025-02-20", completedAt: "2025-03-05" },
      REPORTING: { startedAt: "2025-03-01", completedAt: "2025-03-10" },
      EQCR: { startedAt: "2025-03-08", completedAt: "2025-03-15" },
      INSPECTION: { startedAt: "2025-03-12", completedAt: "2025-03-20" },
    };

    for (const phase of phases) {
      const dates = phaseDates[phase];
      await prisma.phaseProgress.updateMany({
        where: {
          engagementId: engagement.id,
          phase,
        },
        data: {
          status: "COMPLETED",
          completionPercentage: 100,
          startedAt: new Date(dates.startedAt),
          completedAt: new Date(dates.completedAt),
        },
      });
    }

    console.log("  Updating incomplete SectionSignOff for Inventory and Cost of Sales...");
    const partner = await prisma.user.findFirst({
      where: { email: "partner@auditwise.pk" },
    });

    if (partner) {
      await prisma.sectionSignOff.updateMany({
        where: {
          engagementId: engagement.id,
          section: "Inventory and Cost of Sales",
          isComplete: false,
        },
        data: {
          partnerApprovedById: partner.id,
          partnerApprovalDate: new Date("2025-03-10"),
          isComplete: true,
        },
      });
    }

    console.log("  Updating all FSHeadWorkingPaper records to APPROVED/COMPLETED...");
    await prisma.fSHeadWorkingPaper.updateMany({
      where: { engagementId: engagement.id },
      data: {
        status: "APPROVED",
        auditStatus: "COMPLETED",
        tocCompleted: true,
        todCompleted: true,
        analyticsCompleted: true,
      },
    });

    console.log("  Updating InspectionReadiness to 100%...");
    const phaseLockStatus = {
      ONBOARDING: "LOCKED",
      PRE_PLANNING: "LOCKED",
      REQUISITION: "LOCKED",
      PLANNING: "LOCKED",
      EXECUTION: "LOCKED",
      FINALIZATION: "LOCKED",
      REPORTING: "LOCKED",
      EQCR: "LOCKED",
      INSPECTION: "LOCKED",
    };

    await prisma.inspectionReadiness.upsert({
      where: { engagementId: engagement.id },
      update: {
        overallReadiness: 100,
        openItemsCount: 0,
        phaseLockStatus,
        readinessIssues: [],
        auditTrailIntegrity: true,
      },
      create: {
        engagementId: engagement.id,
        overallReadiness: 100,
        openItemsCount: 0,
        phaseLockStatus,
        readinessIssues: [],
        auditTrailIntegrity: true,
      },
    });

    console.log("  ENG-2025-001 successfully marked as fully completed.");
  } catch (error) {
    console.error("Error in completeEngagementSeed:", error);
  }
}
