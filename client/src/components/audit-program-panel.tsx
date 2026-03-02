import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Database,
  Target,
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
  ClipboardCopy,
  BookOpen,
  Download,
  List,
  Link2,
  Settings,
  Play,
  Clock,
  Users,
  FileOutput,
  Layers,
  Zap,
  Package,
  ThumbsUp,
  ThumbsDown,
  Edit,
  Trash2,
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
  timingDirectives: TimingDirective[];
}

interface TimingDirective {
  fsHeadKey: string;
  timing: 'Interim' | 'Year-End' | 'Both';
  rationale: string;
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
}

interface SamplingData {
  populations: PopulationDefinition[];
  sampleSizeCalculations: { populationId: string; finalSampleSize: number }[];
  stratificationPlans: { populationId: string; isStratified: boolean; strata: { id: string; stratumType: string }[] }[];
  sampleList: SampleItem[];
}

interface CoAMapping {
  fsHeadKey: string;
  fsHeadLabel: string;
  totalBalance: number;
  transactionCount: number;
  isMaterial: boolean;
}

interface ProcedureStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
  evidenceRequired: string;
}

interface LinkedSample {
  sampleItemId: string;
  selectionMethodTag: string;
  stratumTag: string | null;
  testDesignOption: 'Test All' | 'Split by Sub-Assertion' | 'Split by Strata' | 'Manual Add-On' | 'Replacement';
}

interface ExecutionParameter {
  nature: 'ToC' | 'ToD' | 'SAP';
  timing: 'Interim' | 'Year-End' | 'Both';
  extent: number;
  evidenceRequirements: EvidenceRequirement[];
  reviewerLevel: 'Senior' | 'Manager' | 'Partner';
}

interface EvidenceRequirement {
  type: 'Document' | 'Confirmation' | 'Recalculation' | 'Inspection' | 'Inquiry' | 'Observation' | 'Reperformance';
  description: string;
  mandatory: boolean;
}

