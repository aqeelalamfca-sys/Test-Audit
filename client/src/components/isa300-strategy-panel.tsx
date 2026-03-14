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
  Clock,
  Compass,
  ShieldCheck,
  PieChart,
  Lightbulb,
  UserCheck,
  FileOutput,
  Calendar,
  BookOpen,
  Briefcase,
  AlertCircle,
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
  responseRequired: boolean;
}

interface FraudRisk {
  id: string;
  type: 'Revenue Recognition' | 'Management Override' | 'Misappropriation' | 'Other';
  description: string;
  affectedAreas: string[];
  likelihood: 'High' | 'Medium' | 'Low';
  magnitude: 'High' | 'Medium' | 'Low';
}

interface SignificantFluctuation {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  movementPercentage: number;
  status: string;
  affectedAssertions: string[];
}

interface RatioAnomaly {
  ratioName: string;
  currentValue: number;
  priorValue: number;
  variance: number;
  status: string;
}

interface PlanningInput {
  riskAssessment: {
    fsLevelRisks: FSLevelRisk[];
    assertionLevelRisks: AssertionLevelRisk[];
    significantRisks: SignificantRisk[];
    fraudRisks: FraudRisk[];
  };
  analyticalProcedures: {
    significantFluctuations: SignificantFluctuation[];
    ratioAnomalies: RatioAnomaly[];
    riskInformingAnalytics: string[];
  };
  materiality: {
    overallMateriality: number;
    performanceMateriality: number;
    trivialThreshold: number;
    qualitativeAdjustments: string[];
  };
  entityCharacteristics: {
    size: string;
    complexity: string;
    industryRiskProfile: string;
    governance: string;
    controlEnvironment: string;
    useOfIT: string;
    priorYearExperience: string;
  };
}

interface OverallAuditApproach {
  approachType: 'Substantive-based' | 'Controls-reliant' | 'Combined';
  justification: string;
  controlEnvironmentAssessment: 'Strong' | 'Moderate' | 'Weak';
  riskNatureConsiderations: string[];
  controlReliabilityRationale: string;
  costBenefitAnalysis: string;
}

interface FSAreaFocus {
  fsHeadKey: string;
  fsHeadLabel: string;
  focusLevel: 'Primary' | 'Secondary' | 'Standard';
  rationale: string;
}

interface ExpertRequirement {
  expertType: string;
  area: string;
  rationale: string;
  timing: string;
}

interface ReportingMilestone {
  milestone: string;
  targetDate: string;
  responsible: string;
}

interface ScopeTimingDirection {
  scope: {
    fsAreasOfFocus: FSAreaFocus[];
    significantLocations: string[];
    componentsIncluded: string[];
    expertsRequired: ExpertRequirement[];
  };
  timing: {
    interimWorkScope: string[];
    yearEndWorkScope: string[];
    rollForwardProcedures: string[];
    reportingDeadlines: ReportingMilestone[];
  };
  direction: {
    highRiskEmphasis: string[];
    professionalSkepticismAreas: string[];
    analyticsUsage: string[];
    teamCommunication: string;
  };
}

interface AssertionResponse {
  procedureId: string;
  procedureDescription: string;
  nature: 'Substantive' | 'TOC' | 'Combined';
  timing: 'Interim' | 'Year-End' | 'Both';
  extent: string;
}

interface RiskResponse {
  riskId: string;
  riskDescription: string;
  fsHeadKey: string;
  assertion: string;
  isSignificantRisk: boolean;
  fsLevelResponses: string[];
  assertionLevelResponses: AssertionResponse[];
  additionalProcedures: string[];
  specialistInvolvement: string | null;
  lowerMaterialityThreshold: number | null;
}

interface PlannedTOC {
  controlId: string;
  controlDescription: string;
  testProcedure: string;
  sampleSize: number;
  timing: string;
}

interface ControlsRelianceDecision {
  processArea: string;
  fsHeadsAffected: string[];
  relianceDecision: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
  rationale: string;
  impactOnProcedures: {
    nature: string;
    timing: string;
    extent: string;
  };
  plannedTestsOfControls: PlannedTOC[];
}

