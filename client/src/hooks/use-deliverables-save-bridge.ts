import { useSimpleSaveBridge, type SimpleSaveBridgeResult } from "./use-simple-save-bridge";

export type DeliverablesSavePayload = Record<string, any>;

export interface DeliverablesSaveBridgeResult extends SimpleSaveBridgeResult {}

export function useDeliverablesSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => DeliverablesSavePayload
): DeliverablesSaveBridgeResult {
  return useSimpleSaveBridge(engagementId, buildPayload, {
    entityType: "deliverables",
    successDescription: (isDraft) =>
      `Deliverables ${isDraft ? "draft" : "progress"} saved successfully.`,
    errorDescription: "Failed to save deliverables. Please try again.",
  });
}
