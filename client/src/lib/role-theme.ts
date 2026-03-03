export type RoleThemeKey = "red" | "orange" | "purple" | "blue" | "teal" | "green" | "gray";

export interface RoleThemeConfig {
  key: RoleThemeKey;
  label: string;
  cssClass: string;
  sidebarBorder: string;
  sidebarBorderDark: string;
  sidebarHeaderBg: string;
  sidebarHeaderBgDark: string;
  iconColor: string;
  iconColorDark: string;
  activeItemBg: string;
  activeItemText: string;
  activeItemBgDark: string;
  activeItemTextDark: string;
  hoverBg: string;
  hoverBgDark: string;
  hoverText: string;
  hoverTextDark: string;
  groupLabelColor: string;
  groupLabelColorDark: string;
  badgeBg: string;
  badgeText: string;
  badgeBgDark: string;
  badgeTextDark: string;
  avatarBg: string;
  avatarText: string;
}

const ROLE_THEMES: Record<RoleThemeKey, RoleThemeConfig> = {
  red: {
    key: "red",
    label: "Super Admin",
    cssClass: "role-red",
    sidebarBorder: "border-red-200",
    sidebarBorderDark: "dark:border-red-900",
    sidebarHeaderBg: "bg-red-50/50",
    sidebarHeaderBgDark: "dark:bg-red-950/30",
    iconColor: "text-red-600",
    iconColorDark: "dark:text-red-400",
    activeItemBg: "data-[active=true]:bg-red-100",
    activeItemText: "data-[active=true]:text-red-800",
    activeItemBgDark: "dark:data-[active=true]:bg-red-950",
    activeItemTextDark: "dark:data-[active=true]:text-red-300",
    hoverBg: "hover:bg-red-50",
    hoverBgDark: "dark:hover:bg-red-950/50",
    hoverText: "hover:text-red-700",
    hoverTextDark: "dark:hover:text-red-400",
    groupLabelColor: "text-red-600",
    groupLabelColorDark: "dark:text-red-400",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
    badgeBgDark: "dark:bg-red-950",
    badgeTextDark: "dark:text-red-400",
    avatarBg: "bg-red-600",
    avatarText: "text-white",
  },
  orange: {
    key: "orange",
    label: "Firm Admin",
    cssClass: "role-orange",
    sidebarBorder: "border-orange-200",
    sidebarBorderDark: "dark:border-orange-900",
    sidebarHeaderBg: "bg-orange-50/50",
    sidebarHeaderBgDark: "dark:bg-orange-950/30",
    iconColor: "text-orange-600",
    iconColorDark: "dark:text-orange-400",
    activeItemBg: "data-[active=true]:bg-orange-100",
    activeItemText: "data-[active=true]:text-orange-800",
    activeItemBgDark: "dark:data-[active=true]:bg-orange-950",
    activeItemTextDark: "dark:data-[active=true]:text-orange-300",
    hoverBg: "hover:bg-orange-50",
    hoverBgDark: "dark:hover:bg-orange-950/50",
    hoverText: "hover:text-orange-700",
    hoverTextDark: "dark:hover:text-orange-400",
    groupLabelColor: "text-orange-600",
    groupLabelColorDark: "dark:text-orange-400",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-700",
    badgeBgDark: "dark:bg-orange-950",
    badgeTextDark: "dark:text-orange-400",
    avatarBg: "bg-orange-600",
    avatarText: "text-white",
  },
  purple: {
    key: "purple",
    label: "Partner",
    cssClass: "role-purple",
    sidebarBorder: "border-purple-200",
    sidebarBorderDark: "dark:border-purple-900",
    sidebarHeaderBg: "bg-purple-50/50",
    sidebarHeaderBgDark: "dark:bg-purple-950/30",
    iconColor: "text-purple-600",
    iconColorDark: "dark:text-purple-400",
    activeItemBg: "data-[active=true]:bg-purple-100",
    activeItemText: "data-[active=true]:text-purple-800",
    activeItemBgDark: "dark:data-[active=true]:bg-purple-950",
    activeItemTextDark: "dark:data-[active=true]:text-purple-300",
    hoverBg: "hover:bg-purple-50",
    hoverBgDark: "dark:hover:bg-purple-950/50",
    hoverText: "hover:text-purple-700",
    hoverTextDark: "dark:hover:text-purple-400",
    groupLabelColor: "text-purple-600",
    groupLabelColorDark: "dark:text-purple-400",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-700",
    badgeBgDark: "dark:bg-purple-950",
    badgeTextDark: "dark:text-purple-400",
    avatarBg: "bg-purple-600",
    avatarText: "text-white",
  },
  blue: {
    key: "blue",
    label: "Manager",
    cssClass: "role-blue",
    sidebarBorder: "border-blue-200",
    sidebarBorderDark: "dark:border-blue-900",
    sidebarHeaderBg: "bg-blue-50/50",
    sidebarHeaderBgDark: "dark:bg-blue-950/30",
    iconColor: "text-blue-600",
    iconColorDark: "dark:text-blue-400",
    activeItemBg: "data-[active=true]:bg-blue-100",
    activeItemText: "data-[active=true]:text-blue-800",
    activeItemBgDark: "dark:data-[active=true]:bg-blue-950",
    activeItemTextDark: "dark:data-[active=true]:text-blue-300",
    hoverBg: "hover:bg-blue-50",
    hoverBgDark: "dark:hover:bg-blue-950/50",
    hoverText: "hover:text-blue-700",
    hoverTextDark: "dark:hover:text-blue-400",
    groupLabelColor: "text-blue-600",
    groupLabelColorDark: "dark:text-blue-400",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
    badgeBgDark: "dark:bg-blue-950",
    badgeTextDark: "dark:text-blue-400",
    avatarBg: "bg-blue-600",
    avatarText: "text-white",
  },
  teal: {
    key: "teal",
    label: "Senior",
    cssClass: "role-teal",
    sidebarBorder: "border-teal-200",
    sidebarBorderDark: "dark:border-teal-900",
    sidebarHeaderBg: "bg-teal-50/50",
    sidebarHeaderBgDark: "dark:bg-teal-950/30",
    iconColor: "text-teal-600",
    iconColorDark: "dark:text-teal-400",
    activeItemBg: "data-[active=true]:bg-teal-100",
    activeItemText: "data-[active=true]:text-teal-800",
    activeItemBgDark: "dark:data-[active=true]:bg-teal-950",
    activeItemTextDark: "dark:data-[active=true]:text-teal-300",
    hoverBg: "hover:bg-teal-50",
    hoverBgDark: "dark:hover:bg-teal-950/50",
    hoverText: "hover:text-teal-700",
    hoverTextDark: "dark:hover:text-teal-400",
    groupLabelColor: "text-teal-600",
    groupLabelColorDark: "dark:text-teal-400",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-700",
    badgeBgDark: "dark:bg-teal-950",
    badgeTextDark: "dark:text-teal-400",
    avatarBg: "bg-teal-600",
    avatarText: "text-white",
  },
  green: {
    key: "green",
    label: "Staff",
    cssClass: "role-green",
    sidebarBorder: "border-green-200",
    sidebarBorderDark: "dark:border-green-900",
    sidebarHeaderBg: "bg-green-50/50",
    sidebarHeaderBgDark: "dark:bg-green-950/30",
    iconColor: "text-green-600",
    iconColorDark: "dark:text-green-400",
    activeItemBg: "data-[active=true]:bg-green-100",
    activeItemText: "data-[active=true]:text-green-800",
    activeItemBgDark: "dark:data-[active=true]:bg-green-950",
    activeItemTextDark: "dark:data-[active=true]:text-green-300",
    hoverBg: "hover:bg-green-50",
    hoverBgDark: "dark:hover:bg-green-950/50",
    hoverText: "hover:text-green-700",
    hoverTextDark: "dark:hover:text-green-400",
    groupLabelColor: "text-green-600",
    groupLabelColorDark: "dark:text-green-400",
    badgeBg: "bg-green-100",
    badgeText: "text-green-700",
    badgeBgDark: "dark:bg-green-950",
    badgeTextDark: "dark:text-green-400",
    avatarBg: "bg-green-600",
    avatarText: "text-white",
  },
  gray: {
    key: "gray",
    label: "Read Only",
    cssClass: "role-gray",
    sidebarBorder: "border-gray-200",
    sidebarBorderDark: "dark:border-gray-800",
    sidebarHeaderBg: "bg-gray-50/50",
    sidebarHeaderBgDark: "dark:bg-gray-950/30",
    iconColor: "text-gray-500",
    iconColorDark: "dark:text-gray-400",
    activeItemBg: "data-[active=true]:bg-gray-100",
    activeItemText: "data-[active=true]:text-gray-800",
    activeItemBgDark: "dark:data-[active=true]:bg-gray-900",
    activeItemTextDark: "dark:data-[active=true]:text-gray-300",
    hoverBg: "hover:bg-gray-50",
    hoverBgDark: "dark:hover:bg-gray-900/50",
    hoverText: "hover:text-gray-700",
    hoverTextDark: "dark:hover:text-gray-400",
    groupLabelColor: "text-gray-500",
    groupLabelColorDark: "dark:text-gray-400",
    badgeBg: "bg-gray-100",
    badgeText: "text-gray-700",
    badgeBgDark: "dark:bg-gray-800",
    badgeTextDark: "dark:text-gray-400",
    avatarBg: "bg-gray-500",
    avatarText: "text-white",
  },
};

