import { useParams, Link } from "wouter";
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
  DialogDescription 
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  FolderOpen, Search, FileText, Image, File, Filter, Loader2, Archive, Calendar, 
  Lock, Plus, Eye, Trash2, Download, Link2, AlertTriangle,
  ClipboardCheck, Target, CheckCircle2, Sparkles, Upload, Check,
  Pencil, Save, Package, FileSpreadsheet, FileOutput, History, User, ShieldCheck,
  ArrowUpCircle, ArrowDownCircle, BookOpen, FileDown, Library
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { AIAssistBanner, PHASE_AI_CONFIGS } from "@/components/ai-assist-banner";
import { PhaseApprovalControl, PhaseLockIndicator } from "@/components/phase-approval-control";
import { PageShell } from "@/components/page-shell";
import { useEvidenceSaveBridge } from "@/hooks/use-evidence-save-bridge";

interface Attachment {
  id: string;
  source: "TAB" | "REQUEST";
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  phase: string;
  tabType: string;
  tabSection: string | null;
  description: string | null;
  workpaperRef: string | null;
  isPermanent: boolean;
  uploadedAt: string;
  uploadedBy: { id: string; fullName: string; role?: string } | null;
  uploadedByContact: { id: string; name: string; email?: string } | null;
  requestInfo: { id: string; title: string; srNumber: string } | null;
}

interface AttachmentStats {
  total: number;
  permanent: number;
  yearly: number;
  documents: number;
  images: number;
  totalSize: number;
}

interface LinkedRisk {
  id: string;
  accountOrClass: string;
  assertion: string;
  riskOfMaterialMisstatement: string;
  isSignificantRisk: boolean;
  isFraudRisk: boolean;
  linkedEvidenceCount: number;
}

interface LinkedTest {
  id: string;
  testCode: string;
  testName: string;
  fsArea: string;
  status: string;
  conclusion: string | null;
  linkedEvidenceCount: number;
}

interface LinkedMisstatement {
  id: string;
  description: string;
  amount: number;
  type: string;
  corrected: boolean;
  linkedEvidenceCount: number;
}

interface LinkedOutput {
  id: string;
  linkType?: string;
  linkedAt: string;
  output: {
    id: string;
    outputCode: string;
    outputName: string;
    phase: string;
    status: string;
    isDeliverable?: boolean;
    deliveryStatus?: string;
  };
  linkedBy?: { id: string; fullName: string };
}

interface CrossPhaseLinksSummary {
  risks: LinkedRisk[];
  tests: LinkedTest[];
  misstatements: LinkedMisstatement[];
  totalLinkedEvidence: number;
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
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].some(ext => type.includes(ext))) {
    return <FileText className="h-4 w-4 text-blue-500" />;
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].some(ext => type.includes(ext))) {
    return <Image className="h-4 w-4 text-green-500" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    REQUISITION: "Data Intake",
    ONBOARDING: "Onboarding",
    PRE_PLANNING: "Pre-Planning",
    PLANNING: "Planning",
    EXECUTION: "Execution",
    FINALIZATION: "Finalization",
    REPORTING: "Reporting",
    EQCR: "EQCR",
    INSPECTION: "Inspection",
  };
  return labels[phase] || phase;
}

interface VaultTemplate {
  id: string;
  fileName: string;
  category: string;
  subCategory: string;
  reference: string;
  title: string;
  description: string;
  fileType: string;
  phase: string;
  fsLineItems: string[];
  isaParagraph: string;
  sourceZip: string;
  linkedModule: string;
  prefillCapable: boolean;
  prefillFields: string[];
}

