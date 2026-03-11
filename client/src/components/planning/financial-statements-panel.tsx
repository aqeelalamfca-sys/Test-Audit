import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { formatAccounting } from "@/lib/formatters";
import {
  FileSpreadsheet, CheckCircle2, Database, Brain,
  Scale, TrendingUp, ArrowUpDown, Layers, FileText,
  AlertTriangle, AlertCircle, Info, ExternalLink, Loader2,
} from "lucide-react";
import { FSSoCF } from "./fs-socf";
import { FSSoCE } from "./fs-soce";
import { FSNotes } from "./fs-notes";
import type { CoAAccountData } from "./fs-types";

interface FsPriorYear {
  propertyPlantEquipment: string;
  intangibleAssets: string;
  inventories: string;
  tradeReceivables: string;
  cashBankBalances: string;
  shareCapital: string;
  retainedEarnings: string;
  revenue: string;
  costOfSales: string;
  adminExpenses: string;
  distributionCosts: string;
  otherOperatingIncome: string;
  financeCosts: string;
  incomeTax: string;
  [key: string]: string;
}

interface FinancialStatementsPanelProps {
  engagementId: string;
  draftFsData: any;
  isFetchingDraftFs: boolean;
  trialBalance: any;
  fsSummary: any;
  fsPriorYear: FsPriorYear;
  setFsPriorYear: React.Dispatch<React.SetStateAction<FsPriorYear>>;
  fsPriorYearDifferences: Record<string, boolean>;
  coaAccounts: CoAAccountData[];
  clientName: string;
  periodEnd: string;
  readOnly?: boolean;
}

