import { createContext, useContext, useState, useCallback } from "react";

interface AICopilotContextType {
  isEnabled: boolean;
  isOpen: boolean;
  currentEngagementId: string | null;
  currentFsHead: string | null;
  auditPhase: string;
  setEnabled: (enabled: boolean) => void;
  setOpen: (open: boolean) => void;
  setContext: (engagementId: string, fsHead?: string, phase?: string) => void;
  toggleOpen: () => void;
}

const AICopilotContext = createContext<AICopilotContextType | undefined>(undefined);

interface AICopilotProviderProps {
  children: React.ReactNode;
  defaultEnabled?: boolean;
}

export function AICopilotProvider({ children, defaultEnabled = true }: AICopilotProviderProps) {
  const [isEnabled, setIsEnabled] = useState(defaultEnabled);
  const [isOpen, setIsOpen] = useState(false);
  const [currentEngagementId, setCurrentEngagementId] = useState<string | null>(null);
  const [currentFsHead, setCurrentFsHead] = useState<string | null>(null);
  const [auditPhase, setAuditPhase] = useState("planning");

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    if (!enabled) {
      setIsOpen(false);
    }
  }, []);

  const setOpen = useCallback((open: boolean) => {
    if (isEnabled) {
      setIsOpen(open);
    }
  }, [isEnabled]);

  const toggleOpen = useCallback(() => {
    if (isEnabled) {
      setIsOpen(prev => !prev);
    }
  }, [isEnabled]);

  const setContext = useCallback((engagementId: string, fsHead?: string, phase?: string) => {
    setCurrentEngagementId(engagementId);
    if (fsHead !== undefined) {
      setCurrentFsHead(fsHead);
    }
    if (phase) {
      setAuditPhase(phase);
    }
  }, []);

  return (
    <AICopilotContext.Provider
      value={{
        isEnabled,
        isOpen,
        currentEngagementId,
        currentFsHead,
        auditPhase,
        setEnabled,
        setOpen,
        setContext,
        toggleOpen,
      }}
    >
      {children}
    </AICopilotContext.Provider>
  );
}

export function useAICopilot() {
  const context = useContext(AICopilotContext);
  if (context === undefined) {
    throw new Error("useAICopilot must be used within an AICopilotProvider");
  }
  return context;
}

export function useAICopilotContext(engagementId: string, fsHead?: string, phase?: string) {
  const { setContext } = useAICopilot();

  const updateContext = useCallback(() => {
    setContext(engagementId, fsHead, phase);
  }, [engagementId, fsHead, phase, setContext]);

  return { updateContext };
}
