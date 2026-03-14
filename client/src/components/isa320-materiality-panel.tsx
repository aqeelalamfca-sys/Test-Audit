import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Database,
  Target,
  Calculator,
  AlertTriangle,
  Shield,
  FileText,
  Copy,
  Check,
  Loader2,
  ArrowDown,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Scale,
  BarChart3,
  Users,
  Lock,
  ClipboardCopy,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskAdjustment {
  factor: string;
  description: string;
  adjustment: number;
  applied: boolean;
  rationale: string;
}

interface QualitativeFactor {
  factor: string;
  present: boolean;
  assessment: string;
  impactLevel: "HIGH" | "MEDIUM" | "LOW" | "NONE";
}

interface AlternativeBenchmark {
  benchmark: string;
  value: number;
  percentageRange: string;
  reasonNotSelected: string;
}

interface SignificantFSHead {
  accountName: string;
  balance: number;
  percentOfMateriality: number;
  riskRating: string;
}

interface PartnerOverrideStructure {
  overrideEnabled: boolean;
  overrideFields: string[];
  requiredFields: string[];
  currentOverride: {
    reason?: string;
    revisedValue?: number;
    impactAssessment?: string;
    approvalTimestamp?: string;
    approverUserId?: string;
  } | null;
}

interface DocumentationOutput {
  benchmarkSelectionRationale: string;
  selectedBenchmarkAndPercentage: string;
  overallMaterialitySummary: string;
  performanceMaterialitySummary: string;
  trivialThresholdSummary: string;
  qualitativeFactorsConsidered: string[];
  impactOnAuditPlanning: string;
  isaReferences: string[];
}

interface ISA320MaterialityResult {
  engagementId: string;
  analysisTimestamp: string;
  step1_dataIngestion: {
    revenue: number;
    totalAssets: number;
    totalEquity: number;
    profitBeforeTax: number;
    priorYearRevenue: number | null;
    priorYearAssets: number | null;
    priorYearPBT: number | null;
    entityType: string | null;
    industry: string | null;
    ownershipStructure: string | null;
    regulatoryEnvironment: string | null;
    fraudRisksIdentified: number;
    significantRisksIdentified: number;
    fsLevelRisks: string[];
  };
  step2_benchmarkSelection: {
    selectedBenchmark: string;
    benchmarkValue: number;
    percentageRange: { min: number; max: number };
    justification: string;
    alternativeBenchmarks: AlternativeBenchmark[];
  };
  step3_riskAdjustedPercentage: {
    basePercentage: number;
    adjustments: RiskAdjustment[];
    finalPercentage: number;
    adjustmentRationale: string;
  };
  step4_materialityLevels: {
    overallMateriality: number;
    performanceMateriality: number;
    performanceMaterialityPercentage: number;
    trivialThreshold: number;
    trivialThresholdPercentage: number;
    calculationFormulas: {
      overall: string;
      performance: string;
      trivial: string;
    };
  };
  step5_qualitativeFactors: {
    factors: QualitativeFactor[];
    impactAssessment: string;
    adjustmentRecommendation: string;
  };
  step6_riskAssessmentLinkage: {
    significantFSHeads: SignificantFSHead[];
    riskRatingsImpact: string;
    analyticalProcedureThresholds: {
      significantVariance: number;
      investigationThreshold: number;
    };
    samplingParameters: {
      suggestedConfidenceLevel: number;
      tolerableMisstatement: number;
      expectedError: number;
    };
  };
  step7_partnerOverride: PartnerOverrideStructure;
  step8_documentation: DocumentationOutput;
}

interface ISA320MaterialityPanelProps {
  engagementId: string;
  onMaterialityCalculated?: (result: ISA320MaterialityResult) => void;
  className?: string;
}

const STEP_ICONS = {
  1: Database,
  2: Target,
  3: TrendingDown,
  4: Calculator,
  5: Shield,
  6: BarChart3,
  7: Users,
  8: FileText,
};

const STEP_TITLES = {
  1: "Data Ingestion Summary",
  2: "Benchmark Selection",
  3: "Risk-Adjusted Percentage",
  4: "Materiality Levels",
  5: "Qualitative Factors Assessment",
  6: "Risk Assessment Linkage",
  7: "Partner Override Section",
  8: "Documentation Output",
};

