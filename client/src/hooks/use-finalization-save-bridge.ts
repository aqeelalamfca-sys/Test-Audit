import { useWorkspaceSaveBridge, type WorkspaceSaveBridgeResult } from "./use-workspace-save-bridge";

export type FinalizationSavePayload = Record<string, any>;

export interface FinalizationSaveBridgeResult extends WorkspaceSaveBridgeResult {}

export function useFinalizationSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => FinalizationSavePayload
): FinalizationSaveBridgeResult {
  return useWorkspaceSaveBridge(engagementId, buildPayload, {
    entityType: "finalization",
  });
}
