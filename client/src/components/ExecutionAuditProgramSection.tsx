import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, FileText, AlertTriangle, CheckCircle2, Trash2, 
  ClipboardList, Upload, Eye, FileCheck, FileX, 
  Download, Lock, AlertCircle, Paperclip, RefreshCw,
  Shield, BarChart3, Target, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountHeadProgram, AuditProcedure } from "./AuditProgramSection";

export interface WorkingPaperAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  uploadedDate: string;
  url?: string;
}

export interface ExecutionProcedure extends AuditProcedure {
  workingPapers: WorkingPaperAttachment[];
  conclusion: "pending" | "satisfactory" | "satisfactory-further-work" | "unsatisfactory-misstatement" | "unsatisfactory-control-deficiency";
  conclusionRemarks: string;
  conclusionDate: string;
  conclusionBy: string;
  isReviewed: boolean;
  reviewedByRole: string;
  reviewNotes: string;
  linkedFindingId: string;
}

export interface ExecutionAccountHeadProgram extends Omit<AccountHeadProgram, 'procedures'> {
  procedures: ExecutionProcedure[];
  syncedFromPlanning: boolean;
  lastSyncDate: string;
}

interface ExecutionAuditProgramSectionProps {
  planningPrograms: AccountHeadProgram[];
  executionPrograms: ExecutionAccountHeadProgram[];
  onExecutionProgramsChange: (programs: ExecutionAccountHeadProgram[]) => void;
  currentUserRole: string;
  currentUserId: string;
  isLocked?: boolean;
  onSyncFromPlanning?: () => void;
}

const CONCLUSION_OPTIONS = [
  { value: "pending", label: "Pending", color: "text-gray-500", isaRef: "" },
  { value: "satisfactory", label: "Satisfactory", color: "text-green-600", isaRef: "ISA 500" },
  { value: "satisfactory-further-work", label: "Satisfactory – Additional Work Required", color: "text-amber-600", isaRef: "ISA 330" },
  { value: "unsatisfactory-misstatement", label: "Unsatisfactory – Potential Misstatement", color: "text-red-600", isaRef: "ISA 450" },
  { value: "unsatisfactory-control-deficiency", label: "Unsatisfactory – Control Deficiency", color: "text-orange-600", isaRef: "ISA 265" }
];

const defaultTeamMembers = [
  { id: "partner", name: "Engagement Partner", role: "Partner" },
  { id: "manager", name: "Audit Manager", role: "Manager" },
  { id: "senior", name: "Senior Auditor", role: "Senior" },
  { id: "staff", name: "Staff Auditor", role: "Staff" },
];

