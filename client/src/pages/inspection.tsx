import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { SignOffBar } from "@/components/sign-off-bar";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";
import { useEngagement } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuth } from "@/lib/auth";
import { getDocumentHeaderHtml } from "@/lib/pdf-logo";
import {
  Archive, Shield, Lock, FileText, CheckCircle2, AlertTriangle,
  Package, Printer, RefreshCw, Eye, Clock, UserCheck, ArrowRight,
  Activity, AlertCircle, FileCheck, History, ClipboardList,
  Search, FolderArchive, BookOpen, Download, Sparkles, BarChart3
} from "lucide-react";

interface ArchiveStats {
  archiveStatus: string;
  archiveSealedAt: string | null;
  archiveReleasedAt: string | null;
  readinessScore: number;
  readinessIssues: any[];
  phaseLockStatus: Record<string, string>;
  metrics: {
    totalPhases: number;
    completedPhases: number;
    totalWorkpapers: number;
    totalFindings: number;
    openItems: number;
    totalAdjustments: number;
    checklistTotal: number;
    checklistCompleted: number;
    risksTotal: number;
    risksAddressed: number;
    testsTotal: number;
    testsWithConclusions: number;
    deliverablesTotal: number;
    deliverablesFinal: number;
    auditTrailEntries: number;
    exportCount: number;
  };
  eqcrStatus: string;
  eqcrClearance: string;
  reportSigned: boolean;
  recentExports: any[];
  engagement: {
    code: string;
    clientName: string;
    periodStart?: string;
    periodEnd?: string;
    status?: string;
  };
}

