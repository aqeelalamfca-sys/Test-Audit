import { prisma } from "../db";
import { hashPassword } from "../auth";
import { validatePasswordPolicy } from "../utils/passwordPolicy";
import { logPlatformAction } from "../services/platformAuditService";

const DEFAULT_EMAIL = "superadmin@auditwise.pk";

export async function seedSuperAdmin() {
  try {
    const email = process.env.INITIAL_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || DEFAULT_EMAIL;
    const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;
    const shouldReset = process.env.ADMIN_RESET === "true";

    const existing = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
    });

    if (existing && !shouldReset) {
      console.log("[Seed] SuperAdmin already exists:", existing.email);
      return existing;
    }

    if (existing && shouldReset) {
      if (!password) {
        console.error("[Seed] ADMIN_RESET=true but no password provided via INITIAL_SUPER_ADMIN_PASSWORD or SUPER_ADMIN_PASSWORD env var");
        return existing;
      }

      const policyResult = validatePasswordPolicy(password);
      if (!policyResult.valid) {
        console.error("[Seed] SuperAdmin reset password does not meet policy:", policyResult.errors.join(", "));
        return existing;
      }

      const passwordHash = await hashPassword(password);
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          passwordHash,
          status: "ACTIVE",
          isActive: true,
        },
      });

      await logPlatformAction(
        existing.id,
        "SUPER_ADMIN_PASSWORD_RESET",
        "User",
        existing.id,
        null,
        "system",
        "startup",
        { email, resetVia: "ADMIN_RESET env var" }
      );

      console.log(`[Seed] SuperAdmin password reset for: ${email}`);
      return updated;
    }

    if (!password) {
      console.error("[Seed] No SuperAdmin password provided. Set INITIAL_SUPER_ADMIN_PASSWORD or SUPER_ADMIN_PASSWORD environment variable.");
      console.error("[Seed] SuperAdmin will NOT be created without a password.");
      return null;
    }

    const policyResult = validatePasswordPolicy(password);
    if (!policyResult.valid) {
      console.error("[Seed] SuperAdmin password does not meet policy:", policyResult.errors.join(", "));
      console.error("[Seed] SuperAdmin will NOT be created. Fix the password and restart.");
      return null;
    }

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

    await logPlatformAction(
      superAdmin.id,
      "SUPER_ADMIN_BOOTSTRAP",
      "User",
      superAdmin.id,
      null,
      "system",
      "startup",
      { email, bootstrapMethod: "env_var" }
    );

    console.log(`[Seed] SuperAdmin created: ${email}`);
    return superAdmin;
  } catch (error) {
    console.error("[Seed] Failed to seed SuperAdmin:", error);
  }
}
