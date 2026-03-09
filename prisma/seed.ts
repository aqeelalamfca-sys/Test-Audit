import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Initializing database...");

  const existingFirm = await prisma.firm.findFirst();
  if (existingFirm) {
    console.log("Database already initialized. Skipping...");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const firmName = process.env.FIRM_NAME || "My Audit Firm";
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (isProduction && (!adminEmail || !adminPassword)) {
    console.error("FATAL: ADMIN_EMAIL and ADMIN_PASSWORD are required in production.");
    process.exit(1);
  }

  const email = adminEmail || "admin@localhost";
  const password = adminPassword || "Admin@123";

  const firm = await prisma.firm.create({
    data: {
      name: firmName,
      licenseNo: "",
      address: "",
      phone: "",
      email: "",
    },
  });

  console.log("Created firm:", firm.name);

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      username: email.split("@")[0],
      passwordHash,
      fullName: "Firm Administrator",
      role: UserRole.ADMIN,
      firmId: firm.id,
    },
  });

  console.log(`Created admin user: ${email}`);

  await prisma.auditTrail.create({
    data: {
      userId: (await prisma.user.findFirst({ where: { email } }))!.id,
      action: "SYSTEM_INIT",
      entityType: "system",
      afterValue: { message: "Database initialized" },
    },
  });

  console.log("Database initialization completed!");
}

main()
  .catch((e) => {
    console.error("Initialization error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