const QUALITATIVE_FACTOR_LABELS: Record<string, string> = {
  fraudRiskPresent: "Fraud Risk Present",
  goingConcernUncertainty: "Going Concern Uncertainty",
  regulatorySensitivity: "Regulatory Sensitivity",
  debtCovenantCompliance: "Debt Covenant Compliance",
  relatedPartyDominance: "Related Party Dominance",
  industrySpecificSensitivity: "Industry-Specific Sensitivity",
  publicInterestConsiderations: "Public Interest Considerations",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StepHeader({
  step,
  title,
  isOpen,
  onToggle,
}: {
  step: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = STEP_ICONS[step as keyof typeof STEP_ICONS];
  return (
    <CollapsibleTrigger asChild>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-2.5 hover-elevate rounded-md transition-colors"
        data-testid={`step-${step}-toggle`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm text-muted-foreground">Step {step}</div>
            <div className="font-medium">{title}</div>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
    </CollapsibleTrigger>
  );
}

function DataIngestionStep({ data }: { data: ISA320MaterialityResult["step1_dataIngestion"] }) {
  const sourceItems = [
    { label: "Revenue", value: data.revenue, priorYear: data.priorYearRevenue },
    { label: "Total Assets", value: data.totalAssets, priorYear: data.priorYearAssets },
    { label: "Total Equity", value: data.totalEquity, priorYear: null },
    { label: "Profit Before Tax", value: data.profitBeforeTax, priorYear: data.priorYearPBT },
  ];

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="grid grid-cols-2 gap-2.5">
        {sourceItems.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border p-3"
            data-testid={`data-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="text-sm text-muted-foreground">{item.label}</div>
            <div className="text-lg font-semibold">{formatCurrency(item.value)}</div>
            {item.priorYear !== null && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <span>Prior Year:</span>
                <span className="font-medium">{formatCurrency(item.priorYear)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-2.5 text-sm">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Entity Type:</span>
            <Badge variant="outline">{data.entityType || "Not specified"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Industry:</span>
            <Badge variant="outline">{data.industry || "Not specified"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ownership:</span>
            <span>{data.ownershipStructure || "Not specified"}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fraud Risks:</span>
            <Badge
              variant={data.fraudRisksIdentified > 0 ? "destructive" : "secondary"}
              data-testid="badge-fraud-risks"
            >
              {data.fraudRisksIdentified} identified
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Significant Risks:</span>
            <Badge
              variant={data.significantRisksIdentified > 2 ? "destructive" : "secondary"}
              data-testid="badge-significant-risks"
            >
              {data.significantRisksIdentified} identified
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">FS Level Risks:</span>
            <span>{data.fsLevelRisks.length} factors</span>
          </div>
        </div>
      </div>

      {data.fsLevelRisks.length > 0 && (
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="mb-2 text-sm font-medium">FS Level Risk Factors:</div>
          <div className="flex flex-wrap gap-1">
            {data.fsLevelRisks.map((risk, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {risk}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BenchmarkSelectionStep({ data }: { data: ISA320MaterialityResult["step2_benchmarkSelection"] }) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="rounded-lg border-2 border-primary bg-primary/5 p-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <Badge className="mb-2 bg-primary" data-testid="badge-selected-benchmark">
              Selected Benchmark
            </Badge>
            <div className="text-xl font-bold">{data.selectedBenchmark}</div>
            <div className="text-lg font-bold text-primary">{formatCurrency(data.benchmarkValue)}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Acceptable Range: {data.percentageRange.min}% - {data.percentageRange.max}%
            </div>
          </div>
          <Target className="h-10 w-10 text-primary opacity-50" />
        </div>
      </div>

      <div className="rounded-lg bg-muted/30 p-3">
        <div className="mb-1 text-sm font-medium">Justification</div>
        <p className="text-sm text-muted-foreground">{data.justification}</p>
      </div>

      <Collapsible open={showAlternatives} onOpenChange={setShowAlternatives}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            data-testid="button-show-alternatives"
          >
            <span>Alternative Benchmarks Considered ({data.alternativeBenchmarks.length})</span>
            {showAlternatives ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {data.alternativeBenchmarks.map((alt, idx) => (
            <div key={idx} className="rounded-lg border p-3" data-testid={`alternative-benchmark-${idx}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{alt.benchmark}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(alt.value)} ({alt.percentageRange})
                  </div>
                </div>
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium">Not selected: </span>
                {alt.reasonNotSelected}
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function RiskAdjustedPercentageStep({ data }: { data: ISA320MaterialityResult["step3_riskAdjustedPercentage"] }) {
  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="flex items-center justify-between rounded-lg border p-2.5">
        <div>
          <div className="text-sm text-muted-foreground">Base Percentage</div>
          <div className="text-lg font-bold">{formatPercentage(data.basePercentage)}</div>
        </div>
        <ArrowRight className="h-6 w-6 text-muted-foreground" />
        <div>
          <div className="text-sm text-muted-foreground">Final Percentage</div>
          <div className="text-lg font-bold text-primary" data-testid="final-percentage">
            {formatPercentage(data.finalPercentage)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Risk Adjustments</div>
        {data.adjustments.map((adj, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              adj.applied ? "bg-orange-50 dark:bg-orange-950/20" : "bg-muted/30"
            )}
            data-testid={`adjustment-${idx}`}
          >
            {adj.applied ? (
              <ArrowDown className="mt-0.5 h-4 w-4 text-orange-600" />
            ) : (
              <MinusCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{adj.factor}</span>
                <Badge variant={adj.applied ? "destructive" : "secondary"}>
                  {adj.applied ? `${adj.adjustment}%` : "No Adjustment"}
                </Badge>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{adj.description}</div>
              <div className="mt-1 text-xs text-muted-foreground italic">{adj.rationale}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted/30 p-3">
        <div className="mb-1 text-sm font-medium">Adjustment Rationale</div>
        <p className="text-sm text-muted-foreground">{data.adjustmentRationale}</p>
      </div>
    </div>
  );
}

function MaterialityLevelsStep({ data }: { data: ISA320MaterialityResult["step4_materialityLevels"] }) {
  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="grid gap-2.5 md:grid-cols-3">
        <Card className="border-2 border-primary" data-testid="card-overall-materiality">
          <CardHeader className="pb-2">
            <CardDescription>Overall Materiality</CardDescription>
            <CardTitle className="text-xl text-primary">{formatCurrency(data.overallMateriality)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded bg-muted/50 p-2 text-xs font-mono">{data.calculationFormulas.overall}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-performance-materiality">
          <CardHeader className="pb-2">
            <CardDescription>Performance Materiality</CardDescription>
            <CardTitle className="text-lg">{formatCurrency(data.performanceMateriality)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <Badge variant="outline">{data.performanceMaterialityPercentage}% of Overall</Badge>
            </div>
            <div className="rounded bg-muted/50 p-2 text-xs font-mono">{data.calculationFormulas.performance}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-trivial-threshold">
          <CardHeader className="pb-2">
            <CardDescription>Trivial Threshold</CardDescription>
            <CardTitle className="text-lg">{formatCurrency(data.trivialThreshold)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <Badge variant="outline">{data.trivialThresholdPercentage}% of PM</Badge>
            </div>
            <div className="rounded bg-muted/50 p-2 text-xs font-mono">{data.calculationFormulas.trivial}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QualitativeFactorsStep({ data }: { data: ISA320MaterialityResult["step5_qualitativeFactors"] }) {
  const getImpactColor = (level: string) => {
    switch (level) {
      case "HIGH":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "MEDIUM":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "LOW":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="grid gap-2">
        {data.factors.map((factor, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-lg border p-3"
            data-testid={`factor-${factor.factor}`}
          >
            {factor.present ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {QUALITATIVE_FACTOR_LABELS[factor.factor] || factor.factor}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={factor.present ? "default" : "outline"}>
                    {factor.present ? "Yes" : "No"}
                  </Badge>
                  <Badge className={getImpactColor(factor.impactLevel)}>{factor.impactLevel}</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{factor.assessment}</p>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="mb-1 text-sm font-medium">Impact Assessment</div>
          <p className="text-sm text-muted-foreground">{data.impactAssessment}</p>
        </div>

        {data.adjustmentRecommendation && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Recommendation</AlertTitle>
            <AlertDescription>{data.adjustmentRecommendation}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

function RiskAssessmentLinkageStep({ data }: { data: ISA320MaterialityResult["step6_riskAssessmentLinkage"] }) {
  const getRiskBadgeVariant = (rating: string) => {
    switch (rating.toUpperCase()) {
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      {data.significantFSHeads.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium">
            Significant FS Heads (Balance {">"} Materiality)
          </div>
          <div className="space-y-2">
            {data.significantFSHeads.map((head, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border p-3"
                data-testid={`fs-head-${idx}`}
              >
                <div>
                  <div className="font-medium">{head.accountName}</div>
                  <div className="text-sm text-muted-foreground">{formatCurrency(head.balance)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {head.percentOfMateriality.toFixed(0)}% of Materiality
                  </span>
                  <Badge variant={getRiskBadgeVariant(head.riskRating)}>{head.riskRating}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div className="grid gap-2.5 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-medium">Analytical Procedure Thresholds</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Significant Variance:</span>
              <span className="font-medium">{formatCurrency(data.analyticalProcedureThresholds.significantVariance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Investigation Threshold:</span>
              <span className="font-medium">
                {formatCurrency(data.analyticalProcedureThresholds.investigationThreshold)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-medium">Sampling Parameters</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confidence Level:</span>
              <span className="font-medium">{data.samplingParameters.suggestedConfidenceLevel}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tolerable Misstatement:</span>
              <span className="font-medium">{formatCurrency(data.samplingParameters.tolerableMisstatement)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected Error:</span>
              <span className="font-medium">{formatCurrency(data.samplingParameters.expectedError)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-muted/30 p-3">
        <div className="mb-1 text-sm font-medium">Risk Ratings Impact</div>
        <p className="text-sm text-muted-foreground">{data.riskRatingsImpact}</p>
      </div>
    </div>
  );
}

function PartnerOverrideStep({ data }: { data: ISA320MaterialityResult["step7_partnerOverride"] }) {
  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="flex items-center justify-between rounded-lg border p-2.5">
        <div className="flex items-center gap-3">
          {data.overrideEnabled ? (
            <Lock className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          )}
          <div>
            <div className="font-medium">Override Status</div>
            <div className="text-sm text-muted-foreground">
              {data.overrideEnabled ? "Override is enabled" : "No override applied - using calculated values"}
            </div>
          </div>
        </div>
        <Badge variant={data.overrideEnabled ? "destructive" : "secondary"} data-testid="badge-override-status">
          {data.overrideEnabled ? "Override Active" : "Standard"}
        </Badge>
      </div>

      {data.overrideEnabled && data.currentOverride && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="mb-3 font-medium text-amber-800 dark:text-amber-200">Current Override Details</div>
          <div className="space-y-2 text-sm">
            {data.currentOverride.reason && (
              <div>
                <span className="text-muted-foreground">Reason: </span>
                <span>{data.currentOverride.reason}</span>
              </div>
            )}
            {data.currentOverride.revisedValue && (
              <div>
                <span className="text-muted-foreground">Revised Value: </span>
                <span className="font-medium">{formatCurrency(data.currentOverride.revisedValue)}</span>
              </div>
            )}
            {data.currentOverride.impactAssessment && (
              <div>
                <span className="text-muted-foreground">Impact Assessment: </span>
                <span>{data.currentOverride.impactAssessment}</span>
              </div>
            )}
            {data.currentOverride.approvalTimestamp && (
              <div>
                <span className="text-muted-foreground">Approved: </span>
                <span>{formatDate(data.currentOverride.approvalTimestamp)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-2.5 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-medium">Override Fields Available</div>
          <div className="flex flex-wrap gap-1">
            {data.overrideFields.map((field, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {field}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-medium">Required Fields for Override</div>
          <div className="flex flex-wrap gap-1">
            {data.requiredFields.map((field, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {field}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentationOutputStep({ data }: { data: ISA320MaterialityResult["step8_documentation"] }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { firm } = useAuth();

  const copyToClipboard = async (text: string, field: string) => {
    const textToWrite = field === "all"
      ? `${firm?.displayName || firm?.name || "AuditWise"}\n=== ISA 320 MATERIALITY DOCUMENTATION ===\nGenerated: ${new Date().toLocaleDateString()}\n\n${text}`
      : text;
    await navigator.clipboard.writeText(textToWrite);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const docSections = [
    { key: "benchmark", title: "Benchmark Selection Rationale", content: data.benchmarkSelectionRationale },
    { key: "selected", title: "Selected Benchmark & Percentage", content: data.selectedBenchmarkAndPercentage },
    { key: "overall", title: "Overall Materiality Summary", content: data.overallMaterialitySummary },
    { key: "pm", title: "Performance Materiality Summary", content: data.performanceMaterialitySummary },
    { key: "trivial", title: "Trivial Threshold Summary", content: data.trivialThresholdSummary },
    { key: "planning", title: "Impact on Audit Planning", content: data.impactOnAuditPlanning },
  ];

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      {docSections.map((section) => (
        <div key={section.key} className="rounded-lg border p-3" data-testid={`doc-${section.key}`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">{section.title}</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(section.content, section.key)}
              data-testid={`button-copy-${section.key}`}
            >
              {copiedField === section.key ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
        </div>
      ))}

      {data.qualitativeFactorsConsidered.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Qualitative Factors Considered</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(data.qualitativeFactorsConsidered.join("\n"), "qualitative")}
              data-testid="button-copy-qualitative"
            >
              {copiedField === "qualitative" ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {data.qualitativeFactorsConsidered.map((factor, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="mb-2 flex items-center gap-2">
          <Scale className="h-4 w-4 text-blue-600" />
          <div className="text-sm font-medium text-blue-800 dark:text-blue-200">ISA References</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.isaReferences.map((ref, idx) => (
            <Badge key={idx} variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
              {ref}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            const allContent = docSections.map((s) => `${s.title}:\n${s.content}`).join("\n\n");
            copyToClipboard(allContent, "all");
          }}
          data-testid="button-copy-all"
        >
          <ClipboardCopy className="mr-2 h-4 w-4" />
          Copy All Documentation
          {copiedField === "all" && <Check className="ml-2 h-4 w-4 text-green-600" />}
        </Button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border p-2.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ISA320MaterialityPanel({
  engagementId,
  onMaterialityCalculated,
  className,
}: ISA320MaterialityPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set([4]));

  const toggleStep = (step: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  const {
    data: savedAnalysis,
    isLoading: isLoadingSaved,
    error: loadError,
  } = useQuery<ISA320MaterialityResult>({
    queryKey: ["/api/isa320-materiality", engagementId],
    enabled: !!engagementId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/isa320-materiality/${engagementId}/analyze`, {});
      return response.json();
    },
    onSuccess: (data: ISA320MaterialityResult) => {
      toast({
        title: "Analysis Complete",
        description: "ISA 320 Materiality analysis has been calculated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/isa320-materiality", engagementId] });
      onMaterialityCalculated?.(data);
      setOpenSteps(new Set([1, 2, 3, 4]));
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to run materiality analysis.",
        variant: "destructive",
      });
    },
  });

  const result = savedAnalysis;

  if (!engagementId) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No Engagement Selected</AlertTitle>
        <AlertDescription>Please select an engagement to run materiality analysis.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={cn("", className)} data-testid="isa320-materiality-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-2.5 space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Brain className="h-5 w-5 text-primary" />
            ISA 320 Materiality Analysis
          </CardTitle>
          <CardDescription>
            AI-driven 8-step materiality determination per ISA 320
          </CardDescription>
        </div>
        <Button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          data-testid="button-run-analysis"
        >
          {analyzeMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              {result ? "Re-analyze" : "Run Analysis"}
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent>
        {isLoadingSaved && <LoadingSkeleton />}

        {loadError && !result && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Analysis Found</AlertTitle>
            <AlertDescription>
              Click "Run Analysis" to generate ISA 320 materiality calculations for this engagement.
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-2">
            <div className="mb-2.5 flex items-center justify-between rounded-lg bg-muted/30 p-3">
              <div className="text-sm text-muted-foreground">
                Last analyzed: {formatDate(result.analysisTimestamp)}
              </div>
              <Badge variant="secondary" data-testid="badge-analysis-timestamp">
                Complete
              </Badge>
            </div>

            {([1, 2, 3, 4, 5, 6, 7, 8] as const).map((step) => (
              <Collapsible key={step} open={openSteps.has(step)} onOpenChange={() => toggleStep(step)}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={step}
                    title={STEP_TITLES[step]}
                    isOpen={openSteps.has(step)}
                    onToggle={() => toggleStep(step)}
                  />
                  <CollapsibleContent>
                    {step === 1 && result.step1_dataIngestion && <DataIngestionStep data={result.step1_dataIngestion} />}
                    {step === 2 && result.step2_benchmarkSelection && <BenchmarkSelectionStep data={result.step2_benchmarkSelection} />}
                    {step === 3 && result.step3_riskAdjustedPercentage && <RiskAdjustedPercentageStep data={result.step3_riskAdjustedPercentage} />}
                    {step === 4 && result.step4_materialityLevels && <MaterialityLevelsStep data={result.step4_materialityLevels} />}
                    {step === 5 && result.step5_qualitativeFactors && <QualitativeFactorsStep data={result.step5_qualitativeFactors} />}
                    {step === 6 && result.step6_riskAssessmentLinkage && <RiskAssessmentLinkageStep data={result.step6_riskAssessmentLinkage} />}
                    {step === 7 && result.step7_partnerOverride && <PartnerOverrideStep data={result.step7_partnerOverride} />}
                    {step === 8 && result.step8_documentation && <DocumentationOutputStep data={result.step8_documentation} />}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type { ISA320MaterialityResult };
