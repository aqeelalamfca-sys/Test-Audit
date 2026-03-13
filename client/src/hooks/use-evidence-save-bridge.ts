import { useSimpleSaveBridge, type SimpleSaveBridgeResult } from "./use-simple-save-bridge";

export type EvidenceSavePayload = Record<string, any>;

export interface EvidenceSaveBridgeResult extends SimpleSaveBridgeResult {}

export function useEvidenceSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => EvidenceSavePayload
): EvidenceSaveBridgeResult {
  return useSimpleSaveBridge(engagementId, buildPayload, {
    entityType: "evidence",
    successDescription: (isDraft) =>
      `Evidence vault ${isDraft ? "draft" : "progress"} saved successfully.`,
    errorDescription: "Failed to save evidence vault. Please try again.",
  });
}