interface VaultCatalogResponse {
  templates: VaultTemplate[];
  meta: {
    totalTemplates: number;
    filteredCount: number;
    categories: string[];
    subCategories: string[];
    modules: string[];
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  WORKING_PAPER: "Working Papers",
  PLANNING: "Planning",
  REPORTING: "Reports & Letters",
  CONFIRMATION: "Confirmations",
  COMPLETION: "Completion",
  OTHER: "Other",
  ISQM: "ISQM Documents",
  ISQM_REFERENCE: "ISQM Reference",
};

const CATEGORY_COLORS: Record<string, string> = {
  WORKING_PAPER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PLANNING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  REPORTING: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  CONFIRMATION: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  COMPLETION: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  ISQM: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  ISQM_REFERENCE: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

const MODULE_LABELS: Record<string, string> = {
  "execution-fs-heads": "FS Heads",
  "execution-substantive": "Substantive Testing",
  "execution-confirmations": "Confirmations",
  "planning": "Planning",
  "planning-risk": "Risk Assessment",
  "planning-materiality": "Materiality",
  "data-intake": "Data Intake",
  "evidence-vault": "Evidence Vault",
  "finalization-reporting": "Reporting",
  "finalization-completion": "Completion",
  "engagement-setup": "Engagement Setup",
  "isqm-governance": "ISQM Governance",
  "isqm-resources": "ISQM Resources",
  "isqm-monitoring": "ISQM Monitoring",
  "isqm-eqcr": "ISQM EQCR",
};

function TemplateLibraryTab() {
  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultCategory, setVaultCategory] = useState("ALL");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<VaultTemplate | null>(null);
  const { toast } = useToast();
  const params = useParams<{ engagementId: string }>();
  const engagementId = params?.engagementId;

  const { data: catalogData, isLoading: catalogLoading } = useQuery<VaultCatalogResponse>({
    queryKey: ["/api/template-vault/catalog"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/template-vault/catalog");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  interface PreviewData {
    template: VaultTemplate;
    preview: {
      type: string;
      description?: string;
      sheets?: string[];
      fileSize?: number;
      lastModified?: string | null;
      prefillFields: string[];
      prefillCapable?: boolean;
      linkedModule?: string;
      sourceZip?: string;
    };
  }

  const { data: previewData } = useQuery<PreviewData>({
    queryKey: ["/api/template-vault/preview", previewTemplate?.id],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/template-vault/preview/${previewTemplate!.id}`);
      if (!res.ok) throw new Error("Failed to load preview");
      return res.json();
    },
    enabled: !!previewTemplate,
  });

  const downloadFile = async (url: string, fileName: string) => {
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const handleDownload = async (template: VaultTemplate) => {
    setDownloading(template.id);
    try {
      await downloadFile(`/api/template-vault/download/${template.id}`, template.fileName === "__GENERATED__" ? `${template.reference}_Template.xlsx` : template.fileName);
      toast({ title: "Downloaded", description: `${template.title} downloaded successfully` });
    } catch {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handlePrefilledDownload = async (template: VaultTemplate) => {
    setDownloading(`prefill-${template.id}`);
    try {
      const url = engagementId
        ? `/api/template-vault/download-prefilled/${template.id}?engagementId=${engagementId}`
        : `/api/template-vault/download-prefilled/${template.id}`;
      const fileName = template.fileName === "__GENERATED__"
        ? `${template.reference}_Prefilled.xlsx`
        : template.fileName;
      await downloadFile(url, fileName);
      toast({ title: "Downloaded", description: `${template.title} (prefilled) downloaded successfully` });
    } catch {
      toast({ title: "Error", description: "Failed to download prefilled template", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const templates = catalogData?.templates || [];
  const filtered = templates.filter(t => {
    if (vaultCategory !== "ALL" && t.category !== vaultCategory) return false;
    if (vaultSearch) {
      const term = vaultSearch.toLowerCase();
      return t.title.toLowerCase().includes(term) || t.reference.toLowerCase().includes(term) || t.description.toLowerCase().includes(term);
    }
    return true;
  });

  const grouped = filtered.reduce<Record<string, VaultTemplate[]>>((acc, t) => {
    const key = t.subCategory;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const fileIcon = (type: string) => {
    if (type === "xlsx") return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    if (type === "docx") return <FileText className="h-4 w-4 text-blue-600" />;
    if (type === "pdf") return <BookOpen className="h-4 w-4 text-red-600" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-indigo-950/20 border-b border-border/50 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 flex-shrink-0">
                <Library className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-lg">Template Library</CardTitle>
                <CardDescription>
                  {catalogData?.meta.totalTemplates || 0} standardized working paper templates, confirmation letters, and ISQM documents
                </CardDescription>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={vaultCategory} onValueChange={setVaultCategory}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="WORKING_PAPER">Working Papers</SelectItem>
                <SelectItem value="PLANNING">Planning</SelectItem>
                <SelectItem value="REPORTING">Reports & Letters</SelectItem>
                <SelectItem value="CONFIRMATION">Confirmations</SelectItem>
                <SelectItem value="COMPLETION">Completion</SelectItem>
                <SelectItem value="ISQM">ISQM Documents</SelectItem>
                <SelectItem value="ISQM_REFERENCE">ISQM Reference</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {catalogLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Library className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No templates found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([subCat, items]) => (
                <div key={subCat}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    {subCat}
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </h3>
                  <div className="grid gap-2">
                    {items.sort((a, b) => a.reference.localeCompare(b.reference)).map(template => (
                      <div
                        key={template.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex-shrink-0">{fileIcon(template.fileType)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{template.reference}</span>
                            <span className="font-medium text-sm truncate">{template.title}</span>
                            {template.prefillCapable && (
                              <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400">Prefill</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {template.isaParagraph && (
                            <Badge variant="outline" className="text-[10px] hidden lg:inline-flex">{template.isaParagraph}</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] hidden md:inline-flex">
                            {MODULE_LABELS[template.linkedModule] || template.linkedModule}
                          </Badge>
                          <Badge className={`text-[10px] ${CATEGORY_COLORS[template.category] || ""}`}>
                            {CATEGORY_LABELS[template.category] || template.category}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] uppercase">{template.fileType}</Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setPreviewTemplate(template)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                disabled={downloading === template.id}
                                onClick={() => handleDownload(template)}
                              >
                                {downloading === template.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FileDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download template</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTemplate && fileIcon(previewTemplate.fileType)}
              {previewTemplate?.title}
            </DialogTitle>
            <DialogDescription>{previewTemplate?.reference}</DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{previewTemplate.description}</p>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <Badge className={`ml-2 text-[10px] ${CATEGORY_COLORS[previewTemplate.category] || ""}`}>
                    {CATEGORY_LABELS[previewTemplate.category] || previewTemplate.category}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Phase:</span>
                  <span className="ml-2 font-medium">{previewTemplate.phase}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Module:</span>
                  <span className="ml-2 font-medium">{MODULE_LABELS[previewTemplate.linkedModule] || previewTemplate.linkedModule}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">File Type:</span>
                  <span className="ml-2 font-medium uppercase">{previewTemplate.fileType}</span>
                </div>
                {previewTemplate.isaParagraph && (
                  <div>
                    <span className="text-muted-foreground">ISA Reference:</span>
                    <span className="ml-2 font-medium">{previewTemplate.isaParagraph}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Source:</span>
                  <span className="ml-2 font-medium text-xs">{previewTemplate.sourceZip}</span>
                </div>
                {previewData?.preview.type === "file" && previewData.preview.fileSize ? (
                  <div>
                    <span className="text-muted-foreground">File Size:</span>
                    <span className="ml-2 font-medium">{(previewData.preview.fileSize / 1024).toFixed(1)} KB</span>
                  </div>
                ) : null}
                {previewData?.preview.type === "generated" && previewData.preview.sheets ? (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Sheets:</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {previewData.preview.sheets.map(s => (
                        <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewTemplate.fsLineItems.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">FS Line Items:</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {previewTemplate.fsLineItems.map(fs => (
                        <Badge key={fs} variant="outline" className="text-[10px]">{fs}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {previewTemplate.prefillCapable && previewTemplate.prefillFields.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Prefill Fields:</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {previewTemplate.prefillFields.map(f => (
                        <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloading === previewTemplate.id}
                  onClick={() => handleDownload(previewTemplate)}
                >
                  {downloading === previewTemplate.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                  Download Blank
                </Button>
                {previewTemplate.prefillCapable && (
                  <Button
                    size="sm"
                    disabled={downloading === `prefill-${previewTemplate.id}`}
                    onClick={() => handlePrefilledDownload(previewTemplate)}
                  >
                    {downloading === `prefill-${previewTemplate.id}` ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Download Prefilled
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function EvidenceVault() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterPermanence, setFilterPermanence] = useState<string>("all");
  const [linkingDialogOpen, setLinkingDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [linkedOutputsDialogOpen, setLinkedOutputsDialogOpen] = useState(false);
  const [selectedEvidenceForOutputs, setSelectedEvidenceForOutputs] = useState<string | null>(null);

  interface DocumentChecklistRow {
    id: string;
    description: string;
    response: string;
    remarks: string;
    attachments: File[];
    isCustom: boolean;
  }

  const [documentChecklistRows, setDocumentChecklistRows] = useState<DocumentChecklistRow[]>([
    // Entity & Registration Documents
    { id: "doc-1", description: "Memorandum & Articles of Association obtained with all amendments", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-2", description: "Certificate of Incorporation obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-3", description: "NTN/STRN Certificates obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-4", description: "Form 29, Form A, Form 38 (latest SECP filings) obtained", response: "", remarks: "", attachments: [], isCustom: false },
    // Governance & Management Documents
    { id: "doc-5", description: "Organizational Chart obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-6", description: "List of Directors and Key Management obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-7", description: "Form A (List of Directors) obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-8", description: "Directors' CVs and Declarations obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-9", description: "Board Committee Compositions obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-10", description: "Shareholding Pattern & Changes documentation obtained", response: "", remarks: "", attachments: [], isCustom: false },
    // Minutes & Meetings
    { id: "doc-11", description: "Board Minutes for current year obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-12", description: "Audit Committee Minutes for current year obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-13", description: "AGM Minutes for previous year obtained", response: "", remarks: "", attachments: [], isCustom: false },
    // Financial & Tax Documents
    { id: "doc-14", description: "Previous 3 years audited financial statements obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-15", description: "Tax returns and assessment orders obtained", response: "", remarks: "", attachments: [], isCustom: false },
    // Client Acceptance Documents
    { id: "doc-16", description: "Predecessor Auditor Communication obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-17", description: "Initial Risk Assessment Memorandum prepared", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-18", description: "Internal Consultation Notes documented", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-19", description: "Signed Client Acceptance Form obtained", response: "", remarks: "", attachments: [], isCustom: false },
    // Due Diligence Documents
    { id: "doc-20", description: "Bank Confirmation Requests prepared", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-21", description: "Professional Advisors List obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-22", description: "Group Structure Chart obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-23", description: "Major Supply/Customer Contracts obtained", response: "", remarks: "", attachments: [], isCustom: false },
    // Policies & Compliance
    { id: "doc-24", description: "Code of Conduct, Whistleblower and Anti-Fraud policies obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-25", description: "All statutory documents verified for authenticity", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-26", description: "Management representation on document completeness obtained", response: "", remarks: "", attachments: [], isCustom: false },
  ]);

  const addChecklistRow = () => {
    const newRow: DocumentChecklistRow = {
      id: `doc-custom-${Date.now()}`,
      description: "",
      response: "",
      remarks: "",
      attachments: [],
      isCustom: true,
    };
    setDocumentChecklistRows(prev => [...prev, newRow]);
  };

  const updateChecklistRow = (id: string, field: keyof DocumentChecklistRow, value: any) => {
    setDocumentChecklistRows(rows => rows.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleChecklistFileUpload = (rowId: string, files: FileList | null) => {
    if (!files) return;
    const currentRow = documentChecklistRows.find(r => r.id === rowId);
    const existingFiles = currentRow?.attachments || [];
    updateChecklistRow(rowId, "attachments", [...existingFiles, ...Array.from(files)]);
  };

  const deleteChecklistRow = (id: string) => {
    setDocumentChecklistRows(rows => rows.filter(row => row.id !== id));
  };

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("documents");

  const isChecklistRowComplete = (row: DocumentChecklistRow): boolean => {
    if (row.isCustom && row.description.trim() === "") return false;
    if (row.response === "") return false;
    if (row.response === "No" && row.remarks.trim() === "") return false;
    return true;
  };

  const checklistIncompleteCount = documentChecklistRows.filter(r => !isChecklistRowComplete(r)).length;

  const getDefaultChecklistRows = (): DocumentChecklistRow[] => [
    { id: "doc-1", description: "Memorandum & Articles of Association obtained with all amendments", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-2", description: "Certificate of Incorporation obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-3", description: "NTN/STRN Certificates obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-4", description: "Form 29, Form A, Form 38 (latest SECP filings) obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-5", description: "Organizational Chart obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-6", description: "List of Directors and Key Management obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-7", description: "Form A (List of Directors) obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-8", description: "Directors' CVs and Declarations obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-9", description: "Board Committee Compositions obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-10", description: "Shareholding Pattern & Changes documentation obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-11", description: "Board Minutes for current year obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-12", description: "Audit Committee Minutes for current year obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-13", description: "AGM Minutes for previous year obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-14", description: "Previous 3 years audited financial statements obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-15", description: "Tax returns and assessment orders obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-16", description: "Predecessor Auditor Communication obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-17", description: "Initial Risk Assessment Memorandum prepared", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-18", description: "Internal Consultation Notes documented", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-19", description: "Signed Client Acceptance Form obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-20", description: "Bank Confirmation Requests prepared", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-21", description: "Professional Advisors List obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-22", description: "Group Structure Chart obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-23", description: "Major Supply/Customer Contracts obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-24", description: "Code of Conduct, Whistleblower and Anti-Fraud policies obtained", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-25", description: "All statutory documents verified for authenticity", response: "", remarks: "", attachments: [], isCustom: false },
    { id: "doc-26", description: "Management representation on document completeness obtained", response: "", remarks: "", attachments: [], isCustom: false },
  ];

  useEffect(() => {
    const loadDocumentChecklist = async () => {
      if (!engagementId) return;
      setDocumentChecklistRows(getDefaultChecklistRows());
      try {
        const response = await fetchWithAuth(`/api/workspace/${engagementId}/evidence`);
        if (response.ok) {
          const result = await response.json();
          if (result.data?.documentChecklist?.rows && result.data.documentChecklist.rows.length > 0) {
            const savedRows: DocumentChecklistRow[] = result.data.documentChecklist.rows;
            const defaultRows = getDefaultChecklistRows();
            const savedIds = new Set(savedRows.map(r => r.id));
            const newDefaultRows = defaultRows.filter(r => !savedIds.has(r.id));
            const mergedRows = [...savedRows, ...newDefaultRows];
            setDocumentChecklistRows(mergedRows);
          }
        }
      } catch (error) {
        console.error("Failed to load document checklist:", error);
      }
    };
    loadDocumentChecklist();
  }, [engagementId]);

  const saveDocumentChecklist = async () => {
    if (!engagementId) return;
    setChecklistSaving(true);
    try {
      const loadResponse = await fetchWithAuth(`/api/workspace/${engagementId}/evidence`);
      let existingData = {};
      if (loadResponse.ok) {
        const result = await loadResponse.json();
        if (result.data) existingData = result.data;
      }

      const response = await apiRequest("PUT", `/api/workspace/${engagementId}/evidence`, {
        ...existingData,
        documentChecklist: { rows: documentChecklistRows }
      });

      if (response.ok) {
        toast({ title: "Saved", description: "Document checklist saved successfully" });
      } else {
        throw new Error("Save failed");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast({ 
        title: "Error", 
        description: "Failed to save document checklist",
        variant: "destructive"
      });
    } finally {
      setChecklistSaving(false);
    }
  };

  const saveEngine = useEvidenceSaveBridge(engagementId, () => ({ filterPhase, filterPermanence }));

  const { data, isLoading, error } = useQuery<{ attachments: Attachment[]; stats: AttachmentStats }>({
    queryKey: ['/api/evidence', engagementId, 'all-attachments'],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/evidence/${engagementId}/all-attachments`);
      if (!res.ok) throw new Error("Failed to fetch attachments");
      return res.json();
    },
    enabled: !!engagementId,
  });

  const updatePermanenceMutation = useMutation({
    mutationFn: async ({ attachmentId, source, isPermanent }: { attachmentId: string; source: "TAB" | "REQUEST"; isPermanent: boolean }) => {
      const endpoint = source === "TAB" 
        ? `/api/evidence/${engagementId}/tab-attachments/${attachmentId}/permanence`
        : `/api/evidence/${engagementId}/request-attachments/${attachmentId}/permanence`;
      return apiRequest("PATCH", endpoint, { isPermanent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evidence', engagementId, 'all-attachments'] });
      toast({
        title: "Document classification updated",
        description: "The document has been reclassified successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document classification",
        variant: "destructive",
      });
    },
  });

  const { data: crossPhaseLinks } = useQuery<CrossPhaseLinksSummary>({
    queryKey: ['/api/evidence', engagementId, 'cross-phase-links'],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/evidence/${engagementId}/cross-phase-links`);
      if (!res.ok) {
        return { risks: [], tests: [], misstatements: [], totalLinkedEvidence: 0 };
      }
      return res.json();
    },
    enabled: !!engagementId,
  });

  const { data: linkedOutputsData = [] } = useQuery<LinkedOutput[]>({
    queryKey: ['/api/engagements', engagementId, 'evidence', selectedEvidenceForOutputs, 'linked-outputs'],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}/evidence/${selectedEvidenceForOutputs}/linked-outputs`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!engagementId && !!selectedEvidenceForOutputs && linkedOutputsDialogOpen,
  });

  const attachments = data?.attachments || [];
  const stats = data?.stats || { total: 0, permanent: 0, yearly: 0, documents: 0, images: 0, totalSize: 0 };
  const links = crossPhaseLinks || { risks: [], tests: [], misstatements: [], totalLinkedEvidence: 0 };

  const filteredAttachments = attachments.filter(a => {
    const matchesSearch = !searchTerm || 
      a.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.tabType?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPhase = filterPhase === "all" || a.phase === filterPhase;
    
    const matchesPermanence = filterPermanence === "all" || 
      (filterPermanence === "permanent" && a.isPermanent) ||
      (filterPermanence === "yearly" && !a.isPermanent);
    
    return matchesSearch && matchesPhase && matchesPermanence;
  });

  if (isLoading) {
    return <AgentsLoadingInline showDelay={1000} />;
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        Failed to load attachments. Please try again.
      </div>
    );
  }

  return (
    <PageShell
      title="Evidence Vault"
      subtitle={`${client?.name || "Select Client"}${engagement?.engagementCode ? ` (${engagement.engagementCode})` : ""}`}
      icon={<FolderOpen className="h-6 w-6 text-primary" />}
      useRegistry={true}
      backHref={`/workspace/${engagementId}/execution`}
      nextHref={`/workspace/${engagementId}/finalization`}
      dashboardHref="/engagements"
      saveFn={async () => {
        try {
          await saveEngine.saveFinal();
          return { ok: true };
        } catch (error) {
          return { ok: false, errors: error };
        }
      }}
      hasUnsavedChanges={saveEngine.isDirty}
      isSaving={saveEngine.isSaving}
      showBack={true}
      showSaveProgress={true}
      showSaveNext={true}
      showSaveClose={true}
    >
    <div className="w-full px-4 py-3 space-y-3">
      {engagementId && (
        <AIAssistBanner
          engagementId={engagementId}
          config={{
            ...PHASE_AI_CONFIGS.evidence,
            contextBuilder: () => JSON.stringify({
              phase: "evidence",
              engagementName: engagement?.engagementCode || "Unknown Engagement",
              clientName: client?.name || "Unknown Client",
              totalEvidence: stats.total,
              permanentDocs: stats.permanent,
              yearlyDocs: stats.yearly,
              linkedRisks: links.risks.length,
              linkedTests: links.tests.length,
            }),
            onActionComplete: (actionId, content) => {
              toast({
                title: "AI Content Generated",
                description: `${actionId} content has been generated. Apply it to relevant fields.`,
              });
            },
          }}
        />
      )}


      <Card data-testid="card-isa230-compliance">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-medium text-sm" data-testid="text-isa230-title">ISA 230 Documentation Requirements</p>
                {stats.total > 0 ? (
                  <Badge variant="default" className="text-xs" data-testid="badge-isa230-status">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    ISA 230 Compliant
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-isa230-status">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    ISA 230 — Documents Required
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-isa230-reference">
                ISA 230 requires sufficient and appropriate documentation of audit procedures performed
              </p>
              <div className="flex items-center gap-4 pt-1 flex-wrap">
                <span className="text-xs" data-testid="text-isa230-total">
                  <span className="font-medium">{stats.total}</span> Total Documents
                </span>
                <span className="text-xs" data-testid="text-isa230-permanent">
                  <Archive className="h-3 w-3 inline mr-0.5" />
                  <span className="font-medium">{stats.permanent}</span> Permanent File
                </span>
                <span className="text-xs" data-testid="text-isa230-yearly">
                  <Calendar className="h-3 w-3 inline mr-0.5" />
                  <span className="font-medium">{stats.yearly}</span> Current Year
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList data-testid="tabs-evidence-vault">
          <TabsTrigger value="documents" data-testid="tab-documents">
            <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
            Document Checklist
          </TabsTrigger>
          <TabsTrigger value="evidence-index" data-testid="tab-evidence-index">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
            Evidence Index
          </TabsTrigger>
          <TabsTrigger value="audit-trail" data-testid="tab-audit-trail">
            <History className="h-3.5 w-3.5 mr-1" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="template-library" data-testid="tab-template-library">
            <Library className="h-3.5 w-3.5 mr-1" />
            Template Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-base font-semibold">Evidence & Document Checklist</CardTitle>
                <CardDescription className="text-sm">
                  Collect, verify, and manage audit evidence per Companies Act 2017, ISA 500, ISA 230
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-xs">
                <Archive className="h-3 w-3 mr-1" />
                Permanent: {stats.permanent}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                For Period: {stats.yearly}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3 pb-2 border-b">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search documents..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-evidence"
              />
            </div>
            <Select value={filterPermanence} onValueChange={setFilterPermanence}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-permanence">
                <SelectValue placeholder="All Classifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classifications</SelectItem>
                <SelectItem value="permanent">Permanent Only</SelectItem>
                <SelectItem value="yearly">For the Period Only</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Cross-Phase Links:</span>
              <Link href={`/workspace/${engagementId}/planning?tab=risk`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-link-risks">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Risks ({links.risks.length})
                </Button>
              </Link>
              <Link href={`/workspace/${engagementId}/execution?tab=substantive`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-link-procedures">
                  <ClipboardCheck className="h-3 w-3 mr-1" />
                  Procedures ({links.tests.length})
                </Button>
              </Link>
              <Link href={`/workspace/${engagementId}/finalization?tab=misstatements`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-link-misstatements">
                  <Target className="h-3 w-3 mr-1" />
                  Misstatements ({links.misstatements.length})
                </Button>
              </Link>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">Sr.</TableHead>
                <TableHead className="w-[40%]">Description / Requirement</TableHead>
                <TableHead className="w-[25%]">Remarks</TableHead>
                <TableHead className="w-[50px] text-center">Attach</TableHead>
                <TableHead className="w-[50px] text-center">View</TableHead>
                <TableHead className="w-[60px] text-center">Permanent</TableHead>
                <TableHead className="w-[60px] text-center">For Period</TableHead>
                <TableHead className="w-[90px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentChecklistRows
                .filter(row => {
                  if (!searchTerm) return true;
                  return row.description.toLowerCase().includes(searchTerm.toLowerCase());
                })
                .map((row, idx) => {
                const fileInputId = `file-input-${row.id}`;
                return (
                <TableRow key={row.id} className={row.isCustom ? "bg-blue-50/30 dark:bg-blue-950/20" : ""} data-testid={`row-checklist-${row.id}`}>
                  <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                  <TableCell>
                    {row.isCustom ? (
                      <Input
                        value={row.description}
                        onChange={e => updateChecklistRow(row.id, "description", e.target.value)}
                        placeholder="Enter document description..."
                        className="text-sm"
                        data-testid={`input-description-${row.id}`}
                      />
                    ) : (
                      <span className="text-sm">{row.description}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={row.remarks}
                      onChange={e => updateChecklistRow(row.id, "remarks", e.target.value)}
                      placeholder="Enter remarks..."
                      className="text-sm min-h-[60px] resize-y"
                      rows={2}
                      data-testid={`input-remarks-${row.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input 
                      type="file" 
                      id={fileInputId}
                      multiple 
                      onChange={e => handleChecklistFileUpload(row.id, e.target.files)} 
                      className="hidden"
                      data-testid={`input-file-${row.id}`}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => document.getElementById(fileInputId)?.click()}
                          data-testid={`button-upload-${row.id}`}
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.attachments.length > 0 ? `${row.attachments.length} file(s)` : "Upload"}
                      </TooltipContent>
                    </Tooltip>
                    {row.attachments.length > 0 && (
                      <Badge variant="secondary" className="ml-0.5 text-[10px] h-4 px-1">{row.attachments.length}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.attachments.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              row.attachments.forEach(file => window.open(URL.createObjectURL(file), "_blank"));
                            }}
                            data-testid={`button-view-${row.id}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View {row.attachments.length} file(s)</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled>
                        <Eye className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      size="sm"
                      variant={row.response === "permanent" ? "default" : "ghost"}
                      className="h-7 w-7 p-0"
                      onClick={() => updateChecklistRow(row.id, "response", "permanent")}
                      data-testid={`button-permanent-${row.id}`}
                    >
                      {row.response === "permanent" ? <Check className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      size="sm"
                      variant={row.response === "yearly" ? "default" : "ghost"}
                      className="h-7 w-7 p-0"
                      onClick={() => updateChecklistRow(row.id, "response", "yearly")}
                      data-testid={`button-period-${row.id}`}
                    >
                      {row.response === "yearly" ? <Check className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingRowId(row.id)}
                            data-testid={`button-edit-row-${row.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-primary"
                            onClick={() => {
                              toast({ title: "Row saved", description: "Changes saved locally." });
                            }}
                            data-testid={`button-save-row-${row.id}`}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteChecklistRow(row.id)}
                            data-testid={`button-delete-row-${row.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={addChecklistRow} data-testid="button-add-checklist-row">
              <Plus className="h-4 w-4 mr-1" />
              Add Line
            </Button>
            <Button onClick={saveDocumentChecklist} disabled={checklistSaving} data-testid="button-save-checklist">
              {checklistSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Checklist
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="evidence-index">
      <Card>
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 flex-shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-base font-semibold">Evidence Index</CardTitle>
                <CardDescription className="text-sm">
                  Complete index of all evidence files with metadata, ISA references, and linkages
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-upload-evidence">
                    <Upload className="h-4 w-4 mr-1" />
                    Upload Evidence
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Evidence</DialogTitle>
                    <DialogDescription>
                      Upload new evidence files to the vault with ISA reference and FS head linkage
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Evidence File</Label>
                      <Input type="file" data-testid="input-evidence-file" />
                    </div>
                    <div className="space-y-2">
                      <Label>ISA Reference</Label>
                      <Select>
                        <SelectTrigger data-testid="select-isa-reference">
                          <SelectValue placeholder="Select ISA reference" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ISA-200">ISA 200 - Overall Objectives</SelectItem>
                          <SelectItem value="ISA-230">ISA 230 - Documentation</SelectItem>
                          <SelectItem value="ISA-240">ISA 240 - Fraud</SelectItem>
                          <SelectItem value="ISA-265">ISA 265 - Control Deficiencies</SelectItem>
                          <SelectItem value="ISA-315">ISA 315 - Risk Assessment</SelectItem>
                          <SelectItem value="ISA-330">ISA 330 - Responses to Assessed Risks</SelectItem>
                          <SelectItem value="ISA-500">ISA 500 - Audit Evidence</SelectItem>
                          <SelectItem value="ISA-505">ISA 505 - External Confirmations</SelectItem>
                          <SelectItem value="ISA-520">ISA 520 - Analytical Procedures</SelectItem>
                          <SelectItem value="ISA-540">ISA 540 - Accounting Estimates</SelectItem>
                          <SelectItem value="ISA-550">ISA 550 - Related Parties</SelectItem>
                          <SelectItem value="ISA-560">ISA 560 - Subsequent Events</SelectItem>
                          <SelectItem value="ISA-580">ISA 580 - Written Representations</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Link to FS Head</Label>
                      <Select>
                        <SelectTrigger data-testid="select-fs-head-link">
                          <SelectValue placeholder="Select FS Head (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash & Bank</SelectItem>
                          <SelectItem value="receivables">Trade Receivables</SelectItem>
                          <SelectItem value="inventory">Inventory</SelectItem>
                          <SelectItem value="ppe">Property, Plant & Equipment</SelectItem>
                          <SelectItem value="payables">Trade Payables</SelectItem>
                          <SelectItem value="revenue">Revenue</SelectItem>
                          <SelectItem value="expenses">Operating Expenses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea placeholder="Brief description of the evidence..." data-testid="input-evidence-description" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" data-testid="button-cancel-upload-evidence">Cancel</Button>
                    <Button data-testid="button-upload-evidence-submit">Upload</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  toast({ title: "Bulk Download", description: "Preparing evidence package for download..." });
                }}
                data-testid="button-bulk-download"
                disabled={attachments.length === 0}
                title={attachments.length === 0 ? "No evidence files to download" : "Download all evidence files as a package"}
              >
                <Package className="h-4 w-4 mr-1" />
                Bulk Download
              </Button>
              <Button 
                size="sm"
                onClick={() => {
                  toast({ title: "Generating Summary", description: "AI is generating evidence summary report..." });
                }}
                data-testid="button-generate-summary"
                disabled={attachments.length === 0}
                title={attachments.length === 0 ? "No evidence files to summarize" : "Generate AI-powered evidence summary report"}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Generate Evidence Summary
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3 pb-4 border-b">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search all evidence..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-evidence-index"
              />
            </div>
            <Select value={filterPhase} onValueChange={setFilterPhase}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-phase">
                <SelectValue placeholder="All Phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                <SelectItem value="REQUISITION">Data Intake</SelectItem>
                <SelectItem value="PRE_PLANNING">Pre-Planning</SelectItem>
                <SelectItem value="PLANNING">Planning</SelectItem>
                <SelectItem value="EXECUTION">Execution</SelectItem>
                <SelectItem value="FINALIZATION">Finalization</SelectItem>
                <SelectItem value="EQCR">EQCR</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPermanence} onValueChange={setFilterPermanence}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="yearly">For the Period</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              {filteredAttachments.length} of {attachments.length} files
            </Badge>
          </div>

          {filteredAttachments.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium tracking-tight mb-2">No Evidence Files Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Evidence files will appear here as they are uploaded across engagement phases.
              </p>
            </div>
          ) : (
            <Table data-testid="table-evidence-index">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>ISA Ref</TableHead>
                  <TableHead>FS Head Link</TableHead>
                  <TableHead>Linked Outputs</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttachments.map((attachment, idx) => (
                  <TableRow key={attachment.id} data-testid={`row-evidence-${attachment.id}`}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(attachment.fileType)}
                        <div>
                          <p className="font-medium text-sm">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={attachment.isPermanent ? "default" : "secondary"} className="text-xs">
                        {attachment.isPermanent ? "Permanent" : "For Period"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getPhaseLabel(attachment.phase)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {attachment.workpaperRef || "ISA 500"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {attachment.tabSection || attachment.tabType || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setSelectedEvidenceForOutputs(attachment.id);
                          setLinkedOutputsDialogOpen(true);
                        }}
                        data-testid={`button-view-linked-outputs-${attachment.id}`}
                      >
                        <FileOutput className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(attachment.uploadedAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5" data-testid={`text-uploaded-by-${attachment.id}`}>
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs">
                          {attachment.uploadedBy?.fullName || attachment.uploadedByContact?.name || "-"}
                        </span>
                        {attachment.uploadedBy && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1" data-testid={`badge-verified-${attachment.id}`}>
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0"
                              onClick={() => window.open(attachment.filePath, "_blank")}
                              data-testid={`button-view-evidence-${attachment.id}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = attachment.filePath;
                                link.download = attachment.fileName;
                                link.click();
                              }}
                              data-testid={`button-download-evidence-${attachment.id}`}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setSelectedAttachment(attachment);
                                setLinkingDialogOpen(true);
                              }}
                              data-testid={`button-link-evidence-${attachment.id}`}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Link to FS Head/Procedure</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={linkingDialogOpen} onOpenChange={setLinkingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Evidence to FS Head / Procedure</DialogTitle>
            <DialogDescription>
              Connect this evidence file to specific FS heads and audit procedures for traceability
            </DialogDescription>
          </DialogHeader>
          {selectedAttachment && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedAttachment.fileType)}
                  <div>
                    <p className="font-medium text-sm">{selectedAttachment.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {getPhaseLabel(selectedAttachment.phase)} • {formatFileSize(selectedAttachment.fileSize)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link to FS Head</Label>
                <Select>
                  <SelectTrigger data-testid="select-link-fs-head">
                    <SelectValue placeholder="Select FS Head" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash & Bank</SelectItem>
                    <SelectItem value="receivables">Trade Receivables</SelectItem>
                    <SelectItem value="inventory">Inventory</SelectItem>
                    <SelectItem value="ppe">Property, Plant & Equipment</SelectItem>
                    <SelectItem value="payables">Trade Payables</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="expenses">Operating Expenses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Link to Audit Procedure</Label>
                <Select>
                  <SelectTrigger data-testid="select-link-procedure">
                    <SelectValue placeholder="Select Procedure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AR-01">AR-01: Bank Confirmation</SelectItem>
                    <SelectItem value="AR-02">AR-02: Cutoff Testing</SelectItem>
                    <SelectItem value="AR-03">AR-03: Sample Selection</SelectItem>
                    <SelectItem value="AR-04">AR-04: Subsequent Receipts</SelectItem>
                    <SelectItem value="INV-01">INV-01: Stock Count Observation</SelectItem>
                    <SelectItem value="PPE-01">PPE-01: Additions Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Link to Risk</Label>
                <Select>
                  <SelectTrigger data-testid="select-link-risk">
                    <SelectValue placeholder="Select Assessed Risk (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {links.risks.map(risk => (
                      <SelectItem key={risk.id} value={risk.id}>
                        {risk.accountOrClass} - {risk.assertion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkingDialogOpen(false)} data-testid="button-cancel-linking">Cancel</Button>
            <Button 
              onClick={() => {
                toast({ title: "Links Saved", description: "Evidence has been linked successfully." });
                setLinkingDialogOpen(false);
              }}
              data-testid="button-save-links"
            >
              Save Links
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkedOutputsDialogOpen} onOpenChange={setLinkedOutputsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileOutput className="h-5 w-5" />
              Linked Outputs
            </DialogTitle>
            <DialogDescription>
              Outputs that reference this evidence file
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            {linkedOutputsData.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <FileOutput className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No outputs are currently linked to this evidence file.</p>
                <p className="text-xs mt-1">Link outputs from the Outputs Registry page.</p>
              </div>
            ) : (
              <div className="divide-y">
                {linkedOutputsData.map((link) => (
                  <div key={link.id} className="py-3 px-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{link.output.outputCode}</p>
                          <p className="text-xs text-muted-foreground truncate">{link.output.outputName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{link.output.phase.replace(/_/g, " ")}</Badge>
                            <Badge variant={link.output.status === "Approved" || link.output.status === "Final" ? "default" : "secondary"} className="text-xs">
                              {link.output.status}
                            </Badge>
                            {link.output.isDeliverable && (
                              <Badge variant="outline" className="text-xs border-green-500 text-green-600">Deliverable</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 ml-6">
                      <span className="text-xs text-muted-foreground">
                        Linked {new Date(link.linkedAt).toLocaleDateString()}
                        {link.linkedBy && ` by ${link.linkedBy.fullName}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkedOutputsDialogOpen(false)} data-testid="button-close-linked-outputs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>

        <TabsContent value="audit-trail">
      <Card data-testid="card-audit-trail">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex-shrink-0">
              <History className="h-5 w-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base font-semibold">Audit Trail</CardTitle>
              <CardDescription className="text-sm">
                Chronological record of all document actions for ISA 230 compliance
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {(() => {
            const documented = attachments.filter(a => a.description && a.description.trim().length > 0).length;
            const total = attachments.length;
            const completenessPercent = total > 0 ? Math.round((documented / total) * 100) : 0;

            const uploadCount = attachments.length;
            const downloadCount = 0;
            const linkCount = links.totalLinkedEvidence || 0;
            const viewCount = 0;
            const deleteCount = 0;

            return (
              <>
                <div className="rounded-md border p-3 bg-muted/20" data-testid="text-isa230-score">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium">ISA 230 Documentation Completeness</span>
                    </div>
                    <Badge variant={completenessPercent >= 80 ? "default" : completenessPercent >= 50 ? "secondary" : "destructive"} className="text-xs">
                      {completenessPercent}%
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        completenessPercent >= 80 ? "bg-emerald-500" : completenessPercent >= 50 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${completenessPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {documented} of {total} attachments have descriptions documented ({completenessPercent}% completeness)
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="audit-trail-stats">
                  <div className="flex items-center gap-2 rounded-md border p-2.5" data-testid="stat-uploads">
                    <ArrowUpCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-semibold leading-none" data-testid="text-upload-count">{uploadCount}</p>
                      <p className="text-xs text-muted-foreground">Uploads</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border p-2.5" data-testid="stat-downloads">
                    <ArrowDownCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-semibold leading-none" data-testid="text-download-count">{downloadCount}</p>
                      <p className="text-xs text-muted-foreground">Downloads</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border p-2.5" data-testid="stat-links">
                    <Link2 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <div>
                      <p className="text-lg font-semibold leading-none" data-testid="text-link-count">{linkCount}</p>
                      <p className="text-xs text-muted-foreground">Links</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border p-2.5" data-testid="stat-views">
                    <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-lg font-semibold leading-none" data-testid="text-view-count">{viewCount}</p>
                      <p className="text-xs text-muted-foreground">Views</p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {attachments.length === 0 ? (
            <div className="text-center py-12" data-testid="text-audit-trail-empty">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium tracking-tight mb-2">No Audit Trail Entries</h3>
              <p className="text-sm text-muted-foreground">
                Document actions will appear here as evidence is uploaded across engagement phases.
              </p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="audit-trail-entries">
              {(() => {
                const sorted = [...attachments].sort(
                  (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
                );
                const grouped: Record<string, Attachment[]> = {};
                sorted.forEach((att) => {
                  const dateKey = new Date(att.uploadedAt).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
                  if (!grouped[dateKey]) grouped[dateKey] = [];
                  grouped[dateKey].push(att);
                });
                return Object.entries(grouped).map(([dateLabel, items]) => (
                  <div key={dateLabel} data-testid={`audit-trail-group-${dateLabel}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">{dateLabel}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{items.length}</Badge>
                    </div>
                    <div className="ml-5 border-l-2 border-border pl-4 space-y-2">
                      {items.map((att) => {
                        const actionType = "upload" as "upload" | "download" | "link" | "view" | "delete";
                        const actionConfig = {
                          upload: { icon: <ArrowUpCircle className="h-4 w-4 text-emerald-500" />, label: "Upload", badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
                          download: { icon: <ArrowDownCircle className="h-4 w-4 text-blue-500" />, label: "Download", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                          link: { icon: <Link2 className="h-4 w-4 text-purple-500" />, label: "Link", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
                          view: { icon: <Eye className="h-4 w-4 text-muted-foreground" />, label: "View", badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300" },
                          delete: { icon: <Trash2 className="h-4 w-4 text-red-500" />, label: "Delete", badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
                        };
                        const config = actionConfig[actionType];

                        return (
                          <div
                            key={att.id}
                            className="flex items-start gap-2 py-1.5"
                            data-testid={`audit-trail-entry-${att.id}`}
                          >
                            {config.icon}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">
                                <span className="text-muted-foreground">Uploaded by </span>
                                <span className="font-medium">
                                  {att.uploadedBy?.fullName || att.uploadedByContact?.name || "Unknown"}
                                </span>
                                <span className="text-muted-foreground"> on </span>
                                <span className="font-medium">
                                  {new Date(att.uploadedAt).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span className="text-muted-foreground"> — </span>
                                <span className="font-medium">{att.fileName}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${config.badgeClass}`}>
                                  {config.label}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                  {getPhaseLabel(att.phase)}
                                </Badge>
                                <Badge
                                  variant={att.isPermanent ? "default" : "secondary"}
                                  className="text-[10px] h-4 px-1.5"
                                >
                                  {att.isPermanent ? "Permanent" : "For Period"}
                                </Badge>
                                {att.uploadedBy && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="template-library">
          <TemplateLibraryTab />
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Archive className="h-5 w-5 text-purple-500 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">About Document Classification</p>
              <p className="text-sm text-muted-foreground">
                <strong>Permanent documents</strong> are linked to the client's master file and carry forward to future engagements. 
                Examples include incorporation documents, agreements, and organizational charts.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>For the Year documents</strong> are specific to this engagement period and include trial balances, 
                bank confirmations, and period-specific correspondence.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </PageShell>
  );
}