const ROLE_TO_THEME: Record<string, RoleThemeKey> = {
  super_admin: "red",
  firm_admin: "orange",
  admin: "blue",
  partner: "purple",
  managing_partner: "purple",
  eqcr: "purple",
  manager: "blue",
  team_lead: "teal",
  senior: "teal",
  staff: "green",
  read_only: "gray",
  client: "gray",
};

const ALL_ROLE_CSS_CLASSES = Object.values(ROLE_THEMES).map(t => t.cssClass);

export function getRoleThemeKey(role: string | undefined | null): RoleThemeKey {
  if (!role) return "blue";
  return ROLE_TO_THEME[role.toLowerCase()] || "blue";
}

export function getRoleTheme(role: string | undefined | null): RoleThemeConfig {
  const key = getRoleThemeKey(role);
  return ROLE_THEMES[key];
}

export function getRoleThemeByKey(key: RoleThemeKey): RoleThemeConfig {
  return ROLE_THEMES[key];
}

export function applyRoleThemeClass(role: string | undefined | null): void {
  const root = document.documentElement;
  ALL_ROLE_CSS_CLASSES.forEach(cls => root.classList.remove(cls));
  const theme = getRoleTheme(role);
  root.classList.add(theme.cssClass);
}

export function clearRoleThemeClass(): void {
  const root = document.documentElement;
  ALL_ROLE_CSS_CLASSES.forEach(cls => root.classList.remove(cls));
}

