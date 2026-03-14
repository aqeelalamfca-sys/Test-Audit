import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface PageProfile {
  module: string;
  group: string;
  objective: string;
  expectedOutputs: string[];
  commonMistakes: string[];
  requiredEvidence: string[];
  reviewRules: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    message: string;
    standardRef?: string;
  }>;
  nextStepGuidance: string[];
  fieldHints: Record<string, { label: string; guidance: string; standardRef?: string; exampleValues?: string[] }>;
  suggestionTemplates: Array<{
    id: string;
    label: string;
    type: string;
    targetField?: string;
  }>;
}

interface StandardReference {
  code: string;
  title: string;
  summary: string;
  auditImplication: string;
  category: string;
  keyParagraphs: Array<{ ref: string; text: string }>;
}

interface PageAIContext {
  pageId: string;
  profile: PageProfile | null;
  standards: StandardReference[];
  engagementSnapshot: Record<string, unknown> | null;
  message?: string;
}

const ROUTE_TO_PAGE_ID: Record<string, string> = {
  "acceptance": "acceptance",
  "independence": "independence",
  "tb-gl-upload": "tb-gl-upload",
  "validation": "validation",
  "coa-mapping": "coa-mapping",
  "materiality": "materiality",
  "risk-assessment": "risk-assessment",
  "planning-strategy": "planning-strategy",
  "analytical-procedures": "analytical-procedures",
  "procedures-sampling": "procedures-sampling",
  "execution-testing": "execution-testing",
  "evidence-linking": "evidence-linking",
  "observations": "observations",
  "adjustments": "adjustments",
  "finalization": "finalization",
  "opinion-reports": "opinion-reports",
  "eqcr": "eqcr",
  "inspection": "inspection",
};

function extractPageId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const workspaceIdx = segments.indexOf("workspace");
  if (workspaceIdx >= 0 && segments.length > workspaceIdx + 2) {
    const slug = segments[workspaceIdx + 2];
    return ROUTE_TO_PAGE_ID[slug] || slug;
  }
  const lastSegment = segments[segments.length - 1];
  return ROUTE_TO_PAGE_ID[lastSegment] || null;
}

function extractEngagementId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const workspaceIdx = segments.indexOf("workspace");
  if (workspaceIdx >= 0 && segments.length > workspaceIdx + 1) {
    return segments[workspaceIdx + 1];
  }
  return null;
}

export function usePageAIContext() {
  const [location] = useLocation();
  const pageId = extractPageId(location);
  const engagementId = extractEngagementId(location);

  const { data, isLoading, error, refetch } = useQuery<PageAIContext>({
    queryKey: ["/api/ai/copilot-enhanced/page-context", pageId, engagementId],
    queryFn: async () => {
      if (!pageId) return { pageId: "", profile: null, standards: [], engagementSnapshot: null };
      const res = await fetchWithAuth("/api/ai/copilot-enhanced/page-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, engagementId }),
      });
      if (!res.ok) throw new Error("Failed to fetch page context");
      return res.json();
    },
    enabled: !!pageId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  return {
    pageId,
    engagementId,
    profile: data?.profile || null,
    standards: data?.standards || [],
    engagementSnapshot: data?.engagementSnapshot || null,
    isLoading,
    error,
    refetch,
    hasProfile: !!data?.profile,
  };
}
