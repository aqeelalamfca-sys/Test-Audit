import React, { useEffect, useMemo, useState } from "react";

interface Props {
  phaseKey: string;
  /** Optional engagementId to scope persistence per engagement. */
  engagementId?: string;
  /** Optional extra className for layout spacing controlled by pages. */
  className?: string;
}

const AiAssistantPanel: React.FC<Props> = ({ phaseKey, engagementId, className }) => {
  // Persist expanded state per phase (and engagement when available)
  const storageKey = useMemo(() => {
    const scope = engagementId ? `:${engagementId}` : "";
    return `aiAssistantPanel:expanded:${phaseKey}${scope}`;
  }, [phaseKey, engagementId]);

  // Default state = collapsed. We read localStorage on mount to avoid layout shift + SSR issues.
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Guard for environments where window/localStorage is unavailable.
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      if (saved !== null) {
        setIsExpanded(Boolean(JSON.parse(saved)));
      }
    } catch {
      // ignore
    } finally {
      setHasHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(isExpanded));
      }
    } catch {
      // ignore
    }
  }, [isExpanded, storageKey, hasHydrated]);

  const togglePanel = () => {
    setIsExpanded(prev => !prev);
  };

  return (
    <div className={['ai-assistant-panel', className].filter(Boolean).join(' ')}>
      <div className="ai-assistant-header" onClick={togglePanel} role="button" tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") togglePanel();
        }}
      >
        <h3>AI Assistant</h3>
        <button type="button">{isExpanded ? "Collapse" : "Expand"}</button>
      </div>
      {isExpanded && (
        <div className="ai-assistant-content">
          {/* Content goes here */}
        </div>
      )}
    </div>
  );
};

export default AiAssistantPanel;