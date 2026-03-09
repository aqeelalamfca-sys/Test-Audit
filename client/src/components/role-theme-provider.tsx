import { useEffect, createContext, useContext } from "react";
import { useAuth } from "@/lib/auth";
import { getRoleTheme, applyRoleThemeClass, clearRoleThemeClass, ALL_ROLE_CSS_CLASSES, type RoleThemeConfig } from "@/lib/role-theme";
import { ACCENT_COLORS } from "@/components/ThemeProvider";

interface RoleThemeContextType {
  theme: RoleThemeConfig;
  role: string;
}

const RoleThemeContext = createContext<RoleThemeContextType | undefined>(undefined);

export function RoleThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase() || "staff";
  const theme = getRoleTheme(role);

  useEffect(() => {
    const root = document.documentElement;
    ACCENT_COLORS.forEach(({ value }) => {
      root.classList.remove(`accent-${value}`);
    });
    applyRoleThemeClass(role);
    return () => {
      clearRoleThemeClass();
    };
  }, [role]);

  return (
    <RoleThemeContext.Provider value={{ theme, role }}>
      {children}
    </RoleThemeContext.Provider>
  );
}

export function useRoleTheme(): RoleThemeContextType {
  const context = useContext(RoleThemeContext);
  if (!context) {
    return { theme: getRoleTheme("staff"), role: "staff" };
  }
  return context;
}