export function getRoleActiveItemClasses(theme: RoleThemeConfig): string {
  return `${theme.activeItemBg} ${theme.activeItemText} ${theme.activeItemBgDark} ${theme.activeItemTextDark} ${theme.hoverBg} ${theme.hoverBgDark} ${theme.hoverText} ${theme.hoverTextDark}`;
}

export function getRoleIconClasses(theme: RoleThemeConfig): string {
  return `${theme.iconColor} ${theme.iconColorDark}`;
}

export function getRoleBadgeClasses(theme: RoleThemeConfig): string {
  return `${theme.badgeBg} ${theme.badgeText} ${theme.badgeBgDark} ${theme.badgeTextDark}`;
}

export function getRoleSidebarClasses(theme: RoleThemeConfig): {
  border: string;
  headerBg: string;
  footerBg: string;
} {
  return {
    border: `${theme.sidebarBorder} ${theme.sidebarBorderDark}`,
    headerBg: `${theme.sidebarHeaderBg} ${theme.sidebarHeaderBgDark}`,
    footerBg: `${theme.sidebarHeaderBg} ${theme.sidebarHeaderBgDark}`,
  };
}

export function getRoleDisplayLabel(role: string | undefined | null): string {
  if (!role) return "User";
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    firm_admin: "Firm Admin",
    admin: "Admin",
    partner: "Partner",
    managing_partner: "Managing Partner",
    eqcr: "EQCR",
    manager: "Manager",
    team_lead: "Team Lead",
    senior: "Senior",
    staff: "Staff",
    read_only: "Read Only",
    client: "Client",
  };
  return labels[role.toLowerCase()] || role;
}

export { ROLE_THEMES, ALL_ROLE_CSS_CLASSES };
