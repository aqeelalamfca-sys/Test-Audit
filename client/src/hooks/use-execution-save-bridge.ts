import { useWorkspaceSaveBridge, type WorkspaceSaveBridgeResult } from "./use-workspace-save-bridge";

export type ExecutionSavePayload = Record<string, any>;

export interface ExecutionSaveBridgeResult extends WorkspaceSaveBridgeResult {}

export function useExecutionSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => ExecutionSavePayload
): ExecutionSaveBridgeResult {
  return useWorkspaceSaveBridge(engagementId, buildPayload, {
    entityType: "execution",
  });
}
