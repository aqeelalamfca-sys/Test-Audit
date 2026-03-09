import { prisma } from "../db";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";

const FIRM_USERS: { email: string; role: UserRole; fullName: string; username: string }[] = [
  { email: "admin@auditwise.pk", role: "FIRM_ADMIN", fullName: "Firm Admin", username: "admin" },
  { email: "partner@auditwise.pk", role: "PARTNER", fullName: "Audit Partner", username: "partner" },
  { email: "manager@auditwise.pk", role: "MANAGER", fullName: "Audit Manager", username: "manager" },
  { email: "senior@auditwise.pk", role: "SENIOR", fullName: "Senior Auditor", username: "senior" },
  { email: "staff@auditwise.pk", role: "STAFF", fullName: "Staff Auditor", username: "staff" },
  { email: "eqcr@auditwise.pk", role: "EQCR", fullName: "EQCR Reviewer", username: "eqcr" },
];

export async function seedTestUsers() {
  let firm = await prisma.firm.findFirst();
  if (!firm) {
    firm = await prisma.firm.create({
      data: { name: "AuditWise Demo Firm" },
    });
  }

  const passwordHash = await bcrypt.hash("Test@123", 12);

  for (const u of FIRM_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        firmId: firm.id,
        isActive: true,
      },
      create: {
        email: u.email,
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        firmId: firm.id,
        isActive: true,
      },
    });
  }

  let client = await prisma.client.findFirst({ where: { firmId: firm.id } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        firmId: firm.id,
        name: "Demo Client Company",
      },
    });
  }

  const portalPasswordHash = await bcrypt.hash("Client@123", 12);
  const portalEmail = "client@company.pk";

  await prisma.clientPortalContact.upsert({
    where: {
      clientId_email: {
        clientId: client.id,
        email: portalEmail,
      },
    },
    update: {
      firstName: "Client",
      lastName: "User",
      portalPasswordHash,
      portalAccessEnabled: true,
      firmId: firm.id,
    },
    create: {
      firmId: firm.id,
      clientId: client.id,
      firstName: "Client",
      lastName: "User",
      email: portalEmail,
      portalAccessEnabled: true,
      portalPasswordHash,
    },
  });

  console.log("Test users seeded successfully");
}
