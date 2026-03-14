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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertCircle,
  Shield,
  FileText,
  Copy,
  Check,
  Loader2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Scale,
  BarChart3,
  Users,
  ClipboardCopy,
  Info,
  Layers,
  PieChart,
  FileOutput,
  BookOpen,
  Download,
  Save,
  List,
  Link2,
  Shuffle,
  Grid3X3,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FSLevelRisk {
  id: string;
  description: string;
  source: string;
  severity: 'High' | 'Medium' | 'Low';
  impactedAreas: string[];
  isFraudIndicator: boolean;
}

interface AssertionLevelRisk {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  inherentRisk: 'High' | 'Medium' | 'Low';
  controlRisk: 'High' | 'Medium' | 'Low';
  combinedRisk: 'High' | 'Medium' | 'Low';
  wcgw: string;
}

interface SignificantRisk {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  riskDescription: string;
  rationale: string;
  isPresumedFraudRisk: boolean;
}

interface FraudRisk {
  id: string;
  type: 'Revenue Recognition' | 'Management Override' | 'Misappropriation' | 'Other';
  description: string;
  affectedAreas: string[];
  likelihood: 'High' | 'Medium' | 'Low';
  magnitude: 'High' | 'Medium' | 'Low';
}

interface MaterialityInputs {
  overallMateriality: number;
  performanceMateriality: number;
  trivialThreshold: number;
  fsHeadSpecificThresholds: FSHeadThreshold[];
}

interface FSHeadThreshold {
  fsHeadKey: string;
  fsHeadLabel: string;
  lowerMateriality: number;
  rationale: string;
}

interface StrategyApproach {
  controlsRelianceDecision: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
  auditApproach: 'Substantive-based' | 'Controls-reliant' | 'Combined';
  areasOfFocus: string[];
  substantiveEmphasis: string[];
}

interface CoAMapping {
  fsHeadKey: string;
  fsHeadLabel: string;
  glAccounts: GLAccountMapping[];
  totalBalance: number;
  transactionCount: number;
}

interface GLAccountMapping {
  glCode: string;
  accountName: string;
  closingBalance: number;
  transactionCount: number;
}

interface PopulationDefinition {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  description: string;
  periodCovered: { start: string; end: string };
  totalValue: number;
  totalTransactionCount: number;
  completenessConfirmed: boolean;
  completenessMethod: string;
  populationType: 'Transactions' | 'Balances' | 'Disclosures';
  sourceData: string;
}

interface SamplingApproachConfig {
  approach: 'Statistical' | 'Non-Statistical';
  rationale: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  assertionTested: string;
  expectedMisstatement: 'High' | 'Medium' | 'Low' | 'None';
  controlsReliance: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
  isaReference: string;
}

interface SampleSizeCalculation {
  populationId: string;
  confidenceLevel: number;
  tolerableError: number;
  expectedError: number;
  baseSampleSize: number;
  adjustments: SampleSizeAdjustment[];
  finalSampleSize: number;
  calculationMethod: string;
  formulaUsed: string;
}

interface SampleSizeAdjustment {
  factor: string;
  description: string;
  adjustment: number;
  applied: boolean;
  rationale: string;
}

interface Stratum {
  id: string;
  populationId: string;
  stratumType: 'High-Value' | 'Unusual' | 'Related Party' | 'Manual Journal' | 'Year-End' | 'Post-Closing' | 'Standard';
  description: string;
  totalValue: number;
  transactionCount: number;
  samplingApproach: 'Key Item (100%)' | 'Sample' | 'Exclude';
  sampleSize: number | null;
  rationale: string;
}

interface StratificationPlan {
  populationId: string;
  isStratified: boolean;
  stratificationRationale: string;
  strata: Stratum[];
  mutuallyExclusiveConfirmed: boolean;
  collectivelyExhaustiveConfirmed: boolean;
}

interface SelectionMethodConfig {
  method: string;
  isAutomated: boolean;
  rationale: string;
  parameters: Record<string, unknown>;
}

