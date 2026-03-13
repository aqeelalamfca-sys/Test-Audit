import { useWorkspaceSaveBridge, type WorkspaceSaveBridgeResult } from "./use-workspace-save-bridge";

export type PlanningSavePayload = Record<string, any>;

export interface PlanningSaveBridgeResult extends WorkspaceSaveBridgeResult {}

export function usePlanningSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => PlanningSavePayload
): PlanningSaveBridgeResult {
  return useWorkspaceSaveBridge(engagementId, buildPayload, {
    entityType: "planning",
    defaultRedirectPrefix: "engagement",
  });
}