interface EvidenceSlot {
  slotId: string;
  evidenceType: string;
  status: 'Pending' | 'Uploaded' | 'Reviewed' | 'Approved';
  uploadedBy: string | null;
  uploadedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

interface ExceptionLog {
  exceptionId: string;
  description: string;
  amount: number;
  status: 'Open' | 'Resolved' | 'Projected' | 'Waived';
  resolution: string | null;
  projectedMisstatement: number | null;
  createdBy: string;
  createdAt: string;
}

interface SignOffGate {
  level: 'Preparer' | 'Reviewer' | 'Manager' | 'Partner';
  required: boolean;
  signedOffBy: string | null;
  signedOffAt: string | null;
  comments: string | null;
}

interface AuditTrailEntry {
  timestamp: string;
  userId: string;
  action: 'Created' | 'Updated' | 'Approved' | 'Rejected' | 'Linked' | 'Unlinked' | 'Signed Off' | 'Exception Added';
  details: string;
  previousValue: string | null;
  newValue: string | null;
}

interface AuditProcedure {
  procedureId: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  procedureType: 'ToC' | 'ToD' | 'SAP';
  source: 'Library' | 'AI Recommended' | 'Manual';
  isAIRecommended: boolean;
  aiApprovalStatus: 'Pending' | 'Approved' | 'Rejected' | null;
  aiApprovedBy: string | null;
  aiApprovedAt: string | null;
  objective: string;
  steps: ProcedureStep[];
  expectedEvidence: string[];
  conclusionCriteria: string;
  isaReference: string;
  linkedRiskIds: string[];
  linkedPopulationId: string | null;
  linkedSampleIds: LinkedSample[];
  executionParameters: ExecutionParameter;
  evidenceSlots: EvidenceSlot[];
  exceptionLogs: ExceptionLog[];
  executionStatus: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
  preparer: string | null;
  preparerSignedAt: string | null;
  reviewer: string | null;
  reviewerSignedAt: string | null;
  signOffGates: SignOffGate[];
  conclusionTemplate: string;
  actualConclusion: string | null;
  workpaperReference: string | null;
  auditTrail: AuditTrailEntry[];
}

interface ProcedurePack {
  id: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  linkedRiskIds: string[];
  linkedSignificantRiskIds: string[];
  linkedFraudRiskIds: string[];
  materialityThreshold: number;
  controlsReliance: 'Full Reliance' | 'Partial Reliance' | 'No Reliance';
  procedures: AuditProcedure[];
  samplingStrategy: string;
  createdAt: string;
  updatedAt: string;
}

interface ExecutionTask {
  taskId: string;
  procedureId: string;
  fsHeadKey: string;
  fsHeadLabel: string;
  assertion: string;
  sampleItemId: string | null;
  taskDescription: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  assignedTo: string | null;
  dueDate: string | null;
  priority: 'High' | 'Medium' | 'Low';
  evidenceRequired: string[];
  createdAt: string;
}

interface QualityGate {
  passed: boolean;
  gate: string;
  message: string;
  isaReference: string;
}

interface QualityGates {
  usingSamplingPageSource: QualityGate;
  noOrphanSamples: QualityGate;
  noOrphanProcedures: QualityGate;
  allProceduresTiedToRisk: QualityGate;
  fullAuditTrail: QualityGate;
  isa330Compliant: QualityGate;
  executionReady: QualityGate;
  overallPassed: boolean;
}

interface DocumentationOutput {
  programScopeSummary: string;
  procedurePacksSummary: string;
  riskResponseSummary: string;
  samplingLinkageSummary: string;
  executionParametersSummary: string;
  qualityGatesSummary: string;
  isaReferences: string[];
}

interface SampleLinkage {
  procedureId: string;
  linkedSamples: LinkedSample[];
  validationStatus: 'Valid' | 'Invalid' | 'Pending';
  validationMessage: string;
}

export interface AuditProgramResult {
  engagementId: string;
  analysisTimestamp: string;
  version: number;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  step1_lockedInputs: {
    riskAssessment: {
      fsLevelRisks: FSLevelRisk[];
      assertionLevelRisks: AssertionLevelRisk[];
      significantRisks: SignificantRisk[];
      fraudRisks: FraudRisk[];
    };
    materiality: MaterialityInputs;
    strategyApproach: StrategyApproach;
    samplingData: SamplingData;
    coaMappings: CoAMapping[];
  };
  step2_procedurePacks: ProcedurePack[];
  step3_allProcedures: AuditProcedure[];
  step4_aiRecommendedProcedures: AuditProcedure[];
  step5_sampleLinkages: SampleLinkage[];
  step6_executionParameters: { procedureId: string; parameters: ExecutionParameter }[];
  step7_procedureRecords: AuditProcedure[];
  step8_executionTasks: ExecutionTask[];
  step9_documentation: DocumentationOutput;
  qualityGates: QualityGates;
}

interface AuditProgramPanelProps {
  engagementId: string;
  onDataChange?: (data: AuditProgramResult) => void;
  onPushToExecution?: (programId: string) => void;
  className?: string;
}

const STEP_ICONS = {
  1: Database,
  2: Package,
  3: BookOpen,
  4: Brain,
  5: Link2,
  6: Settings,
  7: FileText,
  8: Play,
};

const STEP_TITLES = {
  1: "Locked Inputs (Risk, Materiality, Strategy, Sampling)",
  2: "Procedure Packs per FS Head × Assertion",
  3: "Procedure Library",
  4: "AI-Recommended Procedures",
  5: "Sample Linkages",
  6: "Execution Parameters",
  7: "Procedure Records",
  8: "Push to Execution",
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
  count,
}: {
  step: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  isImportant?: boolean;
  count?: number;
}) {
  const Icon = STEP_ICONS[step as keyof typeof STEP_ICONS];
  return (
    <CollapsibleTrigger asChild>
      <button
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between p-4 hover-elevate rounded-md transition-colors",
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
              {count !== undefined && (
                <Badge variant="secondary" className="text-xs">{count}</Badge>
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

function getStatusBadge(status: string) {
  switch (status) {
    case 'Not Started':
      return <Badge variant="secondary">{status}</Badge>;
    case 'In Progress':
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{status}</Badge>;
    case 'Completed':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{status}</Badge>;
    case 'Blocked':
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getRiskBadgeColor(level: string) {
  switch (level) {
    case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'Medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    default: return '';
  }
}

function Step1LockedInputs({ data }: { data: AuditProgramResult['step1_lockedInputs'] }) {
  const riskAssessment = data?.riskAssessment;
  const materiality = data?.materiality;
  const strategyApproach = data?.strategyApproach;
  const samplingData = data?.samplingData;
  const coaMappings = data?.coaMappings;

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-3" data-testid="count-significant-risks">
          <div className="text-sm text-muted-foreground">Significant Risks</div>
          <div className="text-2xl font-bold">{riskAssessment?.significantRisks?.length ?? 0}</div>
        </div>
        <div className="rounded-lg border p-3" data-testid="count-fraud-risks">
          <div className="text-sm text-muted-foreground">Fraud Risks</div>
          <div className="text-2xl font-bold text-destructive">{riskAssessment?.fraudRisks?.length ?? 0}</div>
        </div>
        <div className="rounded-lg border p-3" data-testid="count-samples">
          <div className="text-sm text-muted-foreground">Sample Items</div>
          <div className="text-2xl font-bold">{samplingData?.sampleList?.length ?? 0}</div>
        </div>
        <div className="rounded-lg border p-3" data-testid="count-coa-mappings">
          <div className="text-sm text-muted-foreground">FS Heads</div>
          <div className="text-2xl font-bold">{coaMappings?.length ?? 0}</div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-overall-materiality">
          <CardHeader className="pb-2">
            <CardDescription>Overall Materiality</CardDescription>
            <CardTitle className="text-xl text-primary">{formatCurrency(materiality?.overallMateriality ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-performance-materiality">
          <CardHeader className="pb-2">
            <CardDescription>Performance Materiality</CardDescription>
            <CardTitle className="text-xl">{formatCurrency(materiality?.performanceMateriality ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-trivial-threshold">
          <CardHeader className="pb-2">
            <CardDescription>Trivial Threshold</CardDescription>
            <CardTitle className="text-xl">{formatCurrency(materiality?.trivialThreshold ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Separator />

      <div>
        <div className="mb-2 text-sm font-medium">Strategy Approach</div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" data-testid="badge-audit-approach">
            Audit: {strategyApproach?.auditApproach ?? 'Not set'}
          </Badge>
          <Badge variant="outline" data-testid="badge-controls-reliance">
            Controls: {strategyApproach?.controlsRelianceDecision ?? 'Not set'}
          </Badge>
        </div>
        {(strategyApproach?.areasOfFocus?.length ?? 0) > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">Areas of Focus: </span>
            <span className="text-sm">{strategyApproach!.areasOfFocus.join(", ")}</span>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <div className="mb-2 text-sm font-medium">ISA 530 Sampling Data</div>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border p-2 text-sm">
            <span className="text-muted-foreground">Populations: </span>
            <span className="font-medium">{samplingData?.populations?.length ?? 0}</span>
          </div>
          <div className="rounded-lg border p-2 text-sm">
            <span className="text-muted-foreground">Sample Items: </span>
            <span className="font-medium">{samplingData?.sampleList?.length ?? 0}</span>
          </div>
          <div className="rounded-lg border p-2 text-sm">
            <span className="text-muted-foreground">Strata: </span>
            <span className="font-medium">
              {samplingData?.stratificationPlans?.reduce((sum, p) => sum + (p.strata?.length ?? 0), 0) ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step2ProcedurePacks({ data }: { data: ProcedurePack[] }) {
  if (data.length === 0) {
    return (
      <div className="p-4 pt-0">
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No procedure packs generated yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pt-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>FS Head</TableHead>
            <TableHead>Assertion</TableHead>
            <TableHead className="text-right">Procedures</TableHead>
            <TableHead className="text-right">Sig. Risks</TableHead>
            <TableHead className="text-right">Fraud Risks</TableHead>
            <TableHead>Controls</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((pack) => (
            <TableRow key={pack.id} data-testid={`pack-${pack.id}`}>
              <TableCell className="font-medium">{pack.fsHeadLabel}</TableCell>
              <TableCell>
                <Badge variant="outline">{pack.assertion}</Badge>
              </TableCell>
              <TableCell className="text-right">{pack.procedures.length}</TableCell>
              <TableCell className="text-right">
                <Badge variant={pack.linkedSignificantRiskIds.length > 0 ? "destructive" : "secondary"}>
                  {pack.linkedSignificantRiskIds.length}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={pack.linkedFraudRiskIds.length > 0 ? "destructive" : "secondary"}>
                  {pack.linkedFraudRiskIds.length}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">{pack.controlsReliance}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 330.5-6 - Designing Responses to Assessed Risks</span>
      </div>
    </div>
  );
}

function Step3ProcedureLibrary({ 
  data,
  onAccept,
  onRemove,
}: { 
  data: AuditProcedure[];
  onAccept?: (procedureId: string) => void;
  onRemove?: (procedureId: string) => void;
}) {
  const libraryProcedures = data.filter(p => p.source === 'Library');

  if (libraryProcedures.length === 0) {
    return (
      <div className="p-4 pt-0">
        <div className="rounded-lg border border-dashed p-6 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No library procedures loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="space-y-2">
        {libraryProcedures.slice(0, 10).map((proc) => (
          <div key={proc.procedureId} className="rounded-lg border p-3" data-testid={`library-proc-${proc.procedureId}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{proc.fsHeadLabel}</span>
                  <Badge variant="outline" className="text-xs">{proc.assertion}</Badge>
                  <Badge variant="secondary" className="text-xs">{proc.procedureType}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{proc.objective}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">{proc.isaReference}</Badge>
                  <span className="text-xs text-muted-foreground">{proc.steps.length} steps</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => onAccept?.(proc.procedureId)} data-testid={`accept-${proc.procedureId}`}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`edit-${proc.procedureId}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => onRemove?.(proc.procedureId)} data-testid={`remove-${proc.procedureId}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        ))}
      </div>

      {libraryProcedures.length > 10 && (
        <div className="text-center text-sm text-muted-foreground">
          +{libraryProcedures.length - 10} more procedures
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 330.18 - Nature of Audit Procedures</span>
      </div>
    </div>
  );
}

function Step4AIRecommendedProcedures({ 
  data,
  onApprove,
  onReject,
  isApproving,
}: { 
  data: AuditProcedure[];
  onApprove: (procedureId: string) => void;
  onReject: (procedureId: string) => void;
  isApproving: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className="p-4 pt-0">
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Brain className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No AI-recommended procedures yet.</p>
        </div>
      </div>
    );
  }

  const pendingCount = data.filter(p => p.aiApprovalStatus === 'Pending').length;
  const approvedCount = data.filter(p => p.aiApprovalStatus === 'Approved').length;
  const rejectedCount = data.filter(p => p.aiApprovalStatus === 'Rejected').length;

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="flex items-center gap-4 mb-4">
        <Badge variant="secondary">Pending: {pendingCount}</Badge>
        <Badge className="bg-green-100 text-green-800">Approved: {approvedCount}</Badge>
        <Badge variant="destructive">Rejected: {rejectedCount}</Badge>
      </div>

      <div className="space-y-3">
        {data.map((proc) => (
          <div 
            key={proc.procedureId} 
            className={cn(
              "rounded-lg border p-4",
              proc.aiApprovalStatus === 'Approved' && "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20",
              proc.aiApprovalStatus === 'Rejected' && "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
            )}
            data-testid={`ai-proc-${proc.procedureId}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="font-medium">{proc.fsHeadLabel}</span>
                  <Badge variant="outline">{proc.assertion}</Badge>
                  <Badge variant="secondary" className="text-xs">{proc.procedureType}</Badge>
                  {proc.aiApprovalStatus && (
                    <Badge 
                      className={cn(
                        "text-xs",
                        proc.aiApprovalStatus === 'Pending' && "bg-amber-100 text-amber-800",
                        proc.aiApprovalStatus === 'Approved' && "bg-green-100 text-green-800",
                        proc.aiApprovalStatus === 'Rejected' && "bg-red-100 text-red-800"
                      )}
                    >
                      {proc.aiApprovalStatus}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">{proc.objective}</p>
                {proc.linkedRiskIds.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <span className="text-muted-foreground">Linked to {proc.linkedRiskIds.length} risk(s)</span>
                  </div>
                )}
              </div>
              
              {proc.aiApprovalStatus === 'Pending' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onApprove(proc.procedureId)}
                    disabled={isApproving}
                    className="text-green-600 hover:text-green-700"
                    data-testid={`approve-${proc.procedureId}`}
                  >
                    <ThumbsUp className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReject(proc.procedureId)}
                    disabled={isApproving}
                    className="text-destructive hover:text-destructive"
                    data-testid={`reject-${proc.procedureId}`}
                  >
                    <ThumbsDown className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 330.15 - Responses to Significant Risks, ISA 240 - Fraud Procedures</span>
      </div>
    </div>
  );
}

function Step5SampleLinkages({ data }: { data: SampleLinkage[] }) {
  const validCount = data.filter(l => l.validationStatus === 'Valid').length;
  const invalidCount = data.filter(l => l.validationStatus === 'Invalid').length;
  const pendingCount = data.filter(l => l.validationStatus === 'Pending').length;

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="flex items-center gap-4 mb-4">
        <Badge className="bg-green-100 text-green-800">Valid: {validCount}</Badge>
        <Badge variant="destructive">Invalid: {invalidCount}</Badge>
        <Badge variant="secondary">Pending: {pendingCount}</Badge>
      </div>

      {invalidCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Linkage Issues Detected</AlertTitle>
          <AlertDescription>
            {invalidCount} procedure(s) have invalid or missing sample linkages.
          </AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Procedure ID</TableHead>
            <TableHead className="text-right">Samples</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 15).map((linkage) => (
            <TableRow key={linkage.procedureId} data-testid={`linkage-${linkage.procedureId}`}>
              <TableCell className="font-mono text-xs">{linkage.procedureId}</TableCell>
              <TableCell className="text-right">{linkage.linkedSamples.length}</TableCell>
              <TableCell>
                <Badge 
                  className={cn(
                    "text-xs",
                    linkage.validationStatus === 'Valid' && "bg-green-100 text-green-800",
                    linkage.validationStatus === 'Invalid' && "bg-red-100 text-red-800",
                    linkage.validationStatus === 'Pending' && "bg-amber-100 text-amber-800"
                  )}
                >
                  {linkage.validationStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{linkage.validationMessage}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data.length > 15 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing 15 of {data.length} linkages
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 530 - Sample Linkage to Procedures</span>
      </div>
    </div>
  );
}

function Step6ExecutionParameters({ data }: { data: { procedureId: string; parameters: ExecutionParameter }[] }) {
  if (data.length === 0) {
    return (
      <div className="p-4 pt-0">
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Settings className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No execution parameters configured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Procedure ID</TableHead>
              <TableHead>Nature</TableHead>
              <TableHead>Timing</TableHead>
              <TableHead className="text-right">Extent</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead className="text-right">Evidence Req.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 15).map((item) => (
              <TableRow key={item.procedureId} data-testid={`params-${item.procedureId}`}>
                <TableCell className="font-mono text-xs">{item.procedureId}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.parameters.nature}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{item.parameters.timing}</Badge>
                </TableCell>
                <TableCell className="text-right">{item.parameters.extent}%</TableCell>
                <TableCell>
                  <Badge 
                    className={cn(
                      "text-xs",
                      item.parameters.reviewerLevel === 'Partner' && "bg-purple-100 text-purple-800",
                      item.parameters.reviewerLevel === 'Manager' && "bg-blue-100 text-blue-800",
                      item.parameters.reviewerLevel === 'Senior' && "bg-gray-100 text-gray-800"
                    )}
                  >
                    {item.parameters.reviewerLevel}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {item.parameters.evidenceRequirements.filter(e => e.mandatory).length}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.length > 15 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing 15 of {data.length} parameters
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 330.7-8 - Nature, Timing and Extent of Audit Procedures</span>
      </div>
    </div>
  );
}

function Step7ProcedureRecords({ data, onExport }: { data: AuditProcedure[]; onExport: () => void }) {
  if (data.length === 0) {
    return (
      <div className="p-4 pt-0">
        <div className="rounded-lg border border-dashed p-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No procedure records yet.</p>
        </div>
      </div>
    );
  }

  const summary = {
    total: data.length,
    notStarted: data.filter(p => p.executionStatus === 'Not Started').length,
    inProgress: data.filter(p => p.executionStatus === 'In Progress').length,
    completed: data.filter(p => p.executionStatus === 'Completed').length,
    blocked: data.filter(p => p.executionStatus === 'Blocked').length,
  };

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total:</span>
            <Badge variant="default">{summary.total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Not Started:</span>
            <Badge variant="secondary">{summary.notStarted}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Completed:</span>
            <Badge className="bg-green-100 text-green-800">{summary.completed}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Blocked:</span>
            <Badge variant="destructive">{summary.blocked}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} data-testid="button-export-procedures">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border overflow-auto max-h-96">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Procedure ID</TableHead>
              <TableHead>FS Head</TableHead>
              <TableHead>Assertion</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Samples</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 30).map((proc) => (
              <TableRow key={proc.procedureId} data-testid={`record-${proc.procedureId}`}>
                <TableCell className="font-mono text-xs">{proc.procedureId}</TableCell>
                <TableCell className="text-sm">{proc.fsHeadLabel}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{proc.assertion}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{proc.procedureType}</Badge>
                </TableCell>
                <TableCell className="text-right">{proc.linkedSampleIds.length}</TableCell>
                <TableCell>{getStatusBadge(proc.executionStatus)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {data.length > 30 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing 30 of {data.length} procedures. Export for full list.
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 330.28 - Documentation of Procedures</span>
      </div>
    </div>
  );
}

function Step8PushToExecution({ 
  qualityGatesPassed,
  executionTasks,
  onPush,
  isPushing,
}: { 
  qualityGatesPassed: boolean;
  executionTasks: ExecutionTask[];
  onPush: () => void;
  isPushing: boolean;
}) {
  const pendingTasks = executionTasks.filter(t => t.status === 'Pending').length;
  const highPriorityTasks = executionTasks.filter(t => t.priority === 'High').length;

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold">{executionTasks.length}</div>
          <div className="text-xs text-muted-foreground">Total Tasks</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{pendingTasks}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{highPriorityTasks}</div>
          <div className="text-xs text-muted-foreground">High Priority</div>
        </div>
      </div>

      {!qualityGatesPassed && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Quality Gates Not Passed</AlertTitle>
          <AlertDescription>
            All quality gates must pass before pushing to execution. Review the Quality Gates section above.
          </AlertDescription>
        </Alert>
      )}

      {qualityGatesPassed && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Ready for Execution</AlertTitle>
          <AlertDescription>
            All quality gates have passed. The audit program is ready to be pushed to execution.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          disabled={!qualityGatesPassed || isPushing}
          onClick={onPush}
          data-testid="button-push-to-execution"
        >
          {isPushing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Pushing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Push to Execution
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
        <BookOpen className="h-4 w-4" />
        <span>Reference: ISA 330.28 - Execution of Audit Procedures</span>
      </div>
    </div>
  );
}

function Step9Documentation({ data, onCopyAll }: { data: DocumentationOutput; onCopyAll: () => void }) {
  const sections = [
    { key: 'programScopeSummary', label: 'Program Scope', content: data.programScopeSummary },
    { key: 'procedurePacksSummary', label: 'Procedure Packs', content: data.procedurePacksSummary },
    { key: 'riskResponseSummary', label: 'Risk Response', content: data.riskResponseSummary },
    { key: 'samplingLinkageSummary', label: 'Sampling Linkage', content: data.samplingLinkageSummary },
    { key: 'executionParametersSummary', label: 'Execution Parameters', content: data.executionParametersSummary },
    { key: 'qualityGatesSummary', label: 'Quality Gates', content: data.qualityGatesSummary },
  ];

  return (
    <div className="space-y-4 p-4 pt-0">
      <div className="flex justify-end">
        <Button onClick={onCopyAll} variant="outline" data-testid="button-copy-all-documentation">
          <ClipboardCopy className="mr-2 h-4 w-4" />
          Copy All Documentation
        </Button>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.key} className="rounded-lg border p-4" data-testid={`doc-section-${section.key}`}>
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
    data.usingSamplingPageSource,
    data.noOrphanSamples,
    data.noOrphanProcedures,
    data.allProceduresTiedToRisk,
    data.fullAuditTrail,
    data.isa330Compliant,
    data.executionReady,
  ];

  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2">
        {data.overallPassed ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-600" />
        )}
        <span className="font-semibold">Quality Gates (ISA 330/530 Compliance)</span>
        <Badge variant={data.overallPassed ? "default" : "secondary"}>
          {data.overallPassed ? "All Passed" : "Review Required"}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
              </div>
              <p className="text-xs text-muted-foreground">{gate.message}</p>
              <Badge variant="outline" className="text-xs">{gate.isaReference}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-lg border p-4">
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

export function AuditProgramPanel({ engagementId, onDataChange, onPushToExecution, className }: AuditProgramPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({
    1: true,
    4: true,
  });

  const [showPushDialog, setShowPushDialog] = useState(false);

  const { data: savedProgram, isLoading: isLoadingProgram } = useQuery<AuditProgramResult | null>({
    queryKey: ["/api/audit-program", engagementId],
    enabled: !!engagementId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/audit-program/${engagementId}/analyze`);
      return response.json();
    },
    onSuccess: (result: AuditProgramResult) => {
      toast({
        title: "Audit Program Generated",
        description: "ISA 330 compliant audit program has been generated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-program", engagementId] });
      onDataChange?.(result);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to generate audit program.",
        variant: "destructive",
      });
    },
  });

  const approveAIProcedureMutation = useMutation({
    mutationFn: async ({ procedureId, action }: { procedureId: string; action: 'approve' | 'reject' }) => {
      const response = await apiRequest("POST", `/api/audit-program/${engagementId}/approve-ai-procedure`, {
        procedureId,
        action,
      });
      return response.json();
    },
    onSuccess: (_, { action }) => {
      toast({
        title: action === 'approve' ? "Procedure Approved" : "Procedure Rejected",
        description: `AI-recommended procedure has been ${action}d.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-program", engagementId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message || "Failed to update procedure status.",
        variant: "destructive",
      });
    },
  });

  const pushToExecutionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/audit-program/${engagementId}/push-to-execution`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pushed to Execution",
        description: "Audit program has been successfully pushed to execution.",
      });
      setShowPushDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/audit-program", engagementId] });
      onPushToExecution?.(engagementId);
    },
    onError: (error: Error) => {
      toast({
        title: "Push Failed",
        description: error.message || "Failed to push to execution.",
        variant: "destructive",
      });
    },
  });

  const toggleStep = (step: number) => {
    setOpenSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const handleExportProcedures = () => {
    if (!savedProgram?.step7_procedureRecords) return;
    
    const headers = ["Procedure ID", "FS Head", "Assertion", "Type", "Source", "Objective", "Status", "Samples", "ISA Ref"];
    const rows = savedProgram.step7_procedureRecords.map(p => [
      p.procedureId,
      p.fsHeadLabel,
      p.assertion,
      p.procedureType,
      p.source,
      `"${p.objective.replace(/"/g, '""')}"`,
      p.executionStatus,
      p.linkedSampleIds.length.toString(),
      p.isaReference,
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    navigator.clipboard.writeText(csv);
    toast({
      title: "Exported to Clipboard",
      description: `${savedProgram.step7_procedureRecords.length} procedures copied as CSV.`,
    });
  };

  const handleCopyAllDocumentation = () => {
    if (!savedProgram?.step9_documentation) return;
    
    const doc = savedProgram.step9_documentation;
    const allText = [
      "=== ISA 330 AUDIT PROGRAM DOCUMENTATION ===",
      "",
      "PROGRAM SCOPE:",
      doc.programScopeSummary,
      "",
      "PROCEDURE PACKS:",
      doc.procedurePacksSummary,
      "",
      "RISK RESPONSE:",
      doc.riskResponseSummary,
      "",
      "SAMPLING LINKAGE:",
      doc.samplingLinkageSummary,
      "",
      "EXECUTION PARAMETERS:",
      doc.executionParametersSummary,
      "",
      "QUALITY GATES:",
      doc.qualityGatesSummary,
      "",
      "ISA REFERENCES:",
      doc.isaReferences.join(", "),
    ].join("\n");

    navigator.clipboard.writeText(allText);
    toast({
      title: "Copied to Clipboard",
      description: "All documentation sections have been copied.",
    });
  };

  const handleApproveAIProcedure = (procedureId: string) => {
    approveAIProcedureMutation.mutate({ procedureId, action: 'approve' });
  };

  const handleRejectAIProcedure = (procedureId: string) => {
    approveAIProcedureMutation.mutate({ procedureId, action: 'reject' });
  };

  const handlePushToExecution = () => {
    setShowPushDialog(true);
  };

  const confirmPushToExecution = () => {
    pushToExecutionMutation.mutate();
  };

  if (isLoadingProgram) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>ISA 330 Audit Program Engine</CardTitle>
              <CardDescription>Loading audit program data...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)} data-testid="audit-program-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="flex items-center gap-2">
                ISA 330 Audit Program Engine
                {savedProgram?.version && (
                  <Badge variant="outline" className="text-xs">v{savedProgram.version}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {savedProgram
                  ? `Generated ${formatDate(savedProgram.analysisTimestamp)}`
                  : "Generate ISA 330 compliant audit program from planning inputs"}
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            data-testid="button-analyze"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                {savedProgram ? "Regenerate" : "Generate Program"}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {savedProgram ? (
          <>
            <QualityGatesSection data={savedProgram.qualityGates} />

            <div className="space-y-2">
              {/* Step 1 - Locked Inputs */}
              <Collapsible open={openSteps[1]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={1}
                    title={STEP_TITLES[1]}
                    isOpen={openSteps[1]}
                    onToggle={() => toggleStep(1)}
                  />
                  <CollapsibleContent>
                    <Step1LockedInputs data={savedProgram.step1_lockedInputs} />
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Step 2 - Procedure Packs */}
              <Collapsible open={openSteps[2]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={2}
                    title={STEP_TITLES[2]}
                    isOpen={openSteps[2]}
                    onToggle={() => toggleStep(2)}
                    count={savedProgram.step2_procedurePacks.length}
                  />
                  <CollapsibleContent>
                    <Step2ProcedurePacks data={savedProgram.step2_procedurePacks} />
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Step 3 - Procedure Library */}
              <Collapsible open={openSteps[3]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={3}
                    title={STEP_TITLES[3]}
                    isOpen={openSteps[3]}
                    onToggle={() => toggleStep(3)}
                    count={savedProgram.step3_allProcedures.filter(p => p.source === 'Library').length}
                  />
                  <CollapsibleContent>
                    <Step3ProcedureLibrary data={savedProgram.step3_allProcedures} />
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Step 4 - AI-Recommended Procedures */}
              <Collapsible open={openSteps[4]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={4}
                    title={STEP_TITLES[4]}
                    isOpen={openSteps[4]}
                    onToggle={() => toggleStep(4)}
                    isImportant={savedProgram.step4_aiRecommendedProcedures.some(p => p.aiApprovalStatus === 'Pending')}
                    count={savedProgram.step4_aiRecommendedProcedures.length}
                  />
                  <CollapsibleContent>
                    <Step4AIRecommendedProcedures
                      data={savedProgram.step4_aiRecommendedProcedures}
                      onApprove={handleApproveAIProcedure}
                      onReject={handleRejectAIProcedure}
                      isApproving={approveAIProcedureMutation.isPending}
                    />
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Step 5 - Sample Linkages */}
              <Collapsible open={openSteps[5]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={5}
                    title={STEP_TITLES[5]}
                    isOpen={openSteps[5]}
                    onToggle={() => toggleStep(5)}
                    count={savedProgram.step5_sampleLinkages.length}
                  />
                  <CollapsibleContent>
                    <Step5SampleLinkages data={savedProgram.step5_sampleLinkages} />
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Step 6 - Execution Parameters */}
              <Collapsible open={openSteps[6]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={6}
                    title={STEP_TITLES[6]}
                    isOpen={openSteps[6]}
                    onToggle={() => toggleStep(6)}
                    count={savedProgram.step6_executionParameters.length}
                  />
                  <CollapsibleContent>
                    <Step6ExecutionParameters data={savedProgram.step6_executionParameters} />
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Step 7 - Procedure Records */}
              <Collapsible open={openSteps[7]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={7}
                    title={STEP_TITLES[7]}
                    isOpen={openSteps[7]}
                    onToggle={() => toggleStep(7)}
                    count={savedProgram.step7_procedureRecords.length}
                  />
                  <CollapsibleContent>
                    <Step7ProcedureRecords 
                      data={savedProgram.step7_procedureRecords} 
                      onExport={handleExportProcedures}
                    />
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Step 8 - Push to Execution */}
              <Collapsible open={openSteps[8]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={8}
                    title={STEP_TITLES[8]}
                    isOpen={openSteps[8]}
                    onToggle={() => toggleStep(8)}
                    isImportant={savedProgram.qualityGates.overallPassed}
                  />
                  <CollapsibleContent>
                    <Step8PushToExecution
                      qualityGatesPassed={savedProgram.qualityGates.overallPassed}
                      executionTasks={savedProgram.step8_executionTasks}
                      onPush={handlePushToExecution}
                      isPushing={pushToExecutionMutation.isPending}
                    />
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Documentation Section */}
              <Collapsible open={openSteps[9]}>
                <div className="rounded-lg border">
                  <StepHeader
                    step={9}
                    title="Documentation Output"
                    isOpen={openSteps[9] || false}
                    onToggle={() => toggleStep(9)}
                  />
                  <CollapsibleContent>
                    <Step9Documentation 
                      data={savedProgram.step9_documentation}
                      onCopyAll={handleCopyAllDocumentation}
                    />
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Audit Program Generated</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Click "Generate Program" to create an ISA 330 compliant audit program based on your planning inputs.
            </p>
            <Button 
              className="mt-4" 
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              data-testid="button-generate-first"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Generate Audit Program
                </>
              )}
            </Button>
          </div>
        )}

        {/* Push to Execution Confirmation Dialog */}
        <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Push to Execution</DialogTitle>
              <DialogDescription>
                Are you sure you want to push this audit program to execution? This action will create execution tasks 
                for all procedures and lock the audit program from further modifications.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {savedProgram?.step7_procedureRecords.length || 0} procedures will be pushed
                </span>
              </div>
              <div className="flex items-center gap-2">
                <List className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {savedProgram?.step8_executionTasks.length || 0} execution tasks will be created
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPushDialog(false)}>
                Cancel
              </Button>
              <Button onClick={confirmPushToExecution} disabled={pushToExecutionMutation.isPending}>
                {pushToExecutionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Confirm Push
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