interface ManualSelectionJustification {
  reason: string;
  riskAssertion: string;
  auditorId: string;
  approvedBy: string | null;
  approvalTimestamp: string | null;
}

interface SampleItem {
  id: string;
  transactionId: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  amount: number;
  selectionMethod: string;
  populationReference: string;
  stratumReference: string | null;
  riskReference: string | null;
  testStatus: 'Planned' | 'In Progress' | 'Tested' | 'Exception' | 'N/A';
  auditProcedureId: string | null;
  workpaperTemplateId: string | null;
  evidenceUploadSlot: string | null;
  exceptionTracking: ExceptionRecord | null;
  manualJustification: ManualSelectionJustification | null;
}

interface ExceptionRecord {
  exceptionId: string;
  description: string;
  amount: number;
  status: 'Open' | 'Resolved' | 'Projected';
  resolution: string | null;
}

interface AuditProgramLink {
  sampleItemId: string;
  procedureId: string;
  procedureDescription: string;
  workpaperId: string | null;
  evidenceStatus: 'Pending' | 'Uploaded' | 'Reviewed' | 'Approved';
}

interface DocumentationOutput {
  populationDefinitionSummary: string;
  samplingApproachSummary: string;
  sampleSizeCalculationSummary: string;
  tolerableExpectedErrorSummary: string;
  stratificationApproachSummary: string;
  selectionMethodsSummary: string;
  sampleListSummary: string;
  isaReferences: string[];
}

interface QualityGate {
  passed: boolean;
  gate: string;
  message: string;
  isaReference: string;
}

interface QualityGates {
  isa530Compliance: QualityGate;
  populationCompletenessConfirmed: QualityGate;
  riskLinkedSampleDesign: QualityGate;
  manualSelectionsJustified: QualityGate;
  reproducibleSampleLogic: QualityGate;
  auditTrailComplete: QualityGate;
  overallPassed: boolean;
}

export interface ISA530SamplingResult {
  engagementId: string;
  analysisTimestamp: string;
  step1_requiredInputs: {
    riskAssessment: {
      fsLevelRisks: FSLevelRisk[];
      assertionLevelRisks: AssertionLevelRisk[];
      significantRisks: SignificantRisk[];
      fraudRisks: FraudRisk[];
    };
    materiality: MaterialityInputs;
    strategyApproach: StrategyApproach;
    coaMappings: CoAMapping[];
  };
  step2_populations: PopulationDefinition[];
  step3_samplingApproaches: { populationId: string; config: SamplingApproachConfig }[];
  step4_sampleSizeCalculations: SampleSizeCalculation[];
  step5_stratificationPlans: StratificationPlan[];
  step6_selectionMethods: { populationId: string; methods: SelectionMethodConfig[] }[];
  step7_sampleList: SampleItem[];
  step8_auditProgramLinks: AuditProgramLink[];
  step9_documentation: DocumentationOutput;
  qualityGates: QualityGates;
}

interface ISA530SamplingPanelProps {
  engagementId: number;
  onSamplingGenerated?: (sampling: ISA530SamplingResult) => void;
  className?: string;
}

const STEP_ICONS = {
  1: Database,
  2: Target,
  3: PieChart,
  4: Calculator,
  5: Layers,
  6: Shuffle,
  7: List,
  8: Link2,
  9: FileOutput,
};

