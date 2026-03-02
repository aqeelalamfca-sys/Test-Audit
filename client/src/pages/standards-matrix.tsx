import { useState, useMemo, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  STANDARDS_MAP,
  STANDARDS_BY_PHASE,
  PHASE_STAGE_GATES,
  getNoReportBlockerStandards,
  getStandardsIntegrationMatrix,
  type StandardConfig,
} from "@/lib/standards-config";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { PageShell } from "@/components/page-shell";
import {
  Shield,
  CheckCircle2,
  Lock,
  LockOpen,
  AlertTriangle,
  AlertOctagon,
  FileCheck,
  BarChart3,
  Layers,
  ClipboardList,
  Sparkles,
  Loader2,
  FileText,
  Copy,
  BookMarked,
  Link2,
  Zap,
  Target,
  TrendingUp,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Clock,
  User,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type StatusCode = "Grey" | "Green" | "Amber" | "Orange" | "Red";

interface ISAPhaseRecord {
  isaId: string;
  isaName: string;
  phase: string;
  statusCode: StatusCode;
  completionPct: number;
  mandatoryDocsRequired: number;
  mandatoryDocsCompleted: number;
  signoffRequired: boolean;
  signoffDone: boolean;
  signoffRole: string;
  riskLinkRequired: boolean;
  riskLinkScore: number;
  lastUpdated: string | null;
  owner: string;
  agingDays: number;
  blockingFlag: boolean;
  blockerReason: string;
}

interface NoReportBlocker {
  isaId: string;
  isaName: string;
  gateDescription: string;
  passed: boolean;
  blockerDetails: string;
  owner: string;
  fixRoute: string;
}

interface PhaseHeatbarData {
  phase: string;
  completionPct: number;
  locked: boolean;
  greenCount: number;
  amberCount: number;
  orangeCount: number;
  redCount: number;
  greyCount: number;
}

interface ComplianceSummaryData {
  overallScore: number;
  reportReady: boolean;
  redGapCount: number;
  orangeGapCount: number;
  amberGapCount: number;
  pendingSignoffs: number;
  eqcrStatus: string;
  significantRisksMissingLink: number;
  unadjustedVsPM: {
    unadjustedTotal: number;
    performanceMateriality: number;
    exceeds: boolean;
  };
}

interface ISAScore {
  isa: string;
  area: string;
  percentage: number;
  status: string;
  gaps?: Array<{ issue: string }>;
}

interface CriticalGap {
  priority: string;
  issue: string;
  isaReference: string;
  fix: string;
}

interface HealthCheckData {
  isaScores: ISAScore[];
  criticalGaps: CriticalGap[];
  overallScore: number;
  overallStatus: string;
  recommendations: string[];
}

interface GapItem extends ISAPhaseRecord {
  gapDescription: string;
  severity: StatusCode;
}

interface DraftOption {
  outputType: string;
  label: string;
  description: string;
  isaRef: string;
  iconType: string;
}

interface DraftDialogState {
  open: boolean;
  outputType: string;
  label: string;
  content: string;
  isaReferences: string[];
}

interface ResolutionDialogState {
  open: boolean;
  gap: GapItem | null;
  resolution: string;
}

const PHASE_ORDER = ["pre-planning", "planning", "execution", "finalization", "deliverables", "eqcr"];

const PHASE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "pre-planning": { bg: "bg-blue-500", text: "text-blue-600", label: "Pre-Planning" },
  "planning": { bg: "bg-purple-500", text: "text-purple-600", label: "Planning" },
  "execution": { bg: "bg-emerald-500", text: "text-emerald-600", label: "Execution" },
  "finalization": { bg: "bg-rose-500", text: "text-rose-600", label: "Finalization" },
  "deliverables": { bg: "bg-sky-500", text: "text-sky-600", label: "Deliverables" },
  "eqcr": { bg: "bg-amber-600", text: "text-amber-600", label: "EQCR" },
};

const STATUS_COLORS: Record<string, { bg: string; label: string }> = {
  Green: { bg: "bg-green-500", label: "Complete" },
  Amber: { bg: "bg-amber-500", label: "Minor Pending" },
  Orange: { bg: "bg-orange-500", label: "Significant" },
  Red: { bg: "bg-red-500", label: "Critical" },
  Grey: { bg: "bg-gray-400", label: "Not Started" },
};

const ISA_CATEGORIES: Record<string, string[]> = {
  "Pre-Engagement & Quality": ["ISA 200", "ISA 210", "ISA 220", "ISA 220 (Revised)", "ISQM 1", "IESBA Code"],
  "Risk Assessment & Planning": ["ISA 230", "ISA 240", "ISA 250", "ISA 260", "ISA 300", "ISA 315", "ISA 320", "ISA 330", "ISA 402"],
  "Evidence & Procedures": ["ISA 450", "ISA 500", "ISA 501", "ISA 505", "ISA 510", "ISA 520", "ISA 530"],
  "Specialized Areas": ["ISA 540", "ISA 550", "ISA 560", "ISA 570", "ISA 580", "ISA 600 (Rev)", "ISA 610", "ISA 620"],
  "Quality & Controls": ["ISA 265"],
  "Reporting": ["ISA 700", "ISA 701", "ISA 705", "ISA 706", "ISA 708", "ISA 710", "ISA 720"],
};

const ISA_DRAFT_OPTIONS: DraftOption[] = [
  { outputType: "ISA_260_PLANNING", label: "ISA 260 TCWG Communication (Planning)", description: "Communication to Those Charged With Governance at planning stage", isaRef: "ISA 260.14-17", iconType: "clipboard" },
  { outputType: "ISA_260_FINAL", label: "ISA 260 TCWG Communication (Final)", description: "Final communication to TCWG at completion stage", isaRef: "ISA 260.16-17", iconType: "filetext" },
  { outputType: "ISA_570", label: "ISA 570 Going Concern Memo", description: "Going concern assessment memorandum", isaRef: "ISA 570.10-23", iconType: "trending" },
  { outputType: "ISA_580", label: "ISA 580 Management Representation Letter", description: "Written representations from management", isaRef: "ISA 580.10-13", iconType: "filecheck" },
  { outputType: "ISA_700", label: "ISA 700 Audit Report Skeleton", description: "Independent auditor's report structure", isaRef: "ISA 700.21-46", iconType: "shield" },
  { outputType: "ISA_701", label: "ISA 701 Key Audit Matters", description: "KAM communication drafts", isaRef: "ISA 701.9-13", iconType: "target" },
];

const DRAFT_ICONS: Record<string, typeof ClipboardList> = {
  clipboard: ClipboardList,
  filetext: FileText,
  trending: TrendingUp,
  filecheck: FileCheck,
  shield: Shield,
  target: Target,
};

