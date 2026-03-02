import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  TrendingUp,
  BarChart3,
  FileText,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  Calculator,
  Database,
  ArrowUpDown,
  Target,
  Search,
} from "lucide-react";
import { QAFormChecklist, type ChecklistItem, type ChecklistSection } from "@/components/compliance-checklist";
import { EvidenceUploader, type EvidenceFile } from "@/components/evidence-uploader";
import type {
  AnalyticsOpeningBalancesData,
  AnalyticalProcedureEntry,
  TrendAnalysisEntry,
  BudgetVsActualEntry,
  UnusualFluctuationEntry,
  CustomRatio,
} from "./types";

export interface AnalyticsOpeningSectionProps {
  engagementId: string;
  data: AnalyticsOpeningBalancesData;
  onChange: (data: AnalyticsOpeningBalancesData) => void;
  onAIGenerate?: (field: string) => void;
  currentUser?: string;
  readOnly?: boolean;
}

const FormSection = ({
  icon,
  title,
  description,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Card className={`overflow-hidden ${className}`}>
    <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          {icon}
        </div>
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-6 space-y-6">
      {children}
    </CardContent>
  </Card>
);

const SectionDivider = ({ title, icon }: { title: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-3 pt-4 pb-2">
    {icon && <span className="text-muted-foreground">{icon}</span>}
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    <div className="flex-1 h-px bg-border/60" />
  </div>
);

const FormField = ({
  label,
  source,
  required,
  children,
  helperText,
  className = "",
}: {
  label: string;
  source?: "engagement" | "client" | "auto" | "tb";
  required?: boolean;
  children: React.ReactNode;
  helperText?: string;
  className?: string;
}) => (
  <div className={`space-y-2 ${className}`}>
    <Label className="flex items-center gap-2 text-sm font-medium">
      {label}
      {required && <span className="text-destructive">*</span>}
      {source === "auto" && (
        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
          Auto
        </Badge>
      )}
      {source === "tb" && (
        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800">
          From TB
        </Badge>
      )}
    </Label>
    {children}
    {helperText && (
      <p className="text-xs text-muted-foreground">{helperText}</p>
    )}
  </div>
);

const FormRow = ({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) => (
  <div className={`grid gap-4 ${cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
    {children}
  </div>
);

const AIButton = ({
  onClick,
  label = "AI Auto-Fill",
  disabled,
  testId,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  testId: string;
}) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onClick}
    disabled={disabled}
    className="gap-1.5 text-xs"
    data-testid={testId}
  >
    <Sparkles className="h-3 w-3" />
    {label}
  </Button>
);

function AIAutoFillButton({ field, onAIAutoFill, disabled }: { field: string; onAIAutoFill?: (field: string) => void; disabled?: boolean }) {
  if (!onAIAutoFill) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onAIAutoFill(field)}
      disabled={disabled}
      className="flex-shrink-0"
      data-testid={`button-ai-autofill-${field}`}
    >
      <Sparkles className="h-4 w-4 text-primary" />
    </Button>
  );
}

const RISK_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const INVESTIGATION_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "investigated", label: "Investigated" },
  { value: "resolved", label: "Resolved" },
];

const RECONCILIATION_STATUS_OPTIONS = [
  { value: "reconciled", label: "Reconciled" },
  { value: "unreconciled", label: "Unreconciled" },
  { value: "not_applicable", label: "Not Applicable" },
];

const OPINION_TYPE_OPTIONS = [
  { value: "unmodified", label: "Unmodified" },
  { value: "qualified", label: "Qualified" },
  { value: "adverse", label: "Adverse" },
  { value: "disclaimer", label: "Disclaimer of Opinion" },
  { value: "not_applicable", label: "Not Applicable (First Year)" },
];

const ROLLFORWARD_APPROACH_OPTIONS = [
  { value: "full_rollforward", label: "Full Roll-Forward" },
  { value: "selective_rollforward", label: "Selective Roll-Forward" },
  { value: "fresh_start", label: "Fresh Start / Re-audit" },
];

const PREDECESSOR_ACCESS_OPTIONS = [
  { value: "full_access", label: "Full Access Granted" },
  { value: "limited_access", label: "Limited Access" },
  { value: "no_access", label: "No Access" },
  { value: "not_applicable", label: "Not Applicable" },
];

const YES_NO_PROGRESS_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "in_progress", label: "In Progress" },
];

function getDefaultOpeningBalancesChecklist(): ChecklistSection {
  return {
    id: "isa-510-checklist",
    title: "ISA 510 Opening Balances Checklist",
    description: "Required procedures for opening balances review",
    items: [
      { id: "ob-1", itemCode: "OB-01", requirement: "Obtained sufficient appropriate audit evidence about opening balances (ISA 510.6)", isaReference: "ISA 510.6", status: "", evidenceIds: [], remarks: "" },
      { id: "ob-2", itemCode: "OB-02", requirement: "Determined whether accounting policies reflected in opening balances are consistently applied (ISA 510.6b)", isaReference: "ISA 510.6b", status: "", evidenceIds: [], remarks: "" },
      { id: "ob-3", itemCode: "OB-03", requirement: "Reviewed prior period auditor's working papers for evidence of opening balances (ISA 510.7a)", isaReference: "ISA 510.7a", status: "", evidenceIds: [], remarks: "" },
      { id: "ob-4", itemCode: "OB-04", requirement: "Evaluated whether audit procedures performed in the current period provide evidence about opening balances (ISA 510.7b)", isaReference: "ISA 510.7b", status: "", evidenceIds: [], remarks: "" },
      { id: "ob-5", itemCode: "OB-05", requirement: "Performed specific audit procedures to obtain evidence regarding opening balances where required (ISA 510.7c)", isaReference: "ISA 510.7c", status: "", evidenceIds: [], remarks: "" },
      { id: "ob-6", itemCode: "OB-06", requirement: "Assessed whether opening balances contain misstatements that materially affect current period (ISA 510.8)", isaReference: "ISA 510.8", status: "", evidenceIds: [], remarks: "" },
      { id: "ob-7", itemCode: "OB-07", requirement: "Considered effect on auditor's report if unable to obtain sufficient evidence for opening balances (ISA 510.10)", isaReference: "ISA 510.10", status: "", evidenceIds: [], remarks: "" },
    ],
  };
}

export function getDefaultAnalyticsOpeningBalancesData(engagementId: string): AnalyticsOpeningBalancesData {
  return {
    engagementId,
    openingBalancesReview: {
      checklist: getDefaultOpeningBalancesChecklist(),
      priorYearOpinion: {
        opinionType: "",
        priorAuditorFirm: "",
        priorPeriodEnd: "",
        keyAuditMatters: "",
        modificationsOrEmphasis: "",
        impactOnCurrentPeriod: "",
      },
      rollForwardStrategy: {
        approach: "",
        areasForRollForward: "",
        adjustmentsRequired: "",
        accountingPolicyChanges: "",
        closingToOpeningReconciled: "",
        reconciliationNotes: "",
      },
      firstYearProcedures: {
        isFirstYearEngagement: false,
        predecessorAccess: "",
        predecessorCommunication: "",
        alternativeProcedures: "",
        sufficientEvidenceObtained: "",
        reportImpact: "",
      },
      priorAuditorReview: "",
      openingTBReconciliationStatus: "",
      reconciliationNotes: "",
      evidenceFiles: [],
    },
    trendAnalysis: {
      items: [],
      trendConclusion: "",
    },
    ratioAnalysis: {
      standardRatios: {
        currentRatio: null,
        debtToEquity: null,
        grossMargin: null,
        revenueGrowth: null,
        returnOnAssets: null,
      },
      customRatios: [],
      ratioConclusion: "",
    },
    budgetVsActual: {
      items: [],
      budgetConclusion: "",
    },
    unusualFluctuations: {
      items: [],
      fluctuationThreshold: "10",
      overallAssessment: "",
    },
    analyticalProcedures: [],
    dataSources: "",
    overallConclusion: "",
    signOff: {
      preparedBy: "",
      preparedDate: "",
      reviewedBy: "",
      reviewedDate: "",
      status: "DRAFT",
    },
  };
}

const formatNumber = (val: number | null): string => {
  if (val === null || val === undefined) return "";
  return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatRatio = (val: number | null): string => {
  if (val === null || val === undefined) return "—";
  return val.toFixed(2);
};

export function AnalyticsOpeningSection({
  engagementId,
  data,
  onChange,
  onAIGenerate,
  currentUser = "Current User",
  readOnly = false,
}: AnalyticsOpeningSectionProps) {
  const defaults = getDefaultAnalyticsOpeningBalancesData("");
  const trendAnalysis = data.trendAnalysis || defaults.trendAnalysis;
  const ratioAnalysis = data.ratioAnalysis || defaults.ratioAnalysis;
  const budgetVsActual = data.budgetVsActual || defaults.budgetVsActual;
  const unusualFluctuations = data.unusualFluctuations || defaults.unusualFluctuations;
  const standardRatios = ratioAnalysis.standardRatios || defaults.ratioAnalysis.standardRatios;
  const priorYearOpinion = data.openingBalancesReview.priorYearOpinion || defaults.openingBalancesReview.priorYearOpinion;
  const rollForwardStrategy = data.openingBalancesReview.rollForwardStrategy || defaults.openingBalancesReview.rollForwardStrategy;
  const firstYearProcedures = data.openingBalancesReview.firstYearProcedures || defaults.openingBalancesReview.firstYearProcedures;

  const updatePriorYearOpinion = (field: string, value: unknown) => {
    onChange({
      ...data,
      openingBalancesReview: {
        ...data.openingBalancesReview,
        priorYearOpinion: { ...priorYearOpinion, [field]: value },
      },
    });
  };

  const updateRollForwardStrategy = (field: string, value: unknown) => {
    onChange({
      ...data,
      openingBalancesReview: {
        ...data.openingBalancesReview,
        rollForwardStrategy: { ...rollForwardStrategy, [field]: value },
      },
    });
  };

  const updateFirstYearProcedures = (field: string, value: unknown) => {
    onChange({
      ...data,
      openingBalancesReview: {
        ...data.openingBalancesReview,
        firstYearProcedures: { ...firstYearProcedures, [field]: value },
      },
    });
  };

  const handleChecklistUpdate = (itemId: string, field: keyof ChecklistItem, value: unknown) => {
    const updatedChecklist: ChecklistSection = {
      ...data.openingBalancesReview.checklist,
      items: data.openingBalancesReview.checklist.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    };
    onChange({
      ...data,
      openingBalancesReview: { ...data.openingBalancesReview, checklist: updatedChecklist },
    });
  };

  const handleEvidenceUpload = (files: FileList, tags: string[]) => {
    const newFiles: EvidenceFile[] = Array.from(files).map((file, idx) => ({
      id: `ev-${Date.now()}-${idx}`,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedBy: currentUser,
      uploadedDate: new Date().toISOString().split("T")[0],
      phase: "pre-planning",
      section: "opening-balances",
      tags,
    }));
    onChange({
      ...data,
      openingBalancesReview: {
        ...data.openingBalancesReview,
        evidenceFiles: [...data.openingBalancesReview.evidenceFiles, ...newFiles],
      },
    });
  };

  const handleEvidenceDelete = (fileId: string) => {
    onChange({
      ...data,
      openingBalancesReview: {
        ...data.openingBalancesReview,
        evidenceFiles: data.openingBalancesReview.evidenceFiles.filter((f) => f.id !== fileId),
      },
    });
  };

  const addTrendItem = () => {
    const item: TrendAnalysisEntry = {
      id: `trend-${Date.now()}`,
      lineItem: "",
      currentYear: null,
      priorYear: null,
      changeAmount: null,
      changePercent: null,
      significanceFlag: false,
      explanation: "",
    };
    onChange({ ...data, trendAnalysis: { ...trendAnalysis, items: [...trendAnalysis.items, item] } });
  };

  const updateTrendItem = (id: string, field: keyof TrendAnalysisEntry, value: unknown) => {
    const items = trendAnalysis.items.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, [field]: value };
      if (field === "currentYear" || field === "priorYear") {
        const cy = field === "currentYear" ? (value as number | null) : updated.currentYear;
        const py = field === "priorYear" ? (value as number | null) : updated.priorYear;
        if (cy !== null && py !== null) {
          updated.changeAmount = cy - py;
          updated.changePercent = py !== 0 ? ((cy - py) / Math.abs(py)) * 100 : null;
        }
      }
      return updated;
    });
    onChange({ ...data, trendAnalysis: { ...trendAnalysis, items } });
  };

  const deleteTrendItem = (id: string) => {
    onChange({ ...data, trendAnalysis: { ...trendAnalysis, items: trendAnalysis.items.filter((t) => t.id !== id) } });
  };

  const addBudgetItem = () => {
    const item: BudgetVsActualEntry = {
      id: `bva-${Date.now()}`,
      lineItem: "",
      budgetAmount: null,
      actualAmount: null,
      varianceAmount: null,
      variancePercent: null,
      significanceFlag: false,
      explanation: "",
    };
    onChange({ ...data, budgetVsActual: { ...budgetVsActual, items: [...budgetVsActual.items, item] } });
  };

  const updateBudgetItem = (id: string, field: keyof BudgetVsActualEntry, value: unknown) => {
    const items = budgetVsActual.items.map((b) => {
      if (b.id !== id) return b;
      const updated = { ...b, [field]: value };
      if (field === "budgetAmount" || field === "actualAmount") {
        const budget = field === "budgetAmount" ? (value as number | null) : updated.budgetAmount;
        const actual = field === "actualAmount" ? (value as number | null) : updated.actualAmount;
        if (budget !== null && actual !== null) {
          updated.varianceAmount = actual - budget;
          updated.variancePercent = budget !== 0 ? ((actual - budget) / Math.abs(budget)) * 100 : null;
        }
      }
      return updated;
    });
    onChange({ ...data, budgetVsActual: { ...budgetVsActual, items } });
  };

  const deleteBudgetItem = (id: string) => {
    onChange({ ...data, budgetVsActual: { ...budgetVsActual, items: budgetVsActual.items.filter((b) => b.id !== id) } });
  };

  const addFluctuation = () => {
    const item: UnusualFluctuationEntry = {
      id: `fluc-${Date.now()}`,
      account: "",
      description: "",
      amount: null,
      percentChange: null,
      riskImplication: "",
      investigationStatus: "",
      investigationNotes: "",
    };
    onChange({ ...data, unusualFluctuations: { ...unusualFluctuations, items: [...unusualFluctuations.items, item] } });
  };

  const updateFluctuation = (id: string, field: keyof UnusualFluctuationEntry, value: unknown) => {
    const items = unusualFluctuations.items.map((f) =>
      f.id === id ? { ...f, [field]: value } : f
    );
    onChange({ ...data, unusualFluctuations: { ...unusualFluctuations, items } });
  };

  const deleteFluctuation = (id: string) => {
    onChange({ ...data, unusualFluctuations: { ...unusualFluctuations, items: unusualFluctuations.items.filter((f) => f.id !== id) } });
  };

  const handleAddCustomRatio = () => {
    const newRatio: CustomRatio = { id: `cr-${Date.now()}`, name: "", value: null, priorYear: null, industryBenchmark: null };
    onChange({ ...data, ratioAnalysis: { ...ratioAnalysis, customRatios: [...ratioAnalysis.customRatios, newRatio] } });
  };

  const handleUpdateCustomRatio = (id: string, field: keyof CustomRatio, value: unknown) => {
    onChange({
      ...data,
      ratioAnalysis: {
        ...ratioAnalysis,
        customRatios: ratioAnalysis.customRatios.map((r) => r.id === id ? { ...r, [field]: value } : r),
      },
    });
  };

  const handleDeleteCustomRatio = (id: string) => {
    onChange({
      ...data,
      ratioAnalysis: { ...ratioAnalysis, customRatios: ratioAnalysis.customRatios.filter((r) => r.id !== id) },
    });
  };

  const handleStandardRatioChange = (field: keyof typeof standardRatios, value: number | null) => {
    onChange({
      ...data,
      ratioAnalysis: {
        ...ratioAnalysis,
        standardRatios: { ...standardRatios, [field]: value },
      },
    });
  };

  const significantTrends = trendAnalysis.items.filter((t) => t.significanceFlag).length;
  const significantBudgetVars = budgetVsActual.items.filter((b) => b.significanceFlag).length;
  const openFluctuations = unusualFluctuations.items.filter((f) => f.investigationStatus !== "resolved").length;

  return (
    <div className="space-y-6">
      {/* Opening Balances Review (ISA 510) */}
      <FormSection
        icon={<BookOpen className="h-5 w-5" />}
        title="Opening Balances — ISA 510"
        description="ISA 510.6 — Obtain sufficient appropriate audit evidence about whether opening balances contain misstatements that materially affect the current period's financial statements, and whether appropriate accounting policies are consistently applied."
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-sm font-semibold text-foreground">Audit Procedures Checklist</h4>
          {!readOnly && onAIGenerate && (
            <AIButton onClick={() => onAIGenerate("opening_balances_checklist")} label="AI Suggest Status" testId="button-ai-opening-checklist" />
          )}
        </div>

        <QAFormChecklist
          section={data.openingBalancesReview.checklist}
          onUpdateItem={handleChecklistUpdate}
          readOnly={readOnly}
        />

        {/* Sub-section 1: Prior Year Opinion Review */}
        <SectionDivider title="Prior Year Opinion Review" icon={<FileText className="h-4 w-4" />} />

        <FormRow cols={3}>
          <FormField label="Prior Auditor Firm">
            <Input
              value={priorYearOpinion.priorAuditorFirm}
              onChange={(e) => updatePriorYearOpinion("priorAuditorFirm", e.target.value)}
              placeholder="Name of predecessor audit firm"
              disabled={readOnly}
              data-testid="input-prior-auditor-firm"
            />
          </FormField>
          <FormField label="Prior Period End Date">
            <Input
              type="date"
              value={priorYearOpinion.priorPeriodEnd}
              onChange={(e) => updatePriorYearOpinion("priorPeriodEnd", e.target.value)}
              disabled={readOnly}
              data-testid="input-prior-period-end"
            />
          </FormField>
          <FormField label="Opinion Type" required>
            <Select
              value={priorYearOpinion.opinionType}
              onValueChange={(v) => updatePriorYearOpinion("opinionType", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-opinion-type">
                <SelectValue placeholder="Select opinion type" />
              </SelectTrigger>
              <SelectContent>
                {OPINION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormRow>

        <div className="flex items-end gap-2">
          <FormField label="Key Audit Matters / Emphasis of Matter" className="flex-1 min-w-0">
            <Textarea
              value={priorYearOpinion.keyAuditMatters}
              onChange={(e) => updatePriorYearOpinion("keyAuditMatters", e.target.value)}
              placeholder="List any key audit matters, emphasis of matter, or other matter paragraphs from the prior period report..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-key-audit-matters"
            />
          </FormField>
          <AIAutoFillButton field="prior_year_kam" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>

        {(priorYearOpinion.opinionType === "qualified" || priorYearOpinion.opinionType === "adverse" || priorYearOpinion.opinionType === "disclaimer") && (
          <div className="flex items-end gap-2">
            <FormField label="Modifications / Basis for Modified Opinion" className="flex-1 min-w-0">
              <Textarea
                value={priorYearOpinion.modificationsOrEmphasis}
                onChange={(e) => updatePriorYearOpinion("modificationsOrEmphasis", e.target.value)}
                placeholder="Detail the basis for modification and specific matters giving rise to the qualified/adverse/disclaimer opinion..."
                className="min-h-[60px]"
                disabled={readOnly}
                data-testid="textarea-modifications-emphasis"
              />
            </FormField>
            <AIAutoFillButton field="prior_year_modifications" onAIAutoFill={onAIGenerate} disabled={readOnly} />
          </div>
        )}

        <div className="flex items-end gap-2">
          <FormField label="Impact on Current Period Audit" className="flex-1 min-w-0">
            <Textarea
              value={priorYearOpinion.impactOnCurrentPeriod}
              onChange={(e) => updatePriorYearOpinion("impactOnCurrentPeriod", e.target.value)}
              placeholder="Assess how the prior year opinion affects the current period audit approach, opening balances, and planned procedures..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-impact-current-period"
            />
          </FormField>
          <AIAutoFillButton field="prior_year_impact" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>

        {/* Sub-section 2: Roll-Forward Strategy */}
        <SectionDivider title="Roll-Forward Strategy" icon={<ArrowUpDown className="h-4 w-4" />} />

        <FormRow cols={2}>
          <FormField label="Roll-Forward Approach" required>
            <Select
              value={rollForwardStrategy.approach}
              onValueChange={(v) => updateRollForwardStrategy("approach", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-rollforward-approach">
                <SelectValue placeholder="Select approach" />
              </SelectTrigger>
              <SelectContent>
                {ROLLFORWARD_APPROACH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Closing-to-Opening Reconciled?" required>
            <Select
              value={rollForwardStrategy.closingToOpeningReconciled}
              onValueChange={(v) => updateRollForwardStrategy("closingToOpeningReconciled", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-closing-opening-reconciled">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {YES_NO_PROGRESS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormRow>

        <div className="flex items-end gap-2">
          <FormField label="Areas Selected for Roll-Forward" className="flex-1 min-w-0">
            <Textarea
              value={rollForwardStrategy.areasForRollForward}
              onChange={(e) => updateRollForwardStrategy("areasForRollForward", e.target.value)}
              placeholder="Identify specific financial statement areas/accounts selected for roll-forward (e.g., fixed assets, provisions, equity)..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-areas-rollforward"
            />
          </FormField>
          <AIAutoFillButton field="rollforward_areas" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>

        <FormRow cols={2}>
          <FormField label="Adjustments Required">
            <Textarea
              value={rollForwardStrategy.adjustmentsRequired}
              onChange={(e) => updateRollForwardStrategy("adjustmentsRequired", e.target.value)}
              placeholder="Document any adjustments required to reconcile prior year closing to current year opening..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-adjustments-required"
            />
          </FormField>
          <FormField label="Accounting Policy Changes">
            <Textarea
              value={rollForwardStrategy.accountingPolicyChanges}
              onChange={(e) => updateRollForwardStrategy("accountingPolicyChanges", e.target.value)}
              placeholder="Document any changes in accounting policies affecting opening balances (ISA 510.6b)..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-policy-changes"
            />
          </FormField>
        </FormRow>

        <FormField label="Reconciliation Notes">
          <Textarea
            value={rollForwardStrategy.reconciliationNotes}
            onChange={(e) => updateRollForwardStrategy("reconciliationNotes", e.target.value)}
            placeholder="Document reconciliation findings between prior year closing balances and current year opening balances..."
            className="min-h-[60px]"
            disabled={readOnly}
            data-testid="textarea-rollforward-reconciliation-notes"
          />
        </FormField>

        {/* Sub-section 3: First-Year Engagement Procedures */}
        <SectionDivider title="First-Year Engagement Procedures" icon={<AlertTriangle className="h-4 w-4" />} />

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 mb-4">
          <Checkbox
            checked={firstYearProcedures.isFirstYearEngagement}
            onCheckedChange={(checked) => updateFirstYearProcedures("isFirstYearEngagement", !!checked)}
            disabled={readOnly}
            data-testid="checkbox-first-year"
          />
          <Label className="text-sm font-medium cursor-pointer">
            This is a first-year engagement (ISA 510.6–510.10 specific procedures apply)
          </Label>
        </div>

        {firstYearProcedures.isFirstYearEngagement && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
            <FormRow cols={2}>
              <FormField label="Predecessor Auditor Access" required>
                <Select
                  value={firstYearProcedures.predecessorAccess}
                  onValueChange={(v) => updateFirstYearProcedures("predecessorAccess", v)}
                  disabled={readOnly}
                >
                  <SelectTrigger data-testid="select-predecessor-access">
                    <SelectValue placeholder="Select access level" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDECESSOR_ACCESS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Sufficient Evidence Obtained?" required>
                <Select
                  value={firstYearProcedures.sufficientEvidenceObtained}
                  onValueChange={(v) => updateFirstYearProcedures("sufficientEvidenceObtained", v)}
                  disabled={readOnly}
                >
                  <SelectTrigger data-testid="select-sufficient-evidence">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {YES_NO_PROGRESS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </FormRow>

            <div className="flex items-end gap-2">
              <FormField label="Predecessor Auditor Communication (ISA 510.7a)" className="flex-1 min-w-0">
                <Textarea
                  value={firstYearProcedures.predecessorCommunication}
                  onChange={(e) => updateFirstYearProcedures("predecessorCommunication", e.target.value)}
                  placeholder="Document communication with predecessor auditor — matters discussed, working papers reviewed, any limitations encountered..."
                  className="min-h-[60px]"
                  disabled={readOnly}
                  data-testid="textarea-predecessor-communication"
                />
              </FormField>
              <AIAutoFillButton field="predecessor_communication" onAIAutoFill={onAIGenerate} disabled={readOnly} />
            </div>

            <div className="flex items-end gap-2">
              <FormField label="Alternative Procedures Performed (ISA 510.7b–c)" className="flex-1 min-w-0">
                <Textarea
                  value={firstYearProcedures.alternativeProcedures}
                  onChange={(e) => updateFirstYearProcedures("alternativeProcedures", e.target.value)}
                  placeholder="Where predecessor access was limited, document alternative audit procedures performed to obtain evidence regarding opening balances (e.g., physical inspection, confirmation, analytical procedures)..."
                  className="min-h-[60px]"
                  disabled={readOnly}
                  data-testid="textarea-alternative-procedures"
                />
              </FormField>
              <AIAutoFillButton field="alternative_procedures" onAIAutoFill={onAIGenerate} disabled={readOnly} />
            </div>

            <div className="flex items-end gap-2">
              <FormField label="Impact on Auditor's Report (ISA 510.10)" className="flex-1 min-w-0">
                <Textarea
                  value={firstYearProcedures.reportImpact}
                  onChange={(e) => updateFirstYearProcedures("reportImpact", e.target.value)}
                  placeholder="Assess the impact on the auditor's report if unable to obtain sufficient appropriate evidence regarding opening balances — consider qualification or disclaimer..."
                  className="min-h-[60px]"
                  disabled={readOnly}
                  data-testid="textarea-report-impact"
                />
              </FormField>
              <AIAutoFillButton field="report_impact" onAIAutoFill={onAIGenerate} disabled={readOnly} />
            </div>
          </div>
        )}

        {/* Legacy fields for backward compatibility */}
        <SectionDivider title="Opening TB Reconciliation" icon={<Calculator className="h-4 w-4" />} />

        <FormRow cols={2}>
          <FormField label="Reconciliation Status" required>
            <Select
              value={data.openingBalancesReview.openingTBReconciliationStatus}
              onValueChange={(v) => onChange({ ...data, openingBalancesReview: { ...data.openingBalancesReview, openingTBReconciliationStatus: v as AnalyticsOpeningBalancesData["openingBalancesReview"]["openingTBReconciliationStatus"] } })}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-reconciliation-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {RECONCILIATION_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Additional Notes">
            <Textarea
              value={data.openingBalancesReview.reconciliationNotes}
              onChange={(e) => onChange({ ...data, openingBalancesReview: { ...data.openingBalancesReview, reconciliationNotes: e.target.value } })}
              placeholder="Document reconciliation findings..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-reconciliation-notes"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Required Evidence / Supporting Documents" icon={<FileText className="h-4 w-4" />} />

        <div className="text-xs text-muted-foreground space-y-1 mb-3">
          <p className="font-medium">Required evidence per ISA 510:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            <li>Prior period audit file</li>
            <li>Opening trial balance</li>
            <li>Prior year financial statements</li>
            <li>Predecessor auditor communication (if applicable)</li>
          </ul>
        </div>

        <EvidenceUploader
          phase="pre-planning"
          section="opening-balances"
          files={data.openingBalancesReview.evidenceFiles}
          onUpload={handleEvidenceUpload}
          onDelete={handleEvidenceDelete}
          readOnly={readOnly}
        />
      </FormSection>

      {/* Data Sources */}
      <FormSection
        icon={<Database className="h-5 w-5" />}
        title="Data Sources"
        description="Document sources used for analytical procedures"
      >
        <div className="flex items-end gap-2">
          <FormField label="Data Sources Documentation" className="flex-1 min-w-0">
            <Textarea
              value={data.dataSources}
              onChange={(e) => onChange({ ...data, dataSources: e.target.value })}
              placeholder="Describe the data sources used for analytical procedures (e.g., trial balance, prior year financials, industry benchmarks, management budgets)..."
              rows={3}
              disabled={readOnly}
              data-testid="textarea-analytics-data-sources"
            />
          </FormField>
          <AIAutoFillButton field="data_sources" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>
      </FormSection>

      {/* 1. Trend Analysis (ISA 520/315) */}
      <FormSection
        icon={<TrendingUp className="h-5 w-5" />}
        title="Trend Analysis"
        description="ISA 520.5 / ISA 315 — Year-over-year comparison of key financial statement line items to identify unusual or unexpected relationships indicating risks of material misstatement"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="badge-trend-count">
              {trendAnalysis.items.length} item(s)
            </Badge>
            {significantTrends > 0 && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 gap-1" data-testid="badge-significant-trends">
                <AlertTriangle className="h-3 w-3" />
                {significantTrends} significant
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && onAIGenerate && (
              <AIButton onClick={() => onAIGenerate("trend_analysis")} label="AI Identify Trends" testId="button-ai-trend-analysis" />
            )}
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addTrendItem} className="gap-1" data-testid="button-add-trend">
                <Plus className="h-3.5 w-3.5" />
                Add Line Item
              </Button>
            )}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold min-w-[150px]">Line Item</TableHead>
                <TableHead className="text-xs font-semibold w-[110px]">Current Year</TableHead>
                <TableHead className="text-xs font-semibold w-[110px]">Prior Year</TableHead>
                <TableHead className="text-xs font-semibold w-[110px]">Change</TableHead>
                <TableHead className="text-xs font-semibold w-[80px]">% Change</TableHead>
                <TableHead className="text-xs font-semibold w-[70px] text-center">Flag</TableHead>
                <TableHead className="text-xs font-semibold min-w-[150px]">Explanation</TableHead>
                {!readOnly && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {trendAnalysis.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={readOnly ? 7 : 8} className="text-center text-sm text-muted-foreground py-8">
                    No trend items added. Click "Add Line Item" to begin year-over-year analysis.
                  </TableCell>
                </TableRow>
              )}
              {trendAnalysis.items.map((item) => (
                <TableRow key={item.id} className={item.significanceFlag ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-muted/20"}>
                  <TableCell>
                    <Input value={item.lineItem} onChange={(e) => updateTrendItem(item.id, "lineItem", e.target.value)} placeholder="e.g., Revenue" className="h-8 text-sm" disabled={readOnly} data-testid={`input-trend-item-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.currentYear ?? ""} onChange={(e) => updateTrendItem(item.id, "currentYear", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-trend-cy-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.priorYear ?? ""} onChange={(e) => updateTrendItem(item.id, "priorYear", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-trend-py-${item.id}`} />
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {item.changeAmount !== null ? formatNumber(item.changeAmount) : "—"}
                  </TableCell>
                  <TableCell className={`text-sm font-mono ${item.changePercent !== null && Math.abs(item.changePercent) > 10 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>
                    {item.changePercent !== null ? `${item.changePercent.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={item.significanceFlag} onCheckedChange={(checked) => updateTrendItem(item.id, "significanceFlag", !!checked)} disabled={readOnly} data-testid={`checkbox-trend-flag-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input value={item.explanation} onChange={(e) => updateTrendItem(item.id, "explanation", e.target.value)} placeholder="Explanation..." className="h-8 text-sm" disabled={readOnly} data-testid={`input-trend-explanation-${item.id}`} />
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteTrendItem(item.id)} className="text-destructive" data-testid={`button-delete-trend-${item.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-end gap-2">
          <FormField label="Trend Analysis Conclusion" className="flex-1 min-w-0">
            <Textarea
              value={trendAnalysis.trendConclusion}
              onChange={(e) => onChange({ ...data, trendAnalysis: { ...trendAnalysis, trendConclusion: e.target.value } })}
              placeholder="Summarize key trends identified and their implications for audit risk..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-trend-conclusion"
            />
          </FormField>
          <AIAutoFillButton field="trend_conclusion" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>
      </FormSection>

      {/* 2. Ratio Analysis (ISA 520) */}
      <FormSection
        icon={<BarChart3 className="h-5 w-5" />}
        title="Ratio Analysis"
        description="ISA 520.5 — Evaluate financial relationships using ratio analysis as part of analytical procedures to identify unusual or unexpected relationships that may indicate risks of material misstatement"
      >
        <div className="flex items-center justify-end flex-wrap gap-2">
          {!readOnly && onAIGenerate && (
            <AIButton onClick={() => onAIGenerate("ratio_analysis")} label="AI Compute Ratios" testId="button-ai-compute-ratios" />
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold">Ratio</TableHead>
                <TableHead className="text-xs font-semibold w-[120px]">Current Year</TableHead>
                <TableHead className="text-xs font-semibold w-[120px]">Prior Year</TableHead>
                <TableHead className="text-xs font-semibold w-[120px]">Industry Benchmark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-muted/20">
                <TableCell className="text-sm font-medium">Current Ratio</TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={standardRatios.currentRatio ?? ""} onChange={(e) => handleStandardRatioChange("currentRatio", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid="input-ratio-current" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
              </TableRow>
              <TableRow className="hover:bg-muted/20">
                <TableCell className="text-sm font-medium">Debt-to-Equity</TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={standardRatios.debtToEquity ?? ""} onChange={(e) => handleStandardRatioChange("debtToEquity", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid="input-ratio-debt-equity" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
              </TableRow>
              <TableRow className="hover:bg-muted/20">
                <TableCell className="text-sm font-medium">Gross Margin (%)</TableCell>
                <TableCell>
                  <Input type="number" step="0.1" value={standardRatios.grossMargin ?? ""} onChange={(e) => handleStandardRatioChange("grossMargin", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid="input-ratio-gross-margin" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
              </TableRow>
              <TableRow className="hover:bg-muted/20">
                <TableCell className="text-sm font-medium">Revenue Growth (%)</TableCell>
                <TableCell>
                  <Input type="number" step="0.1" value={standardRatios.revenueGrowth ?? ""} onChange={(e) => handleStandardRatioChange("revenueGrowth", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid="input-ratio-revenue-growth" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
              </TableRow>
              <TableRow className="hover:bg-muted/20">
                <TableCell className="text-sm font-medium">Return on Assets (%)</TableCell>
                <TableCell>
                  <Input type="number" step="0.1" value={standardRatios.returnOnAssets ?? ""} onChange={(e) => handleStandardRatioChange("returnOnAssets", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid="input-ratio-return-assets" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
              </TableRow>
              {ratioAnalysis.customRatios.map((ratio) => (
                <TableRow key={ratio.id} className="hover:bg-muted/20">
                  <TableCell>
                    <Input value={ratio.name} onChange={(e) => handleUpdateCustomRatio(ratio.id, "name", e.target.value)} placeholder="Ratio name..." className="h-8 text-sm" disabled={readOnly} data-testid={`input-custom-ratio-name-${ratio.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={ratio.value ?? ""} onChange={(e) => handleUpdateCustomRatio(ratio.id, "value", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-custom-ratio-value-${ratio.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={ratio.priorYear ?? ""} onChange={(e) => handleUpdateCustomRatio(ratio.id, "priorYear", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-custom-ratio-prior-${ratio.id}`} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input type="number" step="0.01" value={ratio.industryBenchmark ?? ""} onChange={(e) => handleUpdateCustomRatio(ratio.id, "industryBenchmark", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-custom-ratio-benchmark-${ratio.id}`} />
                      {!readOnly && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomRatio(ratio.id)} className="text-destructive flex-shrink-0" data-testid={`button-delete-custom-ratio-${ratio.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleAddCustomRatio} className="gap-1" data-testid="button-add-custom-ratio">
              <Plus className="h-3.5 w-3.5" />
              Add Custom Ratio
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <FormField label="Ratio Analysis Conclusion" className="flex-1 min-w-0">
            <Textarea
              value={ratioAnalysis.ratioConclusion}
              onChange={(e) => onChange({ ...data, ratioAnalysis: { ...ratioAnalysis, ratioConclusion: e.target.value } })}
              placeholder="Summarize key ratio observations, any concerning deviations from benchmarks..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-ratio-conclusion"
            />
          </FormField>
          <AIAutoFillButton field="ratio_conclusion" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>
      </FormSection>

      {/* 3. Budget vs Actual Review */}
      <FormSection
        icon={<Target className="h-5 w-5" />}
        title="Budget vs Actual Review"
        description="ISA 520 / ISA 315 - Compare budgeted figures against actual results to identify variances"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="badge-budget-count">
              {budgetVsActual.items.length} item(s)
            </Badge>
            {significantBudgetVars > 0 && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 gap-1" data-testid="badge-significant-budget">
                <AlertTriangle className="h-3 w-3" />
                {significantBudgetVars} significant
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && onAIGenerate && (
              <AIButton onClick={() => onAIGenerate("budget_vs_actual")} label="AI Identify Variances" testId="button-ai-budget-variances" />
            )}
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addBudgetItem} className="gap-1" data-testid="button-add-budget-item">
                <Plus className="h-3.5 w-3.5" />
                Add Line Item
              </Button>
            )}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold min-w-[150px]">Line Item</TableHead>
                <TableHead className="text-xs font-semibold w-[110px]">Budget</TableHead>
                <TableHead className="text-xs font-semibold w-[110px]">Actual</TableHead>
                <TableHead className="text-xs font-semibold w-[110px]">Variance</TableHead>
                <TableHead className="text-xs font-semibold w-[80px]">% Var</TableHead>
                <TableHead className="text-xs font-semibold w-[70px] text-center">Flag</TableHead>
                <TableHead className="text-xs font-semibold min-w-[150px]">Explanation</TableHead>
                {!readOnly && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetVsActual.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={readOnly ? 7 : 8} className="text-center text-sm text-muted-foreground py-8">
                    No budget items added. Click "Add Line Item" to begin budget vs actual comparison.
                  </TableCell>
                </TableRow>
              )}
              {budgetVsActual.items.map((item) => (
                <TableRow key={item.id} className={item.significanceFlag ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-muted/20"}>
                  <TableCell>
                    <Input value={item.lineItem} onChange={(e) => updateBudgetItem(item.id, "lineItem", e.target.value)} placeholder="e.g., Revenue" className="h-8 text-sm" disabled={readOnly} data-testid={`input-budget-item-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.budgetAmount ?? ""} onChange={(e) => updateBudgetItem(item.id, "budgetAmount", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-budget-amount-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.actualAmount ?? ""} onChange={(e) => updateBudgetItem(item.id, "actualAmount", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-budget-actual-${item.id}`} />
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {item.varianceAmount !== null ? formatNumber(item.varianceAmount) : "—"}
                  </TableCell>
                  <TableCell className={`text-sm font-mono ${item.variancePercent !== null && Math.abs(item.variancePercent) > 10 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>
                    {item.variancePercent !== null ? `${item.variancePercent.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={item.significanceFlag} onCheckedChange={(checked) => updateBudgetItem(item.id, "significanceFlag", !!checked)} disabled={readOnly} data-testid={`checkbox-budget-flag-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input value={item.explanation} onChange={(e) => updateBudgetItem(item.id, "explanation", e.target.value)} placeholder="Explanation..." className="h-8 text-sm" disabled={readOnly} data-testid={`input-budget-explanation-${item.id}`} />
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteBudgetItem(item.id)} className="text-destructive" data-testid={`button-delete-budget-${item.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-end gap-2">
          <FormField label="Budget vs Actual Conclusion" className="flex-1 min-w-0">
            <Textarea
              value={budgetVsActual.budgetConclusion}
              onChange={(e) => onChange({ ...data, budgetVsActual: { ...budgetVsActual, budgetConclusion: e.target.value } })}
              placeholder="Summarize significant budget variances, management explanations, and audit implications..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-budget-conclusion"
            />
          </FormField>
          <AIAutoFillButton field="budget_conclusion" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>
      </FormSection>

      {/* 4. Identification of Unusual Fluctuations */}
      <FormSection
        icon={<Search className="h-5 w-5" />}
        title="Identification of Unusual Fluctuations"
        description="ISA 520.A7 / ISA 315 - Document and investigate unusual or unexpected fluctuations"
      >
        <FormRow cols={2}>
          <FormField label="Significance Threshold (%)" helperText="Fluctuations above this threshold are flagged for investigation">
            <Input
              value={unusualFluctuations.fluctuationThreshold}
              onChange={(e) => onChange({ ...data, unusualFluctuations: { ...unusualFluctuations, fluctuationThreshold: e.target.value } })}
              placeholder="e.g., 10"
              className="w-32"
              disabled={readOnly}
              data-testid="input-fluctuation-threshold"
            />
          </FormField>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Badge variant="outline" data-testid="badge-fluctuation-count">
                {unusualFluctuations.items.length} identified
              </Badge>
              {openFluctuations > 0 && (
                <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 gap-1" data-testid="badge-open-fluctuations">
                  <AlertTriangle className="h-3 w-3" />
                  {openFluctuations} unresolved
                </Badge>
              )}
            </div>
          </div>
        </FormRow>

        <div className="flex items-center justify-end gap-2">
          {!readOnly && onAIGenerate && (
            <AIButton onClick={() => onAIGenerate("unusual_fluctuations")} label="AI Identify Fluctuations" testId="button-ai-fluctuations" />
          )}
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={addFluctuation} className="gap-1" data-testid="button-add-fluctuation">
              <Plus className="h-3.5 w-3.5" />
              Add Fluctuation
            </Button>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold min-w-[130px]">Account</TableHead>
                <TableHead className="text-xs font-semibold min-w-[150px]">Description</TableHead>
                <TableHead className="text-xs font-semibold w-[100px]">Amount</TableHead>
                <TableHead className="text-xs font-semibold w-[80px]">% Change</TableHead>
                <TableHead className="text-xs font-semibold w-[90px]">Risk</TableHead>
                <TableHead className="text-xs font-semibold w-[110px]">Status</TableHead>
                {!readOnly && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {unusualFluctuations.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={readOnly ? 6 : 7} className="text-center text-sm text-muted-foreground py-8">
                    No unusual fluctuations identified. Click "Add Fluctuation" or use AI to detect anomalies.
                  </TableCell>
                </TableRow>
              )}
              {unusualFluctuations.items.map((item) => (
                <TableRow key={item.id} className={item.riskImplication === "high" ? "bg-red-50/50 dark:bg-red-950/20" : item.riskImplication === "medium" ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-muted/20"}>
                  <TableCell>
                    <Input value={item.account} onChange={(e) => updateFluctuation(item.id, "account", e.target.value)} placeholder="Account name" className="h-8 text-sm" disabled={readOnly} data-testid={`input-fluc-account-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input value={item.description} onChange={(e) => updateFluctuation(item.id, "description", e.target.value)} placeholder="Nature of fluctuation..." className="h-8 text-sm" disabled={readOnly} data-testid={`input-fluc-desc-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.amount ?? ""} onChange={(e) => updateFluctuation(item.id, "amount", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-fluc-amount-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.1" value={item.percentChange ?? ""} onChange={(e) => updateFluctuation(item.id, "percentChange", e.target.value ? parseFloat(e.target.value) : null)} className="h-8 text-sm" disabled={readOnly} data-testid={`input-fluc-pct-${item.id}`} />
                  </TableCell>
                  <TableCell>
                    <Select value={item.riskImplication} onValueChange={(v) => updateFluctuation(item.id, "riskImplication", v)} disabled={readOnly}>
                      <SelectTrigger className="h-8 text-sm" data-testid={`select-fluc-risk-${item.id}`}>
                        <SelectValue placeholder="Risk" />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_LEVELS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={item.investigationStatus} onValueChange={(v) => updateFluctuation(item.id, "investigationStatus", v)} disabled={readOnly}>
                      <SelectTrigger className="h-8 text-sm" data-testid={`select-fluc-status-${item.id}`}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {INVESTIGATION_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteFluctuation(item.id)} className="text-destructive" data-testid={`button-delete-fluc-${item.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {unusualFluctuations.items.some((f) => f.investigationStatus !== "resolved" && f.investigationStatus !== "") && (
          <div className="space-y-3">
            <SectionDivider title="Investigation Notes" icon={<AlertTriangle className="h-4 w-4" />} />
            {unusualFluctuations.items
              .filter((f) => f.investigationStatus !== "resolved")
              .map((item) => (
                <div key={item.id} className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {item.account || "Unnamed"} — Investigation Notes
                  </Label>
                  <Textarea
                    value={item.investigationNotes}
                    onChange={(e) => updateFluctuation(item.id, "investigationNotes", e.target.value)}
                    placeholder="Document investigation findings, management explanations, and audit response..."
                    className="min-h-[60px]"
                    disabled={readOnly}
                    data-testid={`textarea-fluc-notes-${item.id}`}
                  />
                </div>
              ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <FormField label="Overall Fluctuation Assessment" className="flex-1 min-w-0">
            <Textarea
              value={unusualFluctuations.overallAssessment}
              onChange={(e) => onChange({ ...data, unusualFluctuations: { ...unusualFluctuations, overallAssessment: e.target.value } })}
              placeholder="Overall assessment of unusual fluctuations and their impact on audit risk and planned procedures..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-fluctuation-assessment"
            />
          </FormField>
          <AIAutoFillButton field="fluctuation_assessment" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>
      </FormSection>

      {/* Overall Conclusion */}
      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Overall Conclusion"
        description="Combined conclusion from analytics and opening balances review"
      >
        <div className="flex items-end gap-2">
          <FormField label="Overall Analytics & Opening Balances Conclusion" required className="flex-1 min-w-0">
            <Textarea
              value={data.overallConclusion}
              onChange={(e) => onChange({ ...data, overallConclusion: e.target.value })}
              placeholder="Document your overall conclusion from the preliminary analytical procedures and opening balances review, including any areas requiring further investigation during fieldwork..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-overall-conclusion"
            />
          </FormField>
          <AIAutoFillButton field="overall_conclusion" onAIAutoFill={onAIGenerate} disabled={readOnly} />
        </div>

      </FormSection>
    </div>
  );
}