interface SamplingApproach {
  fsHeadKey: string;
  fsHeadLabel: string;
  population: string;
  approach: 'Statistical' | 'Non-Statistical' | '100% Testing' | 'Targeted';
  sampleSize: number | null;
  selectionMethod: string;
  rationale: string;
  riskAlignment: string;
  materialityAlignment: string;
}

interface PotentialKAM {
  id: string;
  matter: string;
  category: 'Significant Risk' | 'High Judgment' | 'Complex Estimate' | 'Significant Assumption' | 'Other';
  linkedRisks: string[];
  rationale: string;
  preliminaryAuditFocus: string[];
  communicationTiming: string;
}

interface TeamMember {
  role: string;
  seniorityLevel: 'Partner' | 'Manager' | 'Senior' | 'Staff';
  assignedAreas: string[];
  estimatedHours: number;
}

interface SpecialistAllocation {
  specialistType: string;
  area: string;
  timing: string;
  estimatedHours: number;
}

interface ReviewIntensity {
  managerReviewAreas: string[];
  partnerReviewAreas: string[];
  eqcrRequired: boolean;
  eqcrAreas: string[];
  riskBasedReviewFocus: string[];
}

interface ResourcePlanning {
  teamComposition: TeamMember[];
  specialistInvolvement: SpecialistAllocation[];
  reviewIntensity: ReviewIntensity;
  trainingRequirements: string[];
  riskProfileAlignment: string;
}

interface DocumentationOutput {
  overallAuditApproachSummary: string;
  overallAuditStrategySummary: string;
  responseToSignificantRisksSummary: string;
  controlsRelianceStrategySummary: string;
  samplingApproachSummary: string;
  potentialKAMsSummary: string;
  isaReferences: string[];
}

interface QualityGate {
  passed: boolean;
  gate: string;
  message: string;
  isaReference: string;
}

interface QualityGates {
  allSignificantRisksAddressed: QualityGate;
  allFraudRisksAddressed: QualityGate;
  strategyConsistentWithRisk: QualityGate;
  materialityAligned: QualityGate;
  orphanRisks: string[];
  overallPassed: boolean;
}

export interface ISA300StrategyResult {
  engagementId: string;
  analysisTimestamp: string;
  step1_planningInputs: PlanningInput;
  step2_overallAuditApproach: OverallAuditApproach;
  step3_scopeTimingDirection: ScopeTimingDirection;
  step4_riskResponses: RiskResponse[];
  step5_controlsRelianceDecisions: ControlsRelianceDecision[];
  step6_samplingApproaches: SamplingApproach[];
  step7_potentialKAMs: PotentialKAM[];
  step8_resourcePlanning: ResourcePlanning;
  step9_documentation: DocumentationOutput;
  qualityGates: QualityGates;
}

interface ISA300StrategyPanelProps {
  engagementId: string;
  onStrategyGenerated?: (result: ISA300StrategyResult) => void;
  className?: string;
}

const STEP_ICONS = {
  1: Database,
  2: Target,
  3: Compass,
  4: ShieldCheck,
  5: Layers,
  6: PieChart,
  7: Lightbulb,
  8: Users,
  9: FileOutput,
};

