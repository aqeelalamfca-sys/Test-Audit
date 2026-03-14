import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useWorkspace } from "@/lib/workspace-context";

interface PhaseAICapability {
  id: string;
  label: string;
  description: string;
  promptType: string;
  requiresContext: string[];
  isaReference?: string;
}

interface PhaseAIConfig {
  phaseKey: string;
  phaseLabel: string;
  capabilities: PhaseAICapability[];
  systemPromptOverride?: string;
  contextFields: string[];
}

interface AIGenerationResult {
  content: string;
  capabilityId: string;
  phaseKey: string;
  provider: string;
  disclaimer: string;
  generatedAt: string;
  contextUsed: string[];
}

export function usePhaseAI(phaseKey?: string) {
  const { engagementId } = useWorkspace();
  const queryClient = useQueryClient();

  const configQuery = useQuery<PhaseAIConfig>({
    queryKey: ["phase-ai-config", phaseKey],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/ai/phase/${phaseKey}/capabilities`);
      if (!res.ok) {
        if (res.status === 404) return { phaseKey: phaseKey || "", phaseLabel: "", capabilities: [], contextFields: [] };
        throw new Error("Failed to load AI capabilities");
      }
      return res.json();
    },
    enabled: !!phaseKey,
    staleTime: 5 * 60 * 1000,
  });

  const generateMutation = useMutation<AIGenerationResult, Error, { capabilityId: string; additionalContext?: Record<string, string> }>({
    mutationFn: async ({ capabilityId, additionalContext }) => {
      if (!phaseKey || !engagementId) throw new Error("Phase key and engagement ID required");
      const res = await fetchWithAuth(`/api/ai/phase/${phaseKey}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId, capabilityId, additionalContext }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI generation failed" }));
        throw new Error(err.error || "AI generation failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phase-ai-config", phaseKey] });
    },
  });

  return {
    config: configQuery.data,
    capabilities: configQuery.data?.capabilities || [],
    hasAI: (configQuery.data?.capabilities?.length || 0) > 0,
    isLoading: configQuery.isLoading,
    generate: generateMutation.mutate,
    generateAsync: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    generationResult: generateMutation.data,
    generationError: generateMutation.error,
  };
}

export function useAllPhaseAIConfigs() {
  return useQuery<PhaseAIConfig[]>({
    queryKey: ["all-phase-ai-configs"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/ai/phases/capabilities");
      if (!res.ok) throw new Error("Failed to load AI capabilities");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}
