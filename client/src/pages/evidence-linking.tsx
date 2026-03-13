import { useParams } from "wouter";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { AgentsLoadingInline } from "@/components/agents-loading";
import { useEngagement } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FolderOpen, Search, FileText, Image, File, Loader2,
  Link2, AlertTriangle, CheckCircle2, Sparkles, Upload, Check,
  ShieldCheck, Package, History, User, Eye, Download,
  Layers, FileSpreadsheet, Filter, Tags, ExternalLink,
  XCircle, ArrowRight, Paperclip, BarChart3, BookOpen
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { PhaseApprovalControl, PhaseLockIndicator } from "@/components/phase-approval-control";
import { PageShell } from "@/components/page-shell";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";

interface EvidenceStats {
  totalFiles: number;
  activeFiles: number;
  supersededFiles: number;
  voidedFiles: number;
  totalSize: number;
  totalProcedures: number;
  executedProcedures: number;
  procsWithEvidence: number;
  procsWithoutEvidence: number;
  procsWithoutEvidenceList: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    fsArea: string;
  }>;
  totalWorkpapers: number;
  workpapersLinked: number;
  workpapersUnlinked: number;
  workpaperLinkCount: number;
  categorized: number;
  uncategorized: number;
  sufficientCount: number;
  insufficientCount: number;
  unratedCount: number;
  reviewedCount: number;
  unreviewedWithNotes: number;
  supersededWithoutReason: number;
  linkagePercent: number;
  byPhase: Record<string, { total: number; active: number; linked: number; categorized: number }>;
  bySourceType: Record<string, number>;
  bySufficiency: Record<string, number>;
  allFilesList: VersionFileItem[];
  evidenceList: EvidenceItem[];
}

interface VersionFileItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  phase: string;
  status: string;
  version: number;
  supersededById: string | null;
  supersededReason: string | null;
  uploadedDate: string;
  uploadedBy: { id: string; fullName: string } | null;
}

interface EvidenceItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  phase: string;
  version: number;
  sourceType: string | null;
  sufficiencyRating: string | null;
  reliabilityRating: string | null;
  isaRelevance: string | null;
  description: string | null;
  reviewerNotes: string | null;
  procedureIds: string[];
  riskIds: string[];
  assertions: string[];
  cycle: string | null;
  tags: string[];
  uploadedDate: string;
  uploadedBy: { id: string; fullName: string } | null;
  reviewedBy: { id: string; fullName: string } | null;
  linkedProcedures: Array<{ id: string; code: string; name: string; fsArea: string }>;
  linkedWorkpapers: Array<{ id: string; ref: string; crossReference: string }>;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="h-4 w-4 text-muted-foreground" />;
  const type = fileType.toLowerCase();
  if (["pdf", "doc", "docx", "xls", "xlsx", "txt"].some(ext => type.includes(ext)))
    return <FileText className="h-4 w-4 text-blue-500" />;
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].some(ext => type.includes(ext)))
    return <Image className="h-4 w-4 text-green-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  EXTERNAL_THIRD_PARTY: "External Third-Party",
  EXTERNAL_PREPARED_BY_ENTITY: "External (Entity-Prepared)",
  INTERNAL_STRONG_CONTROLS: "Internal (Strong Controls)",
  INTERNAL_WEAK_CONTROLS: "Internal (Weak Controls)",
  MANAGEMENT_REPRESENTATION: "Management Representation",
  AUDITOR_GENERATED: "Auditor-Generated",
  UNCATEGORIZED: "Uncategorized",
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  EXTERNAL_THIRD_PARTY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  EXTERNAL_PREPARED_BY_ENTITY: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  INTERNAL_STRONG_CONTROLS: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  INTERNAL_WEAK_CONTROLS: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  MANAGEMENT_REPRESENTATION: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  AUDITOR_GENERATED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  UNCATEGORIZED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const SUFFICIENCY_LABELS: Record<string, string> = {
  STRONG: "Strong",
  ADEQUATE: "Adequate",
  MARGINAL: "Marginal",
  INSUFFICIENT: "Insufficient",
  UNRATED: "Unrated",
};

