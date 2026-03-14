import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { USER_GUIDE_REGISTRY } from "@/lib/user-guide-registry";
import type { GuideModule, GuideModuleTab } from "@/lib/user-guide-registry";
import { GUIDE_SCREENSHOTS } from "@/lib/guide-screenshots";
import { logoToBase64 } from "@/lib/pdf-logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BookOpen, Download, AlertTriangle, CheckCircle2, Clock,
  ChevronRight, ChevronDown, Search, Plus, Shield, FileText,
  Info, ExternalLink, Lock, Users, Layers, ArrowRight, ImageIcon, ZoomIn
} from "lucide-react";

interface GuideIssue {
  id: string;
  firmId: string;
  moduleKey: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdById: string;
  createdBy: { fullName: string; role: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface VersionInfo {
  version: string;
  commitHash: string;
  buildDate: string;
  lastUpdated: string;
}

export default function UserGuide() {
  const { user, firm } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGuideTab, setActiveGuideTab] = useState("guide");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [issueDialog, setIssueDialog] = useState(false);
  const [newIssue, setNewIssue] = useState({ moduleKey: "", title: "", description: "", priority: "medium" });

  const { data: versionInfo, isLoading: versionLoading } = useQuery<VersionInfo>({
    queryKey: ["/api/version"],
  });

  const { data: guideIssues = [], isLoading: issuesLoading } = useQuery<GuideIssue[]>({
    queryKey: ["/api/guide-issues"],
  });

  const submitIssueMutation = useMutation({
    mutationFn: async (issue: { moduleKey: string; title: string; description: string; priority: string }) => {
      const res = await apiRequest("POST", "/api/guide-issues", issue);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guide-issues"] });
      setIssueDialog(false);
      setNewIssue({ moduleKey: "", title: "", description: "", priority: "medium" });
      toast({ title: "Issue submitted", description: "Your feedback has been recorded and is visible to the platform team." });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/guide-issues/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guide-issues"] });
    },
  });

  const toggleModule = (key: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const filteredModules = USER_GUIDE_REGISTRY.filter(m =>
    !searchQuery || 
    m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedModules = filteredModules.reduce((acc, m) => {
    const phase = m.phase || "Other";
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(m);
    return acc;
  }, {} as Record<string, GuideModule[]>);

  const phaseOrder = [
    "Firm Administration",
    "Client & Engagement",
    "Pre-Planning",
    "Information Gathering",
    "Planning",
    "Execution",
    "Finalization",
    "Reporting & Deliverables",
    "Quality Review (EQCR)",
    "Inspection & Archiving",
    "Cross-Phase Tools",
  ];

  const generatePDF = async () => {
    toast({ title: "Generating PDF...", description: "Please wait while the guide is prepared." });
    try {
      const jspdfModule = await import("jspdf");
      const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.autoTable || autoTableModule.default;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const allModulesGrouped = USER_GUIDE_REGISTRY.reduce((acc, m) => {
        const phase = m.phase || "Other";
        if (!acc[phase]) acc[phase] = [];
        acc[phase].push(m);
        return acc;
      }, {} as Record<string, GuideModule[]>);

      const firmName = firm?.name || "AuditWise";
      let coverLogoY = 50;
      if (firm?.logoUrl) {
        try {
          const b64 = await logoToBase64(firm.logoUrl);
          if (b64) {
            doc.addImage(b64, "PNG", 67.5, 25, 70, 25);
            coverLogoY = 60;
          }
        } catch {}
      }

      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text(firmName, 105, coverLogoY, { align: "center" });
      doc.setFontSize(18);
      doc.setFont("helvetica", "normal");
      doc.text("Live User Guide", 105, coverLogoY + 15, { align: "center" });
      doc.setFontSize(11);
      doc.text(`Version: ${versionInfo?.version || "1.0.0"}`, 105, coverLogoY + 32, { align: "center" });
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, 105, coverLogoY + 40, { align: "center" });
      doc.setFontSize(10);
      doc.text("Statutory Audit Management Software", 105, coverLogoY + 55, { align: "center" });
      doc.text(`${USER_GUIDE_REGISTRY.length} Modules Documented`, 105, coverLogoY + 63, { align: "center" });
      doc.setFontSize(9);
      doc.text("CONFIDENTIAL - For Internal Use Only", 105, coverLogoY + 80, { align: "center" });

      doc.addPage();
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Table of Contents", 20, 25);
      doc.setFontSize(10);
      let tocY = 40;
      let pageNum = 3;
      phaseOrder.forEach(phase => {
        const mods = allModulesGrouped[phase];
        if (!mods?.length) return;
        if (tocY > 265) { doc.addPage(); tocY = 25; }
        doc.setFont("helvetica", "bold");
        doc.text(phase, 20, tocY);
        tocY += 6;
        doc.setFont("helvetica", "normal");
        mods.forEach(m => {
          if (tocY > 275) { doc.addPage(); tocY = 25; }
          const dots = ".".repeat(Math.max(2, 60 - m.label.length));
          doc.text(`${m.label} ${dots} ${pageNum}`, 25, tocY);
          tocY += 5;
          pageNum++;
        });
        tocY += 3;
      });

      const checkPageBreak = (currentY: number, needed: number): number => {
        if (currentY + needed > 275) {
          doc.addPage();
          return 20;
        }
        return currentY;
      };

      USER_GUIDE_REGISTRY.forEach(mod => {
        doc.addPage();
        let y = 20;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(mod.label, 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Phase: ${mod.phase} | Route: ${mod.routePath}`, 20, y);
        y += 6;

        if (mod.isaReferences.length > 0) {
          doc.text(`ISA References: ${mod.isaReferences.join(", ")}`, 20, y);
          y += 6;
        }

        y = checkPageBreak(y, 15);
        doc.setFont("helvetica", "bold");
        doc.text("Purpose", 20, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const purposeLines = doc.splitTextToSize(mod.purpose, 170);
        doc.text(purposeLines, 20, y);
        y += purposeLines.length * 4 + 4;

        if (mod.prerequisites.length > 0) {
          y = checkPageBreak(y, 10 + mod.prerequisites.length * 4);
          doc.setFont("helvetica", "bold");
          doc.text("Prerequisites", 20, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          mod.prerequisites.forEach(p => {
            y = checkPageBreak(y, 5);
            doc.text(`- ${p}`, 25, y);
            y += 4;
          });
          y += 3;
        }

        if (mod.roles.length > 0) {
          y = checkPageBreak(y, 12);
          doc.setFont("helvetica", "bold");
          doc.text("Required Roles", 20, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          doc.text(mod.roles.join(", "), 25, y);
          y += 6;
        }

        if (mod.approvals.length > 0) {
          y = checkPageBreak(y, 10 + mod.approvals.length * 4);
          doc.setFont("helvetica", "bold");
          doc.text("Approvals & Gates", 20, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          mod.approvals.forEach(a => {
            y = checkPageBreak(y, 5);
            doc.text(`- ${a}`, 25, y);
            y += 4;
          });
          y += 3;
        }

        if (mod.locks.length > 0) {
          y = checkPageBreak(y, 10 + mod.locks.length * 4);
          doc.setFont("helvetica", "bold");
          doc.text("Lock Conditions", 20, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          mod.locks.forEach(l => {
            y = checkPageBreak(y, 5);
            doc.text(`- ${l}`, 25, y);
            y += 4;
          });
          y += 3;
        }

        if (mod.tabs.length > 0) {
          y = checkPageBreak(y, 30);
          doc.setFont("helvetica", "bold");
          doc.text("Tabs / Sub-Sections", 20, y);
          y += 6;

          const tabData = mod.tabs.map(t => [
            t.label,
            t.purpose.substring(0, 90) + (t.purpose.length > 90 ? "..." : ""),
            t.inputFields.slice(0, 3).join(", ") + (t.inputFields.length > 3 ? "..." : ""),
            t.buttons.join(", "),
          ]);

          autoTable(doc, {
            startY: y,
            head: [["Tab", "Purpose", "Key Inputs", "Actions"]],
            body: tabData,
            theme: "grid",
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [30, 64, 175], textColor: 255 },
            margin: { left: 20, right: 20 },
            columnStyles: {
              0: { cellWidth: 25 },
              1: { cellWidth: 65 },
              2: { cellWidth: 40 },
              3: { cellWidth: 40 },
            },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (mod.workedExample) {
          y = checkPageBreak(y, 20);
          doc.setFont("helvetica", "bold");
          doc.text("Worked Example (ABC & Co., FY2025)", 20, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          const exLines = doc.splitTextToSize(mod.workedExample, 170);
          doc.text(exLines, 20, y);
        }
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`${firmName} User Guide | Page ${i} of ${totalPages}`, 105, 290, { align: "center" });
      }

      doc.save(`${firmName.replace(/[^a-zA-Z0-9]/g, "_")}-User-Guide.pdf`);
      toast({ title: "Guide downloaded", description: `PDF with ${USER_GUIDE_REGISTRY.length} modules has been generated.` });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({ title: "Download failed", description: "Could not generate the PDF. Please try again.", variant: "destructive" });
    }
  };

  const renderModuleCard = (mod: GuideModule) => {
    const isExpanded = expandedModules.has(mod.key);
    const issueCount = guideIssues.filter(i => i.moduleKey === mod.key).length;
    
    return (
      <Card key={mod.key} className="mb-3" data-testid={`guide-module-${mod.key}`}>
        <Collapsible open={isExpanded} onOpenChange={() => toggleModule(mod.key)}>
          <CollapsibleTrigger className="w-full" data-testid={`toggle-module-${mod.key}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 px-3 cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="text-left min-w-0">
                  <CardTitle className="text-sm font-semibold">{mod.label}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{mod.purpose.substring(0, 100)}...</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {mod.isaReferences.map(isa => (
                  <Badge key={isa} variant="outline" className="text-[10px]">{isa}</Badge>
                ))}
                {issueCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{issueCount} issue{issueCount > 1 ? "s" : ""}</Badge>
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0 px-3 pb-4">
              <div className="space-y-2.5">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Purpose</h4>
                  <p className="text-sm">{mod.purpose}</p>
                </div>

                {(() => {
                  const screenshotSrc = mod.screenshot || GUIDE_SCREENSHOTS[mod.key];
                  if (!screenshotSrc) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <ImageIcon className="h-3 w-3" />
                        Module Preview
                      </h4>
                      <Dialog>
                        <DialogTrigger asChild>
                          <div className="relative group cursor-pointer rounded-md overflow-hidden border border-border/50 bg-muted/20" data-testid={`screenshot-${mod.key}`}>
                            <img
                              src={screenshotSrc}
                              alt={`${mod.label} screenshot`}
                              className="w-full h-auto max-h-[280px] object-cover object-top"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 rounded-full p-2 shadow-sm">
                                <ZoomIn className="h-4 w-4 text-foreground" />
                              </div>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-2">
                          <DialogHeader className="pb-0">
                            <DialogTitle className="text-sm">{mod.label}</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">Module screenshot preview</DialogDescription>
                          </DialogHeader>
                          <img
                            src={screenshotSrc}
                            alt={`${mod.label} screenshot`}
                            className="w-full h-auto rounded-md"
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  );
                })()}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {mod.prerequisites.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prerequisites</h4>
                      <ul className="text-sm space-y-0.5">
                        {mod.prerequisites.map((p, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {mod.roles.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Required Roles</h4>
                      <div className="flex flex-wrap gap-1">
                        {mod.roles.map(r => (
                          <Badge key={r} variant="secondary" className="text-[10px]">
                            <Users className="h-2.5 w-2.5 mr-1" />{r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {mod.approvals.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Approvals & Gates</h4>
                      <ul className="text-sm space-y-0.5">
                        {mod.approvals.map((a, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Shield className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {mod.locks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Lock Conditions</h4>
                      <ul className="text-sm space-y-0.5">
                        {mod.locks.map((l, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Lock className="h-3 w-3 mt-0.5 shrink-0 text-orange-500" />
                            {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {mod.isaReferences.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">ISA / ISQM References</h4>
                    <div className="flex flex-wrap gap-1">
                      {mod.isaReferences.map(isa => (
                        <Badge key={isa} variant="outline" className="text-[10px]">{isa}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Navigation Path</h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                    <span>AuditWise</span>
                    <ChevronRight className="h-3 w-3" />
                    {mod.routePath.startsWith("/workspace/") ? (
                      <>
                        <span>Workspace</span>
                        <ChevronRight className="h-3 w-3" />
                        <span className="font-medium text-foreground">{mod.label}</span>
                      </>
                    ) : (
                      <span className="font-medium text-foreground">{mod.label}</span>
                    )}
                  </div>
                  <code className="text-[10px] text-muted-foreground mt-0.5 block">{mod.routePath}</code>
                </div>
                
                {mod.tabs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tabs / Sub-Sections</h4>
                    <div className="space-y-2">
                      {mod.tabs.map(tab => (
                        <Card key={tab.key} className="bg-muted/30" data-testid={`guide-tab-${mod.key}-${tab.key}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Layers className="h-3.5 w-3.5 text-primary" />
                              <span className="text-sm font-medium">{tab.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{tab.purpose}</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {tab.inputFields.length > 0 && (
                                <div>
                                  <span className="font-medium">Input Fields:</span>
                                  <span className="text-muted-foreground ml-1">{tab.inputFields.join(", ")}</span>
                                </div>
                              )}
                              {tab.buttons.length > 0 && (
                                <div>
                                  <span className="font-medium">Actions:</span>
                                  <span className="text-muted-foreground ml-1">{tab.buttons.join(", ")}</span>
                                </div>
                              )}
                              {tab.autoPulled.length > 0 && (
                                <div>
                                  <span className="font-medium">Auto-Pulled:</span>
                                  <span className="text-muted-foreground ml-1">{tab.autoPulled.join(", ")}</span>
                                </div>
                              )}
                              {tab.outputs.length > 0 && (
                                <div>
                                  <span className="font-medium">Outputs:</span>
                                  <span className="text-muted-foreground ml-1">{tab.outputs.join(", ")}</span>
                                </div>
                              )}
                            </div>
                            
                            {tab.commonErrors.length > 0 && (
                              <div className="mt-1.5 text-xs">
                                <span className="font-medium text-orange-600 dark:text-orange-400">Common Errors:</span>
                                <span className="text-muted-foreground ml-1">{tab.commonErrors.join("; ")}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {mod.workedExample && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">Worked Example — ABC & Co. (Private) Limited, FY2025</span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300">{mod.workedExample}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="p-2.5 md:p-2.5 max-w-5xl mx-auto space-y-2.5" data-testid="page-user-guide">
      {(versionLoading || issuesLoading) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-spin" />
          Loading guide data...
        </div>
      )}
      <div className="flex items-start justify-between gap-2.5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold" data-testid="text-guide-title">AuditWise Live User Guide</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive guide to all modules, workflows, and features. Auto-generated from the current portal configuration.
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <span>Version: {versionInfo?.version || "1.0.0"}</span>
            <span>|</span>
            <span>Last Updated: {versionInfo?.lastUpdated ? new Date(versionInfo.lastUpdated).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Today"}</span>
            <span>|</span>
            <span>{USER_GUIDE_REGISTRY.length} Modules Documented</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generatePDF} data-testid="button-download-pdf">
            <Download className="h-4 w-4 mr-1.5" />
            Download Guide (PDF)
          </Button>
        </div>
      </div>
      
      <Tabs value={activeGuideTab} onValueChange={setActiveGuideTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="guide" className="gap-1.5" data-testid="tab-guide-content">
            <BookOpen className="h-3.5 w-3.5" />
            Guide Content
          </TabsTrigger>
          <TabsTrigger value="issues" className="gap-1.5" data-testid="tab-guide-issues">
            <AlertTriangle className="h-3.5 w-3.5" />
            Issues / Gaps
            {guideIssues.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">{guideIssues.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="guide" className="mt-2.5 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search modules, features, ISA references..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-guide-search"
            />
          </div>
          
          {phaseOrder.map(phase => {
            const mods = groupedModules[phase];
            if (!mods?.length) return null;
            return (
              <div key={phase}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {phase}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{mods.length} module{mods.length > 1 ? "s" : ""}</span>
                </div>
                {mods.map(renderModuleCard)}
              </div>
            );
          })}
        </TabsContent>
        
        <TabsContent value="issues" className="mt-2.5 space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 px-3">
              <div>
                <CardTitle className="text-sm">Issues & Gaps Tracker</CardTitle>
                <CardDescription className="text-xs">Report missing steps, screens, or documentation gaps by module.</CardDescription>
              </div>
              <Dialog open={issueDialog} onOpenChange={setIssueDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-report-issue">
                    <Plus className="h-4 w-4 mr-1" />
                    Report Issue
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Report an Issue or Gap</DialogTitle>
                    <DialogDescription>Describe a missing step, screen, or documentation gap you've identified.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <label className="text-sm font-medium">Module</label>
                      <Select value={newIssue.moduleKey} onValueChange={v => setNewIssue(prev => ({ ...prev, moduleKey: v }))}>
                        <SelectTrigger data-testid="select-issue-module">
                          <SelectValue placeholder="Select module" />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_GUIDE_REGISTRY.map(m => (
                            <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        placeholder="Brief description of the issue"
                        value={newIssue.title}
                        onChange={e => setNewIssue(prev => ({ ...prev, title: e.target.value }))}
                        data-testid="input-issue-title"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <Select value={newIssue.priority} onValueChange={v => setNewIssue(prev => ({ ...prev, priority: v }))}>
                        <SelectTrigger data-testid="select-issue-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Detailed description of the missing step, screen, or gap..."
                        value={newIssue.description}
                        onChange={e => setNewIssue(prev => ({ ...prev, description: e.target.value }))}
                        rows={4}
                        data-testid="input-issue-description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => submitIssueMutation.mutate(newIssue)}
                      disabled={!newIssue.moduleKey || !newIssue.title || !newIssue.description || submitIssueMutation.isPending}
                      data-testid="button-submit-issue"
                    >
                      {submitIssueMutation.isPending ? "Submitting..." : "Submit Issue"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
          </Card>
          
          {guideIssues.length === 0 ? (
            <Card>
              <CardContent className="py-2 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm font-medium">No issues reported</p>
                <p className="text-xs text-muted-foreground">All documentation appears to be complete.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {guideIssues.map(issue => {
                const mod = USER_GUIDE_REGISTRY.find(m => m.key === issue.moduleKey);
                return (
                  <Card key={issue.id} data-testid={`issue-card-${issue.id}`}>
                    <CardContent className="py-3 px-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{mod?.label || issue.moduleKey}</Badge>
                            <Badge
                              variant={
                                issue.status === "fixed" || issue.status === "resolved" ? "default" :
                                issue.status === "in_review" ? "secondary" :
                                issue.status === "acknowledged" ? "outline" :
                                "destructive"
                              }
                              className="text-[10px]"
                            >
                              {issue.status === "open" ? "Open" :
                               issue.status === "in_review" ? "In Review" :
                               issue.status === "acknowledged" ? "Acknowledged" :
                               issue.status === "resolved" ? "Resolved" : "Fixed"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                issue.priority === "critical" ? "border-red-500 text-red-600" :
                                issue.priority === "high" ? "border-orange-500 text-orange-600" :
                                issue.priority === "medium" ? "border-yellow-500 text-yellow-600" :
                                "border-gray-400 text-gray-500"
                              }`}
                            >
                              {issue.priority?.charAt(0).toUpperCase() + issue.priority?.slice(1) || "Medium"}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{issue.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            By: {issue.createdBy?.fullName || "Unknown"} · {new Date(issue.createdAt).toLocaleDateString("en-GB")}
                          </p>
                        </div>
                        {user?.role === "admin" || user?.role === "partner" ? (
                          <Select
                            value={issue.status}
                            onValueChange={status => updateStatusMutation.mutate({ id: issue.id, status })}
                          >
                            <SelectTrigger className="w-[120px]" data-testid={`select-status-${issue.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_review">In Review</SelectItem>
                              <SelectItem value="acknowledged">Acknowledged</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}