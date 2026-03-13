import { useParams } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { ModuleTemplates } from "@/components/module-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight, ArrowLeft, Layers, FolderOpen, FileText, CheckCircle2, Clock,
  AlertTriangle, UserCheck, FileCheck, ClipboardList, TestTube2,
  Shield, MessageSquare, Plus, BarChart3, FilePen, TrendingUp, Calculator,
  Sparkles, Loader2, Brain, RefreshCw, Upload, Target, ShieldCheck, Lock,
  Save, X, FileUp, StickyNote, ChevronRight, Info, Download, RotateCcw, Search
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AICopilotToggle } from "@/components/ai-copilot-panel";
import { RiskAssessmentForm, ConclusionForm } from "@/components/fs-head-forms";
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/page-shell";
import { useModuleReadOnly } from "@/components/sign-off-bar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatAccounting } from '@/lib/formatters';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface FSHeadAccount {
  code: string;
  name: string;
  openingBalance: number;
  debits: number;
  credits: number;
  closingBalance: number;
  remarks: string;
}

interface FSHead {
  fsHeadKey: string;
  name: string;
  statementType: string;
  accounts: { code: string; name: string }[];
  status: string;
  workingPaper?: { status: string } | null;
}

interface FSHeadWorkingPaper {
  id: string;
  fsHeadKey: string;
  status: string;
  notes: string;
  conclusion: string;
  procedures: FSHeadProcedure[];
  reviewPoints: FSHeadReviewPoint[];
  attachments: FSHeadAttachment[];
  currentYearBalance?: number;
  priorYearBalance?: number;
  movement?: number;
  overallMateriality?: number;
  performanceMateriality?: number;
  trivialThreshold?: number;
  riskLevel?: string;
  tocCompleted?: boolean;
  todCompleted?: boolean;
  analyticsCompleted?: boolean;
  preparedById?: string;
  preparedByName?: string;
  preparedAt?: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  completionPercentage?: number;
}

interface FSHeadProcedure {
  id: string;
  title: string;
  isaReference: string;
  description: string;
  conclusion: string;
  findings: string;
  status: string;
}

interface FSHeadReviewPoint {
  id: string;
  description: string;
  severity: string;
  status: string;
  response: string;
}

interface FSHeadAttachment {
  id: string;
  fileName: string;
  originalName?: string;
  mimeType?: string;
  fileType?: string;
  fileSize: number;
  uploadedAt: string;
  createdAt?: string;
}

interface TOCItem {
  id: string;
  tocRef: string;
  controlDescription: string;
  controlOwner?: string;
  controlFrequency?: string;
  controlType?: string;
  assertions?: string[];
  testSteps?: string;
  result: string;
  conclusion?: string;
  exceptionsFound?: boolean;
  exceptionDetails?: string;
  testingPerformedBy?: { fullName: string };
  testingPerformedAt?: string;
}

interface TODItem {
  id: string;
  todRef: string;
  procedureDescription: string;
  assertions?: string[];
  populationDescription?: string;
  populationValue?: number;
  populationCount?: number;
  sampleSize?: number;
  samplingMethod?: string;
  result: string;
  conclusion?: string;
  exceptionsFound?: number;
  exceptionAmount?: number;
  projectedMisstatement?: number;
  testingPerformedBy?: { fullName: string };
}

interface AnalyticalItem {
  id: string;
  procedureRef: string;
  analyticalType: string;
  description: string;
  currentYearValue?: number;
  priorYearValue?: number;
  varianceAmount?: number;
  variancePercentage?: number;
  thresholdPercentage?: number;
  conclusion?: string;
  isAISuggested?: boolean;
  performedBy?: { fullName: string };
}

interface AdjustmentItem {
  id: string;
  adjustmentRef: string;
  adjustmentType: string;
  description: string;
  debitAccountCode?: string;
  debitAccountName?: string;
  debitAmount?: number;
  creditAccountCode?: string;
  creditAccountName?: string;
  creditAmount?: number;
  netImpact?: number;
  isMaterial?: boolean;
  isPosted?: boolean;
  identifiedBy?: { fullName: string };
}

interface AuditProgramProcedure {
  id: string;
  procedureRef: string;
  description: string;
  type: string;
  isaReference: string;
  status: string;
  assertions: string[];
  conclusion?: string;
}

interface FSProgramItem {
  id: string;
  fsCaption: string;
  procedureType: string;
  description: string;
  status: string;
  riskLevel: string;
  isEditing?: boolean;
}

interface RiskArea {
  id: string;
  riskTitle: string;
  riskLevel: string;
  assertions: string[];
  status: string;
  response?: string;
}

interface RelatedData {
  auditProgram: AuditProgramProcedure[];
  fsProgram: FSProgramItem[];
  controls: { id: string; controlRef: string; controlName: string; controlType: string; frequency: string; owner: string; status: string }[];
  substantiveTests: { id: string; testType: string; assertion: string; description: string; sampleSize: number; exceptionsFound: number; conclusion: string; status: string }[];
  riskAreas: RiskArea[];
}

interface ExecutionContext {
  linkedRisks: any[];
  materiality: { overall: number; performance: number; trivial: number };
  samplingFrames: any[];
  assertionMatrix: Record<string, string[]>;
  priorPeriod: { currentBalance: number; priorBalance: number; movement: number; movementPercent: number };
}

interface ComplianceCheck {
  overallPass: boolean;
  checks: { id: string; name: string; isaRef: string; pass: boolean; details: string }[];
}

const WIZARD_STEPS = [
  { id: 1, label: "Context", icon: FileText, description: "FS Head overview, balances & materiality", isaRef: "ISA 315" },
  { id: 2, label: "Assertions", icon: Target, description: "Risk linkage & assertion matrix", isaRef: "ISA 315/330" },
  { id: 3, label: "Procedures", icon: ClipboardList, description: "TOC, TOD & analytical procedures", isaRef: "ISA 330/520" },
  { id: 4, label: "Evidence", icon: FolderOpen, description: "Upload & cross-reference", isaRef: "ISA 500" },
  { id: 5, label: "Conclusions", icon: FileCheck, description: "Documentation & conclusions", isaRef: "ISA 230" },
  { id: 6, label: "Review", icon: UserCheck, description: "Sign-off & approval workflow", isaRef: "ISA 220" },
];