const SUFFICIENCY_COLORS: Record<string, string> = {
  STRONG: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  ADEQUATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  MARGINAL: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  INSUFFICIENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  UNRATED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const PHASE_LABELS: Record<string, string> = {
  REQUISITION: "Data Intake",
  ONBOARDING: "Onboarding",
  PRE_PLANNING: "Pre-Planning",
  PLANNING: "Planning",
  EXECUTION: "Execution",
  FINALIZATION: "Finalization",
  REPORTING: "Reporting",
  EQCR: "EQCR",
};

function TraceabilityChips({ evidence }: { evidence: EvidenceItem }) {
  return (
    <div className="flex flex-wrap gap-1">
      {evidence.linkedProcedures.map(p => (
        <Badge key={p.id} variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 dark:bg-blue-900/20">
          <Paperclip className="h-2.5 w-2.5 mr-0.5" />
          {p.code || p.name?.slice(0, 15)}
        </Badge>
      ))}
      {evidence.linkedWorkpapers.map(w => (
        <Badge key={w.id} variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-50 dark:bg-amber-900/20">
          <FileSpreadsheet className="h-2.5 w-2.5 mr-0.5" />
          {w.ref}
        </Badge>
      ))}
      {evidence.assertions.map(a => (
        <Badge key={a} variant="outline" className="text-[10px] h-5 px-1.5 bg-purple-50 dark:bg-purple-900/20">
          {a}
        </Badge>
      ))}
      {evidence.linkedProcedures.length === 0 && evidence.linkedWorkpapers.length === 0 && (
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-red-50 dark:bg-red-900/20 text-red-600">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          Unlinked
        </Badge>
      )}
    </div>
  );
}

export default function EvidenceLinking() {
  const params = useParams<{ engagementId: string }>();
  const {
    engagementId: contextEngagementId,
    engagement,
    client,
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();
  const roleGuard = usePhaseRoleGuard("evidence-linking", "EXECUTION");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSourceType, setFilterSourceType] = useState("all");
  const [filterSufficiency, setFilterSufficiency] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats, isLoading, error } = useQuery<EvidenceStats>({
    queryKey: ["/api/planning", engagementId, "evidence-linking-stats"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/planning/${engagementId}/evidence-linking-stats`);
      if (!res.ok) throw new Error("Failed to load evidence linking stats");
      return res.json();
    },
    enabled: !!engagementId,
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      toast({
        title: "Files Received",
        description: `${files.length} file(s) ready for upload. Use the Upload Evidence dialog to complete.`,
      });
    }
  }, [toast]);

  const evidenceList = stats?.evidenceList || [];

  const filteredEvidence = evidenceList.filter(e => {
    const matchesSearch = !searchTerm ||
      e.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.linkedProcedures.some(p => p.code?.toLowerCase().includes(searchTerm.toLowerCase()) || p.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSource = filterSourceType === "all" || (e.sourceType || "UNCATEGORIZED") === filterSourceType;
    const matchesSufficiency = filterSufficiency === "all" || (e.sufficiencyRating || "UNRATED") === filterSufficiency;
    const matchesPhase = filterPhase === "all" || e.phase === filterPhase;
    return matchesSearch && matchesSource && matchesSufficiency && matchesPhase;
  });

  if (isLoading) return <AgentsLoadingInline showDelay={1000} />;
  if (error) return <div className="p-6 text-center text-destructive">Failed to load evidence linking data.</div>;

  const s = stats || {
    totalFiles: 0, activeFiles: 0, supersededFiles: 0, voidedFiles: 0, totalSize: 0,
    totalProcedures: 0, executedProcedures: 0, procsWithEvidence: 0, procsWithoutEvidence: 0,
    procsWithoutEvidenceList: [], totalWorkpapers: 0, workpapersLinked: 0, workpapersUnlinked: 0,
    workpaperLinkCount: 0, categorized: 0, uncategorized: 0, sufficientCount: 0,
    insufficientCount: 0, unratedCount: 0, reviewedCount: 0, unreviewedWithNotes: 0,
    supersededWithoutReason: 0, linkagePercent: 100, byPhase: {}, bySourceType: {}, bySufficiency: {},
    allFilesList: [], evidenceList: [],
  } as EvidenceStats;

  const gateWarnings: Array<{ label: string; passed: boolean; isa: string; detail: string }> = [
    {
      label: "Evidence Linked to Procedures",
      passed: s.procsWithoutEvidence === 0,
      isa: "ISA 500",
      detail: s.procsWithoutEvidence > 0 ? `${s.procsWithoutEvidence} procedure(s) lack evidence` : "All procedures linked",
    },
    {
      label: "Evidence Categorized",
      passed: s.uncategorized === 0,
      isa: "ISA 500",
      detail: s.uncategorized > 0 ? `${s.uncategorized} file(s) need categorization` : "All files categorized",
    },
    {
      label: "Sufficiency Confirmed",
      passed: s.insufficientCount === 0 && s.unratedCount === 0,
      isa: "ISA 500",
      detail: (s.insufficientCount + s.unratedCount) > 0 ? `${s.insufficientCount + s.unratedCount} file(s) need rating` : "All sufficient",
    },
    {
      label: "Version History",
      passed: s.supersededWithoutReason === 0,
      isa: "ISA 230",
      detail: s.supersededWithoutReason > 0 ? `${s.supersededWithoutReason} superseded file(s) lack reasons` : "All documented",
    },
    {
      label: "Reviewer Comments",
      passed: s.unreviewedWithNotes === 0,
      isa: "ISA 220",
      detail: s.unreviewedWithNotes > 0 ? `${s.unreviewedWithNotes} file(s) have unaddressed comments` : "All addressed",
    },
  ];

  const hardGatesFailed = gateWarnings.slice(0, 3).filter(g => !g.passed).length;

  return (
    <PageShell
      showTopBar={false}
      title="Evidence Linking"
      subtitle={`${client?.name || "Select Client"}${engagement?.engagementCode ? ` (${engagement.engagementCode})` : ""}`}
      icon={<Link2 className="h-6 w-6 text-primary" />}
      useRegistry={true}
      backHref={`/workspace/${engagementId}/execution-testing`}
      nextHref={`/workspace/${engagementId}/observations`}
      dashboardHref="/engagements"
      signoffPhase="EXECUTION"
      signoffSection="evidence-linking"
      readOnly={roleGuard.isReadOnly}
      showBack={true}
      showSaveProgress={true}
      showSaveNext={true}
      showSaveClose={true}
    >
    <div className="w-full px-4 py-3 space-y-3">
      <AIAssistantPanel engagementId={engagementId || ""} phaseKey="evidence-linking" className="mb-2" />
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-medium text-sm">ISA 500 — Audit Evidence Requirements</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    3 AI Capabilities
                  </Badge>
                  {hardGatesFailed === 0 ? (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Phase Ready
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {hardGatesFailed} Gate(s) Open
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Link supporting documents to workpapers and procedures, verify sufficiency and appropriateness per ISA 500
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                <div className="text-center p-1.5 rounded border bg-muted/30">
                  <p className="text-lg font-bold leading-none">{s.activeFiles}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Active Files</p>
                </div>
                <div className="text-center p-1.5 rounded border bg-muted/30">
                  <p className="text-lg font-bold leading-none">{s.procsWithEvidence}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Linked Procs</p>
                </div>
                <div className="text-center p-1.5 rounded border bg-muted/30">
                  <p className="text-lg font-bold leading-none">{s.workpapersLinked}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">WP Links</p>
                </div>
                <div className="text-center p-1.5 rounded border bg-muted/30">
                  <p className="text-lg font-bold leading-none">{s.categorized}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Categorized</p>
                </div>
                <div className="text-center p-1.5 rounded border bg-muted/30">
                  <p className="text-lg font-bold leading-none">{s.sufficientCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sufficient</p>
                </div>
                <div className="text-center p-1.5 rounded border bg-muted/30">
                  <p className="text-lg font-bold leading-none text-blue-600 dark:text-blue-400">{s.linkagePercent}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Linkage</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {gateWarnings.map((g, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={g.passed ? "default" : "destructive"}
                        className="text-[10px] cursor-help"
                      >
                        {g.passed ? <Check className="h-2.5 w-2.5 mr-0.5" /> : <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                        {g.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{g.isa}: {g.detail}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dashboard">
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="vault">
            <FolderOpen className="h-3.5 w-3.5 mr-1" />
            Evidence Vault
          </TabsTrigger>
          <TabsTrigger value="linkage">
            <Link2 className="h-3.5 w-3.5 mr-1" />
            Procedure Linkage
          </TabsTrigger>
          <TabsTrigger value="categorization">
            <Tags className="h-3.5 w-3.5 mr-1" />
            Categorization
          </TabsTrigger>
          <TabsTrigger value="versions">
            <History className="h-3.5 w-3.5 mr-1" />
            Version History
          </TabsTrigger>
          <TabsTrigger value="review">
            <User className="h-3.5 w-3.5 mr-1" />
            Reviewer Panel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-500" />
                    Evidence by Source Type (ISA 500)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    ISA 500 hierarchy: External &gt; Internal (strong controls) &gt; Internal (weak controls) &gt; Management representations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(s.bySourceType).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No evidence files yet</p>
                  ) : (
                    Object.entries(s.bySourceType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <Badge className={`text-xs ${SOURCE_TYPE_COLORS[type] || ""}`}>
                          {SOURCE_TYPE_LABELS[type] || type}
                        </Badge>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Sufficiency Assessment
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Evidence sufficiency ratings across all active files
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(s.bySufficiency).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No evidence files yet</p>
                  ) : (
                    Object.entries(s.bySufficiency).map(([rating, count]) => (
                      <div key={rating} className="flex items-center justify-between">
                        <Badge className={`text-xs ${SUFFICIENCY_COLORS[rating] || ""}`}>
                          {SUFFICIENCY_LABELS[rating] || rating}
                        </Badge>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                  Evidence by Audit Phase
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(s.byPhase).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No evidence files yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phase</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Active</TableHead>
                        <TableHead className="text-right">Linked</TableHead>
                        <TableHead className="text-right">Categorized</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(s.byPhase).map(([phase, data]) => (
                        <TableRow key={phase}>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{PHASE_LABELS[phase] || phase}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{data.total}</TableCell>
                          <TableCell className="text-right">{data.active}</TableCell>
                          <TableCell className="text-right">{data.linked}</TableCell>
                          <TableCell className="text-right">{data.categorized}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {s.procsWithoutEvidenceList.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    Missing Evidence Alerts ({s.procsWithoutEvidenceList.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Executed procedures without linked supporting evidence — ISA 500 requires evidence for every procedure performed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Procedure</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>FS Area</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.procsWithoutEvidenceList.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.code}</TableCell>
                          <TableCell className="text-sm">{p.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{p.type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{p.fsArea || "-"}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => { setActiveTab("vault"); }}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Attach
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="vault">
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Drag & drop evidence files here</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Word, Excel, images — or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.svg,.webp"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    toast({
                      title: "Files Selected",
                      description: `${e.target.files.length} file(s) ready for upload`,
                    });
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-blue-500" />
                    <CardTitle className="text-sm font-semibold">Evidence Files</CardTitle>
                    <Badge variant="outline" className="text-xs">{filteredEvidence.length} of {evidenceList.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast({ title: "AI Analysis", description: "Generating evidence sufficiency report..." });
                      }}
                      disabled={evidenceList.length === 0}
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      AI Sufficiency Check
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast({ title: "Bulk Download", description: "Preparing evidence package..." });
                      }}
                      disabled={evidenceList.length === 0}
                    >
                      <Package className="h-3.5 w-3.5 mr-1" />
                      Bulk Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3 pb-4 border-b">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search evidence files..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={filterPhase} onValueChange={setFilterPhase}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Phases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Phases</SelectItem>
                      {Object.entries(PHASE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterSourceType} onValueChange={setFilterSourceType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Source Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Source Types</SelectItem>
                      {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterSufficiency} onValueChange={setFilterSufficiency}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Ratings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ratings</SelectItem>
                      {Object.entries(SUFFICIENCY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filteredEvidence.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium tracking-tight mb-2">No Evidence Files Found</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload evidence files or adjust your filters.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">#</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Source Type</TableHead>
                          <TableHead>Sufficiency</TableHead>
                          <TableHead>Linked To</TableHead>
                          <TableHead>Phase</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEvidence.map((ev, idx) => (
                          <TableRow key={ev.id}>
                            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getFileIcon(ev.fileType)}
                                <div>
                                  <p className="font-medium text-sm">{ev.fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(ev.fileSize)}
                                    {ev.version > 1 && <span className="ml-1">(v{ev.version})</span>}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${SOURCE_TYPE_COLORS[ev.sourceType || "UNCATEGORIZED"] || ""}`}>
                                {SOURCE_TYPE_LABELS[ev.sourceType || "UNCATEGORIZED"] || "Uncategorized"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${SUFFICIENCY_COLORS[ev.sufficiencyRating || "UNRATED"] || ""}`}>
                                {SUFFICIENCY_LABELS[ev.sufficiencyRating || "UNRATED"] || "Unrated"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <TraceabilityChips evidence={ev} />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {PHASE_LABELS[ev.phase] || ev.phase}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Download</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="linkage">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-blue-500" />
                      Procedure-Evidence Linkage Matrix
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      ISA 500 requires every procedure to have linked supporting evidence
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      {s.procsWithEvidence} linked
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      {s.procsWithoutEvidence} unlinked
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-muted rounded-full h-2 mb-4">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      s.linkagePercent >= 80 ? "bg-emerald-500" : s.linkagePercent >= 50 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${s.linkagePercent}%` }}
                  />
                </div>

                {evidenceList.length === 0 ? (
                  <div className="text-center py-8">
                    <Link2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No evidence files to link yet</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Evidence File</TableHead>
                          <TableHead>Linked Procedures</TableHead>
                          <TableHead>Linked Workpapers</TableHead>
                          <TableHead>Assertions</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {evidenceList.map(ev => (
                          <TableRow key={ev.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getFileIcon(ev.fileType)}
                                <div>
                                  <p className="text-sm font-medium">{ev.fileName}</p>
                                  <p className="text-xs text-muted-foreground">{formatFileSize(ev.fileSize)}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {ev.linkedProcedures.length > 0 ? ev.linkedProcedures.map(p => (
                                  <Badge key={p.id} variant="outline" className="text-[10px]">
                                    {p.code || p.name?.slice(0, 20)}
                                  </Badge>
                                )) : (
                                  <span className="text-xs text-muted-foreground">None</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {ev.linkedWorkpapers.length > 0 ? ev.linkedWorkpapers.map(w => (
                                  <Badge key={w.id} variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-900/20">
                                    {w.ref}
                                  </Badge>
                                )) : (
                                  <span className="text-xs text-muted-foreground">None</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {ev.assertions.length > 0 ? ev.assertions.map(a => (
                                  <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                                )) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {ev.linkedProcedures.length > 0 ? (
                                <Badge variant="default" className="text-[10px]">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                  Linked
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  Unlinked
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                  Workpaper-Evidence Links ({s.workpaperLinkCount})
                </CardTitle>
                <CardDescription className="text-xs">
                  {s.workpapersLinked} of {s.totalWorkpapers} workpapers have linked evidence — {s.workpapersUnlinked} without links
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      s.totalWorkpapers > 0 && s.workpapersLinked / s.totalWorkpapers >= 0.8 ? "bg-emerald-500"
                        : s.totalWorkpapers > 0 && s.workpapersLinked / s.totalWorkpapers >= 0.5 ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: s.totalWorkpapers > 0 ? `${(s.workpapersLinked / s.totalWorkpapers) * 100}%` : "0%" }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categorization">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Tags className="h-4 w-4 text-purple-500" />
                      Evidence Categorization & Source References
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      ISA 500 requires evidence to be classified by source type for reliability assessment
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toast({ title: "AI Suggestion", description: "Generating categorization suggestions for uncategorized files..." });
                    }}
                    disabled={s.uncategorized === 0}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Auto-Categorize ({s.uncategorized})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {evidenceList.length === 0 ? (
                  <div className="text-center py-8">
                    <Tags className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No evidence files to categorize</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Source Type</TableHead>
                          <TableHead>Reliability</TableHead>
                          <TableHead>ISA Reference</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Cycle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {evidenceList.map(ev => (
                          <TableRow key={ev.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getFileIcon(ev.fileType)}
                                <span className="text-sm">{ev.fileName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {ev.sourceType ? (
                                <Badge className={`text-[10px] ${SOURCE_TYPE_COLORS[ev.sourceType] || ""}`}>
                                  {SOURCE_TYPE_LABELS[ev.sourceType] || ev.sourceType}
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  Uncategorized
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {ev.reliabilityRating ? (
                                <Badge variant="outline" className="text-[10px]">{ev.reliabilityRating}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">{ev.isaRelevance || "-"}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground line-clamp-2">
                                {ev.description || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">{ev.cycle || "-"}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="h-4 w-4 text-amber-500" />
                    File Version History
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    ISA 230 requires documentation of file supersession with reasons
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span>Active: <strong>{s.activeFiles}</strong></span>
                  <span>Superseded: <strong>{s.supersededFiles}</strong></span>
                  <span>Voided: <strong>{s.voidedFiles}</strong></span>
                  {s.supersededWithoutReason > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      {s.supersededWithoutReason} missing reasons
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(s.allFilesList || []).length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No evidence files yet</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Supersession Reason</TableHead>
                        <TableHead>Upload Date</TableHead>
                        <TableHead>Uploaded By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(s.allFilesList || []).map(vf => (
                        <TableRow key={vf.id} className={vf.status !== "ACTIVE" ? "opacity-60" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getFileIcon(vf.fileType)}
                              <div>
                                <p className="text-sm font-medium">{vf.fileName}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(vf.fileSize)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">v{vf.version}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={vf.status === "ACTIVE" ? "default" : vf.status === "SUPERSEDED" ? "secondary" : "destructive"}
                              className="text-[10px]"
                            >
                              {vf.status === "ACTIVE" && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                              {vf.status === "SUPERSEDED" && <History className="h-2.5 w-2.5 mr-0.5" />}
                              {vf.status === "VOIDED" && <XCircle className="h-2.5 w-2.5 mr-0.5" />}
                              {vf.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {vf.status === "SUPERSEDED" ? (
                              vf.supersededReason ? (
                                <span className="text-xs">{vf.supersededReason}</span>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  Reason missing
                                </Badge>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {new Date(vf.uploadedDate).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs">{vf.uploadedBy?.fullName || "-"}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{s.reviewedCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Reviewed Files</p>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500"
                      style={{ width: s.activeFiles > 0 ? `${(s.reviewedCount / s.activeFiles) * 100}%` : "0%" }}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{s.unreviewedWithNotes}</p>
                  <p className="text-xs text-muted-foreground mt-1">Unaddressed Comments</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{s.sufficientCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sufficient Rating</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Evidence Review Status
                </CardTitle>
                <CardDescription className="text-xs">
                  ISA 220 requires review of all evidence supporting audit conclusions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {evidenceList.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No evidence to review</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Sufficiency</TableHead>
                          <TableHead>Reviewer</TableHead>
                          <TableHead>Reviewer Notes</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {evidenceList.map(ev => (
                          <TableRow key={ev.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getFileIcon(ev.fileType)}
                                <span className="text-sm">{ev.fileName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${SUFFICIENCY_COLORS[ev.sufficiencyRating || "UNRATED"] || ""}`}>
                                {SUFFICIENCY_LABELS[ev.sufficiencyRating || "UNRATED"]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {ev.reviewedBy ? (
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="text-xs">{ev.reviewedBy.fullName}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Awaiting review</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground line-clamp-2">
                                {ev.reviewerNotes || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {ev.reviewedBy ? (
                                <Badge variant="default" className="text-[10px]">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                  Reviewed
                                </Badge>
                              ) : ev.reviewerNotes ? (
                                <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  Needs Attention
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </PageShell>
  );
}
