import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../auth";
import { prisma } from "../db";

export async function subscriptionGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role === "SUPER_ADMIN") {
    return next();
  }

  if (!req.user.firmId) {
    return res.status(403).json({ error: "User not associated with a firm" });
  }

  try {
    const firm = await prisma.firm.findUnique({
      where: { id: req.user.firmId },
      select: { status: true, id: true },
    });

    if (!firm) {
      return res.status(403).json({ error: "Firm not found" });
    }

    if (firm.status === "SUSPENDED") {
      return res.status(403).json({
        error: "Firm account is suspended",
        code: "FIRM_SUSPENDED",
        message: "Your firm account has been suspended. Please contact support.",
      });
    }

    if (firm.status === "TERMINATED") {
      return res.status(403).json({
        error: "Firm account is terminated",
        code: "FIRM_TERMINATED",
        message: "Your firm account has been terminated.",
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { firmId: req.user.firmId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });

    if (subscription) {
      if (subscription.status === "SUSPENDED" || subscription.status === "CANCELED") {
        return res.status(403).json({
          error: "Subscription inactive",
          code: "SUBSCRIPTION_INACTIVE",
          message: "Your subscription is inactive. Please contact your administrator.",
        });
      }

      if (subscription.status === "TRIAL" && subscription.trialEnd) {
        if (new Date() > subscription.trialEnd) {
          return res.status(403).json({
            error: "Trial expired",
            code: "TRIAL_EXPIRED",
            message: "Your trial period has expired. Please upgrade your plan.",
          });
        }
      }

      if (subscription.status === "PAST_DUE") {
        const isWriteRequest = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
        if (isWriteRequest) {
          return res.status(403).json({
            error: "Payment past due",
            code: "PAYMENT_PAST_DUE",
            message: "Your payment is past due. Write operations are restricted until payment is resolved.",
          });
        }
      }

      (req as any).subscription = subscription;
      (req as any).plan = subscription.plan;
    }

    next();
  } catch (error) {
    console.error("Subscription guard error:", error);
    next();
  }
}
