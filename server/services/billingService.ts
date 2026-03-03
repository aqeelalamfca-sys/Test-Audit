import { prisma } from "../db";

export async function generateInvoiceNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: "desc" },
    select: { invoiceNo: true },
  });

  let seq = 1;
  if (lastInvoice?.invoiceNo) {
    const parts = lastInvoice.invoiceNo.split("-");
    seq = parseInt(parts[2] || "0") + 1;
  }

  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export async function generateMonthlyInvoice(subscriptionId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      firm: {
        include: {
          _count: { select: { users: true, engagements: true } },
        },
      },
    },
  });

  if (!sub || !sub.plan) return null;

  const plan = sub.plan;
  const firm = sub.firm;
  const activeUsers = firm._count?.users || 0;
  const officeCount = Array.isArray(firm.offices) ? (firm.offices as any[]).length : 0;
  const engagementCount = firm._count?.engagements || 0;

  const lines: { description: string; quantity: number; unitPrice: number; amount: number }[] = [];

  const baseFee = Number(plan.monthlyPrice);
  lines.push({
    description: `${plan.name} Plan - Monthly Fee`,
    quantity: 1,
    unitPrice: baseFee,
    amount: baseFee,
  });

  const userOverage = Math.max(0, activeUsers - plan.maxUsers);
  if (userOverage > 0 && Number(plan.userOveragePkr) > 0) {
    const rate = Number(plan.userOveragePkr);
    lines.push({
      description: `Extra Users (${userOverage} over ${plan.maxUsers} included)`,
      quantity: userOverage,
      unitPrice: rate,
      amount: userOverage * rate,
    });
  }

  const officeOverage = Math.max(0, officeCount - plan.maxOffices);
  if (officeOverage > 0 && Number(plan.officeOveragePkr) > 0) {
    const rate = Number(plan.officeOveragePkr);
    lines.push({
      description: `Extra Offices (${officeOverage} over ${plan.maxOffices} included)`,
      quantity: officeOverage,
      unitPrice: rate,
      amount: officeOverage * rate,
    });
  }

  const engOverage = Math.max(0, engagementCount - plan.maxEngagements);
  if (engOverage > 0 && Number(plan.engagementPackPkr) > 0 && plan.engagementPackSize > 0) {
    const packs = Math.ceil(engOverage / plan.engagementPackSize);
    const packRate = Number(plan.engagementPackPkr);
    lines.push({
      description: `Engagement Packs (${packs} x ${plan.engagementPackSize}, ${engOverage} over ${plan.maxEngagements} included)`,
      quantity: packs,
      unitPrice: packRate,
      amount: packs * packRate,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const tax = 0;
  const total = subtotal + tax;

  const invoiceNo = await generateInvoiceNo();
  const now = new Date();
  const dueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNo,
      subscriptionId: sub.id,
      subtotal,
      tax,
      amount: total,
      currency: "PKR",
      status: "ISSUED",
      description: `Monthly invoice for ${firm.name} - ${plan.name} Plan`,
      issuedAt: now,
      dueAt,
      lines: {
        create: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
        })),
      },
    },
    include: { lines: true },
  });

  const nextPeriodStart = sub.currentPeriodEnd || now;
  const nextPeriodEnd = new Date(nextPeriodStart);
  nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
  const nextInvoiceAt = new Date(nextPeriodEnd);

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      currentPeriodStart: nextPeriodStart,
      currentPeriodEnd: nextPeriodEnd,
      nextInvoiceAt,
    },
  });

  return invoice;
}

export async function enforceSubscriptionLifecycle() {
  const now = new Date();

  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: "TRIAL",
      trialEnd: { lte: now },
    },
  });

  for (const sub of expiredTrials) {
    const graceDays = sub.graceDays || 7;
    const graceEndAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "PAST_DUE", graceEndAt },
    });
    console.log(`[Billing] Trial expired for subscription ${sub.id}, moved to PAST_DUE (grace ends ${graceEndAt.toISOString()})`);
  }

  const pastDueSubs = await prisma.subscription.findMany({
    where: {
      status: "PAST_DUE",
      graceEndAt: { not: null },
    },
  });

  for (const sub of pastDueSubs) {
    if (!sub.graceEndAt) continue;
    const graceMidpoint = new Date(sub.graceEndAt.getTime() - Math.ceil((sub.graceDays || 7) / 2) * 24 * 60 * 60 * 1000);
    if (now >= graceMidpoint) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "GRACE" },
      });
      console.log(`[Billing] Subscription ${sub.id} moved to GRACE (suspends at ${sub.graceEndAt.toISOString()})`);
    }
  }

  const expiredGrace = await prisma.subscription.findMany({
    where: {
      status: "GRACE",
      graceEndAt: { lte: now },
    },
  });

  for (const sub of expiredGrace) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "SUSPENDED" },
    });
    await prisma.firm.update({
      where: { id: sub.firmId },
      data: { status: "SUSPENDED", suspendedAt: now },
    });
    console.log(`[Billing] Subscription ${sub.id} SUSPENDED due to non-payment`);
  }

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: "ISSUED",
      dueAt: { lte: now },
    },
  });

  for (const inv of overdueInvoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: "OVERDUE" },
    });
  }

  return {
    trialExpired: expiredTrials.length,
    movedToGrace: pastDueSubs.length,
    suspended: expiredGrace.length,
    overdueInvoices: overdueInvoices.length,
  };
}

export async function processScheduledInvoices() {
  const now = new Date();

  const dueSubs = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE", "GRACE"] },
      nextInvoiceAt: { lte: now },
    },
  });

  let generated = 0;
  for (const sub of dueSubs) {
    try {
      await generateMonthlyInvoice(sub.id);
      generated++;
    } catch (err) {
      console.error(`[Billing] Failed to generate invoice for subscription ${sub.id}:`, err);
    }
  }

  return { generated };
}