const STEP_TITLES = {
  1: "Planning Inputs Summary",
  2: "Overall Audit Approach (ISA 300)",
  3: "Scope, Timing & Direction (ISA 300.8)",
  4: "Response to Assessed Risks (ISA 330)",
  5: "Controls Reliance Strategy",
  6: "Sampling Approach",
  7: "Potential Key Audit Matters",
  8: "Resource & Skill Planning",
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

function Step1PlanningInputs({ data }: { data: PlanningInput }) {
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
        <div className="mb-2 text-sm font-medium">Entity Characteristics</div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" data-testid="badge-entity-size">Size: {data.entityCharacteristics.size}</Badge>
          <Badge variant="outline" data-testid="badge-entity-complexity">Complexity: {data.entityCharacteristics.complexity}</Badge>
          <Badge variant="outline" data-testid="badge-industry-risk">Industry Risk: {data.entityCharacteristics.industryRiskProfile}</Badge>
          <Badge variant="outline" data-testid="badge-control-env">Controls: {data.entityCharacteristics.controlEnvironment}</Badge>
          <Badge variant="outline" data-testid="badge-it-usage">IT: {data.entityCharacteristics.useOfIT}</Badge>
          <Badge variant="outline" data-testid="badge-governance">Governance: {data.entityCharacteristics.governance}</Badge>
        </div>
      </div>

      <Separator />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Analytical Findings</span>
          <Badge variant="secondary">
            {data.analyticalProcedures.significantFluctuations.length} variances
          </Badge>
        </div>
        {data.analyticalProcedures.significantFluctuations.length > 0 && (
          <div className="space-y-2">
            {data.analyticalProcedures.significantFluctuations.slice(0, 3).map((fluct) => (
              <div key={fluct.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <span>{fluct.fsHeadLabel}</span>
                <Badge variant={Math.abs(fluct.movementPercentage) > 20 ? "destructive" : "secondary"}>
                  {fluct.movementPercentage > 0 ? "+" : ""}{fluct.movementPercentage.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Step2OverallApproach({ data }: { data: OverallAuditApproach }) {
  const getApproachColor = (approach: string) => {
    switch (approach) {
      case 'Substantive-based':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Controls-reliant':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Combined':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return '';
    }
  };

  const getControlEnvColor = (assessment: string) => {
    switch (assessment) {
      case 'Strong':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Moderate':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'Weak':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="rounded-lg border-2 border-primary bg-primary/5 p-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <Badge className={cn("mb-3 text-base px-3 py-1", getApproachColor(data.approachType))} data-testid="badge-approach-type">
              {data.approachType}
            </Badge>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">Control Environment:</span>
              <Badge className={getControlEnvColor(data.controlEnvironmentAssessment)} data-testid="badge-control-env-assessment">
                {data.controlEnvironmentAssessment}
              </Badge>
            </div>
          </div>
          <Target className="h-12 w-12 text-primary opacity-30" />
        </div>
      </div>

      <div className="rounded-lg bg-muted/30 p-2.5">
        <div className="mb-2 text-sm font-medium">Justification</div>
        <p className="text-sm text-muted-foreground">{data.justification}</p>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Risk Nature Considerations</div>
        <ul className="space-y-1">
          {data.riskNatureConsiderations.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
              <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div className="grid gap-2.5 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="mb-1 text-sm font-medium">Control Reliability Rationale</div>
          <p className="text-sm text-muted-foreground">{data.controlReliabilityRationale}</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-1 text-sm font-medium">Cost-Benefit Analysis</div>
          <p className="text-sm text-muted-foreground">{data.costBenefitAnalysis}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 300.7-8 - Planning the Audit and Overall Audit Strategy</span>
      </div>
    </div>
  );
}

function Step3ScopeTimingDirection({ data }: { data: ScopeTimingDirection }) {
  return (
    <div className="space-y-3 p-2.5 pt-0">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4" />
          Scope
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-2 text-xs text-muted-foreground uppercase">FS Areas of Focus</div>
            <div className="space-y-2">
              {data.scope.fsAreasOfFocus.map((area, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border p-2" data-testid={`scope-area-${idx}`}>
                  <div>
                    <span className="font-medium">{area.fsHeadLabel}</span>
                    <p className="text-xs text-muted-foreground">{area.rationale}</p>
                  </div>
                  <Badge variant={area.focusLevel === 'Primary' ? 'default' : 'secondary'}>
                    {area.focusLevel}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {data.scope.expertsRequired.length > 0 && (
            <div>
              <div className="mb-2 text-xs text-muted-foreground uppercase">Specialists/Experts Required</div>
              <div className="space-y-2">
                {data.scope.expertsRequired.map((expert, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-lg border p-2" data-testid={`expert-${idx}`}>
                    <UserCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">{expert.expertType}</div>
                      <div className="text-sm text-muted-foreground">{expert.area}</div>
                      <div className="text-xs text-muted-foreground">Timing: {expert.timing}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4" />
          Timing
        </div>
        <div className="grid gap-2.5 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs text-muted-foreground uppercase">Interim Work Scope</div>
            <ul className="space-y-1">
              {data.timing.interimWorkScope.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs text-muted-foreground uppercase">Year-End Work Scope</div>
            <ul className="space-y-1">
              {data.timing.yearEndWorkScope.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {data.timing.reportingDeadlines.length > 0 && (
          <div className="mt-2.5">
            <div className="mb-2 text-xs text-muted-foreground uppercase">Milestones</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Responsible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.timing.reportingDeadlines.map((milestone, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{milestone.milestone}</TableCell>
                    <TableCell>{milestone.targetDate}</TableCell>
                    <TableCell>{milestone.responsible}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Compass className="h-4 w-4" />
          Direction
        </div>
        <div className="space-y-2.5">
          <div>
            <div className="mb-2 text-xs text-muted-foreground uppercase">High-Risk Emphasis Areas</div>
            <div className="space-y-1">
              {data.direction.highRiskEmphasis.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs text-muted-foreground uppercase">Professional Skepticism Notes</div>
            <div className="space-y-1">
              {data.direction.professionalSkepticismAreas.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Shield className="mt-0.5 h-4 w-4 text-amber-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 p-3">
            <div className="mb-1 text-sm font-medium">Team Communication</div>
            <p className="text-sm text-muted-foreground">{data.direction.teamCommunication}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4RiskResponses({ data }: { data: RiskResponse[] }) {
  const significantRisks = data.filter(r => r.isSignificantRisk);
  const otherRisks = data.filter(r => !r.isSignificantRisk);
  const hasOrphanRisks = data.some(r => r.assertionLevelResponses.length === 0 && r.fsLevelResponses.length === 0);

  const getResponseBadge = (responses: string[]) => {
    const badges: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }[] = [];
    if (responses.some(r => r.toLowerCase().includes('substantive'))) badges.push({ label: 'Increased Substantive', variant: 'default' });
    if (responses.some(r => r.toLowerCase().includes('specialist'))) badges.push({ label: 'Specialist', variant: 'secondary' });
    if (responses.some(r => r.toLowerCase().includes('unpredictable'))) badges.push({ label: 'Unpredictable', variant: 'destructive' });
    if (responses.some(r => r.toLowerCase().includes('senior'))) badges.push({ label: 'Senior Involvement', variant: 'outline' });
    return badges;
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <Alert variant={hasOrphanRisks ? "destructive" : "default"}>
        {hasOrphanRisks ? (
          <>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Orphan Risks Detected</AlertTitle>
            <AlertDescription>Some risks have no documented responses. Review required.</AlertDescription>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>All Risks Have Responses</AlertTitle>
            <AlertDescription>No orphan risks - all identified risks have documented responses per ISA 330.</AlertDescription>
          </>
        )}
      </Alert>

      {significantRisks.length > 0 && (
        <div>
          <div className="mb-3 text-sm font-medium">Significant Risk Responses ({significantRisks.length})</div>
          <div className="space-y-3">
            {significantRisks.map((risk) => (
              <Card key={risk.riskId} className="border-destructive/50" data-testid={`significant-risk-${risk.riskId}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{risk.riskDescription}</CardTitle>
                      <CardDescription>{risk.fsHeadKey} - {risk.assertion}</CardDescription>
                    </div>
                    <Badge variant="destructive">Significant</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground uppercase">FS-Level Responses</div>
                    <div className="flex flex-wrap gap-1">
                      {risk.fsLevelResponses.map((response, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{response}</Badge>
                      ))}
                      {getResponseBadge(risk.fsLevelResponses).map((badge, idx) => (
                        <Badge key={idx} variant={badge.variant}>{badge.label}</Badge>
                      ))}
                    </div>
                  </div>

                  {risk.assertionLevelResponses.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground uppercase">Assertion-Level Procedures</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Procedure</TableHead>
                            <TableHead>Nature</TableHead>
                            <TableHead>Timing</TableHead>
                            <TableHead>Extent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {risk.assertionLevelResponses.map((proc) => (
                            <TableRow key={proc.procedureId}>
                              <TableCell className="font-medium">{proc.procedureDescription}</TableCell>
                              <TableCell><Badge variant="outline">{proc.nature}</Badge></TableCell>
                              <TableCell>{proc.timing}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{proc.extent}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {risk.specialistInvolvement && (
                    <div className="flex items-center gap-2 text-sm">
                      <UserCheck className="h-4 w-4 text-primary" />
                      <span>Specialist: {risk.specialistInvolvement}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {otherRisks.length > 0 && (
        <div>
          <div className="mb-3 text-sm font-medium">Other Risk Responses ({otherRisks.length})</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk Description</TableHead>
                <TableHead>FS Head</TableHead>
                <TableHead>Assertion</TableHead>
                <TableHead>Procedures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {otherRisks.slice(0, 10).map((risk) => (
                <TableRow key={risk.riskId} data-testid={`other-risk-${risk.riskId}`}>
                  <TableCell className="font-medium max-w-xs truncate">{risk.riskDescription}</TableCell>
                  <TableCell>{risk.fsHeadKey}</TableCell>
                  <TableCell>{risk.assertion}</TableCell>
                  <TableCell>{risk.assertionLevelResponses.length} procedures</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Step5ControlsReliance({ data }: { data: ControlsRelianceDecision[] }) {
  const getRelianceBadge = (decision: string) => {
    switch (decision) {
      case 'Full Reliance':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Rely</Badge>;
      case 'Partial Reliance':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Partial</Badge>;
      case 'No Reliance':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Not Rely</Badge>;
      default:
        return <Badge variant="outline">{decision}</Badge>;
    }
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="grid gap-2.5 md:grid-cols-3">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-lg font-bold text-green-600">{data.filter(d => d.relianceDecision === 'Full Reliance').length}</div>
          <div className="text-sm text-muted-foreground">Full Reliance</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-lg font-bold text-amber-600">{data.filter(d => d.relianceDecision === 'Partial Reliance').length}</div>
          <div className="text-sm text-muted-foreground">Partial Reliance</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-lg font-bold text-red-600">{data.filter(d => d.relianceDecision === 'No Reliance').length}</div>
          <div className="text-sm text-muted-foreground">No Reliance</div>
        </div>
      </div>

      <Separator />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Process Area</TableHead>
            <TableHead>FS Heads Affected</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Rationale</TableHead>
            <TableHead>Planned ToC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((decision, idx) => (
            <TableRow key={idx} data-testid={`controls-decision-${idx}`}>
              <TableCell className="font-medium">{decision.processArea}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {decision.fsHeadsAffected.slice(0, 3).map((head, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{head}</Badge>
                  ))}
                  {decision.fsHeadsAffected.length > 3 && (
                    <Badge variant="secondary" className="text-xs">+{decision.fsHeadsAffected.length - 3}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{getRelianceBadge(decision.relianceDecision)}</TableCell>
              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{decision.rationale}</TableCell>
              <TableCell>
                {decision.plannedTestsOfControls.length > 0 ? (
                  <Badge variant="secondary">{decision.plannedTestsOfControls.length} tests</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Step6Sampling({ data }: { data: SamplingApproach[] }) {
  const getApproachBadge = (approach: string) => {
    switch (approach) {
      case '100% Testing':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">100%</Badge>;
      case 'Statistical':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Statistical</Badge>;
      case 'Non-Statistical':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Non-Statistical</Badge>;
      case 'Targeted':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Targeted</Badge>;
      default:
        return <Badge variant="outline">{approach}</Badge>;
    }
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>FS Head</TableHead>
            <TableHead>Approach</TableHead>
            <TableHead>Sample Size</TableHead>
            <TableHead>Selection Method</TableHead>
            <TableHead>Risk Justification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((sampling, idx) => (
            <TableRow key={idx} data-testid={`sampling-${idx}`}>
              <TableCell className="font-medium">{sampling.fsHeadLabel}</TableCell>
              <TableCell>{getApproachBadge(sampling.approach)}</TableCell>
              <TableCell>
                {sampling.sampleSize !== null ? sampling.sampleSize : <span className="text-muted-foreground">N/A</span>}
              </TableCell>
              <TableCell className="text-sm">{sampling.selectionMethod}</TableCell>
              <TableCell className="max-w-xs text-sm text-muted-foreground">{sampling.riskAlignment}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530 - Audit Sampling</span>
      </div>
    </div>
  );
}

function Step7PotentialKAMs({ data }: { data: PotentialKAM[] }) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Significant Risk':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'High Judgment':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Complex Estimate':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Significant Assumption':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (data.length === 0) {
    return (
      <div className="p-2.5 pt-0">
        <div className="rounded-lg border border-dashed p-3 text-center">
          <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No potential Key Audit Matters identified yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="grid gap-2.5 md:grid-cols-2">
        {data.map((kam) => (
          <Card key={kam.id} data-testid={`kam-${kam.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{kam.matter}</CardTitle>
                <Badge className={getCategoryColor(kam.category)}>{kam.category}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase">Rationale</div>
                <p className="text-sm">{kam.rationale}</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Risk Linkage</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {kam.linkedRisks.map((risk, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">{risk}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Preliminary Audit Focus</div>
                <ul className="mt-1 space-y-1">
                  {kam.preliminaryAuditFocus.map((focus, idx) => (
                    <li key={idx} className="flex items-center gap-1 text-sm">
                      <ArrowRight className="h-3 w-3 text-primary" />
                      {focus}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Communication: {kam.communicationTiming}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 701 - Communicating Key Audit Matters in the Independent Auditor's Report</span>
      </div>
    </div>
  );
}

function Step8ResourcePlanning({ data }: { data: ResourcePlanning }) {
  const getSeniorityColor = (level: string) => {
    switch (level) {
      case 'Partner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Senior':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Staff':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div>
        <div className="mb-3 text-sm font-medium">Team Composition</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead>Assigned Areas</TableHead>
              <TableHead>Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.teamComposition.map((member, idx) => (
              <TableRow key={idx} data-testid={`team-member-${idx}`}>
                <TableCell className="font-medium">{member.role}</TableCell>
                <TableCell>
                  <Badge className={getSeniorityColor(member.seniorityLevel)}>{member.seniorityLevel}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {member.assignedAreas.slice(0, 2).map((area, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{area}</Badge>
                    ))}
                    {member.assignedAreas.length > 2 && (
                      <Badge variant="secondary" className="text-xs">+{member.assignedAreas.length - 2}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{member.estimatedHours}h</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.specialistInvolvement.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <UserCheck className="h-4 w-4" />
              Specialist Involvement
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {data.specialistInvolvement.map((specialist, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg border p-3" data-testid={`specialist-${idx}`}>
                  <Briefcase className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">{specialist.specialistType}</div>
                    <div className="text-sm text-muted-foreground">{specialist.area}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {specialist.timing} - {specialist.estimatedHours}h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <div>
        <div className="mb-3 text-sm font-medium">Review Intensity</div>
        <div className="grid gap-2.5 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800">Manager</Badge>
            </div>
            <ul className="space-y-1">
              {data.reviewIntensity.managerReviewAreas.slice(0, 3).map((area, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">{area}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-800">Partner</Badge>
            </div>
            <ul className="space-y-1">
              {data.reviewIntensity.partnerReviewAreas.slice(0, 3).map((area, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">{area}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge className={data.reviewIntensity.eqcrRequired ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}>
                EQCR
              </Badge>
              {data.reviewIntensity.eqcrRequired ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {data.reviewIntensity.eqcrRequired && data.reviewIntensity.eqcrAreas.length > 0 && (
              <ul className="space-y-1">
                {data.reviewIntensity.eqcrAreas.slice(0, 3).map((area, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">{area}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {data.trainingRequirements.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="mb-2 text-sm font-medium">Training Requirements</div>
            <div className="flex flex-wrap gap-2">
              {data.trainingRequirements.map((req, idx) => (
                <Badge key={idx} variant="outline">{req}</Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Step9Documentation({ data, onCopyAll }: { data: DocumentationOutput; onCopyAll: () => void }) {
  const sections = [
    { key: 'overallAuditApproachSummary', label: 'Overall Audit Approach Summary', content: data.overallAuditApproachSummary },
    { key: 'overallAuditStrategySummary', label: 'Overall Audit Strategy Summary', content: data.overallAuditStrategySummary },
    { key: 'responseToSignificantRisksSummary', label: 'Response to Significant Risks', content: data.responseToSignificantRisksSummary },
    { key: 'controlsRelianceStrategySummary', label: 'Controls Reliance Strategy', content: data.controlsRelianceStrategySummary },
    { key: 'samplingApproachSummary', label: 'Sampling Approach', content: data.samplingApproachSummary },
    { key: 'potentialKAMsSummary', label: 'Potential KAMs', content: data.potentialKAMsSummary },
  ];

  return (
    <div className="space-y-2.5 p-2.5 pt-0">
      <div className="flex justify-end">
        <Button onClick={onCopyAll} variant="outline" data-testid="button-copy-all-documentation">
          <ClipboardCopy className="mr-2 h-4 w-4" />
          Copy All Strategy Documentation
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

export function ISA300StrategyPanel({ engagementId, onStrategyGenerated, className }: ISA300StrategyPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { firm } = useAuth();
  
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({
    2: true,
    4: true,
  });

  const { data: savedStrategy, isLoading: isLoadingStrategy } = useQuery<ISA300StrategyResult | null>({
    queryKey: ["/api/isa300-strategy", engagementId],
    enabled: !!engagementId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/isa300-strategy/${engagementId}/analyze`);
      return response.json();
    },
    onSuccess: (result: ISA300StrategyResult) => {
      toast({
        title: "Audit Strategy Generated",
        description: "ISA 300/330 compliant audit strategy has been generated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/isa300-strategy", engagementId] });
      onStrategyGenerated?.(result);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate audit strategy.",
        variant: "destructive",
      });
    },
  });

  const toggleStep = (step: number) => {
    setOpenSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const handleCopyAllDocumentation = () => {
    if (!savedStrategy?.step9_documentation) return;
    
    const firmName = firm?.displayName || firm?.name || "AuditWise";
    const doc = savedStrategy.step9_documentation;
    const allText = [
      firmName,
      "=== ISA 300/330 AUDIT STRATEGY DOCUMENTATION ===",
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      "OVERALL AUDIT APPROACH SUMMARY:",
      doc.overallAuditApproachSummary,
      "",
      "OVERALL AUDIT STRATEGY SUMMARY:",
      doc.overallAuditStrategySummary,
      "",
      "RESPONSE TO SIGNIFICANT RISKS:",
      doc.responseToSignificantRisksSummary,
      "",
      "CONTROLS RELIANCE STRATEGY:",
      doc.controlsRelianceStrategySummary,
      "",
      "SAMPLING APPROACH:",
      doc.samplingApproachSummary,
      "",
      "POTENTIAL KEY AUDIT MATTERS:",
      doc.potentialKAMsSummary,
      "",
      "ISA REFERENCES:",
      doc.isaReferences.join("\n"),
    ].join("\n");
    
    navigator.clipboard.writeText(allText);
    toast({
      title: "Copied to Clipboard",
      description: "All strategy documentation has been copied.",
    });
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              ISA 300/330 Audit Strategy Panel
            </CardTitle>
            <CardDescription>
              AI-driven audit strategy development per ISA 300 (Planning) and ISA 330 (Risk Response)
            </CardDescription>
          </div>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            data-testid="button-generate-audit-strategy"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Audit Strategy
              </>
            )}
          </Button>
        </div>

        {savedStrategy && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Last analyzed: {formatDate(savedStrategy.analysisTimestamp)}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoadingStrategy ? (
          <LoadingSkeleton />
        ) : !savedStrategy ? (
          <div className="rounded-lg border border-dashed p-2.5 text-center">
            <Brain className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <p className="mt-2.5 text-muted-foreground">
              No audit strategy generated yet. Click "Generate Audit Strategy" to run ISA 300/330 analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Collapsible open={openSteps[1]} onOpenChange={() => toggleStep(1)}>
              <StepHeader step={1} title={STEP_TITLES[1]} isOpen={openSteps[1]} onToggle={() => toggleStep(1)} />
              <CollapsibleContent>
                <Step1PlanningInputs data={savedStrategy.step1_planningInputs} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[2]} onOpenChange={() => toggleStep(2)}>
              <StepHeader step={2} title={STEP_TITLES[2]} isOpen={openSteps[2]} onToggle={() => toggleStep(2)} isImportant />
              <CollapsibleContent>
                <Step2OverallApproach data={savedStrategy.step2_overallAuditApproach} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[3]} onOpenChange={() => toggleStep(3)}>
              <StepHeader step={3} title={STEP_TITLES[3]} isOpen={openSteps[3]} onToggle={() => toggleStep(3)} />
              <CollapsibleContent>
                <Step3ScopeTimingDirection data={savedStrategy.step3_scopeTimingDirection} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[4]} onOpenChange={() => toggleStep(4)}>
              <StepHeader step={4} title={STEP_TITLES[4]} isOpen={openSteps[4]} onToggle={() => toggleStep(4)} isImportant />
              <CollapsibleContent>
                <Step4RiskResponses data={savedStrategy.step4_riskResponses} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Quality Gates Section */}
            {savedStrategy.qualityGates && (
              <div className="space-y-3 p-2.5 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-2">
                  {savedStrategy.qualityGates.overallPassed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  )}
                  <span className="font-semibold">Quality Gates (ISA 300/330 Compliance)</span>
                  <Badge variant={savedStrategy.qualityGates.overallPassed ? "default" : "secondary"}>
                    {savedStrategy.qualityGates.overallPassed ? "All Passed" : "Review Required"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    savedStrategy.qualityGates.allSignificantRisksAddressed,
                    savedStrategy.qualityGates.allFraudRisksAddressed,
                    savedStrategy.qualityGates.strategyConsistentWithRisk,
                    savedStrategy.qualityGates.materialityAligned,
                  ].map((gate, idx) => (
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
                {savedStrategy.qualityGates.orphanRisks.length > 0 && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Orphan Risks Detected</AlertTitle>
                    <AlertDescription>
                      The following risks do not have documented responses:
                      <ul className="list-disc list-inside mt-1">
                        {savedStrategy.qualityGates.orphanRisks.slice(0, 5).map((risk, idx) => (
                          <li key={idx} className="text-xs">{risk}</li>
                        ))}
                        {savedStrategy.qualityGates.orphanRisks.length > 5 && (
                          <li className="text-xs">...and {savedStrategy.qualityGates.orphanRisks.length - 5} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <Separator />

            <Collapsible open={openSteps[5]} onOpenChange={() => toggleStep(5)}>
              <StepHeader step={5} title={STEP_TITLES[5]} isOpen={openSteps[5]} onToggle={() => toggleStep(5)} />
              <CollapsibleContent>
                <Step5ControlsReliance data={savedStrategy.step5_controlsRelianceDecisions} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[6]} onOpenChange={() => toggleStep(6)}>
              <StepHeader step={6} title={STEP_TITLES[6]} isOpen={openSteps[6]} onToggle={() => toggleStep(6)} />
              <CollapsibleContent>
                <Step6Sampling data={savedStrategy.step6_samplingApproaches} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[7]} onOpenChange={() => toggleStep(7)}>
              <StepHeader step={7} title={STEP_TITLES[7]} isOpen={openSteps[7]} onToggle={() => toggleStep(7)} />
              <CollapsibleContent>
                <Step7PotentialKAMs data={savedStrategy.step7_potentialKAMs} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[8]} onOpenChange={() => toggleStep(8)}>
              <StepHeader step={8} title={STEP_TITLES[8]} isOpen={openSteps[8]} onToggle={() => toggleStep(8)} />
              <CollapsibleContent>
                <Step8ResourcePlanning data={savedStrategy.step8_resourcePlanning} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible open={openSteps[9]} onOpenChange={() => toggleStep(9)}>
              <StepHeader step={9} title={STEP_TITLES[9]} isOpen={openSteps[9]} onToggle={() => toggleStep(9)} />
              <CollapsibleContent>
                <Step9Documentation data={savedStrategy.step9_documentation} onCopyAll={handleCopyAllDocumentation} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ISA300StrategyPanel;
