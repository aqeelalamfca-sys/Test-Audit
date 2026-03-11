import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from "@/lib/formatters";
import { Loader2, AlertTriangle, CheckCircle2, Target, TrendingUp, Shield } from "lucide-react";

interface SignificantAccountsPanelProps {
  engagementId: string;
  readOnly?: boolean;
}

const ASSERTION_LABELS: Record<string, string> = {
  EXISTENCE: "Existence",
  COMPLETENESS: "Completeness",
  ACCURACY: "Accuracy",
  VALUATION: "Valuation",
  CUTOFF: "Cut-off",
  CLASSIFICATION: "Classification",
  OCCURRENCE: "Occurrence",
  RIGHTS_OBLIGATIONS: "Rights & Obligations",
  PRESENTATION_DISCLOSURE: "Presentation & Disclosure",
};

export function SignificantAccountsPanel({ engagementId, readOnly }: SignificantAccountsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "significant-accounts"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/significant-accounts`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Identifying significant accounts...</span>
      </div>
    );
  }

  if (!data) return null;

  const { significantAccounts, totalAccounts, significantCount, materialityThreshold, performanceMateriality } = data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Significant Accounts, Classes of Transactions & Disclosures
            </CardTitle>
            <Badge variant="outline" className="text-xs">ISA 315</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Auto-identified from TB data using performance materiality ({formatAccounting(performanceMateriality)}), transaction volume, year-on-year changes, and linked risks.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-2xl font-bold tabular-nums">{totalAccounts}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Total Accounts</p>
            </div>
            <div className="text-center p-2 rounded-md bg-amber-50 dark:bg-amber-950/20">
              <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{significantCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Significant</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-xs font-semibold tabular-nums">{formatAccounting(materialityThreshold)}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Overall Materiality</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-xs font-semibold tabular-nums">{formatAccounting(performanceMateriality)}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Performance Materiality</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-24">Code</TableHead>
                  <TableHead className="text-xs">Account Name</TableHead>
                  <TableHead className="text-xs">FS Category</TableHead>
                  <TableHead className="text-xs text-right">Closing Balance</TableHead>
                  <TableHead className="text-xs text-right">Opening Balance</TableHead>
                  <TableHead className="text-xs text-right">Change %</TableHead>
                  <TableHead className="text-xs">Significance Reasons</TableHead>
                  <TableHead className="text-xs text-center">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {significantAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm">No significant accounts identified</p>
                        <p className="text-xs">Upload TB data and calculate materiality to auto-identify significant areas</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  significantAccounts.map((account: any, idx: number) => (
                    <TableRow key={idx} className={account.hasFraudRisk ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                      <TableCell className="text-xs font-mono tabular-nums">{account.accountCode}</TableCell>
                      <TableCell className="text-xs font-medium">{account.accountName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{account.fsCategory || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-medium">
                        {formatAccounting(account.closingBalance || 0)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                        {account.openingBalance != null ? formatAccounting(account.openingBalance) : "—"}
                      </TableCell>
                      <TableCell className={`text-xs text-right tabular-nums font-medium ${Math.abs(account.changePercent) > 25 ? "text-red-600" : Math.abs(account.changePercent) > 10 ? "text-amber-600" : ""}`}>
                        {account.changePercent != null ? `${account.changePercent.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {account.reasons?.map((reason: string, rIdx: number) => (
                            <Badge key={rIdx} variant="secondary" className="text-[9px] px-1.5 py-0">{reason}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {account.hasFraudRisk && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" title="Fraud risk" />
                          )}
                          {account.linkedRisks && (
                            <Shield className="h-3.5 w-3.5 text-violet-500" title="Linked risk" />
                          )}
                          {Math.abs(account.changePercent) > 25 && (
                            <TrendingUp className="h-3.5 w-3.5 text-amber-500" title="High fluctuation" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-800">
        <CardContent className="pt-4">
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Relevant Assertions
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            For each significant account, consider the following assertions per ISA 315. Map assertions to identified risks in the Risk Assessment tab.
          </p>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(ASSERTION_LABELS).map(([key, label]) => (
              <div key={key} className="p-2 rounded-md border text-center">
                <p className="text-[10px] font-medium">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
