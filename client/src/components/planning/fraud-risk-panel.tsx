import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  AlertTriangle, Shield, Loader2, AlertCircle, FileText,
  Users, Eye, Scale, CheckCircle2
} from "lucide-react";

interface FraudRiskPanelProps {
  engagementId: string;
  readOnly?: boolean;
  onFieldChange?: (field: string, value: any) => void;
  planningData?: any;
}

export function FraudRiskPanel({ engagementId, readOnly, onFieldChange, planningData }: FraudRiskPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "fraud-indicators"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/fraud-indicators`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading fraud risk assessment...</span>
      </div>
    );
  }

  const fraudData = data || {};
  const brainstormingNotes = planningData?.fraudBrainstormingNotes || "";
  const managementOverrideResponse = planningData?.managementOverrideResponse || "";
  const fraudTriangleIncentive = planningData?.fraudTriangleIncentive || "";
  const fraudTriangleOpportunity = planningData?.fraudTriangleOpportunity || "";
  const fraudTriangleRationalization = planningData?.fraudTriangleRationalization || "";
  const revenueRiskRebuttal = planningData?.revenueRiskRebuttal || "";

  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Fraud Risk Assessment (ISA 240)
            </CardTitle>
            <Badge variant="outline" className="text-xs">ISA 240</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Assess fraud risks including presumed risks, management override, and suspicious indicators auto-detected from Data Intake.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Presumed Fraud Risks (ISA 240.26 & .31)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Risk Area</TableHead>
                <TableHead className="text-xs">ISA Reference</TableHead>
                <TableHead className="text-xs text-center">Presumed</TableHead>
                <TableHead className="text-xs text-center">Rebutted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(fraudData.presumedRisks || []).map((risk: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs font-medium">{risk.area}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{risk.isa}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="destructive" className="text-[10px]">Presumed</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {risk.rebutted ? (
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Rebutted</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Active</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {fraudData.presumedRisks?.[0] && !fraudData.presumedRisks[0].rebutted && (
            <div className="mt-3">
              <Label className="text-xs">Revenue Recognition Risk Rebuttal (if applicable)</Label>
              <Textarea
                value={revenueRiskRebuttal}
                onChange={(e) => onFieldChange?.("revenueRiskRebuttal", e.target.value)}
                placeholder="Document reason if revenue recognition risk is rebutted..."
                className="mt-1 text-xs min-h-[60px]"
                disabled={readOnly}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold">Manual Journal Entries</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{fraudData.suspiciousJournals || 0}</p>
            <p className="text-[10px] text-muted-foreground">Manual entries detected in GL</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold">Period-End Entries</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{fraudData.periodEndEntries || 0}</p>
            <p className="text-[10px] text-muted-foreground">Entries within 30 days of year-end</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold">Related Party</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{fraudData.relatedPartyTransactions || 0}</p>
            <p className="text-[10px] text-muted-foreground">Related party records found</p>
          </CardContent>
        </Card>
      </div>

      {(fraudData.fraudRisks || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Identified Fraud Risks ({fraudData.fraudRisks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Risk Description</TableHead>
                  <TableHead className="text-xs">FS Area</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Inherent Risk</TableHead>
                  <TableHead className="text-xs">Planned Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fraudData.fraudRisks.map((risk: any) => (
                  <TableRow key={risk.id}>
                    <TableCell className="text-xs">{risk.riskDescription || risk.accountOrClass}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{risk.fsArea || "—"}</Badge></TableCell>
                    <TableCell><Badge className="text-[10px] bg-red-500">{risk.fraudRiskType?.replace(/_/g, " ") || "—"}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={risk.inherentRisk === "HIGH" || risk.inherentRisk === "SIGNIFICANT" ? "destructive" : "secondary"} className="text-[10px]">
                        {risk.inherentRisk}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{risk.fraudResponse || "Not documented"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Fraud Triangle Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs font-medium">Incentive / Pressure</Label>
            <Textarea
              value={fraudTriangleIncentive}
              onChange={(e) => onFieldChange?.("fraudTriangleIncentive", e.target.value)}
              placeholder="Document management incentives or pressures that could lead to fraud..."
              className="mt-1 text-xs min-h-[60px]"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Opportunity</Label>
            <Textarea
              value={fraudTriangleOpportunity}
              onChange={(e) => onFieldChange?.("fraudTriangleOpportunity", e.target.value)}
              placeholder="Document conditions that provide opportunity for fraud..."
              className="mt-1 text-xs min-h-[60px]"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Rationalization / Attitude</Label>
            <Textarea
              value={fraudTriangleRationalization}
              onChange={(e) => onFieldChange?.("fraudTriangleRationalization", e.target.value)}
              placeholder="Document attitudes or rationalizations that could enable fraud..."
              className="mt-1 text-xs min-h-[60px]"
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Fraud Brainstorming Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs font-medium">Brainstorming Discussion Notes</Label>
            <Textarea
              value={brainstormingNotes}
              onChange={(e) => onFieldChange?.("fraudBrainstormingNotes", e.target.value)}
              placeholder="Document the team brainstorming session on fraud risks per ISA 240..."
              className="mt-1 text-xs min-h-[80px]"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Management Override of Controls — Planned Response</Label>
            <Textarea
              value={managementOverrideResponse}
              onChange={(e) => onFieldChange?.("managementOverrideResponse", e.target.value)}
              placeholder="Document planned procedures to address management override risk (ISA 240.31-33)..."
              className="mt-1 text-xs min-h-[80px]"
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
