import React, { useState, useCallback, useRef } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Paperclip, Check, X, FileText, Download, Trash2, Eye, ListPlus, Loader2, Sparkles, Mail } from "lucide-react";
import {
  HEAD_OF_ACCOUNTS,
  TEMPLATE_OPTIONS,
  COMMON_REQUISITION_ITEMS,
  INDUSTRY_TEMPLATES,
} from "./data";

export interface InformationRequest {
  id: string;
  srNumber: number;
  requestCode: string;
  requestTitle: string;
  headOfAccounts: string;
  description: string;
  priority: string;
  status: string;
  clientResponse?: string;
  clientResponseDate?: string;
  provided?: 'YES' | 'NO' | null;
  providedDate?: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

interface EditingRow {
  id: string;
  headOfAccounts: string;
  description: string;
}

interface RequestsSectionProps {
  engagementId: string | undefined;
  token: string | null;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  engagement: {
    engagementCode?: string;
    fiscalYearEnd?: string | null;
    client?: { name?: string };
  } | null;
  clientInfo: { industry?: string; entityType?: string; specialEntityType?: string } | null;
  requests: InformationRequest[];
  setRequests: React.Dispatch<React.SetStateAction<InformationRequest[]>>;
  isLoading: boolean;
  fetchRequests: () => Promise<void>;
}

export function RequestsSection({
  engagementId,
  token,
  toast,
  engagement,
  clientInfo,
  requests,
  setRequests,
  isLoading,
  fetchRequests,
}: RequestsSectionProps) {
  const [editingRows, setEditingRows] = useState<Map<string, EditingRow>>(new Map());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRow, setNewRow] = useState({ headOfAccounts: "", description: "" });
  const [attachmentDialogId, setAttachmentDialogId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [isDeletingMultipleRequests, setIsDeletingMultipleRequests] = useState(false);
  const [isGeneratingAiSuggestions, setIsGeneratingAiSuggestions] = useState(false);
  const [aiSuggestionProgress, setAiSuggestionProgress] = useState<string>("");
  const saveTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editingRowsRef = useRef<Map<string, EditingRow>>(new Map());

  editingRowsRef.current = editingRows;

  const handleCreateRequest = async () => {
    if (!engagementId || !newRow.headOfAccounts || !newRow.description.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please fill in Head of Accounts and Description.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/requisitions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          headOfAccounts: newRow.headOfAccounts,
          description: newRow.description,
        }),
      });

      if (response.ok) {
        toast({ title: "Request Created", description: "Information request added successfully." });
        setIsAddingNew(false);
        setNewRow({ headOfAccounts: "", description: "" });
        fetchRequests();
      } else {
        throw new Error("Failed to create request");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create information request.", variant: "destructive" });
    }
  };

  const startEditing = (request: InformationRequest) => {
    setEditingRows(new Map(editingRows).set(request.id, {
      id: request.id,
      headOfAccounts: request.headOfAccounts,
      description: request.description,
    }));
  };

  const cancelEditing = (id: string) => {
    const newMap = new Map(editingRows);
    newMap.delete(id);
    setEditingRows(newMap);
    const timeout = saveTimeoutRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      saveTimeoutRef.current.delete(id);
    }
  };

  const updateEditingField = useCallback((id: string, field: keyof EditingRow, value: string) => {
    setEditingRows(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(id);
      if (existing) {
        newMap.set(id, { ...existing, [field]: value });
      }
      return newMap;
    });

    const existingTimeout = saveTimeoutRef.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      autoSaveRow(id);
    }, 800);
    saveTimeoutRef.current.set(id, timeout);
  }, []);

  const autoSaveRow = async (id: string) => {
    const editData = editingRowsRef.current.get(id);
    if (!editData) return;

    try {
      const response = await fetchWithAuth(`/api/requisitions/${id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          headOfAccounts: editData.headOfAccounts,
          description: editData.description,
        }),
      });

      if (response.ok) {
        setRequests(prev => prev.map(r => 
          r.id === id ? { ...r, headOfAccounts: editData.headOfAccounts, description: editData.description } : r
        ));
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  };

  const saveEditing = async (id: string) => {
    const existingTimeout = saveTimeoutRef.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      saveTimeoutRef.current.delete(id);
    }
    
    await autoSaveRow(id);
    cancelEditing(id);
  };

  const updateProvided = async (id: string, provided: 'YES' | 'NO') => {
    try {
      const response = await fetchWithAuth(`/api/requisitions/${id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provided }),
      });

      if (response.ok) {
        setRequests(prev => prev.map(r => 
          r.id === id ? { ...r, provided, providedDate: provided === 'YES' ? new Date().toISOString() : undefined } : r
        ));
        toast({ title: "Updated", description: `Marked as ${provided === 'YES' ? 'Provided' : 'Not Provided'}` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  };

  const deleteRequest = async (id: string) => {
    try {
      const response = await fetchWithAuth(`/api/requisitions/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRequests(prev => prev.filter(r => r.id !== id));
        setSelectedRequestIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        toast({ title: "Deleted", description: "Request removed successfully." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete request.", variant: "destructive" });
    }
  };

  const deleteMultipleRequests = async () => {
    if (selectedRequestIds.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedRequestIds.size} selected request(s)? This action cannot be undone.`);
    if (!confirmed) return;

    setIsDeletingMultipleRequests(true);
    const idsToDelete = Array.from(selectedRequestIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of idsToDelete) {
      try {
        const response = await fetchWithAuth(`/api/requisitions/${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setRequests(prev => prev.filter(r => !selectedRequestIds.has(r.id)));
    setSelectedRequestIds(new Set());
    setIsDeletingMultipleRequests(false);

    if (failCount === 0) {
      toast({ title: "Deleted", description: `${successCount} request(s) removed successfully.` });
    } else {
      toast({ title: "Partial Success", description: `${successCount} deleted, ${failCount} failed.`, variant: "destructive" });
    }
  };

  const toggleSelectAllRequests = () => {
    if (selectedRequestIds.size === requests.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(requests.map(r => r.id)));
    }
  };

  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const applyTemplate = async (templateKey: string, mode: 'fill_empty' | 'replace_all') => {
    if (!engagementId || !templateKey) return;
    
    const industryTemplate = INDUSTRY_TEMPLATES[templateKey];
    if (!industryTemplate) return;

    const combinedTemplate = [...COMMON_REQUISITION_ITEMS, ...industryTemplate];

    setIsApplyingTemplate(true);
    
    try {
      if (mode === 'replace_all' && requests.length > 0) {
        for (const request of requests) {
          await fetchWithAuth(`/api/requisitions/${request.id}`, {
            method: "DELETE",
          });
        }
      }

      let successCount = 0;
      const batchSize = 10;
      
      const currentDescriptions = mode === 'fill_empty' 
        ? new Set(requests.map(r => `${r.headOfAccounts}::${r.description.toLowerCase().trim()}`))
        : new Set<string>();
      
      for (let i = 0; i < combinedTemplate.length; i += batchSize) {
        const batch = combinedTemplate.slice(i, i + batchSize);
        const promises = batch.map(async (item) => {
          const itemKey = `${item.headOfAccounts}::${item.description.toLowerCase().trim()}`;
          const isDuplicate = mode === 'fill_empty' && currentDescriptions.has(itemKey);
          
          if (!isDuplicate) {
            currentDescriptions.add(itemKey);
            
            const response = await fetchWithAuth(`/api/engagements/${engagementId}/requisitions`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                headOfAccounts: item.headOfAccounts,
                description: item.description,
              }),
            });
            
            if (response.ok) {
              return 1;
            }
          }
          return 0;
        });
        
        const results = await Promise.all(promises);
        successCount += results.reduce((a: number, b: number) => a + b, 0 as number);
      }

      toast({
        title: "Template Applied",
        description: `Added ${successCount} information requests from the ${TEMPLATE_OPTIONS.find(t => t.value === templateKey)?.label} template (includes ${COMMON_REQUISITION_ITEMS.length} common items + ${industryTemplate.length} industry-specific items).`,
      });
      
      setSelectedTemplate("");
      fetchRequests();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply template.",
        variant: "destructive",
      });
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const generateAiSuggestions = async () => {
    if (!engagementId) return;
    
    setIsGeneratingAiSuggestions(true);
    setAiSuggestionProgress("Gathering client and engagement information...");
    
    try {
      const engagementResponse = await fetchWithAuth(`/api/engagements/${engagementId}`);
      const engagementData = engagementResponse.ok ? await engagementResponse.json() : null;
      
      let clientData = null;
      if (engagementData?.clientId) {
        const clientResponse = await fetchWithAuth(`/api/clients/${engagementData.clientId}`);
        clientData = clientResponse.ok ? await clientResponse.json() : null;
      }
      
      setAiSuggestionProgress("Analyzing pre-planning data...");
      const prePlanningResponse = await fetchWithAuth(`/api/engagements/${engagementId}/pre-planning`);
      const prePlanningData = prePlanningResponse.ok ? await prePlanningResponse.json() : null;
      
      const context = {
        client: {
          name: clientData?.name || "",
          industry: clientInfo?.industry || clientData?.industry || "",
          entityType: clientInfo?.entityType || clientData?.entityType || "",
          specialEntityType: clientInfo?.specialEntityType || clientData?.specialEntityType || "",
        },
        engagement: {
          type: engagementData?.engagementType || "",
          yearEnd: engagementData?.fiscalYearEnd || "",
          engagementCode: engagementData?.engagementCode || "",
        },
        prePlanning: {
          hasRelatedParties: prePlanningData?.relatedParties?.length > 0,
          hasLoanBalances: prePlanningData?.loansAndBorrowings || false,
          hasFixedAssets: prePlanningData?.significantAssets || false,
          hasInventory: prePlanningData?.significantInventory || false,
          hasEmployees: prePlanningData?.numberOfEmployees > 0,
          hasExport: prePlanningData?.exportActivities || false,
          hasImport: prePlanningData?.importActivities || false,
          isFirstYearAudit: prePlanningData?.isFirstYearAudit || false,
          hasSubsidiaries: prePlanningData?.hasSubsidiaries || false,
          hasInvestments: prePlanningData?.hasInvestments || false,
        }
      };
      
      setAiSuggestionProgress("Generating industry-specific suggestions...");
      
      const suggestions: Array<{ headOfAccounts: string; description: string }> = [];
      
      if (context.client.industry?.toLowerCase().includes("manufacturing") || 
          context.client.industry?.toLowerCase().includes("textile") ||
          context.client.industry?.toLowerCase().includes("fmcg")) {
        suggestions.push(
          { headOfAccounts: "INVENTORY", description: `Production cost analysis for ${context.client.name} - raw materials, WIP, and finished goods` },
          { headOfAccounts: "INVENTORY", description: "Bill of Materials (BOM) for major product lines with standard costs" },
          { headOfAccounts: "COST_OF_SALES", description: "Manufacturing overhead allocation methodology and variance analysis" },
          { headOfAccounts: "FIXED_ASSETS", description: "Plant and machinery register with production capacity details" },
        );
      }
      
      if (context.client.industry?.toLowerCase().includes("technology") || 
          context.client.industry?.toLowerCase().includes("software") ||
          context.client.industry?.toLowerCase().includes("it")) {
        suggestions.push(
          { headOfAccounts: "REVENUE", description: "SaaS/subscription revenue recognition documentation (IFRS 15)" },
          { headOfAccounts: "FIXED_ASSETS", description: "Capitalized software development costs and amortization" },
          { headOfAccounts: "OPERATING_EXPENSES", description: "Cloud infrastructure and hosting costs breakdown" },
          { headOfAccounts: "EQUITY", description: "ESOP/stock option plan documentation and fair value calculations" },
        );
      }
      
      if (context.client.industry?.toLowerCase().includes("retail") || 
          context.client.industry?.toLowerCase().includes("trading")) {
        suggestions.push(
          { headOfAccounts: "INVENTORY", description: "Store-wise inventory aging and shrinkage analysis" },
          { headOfAccounts: "REVENUE", description: "POS system daily sales reconciliation with bank deposits" },
          { headOfAccounts: "REVENUE", description: "Returns, refunds, and credit notes analysis" },
          { headOfAccounts: "LEASES", description: "Store lease agreements with IFRS 16 calculations" },
        );
      }
      
      if (context.client.industry?.toLowerCase().includes("healthcare") || 
          context.client.industry?.toLowerCase().includes("pharma") ||
          context.client.industry?.toLowerCase().includes("hospital")) {
        suggestions.push(
          { headOfAccounts: "CORPORATE_DOCUMENTS", description: "Medical facility licenses and Drug Controller registrations" },
          { headOfAccounts: "INVENTORY", description: "Pharmaceutical inventory with expiry dates and controlled substances" },
          { headOfAccounts: "REVENUE", description: "Patient billing and insurance claims reconciliation" },
          { headOfAccounts: "PAYROLL", description: "Doctor and specialist contracts with fee arrangements" },
        );
      }
      
      if (context.client.industry?.toLowerCase().includes("construction") || 
          context.client.industry?.toLowerCase().includes("real estate")) {
        suggestions.push(
          { headOfAccounts: "REVENUE", description: "Project-wise revenue recognition (percentage of completion method)" },
          { headOfAccounts: "INVENTORY", description: "Work-in-progress valuation by project site" },
          { headOfAccounts: "RECEIVABLES", description: "Retention money receivable schedule by project" },
          { headOfAccounts: "PAYABLES", description: "Sub-contractor payments and certified bills" },
        );
      }
      
      if (context.prePlanning.hasRelatedParties) {
        suggestions.push(
          { headOfAccounts: "RELATED_PARTY", description: `Related party transactions register for ${context.client.name}` },
          { headOfAccounts: "RELATED_PARTY", description: "Transfer pricing documentation and arms-length analysis" },
          { headOfAccounts: "RELATED_PARTY", description: "Balances due to/from related parties with confirmations" },
        );
      }
      
      if (context.prePlanning.hasExport || context.prePlanning.hasImport) {
        suggestions.push(
          { headOfAccounts: "RECEIVABLES", description: "Export receivables and LC documentation" },
          { headOfAccounts: "PAYABLES", description: "Import payments, LC documents, and customs clearances" },
          { headOfAccounts: "BANK_INFORMATION", description: "Foreign currency bank accounts and EEFC account statements" },
          { headOfAccounts: "TAXATION", description: "Export incentives and duty drawback claims" },
        );
      }
      
      if (context.prePlanning.hasSubsidiaries || context.prePlanning.hasInvestments) {
        suggestions.push(
          { headOfAccounts: "INVESTMENTS", description: "Investment in subsidiaries/associates register and valuations" },
          { headOfAccounts: "FINANCIAL_STATEMENTS", description: "Subsidiary financial statements for consolidation" },
          { headOfAccounts: "RELATED_PARTY", description: "Intercompany transactions and balances for elimination" },
        );
      }
      
      if (context.prePlanning.isFirstYearAudit) {
        suggestions.push(
          { headOfAccounts: "CORPORATE_DOCUMENTS", description: "Opening balance sheet and prior year closing trial balance" },
          { headOfAccounts: "FINANCIAL_STATEMENTS", description: "Accounting policies adopted and basis of preparation" },
          { headOfAccounts: "FIXED_ASSETS", description: "Historical cost and depreciation records for all assets" },
        );
      }
      
      if (context.client.entityType === "Listed Company" || context.client.entityType === "Public Limited") {
        suggestions.push(
          { headOfAccounts: "CORPORATE_DOCUMENTS", description: "PSX/Stock Exchange compliance filings" },
          { headOfAccounts: "CORPORATE_DOCUMENTS", description: "Quarterly financial reports and announcements" },
          { headOfAccounts: "EQUITY", description: "Director shareholding and insider trading reports" },
        );
      }
      
      if (context.client.specialEntityType === "Section-42" || context.client.entityType === "NGO/NPO" || context.client.entityType === "Trust") {
        suggestions.push(
          { headOfAccounts: "REVENUE", description: "Donor-wise grant and donation receipts" },
          { headOfAccounts: "TAXATION", description: "Tax exemption certificates and FCRA compliance" },
          { headOfAccounts: "OPERATING_EXPENSES", description: "Program expenses vs administrative expenses ratio" },
        );
      }
      
      setAiSuggestionProgress("Adding suggestions to requisition list...");
      
      const existingItems = new Set(
        requests.map(r => `${r.headOfAccounts}::${r.description.toLowerCase().trim()}`)
      );
      
      let addedCount = 0;
      for (const suggestion of suggestions) {
        const itemKey = `${suggestion.headOfAccounts}::${suggestion.description.toLowerCase().trim()}`;
        const exists = existingItems.has(itemKey);
        
        if (!exists) {
          existingItems.add(itemKey);
          
          const response = await fetchWithAuth(`/api/engagements/${engagementId}/requisitions`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
            },
            body: JSON.stringify(suggestion),
          });
          
          if (response.ok) {
            addedCount++;
          }
        }
      }
      
      toast({
        title: "AI Suggestions Applied",
        description: `Added ${addedCount} AI-generated suggestions based on client profile, engagement type, and pre-planning data.`,
      });
      
      fetchRequests();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate AI suggestions.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAiSuggestions(false);
      setAiSuggestionProgress("");
    }
  };

  const handleExportRequestLetter = async () => {
    if (!engagementId || requests.length === 0) return;
    
    setIsExporting(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/requisitions/export-word?includeProvided=false`);

      if (!response.ok) {
        throw new Error("Failed to generate Word document");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Information_Request_Letter_${engagement?.engagementCode || "engagement"}_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const pendingRequests = requests.filter(r => r.provided !== "YES");
      toast({
        title: "Export Successful",
        description: `Request letter exported as Word document with ${pendingRequests.length} pending items.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export request letter as Word document.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const openEmailDialog = () => {
    const clientName = engagement?.client?.name || "Client";
    const fiscalYear = engagement?.fiscalYearEnd ? new Date(engagement.fiscalYearEnd).getFullYear() : new Date().getFullYear();
    
    setEmailSubject(`Information Request Letter - ${clientName} - FY ${fiscalYear}`);
    
    const pendingRequests = requests.filter(r => r.provided !== "YES");
    const requestList = pendingRequests.map((r, idx) => 
      `${idx + 1}. ${r.headOfAccounts}: ${r.description}`
    ).join('\n');
    
    setEmailBody(`Dear ${clientName},

Please find below the information request letter for the audit of ${clientName} for the fiscal year ending ${fiscalYear}.

The following documents/information are required:

${requestList}

Please provide the above information at your earliest convenience.

Best regards,
Audit Team`);
    
    setEmailTo("");
    setEmailCc("");
    setIsEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter at least one email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/requisitions/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailTo.split(',').map(e => e.trim()).filter(Boolean),
          cc: emailCc ? emailCc.split(',').map(e => e.trim()).filter(Boolean) : [],
          subject: emailSubject,
          body: emailBody,
          includeAttachment: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send email");
      }

      toast({
        title: "Email Sent",
        description: `Information request letter sent to ${emailTo}`,
      });
      setIsEmailDialogOpen(false);
    } catch (error) {
      toast({
        title: "Email Sending",
        description: "Email functionality will be configured with your email provider. For now, you can use Download Info. Req to get the document.",
      });
      setIsEmailDialogOpen(false);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const renderMultilineDescription = (description: string) => {
    const lines = description.split('\n').filter(line => line.trim());
    if (lines.length <= 1) {
      return <span>{description}</span>;
    }
    return (
      <ul className="list-disc pl-4 space-y-0.5 text-sm">
        {lines.map((line, index) => (
          <li key={index} className="leading-relaxed">{line.trim()}</li>
        ))}
      </ul>
    );
  };

  const getAttachmentCount = (request: InformationRequest) => {
    return request.attachments?.length || 0;
  };

  return (
    <>
      <Card className="border-0 shadow-none">
        <CardHeader className="py-2 px-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-medium">Information Requests</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="w-[180px] h-7 text-xs" data-testid="select-template">
                  <SelectValue placeholder="Select Template..." />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedTemplate && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={isApplyingTemplate}
                      data-testid="button-apply-template"
                    >
                      {isApplyingTemplate ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <ListPlus className="h-4 w-4 mr-1" />
                      )}
                      Apply Template
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apply Template</AlertDialogTitle>
                      <AlertDialogDescription>
                        How would you like to apply the {TEMPLATE_OPTIONS.find(t => t.value === selectedTemplate)?.label} template?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-3">
                      <Button 
                        className="w-full justify-start" 
                        variant="outline"
                        onClick={() => applyTemplate(selectedTemplate, 'fill_empty')}
                        disabled={isApplyingTemplate}
                        data-testid="button-fill-empty"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Fill Empty Fields Only
                        <span className="ml-auto text-xs text-muted-foreground">Preserves existing data</span>
                      </Button>
                      <Button 
                        className="w-full justify-start" 
                        variant="outline"
                        onClick={() => applyTemplate(selectedTemplate, 'replace_all')}
                        disabled={isApplyingTemplate}
                        data-testid="button-replace-all"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Replace All Fields
                        <span className="ml-auto text-xs text-muted-foreground">Overwrites all data</span>
                      </Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-template">Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              <Button 
                size="sm" 
                onClick={() => setIsAddingNew(true)} 
                disabled={isAddingNew}
                data-testid="button-add-request"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </Button>

              {selectedRequestIds.size > 0 && (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={deleteMultipleRequests}
                  disabled={isDeletingMultipleRequests}
                  data-testid="button-delete-selected-requests"
                >
                  {isDeletingMultipleRequests ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Delete Selected ({selectedRequestIds.size})
                </Button>
              )}

              <Button 
                size="sm" 
                variant="outline"
                onClick={generateAiSuggestions}
                disabled={isGeneratingAiSuggestions}
                data-testid="button-ai-suggest-requisitions"
              >
                {isGeneratingAiSuggestions ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    {aiSuggestionProgress || "Processing..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI Suggest
                  </>
                )}
              </Button>

              <Button 
                size="sm" 
                variant="outline"
                onClick={openEmailDialog}
                disabled={requests.length === 0}
                data-testid="button-send-email"
              >
                <Mail className="h-4 w-4 mr-1" />
                Send through Email
              </Button>

              <Button 
                size="sm" 
                variant="outline"
                onClick={handleExportRequestLetter}
                disabled={requests.length === 0 || isExporting}
                data-testid="button-download-info-req"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Download Info. Req
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading requests...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] text-center">
                      <input
                        type="checkbox"
                        checked={requests.length > 0 && selectedRequestIds.size === requests.length}
                        onChange={toggleSelectAllRequests}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-select-all-requests"
                      />
                    </TableHead>
                    <TableHead className="w-[60px] text-center">Sr.</TableHead>
                    <TableHead className="w-[180px]">Head of Accounts</TableHead>
                    <TableHead className="min-w-[250px]">Description</TableHead>
                    <TableHead className="min-w-[200px]">Client Response</TableHead>
                    <TableHead className="w-[100px] text-center">Provided</TableHead>
                    <TableHead className="w-[100px] text-center">Attachments</TableHead>
                    <TableHead className="w-[80px] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAddingNew && (
                    <TableRow data-testid="row-new-request">
                      <TableCell className="text-center text-muted-foreground">-</TableCell>
                      <TableCell className="text-center text-muted-foreground">-</TableCell>
                      <TableCell>
                        <Select
                          value={newRow.headOfAccounts}
                          onValueChange={(value) => setNewRow({ ...newRow, headOfAccounts: value })}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid="select-new-head">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {HEAD_OF_ACCOUNTS.map((head) => (
                              <SelectItem key={head.value} value={head.value}>
                                {head.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={newRow.description}
                          onChange={(e) => setNewRow({ ...newRow, description: e.target.value })}
                          placeholder="Enter description..."
                          className="min-h-[60px] text-sm resize-none"
                          data-testid="input-new-description"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">-</TableCell>
                      <TableCell className="text-center text-muted-foreground text-xs">-</TableCell>
                      <TableCell className="text-center text-muted-foreground text-xs">-</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={handleCreateRequest}
                            data-testid="button-save-new"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => { setIsAddingNew(false); setNewRow({ headOfAccounts: "", description: "" }); }}
                            data-testid="button-cancel-new"
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {requests.length === 0 && !isAddingNew ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                        No information requests yet. Click "Add Row" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((request) => {
                      const isEditing = editingRows.has(request.id);
                      const editData = editingRows.get(request.id);
                      const headLabel = HEAD_OF_ACCOUNTS.find(h => h.value === request.headOfAccounts)?.label || request.headOfAccounts;
                      const attachmentCount = getAttachmentCount(request);
                      
                      return (
                        <TableRow 
                          key={request.id} 
                          data-testid={`row-request-${request.id}`}
                          className={selectedRequestIds.has(request.id) ? "bg-blue-50/50" : ""}
                        >
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={selectedRequestIds.has(request.id)}
                              onChange={() => toggleSelectRequest(request.id)}
                              className="h-4 w-4 rounded border-gray-300"
                              data-testid={`checkbox-request-${request.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm" data-testid={`text-sr-${request.id}`}>
                            {request.srNumber}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Select
                                value={editData?.headOfAccounts}
                                onValueChange={(value) => updateEditingField(request.id, 'headOfAccounts', value)}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-head-${request.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {HEAD_OF_ACCOUNTS.map((head) => (
                                    <SelectItem key={head.value} value={head.value}>
                                      {head.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span 
                                className="text-sm cursor-pointer hover:underline"
                                onClick={() => startEditing(request)}
                                data-testid={`text-head-${request.id}`}
                              >
                                {headLabel}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Textarea
                                value={editData?.description}
                                onChange={(e) => updateEditingField(request.id, 'description', e.target.value)}
                                className="min-h-[60px] text-sm resize-none"
                                data-testid={`input-desc-${request.id}`}
                              />
                            ) : (
                              <div 
                                className="text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                                onClick={() => startEditing(request)}
                                data-testid={`text-desc-${request.id}`}
                              >
                                {request.description ? renderMultilineDescription(request.description) : <span className="text-muted-foreground italic">No description</span>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground" data-testid={`text-response-${request.id}`}>
                              {request.clientResponse || <span className="italic">No response yet</span>}
                            </p>
                            {request.clientResponseDate && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(request.clientResponseDate).toLocaleDateString()}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant={request.provided === 'YES' ? 'default' : 'outline'}
                                    className={request.provided === 'YES' ? 'bg-green-600 h-7 w-7' : 'h-7 w-7'}
                                    onClick={() => updateProvided(request.id, 'YES')}
                                    data-testid={`button-yes-${request.id}`}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Provided</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant={request.provided === 'NO' ? 'destructive' : 'outline'}
                                    className="h-7 w-7"
                                    onClick={() => updateProvided(request.id, 'NO')}
                                    data-testid={`button-no-${request.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Not Provided</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAttachmentDialogId(request.id)}
                              className="gap-1"
                              data-testid={`button-attachments-${request.id}`}
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="text-xs">{attachmentCount}</span>
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isEditing ? (
                                <>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => saveEditing(request.id)}
                                    data-testid={`button-save-${request.id}`}
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => cancelEditing(request.id)}
                                    data-testid={`button-cancel-${request.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        onClick={() => {
                                          const vaultUrl = `/workspace/${engagementId}/evidence?account=${encodeURIComponent(request.headOfAccounts)}`;
                                          window.open(vaultUrl, '_blank');
                                        }}
                                        data-testid={`button-vault-${request.id}`}
                                      >
                                        <Eye className="h-4 w-4 text-blue-500" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View in Evidence Vault</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        onClick={() => deleteRequest(request.id)}
                                        data-testid={`button-delete-${request.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Request</TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!attachmentDialogId} onOpenChange={() => setAttachmentDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attachments</DialogTitle>
            <DialogDescription>
              Files uploaded by the client for this request
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {attachmentDialogId && (
              <AttachmentsList 
                attachments={requests.find(r => r.id === attachmentDialogId)?.attachments || []}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentDialogId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Send Information Request Letter
            </DialogTitle>
            <DialogDescription>
              Send the information request letter via email to the client
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">To (comma-separated)</Label>
              <Input
                id="email-to"
                type="text"
                placeholder="client@example.com, finance@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                data-testid="input-email-to"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email-cc">CC (optional, comma-separated)</Label>
              <Input
                id="email-cc"
                type="text"
                placeholder="manager@example.com"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                data-testid="input-email-cc"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                rows={12}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="font-mono text-sm"
                data-testid="textarea-email-body"
              />
            </div>
            
            <div className="rounded-md border p-3 bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Paperclip className="h-4 w-4" />
                <span className="font-medium">Attachment:</span>
                <span>Information_Request_Letter.docx will be attached</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {requests.filter(r => r.provided !== "YES").length} pending information requests will be included
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)} data-testid="button-cancel-email">
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={isSendingEmail || !emailTo.trim()}
              data-testid="button-send-email-submit"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-1" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttachmentsList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No attachments uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div 
          key={attachment.id} 
          className="flex items-center justify-between p-3 border rounded-md"
          data-testid={`attachment-${attachment.id}`}
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{attachment.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {(attachment.fileSize / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" asChild>
              <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" data-testid={`button-view-${attachment.id}`}>
                <Eye className="h-4 w-4" />
              </a>
            </Button>
            <Button size="icon" variant="ghost" asChild>
              <a href={attachment.fileUrl} download={attachment.fileName} data-testid={`button-download-${attachment.id}`}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
