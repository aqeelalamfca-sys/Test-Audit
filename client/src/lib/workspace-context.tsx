import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "./auth";
import { PhaseProgress, getSmartWorkspaceRoute } from "./navigation";
import { fetchWithAuth } from "./fetchWithAuth";

interface Client {
  id: string;
  name: string;
  tradingName?: string;
}

interface TeamMember {
  userId: string;
  role: string;
}

interface MaterialityData {
  overallMateriality?: number;
  performanceMateriality?: number;
  trivialThreshold?: number;
  benchmark?: string;
  benchmarkValue?: number;
  percentage?: number;
}

interface RiskSummary {
  overallEngagementRisk?: string;
  significantRisksCount?: number;
  highRiskAreasCount?: number;
  lastAssessmentDate?: string;
}

interface Engagement {
  id: string;
  engagementCode: string;
  engagementType: string;
  clientId: string;
  fiscalYearEnd: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  currentPhase: string;
  status: string;
  client?: Client;
  phases?: PhaseProgress[];
  team?: TeamMember[];
  materiality?: MaterialityData;
  riskSummary?: RiskSummary;
}

interface AutoSaveState {
  isSaving: boolean;
  lastSavedAt: Date | null;
  lastSavedPhase: string | null;
  lastSavedRoute: string | null;
}

interface SectionSaveState {
  sectionKey: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  hasError: boolean;
}

interface GlobalSaveState {
  sections: Map<string, SectionSaveState>;
  hasAnyUnsaved: boolean;
  isSavingAny: boolean;
  lastGlobalSave: Date | null;
  savingCount: number;
}

