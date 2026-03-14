import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle2, Circle, AlertTriangle, Lock, Unlock, Calculator, Database,
  Target, Shield, FileText, Users, ArrowDown, ArrowRight, Info, Save,
  RefreshCw, ChevronDown, ChevronUp, Printer, X, Plus, Trash2, History,
  BarChart3, Scale, TrendingDown, XCircle, Loader2,
} from "lucide-react";

interface Props {
  engagementId: string;
  readOnly?: boolean;
}

interface SourceData {
  revenue: number; totalAssets: number; totalEquity: number; profitBeforeTax: number;
  grossProfit: number; totalExpenses: number;
  priorYearRevenue: number | null; priorYearAssets: number | null; priorYearPBT: number | null; priorYearEquity: number | null;
  entityType: string | null; industry: string | null; engagementType: string | null;
  ownershipStructure: string | null; regulatoryCategory: string | null;
  tbImported: boolean; fsMapped: boolean; riskAssessmentDone: boolean;
  fraudRiskCount: number; significantRiskCount: number;
  goingConcernFlag: boolean; relatedPartyFlag: boolean; covenantFlag: boolean; publicInterestFlag: boolean;
  accountCount: number; snapshotDate: string;
}

interface BenchmarkRecommendation {
  recommended: string; recommendedValue: number; recommendedPercentage: number;
  recommendedRange: { min: number; max: number }; justification: string;
  alternates: Array<{ type: string; value: number; range: { min: number; max: number }; reason: string }>;
  warnings: string[];
}

interface QualFactor {
  id: string; title: string; present: boolean; severity: "LOW" | "MODERATE" | "HIGH";
  explanation: string; impact: "NO_CHANGE" | "REDUCE_OM" | "REDUCE_PM" | "SET_SPECIFIC"; isaRef: string;
}

interface SpecMat {
  id: string; area: string; fsHead: string; amount: number; rationale: string; linkedRiskId: string | null;
}

interface OverrideRecord {
  id: string; field: string; systemValue: number; overriddenValue: number; reason: string;
  effectOnTesting: string; userId: string; userName: string; userRole: string;
  timestamp: string; reverted: boolean; revertedAt: string | null; revertedBy: string | null;
}

interface MaterialitySetData {
  id: string; status: string; versionId: number; benchmarkType: string; benchmarkAmount: string;
  percentApplied: string; overallMateriality: string; performanceMateriality: string;
  trivialThreshold: string; pmPercentage: string | null; trivialPercentage: string | null;
  rationale: string | null; benchmarkJustification: string | null;
  sourceDataSnapshot: SourceData | null; qualitativeFactors: QualFactor[] | null;
  riskAdjustments: unknown; specificMateriality: SpecMat[] | null;
  overrideHistory: OverrideRecord[] | null; stepProgress: Record<string, string> | null;
  isLocked: boolean; isStale: boolean; staleReason: string | null;
  preparedBy: { fullName: string; role: string } | null;
  reviewedBy: { fullName: string; role: string } | null;
  approvedBy: { fullName: string; role: string } | null;
  lockedBy: { fullName: string; role: string } | null;
  preparedAt: string | null; reviewedAt: string | null; approvedAt: string | null; lockedAt: string | null;
}

interface EngInfo {
  name: string; clientName: string; financialYear: number | null;
  periodStart: string | null; periodEnd: string | null;
}

const BENCHMARK_LABELS: Record<string, string> = {
  PBT: "Profit Before Tax", REVENUE: "Total Revenue", TOTAL_ASSETS: "Total Assets",
  EQUITY: "Total Equity", GROSS_PROFIT: "Gross Profit", TOTAL_EXPENSES: "Total Expenditure",
};

const BENCHMARK_RANGES: Record<string, { min: number; max: number; default: number }> = {
  PBT: { min: 5, max: 10, default: 5 }, REVENUE: { min: 0.5, max: 2, default: 1 },
  TOTAL_ASSETS: { min: 0.5, max: 2, default: 1 }, EQUITY: { min: 1, max: 5, default: 2 },
  GROSS_PROFIT: { min: 2, max: 5, default: 3 }, TOTAL_EXPENSES: { min: 0.5, max: 2, default: 1 },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800", PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  PENDING_APPROVAL: "bg-blue-100 text-blue-800", APPROVED: "bg-green-100 text-green-800",
  LOCKED: "bg-purple-100 text-purple-800", SUPERSEDED: "bg-red-100 text-red-800",
};

