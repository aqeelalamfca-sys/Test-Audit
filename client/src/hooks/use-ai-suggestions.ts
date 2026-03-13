import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useWorkspace } from "@/lib/workspace-context";

export interface AISuggestionRecord {
  id: string;
  fieldKey: string;
  aiValue: string | null;
  userValue: string | null;
  status: "AI_SUGGESTED" | "USER_OVERRIDE" | "MANUAL";
  confidence: number;
  rationale: string | null;
  citations: string[];
  isaReference: string | null;
  modelVersion: string;
  generatedAt: string;
  generatedBy: string | null;
  overriddenAt: string | null;
  overriddenBy: string | null;
  overrideReason: string | null;
}

export interface AIAuditLogEntry {
  id: string;
  fieldKey: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  aiConfidence: number | null;
  userName: string | null;
  userRole: string | null;
  createdAt: string;
}

interface PhaseSuggestionsResponse {
  success: boolean;
  suggestions: AISuggestionRecord[];
  auditLog: AIAuditLogEntry[];
}

export function useAISuggestions(phaseKey?: string) {
  const { engagementId } = useWorkspace();
  const queryClient = useQueryClient();
  const queryKey = ["ai-phase-suggestions", engagementId, phaseKey];

  const suggestionsQuery = useQuery<PhaseSuggestionsResponse>({
    queryKey,
    queryFn: async () => {
      if (!engagementId || !phaseKey) return { success: true, suggestions: [], auditLog: [] };
      const res = await fetchWithAuth(`/api/ai/phase-suggestions/${engagementId}/${phaseKey}`);
      if (!res.ok) return { success: false, suggestions: [], auditLog: [] };
      return res.json();
    },
    enabled: !!engagementId && !!phaseKey,
    staleTime: 2 * 60 * 1000,
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ fieldKey, userValue, overrideReason }: { fieldKey: string; userValue?: string; overrideReason?: string }) => {
      if (!engagementId || !phaseKey) throw new Error("Missing context");
      const res = await fetchWithAuth(`/api/ai/phase-suggestions/${engagementId}/${phaseKey}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldKey, userValue, overrideReason }),
      });
      if (!res.ok) throw new Error("Failed to accept suggestion");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ fieldKey }: { fieldKey: string }) => {
      if (!engagementId || !phaseKey) throw new Error("Missing context");
      const res = await fetchWithAuth(`/api/ai/phase-suggestions/${engagementId}/${phaseKey}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldKey }),
      });
      if (!res.ok) throw new Error("Failed to reject suggestion");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    suggestions: suggestionsQuery.data?.suggestions || [],
    auditLog: suggestionsQuery.data?.auditLog || [],
    isLoading: suggestionsQuery.isLoading,
    refetch: suggestionsQuery.refetch,
    accept: acceptMutation.mutate,
    acceptAsync: acceptMutation.mutateAsync,
    reject: rejectMutation.mutate,
    rejectAsync: rejectMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