function PhaseBadge({ phase }: { phase: string }) {
  const color = PHASE_COLORS[phase] || { bg: "bg-muted", text: "text-muted-foreground", label: phase };
  return (
    <Badge className={`text-[10px] ${color.bg} text-white border-0 no-default-hover-elevate no-default-active-elevate`}>
      {color.label}
    </Badge>
  );
}

function StatusDot({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Grey;
  const s = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  return <div className={`${s} rounded-full ${c.bg}`} title={c.label} data-testid={`dot-status-${status}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Grey;
  return (
    <Badge className={`text-[10px] ${c.bg} text-white border-0 no-default-hover-elevate no-default-active-elevate`} data-testid={`badge-status-${status}`}>
      {c.label}
    </Badge>
  );
}

function StatusLegend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {Object.entries(STATUS_COLORS).map(([k, v]) => (
        <div key={k} className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded-full ${v.bg}`} />
          <span className="text-[10px] text-muted-foreground">{k}: {v.label}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">{message}</span>
    </div>
  );
}

function ErrorState({ message = "Failed to load data", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertOctagon className="w-8 h-8 text-red-500" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} data-testid="button-retry">
          Retry
        </Button>
      )}
    </div>
  );
}

function KPICard({ title, value, subtitle, color, icon, testId }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  icon: React.ReactNode;
  testId: string;
}) {
  const colorClasses = useMemo(() => {
    switch (color) {
      case "green": return { bg: "bg-green-100 dark:bg-green-950/40 text-green-600", text: "text-green-600" };
      case "red": return { bg: "bg-red-100 dark:bg-red-950/40 text-red-600", text: "text-red-600" };
      case "amber": return { bg: "bg-amber-100 dark:bg-amber-950/40 text-amber-600", text: "text-amber-600" };
      default: return { bg: "bg-muted text-muted-foreground", text: "" };
    }
  }, [color]);

  return (
    <Card className="p-3" data-testid={testId}>
      <div className="flex items-start gap-2">
        <div className={`p-1.5 rounded-md ${colorClasses.bg}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{title}</div>
          <div className={`text-xl font-bold ${colorClasses.text}`}>{value}</div>
          {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </Card>
  );
}

function AgingText({ days }: { days: number }) {
  const className = days > 14 ? "text-red-600 font-medium" : days > 7 ? "text-amber-600" : "";
  return <span className={className}>{days}d</span>;
}

function OwnerLabel({ owner }: { owner: string }) {
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <User className="w-3 h-3" />{owner?.replace(/_/g, " ") || "EP"}
    </span>
  );
}

const VIEW_TABS = [
  { id: "overview", label: "Compliance Overview", icon: <Shield className="w-3.5 h-3.5" /> },
  { id: "heatmap", label: "ISA Heatmap", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: "gap-analysis", label: "Gap Analysis", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { id: "risk-trace", label: "Risk Traceability", icon: <Link2 className="w-3.5 h-3.5" /> },
  { id: "signoff", label: "Sign-off Register", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "integration", label: "Integration Matrix", icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "ai-assist", label: "AI Assistance", icon: <Sparkles className="w-3.5 h-3.5" /> },
];

function useComplianceData(engagementId: string | undefined) {
  const summary = useQuery<ComplianceSummaryData | null>({
    queryKey: ["/api/isa-compliance/engagements", engagementId, "compliance-summary"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/isa-compliance/engagements/${engagementId}/compliance-summary`);
      if (!res.ok) throw new Error(`Compliance summary failed: ${res.status}`);
      return res.json();
    },
    enabled: !!engagementId,
  });
  const heatbar = useQuery<{ phases: PhaseHeatbarData[] } | null>({
    queryKey: ["/api/isa-compliance/engagements", engagementId, "phase-heatbar"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/isa-compliance/engagements/${engagementId}/phase-heatbar`);
      if (!res.ok) throw new Error(`Phase heatbar failed: ${res.status}`);
      return res.json();
    },
    enabled: !!engagementId,
  });
  const blockers = useQuery<{ blockers: NoReportBlocker[]; totalGates: number; passedGates: number } | null>({
    queryKey: ["/api/isa-compliance/engagements", engagementId, "no-report-blockers"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/isa-compliance/engagements/${engagementId}/no-report-blockers`);
      if (!res.ok) throw new Error(`No-report blockers failed: ${res.status}`);
      return res.json();
    },
    enabled: !!engagementId,
  });
  const phaseCompliance = useQuery<{ records: ISAPhaseRecord[] } | null>({
    queryKey: ["/api/isa-compliance/engagements", engagementId, "phase-compliance"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/isa-compliance/engagements/${engagementId}/phase-compliance`);
      if (!res.ok) throw new Error(`Phase compliance failed: ${res.status}`);
      return res.json();
    },
    enabled: !!engagementId,
  });
  const healthCheck = useQuery<HealthCheckData | null>({
    queryKey: ["/api/isa-compliance/engagements", engagementId, "health-check"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/isa-compliance/engagements/${engagementId}/health-check`);
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
      return res.json();
    },
    enabled: !!engagementId,
  });
  return { summary, heatbar, blockers, phaseCompliance, healthCheck };
}

type ComplianceDataHook = ReturnType<typeof useComplianceData>;

