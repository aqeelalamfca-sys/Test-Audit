import { useWorkspaceSaveBridge, type WorkspaceSaveBridgeResult } from "./use-workspace-save-bridge";

export type RequisitionSavePayload = Record<string, any>;

export interface RequisitionSaveBridgeResult extends WorkspaceSaveBridgeResult {}

export function useRequisitionSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => RequisitionSavePayload
): RequisitionSaveBridgeResult {
  return useWorkspaceSaveBridge(engagementId, buildPayload, {
    entityType: "requisition",
  });
}
