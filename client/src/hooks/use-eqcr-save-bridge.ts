import { useWorkspaceSaveBridge, type WorkspaceSaveBridgeResult } from "./use-workspace-save-bridge";

export type EQCRSavePayload = Record<string, any>;

export interface EQCRSaveBridgeResult extends WorkspaceSaveBridgeResult {}

export function useEQCRSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => EQCRSavePayload
): EQCRSaveBridgeResult {
  return useWorkspaceSaveBridge(engagementId, buildPayload, {
    entityType: "eqcr",
  });
}
