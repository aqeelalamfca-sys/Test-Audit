import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { FileDown, FileText, Paperclip, Loader2, AlertTriangle, History, Download, Lock } from "lucide-react";
import { format } from "date-fns";

interface Client {
  id: string;
  name: string;
}

interface Engagement {
  id: string;
  engagementCode: string;
  fiscalYearEnd: string | null;
  clientId: string;
  client: {
    id: string;
    name: string;
  };
}

interface PDFGenerationLog {
  id: string;
  engagementId: string;
  clientName: string;
  auditPeriod: string;
  pdfType: "WITH_ATTACHMENTS" | "WITHOUT_ATTACHMENTS";
  generatedById: string;
  generatedBy: {
    fullName: string;
    role: string;
  };
  generatedAt: string;
  storageReference: string | null;
  version: number;
}

export default function PDFDocumentation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedEngagementId, setSelectedEngagementId] = useState<string>("");
  const [isPINDialogOpen, setIsPINDialogOpen] = useState(false);
  const [partnerPIN, setPartnerPIN] = useState("");
  const [pendingAction, setPendingAction] = useState<"print" | "print_with_attachments" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const isAuthorized = user?.role === "FIRM_ADMIN" || user?.role === "PARTNER";

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    enabled: isAuthorized,
  });

  const { data: engagements = [] } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/engagements");
      if (!res.ok) throw new Error("Failed to fetch engagements");
      return res.json();
    },
    enabled: isAuthorized,
  });

  const { data: generationHistory = [] } = useQuery<PDFGenerationLog[]>({
    queryKey: ["/api/pdf-documentation/history", selectedEngagementId],
    queryFn: async () => {
      if (!selectedEngagementId) return [];
      const res = await fetchWithAuth(`/api/pdf-documentation/history/${selectedEngagementId}`);
      if (!res.ok) throw new Error("Failed to fetch generation history");
      return res.json();
    },
    enabled: isAuthorized && !!selectedEngagementId,
  });

  const filteredEngagements = selectedClientId 
    ? engagements.filter(e => e.clientId === selectedClientId)
    : engagements;

  const selectedEngagement = engagements.find(e => e.id === selectedEngagementId);

  const generatePDFMutation = useMutation({
    mutationFn: async ({ engagementId, withAttachments, pin }: { engagementId: string; withAttachments: boolean; pin: string }) => {
      setIsGenerating(true);
      const res = await fetchWithAuth("/api/pdf-documentation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId, withAttachments, partnerPIN: pin }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate PDF");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PDF Generated Successfully",
        description: `Your audit file has been generated. ${data.fileName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pdf-documentation/history", selectedEngagementId] });
      setIsPINDialogOpen(false);
      setPartnerPIN("");
      setPendingAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  const handleGeneratePDF = (withAttachments: boolean) => {
    if (!selectedEngagementId) {
      toast({
        title: "Selection Required",
        description: "Please select a client and audit period before generating.",
        variant: "destructive",
      });
      return;
    }
    
    if (user?.role === "PARTNER") {
      setPendingAction(withAttachments ? "print_with_attachments" : "print");
      setIsPINDialogOpen(true);
    } else if (user?.role === "FIRM_ADMIN") {
      generatePDFMutation.mutate({ 
        engagementId: selectedEngagementId, 
        withAttachments,
        pin: "" 
      });
    }
  };

  const handlePINConfirm = () => {
    if (!partnerPIN) {
      toast({
        title: "PIN Required",
        description: "Please enter your Partner PIN to proceed.",
        variant: "destructive",
      });
      return;
    }
    
    generatePDFMutation.mutate({
      engagementId: selectedEngagementId,
      withAttachments: pendingAction === "print_with_attachments",
      pin: partnerPIN,
    });
  };

  const formatAuditPeriod = (fiscalYearEnd: string | null) => {
    if (!fiscalYearEnd) return "Not Set";
    const date = new Date(fiscalYearEnd);
    return `FY ${date.getFullYear()}`;
  };

  if (!isAuthorized) {
    return (
      <div className="px-4 py-3">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-center max-w-md">
              This module is restricted to Firm Administrators and Engagement Partners only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileDown className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">PDF Documentation</h1>
          <p className="text-muted-foreground">
            Generate complete, inspection-ready audit files for ICAP QCR, EQCR, and AOB reviews
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Audit File
            </CardTitle>
            <CardDescription>
              Select the client and audit period to generate a comprehensive PDF documentation package
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client Name</Label>
                <Select value={selectedClientId} onValueChange={(value) => {
                  setSelectedClientId(value);
                  setSelectedEngagementId("");
                }}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="engagement">Audit Period</Label>
                <Select 
                  value={selectedEngagementId} 
                  onValueChange={setSelectedEngagementId}
                  disabled={!selectedClientId && filteredEngagements.length === 0}
                >
                  <SelectTrigger id="engagement">
                    <SelectValue placeholder="Select audit period..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEngagements.map((engagement) => (
                      <SelectItem key={engagement.id} value={engagement.id}>
                        {formatAuditPeriod(engagement.fiscalYearEnd)} - {engagement.engagementCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedEngagement && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Selected Engagement Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Client:</span> {selectedEngagement.client?.name}</div>
                  <div><span className="text-muted-foreground">Code:</span> {selectedEngagement.engagementCode}</div>
                  <div><span className="text-muted-foreground">Period:</span> {formatAuditPeriod(selectedEngagement.fiscalYearEnd)}</div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
              <Button 
                size="lg" 
                onClick={() => handleGeneratePDF(false)}
                disabled={!selectedEngagementId || isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                PDF / Print
              </Button>
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => handleGeneratePDF(true)}
                disabled={!selectedEngagementId || isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4 mr-2" />
                )}
                PDF / Print with Attachments
              </Button>
            </div>

            <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Partner PIN Required</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    PDF generation requires Partner PIN verification for audit trail and access control compliance.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Generation History
            </CardTitle>
            <CardDescription>
              Previous PDF generations for selected engagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedEngagementId ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Select an engagement to view generation history
              </p>
            ) : generationHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No PDFs have been generated for this engagement yet
              </p>
            ) : (
              <div className="space-y-3">
                {generationHistory.map((log) => (
                  <div key={log.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={log.pdfType === "WITH_ATTACHMENTS" ? "default" : "secondary"}>
                        {log.pdfType === "WITH_ATTACHMENTS" ? "With Attachments" : "Without Attachments"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">v{log.version}</span>
                    </div>
                    <div className="text-muted-foreground space-y-1">
                      <p>Generated by: {log.generatedBy?.fullName}</p>
                      <p>{format(new Date(log.generatedAt), "MMM d, yyyy h:mm a")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PDF Structure & Contents</CardTitle>
          <CardDescription>
            The generated PDF follows a mandatory fixed order for regulatory compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>ISA Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">1</TableCell>
                <TableCell>Cover Page</TableCell>
                <TableCell>Firm name, client, audit period, engagement code, generated date/by</TableCell>
                <TableCell><Badge variant="outline">ISA 230</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">2</TableCell>
                <TableCell>Table of Contents</TableCell>
                <TableCell>Auto-generated navigation with page references</TableCell>
                <TableCell><Badge variant="outline">ISA 230</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">3</TableCell>
                <TableCell>Pre-Planning Documentation</TableCell>
                <TableCell>Ethics checklists, acceptance decisions, engagement letter</TableCell>
                <TableCell><Badge variant="outline">ISA 210, 220</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">4</TableCell>
                <TableCell>Planning Documentation</TableCell>
                <TableCell>Risk assessment, materiality, audit strategy</TableCell>
                <TableCell><Badge variant="outline">ISA 300, 315, 320</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">5</TableCell>
                <TableCell>Execution Documentation</TableCell>
                <TableCell>Controls testing, substantive procedures, journal entry testing</TableCell>
                <TableCell><Badge variant="outline">ISA 330, 500, 530</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">6</TableCell>
                <TableCell>Adjusted Financials</TableCell>
                <TableCell>Adjusted Balance Sheet & Profit/Loss Statement</TableCell>
                <TableCell><Badge variant="outline">ISA 450, 700</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">7</TableCell>
                <TableCell>Finalization Documentation</TableCell>
                <TableCell>Completion checklist, subsequent events, going concern</TableCell>
                <TableCell><Badge variant="outline">ISA 560, 570, 580</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">8</TableCell>
                <TableCell>Deliverables</TableCell>
                <TableCell>Audit report, management letter, engagement & time summaries</TableCell>
                <TableCell><Badge variant="outline">ISA 700, 705, 706</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">9</TableCell>
                <TableCell>Quality Review (EQCR)</TableCell>
                <TableCell>EQCR checklist, AI summary, partner response, signed report</TableCell>
                <TableCell><Badge variant="outline">ISQM-2</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">10</TableCell>
                <TableCell>Attachments</TableCell>
                <TableCell>Embedded attachments or indexed appendix (if selected)</TableCell>
                <TableCell><Badge variant="outline">ISA 230</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Watermark:</strong> All generated PDFs are watermarked with 
              <span className="italic"> "Confidential - For Audit & Regulatory Review Only"</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPINDialogOpen} onOpenChange={setIsPINDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Partner PIN Verification
            </DialogTitle>
            <DialogDescription>
              Enter your Partner PIN to authorize PDF generation. This action will be logged for audit trail purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Partner PIN</Label>
              <Input
                id="pin"
                type="password"
                placeholder="Enter your PIN"
                value={partnerPIN}
                onChange={(e) => setPartnerPIN(e.target.value)}
                maxLength={6}
              />
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Action:</strong> {pendingAction === "print_with_attachments" ? "Generate PDF with Attachments" : "Generate PDF"}</p>
              <p><strong>Engagement:</strong> {selectedEngagement?.engagementCode}</p>
              <p><strong>Client:</strong> {selectedEngagement?.client?.name}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsPINDialogOpen(false);
              setPartnerPIN("");
              setPendingAction(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handlePINConfirm} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Confirm & Generate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
