import React, { useEffect, useState } from 'react';

interface Props {
  phaseKey: string;
}

const AiAssistantPanel: React.FC<Props> = ({ phaseKey }) => {
  // Set default collapsed state based on localStorage
  const storageKey = `aiAssistantPanel:expanded:${phaseKey}`;
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const savedState = localStorage.getItem(storageKey);
    return savedState !== null ? JSON.parse(savedState) : false;
  });

  // Update localStorage whenever the state changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(isExpanded));
  }, [isExpanded, storageKey]);

  const togglePanel = () => {
    setIsExpanded(prev => !prev);
  };

  return (
    <div className="ai-assistant-panel">
      <div className="ai-assistant-header" onClick={togglePanel}>
        <h3>AI Assistant</h3>
        <button>{isExpanded ? 'Collapse' : 'Expand'}</button>
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