import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark";
export type AccentColor = "blue" | "teal" | "indigo" | "slate" | "emerald" | "amber";

interface ThemeContextType {
  mode: ThemeMode;
  accentColor: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY_MODE = "auditwise-theme-mode";
const STORAGE_KEY_ACCENT = "auditwise-accent-color";

export const ACCENT_COLORS: { value: AccentColor; label: string; preview: string }[] = [
  { value: "blue", label: "Blue", preview: "hsl(215, 85%, 35%)" },
  { value: "teal", label: "Teal", preview: "hsl(175, 70%, 32%)" },
  { value: "indigo", label: "Indigo", preview: "hsl(245, 75%, 45%)" },
  { value: "slate", label: "Slate", preview: "hsl(215, 20%, 40%)" },
  { value: "emerald", label: "Emerald", preview: "hsl(155, 65%, 32%)" },
  { value: "amber", label: "Amber", preview: "hsl(38, 85%, 42%)" },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode | null;
      return stored || "light";
    }
    return "light";
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_ACCENT) as AccentColor | null;
      return stored || "blue";
    }
    return "blue";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(mode);
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    ACCENT_COLORS.forEach(({ value }) => {
      root.classList.remove(`accent-${value}`);
    });
    root.classList.add(`accent-${accentColor}`);
    localStorage.setItem(STORAGE_KEY_ACCENT, accentColor);
  }, [accentColor]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  const setAccentColor = useCallback((color: AccentColor) => {
    setAccentColorState(color);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        accentColor,
        setMode,
        setAccentColor,
        toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
}