interface WorkspaceContextType {
  activeEngagement: Engagement | null;
  activeClient: Client | null;
  clients: Client[];
  userEngagements: Engagement[];
  isLoading: boolean;
  isWorkspacePage: boolean;
  isInWorkspaceMode: boolean;
  currentPhaseRoute: string | null;
  currentEngagementId: string | null;
  selectedClientId?: string | null;
  selectedPeriodId?: string | null;
  isContextSet?: boolean;
  autoSaveState: AutoSaveState;
  globalSaveState: GlobalSaveState;
  setActiveEngagement: (engagement: Engagement | null) => void;
  switchToEngagement: (engagementId: string, preservePhase?: boolean) => void;
  switchToClient: (clientId: string) => void;
  exitWorkspace: () => void;
  getWorkspaceHref: (phase: string) => string;
  refreshEngagement: () => Promise<void>;
  getPhaseStatus: (phase: string) => PhaseProgress | undefined;
  canAccessPhase: (phase: string) => boolean;
  registerSection: (sectionKey: string) => void;
  unregisterSection: (sectionKey: string) => void;
  updateSectionState: (sectionKey: string, state: Partial<SectionSaveState>) => void;
  getSectionState: (sectionKey: string) => SectionSaveState | undefined;
  markSectionDirty: (sectionKey: string, isDirty: boolean) => void;
  markSectionSaving: (sectionKey: string, isSaving: boolean) => void;
  markSectionSaved: (sectionKey: string) => void;
  markSectionError: (sectionKey: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const PHASE_ROUTES_ALL: Record<string, string> = {
  "onboarding": "PRE_PLANNING",
  "ethics": "PRE_PLANNING",
  "requisition": "REQUISITION",
  "import": "REQUISITION",
  "tb-review": "REQUISITION",
  "fs-mapping": "REQUISITION",
  "pre-planning": "PRE_PLANNING",
  "planning": "PLANNING",
  "execution": "EXECUTION",
  "fs-heads": "EXECUTION",
  "observations": "EXECUTION",
  "finalization": "FINALIZATION",
  "deliverables": "REPORTING",
  "outputs": "REPORTING",
  "eqcr": "EQCR",
  "inspection": "INSPECTION",
  "controls": "EXECUTION",
  "substantive": "EXECUTION",
  "analytical": "EXECUTION",
  "evidence": "EXECUTION",
  "audit-health": "EXECUTION",
  "information-requisition": "REQUISITION",
};

const PHASE_ORDER = ["ONBOARDING", "PRE_PLANNING", "REQUISITION", "PLANNING", "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"]; // Note: REQUISITION (Data Intake) comes after PRE_PLANNING in UI but enforcement order preserved

const PHASE_TO_ROUTE: Record<string, string> = {
  "ONBOARDING": "pre-planning",
  "PRE_PLANNING": "pre-planning",
  "REQUISITION": "requisition",
  "PLANNING": "planning",
  "EXECUTION": "execution",
  "FINALIZATION": "finalization",
  "REPORTING": "deliverables",
  "EQCR": "eqcr",
  "INSPECTION": "inspection",
};

interface WorkspacePhase {
  key: string;
  label: string;
  group?: string;
  isPrimary?: boolean;
}

export const WORKSPACE_PHASES: WorkspacePhase[] = [
  { key: "pre-planning", label: "Pre-Planning", group: "Audit Lifecycle" },
  { key: "requisition", label: "Data Intake", group: "Audit Lifecycle" },
  { key: "planning", label: "Planning", group: "Audit Lifecycle" },
  { key: "execution", label: "Execution", group: "Audit Lifecycle" },
  { key: "fs-heads", label: "FS Heads", group: "Audit Lifecycle" },
  { key: "evidence", label: "Evidence", group: "Audit Lifecycle" },
  { key: "finalization", label: "Finalization", group: "Audit Lifecycle" },
  { key: "deliverables", label: "Deliverables", group: "Audit Lifecycle" },
  { key: "eqcr", label: "QR", group: "Audit Lifecycle" },
  { key: "inspection", label: "Inspection", group: "Audit Lifecycle" },
];

export const RESTRICTED_PHASE_ROLES: Record<string, string[]> = {
  "eqcr": ["FIRM_ADMIN", "PARTNER", "MANAGER", "EQCR"],
  "inspection": ["FIRM_ADMIN", "PARTNER", "MANAGER", "EQCR"],
};

export function isPhaseVisible(phaseKey: string, userRole: string): boolean {
  const allowedRoles = RESTRICTED_PHASE_ROLES[phaseKey];
  if (!allowedRoles) return true;
  return allowedRoles.includes(userRole.toUpperCase());
}

interface WorkspaceEngagement {
  engagementId: string;
  engagementCode: string;
  engagementType: string;
  periodStart: string | null;
  periodEnd: string | null;
  fiscalYearEnd: string | null;
  currentPhase: string;
  status: string;
  clientId: string;
  clientName: string;
  clientTradingName?: string;
  phases?: PhaseProgress[];
  team?: TeamMember[];
}

async function fetchWorkspaceEngagements(): Promise<Engagement[]> {
  const res = await fetchWithAuth("/api/workspace/engagements");
  if (!res.ok) throw new Error("Failed to fetch workspace engagements");
  const data: WorkspaceEngagement[] = await res.json();
  return data.map(e => ({
    id: e.engagementId,
    engagementCode: e.engagementCode,
    engagementType: e.engagementType,
    clientId: e.clientId,
    fiscalYearEnd: e.fiscalYearEnd,
    periodStart: e.periodStart,
    periodEnd: e.periodEnd,
    currentPhase: e.currentPhase,
    status: e.status,
    client: { id: e.clientId, name: e.clientName, tradingName: e.clientTradingName },
    phases: e.phases,
    team: e.team,
  }));
}

async function fetchClients(): Promise<Client[]> {
  const res = await fetchWithAuth("/api/clients/authorized");
  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeEngagement, setActiveEngagement] = useState<Engagement | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
    try { return localStorage.getItem("activeClientId"); } catch { return null; }
  });
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(() => {
    try { return localStorage.getItem("activePeriodId"); } catch { return null; }
  });
  
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    isSaving: false,
    lastSavedAt: null,
    lastSavedPhase: null,
    lastSavedRoute: null,
  });
  
  const [sectionStates, setSectionStates] = useState<Map<string, SectionSaveState>>(new Map());

  const globalSaveState = useMemo<GlobalSaveState>(() => {
    const sections = sectionStates;
    let hasAnyUnsaved = false;
    let isSavingAny = false;
    let savingCount = 0;
    let lastGlobalSave: Date | null = null;

    sections.forEach((state) => {
      if (state.isDirty) hasAnyUnsaved = true;
      if (state.isSaving) {
        isSavingAny = true;
        savingCount++;
      }
      if (state.lastSavedAt && (!lastGlobalSave || state.lastSavedAt > lastGlobalSave)) {
        lastGlobalSave = state.lastSavedAt;
      }
    });

    return { sections, hasAnyUnsaved, isSavingAny, lastGlobalSave, savingCount };
  }, [sectionStates]);

  const registerSection = useCallback((sectionKey: string) => {
    setSectionStates(prev => {
      if (prev.has(sectionKey)) return prev;
      const next = new Map(prev);
      next.set(sectionKey, {
        sectionKey,
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
        hasError: false,
      });
      return next;
    });
  }, []);

  const unregisterSection = useCallback((sectionKey: string) => {
    setSectionStates(prev => {
      if (!prev.has(sectionKey)) return prev;
      const next = new Map(prev);
      next.delete(sectionKey);
      return next;
    });
  }, []);

  const updateSectionState = useCallback((sectionKey: string, state: Partial<SectionSaveState>) => {
    setSectionStates(prev => {
      const existing = prev.get(sectionKey);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(sectionKey, { ...existing, ...state });
      return next;
    });
  }, []);

  const getSectionState = useCallback((sectionKey: string): SectionSaveState | undefined => {
    return sectionStates.get(sectionKey);
  }, [sectionStates]);

  const markSectionDirty = useCallback((sectionKey: string, isDirty: boolean) => {
    updateSectionState(sectionKey, { isDirty, hasError: false });
  }, [updateSectionState]);

  const markSectionSaving = useCallback((sectionKey: string, isSaving: boolean) => {
    updateSectionState(sectionKey, { isSaving });
  }, [updateSectionState]);

  const markSectionSaved = useCallback((sectionKey: string) => {
    updateSectionState(sectionKey, { 
      isDirty: false, 
      isSaving: false, 
      lastSavedAt: new Date(), 
      hasError: false 
    });
  }, [updateSectionState]);

  const markSectionError = useCallback((sectionKey: string) => {
    updateSectionState(sectionKey, { isSaving: false, hasError: true });
  }, [updateSectionState]);

  const workspaceMatch = location.match(/\/workspace\/([^/]+)(?:\/([^/]+))?/);
  const legacyMatch = location.match(/\/engagement\/([^/]+)(?:\/([^/]+))?/);
  const currentEngagementId = workspaceMatch?.[1] || legacyMatch?.[1] || null;
  const currentPhaseRoute = workspaceMatch?.[2] || legacyMatch?.[2] || null;
  const isInWorkspaceMode = location.startsWith("/workspace/");
  const isWorkspacePage = !!currentEngagementId && !!currentPhaseRoute && !!PHASE_ROUTES_ALL[currentPhaseRoute];

  const { data: engagementsData, isLoading: engagementsLoading } = useQuery<Engagement[]>({
    queryKey: ["/api/workspace/engagements"],
    queryFn: fetchWorkspaceEngagements,
    enabled: !!user,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: fetchClients,
    enabled: !!user,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const userEngagements = useMemo(() => {
    return engagementsData || [];
  }, [engagementsData]);

  const clients = useMemo(() => {
    const clientIds = new Set(userEngagements.map(e => e.clientId));
    return (clientsData || []).filter(c => clientIds.has(c.id));
  }, [clientsData, userEngagements]);

  const isLoading = engagementsLoading || clientsLoading;

  // Keep activeEngagement in sync with URL when present
  useEffect(() => {
    if (currentEngagementId && userEngagements.length > 0) {
      const eng = userEngagements.find(e => e.id === currentEngagementId);
      if (eng && eng.id !== activeEngagement?.id) {
        setActiveEngagement(eng);
        // also persist selected period
        try { localStorage.setItem("activePeriodId", eng.id); setSelectedPeriodId(eng.id); } catch {}
      }
    } else if (!currentEngagementId) {
      setActiveEngagement(null);
    }
  }, [currentEngagementId, userEngagements, activeEngagement?.id]);

  // Auto-save route progress when navigating within a workspace
  useEffect(() => {
    if (!currentEngagementId || !currentPhaseRoute || !isWorkspacePage) return;
    
    const currentPhase = PHASE_ROUTES_ALL[currentPhaseRoute];
    if (!currentPhase) return;

    const saveProgress = async () => {
      setAutoSaveState(prev => ({ ...prev, isSaving: true }));
      try {
        const res = await fetchWithAuth(`/api/engagements/${currentEngagementId}/progress`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastRoute: location,
            lastPhase: currentPhase,
          }),
        });
        if (res.ok) {
          setAutoSaveState({ isSaving: false, lastSavedAt: new Date(), lastSavedPhase: currentPhase, lastSavedRoute: currentPhaseRoute });
        } else {
          setAutoSaveState(prev => ({ ...prev, isSaving: false }));
        }
      } catch (error) {
        console.warn("Failed to save route progress:", error);
        setAutoSaveState(prev => ({ ...prev, isSaving: false }));
      }
    };

    // Short debounce to avoid excessive API calls during rapid navigation
    const timeoutId = setTimeout(saveProgress, 300);
    return () => clearTimeout(timeoutId);
  }, [currentEngagementId, currentPhaseRoute, location, isWorkspacePage]);

  // When userEngagements/clients load, try to restore selected ids from storage
  useEffect(() => {
    try {
      if (selectedClientId) {
        // validate the selected client is still accessible
        const clientExists = clients.some(c => c.id === selectedClientId);
        if (!clientExists) {
          setSelectedClientId(null);
          localStorage.removeItem("activeClientId");
          setSelectedPeriodId(null);
          localStorage.removeItem("activePeriodId");
        }
      }

      if (selectedPeriodId) {
        const eng = userEngagements.find(e => e.id === selectedPeriodId);
        if (eng) {
          setActiveEngagement(eng);
        } else {
          setSelectedPeriodId(null);
          localStorage.removeItem("activePeriodId");
        }
      }
    } catch (e) {
      // ignore storage errors
    }
  }, [clients, userEngagements]);


  const activeClient = useMemo(() => {
    if (selectedClientId) return clients.find(c => c.id === selectedClientId) || null;
    if (!activeEngagement) return null;
    return activeEngagement.client || clients.find(c => c.id === activeEngagement.clientId) || null;
  }, [activeEngagement, clients, selectedClientId]);

  const isContextSet = useMemo(() => {
    return !!selectedClientId && !!selectedPeriodId;
  }, [selectedClientId, selectedPeriodId]);


  const getNextUnlockedPhase = useCallback((phases: PhaseProgress[] | undefined, startingPhase: string): string => {
    if (!phases) return "pre-planning";
    
    const startIndex = PHASE_ORDER.indexOf(startingPhase);
    if (startIndex === -1) return "pre-planning";
    
    for (let i = startIndex; i < PHASE_ORDER.length; i++) {
      const phaseName = PHASE_ORDER[i];
      const phaseData = phases.find(p => p.phase === phaseName);
      const isLocked = phaseData?.lockedAt || phaseData?.status === "COMPLETED";
      if (!isLocked) {
        return PHASE_TO_ROUTE[phaseName] || "pre-planning";
      }
    }
    
    for (let i = 0; i < startIndex; i++) {
      const phaseName = PHASE_ORDER[i];
      const phaseData = phases.find(p => p.phase === phaseName);
      const isLocked = phaseData?.lockedAt || phaseData?.status === "COMPLETED";
      if (!isLocked) {
        return PHASE_TO_ROUTE[phaseName] || "pre-planning";
      }
    }
    
    return "pre-planning";
  }, []);

  const switchToEngagement = useCallback((engagementId: string, preservePhase = true) => {
    const targetEngagement = userEngagements.find(e => e.id === engagementId);
    if (!targetEngagement) return;

    // persist selected period
    try { localStorage.setItem("activePeriodId", engagementId); setSelectedPeriodId(engagementId); } catch {}

    // Persist selection server-side
    (async () => {
      try {
        await fetchWithAuth("/api/auth/me/context", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activePeriodId: engagementId }),
        });
      } catch (e) { console.warn("Failed to persist period selection:", e); }
    })();

    try {
      const engagementScopedPrefixes = [
        "/api/gl", "/api/tb", "/api/planning", "/api/execution",
        "/api/finalization", "/api/evidence", "/api/observations",
        "/api/fs-heads", "/api/controls", "/api/sampling",
        "/api/materiality", "/api/risk", "/api/compliance",
        "/api/audit-program", "/api/deliverables", "/api/progress",
        "/api/data-hub"
      ];
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/engagements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" &&
            engagementScopedPrefixes.some(p => key.startsWith(p));
        }
      });
    } catch (e) {}
    if (preservePhase && currentPhaseRoute) {
      const targetPhaseUpperCase = PHASE_ROUTES_ALL[currentPhaseRoute];
      
      if (targetPhaseUpperCase) {
        const phaseData = targetEngagement.phases?.find(p => p.phase === targetPhaseUpperCase);
        const isLocked = phaseData?.lockedAt || phaseData?.status === "COMPLETED";
        
        if (!isLocked) {
          setLocation(`/workspace/${engagementId}/${currentPhaseRoute}`);
          setActiveEngagement(targetEngagement);
          return;
        }
        
        const nextRoute = getNextUnlockedPhase(targetEngagement.phases, targetPhaseUpperCase);
        setLocation(`/workspace/${engagementId}/${nextRoute}`);
        setActiveEngagement(targetEngagement);
        return;
      }
    }

    setLocation(`/workspace/${engagementId}/pre-planning`);
    setActiveEngagement(targetEngagement);
  }, [userEngagements, currentPhaseRoute, setLocation, getNextUnlockedPhase]);

  const switchToClient = useCallback((clientId: string) => {
    // When switching client from the global selector, clear any selected period
    try { localStorage.setItem("activeClientId", clientId); setSelectedClientId(clientId); } catch {}
    try { localStorage.removeItem("activePeriodId"); setSelectedPeriodId(null); } catch {}

    // Persist selection server-side
    (async () => {
      try {
        await fetchWithAuth("/api/auth/me/context", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeClientId: clientId, activePeriodId: null }),
        });
      } catch (e) { console.warn("Failed to persist client selection:", e); }
    })();

    try {
      const engagementScopedPrefixes = [
        "/api/gl", "/api/tb", "/api/planning", "/api/execution",
        "/api/finalization", "/api/evidence", "/api/observations",
        "/api/fs-heads", "/api/controls", "/api/sampling",
        "/api/materiality", "/api/risk", "/api/compliance",
        "/api/audit-program", "/api/deliverables", "/api/progress",
        "/api/data-hub"
      ];
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/engagements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" &&
            engagementScopedPrefixes.some(p => key.startsWith(p));
        }
      });
    } catch (e) {}

    // Do not auto-navigate - keep selection-driven UX; pages that require a period will prompt the user
  }, []);

  const exitWorkspace = useCallback(() => {
    setLocation("/engagements");
  }, [setLocation]);

  const getWorkspaceHref = useCallback((phase: string): string => {
    if (currentEngagementId) {
      if (phase === "fs-mapping") {
        return `/workspace/${currentEngagementId}/requisition?tab=fs-mapping`;
      }
      return `/workspace/${currentEngagementId}/${phase}`;
    }
    return "/engagements";
  }, [currentEngagementId]);

  const refreshEngagement = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/workspace/engagements"] });
  }, []);

  const getPhaseStatus = useCallback((phase: string): PhaseProgress | undefined => {
    if (!activeEngagement?.phases) return undefined;
    const upperPhase = phase.toUpperCase().replace("-", "_");
    return activeEngagement.phases.find(p => p.phase === upperPhase);
  }, [activeEngagement?.phases]);

  const canAccessPhase = useCallback((_phase: string): boolean => {
    return true;
  }, []);

  const contextValue = useMemo(() => ({
    activeEngagement,
    activeClient,
    clients,
    userEngagements,
    isLoading,
    isWorkspacePage,
    isInWorkspaceMode,
    currentPhaseRoute,
    currentEngagementId,
    selectedClientId,
    selectedPeriodId,
    isContextSet,
    autoSaveState,
    globalSaveState,
    setActiveEngagement,
    switchToEngagement,
    switchToClient,
    exitWorkspace,
    getWorkspaceHref,
    refreshEngagement,
    getPhaseStatus,
    canAccessPhase,
    registerSection,
    unregisterSection,
    updateSectionState,
    getSectionState,
    markSectionDirty,
    markSectionSaving,
    markSectionSaved,
    markSectionError,
  }), [
    activeEngagement,
    activeClient,
    clients,
    userEngagements,
    isLoading,
    isWorkspacePage,
    isInWorkspaceMode,
    currentPhaseRoute,
    currentEngagementId,
    selectedClientId,
    selectedPeriodId,
    isContextSet,
    autoSaveState,
    globalSaveState,
    switchToEngagement,
    switchToClient,
    exitWorkspace,
    getWorkspaceHref,
    refreshEngagement,
    getPhaseStatus,
    canAccessPhase,
    registerSection,
    unregisterSection,
    updateSectionState,
    getSectionState,
    markSectionDirty,
    markSectionSaving,
    markSectionSaved,
    markSectionError,
  ]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}

