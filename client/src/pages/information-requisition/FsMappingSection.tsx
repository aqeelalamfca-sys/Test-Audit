import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  AlertCircle, RefreshCw, Search, ChevronRight, ChevronDown,
  Lock, Unlock, Wand2, Plus, FolderTree, LayoutGrid,
  GitMerge, Link2, Loader2, Play, Edit2, AlertTriangle,
  CheckCheck, XCircle, MoreVertical,
  ArrowDownToLine, ChevronUp, FileSpreadsheet,
  Target, ArrowRight,
  Clock, History, Shield, Zap, Sparkles, ThumbsUp, ThumbsDown,
  X, Check, Brain
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SubTabShell } from './SubTabShell';
import type { DataSource, TabGate, MappingVersion } from './workflow-spec';
import { getNextTab, getPrevTab } from './workflow-spec';

interface FSHead {
  id: string;
  code: string;
  name: string;
  category: string;
  statementType: string;
  sortOrder: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  accountCount: number;
  fsLines: FSLine[];
}

interface FSLine {
  id: string;
  code: string;
  name: string;
  fsHeadId: string;
  sortOrder: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  accountCount: number;
  isActive: boolean;
}

interface TBEntry {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string | null;
  openingDebit: number;
  openingCredit: number;
  closingDebit: number;
  closingCredit: number;
  netBalance: number;
  fsHeadId: string | null;
  fsHeadName: string | null;
  fsLineId: string | null;
  fsLineName: string | null;
  allocationPct: number;
  isMapped: boolean;
  isLocked: boolean;
  notes: string | null;
  isException?: boolean;
  exceptionReason?: string;
  confidence?: number;
  glCode?: string;
  glName?: string;
}

interface Summary {
  totalAccounts: number;
  mappedAccounts: number;
  unmappedAccounts: number;
  completeness: number;
  totalDebit: number;
  totalCredit: number;
  isReconciled: boolean;
  exceptionsCount?: number;
}

interface ReconRibbon {
  tbTotal: number;
  mappedTotal: number;
  unmappedTotal: number;
  difference: number;
  unmappedAccounts: { accountCode: string; accountName: string; glCode?: string; glName?: string; balance: number }[];
  mappedByHead: { fsHeadId: string; fsHeadName: string; total: number; accountCount: number }[];
}

interface ExceptionItem {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  accountCode: string;
  accountName: string;
  glCode?: string;
  glName?: string;
  message: string;
  suggestedFix: string;
  resolution: string | null;
}

interface ExceptionsSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
}

interface VersionTrailEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  performedAt: string;
  performedByName?: string;
  performedById: string;
}

interface VersionTrail {
  currentVersion: { version: number; status: string } | null;
  changeLog: VersionTrailEntry[];
}

interface AutoMapSuggestion {
  accountCode: string;
  accountName: string;
  suggestedFsHeadId: string;
  suggestedFsHeadName: string;
  suggestedFsLineId?: string;
  suggestedFsLineName?: string;
  confidence: number;
  reason: string;
  checked: boolean;
}

interface AiSuggestion {
  fsHeadId: string;
  fsHeadName: string;
  fsLineId: string | null;
  fsLineName: string | null;
  confidence: number;
  rationale: string;
  alternativeHeadId?: string | null;
  alternativeHeadName?: string | null;
}

type FilterStatus = "all" | "mapped" | "unmapped" | "exceptions";

interface FsMappingSectionProps {
  engagementId: string | undefined;
  token: string | null;
  toast: (props: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  onNavigate?: (tab: string) => void;
  canApproveLock?: boolean;
  initialFilter?: FilterStatus;
  onFilterConsumed?: () => void;
}

const formatNumber = (num: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);

const formatAccounting = (num: number) => {
  if (num === 0) return '-';
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs);
  return num < 0 ? `(${formatted})` : formatted;
};

