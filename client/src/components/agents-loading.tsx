import { useState, useEffect } from "react";

const AGENT_MESSAGES = [
  "Agents are helping...",
  "Preparing your workspace...",
  "Analyzing audit data...",
  "Checking compliance...",
  "Crunching numbers...",
  "Reviewing documents...",
  "Organizing workpapers...",
  "Validating entries...",
];

function ThinkingAgent({ index, delay }: { index: number; delay: number }) {
  const colors = [
    { skin: "#F4C28F", hair: "#4A3728", shirt: "hsl(var(--primary))" },
    { skin: "#D4A574", hair: "#2C1810", shirt: "#6366f1" },
    { skin: "#FDDCB5", hair: "#8B4513", shirt: "#0891b2" },
    { skin: "#E8C39E", hair: "#1A1A2E", shirt: "#059669" },
    { skin: "#F0D5B8", hair: "#D4A03C", shirt: "#dc2626" },
  ];
  const agent = colors[index % colors.length];
  const animDelay = `${delay}s`;

  return (
    <div className="relative flex flex-col items-center" data-testid={`thinking-agent-${index}`}>
      <svg
        width="64"
        height="80"
        viewBox="0 0 64 80"
        fill="none"
        className="drop-shadow-md"
      >
        <g>
          <circle cx="32" cy="22" r="14" fill={agent.skin} />

          <ellipse cx="32" cy="12" rx="15" ry="8" fill={agent.hair} />
          <rect x="17" y="8" width="30" height="8" rx="4" fill={agent.hair} />

          <g style={{ animation: `agentBlink 4s ${animDelay} infinite` }}>
            <circle cx="26" cy="22" r="2" fill="#333" />
            <circle cx="38" cy="22" r="2" fill="#333" />
          </g>

          <path d="M28 28 Q32 31 36 28" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />

          <rect x="22" y="36" width="20" height="24" rx="6" fill={agent.shirt} />

          <g style={{ animation: `agentThink 2s ${animDelay} ease-in-out infinite` }}>
            <rect x="8" y="40" width="14" height="5" rx="2.5" fill={agent.skin} />
          </g>
          <rect x="42" y="44" width="14" height="5" rx="2.5" fill={agent.skin} />

          <rect x="24" y="60" width="6" height="14" rx="3" fill={agent.shirt} />
          <rect x="34" y="60" width="6" height="14" rx="3" fill={agent.shirt} />
          <ellipse cx="27" cy="74" rx="5" ry="3" fill="#555" />
          <ellipse cx="37" cy="74" rx="5" ry="3" fill="#555" />
        </g>
      </svg>

      <div
        className="absolute -top-3 -right-1"
        style={{ animation: `agentBubble 2.5s ${animDelay} ease-in-out infinite` }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <g style={{ animation: `agentDots 1.5s ${animDelay} ease-in-out infinite` }}>
            <circle cx="6" cy="10" r="2" fill="hsl(var(--primary))" opacity="0.6" />
            <circle cx="12" cy="10" r="2" fill="hsl(var(--primary))" opacity="0.8">
              <animate attributeName="cy" values="10;7;10" dur="1s" begin={`${delay + 0.2}s`} repeatCount="indefinite" />
            </circle>
            <circle cx="18" cy="10" r="2" fill="hsl(var(--primary))" opacity="1">
              <animate attributeName="cy" values="10;7;10" dur="1s" begin={`${delay + 0.4}s`} repeatCount="indefinite" />
            </circle>
          </g>
        </svg>
      </div>

    </div>
  );
}

export function AgentsLoading({ showDelay = 1000 }: { showDelay?: number }) {
  const [visible, setVisible] = useState(showDelay === 0);
  const [messageIdx, setMessageIdx] = useState(0);

  useEffect(() => {
    if (showDelay === 0) return;
    const timer = setTimeout(() => setVisible(true), showDelay);
    return () => clearTimeout(timer);
  }, [showDelay]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setMessageIdx((prev) => (prev + 1) % AGENT_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="agents-loading-waiting">
        <div className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-testid="agents-loading">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-end gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                animation: `agentBounce 2s ${i * 0.3}s ease-in-out infinite`,
              }}
            >
              <ThinkingAgent index={i} delay={i * 0.4} />
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2 mt-2">
          <p
            className="text-base font-medium text-foreground transition-opacity duration-500"
            data-testid="agents-loading-message"
          >
            {AGENT_MESSAGES[messageIdx]}
          </p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/60"
                style={{
                  animation: `agentDots 1.2s ${i * 0.15}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentsLoadingInline({ showDelay = 1000 }: { showDelay?: number }) {
  const [visible, setVisible] = useState(showDelay === 0);
  const [messageIdx, setMessageIdx] = useState(0);

  useEffect(() => {
    if (showDelay === 0) return;
    const timer = setTimeout(() => setVisible(true), showDelay);
    return () => clearTimeout(timer);
  }, [showDelay]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setMessageIdx((prev) => (prev + 1) % AGENT_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) {
    return <div className="flex items-center justify-center py-12" data-testid="agents-inline-waiting"><div className="h-6 w-6" /></div>;
  }

  return (
    <div className="flex items-center justify-center py-12" data-testid="agents-loading-inline">
      <div className="flex flex-col items-center gap-2.5">
        <div className="flex items-end gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="scale-75"
              style={{
                animation: `agentBounce 2s ${i * 0.4}s ease-in-out infinite`,
              }}
            >
              <ThinkingAgent index={i + 2} delay={i * 0.5} />
            </div>
          ))}
        </div>
        <p className="text-sm font-medium text-muted-foreground" data-testid="agents-inline-message">
          {AGENT_MESSAGES[messageIdx]}
        </p>
      </div>
    </div>
  );
}
