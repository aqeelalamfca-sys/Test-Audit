import { useLocation } from "wouter";
import { useMemo } from "react";

export type CoreActionId = "back" | "saveProgress" | "saveNext" | "saveClose";
export type ContextualActionId = string;

export interface ActionGate {
  enabled: boolean;
  reason?: string;
  fixHref?: string;
  fixLabel?: string;
}

export type GateFn = (ctx: ActionContext) => ActionGate;

export interface ActionContext {
  role: string;
  phaseStatus: string;
  hasUnsavedChanges: boolean;
  canNavigateNext: boolean;
  engagementId: string;
  currentTab?: string;
  prerequisites?: Record<string, boolean>;
}

export interface ContextualAction {
  id: ContextualActionId;
  label: string;
  icon?: string;
  placement: "header" | "inline";
  roles?: string[];
  visibleWhen?: (ctx: ActionContext) => boolean;
  gate?: GateFn;
}

export interface RouteActionConfig {
  route: string;
  label: string;
  phase: string;
  backHref: (engagementId: string) => string;
  nextHref?: (engagementId: string) => string;
  dashboardHref: (engagementId: string) => string;
  coreActions: {
    back: boolean;
    saveProgress: boolean;
    saveNext: boolean;
    saveClose: boolean;
  };
  contextualActions: ContextualAction[];
  maxCoreActions: 4;
  maxContextualActions: number;
}

export const ACTION_RULES = {
  maxCoreActions: 4 as const,
  contextualPlacement: "content" as const,
  coreActionOrder: ["back", "saveProgress", "saveNext", "saveClose"] as CoreActionId[],
  barPositions: ["top", "bottom"] as const,
} as const;

export const WORKSPACE_ROUTES = [
  "/workspace/:id/requisition",
  "/workspace/:id/pre-planning",
  "/workspace/:id/planning",
  "/workspace/:id/execution",
  "/workspace/:id/finalization",
  "/workspace/:id/fs-heads",
  "/workspace/:id/tb-review",
  "/workspace/:id/evidence",
  "/workspace/:id/eqcr",
  "/workspace/:id/deliverables",
] as const;

const DASHBOARD = "/engagements";

const ALL_CORE_ENABLED = {
  back: true,
  saveProgress: true,
  saveNext: true,
  saveClose: true,
};

const NO_NEXT_CORE = {
  back: true,
  saveProgress: true,
  saveNext: false,
  saveClose: true,
};

const ROUTE_CONFIGS: RouteActionConfig[] = [
  {
    route: "/workspace/:id/requisition",
    label: "Data Intake",
    phase: "information-requisition",
    backHref: () => DASHBOARD,
    nextHref: (id) => `/workspace/${id}/acceptance`,
    dashboardHref: () => DASHBOARD,
    coreActions: ALL_CORE_ENABLED,
    contextualActions: [
      {
        id: "importData",
        label: "Import Data",
        icon: "Upload",
        placement: "header",
      },
      {
        id: "reconcile",
        label: "Run Reconciliation",
        icon: "RefreshCw",
        placement: "header",
      },
    ],
    maxCoreActions: 4,
    maxContextualActions: 2,
  },
  {
    route: "/workspace/:id/acceptance",
    label: "Acceptance & Continuance",
    phase: "acceptance",
    backHref: (id) => `/workspace/${id}/tb-gl-upload`,
    nextHref: (id) => `/workspace/${id}/materiality`,
    dashboardHref: () => DASHBOARD,
    coreActions: ALL_CORE_ENABLED,
    contextualActions: [],
    maxCoreActions: 4,
    maxContextualActions: 0,
  },
  {
    route: "/workspace/:id/planning",
    label: "Planning",
    phase: "planning",
    backHref: (id) => `/workspace/${id}/acceptance`,
    nextHref: (id) => `/workspace/${id}/execution-testing`,
    dashboardHref: () => DASHBOARD,
    coreActions: ALL_CORE_ENABLED,
    contextualActions: [
      {
        id: "generateFS",
        label: "Generate Financial Statements",
        icon: "FileSpreadsheet",
        placement: "header",
      },
      {
        id: "runMateriality",
        label: "Calculate Materiality",
        icon: "Calculator",
        placement: "header",
      },
    ],
    maxCoreActions: 4,
    maxContextualActions: 2,
  },
  {
    route: "/workspace/:id/execution",
    label: "Execution",
    phase: "execution",
    backHref: (id) => `/workspace/${id}/planning`,
    nextHref: (id) => `/workspace/${id}/finalization`,
    dashboardHref: () => DASHBOARD,
    coreActions: ALL_CORE_ENABLED,
    contextualActions: [
      {
        id: "recompute",
        label: "Recompute Results",
        icon: "RotateCcw",
        placement: "header",
      },
    ],
    maxCoreActions: 4,
    maxContextualActions: 1,
  },
  {
    route: "/workspace/:id/finalization",
    label: "Finalization",
    phase: "finalization",
    backHref: (id) => `/workspace/${id}/execution`,
    nextHref: (id) => `/workspace/${id}/deliverables`,
    dashboardHref: () => DASHBOARD,
    coreActions: ALL_CORE_ENABLED,
    contextualActions: [
      {
        id: "generateNotes",
        label: "Generate Notes/Disclosures",
        icon: "FileText",
        placement: "header",
      },
    ],
    maxCoreActions: 4,
    maxContextualActions: 1,
  },
  {
    route: "/workspace/:id/fs-heads",
    label: "FS Heads",
    phase: "planning",
    backHref: (id) => `/workspace/${id}/planning`,
    dashboardHref: () => DASHBOARD,
    coreActions: NO_NEXT_CORE,
    contextualActions: [
      {
        id: "addProcedure",
        label: "Add Procedure",
        icon: "Plus",
        placement: "header",
      },
      {
        id: "linkEvidence",
        label: "Link Evidence",
        icon: "Link",
        placement: "header",
      },
    ],
    maxCoreActions: 4,
    maxContextualActions: 2,
  },
  {
    route: "/workspace/:id/tb-review",
    label: "TB Review",
    phase: "information-requisition",
    backHref: (id) => `/workspace/${id}/requisition`,
    dashboardHref: () => DASHBOARD,
    coreActions: NO_NEXT_CORE,
    contextualActions: [
      {
        id: "reconcileGL",
        label: "Reconcile GL",
        icon: "CheckCircle",
        placement: "header",
      },
    ],
    maxCoreActions: 4,
    maxContextualActions: 1,
  },
  {
    route: "/workspace/:id/evidence",
    label: "Evidence Vault",
    phase: "cross-phase",
    backHref: () => "",
    dashboardHref: () => DASHBOARD,
    coreActions: NO_NEXT_CORE,
    contextualActions: [
      {
        id: "uploadEvidence",
        label: "Upload Evidence",
        icon: "Upload",
        placement: "header",
      },
      {
        id: "linkToPhase",
        label: "Link to Phase",
        icon: "Link2",
        placement: "header",
      },
    ],
    maxCoreActions: 4,
    maxContextualActions: 2,
  },
  {
    route: "/workspace/:id/eqcr",
    label: "EQCR",
    phase: "finalization",
    backHref: (id) => `/workspace/${id}/finalization`,
    dashboardHref: () => DASHBOARD,
    coreActions: NO_NEXT_CORE,
    contextualActions: [],
    maxCoreActions: 4,
    maxContextualActions: 0,
  },
  {
    route: "/workspace/:id/deliverables",
    label: "Deliverables",
    phase: "finalization",
    backHref: (id) => `/workspace/${id}/finalization`,
    dashboardHref: () => DASHBOARD,
    coreActions: NO_NEXT_CORE,
    contextualActions: [
      {
        id: "exportPDF",
        label: "Export PDF",
        icon: "FileDown",
        placement: "header",
      },
      {
        id: "generateReport",
        label: "Generate Report",
        icon: "FileOutput",
        placement: "header",
      },
    ],
    maxCoreActions: 4,
    maxContextualActions: 2,
  },
];

