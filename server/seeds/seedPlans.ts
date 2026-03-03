import { prisma } from "../db";

const DEFAULT_PLANS = [
  {
    code: "BASIC",
    name: "Basic",
    maxUsers: 5,
    maxEngagements: 10,
    allowCustomAi: false,
    monthlyPrice: 9999,
    featureFlags: {
      aiAssist: true,
      advancedReporting: false,
      customTemplates: false,
      apiAccess: false,
    },
  },
  {
    code: "PRO",
    name: "Professional",
    maxUsers: 25,
    maxEngagements: 100,
    allowCustomAi: true,
    monthlyPrice: 39999,
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
    maxUsers: 999,
    maxEngagements: 9999,
    allowCustomAi: true,
    monthlyPrice: 99999,
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
      const existing = await prisma.plan.findUnique({ where: { code: plan.code } });
      if (!existing) {
        await prisma.plan.create({ data: plan as any });
        console.log(`[Seed] Plan created: ${plan.code}`);
      }
    }
    console.log("[Seed] Plans seeding complete");
  } catch (error) {
    console.error("[Seed] Failed to seed plans:", error);
  }
}