function AccountCard({
  entry,
  fsHeads,
  isLocked,
  headers,
  engagementId,
  onMappingSaved,
  toast,
}: {
  entry: TBEntry;
  fsHeads: FSHead[];
  isLocked: boolean;
  headers: Record<string, string>;
  engagementId: string;
  onMappingSaved: () => void;
  toast: FsMappingSectionProps['toast'];
}) {
  const [editing, setEditing] = useState(false);
  const [editFsHeadId, setEditFsHeadId] = useState(entry.fsHeadId || "");
  const [editFsLineId, setEditFsLineId] = useState(entry.fsLineId || "");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiDismissed, setAiDismissed] = useState(false);

  const headLines = useMemo(() => {
    if (!editFsHeadId) return [];
    const head = fsHeads.find(h => h.id === editFsHeadId);
    return head?.fsLines || [];
  }, [editFsHeadId, fsHeads]);

  const handleSave = async () => {
    if (!editFsHeadId) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/allocations", {
        method: "POST", headers,
        body: JSON.stringify({
          engagementId,
          accountCode: entry.accountCode,
          fsHeadId: editFsHeadId,
          fsLineId: editFsLineId || null,
        })
      });
      if (res.ok) {
        toast({ title: "Mapped", description: `${entry.accountCode} mapped successfully` });
        setEditing(false);
        setAiSuggestion(null);
        onMappingSaved();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save mapping", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const fetchAiSuggestion = async () => {
    setAiLoading(true);
    setAiDismissed(false);
    try {
      const res = await fetchWithAuth("/api/review-mapping/ai-suggest-mapping", {
        method: "POST", headers,
        body: JSON.stringify({
          engagementId,
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          netBalance: entry.netBalance,
          accountType: entry.accountType,
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestion(data.suggestion);
      } else {
        toast({ title: "AI Error", description: "Could not get AI suggestion", variant: "destructive" });
      }
    } catch {
      toast({ title: "AI Error", description: "Failed to get suggestion", variant: "destructive" });
    } finally { setAiLoading(false); }
  };

  const acceptAiSuggestion = () => {
    if (!aiSuggestion) return;
    setEditFsHeadId(aiSuggestion.fsHeadId);
    setEditFsLineId(aiSuggestion.fsLineId || "");
    setEditing(true);
  };

  const applyAiSuggestionDirectly = async () => {
    if (!aiSuggestion) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/allocations", {
        method: "POST", headers,
        body: JSON.stringify({
          engagementId,
          accountCode: entry.accountCode,
          fsHeadId: aiSuggestion.fsHeadId,
          fsLineId: aiSuggestion.fsLineId || null,
        })
      });
      if (res.ok) {
        toast({ title: "AI Mapping Applied", description: `${entry.accountCode} mapped to ${aiSuggestion.fsHeadName}` });
        setAiSuggestion(null);
        onMappingSaved();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to apply suggestion", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const currentHeadName = entry.fsHeadName || fsHeads.find(h => h.id === entry.fsHeadId)?.name;
  const currentLineName = entry.fsLineName || fsHeads.find(h => h.id === entry.fsHeadId)?.fsLines.find(l => l.id === entry.fsLineId)?.name;

  return (
    <Card
      className={`relative ${
        entry.isException ? 'border-red-300 dark:border-red-800' :
        !entry.isMapped ? 'border-amber-300 dark:border-amber-800' : ''
      }`}
      data-testid={`card-account-${entry.accountCode}`}
    >
      <CardContent className="p-2.5 space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground" data-testid={`text-code-${entry.accountCode}`}>
                {entry.accountCode}
              </span>
              {entry.isLocked && (
                <Tooltip><TooltipTrigger><Lock className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" /></TooltipTrigger><TooltipContent>Locked</TooltipContent></Tooltip>
              )}
              {entry.isException && (
                <Tooltip>
                  <TooltipTrigger><AlertTriangle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" /></TooltipTrigger>
                  <TooltipContent>{entry.exceptionReason}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="text-sm font-medium mt-0.5" data-testid={`text-name-${entry.accountCode}`}>
              {entry.accountName}
            </div>
          </div>

          <div className="flex items-center gap-3 text-right shrink-0">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Debit</div>
              <div className="font-mono text-xs">{formatAccounting(entry.closingDebit)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Credit</div>
              <div className="font-mono text-xs">{formatAccounting(entry.closingCredit)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Net</div>
              <div className={`font-mono text-xs font-medium ${entry.netBalance < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {formatAccounting(entry.netBalance)}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            {!isLocked && !entry.isLocked ? (
              <Select
                value={entry.fsHeadId || ""}
                onValueChange={async (newHeadId) => {
                  if (newHeadId === entry.fsHeadId) return;
                  setSaving(true);
                  try {
                    const res = await fetchWithAuth("/api/review-mapping/allocations", {
                      method: "POST", headers,
                      body: JSON.stringify({
                        engagementId,
                        accountCode: entry.accountCode,
                        fsHeadId: newHeadId,
                        fsLineId: null,
                      })
                    });
                    if (res.ok) {
                      toast({ title: "Re-mapped", description: `${entry.accountCode} mapped to ${fsHeads.find(h => h.id === newHeadId)?.name}` });
                      onMappingSaved();
                    } else {
                      const err = await res.json();
                      toast({ title: "Error", description: err.error, variant: "destructive" });
                    }
                  } catch {
                    toast({ title: "Error", description: "Failed to re-map", variant: "destructive" });
                  } finally { setSaving(false); }
                }}
              >
                <SelectTrigger
                  className={`text-xs w-auto gap-1.5 ${
                    entry.isMapped
                      ? 'border-green-300 dark:border-green-700'
                      : 'border-amber-300 dark:border-amber-700'
                  }`}
                  data-testid={`select-fshead-inline-${entry.accountCode}`}
                >
                  {entry.isMapped ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 dark:text-green-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0" />
                  )}
                  <SelectValue placeholder="Select FS Head" />
                </SelectTrigger>
                <SelectContent>
                  {fsHeads.map(head => (
                    <SelectItem key={head.id} value={head.id} data-testid={`option-fshead-${head.id}`}>
                      {head.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : entry.isMapped ? (
              <Badge variant="outline" className="gap-1 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-head-${entry.accountCode}`}>
                <CheckCircle2 className="h-3 w-3 text-green-500 dark:text-green-400" />
                {currentHeadName}
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 no-default-hover-elevate no-default-active-elevate">
                <AlertCircle className="h-3 w-3 mr-1" /> Unmapped
              </Badge>
            )}
            {currentLineName && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                  {currentLineName}
                </Badge>
              </>
            )}
            {entry.confidence != null && entry.confidence > 0 && (
              <Badge
                variant="outline"
                className={`text-[10px] no-default-hover-elevate no-default-active-elevate ${
                  entry.confidence > 0.8
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : entry.confidence >= 0.65
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}
              >
                {Math.round(entry.confidence * 100)}%
              </Badge>
            )}
          </div>

          {!isLocked && !entry.isLocked && !editing && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAiSuggestion}
                disabled={aiLoading}
                data-testid={`button-ai-suggest-${entry.accountCode}`}
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI Suggest
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditFsHeadId(entry.fsHeadId || "");
                  setEditFsLineId(entry.fsLineId || "");
                  setEditing(true);
                }}
                data-testid={`button-edit-mapping-${entry.accountCode}`}
              >
                <Edit2 className="h-3.5 w-3.5" />
                {entry.isMapped ? 'Edit' : 'Map'}
              </Button>
            </div>
          )}
        </div>

        {aiSuggestion && !aiDismissed && (
          <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2" data-testid={`ai-suggestion-${entry.accountCode}`}>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-800 dark:text-blue-300">AI Recommendation</span>
              <Badge
                variant="outline"
                className={`text-[10px] ml-auto no-default-hover-elevate no-default-active-elevate ${
                  aiSuggestion.confidence >= 0.8
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : aiSuggestion.confidence >= 0.65
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}
              >
                {Math.round(aiSuggestion.confidence * 100)}% confidence
              </Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                {aiSuggestion.fsHeadName}
              </Badge>
              {aiSuggestion.fsLineName && (
                <>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs">
                    {aiSuggestion.fsLineName}
                  </Badge>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{aiSuggestion.rationale}</p>
            {aiSuggestion.alternativeHeadName && (
              <p className="text-[11px] text-muted-foreground">
                Alternative: <span className="font-medium">{aiSuggestion.alternativeHeadName}</span>
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={applyAiSuggestionDirectly}
                disabled={saving}
                data-testid={`button-accept-ai-${entry.accountCode}`}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Apply
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={acceptAiSuggestion}
                data-testid={`button-edit-ai-${entry.accountCode}`}
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit & Apply
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAiDismissed(true); setAiSuggestion(null); }}
                data-testid={`button-dismiss-ai-${entry.accountCode}`}
              >
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            </div>
          </div>
        )}

        {editing && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/30" data-testid={`edit-panel-${entry.accountCode}`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">FS Head</Label>
                <Select value={editFsHeadId} onValueChange={(v) => { setEditFsHeadId(v); setEditFsLineId(""); }}>
                  <SelectTrigger className="text-xs" data-testid={`select-head-${entry.accountCode}`}>
                    <SelectValue placeholder="Select FS Head" />
                  </SelectTrigger>
                  <SelectContent>
                    {fsHeads.map(head => (
                      <SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">FS Line (Optional)</Label>
                <Select value={editFsLineId || "__none__"} onValueChange={(v) => setEditFsLineId(v === "__none__" ? "" : v)} disabled={!editFsHeadId || headLines.length === 0}>
                  <SelectTrigger className="text-xs" data-testid={`select-line-${entry.accountCode}`}>
                    <SelectValue placeholder="Select FS Line" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {headLines.map(line => (
                      <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!editFsHeadId || saving}
                data-testid={`button-save-${entry.accountCode}`}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                data-testid={`button-cancel-edit-${entry.accountCode}`}
              >
                Cancel
              </Button>
              {!aiSuggestion && !aiDismissed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchAiSuggestion}
                  disabled={aiLoading}
                  className="ml-auto"
                  data-testid={`button-ai-while-editing-${entry.accountCode}`}
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Get AI Suggestion
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FsMappingSection({ engagementId, token, toast, onNavigate, canApproveLock, initialFilter, onFilterConsumed }: FsMappingSectionProps) {
  const [fsHeads, setFsHeads] = useState<FSHead[]>([]);
  const [tbEntries, setTbEntries] = useState<TBEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedFsHeadId, setSelectedFsHeadId] = useState<string | null>(null);
  const [expandedHeads, setExpandedHeads] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(initialFilter || "all");
  const [treeSearchQuery, setTreeSearchQuery] = useState("");

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [exceptionsDialogOpen, setExceptionsDialogOpen] = useState(false);
  const [versionTrailDialogOpen, setVersionTrailDialogOpen] = useState(false);

  const [reconRibbon, setReconRibbon] = useState<ReconRibbon | null>(null);
  const [reconExpanded, setReconExpanded] = useState(false);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [exceptionsSummary, setExceptionsSummary] = useState<ExceptionsSummary | null>(null);
  const [versionTrail, setVersionTrail] = useState<VersionTrail | null>(null);

  const [addLineDialogOpen, setAddLineDialogOpen] = useState(false);
  const [newLineCode, setNewLineCode] = useState("");
  const [newLineName, setNewLineName] = useState("");
  const [newLineFsHeadId, setNewLineFsHeadId] = useState("");

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameLineId, setRenameLineId] = useState("");
  const [renameLineName, setRenameLineName] = useState("");

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeReason, setMergeReason] = useState("");

  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkFsHeadId, setBulkFsHeadId] = useState("");
  const [bulkFsLineId, setBulkFsLineId] = useState("");

  const [showAutoMapDialog, setShowAutoMapDialog] = useState(false);
  const [autoMapSuggestions, setAutoMapSuggestions] = useState<AutoMapSuggestion[]>([]);
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  const [exceptionResolutionDialogOpen, setExceptionResolutionDialogOpen] = useState(false);
  const [exceptionBeingResolved, setExceptionBeingResolved] = useState<{ exception: ExceptionItem; resolution: 'FIX' | 'SPLIT' } | null>(null);
  const [exceptionResolutionFsHeadId, setExceptionResolutionFsHeadId] = useState("");
  const [exceptionResolutionFsLineId, setExceptionResolutionFsLineId] = useState("");

  const [isInitializing, setIsInitializing] = useState(false);
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [isPriorMapping, setIsPriorMapping] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ targets: string[]; pushedAt: string; draftFs: { headCount: number }; execution: { workingPapersCreated: number; workingPapersUpdated: number } } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isResolvingException, setIsResolvingException] = useState<string | null>(null);
  const [isBatchAiLoading, setIsBatchAiLoading] = useState(false);

  const [mappingVersion, setMappingVersion] = useState<MappingVersion | null>(null);

  useEffect(() => {
    if (initialFilter) {
      setFilterStatus(initialFilter);
      onFilterConsumed?.();
    }
  }, [initialFilter, onFilterConsumed]);

  const headers = useMemo(() => ({ "Content-Type": "application/json" }), []);

  const fetchData = useCallback(async () => {
    if (!engagementId) return;
    setLoading(true);
    try {
      const [headsRes, allocRes] = await Promise.all([
        fetchWithAuth(`/api/review-mapping/fs-heads/${engagementId}`),
        fetchWithAuth(`/api/review-mapping/allocations/${engagementId}`)
      ]);

      let heads: FSHead[] = [];
      if (headsRes.ok) {
        const headsData = await headsRes.json();
        heads = headsData.fsHeads || [];
        setFsHeads(heads);
        if (heads.length > 0 && expandedHeads.size === 0) {
          setExpandedHeads(new Set([heads[0].id]));
        }
      }

      if (allocRes.ok) {
        const allocData = await allocRes.json();
        const entries = allocData.tbEntries || [];

        if (entries.length > 0 && heads.length === 0) {
          try {
            const initRes = await fetchWithAuth("/api/review-mapping/fs-heads/initialize", {
              method: "POST", headers,
              body: JSON.stringify({ engagementId })
            });
            if (initRes.ok) {
              const reHeadsRes = await fetchWithAuth(`/api/review-mapping/fs-heads/${engagementId}`);
              if (reHeadsRes.ok) {
                const reHeadsData = await reHeadsRes.json();
                heads = reHeadsData.fsHeads || [];
                setFsHeads(heads);
                if (heads.length > 0) setExpandedHeads(new Set([heads[0].id]));
              }
            }
          } catch { /* taxonomy auto-init is best-effort */ }
        }

        const totalAbsBalance = entries.reduce((sum: number, e: TBEntry) => sum + Math.abs(e.netBalance), 0);
        const materialityThreshold = Math.max(totalAbsBalance * 0.05, 100000000);
        const entriesWithExceptions = entries.map((entry: TBEntry) => {
          const isNegativeBalance = entry.netBalance < 0 &&
            (entry.accountType === 'ASSET' || entry.accountCode.startsWith('1'));
          const isUnusualCredit = entry.closingCredit > entry.closingDebit * 3 && entry.closingDebit > 0;
          const isLargeBalance = Math.abs(entry.netBalance) > materialityThreshold;
          const isException = isNegativeBalance || isUnusualCredit || isLargeBalance;
          let exceptionReason = '';
          if (isNegativeBalance) exceptionReason = 'Negative asset balance';
          else if (isUnusualCredit) exceptionReason = 'Unusual credit movement';
          else if (isLargeBalance) exceptionReason = 'Material balance';
          return { ...entry, isException, exceptionReason };
        });
        setTbEntries(entriesWithExceptions);
        const exceptionsCount = entriesWithExceptions.filter((e: TBEntry) => e.isException).length;
        setSummary({ ...(allocData.summary || {}), exceptionsCount });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [engagementId,  toast]);

  const fetchReconRibbon = useCallback(async () => {
    if (!engagementId) return;
    try {
      const res = await fetchWithAuth(`/api/review-mapping/reconciliation-ribbon/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setReconRibbon(data);
      }
    } catch { /* silent */ }
  }, [engagementId]);

  const fetchExceptions = useCallback(async () => {
    if (!engagementId) return;
    try {
      const res = await fetchWithAuth(`/api/review-mapping/exceptions/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setExceptions(data.exceptions || []);
        setExceptionsSummary(data.summary || null);
      }
    } catch { /* silent */ }
  }, [engagementId]);

  const fetchVersionTrail = useCallback(async () => {
    if (!engagementId) return;
    try {
      const res = await fetchWithAuth(`/api/review-mapping/version-trail/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setVersionTrail(data);
      }
    } catch { /* silent */ }
  }, [engagementId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!loading) {
      fetchReconRibbon();
      fetchExceptions();
      fetchVersionTrail();
    }
  }, [loading, fetchReconRibbon, fetchExceptions, fetchVersionTrail]);

  const initializeTaxonomy = async () => {
    if (!engagementId) return;
    setIsInitializing(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/fs-heads/initialize", {
        method: "POST", headers, body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "FS taxonomy initialized with default structure" });
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to initialize taxonomy", variant: "destructive" });
    } finally { setIsInitializing(false); }
  };

  const triggerAutoMap = async () => {
    if (!engagementId) return;
    setIsAutoMapping(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/auto-map-enhanced", {
        method: "POST", headers, body: JSON.stringify({ engagementId, mode: 'RULES_ONLY' })
      });
      if (res.ok) {
        const data = await res.json();
        const suggestions: AutoMapSuggestion[] = (data.suggestions || []).map((s: any) => ({
          ...s,
          checked: (s.confidence || 0) >= 0.7,
        }));
        setAutoMapSuggestions(suggestions);
        setShowAutoMapDialog(true);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to generate suggestions", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to run auto-mapping", variant: "destructive" });
    } finally { setIsAutoMapping(false); }
  };

  const triggerPriorMap = async () => {
    if (!engagementId) return;
    setIsPriorMapping(true);
    try {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}/coa/auto-map-prior`, {
        method: "POST", headers,
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Prior Mapping Applied", description: data.message });
        if (data.applied > 0) {
          fetchData();
        }
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to apply prior mappings", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to apply prior mappings", variant: "destructive" });
    } finally { setIsPriorMapping(false); }
  };

  const triggerAiBatchMap = async () => {
    if (!engagementId) return;
    const unmapped = tbEntries.filter(e => !e.isMapped && !e.isLocked);
    if (unmapped.length === 0) {
      toast({ title: "All Mapped", description: "No unmapped accounts to suggest" });
      return;
    }
    setIsBatchAiLoading(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/ai-suggest-batch", {
        method: "POST", headers,
        body: JSON.stringify({
          engagementId,
          accounts: unmapped.slice(0, 25).map(e => ({
            accountCode: e.accountCode,
            accountName: e.accountName,
            netBalance: e.netBalance,
            accountType: e.accountType,
          })),
        })
      });
      if (res.ok) {
        const data = await res.json();
        const suggestions: AutoMapSuggestion[] = (data.suggestions || [])
          .filter((s: any) => s.suggestedFsHeadId || s.fsHeadId)
          .map((s: any) => ({
          accountCode: s.accountCode,
          accountName: unmapped.find(u => u.accountCode === s.accountCode)?.accountName || s.accountName || s.accountCode,
          suggestedFsHeadId: s.suggestedFsHeadId || s.fsHeadId,
          suggestedFsHeadName: s.suggestedFsHeadName || s.fsHeadName,
          suggestedFsLineId: s.suggestedFsLineId || s.fsLineId,
          suggestedFsLineName: s.suggestedFsLineName || s.fsLineName,
          confidence: s.confidence || 0.5,
          reason: s.rationale || s.reason || '',
          checked: (s.confidence || 0) >= 0.7,
        }));
        setAutoMapSuggestions(suggestions);
        setShowAutoMapDialog(true);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to run AI batch mapping", variant: "destructive" });
    } finally { setIsBatchAiLoading(false); }
  };

  const applyAutoMapSuggestions = async () => {
    const checked = autoMapSuggestions.filter(s => s.checked);
    if (checked.length === 0) {
      toast({ title: "No suggestions selected", description: "Select at least one suggestion to apply." });
      return;
    }
    setIsAutoMapping(true);
    try {
      const mappings = checked.map(s => ({
        accountCode: s.accountCode,
        fsHeadId: s.suggestedFsHeadId,
        fsLineId: s.suggestedFsLineId || null,
      }));
      const res = await fetchWithAuth("/api/review-mapping/auto-map-apply", {
        method: "POST", headers, body: JSON.stringify({ engagementId, mappings })
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Mappings Applied", description: `${data.created || 0} created, ${data.updated || 0} updated, ${data.skippedLocked || 0} skipped (locked)` });
        setShowAutoMapDialog(false);
        setAutoMapSuggestions([]);
        fetchData();
        fetchReconRibbon();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to apply suggestions", variant: "destructive" });
    } finally { setIsAutoMapping(false); }
  };

  const resolveException = async (exceptionId: string, resolution: 'FIX' | 'APPROVE' | 'SPLIT', extra?: { fsHeadId?: string; fsLineId?: string }) => {
    if (!engagementId) return;
    setIsResolvingException(exceptionId);
    try {
      const res = await fetchWithAuth("/api/review-mapping/exceptions/resolve", {
        method: "POST", headers,
        body: JSON.stringify({ engagementId, exceptionId, resolution, ...extra })
      });
      if (res.ok) {
        toast({ title: "Exception Resolved", description: `Exception resolved with ${resolution}` });
        fetchExceptions();
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to resolve exception", variant: "destructive" });
    } finally { setIsResolvingException(null); }
  };

  const handleResolveExceptionWithMapping = async () => {
    if (!exceptionBeingResolved || !exceptionResolutionFsHeadId || !engagementId) return;
    setIsResolvingException(exceptionBeingResolved.exception.id);
    try {
      const res = await fetchWithAuth("/api/review-mapping/exceptions/resolve", {
        method: "POST", headers,
        body: JSON.stringify({
          engagementId,
          exceptionId: exceptionBeingResolved.exception.id,
          resolution: exceptionBeingResolved.resolution,
          fsHeadId: exceptionResolutionFsHeadId,
          fsLineId: exceptionResolutionFsLineId || undefined,
        })
      });
      if (res.ok) {
        toast({ title: "Exception Resolved", description: `Exception resolved with ${exceptionBeingResolved.resolution}` });
        setExceptionResolutionDialogOpen(false);
        setExceptionBeingResolved(null);
        setExceptionResolutionFsHeadId("");
        setExceptionResolutionFsLineId("");
        fetchExceptions();
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to resolve exception", variant: "destructive" });
    } finally { setIsResolvingException(null); }
  };

  const handleApproveLock = async () => {
    if (!engagementId) return;
    setIsApproving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/approve-lock", {
        method: "POST", headers, body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version) {
          setMappingVersion({
            id: data.version.id || `MV-${Date.now()}`,
            version: data.version.version || 1,
            status: 'LOCKED',
            createdAt: data.version.createdAt || new Date().toISOString(),
            approvedAt: new Date().toISOString(),
            approvedBy: data.version.approvedBy || 'current-user',
            snapshotId: data.version.snapshotId || null,
            totalMapped: summary?.mappedAccounts || 0,
            totalAccounts: summary?.totalAccounts || 0,
            completeness: summary?.completeness || 0,
          });
        }
        setShowApproveDialog(false);
        toast({ title: "Approved & Locked", description: "Mapping version has been approved and locked." });
        fetchData();
        fetchVersionTrail();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to approve and lock", variant: "destructive" });
    } finally { setIsApproving(false); }
  };

  const recomputeRollups = async () => {
    if (!engagementId) return;
    setIsRecomputing(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/recompute-rollup", {
        method: "POST", headers, body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "Roll-up balances recomputed" });
        fetchData();
        fetchReconRibbon();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to recompute rollups", variant: "destructive" });
    } finally { setIsRecomputing(false); }
  };

  const lockMappings = async () => {
    if (!engagementId) return;
    setIsLocking(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/lock", {
        method: "POST", headers, body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "All mappings locked" });
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to lock mappings", variant: "destructive" });
    } finally { setIsLocking(false); }
  };

  const unlockMappings = async () => {
    if (!engagementId) return;
    setIsLocking(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/unlock", {
        method: "POST", headers, body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "All mappings unlocked" });
        setMappingVersion(null);
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to unlock mappings", variant: "destructive" });
    } finally { setIsLocking(false); }
  };

  const pushForward = async () => {
    if (!engagementId) return;
    if (summary && summary.completeness < 100) {
      toast({ title: "Cannot Push Forward", description: "Mapping is not 100% complete.", variant: "destructive" });
      return;
    }
    if (!isLocked) {
      toast({ title: "Cannot Push Forward", description: "Mapping must be approved and locked before pushing.", variant: "destructive" });
      return;
    }
    setIsPushing(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/push-forward", {
        method: "POST", headers, body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        const data = await res.json();
        setPushResult(data);
        toast({
          title: "Data Pushed Successfully",
          description: `Pushed to ${data.targets.join(", ")} — ${data.draftFs.headCount} FS Heads, ${data.execution.workingPapersCreated} new working papers created`,
        });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to push forward", variant: "destructive" });
    } finally { setIsPushing(false); }
  };

  const bulkAssign = async () => {
    if (!engagementId || selectedRows.size === 0 || !bulkFsHeadId) return;
    setIsSaving(true);
    try {
      const selectedEntries = tbEntries.filter(e => selectedRows.has(e.id));
      const accountCodes = selectedEntries.map(e => e.accountCode);
      const res = await fetchWithAuth("/api/review-mapping/allocations/bulk", {
        method: "POST", headers,
        body: JSON.stringify({ engagementId, accountCodes, fsHeadId: bulkFsHeadId, fsLineId: bulkFsLineId || null })
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Success", description: `Mapped ${data.created + data.updated} accounts` });
        setBulkAssignDialogOpen(false);
        setSelectedRows(new Set());
        setBulkFsHeadId("");
        setBulkFsLineId("");
        fetchData();
        fetchReconRibbon();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to bulk assign", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const addFsLine = async () => {
    if (!engagementId || !newLineFsHeadId || !newLineCode || !newLineName) return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/fs-lines", {
        method: "POST", headers,
        body: JSON.stringify({ engagementId, fsHeadId: newLineFsHeadId, code: newLineCode.toUpperCase().replace(/\s+/g, '_'), name: newLineName })
      });
      if (res.ok) {
        toast({ title: "Success", description: "FS Line created successfully" });
        setAddLineDialogOpen(false);
        setNewLineCode(""); setNewLineName(""); setNewLineFsHeadId("");
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create FS Line", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const renameFsLine = async () => {
    if (!engagementId || !renameLineId || !renameLineName) return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/fs-lines/rename", {
        method: "POST", headers,
        body: JSON.stringify({ engagementId, fsLineId: renameLineId, newName: renameLineName })
      });
      if (res.ok) {
        toast({ title: "Success", description: "FS Line renamed successfully" });
        setRenameDialogOpen(false);
        setRenameLineId(""); setRenameLineName("");
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to rename FS Line", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const mergeFsLines = async () => {
    if (!engagementId || mergeSourceIds.length === 0 || !mergeTargetId) return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/fs-lines/merge", {
        method: "POST", headers,
        body: JSON.stringify({ engagementId, sourceLineIds: mergeSourceIds, targetLineId: mergeTargetId, reason: mergeReason })
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Success", description: `Merged ${data.mergedCount} FS Lines into target` });
        setMergeDialogOpen(false);
        setMergeSourceIds([]); setMergeTargetId(""); setMergeReason("");
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to merge FS Lines", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const sortByFsHead = () => {
    const sorted = [...tbEntries].sort((a, b) => {
      const aHead = a.fsHeadName || 'zzz_unmapped';
      const bHead = b.fsHeadName || 'zzz_unmapped';
      if (aHead !== bHead) return aHead.localeCompare(bHead);
      return a.accountCode.localeCompare(b.accountCode);
    });
    setTbEntries(sorted);
    toast({ title: "Sorted", description: "Accounts sorted by FS Head grouping." });
  };

  const isLocked = tbEntries.length > 0 && tbEntries.every(e => e.isLocked);
  const noTbData = !loading && tbEntries.length === 0;
  const highExceptions = exceptionsSummary?.high || 0;

  const filteredEntries = useMemo(() => {
    return tbEntries.filter(entry => {
      const matchesSearch = !searchQuery ||
        entry.accountCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.accountName.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesFilter = true;
      if (filterStatus === "mapped") matchesFilter = entry.isMapped;
      else if (filterStatus === "unmapped") matchesFilter = !entry.isMapped;
      else if (filterStatus === "exceptions") matchesFilter = entry.isException === true;
      const matchesFsHead = !selectedFsHeadId || entry.fsHeadId === selectedFsHeadId || (!entry.isMapped);
      return matchesSearch && matchesFilter && matchesFsHead;
    });
  }, [tbEntries, searchQuery, filterStatus, selectedFsHeadId]);

  const bulkHeadLines = useMemo(() => {
    if (!bulkFsHeadId) return [];
    const head = fsHeads.find(h => h.id === bulkFsHeadId);
    return head?.fsLines || [];
  }, [bulkFsHeadId, fsHeads]);

  const allFsLines = useMemo(() =>
    fsHeads.flatMap(h => h.fsLines.map(l => ({ ...l, headName: h.name }))),
    [fsHeads]
  );

  const fsHeadTotals = useMemo(() => {
    const totals: Record<string, { debit: number; credit: number; net: number; mappedCount: number }> = {};
    for (const head of fsHeads) totals[head.id] = { debit: 0, credit: 0, net: 0, mappedCount: 0 };
    for (const entry of tbEntries) {
      if (entry.fsHeadId && totals[entry.fsHeadId]) {
        totals[entry.fsHeadId].debit += entry.closingDebit;
        totals[entry.fsHeadId].credit += entry.closingCredit;
        totals[entry.fsHeadId].net += entry.netBalance;
        totals[entry.fsHeadId].mappedCount += 1;
      }
    }
    return totals;
  }, [fsHeads, tbEntries]);

  const filteredFsHeads = useMemo(() => {
    if (!treeSearchQuery) return fsHeads;
    return fsHeads.filter(h =>
      h.name.toLowerCase().includes(treeSearchQuery.toLowerCase()) ||
      h.code.toLowerCase().includes(treeSearchQuery.toLowerCase())
    );
  }, [fsHeads, treeSearchQuery]);

  const bsHeads = useMemo(() => filteredFsHeads.filter(h => h.statementType === 'BS' || h.statementType === 'Balance Sheet'), [filteredFsHeads]);
  const plHeads = useMemo(() => filteredFsHeads.filter(h => h.statementType !== 'BS' && h.statementType !== 'Balance Sheet'), [filteredFsHeads]);

  const toggleHead = (headId: string) => {
    const newExpanded = new Set(expandedHeads);
    if (newExpanded.has(headId)) newExpanded.delete(headId);
    else newExpanded.add(headId);
    setExpandedHeads(newExpanded);
  };

  const toggleRowSelection = (rowId: string) => {
    const s = new Set(selectedRows);
    if (s.has(rowId)) s.delete(rowId);
    else s.add(rowId);
    setSelectedRows(s);
  };

  const fsMappingDataSource: DataSource = {
    datasetId: mappingVersion?.id || null,
    datasetType: 'MAPPING',
    version: mappingVersion?.version || 0,
    fileName: null,
    lastSynced: mappingVersion?.createdAt || null,
    status: tbEntries.length > 0 ? (isLocked ? 'CURRENT' : 'STALE') : 'MISSING',
    rowCount: tbEntries.length,
  };

  const fsMappingGates: TabGate[] = [
    { gateId: 'tb-loaded', label: 'TB Data Loaded', description: 'Trial Balance data must be loaded before mapping', check: tbEntries.length > 0 ? 'PASS' : 'FAIL', blocking: false },
    { gateId: 'taxonomy-initialized', label: 'Taxonomy Initialized', description: 'FS taxonomy must be initialized', check: fsHeads.length > 0 ? 'PASS' : 'FAIL', blocking: false },
    { gateId: 'all-mapped', label: 'All Accounts Mapped', description: 'All TB accounts must be mapped to an FS Head', check: (summary?.unmappedAccounts || 0) === 0 && tbEntries.length > 0 ? 'PASS' : (summary?.mappedAccounts || 0) > 0 ? 'WARNING' : 'NOT_RUN', blocking: false },
    { gateId: 'reconciled', label: 'TB Reconciled', description: 'TB totals must reconcile (debit = credit)', check: summary?.isReconciled ? 'PASS' : tbEntries.length > 0 ? 'FAIL' : 'NOT_RUN', blocking: false, isaRef: 'ISA 330' },
  ];

  const prevTab = getPrevTab('mapping');
  const nextTab = getNextTab('mapping');

  const mappingCompleteness = reconRibbon
    ? (reconRibbon.tbTotal > 0 ? ((reconRibbon.mappedTotal / reconRibbon.tbTotal) * 100) : 0)
    : (summary?.completeness || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }


  const renderFsHeadItem = (head: FSHead) => {
    const stats = fsHeadTotals[head.id] || { mappedCount: 0, net: 0 };
    const isActive = selectedFsHeadId === head.id;
    return (
      <Collapsible key={head.id} open={expandedHeads.has(head.id)} onOpenChange={() => toggleHead(head.id)}>
        <div
          className={`flex items-center gap-1.5 p-2 rounded-md hover-elevate cursor-pointer ${isActive ? 'bg-accent' : ''}`}
          data-testid={`fs-head-${head.code}`}
          onClick={() => setSelectedFsHeadId(selectedFsHeadId === head.id ? null : head.id)}
        >
          <CollapsibleTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <button className="shrink-0" data-testid={`toggle-head-${head.code}`}>
              {expandedHeads.has(head.id) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{head.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 no-default-hover-elevate no-default-active-elevate">
                {stats.mappedCount} accts
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground">{formatAccounting(stats.net)}</span>
            </div>
          </div>
        </div>
        <CollapsibleContent>
          <div className="ml-5 border-l pl-2 space-y-0.5 my-0.5">
            {head.fsLines.map(line => (
              <div key={line.id} className="flex items-center justify-between p-1.5 text-sm rounded-md hover-elevate group" data-testid={`fs-line-${line.code}`}>
                <div className="flex-1 truncate text-xs">{line.name}</div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-mono">{formatAccounting(line.netBalance || 0)}</span>
                  {!isLocked && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="invisible group-hover:visible" data-testid={`menu-line-${line.code}`}>
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setRenameLineId(line.id); setRenameLineName(line.name); setRenameDialogOpen(true); }} data-testid={`rename-line-${line.code}`}>
                          <Edit2 className="h-4 w-4" /> Rename
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
            {head.fsLines.length === 0 && <div className="text-[10px] text-muted-foreground p-1.5">No lines defined</div>}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <SubTabShell
      tabKey="mapping"
      gates={fsMappingGates}
      headerContent={
        mappingVersion ? (
          <Badge variant="outline" className="gap-1 no-default-hover-elevate" data-testid="badge-mapping-version">
            <span className="text-xs">v{mappingVersion.version}</span>
            <Badge variant={mappingVersion.status === 'LOCKED' ? 'default' : 'secondary'} className="text-[10px] no-default-hover-elevate no-default-active-elevate">
              {mappingVersion.status}
            </Badge>
          </Badge>
        ) : undefined
      }
    >
      <div className="flex flex-col h-full">
            {noTbData && (
              <Alert className="mx-4 mt-2 mb-1" data-testid="alert-no-tb-data">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Trial Balance Data</AlertTitle>
                <AlertDescription className="flex items-center gap-2">
                  Upload Trial Balance data in the Upload tab to start mapping.
                  <Button variant="outline" size="sm" onClick={() => onNavigate?.('upload')} data-testid="button-go-to-upload">
                    <ArrowRight className="h-4 w-4" /> Go to Upload
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {/* Reconciliation Ribbon */}
            <div className="border-b px-3 py-2 sticky top-0 z-30 bg-background" data-testid="recon-ribbon">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">TB Total:</span>
                  <span className="text-sm font-mono font-medium" data-testid="text-tb-total">{formatNumber(reconRibbon?.tbTotal ?? summary?.totalDebit ?? 0)}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Mapped:</span>
                  <span className="text-sm font-mono font-medium text-green-600 dark:text-green-400" data-testid="text-mapped-total">{formatNumber(reconRibbon?.mappedTotal ?? 0)}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <Collapsible open={reconExpanded} onOpenChange={setReconExpanded}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer" data-testid="button-toggle-difference">
                      <span className="text-xs text-muted-foreground">Difference:</span>
                      <span className={`text-sm font-mono font-medium ${(reconRibbon?.difference ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} data-testid="text-difference">
                        {formatNumber(reconRibbon?.difference ?? 0)}
                      </span>
                      {(reconRibbon?.difference ?? 0) > 0 && (
                        reconExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="absolute left-0 right-0 z-40 bg-background border-b shadow-sm px-3 py-2">
                    <div className="text-xs font-medium mb-1">Unmapped Accounts</div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {(reconRibbon?.unmappedAccounts || []).length === 0 ? (
                        <div className="text-xs text-muted-foreground">No unmapped accounts</div>
                      ) : (reconRibbon?.unmappedAccounts || []).map((ua, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="font-mono">{ua.accountCode}</span>
                          <span className="truncate flex-1 mx-2 text-muted-foreground">{ua.accountName}</span>
                          <span className="font-mono">{formatAccounting(ua.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <div className="flex-1 flex items-center gap-2 min-w-[120px]">
                  <Progress value={mappingCompleteness} className="h-1.5 flex-1 max-w-[180px]" data-testid="progress-mapping" />
                  <span className="text-xs font-medium whitespace-nowrap">{Math.round(mappingCompleteness)}%</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-3 text-xs border rounded-md px-2.5 py-1 bg-muted/30" data-testid="tb-control-totals-ribbon">
                  <span className="text-muted-foreground font-medium">TB Control Totals</span>
                  <span className="text-muted-foreground">Debit:</span>
                  <span className="font-mono font-medium" data-testid="text-ribbon-total-debit">{formatNumber(summary?.totalDebit || 0)}</span>
                  <span className="text-muted-foreground">Credit:</span>
                  <span className="font-mono font-medium" data-testid="text-ribbon-total-credit">{formatNumber(summary?.totalCredit || 0)}</span>
                  <span className="text-muted-foreground">Diff:</span>
                  <span className={`font-mono font-medium ${Math.abs((summary?.totalDebit || 0) - (summary?.totalCredit || 0)) > 1 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} data-testid="text-ribbon-tb-diff">
                    {formatNumber((summary?.totalDebit || 0) - (summary?.totalCredit || 0))}
                  </span>
                </div>
                <Badge variant={isLocked ? "default" : "secondary"} className="gap-1 no-default-hover-elevate" data-testid="badge-lock-status">
                  {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {isLocked ? "Locked" : "Unlocked"}
                </Badge>
              </div>
            </div>

            {/* Action Bar */}
            <div className="border-b px-3 py-2" data-testid="action-bar">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={triggerAutoMap}
                  disabled={isAutoMapping || isLocked || fsHeads.length === 0 || (summary?.unmappedAccounts ?? 0) === 0 || noTbData}
                  data-testid="button-auto-map"
                >
                  {isAutoMapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Auto Map
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerAiBatchMap}
                  disabled={isBatchAiLoading || isLocked || fsHeads.length === 0 || (summary?.unmappedAccounts ?? 0) === 0 || noTbData}
                  data-testid="button-ai-batch-map"
                >
                  {isBatchAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  AI Map All
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerPriorMap}
                  disabled={isPriorMapping || isLocked || (summary?.unmappedAccounts ?? 0) === 0 || noTbData}
                  data-testid="button-prior-map"
                >
                  {isPriorMapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                  Prior Year
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { fetchExceptions(); setExceptionsDialogOpen(true); }}
                  disabled={noTbData}
                  data-testid="button-resolve-exceptions"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Exceptions
                  {(exceptionsSummary?.total ?? 0) > 0 && (
                    <Badge variant="destructive" className="ml-1 text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid="badge-exception-count">
                      {exceptionsSummary?.total}
                    </Badge>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApproveDialog(true)}
                  disabled={canApproveLock === false || isLocked || (summary?.unmappedAccounts ?? 0) > 0 || highExceptions > 0 || noTbData}
                  data-testid="button-approve-lock"
                >
                  <Lock className="h-4 w-4" />
                  {isLocked ? 'Locked' : 'Approve & Lock'}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="button-more-actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={initializeTaxonomy} disabled={isInitializing || isLocked} data-testid="menu-init-taxonomy">
                      {isInitializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Initialize Taxonomy
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAddLineDialogOpen(true)} disabled={fsHeads.length === 0 || isLocked} data-testid="menu-add-fs-line">
                      <Plus className="h-4 w-4" /> Add FS Line
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMergeDialogOpen(true)} disabled={allFsLines.length < 2 || isLocked} data-testid="menu-merge-lines">
                      <GitMerge className="h-4 w-4" /> Merge Lines
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={recomputeRollups} disabled={isRecomputing} data-testid="menu-recompute">
                      {isRecomputing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Recompute Rollups
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={sortByFsHead} data-testid="menu-sort-by-head">
                      <ArrowDownToLine className="h-4 w-4" /> Sort by FS Head
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isLocked ? (
                      <DropdownMenuItem onClick={unlockMappings} disabled={isLocking} data-testid="menu-unlock">
                        <Unlock className="h-4 w-4" /> Unlock
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={pushForward} disabled={isPushing || !isLocked} data-testid="menu-push-forward">
                      {isPushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Push All Data Forward
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { fetchVersionTrail(); setVersionTrailDialogOpen(true); }} data-testid="menu-version-trail">
                      <History className="h-4 w-4" /> Version Trail
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex-1" />

                {selectedRows.size > 0 && !isLocked && (
                  <Button variant="secondary" size="sm" onClick={() => setBulkAssignDialogOpen(true)} data-testid="button-bulk-assign">
                    <CheckCheck className="h-4 w-4" /> Assign {selectedRows.size} Selected
                  </Button>
                )}

              </div>
            </div>

            {/* Main Three-Panel Layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Panel: FS Head Selector */}
              <div className="w-72 border-r flex flex-col shrink-0">
                <div className="p-2 border-b space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-1">
                    <FolderTree className="h-4 w-4" /> FS Structure
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter heads..."
                      value={treeSearchQuery}
                      onChange={(e) => setTreeSearchQuery(e.target.value)}
                      className="pl-7 h-8 text-xs"
                      data-testid="input-fs-tree-search"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    <div
                      className={`flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer text-sm ${!selectedFsHeadId ? 'bg-accent' : ''}`}
                      onClick={() => setSelectedFsHeadId(null)}
                      data-testid="fs-head-all"
                    >
                      <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">All Accounts</span>
                      <Badge variant="outline" className="ml-auto text-[10px] no-default-hover-elevate no-default-active-elevate">{tbEntries.length}</Badge>
                    </div>

                    {bsHeads.length > 0 && (
                      <>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-2">Balance Sheet</div>
                        {bsHeads.map(renderFsHeadItem)}
                      </>
                    )}
                    {plHeads.length > 0 && (
                      <>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-2">Profit & Loss</div>
                        {plHeads.map(renderFsHeadItem)}
                      </>
                    )}
                    {filteredFsHeads.length === 0 && fsHeads.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-2 px-2">
                        No FS taxonomy defined.
                        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={initializeTaxonomy} disabled={isInitializing} data-testid="button-init-taxonomy-empty">
                          {isInitializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Initialize Taxonomy
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Center Panel: Vertical Account Cards */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-2 border-b flex items-center gap-2 flex-wrap">
                  <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)} className="flex-shrink-0">
                    <TabsList className="h-8">
                      <TabsTrigger value="all" className="text-xs px-3" data-testid="tab-filter-all">
                        All
                        <Badge variant="outline" className="ml-1 text-[10px] no-default-hover-elevate no-default-active-elevate">{tbEntries.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="unmapped" className="text-xs px-3" data-testid="tab-filter-unmapped">
                        Unmapped
                        <Badge variant="outline" className="ml-1 text-[10px] no-default-hover-elevate no-default-active-elevate">{summary?.unmappedAccounts || 0}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="mapped" className="text-xs px-3" data-testid="tab-filter-mapped">
                        Mapped
                        <Badge variant="outline" className="ml-1 text-[10px] no-default-hover-elevate no-default-active-elevate">{summary?.mappedAccounts || 0}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="exceptions" className="text-xs px-3" data-testid="tab-filter-exceptions">
                        Exceptions
                        {(summary?.exceptionsCount || 0) > 0 && (
                          <Badge variant="destructive" className="ml-1 text-[10px] no-default-hover-elevate no-default-active-elevate">{summary?.exceptionsCount}</Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex-1" />
                  {selectedFsHeadId && (
                    <Badge variant="secondary" className="gap-1 text-xs no-default-hover-elevate">
                      {fsHeads.find(h => h.id === selectedFsHeadId)?.name}
                      <button onClick={() => setSelectedFsHeadId(null)} className="ml-1" data-testid="button-clear-head-filter">
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <div className="relative w-48">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search accounts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7 h-8 text-xs"
                      data-testid="input-search"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-3">
                    {filteredEntries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
                        <div className="text-sm font-medium text-muted-foreground">
                          {tbEntries.length === 0 ? "No TB data available." : "No matching accounts found."}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs text-muted-foreground">
                            Showing {filteredEntries.length} of {tbEntries.length} accounts
                          </span>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedRows.size === filteredEntries.length && filteredEntries.length > 0}
                              onCheckedChange={() => {
                                if (selectedRows.size === filteredEntries.length) setSelectedRows(new Set());
                                else setSelectedRows(new Set(filteredEntries.map(e => e.id)));
                              }}
                              disabled={isLocked}
                              data-testid="checkbox-select-all"
                            />
                            <span className="text-xs text-muted-foreground">Select all</span>
                          </div>
                        </div>

                        {filteredEntries.map(entry => (
                          <div key={entry.id} className="flex items-start gap-2">
                            <Checkbox
                              className="mt-2.5 shrink-0"
                              checked={selectedRows.has(entry.id)}
                              onCheckedChange={() => toggleRowSelection(entry.id)}
                              disabled={entry.isLocked}
                              data-testid={`checkbox-${entry.accountCode}`}
                            />
                            <div className="flex-1 min-w-0">
                              <AccountCard
                                entry={entry}
                                fsHeads={fsHeads}
                                isLocked={isLocked}
                                headers={headers}
                                engagementId={engagementId!}
                                onMappingSaved={() => { fetchData(); fetchReconRibbon(); }}
                                toast={toast}
                              />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>

            </div>

        {/* Exceptions Dialog */}
        <Dialog open={exceptionsDialogOpen} onOpenChange={setExceptionsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-exceptions">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Exceptions Queue</DialogTitle>
                  <DialogDescription>Review and resolve mapping exceptions</DialogDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchExceptions} data-testid="button-refresh-exceptions">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </DialogHeader>
            {exceptionsSummary && (
              <div className="flex items-center gap-1.5">
                {exceptionsSummary.high > 0 && <Badge variant="destructive" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{exceptionsSummary.high} HIGH</Badge>}
                {exceptionsSummary.medium > 0 && <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{exceptionsSummary.medium} MED</Badge>}
                {exceptionsSummary.low > 0 && <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{exceptionsSummary.low} LOW</Badge>}
              </div>
            )}
            <ScrollArea className="flex-1 max-h-[60vh]">
              {exceptions.length === 0 ? (
                <div className="flex flex-col items-center py-2 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 dark:text-green-400 mb-2" />
                  <div className="text-sm font-medium">No Exceptions</div>
                  <div className="text-xs text-muted-foreground">All mappings look good</div>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {exceptions.map(exc => (
                    <div key={exc.id} className="rounded-md border p-3 space-y-1.5" data-testid={`exception-${exc.id}`}>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={exc.severity === 'HIGH' ? 'destructive' : exc.severity === 'MEDIUM' ? 'secondary' : 'outline'}
                          className="text-[10px] no-default-hover-elevate no-default-active-elevate"
                        >
                          {exc.severity}
                        </Badge>
                        <span className="text-xs font-medium">{exc.type}</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-mono text-muted-foreground">{exc.accountCode}</span> {exc.accountName}
                      </div>
                      <div className="text-xs text-muted-foreground">{exc.message}</div>
                      {exc.suggestedFix && (
                        <div className="text-xs text-muted-foreground flex items-start gap-1">
                          <Zap className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                          {exc.suggestedFix}
                        </div>
                      )}
                      {!exc.resolution && (
                        <div className="flex items-center gap-1 pt-1">
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => { setExceptionBeingResolved({ exception: exc, resolution: 'FIX' }); setExceptionResolutionFsHeadId(""); setExceptionResolutionFsLineId(""); setExceptionResolutionDialogOpen(true); }} disabled={isResolvingException === exc.id} data-testid={`button-fix-${exc.id}`}>
                            {isResolvingException === exc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3" />} Fix
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => resolveException(exc.id, 'APPROVE')} disabled={isResolvingException === exc.id} data-testid={`button-approve-exc-${exc.id}`}>
                            <Shield className="h-3 w-3" /> Approve
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => { setExceptionBeingResolved({ exception: exc, resolution: 'SPLIT' }); setExceptionResolutionFsHeadId(""); setExceptionResolutionFsLineId(""); setExceptionResolutionDialogOpen(true); }} disabled={isResolvingException === exc.id} data-testid={`button-split-${exc.id}`}>
                            <GitMerge className="h-3 w-3" /> Split
                          </Button>
                        </div>
                      )}
                      {exc.resolution && (
                        <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> {exc.resolution}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Version Trail Dialog */}
        <Dialog open={versionTrailDialogOpen} onOpenChange={setVersionTrailDialogOpen}>
          <DialogContent className="max-w-lg max-h-[70vh] overflow-hidden flex flex-col" data-testid="dialog-version-trail">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" />Version Trail</DialogTitle>
                  <DialogDescription>Mapping change history and audit trail</DialogDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchVersionTrail} data-testid="button-refresh-version-trail">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </DialogHeader>
            {versionTrail?.currentVersion && (
              <Badge variant="outline" className="gap-1 no-default-hover-elevate w-fit" data-testid="badge-current-version">
                v{versionTrail.currentVersion.version} - {versionTrail.currentVersion.status}
              </Badge>
            )}
            <ScrollArea className="flex-1 max-h-[50vh]">
              {(versionTrail?.changeLog || []).length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-2">No version history yet</div>
              ) : (
                <div className="space-y-3 pr-4">
                  {(versionTrail?.changeLog || []).map((entry, idx) => (
                    <div key={entry.id || idx} className="flex items-start gap-2 text-xs" data-testid={`version-entry-${idx}`}>
                      <div className="mt-0.5 shrink-0">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{entry.action}</div>
                        {entry.reason && <div className="text-muted-foreground text-[11px] mt-0.5">{entry.reason}</div>}
                        <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {entry.performedAt ? new Date(entry.performedAt).toLocaleString() : 'Unknown'}
                          {entry.performedByName && <span className="ml-1">by {entry.performedByName}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Add FS Line Dialog */}
        <Dialog open={addLineDialogOpen} onOpenChange={setAddLineDialogOpen}>
          <DialogContent data-testid="dialog-add-fs-line">
            <DialogHeader>
              <DialogTitle>Add FS Line</DialogTitle>
              <DialogDescription>Create a new FS Line under an existing FS Head</DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 py-2">
              <div className="space-y-2">
                <Label>FS Head</Label>
                <Select value={newLineFsHeadId} onValueChange={setNewLineFsHeadId}>
                  <SelectTrigger data-testid="select-add-line-fs-head"><SelectValue placeholder="Select FS Head" /></SelectTrigger>
                  <SelectContent>{fsHeads.map(head => (<SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Line Code</Label>
                <Input value={newLineCode} onChange={(e) => setNewLineCode(e.target.value)} placeholder="e.g., NEW_ASSET" data-testid="input-add-line-code" />
              </div>
              <div className="space-y-2">
                <Label>Line Name</Label>
                <Input value={newLineName} onChange={(e) => setNewLineName(e.target.value)} placeholder="e.g., New Asset Category" data-testid="input-add-line-name" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddLineDialogOpen(false)} data-testid="button-add-line-cancel">Cancel</Button>
              <Button onClick={addFsLine} disabled={!newLineFsHeadId || !newLineCode || !newLineName || isSaving} data-testid="button-add-line-save">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create FS Line
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename FS Line Dialog */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent data-testid="dialog-rename-fs-line">
            <DialogHeader>
              <DialogTitle>Rename FS Line</DialogTitle>
              <DialogDescription>Update the name of this FS Line.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 py-2">
              <div className="space-y-2">
                <Label>New Name</Label>
                <Input value={renameLineName} onChange={(e) => setRenameLineName(e.target.value)} placeholder="Enter new name" data-testid="input-rename-line-name" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameDialogOpen(false)} data-testid="button-rename-cancel">Cancel</Button>
              <Button onClick={renameFsLine} disabled={!renameLineName || isSaving} data-testid="button-rename-save">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Merge FS Lines Dialog */}
        <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
          <DialogContent className="max-w-lg" data-testid="dialog-merge-fs-lines">
            <DialogHeader>
              <DialogTitle>Merge FS Lines</DialogTitle>
              <DialogDescription>Select source lines to merge into a target line. All mappings will be transferred.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 py-2">
              <div className="space-y-2">
                <Label>Source Lines (to be merged)</Label>
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1" data-testid="merge-source-list">
                  {allFsLines.map(line => (
                    <div key={line.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={mergeSourceIds.includes(line.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setMergeSourceIds([...mergeSourceIds, line.id]);
                          else setMergeSourceIds(mergeSourceIds.filter(id => id !== line.id));
                        }}
                        disabled={line.id === mergeTargetId}
                        data-testid={`checkbox-merge-source-${line.code}`}
                      />
                      <span className="text-sm">{line.name}</span>
                      <span className="text-xs text-muted-foreground">({line.headName})</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Line (merge into)</Label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger data-testid="select-merge-target"><SelectValue placeholder="Select target line" /></SelectTrigger>
                  <SelectContent>
                    {allFsLines.filter(l => !mergeSourceIds.includes(l.id)).map(line => (
                      <SelectItem key={line.id} value={line.id}>{line.name} ({line.headName})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason for Merge</Label>
                <Textarea value={mergeReason} onChange={(e) => setMergeReason(e.target.value)} placeholder="Explain why these lines are being merged..." data-testid="input-merge-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMergeDialogOpen(false)} data-testid="button-merge-cancel">Cancel</Button>
              <Button onClick={mergeFsLines} disabled={mergeSourceIds.length === 0 || !mergeTargetId || isSaving} data-testid="button-merge-save">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Merge Lines
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Assign Dialog */}
        <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
          <DialogContent data-testid="dialog-bulk-assign">
            <DialogHeader>
              <DialogTitle>Bulk Assign Mapping</DialogTitle>
              <DialogDescription>Assign {selectedRows.size} selected accounts to an FS Head/Line</DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 py-2">
              <div className="space-y-2">
                <Label>FS Head</Label>
                <Select value={bulkFsHeadId} onValueChange={(v) => { setBulkFsHeadId(v); setBulkFsLineId(""); }}>
                  <SelectTrigger data-testid="select-bulk-fs-head"><SelectValue placeholder="Select FS Head" /></SelectTrigger>
                  <SelectContent>{fsHeads.map(head => (<SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>FS Line (Optional)</Label>
                <Select value={bulkFsLineId || "__none__"} onValueChange={(v) => setBulkFsLineId(v === "__none__" ? "" : v)} disabled={!bulkFsHeadId || bulkHeadLines.length === 0}>
                  <SelectTrigger data-testid="select-bulk-fs-line"><SelectValue placeholder="Select FS Line" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {bulkHeadLines.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)} data-testid="button-bulk-cancel">Cancel</Button>
              <Button onClick={bulkAssign} disabled={!bulkFsHeadId || isSaving} data-testid="button-bulk-assign">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Assign {selectedRows.size} Accounts
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Auto-Map / AI Batch Review Dialog */}
        <Dialog open={showAutoMapDialog} onOpenChange={setShowAutoMapDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-auto-map-review">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Mapping Suggestions Review
              </DialogTitle>
              <DialogDescription>
                {autoMapSuggestions.length} suggestions generated.
                <span className="ml-1 font-medium">{autoMapSuggestions.filter(s => s.confidence >= 0.7).length} high-confidence.</span>
                <span className="ml-1">{autoMapSuggestions.filter(s => s.checked).length} selected.</span>
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 -mx-6 px-3">
              <div className="space-y-2 py-2">
                {autoMapSuggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.accountCode}
                    className={`flex items-center gap-3 p-3 rounded-md border ${
                      suggestion.checked ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20' :
                      suggestion.confidence < 0.65 ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700' : 'border-border'
                    }`}
                    data-testid={`auto-map-suggestion-${suggestion.accountCode}`}
                  >
                    <Checkbox
                      checked={suggestion.checked}
                      onCheckedChange={(checked) => {
                        const updated = [...autoMapSuggestions];
                        updated[idx] = { ...updated[idx], checked: !!checked };
                        setAutoMapSuggestions(updated);
                      }}
                      data-testid={`checkbox-auto-map-${suggestion.accountCode}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{suggestion.accountCode}</span>
                        <span className="text-sm font-medium truncate">{suggestion.accountName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">{suggestion.suggestedFsHeadName}</Badge>
                        {suggestion.suggestedFsLineName && (
                          <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">{suggestion.suggestedFsLineName}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground truncate">{suggestion.reason}</span>
                      </div>
                    </div>
                    <Badge
                      variant={suggestion.confidence >= 0.8 ? "default" : suggestion.confidence >= 0.65 ? "secondary" : "outline"}
                      className={`shrink-0 no-default-hover-elevate no-default-active-elevate ${
                        suggestion.confidence >= 0.8 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        suggestion.confidence >= 0.65 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                      data-testid={`badge-confidence-auto-${suggestion.accountCode}`}
                    >
                      {Math.round(suggestion.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setAutoMapSuggestions(autoMapSuggestions.map(s => ({ ...s, checked: true })))} data-testid="button-accept-all-auto">
                Accept All
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAutoMapSuggestions(autoMapSuggestions.map(s => ({ ...s, checked: s.confidence >= 0.7 })))} data-testid="button-accept-high-only">
                High Confidence Only
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAutoMapSuggestions(autoMapSuggestions.map(s => ({ ...s, checked: false })))} data-testid="button-reject-all-auto">
                Reject All
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => { setShowAutoMapDialog(false); setAutoMapSuggestions([]); }} data-testid="button-cancel-auto-map">Cancel</Button>
              <Button onClick={applyAutoMapSuggestions} disabled={isAutoMapping || autoMapSuggestions.filter(s => s.checked).length === 0} data-testid="button-apply-auto-map">
                {isAutoMapping ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Apply {autoMapSuggestions.filter(s => s.checked).length} Mappings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve & Lock Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent data-testid="dialog-approve-lock">
            <DialogHeader>
              <DialogTitle>Approve & Lock Mappings</DialogTitle>
              <DialogDescription>This will lock all mapped items and create a mapping version.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Accounts</span>
                  <span className="font-medium">{summary?.totalAccounts || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mapped</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{summary?.mappedAccounts || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unmapped</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{summary?.unmappedAccounts || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completeness</span>
                  <span className="font-medium">{summary?.completeness || 0}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">HIGH Exceptions</span>
                  <span className={`font-medium ${highExceptions > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{highExceptions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reconciliation</span>
                  <Badge variant={summary?.isReconciled ? "default" : "destructive"} className="no-default-hover-elevate no-default-active-elevate">
                    {summary?.isReconciled ? "Reconciled" : "Unreconciled"}
                  </Badge>
                </div>
                {versionTrail?.currentVersion && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Version</span>
                    <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">v{versionTrail.currentVersion.version}</Badge>
                  </div>
                )}
              </div>
              <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    Locking will prevent all edits to the FS mapping. You will need to unlock to make further changes.
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveDialog(false)} data-testid="button-approve-cancel">Cancel</Button>
              <Button onClick={handleApproveLock} disabled={isApproving || (summary?.unmappedAccounts ?? 0) > 0 || highExceptions > 0} data-testid="button-approve-confirm">
                {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Confirm Approve & Lock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exception Resolution Dialog */}
        <Dialog open={exceptionResolutionDialogOpen} onOpenChange={setExceptionResolutionDialogOpen}>
          <DialogContent data-testid="dialog-resolve-exception">
            <DialogHeader>
              <DialogTitle>Resolve Exception - {exceptionBeingResolved?.resolution}</DialogTitle>
              <DialogDescription>
                {exceptionBeingResolved?.exception.accountCode} - {exceptionBeingResolved?.exception.accountName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 py-2">
              <div className="rounded-md border p-3 bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Type</div>
                <div className="text-sm font-medium">{exceptionBeingResolved?.exception.type}</div>
              </div>
              <div className="rounded-md border p-3 bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <div className="text-sm">{exceptionBeingResolved?.exception.message}</div>
              </div>
              <div className="space-y-2">
                <Label>Remap to FS Head</Label>
                <Select value={exceptionResolutionFsHeadId} onValueChange={(v) => { setExceptionResolutionFsHeadId(v); setExceptionResolutionFsLineId(""); }}>
                  <SelectTrigger data-testid="select-exc-fs-head"><SelectValue placeholder="Select FS Head" /></SelectTrigger>
                  <SelectContent>
                    {fsHeads.map(head => (<SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>FS Line (Optional)</Label>
                <Select value={exceptionResolutionFsLineId || "__none__"} onValueChange={(v) => setExceptionResolutionFsLineId(v === "__none__" ? "" : v)} disabled={!exceptionResolutionFsHeadId || !fsHeads.find(h => h.id === exceptionResolutionFsHeadId)?.fsLines?.length}>
                  <SelectTrigger data-testid="select-exc-fs-line"><SelectValue placeholder="Select FS Line" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {fsHeads.find(h => h.id === exceptionResolutionFsHeadId)?.fsLines?.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExceptionResolutionDialogOpen(false)} data-testid="button-exc-cancel">Cancel</Button>
              <Button onClick={handleResolveExceptionWithMapping} disabled={!exceptionResolutionFsHeadId || isResolvingException === exceptionBeingResolved?.exception.id} data-testid="button-exc-resolve">
                {isResolvingException === exceptionBeingResolved?.exception.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Resolve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SubTabShell>
  );
}