export function ExecutionAuditProgramSection({ 
  planningPrograms,
  executionPrograms, 
  onExecutionProgramsChange,
  currentUserRole,
  currentUserId,
  isLocked = false,
  onSyncFromPlanning
}: ExecutionAuditProgramSectionProps) {
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File[] }>({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState<string | null>(null);
  const [viewAttachmentsOpen, setViewAttachmentsOpen] = useState<string | null>(null);

  const canEdit = (procedurePerformedBy: string) => {
    const higherRoles = ["Partner", "Manager", "Senior"];
    return procedurePerformedBy === currentUserId || 
           higherRoles.includes(currentUserRole) ||
           currentUserRole === "Admin";
  };

  const canReview = () => {
    return ["Partner", "Manager"].includes(currentUserRole);
  };

  const syncFromPlanning = () => {
    const syncedPrograms: ExecutionAccountHeadProgram[] = planningPrograms.map(planningProgram => {
      const existingExecution = executionPrograms.find(ep => ep.id === planningProgram.id);
      
      const executionProcedures: ExecutionProcedure[] = planningProgram.procedures.map(proc => {
        const existingProc = existingExecution?.procedures.find(ep => ep.id === proc.id);
        return {
          ...proc,
          workingPapers: existingProc?.workingPapers || [],
          conclusion: existingProc?.conclusion || "pending",
          conclusionRemarks: existingProc?.conclusionRemarks || "",
          conclusionDate: existingProc?.conclusionDate || "",
          conclusionBy: existingProc?.conclusionBy || "",
          isReviewed: existingProc?.isReviewed || false,
          reviewedByRole: existingProc?.reviewedByRole || "",
          reviewNotes: existingProc?.reviewNotes || "",
          linkedFindingId: existingProc?.linkedFindingId || ""
        };
      });

      return {
        ...planningProgram,
        procedures: executionProcedures,
        syncedFromPlanning: true,
        lastSyncDate: new Date().toISOString()
      };
    });

    onExecutionProgramsChange(syncedPrograms);
    onSyncFromPlanning?.();
  };

  useEffect(() => {
    if (executionPrograms.length === 0 && planningPrograms.length > 0) {
      syncFromPlanning();
    }
  }, [planningPrograms]);

  const updateProcedure = (programId: string, procedureId: string, updates: Partial<ExecutionProcedure>) => {
    const updatedPrograms = executionPrograms.map(p => {
      if (p.id === programId) {
        return {
          ...p,
          procedures: p.procedures.map(proc => 
            proc.id === procedureId ? { ...proc, ...updates } : proc
          )
        };
      }
      return p;
    });
    onExecutionProgramsChange(updatedPrograms);
  };

  const handleFileSelect = (procedureId: string, files: FileList | null) => {
    if (files) {
      setSelectedFiles(prev => ({
        ...prev,
        [procedureId]: [...(prev[procedureId] || []), ...Array.from(files)]
      }));
    }
  };

  const uploadWorkingPapers = (programId: string, procedureId: string) => {
    const files = selectedFiles[procedureId] || [];
    if (files.length === 0) return;

    const newAttachments: WorkingPaperAttachment[] = files.map((file, idx) => ({
      id: `wp-${Date.now()}-${idx}`,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedBy: currentUserRole,
      uploadedDate: new Date().toISOString()
    }));

    const program = executionPrograms.find(p => p.id === programId);
    const procedure = program?.procedures.find(p => p.id === procedureId);
    
    if (procedure) {
      updateProcedure(programId, procedureId, {
        workingPapers: [...procedure.workingPapers, ...newAttachments]
      });
    }

    setSelectedFiles(prev => ({ ...prev, [procedureId]: [] }));
    setUploadDialogOpen(null);
  };

  const removeWorkingPaper = (programId: string, procedureId: string, attachmentId: string) => {
    const program = executionPrograms.find(p => p.id === programId);
    const procedure = program?.procedures.find(p => p.id === procedureId);
    
    if (procedure) {
      updateProcedure(programId, procedureId, {
        workingPapers: procedure.workingPapers.filter(wp => wp.id !== attachmentId)
      });
    }
  };

  const handleConclusionChange = (programId: string, procedureId: string, conclusion: string) => {
    updateProcedure(programId, procedureId, {
      conclusion: conclusion as ExecutionProcedure['conclusion'],
      conclusionDate: new Date().toISOString(),
      conclusionBy: currentUserRole
    });
  };

  const markAsReviewed = (programId: string, procedureId: string) => {
    updateProcedure(programId, procedureId, {
      isReviewed: true,
      reviewedByRole: currentUserRole
    });
  };

  const completedCount = useMemo(() => 
    executionPrograms.reduce((acc, p) => 
      acc + p.procedures.filter(proc => 
        proc.conclusion !== "pending" && proc.workingPapers.length > 0
      ).length, 0
    ), [executionPrograms]
  );
  
  const totalProcedures = useMemo(() => 
    executionPrograms.reduce((acc, p) => acc + p.procedures.length, 0),
    [executionPrograms]
  );
  
  const progressPercent = totalProcedures > 0 ? Math.round((completedCount / totalProcedures) * 100) : 0;

  const satisfactoryCount = useMemo(() =>
    executionPrograms.reduce((acc, p) => 
      acc + p.procedures.filter(proc => proc.conclusion === "satisfactory").length, 0
    ), [executionPrograms]
  );

  const unsatisfactoryCount = useMemo(() =>
    executionPrograms.reduce((acc, p) => 
      acc + p.procedures.filter(proc => 
        proc.conclusion === "unsatisfactory-misstatement" || 
        proc.conclusion === "unsatisfactory-control-deficiency"
      ).length, 0
    ), [executionPrograms]
  );

  const furtherWorkCount = useMemo(() =>
    executionPrograms.reduce((acc, p) => 
      acc + p.procedures.filter(proc => proc.conclusion === "satisfactory-further-work").length, 0
    ), [executionPrograms]
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              <div>
                <CardTitle>Audit Program Execution</CardTitle>
                <CardDescription>
                  Execution of approved Audit Program from Planning Phase. Document evidence and conclusions per ISA 330, 500, 230.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isLocked && (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Locked
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={syncFromPlanning}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from Planning
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Progress</p>
                    <p className="text-2xl font-bold">{progressPercent}%</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-500" />
                </div>
                <Progress value={progressPercent} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {completedCount} of {totalProcedures} procedures completed
                </p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Satisfactory</p>
                    <p className="text-2xl font-bold text-green-600">{satisfactoryCount}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Further Work</p>
                    <p className="text-2xl font-bold text-amber-600">{furtherWorkCount}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-900/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unsatisfactory</p>
                    <p className="text-2xl font-bold text-red-600">{unsatisfactoryCount}</p>
                  </div>
                  <FileX className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>ISA Compliance:</strong> Each procedure requires working paper evidence (ISA 230) before conclusion. 
              Conclusions must be documented with supporting remarks (ISA 500). Manager/Partner review locks the conclusion (ISA 220, ISQM-1).
            </AlertDescription>
          </Alert>

          <Accordion type="multiple" className="w-full">
            {executionPrograms.map((program) => {
              const programCompleted = program.procedures.filter(p => p.conclusion !== "pending" && p.workingPapers.length > 0).length;
              const programTotal = program.procedures.length;
              const programProgress = programTotal > 0 ? Math.round((programCompleted / programTotal) * 100) : 0;

              return (
                <AccordionItem key={program.id} value={program.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{program.accountHead}</span>
                        <Badge variant={program.materialityStatus === "Material" ? "default" : "secondary"}>
                          {program.materialityStatus}
                        </Badge>
                        <Badge variant={
                          program.riskLevel === "High" ? "destructive" : 
                          program.riskLevel === "Medium" ? "outline" : "secondary"
                        }>
                          {program.riskLevel} Risk
                        </Badge>
                        {program.isClubbed && (
                          <Badge variant="outline" className="text-orange-600">Clubbed</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={programProgress} className="w-24 h-2" />
                        <span className="text-sm text-muted-foreground">
                          {programCompleted}/{programTotal} completed
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">TB Coverage</Label>
                          <p>{program.tbCoverage.join(", ")}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Relevant Assertions</Label>
                          <p>{program.assertions.join(", ")}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Risk Linkage</Label>
                          <p>Inherent Risk: {program.riskLevel}</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label className="font-medium">Audit Procedures - Execution & Evidence</Label>

                        {program.procedures.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No procedures synced from Planning. Click "Sync from Planning" to load.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {program.procedures.map((procedure, idx) => {
                              const hasEvidence = procedure.workingPapers.length > 0;
                              const hasConcluded = procedure.conclusion !== "pending";
                              const isComplete = hasEvidence && hasConcluded;
                              const needsRemarks = procedure.conclusion !== "pending" && 
                                procedure.conclusion !== "satisfactory" && 
                                !procedure.conclusionRemarks;
                              const isEditable = canEdit(procedure.performedBy) && !procedure.isReviewed && !isLocked;

                              return (
                                <div 
                                  key={procedure.id} 
                                  className={cn(
                                    "border rounded-lg p-4 space-y-4",
                                    procedure.isReviewed && "bg-green-50/50 dark:bg-green-900/10 border-green-200",
                                    (procedure.conclusion === "unsatisfactory-misstatement" || procedure.conclusion === "unsatisfactory-control-deficiency") && "border-red-200 bg-red-50/30"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                      <span className="text-sm font-mono text-muted-foreground mt-1">{idx + 1}.</span>
                                      <div className="flex-1 space-y-2">
                                        <p className="text-sm">{procedure.description}</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge variant="outline" className="text-xs">
                                            {procedure.type}
                                          </Badge>
                                          {procedure.isaReference && (
                                            <Badge variant="secondary" className="text-xs">
                                              {procedure.isaReference}
                                            </Badge>
                                          )}
                                          {procedure.isReviewed && (
                                            <Badge className="bg-green-600 text-xs gap-1">
                                              <Lock className="h-3 w-3" />
                                              Reviewed by {procedure.reviewedByRole}
                                            </Badge>
                                          )}
                                          {isComplete && !procedure.isReviewed && (
                                            <Badge variant="outline" className="text-green-600 text-xs">
                                              Ready for Review
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {hasEvidence ? (
                                        <Badge variant="outline" className="text-green-600 gap-1">
                                          <Paperclip className="h-3 w-3" />
                                          {procedure.workingPapers.length} file(s)
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-amber-600 gap-1">
                                          <AlertCircle className="h-3 w-3" />
                                          No evidence
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Status</Label>
                                      <p className="font-medium">{procedure.status === "not-started" ? "Not Started" : 
                                        procedure.status === "in-progress" ? "In Progress" : 
                                        procedure.status === "completed" ? "Completed" : "N/A"}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">W/P Reference</Label>
                                      <p>{procedure.workpaperRef || "-"}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Performed By</Label>
                                      <p>{procedure.performedBy || "-"}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Reviewed By</Label>
                                      <p>{procedure.reviewedBy || "-"}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Findings</Label>
                                      <p className="truncate">{procedure.findings || "-"}</p>
                                    </div>
                                  </div>

                                  <Separator />

                                  <div className="space-y-4 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <Shield className="h-4 w-4 text-blue-600" />
                                      <Label className="font-medium text-blue-800 dark:text-blue-300">
                                        Evidence & Conclusion (Execution Phase Only)
                                      </Label>
                                    </div>

                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">Working Paper Attachments</Label>
                                        <div className="flex items-center gap-2">
                                          <Dialog 
                                            open={viewAttachmentsOpen === procedure.id} 
                                            onOpenChange={(open) => setViewAttachmentsOpen(open ? procedure.id : null)}
                                          >
                                            <DialogTrigger asChild>
                                              <Button variant="outline" size="sm" disabled={procedure.workingPapers.length === 0}>
                                                <Eye className="h-4 w-4 mr-1" />
                                                View ({procedure.workingPapers.length})
                                              </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-lg">
                                              <DialogHeader>
                                                <DialogTitle>Working Paper Attachments</DialogTitle>
                                              </DialogHeader>
                                              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                                {procedure.workingPapers.map((wp) => (
                                                  <div key={wp.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                      <FileText className="h-8 w-8 text-blue-500" />
                                                      <div>
                                                        <p className="font-medium text-sm">{wp.fileName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                          {formatFileSize(wp.fileSize)} • Uploaded by {wp.uploadedBy}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                          {new Date(wp.uploadedDate).toLocaleDateString()}
                                                        </p>
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <Button variant="ghost" size="icon">
                                                        <Download className="h-4 w-4" />
                                                      </Button>
                                                      {isEditable && (
                                                        <Button 
                                                          variant="ghost" 
                                                          size="icon" 
                                                          className="text-destructive"
                                                          onClick={() => removeWorkingPaper(program.id, procedure.id, wp.id)}
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </DialogContent>
                                          </Dialog>

                                          <Dialog 
                                            open={uploadDialogOpen === procedure.id} 
                                            onOpenChange={(open) => {
                                              setUploadDialogOpen(open ? procedure.id : null);
                                              if (!open) setSelectedFiles(prev => ({ ...prev, [procedure.id]: [] }));
                                            }}
                                          >
                                            <DialogTrigger asChild>
                                              <Button 
                                                variant="outline" 
                                                size="sm" 
                                                disabled={!isEditable}
                                              >
                                                <Upload className="h-4 w-4 mr-1" />
                                                Upload
                                              </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                              <DialogHeader>
                                                <DialogTitle>Upload Working Papers</DialogTitle>
                                              </DialogHeader>
                                              <div className="space-y-4">
                                                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                                                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                                  <p className="text-sm text-muted-foreground mb-2">
                                                    Drag and drop files here, or click to select
                                                  </p>
                                                  <Input
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    id={`file-upload-${procedure.id}`}
                                                    onChange={(e) => handleFileSelect(procedure.id, e.target.files)}
                                                  />
                                                  <Button 
                                                    variant="outline"
                                                    onClick={() => document.getElementById(`file-upload-${procedure.id}`)?.click()}
                                                  >
                                                    Select Files
                                                  </Button>
                                                </div>

                                                {(selectedFiles[procedure.id] || []).length > 0 && (
                                                  <div className="space-y-2">
                                                    <Label>Selected Files:</Label>
                                                    {selectedFiles[procedure.id].map((file, fidx) => (
                                                      <div key={fidx} className="flex items-center justify-between p-2 bg-muted rounded">
                                                        <div className="flex items-center gap-2">
                                                          <FileText className="h-4 w-4" />
                                                          <span className="text-sm">{file.name}</span>
                                                          <span className="text-xs text-muted-foreground">
                                                            ({formatFileSize(file.size)})
                                                          </span>
                                                        </div>
                                                        <Button 
                                                          variant="ghost" 
                                                          size="icon"
                                                          onClick={() => setSelectedFiles(prev => ({
                                                            ...prev,
                                                            [procedure.id]: prev[procedure.id].filter((_, i) => i !== fidx)
                                                          }))}
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                              <DialogFooter>
                                                <DialogClose asChild>
                                                  <Button variant="outline">Cancel</Button>
                                                </DialogClose>
                                                <Button 
                                                  onClick={() => uploadWorkingPapers(program.id, procedure.id)}
                                                  disabled={(selectedFiles[procedure.id] || []).length === 0}
                                                >
                                                  Upload {(selectedFiles[procedure.id] || []).length} File(s)
                                                </Button>
                                              </DialogFooter>
                                            </DialogContent>
                                          </Dialog>
                                        </div>
                                      </div>

                                      {!hasEvidence && (
                                        <Alert variant="destructive" className="py-2">
                                          <AlertCircle className="h-4 w-4" />
                                          <AlertDescription className="text-xs">
                                            Working paper evidence is mandatory before recording conclusion (ISA 230).
                                          </AlertDescription>
                                        </Alert>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-sm">
                                          Conclusion <span className="text-destructive">*</span>
                                        </Label>
                                        <Select 
                                          value={procedure.conclusion}
                                          onValueChange={(v) => handleConclusionChange(program.id, procedure.id, v)}
                                          disabled={!isEditable || !hasEvidence}
                                        >
                                          <SelectTrigger className={cn(
                                            procedure.conclusion === "satisfactory" && "border-green-500",
                                            (procedure.conclusion === "unsatisfactory-misstatement" || procedure.conclusion === "unsatisfactory-control-deficiency") && "border-red-500",
                                            procedure.conclusion === "satisfactory-further-work" && "border-amber-500"
                                          )}>
                                            <SelectValue placeholder="Select conclusion..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {CONCLUSION_OPTIONS.map(opt => (
                                              <SelectItem key={opt.value} value={opt.value}>
                                                <span className={opt.color}>{opt.label}</span>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {procedure.conclusionDate && (
                                          <p className="text-xs text-muted-foreground">
                                            Concluded by {procedure.conclusionBy} on {new Date(procedure.conclusionDate).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>

                                      <div className="space-y-2">
                                        <Label className="text-sm">
                                          Conclusion Remarks
                                          {procedure.conclusion !== "pending" && procedure.conclusion !== "satisfactory" && (
                                            <span className="text-destructive"> *</span>
                                          )}
                                        </Label>
                                        <Textarea
                                          value={procedure.conclusionRemarks}
                                          onChange={(e) => updateProcedure(program.id, procedure.id, { 
                                            conclusionRemarks: e.target.value 
                                          })}
                                          placeholder={procedure.conclusion === "satisfactory" 
                                            ? "Optional remarks..." 
                                            : "Remarks are mandatory for this conclusion type..."}
                                          rows={2}
                                          disabled={!isEditable}
                                          className={cn(needsRemarks && "border-red-500")}
                                        />
                                        {needsRemarks && (
                                          <p className="text-xs text-red-500">
                                            Remarks are mandatory when conclusion is not "Satisfactory"
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {canReview() && isComplete && !procedure.isReviewed && (
                                      <div className="flex justify-end pt-2">
                                        <Button 
                                          onClick={() => markAsReviewed(program.id, procedure.id)}
                                          className="bg-green-600 hover:bg-green-700"
                                        >
                                          <Lock className="h-4 w-4 mr-2" />
                                          Mark as Reviewed & Lock
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

export function createDefaultExecutionPrograms(planningPrograms: AccountHeadProgram[]): ExecutionAccountHeadProgram[] {
  return planningPrograms.map(program => ({
    ...program,
    procedures: program.procedures.map(proc => ({
      ...proc,
      workingPapers: [],
      conclusion: "pending" as const,
      conclusionRemarks: "",
      conclusionDate: "",
      conclusionBy: "",
      isReviewed: false,
      reviewedByRole: "",
      reviewNotes: "",
      linkedFindingId: ""
    })),
    syncedFromPlanning: true,
    lastSyncDate: new Date().toISOString()
  }));
}