function FSHeadsContent({ engagementId, saveRef }: { engagementId: string; saveRef: React.MutableRefObject<{ save: () => Promise<boolean>; isDirty: boolean } | null> }) {
  const [selectedFsHead, setSelectedFsHead] = useState<string | null>(null);
  const [navSearchQuery, setNavSearchQuery] = useState("");
  const { toast } = useToast();
  const wizardSaveRef = useRef<{ save: () => Promise<boolean>; isDirty: boolean } | null>(null);

  const handleFsHeadSwitch = useCallback(async (newKey: string) => {
    if (wizardSaveRef.current?.isDirty) {
      await wizardSaveRef.current.save();
    }
    setSelectedFsHead(newKey);
  }, []);

  const { data: fsHeadsData, isLoading: fsHeadsLoading } = useQuery<{ success: boolean; fsHeads: (FSHead & { workingPaper?: { status: string } | null })[] }>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads']
  });

  const { data: summaryData } = useQuery<{ success: boolean; fsHeads: { fsHeadKey: string; completionPercent?: number; status?: string; proceduresCount?: number }[] }>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads-summary']
  });

  const summaryMap = new Map(
    (summaryData?.fsHeads || []).map((s: any) => [s.fsHeadKey, s])
  );

  const { data: workingPaperData, isLoading: wpLoading } = useQuery<{ success: boolean; workingPaper: FSHeadWorkingPaper | null; accounts?: FSHeadAccount[] }>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads', selectedFsHead],
    enabled: !!selectedFsHead
  });

  const { data: relatedData, isLoading: relatedLoading } = useQuery<RelatedData>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads', selectedFsHead, 'related-data'],
    enabled: !!selectedFsHead
  });

  const { data: tocData } = useQuery<{ toc: TOCItem[] }>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads', selectedFsHead, 'toc'],
    enabled: !!selectedFsHead
  });

  const { data: todData } = useQuery<{ tod: TODItem[] }>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads', selectedFsHead, 'tod'],
    enabled: !!selectedFsHead
  });

  const { data: analyticsData } = useQuery<{ analytics: AnalyticalItem[] }>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads', selectedFsHead, 'analytics'],
    enabled: !!selectedFsHead
  });

  const { data: adjustmentsData } = useQuery<{ adjustments: AdjustmentItem[], totals: any }>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads', selectedFsHead, 'adjustments'],
    enabled: !!selectedFsHead
  });

  const [showGenerateResult, setShowGenerateResult] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: async (regenerate: boolean = false) => {
      const response = await apiRequest(
        "POST",
        `/api/engagements/${engagementId}/fs-heads/generate`,
        { regenerate }
      );
      return response.json() as Promise<{ success: boolean; summary?: { totalFsHeads: number; risksCreated: number; tocCreated: number; todCreated: number; analyticsCreated: number } }>;
    },
    onSuccess: (data) => {
      setShowGenerateResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads'] });
      toast({
        title: "FS Heads Generated",
        description: `Successfully generated ${data.summary?.totalFsHeads || 0} FS Head working papers.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate FS Heads.",
        variant: "destructive",
      });
    }
  });

  const fsHeads: FSHead[] = fsHeadsData?.fsHeads || [];
  const workingPaper: FSHeadWorkingPaper | null = workingPaperData?.workingPaper || null;
  const fsHeadAccounts: FSHeadAccount[] = workingPaperData?.accounts || [];
  const auditProgram = relatedData?.auditProgram || [];
  const riskAreas = relatedData?.riskAreas || [];
  const tocItems = tocData?.toc || [];
  const todItems = todData?.tod || [];
  const analyticsItems = analyticsData?.analytics || [];
  const adjustmentItems = adjustmentsData?.adjustments || [];
  const adjustmentTotals = adjustmentsData?.totals || { totalDebit: 0, totalCredit: 0, totalNetImpact: 0 };

  const groupedHeads = fsHeads.reduce((acc, head) => {
    const type = head.statementType || "Other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(head);
    return acc;
  }, {} as Record<string, FSHead[]>);

  const statementOrder = ["Balance Sheet", "Profit & Loss", "Assets", "Liabilities", "Equity", "Income", "Expenses", "Other"];

  if (fsHeadsLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (fsHeads.length === 0) {
    return (
      <Card data-testid="empty-state">
        <CardContent className="py-12 text-center">
          <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <h3 className="font-semibold text-lg tracking-tight mb-2">No FS Heads Available</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            Generate FS Head working papers from your Chart of Accounts and Trial Balance.
          </p>
          <Button
            onClick={() => generateMutation.mutate(false)}
            disabled={generateMutation.isPending}
            className="gap-2"
            data-testid="btn-generate-fs-heads-empty"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generateMutation.isPending ? "Generating..." : "Generate FS Heads & Working Papers"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {showGenerateResult && (
        <div className="col-span-12">
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <Sparkles className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200 mb-2">
                    {showGenerateResult.message}
                  </p>
                  <div className="grid grid-cols-5 gap-4 text-sm text-green-700 dark:text-green-300">
                    <div><span className="font-medium">{showGenerateResult.summary?.totalFsHeads}</span> FS Heads</div>
                    <div><span className="font-medium">{showGenerateResult.summary?.risksGenerated || 0}</span> Risks</div>
                    <div><span className="font-medium">{showGenerateResult.summary?.tocProcedures}</span> TOC</div>
                    <div><span className="font-medium">{showGenerateResult.summary?.todProcedures}</span> TOD</div>
                    <div><span className="font-medium">{showGenerateResult.summary?.analyticsProcedures}</span> Analytics</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowGenerateResult(null)} data-testid="btn-dismiss-generate-result">
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="col-span-3 space-y-4">
        <Card data-testid="fs-heads-list">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" />
                FS Heads
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => generateMutation.mutate(true)}
                disabled={generateMutation.isPending}
                title="Regenerate FS Heads"
                data-testid="btn-regenerate-fs-heads"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            <CardDescription className="text-xs">
              Select an FS Head to begin the wizard
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="px-3 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Filter FS heads..."
                  value={navSearchQuery}
                  onChange={(e) => setNavSearchQuery(e.target.value)}
                  className="h-7 pl-7 text-xs"
                  data-testid="input-nav-search"
                />
              </div>
            </div>
            <Accordion type="multiple" defaultValue={statementOrder} className="w-full">
              {statementOrder.map(statementType => {
                const allHeads = groupedHeads[statementType];
                const heads = navSearchQuery.trim()
                  ? allHeads?.filter(h => h.name.toLowerCase().includes(navSearchQuery.toLowerCase()))
                  : allHeads;
                if (!heads || heads.length === 0) return null;
                return (
                  <AccordionItem key={statementType} value={statementType} className="border-b last:border-b-0">
                    <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline" data-testid={`accordion-${statementType.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{statementType}</span>
                        <Badge variant="outline" className="text-xs h-5">{heads.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2 px-2 space-y-1">
                      {heads.map(head => {
                        const isSelected = selectedFsHead === head.fsHeadKey;
                        const wpStatus = head.workingPaper?.status || head.status;
                        const statusDot = wpStatus === "APPROVED"
                          ? "bg-green-500"
                          : (wpStatus === "PREPARED" || wpStatus === "REVIEWED" || wpStatus === "IN_REVIEW")
                          ? "bg-amber-500"
                          : "bg-red-400";
                        const headSummary = summaryMap.get(head.fsHeadKey) as any;
                        const completionPct = headSummary?.completionPercent ??
                          (wpStatus === "APPROVED" ? 100 : wpStatus === "REVIEWED" ? 75 : wpStatus === "PREPARED" ? 50 : wpStatus === "IN_PROGRESS" ? 25 : 0);
                        return (
                          <Button
                            key={head.fsHeadKey}
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => handleFsHeadSwitch(head.fsHeadKey)}
                            className={`w-full justify-start h-auto py-2 px-3 text-left ${isSelected ? "ring-2 ring-primary/50" : ""}`}
                            data-testid={`fs-head-btn-${head.fsHeadKey}`}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <div className={`h-2 w-2 rounded-full shrink-0 ${statusDot}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium truncate" data-testid={`fs-head-name-${head.fsHeadKey}`}>
                                    {head.name}
                                  </span>
                                  <Badge
                                    variant={completionPct >= 100 ? "default" : "secondary"}
                                    className="text-[10px] h-4 px-1 shrink-0 ml-auto"
                                    data-testid={`fs-head-completion-${head.fsHeadKey}`}
                                  >
                                    {completionPct}%
                                  </Badge>
                                </div>
                                <div className="text-xs opacity-70">
                                  {head.accounts.length} accounts
                                </div>
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
        <ModuleTemplates moduleName="execution-fs-heads" engagementId={engagementId} title="FS Head Templates" />
      </div>

      <div className="col-span-9">
        {selectedFsHead && workingPaper ? (
          <FSHeadWizard
            workingPaper={workingPaper}
            engagementId={engagementId}
            fsHeadKey={selectedFsHead}
            fsHeadName={fsHeads.find(h => h.fsHeadKey === selectedFsHead)?.name || selectedFsHead}
            fsHeadType={fsHeads.find(h => h.fsHeadKey === selectedFsHead)?.statementType || "Balance Sheet"}
            fsHeadAccounts={fsHeadAccounts}
            auditProgram={auditProgram}
            riskAreas={riskAreas}
            tocItems={tocItems}
            todItems={todItems}
            analyticsItems={analyticsItems}
            adjustmentItems={adjustmentItems}
            adjustmentTotals={adjustmentTotals}
            isLoading={wpLoading || relatedLoading}
            onSaveRef={(ref) => { wizardSaveRef.current = ref; if (saveRef) saveRef.current = ref; }}
          />
        ) : wpLoading ? (
          <Card data-testid="wp-loading">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="select-prompt">
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground">Select an FS Head to begin the execution wizard</p>
              <p className="text-xs text-muted-foreground mt-2">Work through each step sequentially: Context, Assertions, Procedures, Evidence, Conclusions, Review</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WizardStepIndicator({ currentStep, stepCompletion, onStepClick, gateCheck }: {
  currentStep: number;
  stepCompletion: Record<number, { complete: boolean; percent: number }>;
  onStepClick: (step: number) => void;
  gateCheck: (step: number) => { allowed: boolean; reason?: string };
}) {
  return (
    <div className="flex items-center gap-1 mb-4" data-testid="wizard-step-indicator">
      {WIZARD_STEPS.map((step, idx) => {
        const completion = stepCompletion[step.id] || { complete: false, percent: 0 };
        const isCurrent = currentStep === step.id;
        const isPast = currentStep > step.id;
        const gate = gateCheck(step.id);
        const isLocked = !gate.allowed;
        const StepIcon = step.icon;
        return (
          <div key={step.id} className="flex items-center gap-1 flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onStepClick(step.id)}
                  className={`flex flex-col w-full rounded-md text-xs transition-all ${
                    isLocked ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  data-testid={`wizard-step-${step.id}`}
                >
                  <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-t-md w-full ${
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : completion.complete
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                      : isPast
                      ? "bg-muted text-foreground"
                      : "bg-muted/50 text-muted-foreground"
                  }`}>
                    {isLocked ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="font-medium truncate">{step.label}</span>
                    {completion.complete && !isLocked && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />}
                  </div>
                  <div className="w-full bg-muted rounded-b-md overflow-hidden h-1">
                    <div
                      className={`h-full transition-all ${
                        completion.complete
                          ? "bg-green-500"
                          : completion.percent > 0
                          ? "bg-amber-500"
                          : "bg-transparent"
                      }`}
                      style={{ width: `${Math.min(100, completion.percent)}%` }}
                    />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {isLocked ? (
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>{gate.reason}</span>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">{step.label} — {step.isaRef}</div>
                    <div className="text-muted-foreground">{step.description}</div>
                    <div className="mt-1">{Math.round(completion.percent)}% complete</div>
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
            {idx < WIZARD_STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewPointsInline({ reviewPoints, stepLabel }: { reviewPoints: FSHeadReviewPoint[]; stepLabel: string }) {
  const relevant = reviewPoints.filter(rp => rp.status !== "RESOLVED");
  if (relevant.length === 0) return null;
  return (
    <div className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-r-md mb-4" data-testid="review-points-inline">
      <div className="flex items-center gap-2 mb-2">
        <StickyNote className="h-4 w-4 text-amber-600" />
        <span className="text-xs font-medium text-amber-800 dark:text-amber-200">{relevant.length} Review Point{relevant.length > 1 ? 's' : ''}</span>
      </div>
      {relevant.slice(0, 3).map(rp => (
        <div key={rp.id} className="text-xs text-amber-700 dark:text-amber-300 mb-1 flex items-start gap-1" data-testid={`inline-review-${rp.id}`}>
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{rp.description}</span>
          <Badge variant="outline" className="text-xs h-4 ml-auto shrink-0">{rp.severity}</Badge>
        </div>
      ))}
    </div>
  );
}

function FSHeadWizard({
  workingPaper, engagementId, fsHeadKey, fsHeadName, fsHeadType,
  fsHeadAccounts, auditProgram, riskAreas, tocItems, todItems,
  analyticsItems, adjustmentItems, adjustmentTotals, isLoading,
  onSaveRef
}: {
  workingPaper: FSHeadWorkingPaper;
  engagementId: string;
  fsHeadKey: string;
  fsHeadName: string;
  fsHeadType: string;
  fsHeadAccounts: FSHeadAccount[];
  auditProgram: AuditProgramProcedure[];
  riskAreas: RiskArea[];
  tocItems: TOCItem[];
  todItems: TODItem[];
  analyticsItems: AnalyticalItem[];
  adjustmentItems: AdjustmentItem[];
  adjustmentTotals: { totalDebit: number; totalCredit: number; totalNetImpact: number };
  isLoading: boolean;
  onSaveRef?: (ref: { save: () => Promise<boolean>; isDirty: boolean }) => void;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [notes, setNotes] = useState(workingPaper.notes || "");
  const [conclusion, setConclusion] = useState(workingPaper.conclusion || "");
  const baselineNotesRef = useRef(workingPaper.notes || "");
  const baselineConclusionRef = useRef(workingPaper.conclusion || "");

  const isNotesDirty = notes !== baselineNotesRef.current;
  const isConclusionDirty = conclusion !== baselineConclusionRef.current;
  const isDirty = isNotesDirty || isConclusionDirty;

  const saveAllPending = useCallback(async (): Promise<boolean> => {
    try {
      const updates: Record<string, string> = {};
      if (isNotesDirty) updates.notes = notes;
      if (isConclusionDirty) {
        updates.conclusion = conclusion;
        updates.completionStatus = "draft";
      }
      if (Object.keys(updates).length === 0) return true;

      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/working-paper`, updates);
      if (!res.ok) return false;

      baselineNotesRef.current = notes;
      baselineConclusionRef.current = conclusion;
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey] });
      return true;
    } catch {
      return false;
    }
  }, [notes, conclusion, isNotesDirty, isConclusionDirty, engagementId, fsHeadKey]);

  if (onSaveRef) {
    onSaveRef({ save: saveAllPending, isDirty });
  }
  const [showConclusionForm, setShowConclusionForm] = useState(false);
  const [editingTOC, setEditingTOC] = useState<any | null>(null);
  const [editingTOD, setEditingTOD] = useState<any | null>(null);
  const [editingAnalytics, setEditingAnalytics] = useState<any | null>(null);
  const [editingAdjustment, setEditingAdjustment] = useState<any | null>(null);
  const [editingRisk, setEditingRisk] = useState<any | null>(null);
  const [newReviewPoint, setNewReviewPoint] = useState("");
  const [newReviewSeverity, setNewReviewSeverity] = useState("MEDIUM");
  const { toast } = useToast();

  const { data: contextData } = useQuery<ExecutionContext>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'execution-context'],
    enabled: !!fsHeadKey
  });

  const { data: complianceData } = useQuery<ComplianceCheck>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'compliance-check'],
    enabled: !!fsHeadKey
  });

  const { data: templateData } = useQuery<{
    success: boolean;
    template: {
      headType: string;
      displayName: string;
      keyAssertions: string[];
      keyRisks: { description: string; isaReference?: string }[];
      riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
      riskLocked: boolean;
      procedures: { ref: string; type: 'TOC' | 'TOD' | 'ANALYTICS'; description: string; isaReference: string; mandatory: boolean }[];
      specialEnforcement: string[];
      isa540Triggered: boolean;
      fraudRiskPresumed: boolean;
    };
    detectedType: string;
  }>({
    queryKey: ['/api/fs-head-ai/template', encodeURIComponent(fsHeadName)]
  });

  const { data: engagementData } = useQuery<{ engagement: { client?: { name: string }; periodEnd?: string } }>({
    queryKey: ['/api/engagements', engagementId]
  });

  const procedureTemplate = templateData?.template;
  const engagement = engagementData?.engagement || {} as { client?: { name: string }; periodEnd?: string };
  const clientName = engagement.client?.name || "Client Name";
  const fiscalYear = engagement.periodEnd ? new Date(engagement.periodEnd).getFullYear() : new Date().getFullYear();
  const executionContext = contextData || null;
  const complianceChecks = complianceData || null;

  const hasProcedures = tocItems.length > 0 || todItems.length > 0 || analyticsItems.length > 0;
  const hasEvidence = (workingPaper.attachments?.length || 0) > 0;
  const hasConclusion = !!workingPaper.conclusion || !!conclusion;

  const stepCompletion: Record<number, { complete: boolean; percent: number }> = {
    1: { complete: true, percent: 100 },
    2: { complete: riskAreas.length > 0 || (executionContext?.linkedRisks?.length || 0) > 0, percent: riskAreas.length > 0 ? 100 : 0 },
    3: { complete: hasProcedures, percent: hasProcedures ? Math.min(100, ((tocItems.length + todItems.length + analyticsItems.length) / 3) * 100) : 0 },
    4: { complete: hasEvidence, percent: hasEvidence ? Math.min(100, ((workingPaper.attachments?.length || 0) / 3) * 100) : 0 },
    5: { complete: hasConclusion, percent: hasConclusion ? 100 : 0 },
    6: { complete: workingPaper.status === "APPROVED", percent: workingPaper.status === "APPROVED" ? 100 : workingPaper.status === "REVIEWED" ? 75 : workingPaper.status === "PREPARED" ? 50 : 0 },
  };

  const canAdvanceTo = (step: number): { allowed: boolean; reason?: string } => {
    if (step <= currentStep) return { allowed: true };
    if (step === 4 && !hasProcedures) return { allowed: false, reason: "Complete at least one procedure in Step 3 first" };
    if (step === 5 && !hasEvidence) return { allowed: false, reason: "Upload evidence in Step 4 first" };
    if (step === 6 && !hasConclusion) return { allowed: false, reason: "Draft a conclusion in Step 5 first" };
    return { allowed: true };
  };

  const handleStepClick = async (step: number) => {
    const gate = canAdvanceTo(step);
    if (!gate.allowed) {
      toast({ title: "Step Locked", description: gate.reason, variant: "destructive" });
      return;
    }
    if (isDirty) await saveAllPending();
    setCurrentStep(step);
  };

  const handleNext = async () => {
    if (currentStep < 6) {
      const nextStep = currentStep + 1;
      const gate = canAdvanceTo(nextStep);
      if (!gate.allowed) {
        toast({ title: "Cannot Advance", description: gate.reason, variant: "destructive" });
        return;
      }
      if (isDirty) await saveAllPending();
      setCurrentStep(nextStep);
    }
  };

  const handlePrev = async () => {
    if (currentStep > 1) {
      if (isDirty) await saveAllPending();
      setCurrentStep(currentStep - 1);
    }
  };

  const saveTOCMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/toc`, data);
      if (!res.ok) throw new Error("Failed to save TOC");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Test of Control saved" });
      setEditingTOC(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'toc'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'related-data'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to save TOC", variant: "destructive" }); }
  });

  const saveTODMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/tod`, data);
      if (!res.ok) throw new Error("Failed to save TOD");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Test of Details saved" });
      setEditingTOD(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'tod'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'related-data'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to save TOD", variant: "destructive" }); }
  });

  const saveAnalyticsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/analytics`, data);
      if (!res.ok) throw new Error("Failed to save analytical");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Analytical procedure saved" });
      setEditingAnalytics(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'analytics'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to save analytical", variant: "destructive" }); }
  });

  const saveAdjustmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/adjustments`, data);
      if (!res.ok) throw new Error("Failed to save adjustment");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Adjustment saved" });
      setEditingAdjustment(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'adjustments'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to save adjustment", variant: "destructive" }); }
  });

  const updateTOCMutation = useMutation({
    mutationFn: async (data: { id: string; [key: string]: any }) => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/toc/${data.id}`, data);
      if (!res.ok) throw new Error("Failed to update TOC");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "TOC updated" });
      setEditingTOC(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'toc'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to update TOC", variant: "destructive" }); }
  });

  const deleteTOCMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/toc/${id}`);
      if (!res.ok) throw new Error("Failed to delete TOC");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "TOC removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'toc'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to delete TOC", variant: "destructive" }); }
  });

  const updateTODMutation = useMutation({
    mutationFn: async (data: { id: string; [key: string]: any }) => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/tod/${data.id}`, data);
      if (!res.ok) throw new Error("Failed to update TOD");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "TOD updated" });
      setEditingTOD(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'tod'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to update TOD", variant: "destructive" }); }
  });

  const deleteTODMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/tod/${id}`);
      if (!res.ok) throw new Error("Failed to delete TOD");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "TOD removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'tod'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to delete TOD", variant: "destructive" }); }
  });

  const updateAnalyticsMutation = useMutation({
    mutationFn: async (data: { id: string; [key: string]: any }) => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/analytics/${data.id}`, data);
      if (!res.ok) throw new Error("Failed to update analytics");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Analytics updated" });
      setEditingAnalytics(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'analytics'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to update analytics", variant: "destructive" }); }
  });

  const deleteAnalyticsMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/analytics/${id}`);
      if (!res.ok) throw new Error("Failed to delete analytics");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Analytics removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'analytics'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to delete analytics", variant: "destructive" }); }
  });

  const updateAdjustmentMutation = useMutation({
    mutationFn: async (data: { id: string; [key: string]: any }) => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/adjustments/${data.id}`, data);
      if (!res.ok) throw new Error("Failed to update adjustment");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Adjustment updated" });
      setEditingAdjustment(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'adjustments'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to update adjustment", variant: "destructive" }); }
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/adjustments/${id}`);
      if (!res.ok) throw new Error("Failed to delete adjustment");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Adjustment removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'adjustments'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to delete adjustment", variant: "destructive" }); }
  });

  const saveRiskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/engagements/${engagementId}/risk-assessments`, {
        ...data, fsHead: fsHeadKey, accountOrClass: fsHeadName
      });
      if (!res.ok) throw new Error("Failed to save risk");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Risk Assessment saved" });
      setEditingRisk(null);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'risk-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'related-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'execution-context'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to save risk", variant: "destructive" }); }
  });

  const generateRisksMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/fs-heads-ai/generate-risks/${engagementId}/${fsHeadKey}`, { fsHeadName });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "AI Generated", description: `Generated ${data.risks?.length || 0} risk areas` });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'risk-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'related-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'execution-context'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to generate risks", variant: "destructive" }); }
  });

  const generateTOCMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/fs-heads-ai/generate-toc/${engagementId}/${fsHeadKey}`, { fsHeadName, saveToDb: true });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "AI Generated", description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'toc'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to generate TOC", variant: "destructive" }); }
  });

  const generateTODMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/fs-heads-ai/generate-tod/${engagementId}/${fsHeadKey}`, { fsHeadName, saveToDb: true });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "AI Generated", description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'tod'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to generate TOD", variant: "destructive" }); }
  });

  const generateAnalyticsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/fs-heads-ai/generate-analytics/${engagementId}/${fsHeadKey}`, { fsHeadName, saveToDb: true });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "AI Generated", description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'analytics'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to generate analytics", variant: "destructive" }); }
  });

  const generateConclusionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/fs-heads-ai/generate-conclusion/${engagementId}/${fsHeadKey}`, { fsHeadName, saveToDb: false });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setConclusion(data.conclusion);
      toast({ title: "AI Generated", description: "Conclusion draft generated. Review and save." });
    },
    onError: () => { toast({ title: "Error", description: "Failed to generate conclusion", variant: "destructive" }); }
  });

  const saveConclusionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/working-paper`, {
        conclusion: data.conclusion, completionStatus: data.completionStatus
      });
      if (!res.ok) throw new Error("Failed to save conclusion");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      baselineConclusionRef.current = variables.conclusion;
      toast({ title: "Success", description: "Conclusion saved" });
      setShowConclusionForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'compliance-check'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to save conclusion", variant: "destructive" }); }
  });

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/working-paper`, { notes });
      if (!res.ok) throw new Error("Failed to save notes");
      return res.json();
    },
    onSuccess: () => {
      baselineNotesRef.current = notes;
      toast({ title: "Success", description: "Notes saved" });
    },
    onError: () => { toast({ title: "Error", description: "Failed to save notes", variant: "destructive" }); }
  });

  const resolveReviewPointMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; response: string }) => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/review-points/${data.id}`, { status: data.status, response: data.response });
      if (!res.ok) throw new Error("Failed to resolve review point");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Review point resolved" });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to resolve review point", variant: "destructive" }); }
  });

  const addReviewPointMutation = useMutation({
    mutationFn: async (data: { description: string; severity: string }) => {
      const res = await apiRequest("POST", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/review-points`, data);
      if (!res.ok) throw new Error("Failed to add review point");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Review point added" });
      setNewReviewPoint("");
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to add review point", variant: "destructive" }); }
  });

  const statusTransitionMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/status`, { status: newStatus });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Status transition failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `Status updated to ${data.status || 'new status'}` });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'compliance-check'] });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Status transition failed", variant: "destructive" }); }
  });

  const handleSignOff = async (action: string) => {
    try {
      const res = await apiRequest("POST", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/signoff`, { action });
      if (res.ok) {
        toast({ title: "Success", description: `Working paper ${action}d successfully` });
        queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey] });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Sign-off failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Sign-off failed", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED": case "COMPLETED": case "EFFECTIVE":
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
      case "REVIEWED":
        return <Badge variant="secondary"><UserCheck className="h-3 w-3 mr-1" />Reviewed</Badge>;
      case "PREPARED": case "IN_PROGRESS":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case "HIGH":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />High</Badge>;
      case "MEDIUM": case "MODERATE":
        return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />Medium</Badge>;
      case "LOW":
        return <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Low</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{status || "Draft"}</Badge>;
    }
  };

  return (
    <Card data-testid="wizard-container">
      <CardHeader className="py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-base" data-testid="wp-title">{fsHeadName}</CardTitle>
              <CardDescription className="text-xs flex items-center gap-2">
                <span>Step {currentStep} of 6: {WIZARD_STEPS[currentStep - 1].description}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5" data-testid="wizard-isa-ref">
                  {WIZARD_STEPS[currentStep - 1].isaRef}
                </Badge>
              </CardDescription>
            </div>
            {getStatusBadge(workingPaper.status)}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Completion: {workingPaper.completionPercentage || Math.round(Object.values(stepCompletion).reduce((sum, s) => sum + s.percent, 0) / 6)}%</span>
            <Progress value={workingPaper.completionPercentage || Math.round(Object.values(stepCompletion).reduce((sum, s) => sum + s.percent, 0) / 6)} className="w-24 h-2" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <WizardStepIndicator
          currentStep={currentStep}
          stepCompletion={stepCompletion}
          onStepClick={handleStepClick}
          gateCheck={canAdvanceTo}
        />

        <ReviewPointsInline reviewPoints={workingPaper.reviewPoints || []} stepLabel={WIZARD_STEPS[currentStep - 1].label} />

        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <Step1Context
              workingPaper={workingPaper}
              fsHeadName={fsHeadName}
              fsHeadType={fsHeadType}
              fsHeadAccounts={fsHeadAccounts}
              clientName={clientName}
              fiscalYear={fiscalYear}
              executionContext={executionContext}
              riskAreas={riskAreas}
              adjustmentItems={adjustmentItems}
              adjustmentTotals={adjustmentTotals}
              getStatusBadge={getStatusBadge}
              formatAccounting={formatAccounting}
            />
          )}

          {currentStep === 2 && (
            <Step2Assertions
              riskAreas={riskAreas}
              executionContext={executionContext}
              procedureTemplate={procedureTemplate}
              editingRisk={editingRisk}
              setEditingRisk={setEditingRisk}
              saveRiskMutation={saveRiskMutation}
              generateRisksMutation={generateRisksMutation}
              fsHeadName={fsHeadName}
              getStatusBadge={getStatusBadge}
            />
          )}

          {currentStep === 3 && (
            <Step3Procedures
              tocItems={tocItems}
              todItems={todItems}
              analyticsItems={analyticsItems}
              adjustmentItems={adjustmentItems}
              editingTOC={editingTOC}
              setEditingTOC={setEditingTOC}
              editingTOD={editingTOD}
              setEditingTOD={setEditingTOD}
              editingAnalytics={editingAnalytics}
              setEditingAnalytics={setEditingAnalytics}
              saveTOCMutation={saveTOCMutation}
              saveTODMutation={saveTODMutation}
              saveAnalyticsMutation={saveAnalyticsMutation}
              updateTOCMutation={updateTOCMutation}
              updateTODMutation={updateTODMutation}
              updateAnalyticsMutation={updateAnalyticsMutation}
              deleteTOCMutation={deleteTOCMutation}
              deleteTODMutation={deleteTODMutation}
              deleteAnalyticsMutation={deleteAnalyticsMutation}
              generateTOCMutation={generateTOCMutation}
              generateTODMutation={generateTODMutation}
              generateAnalyticsMutation={generateAnalyticsMutation}
              procedureTemplate={procedureTemplate}
              executionContext={executionContext}
              isLoading={isLoading}
              workingPaper={workingPaper}
              getStatusBadge={getStatusBadge}
            />
          )}

          {currentStep === 4 && (
            <Step4Evidence
              workingPaper={workingPaper}
              tocItems={tocItems}
              todItems={todItems}
              engagementId={engagementId}
              fsHeadKey={fsHeadKey}
              getStatusBadge={getStatusBadge}
            />
          )}

          {currentStep === 5 && (
            <Step5Conclusions
              workingPaper={workingPaper}
              conclusion={conclusion}
              setConclusion={setConclusion}
              notes={notes}
              setNotes={setNotes}
              saveConclusionMutation={saveConclusionMutation}
              saveNotesMutation={saveNotesMutation}
              generateConclusionMutation={generateConclusionMutation}
              showConclusionForm={showConclusionForm}
              setShowConclusionForm={setShowConclusionForm}
              complianceChecks={complianceChecks}
              executionContext={executionContext}
              tocItems={tocItems}
              todItems={todItems}
              analyticsItems={analyticsItems}
              adjustmentItems={adjustmentItems}
              fsHeadName={fsHeadName}
              engagementId={engagementId}
              fsHeadKey={fsHeadKey}
            />
          )}

          {currentStep === 6 && (
            <Step6Review
              workingPaper={workingPaper}
              complianceChecks={complianceChecks}
              handleSignOff={handleSignOff}
              statusTransitionMutation={statusTransitionMutation}
              addReviewPointMutation={addReviewPointMutation}
              resolveReviewPointMutation={resolveReviewPointMutation}
              newReviewPoint={newReviewPoint}
              setNewReviewPoint={setNewReviewPoint}
              newReviewSeverity={newReviewSeverity}
              setNewReviewSeverity={setNewReviewSeverity}
              hasProcedures={hasProcedures}
              hasEvidence={hasEvidence}
              hasConclusion={hasConclusion}
              riskAreas={riskAreas}
              executionContext={executionContext}
              getStatusBadge={getStatusBadge}
            />
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t mt-4" data-testid="wizard-nav">
          <Button variant="outline" onClick={handlePrev} disabled={currentStep === 1} className="gap-1" data-testid="btn-wizard-prev">
            <ArrowLeft className="h-4 w-4" />
            {currentStep > 1 ? WIZARD_STEPS[currentStep - 2].label : "Back"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Step {currentStep} of 6
          </span>
          <Button onClick={handleNext} disabled={currentStep === 6} className="gap-1" data-testid="btn-wizard-next">
            {currentStep < 6 ? WIZARD_STEPS[currentStep].label : "Complete"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step1Context({ workingPaper, fsHeadName, fsHeadType, fsHeadAccounts, clientName, fiscalYear, executionContext, riskAreas, adjustmentItems, adjustmentTotals, getStatusBadge, formatAccounting: fmt }: any) {
  const ctx = executionContext || {};
  const mat = ctx.materiality || {};
  const fin = ctx.financials || {};
  const flags = ctx.planningFlags || {};
  const completion = ctx.completion || {};
  const procSummary = ctx.procedureSummary || {};
  const evSummary = ctx.evidenceSummary || {};
  const team = ctx.teamAssignment || {};
  const tpl = ctx.template || {};
  const subItems = ctx.subLineItems || [];

  return (
    <div className="space-y-4" data-testid="step-1-context">
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">FS Head Working Paper</h3>
          {completion.overallPercent !== undefined && (
            <Badge variant={completion.overallPercent === 100 ? "default" : "secondary"} className="ml-auto">
              {completion.overallPercent}% Complete
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client:</span>
              <span className="font-medium" data-testid="wp-client-name">{ctx.engagement?.clientName || clientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Year:</span>
              <span className="font-medium" data-testid="wp-fiscal-year">{ctx.engagement?.fiscalYear || fiscalYear}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">FS Head:</span>
              <span className="font-medium" data-testid="wp-fs-head">{fsHeadName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Framework:</span>
              <span className="font-medium">{ctx.engagement?.reportingFramework || "IFRS"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <Badge variant="outline" data-testid="wp-fs-type">{fsHeadType === "Balance Sheet" ? "BS" : "PL"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preparer:</span>
              <span className="font-medium">{team.preparer || workingPaper.preparedByName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reviewer:</span>
              <span className="font-medium">{team.reviewer || workingPaper.reviewedByName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Partner:</span>
              <span className="font-medium">{team.partner || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {(flags.hasFraudRisk || flags.hasSignificantRisk || flags.hasGoingConcernRisk || flags.hasRelatedPartyIssues || flags.isa540Triggered || fin.isSignificant) && (
        <div className="flex flex-wrap gap-2">
          {fin.isSignificant && <Badge variant="default" className="bg-blue-600">Significant Account</Badge>}
          {flags.hasFraudRisk && <Badge variant="destructive">Fraud Risk (ISA 240)</Badge>}
          {flags.hasSignificantRisk && <Badge variant="destructive" className="bg-orange-600">Significant Risk</Badge>}
          {flags.hasGoingConcernRisk && <Badge variant="destructive" className="bg-purple-600">Going Concern (ISA 570)</Badge>}
          {flags.hasRelatedPartyIssues && <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Related Parties (ISA 550)</Badge>}
          {flags.isa540Triggered && <Badge variant="secondary">ISA 540 Estimates</Badge>}
          {flags.hasLegalComplianceIssues && <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">Legal/Compliance Issues</Badge>}
        </div>
      )}

      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Lead Schedule</h4>
          <Badge variant="secondary" className="ml-2">Auto-Extracted from TB</Badge>
          <Badge variant="outline" className="ml-1">{subItems.length || fsHeadAccounts.length} Sub-Items</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Sub-Line Item</TableHead>
                <TableHead className="text-right min-w-[90px]">P.Y</TableHead>
                {(fsHeadType !== "Income" && fsHeadType !== "Expenses") && (
                  <>
                    <TableHead className="text-right min-w-[90px]">Dr</TableHead>
                    <TableHead className="text-right min-w-[90px]">Cr</TableHead>
                  </>
                )}
                <TableHead className="text-right min-w-[90px]">CY</TableHead>
                <TableHead className="text-right min-w-[70px]">Var%</TableHead>
                <TableHead className="text-right min-w-[90px]">Adj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(subItems.length > 0 ? subItems : fsHeadAccounts).length > 0 ? (
                <>
                  {(subItems.length > 0 ? subItems : fsHeadAccounts).map((item: any, idx: number) => {
                    const code = item.code || item.accountCode || "";
                    const name = item.name || item.accountName || "";
                    const py = item.priorYear ?? item.openingBalance ?? 0;
                    const cy = item.closingBalance ?? 0;
                    const dr = item.debit ?? item.debits ?? 0;
                    const cr = item.credit ?? item.credits ?? 0;
                    const varPct = item.variancePercent ?? (py !== 0 ? ((cy - py) / Math.abs(py)) * 100 : (cy !== 0 ? 100 : 0));
                    const accountAdj = adjustmentItems.filter((adj: AdjustmentItem) =>
                      adj.debitAccountCode === code || adj.creditAccountCode === code
                    );
                    const totalAdj = accountAdj.reduce((sum: number, adj: AdjustmentItem) => {
                      let net = 0;
                      if (adj.debitAccountCode === code) net += adj.debitAmount || 0;
                      if (adj.creditAccountCode === code) net -= adj.creditAmount || 0;
                      return sum + net;
                    }, 0);
                    return (
                      <TableRow key={code || idx} data-testid={`fs-summary-row-${idx}`}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground font-mono">{code}</span>
                            <span className="truncate max-w-[220px]">{name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(py)}</TableCell>
                        {(fsHeadType !== "Income" && fsHeadType !== "Expenses") && (
                          <>
                            <TableCell className="text-right font-mono text-sm">{fmt(dr)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmt(cr)}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right font-mono text-sm">{fmt(cy)}</TableCell>
                        <TableCell className="text-right text-xs">
                          {Math.abs(varPct) > 20 ? (
                            <span className={varPct > 0 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>
                              {varPct > 0 ? "▲" : "▼"}{Math.abs(varPct).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{Math.abs(varPct).toFixed(0)}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {totalAdj !== 0 ? <span className={totalAdj > 0 ? "text-green-600" : "text-red-600"}>{fmt(totalAdj)}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-medium border-t-2">
                    <TableCell className="font-semibold">Total ({fsHeadName})</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(fin.priorYearBalance ?? fsHeadAccounts.reduce((s: number, a: FSHeadAccount) => s + (a.openingBalance || 0), 0))}</TableCell>
                    {(fsHeadType !== "Income" && fsHeadType !== "Expenses") && (
                      <>
                        <TableCell className="text-right font-mono font-semibold">{fmt(subItems.length > 0 ? subItems.reduce((s: number, i: any) => s + (i.debit || 0), 0) : fsHeadAccounts.reduce((s: number, a: FSHeadAccount) => s + (a.debits || 0), 0))}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{fmt(subItems.length > 0 ? subItems.reduce((s: number, i: any) => s + (i.credit || 0), 0) : fsHeadAccounts.reduce((s: number, a: FSHeadAccount) => s + (a.credits || 0), 0))}</TableCell>
                      </>
                    )}
                    <TableCell className="text-right font-mono font-semibold">{fmt(fin.currentYearBalance ?? fsHeadAccounts.reduce((s: number, a: FSHeadAccount) => s + (a.closingBalance || 0), 0))}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {fin.movementPercent ? (
                        <span className={fin.movementPercent > 0 ? "text-amber-600" : "text-red-600"}>
                          {fin.movementPercent > 0 ? "▲" : "▼"}{Math.abs(fin.movementPercent).toFixed(0)}%
                        </span>
                      ) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(adjustmentTotals.totalNetImpact || 0)}</TableCell>
                  </TableRow>
                </>
              ) : (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No sub-line items found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Materiality Comparison (ISA 320)</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Materiality</span>
              <span className="font-semibold" data-testid="wp-overall-mat">{fmt(mat.overall || workingPaper.overallMateriality)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Performance Materiality</span>
              <span className="font-semibold" data-testid="wp-perf-mat">{fmt(mat.performance || workingPaper.performanceMateriality)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Trivial Threshold</span>
              <span className="font-semibold">{fmt(mat.trivial || workingPaper.trivialThreshold)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">FS Head Balance</span>
                <span className="font-bold">{fmt(fin.currentYearBalance ?? workingPaper.currentYearBalance)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">vs PM</span>
                <span className={`font-semibold ${fin.isSignificant ? "text-red-600" : "text-green-600"}`}>
                  {fin.isSignificant ? "Exceeds PM — Significant" : "Below PM"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Completion Status</h4>
          </div>
          <div className="space-y-2">
            {[
              { label: "Context Loaded", done: completion.contextComplete, weight: "10%" },
              { label: "Assertions Confirmed", done: completion.assertionsComplete, weight: "15%" },
              { label: "Procedures Performed", done: completion.proceduresComplete, weight: "30%" },
              { label: "Evidence Attached", done: completion.evidenceComplete, weight: "20%" },
              { label: "Conclusion Written", done: completion.conclusionComplete, weight: "15%" },
              { label: "Review Approved", done: completion.reviewComplete, weight: "10%" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {item.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                )}
                <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                <span className="text-muted-foreground ml-auto">{item.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(riskAreas.length > 0 || (ctx.linkedRisks || []).length > 0) && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Linked Risks (ISA 315)</h4>
            <Badge variant="outline">{(ctx.linkedRisks || riskAreas).length} risks</Badge>
          </div>
          <div className="space-y-2">
            {(ctx.linkedRisks || riskAreas).slice(0, 5).map((risk: any) => (
              <div key={risk.id} className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${(risk.romm || risk.riskLevel || risk.inherentRisk) === 'HIGH' ? 'bg-red-500' : (risk.romm || risk.riskLevel || risk.inherentRisk) === 'MODERATE' ? 'bg-amber-500' : 'bg-green-500'}`} />
                <span className="flex-1 truncate text-xs">{risk.riskDescription || risk.riskTitle}</span>
                <div className="flex gap-1 flex-shrink-0">
                  {risk.isFraudRisk && <Badge variant="destructive" className="text-[9px] h-4">Fraud</Badge>}
                  {risk.isSignificantRisk && <Badge variant="secondary" className="text-[9px] h-4 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200">Significant</Badge>}
                </div>
                {getStatusBadge(risk.romm || risk.riskLevel || risk.inherentRisk)}
              </div>
            ))}
          </div>
        </div>
      )}

      {tpl.specialEnforcement?.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
            <strong>Special Enforcement ({tpl.displayName}):</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              {tpl.specialEnforcement.map((e: string, i: number) => <li key={i}>{e}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Step2Assertions({ riskAreas, executionContext, procedureTemplate, editingRisk, setEditingRisk, saveRiskMutation, generateRisksMutation, fsHeadName, getStatusBadge }: any) {
  const ASSERTIONS = [
    { id: "Existence", label: "Existence / Occurrence", abbr: "E/O", alt: ["existence", "EXISTENCE", "Occurrence"] },
    { id: "Completeness", label: "Completeness", abbr: "C", alt: ["completeness", "COMPLETENESS"] },
    { id: "Accuracy", label: "Accuracy", abbr: "A", alt: ["accuracy", "ACCURACY"] },
    { id: "Valuation", label: "Valuation / Allocation", abbr: "V/A", alt: ["valuation", "VALUATION"] },
    { id: "Rights & Obligations", label: "Rights & Obligations", abbr: "R&O", alt: ["rights", "RIGHTS_AND_OBLIGATIONS", "Rights"] },
    { id: "Presentation & Disclosure", label: "Presentation & Disclosure", abbr: "P&D", alt: ["presentation", "PRESENTATION", "Presentation"] },
    { id: "Cut-off", label: "Cut-off", abbr: "CO", alt: ["cutoff", "CUT_OFF", "Cut-off"] },
    { id: "Classification", label: "Classification", abbr: "CL", alt: ["classification", "CLASSIFICATION"] },
  ];

  const ctx = executionContext || {};
  const linkedRisks = ctx.linkedRisks || [];
  const assertionMatrix = ctx.assertionMatrix || {};
  const auditProgram = ctx.auditProgram || [];
  const allRisks = [...riskAreas, ...linkedRisks.filter((lr: any) => !riskAreas.some((ra: RiskArea) => ra.id === lr.id))];

  const getAssertionCoverage = (assertionId: string, alts: string[]) => {
    const matrixEntry = assertionMatrix[assertionId] || assertionMatrix[alts.find((a: string) => assertionMatrix[a])] || {};
    const riskCount = matrixEntry.risks?.length || 0;
    const procCount = matrixEntry.procedures?.length || 0;
    const isSelected = matrixEntry.selected || riskCount > 0;
    return { riskCount, procCount, isSelected };
  };

  return (
    <div className="space-y-4" data-testid="step-2-assertions">
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <Target className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
          ISA 315/330: Assertion matrix auto-built from Planning risks. Each assertion with linked risks requires at least one audit procedure response.
        </AlertDescription>
      </Alert>

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Assertion Coverage Matrix
          </h4>
          {procedureTemplate && (
            <div className="flex gap-1">
              {procedureTemplate.keyAssertions?.map((a: string) => (
                <Badge key={a} variant="default" className="text-xs">{a}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {ASSERTIONS.map(a => {
            const cov = getAssertionCoverage(a.id, a.alt);
            return (
              <div key={a.id} className={`p-2 rounded-lg border text-center ${cov.isSelected ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-muted/30"}`}>
                <div className="text-xs font-semibold">{a.abbr}</div>
                <div className="text-[10px] text-muted-foreground truncate">{a.label}</div>
                {cov.isSelected ? (
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-[10px] text-green-700 dark:text-green-300">{cov.riskCount} risk{cov.riskCount !== 1 ? "s" : ""}</span>
                    <span className="text-[10px] text-blue-700 dark:text-blue-300">{cov.procCount} proc</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground mt-1">Not covered</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Risk</TableHead>
                {ASSERTIONS.map(a => (
                  <TableHead key={a.id} className="text-center w-12 text-xs">{a.abbr}</TableHead>
                ))}
                <TableHead className="w-20">ROMM</TableHead>
                <TableHead className="w-16">Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRisks.length > 0 ? allRisks.map((risk: any) => {
                const rawAssertions = risk.assertions || risk.assertionImpacts || [];
                const riskAssertions = Array.isArray(rawAssertions) ? rawAssertions : typeof rawAssertions === 'string' ? rawAssertions.split(',').map((s: string) => s.trim()) : [];
                return (
                  <TableRow key={risk.id} data-testid={`assertion-row-${risk.id}`}>
                    <TableCell className="text-xs">{risk.riskTitle || risk.riskDescription || "Untitled Risk"}</TableCell>
                    {ASSERTIONS.map(a => {
                      const covered = riskAssertions.some((ra: string) =>
                        ra === a.id || ra === a.abbr || ra === a.label || a.alt.includes(ra)
                      );
                      return (
                        <TableCell key={a.id} className="text-center">
                          {covered ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell>{getStatusBadge(risk.romm || risk.riskLevel || risk.inherentRisk || "MEDIUM")}</TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {risk.isFraudRisk && <Badge variant="destructive" className="text-[8px] h-4 px-1">F</Badge>}
                        {risk.isSignificantRisk && <Badge variant="secondary" className="text-[8px] h-4 px-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200">S</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={ASSERTIONS.length + 3} className="text-center py-6 text-muted-foreground">
                    No risks identified. Generate risks or add manually.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {auditProgram.length > 0 && (
        <div className="border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Linked Audit Program ({auditProgram.length} procedures from Planning)
          </h4>
          <div className="space-y-1.5">
            {auditProgram.slice(0, 6).map((proc: any) => (
              <div key={proc.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                <span className="font-mono text-muted-foreground w-16 flex-shrink-0">{proc.workpaperRef}</span>
                <span className="flex-1 truncate">{proc.title || proc.description}</span>
                <div className="flex gap-1 flex-shrink-0">
                  {proc.assertions?.slice(0, 2).map((a: string) => (
                    <Badge key={a} variant="outline" className="text-[9px] h-4">{a}</Badge>
                  ))}
                </div>
                <Badge variant={proc.status === "COMPLETED" ? "default" : "secondary"} className="text-[9px] h-4">{proc.status}</Badge>
              </div>
            ))}
            {auditProgram.length > 6 && (
              <p className="text-xs text-muted-foreground text-center">+ {auditProgram.length - 6} more procedures</p>
            )}
          </div>
        </div>
      )}

      {procedureTemplate && (
        <div className="border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Template Key Risks ({procedureTemplate.displayName || fsHeadName})
          </h4>
          <div className="space-y-2">
            {procedureTemplate.keyRisks?.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                <span>{r.description}</span>
                {r.isaReference && <Badge variant="outline" className="text-xs h-4 ml-auto">{r.isaReference}</Badge>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {procedureTemplate.fraudRiskPresumed && <Badge variant="destructive">ISA 240 Fraud Risk Presumed</Badge>}
            {procedureTemplate.isa540Triggered && <Badge variant="secondary">ISA 540 Estimates</Badge>}
            {procedureTemplate.riskLocked && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Risk Level Locked</Badge>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Risk Areas ({allRisks.length})</h4>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => generateRisksMutation.mutate()}
            disabled={generateRisksMutation.isPending}
            data-testid="btn-generate-risks"
          >
            {generateRisksMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            AI Generate Risks
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setEditingRisk({ id: 'new' })}
            data-testid="btn-add-risk"
          >
            <Plus className="h-3 w-3" />
            Add Risk
          </Button>
        </div>
      </div>

      {editingRisk && (
        <RiskAssessmentForm
          onSave={(data: any) => saveRiskMutation.mutate(data)}
          onCancel={() => setEditingRisk(null)}
          initialData={editingRisk.id !== 'new' ? editingRisk : undefined}
          fsHeadName={fsHeadName}
        />
      )}
    </div>
  );
}

function Step3Procedures({
  tocItems, todItems, analyticsItems, adjustmentItems,
  editingTOC, setEditingTOC, editingTOD, setEditingTOD,
  editingAnalytics, setEditingAnalytics,
  saveTOCMutation, saveTODMutation, saveAnalyticsMutation,
  updateTOCMutation, updateTODMutation, updateAnalyticsMutation,
  deleteTOCMutation, deleteTODMutation, deleteAnalyticsMutation,
  generateTOCMutation, generateTODMutation, generateAnalyticsMutation,
  procedureTemplate, executionContext, isLoading, workingPaper, getStatusBadge
}: any) {
  const [activeSection, setActiveSection] = useState<'toc' | 'tod' | 'analytics'>('toc');
  const ctx = executionContext || {};
  const auditProgram = ctx.auditProgram || [];
  const procSummary = ctx.procedureSummary || {};
  const flags = ctx.planningFlags || {};

  const totalPerformed = tocItems.filter((t: TOCItem) => t.result && t.result !== "NOT_TESTED" && t.result !== "PENDING").length +
    todItems.filter((t: TODItem) => t.result && t.result !== "NOT_TESTED" && t.result !== "PENDING").length +
    analyticsItems.filter((a: AnalyticalItem) => a.conclusion).length;
  const totalProcedures = tocItems.length + todItems.length + analyticsItems.length;

  return (
    <div className="space-y-4" data-testid="step-3-procedures">
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <ClipboardList className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
          ISA 330: Execute audit procedures responding to assessed risks. Procedures auto-inherited from Planning audit programs.
          {flags.hasFraudRisk && " ISA 240 fraud procedures are mandatory."}
          {flags.hasSignificantRisk && " Enhanced procedures required for significant risks."}
        </AlertDescription>
      </Alert>

      {auditProgram.length > 0 && (
        <div className="border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Planning Audit Program ({auditProgram.length} procedures linked)</span>
            <Badge variant="outline" className="text-[9px] h-4 ml-auto">{totalPerformed}/{totalProcedures} performed</Badge>
          </div>
          <div className="space-y-1">
            {auditProgram.slice(0, 4).map((proc: any) => (
              <div key={proc.id} className="flex items-center gap-2 text-[10px] p-1 rounded bg-background/50">
                <span className="font-mono text-muted-foreground w-14 flex-shrink-0">{proc.workpaperRef}</span>
                <span className="flex-1 truncate">{proc.title || proc.description}</span>
                <div className="flex gap-0.5 flex-shrink-0">
                  {proc.assertions?.slice(0, 2).map((a: string) => (
                    <Badge key={a} variant="outline" className="text-[8px] h-3.5 px-1">{a}</Badge>
                  ))}
                </div>
                <Badge variant={proc.status === "COMPLETED" ? "default" : "secondary"} className="text-[8px] h-3.5">{proc.status}</Badge>
              </div>
            ))}
            {auditProgram.length > 4 && (
              <p className="text-[10px] text-muted-foreground text-center">+ {auditProgram.length - 4} more</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <button
          onClick={() => setActiveSection('toc')}
          className={`p-3 rounded-lg border text-left transition-all ${activeSection === 'toc' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
          data-testid="btn-section-toc"
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4" />
            <span className="font-medium text-sm">Test of Controls</span>
          </div>
          <div className="text-2xl font-bold">{tocItems.length}</div>
          <div className="text-xs text-muted-foreground">
            {tocItems.filter((t: TOCItem) => t.result === "EFFECTIVE").length} effective
            {tocItems.filter((t: TOCItem) => t.result === "NOT_EFFECTIVE").length > 0 && (
              <span className="text-red-600 ml-1">• {tocItems.filter((t: TOCItem) => t.result === "NOT_EFFECTIVE").length} failed</span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveSection('tod')}
          className={`p-3 rounded-lg border text-left transition-all ${activeSection === 'tod' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
          data-testid="btn-section-tod"
        >
          <div className="flex items-center gap-2 mb-1">
            <TestTube2 className="h-4 w-4" />
            <span className="font-medium text-sm">Test of Details</span>
          </div>
          <div className="text-2xl font-bold">{todItems.length}</div>
          <div className="text-xs text-muted-foreground">
            {todItems.filter((t: TODItem) => t.result === "SATISFACTORY").length} satisfactory
            {todItems.filter((t: TODItem) => (t.exceptionsFound || 0) > 0).length > 0 && (
              <span className="text-amber-600 ml-1">• {todItems.filter((t: TODItem) => (t.exceptionsFound || 0) > 0).length} exceptions</span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveSection('analytics')}
          className={`p-3 rounded-lg border text-left transition-all ${activeSection === 'analytics' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
          data-testid="btn-section-analytics"
        >
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4" />
            <span className="font-medium text-sm">Analytics</span>
          </div>
          <div className="text-2xl font-bold">{analyticsItems.length}</div>
          <div className="text-xs text-muted-foreground">{analyticsItems.filter((a: AnalyticalItem) => a.conclusion).length} concluded</div>
        </button>
      </div>

      {activeSection === 'toc' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Test of Controls</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => generateTOCMutation.mutate()} disabled={generateTOCMutation.isPending} data-testid="btn-generate-toc">
                {generateTOCMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI Generate
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingTOC({ id: 'new', tocRef: '', controlType: 'Preventive', controlFrequency: 'Monthly', controlDescription: '', controlOwner: '', testSteps: '', result: 'NOT_TESTED' })} data-testid="btn-add-toc">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          </div>
          {editingTOC?.id === 'new' && (
            <div className="border rounded-md p-3 bg-muted/30" data-testid="toc-row-new">
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Control Ref *</Label>
                  <Input value={editingTOC.tocRef || ''} onChange={(e) => setEditingTOC({ ...editingTOC, tocRef: e.target.value })} placeholder="TOC-001" data-testid="input-toc-ref-new" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={editingTOC.controlType || 'Preventive'} onValueChange={(v: string) => setEditingTOC({ ...editingTOC, controlType: v })}>
                    <SelectTrigger data-testid="select-control-type-new"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Preventive">Preventive</SelectItem>
                      <SelectItem value="Detective">Detective</SelectItem>
                      <SelectItem value="Corrective">Corrective</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <Select value={editingTOC.controlFrequency || 'Monthly'} onValueChange={(v: string) => setEditingTOC({ ...editingTOC, controlFrequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Per Transaction">Per Transaction</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={() => saveTOCMutation.mutate(editingTOC)} disabled={saveTOCMutation.isPending || !editingTOC.tocRef} data-testid="btn-save-toc-new">
                    {saveTOCMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingTOC(null)} data-testid="btn-cancel-toc-new"><X className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={editingTOC.controlDescription || ''} onChange={(e) => setEditingTOC({ ...editingTOC, controlDescription: e.target.value })} placeholder="Describe the control..." rows={2} data-testid="input-description-toc-new" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Control Owner</Label>
                  <Input value={editingTOC.controlOwner || ''} onChange={(e) => setEditingTOC({ ...editingTOC, controlOwner: e.target.value })} placeholder="e.g., Finance Manager" data-testid="input-owner-toc-new" />
                  <Label className="text-xs mt-2">Result</Label>
                  <Select value={editingTOC.result || 'NOT_TESTED'} onValueChange={(v: string) => setEditingTOC({ ...editingTOC, result: v })}>
                    <SelectTrigger data-testid="select-result-toc-new"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOT_TESTED">Not Tested</SelectItem>
                      <SelectItem value="EFFECTIVE">Effective</SelectItem>
                      <SelectItem value="INEFFECTIVE">Ineffective</SelectItem>
                      <SelectItem value="DEVIATION">Deviation Found</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="text-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div></div>
          ) : tocItems.length === 0 && editingTOC?.id !== 'new' ? (
            <div className="text-center py-6 text-muted-foreground border rounded-lg" data-testid="toc-empty">
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No Test of Controls documented</p>
              <p className="text-xs mt-1">Click AI Generate or Add manually</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="toc-list">
              {tocItems.map((toc: TOCItem) => (
                <div key={toc.id} className="border rounded-md p-3" data-testid={`toc-row-${toc.id}`}>
                  {editingTOC?.id === toc.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Control Ref</Label>
                          <Input value={editingTOC.tocRef || ''} onChange={(e) => setEditingTOC({ ...editingTOC, tocRef: e.target.value })} data-testid="input-toc-ref-inline" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={editingTOC.controlType || ''} onValueChange={(v: string) => setEditingTOC({ ...editingTOC, controlType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Preventive">Preventive</SelectItem>
                              <SelectItem value="Detective">Detective</SelectItem>
                              <SelectItem value="Corrective">Corrective</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Frequency</Label>
                          <Select value={editingTOC.controlFrequency || ''} onValueChange={(v: string) => setEditingTOC({ ...editingTOC, controlFrequency: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Per Transaction">Per Transaction</SelectItem>
                              <SelectItem value="Daily">Daily</SelectItem>
                              <SelectItem value="Weekly">Weekly</SelectItem>
                              <SelectItem value="Monthly">Monthly</SelectItem>
                              <SelectItem value="Quarterly">Quarterly</SelectItem>
                              <SelectItem value="Annually">Annually</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button size="sm" onClick={() => updateTOCMutation.mutate(editingTOC)} disabled={updateTOCMutation.isPending} data-testid="btn-save-toc-inline">
                            {updateTOCMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTOC(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Textarea value={editingTOC.controlDescription || ''} onChange={(e) => setEditingTOC({ ...editingTOC, controlDescription: e.target.value })} rows={2} data-testid="input-description-toc-inline" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Control Owner</Label>
                          <Input value={editingTOC.controlOwner || ''} onChange={(e) => setEditingTOC({ ...editingTOC, controlOwner: e.target.value })} placeholder="e.g., Finance Manager" />
                          <Label className="text-xs mt-2">Result</Label>
                          <Select value={editingTOC.result || 'NOT_TESTED'} onValueChange={(v: string) => setEditingTOC({ ...editingTOC, result: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NOT_TESTED">Not Tested</SelectItem>
                              <SelectItem value="EFFECTIVE">Effective</SelectItem>
                              <SelectItem value="INEFFECTIVE">Ineffective</SelectItem>
                              <SelectItem value="DEVIATION">Deviation Found</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{toc.tocRef}</span>
                          <Badge variant="outline" className="text-xs">{toc.controlType || '-'}</Badge>
                          <Badge variant="outline" className="text-xs">{toc.controlFrequency || '-'}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{toc.controlDescription}</p>
                      </div>
                      {getStatusBadge(toc.result)}
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditingTOC({ ...toc })} data-testid={`btn-edit-toc-${toc.id}`}><FilePen className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (window.confirm('Delete this control test?')) deleteTOCMutation.mutate(toc.id); }} data-testid={`btn-delete-toc-${toc.id}`}><X className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'tod' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Test of Details</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => generateTODMutation.mutate()} disabled={generateTODMutation.isPending} data-testid="btn-generate-tod">
                {generateTODMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI Generate
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingTOD({ id: 'new', todRef: '', procedureDescription: '', populationCount: 0, sampleSize: 0, samplingMethod: 'Random', exceptionsFound: 0, result: 'NOT_TESTED' })} data-testid="btn-add-tod">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          </div>
          {editingTOD?.id === 'new' && (
            <div className="border rounded-md p-3 bg-muted/30" data-testid="tod-row-new">
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Procedure Ref *</Label>
                  <Input value={editingTOD.todRef || ''} onChange={(e) => setEditingTOD({ ...editingTOD, todRef: e.target.value })} placeholder="TOD-001" data-testid="input-tod-ref-new" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sampling Method</Label>
                  <Select value={editingTOD.samplingMethod || 'Random'} onValueChange={(v: string) => setEditingTOD({ ...editingTOD, samplingMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Random">Random</SelectItem>
                      <SelectItem value="MUS">MUS</SelectItem>
                      <SelectItem value="Stratified">Stratified</SelectItem>
                      <SelectItem value="Judgmental">Judgmental</SelectItem>
                      <SelectItem value="100% coverage">100% coverage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Result</Label>
                  <Select value={editingTOD.result || 'NOT_TESTED'} onValueChange={(v: string) => setEditingTOD({ ...editingTOD, result: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOT_TESTED">Not Tested</SelectItem>
                      <SelectItem value="SATISFACTORY">Satisfactory</SelectItem>
                      <SelectItem value="EXCEPTIONS_NOTED">Exceptions</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={() => saveTODMutation.mutate(editingTOD)} disabled={saveTODMutation.isPending || !editingTOD.todRef} data-testid="btn-save-tod-new">
                    {saveTODMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingTOD(null)}><X className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">Description</Label>
                <Textarea value={editingTOD.procedureDescription || ''} onChange={(e) => setEditingTOD({ ...editingTOD, procedureDescription: e.target.value })} placeholder="Describe the test..." rows={2} data-testid="input-description-tod-new" />
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Population Size</Label>
                  <Input value={editingTOD.populationCount || ''} onChange={(e) => setEditingTOD({ ...editingTOD, populationCount: parseInt(e.target.value) || 0 })} type="number" placeholder="e.g. 500" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Population Value</Label>
                  <Input value={editingTOD.populationValue || ''} onChange={(e) => setEditingTOD({ ...editingTOD, populationValue: parseFloat(e.target.value) || 0 })} type="number" placeholder="e.g. 1000000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sample Size</Label>
                  <Input value={editingTOD.sampleSize || ''} onChange={(e) => setEditingTOD({ ...editingTOD, sampleSize: parseInt(e.target.value) || 0 })} type="number" placeholder="e.g. 25" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Exceptions Found</Label>
                  <Input value={editingTOD.exceptionsFound || ''} onChange={(e) => setEditingTOD({ ...editingTOD, exceptionsFound: parseInt(e.target.value) || 0 })} type="number" placeholder="0" />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">Conclusion</Label>
                <Textarea value={editingTOD.conclusion || ''} onChange={(e) => setEditingTOD({ ...editingTOD, conclusion: e.target.value })} placeholder="Conclusion of this test..." rows={2} />
              </div>
            </div>
          )}
          {todItems.length === 0 && editingTOD?.id !== 'new' ? (
            <div className="text-center py-6 text-muted-foreground border rounded-lg" data-testid="tod-empty">
              <TestTube2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No Test of Details documented</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="tod-list">
              {todItems.map((tod: TODItem) => (
                <div key={tod.id} className="border rounded-md p-3" data-testid={`tod-row-${tod.id}`}>
                  {editingTOD?.id === tod.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Ref</Label>
                          <Input value={editingTOD.todRef || ''} onChange={(e) => setEditingTOD({ ...editingTOD, todRef: e.target.value })} data-testid="input-tod-ref-inline" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Method</Label>
                          <Select value={editingTOD.samplingMethod || ''} onValueChange={(v: string) => setEditingTOD({ ...editingTOD, samplingMethod: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Random">Random</SelectItem>
                              <SelectItem value="MUS">MUS</SelectItem>
                              <SelectItem value="Stratified">Stratified</SelectItem>
                              <SelectItem value="Judgmental">Judgmental</SelectItem>
                              <SelectItem value="100% coverage">100%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Result</Label>
                          <Select value={editingTOD.result || 'NOT_TESTED'} onValueChange={(v: string) => setEditingTOD({ ...editingTOD, result: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NOT_TESTED">Not Tested</SelectItem>
                              <SelectItem value="SATISFACTORY">Satisfactory</SelectItem>
                              <SelectItem value="EXCEPTIONS_NOTED">Exceptions</SelectItem>
                              <SelectItem value="NOT_APPLICABLE">N/A</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button size="sm" onClick={() => updateTODMutation.mutate(editingTOD)} disabled={updateTODMutation.isPending}><Save className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTOD(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea value={editingTOD.procedureDescription || ''} onChange={(e) => setEditingTOD({ ...editingTOD, procedureDescription: e.target.value })} rows={2} />
                      </div>
                      <div className="grid grid-cols-4 gap-3 mt-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Population Size</Label>
                          <Input value={editingTOD.populationCount || ''} onChange={(e) => setEditingTOD({ ...editingTOD, populationCount: parseInt(e.target.value) || 0 })} type="number" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Population Value</Label>
                          <Input value={editingTOD.populationValue || ''} onChange={(e) => setEditingTOD({ ...editingTOD, populationValue: parseFloat(e.target.value) || 0 })} type="number" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sample Size</Label>
                          <Input value={editingTOD.sampleSize || ''} onChange={(e) => setEditingTOD({ ...editingTOD, sampleSize: parseInt(e.target.value) || 0 })} type="number" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Exceptions</Label>
                          <Input value={editingTOD.exceptionsFound || ''} onChange={(e) => setEditingTOD({ ...editingTOD, exceptionsFound: parseInt(e.target.value) || 0 })} type="number" />
                        </div>
                      </div>
                      <div className="space-y-1 mt-3">
                        <Label className="text-xs">Conclusion</Label>
                        <Textarea value={editingTOD.conclusion || ''} onChange={(e) => setEditingTOD({ ...editingTOD, conclusion: e.target.value })} rows={2} placeholder="Conclusion..." />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{tod.todRef}</span>
                            <Badge variant="outline" className="text-xs">{tod.samplingMethod || '-'}</Badge>
                            {(tod.sampleSize || 0) > 0 && (
                              <span className="text-[10px] text-muted-foreground">Sample: {tod.sampleSize}/{tod.populationCount || '?'}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{tod.procedureDescription}</p>
                        </div>
                        {getStatusBadge(tod.result)}
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditingTOD({ ...tod })} data-testid={`btn-edit-tod-${tod.id}`}><FilePen className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (window.confirm('Delete this test of detail?')) deleteTODMutation.mutate(tod.id); }} data-testid={`btn-delete-tod-${tod.id}`}><X className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                      {((tod.exceptionsFound || 0) > 0 || tod.conclusion) && (
                        <div className="mt-2 pt-2 border-t flex items-start gap-4 text-xs">
                          {(tod.exceptionsFound || 0) > 0 && (
                            <span className="text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {tod.exceptionsFound} exception{(tod.exceptionsFound || 0) > 1 ? 's' : ''}
                              {(tod.projectedMisstatement || 0) > 0 && ` (projected: ${formatAccounting(tod.projectedMisstatement || 0)})`}
                            </span>
                          )}
                          {tod.conclusion && <span className="text-muted-foreground flex-1 truncate">{tod.conclusion}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'analytics' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Analytical Procedures</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => generateAnalyticsMutation.mutate()} disabled={generateAnalyticsMutation.isPending} data-testid="btn-run-analytics">
                {generateAnalyticsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                AI Generate
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingAnalytics({ id: 'new', procedureRef: '', analyticalType: 'YoY Comparison', description: '', thresholdPercentage: 10, currentYearValue: workingPaper.currentYearBalance || 0, priorYearValue: workingPaper.priorYearBalance || 0 })} data-testid="btn-add-analytics">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          </div>
          {editingAnalytics?.id === 'new' && (
            <div className="border rounded-md p-3 bg-muted/30" data-testid="analytics-row-new">
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Ref *</Label>
                  <Input value={editingAnalytics.procedureRef || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, procedureRef: e.target.value })} placeholder="ANA-001" data-testid="input-analytics-ref-new" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={editingAnalytics.analyticalType || 'YoY Comparison'} onValueChange={(v: string) => setEditingAnalytics({ ...editingAnalytics, analyticalType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YoY Comparison">YoY Comparison</SelectItem>
                      <SelectItem value="Trend Analysis">Trend Analysis</SelectItem>
                      <SelectItem value="Ratio Analysis">Ratio Analysis</SelectItem>
                      <SelectItem value="Budget Comparison">Budget Comparison</SelectItem>
                      <SelectItem value="Reasonableness Test">Reasonableness</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Threshold %</Label>
                  <Input value={editingAnalytics.thresholdPercentage || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, thresholdPercentage: parseFloat(e.target.value) || 0 })} type="number" data-testid="input-threshold-new" />
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={() => saveAnalyticsMutation.mutate(editingAnalytics)} disabled={saveAnalyticsMutation.isPending || !editingAnalytics.procedureRef} data-testid="btn-save-analytics-new">
                    {saveAnalyticsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingAnalytics(null)}><X className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">Description</Label>
                <Textarea value={editingAnalytics.description || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, description: e.target.value })} placeholder="Describe the procedure..." rows={2} data-testid="input-description-analytics-new" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Current Year Value</Label>
                  <Input value={editingAnalytics.currentYearValue || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, currentYearValue: parseFloat(e.target.value) || 0 })} type="number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prior Year Value</Label>
                  <Input value={editingAnalytics.priorYearValue || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, priorYearValue: parseFloat(e.target.value) || 0 })} type="number" />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs">Conclusion</Label>
                <Textarea value={editingAnalytics.conclusion || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, conclusion: e.target.value })} placeholder="Conclusion..." rows={2} />
              </div>
            </div>
          )}
          {analyticsItems.length === 0 && editingAnalytics?.id !== 'new' ? (
            <div className="text-center py-6 text-muted-foreground border rounded-lg" data-testid="analytics-empty">
              <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No analytical procedures documented</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="analytics-list">
              {analyticsItems.map((ana: AnalyticalItem) => (
                <div key={ana.id} className="border rounded-md p-3" data-testid={`analytics-row-${ana.id}`}>
                  {editingAnalytics?.id === ana.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Ref</Label>
                          <Input value={editingAnalytics.procedureRef || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, procedureRef: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={editingAnalytics.analyticalType || ''} onValueChange={(v: string) => setEditingAnalytics({ ...editingAnalytics, analyticalType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="YoY Comparison">YoY</SelectItem>
                              <SelectItem value="Trend Analysis">Trend</SelectItem>
                              <SelectItem value="Ratio Analysis">Ratio</SelectItem>
                              <SelectItem value="Budget Comparison">Budget</SelectItem>
                              <SelectItem value="Reasonableness Test">Reasonableness</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Threshold %</Label>
                          <Input value={editingAnalytics.thresholdPercentage || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, thresholdPercentage: parseFloat(e.target.value) || 0 })} type="number" />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button size="sm" onClick={() => updateAnalyticsMutation.mutate(editingAnalytics)} disabled={updateAnalyticsMutation.isPending}><Save className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingAnalytics(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea value={editingAnalytics.description || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, description: e.target.value })} rows={2} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Current Year Value</Label>
                          <Input value={editingAnalytics.currentYearValue || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, currentYearValue: parseFloat(e.target.value) || 0 })} type="number" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Prior Year Value</Label>
                          <Input value={editingAnalytics.priorYearValue || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, priorYearValue: parseFloat(e.target.value) || 0 })} type="number" />
                        </div>
                      </div>
                      <div className="space-y-1 mt-3">
                        <Label className="text-xs">Conclusion</Label>
                        <Textarea value={editingAnalytics.conclusion || ''} onChange={(e) => setEditingAnalytics({ ...editingAnalytics, conclusion: e.target.value })} rows={2} placeholder="Conclusion of this analytical procedure..." />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{ana.procedureRef}</span>
                            <Badge variant="outline" className="text-xs">{ana.analyticalType}</Badge>
                            {(ana.variancePercentage !== undefined && ana.variancePercentage !== null) && (
                              <span className={`text-[10px] font-medium ${Math.abs(ana.variancePercentage) > (ana.thresholdPercentage || 10) ? 'text-amber-600' : 'text-green-600'}`}>
                                {ana.variancePercentage > 0 ? '▲' : '▼'}{Math.abs(ana.variancePercentage).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{ana.description}</p>
                        </div>
                        {ana.conclusion ? <Badge variant="default" className="text-xs">Complete</Badge> : <Badge variant="outline" className="text-xs">Pending</Badge>}
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditingAnalytics({ ...ana })} data-testid={`btn-edit-analytics-${ana.id}`}><FilePen className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (window.confirm('Delete this analytical procedure?')) deleteAnalyticsMutation.mutate(ana.id); }} data-testid={`btn-delete-analytics-${ana.id}`}><X className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                      {ana.conclusion && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground truncate">{ana.conclusion}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step4Evidence({ workingPaper, tocItems, todItems, engagementId, fsHeadKey, getStatusBadge }: any) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSufficiencyPanel, setShowSufficiencyPanel] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("evidenceType", "supporting");
        const res = await fetchWithAuth(`/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/attachments`, {
          method: "POST",
          body: formData,
          timeout: 60000,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to upload ${files[i].name}`);
        }
      }
      toast({ title: "Success", description: `${files.length} file(s) uploaded` });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'compliance-check'] });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setIsDragOver(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [engagementId, fsHeadKey, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await apiRequest("DELETE", `/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/attachments/${attachmentId}`);
      if (!res.ok) throw new Error("Failed to delete attachment");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Evidence removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads', fsHeadKey, 'compliance-check'] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to delete evidence", variant: "destructive" }); }
  });

  const aiEvidenceMutation = useMutation({
    mutationFn: async () => {
      const attachmentSummary = (workingPaper.attachments || []).map((a: FSHeadAttachment) => `${a.originalName || a.fileName} (${a.mimeType || 'unknown'})`).join(", ");
      const res = await apiRequest("POST", `/api/ai/copilot/analysis`, {
        engagementId,
        phase: "execution",
        context: `Evidence sufficiency assessment for FS Head "${fsHeadKey}".
Current evidence state:
- TOC items: ${tocItems.length} (completed: ${tocItems.filter((t: TOCItem) => t.result && t.result !== "NOT_TESTED" && t.result !== "PENDING").length})
- TOD items: ${todItems.length} (with conclusions: ${todItems.filter((t: TODItem) => t.conclusion && t.conclusion.trim().length > 0).length})
- Attachments: ${workingPaper.attachments?.length || 0} files${attachmentSummary ? ` [${attachmentSummary}]` : ""}
- Working paper status: ${workingPaper.status || "DRAFT"}
- Risk level: ${workingPaper.riskLevel || "Not assessed"}`,
        question: `Perform a structured ISA 500 evidence sufficiency and appropriateness evaluation for this FS Head. Assess:
1. SUFFICIENCY: Is the quantity of evidence adequate given the assessed risk level and procedure types?
2. APPROPRIATENESS: Consider relevance and reliability of evidence types present.
3. GAPS: Identify specific missing evidence types (e.g., external confirmations, recalculations, analytical procedures support).
4. RECOMMENDATIONS: Suggest specific additional evidence items needed.
Format your response with clear sections for each area above.`
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setShowSufficiencyPanel(true);
      toast({ title: "AI Analysis", description: "Evidence sufficiency assessment generated" });
    },
    onError: () => { toast({ title: "Error", description: "AI analysis failed", variant: "destructive" }); }
  });

  const triggerUpload = () => fileInputRef.current?.click();

  const attachmentCount = workingPaper.attachments?.length || 0;
  const requiredMinimum = Math.max(3, tocItems.length + todItems.length);
  const sufficiencyMet = attachmentCount >= requiredMinimum;
  const completedToc = tocItems.filter((t: TOCItem) => t.result && t.result !== "NOT_TESTED" && t.result !== "PENDING").length;
  const completedTod = todItems.filter((t: TODItem) => t.conclusion && t.conclusion.trim().length > 0).length;

  return (
    <div className="space-y-4" data-testid="step-4-evidence">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.csv,.txt"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
        data-testid="input-file-upload"
      />

      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
          ISA 500: Audit evidence must be sufficient (quantity) and appropriate (quality). Upload supporting documents and cross-reference to procedures.
        </AlertDescription>
      </Alert>

      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Evidence Requirements
          </h4>
          <Badge variant="outline" className="text-xs">
            {attachmentCount} / {requiredMinimum} minimum
          </Badge>
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="p-2 bg-background rounded border">
            <div className="font-medium">Sufficient</div>
            <div className="text-muted-foreground">Quantity</div>
            <Badge variant={sufficiencyMet ? "default" : "secondary"} className="mt-1">
              {sufficiencyMet ? "Met" : "Pending"}
            </Badge>
          </div>
          <div className="p-2 bg-background rounded border">
            <div className="font-medium">Appropriate</div>
            <div className="text-muted-foreground">Quality</div>
            <Badge variant="secondary" className="mt-1">Review</Badge>
          </div>
          <div className="p-2 bg-background rounded border">
            <div className="font-medium">Reliable</div>
            <div className="text-muted-foreground">Source</div>
            <Badge variant="secondary" className="mt-1">Review</Badge>
          </div>
          <div className="p-2 bg-background rounded border">
            <div className="font-medium">Relevant</div>
            <div className="text-muted-foreground">Linkage</div>
            <Badge variant="secondary" className="mt-1">Review</Badge>
          </div>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerUpload}
        data-testid="drop-zone"
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{isDragOver ? 'Drop files here' : 'Drag & drop files or click to upload'}</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOC, XLS, JPG, PNG, CSV (max 10MB each)</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Attached Evidence ({workingPaper.attachments?.length || 0})</h3>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => aiEvidenceMutation.mutate()} disabled={aiEvidenceMutation.isPending} data-testid="btn-ai-evidence">
          {aiEvidenceMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
          AI Sufficiency Check
        </Button>
      </div>

      {(workingPaper.attachments?.length || 0) === 0 ? (
        <div className="text-center py-4 text-muted-foreground" data-testid="evidence-empty">
          <p className="text-sm">No evidence attached yet. Upload supporting documents above.</p>
        </div>
      ) : (
        <Table data-testid="evidence-table">
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-20">Size</TableHead>
              <TableHead className="w-24">Reliability</TableHead>
              <TableHead className="w-28">Uploaded</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workingPaper.attachments?.map((att: FSHeadAttachment) => {
              const fileExt = (att.mimeType?.split('/').pop() || att.fileType || att.originalName?.split('.').pop() || 'file').toUpperCase();
              const sizeKB = att.fileSize / 1024;
              const sizeDisplay = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB.toFixed(1)} KB`;
              return (
                <TableRow key={att.id} data-testid={`evidence-row-${att.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                        fileExt === 'PDF' ? 'bg-red-100 text-red-700' :
                        fileExt === 'XLSX' || fileExt === 'XLS' || fileExt === 'CSV' ? 'bg-green-100 text-green-700' :
                        fileExt === 'DOCX' || fileExt === 'DOC' ? 'bg-blue-100 text-blue-700' :
                        fileExt === 'PNG' || fileExt === 'JPG' || fileExt === 'JPEG' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{fileExt.substring(0, 4)}</div>
                      <div className="min-w-0">
                        <span className="font-medium text-sm truncate block max-w-[200px]">{att.originalName || att.fileName}</span>
                        <span className="text-[10px] text-muted-foreground">{sizeDisplay}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{fileExt}</Badge></TableCell>
                  <TableCell className="text-xs">{sizeDisplay}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">External</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(att.uploadedAt || att.createdAt || '').toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => {
                        window.open(`/api/engagements/${engagementId}/fs-heads/${fsHeadKey}/attachments/${att.id}/download`, '_blank');
                      }} title="Download" data-testid={`btn-download-evidence-${att.id}`}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => {
                        if (window.confirm(`Delete "${att.originalName || att.fileName}"?`)) {
                          deleteAttachmentMutation.mutate(att.id);
                        }
                      }} title="Delete" data-testid={`btn-delete-evidence-${att.id}`}>
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {aiEvidenceMutation.isPending && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20" data-testid="ai-evidence-loading">
          <CardContent className="py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs text-muted-foreground">Analyzing evidence sufficiency against ISA 500 requirements...</p>
          </CardContent>
        </Card>
      )}

      {showSufficiencyPanel && aiEvidenceMutation.isSuccess && aiEvidenceMutation.data && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20" data-testid="ai-evidence-sufficiency-panel">
          <CardHeader className="py-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-blue-600" />
              AI Evidence Sufficiency Assessment
              <Badge variant="outline" className="text-xs">Advisory</Badge>
            </CardTitle>
            <Button size="icon" variant="ghost" onClick={() => setShowSufficiencyPanel(false)} data-testid="btn-dismiss-evidence-panel">
              <X className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="text-xs space-y-3">
            <div className="grid grid-cols-3 gap-3 p-3 bg-background rounded-lg border">
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{attachmentCount}</div>
                <div className="text-muted-foreground">Evidence Items</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{completedToc}/{tocItems.length}</div>
                <div className="text-muted-foreground">TOC Completed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{completedTod}/{todItems.length}</div>
                <div className="text-muted-foreground">TOD Completed</div>
              </div>
            </div>

            <div className="p-3 bg-background rounded-lg border space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-medium">ISA 500 Analysis</span>
              </div>
              <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {aiEvidenceMutation.data.analysis || aiEvidenceMutation.data.response || "Evidence assessment completed."}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <p className="text-muted-foreground italic">AI-assisted — subject to professional judgment</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Step5Conclusions({
  workingPaper, conclusion, setConclusion, notes, setNotes,
  saveConclusionMutation, saveNotesMutation, generateConclusionMutation,
  showConclusionForm, setShowConclusionForm, complianceChecks,
  executionContext, tocItems, todItems, analyticsItems, adjustmentItems, fsHeadName,
  engagementId, fsHeadKey
}: any) {
  const { toast } = useToast();
  const [showAiConclusionPanel, setShowAiConclusionPanel] = useState(false);

  const aiConclusionAnalysisMutation = useMutation({
    mutationFn: async () => {
      const completedToc = tocItems.filter((t: TOCItem) => t.result && t.result !== "NOT_TESTED" && t.result !== "PENDING").length;
      const completedTod = todItems.filter((t: TODItem) => t.conclusion && t.conclusion.trim().length > 0).length;
      const exceptionsInTod = todItems.filter((t: TODItem) => (t.exceptionsFound || 0) > 0).length;
      const adjustmentCount = adjustmentItems.length;
      const evidenceCount = workingPaper.attachments?.length || 0;

      const res = await apiRequest("POST", `/api/ai/copilot/analysis`, {
        engagementId: engagementId || workingPaper.engagementId,
        phase: "execution",
        context: `Conclusion drafting assistance for FS Head "${fsHeadName}" (key: ${fsHeadKey || workingPaper.fsHeadKey}).
Work performed summary:
- TOC: ${tocItems.length} total, ${completedToc} completed
- TOD: ${todItems.length} total, ${completedTod} with conclusions, ${exceptionsInTod} with exceptions
- Analytical procedures: ${analyticsItems.length}
- Adjustments identified: ${adjustmentCount}
- Evidence items: ${evidenceCount}
- Current conclusion draft: ${conclusion ? `"${conclusion.substring(0, 200)}${conclusion.length > 200 ? '...' : ''}"` : "None"}
- Working paper status: ${workingPaper.status || "DRAFT"}
- Risk level: ${workingPaper.riskLevel || "Not assessed"}
- Current year balance: ${workingPaper.currentYearBalance || "N/A"}
- Prior year balance: ${workingPaper.priorYearBalance || "N/A"}`,
        question: `As an AI audit assistant, provide a structured conclusion assessment for this FS Head. Include:
1. WORK SUMMARY: Brief summary of procedures performed and their outcomes.
2. KEY FINDINGS: Highlight any exceptions, adjustments, or areas requiring attention.
3. EVIDENCE ASSESSMENT: Whether evidence obtained is sufficient and appropriate per ISA 500.
4. SUGGESTED CONCLUSION ELEMENTS: Key points that should be included in the conclusion per ISA 230/330.
5. COMPLETENESS CHECK: Any gaps in documentation or procedures that should be addressed before finalizing.
Format clearly with sections. This is advisory only.`
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setShowAiConclusionPanel(true);
      toast({ title: "AI Analysis", description: "Conclusion assessment generated" });
    },
    onError: () => { toast({ title: "Error", description: "AI conclusion analysis failed", variant: "destructive" }); }
  });

  return (
    <div className="space-y-4" data-testid="step-5-conclusions">
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <FileCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
          ISA 230: Document the overall conclusion on audit evidence sufficiency and appropriateness. ISA 330.25-27.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="text-center p-2 rounded border bg-background">
          <div className="text-xl font-bold text-primary">{tocItems.length}</div>
          <div className="text-xs text-muted-foreground">Controls Tested</div>
          <div className="text-[10px] text-green-600">{tocItems.filter((t: TOCItem) => t.result === "EFFECTIVE").length} effective</div>
        </div>
        <div className="text-center p-2 rounded border bg-background">
          <div className="text-xl font-bold text-primary">{todItems.length}</div>
          <div className="text-xs text-muted-foreground">Details Tested</div>
          <div className="text-[10px]">
            <span className="text-green-600">{todItems.filter((t: TODItem) => t.result === "SATISFACTORY").length} pass</span>
            {todItems.filter((t: TODItem) => (t.exceptionsFound || 0) > 0).length > 0 && (
              <span className="text-amber-600 ml-1">• {todItems.filter((t: TODItem) => (t.exceptionsFound || 0) > 0).length} exc</span>
            )}
          </div>
        </div>
        <div className="text-center p-2 rounded border bg-background">
          <div className="text-xl font-bold text-primary">{analyticsItems.length}</div>
          <div className="text-xs text-muted-foreground">Analytics</div>
          <div className="text-[10px] text-green-600">{analyticsItems.filter((a: AnalyticalItem) => a.conclusion).length} concluded</div>
        </div>
        <div className="text-center p-2 rounded border bg-background">
          <div className="text-xl font-bold text-primary">{workingPaper.attachments?.length || 0}</div>
          <div className="text-xs text-muted-foreground">Evidence Items</div>
          <div className="text-[10px] text-muted-foreground">{adjustmentItems.length} adjustments</div>
        </div>
      </div>

      {executionContext?.completion && (
        <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg text-xs">
          <span className="text-muted-foreground">Overall Completion:</span>
          <Progress value={executionContext.completion.overallPercent || 0} className="flex-1 h-2" />
          <span className="font-semibold">{executionContext.completion.overallPercent || 0}%</span>
          {executionContext.completion.overallPercent === 100 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
        </div>
      )}

      {complianceChecks && (
        <div className="border rounded-lg p-3">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            ISA Compliance Checklist
          </h4>
          <div className="space-y-1">
            {complianceChecks.checks?.map((check: any) => (
              <div key={check.id} className="flex items-center gap-2 text-xs">
                {check.pass ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className="flex-1">{check.name}</span>
                <Badge variant="outline" className="text-xs">{check.isaRef}</Badge>
                <Badge variant={check.pass ? "default" : "secondary"} className="text-xs">{check.pass ? "Pass" : "Pending"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label htmlFor="conclusion-text" className="text-sm font-medium">Conclusion</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => aiConclusionAnalysisMutation.mutate()}
              disabled={aiConclusionAnalysisMutation.isPending}
              data-testid="btn-ai-conclusion-analysis"
            >
              {aiConclusionAnalysisMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
              AI Analyze
            </Button>
            <Dialog open={showConclusionForm} onOpenChange={setShowConclusionForm}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1" data-testid="btn-structured-conclusion">
                  <FileCheck className="h-3 w-3" />
                  Structured Form
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Document Conclusion</DialogTitle></DialogHeader>
                <ConclusionForm
                  onSave={(data: any) => {
                    setConclusion(data.conclusion);
                    saveConclusionMutation.mutate(data);
                  }}
                  onCancel={() => setShowConclusionForm(false)}
                  initialConclusion={conclusion}
                  fsHeadName={fsHeadName}
                  workSummary={{
                    tocCount: tocItems.length,
                    todCount: todItems.length,
                    analyticsCount: analyticsItems.length,
                    adjustmentCount: adjustmentItems.length,
                    evidenceCount: workingPaper.attachments?.length || 0
                  }}
                />
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => generateConclusionMutation.mutate()}
              disabled={generateConclusionMutation.isPending}
              data-testid="btn-generate-conclusion"
            >
              {generateConclusionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              AI Draft
            </Button>
          </div>
        </div>
        <Textarea
          id="conclusion-text"
          placeholder="Enter the overall conclusion for this FS Head..."
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          className="min-h-[150px]"
          data-testid="input-conclusion"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => saveConclusionMutation.mutate({ conclusion, completionStatus: 'draft' })}
            disabled={saveConclusionMutation.isPending}
            data-testid="btn-save-conclusion"
          >
            {saveConclusionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Save Conclusion
          </Button>
        </div>
      </div>

      {aiConclusionAnalysisMutation.isPending && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20" data-testid="ai-conclusion-loading">
          <CardContent className="py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs text-muted-foreground">Analyzing work performed and drafting conclusion guidance...</p>
          </CardContent>
        </Card>
      )}

      {showAiConclusionPanel && aiConclusionAnalysisMutation.isSuccess && aiConclusionAnalysisMutation.data && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20" data-testid="ai-conclusion-draft-panel">
          <CardHeader className="py-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-blue-600" />
              AI Conclusion Assessment
              <Badge variant="outline" className="text-xs">Advisory</Badge>
            </CardTitle>
            <Button size="icon" variant="ghost" onClick={() => setShowAiConclusionPanel(false)} data-testid="btn-dismiss-conclusion-panel">
              <X className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="text-xs space-y-3">
            <div className="p-3 bg-background rounded-lg border space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <FileCheck className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-medium">ISA 230/330 Conclusion Guidance</span>
              </div>
              <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {aiConclusionAnalysisMutation.data.analysis || aiConclusionAnalysisMutation.data.response || "Conclusion analysis completed."}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <p className="text-muted-foreground italic">AI-assisted — subject to professional judgment</p>
            </div>
          </CardContent>
        </Card>
      )}

      {generateConclusionMutation.isSuccess && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20" data-testid="ai-conclusion-generated-notice">
          <CardContent className="p-3 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span className="text-green-700 dark:text-green-300">AI-generated conclusion draft applied above. Review, edit, and save.</span>
            <span className="text-muted-foreground italic ml-auto">AI-assisted — subject to professional judgment</span>
          </CardContent>
        </Card>
      )}

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Working Notes</Label>
          <span className="text-xs text-muted-foreground">{notes.length} characters</span>
        </div>
        <Textarea
          placeholder="Enter working notes, observations..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[120px] font-mono text-sm"
          data-testid="input-notes"
        />
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => saveNotesMutation.mutate()}
            disabled={saveNotesMutation.isPending}
            data-testid="btn-save-notes"
          >
            {saveNotesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save Notes
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step6Review({
  workingPaper, complianceChecks, handleSignOff, statusTransitionMutation,
  addReviewPointMutation, resolveReviewPointMutation, newReviewPoint, setNewReviewPoint,
  newReviewSeverity, setNewReviewSeverity,
  hasProcedures, hasEvidence, hasConclusion, riskAreas, executionContext, getStatusBadge
}: any) {
  const risksAddressed = riskAreas.length === 0 || riskAreas.every((r: RiskArea) => r.status === "MITIGATED" || r.status === "ADDRESSED");
  const allReviewPointsResolved = !workingPaper.reviewPoints?.length || workingPaper.reviewPoints.every((rp: FSHeadReviewPoint) => rp.status === "RESOLVED" || rp.status === "CLOSED");
  const ctx = executionContext || {};
  const completion = ctx.completion || {};
  const flags = ctx.planningFlags || {};

  const gates = [
    { label: "Context & Data Loaded", done: completion.contextComplete ?? true, weight: "10%", isa: "ISA 230" },
    { label: "Assertions Confirmed", done: completion.assertionsComplete ?? false, weight: "15%", isa: "ISA 315" },
    { label: "Procedures Performed", done: completion.proceduresComplete ?? hasProcedures, weight: "30%", isa: "ISA 330" },
    { label: "Evidence Sufficient & Appropriate", done: completion.evidenceComplete ?? hasEvidence, weight: "20%", isa: "ISA 500" },
    { label: "Conclusion Documented", done: completion.conclusionComplete ?? hasConclusion, weight: "15%", isa: "ISA 230" },
    { label: "Review Approved", done: completion.reviewComplete ?? false, weight: "10%", isa: "ISQM-1" },
  ];
  const gatesPassed = gates.filter(g => g.done).length;

  return (
    <div className="space-y-4" data-testid="step-6-review">
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <UserCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
          Review and sign-off workflow: Draft → Prepared → Reviewed → Approved. Each transition is audit-trail logged per ISQM-1.
        </AlertDescription>
      </Alert>

      {completion.overallPercent !== undefined && (
        <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg text-xs">
          <span className="text-muted-foreground">Completion:</span>
          <Progress value={completion.overallPercent} className="flex-1 h-2" />
          <span className="font-semibold">{completion.overallPercent}%</span>
          <Badge variant={gatesPassed === gates.length ? "default" : "secondary"} className="text-[9px]">{gatesPassed}/{gates.length} gates</Badge>
        </div>
      )}

      <div className="border rounded-lg p-4 bg-muted/20">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Completion Gates (Weighted)
        </h4>
        <div className="space-y-2">
          {gates.map((gate, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {gate.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
              )}
              <span className={gate.done ? "text-foreground flex-1" : "text-muted-foreground flex-1"}>{gate.label}</span>
              <Badge variant="outline" className="text-[9px] h-4">{gate.isa}</Badge>
              <span className="text-muted-foreground w-8 text-right">{gate.weight}</span>
            </div>
          ))}
        </div>
        {(flags.hasFraudRisk || flags.hasSignificantRisk) && (
          <div className="mt-2 pt-2 border-t flex gap-2 text-xs">
            {flags.hasFraudRisk && <Badge variant="destructive" className="text-[9px]">ISA 240 Fraud procedures required</Badge>}
            {flags.hasSignificantRisk && <Badge variant="secondary" className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200">Significant risk — enhanced review</Badge>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2 p-2 rounded border bg-background">
          {risksAddressed ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          <span>All risks addressed</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded border bg-background">
          {allReviewPointsResolved ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          <span>Review points resolved ({workingPaper.reviewPoints?.filter((rp: FSHeadReviewPoint) => rp.status === "RESOLVED" || rp.status === "CLOSED").length || 0}/{workingPaper.reviewPoints?.length || 0})</span>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Review Points
          </h4>
          <Badge variant="outline">{workingPaper.reviewPoints?.length || 0} points</Badge>
        </div>

        <div className="flex gap-2 mb-3">
          <Input
            value={newReviewPoint}
            onChange={(e) => setNewReviewPoint(e.target.value)}
            placeholder="Add a review point or comment..."
            className="flex-1 text-sm"
            data-testid="input-review-point"
          />
          <Select value={newReviewSeverity} onValueChange={setNewReviewSeverity}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => addReviewPointMutation.mutate({ description: newReviewPoint, severity: newReviewSeverity })}
            disabled={addReviewPointMutation.isPending || !newReviewPoint.trim()}
            data-testid="btn-add-review-point"
          >
            {addReviewPointMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>

        {(workingPaper.reviewPoints?.length || 0) === 0 ? (
          <div className="text-center py-4 text-muted-foreground border rounded-lg border-dashed">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No review points raised</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="review-points-list">
            {workingPaper.reviewPoints?.map((rp: FSHeadReviewPoint) => (
              <div key={rp.id} className={`border rounded-lg p-3 ${rp.status === 'RESOLVED' || rp.status === 'CLOSED' ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200' : 'bg-background'}`} data-testid={`review-point-${rp.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(rp.severity)}
                      {getStatusBadge(rp.status)}
                    </div>
                    <p className="text-sm">{rp.description}</p>
                    {rp.response && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Response: </span>{rp.response}
                      </div>
                    )}
                  </div>
                  {rp.status !== 'RESOLVED' && rp.status !== 'CLOSED' && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => {
                        const response = window.prompt('Enter response to this review point:');
                        if (response) {
                          resolveReviewPointMutation.mutate({ id: rp.id, status: 'RESOLVED', response });
                        }
                      }} data-testid={`btn-resolve-rp-${rp.id}`}>
                        <CheckCircle2 className="h-3 w-3" />
                        Resolve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Sign-Off Workflow
        </h4>
        <div className="flex items-center gap-4 mb-4">
          {["DRAFT", "PREPARED", "REVIEWED", "APPROVED"].map((status, idx) => {
            const isCurrent = workingPaper.status === status;
            const isPast = ["DRAFT", "PREPARED", "REVIEWED", "APPROVED"].indexOf(workingPaper.status) > idx;
            return (
              <div key={status} className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCurrent ? "bg-primary text-primary-foreground" : isPast ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}>
                  {isPast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span className={`text-xs ${isCurrent ? "font-semibold" : "text-muted-foreground"}`}>{status}</span>
                {idx < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs mb-4">
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-medium">Prepared By</div>
            <div className="text-muted-foreground">{workingPaper.preparedByName || "—"}</div>
            {workingPaper.preparedAt && <div className="text-muted-foreground">{new Date(workingPaper.preparedAt).toLocaleDateString()}</div>}
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-medium">Reviewed By</div>
            <div className="text-muted-foreground">{workingPaper.reviewedByName || "—"}</div>
            {workingPaper.reviewedAt && <div className="text-muted-foreground">{new Date(workingPaper.reviewedAt).toLocaleDateString()}</div>}
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="font-medium">Approved By</div>
            <div className="text-muted-foreground">{workingPaper.approvedByName || "—"}</div>
            {workingPaper.approvedAt && <div className="text-muted-foreground">{new Date(workingPaper.approvedAt).toLocaleDateString()}</div>}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          {workingPaper.status === "PREPARED" && (
            <Button size="sm" variant="outline" className="gap-1 text-amber-600 hover:text-amber-700" onClick={() => statusTransitionMutation.mutate("IN_PROGRESS")} disabled={statusTransitionMutation.isPending} data-testid="btn-return">
              {statusTransitionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Return for Rework
            </Button>
          )}
          {workingPaper.status === "REVIEWED" && (
            <Button size="sm" variant="outline" className="gap-1 text-amber-600 hover:text-amber-700" onClick={() => statusTransitionMutation.mutate("PREPARED")} disabled={statusTransitionMutation.isPending} data-testid="btn-return-reviewed">
              {statusTransitionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Return for Rework
            </Button>
          )}
          {workingPaper.status === "DRAFT" && (
            <Button size="sm" onClick={() => statusTransitionMutation.mutate("PREPARED")} disabled={statusTransitionMutation.isPending} data-testid="btn-prepare">
              {statusTransitionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Mark as Prepared
            </Button>
          )}
          {workingPaper.status === "PREPARED" && (
            <Button size="sm" onClick={() => statusTransitionMutation.mutate("REVIEWED")} disabled={statusTransitionMutation.isPending} data-testid="btn-review">
              {statusTransitionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Mark as Reviewed
            </Button>
          )}
          {workingPaper.status === "REVIEWED" && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => statusTransitionMutation.mutate("APPROVED")} disabled={statusTransitionMutation.isPending} data-testid="btn-approve">
              {statusTransitionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Approve Working Paper
            </Button>
          )}
          {workingPaper.status === "IN_PROGRESS" && (
            <Button size="sm" onClick={() => statusTransitionMutation.mutate("PREPARED")} disabled={statusTransitionMutation.isPending} data-testid="btn-prepare-from-progress">
              {statusTransitionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Mark as Prepared
            </Button>
          )}
          {workingPaper.status === "APPROVED" && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Working Paper Approved
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FSHeadsPage() {
  const params = useParams<{ engagementId: string }>();
  const engagementId = params.engagementId || "";
  const { engagement, client } = useEngagement();
  const { isReadOnly: fsHeadsReadOnly } = useModuleReadOnly("EXECUTION", "FS_HEADS");
  const contentSaveRef = useRef<{ save: () => Promise<boolean>; isDirty: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (contentSaveRef.current?.isDirty) {
      setIsSaving(true);
      try {
        const ok = await contentSaveRef.current.save();
        return { ok };
      } finally {
        setIsSaving(false);
      }
    }
    return { ok: true };
  }, []);

  return (
    <PageShell
      title="FS Heads Execution Wizard"
      subtitle={`${client?.name || "Engagement"} - ${engagement?.engagementCode || ""}`}
      icon={<Layers className="h-5 w-5 text-primary" />}
      backHref={`/workspace/${engagementId}/execution`}
      dashboardHref="/engagements"
      saveFn={handleSave}
      hasUnsavedChanges={contentSaveRef.current?.isDirty || false}
      isSaving={isSaving}
      showBack={true}
      showSaveProgress={true}
      showSaveNext={false}
      showSaveClose={true}
      signoffPhase="EXECUTION"
      signoffSection="FS_HEADS"
      readOnly={fsHeadsReadOnly}
    >
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <FSHeadsContent engagementId={engagementId} saveRef={contentSaveRef} />
      </div>

      {engagementId && (
        <AICopilotToggle
          engagementId={engagementId}
          auditPhase="execution"
        />
      )}
    </PageShell>
  );
}