function matchRoute(pattern: string, path: string): string | null {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return null;

  let engagementId: string | null = null;

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === ":id" || patternParts[i] === ":engagementId") {
      engagementId = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return engagementId;
}

export function getRouteConfig(routePath: string): RouteActionConfig | null {
  for (const config of ROUTE_CONFIGS) {
    if (matchRoute(config.route, routePath) !== null) {
      return config;
    }
  }
  return null;
}

function extractEngagementId(path: string): string {
  const parts = path.split("/");
  const wsIndex = parts.indexOf("workspace");
  if (wsIndex !== -1 && wsIndex + 1 < parts.length) {
    return parts[wsIndex + 1];
  }
  return "";
}

export function useActionRegistry() {
  const [location] = useLocation();

  return useMemo(() => {
    const engagementId = extractEngagementId(location);
    const config = getRouteConfig(location);

    function getCoreActionProps() {
      if (!config) return null;

      const backHref = config.backHref(engagementId);

      return {
        backHref: backHref || undefined,
        nextHref: config.nextHref ? config.nextHref(engagementId) : undefined,
        dashboardHref: config.dashboardHref(engagementId),
        showBack: config.coreActions.back,
        showSaveProgress: config.coreActions.saveProgress,
        showSaveNext: config.coreActions.saveNext,
        showSaveClose: config.coreActions.saveClose,
      };
    }

    function getContextualActions(ctx: ActionContext): (ContextualAction & { gateResult: ActionGate })[] {
      if (!config) return [];

      return config.contextualActions
        .filter((action) => {
          if (action.roles && action.roles.length > 0 && !action.roles.includes(ctx.role)) {
            return false;
          }
          if (action.visibleWhen && !action.visibleWhen(ctx)) {
            return false;
          }
          return true;
        })
        .map((action) => ({
          ...action,
          gateResult: action.gate
            ? action.gate(ctx)
            : { enabled: true },
        }));
    }

    return {
      config,
      engagementId,
      getCoreActionProps,
      getContextualActions,
    };
  }, [location]);
}

export interface PageShellRegistryProps {
  backHref?: string;
  nextHref?: string;
  dashboardHref?: string;
  showBack: boolean;
  showSaveProgress: boolean;
  showSaveNext: boolean;
  showSaveClose: boolean;
}

export function usePageShellRegistry(): PageShellRegistryProps | null {
  const { config, engagementId } = useActionRegistry();

  return useMemo(() => {
    if (!config) return null;

    const backHref = config.backHref(engagementId);

    return {
      backHref: backHref || undefined,
      nextHref: config.nextHref ? config.nextHref(engagementId) : undefined,
      dashboardHref: config.dashboardHref(engagementId),
      showBack: config.coreActions.back,
      showSaveProgress: config.coreActions.saveProgress,
      showSaveNext: config.coreActions.saveNext,
      showSaveClose: config.coreActions.saveClose,
    };
  }, [config, engagementId]);
}
