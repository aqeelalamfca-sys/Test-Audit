import { useSimpleSaveBridge, type SimpleSaveBridgeResult } from "./use-simple-save-bridge";

export type InspectionSavePayload = Record<string, any>;

export interface InspectionSaveBridgeResult extends SimpleSaveBridgeResult {}

export function useInspectionSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => InspectionSavePayload
): InspectionSaveBridgeResult {
  return useSimpleSaveBridge(engagementId, buildPayload, {
    entityType: "inspection",
    successDescription: (isDraft) =>
      `Inspection data ${isDraft ? "draft" : "progress"} saved successfully.`,
    errorDescription: "Failed to save inspection data. Please try again.",
  });
}
