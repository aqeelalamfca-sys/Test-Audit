import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ModuleTemplates } from "@/components/module-templates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChecklistTable, ChecklistItem, createDefaultChecklistItems } from "@/components/ChecklistTable";
import { AccordionFormSection, FormSectionItem, createDefaultFormSectionItems } from "@/components/AccordionFormSection";
import { AuditProgramSection, AccountHeadProgram, createDefaultAuditPrograms } from "@/components/AuditProgramSection";
import { PageShell } from "@/components/page-shell";
import { GLWorkflow } from "@/components/GLWorkflow";
import { useModuleReadOnly } from "@/components/sign-off-bar";
import { usePlanningSaveBridge } from "@/hooks/use-planning-save-bridge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEngagement } from "@/lib/workspace-context";
import { 
  Calculator, Target, FileText, AlertTriangle, Building2,
  Upload, CheckCircle2, Shield, Scale, FileCheck,
  Lock, UserCheck, Calendar, ClipboardList, AlertCircle,
  ArrowRight, Database, Brain, TrendingUp, BarChart3, FileSpreadsheet,
  Briefcase, MessageSquare, Activity, RefreshCw, Info,
  Plus, Trash2, Download, ExternalLink, ChevronDown, ChevronRight, FileOutput, Loader2, Link2,
  Layers, CircleDashed, ArrowUpDown, Users, Network, GraduationCap
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AIAssistButton } from "@/components/ui/ai-assist-button";
import { Sparkles } from "lucide-react";
import { PhaseApprovalControl, PhaseLockIndicator } from "@/components/phase-approval-control";
import { SyncPlanningToExecution } from "@/components/sync-planning-to-execution";
import { MaterialitySetPanel, AuditPlanPanel, ProceduresMatrixPanel } from "@/components/control-pack";
import { ISA320MaterialityPanel as ISA320MaterialityPanelNew } from "@/components/planning/isa320-materiality-panel";
import { ISA300StrategyPanel } from "@/components/isa300-strategy-panel";
import ISA530SamplingPanel from "@/components/isa530-sampling-panel";
import {
  EngagementTeamSection,
  getDefaultEngagementTeamData,
} from "@/components/preplanning-wizard";
import type { EngagementTeamData } from "@/components/preplanning-wizard";
import { AuditProgramPanel } from "@/components/audit-program-panel";
import { LinkageMonitorPanel } from "@/components/linkage-monitor-panel";

import { formatAccounting } from '@/lib/formatters';

import type { CoAAccountData } from "@/components/planning/fs-types";
import { PlanningDashboard } from "@/components/planning/planning-dashboard";
import { SignificantAccountsPanel } from "@/components/planning/significant-accounts-panel";
import { FraudRiskPanel } from "@/components/planning/fraud-risk-panel";
import { InternalControlsPanel } from "@/components/planning/internal-controls-panel";
import { LawsRegulationsPanel } from "@/components/planning/laws-regulations-panel";
import { GoingConcernPanel } from "@/components/planning/going-concern-panel";
import { TeamPlanningPanel } from "@/components/planning/team-planning-panel";
import { PlanningMemoPanel } from "@/components/planning/planning-memo-panel";
import { RelatedPartiesPanel } from "@/components/planning/related-parties-panel";
import { AnalyticalProceduresPanel } from "@/components/planning/analytical-procedures-panel";
import { FinancialStatementsPanel } from "@/components/planning/financial-statements-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AIPromptType = "entity_understanding" | "risk_description" | "audit_procedure" | "observation_wording" | "deficiency_narrative" | "audit_summary" | "management_letter_point" | "variance_explanation" | "materiality_rationale";

const FIELD_PROMPT_MAP: Record<string, AIPromptType> = {
  narrativeSteps: "entity_understanding",
  auditStrategyImpact: "audit_procedure",
  qualityObjectives: "audit_procedure",
  fraudRiskAssessment: "risk_description",
  benchmarkRationale: "materiality_rationale",
  overallStrategy: "audit_procedure",
  keyAuditMatters: "audit_summary",
  responseToSignificantRisks: "risk_description",
  populationDefinition: "audit_procedure",
  sampleSizeCalculation: "audit_procedure",
  stratificationApproach: "audit_procedure",
  managementPlans: "entity_understanding",
  relatedPartyTransactions: "entity_understanding",
  relatedPartyRisks: "risk_description",
  estimatesDescription: "entity_understanding",
  estimateRisks: "risk_description",
  groupAuditScope: "audit_procedure",
  expertNature: "entity_understanding",
  internalAuditReliance: "audit_procedure",
  lawsRegulations: "entity_understanding",
  subsequentEvents: "entity_understanding",
  auditCommitteePlan: "audit_summary",
  communicationPlan: "audit_summary",
  followUpProcedures: "audit_procedure",
  qualityPlan: "audit_procedure",
  supervisionLevel: "audit_procedure",
  reviewProcedures: "audit_procedure",
  competenceAssessment: "audit_procedure",
  independenceMonitoring: "audit_procedure",
  documentationStandards: "audit_procedure",
  fileOrganization: "audit_procedure",
  retentionPolicy: "audit_procedure",
  crossReferencingPlan: "audit_procedure",
};

function getPromptType(fieldName: string): AIPromptType {
  return FIELD_PROMPT_MAP[fieldName] || "audit_procedure";
}

