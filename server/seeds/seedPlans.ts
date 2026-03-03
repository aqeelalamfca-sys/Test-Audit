import { prisma } from "../db";

const DEFAULT_PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    maxUsers: 5,
    maxEngagements: 15,
    maxOffices: 1,
    storageGb: 5,
    allowCustomAi: false,
    platformAiIncluded: true,
    monthlyPrice: 4900,
    userOveragePkr: 800,
    officeOveragePkr: 2500,
    engagementPackSize: 10,
    engagementPackPkr: 2000,
    supportLevel: "standard",
    featureFlags: {
      aiAssist: true,
      advancedReporting: false,
      customTemplates: false,
      apiAccess: false,
    },
  },
  {
    code: "GROWTH",
    name: "Growth",
    maxUsers: 20,
    maxEngagements: 75,
    maxOffices: 3,
    storageGb: 25,
    allowCustomAi: true,
    platformAiIncluded: true,
    monthlyPrice: 14900,
    userOveragePkr: 700,
    officeOveragePkr: 2000,
    engagementPackSize: 25,
    engagementPackPkr: 4000,
    supportLevel: "standard",
    featureFlags: {
      aiAssist: true,
      advancedReporting: true,
      customTemplates: false,
      apiAccess: false,
    },
  },
  {
    code: "PROFESSIONAL",
    name: "Professional",
    maxUsers: 60,
    maxEngagements: 250,
    maxOffices: 7,
    storageGb: 100,
    allowCustomAi: true,
    platformAiIncluded: true,
    monthlyPrice: 34900,
    userOveragePkr: 600,
    officeOveragePkr: 1500,
    engagementPackSize: 50,
    engagementPackPkr: 6000,
    supportLevel: "priority",
    featureFlags: {
      aiAssist: true,
      advancedReporting: true,
      customTemplates: true,
      apiAccess: false,
    },
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    maxUsers: 9999,
    maxEngagements: 99999,
    maxOffices: 9999,
    storageGb: 500,
    allowCustomAi: true,
    platformAiIncluded: true,
    monthlyPrice: 79900,
    userOveragePkr: 0,
    officeOveragePkr: 0,
    engagementPackSize: 1,
    engagementPackPkr: 0,
    supportLevel: "dedicated",
    featureFlags: {
      aiAssist: true,
      advancedReporting: true,
      customTemplates: true,
      apiAccess: true,
    },
  },
];

export async function seedPlans() {
  try {
    for (const plan of DEFAULT_PLANS) {
      await prisma.plan.upsert({
        where: { code: plan.code },
        update: {
          name: plan.name,
          maxUsers: plan.maxUsers,
          maxEngagements: plan.maxEngagements,
          maxOffices: plan.maxOffices,
          storageGb: plan.storageGb,
          allowCustomAi: plan.allowCustomAi,
          platformAiIncluded: plan.platformAiIncluded,
          monthlyPrice: plan.monthlyPrice,
          userOveragePkr: plan.userOveragePkr,
          officeOveragePkr: plan.officeOveragePkr,
          engagementPackSize: plan.engagementPackSize,
          engagementPackPkr: plan.engagementPackPkr,
          supportLevel: plan.supportLevel,
          featureFlags: plan.featureFlags,
        },
        create: plan as any,
      });
    }

    const oldCodes = ["BASIC", "PRO"];
    for (const code of oldCodes) {
      const old = await prisma.plan.findUnique({ where: { code } });
      if (old) {
        const subCount = await prisma.subscription.count({ where: { planId: old.id } });
        if (subCount === 0) {
          await prisma.plan.delete({ where: { code } });
          console.log(`[Seed] Removed legacy plan: ${code}`);
        } else {
          await prisma.plan.update({ where: { code }, data: { isActive: false, isPublic: false } });
          console.log(`[Seed] Deactivated legacy plan: ${code} (has ${subCount} subscriptions)`);
        }
      }
    }

    console.log("[Seed] Plans seeding complete");
  } catch (error) {
    console.error("[Seed] Failed to seed plans:", error);
  }
}
