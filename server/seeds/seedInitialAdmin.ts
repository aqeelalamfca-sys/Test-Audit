import { prisma } from "../db";
import bcrypt from "bcryptjs";

export async function seedInitialAdmin() {
  const existingFirm = await prisma.firm.findFirst();
  if (existingFirm) {
    const userCount = await prisma.user.count({ where: { firmId: existingFirm.id } });
    if (userCount > 0) {
      console.log("Firm and users already exist, skipping initial admin setup");
      return;
    }
  }

  const isProduction = process.env.NODE_ENV === "production";
  const firmName = process.env.FIRM_NAME || "My Audit Firm";
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (isProduction && (!adminEmail || !adminPassword)) {
    console.error("FATAL: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required in production.");
    console.error("Set these in your deployment configuration (e.g., AWS Secrets Manager).");
    process.exit(1);
  }

  const email = adminEmail || "admin@auditwise.local";
  const password = adminPassword || "Admin@123";

  console.log(`Creating initial firm: ${firmName}`);
  const firm = existingFirm || await prisma.firm.create({
    data: { name: firmName },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email: email },
    update: {
      passwordHash,
      fullName: "System Administrator",
      role: "ADMIN",
      firmId: firm.id,
      isActive: true,
    },
    create: {
      email: email,
      username: email.split("@")[0],
      passwordHash,
      fullName: "System Administrator",
      role: "ADMIN",
      firmId: firm.id,
      isActive: true,
    },
  });

  console.log(`Initial admin created: ${email}`);
  console.log("You can now login and create additional users from the User Management page.");
}