export default function Planning() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client, 
    getPhaseStatus,
    canAccessPhase,
    materiality: contextMateriality,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { isReadOnly: planningReadOnly } = useModuleReadOnly("PLANNING", "PLANNING");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem(`planning-active-tab-${engagementId}`);
    if (saved === "balance-sheet" || saved === "profit-loss" || saved === "gl-tb-data") {
      return "financial-statements";
    }
    if (saved === "entity" || saved === "walkthroughs" || saved === "control-pack") {
      return "entity-controls";
    }
    if (saved === "risk" || saved === "going-concern") {
      return "risk-assessment";
    }
    if (saved === "analytical" || saved === "preliminary-analytics") {
      return "analytical-procedures";
    }
    if (saved === "strategy") {
      return "strategy-approach";
    }
    if (saved === "related-parties" || saved === "accounting-estimates" || saved === "group-audits" || saved === "experts" || saved === "specialized-areas") {
      return "related-parties";
    }
    if (saved === "quality" || saved === "documentation" || saved === "signoff" || saved === "initiation" || saved === "qc-checklist" || saved === "checklists") {
      return "planning-memo";
    }
    if (saved === "sampling") {
      return "audit-program";
    }
    if (saved === "tcwg-communication" || saved === "team-quality") {
      return "team-planning";
    }
    if (window.location.pathname.includes("/materiality")) return "materiality";
    const validTabs = ["planning-dashboard", "financial-statements", "entity-controls", "analytical-procedures", "materiality", "significant-accounts", "risk-assessment", "fraud-risk", "internal-controls", "related-parties", "laws-regulations", "going-concern", "team-planning", "strategy-approach", "audit-program", "planning-memo"];
    if (validTabs.includes(saved || "")) return saved as string;
    return "planning-dashboard";
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entitySubTab, setEntitySubTab] = useState("entity-understanding");
  const [isUploading, setIsUploading] = useState(false);
  const [tbData, setTbData] = useState<any>(null);
  const [loadingTbData, setLoadingTbData] = useState(false);
  
  // Field Registry Recompute state
  const [isRecomputingFields, setIsRecomputingFields] = useState(false);
  
  // Phase 3 Output Generation state per tab
  const [generatingTab, setGeneratingTab] = useState<string | null>(null);
  
  // Tab ID mapping for Phase 3 output generation
  const TAB_CONFIG = {
    "financial-statements": { tabId: "fs", label: "Financial Statements" },
    "entity-controls": { tabId: "entity", label: "Understanding Entity & Internal Controls" },
    "risk-assessment": { tabId: "risk", label: "Risk Assessment" },
    "analytical-procedures": { tabId: "analytics", label: "Analytical Procedures" },
    "materiality": { tabId: "materiality", label: "Materiality" },
    "strategy-approach": { tabId: "strategy", label: "Audit Strategy & Approach" },
    "audit-program": { tabId: "program", label: "Audit Program" },
    "tcwg-communication": { tabId: "tcwg", label: "Communication with TCWG" },
    "quality-control": { tabId: "qc", label: "Quality Control & Planning Review" },
  } as const;
  
  const handleGeneratePhase3Outputs = async (tabKey: keyof typeof TAB_CONFIG) => {
    if (!engagementId) {
      toast({ title: "Error", description: "No engagement selected.", variant: "destructive" });
      return;
    }
    
    const config = TAB_CONFIG[tabKey];
    setGeneratingTab(config.tabId);
    
    try {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/outputs/generate-phase3`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tabId: config.tabId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate outputs");
      }
      
      const result = await response.json();
      toast({
        title: "Outputs Generated",
        description: result.message || `Generated ${config.label} outputs successfully.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "outputs"] });
    } catch (error) {
      console.error("Generate Phase 3 outputs failed:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate outputs.",
        variant: "destructive",
      });
    } finally {
      setGeneratingTab(null);
    }
  };
  
  const handleRecomputeFields = async () => {
    if (!engagementId) {
      toast({ title: "Error", description: "No engagement selected.", variant: "destructive" });
      return;
    }
    
    setIsRecomputingFields(true);
    try {
      const response = await fetchWithAuth(`/api/field-registry/engagements/${engagementId}/computed-fields/recompute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to recompute fields");
      }
      
      const result = await response.json();
      toast({
        title: "Fields Recomputed",
        description: result.message || "All computed fields have been updated.",
      });
    } catch (error) {
      console.error("Recompute fields failed:", error);
      toast({
        title: "Recompute Failed",
        description: error instanceof Error ? error.message : "Failed to recompute fields.",
        variant: "destructive",
      });
    } finally {
      setIsRecomputingFields(false);
    }
  };

  const safeNum = (v: string | undefined | null): number =>
    parseFloat(String(v ?? '').replace(/,/g, '')) || 0;

  // Section 0: Trial Balance Data
  const [trialBalance, setTrialBalance] = useState({
    fileUploaded: false,
    fileName: "",
    reportingPeriodEnd: "",
    currency: "PKR",
    validationStatus: "pending",
    profitBeforeTax: "",
    revenue: "",
    totalAssets: "",
    totalEquity: "",
    aiObservations: "",
    professionalNotes: ""
  });

  // Financial Statement Prior Year Values (Opening Balances - editable)
  const [fsPriorYear, setFsPriorYear] = useState({
    // Balance Sheet - Assets
    propertyPlantEquipment: "",
    intangibleAssets: "",
    inventories: "",
    tradeReceivables: "",
    cashBankBalances: "",
    // Balance Sheet - Equity & Liabilities
    shareCapital: "",
    retainedEarnings: "",
    // Profit & Loss
    revenue: "",
    costOfSales: "",
    adminExpenses: "",
    distributionCosts: "",
    otherOperatingIncome: "",
    financeIncome: "",
    financeCosts: "",
    incomeTax: "",
  });

  // Track which prior year values differ from TB/GL opening balances
  const [fsPriorYearDifferences, setFsPriorYearDifferences] = useState<Record<string, boolean>>({});

  // Draft FS data fetched from Data Intake
  interface DraftFSLineItem {
    fsLineItem: string;
    displayName: string;
    originalTotal: number;
    adjustedTotal: number;
    accountCount: number;
    notesRef?: string;
    openingTotal?: number;
  }
  interface DraftFSSection {
    sectionName: string;
    displayOrder: number;
    isSubtotal: boolean;
    lineItems: DraftFSLineItem[];
    sectionOriginalTotal: number;
    sectionAdjustedTotal: number;
  }
  interface DraftFSData {
    balanceSheet: {
      sections: DraftFSSection[];
      totalAssets: number;
      totalEquityLiabilities: number;
      isBalanced: boolean;
      variance: number;
    };
    profitLoss: {
      sections: DraftFSSection[];
      revenue: number;
      expenses: number;
      netProfit: number;
    };
    summary: {
      totalMappedAccounts: number;
      totalUnmappedAccounts: number;
      mappingCompleteness: number;
      generatedAt: string;
    };
    keywordTotals: {
      totalAssets: number;
      totalLiabilities: number;
      totalEquity: number;
      totalIncome: number;
      totalExpenses: number;
    };
    fsHeads: Array<{
      fsLineItem: string;
      displayName: string;
      accountCount: number;
      debitTotal: number;
      creditTotal: number;
      netBalance: number;
      adjustedNetBalance: number;
    }>;
  }
  // Auto-fetch Draft FS data with real-time updates
  const { data: draftFsData, isLoading: isFetchingDraftFs, error: draftFsQueryError, refetch: refetchDraftFs } = useQuery<DraftFSData>({
    queryKey: ['/api/fs-draft', engagementId],
    queryFn: async () => {
      if (!engagementId) throw new Error("No engagement ID");
      const response = await fetchWithAuth(`/api/fs-draft/${engagementId}?viewType=ADJUSTED`);
      if (!response.ok) {
        throw new Error("Failed to fetch Draft FS data");
      }
      return response.json();
    },
    enabled: !!engagementId,
    refetchInterval: 5000, // Real-time update every 5 seconds
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });

  const { data: coaAccountsRaw } = useQuery<CoAAccountData[]>({
    queryKey: ['/api/engagements', engagementId, 'coa'],
    queryFn: async () => {
      if (!engagementId) throw new Error("No engagement ID");
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/coa`);
      if (!response.ok) throw new Error("Failed to fetch CoA data");
      return response.json();
    },
    enabled: !!engagementId && (activeTab === 'financial-statements' || activeTab === 'risk-assessment'),
    staleTime: 10000,
  });
  const coaAccounts: CoAAccountData[] = coaAccountsRaw || [];

  // Update trial balance when draft FS data changes
  useEffect(() => {
    if (draftFsData) {
      const kt = draftFsData.keywordTotals;
      if (kt) {
        const totalAssets = kt.totalAssets || 0;
        const totalEquity = kt.totalEquity || 0;
        const revenue = kt.totalIncome || 0;
        const totalExpenses = kt.totalExpenses || 0;
        const pbt = revenue - totalExpenses;
        const hasData = totalAssets > 0 || totalEquity > 0 || revenue > 0;
        setTrialBalance(prev => ({
          ...prev,
          totalAssets: totalAssets ? totalAssets.toString() : prev.totalAssets,
          totalEquity: totalEquity ? totalEquity.toString() : prev.totalEquity,
          revenue: revenue ? revenue.toString() : prev.revenue,
          profitBeforeTax: pbt ? pbt.toString() : prev.profitBeforeTax,
          fileUploaded: hasData || prev.fileUploaded,
          validationStatus: hasData ? "complete" : prev.validationStatus,
        }));
      } else {
        if (draftFsData.balanceSheet) {
          setTrialBalance(prev => ({
            ...prev,
            totalAssets: draftFsData.balanceSheet.totalAssets?.toString() || prev.totalAssets,
            totalEquity: draftFsData.balanceSheet.totalEquityLiabilities?.toString() || prev.totalEquity,
          }));
        }
        if (draftFsData.profitLoss) {
          setTrialBalance(prev => ({
            ...prev,
            revenue: draftFsData.profitLoss.revenue?.toString() || prev.revenue,
            profitBeforeTax: draftFsData.profitLoss.netProfit?.toString() || prev.profitBeforeTax,
          }));
        }
      }
    }
  }, [draftFsData]);

  const draftFsError = draftFsQueryError ? (draftFsQueryError instanceof Error ? draftFsQueryError.message : "Failed to fetch Draft FS") : null;

  // Draft FS summary from keyword-based totals (matching Data Intake logic)
  const fsSummary = useMemo(() => {
    // Primary source: keywordTotals from API (computed using same logic as Data Intake)
    if (draftFsData?.keywordTotals) {
      return {
        totalAssets: draftFsData.keywordTotals.totalAssets || 0,
        totalLiabilities: draftFsData.keywordTotals.totalLiabilities || 0,
        totalEquity: draftFsData.keywordTotals.totalEquity || 0,
        totalIncome: draftFsData.keywordTotals.totalIncome || 0,
        totalExpenses: draftFsData.keywordTotals.totalExpenses || 0
      };
    }
    
    // Fallback to section-based calculation if keywordTotals not available
    const findSection = (sections: any[] | undefined, name: string) => 
      sections?.find((s: any) => s.sectionName === name);
    
    const getSectionTotal = (section: any) => section?.sectionAdjustedTotal || section?.sectionOriginalTotal || 0;
    
    const sumSections = (sections: any[] | undefined, names: string[]) =>
      names.reduce((sum, name) => sum + getSectionTotal(findSection(sections, name)), 0);
    
    const bs = draftFsData?.balanceSheet;
    const pl = draftFsData?.profitLoss;
    
    const totalAssets = bs?.totalAssets || getSectionTotal(findSection(bs?.sections, "Total Assets"));
    const totalEquity = getSectionTotal(findSection(bs?.sections, "Share Capital & Reserves"));
    const totalLiabilities = sumSections(bs?.sections, ["Non-Current Liabilities", "Current Liabilities"]);
    const totalIncome = pl?.revenue || getSectionTotal(findSection(pl?.sections, "Total Income"));
    const totalExpenses = pl?.expenses || sumSections(pl?.sections, [
      "Cost of Sales", "Operating Expenses", "Finance Costs", "Tax Expense"
    ]);
    
    return { totalAssets, totalLiabilities, totalEquity, totalIncome, totalExpenses };
  }, [draftFsData]);

  // FS Head list from API for display
  const fsHeadsList = useMemo(() => {
    return draftFsData?.fsHeads || [];
  }, [draftFsData]);

  // Section 1: Planning Initiation
  const [planningInitiation, setPlanningInitiation] = useState({
    planningStartDate: new Date().toISOString().split('T')[0],
    planningCompletionTarget: "",
    planningTeam: [] as string[],
    planningCoordinator: "",
    kickoffMeetingDate: "",
    planningMethodology: "risk-based",
    softwareTools: [] as string[],
    qualityObjectives: ""
  });

  // Task Allocation Matrix
  const [taskAllocation, setTaskAllocation] = useState({
    planningStrategyDueDate: "",
    teamAssignmentDueDate: "",
    qualityObjectivesDueDate: "",
    timelineDevelopmentDueDate: "",
    toolConfigurationDueDate: "",
    documentationSetupDueDate: ""
  });

  // Section 1 Checklists - New format with full item details
  const [isa300Checklist, setIsa300Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-001", checkItem: "ISA 300.8 - Planning activities documented and timely" },
    { refNo: "CHK-002", checkItem: "ISA 300.9 - Audit strategy established" },
    { refNo: "CHK-003", checkItem: "ISA 300.10 - Audit plan developed" },
    { refNo: "CHK-004", checkItem: "ISA 300.11 - Changes to planning documented" },
    { refNo: "CHK-005", checkItem: "ISA 300.12 - Direction, supervision & review planned" }
  ]));
  const [icapEthicsChecklist, setIcapEthicsChecklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-006", checkItem: "ICAP 290 - Independence requirements met" },
    { refNo: "CHK-007", checkItem: "ICAP 220 - Quality control requirements" },
    { refNo: "CHK-008", checkItem: "ICAP 140 - Confidentiality requirements" },
    { refNo: "CHK-009", checkItem: "ICAP 150 - Professional competence requirements" }
  ]));

  // Section 2: Entity Understanding - Using FormSectionItem[] format
  const [entityUnderstandingSections, setEntityUnderstandingSections] = useState<FormSectionItem[]>(createDefaultFormSectionItems([
    { refNo: "SEC-001", title: "Industry Analysis Summary (ISA 315.11)" },
    { refNo: "SEC-002", title: "Regulatory Environment (ISA 250.A2)" },
    { refNo: "SEC-003", title: "Entity Objectives & Strategies (ISA 315.11(c))" },
    { refNo: "SEC-004", title: "Measurement of Performance (ISA 315.11(d))" },
    { refNo: "SEC-005", title: "Internal Control Environment (ISA 315.14)" },
    { refNo: "SEC-006", title: "Information Systems Assessment (ISA 315.17)" },
    { refNo: "SEC-007", title: "Fraud Risk Factors (ISA 240.A1)" },
    { refNo: "SEC-008", title: "Related Party Relationship Assessment (ISA 550.12)" }
  ]));

  // Section 2 Checklists
  const [isa315Checklist, setIsa315Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-010", checkItem: "ISA 315.11 - Entity and environment understood" },
    { refNo: "CHK-011", checkItem: "ISA 315.12 - Industry factors considered" },
    { refNo: "CHK-012", checkItem: "ISA 315.13 - Regulatory environment assessed" },
    { refNo: "CHK-013", checkItem: "ISA 315.14 - Entity objectives evaluated" },
    { refNo: "CHK-014", checkItem: "ISA 315.15 - Business operations understood" },
    { refNo: "CHK-015", checkItem: "ISA 315.16 - Performance measures reviewed" },
    { refNo: "CHK-016", checkItem: "ISA 315.17 - Internal control evaluated" },
    { refNo: "CHK-017", checkItem: "ISA 315.18 - Control environment assessed" },
    { refNo: "CHK-018", checkItem: "ISA 315.19 - Risk assessment process reviewed" },
    { refNo: "CHK-019", checkItem: "ISA 315.21 - Information system evaluated" }
  ]));
  const [companiesAct2017Checklist, setCompaniesAct2017Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-020", checkItem: "Section 223 - Books of account maintained" },
    { refNo: "CHK-021", checkItem: "Section 246 - Annual accounts prepared" },
    { refNo: "CHK-022", checkItem: "Section 255 - Audit requirements met" },
    { refNo: "CHK-023", checkItem: "Relevant schedules reviewed" }
  ]));

  // Section 3: System Walkthroughs
  interface WalkthroughControl {
    id: string;
    stepNo: number;
    description: string;
    controlType: "Manual" | "IT" | "Hybrid";
    keyControl: boolean;
    frequency: string;
    controlOwner: string;
  }

  interface WalkthroughEvidence {
    id: string;
    description: string;
    attachment: string;
    attachmentName?: string;
    remarks: string;
  }

  interface SystemWalkthrough {
    id: string;
    processName: string;
    relatedAccountHeads: string[];
    natureOfProcess: "Manual" | "Automated" | "Hybrid";
    systemUsed: string;
    performedBy: string;
    walkthroughDate: string;
    periodCovered: string;
    linkedRisks: string[];
    auditProgramRef: string;
    narrativeSteps: string[];
    controls: WalkthroughControl[];
    evidence: WalkthroughEvidence[];
    designEffectiveness: "Effective" | "Ineffective" | "";
    implementationStatus: "Implemented" | "Not Implemented" | "";
    overallConclusion: "Satisfactory" | "Unsatisfactory" | "";
    conclusionRemarks: string;
    impactOnRiskAssessment: string;
    overallAssessment: string;
    auditStrategyImpact: string;
    isLocked: boolean;
    createdBy: string;
    createdDate: string;
  }

  const [walkthroughs, setWalkthroughs] = useState<SystemWalkthrough[]>([
    {
      id: "wt-1",
      processName: "Revenue",
      relatedAccountHeads: ["Sales - Local", "Sales - Export", "Trade Receivables"],
      natureOfProcess: "Hybrid",
      systemUsed: "",
      performedBy: "",
      walkthroughDate: "",
      periodCovered: "FY 2024",
      linkedRisks: [],
      auditProgramRef: "AP-REV-001",
      narrativeSteps: [
        "1. The transaction is initiated by ____________________.",
        "2. The source document generated is ____________________.",
        "3. Data entry into the system is performed by ____________________.",
        "4. Authorization / approval is carried out by ____________________.",
        "5. System or manual validation controls include ____________________.",
        "6. Posting to the general ledger occurs ____________________.",
        "7. Reports generated are reviewed by ____________________."
      ],
      controls: [],
      evidence: [],
      designEffectiveness: "",
      implementationStatus: "",
      overallConclusion: "",
      conclusionRemarks: "",
      impactOnRiskAssessment: "",
      overallAssessment: "",
      auditStrategyImpact: "",
      isLocked: false,
      createdBy: "",
      createdDate: new Date().toISOString()
    }
  ]);

  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [activeWalkthroughId, setActiveWalkthroughId] = useState<string>("wt-1");

  const processOptions = ["Revenue", "Purchases", "Payroll", "Inventory", "Fixed Assets", "Cash & Bank", "Other"];
  const teamMembers = ["Engagement Partner", "Audit Manager", "Senior Auditor", "Staff Auditor"];
  const tbAccountHeads = ["Sales - Local", "Sales - Export", "Trade Receivables", "Trade Payables", "Inventory", "Fixed Assets", "Cash & Bank", "Wages & Salaries"];

  const addNewWalkthrough = () => {
    const newWalkthrough: SystemWalkthrough = {
      id: `wt-${Date.now()}`,
      processName: "",
      relatedAccountHeads: [],
      natureOfProcess: "Hybrid",
      systemUsed: "",
      performedBy: "",
      walkthroughDate: "",
      periodCovered: "FY 2024",
      linkedRisks: [],
      auditProgramRef: "",
      narrativeSteps: [
        "1. The transaction is initiated by ____________________.",
        "2. The source document generated is ____________________.",
        "3. Data entry into the system is performed by ____________________.",
        "4. Authorization / approval is carried out by ____________________.",
        "5. System or manual validation controls include ____________________.",
        "6. Posting to the general ledger occurs ____________________.",
        "7. Reports generated are reviewed by ____________________."
      ],
      controls: [],
      evidence: [],
      designEffectiveness: "",
      implementationStatus: "",
      overallConclusion: "",
      conclusionRemarks: "",
      impactOnRiskAssessment: "",
      overallAssessment: "",
      auditStrategyImpact: "",
      isLocked: false,
      createdBy: "",
      createdDate: new Date().toISOString()
    };
    setWalkthroughs([...walkthroughs, newWalkthrough]);
    setActiveWalkthroughId(newWalkthrough.id);
  };

  const updateWalkthrough = (id: string, updates: Partial<SystemWalkthrough>) => {
    setWalkthroughs(walkthroughs.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const deleteWalkthrough = (id: string) => {
    const remaining = walkthroughs.filter(w => w.id !== id);
    setWalkthroughs(remaining);
    if (activeWalkthroughId === id && remaining.length > 0) {
      setActiveWalkthroughId(remaining[0].id);
    }
  };

  const addControlToWalkthrough = (walkthroughId: string) => {
    const walkthrough = walkthroughs.find(w => w.id === walkthroughId);
    if (!walkthrough) return;
    
    const newControl: WalkthroughControl = {
      id: `ctrl-${Date.now()}`,
      stepNo: walkthrough.controls.length + 1,
      description: "",
      controlType: "Manual",
      keyControl: false,
      frequency: "",
      controlOwner: ""
    };
    
    updateWalkthrough(walkthroughId, { controls: [...walkthrough.controls, newControl] });
  };

  const updateControl = (walkthroughId: string, controlId: string, updates: Partial<WalkthroughControl>) => {
    const walkthrough = walkthroughs.find(w => w.id === walkthroughId);
    if (!walkthrough) return;
    
    const updatedControls = walkthrough.controls.map(c => 
      c.id === controlId ? { ...c, ...updates } : c
    );
    updateWalkthrough(walkthroughId, { controls: updatedControls });
  };

  const addEvidenceToWalkthrough = (walkthroughId: string) => {
    const walkthrough = walkthroughs.find(w => w.id === walkthroughId);
    if (!walkthrough) return;
    
    const newEvidence: WalkthroughEvidence = {
      id: `ev-${Date.now()}`,
      description: "",
      attachment: "",
      remarks: ""
    };
    
    updateWalkthrough(walkthroughId, { evidence: [...walkthrough.evidence, newEvidence] });
  };

  const updateEvidence = (walkthroughId: string, evidenceId: string, updates: Partial<WalkthroughEvidence>) => {
    const walkthrough = walkthroughs.find(w => w.id === walkthroughId);
    if (!walkthrough) return;
    
    const updatedEvidence = walkthrough.evidence.map(e => 
      e.id === evidenceId ? { ...e, ...updates } : e
    );
    updateWalkthrough(walkthroughId, { evidence: updatedEvidence });
  };

  const handleEvidenceFileUpload = useCallback((walkthroughId: string, evidenceId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 50MB.",
          variant: "destructive"
        });
        return;
      }

      try {
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          updateEvidence(walkthroughId, evidenceId, { 
            attachment: base64,
            attachmentName: file.name 
          } as any);
          
          toast({
            title: "File Attached",
            description: `${file.name} has been attached successfully.`
          });
        };
        reader.onerror = () => {
          toast({
            title: "Upload Failed",
            description: "Failed to read the file. Please try again.",
            variant: "destructive"
          });
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('File upload error:', error);
        toast({
          title: "Upload Failed",
          description: "An error occurred while uploading the file.",
          variant: "destructive"
        });
      }
    };
    
    input.click();
  }, [toast, updateEvidence]);

  const generateAINarrative = async (walkthroughId: string) => {
    setIsGeneratingNarrative(true);
    const walkthrough = walkthroughs.find(w => w.id === walkthroughId);
    if (!walkthrough) {
      setIsGeneratingNarrative(false);
      return;
    }

    try {
      const response = await fetchWithAuth("/api/audit-program/generate-walkthrough-narrative", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          processName: walkthrough.processName,
          relatedAccountHeads: walkthrough.relatedAccountHeads,
          natureOfProcess: walkthrough.natureOfProcess,
          systemUsed: walkthrough.systemUsed
        })
      });
      
      const result = await response.json();
      if (result.success && result.narrativeSteps) {
        updateWalkthrough(walkthroughId, { narrativeSteps: result.narrativeSteps });
      }
    } catch (error) {
      console.error("Error generating narrative:", error);
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  // Section 4: Risk Assessment
  const [riskAssessment, setRiskAssessment] = useState({
    fraudRiskAssessment: "",
    overallRiskRating: "medium",
    risksRequiringSubstantive: "",
    externalRiskFactors: "",
    internalRiskFactors: "",
    goingConcernRisks: "",
    complexTransactionRisks: "",
    accountingEstimateRisks: ""
  });

  // AI Risk Assessment Engine (ISA 315 Compliant)
  interface AIRiskAssessmentResult {
    significantFsHeads: Array<{
      fsHeadKey: string;
      fsHeadLabel: string;
      isSignificant: boolean;
      significanceRationale: string;
      sizeVsMateriality: 'Above' | 'Below' | 'Near';
      volatility: 'High' | 'Medium' | 'Low';
      estimationComplexity: 'High' | 'Medium' | 'Low';
    }>;
    fsLevelRisks: Array<{
      id: string;
      riskDescription: string;
      source: 'Entity' | 'Industry' | 'Analytics';
      isFraudIndicator: boolean;
      impactedFsAreas: string[];
      severity: 'High' | 'Medium' | 'Low';
      isaReference: string;
    }>;
    assertionRisks: Array<{
      id: string;
      fsHeadKey: string;
      fsHeadLabel: string;
      assertion: string;
      riskStatement: string;
      whatCouldGoWrong: string;
      riskDriver: string;
      isFraudRisk: boolean;
      isSignificantRisk: boolean;
      significantRiskRationale: string;
      likelihood: 'High' | 'Medium' | 'Low';
      magnitude: 'High' | 'Medium' | 'Low';
      riskRating: 'High' | 'Medium' | 'Low';
      linkedProcedureIds?: string[];
      fraudSusceptibility?: 'High' | 'Medium' | 'Low';
      fraudRiskCriteria?: {
        pressure: string[];
        opportunity: string[];
        rationalization: string[];
      };
      isa315Adjustments?: string;
    }>;
    riskAnalytics: Array<{
      id: string;
      indicator: string;
      value: string;
      benchmark: string;
      variance: string;
      linkedFsHeads: string[];
      linkedAssertions: string[];
      linkedRiskIds: string[];
      riskImplication: string;
    }>;
    analysisDate: string;
    materiality: { overall: number; performance: number; trivial: number };
    totalRisksIdentified: number;
    significantRisksCount: number;
    fraudRisksCount: number;
    isa315EntityFactors?: {
      industryRiskProfile: 'High' | 'Medium' | 'Low';
      complexityIndicators: string[];
      estimationComplexityFromNotes: string;
      relatedPartyTransactions: { identified: boolean; riskLevel: 'High' | 'Medium' | 'Low'; details: string };
    };
    isa240FraudAnalysis?: {
      overallFraudRisk: 'High' | 'Medium' | 'Low';
      fraudTriangle: {
        pressure: string[];
        opportunity: string[];
        rationalization: string[];
      };
      highFraudSusceptibilityAccounts: string[];
      presumedFraudRisks: Array<{ risk: string; isaReference: string; response: string }>;
    };
    auditStrategyInputs: {
      controlsRelianceDecision: 'Substantive Only' | 'Combined' | 'Controls Reliance';
      controlsRelianceRationale: string;
      highRiskAreas: Array<{
        fsHeadKey: string;
        fsHeadLabel?: string;
        assertion?: string;
        riskId: string;
        riskRating?: 'High' | 'Medium' | 'Low';
        recommendedApproach: string;
        procedureFocus: string[];
        procedureIds?: string[];
        isFraudRisk?: boolean;
        fraudSusceptibility?: 'High' | 'Medium' | 'Low';
        isa315Adjustments?: string;
        fraudRiskCriteria?: { pressure: string[]; opportunity: string[]; rationalization: string[] };
      }>;
      samplingStrategyInputs: Array<{
        fsHeadKey: string;
        samplingApproach: 'Statistical' | 'Non-Statistical' | 'MUS' | 'Targeted';
        rationale: string;
        riskLevel: 'High' | 'Medium' | 'Low';
      }>;
      focusAreasForSubstantive: string[];
      keyAuditMatters: string[];
    };
  }

  const [aiRiskAssessment, setAiRiskAssessment] = useState<AIRiskAssessmentResult | null>(null);
  const [isRunningAiRiskAnalysis, setIsRunningAiRiskAnalysis] = useState(false);
  const [aiRiskAnalysisError, setAiRiskAnalysisError] = useState<string | null>(null);


  const runAiRiskAnalysis = useCallback(async () => {
    if (!engagementId) {
      toast({ title: "Error", description: "No engagement selected.", variant: "destructive" });
      return;
    }

    setIsRunningAiRiskAnalysis(true);
    setAiRiskAnalysisError(null);

    try {
      const response = await fetchWithAuth(`/api/ai-risk-assessment/${engagementId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        let errorMessage = "Failed to run AI risk analysis";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (response.status === 401) {
            errorMessage = "Your session has expired. Please refresh the page and log in again.";
          } else if (response.status === 403) {
            errorMessage = "You don't have permission to access this feature.";
          } else if (response.status === 404) {
            errorMessage = "Engagement not found.";
          } else {
            errorMessage = `Server error (${response.status}). Please try again.`;
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setAiRiskAssessment(result);
      toast({
        title: "AI Risk Analysis Complete",
        description: `Identified ${result.totalRisksIdentified} risks, including ${result.significantRisksCount} significant risks.`,
      });
    } catch (error) {
      console.error("AI Risk Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to run AI risk analysis";
      setAiRiskAnalysisError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRunningAiRiskAnalysis(false);
    }
  }, [engagementId, toast]);

  // Assertion Level Risks - FS Head based structure with ROMM
  const [assertionLevelRisks, setAssertionLevelRisks] = useState<Array<{
    id: string;
    fsHeadKey: string;
    fsHeadLabel: string;
    assertions: string[];
    inherentRisk: string;
    controlRisk: string;
    romm: string;
    significantRisk: boolean;
    plannedResponse: string;
  }>>([]);

  const applyAiRisksToMatrix = useCallback(() => {
    if (!aiRiskAssessment) {
      toast({ title: "No AI Analysis", description: "Run AI Risk Analysis first.", variant: "destructive" });
      return;
    }

    const existingFsHeadKeys = new Set(assertionLevelRisks.map(r => r.fsHeadKey));
    const newAssertionRisks = aiRiskAssessment.assertionRisks
      .filter(aiRisk => !existingFsHeadKeys.has(aiRisk.fsHeadKey))
      .map((aiRisk, idx) => ({
        id: `AR-AI-${String(assertionLevelRisks.length + idx + 1).padStart(3, '0')}`,
        fsHeadKey: aiRisk.fsHeadKey,
        fsHeadLabel: aiRisk.fsHeadLabel,
        assertions: [aiRisk.assertion],
        inherentRisk: aiRisk.likelihood,
        controlRisk: 'Medium' as string,
        romm: aiRisk.riskRating,
        significantRisk: aiRisk.isSignificantRisk,
        plannedResponse: aiRisk.riskStatement,
      }));

    if (newAssertionRisks.length > 0) {
      setAssertionLevelRisks(prev => [...prev, ...newAssertionRisks]);
      toast({
        title: "Risks Applied",
        description: `Added ${newAssertionRisks.length} AI-identified risks to the Assertion Level Risk Matrix.`,
      });
    } else {
      toast({
        title: "No New Risks",
        description: "All AI-identified risks already exist in the risk matrix.",
      });
    }
  }, [aiRiskAssessment, assertionLevelRisks, toast]);

  const getRiskSeverityBadge = (severity: 'High' | 'Medium' | 'Low') => {
    switch (severity) {
      case 'High':
        return <Badge variant="destructive">{severity}</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">{severity}</Badge>;
      case 'Low':
        return <Badge variant="outline" className="text-green-600 border-green-600">{severity}</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  // FS Level Risks - with full controls and residual tracking
  const [fsLevelRisks, setFsLevelRisks] = useState<Array<{
    id: string;
    area: string;
    description: string;
    likelihood: string;
    impact: string;
    rating: string;
    controls: string;
    residual: string;
  }>>([
    { id: "FS-001", area: "Revenue", description: "", likelihood: "", impact: "", rating: "", controls: "", residual: "" },
    { id: "FS-002", area: "Inventory", description: "", likelihood: "", impact: "", rating: "", controls: "", residual: "" },
    { id: "FS-003", area: "PPE", description: "", likelihood: "", impact: "", rating: "", controls: "", residual: "" },
    { id: "FS-004", area: "Receivables", description: "", likelihood: "", impact: "", rating: "", controls: "", residual: "" },
    { id: "FS-005", area: "Payables", description: "", likelihood: "", impact: "", rating: "", controls: "", residual: "" }
  ]);

  // Standard audit assertions per ISA 315 - CAVR-EC format with short codes
  const AUDIT_ASSERTIONS = [
    { code: "E", label: "Existence", full: "Existence" },
    { code: "C", label: "Completeness", full: "Completeness" },
    { code: "A", label: "Accuracy", full: "Accuracy" },
    { code: "V", label: "Valuation", full: "Valuation" },
    { code: "R", label: "Rights", full: "Rights & Obligations" },
    { code: "CU", label: "Cut-off", full: "Cut-off" },
    { code: "CL", label: "Class", full: "Classification" },
    { code: "P", label: "Present", full: "Presentation" },
  ];

  // ROMM calculation: Inherent Risk × Control Risk
  const calculateROMM = useCallback((inherentRisk: string, controlRisk: string): string => {
    if (!inherentRisk || !controlRisk) return "";
    const ir = inherentRisk.toLowerCase();
    const cr = controlRisk.toLowerCase();
    if (ir === "high" || cr === "high") return "High";
    if (ir === "low" && cr === "low") return "Low";
    return "Medium";
  }, []);

  // ISA 330 Audit Procedure Matrix - Links Risks to Procedures
  interface ProcedureMatrixItem {
    id: string;
    fsHeadKey: string;
    fsHeadLabel: string;
    linkedRiskId: string;
    assertions: string[];
    procedureType: 'TEST_OF_DETAILS' | 'SUBSTANTIVE_ANALYTICAL' | 'TEST_OF_CONTROLS';
    procedureName: string;
    procedureDescription: string;
    nature: 'Inspection' | 'Observation' | 'Inquiry' | 'Confirmation' | 'Recalculation' | 'Reperformance' | 'Analytical';
    timing: 'Interim' | 'Year-end' | 'Roll-forward';
    extent: string;
    assignedTo: string;
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
    glCodeSet: string[];
    populationCount: number;
    populationValue: number;
    sampleSize: number;
    selectedSamples: string[];
  }

  const [procedureMatrix, setProcedureMatrix] = useState<ProcedureMatrixItem[]>([]);

  // Update procedure - defined early to avoid hoisting issues
  const updateProcedure = useCallback((id: string, updates: Partial<ProcedureMatrixItem>) => {
    setProcedureMatrix(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  // Sampling Dialog State
  type SamplingMethod = 'RANDOM_SELECTION' | 'MUS' | 'TOP_N' | 'SPECIFIC_SELECTION';
  type ConfidenceLevel = '90' | '95' | '99';
  
  interface SamplingFormState {
    method: SamplingMethod;
    sampleSize: string;
    confidenceLevel: ConfidenceLevel;
    tolerableError: string;
    selectedItems: string[];
  }
  
  interface MockTransaction {
    id: string;
    docNumber: string;
    date: string;
    description: string;
    amount: number;
    status: 'PENDING' | 'TESTED' | 'EXCEPTION';
  }

  const [samplingDialogOpen, setSamplingDialogOpen] = useState(false);
  const [selectedProcedureForSampling, setSelectedProcedureForSampling] = useState<ProcedureMatrixItem | null>(null);
  const [samplingForm, setSamplingForm] = useState<SamplingFormState>({
    method: 'RANDOM_SELECTION',
    sampleSize: '',
    confidenceLevel: '95',
    tolerableError: '',
    selectedItems: []
  });
  const [mockTransactions, setMockTransactions] = useState<MockTransaction[]>([]);

  // Generate mock transactions based on population
  const generateMockTransactions = useCallback((populationCount: number, populationValue: number): MockTransaction[] => {
    const transactions: MockTransaction[] = [];
    const avgValue = populationValue / Math.max(populationCount, 1);
    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() - 6);
    
    for (let i = 0; i < Math.min(populationCount, 50); i++) {
      const variance = (Math.random() - 0.5) * avgValue * 1.5;
      const amount = Math.max(100, avgValue + variance);
      const txDate = new Date(baseDate);
      txDate.setDate(txDate.getDate() + Math.floor(Math.random() * 180));
      
      transactions.push({
        id: `TXN-${String(i + 1).padStart(4, '0')}`,
        docNumber: `INV-${2024}${String(Math.floor(Math.random() * 9999) + 1000).padStart(4, '0')}`,
        date: txDate.toISOString().split('T')[0],
        description: [
          'Sales Invoice', 'Purchase Order', 'Credit Note', 'Payment Receipt',
          'Journal Entry', 'Adjustment', 'Transfer', 'Service Invoice'
        ][Math.floor(Math.random() * 8)],
        amount: Math.round(amount * 100) / 100,
        status: 'PENDING'
      });
    }
    
    return transactions.sort((a, b) => b.amount - a.amount);
  }, []);

  // Calculate sample size using ISA 530 formulas
  const calculateSampleSize = useCallback((
    populationValue: number,
    tolerableError: number,
    confidenceLevel: ConfidenceLevel,
    rommLevel: string
  ): number => {
    const confidenceFactors: Record<ConfidenceLevel, number> = {
      '90': 2.31,
      '95': 3.00,
      '99': 4.61
    };
    
    const rommMultipliers: Record<string, number> = {
      'High': 1.5,
      'Medium': 1.0,
      'Low': 0.7
    };
    
    const factor = confidenceFactors[confidenceLevel] || 3.0;
    const rommMult = rommMultipliers[rommLevel] || 1.0;
    
    if (!tolerableError || tolerableError <= 0) return 25;
    
    const baseSample = Math.ceil((populationValue * factor) / tolerableError);
    return Math.min(Math.max(Math.ceil(baseSample * rommMult), 10), 100);
  }, []);

  // Apply sampling method to select items
  const applySamplingMethod = useCallback((
    method: SamplingMethod,
    transactions: MockTransaction[],
    sampleSize: number
  ): string[] => {
    const size = Math.min(sampleSize, transactions.length);
    
    switch (method) {
      case 'RANDOM_SELECTION': {
        const shuffled = [...transactions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, size).map(t => t.id);
      }
      case 'MUS': {
        const totalValue = transactions.reduce((sum, t) => sum + t.amount, 0);
        const interval = totalValue / size;
        const selected: string[] = [];
        let cumulative = 0;
        let nextThreshold = Math.random() * interval;
        
        for (const tx of transactions) {
          cumulative += tx.amount;
          while (cumulative >= nextThreshold && selected.length < size) {
            if (!selected.includes(tx.id)) {
              selected.push(tx.id);
            }
            nextThreshold += interval;
          }
        }
        return selected;
      }
      case 'TOP_N': {
        return transactions
          .sort((a, b) => b.amount - a.amount)
          .slice(0, size)
          .map(t => t.id);
      }
      case 'SPECIFIC_SELECTION':
      default:
        return [];
    }
  }, []);

  // Open sampling dialog for a procedure
  const openSamplingDialog = useCallback((proc: ProcedureMatrixItem) => {
    setSelectedProcedureForSampling(proc);
    
    const transactions = generateMockTransactions(proc.populationCount || 30, proc.populationValue || 1000000);
    setMockTransactions(transactions);
    
    setSamplingForm({
      method: 'RANDOM_SELECTION',
      sampleSize: String(proc.sampleSize || 25),
      confidenceLevel: '95',
      tolerableError: String(Math.round((proc.populationValue || 1000000) * 0.05)),
      selectedItems: proc.selectedSamples || []
    });
    
    setSamplingDialogOpen(true);
  }, [generateMockTransactions]);

  // Handle sampling method change
  const handleSamplingMethodChange = useCallback((method: SamplingMethod) => {
    setSamplingForm(prev => {
      const sampleSize = parseInt(prev.sampleSize) || 25;
      const newSelected = method === 'SPECIFIC_SELECTION' 
        ? prev.selectedItems 
        : applySamplingMethod(method, mockTransactions, sampleSize);
      return { ...prev, method, selectedItems: newSelected };
    });
  }, [applySamplingMethod, mockTransactions]);

  // Handle calculate sample size button
  const handleCalculateSampleSize = useCallback(() => {
    if (!selectedProcedureForSampling) return;
    
    const linkedRisk = assertionLevelRisks.find(r => r.id === selectedProcedureForSampling.linkedRiskId);
    const rommLevel = linkedRisk?.romm || 'Medium';
    const tolerableError = parseFloat(samplingForm.tolerableError) || (selectedProcedureForSampling.populationValue * 0.05);
    
    const calculatedSize = calculateSampleSize(
      selectedProcedureForSampling.populationValue || 1000000,
      tolerableError,
      samplingForm.confidenceLevel,
      rommLevel
    );
    
    setSamplingForm(prev => ({
      ...prev,
      sampleSize: String(calculatedSize),
      selectedItems: applySamplingMethod(prev.method, mockTransactions, calculatedSize)
    }));
    
    toast({
      title: "Sample Size Calculated",
      description: `ISA 530 formula suggests ${calculatedSize} items based on ${rommLevel} ROMM.`,
    });
  }, [selectedProcedureForSampling, samplingForm.tolerableError, samplingForm.confidenceLevel, assertionLevelRisks, calculateSampleSize, applySamplingMethod, mockTransactions, toast]);

  // Toggle transaction selection
  const toggleTransactionSelection = useCallback((txId: string) => {
    setSamplingForm(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.includes(txId)
        ? prev.selectedItems.filter(id => id !== txId)
        : [...prev.selectedItems, txId]
    }));
  }, []);

  // Save sampling selection
  const saveSamplingSelection = useCallback(() => {
    if (!selectedProcedureForSampling) return;
    
    updateProcedure(selectedProcedureForSampling.id, {
      sampleSize: samplingForm.selectedItems.length,
      selectedSamples: samplingForm.selectedItems
    });
    
    setSamplingDialogOpen(false);
    setSelectedProcedureForSampling(null);
    
    toast({
      title: "Samples Selected",
      description: `${samplingForm.selectedItems.length} samples selected for ${selectedProcedureForSampling.procedureName || selectedProcedureForSampling.id}.`,
    });
  }, [selectedProcedureForSampling, samplingForm.selectedItems, updateProcedure, toast]);

  // Population Definition Dialog State
  const [populationDialogOpen, setPopulationDialogOpen] = useState(false);
  const [selectedProcedureForPopulation, setSelectedProcedureForPopulation] = useState<ProcedureMatrixItem | null>(null);
  const [populationForm, setPopulationForm] = useState<{
    selectedCodes: string[];
    dateFrom: string;
    dateTo: string;
    transactionType: 'ALL' | 'DEBITS' | 'CREDITS';
    minAmount: string;
  }>({
    selectedCodes: [],
    dateFrom: '',
    dateTo: '',
    transactionType: 'ALL',
    minAmount: ''
  });

  // CoA items with balances for population selection
  interface CoaItemWithBalance {
    accountCode: string;
    accountName: string;
    fsLineItem: string;
    closingBalance: number;
    transactionCount: number;
  }
  const [coaWithBalances, setCoaWithBalances] = useState<CoaItemWithBalance[]>([]);
  const [loadingCoaBalances, setLoadingCoaBalances] = useState(false);

  // Fetch CoA with balances for population definition
  const fetchCoaWithBalances = useCallback(async () => {
    if (!engagementId) return;
    setLoadingCoaBalances(true);
    try {
      const response = await fetchWithAuth(`/api/trial-balance/coa-with-balances/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        const accounts = (data.accounts || [])
          .filter((acc: any) => acc.fsLineItem)
          .map((acc: any) => ({
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            fsLineItem: acc.fsLineItem,
            closingBalance: parseFloat(acc.closingBalance || acc.balance || '0') || 0,
            transactionCount: acc.transactionCount || 0
          }));
        setCoaWithBalances(accounts);
      }
    } catch (error) {
      console.error("Failed to fetch CoA with balances:", error);
    } finally {
      setLoadingCoaBalances(false);
    }
  }, [engagementId]);

  // Filter CoA items by FS Head for the selected procedure
  const filteredCoaForPopulation = useMemo(() => {
    if (!selectedProcedureForPopulation) return [];
    const fsHeadKey = selectedProcedureForPopulation.fsHeadKey.toLowerCase();
    const fsHeadLabel = selectedProcedureForPopulation.fsHeadLabel.toLowerCase();
    
    return coaWithBalances.filter(item => {
      const itemFsLine = (item.fsLineItem || '').toLowerCase();
      return itemFsLine.includes(fsHeadLabel) || 
             itemFsLine.replace(/[^a-z0-9]/g, '_').includes(fsHeadKey.replace(/[^a-z0-9]/g, '_')) ||
             fsHeadLabel.includes(itemFsLine) ||
             itemFsLine === fsHeadLabel;
    });
  }, [coaWithBalances, selectedProcedureForPopulation]);

  // Calculate population stats based on selected codes and filters
  const populationStats = useMemo(() => {
    const selectedItems = coaWithBalances.filter(item => 
      populationForm.selectedCodes.includes(item.accountCode)
    );
    
    let totalValue = 0;
    let totalCount = selectedItems.length;
    
    selectedItems.forEach(item => {
      let balance = item.closingBalance;
      const minAmount = parseFloat(populationForm.minAmount) || 0;
      
      if (populationForm.transactionType === 'DEBITS' && balance < 0) {
        balance = 0;
      } else if (populationForm.transactionType === 'CREDITS' && balance > 0) {
        balance = 0;
      }
      
      if (Math.abs(balance) >= minAmount) {
        totalValue += Math.abs(balance);
      }
    });
    
    return { count: totalCount, value: totalValue };
  }, [coaWithBalances, populationForm]);

  // Open population dialog for a procedure
  const openPopulationDialog = useCallback((proc: ProcedureMatrixItem) => {
    setSelectedProcedureForPopulation(proc);
    setPopulationForm({
      selectedCodes: proc.glCodeSet || [],
      dateFrom: '',
      dateTo: '',
      transactionType: 'ALL',
      minAmount: ''
    });
    setPopulationDialogOpen(true);
    
    if (coaWithBalances.length === 0) {
      fetchCoaWithBalances();
    }
  }, [coaWithBalances.length, fetchCoaWithBalances]);

  // Save population definition
  const savePopulationDefinition = useCallback(() => {
    if (!selectedProcedureForPopulation) return;
    
    updateProcedure(selectedProcedureForPopulation.id, {
      glCodeSet: populationForm.selectedCodes,
      populationCount: populationStats.count,
      populationValue: populationStats.value
    });
    
    setPopulationDialogOpen(false);
    setSelectedProcedureForPopulation(null);
    
    toast({
      title: "Population Defined",
      description: `Population set with ${populationStats.count} accounts, value: PKR ${formatAccounting(populationStats.value)}`,
    });
  }, [selectedProcedureForPopulation, populationForm.selectedCodes, populationStats, updateProcedure, toast]);

  // Toggle code selection in population form
  const toggleCodeSelection = useCallback((code: string) => {
    setPopulationForm(prev => ({
      ...prev,
      selectedCodes: prev.selectedCodes.includes(code)
        ? prev.selectedCodes.filter(c => c !== code)
        : [...prev.selectedCodes, code]
    }));
  }, []);

  // Select all filtered codes
  const selectAllFilteredCodes = useCallback(() => {
    const allCodes = filteredCoaForPopulation.map(item => item.accountCode);
    setPopulationForm(prev => ({
      ...prev,
      selectedCodes: allCodes
    }));
  }, [filteredCoaForPopulation]);

  // Clear all selected codes
  const clearAllSelectedCodes = useCallback(() => {
    setPopulationForm(prev => ({
      ...prev,
      selectedCodes: []
    }));
  }, []);

  // Standard procedures by FS Head type for auto-generation
  const STANDARD_PROCEDURES: Record<string, Array<{ name: string; type: ProcedureMatrixItem['procedureType']; nature: ProcedureMatrixItem['nature']; description: string }>> = {
    TRADE_RECEIVABLES: [
      { name: "Receivables Confirmation", type: "TEST_OF_DETAILS", nature: "Confirmation", description: "Send positive confirmations to customers for outstanding balances" },
      { name: "Subsequent Collections Review", type: "TEST_OF_DETAILS", nature: "Inspection", description: "Verify subsequent cash receipts for year-end balances" },
      { name: "Aging Analysis Review", type: "SUBSTANTIVE_ANALYTICAL", nature: "Analytical", description: "Analyze aging of receivables and test allowance for doubtful accounts" },
    ],
    INVENTORY: [
      { name: "Physical Inventory Observation", type: "TEST_OF_CONTROLS", nature: "Observation", description: "Observe client's physical inventory count procedures" },
      { name: "Inventory Valuation Test", type: "TEST_OF_DETAILS", nature: "Recalculation", description: "Test inventory valuation at lower of cost or NRV" },
      { name: "Cut-off Testing", type: "TEST_OF_DETAILS", nature: "Inspection", description: "Verify proper cut-off of purchases and sales around year-end" },
    ],
    REVENUE: [
      { name: "Revenue Cut-off Test", type: "TEST_OF_DETAILS", nature: "Inspection", description: "Test revenue recognition cut-off at period end" },
      { name: "Sales Invoice Vouching", type: "TEST_OF_DETAILS", nature: "Inspection", description: "Vouch sales to supporting documents (invoices, delivery notes)" },
      { name: "Analytical Review of Revenue", type: "SUBSTANTIVE_ANALYTICAL", nature: "Analytical", description: "Compare revenue trends month-by-month and year-over-year" },
    ],
    TRADE_PAYABLES: [
      { name: "Supplier Confirmations", type: "TEST_OF_DETAILS", nature: "Confirmation", description: "Confirm balances with major suppliers" },
      { name: "Unrecorded Liabilities Search", type: "TEST_OF_DETAILS", nature: "Inspection", description: "Search for unrecorded liabilities after year-end" },
      { name: "Payables Completeness Test", type: "TEST_OF_DETAILS", nature: "Inspection", description: "Trace receiving reports to recorded payables" },
    ],
    PROPERTY_PLANT_EQUIPMENT: [
      { name: "Additions/Disposals Vouching", type: "TEST_OF_DETAILS", nature: "Inspection", description: "Vouch significant additions and disposals to supporting documents" },
      { name: "Depreciation Recalculation", type: "TEST_OF_DETAILS", nature: "Recalculation", description: "Recalculate depreciation expense for selected assets" },
      { name: "Physical Verification", type: "TEST_OF_DETAILS", nature: "Observation", description: "Physically verify existence of selected fixed assets" },
    ],
    CASH_BANK: [
      { name: "Bank Confirmation", type: "TEST_OF_DETAILS", nature: "Confirmation", description: "Obtain bank confirmations for all bank accounts" },
      { name: "Bank Reconciliation Review", type: "TEST_OF_CONTROLS", nature: "Inspection", description: "Review bank reconciliations for accuracy and outstanding items" },
      { name: "Cash Count", type: "TEST_OF_DETAILS", nature: "Observation", description: "Count cash on hand and verify to records" },
    ],
  };

  // Add procedure to matrix
  const addProcedure = useCallback((linkedRiskId?: string) => {
    const risk = linkedRiskId ? assertionLevelRisks.find(r => r.id === linkedRiskId) : undefined;
    const nextNum = procedureMatrix.length + 1;
    const newProcedure: ProcedureMatrixItem = {
      id: `PROC-${String(nextNum).padStart(3, '0')}`,
      fsHeadKey: risk?.fsHeadKey || '',
      fsHeadLabel: risk?.fsHeadLabel || '',
      linkedRiskId: linkedRiskId || '',
      assertions: risk?.assertions || [],
      procedureType: 'TEST_OF_DETAILS',
      procedureName: '',
      procedureDescription: '',
      nature: 'Inspection',
      selectedSamples: [],
      timing: 'Year-end',
      extent: '',
      assignedTo: '',
      status: 'PLANNED',
      glCodeSet: [],
      populationCount: 0,
      populationValue: 0,
      sampleSize: 0,
    };
    setProcedureMatrix(prev => [...prev, newProcedure]);
  }, [assertionLevelRisks, procedureMatrix.length]);

  // Remove procedure
  const removeProcedure = useCallback((id: string) => {
    setProcedureMatrix(prev => prev.filter(p => p.id !== id));
  }, []);

  // Generate procedures from risks with High or Medium ROMM
  const generateProceduresFromRisks = useCallback(() => {
    const eligibleRisks = assertionLevelRisks.filter(r => r.romm === 'High' || r.romm === 'Medium');
    
    if (eligibleRisks.length === 0) {
      toast({
        title: "No Eligible Risks",
        description: "Add assertion level risks with High or Medium ROMM first.",
        variant: "destructive"
      });
      return;
    }

    const existingLinkedRisks = new Set(procedureMatrix.map(p => p.linkedRiskId));
    const newProcedures: ProcedureMatrixItem[] = [];
    let procNum = procedureMatrix.length;

    eligibleRisks.forEach(risk => {
      if (existingLinkedRisks.has(risk.id)) return;

      // Get standard procedures for this FS head type
      const fsHeadKey = risk.fsHeadKey.toUpperCase().replace(/[^A-Z_]/g, '_');
      const standardProcs = STANDARD_PROCEDURES[fsHeadKey] || [
        { name: `${risk.fsHeadLabel} - Detailed Testing`, type: 'TEST_OF_DETAILS' as const, nature: 'Inspection' as const, description: `Perform detailed substantive testing on ${risk.fsHeadLabel}` }
      ];

      standardProcs.forEach(proc => {
        procNum++;
        newProcedures.push({
          id: `PROC-${String(procNum).padStart(3, '0')}`,
          fsHeadKey: risk.fsHeadKey,
          fsHeadLabel: risk.fsHeadLabel,
          linkedRiskId: risk.id,
          assertions: risk.assertions,
          procedureType: proc.type,
          procedureName: proc.name,
          procedureDescription: proc.description,
          nature: proc.nature,
          timing: 'Year-end',
          extent: risk.romm === 'High' ? 'Large sample (25-40 items)' : 'Medium sample (15-25 items)',
          assignedTo: '',
          status: 'PLANNED',
          glCodeSet: [],
          populationCount: 0,
          populationValue: 0,
          sampleSize: risk.romm === 'High' ? 30 : 20,
          selectedSamples: [],
        });
      });
    });

    if (newProcedures.length === 0) {
      toast({
        title: "No New Procedures",
        description: "All eligible risks already have linked procedures.",
        variant: "default"
      });
      return;
    }

    setProcedureMatrix(prev => [...prev, ...newProcedures]);
    toast({
      title: "Procedures Generated",
      description: `Created ${newProcedures.length} audit procedures from ${eligibleRisks.length} risks.`,
    });
  }, [assertionLevelRisks, procedureMatrix, toast]);

  // Add new FS Level Risk row
  const addFsLevelRisk = useCallback(() => {
    const nextNum = fsLevelRisks.length + 1;
    const newId = `FS-${String(nextNum).padStart(3, '0')}`;
    setFsLevelRisks(prev => [...prev, {
      id: newId,
      area: "",
      description: "",
      likelihood: "",
      impact: "",
      rating: "",
      controls: "",
      residual: ""
    }]);
  }, [fsLevelRisks.length]);

  // Remove FS Level Risk row
  const removeFsLevelRisk = useCallback((idx: number) => {
    setFsLevelRisks(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Add new Assertion Level Risk row (FS Head based)
  const addAssertionLevelRisk = useCallback(() => {
    const nextNum = assertionLevelRisks.length + 1;
    const newId = `AR-${String(nextNum).padStart(3, '0')}`;
    setAssertionLevelRisks(prev => [...prev, {
      id: newId,
      fsHeadKey: "",
      fsHeadLabel: "",
      assertions: [],
      inherentRisk: "",
      controlRisk: "",
      romm: "",
      significantRisk: false,
      plannedResponse: ""
    }]);
  }, [assertionLevelRisks.length]);

  // Remove Assertion Level Risk row
  const removeAssertionLevelRisk = useCallback((idx: number) => {
    setAssertionLevelRisks(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Update risk row with ROMM auto-calculation
  const updateAssertionRisk = useCallback((idx: number, updates: Partial<typeof assertionLevelRisks[0]>) => {
    setAssertionLevelRisks(prev => {
      const updated = [...prev];
      const current = updated[idx];
      const newItem = { ...current, ...updates };
      
      // Auto-calculate ROMM when inherent or control risk changes
      const ir = updates.inherentRisk ?? current.inherentRisk;
      const cr = updates.controlRisk ?? current.controlRisk;
      newItem.romm = calculateROMM(ir, cr);
      
      updated[idx] = newItem;
      return updated;
    });
  }, [calculateROMM]);

  // Chart of Accounts line items from Data Intake
  const [coaLineItems, setCoaLineItems] = useState<Array<{
    accountCode: string;
    accountName: string;
    fsLineItem: string;
    nature: string;
  }>>([]);
  const [loadingCoaLineItems, setLoadingCoaLineItems] = useState(false);

  // FS Line Items with GL Transaction Counts for Mapping & Review
  const [fsLineItemsMapping, setFsLineItemsMapping] = useState<Array<{
    accountCode: string;
    accountName: string;
    fsLineItem: string;
    closingBalance: number;
    transactionCount: number;
    classification: 'B.S' | 'P&L';
    selected: boolean;
  }>>([]);
  const [loadingFsMapping, setLoadingFsMapping] = useState(false);

  // Fetch CoA line items that have FS allocations
  const fetchCoaLineItems = useCallback(async () => {
    if (!engagementId) return;
    setLoadingCoaLineItems(true);
    try {
      const response = await fetchWithAuth(`/api/trial-balance/coa/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter accounts that have fsLineItem allocated
        const allocatedAccounts = (data.accounts || []).filter((acc: any) => acc.fsLineItem);
        setCoaLineItems(allocatedAccounts.map((acc: any) => ({
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          fsLineItem: acc.fsLineItem,
          nature: acc.nature || 'DR'
        })));
      }
    } catch (error) {
      console.error("Failed to fetch CoA line items:", error);
    } finally {
      setLoadingCoaLineItems(false);
    }
  }, [engagementId]);

  // Fetch FS Line Items from CoA with GL Transaction Counts
  const fetchFsLineItemsWithTransactions = useCallback(async () => {
    if (!engagementId) return;
    setLoadingFsMapping(true);
    try {
      // Fetch CoA with balances
      const coaResponse = await fetchWithAuth(`/api/trial-balance/coa-with-balances/${engagementId}`);
      
      // Fetch GL summary for transaction counts
      const glResponse = await fetchWithAuth(`/api/trial-balance/gl-summary/${engagementId}`);
      
      let coaData: any[] = [];
      let glSummary: Record<string, number> = {};
      
      if (coaResponse.ok) {
        const data = await coaResponse.json();
        coaData = data.accounts || [];
      }
      
      if (glResponse.ok) {
        const data = await glResponse.json();
        // Build account code to transaction count map from GL summary
        if (data.summary) {
          Object.entries(data.summary).forEach(([code, summaryData]: [string, any]) => {
            glSummary[code] = summaryData.entryCount || 0;
          });
        }
      }
      
      // Classify accounts as B.S or P&L
      const bsKeywords = ['asset', 'liability', 'equity', 'receivable', 'payable', 'cash', 'bank', 'inventory', 'ppe', 'property', 'capital', 'share', 'retained', 'reserve', 'investment', 'intangible', 'fixed', 'current'];
      const plKeywords = ['revenue', 'income', 'expense', 'cost', 'profit', 'loss', 'sales', 'administrative', 'distribution', 'finance', 'tax', 'operating', 'other'];
      
      const mappedItems = coaData
        .filter((acc: any) => acc.fsLineItem)
        .map((acc: any) => {
          const fsName = (acc.fsLineItem || '').toLowerCase();
          const accName = (acc.accountName || '').toLowerCase();
          const isBS = bsKeywords.some(kw => fsName.includes(kw) || accName.includes(kw));
          const isPL = plKeywords.some(kw => fsName.includes(kw) || accName.includes(kw));
          
          return {
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            fsLineItem: acc.fsLineItem,
            closingBalance: parseFloat(acc.closingBalance || acc.balance || '0') || 0,
            transactionCount: glSummary[acc.accountCode] || 0,
            classification: (isPL && !isBS ? 'P&L' : 'B.S') as 'B.S' | 'P&L',
            selected: false
          };
        });
      
      setFsLineItemsMapping(mappedItems);
      
      toast({
        title: "Data Loaded",
        description: `Loaded ${mappedItems.length} FS line items from Chart of Accounts`,
      });
    } catch (error) {
      console.error("Failed to fetch FS line items mapping:", error);
      toast({
        title: "Error",
        description: "Failed to load FS line items. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingFsMapping(false);
    }
  }, [engagementId, toast]);

  // Get unique FS line items grouped by type (B.S vs P&L)
  const groupedFsLineItems = useMemo(() => {
    const bsNatures = ['DR', 'CR']; // Assets, Liabilities, Equity are typically in B.S
    const bsKeywords = ['asset', 'liability', 'equity', 'receivable', 'payable', 'cash', 'bank', 'inventory', 'ppe', 'property', 'capital', 'share', 'retained', 'reserve', 'investment', 'intangible'];
    const plKeywords = ['revenue', 'income', 'expense', 'cost', 'profit', 'loss', 'sales', 'administrative', 'distribution', 'finance', 'tax'];
    
    const uniqueLineItems = new Map<string, { name: string; type: 'bs' | 'pl' }>();
    
    coaLineItems.forEach(item => {
      if (!item.fsLineItem || uniqueLineItems.has(item.fsLineItem)) return;
      
      const lowerName = item.fsLineItem.toLowerCase();
      const isBS = bsKeywords.some(kw => lowerName.includes(kw));
      const isPL = plKeywords.some(kw => lowerName.includes(kw));
      
      // Default to B.S if unclear
      uniqueLineItems.set(item.fsLineItem, {
        name: item.fsLineItem,
        type: isPL && !isBS ? 'pl' : 'bs'
      });
    });

    return {
      balanceSheet: Array.from(uniqueLineItems.values()).filter(i => i.type === 'bs').map(i => i.name),
      profitLoss: Array.from(uniqueLineItems.values()).filter(i => i.type === 'pl').map(i => i.name),
      all: Array.from(uniqueLineItems.keys())
    };
  }, [coaLineItems]);

  // Convert FS line item name to a key format (e.g., "Trade Receivables" -> "TRADE_RECEIVABLES")
  const toFsHeadKey = useCallback((name: string): string => {
    return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  }, []);

  // Push B.S/P&L heads from CoA to Assertion Level Risk (FS Head based)
  const pushToAssertionLevelRisk = useCallback(async (type: 'balanceSheet' | 'profitLoss' | 'both') => {
    // Fetch CoA data if not loaded
    if (coaLineItems.length === 0) {
      await fetchCoaLineItems();
    }

    let accountsToAdd: string[] = [];
    
    if (type === 'balanceSheet' || type === 'both') {
      accountsToAdd = [...accountsToAdd, ...groupedFsLineItems.balanceSheet];
    }
    if (type === 'profitLoss' || type === 'both') {
      accountsToAdd = [...accountsToAdd, ...groupedFsLineItems.profitLoss];
    }

    // If no CoA data yet, fallback to refetch
    if (accountsToAdd.length === 0 && coaLineItems.length === 0) {
      toast({
        title: "No FS Line Items",
        description: "Please allocate FS Line Items in Chart of Accounts first.",
        variant: "destructive"
      });
      return;
    }

    // Filter out FS Heads that already exist
    const existingKeys = assertionLevelRisks.map(r => r.fsHeadKey.toLowerCase());
    const newAccounts = accountsToAdd.filter(a => !existingKeys.includes(toFsHeadKey(a).toLowerCase()));

    if (newAccounts.length === 0) {
      toast({
        title: "No New FS Heads",
        description: "All FS Heads are already in the risk matrix.",
        variant: "default"
      });
      return;
    }

    const startNum = assertionLevelRisks.length + 1;
    const newRisks = newAccounts.map((account, i) => ({
      id: `AR-${String(startNum + i).padStart(3, '0')}`,
      fsHeadKey: toFsHeadKey(account),
      fsHeadLabel: account,
      assertions: [] as string[],
      inherentRisk: "",
      controlRisk: "",
      romm: "",
      significantRisk: false,
      plannedResponse: ""
    }));

    setAssertionLevelRisks(prev => [...prev, ...newRisks]);
    
    toast({
      title: "FS Heads Added",
      description: `Added ${newRisks.length} ${type === 'balanceSheet' ? 'Balance Sheet' : type === 'profitLoss' ? 'P&L' : 'B.S & P&L'} FS Heads to Assertion Level Risk.`,
    });
  }, [assertionLevelRisks, toast, coaLineItems, groupedFsLineItems, fetchCoaLineItems, toFsHeadKey]);

  // Load FS Heads from Draft FS API
  const loadFsHeadsFromDraftFs = useCallback(async () => {
    if (!engagementId) {
      toast({ title: "Error", description: "No engagement selected.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/fs-draft/${engagementId}?viewType=ADJUSTED`);

      if (!response.ok) {
        throw new Error("Failed to fetch Draft FS data");
      }

      const data: DraftFSData = await response.json();
      const fsHeads = data.fsHeads || [];

      if (fsHeads.length === 0) {
        toast({
          title: "No FS Heads Found",
          description: "Please complete TB/GL mapping in Data Intake first.",
          variant: "destructive"
        });
        return;
      }

      // Filter out existing FS Heads
      const existingKeys = assertionLevelRisks.map(r => r.fsHeadKey.toLowerCase());
      const newHeads = fsHeads.filter(h => !existingKeys.includes(toFsHeadKey(h.fsLineItem).toLowerCase()));

      if (newHeads.length === 0) {
        toast({
          title: "No New FS Heads",
          description: "All FS Heads from Draft FS are already in the risk matrix.",
          variant: "default"
        });
        return;
      }

      const startNum = assertionLevelRisks.length + 1;
      const newRisks = newHeads.map((head, i) => ({
        id: `AR-${String(startNum + i).padStart(3, '0')}`,
        fsHeadKey: toFsHeadKey(head.fsLineItem),
        fsHeadLabel: head.displayName || head.fsLineItem,
        assertions: [] as string[],
        inherentRisk: "",
        controlRisk: "",
        romm: "",
        significantRisk: false,
        plannedResponse: ""
      }));

      setAssertionLevelRisks(prev => [...prev, ...newRisks]);

      toast({
        title: "FS Heads Loaded",
        description: `Added ${newRisks.length} FS Heads from Draft Financial Statements.`,
      });
    } catch (error) {
      console.error("Failed to load FS Heads from Draft FS:", error);
      toast({
        title: "Load Failed",
        description: error instanceof Error ? error.message : "Failed to load FS Heads.",
        variant: "destructive"
      });
    }
  }, [engagementId, assertionLevelRisks, toast, toFsHeadKey]);

  // Load CoA line items on mount
  useEffect(() => {
    if (engagementId && coaLineItems.length === 0) {
      fetchCoaLineItems();
    }
  }, [engagementId, coaLineItems.length, fetchCoaLineItems]);

  // Section 3 Checklists
  const [isa240Checklist, setIsa240Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-024", checkItem: "ISA 240.15 - Discussion among team on fraud risks" },
    { refNo: "CHK-025", checkItem: "ISA 240.16 - Management inquiries about fraud" },
    { refNo: "CHK-026", checkItem: "ISA 240.17 - Evaluation of fraud risk factors" },
    { refNo: "CHK-027", checkItem: "ISA 240.18 - Revenue recognition fraud risk considered" },
    { refNo: "CHK-028", checkItem: "ISA 240.19 - Management override of controls considered" },
    { refNo: "CHK-029", checkItem: "ISA 240.20 - Fraud risk response designed" },
    { refNo: "CHK-030", checkItem: "ISA 240.21 - Audit procedures for fraud documented" }
  ]));
  const [isa315RiskChecklist, setIsa315RiskChecklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-031", checkItem: "ISA 315.24 - Risks of material misstatement identified" },
    { refNo: "CHK-032", checkItem: "ISA 315.25 - FS level risks assessed" },
    { refNo: "CHK-033", checkItem: "ISA 315.26 - Assertion level risks assessed" },
    { refNo: "CHK-034", checkItem: "ISA 315.27 - Significant risks identified" },
    { refNo: "CHK-035", checkItem: "ISA 315.28 - Related controls identified" },
    { refNo: "CHK-036", checkItem: "ISA 315.29 - Risk assessment documented" }
  ]));

  // Section 4: Materiality
  const [materiality, setMateriality] = useState({
    benchmarkRationale: "",
    selectedBenchmark: "revenue",
    benchmarkPercentage: "2",
    qualitativeFactors: "",
    revisionProcess: ""
  });

  // Materiality calculations (auto-calc from TB)
  const materialityCalc = useMemo(() => {
    const pbt = safeNum(trialBalance.profitBeforeTax);
    const revenue = safeNum(trialBalance.revenue);
    const assets = safeNum(trialBalance.totalAssets);
    const equity = safeNum(trialBalance.totalEquity);
    const pct = parseFloat(materiality.benchmarkPercentage) / 100;

    let selectedAmount = 0;
    if (materiality.selectedBenchmark === "pbt") selectedAmount = pbt * 0.05;
    else if (materiality.selectedBenchmark === "revenue") selectedAmount = revenue * pct;
    else if (materiality.selectedBenchmark === "assets") selectedAmount = assets * 0.01;
    else if (materiality.selectedBenchmark === "equity") selectedAmount = equity * 0.05;

    return {
      pbt, revenue, assets, equity,
      overallMateriality: selectedAmount,
      performanceMateriality: selectedAmount * 0.75,
      specificMateriality: selectedAmount * 0.5,
      trivialThreshold: selectedAmount * 0.05
    };
  }, [trialBalance, materiality]);

  // Computed Analytical Data from Trial Balance
  const analyticalCalc = useMemo(() => {
    const revenue = safeNum(trialBalance.revenue);
    const assets = safeNum(trialBalance.totalAssets);
    const equity = safeNum(trialBalance.totalEquity);
    const pbt = safeNum(trialBalance.profitBeforeTax);

    // Calculate derived metrics from available data
    const grossMargin = revenue > 0 ? (pbt / revenue) * 100 : 0;
    const returnOnAssets = assets > 0 ? (pbt / assets) * 100 : 0;
    const returnOnEquity = equity > 0 ? (pbt / equity) * 100 : 0;
    const debtToEquity = equity > 0 ? ((assets - equity) / equity) : 0;
    const assetTurnover = assets > 0 ? (revenue / assets) : 0;

    return {
      revenue,
      assets,
      equity,
      pbt,
      grossMargin: grossMargin.toFixed(2),
      returnOnAssets: returnOnAssets.toFixed(2),
      returnOnEquity: returnOnEquity.toFixed(2),
      debtToEquity: debtToEquity.toFixed(2),
      assetTurnover: assetTurnover.toFixed(2),
      hasData: revenue > 0 || assets > 0 || equity > 0 || pbt > 0
    };
  }, [trialBalance]);

  // Section 4 Checklists
  const [isa320Checklist, setIsa320Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-037", checkItem: "ISA 320.8 - Overall materiality determined" },
    { refNo: "CHK-038", checkItem: "ISA 320.9 - Benchmark selection justified" },
    { refNo: "CHK-039", checkItem: "ISA 320.10 - Performance materiality determined" },
    { refNo: "CHK-040", checkItem: "ISA 320.11 - Revision of materiality considered" },
    { refNo: "CHK-041", checkItem: "ISA 320.12 - Qualitative factors considered" },
    { refNo: "CHK-042", checkItem: "ISA 320.13 - Documentation requirements met" },
    { refNo: "CHK-043", checkItem: "ISA 320.14 - Communication of materiality" }
  ]));
  // Section 5: Analytical Procedures
  const [analyticalProcedures, setAnalyticalProcedures] = useState({
    analyticalPlan: "",
    significantFluctuations: "",
    investigationsPerformed: "",
    investigationResults: "",
    impactOnRiskAssessment: "",
    unusualRelationships: "",
    managementInquiries: "",
    corroborativeEvidence: ""
  });

  // Comprehensive Financial Ratio Categories
  const RATIO_CATEGORIES = {
    liquidity: [
      { id: "current_ratio", name: "Current Ratio", formula: "Current Assets / Current Liabilities" },
      { id: "quick_ratio", name: "Quick Ratio (Acid Test)", formula: "(Current Assets - Inventory) / Current Liabilities" },
      { id: "cash_ratio", name: "Cash Ratio", formula: "Cash & Equivalents / Current Liabilities" },
      { id: "working_capital", name: "Working Capital", formula: "Current Assets - Current Liabilities" },
    ],
    profitability: [
      { id: "gross_margin", name: "Gross Profit Margin %", formula: "(Revenue - Cost of Sales) / Revenue × 100" },
      { id: "operating_margin", name: "Operating Profit Margin %", formula: "Operating Profit / Revenue × 100" },
      { id: "net_margin", name: "Net Profit Margin %", formula: "Net Profit / Revenue × 100" },
      { id: "roa", name: "Return on Assets (ROA) %", formula: "Net Profit / Total Assets × 100" },
      { id: "roe", name: "Return on Equity (ROE) %", formula: "Net Profit / Total Equity × 100" },
      { id: "roce", name: "Return on Capital Employed %", formula: "EBIT / (Total Assets - Current Liabilities) × 100" },
    ],
    leverage: [
      { id: "debt_equity", name: "Debt to Equity Ratio", formula: "Total Liabilities / Total Equity" },
      { id: "debt_ratio", name: "Debt Ratio", formula: "Total Liabilities / Total Assets" },
      { id: "equity_ratio", name: "Equity Ratio", formula: "Total Equity / Total Assets" },
      { id: "interest_coverage", name: "Interest Coverage Ratio", formula: "EBIT / Interest Expense" },
    ],
    efficiency: [
      { id: "asset_turnover", name: "Asset Turnover", formula: "Revenue / Total Assets" },
      { id: "inventory_turnover", name: "Inventory Turnover", formula: "Cost of Sales / Average Inventory" },
      { id: "receivables_turnover", name: "Receivables Turnover", formula: "Revenue / Average Trade Receivables" },
      { id: "payables_turnover", name: "Payables Turnover", formula: "Cost of Sales / Average Trade Payables" },
      { id: "days_inventory", name: "Days Inventory Outstanding", formula: "365 / Inventory Turnover" },
      { id: "days_receivables", name: "Days Receivables Outstanding", formula: "365 / Receivables Turnover" },
      { id: "days_payables", name: "Days Payables Outstanding", formula: "365 / Payables Turnover" },
    ]
  };

  const [ratioAnalysis, setRatioAnalysis] = useState<Array<{
    id: string;
    ratio: string;
    category: string;
    formula: string;
    currentYear: string;
    priorYear: string;
    industryAvg: string;
    variance: string;
    investigation: boolean;
    isAuto: boolean;
  }>>([
    // Liquidity Ratios
    { id: "current_ratio", ratio: "Current Ratio", category: "Liquidity", formula: "Current Assets / Current Liabilities", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "quick_ratio", ratio: "Quick Ratio (Acid Test)", category: "Liquidity", formula: "(Current Assets - Inventory) / Current Liabilities", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "cash_ratio", ratio: "Cash Ratio", category: "Liquidity", formula: "Cash / Current Liabilities", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    // Profitability Ratios
    { id: "gross_margin", ratio: "Gross Profit Margin %", category: "Profitability", formula: "(Revenue - CoS) / Revenue × 100", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "operating_margin", ratio: "Operating Profit Margin %", category: "Profitability", formula: "Operating Profit / Revenue × 100", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "net_margin", ratio: "Net Profit Margin %", category: "Profitability", formula: "PBT / Revenue × 100", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "roa", ratio: "Return on Assets (ROA) %", category: "Profitability", formula: "PBT / Total Assets × 100", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "roe", ratio: "Return on Equity (ROE) %", category: "Profitability", formula: "PBT / Total Equity × 100", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    // Leverage Ratios
    { id: "debt_equity", ratio: "Debt to Equity Ratio", category: "Leverage", formula: "Total Liabilities / Total Equity", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "debt_ratio", ratio: "Debt Ratio", category: "Leverage", formula: "Total Liabilities / Total Assets", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "equity_ratio", ratio: "Equity Ratio", category: "Leverage", formula: "Total Equity / Total Assets", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    // Efficiency Ratios
    { id: "asset_turnover", ratio: "Asset Turnover", category: "Efficiency", formula: "Revenue / Total Assets", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "inventory_turnover", ratio: "Inventory Turnover", category: "Efficiency", formula: "Cost of Sales / Inventory", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
    { id: "receivables_turnover", ratio: "Receivables Turnover", category: "Efficiency", formula: "Revenue / Receivables", currentYear: "", priorYear: "", industryAvg: "", variance: "", investigation: false, isAuto: true },
  ]);

  // Auto-calculate ratios from B.S and P&L data
  const calculatedRatios = useMemo(() => {
    // Current Year Data (from trialBalance and derived)
    const revenue = safeNum(trialBalance.revenue);
    const totalAssets = safeNum(trialBalance.totalAssets);
    const totalEquity = safeNum(trialBalance.totalEquity);
    const pbt = safeNum(trialBalance.profitBeforeTax);
    
    // Estimated current year values (can be refined with actual data)
    const costOfSales = revenue * 0.6; // Estimate 60% CoS if not available
    const grossProfit = revenue - costOfSales;
    const operatingProfit = pbt * 1.2; // Estimate before finance costs
    const totalLiabilities = totalAssets - totalEquity;
    
    // Estimate B.S components if not available (proportional to total assets)
    const currentAssets = totalAssets * 0.4; // Estimate 40% current
    const inventory = currentAssets * 0.3; // Estimate 30% of current
    const cash = currentAssets * 0.25; // Estimate 25% of current
    const receivables = currentAssets * 0.35; // Estimate 35% of current
    const currentLiabilities = totalLiabilities * 0.5; // Estimate 50% current
    
    // Prior Year Data
    const priorRevenue = safeNum(fsPriorYear.revenue);
    const priorCostOfSales = safeNum(fsPriorYear.costOfSales);
    const priorGrossProfit = priorRevenue - priorCostOfSales;
    const priorInventory = safeNum(fsPriorYear.inventories);
    const priorReceivables = safeNum(fsPriorYear.tradeReceivables);
    const priorCash = safeNum(fsPriorYear.cashBankBalances);
    const priorPPE = safeNum(fsPriorYear.propertyPlantEquipment);
    const priorIntangibles = safeNum(fsPriorYear.intangibleAssets);
    const priorEquity = safeNum(fsPriorYear.shareCapital) + safeNum(fsPriorYear.retainedEarnings);
    const priorTotalAssets = priorPPE + priorIntangibles + priorInventory + priorReceivables + priorCash;
    
    // Helper to format ratio
    const fmt = (val: number, decimals = 2): string => {
      if (!isFinite(val) || isNaN(val)) return "-";
      return val.toFixed(decimals);
    };

    const fmtPct = (val: number): string => {
      if (!isFinite(val) || isNaN(val)) return "-";
      return val.toFixed(2) + "%";
    };

    return {
      // Liquidity
      current_ratio: { current: fmt(currentAssets / currentLiabilities), prior: "-" },
      quick_ratio: { current: fmt((currentAssets - inventory) / currentLiabilities), prior: "-" },
      cash_ratio: { current: fmt(cash / currentLiabilities), prior: "-" },
      // Profitability
      gross_margin: { current: fmtPct((grossProfit / revenue) * 100), prior: priorRevenue > 0 ? fmtPct((priorGrossProfit / priorRevenue) * 100) : "-" },
      operating_margin: { current: fmtPct((operatingProfit / revenue) * 100), prior: "-" },
      net_margin: { current: fmtPct((pbt / revenue) * 100), prior: "-" },
      roa: { current: fmtPct((pbt / totalAssets) * 100), prior: priorTotalAssets > 0 ? fmtPct((pbt / priorTotalAssets) * 100) : "-" },
      roe: { current: fmtPct((pbt / totalEquity) * 100), prior: priorEquity > 0 ? fmtPct((pbt / priorEquity) * 100) : "-" },
      // Leverage
      debt_equity: { current: fmt(totalLiabilities / totalEquity), prior: priorEquity > 0 ? fmt((priorTotalAssets - priorEquity) / priorEquity) : "-" },
      debt_ratio: { current: fmt(totalLiabilities / totalAssets), prior: priorTotalAssets > 0 ? fmt((priorTotalAssets - priorEquity) / priorTotalAssets) : "-" },
      equity_ratio: { current: fmt(totalEquity / totalAssets), prior: priorTotalAssets > 0 ? fmt(priorEquity / priorTotalAssets) : "-" },
      // Efficiency
      asset_turnover: { current: fmt(revenue / totalAssets) + "x", prior: priorTotalAssets > 0 ? fmt(priorRevenue / priorTotalAssets) + "x" : "-" },
      inventory_turnover: { current: fmt(costOfSales / inventory) + "x", prior: priorInventory > 0 ? fmt(priorCostOfSales / priorInventory) + "x" : "-" },
      receivables_turnover: { current: fmt(revenue / receivables) + "x", prior: priorReceivables > 0 ? fmt(priorRevenue / priorReceivables) + "x" : "-" },
    };
  }, [trialBalance, fsPriorYear]);

  // Add custom ratio row
  const addRatioRow = useCallback(() => {
    const newId = `custom_${Date.now()}`;
    setRatioAnalysis(prev => [...prev, {
      id: newId,
      ratio: "",
      category: "Custom",
      formula: "",
      currentYear: "",
      priorYear: "",
      industryAvg: "",
      variance: "",
      investigation: false,
      isAuto: false
    }]);
  }, []);

  // Remove ratio row
  const removeRatioRow = useCallback((id: string) => {
    setRatioAnalysis(prev => prev.filter(r => r.id !== id));
  }, []);

  // Section 5 Checklists
  const [isa520Checklist, setIsa520Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-044", checkItem: "ISA 520.5 - Analytical procedures designed" },
    { refNo: "CHK-045", checkItem: "ISA 520.6 - Expectations developed" },
    { refNo: "CHK-046", checkItem: "ISA 520.7 - Significant fluctuations investigated" },
    { refNo: "CHK-047", checkItem: "ISA 520.8 - Results corroborated" },
    { refNo: "CHK-048", checkItem: "ISA 520.9 - Management explanations evaluated" },
    { refNo: "CHK-049", checkItem: "ISA 520.10 - Conclusions documented" }
  ]));

  // Section 6: Going Concern
  const [goingConcern, setGoingConcern] = useState({
    assessmentPeriod: "12",
    managementAssessment: "",
    financialIndicators: "",
    operatingIndicators: "",
    externalFactors: "",
    managementPlans: "",
    plansFeasibility: "",
    additionalProcedures: "",
    writtenRepresentations: "",
    tcwgCommunication: "",
    opinionConsiderations: "",
    subsequentEventsMonitoring: ""
  });

  // Section 6 Indicator Checklists
  const [financialIndicators, setFinancialIndicators] = useState({
    negativeCashFlows: false, netLiability: false, loanBreach: false, overduePayables: false,
    dividendArrears: false, unablePayDebts: false, operatingLosses: false, workingCapitalDeficiency: false
  });
  const [operatingIndicators, setOperatingIndicators] = useState({
    keyManagementLoss: false, laborDifficulties: false, keySupplierLoss: false, supplyShortages: false,
    competitorEmergence: false, majorLitigation: false
  });
  const [externalIndicators, setExternalIndicators] = useState({
    industryDecline: false, regulatoryChanges: false, economicDownturn: false, politicalInstability: false, techChanges: false
  });

  // Section 6 Checklists
  const [isa570Checklist, setIsa570Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-050", checkItem: "ISA 570.10 - Going concern assumption evaluated" },
    { refNo: "CHK-051", checkItem: "ISA 570.11 - Events/conditions assessed" },
    { refNo: "CHK-052", checkItem: "ISA 570.12 - Management assessment reviewed" },
    { refNo: "CHK-053", checkItem: "ISA 570.13 - Assessment period evaluated" },
    { refNo: "CHK-054", checkItem: "ISA 570.14 - Additional procedures performed" },
    { refNo: "CHK-055", checkItem: "ISA 570.15 - Management plans evaluated" },
    { refNo: "CHK-056", checkItem: "ISA 570.16 - Written representations obtained" },
    { refNo: "CHK-057", checkItem: "ISA 570.17 - TCWG communication made" },
    { refNo: "CHK-058", checkItem: "ISA 570.18 - Audit conclusions reached" }
  ]));

  // Section 7: Audit Strategy & Program
  const [auditStrategy, setAuditStrategy] = useState({
    overallStrategy: "",
    auditApproach: "combined",
    keyAuditMatters: "",
    significantRisksResponse: "",
    samplingApproach: "non-statistical",
    itAuditApproach: "",
    groupAuditStrategy: "",
    expertUse: "",
    internalAuditReliance: "",
    timingOfProcedures: ""
  });

  // Section 7 Checklists
  const [isa330Checklist, setIsa330Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-059", checkItem: "ISA 330.5 - Overall responses designed" },
    { refNo: "CHK-060", checkItem: "ISA 330.6 - Further audit procedures designed" },
    { refNo: "CHK-061", checkItem: "ISA 330.7 - Nature of procedures determined" },
    { refNo: "CHK-062", checkItem: "ISA 330.8 - Timing of procedures planned" },
    { refNo: "CHK-063", checkItem: "ISA 330.9 - Extent of procedures determined" },
    { refNo: "CHK-064", checkItem: "ISA 330.10 - Controls testing approach" },
    { refNo: "CHK-065", checkItem: "ISA 330.11 - Substantive procedures planned" },
    { refNo: "CHK-066", checkItem: "ISA 330.12 - Response to significant risks" },
    { refNo: "CHK-067", checkItem: "ISA 330.13 - Presentation and disclosure procedures" }
  ]));

  // Section 7b: Team & Quality Management (ISA 220/ISQM 1) — moved from Pre-Planning
  const [teamData, setTeamData] = useState<EngagementTeamData>(() => getDefaultEngagementTeamData(engagementId || ""));

  // Section 8: Sampling (ISA 530)
  const [sampling, setSampling] = useState({
    samplingApproach: "non-statistical",
    populationDefinition: "",
    samplingUnit: "",
    sampleSizeCalculation: "",
    selectionMethod: "",
    tolerableError: "",
    expectedError: "",
    confidenceLevel: "95",
    stratificationApproach: "",
    samplingRiskAssessment: ""
  });
  const [isa530Checklist, setIsa530Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-068", checkItem: "ISA 530.5 - Sample design appropriate" },
    { refNo: "CHK-069", checkItem: "ISA 530.6 - Sample size sufficient" },
    { refNo: "CHK-070", checkItem: "ISA 530.7 - Selection method appropriate" },
    { refNo: "CHK-071", checkItem: "ISA 530.8 - Audit procedures performed on items" },
    { refNo: "CHK-072", checkItem: "ISA 530.9 - Nature/cause of deviations analyzed" },
    { refNo: "CHK-073", checkItem: "ISA 530.10 - Results projected to population" }
  ]));

  // Section 8.5: Risk Responses (ISA 330)
  const [riskResponses, setRiskResponses] = useState({
    overallResponse: "",
    furtherProcedures: "",
    testsOfControls: "",
    substantiveProcedures: "",
    significantRiskResponse: "",
    presentationDisclosure: ""
  });

  // Section 9: Audit Program - AI-Assisted
  const [auditPrograms, setAuditPrograms] = useState<AccountHeadProgram[]>(() => {
    const saved = localStorage.getItem(`planning-audit-programs-${engagementId}`);
    return saved ? JSON.parse(saved) : createDefaultAuditPrograms();
  });

  useEffect(() => {
    localStorage.setItem(`planning-audit-programs-${engagementId}`, JSON.stringify(auditPrograms));
  }, [auditPrograms, engagementId]);

  // Save active tab to localStorage
  useEffect(() => {
    if (engagementId) {
      localStorage.setItem(`planning-active-tab-${engagementId!}`, activeTab);
    }
  }, [activeTab, engagementId]);

  // Section 10: Related Parties & Subsequent Events (moved from 8)
  const [relatedParties, setRelatedParties] = useState({
    identificationProcedures: "",
    riskAssessment: "",
    auditProcedures: "",
    disclosureReview: "",
    managementRepresentations: ""
  });
  const [subsequentEvents, setSubsequentEvents] = useState({
    proceduresPlanned: "",
    dateRange: "",
    inquiriesList: "",
    documentReview: ""
  });

  // Section 9: Quality Control
  const [qualityControl, setQualityControl] = useState({
    qualityPlan: "",
    supervisionLevel: "",
    reviewProcedures: "",
    consultationRequirements: "",
    eqcrRequired: false,
    eqcrPlan: "",
    monitoringProcedures: "",
    documentationStandards: "",
    ethicalMonitoring: "",
    independenceMonitoring: "",
    competenceAssessment: ""
  });

  // Section 11 Checklists (Quality Control)
  const [isa220Checklist, setIsa220Checklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-074", checkItem: "ISA 220.11 - Quality control policies applied" },
    { refNo: "CHK-075", checkItem: "ISA 220.12 - Supervision planned" },
    { refNo: "CHK-076", checkItem: "ISA 220.13 - Review procedures established" },
    { refNo: "CHK-077", checkItem: "ISA 220.14 - Consultation planned if needed" },
    { refNo: "CHK-078", checkItem: "ISA 220.15 - EQCR planned if required" },
    { refNo: "CHK-079", checkItem: "ISA 220.16 - Team competence assessed" },
    { refNo: "CHK-080", checkItem: "ISA 220.17 - Ethical requirements complied" },
    { refNo: "CHK-081", checkItem: "ISA 220.18 - Monitoring procedures applied" }
  ]));

  // Section 11 & 12: Documentation & Communication
  const [documentation, setDocumentation] = useState({
    documentationStandards: "",
    reviewProcess: "",
    retentionPlan: "",
    electronicControls: "",
    confidentialityPlan: "",
    accessControl: "",
    backupProcedures: ""
  });
  const [communication, setCommunication] = useState({
    communicationPlan: "",
    regulatoryCommunication: "",
    auditCommitteePlan: "",
    managementPlan: "",
    timelyIssuePlan: "",
    followUpProcedures: ""
  });

  // Section 13: Final Sign-offs
  const [signOffs, setSignOffs] = useState({
    partnerSignature: { signed: false, name: "", date: "", icapNo: "" },
    managerSignature: { signed: false, name: "", date: "" },
    qcReviewer: { signed: false, name: "", date: "" }
  });

  // Section 14 Transition Checklist
  const [transitionChecklist, setTransitionChecklist] = useState<ChecklistItem[]>(createDefaultChecklistItems([
    { refNo: "CHK-082", checkItem: "Planning documentation complete and approved" },
    { refNo: "CHK-083", checkItem: "Audit program finalized and distributed" },
    { refNo: "CHK-084", checkItem: "Team briefed on audit approach" },
    { refNo: "CHK-085", checkItem: "Client communication plan activated" },
    { refNo: "CHK-086", checkItem: "Information requests sent to client" },
    { refNo: "CHK-087", checkItem: "Quality control procedures activated" },
    { refNo: "CHK-088", checkItem: "Budget monitoring established" },
    { refNo: "CHK-089", checkItem: "Documentation system activated" },
    { refNo: "CHK-090", checkItem: "Transition meeting conducted" },
    { refNo: "CHK-091", checkItem: "Execution phase authorized" }
  ]));

  // Calculate overall progress - counts items with status "completed" or "na"
  const calculateProgress = () => {
    const allChecklists = [
      ...isa300Checklist,
      ...icapEthicsChecklist,
      ...isa315Checklist,
      ...companiesAct2017Checklist,
      ...isa240Checklist,
      ...isa315RiskChecklist,
      ...isa320Checklist,
      ...isa520Checklist,
      ...isa530Checklist,
      ...isa570Checklist,
      ...isa330Checklist,
      ...isa220Checklist,
      ...transitionChecklist
    ];
    const completed = allChecklists.filter(item => item.status === "completed" || item.status === "na").length;
    const totalItems = allChecklists.length + 2; // +2 for partner and manager signatures
    const completedCount = completed + (signOffs.partnerSignature.signed ? 1 : 0) + (signOffs.managerSignature.signed ? 1 : 0);
    return Math.round((completedCount / totalItems) * 100);
  };

  const progress = calculateProgress();
  const isReadyForExecution = progress === 100;

  const [extendedPlanningData, setExtendedPlanningData] = useState<Record<string, any>>({});

  const buildPlanningPayload = useCallback(() => ({
    trialBalance,
    planningInitiation,
    taskAllocation,
    entityUnderstandingSections,
    walkthroughs,
    riskAssessment,
    fsLevelRisks,
    assertionLevelRisks,
    procedureMatrix,
    materiality,
    analyticalProcedures,
    ratioAnalysis,
    riskResponses,
    auditPrograms,
    auditStrategy,
    teamData,
    goingConcern,
    financialIndicators,
    operatingIndicators,
    externalIndicators,
    relatedParties,
    subsequentEvents,
    qualityControl,
    documentation,
    communication,
    signOffs,
    sampling,
    isa300Checklist,
    icapEthicsChecklist,
    isa315Checklist,
    companiesAct2017Checklist,
    isa240Checklist,
    isa315RiskChecklist,
    isa320Checklist,
    isa330Checklist,
    isa520Checklist,
    isa530Checklist,
    isa570Checklist,
    isa220Checklist,
    transitionChecklist,
    ...extendedPlanningData,
  }), [
    trialBalance, planningInitiation, taskAllocation, entityUnderstandingSections, walkthroughs,
    riskAssessment, fsLevelRisks, assertionLevelRisks, procedureMatrix, materiality, analyticalProcedures,
    ratioAnalysis, riskResponses, auditPrograms, auditStrategy, teamData, goingConcern, financialIndicators, 
    operatingIndicators, externalIndicators, relatedParties, subsequentEvents,
    qualityControl, documentation, communication, signOffs,
    sampling, isa300Checklist, icapEthicsChecklist, isa315Checklist,
    companiesAct2017Checklist, isa240Checklist, isa315RiskChecklist, isa320Checklist,
    isa330Checklist, isa520Checklist, isa530Checklist, isa570Checklist, isa220Checklist,
    transitionChecklist, extendedPlanningData
  ]);

  const saveEngine = usePlanningSaveBridge(engagementId, buildPlanningPayload);

  const handleExtendedFieldChange = useCallback((field: string, value: any) => {
    setExtendedPlanningData(prev => ({ ...prev, [field]: value }));
    saveEngine.signalChange();
  }, [saveEngine]);

  const handleDownloadTBTemplate = useCallback(async (format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      const response = await fetchWithAuth('/api/templates/download/tb-template');

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trial_balance_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template Downloaded",
        description: `Trial Balance template (XLSX) downloaded successfully.`
      });
    } catch (error) {
      console.error('TB template download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download Trial Balance template.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleDownloadGLTemplate = useCallback(async (format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      const response = await fetchWithAuth('/api/templates/download/gl-template');

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `general_ledger_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template Downloaded",
        description: `General Ledger template (XLSX) downloaded successfully.`
      });
    } catch (error) {
      console.error('GL template download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download General Ledger template.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Keep legacy function for backward compatibility
  const handleDownloadTemplate = handleDownloadTBTemplate;

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|csv)$/i)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetchWithAuth(`/api/trial-balance/upload/${engagementId}`, {
        method: 'POST',
        body: formData,
        timeout: 120000
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      setTrialBalance(prev => ({
        ...prev,
        fileUploaded: true,
        fileName: file.name,
        validationStatus: "completed"
      }));

      toast({
        title: "Upload Successful",
        description: `Trial Balance uploaded successfully. ${result.rowCount || 0} accounts processed.`
      });

      // Trigger auto-save to persist the upload status
      setTimeout(() => {
        saveEngine.saveDraft();
      }, 500);

      // Optionally reload data or refresh the page
      queryClient.invalidateQueries({ queryKey: [`/api/trial-balance/${engagementId}`] });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload trial balance. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [engagementId, toast, saveEngine]);

  const handleDeleteTrialBalance = useCallback(async () => {
    if (!confirm('Are you sure you want to delete the uploaded trial balance? This action cannot be undone.')) {
      return;
    }

    try {
      setTrialBalance(prev => ({
        ...prev,
        fileUploaded: false,
        fileName: '',
        validationStatus: 'pending'
      }));
      setTbData(null);
      
      // Auto-save after deletion
      setTimeout(() => {
        saveEngine.saveDraft();
      }, 500);

      toast({
        title: "Trial Balance Deleted",
        description: "The trial balance file has been removed."
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete trial balance. Please try again.",
        variant: "destructive"
      });
    }
  }, [toast, saveEngine]);

  const handleViewTrialBalance = useCallback(async () => {
    if (!engagementId) return;
    
    setLoadingTbData(true);
    try {
      const response = await fetchWithAuth(`/api/trial-balance/${engagementId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch trial balance data');
      }

      const data = await response.json();
      setTbData(data);
      
      toast({
        title: "Data Loaded",
        description: `Loaded ${data.lineItems?.length || 0} trial balance accounts.`
      });
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load trial balance data. Make sure you have uploaded a file.",
        variant: "destructive"
      });
    } finally {
      setLoadingTbData(false);
    }
  }, [engagementId, toast]);

  const handleProceedToExecution = useCallback(async () => {
    if (!isReadyForExecution) return;
    
    try {
      // Save current planning data before proceeding
      await saveEngine.saveAndClose();
      
      // Navigate to execution phase
      setLocation(`/workspace/${engagementId}/execution`);
      
      toast({
        title: "Proceeding to Execution",
        description: "Planning phase completed. Starting execution phase."
      });
    } catch (error) {
      console.error('Proceed error:', error);
      toast({
        title: "Navigation Failed",
        description: "Failed to proceed to execution phase.",
        variant: "destructive"
      });
    }
  }, [isReadyForExecution, engagementId, saveEngine, setLocation, toast]);

  // Load saved planning data
  useEffect(() => {
    const loadPlanningData = async () => {
      if (!engagementId) return;
      
      try {
        // Fetch TB summary values from backend (populated from TB push)
        const tbSummaryResponse = await fetchWithAuth(`/api/trial-balance/${engagementId}/summary`);
        
        if (tbSummaryResponse.ok) {
          const tbSummary = await tbSummaryResponse.json();
          if (tbSummary.populated) {
            setTrialBalance(prev => ({
              ...prev,
              fileUploaded: true,
              totalAssets: tbSummary.totalAssets?.toString() || prev.totalAssets,
              totalEquity: tbSummary.totalEquity?.toString() || prev.totalEquity,
              revenue: tbSummary.totalRevenue?.toString() || prev.revenue,
              profitBeforeTax: tbSummary.netIncome?.toString() || prev.profitBeforeTax,
            }));
          }
        }
        
        const response = await fetchWithAuth(`/api/workspace/${engagementId}/planning`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const data = result.data.data || result.data;
            
            if (data.trialBalance) setTrialBalance(data.trialBalance);
            if (data.planningInitiation) setPlanningInitiation(data.planningInitiation);
            if (data.taskAllocation) setTaskAllocation(data.taskAllocation);
            if (data.entityUnderstandingSections) setEntityUnderstandingSections(data.entityUnderstandingSections);
            if (data.walkthroughs) setWalkthroughs(data.walkthroughs);
            if (data.riskAssessment) setRiskAssessment(data.riskAssessment);
            if (data.fsLevelRisks) setFsLevelRisks(data.fsLevelRisks);
            if (data.assertionLevelRisks) setAssertionLevelRisks(data.assertionLevelRisks);
            if (data.procedureMatrix) setProcedureMatrix(data.procedureMatrix);
            if (data.materiality) setMateriality(data.materiality);
            if (data.analyticalProcedures) setAnalyticalProcedures(data.analyticalProcedures);
            if (data.ratioAnalysis) setRatioAnalysis(data.ratioAnalysis);
            if (data.riskResponses) setRiskResponses(data.riskResponses);
            if (data.auditPrograms) setAuditPrograms(data.auditPrograms);
            if (data.auditStrategy) setAuditStrategy(data.auditStrategy);
            if (data.teamData) setTeamData(prev => ({ ...prev, ...data.teamData }));
            if (data.goingConcern) setGoingConcern(data.goingConcern);
            if (data.financialIndicators) setFinancialIndicators(data.financialIndicators);
            if (data.operatingIndicators) setOperatingIndicators(data.operatingIndicators);
            if (data.externalIndicators) setExternalIndicators(data.externalIndicators);
            if (data.relatedParties) setRelatedParties(data.relatedParties);
            if (data.subsequentEvents) setSubsequentEvents(data.subsequentEvents);
            if (data.qualityControl) setQualityControl(data.qualityControl);
            if (data.documentation) setDocumentation(data.documentation);
            if (data.communication) setCommunication(data.communication);
            if (data.signOffs) setSignOffs(data.signOffs);
            if (data.sampling) setSampling(data.sampling);
            if (data.isa300Checklist) setIsa300Checklist(data.isa300Checklist);
            if (data.icapEthicsChecklist) setIcapEthicsChecklist(data.icapEthicsChecklist);
            if (data.isa315Checklist) setIsa315Checklist(data.isa315Checklist);
            if (data.companiesAct2017Checklist) setCompaniesAct2017Checklist(data.companiesAct2017Checklist);
            if (data.isa240Checklist) setIsa240Checklist(data.isa240Checklist);
            if (data.isa315RiskChecklist) setIsa315RiskChecklist(data.isa315RiskChecklist);
            if (data.isa320Checklist) setIsa320Checklist(data.isa320Checklist);
            if (data.isa330Checklist) setIsa330Checklist(data.isa330Checklist);
            if (data.isa520Checklist) setIsa520Checklist(data.isa520Checklist);
            if (data.isa530Checklist) setIsa530Checklist(data.isa530Checklist);
            if (data.isa570Checklist) setIsa570Checklist(data.isa570Checklist);
            if (data.isa220Checklist) setIsa220Checklist(data.isa220Checklist);
            if (data.transitionChecklist) setTransitionChecklist(data.transitionChecklist);

            const knownKeys = new Set([
              'trialBalance', 'planningInitiation', 'taskAllocation', 'entityUnderstandingSections',
              'walkthroughs', 'riskAssessment', 'fsLevelRisks', 'assertionLevelRisks', 'procedureMatrix',
              'materiality', 'analyticalProcedures', 'ratioAnalysis', 'riskResponses', 'auditPrograms',
              'auditStrategy', 'teamData', 'goingConcern', 'financialIndicators', 'operatingIndicators',
              'externalIndicators', 'relatedParties', 'subsequentEvents', 'qualityControl', 'documentation',
              'communication', 'signOffs', 'sampling', 'isa300Checklist', 'icapEthicsChecklist',
              'isa315Checklist', 'companiesAct2017Checklist', 'isa240Checklist', 'isa315RiskChecklist',
              'isa320Checklist', 'isa330Checklist', 'isa520Checklist', 'isa530Checklist', 'isa570Checklist',
              'isa220Checklist', 'transitionChecklist'
            ]);
            const extKeys: Record<string, any> = {};
            for (const key of Object.keys(data)) {
              if (!knownKeys.has(key)) {
                extKeys[key] = data[key];
              }
            }
            if (Object.keys(extKeys).length > 0) {
              setExtendedPlanningData(extKeys);
            }
            
            setTimeout(() => {
              saveEngine.initializeBaseline();
            }, 100);
          }
        }
      } catch (error) {
        console.error("Failed to load planning data:", error);
      }
    };
    
    loadPlanningData();
  }, [engagementId]);

  const handleTabSwitch = useCallback((newTab: string) => {
    if (saveEngine.isDirty && !saveEngine.isSaving) {
      saveEngine.saveDraft();
    }
    setActiveTab(newTab);
    localStorage.setItem(`planning-active-tab-${engagementId}`, newTab);
  }, [saveEngine, engagementId]);

  const tabs = [
    { id: "planning-dashboard", label: "A. Dashboard / Readiness", icon: Activity },
    { id: "financial-statements", label: "B. Financial Statements", icon: FileSpreadsheet },
    { id: "entity-controls", label: "C. Entity & Environment (ISA 315)", icon: Building2 },
    { id: "analytical-procedures", label: "D. Analytical Review (ISA 520)", icon: TrendingUp },
    { id: "materiality", label: "E. Materiality (ISA 320)", icon: Calculator },
    { id: "significant-accounts", label: "F. Significant Accounts", icon: Target },
    { id: "risk-assessment", label: "G. Risk Assessment (ISA 315)", icon: AlertTriangle },
    { id: "fraud-risk", label: "H. Fraud Risk (ISA 240)", icon: Shield },
    { id: "internal-controls", label: "I. Internal Controls", icon: Lock },
    { id: "related-parties", label: "J. Related Parties (ISA 550)", icon: Users },
    { id: "laws-regulations", label: "K. Laws & Regulations (ISA 250)", icon: Scale },
    { id: "going-concern", label: "L. Going Concern (ISA 570)", icon: Activity },
    { id: "team-planning", label: "M. Team / Budget / Timelines", icon: Calendar },
    { id: "strategy-approach", label: "N. Audit Strategy (ISA 300)", icon: Briefcase },
    { id: "audit-program", label: "O. Audit Programs", icon: ClipboardList },
    { id: "planning-memo", label: "P. Planning Memo / Approval", icon: FileCheck },
  ];


  if (!engagementId) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-6">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Engagement Selected</h2>
        <p className="text-muted-foreground text-center mb-4">
          Please select an engagement from the dashboard or navigate to a specific engagement workspace.
        </p>
        <Link href="/engagements">
          <Button>View Engagements</Button>
        </Link>
      </div>
    );
  }

  return (
    <PageShell
      showTopBar={false}
      title={activeTab === "materiality" ? "Materiality (ISA 320)" : "Audit Planning Phase"}
      subtitle={`${client?.name || ""} ${engagement?.engagementCode ? `(${engagement.engagementCode})` : ""}`}
      icon={<Calculator className="h-5 w-5 text-primary" />}
      backHref={`/engagements`}
      nextHref={`/workspace/${engagementId}/risk-assessment`}
      dashboardHref="/engagements"
      saveFn={async () => {
        try {
          await saveEngine.saveFinal();
          if (engagementId) {
            fetchWithAuth(`/api/field-registry/engagements/${engagementId}/computed-fields/recompute`, {
              method: "POST", headers: { "Content-Type": "application/json" },
            }).catch(() => {});
            fetchWithAuth(`/api/engagements/${engagementId}/outputs/generate-phase3`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tabId: activeTab }),
            }).catch(() => {});
          }
          return { ok: true };
        } catch (error) {
          return { ok: false, errors: error };
        }
      }}
      hasUnsavedChanges={saveEngine.isDirty}
      isSaving={saveEngine.isSaving}
      showBack={true}
      showSaveProgress={true}
      showSaveNext={true}
      showSaveClose={true}
      signoffPhase="PLANNING"
      signoffSection="PLANNING"
      readOnly={planningReadOnly}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabSwitch}
      headerActions={null}
    >
      <div className="px-4 py-2 space-y-2">

      <Tabs value={activeTab} onValueChange={handleTabSwitch}>
        <SimpleTabNavigation
          activeTab={activeTab}
          setActiveTab={handleTabSwitch}
          tabs={tabs.map(tab => ({ id: tab.id, label: tab.label }))}
          ariaLabel="Planning Steps"
        />

        {/* Tab A: Planning Dashboard / Readiness Summary */}
        <TabsContent value="planning-dashboard" className="space-y-4 mt-3" data-testid="tab-content-planning-dashboard">
          {engagementId && (
            <PlanningDashboard
              engagementId={engagementId}
              onNavigateToTab={(tabId) => handleTabSwitch(tabId)}
            />
          )}
          {engagementId && (
            <ModuleTemplates moduleName="planning" engagementId={engagementId} title="Planning Templates" />
          )}
        </TabsContent>

        {/* Tab B: Financial Statements (FS) */}
        <TabsContent value="financial-statements" className="space-y-4 mt-3" data-testid="tab-content-financial-statements">
          {engagementId && (
            <FinancialStatementsPanel
              engagementId={engagementId}
              draftFsData={draftFsData}
              isFetchingDraftFs={isFetchingDraftFs}
              trialBalance={trialBalance}
              fsSummary={fsSummary}
              fsPriorYear={fsPriorYear}
              setFsPriorYear={setFsPriorYear}
              fsPriorYearDifferences={fsPriorYearDifferences}
              coaAccounts={coaAccounts}
              clientName={client?.name || "Company Name"}
              periodEnd={engagement?.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : "Period End"}
              readOnly={planningReadOnly}
            />
          )}
        </TabsContent>

        {/* Tab 2: Understanding Entity & Internal Controls (ISA 315) */}
        <TabsContent value="entity-controls" className="space-y-4 mt-3" data-testid="tab-content-entity-controls">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Understanding Entity & Internal Controls
                  </CardTitle>
                  <CardDescription>ISA 315 (Revised 2019) — Understanding the entity, its environment, internal controls, and system walkthroughs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={entitySubTab} onValueChange={setEntitySubTab}>
                <div className="flex flex-wrap gap-1 mb-4 border-b pb-2">
                  {[
                    { id: "entity-understanding", label: "Entity Understanding (ISA 315)" },
                    { id: "walkthroughs", label: "System Walkthroughs (ISA 315/330)" },
                    { id: "planning-initiation", label: "Planning Initiation (ISA 300)" },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setEntitySubTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${entitySubTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                      data-testid={`subtab-entity-${tab.id}`}>{tab.label}</button>
                  ))}
                </div>

                <TabsContent value="entity-understanding" className="space-y-4 mt-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Info className="h-3.5 w-3.5" />
                    <span>ISA 315 (Revised 2019) — Understanding the entity and its environment, the applicable financial reporting framework, and the entity's system of internal control</span>
                  </div>
                  <AccordionFormSection
                    title="Entity Understanding Sections"
                    description="Complete analysis for each area with attachments and verification"
                    items={entityUnderstandingSections}
                    onItemsChange={setEntityUnderstandingSections}
                    icon={<Building2 className="h-4 w-4" />}
                  />
                </TabsContent>

                <TabsContent value="walkthroughs" className="space-y-4 mt-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Info className="h-3.5 w-3.5" />
                    <span>ISA 315 & ISA 330 — Understanding transaction flows, identifying controls, and assessing design effectiveness</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-2 flex-wrap">
                      {walkthroughs.map(w => (
                        <div key={w.id} className="flex items-center gap-1">
                          <Button variant={activeWalkthroughId === w.id ? "default" : "outline"} size="sm" onClick={() => setActiveWalkthroughId(w.id)}>
                            {w.processName || "New Walkthrough"}{w.isLocked && <Lock className="h-3 w-3 ml-1" />}
                          </Button>
                          {!w.isLocked && walkthroughs.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteWalkthrough(w.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button onClick={addNewWalkthrough} variant="outline"><Plus className="h-4 w-4 mr-2" /> Add Walkthrough</Button>
                  </div>
                  {walkthroughs.filter(w => w.id === activeWalkthroughId).map(walkthrough => (
                    <div key={walkthrough.id} className="space-y-4">
                      <Accordion type="multiple" defaultValue={["header", "narrative", "controls", "evidence", "conclusion"]} className="space-y-4">
                        <AccordionItem value="header" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline"><div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="font-medium">A. Walkthrough Header (Mandatory Metadata)</span></div></AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Process Name <span className="text-destructive">*</span></Label>
                                <Select value={walkthrough.processName} onValueChange={(v) => updateWalkthrough(walkthrough.id, { processName: v })} disabled={walkthrough.isLocked}>
                                  <SelectTrigger><SelectValue placeholder="Select process..." /></SelectTrigger>
                                  <SelectContent>{processOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Nature of Process <span className="text-destructive">*</span></Label>
                                <Select value={walkthrough.natureOfProcess} onValueChange={(v) => updateWalkthrough(walkthrough.id, { natureOfProcess: v as any })} disabled={walkthrough.isLocked}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="Manual">Manual</SelectItem><SelectItem value="Automated">Automated</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem></SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>System / Application Used</Label>
                                <Input value={walkthrough.systemUsed} onChange={(e) => updateWalkthrough(walkthrough.id, { systemUsed: e.target.value })} placeholder="e.g., SAP, Oracle, Excel, Manual" disabled={walkthrough.isLocked} />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Walkthrough Performed By <span className="text-destructive">*</span></Label>
                                <Select value={walkthrough.performedBy} onValueChange={(v) => updateWalkthrough(walkthrough.id, { performedBy: v })} disabled={walkthrough.isLocked}>
                                  <SelectTrigger><SelectValue placeholder="Select team member..." /></SelectTrigger>
                                  <SelectContent>{teamMembers.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Walkthrough Date <span className="text-destructive">*</span></Label>
                                <Input type="date" value={walkthrough.walkthroughDate} onChange={(e) => updateWalkthrough(walkthrough.id, { walkthroughDate: e.target.value })} disabled={walkthrough.isLocked} />
                              </div>
                              <div className="space-y-2">
                                <Label>Period Covered <span className="text-destructive">*</span></Label>
                                <Input value={walkthrough.periodCovered} onChange={(e) => updateWalkthrough(walkthrough.id, { periodCovered: e.target.value })} placeholder="e.g., FY 2024" disabled={walkthrough.isLocked} />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Related Account Heads (from TB)</Label>
                                <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[40px]">
                                  {walkthrough.relatedAccountHeads.map((ah, idx) => (
                                    <Badge key={idx} variant="secondary" className="gap-1">{ah}{!walkthrough.isLocked && (<button onClick={() => updateWalkthrough(walkthrough.id, { relatedAccountHeads: walkthrough.relatedAccountHeads.filter((_, i) => i !== idx) })} className="ml-1 hover:text-destructive">×</button>)}</Badge>
                                  ))}
                                  {!walkthrough.isLocked && (
                                    <Select onValueChange={(v) => { if (!walkthrough.relatedAccountHeads.includes(v)) { updateWalkthrough(walkthrough.id, { relatedAccountHeads: [...walkthrough.relatedAccountHeads, v] }); } }}>
                                      <SelectTrigger className="w-32 h-7"><SelectValue placeholder="Add..." /></SelectTrigger>
                                      <SelectContent>{tbAccountHeads.filter(a => !walkthrough.relatedAccountHeads.includes(a)).map(ah => (<SelectItem key={ah} value={ah}>{ah}</SelectItem>))}</SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Reference to Audit Program</Label>
                                <Input value={walkthrough.auditProgramRef} readOnly className="bg-muted" placeholder="Auto-linked from Audit Program" />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="narrative" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline"><div className="flex items-center gap-2"><Brain className="h-4 w-4" /><span className="font-medium">B. AI-Assisted Process Flow Narrative</span><Badge variant="outline" className="text-xs">AI-Generated Draft – Subject to Professional Judgment</Badge></div></AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-4">
                            <div className="flex justify-end">
                              <Button onClick={() => generateAINarrative(walkthrough.id)} disabled={isGeneratingNarrative || walkthrough.isLocked} variant="outline">
                                {isGeneratingNarrative ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating...</>) : (<><Brain className="h-4 w-4 mr-2" />AI Generate Narrative</>)}
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {walkthrough.narrativeSteps.map((step, idx) => (
                                <div key={idx} className="flex gap-2">
                                  <Textarea value={step} onChange={(e) => { const updated = [...walkthrough.narrativeSteps]; updated[idx] = e.target.value; updateWalkthrough(walkthrough.id, { narrativeSteps: updated }); }} rows={2} disabled={walkthrough.isLocked} className="flex-1" />
                                  {!walkthrough.isLocked && walkthrough.narrativeSteps.length > 1 && (<Button variant="ghost" size="icon" onClick={() => { updateWalkthrough(walkthrough.id, { narrativeSteps: walkthrough.narrativeSteps.filter((_, i) => i !== idx) }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>)}
                                </div>
                              ))}
                              {!walkthrough.isLocked && (<Button variant="outline" size="sm" onClick={() => updateWalkthrough(walkthrough.id, { narrativeSteps: [...walkthrough.narrativeSteps, `${walkthrough.narrativeSteps.length + 1}. ____________________.`] })}><Plus className="h-4 w-4 mr-1" /> Add Step</Button>)}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="controls" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline"><div className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="font-medium">C. Control Identification & Mapping Table</span></div></AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-4">
                            <Table>
                              <TableHeader><TableRow><TableHead className="w-16">Step No.</TableHead><TableHead>Control Description</TableHead><TableHead className="w-28">Control Type</TableHead><TableHead className="w-24">Key Control</TableHead><TableHead className="w-28">Frequency</TableHead><TableHead className="w-32">Control Owner</TableHead>{!walkthrough.isLocked && <TableHead className="w-12"></TableHead>}</TableRow></TableHeader>
                              <TableBody>
                                {walkthrough.controls.length === 0 ? (
                                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No controls identified yet. Click "Add Control" to begin.</TableCell></TableRow>
                                ) : (walkthrough.controls.map((control) => (
                                  <TableRow key={control.id}>
                                    <TableCell className="font-mono">{control.stepNo}</TableCell>
                                    <TableCell><Input value={control.description} onChange={(e) => updateControl(walkthrough.id, control.id, { description: e.target.value })} placeholder="Describe the control..." disabled={walkthrough.isLocked} /></TableCell>
                                    <TableCell><Select value={control.controlType} onValueChange={(v) => updateControl(walkthrough.id, control.id, { controlType: v as any })} disabled={walkthrough.isLocked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Manual">Manual</SelectItem><SelectItem value="IT">IT</SelectItem><SelectItem value="Hybrid">Hybrid</SelectItem></SelectContent></Select></TableCell>
                                    <TableCell><Checkbox checked={control.keyControl} onCheckedChange={(c) => updateControl(walkthrough.id, control.id, { keyControl: !!c })} disabled={walkthrough.isLocked} /></TableCell>
                                    <TableCell><Input value={control.frequency} onChange={(e) => updateControl(walkthrough.id, control.id, { frequency: e.target.value })} placeholder="e.g., Daily" disabled={walkthrough.isLocked} /></TableCell>
                                    <TableCell><Input value={control.controlOwner} onChange={(e) => updateControl(walkthrough.id, control.id, { controlOwner: e.target.value })} placeholder="Owner" disabled={walkthrough.isLocked} /></TableCell>
                                    {!walkthrough.isLocked && (<TableCell><Button variant="ghost" size="icon" onClick={() => { updateWalkthrough(walkthrough.id, { controls: walkthrough.controls.filter(c => c.id !== control.id) }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>)}
                                  </TableRow>
                                )))}
                              </TableBody>
                            </Table>
                            {!walkthrough.isLocked && (<Button variant="outline" onClick={() => addControlToWalkthrough(walkthrough.id)}><Plus className="h-4 w-4 mr-2" /> Add Control</Button>)}
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="evidence" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline"><div className="flex items-center gap-2"><FileCheck className="h-4 w-4" /><span className="font-medium">D. Walkthrough Evidence & Attachments</span></div></AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-4">
                            <Table>
                              <TableHeader><TableRow><TableHead>Evidence Description</TableHead><TableHead className="w-40">Attachment</TableHead><TableHead>Remarks</TableHead>{!walkthrough.isLocked && <TableHead className="w-12"></TableHead>}</TableRow></TableHeader>
                              <TableBody>
                                {walkthrough.evidence.length === 0 ? (
                                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No evidence attached yet. Click "Add Evidence" to begin.</TableCell></TableRow>
                                ) : (walkthrough.evidence.map((ev) => (
                                  <TableRow key={ev.id}>
                                    <TableCell><Input value={ev.description} onChange={(e) => updateEvidence(walkthrough.id, ev.id, { description: e.target.value })} placeholder="e.g., Invoice / Voucher, System Screenshot" disabled={walkthrough.isLocked} /></TableCell>
                                    <TableCell>
                                      {ev.attachment ? (
                                        <div className="flex items-center gap-1">
                                          <Button variant="outline" size="sm" onClick={() => { const link = document.createElement('a'); link.href = ev.attachment; link.download = ev.attachmentName || 'attachment'; link.click(); }}><Download className="h-3 w-3 mr-1" /><span className="truncate max-w-[80px]">{ev.attachmentName || "File"}</span></Button>
                                          {!walkthrough.isLocked && (<Button variant="ghost" size="icon" onClick={() => updateEvidence(walkthrough.id, ev.id, { attachment: "", attachmentName: "" } as any)}><Trash2 className="h-3 w-3 text-destructive" /></Button>)}
                                        </div>
                                      ) : (
                                        <Button variant="outline" size="sm" disabled={walkthrough.isLocked} onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (ev: any) => { updateEvidence(walkthrough.id, ev.id, { attachment: ev.target?.result, attachmentName: file.name } as any); }; reader.readAsDataURL(file); } }; input.click(); }}><Upload className="h-3 w-3 mr-1" /> Attach</Button>
                                      )}
                                    </TableCell>
                                    <TableCell><Input value={ev.remarks} onChange={(e) => updateEvidence(walkthrough.id, ev.id, { remarks: e.target.value })} placeholder="Additional notes..." disabled={walkthrough.isLocked} /></TableCell>
                                    {!walkthrough.isLocked && (<TableCell><Button variant="ghost" size="icon" onClick={() => { updateWalkthrough(walkthrough.id, { evidence: walkthrough.evidence.filter(e => e.id !== ev.id) }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>)}
                                  </TableRow>
                                )))}
                              </TableBody>
                            </Table>
                            {!walkthrough.isLocked && (<Button variant="outline" onClick={() => addEvidenceToWalkthrough(walkthrough.id)}><Plus className="h-4 w-4 mr-2" /> Add Evidence</Button>)}
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="conclusion" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /><span className="font-medium">E. Overall Walkthrough Conclusion</span></div></AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-4">
                            <div className="space-y-2">
                              <Label>Overall Assessment of Internal Controls <span className="text-destructive">*</span></Label>
                              <Select value={walkthrough.overallAssessment} onValueChange={(v) => updateWalkthrough(walkthrough.id, { overallAssessment: v as any })} disabled={walkthrough.isLocked}>
                                <SelectTrigger><SelectValue placeholder="Select assessment..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Effective">Effective — Controls operating as designed</SelectItem>
                                  <SelectItem value="Partially Effective">Partially Effective — Some controls need improvement</SelectItem>
                                  <SelectItem value="Ineffective">Ineffective — Significant control deficiencies</SelectItem>
                                  <SelectItem value="Not Tested">Not Yet Tested</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between"><Label>Impact on Audit Strategy (ISA 330) <span className="text-destructive">*</span></Label><AIAssistButton fieldName="auditStrategyImpact" fieldLabel="Impact on Audit Strategy" promptType={getPromptType("auditStrategyImpact")} context={`Planning - Walkthrough audit strategy impact for ${engagement?.engagementCode || "engagement"}`} engagementId={engagementId} page="planning" section="entity-controls" onInsert={(c) => updateWalkthrough(walkthrough.id, { auditStrategyImpact: c })} currentValue={walkthrough.auditStrategyImpact} disabled={walkthrough.isLocked} /></div>
                              <Textarea value={walkthrough.auditStrategyImpact} onChange={(e) => updateWalkthrough(walkthrough.id, { auditStrategyImpact: e.target.value })} placeholder="Describe how the walkthrough findings influence the overall audit strategy and approach (ISA 330)..." rows={3} disabled={walkthrough.isLocked} />
                              <p className="text-xs text-muted-foreground">This information feeds into the Risk Register (ISA 315) and influences Audit Strategy (ISA 330)</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="planning-initiation" className="space-y-4 mt-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Info className="h-3.5 w-3.5" />
                    <span>ISA 300.8 — Planning activities, team briefing, and task allocation</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Planning Start Date <span className="text-destructive">*</span></Label><Input type="date" value={planningInitiation.planningStartDate} onChange={(e) => setPlanningInitiation(p => ({...p, planningStartDate: e.target.value}))} /><p className="text-xs text-muted-foreground">ISA 300.8</p></div>
                    <div className="space-y-2"><Label>Planning Completion Target <span className="text-destructive">*</span></Label><Input type="date" value={planningInitiation.planningCompletionTarget} onChange={(e) => setPlanningInitiation(p => ({...p, planningCompletionTarget: e.target.value}))} /><p className="text-xs text-muted-foreground">ISA 300.10</p></div>
                    <div className="space-y-2"><Label>Planning Kick-off Meeting Date <span className="text-destructive">*</span></Label><Input type="date" value={planningInitiation.kickoffMeetingDate} onChange={(e) => setPlanningInitiation(p => ({...p, kickoffMeetingDate: e.target.value}))} /><p className="text-xs text-muted-foreground">ISA 300.A6</p></div>
                    <div className="space-y-2"><Label>Planning Coordinator <span className="text-destructive">*</span></Label><Select value={planningInitiation.planningCoordinator} onValueChange={(v) => setPlanningInitiation(p => ({...p, planningCoordinator: v}))}><SelectTrigger><SelectValue placeholder="Select coordinator" /></SelectTrigger><SelectContent><SelectItem value="manager1">Audit Manager</SelectItem><SelectItem value="senior1">Senior Auditor</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">ISA 220.14</p></div>
                    <div className="space-y-2"><Label>Planning Methodology <span className="text-destructive">*</span></Label><Select value={planningInitiation.planningMethodology} onValueChange={(v) => setPlanningInitiation(p => ({...p, planningMethodology: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="risk-based">Risk-based Approach</SelectItem><SelectItem value="substantive">Substantive Approach</SelectItem><SelectItem value="combined">Combined Approach</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">ISA 300.5</p></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><Label>Planning Quality Objectives <span className="text-destructive">*</span></Label><AIAssistButton fieldName="qualityObjectives" fieldLabel="Planning Quality Objectives" promptType={getPromptType("qualityObjectives")} context={`Planning quality objectives per ISQM 1.30 for ${engagement?.engagementCode || "engagement"}`} engagementId={engagementId} page="planning" section="quality-control" onInsert={(c) => setPlanningInitiation(p => ({...p, qualityObjectives: c}))} currentValue={planningInitiation.qualityObjectives} /></div>
                    <Textarea value={planningInitiation.qualityObjectives} onChange={(e) => setPlanningInitiation(p => ({...p, qualityObjectives: e.target.value}))} placeholder="Define quality objectives for the planning phase (ISQM 1.30)..." rows={3} />
                  </div>
                  <Separator />
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Task Allocation Matrix</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Task</TableHead><TableHead className="text-center">Partner</TableHead><TableHead className="text-center">Manager</TableHead><TableHead className="text-center">Senior</TableHead><TableHead className="text-center">Assistant</TableHead><TableHead>Due Date</TableHead></TableRow></TableHeader>
                        <TableBody>
                          <TableRow><TableCell>Planning Strategy Development</TableCell><TableCell className="text-center"><CheckCircle2 className="h-4 w-4 text-primary mx-auto" /></TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"></TableCell><TableCell><Input type="date" className="w-40 cursor-pointer" value={taskAllocation.planningStrategyDueDate} onChange={(e) => setTaskAllocation({ ...taskAllocation, planningStrategyDueDate: e.target.value })} /></TableCell></TableRow>
                          <TableRow><TableCell>Team Assignment</TableCell><TableCell className="text-center"><CheckCircle2 className="h-4 w-4 text-primary mx-auto" /></TableCell><TableCell className="text-center"><CheckCircle2 className="h-4 w-4 text-primary mx-auto" /></TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"></TableCell><TableCell><Input type="date" className="w-40 cursor-pointer" value={taskAllocation.teamAssignmentDueDate} onChange={(e) => setTaskAllocation({ ...taskAllocation, teamAssignmentDueDate: e.target.value })} /></TableCell></TableRow>
                          <TableRow><TableCell>Quality Objectives Setting</TableCell><TableCell className="text-center"><CheckCircle2 className="h-4 w-4 text-primary mx-auto" /></TableCell><TableCell className="text-center"><CheckCircle2 className="h-4 w-4 text-primary mx-auto" /></TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"></TableCell><TableCell><Input type="date" className="w-40 cursor-pointer" value={taskAllocation.qualityObjectivesDueDate} onChange={(e) => setTaskAllocation({ ...taskAllocation, qualityObjectivesDueDate: e.target.value })} /></TableCell></TableRow>
                          <TableRow><TableCell>Timeline Development</TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"><CheckCircle2 className="h-4 w-4 text-primary mx-auto" /></TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"></TableCell><TableCell><Input type="date" className="w-40 cursor-pointer" value={taskAllocation.timelineDevelopmentDueDate} onChange={(e) => setTaskAllocation({ ...taskAllocation, timelineDevelopmentDueDate: e.target.value })} /></TableCell></TableRow>
                          <TableRow><TableCell>Tool Configuration</TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"><CheckCircle2 className="h-4 w-4 text-primary mx-auto" /></TableCell><TableCell className="text-center"></TableCell><TableCell><Input type="date" className="w-40 cursor-pointer" value={taskAllocation.toolConfigurationDueDate} onChange={(e) => setTaskAllocation({ ...taskAllocation, toolConfigurationDueDate: e.target.value })} /></TableCell></TableRow>
                          <TableRow><TableCell>Documentation Setup</TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"></TableCell><TableCell className="text-center"><CheckCircle2 className="h-4 w-4 text-primary mx-auto" /></TableCell><TableCell><Input type="date" className="w-40 cursor-pointer" value={taskAllocation.documentationSetupDueDate} onChange={(e) => setTaskAllocation({ ...taskAllocation, documentationSetupDueDate: e.target.value })} /></TableCell></TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Risk Assessment */}
        <TabsContent value="risk-assessment" className="space-y-4 mt-3" data-testid="tab-content-risk-assessment">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Risk Assessment Procedures
                  </CardTitle>
                  <CardDescription>ISA 315 & ISA 240 Compliant - Identifying and assessing risks of material misstatement</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" data-testid="btn-save-risk"
                    onClick={() => { saveEngine.saveDraft(); }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" size="sm" data-testid="btn-ai-suggest-risks"
                    onClick={runAiRiskAnalysis}
                    disabled={isRunningAiRiskAnalysis}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI Suggest Risks
                  </Button>
                  <Button size="sm" data-testid="btn-generate-risk-response"
                    onClick={() => {
                      const responses = assertionLevelRisks.map(risk => ({
                        riskId: risk.id,
                        fsHeadKey: risk.fsHeadKey,
                        fsHeadLabel: risk.fsHeadLabel || risk.fsHeadKey,
                        responseType: risk.significantRisk ? 'substantive-only' : 'combined',
                        procedures: [
                          `Perform substantive analytical procedures on ${risk.fsHeadLabel || risk.fsHeadKey}.`,
                          `Obtain third-party confirmations where applicable for ${risk.fsHeadLabel || risk.fsHeadKey}.`,
                          ...(risk.significantRisk ? [`Design extended procedures specifically addressing significant risk for ${risk.fsHeadLabel || risk.fsHeadKey} per ISA 330.21.`] : [])
                        ]
                      }));
                      setRiskResponses(responses);
                      saveEngine.signalChange();
                      toast({ title: "Risk Response Plan Generated", description: `Generated responses for ${responses.length} risks per ISA 330.` });
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Risk Response Plan
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Risk-Informing Data from Trial Balance
                    {materialityCalc.assets > 0 || materialityCalc.revenue > 0 ? (
                      <Badge variant="default" className="ml-2">Data Linked</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2">Pending TB Upload</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Overall Materiality</p>
                      <p className="font-semibold text-primary">{materialityCalc.overallMateriality ? formatAccounting(materialityCalc.overallMateriality) : 'Not calculated'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Performance Materiality</p>
                      <p className="font-semibold">{materialityCalc.performanceMateriality ? formatAccounting(materialityCalc.performanceMateriality) : 'Not calculated'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-semibold">{materialityCalc.revenue ? formatAccounting(materialityCalc.revenue) : 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Assets</p>
                      <p className="font-semibold">{materialityCalc.assets ? formatAccounting(materialityCalc.assets) : 'Not set'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Risk thresholds and account balances automatically feed from TB data to inform assertion-level risk assessment.
                  </p>
                </CardContent>
              </Card>

              {/* AI Risk Assessment Engine (ISA 315) */}
              <Accordion type="single" collapsible defaultValue="ai-risk-engine" className="w-full">
                <AccordionItem value="ai-risk-engine" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <h4 className="font-semibold">AI Risk Assessment Engine (ISA 315)</h4>
                        <p className="text-xs text-muted-foreground font-normal">
                          AI-powered risk identification and assessment per ISA 315.25-26
                        </p>
                      </div>
                      {aiRiskAssessment && (
                        <Badge variant="default" className="ml-2">
                          {aiRiskAssessment.totalRisksIdentified} Risks Identified
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {/* Run Analysis Button */}
                      <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">Run AI Risk Analysis</p>
                          <p className="text-xs text-muted-foreground">
                            Analyze financial data, entity understanding, and industry factors to identify risks
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={runAiRiskAnalysis}
                            disabled={isRunningAiRiskAnalysis}
                            data-testid="btn-run-ai-risk-analysis"
                          >
                            {isRunningAiRiskAnalysis ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Brain className="h-4 w-4 mr-2" />
                                Run AI Risk Analysis
                              </>
                            )}
                          </Button>
                          {aiRiskAssessment && (
                            <Button
                              variant="outline"
                              onClick={applyAiRisksToMatrix}
                              data-testid="btn-apply-ai-risks"
                            >
                              <Link2 className="h-4 w-4 mr-2" />
                              Apply to Risk Matrix
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Loading State */}
                      {isRunningAiRiskAnalysis && (
                        <Card className="border-primary/20">
                          <CardContent className="py-4 flex flex-col items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-sm font-medium">Analyzing Risk Factors...</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Processing financial data, entity context, and industry benchmarks
                            </p>
                            <Progress value={45} className="w-48 mt-4" />
                          </CardContent>
                        </Card>
                      )}

                      {/* Error State */}
                      {aiRiskAnalysisError && !isRunningAiRiskAnalysis && (
                        <Card className="border-destructive/50 bg-destructive/5">
                          <CardContent className="py-4">
                            <div className="flex items-center gap-2 text-destructive">
                              <AlertCircle className="h-4 w-4" />
                              <p className="text-sm font-medium">Analysis Failed</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{aiRiskAnalysisError}</p>
                          </CardContent>
                        </Card>
                      )}

                      {/* AI Analysis Results */}
                      {aiRiskAssessment && !isRunningAiRiskAnalysis && (
                        <div className="space-y-4">
                          {/* Section E: Analysis Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <Card className="bg-primary/5 border-primary/20">
                              <CardContent className="py-3 text-center">
                                <p className="text-2xl font-bold text-primary">{aiRiskAssessment.totalRisksIdentified}</p>
                                <p className="text-xs text-muted-foreground">Total Risks</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-destructive/5 border-destructive/20">
                              <CardContent className="py-3 text-center">
                                <p className="text-2xl font-bold text-destructive">{aiRiskAssessment.significantRisksCount}</p>
                                <p className="text-xs text-muted-foreground">Significant</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-amber-500/5 border-amber-500/20">
                              <CardContent className="py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  <p className="text-2xl font-bold text-amber-600">{aiRiskAssessment.fraudRisksCount}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">Fraud Risks</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="py-3 text-center">
                                <p className="text-lg font-semibold">{formatAccounting(aiRiskAssessment.materiality.overall)}</p>
                                <p className="text-xs text-muted-foreground">Overall Mat.</p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="py-3 text-center">
                                <p className="text-xs text-muted-foreground">Analysis Date</p>
                                <p className="text-sm font-medium">{new Date(aiRiskAssessment.analysisDate).toLocaleDateString()}</p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Section A: Significant FS Areas */}
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2">
                              <ChevronDown className="h-4 w-4" />
                              <span className="font-medium text-sm">A. Significant Financial Statement Areas</span>
                              <Badge variant="outline" className="ml-auto">
                                {aiRiskAssessment.significantFsHeads.filter(h => h.isSignificant).length} Significant
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>FS Head</TableHead>
                                    <TableHead className="w-20 text-center">Significant</TableHead>
                                    <TableHead className="w-24">Size vs Mat.</TableHead>
                                    <TableHead className="w-20">Volatility</TableHead>
                                    <TableHead className="w-24">Complexity</TableHead>
                                    <TableHead>Rationale</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {aiRiskAssessment.significantFsHeads.map((head) => (
                                    <TableRow key={head.fsHeadKey}>
                                      <TableCell>
                                        <div>
                                          <p className="font-medium text-sm">{head.fsHeadLabel}</p>
                                          <p className="text-xs text-muted-foreground font-mono">{head.fsHeadKey}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {head.isSignificant ? (
                                          <Badge variant="destructive" className="gap-1">
                                            <Target className="h-3 w-3" /> Yes
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline">No</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={head.sizeVsMateriality === 'Above' ? 'destructive' : head.sizeVsMateriality === 'Near' ? 'secondary' : 'outline'}>
                                          {head.sizeVsMateriality}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>{getRiskSeverityBadge(head.volatility)}</TableCell>
                                      <TableCell>{getRiskSeverityBadge(head.estimationComplexity)}</TableCell>
                                      <TableCell className="text-xs max-w-[200px] truncate" title={head.significanceRationale}>
                                        {head.significanceRationale}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Section B: FS-Level Risks (Pervasive) */}
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2">
                              <ChevronDown className="h-4 w-4" />
                              <span className="font-medium text-sm">B. Financial Statement Level Risks (Pervasive)</span>
                              <Badge variant="outline" className="ml-auto">
                                {aiRiskAssessment.fsLevelRisks.length} Risks
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-20">ID</TableHead>
                                    <TableHead>Risk Description</TableHead>
                                    <TableHead className="w-20">Source</TableHead>
                                    <TableHead className="w-20">Severity</TableHead>
                                    <TableHead className="w-16 text-center">Fraud</TableHead>
                                    <TableHead className="w-28">ISA Ref</TableHead>
                                    <TableHead>Impacted Areas</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {aiRiskAssessment.fsLevelRisks.map((risk) => (
                                    <TableRow key={risk.id}>
                                      <TableCell className="font-mono text-xs">{risk.id}</TableCell>
                                      <TableCell className="text-sm">{risk.riskDescription}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline">{risk.source}</Badge>
                                      </TableCell>
                                      <TableCell>{getRiskSeverityBadge(risk.severity)}</TableCell>
                                      <TableCell className="text-center">
                                        {risk.isFraudIndicator && (
                                          <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs font-mono">{risk.isaReference}</TableCell>
                                      <TableCell className="text-xs">
                                        {risk.impactedFsAreas.slice(0, 2).join(', ')}
                                        {risk.impactedFsAreas.length > 2 && ` +${risk.impactedFsAreas.length - 2}`}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Section C: Assertion-Level Risks */}
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2">
                              <ChevronDown className="h-4 w-4" />
                              <span className="font-medium text-sm">C. Assertion-Level Risks</span>
                              <Badge variant="outline" className="ml-auto">
                                {aiRiskAssessment.assertionRisks.length} Risks
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <ScrollArea className="w-full">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-16">ID</TableHead>
                                      <TableHead className="w-32">FS Head</TableHead>
                                      <TableHead className="w-16">Assert.</TableHead>
                                      <TableHead>What Could Go Wrong</TableHead>
                                      <TableHead className="w-20">L/M/R</TableHead>
                                      <TableHead className="w-16 text-center">Sig.</TableHead>
                                      <TableHead className="w-16 text-center">Fraud</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {aiRiskAssessment.assertionRisks.map((risk) => (
                                      <TableRow key={risk.id}>
                                        <TableCell className="font-mono text-xs">{risk.id}</TableCell>
                                        <TableCell>
                                          <div>
                                            <p className="font-medium text-xs">{risk.fsHeadLabel}</p>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="secondary" className="text-xs">{risk.assertion}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs max-w-[250px]">
                                          <p className="truncate" title={risk.whatCouldGoWrong}>{risk.whatCouldGoWrong}</p>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex gap-1">
                                            {getRiskSeverityBadge(risk.riskRating)}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {risk.isSignificantRisk && (
                                            <Target className="h-4 w-4 text-destructive mx-auto" />
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {risk.isFraudRisk && (
                                            <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                                <ScrollBar orientation="horizontal" />
                              </ScrollArea>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Section D: Risk-Informing Analytics */}
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2">
                              <ChevronDown className="h-4 w-4" />
                              <span className="font-medium text-sm">D. Risk-Informing Analytics</span>
                              <Badge variant="outline" className="ml-auto">
                                {aiRiskAssessment.riskAnalytics.length} Indicators
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Indicator</TableHead>
                                    <TableHead className="w-24">Value</TableHead>
                                    <TableHead className="w-24">Benchmark</TableHead>
                                    <TableHead className="w-20">Variance</TableHead>
                                    <TableHead>Risk Implication</TableHead>
                                    <TableHead className="w-28">Linked Risks</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {aiRiskAssessment.riskAnalytics.map((analytic) => (
                                    <TableRow key={analytic.id}>
                                      <TableCell className="font-mono text-xs">{analytic.id}</TableCell>
                                      <TableCell className="text-sm font-medium">{analytic.indicator}</TableCell>
                                      <TableCell className="font-mono text-sm">{analytic.value}</TableCell>
                                      <TableCell className="font-mono text-sm text-muted-foreground">{analytic.benchmark}</TableCell>
                                      <TableCell>
                                        <Badge variant={analytic.variance.startsWith('+') || parseFloat(analytic.variance) > 10 ? 'destructive' : analytic.variance.startsWith('-') ? 'secondary' : 'outline'}>
                                          {analytic.variance}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs max-w-[200px]">
                                        <p className="truncate" title={analytic.riskImplication}>{analytic.riskImplication}</p>
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {analytic.linkedRiskIds?.slice(0, 2).join(', ') || '-'}
                                        {(analytic.linkedRiskIds?.length || 0) > 2 && ` +${analytic.linkedRiskIds!.length - 2}`}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Section E: ISA 315 Entity Factors */}
                          {aiRiskAssessment.isa315EntityFactors && (
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2">
                                <ChevronDown className="h-4 w-4" />
                                <span className="font-medium text-sm">E. ISA 315 Entity Risk Factors</span>
                                <Badge 
                                  variant={aiRiskAssessment.isa315EntityFactors.industryRiskProfile === 'High' ? 'destructive' : 
                                           aiRiskAssessment.isa315EntityFactors.industryRiskProfile === 'Medium' ? 'secondary' : 'outline'}
                                  className="ml-auto"
                                >
                                  {aiRiskAssessment.isa315EntityFactors.industryRiskProfile} Industry Risk
                                </Badge>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-3 p-2 bg-muted/20 rounded-md">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <h6 className="text-xs font-medium text-muted-foreground mb-1">Complexity Indicators</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {aiRiskAssessment.isa315EntityFactors.complexityIndicators.length > 0 ? 
                                          aiRiskAssessment.isa315EntityFactors.complexityIndicators.map((indicator, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">{indicator}</Badge>
                                          )) :
                                          <span className="text-xs text-muted-foreground">None identified</span>
                                        }
                                      </div>
                                    </div>
                                    <div>
                                      <h6 className="text-xs font-medium text-muted-foreground mb-1">Related Party Transactions</h6>
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          variant={aiRiskAssessment.isa315EntityFactors.relatedPartyTransactions.identified ? 
                                            (aiRiskAssessment.isa315EntityFactors.relatedPartyTransactions.riskLevel === 'High' ? 'destructive' : 'secondary') : 'outline'}
                                        >
                                          {aiRiskAssessment.isa315EntityFactors.relatedPartyTransactions.identified ? 'Identified' : 'Not Identified'}
                                        </Badge>
                                        {aiRiskAssessment.isa315EntityFactors.relatedPartyTransactions.identified && (
                                          <span className="text-xs text-muted-foreground">{aiRiskAssessment.isa315EntityFactors.relatedPartyTransactions.details}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {aiRiskAssessment.isa315EntityFactors.estimationComplexityFromNotes && (
                                    <div>
                                      <h6 className="text-xs font-medium text-muted-foreground mb-1">Estimation Complexity Notes</h6>
                                      <p className="text-xs">{aiRiskAssessment.isa315EntityFactors.estimationComplexityFromNotes}</p>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}

                          {/* Section F: ISA 240 Fraud Analysis */}
                          {aiRiskAssessment.isa240FraudAnalysis && (
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2">
                                <ChevronDown className="h-4 w-4" />
                                <span className="font-medium text-sm">F. ISA 240 Fraud Risk Analysis</span>
                                <Badge 
                                  variant={aiRiskAssessment.isa240FraudAnalysis.overallFraudRisk === 'High' ? 'destructive' : 
                                           aiRiskAssessment.isa240FraudAnalysis.overallFraudRisk === 'Medium' ? 'secondary' : 'outline'}
                                  className="ml-auto"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {aiRiskAssessment.isa240FraudAnalysis.overallFraudRisk} Fraud Risk
                                </Badge>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-4 p-2">
                                  {/* Fraud Triangle */}
                                  <div className="grid grid-cols-3 gap-3">
                                    <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                                      <CardHeader className="py-2 px-3">
                                        <CardTitle className="text-xs text-red-700 dark:text-red-300">Pressure Indicators</CardTitle>
                                      </CardHeader>
                                      <CardContent className="py-1 px-3">
                                        <ul className="text-xs space-y-1">
                                          {aiRiskAssessment.isa240FraudAnalysis.fraudTriangle.pressure.length > 0 ? 
                                            aiRiskAssessment.isa240FraudAnalysis.fraudTriangle.pressure.map((item, idx) => (
                                              <li key={idx} className="flex items-start gap-1">
                                                <span className="text-red-500">•</span> {item}
                                              </li>
                                            )) :
                                            <li className="text-muted-foreground">None identified</li>
                                          }
                                        </ul>
                                      </CardContent>
                                    </Card>
                                    <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                                      <CardHeader className="py-2 px-3">
                                        <CardTitle className="text-xs text-amber-700 dark:text-amber-300">Opportunity Indicators</CardTitle>
                                      </CardHeader>
                                      <CardContent className="py-1 px-3">
                                        <ul className="text-xs space-y-1">
                                          {aiRiskAssessment.isa240FraudAnalysis.fraudTriangle.opportunity.length > 0 ? 
                                            aiRiskAssessment.isa240FraudAnalysis.fraudTriangle.opportunity.map((item, idx) => (
                                              <li key={idx} className="flex items-start gap-1">
                                                <span className="text-amber-500">•</span> {item}
                                              </li>
                                            )) :
                                            <li className="text-muted-foreground">None identified</li>
                                          }
                                        </ul>
                                      </CardContent>
                                    </Card>
                                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                                      <CardHeader className="py-2 px-3">
                                        <CardTitle className="text-xs text-blue-700 dark:text-blue-300">Rationalization Indicators</CardTitle>
                                      </CardHeader>
                                      <CardContent className="py-1 px-3">
                                        <ul className="text-xs space-y-1">
                                          {aiRiskAssessment.isa240FraudAnalysis.fraudTriangle.rationalization.length > 0 ? 
                                            aiRiskAssessment.isa240FraudAnalysis.fraudTriangle.rationalization.map((item, idx) => (
                                              <li key={idx} className="flex items-start gap-1">
                                                <span className="text-blue-500">•</span> {item}
                                              </li>
                                            )) :
                                            <li className="text-muted-foreground">None identified</li>
                                          }
                                        </ul>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  {/* Presumed Fraud Risks */}
                                  <div>
                                    <h6 className="text-xs font-medium mb-2 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3 text-destructive" />
                                      Presumed Fraud Risks (ISA 240)
                                    </h6>
                                    <div className="space-y-2">
                                      {aiRiskAssessment.isa240FraudAnalysis.presumedFraudRisks.map((risk, idx) => (
                                        <div key={idx} className="p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                                          <div className="flex items-start justify-between">
                                            <span className="text-xs font-medium">{risk.risk}</span>
                                            <Badge variant="outline" className="text-xs">{risk.isaReference}</Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground mt-1">{risk.response}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* High Fraud Susceptibility Accounts */}
                                  {aiRiskAssessment.isa240FraudAnalysis.highFraudSusceptibilityAccounts.length > 0 && (
                                    <div>
                                      <h6 className="text-xs font-medium mb-1">High Fraud Susceptibility Accounts</h6>
                                      <div className="flex flex-wrap gap-1">
                                        {aiRiskAssessment.isa240FraudAnalysis.highFraudSusceptibilityAccounts.map((account, idx) => (
                                          <Badge key={idx} variant="destructive" className="text-xs">{account}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}

                          {/* Audit Strategy Inputs Section */}
                          {aiRiskAssessment.auditStrategyInputs && (
                            <Collapsible defaultOpen={true} className="border rounded-lg">
                              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180">
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 text-primary" />
                                  <span className="font-medium text-sm">G. Audit Strategy Inputs</span>
                                  <Badge variant="outline" className="ml-2">
                                    {aiRiskAssessment.auditStrategyInputs.controlsRelianceDecision}
                                  </Badge>
                                </div>
                                <ChevronDown className="h-4 w-4 transition-transform" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="p-3 pt-0 space-y-4">
                                {/* Controls Reliance Decision */}
                                <Card className="bg-muted/30">
                                  <CardHeader className="py-2 px-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                      <Shield className="h-4 w-4" />
                                      Controls Reliance Decision
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="py-2 px-3">
                                    <div className="flex items-start gap-3">
                                      <Badge 
                                        variant={aiRiskAssessment.auditStrategyInputs.controlsRelianceDecision === 'Substantive Only' ? 'destructive' : 
                                                 aiRiskAssessment.auditStrategyInputs.controlsRelianceDecision === 'Combined' ? 'secondary' : 'default'}
                                        className="shrink-0 mt-0.5"
                                      >
                                        {aiRiskAssessment.auditStrategyInputs.controlsRelianceDecision}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground">
                                        {aiRiskAssessment.auditStrategyInputs.controlsRelianceRationale}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* High-Risk Areas Table */}
                                {aiRiskAssessment.auditStrategyInputs.highRiskAreas.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 text-destructive" />
                                      <h5 className="text-sm font-medium">High-Risk Areas</h5>
                                      <Badge variant="outline" className="text-xs">{aiRiskAssessment.auditStrategyInputs.highRiskAreas.length}</Badge>
                                    </div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-28">FS Head</TableHead>
                                          <TableHead className="w-20">Risk ID</TableHead>
                                          <TableHead>Recommended Approach</TableHead>
                                          <TableHead>Procedure Focus</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {aiRiskAssessment.auditStrategyInputs.highRiskAreas.slice(0, 8).map((area, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell className="text-xs font-medium">{area.fsHeadKey.replace(/_/g, ' ')}</TableCell>
                                            <TableCell className="font-mono text-xs">{area.riskId}</TableCell>
                                            <TableCell className="text-xs">{area.recommendedApproach}</TableCell>
                                            <TableCell className="text-xs">
                                              <div className="flex flex-wrap gap-1">
                                                {area.procedureFocus.slice(0, 3).map((proc, i) => (
                                                  <Badge key={i} variant="outline" className="text-xs">{proc}</Badge>
                                                ))}
                                                {area.procedureFocus.length > 3 && (
                                                  <Badge variant="secondary" className="text-xs">+{area.procedureFocus.length - 3}</Badge>
                                                )}
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}

                                {/* Sampling Strategy Inputs */}
                                {aiRiskAssessment.auditStrategyInputs.samplingStrategyInputs.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <BarChart3 className="h-4 w-4 text-primary" />
                                      <h5 className="text-sm font-medium">Sampling Strategy per FS Head</h5>
                                    </div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-32">FS Head</TableHead>
                                          <TableHead className="w-28">Approach</TableHead>
                                          <TableHead className="w-20">Risk</TableHead>
                                          <TableHead>Rationale</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {aiRiskAssessment.auditStrategyInputs.samplingStrategyInputs.slice(0, 10).map((sampling, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell className="text-xs font-medium">{sampling.fsHeadKey.replace(/_/g, ' ')}</TableCell>
                                            <TableCell>
                                              <Badge variant={sampling.samplingApproach === 'Targeted' ? 'destructive' : 
                                                             sampling.samplingApproach === 'MUS' ? 'secondary' : 'outline'}
                                                     className="text-xs">
                                                {sampling.samplingApproach}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant={sampling.riskLevel === 'High' ? 'destructive' : 
                                                             sampling.riskLevel === 'Medium' ? 'secondary' : 'outline'}
                                                     className="text-xs">
                                                {sampling.riskLevel}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{sampling.rationale}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}

                                {/* Focus Areas and Key Audit Matters */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Focus Areas for Substantive Testing */}
                                  {aiRiskAssessment.auditStrategyInputs.focusAreasForSubstantive.length > 0 && (
                                    <Card className="bg-muted/20">
                                      <CardHeader className="py-2 px-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <FileCheck className="h-4 w-4" />
                                          Focus Areas for Substantive Testing
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="py-2 px-3">
                                        <ul className="space-y-1">
                                          {aiRiskAssessment.auditStrategyInputs.focusAreasForSubstantive.map((area, idx) => (
                                            <li key={idx} className="text-xs flex items-start gap-2">
                                              <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                              <span>{area}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </CardContent>
                                    </Card>
                                  )}

                                  {/* Key Audit Matters */}
                                  {aiRiskAssessment.auditStrategyInputs.keyAuditMatters.length > 0 && (
                                    <Card className="bg-muted/20">
                                      <CardHeader className="py-2 px-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <AlertCircle className="h-4 w-4 text-amber-600" />
                                          Potential Key Audit Matters
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="py-2 px-3">
                                        <ul className="space-y-1">
                                          {aiRiskAssessment.auditStrategyInputs.keyAuditMatters.slice(0, 5).map((matter, idx) => (
                                            <li key={idx} className="text-xs flex items-start gap-2">
                                              <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                                              <span className="line-clamp-2">{matter}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </CardContent>
                                    </Card>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      )}

                      {/* Empty State */}
                      {!aiRiskAssessment && !isRunningAiRiskAnalysis && !aiRiskAnalysisError && (
                        <Card className="border-dashed">
                          <CardContent className="py-4 flex flex-col items-center justify-center text-center">
                            <Brain className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="text-sm font-medium">No AI Analysis Performed</p>
                            <p className="text-xs text-muted-foreground mb-4 max-w-md">
                              Run AI Risk Analysis to automatically identify significant accounts, 
                              assertion-level risks, fraud indicators, and analytical anomalies based on your financial data.
                            </p>
                            <Button onClick={runAiRiskAnalysis} variant="outline">
                              <Brain className="h-4 w-4 mr-2" />
                              Run AI Risk Analysis
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Overall Risk of Material Misstatement <span className="text-destructive">*</span></Label>
                  <Select value={riskAssessment.overallRiskRating} onValueChange={(v) => setRiskAssessment(p => ({...p, overallRiskRating: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">ISA 315.24</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Financial Statement Level Risk Matrix (ISA 315.25)</h4>
                  <Button variant="outline" size="sm" onClick={addFsLevelRisk} data-testid="btn-add-fs-risk">
                    <Plus className="h-4 w-4 mr-1" /> Add Row
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Risk ID</TableHead>
                      <TableHead className="w-32">Risk Area</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Likelihood</TableHead>
                      <TableHead className="w-24">Impact</TableHead>
                      <TableHead className="w-16">Rating</TableHead>
                      <TableHead className="w-28">Controls</TableHead>
                      <TableHead className="w-24">Residual</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fsLevelRisks.map((risk, idx) => (
                      <TableRow key={risk.id}>
                        <TableCell className="font-mono text-sm">{risk.id}</TableCell>
                        <TableCell>
                          <Input 
                            className="w-full" 
                            placeholder="Risk Area" 
                            value={risk.area} 
                            onChange={(e) => {
                              const updated = [...fsLevelRisks];
                              updated[idx].area = e.target.value;
                              setFsLevelRisks(updated);
                            }} 
                            data-testid={`input-fs-risk-area-${idx}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            className="w-full" 
                            placeholder="Description" 
                            value={risk.description} 
                            onChange={(e) => {
                              const updated = [...fsLevelRisks];
                              updated[idx].description = e.target.value;
                              setFsLevelRisks(updated);
                            }} 
                            data-testid={`input-fs-risk-desc-${idx}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={risk.likelihood} onValueChange={(v) => {
                            const updated = [...fsLevelRisks];
                            updated[idx].likelihood = v;
                            setFsLevelRisks(updated);
                          }}>
                            <SelectTrigger className="w-20"><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Med</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={risk.impact} onValueChange={(v) => {
                            const updated = [...fsLevelRisks];
                            updated[idx].impact = v;
                            setFsLevelRisks(updated);
                          }}>
                            <SelectTrigger className="w-20"><SelectValue placeholder="-" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Med</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            risk.likelihood === 'high' && risk.impact === 'high' ? 'destructive' :
                            risk.likelihood === 'low' && risk.impact === 'low' ? 'outline' : 'secondary'
                          }>
                            {risk.likelihood && risk.impact ? (
                              risk.likelihood === 'high' && risk.impact === 'high' ? 'High' :
                              risk.likelihood === 'low' && risk.impact === 'low' ? 'Low' : 'Med'
                            ) : '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input 
                            className="w-full" 
                            placeholder="Controls" 
                            value={risk.controls} 
                            onChange={(e) => {
                              const updated = [...fsLevelRisks];
                              updated[idx].controls = e.target.value;
                              setFsLevelRisks(updated);
                            }}
                            data-testid={`input-fs-risk-controls-${idx}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            className="w-full" 
                            placeholder="Residual" 
                            value={risk.residual} 
                            onChange={(e) => {
                              const updated = [...fsLevelRisks];
                              updated[idx].residual = e.target.value;
                              setFsLevelRisks(updated);
                            }}
                            data-testid={`input-fs-risk-residual-${idx}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeFsLevelRisk(idx)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            data-testid={`btn-remove-fs-risk-${idx}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="font-medium">FS Head → Assertion Level Risk Matrix (ISA 315.26)</h4>
                    <p className="text-xs text-muted-foreground">CAVR-EC: Completeness, Accuracy, Valuation, Rights & Obligations, Existence, Cut-off, Classification, Presentation</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={loadFsHeadsFromDraftFs}
                      data-testid="btn-load-from-draft-fs"
                    >
                      <Database className="h-4 w-4 mr-1" /> 
                      Load from Draft FS
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={loadingCoaLineItems} data-testid="btn-push-fs-accounts">
                          <Database className="h-4 w-4 mr-1" /> 
                          {loadingCoaLineItems ? 'Loading...' : 'Push from CoA'}
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => pushToAssertionLevelRisk('balanceSheet')} 
                          disabled={groupedFsLineItems.balanceSheet.length === 0}
                          data-testid="menu-push-bs"
                        >
                          Balance Sheet Heads ({groupedFsLineItems.balanceSheet.length})
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => pushToAssertionLevelRisk('profitLoss')} 
                          disabled={groupedFsLineItems.profitLoss.length === 0}
                          data-testid="menu-push-pl"
                        >
                          P&L Heads ({groupedFsLineItems.profitLoss.length})
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => pushToAssertionLevelRisk('both')} 
                          disabled={groupedFsLineItems.all.length === 0}
                          data-testid="menu-push-both"
                        >
                          All FS Line Items ({groupedFsLineItems.all.length})
                        </DropdownMenuItem>
                        {groupedFsLineItems.all.length === 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1 text-xs text-muted-foreground">
                              Allocate FS Lines in Chart of Accounts first
                            </div>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" onClick={addAssertionLevelRisk} data-testid="btn-add-assertion-risk">
                      <Plus className="h-4 w-4 mr-1" /> Add Row
                    </Button>
                  </div>
                </div>

                {assertionLevelRisks.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-4 text-center">
                      <Database className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">No FS Heads Added</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Load FS Heads from Draft FS or push from Chart of Accounts to begin risk assessment.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={loadFsHeadsFromDraftFs}>
                          <Database className="h-4 w-4 mr-1" /> Load from Draft FS
                        </Button>
                        <Button variant="outline" size="sm" onClick={addAssertionLevelRisk}>
                          <Plus className="h-4 w-4 mr-1" /> Add Manually
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48 sticky left-0 bg-background z-10">FS Head</TableHead>
                          {AUDIT_ASSERTIONS.map(a => (
                            <TableHead key={a.code} className="w-10 text-center px-1">
                              <span title={a.full} className="cursor-help">{a.code}</span>
                            </TableHead>
                          ))}
                          <TableHead className="w-20">IR</TableHead>
                          <TableHead className="w-20">CR</TableHead>
                          <TableHead className="w-20">ROMM</TableHead>
                          <TableHead className="w-16 text-center">Sig.</TableHead>
                          <TableHead className="min-w-[200px]">Planned Response</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assertionLevelRisks.map((risk, idx) => (
                          <TableRow key={risk.id}>
                            <TableCell className="sticky left-0 bg-background z-10">
                              {risk.fsHeadLabel ? (
                                <div>
                                  <p className="font-medium text-sm">{risk.fsHeadLabel}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{risk.fsHeadKey}</p>
                                </div>
                              ) : (
                                <Select 
                                  value={risk.fsHeadKey}
                                  onValueChange={(v) => {
                                    const label = groupedFsLineItems.all.find(item => toFsHeadKey(item) === v) || v;
                                    updateAssertionRisk(idx, { fsHeadKey: v, fsHeadLabel: label });
                                  }}
                                >
                                  <SelectTrigger className="w-full" data-testid={`select-fs-head-${idx}`}>
                                    <SelectValue placeholder="Select FS Head" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {groupedFsLineItems.all.map(item => (
                                      <SelectItem key={item} value={toFsHeadKey(item)}>{item}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            {AUDIT_ASSERTIONS.map(assertion => {
                              const isSelected = risk.assertions.includes(assertion.code);
                              return (
                                <TableCell key={assertion.code} className="text-center px-1">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const newAssertions = checked 
                                        ? [...risk.assertions, assertion.code]
                                        : risk.assertions.filter(a => a !== assertion.code);
                                      updateAssertionRisk(idx, { assertions: newAssertions });
                                    }}
                                    data-testid={`checkbox-assertion-${idx}-${assertion.code.toLowerCase()}`}
                                  />
                                </TableCell>
                              );
                            })}
                            <TableCell>
                              <Select 
                                value={risk.inherentRisk} 
                                onValueChange={(v) => updateAssertionRisk(idx, { inherentRisk: v })}
                              >
                                <SelectTrigger className="w-16" data-testid={`select-ir-${idx}`}>
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="High">H</SelectItem>
                                  <SelectItem value="Medium">M</SelectItem>
                                  <SelectItem value="Low">L</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={risk.controlRisk} 
                                onValueChange={(v) => updateAssertionRisk(idx, { controlRisk: v })}
                              >
                                <SelectTrigger className="w-16" data-testid={`select-cr-${idx}`}>
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="High">H</SelectItem>
                                  <SelectItem value="Medium">M</SelectItem>
                                  <SelectItem value="Low">L</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                risk.romm === 'High' ? 'destructive' :
                                risk.romm === 'Low' ? 'outline' : 'secondary'
                              }>
                                {risk.romm || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={risk.significantRisk}
                                onCheckedChange={(checked) => updateAssertionRisk(idx, { significantRisk: !!checked })}
                                data-testid={`checkbox-significant-${idx}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                className="w-full" 
                                placeholder="Planned audit response..." 
                                value={risk.plannedResponse}
                                onChange={(e) => updateAssertionRisk(idx, { plannedResponse: e.target.value })}
                                data-testid={`input-response-${idx}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeAssertionLevelRisk(idx)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                data-testid={`btn-remove-assertion-risk-${idx}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}

                {assertionLevelRisks.length > 0 && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <span><strong>IR</strong> = Inherent Risk</span>
                    <span><strong>CR</strong> = Control Risk</span>
                    <span><strong>ROMM</strong> = Risk of Material Misstatement (IR × CR)</span>
                    <span><strong>Sig.</strong> = Significant Risk (ISA 315.28)</span>
                  </div>
                )}
              </div>

              <Separator className="my-6" />

              <Collapsible defaultOpen className="space-y-4">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer hover-elevate p-2 rounded-md -mx-2">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      <h4 className="font-semibold text-base">Audit Program (ISA 330)</h4>
                      <Badge variant="outline" className="text-xs">Audit Procedures Matrix</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{procedureMatrix.length} procedures</Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm text-muted-foreground">
                      Link identified risks to specific audit procedures. Auto-generate based on risk assessment or add manually.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={generateProceduresFromRisks}
                        data-testid="btn-generate-procedures"
                      >
                        <Brain className="h-4 w-4 mr-1" /> 
                        Generate from Risks
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" data-testid="btn-add-procedure">
                            <Plus className="h-4 w-4 mr-1" /> 
                            Add Procedure
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                            Link to Assertion Risk
                          </div>
                          <DropdownMenuSeparator />
                          {assertionLevelRisks.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground text-center">
                              No assertion risks defined yet
                            </div>
                          ) : (
                            assertionLevelRisks.map(risk => (
                              <DropdownMenuItem 
                                key={risk.id}
                                onClick={() => addProcedure(risk.id)}
                                data-testid={`menu-add-proc-${risk.id}`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{risk.fsHeadLabel || risk.fsHeadKey}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {risk.id} • ROMM: {risk.romm || '-'} • {risk.assertions.join(', ') || 'No assertions'}
                                  </span>
                                </div>
                              </DropdownMenuItem>
                            ))
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => addProcedure()} data-testid="menu-add-proc-unlinked">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Unlinked Procedure
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {procedureMatrix.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-4 text-center">
                        <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium">No Audit Procedures Defined</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Generate procedures from risks or add them manually.
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={generateProceduresFromRisks}
                            disabled={assertionLevelRisks.filter(r => r.romm === 'High' || r.romm === 'Medium').length === 0}
                          >
                            <Brain className="h-4 w-4 mr-1" /> Generate from Risks
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => addProcedure()}>
                            <Plus className="h-4 w-4 mr-1" /> Add Manually
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <ScrollArea className="w-full">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24">Ref#</TableHead>
                              <TableHead className="w-40">FS Head</TableHead>
                              <TableHead className="w-32">Assertions</TableHead>
                              <TableHead className="w-32">Type</TableHead>
                              <TableHead className="min-w-[200px]">Procedure</TableHead>
                              <TableHead className="w-40">N-T-E</TableHead>
                              <TableHead className="w-44">Population</TableHead>
                              <TableHead className="w-40">Sampling</TableHead>
                              <TableHead className="w-28">Status</TableHead>
                              <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {procedureMatrix.map((proc) => {
                              const linkedRisk = assertionLevelRisks.find(r => r.id === proc.linkedRiskId);
                              return (
                                <TableRow key={proc.id} data-testid={`row-procedure-${proc.id}`}>
                                  <TableCell className="font-mono text-xs">
                                    <div className="flex items-center gap-1">
                                      {proc.id}
                                      {linkedRisk && (
                                        <span title={`Linked to ${linkedRisk.id}`}>
                                          <Link2 className="h-3 w-3 text-primary" />
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium text-sm truncate max-w-[150px]" title={proc.fsHeadLabel}>
                                        {proc.fsHeadLabel || proc.fsHeadKey || '-'}
                                      </p>
                                      {linkedRisk && (
                                        <p className="text-xs text-muted-foreground">
                                          Risk: {linkedRisk.id}
                                        </p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {proc.assertions.slice(0, 3).map(a => (
                                        <Badge key={a} variant="outline" className="text-xs px-1">
                                          {a}
                                        </Badge>
                                      ))}
                                      {proc.assertions.length > 3 && (
                                        <Badge variant="secondary" className="text-xs px-1">
                                          +{proc.assertions.length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Select 
                                      value={proc.procedureType}
                                      onValueChange={(v) => updateProcedure(proc.id, { procedureType: v as any })}
                                    >
                                      <SelectTrigger className="h-8 text-xs" data-testid={`select-proc-type-${proc.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="TEST_OF_DETAILS">Test of Details</SelectItem>
                                        <SelectItem value="SUBSTANTIVE_ANALYTICAL">Subst. Analytical</SelectItem>
                                        <SelectItem value="TEST_OF_CONTROLS">Test of Controls</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Input 
                                      value={proc.procedureName}
                                      onChange={(e) => updateProcedure(proc.id, { procedureName: e.target.value })}
                                      placeholder="Procedure name..."
                                      className="h-8 text-sm"
                                      data-testid={`input-proc-name-${proc.id}`}
                                    />
                                    {proc.procedureDescription && (
                                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]" title={proc.procedureDescription}>
                                        {proc.procedureDescription}
                                      </p>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-xs space-y-0.5">
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground w-4">N:</span>
                                        <span>{proc.nature}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground w-4">T:</span>
                                        <span>{proc.timing}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground w-4">E:</span>
                                        <span className="truncate max-w-[100px]" title={proc.extent}>{proc.extent || '-'}</span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {proc.glCodeSet && proc.glCodeSet.length > 0 ? (
                                      <div className="space-y-1">
                                        <Badge 
                                          variant="outline" 
                                          className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                                        >
                                          <Layers className="h-3 w-3 mr-1" />
                                          {proc.populationCount} items
                                        </Badge>
                                        <p className="text-xs text-muted-foreground truncate max-w-[120px]" title={`PKR ${formatAccounting(proc.populationValue || 0)}`}>
                                          PKR {formatAccounting(proc.populationValue || 0)}
                                        </p>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-xs px-2"
                                          onClick={() => openPopulationDialog(proc)}
                                          data-testid={`btn-edit-population-${proc.id}`}
                                        >
                                          Edit
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-start gap-1">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <CircleDashed className="h-3 w-3" />
                                          Not defined
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={() => openPopulationDialog(proc)}
                                          data-testid={`btn-define-population-${proc.id}`}
                                        >
                                          <Layers className="h-3 w-3 mr-1" />
                                          Define
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {proc.selectedSamples && proc.selectedSamples.length > 0 ? (
                                      <div className="space-y-1">
                                        <Badge 
                                          variant="outline" 
                                          className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          {proc.selectedSamples.length} selected
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-xs px-2"
                                          onClick={() => openSamplingDialog(proc)}
                                          data-testid={`btn-edit-samples-${proc.id}`}
                                        >
                                          Edit Samples
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => openSamplingDialog(proc)}
                                        disabled={!proc.glCodeSet || proc.glCodeSet.length === 0}
                                        data-testid={`btn-select-samples-${proc.id}`}
                                      >
                                        <Target className="h-3 w-3 mr-1" />
                                        Select Samples
                                      </Button>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Select 
                                      value={proc.status}
                                      onValueChange={(v) => updateProcedure(proc.id, { status: v as any })}
                                    >
                                      <SelectTrigger className="h-8 text-xs" data-testid={`select-proc-status-${proc.id}`}>
                                        <Badge 
                                          variant={
                                            proc.status === 'COMPLETED' ? 'default' :
                                            proc.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                                          }
                                          className={
                                            proc.status === 'COMPLETED' ? 'bg-green-600' :
                                            proc.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 
                                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                          }
                                        >
                                          {proc.status.replace('_', ' ')}
                                        </Badge>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="PLANNED">
                                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                            PLANNED
                                          </Badge>
                                        </SelectItem>
                                        <SelectItem value="IN_PROGRESS">
                                          <Badge className="bg-blue-600 text-white">IN PROGRESS</Badge>
                                        </SelectItem>
                                        <SelectItem value="COMPLETED">
                                          <Badge className="bg-green-600 text-white">COMPLETED</Badge>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => removeProcedure(proc.id)}
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      data-testid={`btn-remove-proc-${proc.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                  )}

                  {procedureMatrix.length > 0 && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <span><strong>N</strong> = Nature</span>
                      <span><strong>T</strong> = Timing</span>
                      <span><strong>E</strong> = Extent</span>
                      <span className="flex items-center gap-1">
                        <Link2 className="h-3 w-3" /> = Linked to risk
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" /> = Population defined
                      </span>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Population Definition Dialog */}
              <Dialog open={populationDialogOpen} onOpenChange={setPopulationDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Define Population for {selectedProcedureForPopulation?.procedureName || selectedProcedureForPopulation?.id}
                    </DialogTitle>
                    <DialogDescription>
                      Select GL accounts and apply filters to define the audit population for this procedure.
                    </DialogDescription>
                  </DialogHeader>

                  {selectedProcedureForPopulation && (
                    <div className="space-y-4">
                      {/* Procedure Info */}
                      <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-md">
                        <div>
                          <Label className="text-xs text-muted-foreground">FS Head</Label>
                          <p className="font-medium">{selectedProcedureForPopulation.fsHeadLabel || selectedProcedureForPopulation.fsHeadKey || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Assertions</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedProcedureForPopulation.assertions.length > 0 ? (
                              selectedProcedureForPopulation.assertions.map(a => (
                                <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CoA Code Selection */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Select GL Accounts</Label>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={selectAllFilteredCodes}
                              className="h-7 text-xs"
                              data-testid="btn-select-all-codes"
                            >
                              Select All
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={clearAllSelectedCodes}
                              className="h-7 text-xs"
                              data-testid="btn-clear-codes"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>

                        {loadingCoaBalances ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">Loading accounts...</span>
                          </div>
                        ) : filteredCoaForPopulation.length === 0 ? (
                          <div className="text-center py-3 border rounded-md border-dashed">
                            <p className="text-sm text-muted-foreground mb-2">No accounts found for this FS Head</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={fetchCoaWithBalances}
                              data-testid="btn-reload-coa"
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Reload Accounts
                            </Button>
                          </div>
                        ) : (
                          <div className="border rounded-md max-h-60 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-10"></TableHead>
                                  <TableHead className="w-24">Code</TableHead>
                                  <TableHead>Account Name</TableHead>
                                  <TableHead className="text-right w-36">Balance</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredCoaForPopulation.map(item => (
                                  <TableRow 
                                    key={item.accountCode} 
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => toggleCodeSelection(item.accountCode)}
                                    data-testid={`row-coa-${item.accountCode}`}
                                  >
                                    <TableCell>
                                      <Checkbox
                                        checked={populationForm.selectedCodes.includes(item.accountCode)}
                                        onCheckedChange={() => toggleCodeSelection(item.accountCode)}
                                        data-testid={`checkbox-coa-${item.accountCode}`}
                                      />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{item.accountCode}</TableCell>
                                    <TableCell className="text-sm">{item.accountName}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatAccounting(item.closingBalance)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {filteredCoaForPopulation.length === 0 && coaWithBalances.length > 0 && (
                          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                              No accounts match the FS Head "{selectedProcedureForPopulation.fsHeadLabel}". 
                              You may need to allocate accounts to this FS Head in the Chart of Accounts.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Population Filters */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Population Filters (Optional)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Date From</Label>
                            <Input
                              type="date"
                              value={populationForm.dateFrom}
                              onChange={(e) => setPopulationForm(prev => ({ ...prev, dateFrom: e.target.value }))}
                              className="h-8 text-sm"
                              data-testid="input-date-from"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Date To</Label>
                            <Input
                              type="date"
                              value={populationForm.dateTo}
                              onChange={(e) => setPopulationForm(prev => ({ ...prev, dateTo: e.target.value }))}
                              className="h-8 text-sm"
                              data-testid="input-date-to"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Transaction Type</Label>
                            <Select
                              value={populationForm.transactionType}
                              onValueChange={(v) => setPopulationForm(prev => ({ ...prev, transactionType: v as any }))}
                            >
                              <SelectTrigger className="h-8 text-sm" data-testid="select-transaction-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">All</SelectItem>
                                <SelectItem value="DEBITS">Debits Only</SelectItem>
                                <SelectItem value="CREDITS">Credits Only</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Min. Amount</Label>
                            <Input
                              type="number"
                              value={populationForm.minAmount}
                              onChange={(e) => setPopulationForm(prev => ({ ...prev, minAmount: e.target.value }))}
                              placeholder="0"
                              className="h-8 text-sm"
                              data-testid="input-min-amount"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Population Stats */}
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">Population Summary</Label>
                            <p className="text-xs text-muted-foreground mt-1">Based on selected accounts and filters</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Accounts</p>
                                <p className="text-lg font-bold text-primary">{populationStats.count}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total Value</p>
                                <p className="text-lg font-bold text-primary">PKR {formatAccounting(populationStats.value)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setPopulationDialogOpen(false)}
                      data-testid="btn-cancel-population"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={savePopulationDefinition}
                      disabled={populationForm.selectedCodes.length === 0}
                      data-testid="btn-save-population"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Save Population
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Sampling Configuration Dialog */}
              <Dialog open={samplingDialogOpen} onOpenChange={setSamplingDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Sample Selection for {selectedProcedureForSampling?.procedureName || selectedProcedureForSampling?.id}
                    </DialogTitle>
                    <DialogDescription>
                      Configure sampling method and select transactions for audit testing (ISA 530).
                    </DialogDescription>
                  </DialogHeader>

                  {selectedProcedureForSampling && (
                    <div className="space-y-4">
                      {/* Population Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-md">
                        <div>
                          <Label className="text-xs text-muted-foreground">FS Head</Label>
                          <p className="font-medium text-sm">{selectedProcedureForSampling.fsHeadLabel || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Population Items</Label>
                          <p className="font-medium text-sm">{selectedProcedureForSampling.populationCount || mockTransactions.length}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Population Value</Label>
                          <p className="font-medium text-sm">PKR {formatAccounting(selectedProcedureForSampling.populationValue || 0)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">ROMM Level</Label>
                          <Badge variant={
                            assertionLevelRisks.find(r => r.id === selectedProcedureForSampling.linkedRiskId)?.romm === 'High' ? 'destructive' :
                            assertionLevelRisks.find(r => r.id === selectedProcedureForSampling.linkedRiskId)?.romm === 'Medium' ? 'secondary' : 'outline'
                          }>
                            {assertionLevelRisks.find(r => r.id === selectedProcedureForSampling.linkedRiskId)?.romm || 'Not Set'}
                          </Badge>
                        </div>
                      </div>

                      {/* Sampling Method Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Sampling Method</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { value: 'RANDOM_SELECTION' as const, label: 'Random', desc: 'Equal probability selection' },
                            { value: 'MUS' as const, label: 'MUS', desc: 'Monetary unit sampling' },
                            { value: 'TOP_N' as const, label: 'Top N', desc: 'Highest value items' },
                            { value: 'SPECIFIC_SELECTION' as const, label: 'Manual', desc: 'Select manually' },
                          ].map(method => (
                            <Card 
                              key={method.value}
                              className={`cursor-pointer hover-elevate ${samplingForm.method === method.value ? 'border-primary bg-primary/5' : ''}`}
                              onClick={() => handleSamplingMethodChange(method.value)}
                              data-testid={`card-method-${method.value}`}
                            >
                              <CardContent className="p-3 text-center">
                                <p className="font-medium text-sm">{method.label}</p>
                                <p className="text-xs text-muted-foreground">{method.desc}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Sampling Parameters */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Sample Size</Label>
                          <Input
                            type="number"
                            value={samplingForm.sampleSize}
                            onChange={(e) => {
                              const size = parseInt(e.target.value) || 0;
                              setSamplingForm(prev => ({
                                ...prev,
                                sampleSize: e.target.value,
                                selectedItems: samplingForm.method !== 'SPECIFIC_SELECTION' 
                                  ? applySamplingMethod(samplingForm.method, mockTransactions, size)
                                  : prev.selectedItems
                              }));
                            }}
                            className="h-8"
                            data-testid="input-sample-size"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Confidence Level</Label>
                          <Select
                            value={samplingForm.confidenceLevel}
                            onValueChange={(v) => setSamplingForm(prev => ({ ...prev, confidenceLevel: v as ConfidenceLevel }))}
                          >
                            <SelectTrigger className="h-8" data-testid="select-confidence">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="90">90%</SelectItem>
                              <SelectItem value="95">95%</SelectItem>
                              <SelectItem value="99">99%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Tolerable Error</Label>
                          <Input
                            type="number"
                            value={samplingForm.tolerableError}
                            onChange={(e) => setSamplingForm(prev => ({ ...prev, tolerableError: e.target.value }))}
                            placeholder="PKR"
                            className="h-8"
                            data-testid="input-tolerable-error"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">&nbsp;</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8"
                            onClick={handleCalculateSampleSize}
                            data-testid="btn-calculate-sample-size"
                            title="Calculate sample size based on parameters"
                          >
                            <Calculator className="h-3 w-3 mr-1" />
                            Calculate
                          </Button>
                        </div>
                      </div>

                      {/* Sample Selection Table */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            Transaction Selection ({samplingForm.selectedItems.length} of {mockTransactions.length} selected)
                          </Label>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setSamplingForm(prev => ({ ...prev, selectedItems: mockTransactions.map(t => t.id) }))}
                              data-testid="btn-select-all-samples"
                            >
                              Select All
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setSamplingForm(prev => ({ ...prev, selectedItems: [] }))}
                              data-testid="btn-clear-samples"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        
                        <div className="border rounded-md max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10"></TableHead>
                                <TableHead className="w-28">Doc#</TableHead>
                                <TableHead className="w-28">Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right w-32">Amount</TableHead>
                                <TableHead className="w-24">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mockTransactions.map(tx => (
                                <TableRow 
                                  key={tx.id}
                                  className={`cursor-pointer ${samplingForm.selectedItems.includes(tx.id) ? 'bg-primary/5' : ''}`}
                                  onClick={() => toggleTransactionSelection(tx.id)}
                                  data-testid={`row-tx-${tx.id}`}
                                >
                                  <TableCell>
                                    <Checkbox
                                      checked={samplingForm.selectedItems.includes(tx.id)}
                                      onCheckedChange={() => toggleTransactionSelection(tx.id)}
                                      data-testid={`checkbox-tx-${tx.id}`}
                                    />
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{tx.docNumber}</TableCell>
                                  <TableCell className="text-xs">{tx.date}</TableCell>
                                  <TableCell className="text-sm">{tx.description}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {formatAccounting(tx.amount)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {tx.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Selection Summary */}
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">Selection Summary</Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Method: {samplingForm.method.replace('_', ' ')} | Confidence: {samplingForm.confidenceLevel}%
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Selected Items</p>
                                <p className="text-lg font-bold text-primary">{samplingForm.selectedItems.length}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Selected Value</p>
                                <p className="text-lg font-bold text-primary">
                                  PKR {formatAccounting(
                                    mockTransactions
                                      .filter(t => samplingForm.selectedItems.includes(t.id))
                                      .reduce((sum, t) => sum + t.amount, 0)
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setSamplingDialogOpen(false)}
                      data-testid="btn-cancel-sampling"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={saveSamplingSelection}
                      disabled={samplingForm.selectedItems.length === 0}
                      data-testid="btn-save-samples"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Save Selection ({samplingForm.selectedItems.length} items)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Audit Trail Summary Section */}
              <Accordion type="single" collapsible className="w-full" data-testid="audit-trail-summary-accordion">
                <AccordionItem value="audit-trail-summary" className="border rounded-lg bg-gradient-to-r from-slate-50/50 to-slate-100/50 dark:from-slate-950/50 dark:to-slate-900/50">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Audit Trail Summary (End-to-End)</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {assertionLevelRisks.length} FS Heads
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {assertionLevelRisks.filter(r => r.romm === 'High').length}H / 
                          {assertionLevelRisks.filter(r => r.romm === 'Medium').length}M / 
                          {assertionLevelRisks.filter(r => r.romm === 'Low').length}L
                        </span>
                        <span className="flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          {procedureMatrix.length} Procedures
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {/* Summary Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-3 bg-muted/30 rounded-md">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">FS Heads with Risks</p>
                        <p className="text-lg font-bold text-primary">{assertionLevelRisks.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Risks (H/M/L)</p>
                        <div className="flex items-center justify-center gap-1">
                          <Badge variant="destructive" className="text-xs px-1.5">
                            {assertionLevelRisks.filter(r => r.romm === 'High').length}
                          </Badge>
                          <Badge variant="secondary" className="text-xs px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            {assertionLevelRisks.filter(r => r.romm === 'Medium').length}
                          </Badge>
                          <Badge variant="outline" className="text-xs px-1.5 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                            {assertionLevelRisks.filter(r => r.romm === 'Low').length}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Procedures</p>
                        <p className="text-lg font-bold">
                          {procedureMatrix.length}
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            ({procedureMatrix.filter(p => p.status === 'COMPLETED').length} done)
                          </span>
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Population Items</p>
                        <p className="text-lg font-bold">{procedureMatrix.reduce((sum, p) => sum + (p.populationCount || 0), 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Samples Selected</p>
                        <p className="text-lg font-bold">{procedureMatrix.reduce((sum, p) => sum + (p.selectedSamples?.length || 0), 0)}</p>
                      </div>
                    </div>

                    {/* Audit Trail Tree */}
                    {assertionLevelRisks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-4 text-center border border-dashed rounded-md">
                        <CircleDashed className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium">No Assertion Risks Defined</p>
                        <p className="text-xs text-muted-foreground">
                          Add FS Heads to the Assertion Level Risk Matrix above to see the audit trail.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {assertionLevelRisks.map((risk) => {
                          const linkedProcedures = procedureMatrix.filter(p => p.linkedRiskId === risk.id || p.fsHeadKey === risk.fsHeadKey);
                          const totalPopulationValue = linkedProcedures.reduce((sum, p) => sum + (p.populationValue || 0), 0);
                          const totalSampleValue = linkedProcedures.reduce((sum, p) => {
                            if (!p.selectedSamples?.length || !p.populationValue || !p.populationCount) return sum;
                            return sum + (p.populationValue / p.populationCount) * p.selectedSamples.length;
                          }, 0);
                          
                          return (
                            <div key={risk.id} className="border rounded-md bg-background" data-testid={`audit-trail-fs-${risk.id}`}>
                              {/* FS Head Level */}
                              <div className="flex items-center gap-2 p-3 border-b bg-muted/20">
                                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                                <span className="font-medium text-sm">{risk.fsHeadLabel || risk.fsHeadKey}</span>
                                {risk.significantRisk && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">SIG</Badge>
                                )}
                                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                                  {linkedProcedures.length > 0 ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                                      <span>{linkedProcedures.length} procedure(s)</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="h-3 w-3 text-amber-500" />
                                      <span className="text-amber-600">No procedures linked</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <div className="p-3 space-y-2">
                                {/* Assertions Level */}
                                <div className="flex items-start gap-2 pl-4 relative">
                                  <div className="absolute left-1 top-0 bottom-0 w-px bg-border" />
                                  <div className="absolute left-1 top-2.5 w-2 h-px bg-border" />
                                  <Shield className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <span className="text-xs text-muted-foreground">Assertions: </span>
                                    <div className="inline-flex flex-wrap gap-1 ml-1">
                                      {risk.assertions.length > 0 ? (
                                        risk.assertions.map(a => (
                                          <Badge key={a} variant="outline" className="text-[10px] px-1.5 py-0">{a}</Badge>
                                        ))
                                      ) : (
                                        <span className="text-xs text-muted-foreground italic">None selected</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Risk/ROMM Level */}
                                <div className="flex items-start gap-2 pl-8 relative">
                                  <div className="absolute left-1 top-0 h-6 w-px bg-border" />
                                  <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                                  <div className="absolute left-5 top-2.5 w-2 h-px bg-border" />
                                  <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                                    risk.romm === 'High' ? 'text-red-500' :
                                    risk.romm === 'Medium' ? 'text-amber-500' : 'text-green-500'
                                  }`} />
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground">ROMM:</span>
                                    <Badge variant={
                                      risk.romm === 'High' ? 'destructive' :
                                      risk.romm === 'Medium' ? 'secondary' : 'outline'
                                    } className={`text-[10px] px-1.5 py-0 ${
                                      risk.romm === 'Medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
                                      risk.romm === 'Low' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : ''
                                    }`}>
                                      {risk.romm || 'Not Set'}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                      (IR: {risk.inherentRisk || '-'} × CR: {risk.controlRisk || '-'})
                                    </span>
                                  </div>
                                </div>

                                {/* Procedures Level */}
                                {linkedProcedures.length > 0 ? (
                                  linkedProcedures.map((proc, procIdx) => (
                                    <div key={proc.id} className="pl-12 relative">
                                      <div className="absolute left-1 top-0 h-6 w-px bg-border" />
                                      <div className="absolute left-5 top-0 h-6 w-px bg-border" />
                                      <div className="absolute left-9 top-0 bottom-0 w-px bg-border" />
                                      <div className="absolute left-9 top-2.5 w-2 h-px bg-border" />
                                      
                                      <div className="space-y-1.5">
                                        {/* Procedure Info */}
                                        <div className="flex items-start gap-2">
                                          <ClipboardList className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-mono text-[10px] text-muted-foreground">{proc.id}</span>
                                              <span className="text-xs">{proc.procedureName || 'Unnamed procedure'}</span>
                                              <Badge 
                                                variant={proc.status === 'COMPLETED' ? 'default' : proc.status === 'IN_PROGRESS' ? 'secondary' : 'outline'}
                                                className={`text-[10px] px-1.5 py-0 ${
                                                  proc.status === 'COMPLETED' ? 'bg-green-600' :
                                                  proc.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : ''
                                                }`}
                                              >
                                                {proc.status?.replace('_', ' ') || 'PLANNED'}
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Population Level */}
                                        <div className="flex items-start gap-2 pl-4 relative">
                                          <div className="absolute left-0.5 top-0 bottom-0 w-px bg-border" />
                                          <div className="absolute left-0.5 top-2 w-2 h-px bg-border" />
                                          <Database className="h-3 w-3 text-cyan-500 mt-0.5 flex-shrink-0" />
                                          <span className="text-[11px] text-muted-foreground">
                                            Population: {proc.populationCount || 0} accounts | PKR {formatAccounting(proc.populationValue || 0)}
                                          </span>
                                        </div>

                                        {/* Samples Level */}
                                        <div className="flex items-start gap-2 pl-8 relative">
                                          <div className="absolute left-0.5 top-0 h-3 w-px bg-border" />
                                          <div className="absolute left-4.5 top-0 bottom-0 w-px bg-border" />
                                          <div className="absolute left-4.5 top-2 w-2 h-px bg-border" />
                                          <Target className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                                          <span className="text-[11px] text-muted-foreground">
                                            Samples: {proc.selectedSamples?.length || 0} selected | 
                                            PKR {formatAccounting(proc.populationCount && proc.populationValue && proc.selectedSamples?.length
                                              ? (proc.populationValue / proc.populationCount) * proc.selectedSamples.length
                                              : 0
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="pl-12 relative">
                                    <div className="absolute left-1 top-0 h-3 w-px bg-border" />
                                    <div className="absolute left-5 top-0 h-3 w-px bg-border" />
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic py-1">
                                      <ClipboardList className="h-3 w-3 text-muted-foreground" />
                                      <span>No procedures linked to this risk</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Fraud Risk Assessment (ISA 240.15) <span className="text-destructive">*</span></Label><AIAssistButton fieldName="fraudRiskAssessment" fieldLabel="Fraud Risk Assessment" promptType={getPromptType("fraudRiskAssessment")} context={`Fraud risk assessment per ISA 240.15 for ${engagement?.engagementCode || "engagement"}. Client: ${client?.name || "N/A"}`} engagementId={engagementId} page="planning" section="risk-assessment" onInsert={(c) => setRiskAssessment(p => ({...p, fraudRiskAssessment: c}))} currentValue={riskAssessment.fraudRiskAssessment} /></div>
                <Textarea 
                  value={riskAssessment.fraudRiskAssessment}
                  onChange={(e) => setRiskAssessment(p => ({...p, fraudRiskAssessment: e.target.value}))}
                  placeholder="Document fraud risk factors: incentives/pressures, opportunities, attitudes/rationalization..."
                  rows={4}
                />
              </div>

              <Separator className="my-6" />

              {engagementId && (
                <SyncPlanningToExecution engagementId={engagementId} />
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* Tab 4: Materiality */}
        <TabsContent value="materiality" className="space-y-4 mt-3" data-testid="tab-content-materiality">
          {engagementId && (
            <>
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Materiality Phase Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-md border border-blue-100 dark:border-blue-900">
                      <div className="flex items-center gap-2 mb-1">
                        <Calculator className="h-4 w-4 text-blue-500" />
                        <p className="text-sm font-medium">Benchmark & Calculation</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Select benchmark basis, calculate OM, PM, and trivial threshold per ISA 320</p>
                    </div>
                    <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-md border border-purple-100 dark:border-purple-900">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-purple-500" />
                        <p className="text-sm font-medium">Qualitative Factors</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Assess entity-specific risk factors, fraud considerations, and regulatory environment</p>
                    </div>
                    <div className="p-3 bg-green-50/50 dark:bg-green-950/20 rounded-md border border-green-100 dark:border-green-900">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <p className="text-sm font-medium">Approval & Linkage</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Partner approval and downstream linkage to risk assessment and significant accounts</p>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <h3 className="text-sm font-semibold">AI Support Available</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">Benchmark Recommendation</Badge>
                      <Badge variant="outline" className="text-xs">Materiality Narration</Badge>
                      <Badge variant="outline" className="text-xs">Linkage Summary</Badge>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">DOWNSTREAM LINKAGE</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" variant="secondary">
                        <ChevronRight className="h-3 w-3 mr-1" /> FS Heads — Significant account identification
                      </Badge>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" variant="secondary">
                        <ChevronRight className="h-3 w-3 mr-1" /> Risk Assessment — Risk scoring thresholds
                      </Badge>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" variant="secondary">
                        <ChevronRight className="h-3 w-3 mr-1" /> Planning — Sampling size determination
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ISA320MaterialityPanelNew
                engagementId={engagementId}
                readOnly={planningReadOnly}
              />
            </>
          )}
        </TabsContent>

        {/* Tab D: Analytical Procedures (ISA 520) */}
        <TabsContent value="analytical-procedures" className="space-y-4 mt-3" data-testid="tab-content-analytical-procedures">
          {engagementId && (
            <AnalyticalProceduresPanel
              engagementId={engagementId}
              readOnly={planningReadOnly}
            />
          )}
        </TabsContent>



        {/* Tab 5: Strategy & Approach */}
        <TabsContent value="strategy-approach" className="space-y-4 mt-3" data-testid="tab-content-strategy-approach">
          {/* AI-Driven ISA 300/330 Strategy Panel */}
          {engagementId && (
            <ISA300StrategyPanel 
              engagementId={engagementId}
              onStrategyGenerated={(result) => {
                // Update local state with AI-generated strategy
                if (result.step2_overallAuditApproach) {
                  setAuditStrategy(prev => ({
                    ...prev,
                    auditApproach: (result.step2_overallAuditApproach.approachType as string) === 'Substantive' ? 'substantive' :
                                   (result.step2_overallAuditApproach.approachType as string) === 'Controls-Reliant' ? 'controls' : 'combined',
                    overallStrategy: result.step9_documentation?.overallAuditStrategySummary || prev.overallStrategy,
                    keyAuditMatters: result.step7_potentialKAMs?.map(k => k.matter).join('\n\n') || prev.keyAuditMatters,
                    significantRisksResponse: result.step9_documentation?.responseToSignificantRisksSummary || prev.significantRisksResponse,
                    samplingApproach: (result.step6_samplingApproaches?.[0]?.approach as string) === 'Statistical' ? 'statistical' :
                                      (result.step6_samplingApproaches?.[0]?.approach as string) === 'MUS' ? 'mus' : 'non-statistical',
                  }));
                }
              }}
            />
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Manual Strategy & Approach
                  </CardTitle>
                  <CardDescription>ISA 330 Compliant - Manual controls for audit strategy documentation</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" data-testid="btn-save-strategy">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button size="sm" data-testid="btn-proceed-to-sampling">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Proceed to Sampling
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Overall Audit Approach <span className="text-destructive">*</span></Label>
                  <Select value={auditStrategy.auditApproach} onValueChange={(v) => setAuditStrategy(p => ({...p, auditApproach: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="controls">Controls Reliance Approach</SelectItem>
                      <SelectItem value="substantive">Substantive Approach</SelectItem>
                      <SelectItem value="combined">Combined Approach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sampling Approach <span className="text-destructive">*</span></Label>
                  <Select value={auditStrategy.samplingApproach} onValueChange={(v) => setAuditStrategy(p => ({...p, samplingApproach: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="statistical">Statistical Sampling</SelectItem>
                      <SelectItem value="non-statistical">Non-Statistical Sampling</SelectItem>
                      <SelectItem value="mus">Monetary Unit Sampling (MUS)</SelectItem>
                      <SelectItem value="stratified">Stratified Sampling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label>Overall Audit Strategy <span className="text-destructive">*</span></Label><AIAssistButton fieldName="overallStrategy" fieldLabel="Overall Audit Strategy" promptType={getPromptType("overallStrategy")} context={`Overall audit strategy per ISA 300 for ${engagement?.engagementCode || "engagement"}`} engagementId={engagementId} page="planning" section="strategy-approach" onInsert={(c) => setAuditStrategy(p => ({...p, overallStrategy: c}))} currentValue={auditStrategy.overallStrategy} /></div>
                  <Textarea 
                    value={auditStrategy.overallStrategy}
                    onChange={(e) => setAuditStrategy(p => ({...p, overallStrategy: e.target.value}))}
                    placeholder="Document the overall audit strategy including scope, timing, and direction (ISA 330.5)..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label>Key Audit Matters <span className="text-destructive">*</span></Label><AIAssistButton fieldName="keyAuditMatters" fieldLabel="Key Audit Matters" promptType={getPromptType("keyAuditMatters")} context={`Key audit matters identification per ISA 701 for ${engagement?.engagementCode || "engagement"}`} engagementId={engagementId} page="planning" section="strategy-approach" onInsert={(c) => setAuditStrategy(p => ({...p, keyAuditMatters: c}))} currentValue={auditStrategy.keyAuditMatters} /></div>
                  <Textarea 
                    value={auditStrategy.keyAuditMatters}
                    onChange={(e) => setAuditStrategy(p => ({...p, keyAuditMatters: e.target.value}))}
                    placeholder="Identify potential Key Audit Matters based on risk assessment..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><Label>Response to Significant Risks <span className="text-destructive">*</span></Label><AIAssistButton fieldName="responseToSignificantRisks" fieldLabel="Response to Significant Risks" promptType={getPromptType("responseToSignificantRisks")} context={`Audit responses to significant risks per ISA 330 for ${engagement?.engagementCode || "engagement"}`} engagementId={engagementId} page="planning" section="strategy-approach" onInsert={(c) => setAuditStrategy(p => ({...p, significantRisksResponse: c}))} currentValue={auditStrategy.significantRisksResponse} /></div>
                  <Textarea 
                    value={auditStrategy.significantRisksResponse}
                    onChange={(e) => setAuditStrategy(p => ({...p, significantRisksResponse: e.target.value}))}
                    placeholder="Document planned responses to significant risks (ISA 330.6)..."
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>


        {/* Tab 7: Audit Program */}
        <TabsContent value="audit-program" className="space-y-4 mt-3" data-testid="tab-content-audit-program">
          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Audit Program
                  </CardTitle>
                  <CardDescription>Per-head procedures based on ISA 330 requirements</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" data-testid="btn-ai-generate-program"
                    title="AI-generate audit program procedures"
                    onClick={() => {
                      const defaultPrograms = assertionLevelRisks.map(risk => ({
                        fsHeadKey: risk.fsHeadKey,
                        fsHeadLabel: risk.fsHeadLabel || risk.fsHeadKey,
                        procedures: [
                          { id: `proc-${risk.id}-1`, description: `Obtain and review ${risk.fsHeadLabel || risk.fsHeadKey} supporting documentation.`, type: 'substantive' as const, status: 'not-started' as const },
                          { id: `proc-${risk.id}-2`, description: `Perform analytical review of ${risk.fsHeadLabel || risk.fsHeadKey} movements.`, type: 'analytical' as const, status: 'not-started' as const },
                          ...(risk.significantRisk ? [{ id: `proc-${risk.id}-3`, description: `Extended testing for significant risk: ${risk.fsHeadLabel || risk.fsHeadKey}.`, type: 'substantive' as const, status: 'not-started' as const }] : [])
                        ]
                      }));
                      setAuditPrograms(defaultPrograms);
                      saveEngine.signalChange();
                      toast({ title: "Audit Program Generated", description: `Generated procedures for ${defaultPrograms.length} FS heads from risk matrix.` });
                    }}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI Generate
                  </Button>
                  <Button variant="outline" size="sm" data-testid="btn-edit-program"
                    onClick={() => toast({ title: "Edit Mode", description: "Edit procedures directly in the table below." })}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button size="sm" data-testid="btn-lock-program-reviewed"
                    onClick={() => {
                      setAuditPrograms(prev => prev.map(p => ({ ...p, procedures: p.procedures.map((pr: any) => ({ ...pr, status: 'reviewed' })) })));
                      saveEngine.signalChange();
                      toast({ title: "Program Locked", description: "Audit program procedures marked as reviewed." });
                    }}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Lock as Reviewed
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
          <AuditProgramSection
            programs={auditPrograms}
            onProgramsChange={setAuditPrograms}
            overallMateriality={materialityCalc.overallMateriality || 1000000}
            performanceMateriality={materialityCalc.performanceMateriality || 750000}
            industryType={(client as any)?.industry || "Manufacturing"}
            companyProfile={{
              name: client?.name,
              country: (client as any)?.country || "Pakistan",
              regulatoryFramework: "ICAP/SECP",
              fiscalYear: engagement?.periodEnd ? new Date(engagement.periodEnd).getFullYear().toString() : new Date().getFullYear().toString(),
              listedStatus: (client as any)?.listedStatus || "Unlisted"
            }}
            engagementId={engagementId}
          />

          {/* ISA 330 AI-Powered Audit Program & Procedure Engine */}
          <AuditProgramPanel
            engagementId={engagementId}
            onDataChange={() => {}}
            onPushToExecution={() => {}}
          />

          {/* Dynamic Link Monitor & Auto-Repair Engine */}
          <LinkageMonitorPanel
            engagementId={engagementId}
            onDataChange={() => {}}
          />

        </TabsContent>

        {/* Tab F: Significant Accounts, Classes of Transactions & Disclosures */}
        <TabsContent value="significant-accounts" className="space-y-4 mt-3" data-testid="tab-content-significant-accounts">
          {engagementId && (
            <SignificantAccountsPanel engagementId={engagementId} readOnly={planningReadOnly} />
          )}
        </TabsContent>

        {/* Tab H: Fraud Risk Assessment (ISA 240) */}
        <TabsContent value="fraud-risk" className="space-y-4 mt-3" data-testid="tab-content-fraud-risk">
          {engagementId && (
            <FraudRiskPanel
              engagementId={engagementId}
              readOnly={planningReadOnly}
              onFieldChange={handleExtendedFieldChange}
              planningData={extendedPlanningData}
            />
          )}
        </TabsContent>

        {/* Tab I: Internal Control / Process Understanding / Walkthroughs */}
        <TabsContent value="internal-controls" className="space-y-4 mt-3" data-testid="tab-content-internal-controls">
          {engagementId && (
            <InternalControlsPanel
              engagementId={engagementId}
              readOnly={planningReadOnly}
              onFieldChange={handleExtendedFieldChange}
              planningData={extendedPlanningData}
            />
          )}
        </TabsContent>

        {/* Tab J: Related Parties (ISA 550) */}
        <TabsContent value="related-parties" className="space-y-4 mt-3" data-testid="tab-content-related-parties">
          {engagementId && (
            <RelatedPartiesPanel
              engagementId={engagementId}
              readOnly={planningReadOnly}
              onFieldChange={handleExtendedFieldChange}
              planningData={extendedPlanningData}
            />
          )}
        </TabsContent>

        {/* Tab K: Laws & Regulations (ISA 250) */}
        <TabsContent value="laws-regulations" className="space-y-4 mt-3" data-testid="tab-content-laws-regulations">
          {engagementId && (
            <LawsRegulationsPanel
              engagementId={engagementId}
              readOnly={planningReadOnly}
              onFieldChange={handleExtendedFieldChange}
              planningData={extendedPlanningData}
            />
          )}
        </TabsContent>

        {/* Tab L: Going Concern & Subsequent Events (ISA 570) */}
        <TabsContent value="going-concern" className="space-y-4 mt-3" data-testid="tab-content-going-concern">
          {engagementId && (
            <GoingConcernPanel
              engagementId={engagementId}
              readOnly={planningReadOnly}
              onFieldChange={handleExtendedFieldChange}
              planningData={extendedPlanningData}
            />
          )}
        </TabsContent>

        {/* Tab M: Team Planning / Budget / Timelines */}
        <TabsContent value="team-planning" className="space-y-4 mt-3" data-testid="tab-content-team-planning">
          {engagementId && (
            <TeamPlanningPanel
              engagementId={engagementId}
              readOnly={planningReadOnly}
              onFieldChange={handleExtendedFieldChange}
              planningData={extendedPlanningData}
            />
          )}
        </TabsContent>

        {/* Tab P: Planning Memo / Final Approval */}
        <TabsContent value="planning-memo" className="space-y-4 mt-3" data-testid="tab-content-planning-memo">
          {engagementId && (
            <PlanningMemoPanel
              engagementId={engagementId}
              readOnly={planningReadOnly}
              onFieldChange={handleExtendedFieldChange}
              planningData={extendedPlanningData}
            />
          )}
        </TabsContent>

        {/* Legacy specialized areas removed — content promoted to individual tabs J, K, L */}


      </Tabs>
      </div>
    </PageShell>
  );
}