function fmtPKR(n: number): string {
  if (n === 0) return "PKR 0";
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STEPS = [
  { key: "data", label: "Data Readiness", icon: Database, help: "Verify Trial Balance, FS mapping, and risk data are available" },
  { key: "benchmark_rec", label: "Benchmark Recommendation", icon: Target, help: "System recommends optimal benchmark based on entity profile" },
  { key: "benchmark_sel", label: "Benchmark Selection", icon: Scale, help: "Select and confirm the benchmark for materiality calculation" },
  { key: "percentage", label: "Percentage Selection", icon: TrendingDown, help: "Choose appropriate percentage within ISA 320 guidelines" },
  { key: "qualitative", label: "Qualitative Factors", icon: Shield, help: "Assess factors that may require lower materiality" },
  { key: "calculation", label: "Materiality Calculation", icon: Calculator, help: "Calculate OM, PM, Specific Materiality, and Trivial Threshold" },
  { key: "linkage", label: "Risk & FS Head Linkage", icon: BarChart3, help: "Link materiality to significant accounts and risk assessment" },
  { key: "override", label: "Partner Override", icon: Users, help: "Partner may override system-calculated values with justification" },
  { key: "documentation", label: "Documentation & Memo", icon: FileText, help: "Generate ISA 320 Planning Materiality Memo" },
  { key: "lock", label: "Lock & Push", icon: Lock, help: "Lock materiality and push to downstream modules" },
];

export function ISA320MaterialityPanel({ engagementId, readOnly = false }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
  const [showMemo, setShowMemo] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  const [benchmarkType, setBenchmarkType] = useState("PBT");
  const [benchmarkAmount, setBenchmarkAmount] = useState(0);
  const [percentApplied, setPercentApplied] = useState(5);
  const [pmPercentage, setPmPercentage] = useState(75);
  const [trivialPercentage, setTrivialPercentage] = useState(5);
  const [rationale, setRationale] = useState("");
  const [benchmarkJustification, setBenchmarkJustification] = useState("");
  const [qualFactors, setQualFactors] = useState<QualFactor[]>([]);
  const [specificMats, setSpecificMats] = useState<SpecMat[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideEffect, setOverrideEffect] = useState("");
  const [overrideOM, setOverrideOM] = useState("");
  const [overridePM, setOverridePM] = useState("");
  const [overrideTrivial, setOverrideTrivial] = useState("");

  const { data: sourceResp, isLoading, refetch: refetchSource } = useQuery({
    queryKey: ["/api/isa320-materiality", engagementId, "source-data"],
    queryFn: () => apiRequest("GET", `/api/isa320-materiality/${engagementId}/source-data`).then(r => r.json()),
    enabled: !!engagementId,
    staleTime: 30000,
  });

  const sourceData: SourceData | null = sourceResp?.sourceData || null;
  const recommendation: BenchmarkRecommendation | null = sourceResp?.recommendation || null;
  const existingSet: MaterialitySetData | null = sourceResp?.existingSet || null;
  const engInfo: EngInfo | null = sourceResp?.engagementInfo || null;
  const isStale: boolean = sourceResp?.isStale || false;
  const staleReason: string = sourceResp?.staleReason || "";

  const isLocked = existingSet?.isLocked || false;
  const isPartner = user?.role === "PARTNER" || user?.role === "FIRM_ADMIN";
  const canEdit = !readOnly && !isLocked;
  const status = existingSet?.status || "NOT_STARTED";

  useEffect(() => {
    if (existingSet) {
      setBenchmarkType(existingSet.benchmarkType || "PBT");
      setBenchmarkAmount(Number(existingSet.benchmarkAmount) || 0);
      setPercentApplied(Number(existingSet.percentApplied) || 5);
      setPmPercentage(Number(existingSet.pmPercentage) || 75);
      setTrivialPercentage(Number(existingSet.trivialPercentage) || 5);
      setRationale(existingSet.rationale || "");
      setBenchmarkJustification(existingSet.benchmarkJustification || "");
      if (existingSet.qualitativeFactors) setQualFactors(existingSet.qualitativeFactors);
      if (existingSet.specificMateriality) setSpecificMats(existingSet.specificMateriality);
    } else if (recommendation && sourceData) {
      setBenchmarkType(recommendation.recommended);
      setBenchmarkAmount(recommendation.recommendedValue);
      setPercentApplied(recommendation.recommendedPercentage);
      setBenchmarkJustification(recommendation.justification);
    }
  }, [existingSet, recommendation, sourceData]);

  useEffect(() => {
    if (sourceResp?.qualitativeFactorDefaults && qualFactors.length === 0 && !existingSet?.qualitativeFactors) {
      setQualFactors(sourceResp.qualitativeFactorDefaults.map((f: Omit<QualFactor, "present" | "severity" | "explanation" | "impact">) => ({
        ...f, present: false, severity: "LOW" as const, explanation: "", impact: "NO_CHANGE" as const,
      })));
    }
  }, [sourceResp, qualFactors.length, existingSet]);

  const om = useMemo(() => Math.round(benchmarkAmount * (percentApplied / 100)), [benchmarkAmount, percentApplied]);
  const pm = useMemo(() => Math.round(om * (pmPercentage / 100)), [om, pmPercentage]);
  const trivial = useMemo(() => Math.round(om * (trivialPercentage / 100)), [om, trivialPercentage]);

  const savedOM = existingSet ? Number(existingSet.overallMateriality) : 0;
  const savedPM = existingSet ? Number(existingSet.performanceMateriality) : 0;
  const savedTrivial = existingSet ? Number(existingSet.trivialThreshold) : 0;
  const displayOM = existingSet ? savedOM : om;
  const displayPM = existingSet ? savedPM : pm;
  const displayTrivial = existingSet ? savedTrivial : trivial;

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", `/api/isa320-materiality/${engagementId}/save`, body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isa320-materiality", engagementId] });
      toast({ title: "Materiality Saved", description: "Draft saved successfully." });
    },
    onError: (err: Error) => toast({ title: "Save Failed", description: err.message, variant: "destructive" }),
  });

  const finalizeMutation = useMutation({
    mutationFn: (body: { action: string }) => apiRequest("POST", `/api/isa320-materiality/${engagementId}/finalize`, body).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/isa320-materiality", engagementId] });
      const s = data.materialitySet?.status || "updated";
      toast({ title: "Status Updated", description: `Materiality status: ${s}` });
    },
    onError: (err: Error) => toast({ title: "Action Failed", description: err.message, variant: "destructive" }),
  });

  const overrideMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", `/api/isa320-materiality/${engagementId}/partner-override`, body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isa320-materiality", engagementId] });
      toast({ title: "Override Applied", description: "Partner override recorded with audit trail." });
      setOverrideReason(""); setOverrideEffect(""); setOverrideOM(""); setOverridePM(""); setOverrideTrivial("");
    },
    onError: (err: Error) => toast({ title: "Override Failed", description: err.message, variant: "destructive" }),
  });

  const revertMutation = useMutation({
    mutationFn: (body: { overrideId: string }) => apiRequest("POST", `/api/isa320-materiality/${engagementId}/revert-override`, body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isa320-materiality", engagementId] });
      toast({ title: "Override Reverted", description: "System-calculated value restored." });
    },
    onError: (err: Error) => toast({ title: "Revert Failed", description: err.message, variant: "destructive" }),
  });

  const pushMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/isa320-materiality/${engagementId}/push-downstream`).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: "Pushed Downstream", description: `${data.significantAccounts?.length || 0} significant accounts flagged, ${data.allocationsUpdated || 0} allocations updated.` });
    },
    onError: (err: Error) => toast({ title: "Push Failed", description: err.message, variant: "destructive" }),
  });

  const { data: memoData } = useQuery({
    queryKey: ["/api/isa320-materiality", engagementId, "memo"],
    queryFn: () => apiRequest("GET", `/api/isa320-materiality/${engagementId}/memo`).then(r => r.json()),
    enabled: showMemo && !!existingSet,
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate({
      benchmarkType, benchmarkAmount, percentApplied, overallMateriality: om,
      performanceMateriality: pm, trivialThreshold: trivial, pmPercentage, trivialPercentage,
      rationale, benchmarkJustification, sourceDataSnapshot: sourceData,
      qualitativeFactors: qualFactors, specificMateriality: specificMats,
      stepProgress: Object.fromEntries(STEPS.map((s, i) => [s.key, i <= activeStep ? "complete" : "not_started"])),
    });
  }, [benchmarkType, benchmarkAmount, percentApplied, om, pm, trivial, pmPercentage, trivialPercentage,
      rationale, benchmarkJustification, sourceData, qualFactors, specificMats, activeStep, saveMutation]);

  const handleApplyRecommendation = useCallback(() => {
    if (!recommendation) return;
    setBenchmarkType(recommendation.recommended);
    setBenchmarkAmount(recommendation.recommendedValue);
    setPercentApplied(recommendation.recommendedPercentage);
    setBenchmarkJustification(recommendation.justification);
    toast({ title: "Recommendation Applied", description: `${BENCHMARK_LABELS[recommendation.recommended] || recommendation.recommended} selected as benchmark.` });
  }, [recommendation, toast]);

  const handleOverride = useCallback(() => {
    if (!overrideReason) { toast({ title: "Reason Required", description: "Please provide a reason for the override.", variant: "destructive" }); return; }
    const overrides: Array<{ field: string; systemValue: number; overriddenValue: number }> = [];
    if (overrideOM && Number(overrideOM) !== displayOM) overrides.push({ field: "overallMateriality", systemValue: displayOM, overriddenValue: Number(overrideOM) });
    if (overridePM && Number(overridePM) !== displayPM) overrides.push({ field: "performanceMateriality", systemValue: displayPM, overriddenValue: Number(overridePM) });
    if (overrideTrivial && Number(overrideTrivial) !== displayTrivial) overrides.push({ field: "trivialThreshold", systemValue: displayTrivial, overriddenValue: Number(overrideTrivial) });
    if (overrides.length === 0) { toast({ title: "No Changes", description: "Enter at least one override value.", variant: "destructive" }); return; }
    overrideMutation.mutate({ overrides, reason: overrideReason, effectOnTesting: overrideEffect });
  }, [overrideOM, overridePM, overrideTrivial, overrideReason, overrideEffect, displayOM, displayPM, displayTrivial, overrideMutation, toast]);

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
    setActiveStep(idx);
  };

  const getStepStatus = (idx: number): "complete" | "active" | "blocked" | "not_started" => {
    if (existingSet?.stepProgress) {
      const sp = existingSet.stepProgress as Record<string, string>;
      const key = STEPS[idx].key;
      if (sp[key] === "complete") return "complete";
    }
    if (idx === 0 && sourceData?.tbImported) return "complete";
    if (idx <= activeStep) return "active";
    return "not_started";
  };

  const overrideHistory = (existingSet?.overrideHistory || []) as OverrideRecord[];
  const activeOverrides = overrideHistory.filter(o => !o.reverted);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading materiality data...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="sticky top-0 z-10 bg-background border-b pb-3 -mx-1 px-1">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base">ISA 320 — Planning Materiality</h3>
                <Badge className={STATUS_COLORS[status] || "bg-gray-100"}>{status.replace(/_/g, " ")}</Badge>
                {isStale && <Badge variant="destructive" className="text-xs">Stale</Badge>}
                {isLocked && <Lock className="h-4 w-4 text-purple-600" />}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                <span>{engInfo?.clientName || "—"}</span>
                <span>FY {engInfo?.financialYear || "—"}</span>
                {existingSet && <span>v{existingSet.versionId}</span>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center min-w-[360px]">
              <div className="p-2 rounded-lg bg-primary/5 border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Overall Materiality</div>
                <div className="text-sm font-bold text-primary">{fmtPKR(displayOM)}</div>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Performance Mat.</div>
                <div className="text-sm font-bold text-blue-700 dark:text-blue-400">{fmtPKR(displayPM)}</div>
              </div>
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Trivial Threshold</div>
                <div className="text-sm font-bold text-orange-700 dark:text-orange-400">{fmtPKR(displayTrivial)}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs">
            <span className={sourceData?.tbImported ? "text-green-600" : "text-red-500"}>
              {sourceData?.tbImported ? "✓" : "✗"} Trial Balance
            </span>
            <span className={sourceData?.fsMapped ? "text-green-600" : "text-amber-500"}>
              {sourceData?.fsMapped ? "✓" : "○"} FS Mapping
            </span>
            <span className={sourceData?.riskAssessmentDone ? "text-green-600" : "text-amber-500"}>
              {sourceData?.riskAssessmentDone ? "✓" : "○"} Risk Assessment
            </span>
            {activeOverrides.length > 0 && <span className="text-purple-600">Partner Override Active</span>}
          </div>

          {isStale && (
            <Alert variant="destructive" className="mt-2 py-1.5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{staleReason} <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => refetchSource()}>Refresh Data</Button></AlertDescription>
            </Alert>
          )}

          {canEdit && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-3.5 w-3.5 mr-1" />{saveMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
              {existingSet && status === "DRAFT" && (
                <Button size="sm" variant="outline" onClick={() => finalizeMutation.mutate({ action: "submit_review" })} disabled={finalizeMutation.isPending}>
                  Submit for Review
                </Button>
              )}
              {existingSet && status === "PENDING_REVIEW" && ["SENIOR", "MANAGER", "PARTNER", "FIRM_ADMIN"].includes(user?.role || "") && (
                <Button size="sm" variant="outline" onClick={() => finalizeMutation.mutate({ action: "review" })} disabled={finalizeMutation.isPending}>
                  Mark Reviewed
                </Button>
              )}
              {existingSet && status === "PENDING_APPROVAL" && isPartner && (
                <Button size="sm" onClick={() => finalizeMutation.mutate({ action: "approve" })} disabled={finalizeMutation.isPending}>
                  Approve
                </Button>
              )}
              {existingSet && status === "APPROVED" && isPartner && (
                <Button size="sm" onClick={() => finalizeMutation.mutate({ action: "lock" })} disabled={finalizeMutation.isPending}>
                  <Lock className="h-3.5 w-3.5 mr-1" />Lock Materiality
                </Button>
              )}
            </div>
          )}
          {isLocked && isPartner && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => finalizeMutation.mutate({ action: "unlock" })} disabled={finalizeMutation.isPending}>
                <Unlock className="h-3.5 w-3.5 mr-1" />Unlock
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {STEPS.map((step, idx) => {
            const expanded = expandedSteps.has(idx);
            const stepStatus = getStepStatus(idx);
            const StepIcon = step.icon;
            return (
              <div key={step.key} className={`border rounded-lg ${idx === activeStep ? "border-primary/50 shadow-sm" : ""}`}>
                <button
                  onClick={() => toggleStep(idx)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
                    ${stepStatus === "complete" ? "bg-green-100 text-green-700" : stepStatus === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {stepStatus === "complete" ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <StepIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{step.label}</div>
                    <div className="text-xs text-muted-foreground">{step.help}</div>
                  </div>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expanded && (
                  <div className="px-3 pb-3 pt-0">
                    <Separator className="mb-3" />
                    {idx === 0 && renderDataReadiness(sourceData)}
                    {idx === 1 && renderBenchmarkRecommendation(recommendation, sourceData, handleApplyRecommendation, canEdit)}
                    {idx === 2 && renderBenchmarkSelection(benchmarkType, setBenchmarkType, benchmarkAmount, setBenchmarkAmount, benchmarkJustification, setBenchmarkJustification, sourceData, canEdit)}
                    {idx === 3 && renderPercentageSelection(percentApplied, setPercentApplied, pmPercentage, setPmPercentage, trivialPercentage, setTrivialPercentage, benchmarkType, sourceData, canEdit)}
                    {idx === 4 && renderQualitativeFactors(qualFactors, setQualFactors, canEdit)}
                    {idx === 5 && renderCalculation(benchmarkType, benchmarkAmount, percentApplied, om, pm, trivial, pmPercentage, trivialPercentage, specificMats, setSpecificMats, canEdit)}
                    {idx === 6 && renderLinkage(om, pm, trivial, sourceData)}
                    {idx === 7 && renderPartnerOverride(isPartner, canEdit, displayOM, displayPM, displayTrivial, overrideOM, setOverrideOM, overridePM, setOverridePM, overrideTrivial, setOverrideTrivial, overrideReason, setOverrideReason, overrideEffect, setOverrideEffect, handleOverride, overrideMutation.isPending, overrideHistory, revertMutation)}
                    {idx === 8 && renderDocumentation(existingSet, showMemo, setShowMemo, memoData, showAuditTrail, setShowAuditTrail, overrideHistory)}
                    {idx === 9 && renderLockPush(existingSet, isPartner, canEdit, status, finalizeMutation, pushMutation)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {canEdit && (
          <div className="flex gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" />{saveMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => refetchSource()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Recalculate
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function renderDataReadiness(sourceData: SourceData | null) {
  if (!sourceData) return <p className="text-sm text-muted-foreground">Loading source data...</p>;
  const checks = [
    { label: "Trial Balance Imported", ok: sourceData.tbImported, detail: sourceData.tbImported ? `${sourceData.accountCount} accounts loaded` : "Upload Trial Balance in Data Intake" },
    { label: "Financial Statements Mapped", ok: sourceData.fsMapped, detail: sourceData.fsMapped ? "FS line items mapped" : "Map FS line items to complete benchmark analysis" },
    { label: "Risk Assessment Completed", ok: sourceData.riskAssessmentDone, detail: sourceData.riskAssessmentDone ? `${sourceData.fraudRiskCount} fraud risks, ${sourceData.significantRiskCount} significant risks` : "Complete risk assessment for risk-adjusted percentage" },
  ];
  const warnings: string[] = [];
  if (!sourceData.tbImported) warnings.push("Trial Balance not imported — materiality cannot be finalized.");
  if (sourceData.profitBeforeTax === 0 && sourceData.revenue === 0) warnings.push("No financial data found — check Trial Balance import.");
  if (sourceData.profitBeforeTax < 0) warnings.push("Entity is loss-making — PBT benchmark is not appropriate.");

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 text-sm">
            {c.ok ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
            <span className="font-medium">{c.label}</span>
            <span className="text-muted-foreground text-xs">— {c.detail}</span>
          </div>
        ))}
      </div>
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <Alert key={i} variant="destructive" className="py-1.5"><AlertTriangle className="h-3.5 w-3.5" /><AlertDescription className="text-xs">{w}</AlertDescription></Alert>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
        {[
          { label: "Profit Before Tax", value: sourceData.profitBeforeTax },
          { label: "Revenue", value: sourceData.revenue },
          { label: "Total Assets", value: sourceData.totalAssets },
          { label: "Total Equity", value: sourceData.totalEquity },
          { label: "Gross Profit", value: sourceData.grossProfit },
          { label: "Total Expenses", value: sourceData.totalExpenses },
        ].map(item => (
          <div key={item.label}>
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className={`text-sm font-semibold ${item.value < 0 ? "text-red-600" : ""}`}>{item.value !== 0 ? fmtPKR(item.value) : "Not available"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderBenchmarkRecommendation(rec: BenchmarkRecommendation | null, sourceData: SourceData | null, onApply: () => void, canEdit: boolean) {
  if (!rec) return <p className="text-sm text-muted-foreground">Source data required for recommendation.</p>;
  return (
    <div className="space-y-3">
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-semibold">Recommended: {BENCHMARK_LABELS[rec.recommended] || rec.recommended}</div>
            <div className="text-xs text-muted-foreground">Value: {fmtPKR(rec.recommendedValue)} | Range: {rec.recommendedRange.min}%–{rec.recommendedRange.max}% | Default: {rec.recommendedPercentage}%</div>
          </div>
          {canEdit && <Button size="sm" onClick={onApply}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Apply</Button>}
        </div>
        <p className="text-xs text-muted-foreground">{rec.justification}</p>
      </div>
      {rec.warnings.length > 0 && (
        <div className="space-y-1">
          {rec.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{w}
            </div>
          ))}
        </div>
      )}
      {rec.alternates.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1.5 text-muted-foreground">Alternative Benchmarks Considered</div>
          <div className="space-y-1">
            {rec.alternates.map(alt => (
              <div key={alt.type} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                <span className="font-medium">{BENCHMARK_LABELS[alt.type] || alt.type}: {fmtPKR(alt.value)}</span>
                <span className="text-muted-foreground ml-2">{alt.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderBenchmarkSelection(
  benchmarkType: string, setBenchmarkType: (v: string) => void,
  benchmarkAmount: number, setBenchmarkAmount: (v: number) => void,
  justification: string, setJustification: (v: string) => void,
  sourceData: SourceData | null, canEdit: boolean,
) {
  const getBenchmarkValue = (type: string): number => {
    if (!sourceData) return 0;
    switch (type) {
      case "PBT": return sourceData.profitBeforeTax;
      case "REVENUE": return sourceData.revenue;
      case "TOTAL_ASSETS": return sourceData.totalAssets;
      case "EQUITY": return sourceData.totalEquity;
      case "GROSS_PROFIT": return sourceData.grossProfit;
      case "TOTAL_EXPENSES": return sourceData.totalExpenses;
      default: return 0;
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Selected Benchmark</Label>
          <Select value={benchmarkType} onValueChange={(v) => { setBenchmarkType(v); setBenchmarkAmount(getBenchmarkValue(v)); }} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BENCHMARK_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            {BENCHMARK_RANGES[benchmarkType] && `Acceptable range: ${BENCHMARK_RANGES[benchmarkType].min}%–${BENCHMARK_RANGES[benchmarkType].max}%`}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">Benchmark Amount</Label>
          <div className="text-lg font-bold">{fmtPKR(benchmarkAmount)}</div>
          <div className="text-xs text-muted-foreground">Auto-extracted from Trial Balance</div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Benchmark Selection Rationale (ISA 320.9)</Label>
        <Textarea value={justification} onChange={e => setJustification(e.target.value)} rows={3}
          placeholder="Document why this benchmark was selected..." disabled={!canEdit} />
      </div>
    </div>
  );
}

function renderPercentageSelection(
  percentApplied: number, setPercentApplied: (v: number) => void,
  pmPct: number, setPmPct: (v: number) => void,
  trivialPct: number, setTrivialPct: (v: number) => void,
  benchmarkType: string, sourceData: SourceData | null, canEdit: boolean,
) {
  const range = BENCHMARK_RANGES[benchmarkType] || { min: 1, max: 10 };
  const riskFactors: string[] = [];
  if (sourceData?.fraudRiskCount && sourceData.fraudRiskCount > 0) riskFactors.push("Fraud risk present — consider lower end of range");
  if (sourceData?.goingConcernFlag) riskFactors.push("Going concern indicators — conservative percentage recommended");
  if (sourceData?.publicInterestFlag) riskFactors.push("Public interest entity — lower percentage warranted");
  if (sourceData?.covenantFlag) riskFactors.push("Debt covenant sensitivity — precision in threshold matters");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Materiality % of Benchmark</Label>
          <div className="flex items-center gap-2">
            <Input type="number" step="0.1" min={range.min} max={range.max} value={percentApplied}
              onChange={e => setPercentApplied(Number(e.target.value))} className="w-24" disabled={!canEdit} />
            <span className="text-sm">%</span>
          </div>
          <div className="text-xs text-muted-foreground">Range: {range.min}%–{range.max}%</div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">PM as % of OM</Label>
          <div className="flex items-center gap-2">
            <Input type="number" step="1" min={50} max={90} value={pmPct}
              onChange={e => setPmPct(Number(e.target.value))} className="w-24" disabled={!canEdit} />
            <span className="text-sm">%</span>
          </div>
          <div className="text-xs text-muted-foreground">Typical: 50%–75% (lower if higher risk)</div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Trivial as % of OM</Label>
          <div className="flex items-center gap-2">
            <Input type="number" step="0.5" min={1} max={10} value={trivialPct}
              onChange={e => setTrivialPct(Number(e.target.value))} className="w-24" disabled={!canEdit} />
            <span className="text-sm">%</span>
          </div>
          <div className="text-xs text-muted-foreground">Typical: 3%–5% of OM (ISA 450.A2)</div>
        </div>
      </div>
      {riskFactors.length > 0 && (
        <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
          <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Risk-Adjustment Considerations</div>
          {riskFactors.map((f, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5"><AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />{f}</div>)}
        </div>
      )}
    </div>
  );
}

function renderQualitativeFactors(factors: QualFactor[], setFactors: (f: QualFactor[]) => void, canEdit: boolean) {
  const update = (idx: number, field: string, value: unknown) => {
    const next = [...factors];
    (next[idx] as Record<string, unknown>)[field] = value;
    setFactors(next);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground mb-2">Assess each qualitative factor. Factors marked "present" with high severity may require adjusting materiality downward or setting specific materiality for affected areas.</div>
      {factors.map((f, idx) => (
        <div key={f.id} className={`p-2.5 rounded border ${f.present ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/10" : "border-transparent bg-muted/30"}`}>
          <div className="flex items-center gap-3">
            <Checkbox checked={f.present} onCheckedChange={c => update(idx, "present", !!c)} disabled={!canEdit} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{f.title}</div>
              <div className="text-xs text-muted-foreground">{f.isaRef}</div>
            </div>
            {f.present && (
              <Select value={f.severity} onValueChange={v => update(idx, "severity", v)} disabled={!canEdit}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MODERATE">Moderate</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            )}
            {f.present && (
              <Select value={f.impact} onValueChange={v => update(idx, "impact", v)} disabled={!canEdit}>
                <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO_CHANGE">No Change</SelectItem>
                  <SelectItem value="REDUCE_OM">Reduce OM</SelectItem>
                  <SelectItem value="REDUCE_PM">Reduce PM</SelectItem>
                  <SelectItem value="SET_SPECIFIC">Set Specific Mat.</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {f.present && (
            <div className="mt-2 ml-7">
              <Input placeholder="Explanation..." value={f.explanation} onChange={e => update(idx, "explanation", e.target.value)}
                className="h-7 text-xs" disabled={!canEdit} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function renderCalculation(
  benchmarkType: string, benchmarkAmount: number, percentApplied: number,
  om: number, pm: number, trivial: number, pmPct: number, trivialPct: number,
  specificMats: SpecMat[], setSpecificMats: (s: SpecMat[]) => void, canEdit: boolean,
) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="text-xs text-muted-foreground">Overall Materiality (ISA 320.10)</div>
          <div className="text-xl font-bold text-primary mt-1">{fmtPKR(om)}</div>
          <div className="text-xs text-muted-foreground mt-1">{BENCHMARK_LABELS[benchmarkType]} {fmtPKR(benchmarkAmount)} × {percentApplied}%</div>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <div className="text-xs text-muted-foreground">Performance Materiality (ISA 320.11)</div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-1">{fmtPKR(pm)}</div>
          <div className="text-xs text-muted-foreground mt-1">OM {fmtPKR(om)} × {pmPct}%</div>
        </div>
        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
          <div className="text-xs text-muted-foreground">Clearly Trivial (ISA 450.A2)</div>
          <div className="text-xl font-bold text-orange-700 dark:text-orange-400 mt-1">{fmtPKR(trivial)}</div>
          <div className="text-xs text-muted-foreground mt-1">OM {fmtPKR(om)} × {trivialPct}%</div>
        </div>
      </div>

      <Separator />
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Specific Materiality by FS Area</div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setSpecificMats([...specificMats, { id: crypto.randomUUID(), area: "", fsHead: "", amount: 0, rationale: "", linkedRiskId: null }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Area
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          Set lower materiality for sensitive areas such as related party transactions, directors' remuneration, covenant-related disclosures, etc.
        </div>
        {specificMats.length === 0 && <p className="text-xs text-muted-foreground italic">No specific materiality areas defined.</p>}
        {specificMats.map((s, idx) => (
          <div key={s.id} className="flex gap-2 items-start mb-2">
            <Input placeholder="Area name" value={s.area} onChange={e => {
              const next = [...specificMats]; next[idx] = { ...next[idx], area: e.target.value }; setSpecificMats(next);
            }} className="flex-1 h-8 text-xs" disabled={!canEdit} />
            <Input type="number" placeholder="Amount" value={s.amount || ""} onChange={e => {
              const next = [...specificMats]; next[idx] = { ...next[idx], amount: Number(e.target.value) }; setSpecificMats(next);
            }} className="w-32 h-8 text-xs" disabled={!canEdit} />
            <Input placeholder="Rationale" value={s.rationale} onChange={e => {
              const next = [...specificMats]; next[idx] = { ...next[idx], rationale: e.target.value }; setSpecificMats(next);
            }} className="flex-1 h-8 text-xs" disabled={!canEdit} />
            {canEdit && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSpecificMats(specificMats.filter((_, i) => i !== idx))}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderLinkage(om: number, pm: number, trivial: number, sourceData: SourceData | null) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Materiality levels drive the following downstream audit decisions.</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide">Significant Accounts</div>
          <p className="text-xs">Accounts with balances exceeding <strong>{fmtPKR(om)}</strong> require detailed substantive testing.</p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide">Sampling</div>
          <p className="text-xs">Tolerable misstatement for sampling: <strong>{fmtPKR(pm)}</strong>. Sample sizes calibrated accordingly.</p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide">Analytical Procedures</div>
          <p className="text-xs">Investigation threshold for fluctuations: <strong>{fmtPKR(Math.round(pm * 0.5))}</strong></p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide">Journal Entry Testing</div>
          <p className="text-xs">JE testing threshold: <strong>{fmtPKR(trivial)}</strong></p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide">Misstatement Accumulation</div>
          <p className="text-xs">Misstatements below <strong>{fmtPKR(trivial)}</strong> are clearly trivial per ISA 450.A2.</p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide">Completion Review</div>
          <p className="text-xs">Accumulated uncorrected misstatements approaching <strong>{fmtPKR(om)}</strong> require audit report modification.</p>
        </div>
      </div>
    </div>
  );
}

function renderPartnerOverride(
  isPartner: boolean, canEdit: boolean,
  displayOM: number, displayPM: number, displayTrivial: number,
  overrideOM: string, setOverrideOM: (v: string) => void,
  overridePM: string, setOverridePM: (v: string) => void,
  overrideTrivial: string, setOverrideTrivial: (v: string) => void,
  overrideReason: string, setOverrideReason: (v: string) => void,
  overrideEffect: string, setOverrideEffect: (v: string) => void,
  handleOverride: () => void, isPending: boolean,
  history: OverrideRecord[], revertMutation: { mutate: (body: { overrideId: string }) => void; isPending: boolean },
) {
  if (!isPartner) {
    return <p className="text-sm text-muted-foreground">Only Partners can apply overrides to system-calculated materiality.</p>;
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <>
          <div className="text-xs text-muted-foreground">Override system-calculated values. A reason and effect commentary are mandatory. Each override is recorded with full audit trail.</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Overall Materiality</Label>
              <div className="text-xs text-muted-foreground mb-1">System: {fmtPKR(displayOM)}</div>
              <Input type="number" placeholder="Override value" value={overrideOM} onChange={e => setOverrideOM(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Performance Materiality</Label>
              <div className="text-xs text-muted-foreground mb-1">System: {fmtPKR(displayPM)}</div>
              <Input type="number" placeholder="Override value" value={overridePM} onChange={e => setOverridePM(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trivial Threshold</Label>
              <div className="text-xs text-muted-foreground mb-1">System: {fmtPKR(displayTrivial)}</div>
              <Input type="number" placeholder="Override value" value={overrideTrivial} onChange={e => setOverrideTrivial(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason for Override <span className="text-destructive">*</span></Label>
            <Textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={2}
              placeholder="Provide mandatory justification for the override..." className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Effect on Risk Assessment and Testing</Label>
            <Textarea value={overrideEffect} onChange={e => setOverrideEffect(e.target.value)} rows={2}
              placeholder="Describe the impact on audit procedures, sampling, and reporting..." className="text-xs" />
          </div>
          <Button size="sm" onClick={handleOverride} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Users className="h-3.5 w-3.5 mr-1" />}
            Apply Override
          </Button>
        </>
      )}

      {history.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1.5 flex items-center gap-1"><History className="h-3.5 w-3.5" /> Override History</div>
          <div className="space-y-1.5">
            {history.map(h => (
              <div key={h.id} className={`p-2 rounded text-xs border ${h.reverted ? "bg-muted/30 line-through opacity-60" : "bg-purple-50 dark:bg-purple-950/20 border-purple-200"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{h.field}: {fmtPKR(h.systemValue)} → {fmtPKR(h.overriddenValue)}</span>
                  <span className="text-muted-foreground">{fmtDate(h.timestamp)} by {h.userName}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">Reason: {h.reason}</p>
                {!h.reverted && canEdit && isPartner && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs mt-1" onClick={() => revertMutation.mutate({ overrideId: h.id })}>
                    Revert to System Value
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderDocumentation(
  existingSet: MaterialitySetData | null,
  showMemo: boolean, setShowMemo: (v: boolean) => void,
  memoData: Record<string, unknown> | null,
  showAuditTrail: boolean, setShowAuditTrail: (v: boolean) => void,
  overrideHistory: OverrideRecord[],
) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={showMemo ? "default" : "outline"} onClick={() => setShowMemo(!showMemo)}>
          <FileText className="h-3.5 w-3.5 mr-1" />{showMemo ? "Hide Memo" : "View ISA 320 Memo"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowAuditTrail(!showAuditTrail)}>
          <History className="h-3.5 w-3.5 mr-1" />{showAuditTrail ? "Hide Audit Trail" : "View Audit Trail"}
        </Button>
        {showMemo && memoData && (
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" />Print
          </Button>
        )}
      </div>

      {showMemo && memoData && (
        <div className="p-2.5 border rounded-lg bg-white dark:bg-gray-950 text-sm space-y-2.5 print:shadow-none" id="isa320-memo">
          <div className="text-center border-b pb-3">
            <h2 className="text-lg font-bold">{String(memoData.title || "ISA 320 — Planning Materiality Memo")}</h2>
            <p className="text-xs text-muted-foreground mt-1">Generated: {fmtDate(String(memoData.generatedAt || ""))}</p>
          </div>

          {memoData.engagementDetails && (
            <div>
              <h3 className="font-semibold text-sm mb-1">1. Engagement Details</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {Object.entries(memoData.engagementDetails as Record<string, string>).map(([k, v]) => (
                  <div key={k}><span className="text-muted-foreground">{k.replace(/([A-Z])/g, " $1").trim()}:</span> <span className="font-medium">{v}</span></div>
                ))}
              </div>
            </div>
          )}

          {memoData.benchmarkSelection && (
            <div>
              <h3 className="font-semibold text-sm mb-1">2. Benchmark Selection</h3>
              <div className="text-xs space-y-0.5">
                {Object.entries(memoData.benchmarkSelection as Record<string, string>).map(([k, v]) => (
                  <div key={k}><span className="text-muted-foreground">{k.replace(/([A-Z])/g, " $1").trim()}:</span> {v}</div>
                ))}
              </div>
            </div>
          )}

          {memoData.materialityCalculation && (
            <div>
              <h3 className="font-semibold text-sm mb-1">3. Materiality Calculation</h3>
              <div className="text-xs space-y-0.5">
                {Object.entries(memoData.materialityCalculation as Record<string, string>).map(([k, v]) => (
                  <div key={k}><span className="text-muted-foreground">{k.replace(/([A-Z])/g, " $1").trim()}:</span> <strong>{v}</strong></div>
                ))}
              </div>
            </div>
          )}

          {memoData.conclusion && (
            <div>
              <h3 className="font-semibold text-sm mb-1">4. Conclusion</h3>
              <p className="text-xs">{String(memoData.conclusion)}</p>
            </div>
          )}

          {memoData.signOff && (
            <div>
              <h3 className="font-semibold text-sm mb-1">5. Sign-Off</h3>
              <div className="grid grid-cols-3 gap-3 text-xs border-t pt-2">
                {Object.entries(memoData.signOff as Record<string, string>).map(([k, v]) => (
                  <div key={k}><span className="text-muted-foreground">{k.replace(/([A-Z])/g, " $1").trim()}:</span> {v}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAuditTrail && (
        <div className="p-3 border rounded-lg space-y-2">
          <div className="text-sm font-medium">Materiality Change Log</div>
          {overrideHistory.length === 0 && <p className="text-xs text-muted-foreground italic">No changes recorded yet.</p>}
          {overrideHistory.map(h => (
            <div key={h.id} className="text-xs p-2 bg-muted/50 rounded">
              <span className="font-medium">{h.field}</span>: {fmtPKR(h.systemValue)} → {fmtPKR(h.overriddenValue)}
              {h.reverted && <Badge variant="outline" className="ml-1 text-[10px]">Reverted</Badge>}
              <span className="text-muted-foreground ml-2">by {h.userName} on {fmtDate(h.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderLockPush(
  existingSet: MaterialitySetData | null, isPartner: boolean, canEdit: boolean,
  status: string,
  finalizeMutation: { mutate: (body: { action: string }) => void; isPending: boolean },
  pushMutation: { mutate: () => void; isPending: boolean },
) {
  const isApprovedOrLocked = status === "APPROVED" || status === "LOCKED";
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Lock materiality to freeze values and push to downstream audit modules (Risk Assessment, Sampling, Execution, Completion).</div>

      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">Current Status:</span>
        <Badge className={STATUS_COLORS[status] || "bg-gray-100"}>{status.replace(/_/g, " ")}</Badge>
      </div>

      {existingSet && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div><span className="text-muted-foreground">Prepared:</span> {existingSet.preparedBy?.fullName || "—"} ({fmtDate(existingSet.preparedAt)})</div>
          <div><span className="text-muted-foreground">Reviewed:</span> {existingSet.reviewedBy?.fullName || "—"} ({fmtDate(existingSet.reviewedAt)})</div>
          <div><span className="text-muted-foreground">Approved:</span> {existingSet.approvedBy?.fullName || "—"} ({fmtDate(existingSet.approvedAt)})</div>
          <div><span className="text-muted-foreground">Locked:</span> {existingSet.lockedBy?.fullName || "—"} ({fmtDate(existingSet.lockedAt)})</div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {isApprovedOrLocked && (
          <Button size="sm" onClick={() => pushMutation.mutate()} disabled={pushMutation.isPending}>
            <ArrowRight className="h-3.5 w-3.5 mr-1" />
            {pushMutation.isPending ? "Pushing..." : "Push to Risk & Execution"}
          </Button>
        )}
        {status === "APPROVED" && isPartner && (
          <Button size="sm" onClick={() => finalizeMutation.mutate({ action: "lock" })} disabled={finalizeMutation.isPending}>
            <Lock className="h-3.5 w-3.5 mr-1" />Lock Materiality
          </Button>
        )}
        {status === "LOCKED" && isPartner && (
          <Button size="sm" variant="outline" onClick={() => finalizeMutation.mutate({ action: "unlock" })} disabled={finalizeMutation.isPending}>
            <Unlock className="h-3.5 w-3.5 mr-1" />Unlock
          </Button>
        )}
      </div>

      {!existingSet && <p className="text-xs text-amber-600">Save a draft first to enable workflow actions.</p>}
      {existingSet && status === "DRAFT" && <p className="text-xs text-muted-foreground">Submit for review to start the approval workflow.</p>}
    </div>
  );
}
