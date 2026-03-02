import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  CheckCircle2, XCircle, Clock, AlertTriangle, Download,
  FileSearch, Shield, RefreshCw, ClipboardCheck
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface QCRCheck {
  id: string;
  checkCategory: string;
  checkItem: string;
  isaReference: string;
  status: string;
  isCompliant: boolean | null;
  evidenceRef: string | null;
  comments: string | null;
}

interface CategorySummary {
  category: string;
  isaReference: string;
  totalItems: number;
  compliant: number;
  nonCompliant: number;
  notChecked: number;
}

interface QCROverall {
  totalItems: number;
  compliantItems: number;
  nonCompliantItems: number;
  notCheckedItems: number;
  readinessScore: number;
}

interface QCRReadinessReportProps {
  engagementId: string;
}

export function QCRReadinessReport({ engagementId }: QCRReadinessReportProps) {
  const [checks, setChecks] = useState<QCRCheck[]>([]);
  const [summary, setSummary] = useState<CategorySummary[]>([]);
  const [overall, setOverall] = useState<QCROverall | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReadiness();
  }, [engagementId]);

  const fetchReadiness = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`/api/qcr/qcr-readiness/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setChecks(data.checks);
        setSummary(data.summary);
        setOverall(data.overall);
      }
    } catch (error) {
      console.error("Error fetching QCR readiness:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeChecklist = async () => {
    try {
      const res = await fetchWithAuth(`/api/qcr/qcr-readiness/${engagementId}/initialize`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchReadiness();
      }
    } catch (error) {
      console.error("Error initializing checklist:", error);
    }
  };

  const updateCheck = async (checkId: string, isCompliant: boolean) => {
    try {
      const res = await fetchWithAuth(`/api/qcr/qcr-readiness/${checkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompliant, status: "CHECKED" }),
      });
      if (res.ok) {
        setChecks(checks.map(c => 
          c.id === checkId ? { ...c, isCompliant, status: "CHECKED" } : c
        ));
        await fetchReadiness();
      }
    } catch (error) {
      console.error("Error updating check:", error);
    }
  };

  const getReadinessColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getCategoryProgress = (cat: CategorySummary) => {
    if (cat.totalItems === 0) return 0;
    return Math.round((cat.compliant / cat.totalItems) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading QCR readiness report...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            QCR Readiness Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Quality Control Review readiness assessment per ICAP/AOB requirements
          </p>
        </div>
        <div className="flex items-center gap-2">
          {checks.length === 0 && (
            <Button onClick={initializeChecklist}>
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Initialize Checklist
            </Button>
          )}
          <Button variant="outline" onClick={fetchReadiness}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {overall && (
        <div className="grid grid-cols-5 gap-4">
          <Card className="col-span-1">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className={`text-4xl font-bold ${getReadinessColor(overall.readinessScore)}`}>
                  {overall.readinessScore}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">QCR Readiness</p>
              </div>
              <Progress 
                value={overall.readinessScore} 
                className="mt-3"
              />
              <div className="mt-2 text-center">
                {overall.readinessScore >= 80 ? (
                  <Badge className="bg-green-100 text-green-700">Ready for QCR</Badge>
                ) : overall.readinessScore >= 60 ? (
                  <Badge className="bg-yellow-100 text-yellow-700">Needs Attention</Badge>
                ) : (
                  <Badge variant="destructive">Not Ready</Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{overall.compliantItems}</p>
                  <p className="text-xs text-muted-foreground">Compliant Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-6 w-6 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{overall.nonCompliantItems}</p>
                  <p className="text-xs text-muted-foreground">Non-Compliant</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-gray-400" />
                <div>
                  <p className="text-2xl font-bold">{overall.notCheckedItems}</p>
                  <p className="text-xs text-muted-foreground">Not Checked</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{overall.totalItems}</p>
                  <p className="text-xs text-muted-foreground">Total Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {summary.map((cat) => (
                <div key={cat.category} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{cat.category}</span>
                    <Badge variant="outline" className="text-xs">{cat.isaReference}</Badge>
                  </div>
                  <Progress value={getCategoryProgress(cat)} className="h-2 mb-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="text-green-600">{cat.compliant} passed</span>
                    <span className="text-red-600">{cat.nonCompliant} failed</span>
                    <span>{cat.notChecked} pending</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {checks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Checklist Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {summary.map((cat) => {
                const categoryChecks = checks.filter(c => c.checkCategory === cat.category);
                return (
                  <AccordionItem key={cat.category} value={cat.category}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-medium">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{cat.isaReference}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {cat.compliant}/{cat.totalItems}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Status</TableHead>
                            <TableHead>Check Item</TableHead>
                            <TableHead className="w-24">ISA Ref</TableHead>
                            <TableHead className="w-32">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryChecks.map((check) => (
                            <TableRow key={check.id}>
                              <TableCell>
                                {check.isCompliant === true ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : check.isCompliant === false ? (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                ) : (
                                  <Clock className="h-5 w-5 text-gray-400" />
                                )}
                              </TableCell>
                              <TableCell>{check.checkItem}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{check.isaReference}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant={check.isCompliant === true ? "default" : "outline"}
                                    className="h-7 px-2"
                                    onClick={() => updateCheck(check.id, true)}
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={check.isCompliant === false ? "destructive" : "outline"}
                                    className="h-7 px-2"
                                    onClick={() => updateCheck(check.id, false)}
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default QCRReadinessReport;
