import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, ExternalLink, ChevronDown, AlertCircle, Link2,
  Upload, Sparkles, Loader2, Trash2, File, CheckCircle2,
  Eye, Pencil, X, Save, BookOpen, FileUp, Download
} from "lucide-react";
import { formatAccounting } from "@/lib/formatters";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import type { DraftFSData, CoAAccountData } from "./fs-types";

interface FSNotesProps {
  draftFsData: DraftFSData | undefined;
  coaAccounts: CoAAccountData[];
  engagementId: string;
  clientName: string;
  periodEnd: string;
  onSwitchTab?: (tab: string) => void;
}

interface NoteGroup {
  noteRef: string;
  fsLineItems: string[];
  accounts: CoAAccountData[];
  totalOpening: number;
  totalClosing: number;
}

interface ReferenceDoc {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string | null;
  createdAt: string;
}

interface GeneratedNote {
  id: string;
  noteNumber: number;
  noteTitle: string;
  content: string;
  noteRef: string | null;
  isAIGenerated: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FSNotes({ draftFsData, coaAccounts, engagementId, clientName, periodEnd, onSwitchTab }: FSNotesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notesViewTab, setNotesViewTab] = useState("data");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleExportExcel = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/notes/${engagementId}/export-excel`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Notes_to_FS_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export Complete", description: "Notes exported to Excel successfully." });
    } catch (error: any) {
      toast({ title: "Export Failed", description: error.message, variant: "destructive" });
    }
  }, [engagementId, clientName, toast]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    try {
      const res = await fetchWithAuth(`/api/notes/${engagementId}/reference-docs`, {
        method: "POST",
        body: formData,
        timeout: 60000,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      toast({ title: "Files Uploaded", description: `${data.uploaded} reference document(s) uploaded.` });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", engagementId, "reference-docs"] });
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [engagementId, toast, queryClient]);

  const { noteGroups, unmappedAccounts, summaryStats } = useMemo(() => {
    const grouped = new Map<string, CoAAccountData[]>();
    const unmapped: CoAAccountData[] = [];

    for (const account of coaAccounts) {
      const ref = account.notesDisclosureRef?.trim();
      if (ref) {
        if (!grouped.has(ref)) {
          grouped.set(ref, []);
        }
        grouped.get(ref)!.push(account);
      } else {
        unmapped.push(account);
      }
    }

    const notes: NoteGroup[] = Array.from(grouped.entries())
      .sort((a, b) => {
        const numA = parseInt(a[0].replace(/\D/g, "")) || 0;
        const numB = parseInt(b[0].replace(/\D/g, "")) || 0;
        if (numA !== numB) return numA - numB;
        return a[0].localeCompare(b[0]);
      })
      .map(([noteRef, accounts]) => {
        const fsLineItemSet = new Set<string>();
        let totalOpening = 0;
        let totalClosing = 0;

        for (const acc of accounts) {
          if (acc.fsLineItem?.trim()) {
            fsLineItemSet.add(acc.fsLineItem.trim());
          }
          totalOpening += acc.openingBalance || 0;
          totalClosing += acc.closingBalance || 0;
        }

        return {
          noteRef,
          fsLineItems: Array.from(fsLineItemSet),
          accounts,
          totalOpening,
          totalClosing,
        };
      });

    const mappedCount = coaAccounts.length - unmapped.length;
    const coverage = coaAccounts.length > 0 ? Math.round((mappedCount / coaAccounts.length) * 100) : 0;

    return {
      noteGroups: notes,
      unmappedAccounts: unmapped,
      summaryStats: {
        totalNotes: notes.length,
        mappedCount,
        unmappedCount: unmapped.length,
        coverage,
      },
    };
  }, [coaAccounts]);

  const { data: refDocs = [], isLoading: loadingDocs } = useQuery<ReferenceDoc[]>({
    queryKey: ["/api/notes", engagementId, "reference-docs"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/notes/${engagementId}/reference-docs`);
      if (!res.ok) throw new Error("Failed to fetch reference docs");
      return res.json();
    },
  });

  const { data: generatedNotes = [], isLoading: loadingNotes } = useQuery<GeneratedNote[]>({
    queryKey: ["/api/notes", engagementId, "generated"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/notes/${engagementId}/generated`);
      if (!res.ok) throw new Error("Failed to fetch generated notes");
      return res.json();
    },
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetchWithAuth(`/api/notes/${engagementId}/reference-docs`, {
        method: "POST",
        body: formData,
        timeout: 60000,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      toast({ title: "Files Uploaded", description: `${data.uploaded} reference document(s) uploaded successfully.` });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", engagementId, "reference-docs"] });
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }, [engagementId, toast, queryClient]);

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/notes/${engagementId}/reference-docs/${docId}`);
    },
    onSuccess: () => {
      toast({ title: "Document Removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", engagementId, "reference-docs"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/notes/${engagementId}/generate`, {
        noteGroups: noteGroups.map((g) => ({
          noteRef: g.noteRef,
          fsLineItems: g.fsLineItems,
          totalOpening: g.totalOpening,
          totalClosing: g.totalClosing,
          accounts: g.accounts.map((a) => ({
            accountCode: a.accountCode,
            accountName: a.accountName,
            accountClass: a.accountClass,
            openingBalance: a.openingBalance,
            closingBalance: a.closingBalance,
          })),
        })),
        clientName,
        periodEnd,
        reportingFramework: "IFRS as adopted in Pakistan",
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Notes Generated", description: `${data.generated} notes generated via ${data.provider}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", engagementId, "generated"] });
      setNotesViewTab("generated");
    },
    onError: (err: any) => {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, data }: { noteId: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/notes/${engagementId}/generated/${noteId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Note Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", engagementId, "generated"] });
      setEditingNoteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/notes/${engagementId}/generated/${noteId}`);
    },
    onSuccess: () => {
      toast({ title: "Note Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", engagementId, "generated"] });
    },
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    noteGroups.forEach((group, idx) => {
      initial[group.noteRef] = idx < 3;
    });
    initial["__unmapped__"] = false;
    return initial;
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (coaAccounts.length === 0) {
    return (
      <Card data-testid="fs-notes-empty-state">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-2.5">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold" data-testid="text-empty-title">No Chart of Accounts Data</h3>
            <p className="text-sm text-muted-foreground max-w-md" data-testid="text-empty-description">
              Notes to the Financial Statements require Chart of Accounts data. Please upload your Trial Balance
              and map accounts via the Data Intake page.
            </p>
          </div>
          <Link href={`/workspace/${engagementId}/requisition`} data-testid="link-upload-requisition">
            <Badge variant="outline" className="cursor-pointer gap-1">
              <ExternalLink className="h-3 w-3" />
              Go to Data Intake
            </Badge>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5" data-testid="fs-notes-container">
      <div className="print-only mb-3 text-center border-b pb-4 hidden print:block" data-testid="print-header">
        <h1 className="text-xl font-bold">{clientName}</h1>
        <h2 className="text-lg font-semibold">Notes to the Financial Statements</h2>
        <p className="text-sm text-muted-foreground">
          For the period ended {periodEnd} | Currency: PKR
        </p>
      </div>

      <Card data-testid="fs-notes-summary-card">
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Notes Summary</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/workspace/${engagementId}/requisition?tab=review-coa&subtab=mapping`} data-testid="link-review-mapping">
                <Badge variant="outline" className="cursor-pointer gap-1">
                  <Link2 className="h-3 w-3" />
                  FS Mapping
                </Badge>
              </Link>
              <Link href={`/workspace/${engagementId}/fs-heads`} data-testid="link-fs-heads">
                <Badge variant="outline" className="cursor-pointer gap-1">
                  <ExternalLink className="h-3 w-3" />
                  FS Heads
                </Badge>
              </Link>
            </div>
          </div>
          <CardDescription>
            {clientName} — Period ended {periodEnd}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="text-center" data-testid="stat-total-notes">
              <p className="text-lg font-bold">{summaryStats.totalNotes}</p>
              <p className="text-xs text-muted-foreground">Total Notes</p>
            </div>
            <div className="text-center" data-testid="stat-mapped-accounts">
              <p className="text-lg font-bold">{summaryStats.mappedCount}</p>
              <p className="text-xs text-muted-foreground">Mapped Accounts</p>
            </div>
            <div className="text-center" data-testid="stat-unmapped-accounts">
              <p className="text-lg font-bold">{summaryStats.unmappedCount}</p>
              <p className="text-xs text-muted-foreground">Unmapped Accounts</p>
            </div>
            <div className="text-center" data-testid="stat-coverage">
              <p className="text-lg font-bold">{summaryStats.coverage}%</p>
              <p className="text-xs text-muted-foreground">Coverage</p>
            </div>
            <div className="text-center" data-testid="stat-generated-notes">
              <p className="text-lg font-bold">{generatedNotes.length}</p>
              <p className="text-xs text-muted-foreground">AI Notes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        data-testid="reference-docs-card"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={isDragging ? "ring-2 ring-primary ring-offset-2 transition-all" : "transition-all"}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Reference Documents</CardTitle>
              <Badge variant="secondary">{refDocs.length} file{refDocs.length !== 1 ? "s" : ""}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="notes-file-upload" data-testid="button-upload-reference">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md cursor-pointer hover:bg-accent transition-colors">
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                  {isUploading ? "Uploading..." : "Upload Files"}
                </div>
                <input
                  id="notes-file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.zip,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  data-testid="input-file-upload"
                />
              </label>
            </div>
          </div>
          <CardDescription>
            Upload reference files (PDF, Excel, Word, ZIP) — ICAP guidelines, illustrative FS, model accounts, or prior year notes. Drag and drop multiple files or click Upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDocs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading documents...
            </div>
          ) : refDocs.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-2 gap-3 border-2 border-dashed rounded-lg transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`} data-testid="empty-ref-docs">
              <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">{isDragging ? "Drop files here" : "No Reference Documents"}</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Drag and drop or click Upload to add ICAP illustrative financial statements,
                  model accounts (Excel), prior year notes, or IFRS reference PDFs.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {refDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 p-2.5 border rounded-md hover:bg-accent/50 transition-colors"
                  data-testid={`ref-doc-${doc.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`ref-doc-name-${doc.id}`}>{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.fileSize)} &middot; {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteDocMutation.mutate(doc.id)}
                    disabled={deleteDocMutation.isPending}
                    data-testid={`button-delete-doc-${doc.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="ai-generation-card">
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">AI Notes Generation</CardTitle>
              {generatedNotes.length > 0 && (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {generatedNotes.length} generated
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {generatedNotes.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportExcel}
                  className="gap-1.5"
                  data-testid="button-export-notes-excel"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Excel
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || noteGroups.length === 0}
                className="gap-1.5"
                data-testid="button-generate-notes"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    {generatedNotes.length > 0 ? "Regenerate Notes" : "Generate Notes"}
                  </>
                )}
              </Button>
            </div>
          </div>
          <CardDescription>
            Generate Pakistan-formatted Notes to the Financial Statements using AI.
            {refDocs.length > 0 && ` ${refDocs.length} reference document(s) will provide context.`}
            {refDocs.length === 0 && " Upload reference files above for better results."}
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={notesViewTab} onValueChange={setNotesViewTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="data" className="gap-1.5 text-xs" data-testid="tab-notes-data-view">
            <FileText className="h-3.5 w-3.5" />
            Account Data ({noteGroups.length})
          </TabsTrigger>
          <TabsTrigger value="generated" className="gap-1.5 text-xs" data-testid="tab-notes-generated-view">
            <Sparkles className="h-3.5 w-3.5" />
            Generated Notes ({generatedNotes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="mt-3 space-y-3">
          {noteGroups.map((group, idx) => (
            <Collapsible
              key={group.noteRef}
              open={openSections[group.noteRef] ?? idx < 3}
              onOpenChange={() => toggleSection(group.noteRef)}
              data-testid={`note-section-${group.noteRef}`}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer select-none py-3" data-testid={`note-trigger-${group.noteRef}`}>
                    <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base" data-testid={`note-title-${group.noteRef}`}>
                          {group.noteRef}
                        </CardTitle>
                        <Badge variant="secondary" data-testid={`note-account-count-${group.noteRef}`}>
                          {group.accounts.length} account{group.accounts.length !== 1 ? "s" : ""}
                        </Badge>
                        {group.fsLineItems.map((fsl) => (
                          <Link
                            key={fsl}
                            href={`/workspace/${engagementId}/fs-heads?highlight=${encodeURIComponent(fsl)}`}
                            data-testid={`link-fs-head-${fsl}`}
                          >
                            <Badge variant="outline" className="cursor-pointer gap-1">
                              <Link2 className="h-3 w-3" />
                              {fsl}
                            </Badge>
                          </Link>
                        ))}
                        {onSwitchTab && (() => {
                          const bsFsItems = ['PPE', 'INTANGIBLE', 'INVENTORIES', 'TRADE_RECEIVABLES', 'TRADE_PAYABLES', 'SHARE_CAPITAL', 'RETAINED_EARNINGS', 'CASH', 'LOAN', 'BORROWING', 'INVESTMENT', 'DEFERRED', 'PROVISION', 'RIGHT_OF_USE', 'GOODWILL', 'OTHER_ASSETS', 'OTHER_LIABILITIES', 'PREPAYMENT', 'ACCRUAL'];
                          const plFsItems = ['REVENUE', 'COST_OF_SALES', 'ADMIN', 'DISTRIBUTION', 'SELLING', 'FINANCE_COSTS', 'FINANCE_INCOME', 'DEPRECIATION', 'AMORTISATION', 'IMPAIRMENT', 'INCOME_TAX', 'TAX_EXPENSE', 'OTHER_INCOME', 'OTHER_EXPENSE', 'OPERATING'];

                          const hasBs = group.accounts.some(a =>
                            ['Asset', 'Liability', 'Equity'].includes(a.accountClass || '') ||
                            bsFsItems.some(k => (a.fsLineItem || '').toUpperCase().includes(k))
                          );
                          const hasPl = group.accounts.some(a =>
                            ['Income', 'Expense', 'Revenue'].includes(a.accountClass || '') ||
                            plFsItems.some(k => (a.fsLineItem || '').toUpperCase().includes(k))
                          );

                          return (
                            <>
                              {hasBs && (
                                <button
                                  className="text-xs text-primary hover:underline cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); onSwitchTab("balance-sheet"); }}
                                  data-testid={`link-note-${group.noteRef}-to-bs`}
                                >
                                  &rarr; BS
                                </button>
                              )}
                              {hasPl && (
                                <button
                                  className="text-xs text-primary hover:underline cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); onSwitchTab("profit-loss"); }}
                                  data-testid={`link-note-${group.noteRef}-to-pl`}
                                >
                                  &rarr; P&amp;L
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono" data-testid={`note-closing-${group.noteRef}`}>
                          PKR {formatAccounting(group.totalClosing)}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            openSections[group.noteRef] ? "rotate-180" : ""
                          }`}
                          data-testid={`note-chevron-${group.noteRef}`}
                        />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Table data-testid={`note-table-${group.noteRef}`}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px] border-r border-border">Account Code</TableHead>
                          <TableHead className="border-r border-border">Account Name</TableHead>
                          <TableHead className="text-right w-[150px] border-r border-border">Opening Balance</TableHead>
                          <TableHead className="text-right w-[150px] border-r border-border">Closing Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.accounts.map((acc) => (
                          <TableRow key={acc.id} data-testid={`note-row-${acc.id}`}>
                            <TableCell className="font-mono text-sm border-r border-border" data-testid={`cell-code-${acc.id}`}>
                              {acc.accountCode}
                            </TableCell>
                            <TableCell className="border-r border-border" data-testid={`cell-name-${acc.id}`}>{acc.accountName}</TableCell>
                            <TableCell className="text-right font-mono border-r border-border" data-testid={`cell-opening-${acc.id}`}>
                              {formatAccounting(acc.openingBalance)}
                            </TableCell>
                            <TableCell className="text-right font-mono border-r border-border" data-testid={`cell-closing-${acc.id}`}>
                              {formatAccounting(acc.closingBalance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold border-t-2" data-testid={`note-total-${group.noteRef}`}>
                          <TableCell colSpan={2} className="text-right border-r border-border">
                            Total — {group.noteRef}
                          </TableCell>
                          <TableCell className="text-right font-mono border-r border-border" data-testid={`total-opening-${group.noteRef}`}>
                            {formatAccounting(group.totalOpening)}
                          </TableCell>
                          <TableCell className="text-right font-mono border-r border-border" data-testid={`total-closing-${group.noteRef}`}>
                            {formatAccounting(group.totalClosing)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}

          {unmappedAccounts.length > 0 && (
            <Collapsible
              open={openSections["__unmapped__"] ?? false}
              onOpenChange={() => toggleSection("__unmapped__")}
              data-testid="note-section-unmapped"
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer select-none" data-testid="note-trigger-unmapped">
                    <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base" data-testid="note-title-unmapped">
                          Unmapped Accounts
                        </CardTitle>
                        <Badge variant="destructive" data-testid="note-unmapped-count">
                          {unmappedAccounts.length} account{unmappedAccounts.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          openSections["__unmapped__"] ? "rotate-180" : ""
                        }`}
                        data-testid="note-chevron-unmapped"
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-3" data-testid="text-unmapped-hint">
                      These accounts have no Notes Disclosure Reference assigned. Assign references via the{" "}
                      <Link href={`/workspace/${engagementId}/requisition?tab=review-coa&subtab=mapping`} className="underline" data-testid="link-unmapped-mapping">
                        FS Mapping
                      </Link>{" "}
                      tab.
                    </p>
                    <Table data-testid="note-table-unmapped">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px] border-r border-border">Account Code</TableHead>
                          <TableHead className="border-r border-border">Account Name</TableHead>
                          <TableHead className="border-r border-border">FS Line Item</TableHead>
                          <TableHead className="text-right w-[150px] border-r border-border">Opening Balance</TableHead>
                          <TableHead className="text-right w-[150px] border-r border-border">Closing Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmappedAccounts.map((acc) => (
                          <TableRow key={acc.id} data-testid={`unmapped-row-${acc.id}`}>
                            <TableCell className="font-mono text-sm border-r border-border" data-testid={`unmapped-code-${acc.id}`}>
                              {acc.accountCode}
                            </TableCell>
                            <TableCell className="border-r border-border" data-testid={`unmapped-name-${acc.id}`}>{acc.accountName}</TableCell>
                            <TableCell className="border-r border-border" data-testid={`unmapped-fsline-${acc.id}`}>
                              {acc.fsLineItem || <span className="text-muted-foreground italic">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono border-r border-border" data-testid={`unmapped-opening-${acc.id}`}>
                              {formatAccounting(acc.openingBalance)}
                            </TableCell>
                            <TableCell className="text-right font-mono border-r border-border" data-testid={`unmapped-closing-${acc.id}`}>
                              {formatAccounting(acc.closingBalance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold border-t-2" data-testid="unmapped-total-row">
                          <TableCell colSpan={3} className="text-right border-r border-border">
                            Total — Unmapped
                          </TableCell>
                          <TableCell className="text-right font-mono border-r border-border" data-testid="unmapped-total-opening">
                            {formatAccounting(unmappedAccounts.reduce((sum, a) => sum + (a.openingBalance || 0), 0))}
                          </TableCell>
                          <TableCell className="text-right font-mono border-r border-border" data-testid="unmapped-total-closing">
                            {formatAccounting(unmappedAccounts.reduce((sum, a) => sum + (a.closingBalance || 0), 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </TabsContent>

        <TabsContent value="generated" className="mt-3 space-y-3">
          {loadingNotes ? (
            <Card>
              <CardContent className="flex items-center gap-2 py-2 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading generated notes...
              </CardContent>
            </Card>
          ) : generatedNotes.length === 0 ? (
            <Card data-testid="empty-generated-notes">
              <CardContent className="flex flex-col items-center justify-center py-12 gap-2.5">
                <Sparkles className="h-12 w-12 text-muted-foreground" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">No Generated Notes Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Click "Generate Notes" above to create AI-powered Notes to the Financial Statements
                    formatted per Pakistan requirements (Companies Act 2017 Third Schedule, IFRS as adopted).
                  </p>
                </div>
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending || noteGroups.length === 0}
                  className="gap-1.5"
                  data-testid="button-generate-notes-empty"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Notes
                </Button>
              </CardContent>
            </Card>
          ) : (
            generatedNotes.map((note) => (
              <Card key={note.id} data-testid={`generated-note-${note.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base" data-testid={`gen-note-title-${note.id}`}>
                        {note.noteRef ? `${note.noteRef} — ` : `Note ${note.noteNumber} — `}
                        {note.noteTitle}
                      </CardTitle>
                      {note.isAIGenerated && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                      <Badge
                        variant={note.status === "approved" ? "default" : note.status === "reviewed" ? "secondary" : "outline"}
                        className="text-xs"
                        data-testid={`gen-note-status-${note.id}`}
                      >
                        {note.status === "approved" ? "Approved" : note.status === "reviewed" ? "Reviewed" : "Draft"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {editingNoteId === note.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1"
                            onClick={() => {
                              updateNoteMutation.mutate({ noteId: note.id, data: { content: editContent } });
                            }}
                            disabled={updateNoteMutation.isPending}
                            data-testid={`button-save-note-${note.id}`}
                          >
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => setEditingNoteId(null)}
                            data-testid={`button-cancel-edit-${note.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1"
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditContent(note.content);
                            }}
                            data-testid={`button-edit-note-${note.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {note.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1"
                              onClick={() => updateNoteMutation.mutate({ noteId: note.id, data: { status: "reviewed" } })}
                              data-testid={`button-review-note-${note.id}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Mark Reviewed
                            </Button>
                          )}
                          {note.status === "reviewed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-green-600"
                              onClick={() => updateNoteMutation.mutate({ noteId: note.id, data: { status: "approved" } })}
                              data-testid={`button-approve-note-${note.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                            data-testid={`button-delete-note-${note.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingNoteId === note.id ? (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                      data-testid={`textarea-edit-note-${note.id}`}
                    />
                  ) : (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed"
                      data-testid={`gen-note-content-${note.id}`}
                    >
                      {note.content}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Generated: {new Date(note.createdAt).toLocaleString()}</span>
                    {note.updatedAt !== note.createdAt && (
                      <span>&middot; Updated: {new Date(note.updatedAt).toLocaleString()}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
