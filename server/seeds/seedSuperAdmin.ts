import { prisma } from "../db";
import { hashPassword } from "../auth";

export async function seedSuperAdmin() {
  try {
    const existing = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
    });

    if (existing) {
      console.log("[Seed] SuperAdmin already exists:", existing.email);
      return existing;
    }

    const email = process.env.SUPER_ADMIN_EMAIL || "superadmin@auditwise.pk";
    const password = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123";

    const passwordHash = await hashPassword(password);
    const superAdmin = await prisma.user.create({
      data: {
        email,
        username: "superadmin",
        passwordHash,
        fullName: "Platform Super Admin",
        role: "SUPER_ADMIN",
        firmId: null,
        status: "ACTIVE",
        isActive: true,
      },
    });

    console.log(`[Seed] SuperAdmin created: ${email}`);
    return superAdmin;
  } catch (error) {
    console.error("[Seed] Failed to seed SuperAdmin:", error);
  }
}
