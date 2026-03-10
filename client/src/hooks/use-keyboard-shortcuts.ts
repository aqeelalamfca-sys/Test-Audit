import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: string;
}

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

export function getModKey() {
  return isMac() ? "Cmd" : "Ctrl";
}

export function formatShortcut(def: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }) {
  const parts: string[] = [];
  if (def.ctrl) parts.push(getModKey());
  if (def.alt) parts.push("Alt");
  if (def.shift) parts.push("Shift");
  parts.push(def.key.length === 1 ? def.key.toUpperCase() : def.key);
  return parts.join(" + ");
}

export const SHORTCUT_DEFINITIONS = [
  { key: "/", ctrl: true, description: "Focus search bar", category: "General" },
  { key: "b", ctrl: true, description: "Toggle sidebar", category: "General" },
  { key: "?", shift: true, ctrl: true, description: "Show keyboard shortcuts", category: "General" },
  { key: "h", ctrl: true, shift: true, description: "Go to Home / Dashboard", category: "Navigation" },
  { key: "e", ctrl: true, shift: true, description: "Go to Engagements", category: "Navigation" },
  { key: "c", ctrl: true, shift: true, description: "Go to Clients", category: "Navigation" },
  { key: "g", ctrl: true, shift: true, description: "Go to User Guide", category: "Navigation" },
  { key: "s", ctrl: true, shift: true, description: "Go to Settings", category: "Navigation" },
  { key: "1", alt: true, description: "Go to Pre-Planning", category: "Workspace" },
  { key: "2", alt: true, description: "Go to Data Intake", category: "Workspace" },
  { key: "3", alt: true, description: "Go to Planning", category: "Workspace" },
  { key: "4", alt: true, description: "Go to Execution", category: "Workspace" },
  { key: "5", alt: true, description: "Go to FS Heads", category: "Workspace" },
  { key: "6", alt: true, description: "Go to Evidence", category: "Workspace" },
  { key: "7", alt: true, description: "Go to Finalization", category: "Workspace" },
  { key: "8", alt: true, description: "Go to Deliverables", category: "Workspace" },
  { key: "Escape", description: "Close open dialog / dropdown", category: "General" },
] as const;

const WORKSPACE_PHASE_KEYS: Record<string, string> = {
  "1": "pre-planning",
  "2": "requisition",
  "3": "planning",
  "4": "execution",
  "5": "fs-heads",
  "6": "evidence",
  "7": "finalization",
  "8": "deliverables",
};

export function useKeyboardShortcuts(options: {
  onToggleHelp: () => void;
  engagementId?: string | null;
}) {
  const [location, setLocation] = useLocation();
  const { onToggleHelp, engagementId } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      const ctrl = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      if (ctrl && e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector('[data-testid="input-search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
        return;
      }

      if (ctrl && shift && e.key === "?") {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      if (isInput) return;

      if (ctrl && shift) {
        switch (e.key.toLowerCase()) {
          case "h":
            e.preventDefault();
            setLocation("/");
            return;
          case "e":
            e.preventDefault();
            setLocation("/engagements");
            return;
          case "c":
            e.preventDefault();
            setLocation("/clients");
            return;
          case "g":
            e.preventDefault();
            setLocation("/user-guide");
            return;
          case "s":
            e.preventDefault();
            setLocation("/firm-admin/settings");
            return;
        }
      }

      if (alt && !ctrl && !shift && engagementId) {
        const phaseKey = WORKSPACE_PHASE_KEYS[e.key];
        if (phaseKey) {
          e.preventDefault();
          setLocation(`/workspace/${engagementId}/${phaseKey}`);
          return;
        }
      }
    },
    [setLocation, onToggleHelp, engagementId]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