const STEP_TITLES = {
  1: "Required Inputs Summary",
  2: "Population Definitions (ISA 530.5)",
  3: "Sampling Approaches",
  4: "Sample Size Calculations",
  5: "Stratification Plans",
  6: "Selection Methods",
  7: "Sample Lists",
  8: "Audit Program Links",
  9: "Documentation Output",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
  isImportant = false,
}: {
  step: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  isImportant?: boolean;
}) {
  const Icon = STEP_ICONS[step as keyof typeof STEP_ICONS];
  return (
    <CollapsibleTrigger asChild>
      <button
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between p-2.5 hover-elevate rounded-md transition-colors",
          isImportant && "bg-primary/5"
        )}
        data-testid={`step-${step}-toggle`}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            isImportant ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Step {step}</span>
              {isImportant && (
                <Badge variant="default" className="text-xs">Important</Badge>
              )}
            </div>
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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      data-testid={`copy-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

function Step1RequiredInputs({ data }: { data: ISA530SamplingResult['step1_requiredInputs'] }) {
  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div className="rounded-lg border p-3" data-testid="count-significant-risks">
          <div className="text-sm text-muted-foreground">Significant Risks</div>
          <div className="text-lg font-bold">{data.riskAssessment.significantRisks.length}</div>
        </div>
        <div className="rounded-lg border p-3" data-testid="count-fraud-risks">
          <div className="text-sm text-muted-foreground">Fraud Risks</div>
          <div className="text-lg font-bold text-destructive">{data.riskAssessment.fraudRisks.length}</div>
        </div>
        <div className="rounded-lg border p-3" data-testid="count-fs-level-risks">
          <div className="text-sm text-muted-foreground">FS-Level Risks</div>
          <div className="text-lg font-bold">{data.riskAssessment.fsLevelRisks.length}</div>
        </div>
        <div className="rounded-lg border p-3" data-testid="count-assertion-risks">
          <div className="text-sm text-muted-foreground">Assertion-Level Risks</div>
          <div className="text-lg font-bold">{data.riskAssessment.assertionLevelRisks.length}</div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-2.5 md:grid-cols-3">
        <Card data-testid="card-overall-materiality">
          <CardHeader className="pb-2">
            <CardDescription>Overall Materiality</CardDescription>
            <CardTitle className="text-xl text-primary">{formatCurrency(data?.materiality?.overallMateriality ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-performance-materiality">
          <CardHeader className="pb-2">
            <CardDescription>Performance Materiality</CardDescription>
            <CardTitle className="text-xl">{formatCurrency(data?.materiality?.performanceMateriality ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-trivial-threshold">
          <CardHeader className="pb-2">
            <CardDescription>Trivial Threshold</CardDescription>
            <CardTitle className="text-xl">{formatCurrency(data?.materiality?.trivialThreshold ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Separator />

      <div>
        <div className="mb-2 text-sm font-medium">Strategy Approach</div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" data-testid="badge-audit-approach">
            Audit: {data.strategyApproach.auditApproach}
          </Badge>
          <Badge variant="outline" data-testid="badge-controls-reliance">
            Controls: {data.strategyApproach.controlsRelianceDecision}
          </Badge>
        </div>
        {data.strategyApproach.areasOfFocus.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">Areas of Focus: </span>
            <span className="text-sm">{data.strategyApproach.areasOfFocus.join(", ")}</span>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">CoA Mappings</span>
          <Badge variant="secondary">{data.coaMappings.length} FS Heads</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {data.coaMappings.slice(0, 6).map((mapping, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>{mapping.fsHeadLabel}</span>
              <Badge variant="outline" className="text-xs">{formatCurrency(Math.abs(mapping.totalBalance))}</Badge>
            </div>
          ))}
        </div>
        {data.coaMappings.length > 6 && (
          <div className="mt-2 text-xs text-muted-foreground text-center">
            +{data.coaMappings.length - 6} more FS Heads
          </div>
        )}
      </div>
    </div>
  );
}

function Step2Populations({ data }: { data: PopulationDefinition[] }) {
  if (data.length === 0) {
    return (
      <div className="p-2.5 pt-0">
        <div className="rounded-lg border border-dashed p-3 text-center">
          <Target className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No populations defined yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>FS Head</TableHead>
            <TableHead>Assertion</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead>Complete</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((pop) => (
            <TableRow key={pop.id} data-testid={`population-${pop.id}`}>
              <TableCell className="font-medium">{pop.fsHeadLabel}</TableCell>
              <TableCell>
                <Badge variant="outline">{pop.assertion}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">{pop.populationType}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {pop.periodCovered.start} - {pop.periodCovered.end}
              </TableCell>
              <TableCell className="text-right">{formatCurrency(pop.totalValue)}</TableCell>
              <TableCell className="text-right">{pop.totalTransactionCount}</TableCell>
              <TableCell>
                {pop.completenessConfirmed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530.5 - Defining the Population</span>
      </div>
    </div>
  );
}

function Step3SamplingApproaches({ 
  data, 
  populations 
}: { 
  data: { populationId: string; config: SamplingApproachConfig }[]; 
  populations: PopulationDefinition[];
}) {
  const getApproachColor = (approach: string) => {
    return approach === 'Statistical' 
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return '';
    }
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      {data.map((item) => {
        const pop = populations.find(p => p.id === item.populationId);
        return (
          <div key={item.populationId} className="rounded-lg border p-2.5" data-testid={`approach-${item.populationId}`}>
            <div className="flex items-start justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{pop?.fsHeadLabel || item.populationId}</span>
                  <Badge variant="outline">{pop?.assertion}</Badge>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getApproachColor(item.config.approach)}>{item.config.approach}</Badge>
                  <Badge className={getRiskColor(item.config.riskLevel)}>Risk: {item.config.riskLevel}</Badge>
                  <Badge variant="secondary">Expected Misstatement: {item.config.expectedMisstatement}</Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{item.config.rationale}</p>
            <div className="mt-2 text-xs text-muted-foreground">{item.config.isaReference}</div>
          </div>
        );
      })}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530.7-8 - Statistical vs Non-Statistical Sampling</span>
      </div>
    </div>
  );
}

function Step4SampleSizeCalculations({ 
  data, 
  populations 
}: { 
  data: SampleSizeCalculation[]; 
  populations: PopulationDefinition[];
}) {
  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      {data.map((calc) => {
        const pop = populations.find(p => p.id === calc.populationId);
        const appliedAdjustments = calc.adjustments.filter(a => a.applied);
        
        return (
          <div key={calc.populationId} className="rounded-lg border p-2.5" data-testid={`calculation-${calc.populationId}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="font-medium">{pop?.fsHeadLabel || calc.populationId}</span>
                <Badge variant="outline" className="ml-2">{pop?.assertion}</Badge>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">{calc.finalSampleSize}</div>
                <div className="text-xs text-muted-foreground">Final Sample Size</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="rounded-lg bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="font-medium">{calc.confidenceLevel}%</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">Tolerable Error</div>
                <div className="font-medium">{formatCurrency(calc.tolerableError)}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">Expected Error</div>
                <div className="font-medium">{formatCurrency(calc.expectedError)}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">Base Size</div>
                <div className="font-medium">{calc.baseSampleSize}</div>
              </div>
            </div>

            {appliedAdjustments.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1">Adjustments Applied:</div>
                <div className="space-y-1">
                  {appliedAdjustments.map((adj, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{adj.factor}</span>
                      <Badge variant="outline" className="text-xs">+{adj.adjustment}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Method: {calc.calculationMethod}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530.A10-A13 - Sample Size Determination</span>
      </div>
    </div>
  );
}

function Step5StratificationPlans({ 
  data, 
  populations 
}: { 
  data: StratificationPlan[]; 
  populations: PopulationDefinition[];
}) {
  const getStratumColor = (type: string) => {
    switch (type) {
      case 'High-Value': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Unusual': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Related Party': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Manual Journal': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      {data.map((plan) => {
        const pop = populations.find(p => p.id === plan.populationId);
        
        return (
          <div key={plan.populationId} className="rounded-lg border p-2.5" data-testid={`stratification-${plan.populationId}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{pop?.fsHeadLabel || plan.populationId}</span>
                <Badge variant={plan.isStratified ? "default" : "secondary"}>
                  {plan.isStratified ? "Stratified" : "Not Stratified"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {plan.mutuallyExclusiveConfirmed && (
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                    Mutually Exclusive
                  </Badge>
                )}
                {plan.collectivelyExhaustiveConfirmed && (
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                    Collectively Exhaustive
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">{plan.stratificationRationale}</p>

            {plan.strata.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stratum</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead>Approach</TableHead>
                    <TableHead className="text-right">Sample</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.strata.map((stratum) => (
                    <TableRow key={stratum.id}>
                      <TableCell className="text-sm">{stratum.description}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", getStratumColor(stratum.stratumType))}>
                          {stratum.stratumType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(stratum.totalValue)}</TableCell>
                      <TableCell className="text-right">{stratum.transactionCount}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{stratum.samplingApproach}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {stratum.sampleSize !== null ? stratum.sampleSize : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530.A6 - Stratification of Population</span>
      </div>
    </div>
  );
}

function Step6SelectionMethods({ 
  data, 
  populations 
}: { 
  data: { populationId: string; methods: SelectionMethodConfig[] }[]; 
  populations: PopulationDefinition[];
}) {
  const getMethodIcon = (method: string, isAutomated: boolean) => {
    if (isAutomated) {
      return <Shuffle className="h-4 w-4 text-primary" />;
    }
    return <Users className="h-4 w-4 text-amber-600" />;
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      {data.map((item) => {
        const pop = populations.find(p => p.id === item.populationId);
        const automatedMethods = item.methods.filter(m => m.isAutomated);
        const manualMethods = item.methods.filter(m => !m.isAutomated);
        
        return (
          <div key={item.populationId} className="rounded-lg border p-2.5" data-testid={`selection-${item.populationId}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="font-medium">{pop?.fsHeadLabel || item.populationId}</span>
              <Badge variant="outline">{pop?.assertion}</Badge>
            </div>

            {automatedMethods.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-2">Automated Methods</div>
                <div className="space-y-2">
                  {automatedMethods.map((method, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg bg-primary/5 p-2">
                      {getMethodIcon(method.method, method.isAutomated)}
                      <div>
                        <Badge variant="default">{method.method}</Badge>
                        <p className="text-sm text-muted-foreground mt-1">{method.rationale}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {manualMethods.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-2">Manual Selections</div>
                <div className="space-y-2">
                  {manualMethods.map((method, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-2">
                      {getMethodIcon(method.method, method.isAutomated)}
                      <div>
                        <Badge variant="secondary">{method.method}</Badge>
                        <p className="text-sm text-muted-foreground mt-1">{method.rationale}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530.A14-A16 - Sample Selection Methods</span>
      </div>
    </div>
  );
}

function Step7SampleList({ data, onExport }: { data: SampleItem[]; onExport: () => void }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Planned': return <Badge variant="secondary">{status}</Badge>;
      case 'In Progress': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{status}</Badge>;
      case 'Tested': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{status}</Badge>;
      case 'Exception': return <Badge variant="destructive">{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (data.length === 0) {
    return (
      <div className="p-2.5 pt-0">
        <div className="rounded-lg border border-dashed p-3 text-center">
          <List className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No samples generated yet.</p>
        </div>
      </div>
    );
  }

  const summary = {
    total: data.length,
    planned: data.filter(s => s.testStatus === 'Planned').length,
    inProgress: data.filter(s => s.testStatus === 'In Progress').length,
    tested: data.filter(s => s.testStatus === 'Tested').length,
    exception: data.filter(s => s.testStatus === 'Exception').length,
    totalValue: data.reduce((sum, s) => sum + s.amount, 0),
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total:</span>
            <Badge variant="default">{summary.total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Planned:</span>
            <Badge variant="secondary">{summary.planned}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tested:</span>
            <Badge className="bg-green-100 text-green-800">{summary.tested}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Exceptions:</span>
            <Badge variant="destructive">{summary.exception}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} data-testid="button-export-samples">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="rounded-lg border overflow-auto max-h-96">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sample ID</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>FS Head</TableHead>
              <TableHead>Assertion</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 50).map((sample) => (
              <TableRow key={sample.id} data-testid={`sample-${sample.id}`}>
                <TableCell className="font-mono text-xs">{sample.id}</TableCell>
                <TableCell className="font-mono text-xs">{sample.transactionId}</TableCell>
                <TableCell className="text-sm">{sample.fsHeadLabel}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{sample.assertion}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(sample.amount)}</TableCell>
                <TableCell className="text-xs">{sample.selectionMethod}</TableCell>
                <TableCell>{getStatusBadge(sample.testStatus)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {data.length > 50 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing 50 of {data.length} samples. Export for full list.
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530.14 - Documentation of Selected Items</span>
      </div>
    </div>
  );
}

function Step8AuditProgramLinks({ 
  data, 
  samples 
}: { 
  data: AuditProgramLink[]; 
  samples: SampleItem[];
}) {
  const getEvidenceStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Reviewed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Uploaded': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'Pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default: return '';
    }
  };

  const orphanSamples = samples.filter(s => 
    !data.some(link => link.sampleItemId === s.id)
  );

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      {orphanSamples.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Orphan Samples Detected</AlertTitle>
          <AlertDescription>
            {orphanSamples.length} sample(s) do not have audit program linkages.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-lg font-bold">{data.length}</div>
          <div className="text-xs text-muted-foreground">Total Linkages</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-lg font-bold text-green-600">{data.filter(l => l.evidenceStatus === 'Approved').length}</div>
          <div className="text-xs text-muted-foreground">Evidence Approved</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-lg font-bold text-amber-600">{data.filter(l => l.evidenceStatus === 'Pending').length}</div>
          <div className="text-xs text-muted-foreground">Pending Evidence</div>
        </div>
      </div>

      {data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sample</TableHead>
              <TableHead>Procedure</TableHead>
              <TableHead>Workpaper</TableHead>
              <TableHead>Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 20).map((link) => (
              <TableRow key={link.sampleItemId}>
                <TableCell className="font-mono text-xs">{link.sampleItemId}</TableCell>
                <TableCell className="text-sm">{link.procedureDescription}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{link.workpaperId || '-'}</TableCell>
                <TableCell>
                  <Badge className={cn("text-xs", getEvidenceStatusColor(link.evidenceStatus))}>
                    {link.evidenceStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data.length > 20 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing 20 of {data.length} linkages
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530.14(b) - Linkage to Audit Procedures</span>
      </div>
    </div>
  );
}

function Step9Documentation({ data, onCopyAll }: { data: DocumentationOutput; onCopyAll: () => void }) {
  const sections = [
    { key: 'populationDefinitionSummary', label: 'Population Definition', content: data.populationDefinitionSummary },
    { key: 'samplingApproachSummary', label: 'Sampling Approach', content: data.samplingApproachSummary },
    { key: 'sampleSizeCalculationSummary', label: 'Sample Size Calculation', content: data.sampleSizeCalculationSummary },
    { key: 'tolerableExpectedErrorSummary', label: 'Tolerable & Expected Error', content: data.tolerableExpectedErrorSummary },
    { key: 'stratificationApproachSummary', label: 'Stratification Approach', content: data.stratificationApproachSummary },
    { key: 'selectionMethodsSummary', label: 'Selection Methods', content: data.selectionMethodsSummary },
    { key: 'sampleListSummary', label: 'Sample List', content: data.sampleListSummary },
  ];

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="flex justify-end">
        <Button onClick={onCopyAll} variant="outline" data-testid="button-copy-all-documentation">
          <ClipboardCopy className="mr-2 h-4 w-4" />
          Copy All Documentation
        </Button>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.key} className="rounded-lg border p-2.5" data-testid={`doc-section-${section.key}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="mb-2 text-sm font-medium">{section.label}</div>
                <p className="text-sm text-muted-foreground">{section.content}</p>
              </div>
              <CopyButton text={section.content} label={section.label} />
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div>
        <div className="mb-3 text-sm font-medium">ISA References</div>
        <div className="flex flex-wrap gap-2">
          {data.isaReferences.map((ref, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs" data-testid={`isa-ref-${idx}`}>
              <BookOpen className="mr-1 h-3 w-3" />
              {ref}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function QualityGatesSection({ data }: { data: QualityGates }) {
  const gates = [
    data.isa530Compliance,
    data.populationCompletenessConfirmed,
    data.riskLinkedSampleDesign,
    data.manualSelectionsJustified,
    data.reproducibleSampleLogic,
    data.auditTrailComplete,
  ];

  return (
    <div className="space-y-3 p-2.5 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2">
        {data.overallPassed ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-600" />
        )}
        <span className="font-semibold">Quality Gates (ISA 530 Compliance)</span>
        <Badge variant={data.overallPassed ? "default" : "secondary"}>
          {data.overallPassed ? "All Passed" : "Review Required"}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {gates.map((gate, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 bg-background rounded border">
            {gate.passed ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{gate.gate}</span>
                <Badge variant="outline" className="text-xs">{gate.isaReference}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{gate.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-lg border p-2.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-48" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ISA530SamplingPanel({ engagementId, onSamplingGenerated, className }: ISA530SamplingPanelProps) {
  const { firm } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({
    1: true,
    7: true,
  });

  const { data: savedSampling, isLoading: isLoadingSampling } = useQuery<ISA530SamplingResult | null>({
    queryKey: ["/api/isa530-sampling", engagementId],
    enabled: !!engagementId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/isa530-sampling/${engagementId}/analyze`);
      return response.json();
    },
    onSuccess: (result: ISA530SamplingResult) => {
      toast({
        title: "Sampling Analysis Complete",
        description: "ISA 530 compliant sampling plan has been generated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/isa530-sampling", engagementId] });
      onSamplingGenerated?.(result);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate sampling analysis.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!savedSampling) throw new Error("No sampling data to save");
      const response = await apiRequest("POST", `/api/isa530-sampling/${engagementId}/save`, savedSampling);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Saved Successfully",
        description: "Sampling plan has been persisted to the database.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save sampling plan.",
        variant: "destructive",
      });
    },
  });

  const toggleStep = (step: number) => {
    setOpenSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const handleExportSamples = () => {
    if (!savedSampling?.step7_sampleList) return;
    
    const firmName = firm?.displayName || firm?.name || "AuditWise";
    const headers = ["Sample ID", "Transaction ID", "FS Head", "Assertion", "Amount", "Selection Method", "Status", "Population Ref", "Risk Ref"];
    const rows = savedSampling.step7_sampleList.map(s => [
      s.id,
      s.transactionId,
      s.fsHeadLabel,
      s.assertion,
      s.amount.toString(),
      s.selectionMethod,
      s.testStatus,
      s.populationReference,
      s.riskReference || '',
    ]);
    
    const preamble = [`"${firmName}"`, `"ISA 530 Sampling Export"`, `"Generated: ${new Date().toLocaleDateString()}"`, ""];
    const csv = [...preamble, headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    navigator.clipboard.writeText(csv);
    toast({
      title: "Exported to Clipboard",
      description: `${savedSampling.step7_sampleList.length} samples copied as CSV.`,
    });
  };

  const handleCopyAllDocumentation = () => {
    if (!savedSampling?.step9_documentation) return;
    
    const firmName = firm?.displayName || firm?.name || "AuditWise";
    const doc = savedSampling.step9_documentation;
    const allText = [
      firmName,
      "=== ISA 530 AUDIT SAMPLING DOCUMENTATION ===",
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      "POPULATION DEFINITION:",
      doc.populationDefinitionSummary,
      "",
      "SAMPLING APPROACH:",
      doc.samplingApproachSummary,
      "",
      "SAMPLE SIZE CALCULATION:",
      doc.sampleSizeCalculationSummary,
      "",
      "TOLERABLE & EXPECTED ERROR:",
      doc.tolerableExpectedErrorSummary,
      "",
      "STRATIFICATION APPROACH:",
      doc.stratificationApproachSummary,
      "",
      "SELECTION METHODS:",
      doc.selectionMethodsSummary,
      "",
      "SAMPLE LIST SUMMARY:",
      doc.sampleListSummary,
      "",
      "ISA REFERENCES:",
      doc.isaReferences.join("\n"),
    ].join("\n");
    
    navigator.clipboard.writeText(allText);
    toast({
      title: "Copied to Clipboard",
      description: "All sampling documentation has been copied.",
    });
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              ISA 530 Audit Sampling Engine
            </CardTitle>
            <CardDescription>
              AI-driven sample design ensuring ISA 530 compliance with risk-responsive, materiality-aligned, reproducible samples
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              data-testid="button-analyze-sampling"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Analyze Sampling
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !savedSampling}
              data-testid="button-save-sampling"
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        {savedSampling && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Last analyzed: {formatDate(savedSampling.analysisTimestamp)}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoadingSampling ? (
          <LoadingSkeleton />
        ) : !savedSampling ? (
          <div className="rounded-lg border border-dashed p-2.5 text-center">
            <Brain className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <p className="mt-2.5 text-muted-foreground">
              No sampling analysis generated yet. Click "Analyze Sampling" to run ISA 530 analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Collapsible open={openSteps[1]} onOpenChange={() => toggleStep(1)}>
              <StepHeader step={1} title={STEP_TITLES[1]} isOpen={openSteps[1]} onToggle={() => toggleStep(1)} />
              <CollapsibleContent>
                <Step1RequiredInputs data={savedSampling.step1_requiredInputs} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[2]} onOpenChange={() => toggleStep(2)}>
              <StepHeader step={2} title={STEP_TITLES[2]} isOpen={openSteps[2]} onToggle={() => toggleStep(2)} />
              <CollapsibleContent>
                <Step2Populations data={savedSampling.step2_populations} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[3]} onOpenChange={() => toggleStep(3)}>
              <StepHeader step={3} title={STEP_TITLES[3]} isOpen={openSteps[3]} onToggle={() => toggleStep(3)} />
              <CollapsibleContent>
                <Step3SamplingApproaches 
                  data={savedSampling.step3_samplingApproaches} 
                  populations={savedSampling.step2_populations} 
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[4]} onOpenChange={() => toggleStep(4)}>
              <StepHeader step={4} title={STEP_TITLES[4]} isOpen={openSteps[4]} onToggle={() => toggleStep(4)} />
              <CollapsibleContent>
                <Step4SampleSizeCalculations 
                  data={savedSampling.step4_sampleSizeCalculations} 
                  populations={savedSampling.step2_populations} 
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {savedSampling.qualityGates && (
              <>
                <QualityGatesSection data={savedSampling.qualityGates} />
                <Separator />
              </>
            )}

            <Collapsible open={openSteps[5]} onOpenChange={() => toggleStep(5)}>
              <StepHeader step={5} title={STEP_TITLES[5]} isOpen={openSteps[5]} onToggle={() => toggleStep(5)} />
              <CollapsibleContent>
                <Step5StratificationPlans 
                  data={savedSampling.step5_stratificationPlans} 
                  populations={savedSampling.step2_populations} 
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[6]} onOpenChange={() => toggleStep(6)}>
              <StepHeader step={6} title={STEP_TITLES[6]} isOpen={openSteps[6]} onToggle={() => toggleStep(6)} />
              <CollapsibleContent>
                <Step6SelectionMethods 
                  data={savedSampling.step6_selectionMethods} 
                  populations={savedSampling.step2_populations} 
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[7]} onOpenChange={() => toggleStep(7)}>
              <StepHeader step={7} title={STEP_TITLES[7]} isOpen={openSteps[7]} onToggle={() => toggleStep(7)} isImportant />
              <CollapsibleContent>
                <Step7SampleList data={savedSampling.step7_sampleList} onExport={handleExportSamples} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[8]} onOpenChange={() => toggleStep(8)}>
              <StepHeader step={8} title={STEP_TITLES[8]} isOpen={openSteps[8]} onToggle={() => toggleStep(8)} />
              <CollapsibleContent>
                <Step8AuditProgramLinks 
                  data={savedSampling.step8_auditProgramLinks} 
                  samples={savedSampling.step7_sampleList}
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[9]} onOpenChange={() => toggleStep(9)}>
              <StepHeader step={9} title={STEP_TITLES[9]} isOpen={openSteps[9]} onToggle={() => toggleStep(9)} />
              <CollapsibleContent>
                <Step9Documentation 
                  data={savedSampling.step9_documentation} 
                  onCopyAll={handleCopyAllDocumentation} 
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ISA530SamplingPanel;
