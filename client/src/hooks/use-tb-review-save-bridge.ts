import { useWorkspaceSaveBridge, type WorkspaceSaveBridgeResult } from "./use-workspace-save-bridge";

export type TBReviewSavePayload = Record<string, any>;

export interface TBReviewSaveBridgeResult extends WorkspaceSaveBridgeResult {}

export function useTBReviewSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => TBReviewSavePayload
): TBReviewSaveBridgeResult {
  return useWorkspaceSaveBridge(engagementId, buildPayload, {
    entityType: "trial-balance",
    sectionKeyPrefix: "tb-review",
  });
}
