import { useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, RefreshCw, FileText, Target, Scale, Shield, 
  AlertTriangle, CheckCircle2, Clock, BarChart3, Info, Sparkles, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExecutionAccountHeadProgram } from "./ExecutionAuditProgramSection";

interface ProgramSummary {
  accountHead: string;
  description?: string;
  amount?: number;
  tbCoverage: string[];
  totalProcedures: number;
  completedProcedures: number;
  materialityStatus: "Material" | "Immaterial";
  riskLevel: "High" | "Medium" | "Low";
  sampleSize?: number;
  sampleMethod?: string;
  controlProcedures: number;
  substantiveProcedures: number;
  analyticalProcedures: number;
  aiSummary?: string;
  status: "pending" | "in-progress" | "completed";
}

interface ExecutionProgramSummaryProps {
  executionPrograms: ExecutionAccountHeadProgram[];
  onSyncFromPlanning?: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export function ExecutionProgramSummary({
  executionPrograms,
  onSyncFromPlanning
}: ExecutionProgramSummaryProps) {
  const [summaries, setSummaries] = useState<{ [key: string]: string }>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const programSummaries: ProgramSummary[] = executionPrograms.map(program => {
    const completedCount = program.procedures.filter(p => 
      p.conclusion === "satisfactory" || 
      p.conclusion === "satisfactory-further-work"
    ).length;

    const controlCount = program.procedures.filter(p => p.type === "Control").length;
    const substantiveCount = program.procedures.filter(p => p.type === "Substantive").length;
    const analyticalCount = program.procedures.filter(p => p.type === "Analytical").length;

    let status: "pending" | "in-progress" | "completed" = "pending";
    if (completedCount === program.procedures.length && program.procedures.length > 0) {
      status = "completed";
    } else if (completedCount > 0) {
      status = "in-progress";
    }

    return {
      accountHead: program.accountHead,
      description: program.description,
      amount: program.amount,
      tbCoverage: program.tbCoverage || [],
      totalProcedures: program.procedures.length,
      completedProcedures: completedCount,
      materialityStatus: program.materialityStatus,
      riskLevel: program.riskLevel,
      sampleSize: program.sampleSize,
      sampleMethod: program.sampleMethod,
      controlProcedures: controlCount,
      substantiveProcedures: substantiveCount,
      analyticalProcedures: analyticalCount,
      aiSummary: summaries[program.id],
      status
    };
  });

  const generateSummary = async (programId: string, program: ExecutionAccountHeadProgram) => {
    setLoadingSummary(programId);
    try {
      const context = `
Account Head: ${program.accountHead}
Description: ${program.description || "Not specified"}
Amount: ${program.amount ? formatCurrency(program.amount) : "Not specified"}
TB Coverage: ${program.tbCoverage?.join(", ") || "Not specified"}
Materiality Status: ${program.materialityStatus}
Risk Level: ${program.riskLevel}
Sample Size: ${program.sampleSize || "Not determined"}
Sample Method: ${program.sampleMethod || "Not specified"}
Assertions: ${program.assertions?.join(", ") || "All relevant assertions"}
Total Procedures: ${program.procedures.length}
- Control Tests: ${program.procedures.filter(p => p.type === "Control").length}
- Substantive Tests: ${program.procedures.filter(p => p.type === "Substantive").length}
- Analytical Procedures: ${program.procedures.filter(p => p.type === "Analytical").length}

Key Procedures:
${program.procedures.slice(0, 5).map(p => `- ${p.description} (${p.type})`).join('\n')}
      `;

      const response = await fetchWithAuth('/api/audit-program/generate-execution-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          context: `Generate a concise audit execution summary (2-3 sentences) for this account head, highlighting key focus areas, primary risks, and recommended testing approach based on ISA standards:\n${context}` 
        })
      });

