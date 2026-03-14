import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, XCircle, Clock, AlertTriangle, Download,
  FileText, Shield, RefreshCw
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuth } from "@/lib/auth";

interface ISAStandard {
  isa: string;
  title: string;
  status: "COMPLIANT" | "NON_COMPLIANT" | "IN_PROGRESS" | "NOT_STARTED";
  evidence: string;
}

interface ISAComplianceSummary {
  total: number;
  compliant: number;
  inProgress: number;
  nonCompliant: number;
  notStarted: number;
  complianceScore: number;
}

interface ISAComplianceMatrixProps {
  engagementId: string;
}

export function ISAComplianceMatrix({ engagementId }: ISAComplianceMatrixProps) {
  const { firm } = useAuth();
  const [standards, setStandards] = useState<ISAStandard[]>([]);
  const [summary, setSummary] = useState<ISAComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompliance();
  }, [engagementId]);

  const fetchCompliance = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`/api/qcr/isa-compliance/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setStandards(data.standards);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error("Error fetching ISA compliance:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLIANT":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "NON_COMPLIANT":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLIANT":
        return <Badge className="bg-green-100 text-green-700">Compliant</Badge>;
      case "NON_COMPLIANT":
        return <Badge variant="destructive">Non-Compliant</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-yellow-100 text-yellow-700">In Progress</Badge>;
      default:
        return <Badge variant="secondary">Not Started</Badge>;
    }
  };

  const exportToCSV = () => {
    const firmName = firm?.displayName || firm?.name || "AuditWise";
    const headers = ["ISA", "Title", "Status", "Evidence"];
    const rows = standards.map(s => [s.isa, s.title, s.status, s.evidence]);
    const allRows = [
      [`"${firmName}"`],
      [`"ISA Compliance Matrix"`],
      [`"Generated: ${new Date().toLocaleDateString()}"`],
      [],
      headers.map(h => `"${h}"`),
      ...rows.map(row => row.map(cell => `"${cell}"`))
    ];
    const csv = allRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${firmName.replace(/\s+/g, '_')}_isa-compliance-${engagementId}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-2.5">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading ISA compliance matrix...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            ISA Compliance Matrix
          </h2>
          <p className="text-sm text-muted-foreground">
            Compliance status with International Standards on Auditing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchCompliance}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-5 gap-2.5">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-xl font-bold text-primary">{summary.complianceScore}%</p>
                <p className="text-xs text-muted-foreground">Compliance Score</p>
              </div>
              <Progress value={summary.complianceScore} className="mt-2" />
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xl font-bold text-green-600">{summary.compliant}</p>
                  <p className="text-xs text-muted-foreground">Compliant</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-xl font-bold text-yellow-600">{summary.inProgress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-xl font-bold text-red-600">{summary.nonCompliant}</p>
                  <p className="text-xs text-muted-foreground">Non-Compliant</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xl font-bold">{summary.notStarted}</p>
                  <p className="text-xs text-muted-foreground">Not Started</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Standards Compliance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Standard</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Evidence / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standards.map((standard) => (
                <TableRow key={standard.isa}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(standard.status)}
                      <span className="font-mono font-medium">{standard.isa}</span>
                    </div>
                  </TableCell>
                  <TableCell>{standard.title}</TableCell>
                  <TableCell>{getStatusBadge(standard.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{standard.evidence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default ISAComplianceMatrix;