export default function Inspection() {
  const params = useParams<{ engagementId: string }>();
  const { engagementId: contextEngagementId, engagement, client, refreshEngagement } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();
  const { firm, user } = useAuth();
  const roleGuard = usePhaseRoleGuard("inspection", "INSPECTION");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [archive, setArchive] = useState<any>(null);
  const [archiveIndex, setArchiveIndex] = useState<any>(null);
  const [finalReports, setFinalReports] = useState<any>(null);
  const [reviewHistory, setReviewHistory] = useState<any>(null);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [workingPapers, setWorkingPapers] = useState<any>(null);
  const [exportLogs, setExportLogs] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isSealed = archive?.status === "SEALED" || archive?.status === "RELEASED";
  const isReleased = archive?.status === "RELEASED";
  const isPartner = user?.role === "PARTNER" || user?.role === "FIRM_ADMIN" || user?.role === "SUPER_ADMIN";

  const fetchStats = useCallback(async () => {
    if (!engagementId) return;
    try {
      const res = await fetchWithAuth(`/api/inspection/${engagementId}/stats`);
      if (res.ok) {
        const result = await res.json();
        if (result.success) setStats(result.data);
      }
    } catch (e) { console.error("Failed to fetch stats:", e); }
  }, [engagementId]);

  const fetchArchive = useCallback(async () => {
    if (!engagementId) return;
    try {
      const res = await fetchWithAuth(`/api/inspection/${engagementId}/archive`);
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setArchive(result.data);
          if (result.data?.archiveIndex) setArchiveIndex(result.data.archiveIndex);
        }
      }
    } catch (e) { console.error("Failed to fetch archive:", e); }
  }, [engagementId]);

  const fetchTabData = useCallback(async (tab: string) => {
    if (!engagementId) return;
    try {
      if (tab === "reports" && !finalReports) {
        const res = await fetchWithAuth(`/api/inspection/${engagementId}/final-reports`);
        if (res.ok) { const r = await res.json(); if (r.success) setFinalReports(r.data); }
      } else if (tab === "review" && !reviewHistory) {
        const res = await fetchWithAuth(`/api/inspection/${engagementId}/review-history`);
        if (res.ok) { const r = await res.json(); if (r.success) setReviewHistory(r.data); }
      } else if (tab === "trail" && auditTrail.length === 0) {
        const res = await fetchWithAuth(`/api/inspection/${engagementId}/audit-trail`);
        if (res.ok) { const r = await res.json(); if (r.success) setAuditTrail(r.data); }
      } else if (tab === "papers" && !workingPapers) {
        const res = await fetchWithAuth(`/api/inspection/${engagementId}/working-papers`);
        if (res.ok) { const r = await res.json(); if (r.success) setWorkingPapers(r.data); }
      } else if (tab === "exports" && exportLogs.length === 0) {
        const res = await fetchWithAuth(`/api/inspection/${engagementId}/exports`);
        if (res.ok) { const r = await res.json(); if (r.success) setExportLogs(r.data); }
      }
    } catch (e) { console.error("Failed to fetch tab data:", e); }
  }, [engagementId, finalReports, reviewHistory, auditTrail, workingPapers, exportLogs]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchArchive()]);
      setLoading(false);
    };
    init();
  }, [fetchStats, fetchArchive]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  const handleBuildArchive = async () => {
    setActionLoading("build");
    try {
      const res = await fetchWithAuth(`/api/inspection/${engagementId}/archive/build`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await res.json();
      if (res.ok && result.success) {
        setArchive(result.data);
        toast({ title: "Archive Built", description: "Archive package has been assembled." });
        await fetchStats();
      } else {
        toast({ title: "Build Failed", description: result.error || "Failed to build archive.", variant: "destructive" });
      }
    } catch (e) { toast({ title: "Error", description: "Failed to build archive.", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleSealArchive = async () => {
    setActionLoading("seal");
    try {
      const res = await fetchWithAuth(`/api/inspection/${engagementId}/archive/seal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await res.json();
      if (res.ok && result.success) {
        setArchive(result.data);
        toast({ title: "Archive Sealed", description: "Engagement file is now immutable. No further modifications allowed." });
        await fetchStats();
      } else {
        toast({ title: "Seal Failed", description: result.error || "Failed to seal archive.", variant: "destructive" });
      }
    } catch (e) { toast({ title: "Error", description: "Failed to seal archive.", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleReleaseArchive = async () => {
    setActionLoading("release");
    try {
      const res = await fetchWithAuth(`/api/inspection/${engagementId}/archive/release`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await res.json();
      if (res.ok && result.success) {
        setArchive(result.data);
        toast({ title: "Archive Released", description: "Engagement has been transitioned to ARCHIVED state." });
        await fetchStats();
        refreshEngagement?.();
      } else {
        toast({ title: "Release Failed", description: result.error || "Failed to release archive.", variant: "destructive" });
      }
    } catch (e) { toast({ title: "Error", description: "Failed to release archive.", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleGenerateIndex = async () => {
    setActionLoading("index");
    try {
      const res = await fetchWithAuth(`/api/inspection/${engagementId}/archive/generate-index`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await res.json();
      if (res.ok && result.success) {
        setArchiveIndex(result.data);
        toast({ title: "Index Generated", description: "Archive index has been generated for inspection retrieval." });
      } else {
        toast({ title: "Index Failed", description: result.error || "Failed to generate index.", variant: "destructive" });
      }
    } catch (e) { toast({ title: "Error", description: "Failed to generate index.", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleCheckReadiness = async () => {
    setActionLoading("readiness");
    try {
      const res = await fetchWithAuth(`/api/inspection/${engagementId}/readiness`);
      if (res.ok) {
        toast({ title: "Readiness Refreshed", description: "Inspection readiness score has been recalculated." });
        await fetchStats();
      }
    } catch (e) { toast({ title: "Error", description: "Failed to check readiness.", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleAIAnalysis = async (type: "completeness" | "gap") => {
    setActionLoading(`ai-${type}`);
    try {
      const endpoint = type === "completeness" ? "generate-completeness-analysis" : "generate-gap-summary";
      const res = await fetchWithAuth(`/api/inspection/${engagementId}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await res.json();
      if (res.ok && result.success) {
        toast({ title: "AI Analysis Complete", description: result.data?.content?.slice(0, 100) || "Analysis generated." });
      } else {
        toast({ title: "AI Analysis Failed", description: result.error || "AI capability unavailable.", variant: "destructive" });
      }
    } catch (e) { toast({ title: "Error", description: "Failed to run AI analysis.", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handleExport = async (exportType: string) => {
    setActionLoading("export");
    try {
      const firmName = firm?.displayName || firm?.name || "AuditWise";
      const packageContent = {
        firmName,
        exportDate: new Date().toISOString(),
        engagementId,
        clientName: client?.name || "",
        engagementCode: engagement?.engagementCode || "",
        archiveStatus: archive?.status || "PENDING",
        frozenSnapshot: archive?.frozenSnapshot,
        archiveIndex,
        stats,
      };
      const blob = new Blob([JSON.stringify(packageContent, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${firmName.replace(/\s+/g, "_")}_Archive_${engagement?.engagementCode || "export"}_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await fetchWithAuth(`/api/inspection/${engagementId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType, exportFormat: "JSON" }),
      });

      toast({ title: "Export Complete", description: "Archive package has been downloaded." });
    } catch (e) { toast({ title: "Export Failed", description: "Unable to export.", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  const handlePrintArchive = async () => {
    setActionLoading("print");
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const headerHtml = await getDocumentHeaderHtml(firm?.logoUrl, firm?.name);
      const m = stats?.metrics;
      const printContent = document.createElement("div");
      printContent.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
          <div style="margin-bottom: 30px; border-bottom: 3px solid #1a365d; padding-bottom: 20px;">
            ${headerHtml}
            <h1 style="color: #1a365d; margin-bottom: 10px; font-size: 24px; text-align: center;">INSPECTION ARCHIVE</h1>
            <h2 style="color: #4a5568; font-weight: normal; font-size: 16px; text-align: center;">Immutable Engagement File</h2>
            <p style="color: #718096; font-size: 12px; text-align: center;">Generated: ${new Date().toLocaleString()}</p>
          </div>
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">Engagement Details</h3>
            <table style="width: 100%; font-size: 12px;">
              <tr><td style="padding: 4px 0;"><strong>Client:</strong></td><td>${client?.name || "N/A"}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Code:</strong></td><td>${engagement?.engagementCode || "N/A"}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Archive Status:</strong></td><td>${archive?.status || "PENDING"}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Readiness Score:</strong></td><td>${stats?.readinessScore || 0}%</td></tr>
            </table>
          </div>
          <div style="margin-bottom: 20px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">Key Metrics</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 8px; background: #edf2f7; border: 1px solid #e2e8f0; text-align: center;"><strong>Evidence Files</strong><br/>${m?.totalWorkpapers || 0}</td>
                <td style="padding: 8px; background: #edf2f7; border: 1px solid #e2e8f0; text-align: center;"><strong>Findings</strong><br/>${m?.totalFindings || 0}</td>
                <td style="padding: 8px; background: #edf2f7; border: 1px solid #e2e8f0; text-align: center;"><strong>Open Items</strong><br/>${m?.openItems || 0}</td>
                <td style="padding: 8px; background: #edf2f7; border: 1px solid #e2e8f0; text-align: center;"><strong>Audit Trail</strong><br/>${m?.auditTrailEntries || 0}</td>
              </tr>
            </table>
          </div>
          <div style="margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
              <div style="text-align: center; width: 30%;"><div style="border-bottom: 1px solid #2d3748; margin-bottom: 8px; height: 40px;"></div><p style="font-size: 11px;"><strong>Prepared By</strong></p></div>
              <div style="text-align: center; width: 30%;"><div style="border-bottom: 1px solid #2d3748; margin-bottom: 8px; height: 40px;"></div><p style="font-size: 11px;"><strong>Reviewed By</strong></p></div>
              <div style="text-align: center; width: 30%;"><div style="border-bottom: 1px solid #2d3748; margin-bottom: 8px; height: 40px;"></div><p style="font-size: 11px;"><strong>Partner Approval</strong></p></div>
            </div>
          </div>
        </div>
      `;
      await html2pdf().set({
        margin: 10,
        filename: `Archive_${engagement?.engagementCode || "export"}_${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      }).from(printContent).save();
      toast({ title: "Print Complete", description: "Archive PDF has been generated." });
    } catch (e) { toast({ title: "Print Failed", description: "Unable to generate PDF.", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="w-full px-3 py-3 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const m = stats?.metrics;

  return (
    <div className="w-full px-3 py-3 space-y-2.5">
      <SignOffBar phase="INSPECTION" section="inspection" className="mb-1" />
<div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
            <Archive className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">Inspection Archive</h1>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {client?.name} {engagement?.engagementCode && `(${engagement.engagementCode})`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate hidden md:block">
              Final immutable archive — ISA 220 / ISA 230 / ISQM 1
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <Badge variant="outline" className="text-xs"><Shield className="h-3 w-3 mr-1" />ISA 220</Badge>
          <Badge variant="outline" className="text-xs"><FileText className="h-3 w-3 mr-1" />ISA 230</Badge>
          <Badge variant="outline" className="text-xs"><Activity className="h-3 w-3 mr-1" />ISQM 1</Badge>
          {isSealed && (
            <Badge variant="outline" className="h-6 text-xs bg-purple-50 border-purple-200 text-purple-700">
              <Lock className="h-3 w-3 mr-1" />{isReleased ? "Archived" : "Sealed"}
            </Badge>
          )}
        </div>
      </div>

      {isSealed && (
        <Card className="border-purple-200 bg-purple-50/30 dark:bg-purple-950/20">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-purple-800 dark:text-purple-200">
                  {isReleased ? "Archive Released — Engagement Archived" : "Archive Sealed — Read Only"}
                </p>
                <p className="text-purple-700 dark:text-purple-300">
                  {isReleased
                    ? "This engagement has been archived. The file is immutable and ready for regulatory inspection."
                    : "The archive is sealed. No modifications are allowed. Release to finalize archival."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="dashboard"><BarChart3 className="h-3.5 w-3.5" />Dashboard</TabsTrigger>
          <TabsTrigger value="reports"><FileText className="h-3.5 w-3.5" />Final Reports</TabsTrigger>
          <TabsTrigger value="documents"><FileCheck className="h-3.5 w-3.5" />Key Documents</TabsTrigger>
          <TabsTrigger value="trail"><History className="h-3.5 w-3.5" />Audit Trail</TabsTrigger>
          <TabsTrigger value="papers"><ClipboardList className="h-3.5 w-3.5" />Working Papers</TabsTrigger>
          <TabsTrigger value="review"><Eye className="h-3.5 w-3.5" />Review History</TabsTrigger>
          <TabsTrigger value="index"><Search className="h-3.5 w-3.5" />Archive Index</TabsTrigger>
          <TabsTrigger value="exports"><FolderArchive className="h-3.5 w-3.5" />Export & Release</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-2.5 mt-2.5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard icon={<BarChart3 className="h-4 w-4 text-blue-500" />} label="Readiness" value={`${stats?.readinessScore || 0}%`} />
            <MetricCard icon={<FileText className="h-4 w-4 text-indigo-500" />} label="Evidence Files" value={m?.totalWorkpapers || 0} />
            <MetricCard icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} label="Findings" value={m?.totalFindings || 0} />
            <MetricCard icon={<AlertCircle className="h-4 w-4 text-red-500" />} label="Open Items" value={m?.openItems || 0} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard icon={<ClipboardList className="h-4 w-4 text-green-500" />} label="Checklists" value={`${m?.checklistCompleted || 0}/${m?.checklistTotal || 0}`} />
            <MetricCard icon={<Shield className="h-4 w-4 text-violet-500" />} label="Risks Covered" value={`${m?.risksAddressed || 0}/${m?.risksTotal || 0}`} />
            <MetricCard icon={<CheckCircle2 className="h-4 w-4 text-teal-500" />} label="Tests Concluded" value={`${m?.testsWithConclusions || 0}/${m?.testsTotal || 0}`} />
            <MetricCard icon={<History className="h-4 w-4 text-gray-500" />} label="Audit Trail" value={m?.auditTrailEntries || 0} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-5 w-5" />Archive Lifecycle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: "Build", done: !!archive, status: archive?.status },
                  { label: "Readiness ≥80%", done: (stats?.readinessScore || 0) >= 80 },
                  { label: "Sealed", done: archive?.status === "SEALED" || archive?.status === "RELEASED" },
                  { label: "Released", done: archive?.status === "RELEASED" },
                ].map((step, idx, arr) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${step.done ? "bg-green-50 border-green-200 dark:bg-green-950/30" : "bg-muted/30"}`}>
                      {step.done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                      <p className={`text-sm font-medium ${step.done ? "text-green-800 dark:text-green-200" : "text-muted-foreground"}`}>{step.label}</p>
                    </div>
                    {idx < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {(stats?.readinessIssues?.length ?? 0) > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-700">
                  <AlertTriangle className="h-5 w-5" />Readiness Issues ({stats!.readinessIssues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats!.readinessIssues.map((issue: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <span>
                        {issue.type === "OPEN_REVIEW_NOTES" && `${issue.count} open review note(s)`}
                        {issue.type === "INCOMPLETE_CHECKLISTS" && `Checklists ${issue.percentage}% complete`}
                        {issue.type === "UNADDRESSED_RISKS" && `${issue.count} unaddressed risk(s)`}
                        {issue.type === "TESTS_WITHOUT_CONCLUSIONS" && `${issue.count} test(s) without conclusions`}
                        {issue.type === "EQCR_NOT_CLEARED" && "EQCR not cleared"}
                        {issue.type === "REPORT_NOT_SIGNED" && "Audit report not signed"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleCheckReadiness} disabled={!!actionLoading}>
              {actionLoading === "readiness" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh Readiness
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAIAnalysis("completeness")} disabled={!!actionLoading || isSealed}>
              {actionLoading === "ai-completeness" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              AI Completeness
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAIAnalysis("gap")} disabled={!!actionLoading || isSealed}>
              {actionLoading === "ai-gap" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              AI Gap Analysis
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-2.5 mt-2.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Final Audit Reports</CardTitle>
              <CardDescription>Signed reports and issued deliverables</CardDescription>
            </CardHeader>
            <CardContent>
              {finalReports?.report ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">Audit Report</p>
                      <p className="text-sm text-muted-foreground">
                        Opinion: {finalReports.report.opinionType || "N/A"} |
                        Signed: {finalReports.report.signedBy?.fullName || "Not signed"} |
                        {finalReports.report.signedDate ? ` Date: ${new Date(finalReports.report.signedDate).toLocaleDateString()}` : " Unsigned"}
                      </p>
                    </div>
                    <Badge className={finalReports.report.signedById ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                      {finalReports.report.signedById ? "Signed" : "Unsigned"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No audit report found.</p>
              )}
            </CardContent>
          </Card>

          {finalReports?.deliverables?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Deliverables Register</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Deliverable</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalReports.deliverables.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name || d.title || "Untitled"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.type || "N/A"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={
                            d.status === "ISSUED" || d.status === "FINALIZED" ? "bg-green-50 text-green-700" :
                            d.status === "APPROVED" ? "bg-blue-50 text-blue-700" : ""
                          }>
                            {d.status || "DRAFT"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {finalReports?.signedReport && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">EQCR Signed Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <FileCheck className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="font-medium">{finalReports.signedReport.fileName || "Signed Report"}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded: {new Date(finalReports.signedReport.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-2.5 mt-2.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Key Signed Documents</CardTitle>
              <CardDescription>Critical documents that form part of the archive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Engagement Letter", status: "SIGNED", icon: <FileText className="h-5 w-5 text-blue-500" /> },
                  { label: "Independence Declarations", status: "COMPLETE", icon: <Shield className="h-5 w-5 text-green-500" /> },
                  { label: "Client Acceptance Form", status: "APPROVED", icon: <UserCheck className="h-5 w-5 text-indigo-500" /> },
                  { label: "Audit Report (Signed)", status: stats?.reportSigned ? "SIGNED" : "PENDING", icon: <FileCheck className="h-5 w-5 text-teal-500" /> },
                  { label: "EQCR Clearance", status: stats?.eqcrClearance || "PENDING", icon: <CheckCircle2 className="h-5 w-5 text-violet-500" /> },
                  { label: "Completion Memorandum", status: "FILED", icon: <BookOpen className="h-5 w-5 text-orange-500" /> },
                ].map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      {doc.icon}
                      <span className="text-sm font-medium">{doc.label}</span>
                    </div>
                    <Badge variant="outline" className={
                      ["SIGNED", "COMPLETE", "APPROVED", "CLEARED", "CLEARED_WITH_CONDITIONS", "FILED"].includes(doc.status)
                        ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }>
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Engagement Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Client</p>
                  <p className="text-sm font-medium">{client?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Code</p>
                  <p className="text-sm font-medium">{engagement?.engagementCode || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">EQCR Status</p>
                  <Badge variant="outline">{stats?.eqcrStatus || "N/A"}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">File Status</p>
                  <Badge variant="outline" className={isReleased ? "bg-purple-50 text-purple-700" : isSealed ? "bg-blue-50 text-blue-700" : ""}>
                    {isReleased ? "ARCHIVED" : isSealed ? "SEALED" : engagement?.status || "ACTIVE"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trail" className="space-y-2.5 mt-2.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-5 w-5" />
                Audit Trail Log
                <Badge variant="secondary" className="ml-2">{auditTrail.length} entries</Badge>
              </CardTitle>
              <CardDescription>Complete audit trail for engagement history reproducibility</CardDescription>
            </CardHeader>
            <CardContent>
              {auditTrail.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Justification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditTrail.map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{entry.entityType}</TableCell>
                          <TableCell className="text-xs">{entry.user?.fullName || "System"}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{entry.justification || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No audit trail entries found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="papers" className="space-y-2.5 mt-2.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-5 w-5" />
                Working Paper Freeze Snapshot
                <Badge variant="secondary" className="ml-2">{workingPapers?.summary?.totalWorkpapers || 0} papers</Badge>
              </CardTitle>
              <CardDescription>Frozen snapshot of all working papers at time of archive</CardDescription>
            </CardHeader>
            <CardContent>
              {workingPapers?.workpapers?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Reference</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workingPapers.workpapers.map((wp: any) => (
                      <TableRow key={wp.id}>
                        <TableCell className="font-mono text-xs">{wp.reference || "-"}</TableCell>
                        <TableCell className="text-sm">{wp.title || "Untitled"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{wp.status || "N/A"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{new Date(wp.updatedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No working papers found.</p>
              )}
            </CardContent>
          </Card>

          {workingPapers?.evidenceFiles?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  Evidence Files
                  <Badge variant="secondary">{workingPapers.evidenceFiles.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>File Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workingPapers.evidenceFiles.slice(0, 50).map((ef: any) => (
                      <TableRow key={ef.id}>
                        <TableCell className="text-sm">{ef.fileName}</TableCell>
                        <TableCell className="text-xs">{ef.category || "-"}</TableCell>
                        <TableCell className="text-xs">{ef.fileType || "-"}</TableCell>
                        <TableCell className="text-xs">{new Date(ef.uploadedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="review" className="space-y-2.5 mt-2.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Review History Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewHistory ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold">{reviewHistory.summary?.totalReviewNotes || 0}</p>
                    <p className="text-xs text-muted-foreground">Review Notes</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold">{reviewHistory.summary?.openReviewNotes || 0}</p>
                    <p className="text-xs text-muted-foreground">Open Notes</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold">{reviewHistory.summary?.totalEqcrComments || 0}</p>
                    <p className="text-xs text-muted-foreground">EQCR Comments</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading review history...</p>
              )}
            </CardContent>
          </Card>

          {reviewHistory?.reviewNotes?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Review Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Title</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewHistory.reviewNotes.slice(0, 50).map((note: any) => (
                      <TableRow key={note.id}>
                        <TableCell className="text-sm font-medium">{note.title || "Untitled"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            note.priority === "HIGH" ? "border-red-500 text-red-600" :
                            note.priority === "MEDIUM" ? "border-amber-500 text-amber-600" : ""
                          }>
                            {note.priority || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={
                            note.status === "RESOLVED" || note.status === "CLOSED" ? "bg-green-50 text-green-700" :
                            note.status === "OPEN" ? "bg-red-50 text-red-700" : ""
                          }>
                            {note.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{note.createdByUser?.fullName || "-"}</TableCell>
                        <TableCell className="text-xs">{new Date(note.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {reviewHistory?.sectionSignOffs?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Section Sign-offs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Section</TableHead>
                      <TableHead>Prepared By</TableHead>
                      <TableHead>Reviewed By</TableHead>
                      <TableHead>Partner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewHistory.sectionSignOffs.map((so: any) => (
                      <TableRow key={so.id}>
                        <TableCell className="text-sm font-medium">{so.section || so.phase || "-"}</TableCell>
                        <TableCell className="text-xs">{so.preparedBy?.fullName || "-"}</TableCell>
                        <TableCell className="text-xs">{so.reviewedBy?.fullName || "-"}</TableCell>
                        <TableCell className="text-xs">{so.partnerApproval?.fullName || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="index" className="space-y-2.5 mt-2.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-5 w-5" />
                Inspection-Ready Archive Index
              </CardTitle>
              <CardDescription>Structured index for regulator / inspection retrieval (AOB / ICAP)</CardDescription>
            </CardHeader>
            <CardContent>
              {archiveIndex?.sections ? (
                <div className="space-y-2.5">
                  {archiveIndex.sections.map((section: any) => (
                    <div key={section.ref} className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm mb-2">
                        <Badge variant="outline" className="mr-2">{section.ref}</Badge>
                        {section.title}
                      </h4>
                      <div className="space-y-1">
                        {section.items.map((item: any) => (
                          <div key={item.ref} className="flex items-center justify-between text-sm pl-4">
                            <span className="text-muted-foreground">
                              <span className="font-mono text-xs mr-2">{item.ref}</span>
                              {item.description}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {typeof item.count === "number" ? `${item.count} items` : "-"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {archiveIndex.totals && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 pt-2">
                      {Object.entries(archiveIndex.totals).map(([key, val]) => (
                        <div key={key} className="text-center p-2 bg-muted/30 rounded">
                          <p className="text-lg font-bold">{val as number}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No archive index has been generated yet.</p>
                  {isPartner && (
                    <Button onClick={handleGenerateIndex} disabled={!!actionLoading}>
                      {actionLoading === "index" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                      Generate Archive Index
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {archiveIndex && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleGenerateIndex} disabled={!!actionLoading}>
                <RefreshCw className="h-4 w-4 mr-2" />Regenerate Index
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="exports" className="space-y-2.5 mt-2.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Archive Actions</CardTitle>
              <CardDescription>
                {isReleased ? "Engagement is archived — export packages for inspection" :
                 isSealed ? "Archive is sealed — release to finalize" :
                 "Build, seal, and release the archive package"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {!isSealed && isPartner && (
                  <>
                    {!archive || archive.status === "PENDING" ? (
                      <Button onClick={handleBuildArchive} disabled={!!actionLoading}>
                        {actionLoading === "build" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
                        Build Archive Package
                      </Button>
                    ) : archive.status === "BUILDING" ? (
                      <Button onClick={handleSealArchive} disabled={!!actionLoading}>
                        {actionLoading === "seal" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                        Seal Archive
                      </Button>
                    ) : null}
                  </>
                )}

                {isSealed && !isReleased && isPartner && (
                  <Button onClick={handleReleaseArchive} disabled={!!actionLoading} variant="default">
                    {actionLoading === "release" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FolderArchive className="h-4 w-4 mr-2" />}
                    Release Archive
                  </Button>
                )}

                <Button variant="outline" onClick={() => handleExport("FULL_ARCHIVE")} disabled={!!actionLoading}>
                  {actionLoading === "export" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Export Package
                </Button>
                <Button variant="outline" onClick={handlePrintArchive} disabled={!!actionLoading}>
                  {actionLoading === "print" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                  Print Archive PDF
                </Button>
              </div>

              {archive && (
                <Separator />
              )}

              {archive && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className={
                      archive.status === "RELEASED" ? "bg-purple-50 text-purple-700" :
                      archive.status === "SEALED" ? "bg-blue-50 text-blue-700" :
                      archive.status === "BUILDING" ? "bg-amber-50 text-amber-700" : ""
                    }>
                      {archive.status}
                    </Badge>
                  </div>
                  {archive.sealedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Sealed</p>
                      <p className="text-sm">{new Date(archive.sealedAt).toLocaleString()}</p>
                      {archive.sealedBy && <p className="text-xs text-muted-foreground">{archive.sealedBy.fullName}</p>}
                    </div>
                  )}
                  {archive.releasedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Released</p>
                      <p className="text-sm">{new Date(archive.releasedAt).toLocaleString()}</p>
                      {archive.releasedBy && <p className="text-xs text-muted-foreground">{archive.releasedBy.fullName}</p>}
                    </div>
                  )}
                  {archive.packageHash && (
                    <div>
                      <p className="text-xs text-muted-foreground">Integrity Hash</p>
                      <p className="font-mono text-xs">{archive.packageHash}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {exportLogs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Export History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Exported By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportLogs.map((exp: any) => (
                      <TableRow key={exp.id}>
                        <TableCell className="text-xs">{new Date(exp.exportedDate || exp.createdAt).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{exp.exportType}</Badge></TableCell>
                        <TableCell className="text-xs">{exp.exportFormat || "JSON"}</TableCell>
                        <TableCell className="text-xs">{exp.exportedBy?.fullName || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="py-3 px-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
