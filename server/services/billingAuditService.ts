import { prisma } from "../db";

export async function logBillingAction(params: {
  actorUserId?: string;
  firmId?: string;
  subscriptionId?: string;
  action: string;
  beforeState?: any;
  afterState?: any;
}) {
  return prisma.billingAuditLog.create({
    data: {
      actorUserId: params.actorUserId || null,
      firmId: params.firmId || null,
      subscriptionId: params.subscriptionId || null,
      action: params.action,
      beforeState: params.beforeState || null,
      afterState: params.afterState || null,
    },
  });
}
