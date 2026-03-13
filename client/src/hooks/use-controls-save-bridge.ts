import { useWorkspaceSaveBridge, type WorkspaceSaveBridgeResult } from "./use-workspace-save-bridge";

export type ControlsSavePayload = Record<string, any>;

export interface ControlsSaveBridgeResult extends WorkspaceSaveBridgeResult {}

export function useControlsSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => ControlsSavePayload
): ControlsSaveBridgeResult {
  return useWorkspaceSaveBridge(engagementId, buildPayload, {
    entityType: "controls",
  });
}
