import { useWorkspaceSaveBridge, type WorkspaceSaveBridgeResult } from "./use-workspace-save-bridge";

export type SubstantiveSavePayload = Record<string, any>;

export interface SubstantiveSaveBridgeResult extends WorkspaceSaveBridgeResult {}

export function useSubstantiveSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => SubstantiveSavePayload
): SubstantiveSaveBridgeResult {
  return useWorkspaceSaveBridge(engagementId, buildPayload, {
    entityType: "substantive",
  });
}
