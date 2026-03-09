import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchWithAuth } from "./fetchWithAuth";

interface AISettings {
  aiEnabled: boolean;
  preferredProvider: string;
  providerPriority: string[];
  hasOpenAI: boolean;
  openaiEnabled: boolean;
  hasGemini: boolean;
  geminiEnabled: boolean;
  hasDeepseek: boolean;
  deepseekEnabled: boolean;
  maxTokensPerResponse: number;
  autoSuggestionsEnabled: boolean;
  manualTriggerOnly: boolean;
  requestTimeout: number;
}

interface AIContextType {
  settings: AISettings | null;
  loading: boolean;
  error: string | null;
  isAIEnabled: boolean;
  hasActiveProvider: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: AISettings = {
  aiEnabled: true,
  preferredProvider: "openai",
  providerPriority: ["openai", "gemini", "deepseek"],
  hasOpenAI: false,
  openaiEnabled: true,
  hasGemini: false,
  geminiEnabled: false,
  hasDeepseek: false,
  deepseekEnabled: false,
  maxTokensPerResponse: 2000,
  autoSuggestionsEnabled: true,
  manualTriggerOnly: false,
  requestTimeout: 30000,
};

const AIContext = createContext<AIContextType>({
  settings: null,
  loading: true,
  error: null,
  isAIEnabled: false,
  hasActiveProvider: false,
  refreshSettings: async () => {},
});

export function AIProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/ai/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setError(null);
      } else if (res.status === 404) {
        setSettings(defaultSettings);
        setError(null);
      } else {
        setError("Failed to fetch AI settings");
      }
    } catch (err) {
      console.error("Error fetching AI settings:", err);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const hasActiveProvider = settings ? (
    (settings.openaiEnabled && settings.hasOpenAI) ||
    (settings.geminiEnabled && settings.hasGemini) ||
    (settings.deepseekEnabled && settings.hasDeepseek)
  ) : false;

  const isAIEnabled = settings?.aiEnabled === true && hasActiveProvider;

  return (
    <AIContext.Provider value={{ 
      settings, 
      loading, 
      error, 
      isAIEnabled,
      hasActiveProvider,
      refreshSettings: fetchSettings 
    }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
}

export const PROHIBITED_AI_FIELDS = [
  "riskLevel",
  "riskRating", 
  "materialityAmount",
  "performanceMateriality",
  "trivialThreshold",
  "auditOpinion",
  "opinionType",
  "isApproved",
  "approvedBy",
  "signedOff",
  "partnerApproval",
  "managerApproval",
  "testResult",
  "conclusion",
  "evidenceSufficient",
  "sampleSize",
];

export function isAIProhibitedField(fieldKey: string): boolean {
  return PROHIBITED_AI_FIELDS.some(
    (prohibited) => 
      fieldKey.toLowerCase().includes(prohibited.toLowerCase()) ||
      prohibited.toLowerCase().includes(fieldKey.toLowerCase())
  );
}

export default AIContext;