function ComplianceOverviewTab({ data }: { data: ComplianceDataHook }) {
  if (data.summary.isLoading || data.heatbar.isLoading || data.blockers.isLoading) return <LoadingState message="Computing compliance status..." />;
  if (data.summary.isError) return <ErrorState message="Failed to load compliance summary" onRetry={() => data.summary.refetch()} />;

  const s: ComplianceSummaryData = data.summary.data || {
    overallScore: 0, reportReady: false, redGapCount: 0, orangeGapCount: 0, amberGapCount: 0,
    pendingSignoffs: 0, eqcrStatus: "N/A", significantRisksMissingLink: 0,
    unadjustedVsPM: { unadjustedTotal: 0, performanceMateriality: 0, exceeds: false },
  };
  const phases: PhaseHeatbarData[] = data.heatbar.data?.phases || [];
  const gates: NoReportBlocker[] = data.blockers.data?.blockers || [];
  const passedGates = gates.filter((g) => g.passed).length;

  return (
    <div className="space-y-4" data-testid="tab-compliance-overview">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3" data-testid="kpi-cards">
        <KPICard
          title="Compliance Score"
          value={`${s.overallScore}%`}
          color={s.overallScore >= 90 ? "green" : s.overallScore >= 70 ? "amber" : "red"}
          icon={<Shield className="w-4 h-4" />}
          testId="kpi-overall-score"
        />
        <KPICard
          title="Report Ready"
          value={s.reportReady ? "YES" : "NO"}
          subtitle={`${passedGates}/${gates.length} gates passed`}
          color={s.reportReady ? "green" : "red"}
          icon={s.reportReady ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          testId="kpi-report-ready"
        />
        <KPICard title="Red ISA Gaps" value={s.redGapCount} color={s.redGapCount > 0 ? "red" : "green"} icon={<AlertOctagon className="w-4 h-4" />} testId="kpi-red-gaps" />
        <KPICard title="Pending Sign-offs" value={s.pendingSignoffs} color={s.pendingSignoffs > 0 ? "amber" : "green"} icon={<ClipboardList className="w-4 h-4" />} testId="kpi-pending-signoffs" />
        <KPICard title="EQCR Status" value={s.eqcrStatus?.replace(/_/g, " ") || "N/A"} color={s.eqcrStatus === "Approved" ? "green" : s.eqcrStatus === "Not Required" ? "neutral" : "amber"} icon={<Eye className="w-4 h-4" />} testId="kpi-eqcr" />
        <KPICard title="Risks Unlinked" value={s.significantRisksMissingLink} subtitle="Significant risks" color={s.significantRisksMissingLink > 0 ? "red" : "green"} icon={<Link2 className="w-4 h-4" />} testId="kpi-risks-missing" />
        <KPICard title="Misstatements" value={s.unadjustedVsPM?.unadjustedTotal?.toLocaleString() || "0"} subtitle={`PM: ${s.unadjustedVsPM?.performanceMateriality?.toLocaleString() || 0}`} color={s.unadjustedVsPM?.exceeds ? "red" : "green"} icon={<TrendingUp className="w-4 h-4" />} testId="kpi-misstatements" />
      </div>

      <Card data-testid="phase-heatbar">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" />Phase Completion Heatbar</CardTitle>
          <CardDescription>ISA compliance distribution across audit phases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {phases.map((p) => {
              const pc = PHASE_COLORS[p.phase] || PHASE_COLORS["pre-planning"];
              const total = (p.greenCount || 0) + (p.amberCount || 0) + (p.orangeCount || 0) + (p.redCount || 0) + (p.greyCount || 0);
              return (
                <div key={p.phase} className="flex items-center gap-3" data-testid={`heatbar-phase-${p.phase}`}>
                  <div className="w-28 flex items-center gap-2 flex-shrink-0">
                    {p.locked ? <Lock className="w-3.5 h-3.5 text-green-600" /> : <LockOpen className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className={`text-xs font-medium ${pc.text}`}>{pc.label}</span>
                  </div>
                  <div className="flex-1 flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {total > 0 && (
                      <>
                        {p.greenCount > 0 && <div className="bg-green-500 h-full transition-all" style={{ width: `${(p.greenCount / total) * 100}%` }} title={`${p.greenCount} Complete`} />}
                        {p.amberCount > 0 && <div className="bg-amber-500 h-full transition-all" style={{ width: `${(p.amberCount / total) * 100}%` }} title={`${p.amberCount} Minor Pending`} />}
                        {p.orangeCount > 0 && <div className="bg-orange-500 h-full transition-all" style={{ width: `${(p.orangeCount / total) * 100}%` }} title={`${p.orangeCount} Significant`} />}
                        {p.redCount > 0 && <div className="bg-red-500 h-full transition-all" style={{ width: `${(p.redCount / total) * 100}%` }} title={`${p.redCount} Critical`} />}
                        {p.greyCount > 0 && <div className="bg-gray-400 h-full transition-all" style={{ width: `${(p.greyCount / total) * 100}%` }} title={`${p.greyCount} Not Started`} />}
                      </>
                    )}
                  </div>
                  <div className="w-16 text-right flex items-center gap-1 justify-end flex-shrink-0">
                    <span className="text-xs font-semibold">{p.completionPct}%</span>
                    <span className="text-[10px] text-muted-foreground">({total})</span>
                  </div>
                </div>
              );
            })}
          </div>
          <Separator className="my-3" />
          <StatusLegend />
        </CardContent>
      </Card>

      <Card data-testid="no-report-blockers">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><AlertOctagon className="w-4 h-4 text-red-500" />No-Report Blockers (Hard Lock Gates)</CardTitle>
              <CardDescription>Reporting remains locked until ALL {gates.length} gates are satisfied — {passedGates} passed</CardDescription>
            </div>
            <Badge className={`${passedGates === gates.length ? "bg-green-500" : "bg-red-500"} text-white border-0 no-default-hover-elevate no-default-active-elevate`}>
              {passedGates}/{gates.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Status</TableHead>
                <TableHead className="w-24">ISA</TableHead>
                <TableHead>Gate Requirement</TableHead>
                <TableHead className="w-44">Blocker Details</TableHead>
                <TableHead className="w-28">Owner</TableHead>
                <TableHead className="w-16 text-center">Fix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gates.map((g) => (
                <TableRow key={g.isaId} className={g.passed ? "" : "bg-red-50/50 dark:bg-red-950/20"} data-testid={`blocker-${g.isaId}`}>
                  <TableCell className="text-center">
                    {g.passed ? <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" /> : <XCircle className="w-5 h-5 text-red-600 mx-auto" />}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{g.isaName}</TableCell>
                  <TableCell className="text-sm">{g.gateDescription}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{g.passed ? "Satisfied" : (g.blockerDetails || "Not completed")}</TableCell>
                  <TableCell><OwnerLabel owner={g.owner} /></TableCell>
                  <TableCell className="text-center">
                    {!g.passed && g.fixRoute && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Navigate to fix" data-testid={`button-fix-${g.isaId}`}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function HeatmapDrilldown({ cell, onClose }: { cell: ISAPhaseRecord | null; onClose: () => void }) {
  if (!cell) return null;
  return (
    <Dialog open={!!cell} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusDot status={cell.statusCode} />
            {cell.isaName} — {PHASE_COLORS[cell.phase]?.label || cell.phase}
          </DialogTitle>
          <DialogDescription>ISA compliance drilldown — {cell.completionPct}% complete</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={cell.statusCode} />
            <Progress value={cell.completionPct} className="flex-1 h-2" />
            <span className="text-sm font-medium">{cell.completionPct}%</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <DrilldownCell label="Docs Required" value={String(cell.mandatoryDocsRequired)} />
            <DrilldownCell label="Docs Done" value={String(cell.mandatoryDocsCompleted)} />
            <DrilldownCell label="Sign-off" value={cell.signoffDone ? "Done" : cell.signoffRequired ? "Pending" : "N/A"} valueClass={cell.signoffDone ? "text-green-600" : cell.signoffRequired ? "text-amber-600" : ""} />
            <DrilldownCell label="Sign-off Role" value={cell.signoffRole?.replace(/_/g, " ")} small />
            <DrilldownCell label="Risk Link" value={cell.riskLinkRequired ? `${cell.riskLinkScore}%` : "N/A"} />
            <DrilldownCell label="Aging" value={`${cell.agingDays} days`} valueClass={cell.agingDays > 14 ? "text-red-600" : cell.agingDays > 7 ? "text-amber-600" : ""} icon={<Clock className="w-3 h-3" />} />
            <DrilldownCell label="Owner" value={cell.owner?.replace(/_/g, " ")} small icon={<User className="w-3 h-3" />} />
            <DrilldownCell label="Blocking" value={cell.blockingFlag ? "YES" : "No"} valueClass={cell.blockingFlag ? "text-red-600" : "text-green-600"} />
          </div>
          {cell.blockerReason && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
              <div className="text-xs text-red-600 font-semibold mb-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3" />Blocker Reason</div>
              <div className="text-sm">{cell.blockerReason}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DrilldownCell({ label, value, valueClass = "", small = false, icon }: {
  label: string; value: string; valueClass?: string; small?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className="p-2.5 bg-muted/50 rounded-lg">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">{icon}{label}</div>
      <div className={`font-semibold mt-0.5 ${small ? "text-xs" : ""} ${valueClass}`}>{value}</div>
    </div>
  );
}

function ISAHeatmapTab({ data }: { data: ComplianceDataHook }) {
  const [selectedCell, setSelectedCell] = useState<ISAPhaseRecord | null>(null);
  if (data.phaseCompliance.isLoading) return <LoadingState message="Loading ISA heatmap..." />;
  if (data.phaseCompliance.isError) return <ErrorState message="Failed to load compliance data" onRetry={() => data.phaseCompliance.refetch()} />;

  const records: ISAPhaseRecord[] = data.phaseCompliance.data?.records || [];

  const recordMap = useMemo(() => {
    const map = new Map<string, ISAPhaseRecord>();
    for (const r of records) map.set(`${r.isaName}__${r.phase}`, r);
    return map;
  }, [records]);

  const categorizedISAs = useMemo(() => {
    const categories: Array<{ name: string; standards: string[] }> = [];
    for (const [category, isaNames] of Object.entries(ISA_CATEGORIES)) {
      const matchedNames = isaNames.filter((isa) => records.some((r) => r.isaName === isa));
      if (matchedNames.length > 0) {
        categories.push({ name: category, standards: matchedNames });
      }
    }
    const allCategorized = new Set(Object.values(ISA_CATEGORIES).flat());
    const uncategorized = [...new Set(records.map((r) => r.isaName))].filter((n) => !allCategorized.has(n));
    if (uncategorized.length > 0) {
      categories.push({ name: "Other Standards", standards: uncategorized });
    }
    return categories;
  }, [records]);

  const getStatusColor = useCallback((statusCode: StatusCode): string => {
    switch (statusCode) {
      case "Green": return "#22c55e";
      case "Amber": return "#f59e0b";
      case "Orange": return "#f97316";
      case "Red": return "#ef4444";
      default: return "#9ca3af";
    }
  }, []);

  return (
    <div className="space-y-4" data-testid="tab-isa-heatmap">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" />ISA x Phase Compliance Heatmap</CardTitle>
          <CardDescription>Click any cell to view details. Rows grouped by ISA category, columns by audit phase.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32 sticky left-0 bg-background z-10">ISA Standard</TableHead>
                  {PHASE_ORDER.map((phase) => <TableHead key={phase} className="text-center w-24"><PhaseBadge phase={phase} /></TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorizedISAs.map((cat) => (
                  <>
                    <TableRow key={`cat-${cat.name}`} className="bg-muted/30 hover:bg-muted/40">
                      <TableCell colSpan={PHASE_ORDER.length + 1} className="py-1.5 sticky left-0 z-10">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.name}</span>
                      </TableCell>
                    </TableRow>
                    {cat.standards.map((isa) => (
                      <TableRow key={isa} data-testid={`heatmap-row-${isa}`}>
                        <TableCell className="font-medium text-xs sticky left-0 bg-background z-10 whitespace-nowrap">{isa}</TableCell>
                        {PHASE_ORDER.map((phase) => {
                          const rec = recordMap.get(`${isa}__${phase}`);
                          if (!rec) return (
                            <TableCell key={phase} className="text-center">
                              <div className="w-8 h-8 mx-auto rounded-md bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-800" />
                            </TableCell>
                          );
                          return (
                            <TableCell key={phase} className="text-center">
                              <button
                                className="w-9 h-9 rounded-md flex items-center justify-center mx-auto cursor-pointer transition-all hover:scale-110 hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 relative"
                                style={{ backgroundColor: getStatusColor(rec.statusCode) }}
                                onClick={() => setSelectedCell(rec)}
                                title={`${isa} - ${PHASE_COLORS[phase]?.label || phase}: ${rec.completionPct}%`}
                                data-testid={`heatmap-cell-${isa}-${phase}`}
                              >
                                <span className="text-[9px] font-bold text-white">{rec.completionPct}%</span>
                                {rec.blockingFlag && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border border-white" />}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <StatusLegend />
      <HeatmapDrilldown cell={selectedCell} onClose={() => setSelectedCell(null)} />
    </div>
  );
}

function GapAnalysisTab({ data, engagementId }: { data: ComplianceDataHook; engagementId?: string }) {
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [resolutionDialog, setResolutionDialog] = useState<ResolutionDialogState>({ open: false, gap: null, resolution: "" });

  const gapResolutionMutation = useMutation({
    mutationFn: async (gap: GapItem) => {
      const res = await apiRequest("POST", `/api/isa-compliance/engagements/${engagementId}/ai-gap-resolution`, {
        isaId: gap.isaId, isaName: gap.isaName, phase: gap.phase, gapDescription: gap.gapDescription, severity: gap.severity,
      });
      return res.json();
    },
    onSuccess: (data: { resolution?: string; content?: string }) => setResolutionDialog((prev) => ({ ...prev, resolution: data.resolution || data.content || "" })),
    onError: (error: Error) => toast({ title: "AI Error", description: error.message, variant: "destructive" }),
  });

  if (data.phaseCompliance.isLoading) return <LoadingState />;
  if (data.phaseCompliance.isError) return <ErrorState message="Failed to load compliance data" onRetry={() => data.phaseCompliance.refetch()} />;

  const records: ISAPhaseRecord[] = (data.phaseCompliance.data?.records || []).filter(
    (r) => r.statusCode !== "Green" && r.statusCode !== "Grey"
  );

  const allGaps: GapItem[] = useMemo(() => records.map((r) => ({
    ...r,
    gapDescription: r.blockerReason || (r.mandatoryDocsCompleted < r.mandatoryDocsRequired ? `${r.mandatoryDocsRequired - r.mandatoryDocsCompleted} mandatory document(s) missing` : r.signoffRequired && !r.signoffDone ? "Sign-off pending" : r.riskLinkRequired && r.riskLinkScore < 100 ? `Risk linkage incomplete (${r.riskLinkScore}%)` : "Incomplete — review required"),
    severity: r.statusCode as StatusCode,
  })), [records]);

  const filteredGaps = useMemo(() => {
    let result = allGaps;
    if (severityFilter !== "all") result = result.filter((g) => g.severity === severityFilter);
    if (phaseFilter !== "all") result = result.filter((g) => g.phase === phaseFilter);
    return result;
  }, [allGaps, severityFilter, phaseFilter]);

  const severityCounts = useMemo(() => ({
    Red: records.filter((r) => r.statusCode === "Red").length,
    Orange: records.filter((r) => r.statusCode === "Orange").length,
    Amber: records.filter((r) => r.statusCode === "Amber").length,
  }), [records]);

  const handleResolve = useCallback((g: GapItem) => {
    setResolutionDialog({ open: true, gap: g, resolution: "" });
    if (engagementId) gapResolutionMutation.mutate(g);
  }, [engagementId, gapResolutionMutation]);

  return (
    <div className="space-y-4" data-testid="tab-gap-analysis">
      <div className="flex items-center gap-3 flex-wrap">
        <Card className="flex items-center gap-2 px-3 py-2 border-red-200 dark:border-red-900">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm font-medium">{severityCounts.Red} Critical</span>
        </Card>
        <Card className="flex items-center gap-2 px-3 py-2 border-orange-200 dark:border-orange-900">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-sm font-medium">{severityCounts.Orange} Significant</span>
        </Card>
        <Card className="flex items-center gap-2 px-3 py-2 border-amber-200 dark:border-amber-900">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm font-medium">{severityCounts.Amber} Minor</span>
        </Card>
        <div className="flex-1" />
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="filter-severity"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="Red">Critical</SelectItem>
            <SelectItem value="Orange">Significant</SelectItem>
            <SelectItem value="Amber">Minor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="filter-phase"><SelectValue placeholder="Phase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            {PHASE_ORDER.map((p) => <SelectItem key={p} value={p}>{PHASE_COLORS[p]?.label || p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">Sev.</TableHead>
                <TableHead className="w-24">ISA</TableHead>
                <TableHead className="w-28">Phase</TableHead>
                <TableHead>Gap Description</TableHead>
                <TableHead className="w-24">Owner</TableHead>
                <TableHead className="w-20 text-center">Docs</TableHead>
                <TableHead className="w-16 text-center">Aging</TableHead>
                <TableHead className="w-16 text-center">Blocker</TableHead>
                <TableHead className="w-20 text-center">AI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGaps.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8"><CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-600" />No gaps detected — all ISA requirements satisfied</TableCell></TableRow>
              ) : filteredGaps.map((g, i) => (
                <TableRow key={`${g.isaId}-${g.phase}-${i}`} className={g.severity === "Red" ? "bg-red-50/50 dark:bg-red-950/20" : g.severity === "Orange" ? "bg-orange-50/30 dark:bg-orange-950/10" : ""} data-testid={`gap-row-${g.isaId}`}>
                  <TableCell className="text-center"><StatusDot status={g.severity} size="sm" /></TableCell>
                  <TableCell className="font-medium text-xs">{g.isaName}</TableCell>
                  <TableCell><PhaseBadge phase={g.phase} /></TableCell>
                  <TableCell className="text-xs max-w-[200px]">{g.gapDescription}</TableCell>
                  <TableCell><OwnerLabel owner={g.owner} /></TableCell>
                  <TableCell className="text-center text-xs">{g.mandatoryDocsCompleted}/{g.mandatoryDocsRequired}</TableCell>
                  <TableCell className="text-center text-xs"><AgingText days={g.agingDays} /></TableCell>
                  <TableCell className="text-center">{g.blockingFlag && <AlertOctagon className="w-4 h-4 text-red-600 mx-auto" />}</TableCell>
                  <TableCell className="text-center">
                    <Button size="sm" variant="ghost" onClick={() => handleResolve(g)} disabled={!engagementId} className="h-7 w-7 p-0" data-testid={`button-ai-resolve-${g.isaId}`}>
                      <Sparkles className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={resolutionDialog.open} onOpenChange={(open) => setResolutionDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-gap-resolution">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" />AI Gap Resolution</DialogTitle>
            <DialogDescription>{resolutionDialog.gap && `${resolutionDialog.gap.isaName} — ${PHASE_COLORS[resolutionDialog.gap.phase]?.label} — ${STATUS_COLORS[resolutionDialog.gap.severity]?.label}`}</DialogDescription>
          </DialogHeader>
          {gapResolutionMutation.isPending ? (
            <LoadingState message="Generating resolution plan..." />
          ) : resolutionDialog.resolution ? (
            <div className="space-y-3">
              <Textarea className="min-h-[300px] text-sm font-mono" value={resolutionDialog.resolution} onChange={(e) => setResolutionDialog((prev) => ({ ...prev, resolution: e.target.value }))} data-testid="textarea-gap-resolution" />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(resolutionDialog.resolution); toast({ title: "Copied to clipboard" }); }} data-testid="button-copy-resolution"><Copy className="w-3.5 h-3.5 mr-1" />Copy</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (engagementId && resolutionDialog.gap) gapResolutionMutation.mutate(resolutionDialog.gap); }} disabled={gapResolutionMutation.isPending} data-testid="button-regenerate-resolution"><Sparkles className="w-3.5 h-3.5 mr-1" />Regenerate</Button>
                <span className="text-[10px] text-muted-foreground ml-auto">AI-generated — requires professional review per ISA 220</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RiskTraceabilityTab({ data }: { data: ComplianceDataHook }) {
  if (data.healthCheck.isLoading) return <LoadingState />;
  if (data.healthCheck.isError) return <ErrorState message="Failed to load health check data" onRetry={() => data.healthCheck.refetch()} />;

  const scores: ISAScore[] = data.healthCheck.data?.isaScores || [];
  const allGaps: CriticalGap[] = data.healthCheck.data?.criticalGaps || [];

  const riskScores = useMemo(() =>
    scores.filter((s) => ["ISA 315", "ISA 330", "ISA 240"].includes(s.isa)),
    [scores]
  );
  const overallRiskLinkScore = riskScores.length > 0
    ? Math.round(riskScores.reduce((acc, s) => acc + s.percentage, 0) / riskScores.length)
    : 0;

  const chainSteps = useMemo(() => [
    { label: "Risk Identified", isa: "ISA 315", score: scores.find((s) => s.isa === "ISA 315")?.percentage || 0, description: "Risks identified and assessed" },
    { label: "Response Designed", isa: "ISA 330", score: scores.find((s) => s.isa === "ISA 330")?.percentage || 0, description: "Audit responses to risks" },
    { label: "Evidence Obtained", isa: "ISA 500", score: scores.find((s) => s.isa === "ISA 500")?.percentage || 0, description: "Sufficient appropriate evidence" },
    { label: "Misstatements", isa: "ISA 450", score: scores.find((s) => s.isa === "ISA 450")?.percentage || 0, description: "Evaluation of misstatements" },
    { label: "Opinion", isa: "ISA 700-706", score: scores.find((s) => s.isa === "ISA 700-706")?.percentage || 0, description: "Audit opinion formed" },
  ], [scores]);

  return (
    <div className="space-y-4" data-testid="tab-risk-traceability">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Link2 className="w-4 h-4" />Risk — Response — Evidence — Conclusion — Opinion</CardTitle>
              <CardDescription>Complete audit trail traceability chain per ISA 330</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Risk Link Score</div>
              <div className={`text-2xl font-bold ${overallRiskLinkScore >= 80 ? "text-green-600" : overallRiskLinkScore >= 60 ? "text-amber-600" : "text-red-600"}`}>{overallRiskLinkScore}%</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-1 flex-wrap justify-center">
            {chainSteps.map((step, i) => {
              const isComplete = step.score >= 80;
              const isPartial = step.score >= 50 && step.score < 80;
              return (
                <div key={step.isa} className="flex items-center gap-1">
                  <div className={`px-4 py-3 rounded-lg border-2 text-center min-w-[120px] transition-colors ${isComplete ? "border-green-400 bg-green-50 dark:bg-green-950/20" : isPartial ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : "border-red-400 bg-red-50 dark:bg-red-950/20"}`}>
                    <div className="text-xs font-medium">{step.label}</div>
                    <div className={`text-lg font-bold ${isComplete ? "text-green-600" : isPartial ? "text-amber-600" : "text-red-600"}`}>{step.score}%</div>
                    <div className="text-[10px] text-muted-foreground">{step.isa}</div>
                    <Progress value={step.score} className="h-1 mt-1.5" />
                  </div>
                  {i < chainSteps.length - 1 && <ArrowRight className={`w-5 h-5 flex-shrink-0 ${isComplete ? "text-green-500" : "text-muted-foreground"}`} />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">ISA Compliance Scores</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">ISA</TableHead>
                <TableHead>Area</TableHead>
                <TableHead className="w-32 text-center">Score</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-16 text-center">Gaps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map((s) => (
                <TableRow key={s.isa} data-testid={`trace-row-${s.isa}`}>
                  <TableCell className="font-medium text-sm">{s.isa}</TableCell>
                  <TableCell className="text-sm">{s.area}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <Progress value={s.percentage} className="h-2 w-20" />
                      <span className="text-xs font-medium w-8 text-right">{s.percentage}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-[10px] border-0 no-default-hover-elevate no-default-active-elevate ${s.status === "COMPLIANT" ? "bg-green-500 text-white" : s.status === "PARTIAL" ? "bg-amber-500 text-white" : s.status === "GAP" ? "bg-orange-500 text-white" : "bg-red-500 text-white"}`}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs">{s.gaps?.length || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {allGaps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Critical Gaps Requiring Attention ({allGaps.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Priority</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-32">ISA Reference</TableHead>
                  <TableHead>Resolution Path</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allGaps.slice(0, 20).map((g, i) => (
                  <TableRow key={i} className={g.priority === "CRITICAL" ? "bg-red-50/30 dark:bg-red-950/10" : ""} data-testid={`critical-gap-${i}`}>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 no-default-hover-elevate no-default-active-elevate ${g.priority === "CRITICAL" ? "bg-red-500 text-white" : g.priority === "HIGH" ? "bg-orange-500 text-white" : "bg-amber-500 text-white"}`}>{g.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{g.issue}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{g.isaReference}</TableCell>
                    <TableCell className="text-xs">{g.fix}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SignoffRegisterTab({ data }: { data: ComplianceDataHook }) {
  if (data.phaseCompliance.isLoading) return <LoadingState />;
  if (data.phaseCompliance.isError) return <ErrorState message="Failed to load sign-off data" onRetry={() => data.phaseCompliance.refetch()} />;

  const allRecords: ISAPhaseRecord[] = data.phaseCompliance.data?.records || [];
  const records = useMemo(() => allRecords.filter((r) => r.signoffRequired), [allRecords]);
  const signedOff = useMemo(() => records.filter((r) => r.signoffDone), [records]);
  const pending = useMemo(() => records.filter((r) => !r.signoffDone), [records]);

  const funnelData = useMemo(() => {
    const preparedCount = allRecords.length;
    const reviewedCount = allRecords.filter((r) => r.completionPct >= 50).length;
    const epSignedCount = signedOff.length;
    const eqcrCount = allRecords.filter((r) => r.completionPct >= 100 && r.signoffDone).length;
    const lockedCount = allRecords.filter((r) => r.completionPct >= 100 && r.signoffDone && r.statusCode === "Green").length;

    return [
      { label: "Prepared", count: preparedCount, color: "bg-blue-500", pct: 100 },
      { label: "Reviewed", count: reviewedCount, color: "bg-purple-500", pct: preparedCount > 0 ? Math.round((reviewedCount / preparedCount) * 100) : 0 },
      { label: "EP Signed", count: epSignedCount, color: "bg-green-500", pct: preparedCount > 0 ? Math.round((epSignedCount / preparedCount) * 100) : 0 },
      { label: "EQCR", count: eqcrCount, color: "bg-rose-500", pct: preparedCount > 0 ? Math.round((eqcrCount / preparedCount) * 100) : 0 },
      { label: "Locked", count: lockedCount, color: "bg-gray-700 dark:bg-gray-400", pct: preparedCount > 0 ? Math.round((lockedCount / preparedCount) * 100) : 0 },
    ];
  }, [allRecords, signedOff]);

  const completionRate = records.length > 0 ? Math.round((signedOff.length / records.length) * 100) : 0;

  return (
    <div className="space-y-4" data-testid="tab-signoff-register">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4" />Sign-off Funnel</CardTitle>
            <CardDescription>Prepared — Reviewed — EP Signed — EQCR — Locked</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 h-44 justify-center px-2">
              {funnelData.map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-1.5 flex-1 max-w-24">
                  <span className="text-sm font-bold">{f.count}</span>
                  <div className={`w-full rounded-t-md ${f.color} transition-all`} style={{ height: `${Math.max(f.pct, 8)}%` }} />
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{f.label}</span>
                  <span className="text-[9px] text-muted-foreground">{f.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4" />Sign-off Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Stage Gate Items</span>
                <span className="font-bold">{records.length}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Signed Off</span>
                <span className="font-bold text-green-600">{signedOff.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Pending</span>
                <span className="font-bold text-amber-600">{pending.length}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completion Rate</span>
                <span className="font-bold">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sign-off Register Detail</CardTitle>
          <CardDescription>{signedOff.length} of {records.length} completed ({pending.length} pending)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead className="w-24">ISA</TableHead>
                <TableHead className="w-28">Phase</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Sign-off Role</TableHead>
                <TableHead className="w-20 text-center">Docs</TableHead>
                <TableHead className="w-16 text-center">Aging</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r, i) => (
                <TableRow key={`${r.isaId}-${i}`} className={!r.signoffDone ? "bg-amber-50/50 dark:bg-amber-950/10" : ""} data-testid={`signoff-row-${r.isaId}`}>
                  <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-xs">{r.isaName}</TableCell>
                  <TableCell><PhaseBadge phase={r.phase} /></TableCell>
                  <TableCell className="text-xs">{r.isaId.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.signoffRole?.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-center text-xs">{r.mandatoryDocsCompleted}/{r.mandatoryDocsRequired}</TableCell>
                  <TableCell className="text-center text-xs"><AgingText days={r.agingDays} /></TableCell>
                  <TableCell className="text-center">
                    {r.signoffDone ? (
                      <Badge className="text-[10px] bg-green-500 text-white border-0 no-default-hover-elevate no-default-active-elevate"><CheckCircle2 className="w-3 h-3 mr-1" />Signed</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-amber-500 text-white border-0 no-default-hover-elevate no-default-active-elevate"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationMatrixTab() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  const phaseData = useMemo(() => {
    return PHASE_ORDER.map((phase) => {
      const pc = PHASE_COLORS[phase];
      const integrationEntries = getStandardsIntegrationMatrix(phase);
      const allTriggers = new Set<string>();
      const allControls = new Set<string>();
      const allAutoFetch = new Set<string>();
      const allDeps = new Set<string>();

      for (const { standard: s, phaseDetail } of integrationEntries) {
        if (phaseDetail) {
          if (phaseDetail.trigger) allTriggers.add(phaseDetail.trigger);
          phaseDetail.mandatoryControls?.forEach((c: string) => allControls.add(c));
          phaseDetail.autoFetchSources?.forEach((a: string) => allAutoFetch.add(a));
          phaseDetail.dependencyRules?.forEach((d: string) => allDeps.add(d));
        }
        s.phaseMapping?.forEach((pm: { phase: string; trigger?: string; mandatoryControls?: string[]; autoFetchSources?: string[]; dependencyRules?: string[] }) => {
          if (pm.phase === phase) {
            if (pm.trigger) allTriggers.add(pm.trigger);
            pm.mandatoryControls?.forEach((c) => allControls.add(c));
            pm.autoFetchSources?.forEach((a) => allAutoFetch.add(a));
            pm.dependencyRules?.forEach((d) => allDeps.add(d));
          }
        });
      }

      return { phase, pc, integrationEntries, allTriggers, allControls, allAutoFetch, allDeps };
    });
  }, []);

  return (
    <div className="space-y-4" data-testid="tab-integration-matrix">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4" />Audit Software Integration Matrix</CardTitle>
          <CardDescription>Phase-wise triggers, mandatory controls, auto-fetch sources, and dependency rules</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {phaseData.map(({ phase, pc, integrationEntries, allTriggers, allControls, allAutoFetch, allDeps }) => {
              const isExpanded = expandedPhase === phase;
              return (
                <div key={phase} data-testid={`integration-phase-${phase}`}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors" onClick={() => setExpandedPhase(isExpanded ? null : phase)} data-testid={`toggle-phase-${phase}`}>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <PhaseBadge phase={phase} />
                    <span className="text-sm font-medium flex-1">{pc?.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{integrationEntries.length} standards</Badge>
                      <Badge variant="outline" className="text-[10px]">{allControls.size} controls</Badge>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 bg-muted/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IntegrationSection icon={<Zap className="w-3 h-3" />} label="Triggers" items={[...allTriggers]} itemIcon={<ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />} emptyText="No specific triggers" />
                        <IntegrationSection icon={<Lock className="w-3 h-3" />} label="Mandatory Controls" items={[...allControls].slice(0, 10)} itemIcon={<CheckCircle2 className="w-2.5 h-2.5 text-green-500" />} overflow={allControls.size > 10 ? allControls.size - 10 : 0} />
                        <IntegrationSection icon={<Target className="w-3 h-3" />} label="Auto-Fetch Sources" items={[...allAutoFetch].slice(0, 8)} itemIcon={<FileCheck className="w-2.5 h-2.5 text-blue-500" />} overflow={allAutoFetch.size > 8 ? allAutoFetch.size - 8 : 0} />
                        <IntegrationSection icon={<Link2 className="w-3 h-3" />} label="Dependency Rules" items={[...allDeps].slice(0, 8)} itemIcon={<AlertTriangle className="w-2.5 h-2.5 text-amber-500" />} overflow={allDeps.size > 8 ? allDeps.size - 8 : 0} />
                      </div>
                      <Separator />
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1.5">Applicable Standards</div>
                        <div className="flex flex-wrap gap-1.5">
                          {integrationEntries.map(({ standard: s }) => (
                            <Badge key={s.standardId} variant="outline" className="text-[10px] gap-0.5">
                              {s.standardName}
                              {s.isStageGate && <Lock className="w-2.5 h-2.5" />}
                              {s.noReportBlocker && <AlertOctagon className="w-2.5 h-2.5 text-red-500" />}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationSection({ icon, label, items, itemIcon, emptyText = "None", overflow = 0 }: {
  icon: React.ReactNode; label: string; items: string[]; itemIcon: React.ReactNode; emptyText?: string; overflow?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      {items.length === 0 ? (
        <div className="text-xs pl-4 text-muted-foreground italic">{emptyText}</div>
      ) : (
        <>
          {items.map((item, i) => <div key={i} className="text-xs pl-4 flex items-center gap-1">{itemIcon}{item}</div>)}
          {overflow > 0 && <div className="text-xs pl-4 text-muted-foreground">+{overflow} more</div>}
        </>
      )}
    </div>
  );
}

function DraftIcon({ iconType }: { iconType: string }) {
  const IconComponent = DRAFT_ICONS[iconType] || Target;
  return <IconComponent className="w-4 h-4 text-primary" />;
}

function AIAssistTab({ engagementId }: { engagementId?: string }) {
  const { toast } = useToast();
  const [draftDialog, setDraftDialog] = useState<DraftDialogState>({ open: false, outputType: "", label: "", content: "", isaReferences: [] });

  const draftMutation = useMutation({
    mutationFn: async (outputType: string) => {
      const res = await apiRequest("POST", `/api/isa-compliance/engagements/${engagementId}/ai-draft`, { outputType });
      return res.json();
    },
    onSuccess: (data: { content: string; isaReferences?: string[] }) => setDraftDialog((prev) => ({ ...prev, content: data.content, isaReferences: data.isaReferences || [] })),
    onError: (error: Error) => toast({ title: "AI Draft Error", description: error.message, variant: "destructive" }),
  });

  const handleDraft = useCallback((option: DraftOption) => {
    if (!engagementId) { toast({ title: "No Engagement", description: "Select an engagement to generate AI drafts", variant: "destructive" }); return; }
    setDraftDialog({ open: true, outputType: option.outputType, label: option.label, content: "", isaReferences: [] });
    draftMutation.mutate(option.outputType);
  }, [engagementId, toast, draftMutation]);

  return (
    <>
      <div className="space-y-4" data-testid="tab-ai-assist">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" />AI-Assisted ISA Output Drafting</CardTitle>
            <CardDescription>Generate draft ISA deliverables using AI. All outputs require professional review before use per ISA 220 and ISQM 1.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ISA_DRAFT_OPTIONS.map((option) => (
                <Card key={option.outputType} className="hover:border-primary/50 transition-colors cursor-pointer" data-testid={`card-draft-${option.outputType}`}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-md bg-muted">
                          <DraftIcon iconType={option.iconType} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{option.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{option.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{option.isaRef}</Badge>
                        <div className="flex-1" />
                        <Button size="sm" variant="default" onClick={() => handleDraft(option)} disabled={!engagementId || draftMutation.isPending} className="h-7 text-xs" data-testid={`button-draft-${option.outputType}`}>
                          {draftMutation.isPending && draftDialog.outputType === option.outputType ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                          Draft
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {!engagementId && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1" data-testid="text-no-engagement-warning">
                  <AlertTriangle className="w-4 h-4" />Navigate to a specific engagement to enable AI drafting.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BookMarked className="w-4 h-4" />AI Capabilities & Governance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GovernanceItem icon={<Sparkles className="w-3.5 h-3.5 text-purple-600" />} bgClass="bg-purple-100 dark:bg-purple-950/40" title="Gap Resolution" description="Available on Gap Analysis tab — click resolve on any gap for AI-suggested steps with ISA paragraph references" />
              <GovernanceItem icon={<FileText className="w-3.5 h-3.5 text-blue-600" />} bgClass="bg-blue-100 dark:bg-blue-950/40" title="Draft ISA Outputs" description="Generate draft communications, memos, and reports for ISA 260, 570, 580, 700, 701" />
              <GovernanceItem icon={<Shield className="w-3.5 h-3.5 text-red-600" />} bgClass="bg-red-100 dark:bg-red-950/40" title="Professional Judgment" description="All AI outputs are non-authoritative drafts. They do not replace auditor judgment per ISA 220 and ISQM 1." />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={draftDialog.open} onOpenChange={(open) => setDraftDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="dialog-ai-draft">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" />{draftDialog.label}</DialogTitle>
            <DialogDescription>AI-generated draft — requires professional review before use</DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {draftMutation.isPending ? <LoadingState message="Generating ISA-compliant draft..." /> : draftDialog.content ? (
                <div className="flex flex-col flex-1 gap-2 min-h-0 overflow-hidden">
                  <Textarea className="flex-1 min-h-[350px] text-sm font-mono resize-none" value={draftDialog.content} onChange={(e) => setDraftDialog((prev) => ({ ...prev, content: e.target.value }))} data-testid="textarea-ai-draft" />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(draftDialog.content); toast({ title: "Copied to clipboard" }); }} data-testid="button-copy-draft"><Copy className="w-3.5 h-3.5 mr-1" />Copy</Button>
                    <Button size="sm" variant="ghost" onClick={() => draftMutation.mutate(draftDialog.outputType)} disabled={draftMutation.isPending} data-testid="button-regenerate-draft"><Sparkles className="w-3.5 h-3.5 mr-1" />Regenerate</Button>
                    <span className="text-[10px] text-muted-foreground ml-auto">AI-assisted — Subject to professional judgment per ISA 220</span>
                  </div>
                </div>
              ) : null}
            </div>
            {draftDialog.isaReferences.length > 0 && (
              <div className="w-56 flex-shrink-0 border-l pl-4 overflow-y-auto" data-testid="panel-isa-references">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1 text-muted-foreground uppercase tracking-wide"><BookMarked className="w-3 h-3" />ISA References</p>
                <div className="space-y-1.5">
                  {draftDialog.isaReferences.map((ref, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground p-2 rounded-md bg-muted/50 font-mono">{ref}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GovernanceItem({ icon, bgClass, title, description }: { icon: React.ReactNode; bgClass: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`p-1.5 rounded-md ${bgClass}`}>{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default function StandardsMatrixPage() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const [activeTab, setActiveTab] = useState("overview");
  const complianceData = useComplianceData(engagementId);

  const stats = useMemo(() => ({
    totalStandards: STANDARDS_MAP.length,
    phaseCount: Object.keys(STANDARDS_BY_PHASE).length,
    stageGateCount: STANDARDS_MAP.filter((s) => s.isStageGate).length,
    noReportBlockerCount: getNoReportBlockerStandards().length,
  }), []);

  return (
    <PageShell
      title="ISA Compliance Engine"
      subtitle="ISA 200-720, ISA 220 (Rev), ISQM 1, IESBA — inspection-ready compliance monitoring"
      icon={<Shield className="w-5 h-5 text-primary" />}
      readOnly
      showTopBar={false}
      showBottomBar={false}
    >
      <div className="space-y-4" data-testid="standards-matrix-page">
        <div className="flex items-center gap-3 flex-wrap" data-testid="stats-bar">
          <Card className="flex items-center gap-2 px-4 py-2">
            <FileCheck className="w-4 h-4 text-primary" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Standards:</span>
              <span className="text-sm font-bold" data-testid="stat-total-standards">{stats.totalStandards}</span>
            </div>
          </Card>
          <Card className="flex items-center gap-2 px-4 py-2">
            <Layers className="w-4 h-4 text-purple-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Phases:</span>
              <span className="text-sm font-bold" data-testid="stat-phases">{stats.phaseCount}</span>
            </div>
          </Card>
          <Card className="flex items-center gap-2 px-4 py-2">
            <Lock className="w-4 h-4 text-amber-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Stage Gates:</span>
              <span className="text-sm font-bold" data-testid="stat-stage-gates">{stats.stageGateCount}</span>
            </div>
          </Card>
          <Card className="flex items-center gap-2 px-4 py-2">
            <AlertOctagon className="w-4 h-4 text-red-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">No-Report Blockers:</span>
              <span className="text-sm font-bold text-red-600" data-testid="stat-blockers">{stats.noReportBlockerCount}</span>
            </div>
          </Card>
        </div>

        <SimpleTabNavigation activeTab={activeTab} setActiveTab={setActiveTab} tabs={VIEW_TABS} ariaLabel="ISA Compliance Engine" data-testid="tabs-compliance-engine" />

        {activeTab === "overview" && engagementId && <ComplianceOverviewTab data={complianceData} />}
        {activeTab === "heatmap" && engagementId && <ISAHeatmapTab data={complianceData} />}
        {activeTab === "gap-analysis" && <GapAnalysisTab data={complianceData} engagementId={engagementId} />}
        {activeTab === "risk-trace" && engagementId && <RiskTraceabilityTab data={complianceData} />}
        {activeTab === "signoff" && engagementId && <SignoffRegisterTab data={complianceData} />}
        {activeTab === "integration" && <IntegrationMatrixTab />}
        {activeTab === "ai-assist" && <AIAssistTab engagementId={engagementId} />}

        {!engagementId && activeTab !== "integration" && activeTab !== "ai-assist" && (
          <Card className="p-8 text-center">
            <Shield className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground" data-testid="text-select-engagement">Select an engagement from the workspace to view compliance data</p>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
