import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { 
  ArrowLeft, Save, Brain, CheckCircle2, FileSpreadsheet, 
  AlertCircle, RefreshCw, Search, ChevronRight, ChevronDown,
  Lock, Unlock, Wand2, Plus, Trash2, FolderTree, LayoutGrid,
  GitMerge, Link2, ArrowRight, Loader2, Play, Edit2, AlertTriangle,
  CheckCheck, XCircle, TrendingDown, Percent, MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

type FilterStatus = "all" | "mapped" | "unmapped" | "exceptions";

export default function ReviewMapping() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();

  const [fsHeads, setFsHeads] = useState<FSHead[]>([]);
  const [tbEntries, setTbEntries] = useState<TBEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedHeads, setExpandedHeads] = useState<Set<string>>(new Set());
  const [selectedAccount, setSelectedAccount] = useState<TBEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterFsHead, setFilterFsHead] = useState<string>("all");
  
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedFsHeadId, setSelectedFsHeadId] = useState<string>("");
  const [selectedFsLineId, setSelectedFsLineId] = useState<string>("");
  
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
  
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkFsHeadId, setBulkFsHeadId] = useState("");
  const [bulkFsLineId, setBulkFsLineId] = useState("");
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAiMapping, setIsAiMapping] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!engagementId) return;
    setLoading(true);
    try {
      const [headsRes, allocRes] = await Promise.all([
        fetchWithAuth(`/api/review-mapping/fs-heads/${engagementId}`),
        fetchWithAuth(`/api/review-mapping/allocations/${engagementId}`)
      ]);

      if (headsRes.ok) {
        const headsData = await headsRes.json();
        const heads = headsData.fsHeads || [];
        setFsHeads(heads);
        if (heads.length > 0 && expandedHeads.size === 0) {
          setExpandedHeads(new Set([heads[0].id]));
        }
      }

      if (allocRes.ok) {
        const allocData = await allocRes.json();
        const entries = allocData.tbEntries || [];
        
        const entriesWithExceptions = entries.map((entry: TBEntry) => {
          const isNegativeBalance = entry.netBalance < 0 && 
            (entry.accountType === 'ASSET' || entry.accountCode.startsWith('1'));
          const isUnusualCredit = entry.closingCredit > entry.closingDebit * 3 && entry.closingDebit > 0;
          const isLargeBalance = Math.abs(entry.netBalance) > 10000000;
          
          const isException = isNegativeBalance || isUnusualCredit || isLargeBalance;
          let exceptionReason = '';
          if (isNegativeBalance) exceptionReason = 'Negative asset balance';
          else if (isUnusualCredit) exceptionReason = 'Unusual credit movement';
          else if (isLargeBalance) exceptionReason = 'Material balance';
          
          return { ...entry, isException, exceptionReason };
        });
        
        setTbEntries(entriesWithExceptions);
        
        const exceptionsCount = entriesWithExceptions.filter((e: TBEntry) => e.isException).length;
        setSummary({ 
          ...(allocData.summary || {}), 
          exceptionsCount 
        });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [engagementId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const initializeTaxonomy = async () => {
    if (!engagementId) return;
    setIsInitializing(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/fs-heads/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "FS taxonomy initialized with default structure" });
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to initialize taxonomy", variant: "destructive" });
    } finally {
      setIsInitializing(false);
    }
  };

  const runAiMapping = async () => {
    if (!engagementId) return;
    setIsAiMapping(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/ai-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "AI Mapping Complete", description: `Created ${data.suggestionsCreated} mapping suggestions` });
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to run AI mapping", variant: "destructive" });
    } finally {
      setIsAiMapping(false);
    }
  };

  const recomputeRollups = async () => {
    if (!engagementId) return;
    setIsRecomputing(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/recompute-rollup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "Roll-up balances recomputed" });
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to recompute rollups", variant: "destructive" });
    } finally {
      setIsRecomputing(false);
    }
  };

  const lockMappings = async () => {
    if (!engagementId) return;
    
    if (summary && summary.unmappedAccounts > 0) {
      toast({ 
        title: "Cannot Lock", 
        description: `${summary.unmappedAccounts} accounts are still unmapped. Complete all mappings first.`, 
        variant: "destructive" 
      });
      return;
    }
    
    if (summary && !summary.isReconciled) {
      toast({ 
        title: "Cannot Lock", 
        description: "TB totals do not reconcile. Resolve differences before locking.", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsLocking(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "All mappings locked and approved" });
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to lock mappings", variant: "destructive" });
    } finally {
      setIsLocking(false);
    }
  };

  const unlockMappings = async () => {
    if (!engagementId) return;
    setIsLocking(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        toast({ title: "Success", description: "All mappings unlocked" });
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to unlock mappings", variant: "destructive" });
    } finally {
      setIsLocking(false);
    }
  };

  const pushForward = async () => {
    if (!engagementId) return;
    
    if (summary && summary.completeness < 100) {
      toast({ 
        title: "Cannot Push Forward", 
        description: "Mapping is not 100% complete. Complete all mappings or get Partner approval for exceptions.", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsPushing(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/push-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        const data = await res.json();
        toast({ 
          title: "Success", 
          description: `Created ${data.workingPapersCreated} FS Head Working Papers for execution phase` 
        });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to push forward", variant: "destructive" });
    } finally {
      setIsPushing(false);
    }
  };

  const saveMapping = async () => {
    if (!selectedAccount || !engagementId || !selectedFsHeadId) return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          accountCode: selectedAccount.accountCode,
          fsHeadId: selectedFsHeadId,
          fsLineId: selectedFsLineId || null
        })
      });
      if (res.ok) {
        toast({ title: "Success", description: "Account mapped successfully" });
        setMappingDialogOpen(false);
        setSelectedAccount(null);
        setSelectedFsHeadId("");
        setSelectedFsLineId("");
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save mapping", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const addFsLine = async () => {
    if (!engagementId || !newLineFsHeadId || !newLineCode || !newLineName) return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/fs-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          fsHeadId: newLineFsHeadId,
          code: newLineCode.toUpperCase().replace(/\s+/g, '_'),
          name: newLineName
        })
      });
      if (res.ok) {
        toast({ title: "Success", description: "FS Line created successfully" });
        setAddLineDialogOpen(false);
        setNewLineCode("");
        setNewLineName("");
        setNewLineFsHeadId("");
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create FS Line", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const renameFsLine = async () => {
    if (!engagementId || !renameLineId || !renameLineName) return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/fs-lines/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          fsLineId: renameLineId,
          newName: renameLineName
        })
      });
      if (res.ok) {
        toast({ title: "Success", description: "FS Line renamed successfully" });
        setRenameDialogOpen(false);
        setRenameLineId("");
        setRenameLineName("");
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to rename FS Line", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const mergeFsLines = async () => {
    if (!engagementId || mergeSourceIds.length === 0 || !mergeTargetId) return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth("/api/review-mapping/fs-lines/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          sourceLineIds: mergeSourceIds,
          targetLineId: mergeTargetId,
          reason: mergeReason
        })
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Success", description: `Merged ${data.mergedCount} FS Lines into target` });
        setMergeDialogOpen(false);
        setMergeSourceIds([]);
        setMergeTargetId("");
        setMergeReason("");
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to merge FS Lines", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const bulkAssign = async () => {
    if (!engagementId || selectedRows.size === 0 || !bulkFsHeadId) return;
    setIsSaving(true);
    try {
      const selectedEntries = tbEntries.filter(e => selectedRows.has(e.id));
      const accountCodes = selectedEntries.map(e => e.accountCode);
      
      const res = await fetchWithAuth("/api/review-mapping/allocations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          accountCodes,
          fsHeadId: bulkFsHeadId,
          fsLineId: bulkFsLineId || null
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        toast({ 
          title: "Success", 
          description: `Mapped ${data.created + data.updated} accounts (${data.created} new, ${data.updated} updated)` 
        });
        setBulkAssignDialogOpen(false);
        setSelectedRows(new Set());
        setBulkFsHeadId("");
        setBulkFsLineId("");
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to bulk assign mappings", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleHead = (headId: string) => {
    const newExpanded = new Set(expandedHeads);
    if (newExpanded.has(headId)) {
      newExpanded.delete(headId);
    } else {
      newExpanded.add(headId);
    }
    setExpandedHeads(newExpanded);
  };

  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === filteredEntries.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const filteredEntries = useMemo(() => {
    return tbEntries.filter(entry => {
      const matchesSearch = !searchQuery || 
        entry.accountCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.accountName.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (filterStatus === "mapped") matchesFilter = entry.isMapped;
      else if (filterStatus === "unmapped") matchesFilter = !entry.isMapped;
      else if (filterStatus === "exceptions") matchesFilter = entry.isException === true;
      
      const matchesFsHead = filterFsHead === "all" || entry.fsHeadId === filterFsHead;
      
      return matchesSearch && matchesFilter && matchesFsHead;
    });
  }, [tbEntries, searchQuery, filterStatus, filterFsHead]);

  const selectedHeadLines = useMemo(() => {
    if (!selectedFsHeadId) return [];
    const head = fsHeads.find(h => h.id === selectedFsHeadId);
    return head?.fsLines || [];
  }, [selectedFsHeadId, fsHeads]);

  const bulkHeadLines = useMemo(() => {
    if (!bulkFsHeadId) return [];
    const head = fsHeads.find(h => h.id === bulkFsHeadId);
    return head?.fsLines || [];
  }, [bulkFsHeadId, fsHeads]);

  const allFsLines = useMemo(() => {
    return fsHeads.flatMap(h => h.fsLines.map(l => ({ ...l, headName: h.name })));
  }, [fsHeads]);

  const isLocked = tbEntries.length > 0 && tbEntries.every(e => e.isLocked);

  const fsHeadTotals = useMemo(() => {
    const totals: Record<string, { debit: number; credit: number; net: number }> = {};
    for (const head of fsHeads) {
      totals[head.id] = { debit: 0, credit: 0, net: 0 };
    }
    for (const entry of tbEntries) {
      if (entry.fsHeadId && totals[entry.fsHeadId]) {
        totals[entry.fsHeadId].debit += entry.closingDebit;
        totals[entry.fsHeadId].credit += entry.closingCredit;
        totals[entry.fsHeadId].net += entry.netBalance;
      }
    }
    return totals;
  }, [fsHeads, tbEntries]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/workspace/${engagementId}/planning`}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Review & Mapping</h1>
              <p className="text-sm text-muted-foreground">
                Chart of Accounts and TB Mapping Workspace
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={summary?.completeness === 100 ? "default" : "secondary"} className="gap-1">
              <Percent className="h-3 w-3" />
              {summary?.completeness || 0}% Complete
            </Badge>
            <Badge variant={summary?.isReconciled ? "default" : "destructive"} className="gap-1">
              {summary?.isReconciled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {summary?.isReconciled ? "Reconciled" : "Unreconciled"}
            </Badge>
            <Badge variant={isLocked ? "default" : "secondary"} className="gap-1">
              {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              {isLocked ? "Locked" : "Unlocked"}
            </Badge>
            {summary && summary.unmappedAccounts > 0 && (
              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                <AlertCircle className="h-3 w-3" />
                {summary.unmappedAccounts} Unmapped
              </Badge>
            )}
            {summary && (summary.exceptionsCount || 0) > 0 && (
              <Badge variant="outline" className="gap-1 text-red-600 border-red-300">
                <AlertTriangle className="h-3 w-3" />
                {summary.exceptionsCount} Exceptions
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {fsHeads.length === 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={initializeTaxonomy} 
              disabled={isInitializing}
              data-testid="button-initialize-taxonomy"
            >
              {isInitializing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Initialize Taxonomy
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={runAiMapping} 
            disabled={isAiMapping || fsHeads.length === 0 || isLocked}
            data-testid="button-ai-mapping"
          >
            {isAiMapping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            AI Mapping
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setAddLineDialogOpen(true)}
            disabled={fsHeads.length === 0 || isLocked}
            data-testid="button-add-fs-line"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add FS Line
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setMergeDialogOpen(true)}
            disabled={fsHeads.length === 0 || allFsLines.length < 2 || isLocked}
            data-testid="button-merge-lines"
          >
            <GitMerge className="h-4 w-4 mr-2" />
            Merge
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={recomputeRollups} 
            disabled={isRecomputing}
            data-testid="button-recompute"
          >
            {isRecomputing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Recompute
          </Button>
          
          <div className="flex-1" />
          
          {selectedRows.size > 0 && !isLocked && (
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => setBulkAssignDialogOpen(true)}
              data-testid="button-bulk-assign"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Assign {selectedRows.size} Selected
            </Button>
          )}
          
          {isLocked ? (
            <Button variant="outline" size="sm" onClick={unlockMappings} disabled={isLocking} data-testid="button-unlock">
              {isLocking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
              Unlock
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={lockMappings} 
              disabled={isLocking || (summary?.unmappedAccounts ?? 0) > 0 || !summary?.isReconciled} 
              data-testid="button-lock"
            >
              {isLocking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Approve & Lock
            </Button>
          )}
          <Button 
            size="sm" 
            onClick={pushForward} 
            disabled={isPushing || !isLocked} 
            data-testid="button-push-forward"
          >
            {isPushing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Push Forward
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FolderTree className="h-4 w-4" />
              FS Structure
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {fsHeads.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No FS taxonomy defined.
                  <br />Click "Initialize Taxonomy" to start.
                </div>
              ) : (
                fsHeads.map(head => (
                  <Collapsible 
                    key={head.id} 
                    open={expandedHeads.has(head.id)}
                    onOpenChange={() => toggleHead(head.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                        data-testid={`fs-head-${head.code}`}
                      >
                        {expandedHeads.has(head.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{head.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {head.fsLines.length} lines · {fsHeadTotals[head.id]?.net ? formatNumber(fsHeadTotals[head.id].net) : '0'}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {head.statementType}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 border-l pl-2 space-y-1">
                        {head.fsLines.map(line => (
                          <div 
                            key={line.id}
                            className="flex items-center justify-between p-2 text-sm rounded-md hover-elevate group"
                            data-testid={`fs-line-${line.code}`}
                          >
                            <div className="flex-1 truncate">{line.name}</div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                {formatNumber(line.netBalance || 0)}
                              </span>
                              {!isLocked && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                    >
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                      setRenameLineId(line.id);
                                      setRenameLineName(line.name);
                                      setRenameDialogOpen(true);
                                    }}>
                                      <Edit2 className="h-4 w-4 mr-2" />
                                      Rename
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        ))}
                        {head.fsLines.length === 0 && (
                          <div className="text-xs text-muted-foreground p-2">No lines defined</div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <LayoutGrid className="h-4 w-4" />
              TB Accounts
            </div>
            <div className="flex-1" />
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
                data-testid="input-search"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v: FilterStatus) => setFilterStatus(v)}>
              <SelectTrigger className="w-32 h-9" data-testid="select-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="mapped">Mapped</SelectItem>
                <SelectItem value="unmapped">Unmapped</SelectItem>
                <SelectItem value="exceptions">Exceptions</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterFsHead} onValueChange={setFilterFsHead}>
              <SelectTrigger className="w-40 h-9" data-testid="select-filter-head">
                <SelectValue placeholder="All FS Heads" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All FS Heads</SelectItem>
                {fsHeads.map(head => (
                  <SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedRows.size === filteredEntries.length && filteredEntries.length > 0}
                      onCheckedChange={toggleAllRows}
                      disabled={isLocked}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="text-right w-28">Debit</TableHead>
                  <TableHead className="text-right w-28">Credit</TableHead>
                  <TableHead className="text-right w-28">Net Balance</TableHead>
                  <TableHead className="w-36">FS Head</TableHead>
                  <TableHead className="w-36">FS Line</TableHead>
                  <TableHead className="w-16">Status</TableHead>
                  <TableHead className="w-16">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-4">
                      {tbEntries.length === 0 
                        ? "No TB data available. Upload TB data in the Planning phase first."
                        : "No matching accounts found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map(entry => (
                    <TableRow 
                      key={entry.id}
                      className={`
                        ${!entry.isMapped ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}
                        ${entry.isException ? "bg-red-50/50 dark:bg-red-950/20" : ""}
                      `}
                      data-testid={`row-tb-${entry.accountCode}`}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedRows.has(entry.id)}
                          onCheckedChange={() => toggleRowSelection(entry.id)}
                          disabled={entry.isLocked}
                          data-testid={`checkbox-${entry.accountCode}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{entry.accountCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {entry.accountName}
                          {entry.isException && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                {entry.exceptionReason}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(entry.closingDebit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(entry.closingCredit)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-medium ${entry.netBalance < 0 ? 'text-red-600' : ''}`}>
                        {formatNumber(entry.netBalance)}
                      </TableCell>
                      <TableCell>
                        {entry.fsHeadName ? (
                          <Badge variant="outline" className="text-xs">{entry.fsHeadName}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.fsLineName ? (
                          <span className="text-xs">{entry.fsLineName}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.isLocked ? (
                          <Lock className="h-4 w-4 text-blue-500" />
                        ) : entry.isMapped ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedAccount(entry);
                            setSelectedFsHeadId(entry.fsHeadId || "");
                            setSelectedFsLineId(entry.fsLineId || "");
                            setMappingDialogOpen(true);
                          }}
                          disabled={entry.isLocked}
                          data-testid={`button-map-${entry.accountCode}`}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <div className="w-72 border-l flex flex-col">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <GitMerge className="h-4 w-4" />
              Summary & Reconciliation
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Mapping Progress</div>
                <Progress value={summary?.completeness || 0} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{summary?.mappedAccounts || 0} mapped</span>
                  <span>{summary?.completeness || 0}%</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Account Summary</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Total Accounts</div>
                  <div className="text-right font-medium">{summary?.totalAccounts || 0}</div>
                  <div className="text-muted-foreground">Mapped</div>
                  <div className="text-right font-medium text-green-600">{summary?.mappedAccounts || 0}</div>
                  <div className="text-muted-foreground">Unmapped</div>
                  <div className="text-right font-medium text-amber-600">{summary?.unmappedAccounts || 0}</div>
                  <div className="text-muted-foreground">Exceptions</div>
                  <div className="text-right font-medium text-red-600">{summary?.exceptionsCount || 0}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">TB Control Totals</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Total Debit</div>
                  <div className="text-right font-mono text-xs">{formatNumber(summary?.totalDebit || 0)}</div>
                  <div className="text-muted-foreground">Total Credit</div>
                  <div className="text-right font-mono text-xs">{formatNumber(summary?.totalCredit || 0)}</div>
                  <div className="text-muted-foreground font-medium">Difference</div>
                  <div className={`text-right font-mono text-xs font-medium ${
                    Math.abs((summary?.totalDebit || 0) - (summary?.totalCredit || 0)) > 1 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formatNumber((summary?.totalDebit || 0) - (summary?.totalCredit || 0))}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Reconciliation Status</div>
                <div className="flex items-center gap-2">
                  {summary?.isReconciled ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Balanced</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">Difference Exists</span>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Lock Status</div>
                <div className="flex items-center gap-2">
                  {isLocked ? (
                    <>
                      <Lock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-blue-600">Approved & Locked</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Unlocked - Editable</span>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">FS Head Preview</div>
                <div className="space-y-1">
                  {fsHeads.slice(0, 8).map(head => (
                    <div key={head.id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate flex-1">{head.name}</span>
                      <span className="font-mono ml-2">{formatNumber(fsHeadTotals[head.id]?.net || 0)}</span>
                    </div>
                  ))}
                  {fsHeads.length > 8 && (
                    <div className="text-xs text-muted-foreground">
                      +{fsHeads.length - 8} more...
                    </div>
                  )}
                </div>
              </div>

              {(summary?.unmappedAccounts || 0) > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-amber-600">Unmapped Accounts</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {tbEntries.filter(e => !e.isMapped).slice(0, 5).map(entry => (
                        <div 
                          key={entry.id} 
                          className="text-xs text-muted-foreground hover-elevate p-1 rounded cursor-pointer"
                          onClick={() => {
                            setSelectedAccount(entry);
                            setSelectedFsHeadId("");
                            setSelectedFsLineId("");
                            setMappingDialogOpen(true);
                          }}
                        >
                          {entry.accountCode} - {entry.accountName}
                        </div>
                      ))}
                      {(summary?.unmappedAccounts || 0) > 5 && (
                        <div className="text-xs text-muted-foreground">
                          +{(summary?.unmappedAccounts || 0) - 5} more...
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Map Account to FS Structure</DialogTitle>
            <DialogDescription>
              {selectedAccount?.accountCode} - {selectedAccount?.accountName}
              <br />
              <span className="font-mono">Balance: {formatNumber(selectedAccount?.netBalance || 0)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>FS Head</Label>
              <Select value={selectedFsHeadId} onValueChange={(v) => { setSelectedFsHeadId(v); setSelectedFsLineId(""); }}>
                <SelectTrigger data-testid="select-fs-head">
                  <SelectValue placeholder="Select FS Head" />
                </SelectTrigger>
                <SelectContent>
                  {fsHeads.map(head => (
                    <SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>FS Line (Optional)</Label>
              <Select 
                value={selectedFsLineId || "__none__"} 
                onValueChange={(v) => setSelectedFsLineId(v === "__none__" ? "" : v)}
                disabled={!selectedFsHeadId || selectedHeadLines.length === 0}
              >
                <SelectTrigger data-testid="select-fs-line">
                  <SelectValue placeholder="Select FS Line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {selectedHeadLines.map(line => (
                    <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMapping} disabled={!selectedFsHeadId || isSaving} data-testid="button-save-mapping">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addLineDialogOpen} onOpenChange={setAddLineDialogOpen}>
        <DialogContent data-testid="dialog-add-fs-line">
          <DialogHeader>
            <DialogTitle>Add FS Line</DialogTitle>
            <DialogDescription>
              Create a new FS Line under an existing FS Head
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>FS Head</Label>
              <Select value={newLineFsHeadId} onValueChange={setNewLineFsHeadId}>
                <SelectTrigger data-testid="select-add-line-fs-head">
                  <SelectValue placeholder="Select FS Head" />
                </SelectTrigger>
                <SelectContent>
                  {fsHeads.map(head => (
                    <SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Line Code</Label>
              <Input 
                value={newLineCode} 
                onChange={(e) => setNewLineCode(e.target.value)}
                placeholder="e.g., NEW_ASSET"
                data-testid="input-add-line-code"
              />
            </div>
            <div className="space-y-2">
              <Label>Line Name</Label>
              <Input 
                value={newLineName} 
                onChange={(e) => setNewLineName(e.target.value)}
                placeholder="e.g., New Asset Category"
                data-testid="input-add-line-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLineDialogOpen(false)} data-testid="button-add-line-cancel">
              Cancel
            </Button>
            <Button onClick={addFsLine} disabled={!newLineFsHeadId || !newLineCode || !newLineName || isSaving} data-testid="button-add-line-save">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create FS Line
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent data-testid="dialog-rename-fs-line">
          <DialogHeader>
            <DialogTitle>Rename FS Line</DialogTitle>
            <DialogDescription>
              Update the name of this FS Line. Changes will reflect immediately across all mapped accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Name</Label>
              <Input 
                value={renameLineName} 
                onChange={(e) => setRenameLineName(e.target.value)}
                placeholder="Enter new name"
                data-testid="input-rename-line-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} data-testid="button-rename-cancel">
              Cancel
            </Button>
            <Button onClick={renameFsLine} disabled={!renameLineName || isSaving} data-testid="button-rename-save">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-merge-fs-lines">
          <DialogHeader>
            <DialogTitle>Merge FS Lines</DialogTitle>
            <DialogDescription>
              Select source lines to merge into a target line. All mappings will be transferred.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Source Lines (to be merged)</Label>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1" data-testid="merge-source-list">
                {allFsLines.map(line => (
                  <div key={line.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={mergeSourceIds.includes(line.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setMergeSourceIds([...mergeSourceIds, line.id]);
                        } else {
                          setMergeSourceIds(mergeSourceIds.filter(id => id !== line.id));
                        }
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
                <SelectTrigger data-testid="select-merge-target">
                  <SelectValue placeholder="Select target line" />
                </SelectTrigger>
                <SelectContent>
                  {allFsLines.filter(l => !mergeSourceIds.includes(l.id)).map(line => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name} ({line.headName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason for Merge</Label>
              <Textarea 
                value={mergeReason} 
                onChange={(e) => setMergeReason(e.target.value)}
                data-testid="input-merge-reason"
                placeholder="Explain why these lines are being merged..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} data-testid="button-merge-cancel">
              Cancel
            </Button>
            <Button onClick={mergeFsLines} disabled={mergeSourceIds.length === 0 || !mergeTargetId || isSaving} data-testid="button-merge-save">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Merge Lines
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent data-testid="dialog-bulk-assign">
          <DialogHeader>
            <DialogTitle>Bulk Assign Mapping</DialogTitle>
            <DialogDescription>
              Assign {selectedRows.size} selected accounts to an FS Head/Line
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>FS Head</Label>
              <Select value={bulkFsHeadId} onValueChange={(v) => { setBulkFsHeadId(v); setBulkFsLineId(""); }}>
                <SelectTrigger data-testid="select-bulk-fs-head">
                  <SelectValue placeholder="Select FS Head" />
                </SelectTrigger>
                <SelectContent>
                  {fsHeads.map(head => (
                    <SelectItem key={head.id} value={head.id}>{head.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>FS Line (Optional)</Label>
              <Select 
                value={bulkFsLineId || "__none__"} 
                onValueChange={(v) => setBulkFsLineId(v === "__none__" ? "" : v)}
                disabled={!bulkFsHeadId || bulkHeadLines.length === 0}
              >
                <SelectTrigger data-testid="select-bulk-fs-line">
                  <SelectValue placeholder="Select FS Line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {bulkHeadLines.map(line => (
                    <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)} data-testid="button-bulk-cancel">
              Cancel
            </Button>
            <Button onClick={bulkAssign} disabled={!bulkFsHeadId || isSaving} data-testid="button-bulk-assign">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Assign {selectedRows.size} Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