      const data = await response.json();
      if (data.success && data.guidance) {
        setSummaries(prev => ({ ...prev, [programId]: data.guidance }));
        setErrorMessage(null);
      } else {
        setErrorMessage(`Failed to generate summary for ${program.accountHead}. Please try again.`);
      }
    } catch (error) {
      console.error("Failed to generate summary:", error);
      setErrorMessage(`Failed to generate AI summary. Please check your connection and try again.`);
    } finally {
      setLoadingSummary(null);
    }
  };

  const generateAllSummaries = async () => {
    setGeneratingAll(true);
    for (const program of executionPrograms) {
      if (!summaries[program.id]) {
        await generateSummary(program.id, program);
      }
    }
    setGeneratingAll(false);
  };

  const totalProcedures = programSummaries.reduce((acc, p) => acc + p.totalProcedures, 0);
  const completedProcedures = programSummaries.reduce((acc, p) => acc + p.completedProcedures, 0);
  const overallProgress = totalProcedures > 0 ? (completedProcedures / totalProcedures) * 100 : 0;

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "High": return <Badge variant="destructive">High Risk</Badge>;
      case "Medium": return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Medium Risk</Badge>;
      case "Low": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Low Risk</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getMaterialityBadge = (level: string) => {
    return level === "Material" 
      ? <Badge className="bg-blue-600">Material</Badge>
      : <Badge variant="outline">Immaterial</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "in-progress": return <Clock className="h-5 w-5 text-amber-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Program Summary
              </CardTitle>
              <CardDescription>
                Consolidated view of all account heads with materiality, risk, and sampling information from Planning Phase
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {errorMessage && (
                <Alert variant="destructive" className="py-2 px-3">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs ml-2">{errorMessage}</AlertDescription>
                </Alert>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={onSyncFromPlanning}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from Planning
              </Button>
              <Button
                size="sm"
                onClick={generateAllSummaries}
                disabled={generatingAll}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generatingAll ? "Generating..." : "Generate All Summaries"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  Account Heads
                </div>
                <div className="text-2xl font-bold">{executionPrograms.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Target className="h-4 w-4" />
                  Total Procedures
                </div>
                <div className="text-2xl font-bold">{totalProcedures}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Completed
                </div>
                <div className="text-2xl font-bold text-green-600">{completedProcedures}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  Progress
                </div>
                <div className="text-2xl font-bold">{overallProgress.toFixed(0)}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4">
            <Progress value={overallProgress} className="h-2" />
          </div>

          <Separator className="my-4" />

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead>Account Head</TableHead>
                <TableHead className="text-right">Amount (PKR)</TableHead>
                <TableHead className="text-center">Materiality</TableHead>
                <TableHead className="text-center">Risk</TableHead>
                <TableHead className="text-center">Sample</TableHead>
                <TableHead className="text-center">Procedures</TableHead>
                <TableHead className="text-center">Progress</TableHead>
                <TableHead className="w-[100px]">AI Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programSummaries.map((summary, index) => {
                const program = executionPrograms[index];
                return (
                  <TableRow 
                    key={program.id}
                    className={cn(
                      summary.riskLevel === "High" && "bg-red-50/30",
                      summary.status === "completed" && "bg-green-50/30"
                    )}
                  >
                    <TableCell>{getStatusIcon(summary.status)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{summary.accountHead}</div>
                      {summary.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{summary.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {summary.amount ? formatCurrency(summary.amount) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {getMaterialityBadge(summary.materialityStatus)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getRiskBadge(summary.riskLevel)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm">{summary.sampleSize || "-"}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xs">
                        <span title="Control Tests" className="px-1 bg-blue-100 rounded text-blue-700">C:{summary.controlProcedures}</span>
                        <span title="Substantive Tests" className="px-1 bg-purple-100 rounded text-purple-700">S:{summary.substantiveProcedures}</span>
                        <span title="Analytical" className="px-1 bg-green-100 rounded text-green-700">A:{summary.analyticalProcedures}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={summary.totalProcedures > 0 ? (summary.completedProcedures / summary.totalProcedures) * 100 : 0} 
                          className="h-2 w-16"
                        />
                        <span className="text-xs text-muted-foreground">
                          {summary.completedProcedures}/{summary.totalProcedures}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {loadingSummary === program.id ? (
                        <div className="flex items-center">
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ) : summary.aiSummary ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-blue-600">
                              <Info className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Brain className="h-5 w-5 text-blue-600" />
                                AI Summary: {summary.accountHead}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                <div className="p-2 bg-slate-50 rounded">
                                  <div className="text-muted-foreground text-xs">Amount</div>
                                  <div className="font-medium">{summary.amount ? formatCurrency(summary.amount) : "Not specified"}</div>
                                </div>
                                <div className="p-2 bg-slate-50 rounded">
                                  <div className="text-muted-foreground text-xs">Sample Size</div>
                                  <div className="font-medium">{summary.sampleSize || "Not determined"}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div className="p-2 bg-slate-50 rounded">
                                  <div className="text-muted-foreground text-xs">TB Coverage</div>
                                  <div className="font-medium text-xs">{summary.tbCoverage.slice(0, 2).join(", ") || "-"}</div>
                                </div>
                                <div className="p-2 bg-slate-50 rounded">
                                  <div className="text-muted-foreground text-xs">Materiality</div>
                                  <div>{getMaterialityBadge(summary.materialityStatus)}</div>
                                </div>
                                <div className="p-2 bg-slate-50 rounded">
                                  <div className="text-muted-foreground text-xs">Risk</div>
                                  <div>{getRiskBadge(summary.riskLevel)}</div>
                                </div>
                              </div>
                              <Separator />
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm">{summary.aiSummary}</p>
                              </div>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">ISA 330</Badge>
                                <Badge variant="outline">ISA 500</Badge>
                                <Badge variant="outline">ISA 530</Badge>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateSummary(program.id, program)}
                        >
                          <Brain className="h-4 w-4 mr-1" />
                          Generate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>ISA Compliance Note:</strong> This summary consolidates audit program information from the Planning Phase (ISA 300). 
                Sample sizes are determined based on risk assessment (ISA 530) and materiality (ISA 320). 
                Use the "Generate Summary" feature to get AI-assisted guidance on testing focus areas.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
