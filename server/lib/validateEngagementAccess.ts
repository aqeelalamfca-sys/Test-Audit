import { prisma } from "../db";

/**
 * Validates that the given engagement exists and belongs to the given firm.
 * Returns `{ valid: true, engagement }` on success, or `{ valid: false, error }` on failure.
 */
export async function validateEngagementAccess(
  engagementId: string,
  firmId: string | null | undefined
): Promise<{ valid: boolean; engagement?: any; error?: string }> {
  if (!firmId) {
    return { valid: false, error: "User not associated with a firm" };
  }

  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, firmId },
  });

  if (!engagement) {
    return { valid: false, error: "Engagement not found" };
  }

  return { valid: true, engagement };
}
