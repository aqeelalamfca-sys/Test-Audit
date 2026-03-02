import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from '@/lib/formatters';
import { 
  Eye, CheckCircle2, AlertTriangle, FileText, Lock, Printer,
  ClipboardCheck, Shield, User, FileCheck,
  AlertCircle, RefreshCw, Archive, Package,
  BookOpen, ClipboardList,
  History, Clock, UserCheck, ArrowRight, Activity
} from "lucide-react";
import { AIAssistBanner, PHASE_AI_CONFIGS } from "@/components/ai-assist-banner";

interface PhaseSummary {
  phase: string;
  status: string;
  completedItems: number;
  totalItems: number;
  signedOffBy?: string;
  signedOffDate?: string;
  keyFindings?: string[];
}

interface InspectionData {
  engagementInfo: {
    code: string;
    clientName: string;
    periodStart?: string;
    periodEnd?: string;
    auditOpinion?: string;
    fileStatus?: string;
  };
  phases: PhaseSummary[];
  keyMetrics: {
    totalWorkpapers: number;
    totalFindings: number;
    openItems: number;
    adjustmentsCount: number;
    materialityAmount?: number;
  };
  riskSummary: Array<{
    riskArea: string;
    riskLevel: string;
    response: string;
  }>;
  auditMatters: Array<{
    matter: string;
    conclusion: string;
  }>;
}

