/**
 * AuditWise Design System Tokens
 * Single source of truth for all design values
 */

// Spacing scale (4px base unit)
export const spacing = {
  xs: "0.25rem",   // 4px
  sm: "0.5rem",    // 8px
  md: "0.75rem",   // 12px
  lg: "1rem",      // 16px
  xl: "1.5rem",    // 24px
  "2xl": "2rem",   // 32px
  "3xl": "3rem",   // 48px
} as const;

// Typography scale
export const typography = {
  fontSize: {
    xs: "0.75rem",    // 12px
    sm: "0.875rem",   // 14px
    base: "1rem",     // 16px
    lg: "1.125rem",   // 18px
    xl: "1.25rem",    // 20px
    "2xl": "1.5rem",  // 24px
    "3xl": "1.875rem", // 30px
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.75",
  },
} as const;

// Border radius
export const borderRadius = {
  none: "0",
  sm: "0.25rem",     // 4px - default for most elements
  md: "0.375rem",    // 6px - cards, modals
  lg: "0.5rem",      // 8px - large containers
  full: "9999px",    // pills, circles
} as const;

// Shadows
export const shadows = {
  none: "none",
  xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
} as const;

// Z-index scale
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// Standard element sizes
export const sizes = {
  // Input/button heights
  inputSm: "2rem",      // 32px
  inputMd: "2.5rem",    // 40px (default)
  inputLg: "3rem",      // 48px
  
  // Icon sizes
  iconXs: "0.75rem",    // 12px
  iconSm: "1rem",       // 16px
  iconMd: "1.25rem",    // 20px
  iconLg: "1.5rem",     // 24px
  
  // Sidebar
  sidebarWidth: "16rem",      // 256px
  sidebarWidthCollapsed: "4rem", // 64px
  
  // Header
  headerHeight: "3.5rem",     // 56px
  
  // Page container
  pageMaxWidth: "1400px",
  pagePadding: "1.5rem",      // 24px
  
  // Cards
  cardPadding: "1rem",        // 16px
  cardGap: "1rem",            // 16px
} as const;

/**
 * Status color classes (Tailwind CSS)
 * These are the single source of truth for all status indicators
 * Used by StatusBadge and other status display components
 */
export const statusColorClasses = {
  pass: {
    bg: "bg-green-100 dark:bg-green-900/50",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
    combined: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
  warn: {
    bg: "bg-amber-100 dark:bg-amber-900/50",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-700",
    combined: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  fail: {
    bg: "bg-red-100 dark:bg-red-900/50",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
    combined: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
  info: {
    bg: "bg-blue-100 dark:bg-blue-900/50",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
    combined: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  neutral: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-300 dark:border-gray-700",
    combined: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  pending: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-300 dark:border-slate-700",
    combined: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
} as const;

// Audit-specific status mappings
export const auditStatusMap = {
  // Workflow status
  not_started: "neutral",
  in_progress: "info",
  pending_review: "warn",
  approved: "pass",
  rejected: "fail",
  completed: "pass",
  
  // Reconciliation status
  balanced: "pass",
  unbalanced: "fail",
  partial: "warn",
  
  // Evidence status
  obtained: "pass",
  pending: "pending",
  missing: "fail",
  
  // Risk levels
  low: "pass",
  medium: "warn",
  high: "fail",
} as const;

export type StatusType = keyof typeof statusColorClasses;
export type AuditStatus = keyof typeof auditStatusMap;

/**
 * Helper to get status class from audit value
 */
export function getStatusFromAuditValue(value: string): StatusType {
  const lowerValue = value.toLowerCase().replace(/[\s-_]/g, '_');
  return (auditStatusMap[lowerValue as AuditStatus] as StatusType) || "neutral";
}
