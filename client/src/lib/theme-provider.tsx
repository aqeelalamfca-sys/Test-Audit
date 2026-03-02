export {
  ThemeProvider,
  useThemeContext,
  ACCENT_COLORS,
  type ThemeMode,
  type AccentColor,
} from "@/components/ThemeProvider";

import { useThemeContext } from "@/components/ThemeProvider";

export function useTheme() {
  const { mode, toggleMode, setMode } = useThemeContext();
  return {
    theme: mode,
    setTheme: setMode,
    toggleTheme: toggleMode,
  };
}