export default function Inspection() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [data, setData] = useState<InspectionData>({
    engagementInfo: {
      code: engagement?.engagementCode || "",
      clientName: client?.name || "",
      fileStatus: "LOCKED"
    },
    phases: [
      { phase: "Pre-Planning", status: "Completed", completedItems: 12, totalItems: 12, signedOffBy: "Manager", signedOffDate: "2026-01-15" },
      { phase: "Planning", status: "Completed", completedItems: 25, totalItems: 25, signedOffBy: "Manager", signedOffDate: "2026-01-18" },
      { phase: "Execution", status: "Completed", completedItems: 45, totalItems: 45, signedOffBy: "Senior", signedOffDate: "2026-01-25" },
      { phase: "Finalization", status: "Completed", completedItems: 18, totalItems: 18, signedOffBy: "Partner", signedOffDate: "2026-01-28" },
      { phase: "EQCR", status: "Completed", completedItems: 15, totalItems: 15, signedOffBy: "EQCR Reviewer", signedOffDate: "2026-01-29" },
    ],
    keyMetrics: {
      totalWorkpapers: 85,
      totalFindings: 3,
      openItems: 0,
      adjustmentsCount: 2,
      materialityAmount: 5000000
    },
    riskSummary: [
      { riskArea: "Revenue Recognition", riskLevel: "Significant", response: "Extended substantive procedures performed" },
      { riskArea: "Management Override", riskLevel: "Significant", response: "Journal entry testing completed" },
      { riskArea: "Inventory Valuation", riskLevel: "Moderate", response: "Physical count observation and NRV testing" },
    ],
    auditMatters: [
      { matter: "Revenue Recognition Policy", conclusion: "Appropriate accounting treatment confirmed" },
      { matter: "Going Concern Assessment", conclusion: "No material uncertainty identified" },
      { matter: "Related Party Transactions", conclusion: "All transactions at arm's length, properly disclosed" },
    ]
  });

  const fetchInspectionData = useCallback(async () => {
    if (!engagementId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetchWithAuth(`/api/workspace/${engagementId}/inspection`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setData(prev => ({ ...prev, ...result.data }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch inspection data:", error);
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    fetchInspectionData();
  }, [fetchInspectionData]);

  const handleExportFullPackage = async () => {
    setExporting(true);
    try {
      toast({
        title: "Exporting Package",
        description: "Generating full audit package for download...",
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const packageContent = {
        exportDate: new Date().toISOString(),
        engagementId,
        clientName: client?.name || data.engagementInfo.clientName,
        engagementCode: engagement?.engagementCode || data.engagementInfo.code,
        phases: data.phases,
        keyMetrics: data.keyMetrics,
        riskSummary: data.riskSummary,
        auditMatters: data.auditMatters,
      };
      
      const blob = new Blob([JSON.stringify(packageContent, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Audit_Package_${engagement?.engagementCode || 'export'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: "Full audit package has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export the audit package.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePrintArchive = async () => {
    setPrinting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      
      const printContent = document.createElement("div");
      printContent.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1a365d; padding-bottom: 20px;">
            <h1 style="color: #1a365d; margin-bottom: 10px; font-size: 24px;">AUDIT FILE ARCHIVE</h1>
            <h2 style="color: #4a5568; font-weight: normal; font-size: 18px;">Inspection Ready Summary</h2>
            <p style="color: #718096; font-size: 12px;">Generated: ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">Engagement Details</h3>
            <table style="width: 100%; font-size: 12px;">
              <tr><td style="padding: 5px 0;"><strong>Client:</strong></td><td>${client?.name || data.engagementInfo.clientName || "N/A"}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Engagement Code:</strong></td><td>${engagement?.engagementCode || data.engagementInfo.code || "N/A"}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Audit Opinion:</strong></td><td>${data.engagementInfo.auditOpinion || "Unmodified"}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>File Status:</strong></td><td>${data.engagementInfo.fileStatus || "LOCKED"}</td></tr>
            </table>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">Key Metrics</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 10px; background: #edf2f7; border: 1px solid #e2e8f0; text-align: center;"><strong>Work Papers</strong><br/>${data.keyMetrics.totalWorkpapers}</td>
                <td style="padding: 10px; background: #edf2f7; border: 1px solid #e2e8f0; text-align: center;"><strong>Findings</strong><br/>${data.keyMetrics.totalFindings}</td>
                <td style="padding: 10px; background: #edf2f7; border: 1px solid #e2e8f0; text-align: center;"><strong>Open Items</strong><br/>${data.keyMetrics.openItems}</td>
                <td style="padding: 10px; background: #edf2f7; border: 1px solid #e2e8f0; text-align: center;"><strong>Adjustments</strong><br/>${data.keyMetrics.adjustmentsCount}</td>
              </tr>
            </table>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">Phase Completion Status</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #edf2f7;">
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Phase</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">Status</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">Completion</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Signed Off By</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Date</th>
                </tr>
              </thead>
              <tbody>
                ${data.phases.map(phase => `
                  <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${phase.phase}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; color: ${phase.status === 'Completed' ? '#276749' : '#c53030'};">${phase.status}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${phase.completedItems}/${phase.totalItems}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${phase.signedOffBy || '-'}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${phase.signedOffDate || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">Risk Assessment Summary</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #edf2f7;">
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Risk Area</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">Risk Level</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Response</th>
                </tr>
              </thead>
              <tbody>
                ${data.riskSummary.map(risk => `
                  <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${risk.riskArea}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; color: ${risk.riskLevel === 'Significant' ? '#c53030' : '#b7791f'};">${risk.riskLevel}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${risk.response}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">Key Audit Matters</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #edf2f7;">
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Matter</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Conclusion</th>
                </tr>
              </thead>
              <tbody>
                ${data.auditMatters.map(matter => `
                  <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${matter.matter}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${matter.conclusion}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div style="margin-top: 50px; border-top: 2px solid #e2e8f0; padding-top: 30px;">
            <div style="display: flex; justify-content: space-between; margin-top: 30px;">
              <div style="text-align: center; width: 30%;">
                <div style="border-bottom: 1px solid #2d3748; margin-bottom: 10px; height: 50px;"></div>
                <p style="font-size: 11px;"><strong>Prepared By</strong></p>
              </div>
              <div style="text-align: center; width: 30%;">
                <div style="border-bottom: 1px solid #2d3748; margin-bottom: 10px; height: 50px;"></div>
                <p style="font-size: 11px;"><strong>Reviewed By</strong></p>
              </div>
              <div style="text-align: center; width: 30%;">
                <div style="border-bottom: 1px solid #2d3748; margin-bottom: 10px; height: 50px;"></div>
                <p style="font-size: 11px;"><strong>Partner Approval</strong></p>
              </div>
            </div>
          </div>
        </div>
      `;

      const options = {
        margin: 10,
        filename: `Audit_Archive_${engagement?.engagementCode || 'export'}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const }
      };

      await html2pdf().set(options).from(printContent).save();
      
      toast({
        title: "Print Complete",
        description: "Archive PDF has been generated and downloaded.",
      });
    } catch (error) {
      toast({
        title: "Print Failed",
        description: "Unable to generate the archive PDF.",
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 py-3 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-3 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
            <Archive className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate" data-testid="text-inspection-title">Inspection Archive</h1>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {client?.name || data.engagementInfo.clientName} {engagement?.engagementCode && `(${engagement.engagementCode})`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate hidden md:block">
              Read-only archive view of completed engagement - AOB/ICAP Inspection Ready
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <Badge variant="outline" className="text-xs" data-testid="badge-isa-220">
            <Shield className="h-3 w-3 mr-1" />
            ISA 220
          </Badge>
          <Badge variant="outline" className="text-xs" data-testid="badge-isqm-1">
            <ClipboardCheck className="h-3 w-3 mr-1" />
            ISQM 1
          </Badge>
          <Badge variant="outline" className="text-xs" data-testid="badge-isa-230">
            <FileText className="h-3 w-3 mr-1" />
            ISA 230
          </Badge>
          <Badge variant="outline" className="text-xs" data-testid="badge-isqm1-monitoring">
            <Activity className="h-3 w-3 mr-1" />
            ISQM 1 Monitoring
          </Badge>
          <Badge variant="outline" className="h-6 text-xs bg-purple-50 border-purple-200 text-purple-700" data-testid="badge-readonly">
            <Lock className="h-3 w-3 mr-1" />
            Read Only
          </Badge>
        </div>
      </div>

      <AIAssistBanner
        engagementId={engagementId || ""}
        config={{
          ...PHASE_AI_CONFIGS.finalization,
          contextBuilder: () => `Inspection archive for engagement ${engagementId}. Client: ${client?.name || data.engagementInfo.clientName}. Code: ${engagement?.engagementCode || data.engagementInfo.code}.`,
        }}
        data-testid="ai-assist-banner-inspection"
      />

      <Card className="border-purple-200 bg-purple-50/30 dark:bg-purple-950/20">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-purple-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-purple-800 dark:text-purple-200">Inspection Mode Active</p>
              <p className="text-purple-700 dark:text-purple-300">
                This is a read-only view of the completed engagement file. All data is locked and cannot be modified. 
                Use this view for quality reviews, AOB inspections, and archival purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-signoff-status-bar">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5" />
            Sign-off Status
          </CardTitle>
          <CardDescription>Maker-checker approval status for the inspection archive</CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const preparedPhase = data.phases.find(p => p.signedOffBy && p.phase === "Pre-Planning") || data.phases.find(p => p.signedOffBy);
            const reviewedPhase = data.phases.find(p => p.signedOffBy && (p.phase === "Execution" || p.phase === "EQCR"));
            const partnerPhase = data.phases.find(p => p.signedOffBy && p.phase === "Finalization");
            
            const steps = [
              {
                label: "Prepared",
                completed: !!preparedPhase?.signedOffBy,
                user: preparedPhase?.signedOffBy,
                date: preparedPhase?.signedOffDate,
              },
              {
                label: "Reviewed",
                completed: !!reviewedPhase?.signedOffBy,
                user: reviewedPhase?.signedOffBy,
                date: reviewedPhase?.signedOffDate,
              },
              {
                label: "Partner Approved",
                completed: !!partnerPhase?.signedOffBy,
                user: partnerPhase?.signedOffBy,
                date: partnerPhase?.signedOffDate,
              },
            ];

            return (
              <div className="flex items-center gap-2 flex-wrap" data-testid="signoff-steps">
                {steps.map((step, idx) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${step.completed ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-muted/30 border-border"}`} data-testid={`signoff-step-${idx}`}>
                      {step.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${step.completed ? "text-green-800 dark:text-green-200" : "text-muted-foreground"}`} data-testid={`signoff-step-label-${idx}`}>{step.label}</p>
                        {step.completed && step.user ? (
                          <p className="text-xs text-muted-foreground" data-testid={`signoff-step-detail-${idx}`}>
                            {step.user} &middot; {step.date}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Pending</p>
                        )}
                      </div>
                    </div>
                    {idx < steps.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 justify-end">
        <Button 
          variant="outline" 
          onClick={handleExportFullPackage}
          disabled={exporting}
          data-testid="button-export-full-package"
        >
          {exporting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
          Export Full Package
        </Button>
        <Button 
          onClick={handlePrintArchive}
          disabled={printing}
          data-testid="button-print-archive"
        >
          {printing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
          Print Archive
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Work Papers</p>
                <p className="text-lg font-bold" data-testid="text-workpapers-count">{data.keyMetrics.totalWorkpapers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Findings</p>
                <p className="text-lg font-bold" data-testid="text-findings-count">{data.keyMetrics.totalFindings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Open Items</p>
                <p className="text-lg font-bold" data-testid="text-open-items">{data.keyMetrics.openItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Adjustments</p>
                <p className="text-lg font-bold" data-testid="text-adjustments-count">{data.keyMetrics.adjustmentsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">File Status</p>
                <p className="text-sm font-medium text-green-600" data-testid="text-file-status">LOCKED</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2" data-testid="phase-signoff-indicators">
        {data.phases.map((phase, idx) => {
          const isSigned = !!phase.signedOffBy;
          return (
            <Card key={phase.phase} className={`border shadow-sm ${isSigned ? "border-green-200 dark:border-green-800" : "border-border"}`} data-testid={`phase-signoff-card-${idx}`}>
              <CardContent className="py-2 px-3">
                <div className="flex items-center gap-2">
                  {isSigned ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" data-testid={`phase-signoff-name-${idx}`}>{phase.phase}</p>
                    {isSigned ? (
                      <p className="text-[10px] text-muted-foreground truncate" data-testid={`phase-signoff-signer-${idx}`}>{phase.signedOffBy} &middot; {phase.signedOffDate}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground" data-testid={`phase-signoff-pending-${idx}`}>Pending sign-off</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5" />
            Phase Completion Summary
          </CardTitle>
          <CardDescription>All phases are completed and locked for inspection</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Phase</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Completion</TableHead>
                <TableHead>Signed Off By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.phases.map((phase, idx) => (
                <TableRow key={phase.phase} data-testid={`row-phase-${idx}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {phase.status === "Completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" data-testid={`icon-phase-completed-${idx}`} />
                      ) : phase.status === "In Progress" ? (
                        <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" data-testid={`icon-phase-inprogress-${idx}`} />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" data-testid={`icon-phase-notstarted-${idx}`} />
                      )}
                      <div>
                        <p className="font-medium" data-testid={`text-phase-name-${idx}`}>{phase.phase}</p>
                        {phase.signedOffBy && (
                          <p className="text-xs text-muted-foreground" data-testid={`text-phase-signoff-info-${idx}`}>
                            Signed by {phase.signedOffBy} on {phase.signedOffDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={phase.status === "Completed" ? "default" : phase.status === "In Progress" ? "secondary" : "destructive"}
                      className={phase.status === "Completed" ? "bg-green-100 text-green-800" : phase.status === "In Progress" ? "bg-amber-100 text-amber-800" : ""}
                      data-testid={`badge-phase-status-${idx}`}
                    >
                      {phase.status === "Completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {phase.status === "In Progress" && <Clock className="h-3 w-3 mr-1" />}
                      {phase.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm" data-testid={`text-phase-completion-${idx}`}>{phase.completedItems}/{phase.totalItems}</span>
                  </TableCell>
                  <TableCell data-testid={`text-phase-signedby-${idx}`}>{phase.signedOffBy || "-"}</TableCell>
                  <TableCell data-testid={`text-phase-signeddate-${idx}`}>{phase.signedOffDate || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["risks", "matters", "audit-trail"]} className="space-y-2">
        <AccordionItem value="risks" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span>Risk Assessment Summary</span>
              <Badge variant="secondary" className="ml-2">{data.riskSummary.length} items</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Risk Area</TableHead>
                  <TableHead className="text-center">Risk Level</TableHead>
                  <TableHead>Auditor Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.riskSummary.map((risk, idx) => (
                  <TableRow key={idx} data-testid={`row-risk-${idx}`}>
                    <TableCell className="font-medium">{risk.riskArea}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline" 
                        className={risk.riskLevel === "Significant" ? "border-red-500 text-red-600" : "border-orange-500 text-orange-600"}
                      >
                        {risk.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{risk.response}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="matters" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span>Key Audit Matters</span>
              <Badge variant="secondary" className="ml-2">{data.auditMatters.length} items</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Matter</TableHead>
                  <TableHead>Conclusion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.auditMatters.map((matter, idx) => (
                  <TableRow key={idx} data-testid={`row-matter-${idx}`}>
                    <TableCell className="font-medium">{matter.matter}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{matter.conclusion}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audit-trail" className="border rounded-lg" data-testid="accordion-audit-trail">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-500" />
              <span>Inspection Audit Trail</span>
              <Badge variant="secondary" className="ml-2">{data.phases.filter(p => p.signedOffBy).length} sign-offs</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3" data-testid="audit-trail-timeline">
              {data.phases
                .filter(p => p.signedOffBy && p.signedOffDate)
                .sort((a, b) => new Date(a.signedOffDate!).getTime() - new Date(b.signedOffDate!).getTime())
                .map((phase, idx) => (
                  <div key={phase.phase} className="flex items-start gap-3 relative" data-testid={`audit-trail-entry-${idx}`}>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        phase.status === "Completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {phase.status === "Completed" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      {idx < data.phases.filter(p => p.signedOffBy && p.signedOffDate).length - 1 && (
                        <div className="w-px h-6 bg-border mt-1" />
                      )}
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-medium" data-testid={`audit-trail-phase-${idx}`}>{phase.phase} - {phase.status}</p>
                      <p className="text-xs text-muted-foreground" data-testid={`audit-trail-detail-${idx}`}>
                        Signed off by <span className="font-medium">{phase.signedOffBy}</span> on {phase.signedOffDate}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {phase.completedItems}/{phase.totalItems} items completed
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Engagement Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Client Name</p>
              <p className="text-sm font-medium" data-testid="text-client-name">{client?.name || data.engagementInfo.clientName || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Engagement Code</p>
              <p className="text-sm font-medium" data-testid="text-engagement-code">{engagement?.engagementCode || data.engagementInfo.code || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Audit Opinion</p>
              <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700" data-testid="text-audit-opinion">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {data.engagementInfo.auditOpinion || "Unmodified"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Materiality</p>
              <p className="text-sm font-medium" data-testid="text-materiality">
                {data.keyMetrics.materialityAmount 
                  ? `PKR ${formatAccounting(data.keyMetrics.materialityAmount)}`
                  : "N/A"
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