export function useEngagement() {
  const {
    activeEngagement,
    activeClient,
    currentEngagementId,
    isLoading,
    refreshEngagement,
    getPhaseStatus,
    canAccessPhase,
    autoSaveState,
    globalSaveState,
    registerSection,
    unregisterSection,
    markSectionDirty,
    markSectionSaving,
    markSectionSaved,
    markSectionError,
    getSectionState,
  } = useWorkspace();

  return {
    engagement: activeEngagement,
    engagementId: currentEngagementId,
    client: activeClient,
    isLoading,
    refreshEngagement,
    getPhaseStatus,
    canAccessPhase,
    autoSaveState,
    globalSaveState,
    registerSection,
    unregisterSection,
    markSectionDirty,
    markSectionSaving,
    markSectionSaved,
    markSectionError,
    getSectionState,
    phases: activeEngagement?.phases || [],
    team: activeEngagement?.team || [],
    materiality: activeEngagement?.materiality,
    riskSummary: activeEngagement?.riskSummary,
    fiscalYearEnd: activeEngagement?.fiscalYearEnd,
    periodStart: activeEngagement?.periodStart,
    periodEnd: activeEngagement?.periodEnd,
    currentPhase: activeEngagement?.currentPhase,
    status: activeEngagement?.status,
    engagementCode: activeEngagement?.engagementCode,
    engagementType: activeEngagement?.engagementType,
  };
}

export type { 
  Engagement, 
  Client, 
  TeamMember, 
  PhaseProgress, 
  MaterialityData, 
  RiskSummary, 
  AutoSaveState, 
  SectionSaveState, 
  GlobalSaveState 
};
