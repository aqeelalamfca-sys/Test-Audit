import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Calculator,
  DollarSign,
  BarChart3,
  Layers,
  FileText,
  Trash2,
  Plus,
  Sparkles,
  Loader2,
} from "lucide-react";
import { FormSection, FormField, FormRow, SectionDivider } from "./sections";
import type { MaterialityData, ComponentMaterialityItem } from "./types";

export interface MaterialitySectionProps {
  engagementId: string;
  data: MaterialityData;
  onChange: (data: MaterialityData) => void;
  currentUser?: string;
  readOnly?: boolean;
  onAiSuggest?: (field: string) => Promise<string | undefined>;
  isAiLoading?: boolean;
}

const BENCHMARK_OPTIONS: { value: MaterialityData["benchmarkSelection"]; label: string; typicalRange: string }[] = [
  { value: "revenue", label: "Revenue", typicalRange: "0.5% - 2%" },
  { value: "total_assets", label: "Total Assets", typicalRange: "1% - 2%" },
  { value: "pbt", label: "Profit Before Tax", typicalRange: "5% - 10%" },
  { value: "equity", label: "Equity", typicalRange: "1% - 5%" },
  { value: "gross_profit", label: "Gross Profit", typicalRange: "1% - 5%" },
];

function formatNumber(value: number): string {
  if (!value && value !== 0) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function MaterialitySection({
  engagementId,
  data,
  onChange,
  currentUser = "Current User",
  readOnly = false,
  onAiSuggest,
  isAiLoading = false,
}: MaterialitySectionProps) {
  const handleChange = useCallback(<K extends keyof MaterialityData>(
    field: K,
    value: MaterialityData[K]
  ) => {
    onChange({ ...data, [field]: value });
  }, [data, onChange]);

  const handleFinancialDataChange = useCallback((field: keyof MaterialityData["financialData"], value: number) => {
    const updatedFinancialData = { ...data.financialData, [field]: value };
    onChange({ ...data, financialData: updatedFinancialData });
  }, [data, onChange]);

  const handleComputationChange = useCallback((field: keyof MaterialityData["materialityComputation"], value: number) => {
    const updatedComputation = { ...data.materialityComputation, [field]: value };
    onChange({ ...data, materialityComputation: updatedComputation });
  }, [data, onChange]);

  const handleSignOffChange = useCallback((signOffData: SignOffData) => {
    handleChange("signOff", signOffData);
  }, [handleChange]);

  const selectedBenchmarkAmount = useMemo(() => {
    switch (data.benchmarkSelection) {
      case "revenue": return data.financialData.revenue;
      case "total_assets": return data.financialData.totalAssets;
      case "pbt": return data.financialData.profitBeforeTax;
      case "equity": return data.financialData.equity;
      case "gross_profit": return data.financialData.grossProfit;
      default: return 0;
    }
  }, [data.benchmarkSelection, data.financialData]);

  const computedMateriality = useMemo(() => {
    const benchmarkAmount = selectedBenchmarkAmount;
    const pctApplied = data.materialityComputation.percentageApplied || 0;
    const overall = Math.round(benchmarkAmount * (pctApplied / 100));
    const perfPct = data.materialityComputation.performanceMaterialityPercent || 60;
    const perfMat = Math.round(overall * (perfPct / 100));
    const trivPct = data.materialityComputation.trivialThresholdPercent || 5;
    const trivial = Math.round(overall * (trivPct / 100));

    return {
      benchmarkAmount,
      overallMateriality: overall,
      performanceMateriality: perfMat,
      trivialThreshold: trivial,
    };
  }, [selectedBenchmarkAmount, data.materialityComputation.percentageApplied, data.materialityComputation.performanceMaterialityPercent, data.materialityComputation.trivialThresholdPercent]);

  const handleAutoCompute = useCallback(() => {
    const updated: MaterialityData["materialityComputation"] = {
      ...data.materialityComputation,
      benchmarkAmount: computedMateriality.benchmarkAmount,
      overallMateriality: computedMateriality.overallMateriality,
      performanceMateriality: computedMateriality.performanceMateriality,
      trivialThreshold: computedMateriality.trivialThreshold,
    };
    handleChange("materialityComputation", updated);
    handleChange("clearlyTrivialThreshold", {
      ...data.clearlyTrivialThreshold,
      threshold: computedMateriality.trivialThreshold,
    });
  }, [computedMateriality, data.materialityComputation, data.clearlyTrivialThreshold, handleChange]);

  const addComponent = useCallback(() => {
    const newItem: ComponentMaterialityItem = {
      id: `comp-${Date.now()}`,
      componentName: "",
      allocationBasis: "",
      allocatedMateriality: 0,
      performanceMateriality: 0,
    };
    handleChange("componentMateriality", {
      ...data.componentMateriality,
      components: [...data.componentMateriality.components, newItem],
    });
  }, [data.componentMateriality, handleChange]);

  const removeComponent = useCallback((id: string) => {
    handleChange("componentMateriality", {
      ...data.componentMateriality,
      components: data.componentMateriality.components.filter(c => c.id !== id),
    });
  }, [data.componentMateriality, handleChange]);

  const updateComponent = useCallback((id: string, field: keyof ComponentMaterialityItem, value: string | number) => {
    handleChange("componentMateriality", {
      ...data.componentMateriality,
      components: data.componentMateriality.components.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    });
  }, [data.componentMateriality, handleChange]);

  return (
    <div className="space-y-3">
      <FormSection
        icon={<BarChart3 className="h-5 w-5" />}
        title="Benchmark Selection"
        description="ISA 320.10 — Determine materiality for the financial statements as a whole by selecting an appropriate benchmark and applying a percentage"
      >
        <FormField label="Materiality Benchmark" required>
          <RadioGroup
            value={data.benchmarkSelection}
            onValueChange={(v) => handleChange("benchmarkSelection", v as MaterialityData["benchmarkSelection"])}
            disabled={readOnly}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {BENCHMARK_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-start space-x-3 border border-border/60 rounded-md p-3">
                <RadioGroupItem value={opt.value} id={`benchmark-${opt.value}`} data-testid={`radio-benchmark-${opt.value}`} />
                <Label htmlFor={`benchmark-${opt.value}`} className="cursor-pointer space-y-0.5">
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">Typical: {opt.typicalRange}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FormField>

        <FormField label="Benchmark Rationale" required>
          <div className="space-y-2">
            <Textarea
              value={data.benchmarkRationale}
              onChange={(e) => handleChange("benchmarkRationale", e.target.value)}
              placeholder="Justify why this benchmark is appropriate for the entity..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-benchmark-rationale"
            />
            {onAiSuggest && (
              <Button
                variant="outline"
                size="sm"
                disabled={readOnly || isAiLoading}
                onClick={async () => {
                  const result = await onAiSuggest?.("benchmarkRationale");
                  if (result) handleChange("benchmarkRationale", result);
                }}
                data-testid="button-ai-benchmark-rationale"
              >
                {isAiLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                AI Suggest
              </Button>
            )}
          </div>
        </FormField>
      </FormSection>

      <FormSection
        icon={<DollarSign className="h-5 w-5" />}
        title="Financial Data"
        description="Auto-fetched from Trial Balance — editable overrides available"
      >
        <FormRow cols={3}>
          <FormField label="Revenue" source="tb">
            <Input
              type="text"
              value={formatNumber(data.financialData.revenue)}
              onChange={(e) => handleFinancialDataChange("revenue", parseNumber(e.target.value))}
              disabled={readOnly}
              data-testid="input-revenue"
            />
          </FormField>
          <FormField label="Total Assets" source="tb">
            <Input
              type="text"
              value={formatNumber(data.financialData.totalAssets)}
              onChange={(e) => handleFinancialDataChange("totalAssets", parseNumber(e.target.value))}
              disabled={readOnly}
              data-testid="input-total-assets"
            />
          </FormField>
          <FormField label="Profit Before Tax" source="tb">
            <Input
              type="text"
              value={formatNumber(data.financialData.profitBeforeTax)}
              onChange={(e) => handleFinancialDataChange("profitBeforeTax", parseNumber(e.target.value))}
              disabled={readOnly}
              data-testid="input-pbt"
            />
          </FormField>
        </FormRow>
        <FormRow cols={2}>
          <FormField label="Equity" source="tb">
            <Input
              type="text"
              value={formatNumber(data.financialData.equity)}
              onChange={(e) => handleFinancialDataChange("equity", parseNumber(e.target.value))}
              disabled={readOnly}
              data-testid="input-equity"
            />
          </FormField>
          <FormField label="Gross Profit" source="tb">
            <Input
              type="text"
              value={formatNumber(data.financialData.grossProfit)}
              onChange={(e) => handleFinancialDataChange("grossProfit", parseNumber(e.target.value))}
              disabled={readOnly}
              data-testid="input-gross-profit"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Calculator className="h-5 w-5" />}
        title="Materiality Computation"
        description="ISA 320.10-11 — Overall materiality, performance materiality, and trivial threshold"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            Selected benchmark: <span className="font-medium text-foreground">{data.benchmarkSelection ? BENCHMARK_OPTIONS.find(b => b.value === data.benchmarkSelection)?.label : "None"}</span>
            {" = "}
            <span className="font-medium text-foreground">{formatNumber(computedMateriality.benchmarkAmount)}</span>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleAutoCompute}
            disabled={readOnly || !data.benchmarkSelection}
            data-testid="button-auto-compute"
          >
            <Calculator className="h-3.5 w-3.5 mr-1.5" />
            Auto-Compute
          </Button>
        </div>

        <Separator />

        <FormRow cols={3}>
          <FormField label="Percentage Applied (%)" required>
            <Input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={data.materialityComputation.percentageApplied || ""}
              onChange={(e) => handleComputationChange("percentageApplied", parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              data-testid="input-percentage-applied"
            />
          </FormField>
          <FormField label="Overall Materiality" source="auto">
            <Input
              type="text"
              value={formatNumber(data.materialityComputation.overallMateriality || computedMateriality.overallMateriality)}
              onChange={(e) => handleComputationChange("overallMateriality", parseNumber(e.target.value))}
              disabled={readOnly}
              data-testid="input-overall-materiality"
            />
          </FormField>
          <FormField label="Benchmark Amount" source="auto">
            <Input
              type="text"
              value={formatNumber(data.materialityComputation.benchmarkAmount || computedMateriality.benchmarkAmount)}
              readOnly
              disabled
              className="bg-muted/50"
              data-testid="input-benchmark-amount"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Performance Materiality (ISA 320.11 — Amount set to reduce aggregation risk of uncorrected and undetected misstatements)" icon={<BarChart3 className="h-4 w-4" />} />

        <FormRow cols={3}>
          <FormField label="Performance Materiality (%)" helperText="Typically 50-75% of overall materiality">
            <Input
              type="number"
              step="1"
              min={0}
              max={100}
              value={data.materialityComputation.performanceMaterialityPercent || ""}
              onChange={(e) => handleComputationChange("performanceMaterialityPercent", parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              data-testid="input-perf-materiality-pct"
            />
          </FormField>
          <FormField label="Performance Materiality" source="auto">
            <Input
              type="text"
              value={formatNumber(data.materialityComputation.performanceMateriality || computedMateriality.performanceMateriality)}
              onChange={(e) => handleComputationChange("performanceMateriality", parseNumber(e.target.value))}
              disabled={readOnly}
              data-testid="input-perf-materiality"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Trivial Threshold (ISA 450)" icon={<FileText className="h-4 w-4" />} />

        <FormRow cols={3}>
          <FormField label="Trivial Threshold (%)" helperText="Typically 5% of overall materiality">
            <Input
              type="number"
              step="0.5"
              min={0}
              max={100}
              value={data.materialityComputation.trivialThresholdPercent || ""}
              onChange={(e) => handleComputationChange("trivialThresholdPercent", parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              data-testid="input-trivial-pct"
            />
          </FormField>
          <FormField label="Trivial Threshold" source="auto">
            <Input
              type="text"
              value={formatNumber(data.materialityComputation.trivialThreshold || computedMateriality.trivialThreshold)}
              onChange={(e) => handleComputationChange("trivialThreshold", parseNumber(e.target.value))}
              disabled={readOnly}
              data-testid="input-trivial-threshold"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Rationale"
        description="ISA 320.A1 — Document justification for materiality judgments"
      >
        <FormField label="Materiality Rationale" required>
          <div className="space-y-2">
            <Textarea
              value={data.rationale}
              onChange={(e) => handleChange("rationale", e.target.value)}
              placeholder="Document the rationale for the benchmark selection, percentage applied, and any adjustments made..."
              className="min-h-[120px]"
              disabled={readOnly}
              data-testid="textarea-materiality-rationale"
            />
            {onAiSuggest && (
              <Button
                variant="outline"
                size="sm"
                disabled={readOnly || isAiLoading}
                onClick={async () => {
                  const result = await onAiSuggest?.("rationale");
                  if (result) handleChange("rationale", result);
                }}
                data-testid="button-ai-materiality-rationale"
              >
                {isAiLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                AI Draft Rationale
              </Button>
            )}
          </div>
        </FormField>
      </FormSection>

      <FormSection
        icon={<Layers className="h-5 w-5" />}
        title="Component Materiality"
        description="ISA 600 — Applicable for group audit engagements"
      >
        <div className="flex items-center space-x-3">
          <Checkbox
            id="isGroupAudit"
            checked={data.componentMateriality.isGroupAudit}
            onCheckedChange={(checked) =>
              handleChange("componentMateriality", {
                ...data.componentMateriality,
                isGroupAudit: !!checked,
              })
            }
            disabled={readOnly}
            data-testid="checkbox-group-audit-materiality"
          />
          <Label htmlFor="isGroupAudit" className="text-sm font-medium cursor-pointer">
            This is a Group Audit — Component materiality allocation required
          </Label>
        </div>

        {data.componentMateriality.isGroupAudit && (
          <div className="space-y-2.5">
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Component Name</th>
                    <th className="text-left p-3 font-medium">Allocation Basis</th>
                    <th className="text-right p-3 font-medium">Allocated Materiality</th>
                    <th className="text-right p-3 font-medium">Performance Materiality</th>
                    <th className="text-center p-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.componentMateriality.components.map((comp) => (
                    <tr key={comp.id} className="border-b last:border-b-0" data-testid={`row-component-${comp.id}`}>
                      <td className="p-2">
                        <Input
                          value={comp.componentName}
                          onChange={(e) => updateComponent(comp.id, "componentName", e.target.value)}
                          placeholder="Component name"
                          disabled={readOnly}
                          data-testid={`input-component-name-${comp.id}`}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={comp.allocationBasis}
                          onChange={(e) => updateComponent(comp.id, "allocationBasis", e.target.value)}
                          placeholder="Basis"
                          disabled={readOnly}
                          data-testid={`input-component-basis-${comp.id}`}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="text"
                          value={formatNumber(comp.allocatedMateriality)}
                          onChange={(e) => updateComponent(comp.id, "allocatedMateriality", parseNumber(e.target.value))}
                          className="text-right"
                          disabled={readOnly}
                          data-testid={`input-component-materiality-${comp.id}`}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="text"
                          value={formatNumber(comp.performanceMateriality)}
                          onChange={(e) => updateComponent(comp.id, "performanceMateriality", parseNumber(e.target.value))}
                          className="text-right"
                          disabled={readOnly}
                          data-testid={`input-component-perf-mat-${comp.id}`}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeComponent(comp.id)}
                          disabled={readOnly}
                          data-testid={`button-remove-component-${comp.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {data.componentMateriality.components.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-3 text-center text-muted-foreground text-sm">
                        No components added. Click "Add Component" to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addComponent}
              disabled={readOnly}
              data-testid="button-add-component"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Component
            </Button>
          </div>
        )}
      </FormSection>

      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Clearly Trivial Threshold"
        description="ISA 450.A2 — Amount below which misstatements are clearly trivial, individually or in aggregate, and need not be accumulated"
      >
        <FormRow cols={2}>
          <FormField label="Threshold Amount" source="auto">
            <Input
              type="text"
              value={formatNumber(data.clearlyTrivialThreshold.threshold)}
              onChange={(e) =>
                handleChange("clearlyTrivialThreshold", {
                  ...data.clearlyTrivialThreshold,
                  threshold: parseNumber(e.target.value),
                })
              }
              disabled={readOnly}
              data-testid="input-clearly-trivial-threshold"
            />
          </FormField>
          <FormField label="Basis for Threshold">
            <Textarea
              value={data.clearlyTrivialThreshold.basis}
              onChange={(e) =>
                handleChange("clearlyTrivialThreshold", {
                  ...data.clearlyTrivialThreshold,
                  basis: e.target.value,
                })
              }
              placeholder="Basis for determining the clearly trivial threshold..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-trivial-basis"
            />
          </FormField>
        </FormRow>
      </FormSection>

    </div>
  );
}

export function getDefaultMaterialityData(engagementId: string = ""): MaterialityData {
  return {
    engagementId,
    benchmarkSelection: "",
    benchmarkRationale: "",
    financialData: {
      revenue: 0,
      totalAssets: 0,
      profitBeforeTax: 0,
      equity: 0,
      grossProfit: 0,
    },
    materialityComputation: {
      benchmarkAmount: 0,
      percentageApplied: 0,
      overallMateriality: 0,
      performanceMaterialityPercent: 60,
      performanceMateriality: 0,
      trivialThresholdPercent: 5,
      trivialThreshold: 0,
    },
    rationale: "",
    componentMateriality: {
      isGroupAudit: false,
      components: [],
    },
    clearlyTrivialThreshold: {
      threshold: 0,
      basis: "",
    },
    signOff: {
      preparedBy: "",
      preparedDate: "",
      reviewedBy: "",
      reviewedDate: "",
      approvedBy: "",
      approvedDate: "",
      status: "DRAFT",
    },
  };
}