const calculateVariance = (current: number, prior: number): string => {
  if (!prior || prior === 0) return "-";
  const variance = ((current - prior) / Math.abs(prior)) * 100;
  return variance > 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`;
};

const getVarianceStyle = (current: number, prior: number): string => {
  if (!prior || prior === 0) return "";
  const variance = ((current - prior) / Math.abs(prior)) * 100;
  if (Math.abs(variance) > 20) return "text-red-600 font-semibold";
  if (Math.abs(variance) > 10) return "text-amber-600";
  return "text-green-600";
};

function DraftFsSectionTable({ sections, type }: { sections: any[]; type: "bs" | "pl" }) {
  return (
    <Table className="fs-table-print border border-border">
      <TableHeader>
        <TableRow className="bg-muted/50 border-b-2 border-border">
          <TableHead className="w-[300px] text-center font-bold border-r border-border">FS Head</TableHead>
          <TableHead className="w-[80px] text-center font-bold border-r border-border">Notes</TableHead>
          <TableHead className="text-center w-[150px] font-bold border-r border-border">
            <div>Current Year</div>
            <div className="text-xs font-normal text-muted-foreground">(PKR)</div>
          </TableHead>
          <TableHead className="text-center w-[150px] font-bold border-r border-border">
            <div>Prior Year</div>
            <div className="text-xs font-normal text-muted-foreground">(PKR)</div>
          </TableHead>
          <TableHead className="w-[100px] text-center font-bold source-column print:hidden">Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sections
          .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
          .map((section: any, sectionIdx: number) => (
            <SectionRows key={sectionIdx} section={section} sectionIdx={sectionIdx} prefix={type === "pl" ? "pl-" : ""} />
          ))}
      </TableBody>
    </Table>
  );
}

function SectionRows({ section, sectionIdx, prefix }: { section: any; sectionIdx: number; prefix: string }) {
  return (
    <>
      <TableRow className={section.isSubtotal ? "fs-total-row font-bold border-t-2 border-b border-border bg-muted/50" : "fs-section-header font-semibold bg-muted/30 border-b border-border"}>
        <TableCell colSpan={5} className="border-r border-border">{section.sectionName}</TableCell>
      </TableRow>
      {section.lineItems.map((item: any, itemIdx: number) => (
        <TableRow key={`${prefix}item-${sectionIdx}-${itemIdx}`} className="border-b border-border">
          <TableCell className="border-r border-border">{item.displayName}</TableCell>
          <TableCell className="text-center text-muted-foreground border-r border-border">
            {item.notesRef ? (
              <span className="text-primary font-medium">{item.notesRef}</span>
            ) : "-"}
          </TableCell>
          <TableCell className="text-right font-medium pkr-amount border-r border-border">
            {formatAccounting(item.adjustedTotal)}
          </TableCell>
          <TableCell className="text-right text-muted-foreground pkr-amount border-r border-border">
            {formatAccounting(item.openingTotal || 0)}
          </TableCell>
          <TableCell className="text-center source-column print:hidden">
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">Draft FS</Badge>
          </TableCell>
        </TableRow>
      ))}
      {section.isSubtotal && (
        <TableRow className="fs-total-row font-bold bg-muted/20 border-b border-border">
          <TableCell className="font-bold border-r border-border">{section.sectionName}</TableCell>
          <TableCell className="border-r border-border"></TableCell>
          <TableCell className="text-right font-bold text-primary pkr-amount border-r border-border">
            {formatAccounting(section.sectionAdjustedTotal)}
          </TableCell>
          <TableCell className="text-right font-bold text-muted-foreground pkr-amount border-r border-border">
            {formatAccounting(section.sectionOriginalTotal || 0)}
          </TableCell>
          <TableCell className="text-center source-column print:hidden"></TableCell>
        </TableRow>
      )}
    </>
  );
}

function FallbackRow({ label, priorKey, priorYear, setFsPriorYear, currentValue, multiplier, baseValue, fsPriorYearDifferences, readOnly }: {
  label: string; priorKey: string; priorYear: FsPriorYear;
  setFsPriorYear: React.Dispatch<React.SetStateAction<FsPriorYear>>;
  currentValue: number; multiplier?: number; baseValue?: string;
  fsPriorYearDifferences: Record<string, boolean>; readOnly?: boolean;
}) {
  const computedCurrent = multiplier && baseValue ? Number(baseValue) * multiplier : currentValue;
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right p-1">
        <Input
          type="number"
          value={priorYear[priorKey]}
          onChange={(e) => setFsPriorYear(prev => ({ ...prev, [priorKey]: e.target.value }))}
          className="h-8 text-right text-sm"
          placeholder="Enter opening"
          disabled={readOnly}
        />
      </TableCell>
      <TableCell className="text-right">{computedCurrent ? formatAccounting(computedCurrent) : '-'}</TableCell>
      <TableCell className={`text-right ${getVarianceStyle(computedCurrent, Number(priorYear[priorKey]))}`}>
        {calculateVariance(computedCurrent, Number(priorYear[priorKey]))}
      </TableCell>
      <TableCell><Badge variant="outline" className="text-xs">Trial Balance</Badge></TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">AI</Badge>
        {fsPriorYearDifferences[priorKey] && <Badge variant="destructive" className="text-xs ml-1">Diff</Badge>}
      </TableCell>
    </TableRow>
  );
}

export function FinancialStatementsPanel({
  engagementId, draftFsData, isFetchingDraftFs, trialBalance,
  fsSummary, fsPriorYear, setFsPriorYear, fsPriorYearDifferences,
  coaAccounts, clientName, periodEnd, readOnly,
}: FinancialStatementsPanelProps) {
  const [fsSubTab, setFsSubTab] = useState("balance-sheet");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Financial Statements
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {draftFsData ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
                <CheckCircle2 className="h-3 w-3 mr-1" />Live Synced
              </Badge>
            ) : isFetchingDraftFs ? (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />Loading...
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300">
                <Database className="h-3 w-3 mr-1" />Pending Data
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Source: {draftFsData ? "Draft FS" : "GL/TB Upload"}
              {draftFsData ? (
                <Badge variant="default" className="ml-2 gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Loaded from Draft FS</Badge>
              ) : trialBalance.fileUploaded ? (
                <Badge variant="default" className="ml-2 gap-1"><CheckCircle2 className="h-3 w-3" />Connected</Badge>
              ) : (
                <Badge variant="outline" className="ml-2">Pending Upload</Badge>
              )}
              {draftFsData?.summary && (
                <Badge variant="secondary" className="ml-2">{draftFsData.summary.totalMappedAccounts} mapped accounts</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              {[
                { label: "Total Assets", value: fsSummary.totalAssets, fallback: trialBalance.totalAssets, color: "text-green-700 dark:text-green-400" },
                { label: "Total Liabilities", value: fsSummary.totalLiabilities, fallback: null, color: "text-red-600 dark:text-red-400" },
                { label: "Total Equity", value: fsSummary.totalEquity, fallback: trialBalance.totalEquity, color: "text-blue-600 dark:text-blue-400" },
                { label: "Total Income", value: fsSummary.totalIncome, fallback: trialBalance.revenue, color: "text-green-700 dark:text-green-400" },
                { label: "Total Expenses", value: fsSummary.totalExpenses, fallback: trialBalance.profitBeforeTax, color: "text-red-600 dark:text-red-400" },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-muted-foreground">{item.label}</p>
                  <p className={`font-semibold ${item.color}`}>
                    {item.value ? formatAccounting(item.value)
                      : item.fallback ? formatAccounting(Number(String(item.fallback).replace(/,/g, '')))
                      : <span className="text-red-500">Not set</span>}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">AI-Assisted Financial Statement Mapping</p>
                <p className="text-blue-700 dark:text-blue-300">
                  AI automatically maps Trial Balance accounts to Financial Statement line items. All AI suggestions are editable and require professional review.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={fsSubTab} onValueChange={setFsSubTab} className="w-full">
          <TabsList className="w-full justify-start flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="balance-sheet" className="gap-1.5 text-xs"><Scale className="h-3.5 w-3.5" />Balance Sheet</TabsTrigger>
            <TabsTrigger value="profit-loss" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Profit & Loss</TabsTrigger>
            <TabsTrigger value="socf" className="gap-1.5 text-xs"><ArrowUpDown className="h-3.5 w-3.5" />SoCF</TabsTrigger>
            <TabsTrigger value="soce" className="gap-1.5 text-xs"><Layers className="h-3.5 w-3.5" />SoCE</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Notes</TabsTrigger>
            <TabsTrigger value="trial-balance" className="gap-1.5 text-xs"><Database className="h-3.5 w-3.5" />Trial Balance</TabsTrigger>
          </TabsList>

          <TabsContent value="balance-sheet" className="mt-4">
            {draftFsData?.balanceSheet?.sections ? (
              <>
                <div className="hidden print:block text-center mb-6">
                  <h2 className="text-lg font-bold uppercase">{clientName}</h2>
                  <h3 className="text-base font-semibold mt-1">Statement of Financial Position</h3>
                  <p className="text-sm text-muted-foreground mt-1">As at {periodEnd}</p>
                  <p className="text-xs text-muted-foreground">(Amounts in Pakistani Rupees)</p>
                </div>
                <DraftFsSectionTable sections={draftFsData.balanceSheet.sections} type="bs" />
                <Table className="mt-0">
                  <TableBody>
                    <TableRow className="fs-total-row font-bold border-t-2 border-b border-border bg-primary/5">
                      <TableCell className="font-bold text-lg border-r border-border">Balance Check</TableCell>
                      <TableCell className="border-r border-border"></TableCell>
                      <TableCell className="text-right border-r border-border" colSpan={2}>
                        {draftFsData.balanceSheet.isBalanced ? (
                          <Badge className="bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" />Balanced</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Variance: {formatAccounting(draftFsData.balanceSheet.variance)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center source-column print:hidden"></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            ) : (
              <FallbackBalanceSheet trialBalance={trialBalance} fsPriorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
            )}
          </TabsContent>

          <TabsContent value="profit-loss" className="mt-4">
            {draftFsData?.profitLoss?.sections ? (
              <>
                <div className="hidden print:block text-center mb-6">
                  <h2 className="text-lg font-bold uppercase">{clientName}</h2>
                  <h3 className="text-base font-semibold mt-1">Statement of Profit or Loss</h3>
                  <p className="text-sm text-muted-foreground mt-1">For the year ended {periodEnd}</p>
                  <p className="text-xs text-muted-foreground">(Amounts in Pakistani Rupees)</p>
                </div>
                <DraftFsSectionTable sections={draftFsData.profitLoss.sections} type="pl" />
                <Table className="mt-0">
                  <TableBody>
                    <TableRow className="fs-total-row font-bold border-t-2 border-b border-border bg-primary/5">
                      <TableCell className="font-bold text-lg border-r border-border">Net Profit/(Loss)</TableCell>
                      <TableCell className="border-r border-border"></TableCell>
                      <TableCell className={`text-right font-bold text-lg pkr-amount border-r border-border ${draftFsData.profitLoss.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAccounting(draftFsData.profitLoss.netProfit)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-muted-foreground pkr-amount border-r border-border">-</TableCell>
                      <TableCell className="text-center source-column print:hidden"></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            ) : (
              <FallbackProfitLoss trialBalance={trialBalance} fsPriorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
            )}
          </TabsContent>

          <TabsContent value="socf" className="mt-4">
            <FSSoCF
              draftFsData={draftFsData}
              fsPriorYear={fsPriorYear}
              trialBalance={trialBalance}
              coaAccounts={coaAccounts}
              engagementId={engagementId}
              clientName={clientName}
              periodEnd={periodEnd}
              onSwitchTab={setFsSubTab}
            />
          </TabsContent>

          <TabsContent value="soce" className="mt-4">
            <FSSoCE
              draftFsData={draftFsData}
              fsPriorYear={fsPriorYear}
              trialBalance={trialBalance}
              coaAccounts={coaAccounts}
              engagementId={engagementId}
              clientName={clientName}
              periodEnd={periodEnd}
              onSwitchTab={setFsSubTab}
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <FSNotes
              draftFsData={draftFsData}
              coaAccounts={coaAccounts}
              engagementId={engagementId}
              clientName={clientName}
              periodEnd={periodEnd}
              onSwitchTab={setFsSubTab}
            />
          </TabsContent>

          <TabsContent value="trial-balance" className="mt-3 space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Trial Balance data is shown in read-only mode. For validation, sign-off, and edits, go to Trial Balance Review.
                </p>
              </div>
              <Link href={`/workspace/${engagementId}/tb-review`}>
                <Button size="sm" variant="outline" className="flex-shrink-0 ml-2">
                  Go to TB Review<ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>

            {trialBalance.fileUploaded ? (
              <Card>
                <CardHeader><CardTitle className="text-sm">Trial Balance Summary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "File Name", value: trialBalance.fileName || "Uploaded File" },
                      { label: "Total Assets", value: trialBalance.totalAssets ? formatAccounting(Number(String(trialBalance.totalAssets).replace(/,/g, ''))) : '-' },
                      { label: "Total Equity", value: trialBalance.totalEquity ? formatAccounting(Number(String(trialBalance.totalEquity).replace(/,/g, ''))) : '-' },
                      { label: "Revenue", value: trialBalance.revenue ? formatAccounting(Number(String(trialBalance.revenue).replace(/,/g, ''))) : '-' },
                    ].map(item => (
                      <div key={item.label} className="space-y-1">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="font-medium text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground">For detailed Trial Balance data, mapping, validation, and sign-off, please visit the Trial Balance Review page.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center text-center space-y-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">No Trial Balance data uploaded yet. Upload a Trial Balance file to get started.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Upload Trial Balance to auto-populate Financial Statement line items. All figures are editable.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FallbackBalanceSheet({ trialBalance, fsPriorYear, setFsPriorYear, fsPriorYearDifferences, readOnly }: {
  trialBalance: any; fsPriorYear: FsPriorYear; setFsPriorYear: React.Dispatch<React.SetStateAction<FsPriorYear>>;
  fsPriorYearDifferences: Record<string, boolean>; readOnly?: boolean;
}) {
  const ta = Number(trialBalance.totalAssets) || 0;
  const te = Number(trialBalance.totalEquity) || 0;
  const priorTotalAssets = Number(fsPriorYear.propertyPlantEquipment) + Number(fsPriorYear.intangibleAssets) + Number(fsPriorYear.inventories) + Number(fsPriorYear.tradeReceivables) + Number(fsPriorYear.cashBankBalances);
  const priorTotalEquity = Number(fsPriorYear.shareCapital) + Number(fsPriorYear.retainedEarnings);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Line Item</TableHead>
          <TableHead className="text-right w-[150px]">Prior Year (PKR)</TableHead>
          <TableHead className="text-right w-[150px]">Current Year (PKR)</TableHead>
          <TableHead className="text-right w-[100px]">Variance</TableHead>
          <TableHead className="w-[100px]">Source</TableHead>
          <TableHead className="w-[120px]">Edit Indicator</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="font-semibold bg-muted/30"><TableCell colSpan={6}>Non-Current Assets</TableCell></TableRow>
        <FallbackRow label="Property, Plant & Equipment" priorKey="propertyPlantEquipment" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={ta * 0.4} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <FallbackRow label="Intangible Assets" priorKey="intangibleAssets" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={ta * 0.1} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <TableRow className="font-semibold bg-muted/30"><TableCell colSpan={6}>Current Assets</TableCell></TableRow>
        <FallbackRow label="Inventories" priorKey="inventories" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={ta * 0.2} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <FallbackRow label="Trade Receivables" priorKey="tradeReceivables" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={ta * 0.2} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <FallbackRow label="Cash & Bank Balances" priorKey="cashBankBalances" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={ta * 0.1} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <TableRow className="font-bold border-t-2">
          <TableCell>Total Assets</TableCell>
          <TableCell className="text-right font-bold">{priorTotalAssets > 0 ? formatAccounting(priorTotalAssets) : '-'}</TableCell>
          <TableCell className="text-right">{ta ? formatAccounting(ta) : '-'}</TableCell>
          <TableCell className={`text-right ${getVarianceStyle(ta, priorTotalAssets)}`}>{calculateVariance(ta, priorTotalAssets)}</TableCell>
          <TableCell></TableCell>
          <TableCell><Badge className="text-xs bg-blue-100 text-blue-800">Total</Badge></TableCell>
        </TableRow>
        <TableRow className="font-semibold bg-muted/30"><TableCell colSpan={6}>Equity</TableCell></TableRow>
        <FallbackRow label="Share Capital" priorKey="shareCapital" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={te * 0.5} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <FallbackRow label="Retained Earnings" priorKey="retainedEarnings" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={te * 0.5} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <TableRow className="font-bold border-t-2">
          <TableCell>Total Equity</TableCell>
          <TableCell className="text-right font-bold">{priorTotalEquity > 0 ? formatAccounting(priorTotalEquity) : '-'}</TableCell>
          <TableCell className="text-right">{te ? formatAccounting(te) : '-'}</TableCell>
          <TableCell className={`text-right ${getVarianceStyle(te, priorTotalEquity)}`}>{calculateVariance(te, priorTotalEquity)}</TableCell>
          <TableCell></TableCell>
          <TableCell><Badge className="text-xs bg-blue-100 text-blue-800">Total</Badge></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function FallbackProfitLoss({ trialBalance, fsPriorYear, setFsPriorYear, fsPriorYearDifferences, readOnly }: {
  trialBalance: any; fsPriorYear: FsPriorYear; setFsPriorYear: React.Dispatch<React.SetStateAction<FsPriorYear>>;
  fsPriorYearDifferences: Record<string, boolean>; readOnly?: boolean;
}) {
  const rev = Number(trialBalance.revenue) || 0;
  const pbt = Number(trialBalance.profitBeforeTax) || 0;
  const priorGross = Number(fsPriorYear.revenue) - Number(fsPriorYear.costOfSales);
  const priorOperating = priorGross - Number(fsPriorYear.adminExpenses) - Number(fsPriorYear.distributionCosts) + Number(fsPriorYear.otherOperatingIncome);
  const priorPBT = priorOperating - Number(fsPriorYear.financeCosts);
  const priorPAT = priorPBT - Number(fsPriorYear.incomeTax);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Line Item</TableHead>
          <TableHead className="text-right w-[150px]">Prior Year (PKR)</TableHead>
          <TableHead className="text-right w-[150px]">Current Year (PKR)</TableHead>
          <TableHead className="text-right w-[100px]">Variance</TableHead>
          <TableHead className="w-[100px]">Source</TableHead>
          <TableHead className="w-[120px]">Edit Indicator</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <FallbackRow label="Revenue" priorKey="revenue" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={rev} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <FallbackRow label="Cost of Sales" priorKey="costOfSales" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={rev * 0.6} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <TableRow className="font-semibold border-t">
          <TableCell>Gross Profit</TableCell>
          <TableCell className="text-right font-bold">{priorGross > 0 ? formatAccounting(priorGross) : '-'}</TableCell>
          <TableCell className="text-right">{rev ? formatAccounting(rev * 0.4) : '-'}</TableCell>
          <TableCell className={`text-right ${getVarianceStyle(rev * 0.4, priorGross)}`}>{calculateVariance(rev * 0.4, priorGross)}</TableCell>
          <TableCell></TableCell>
          <TableCell><Badge className="text-xs bg-amber-100 text-amber-800">Auto</Badge></TableCell>
        </TableRow>
        <FallbackRow label="Administrative Expenses" priorKey="adminExpenses" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={rev * 0.15} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <FallbackRow label="Distribution Costs" priorKey="distributionCosts" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={rev * 0.1} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <FallbackRow label="Other Operating Income" priorKey="otherOperatingIncome" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={rev * 0.02} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <TableRow className="font-semibold border-t">
          <TableCell>Operating Profit</TableCell>
          <TableCell className="text-right font-bold">{priorOperating > 0 ? formatAccounting(priorOperating) : '-'}</TableCell>
          <TableCell className="text-right">{rev ? formatAccounting(rev * 0.17) : '-'}</TableCell>
          <TableCell className="text-right">-</TableCell>
          <TableCell></TableCell>
          <TableCell><Badge className="text-xs bg-amber-100 text-amber-800">Auto</Badge></TableCell>
        </TableRow>
        <FallbackRow label="Finance Costs" priorKey="financeCosts" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={rev * 0.02} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <TableRow className="font-bold border-t-2">
          <TableCell>Profit Before Tax</TableCell>
          <TableCell className="text-right font-bold">{priorPBT !== 0 ? formatAccounting(priorPBT) : '-'}</TableCell>
          <TableCell className="text-right">{pbt ? formatAccounting(pbt) : '-'}</TableCell>
          <TableCell className={`text-right ${getVarianceStyle(pbt, priorPBT)}`}>{calculateVariance(pbt, priorPBT)}</TableCell>
          <TableCell><Badge variant="outline" className="text-xs">Trial Balance</Badge></TableCell>
          <TableCell><Badge className="text-xs bg-blue-100 text-blue-800">Total</Badge></TableCell>
        </TableRow>
        <FallbackRow label="Taxation" priorKey="incomeTax" priorYear={fsPriorYear} setFsPriorYear={setFsPriorYear} currentValue={pbt * 0.29} fsPriorYearDifferences={fsPriorYearDifferences} readOnly={readOnly} />
        <TableRow className="font-bold border-t-2 bg-muted/30">
          <TableCell>Profit After Tax</TableCell>
          <TableCell className="text-right font-bold">{priorPAT !== 0 ? formatAccounting(priorPAT) : '-'}</TableCell>
          <TableCell className="text-right">{pbt ? formatAccounting(pbt * 0.71) : '-'}</TableCell>
          <TableCell className={`text-right ${getVarianceStyle(pbt * 0.71, priorPAT)}`}>{calculateVariance(pbt * 0.71, priorPAT)}</TableCell>
          <TableCell></TableCell>
          <TableCell><Badge className="text-xs bg-amber-100 text-amber-800">Auto</Badge></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
