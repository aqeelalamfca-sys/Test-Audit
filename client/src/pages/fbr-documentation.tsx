import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calculator,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Receipt,
  Landmark,
  ClipboardCheck,
  FileSpreadsheet,
  Shield,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useWorkspace } from "@/lib/workspace-context";

interface TaxComputationLine {
  id: string;
  description: string;
  reference: string;
  amount: number;
  adjustmentType: "add_back" | "deduction" | "exempt" | "none";
  notes: string;
}

interface WHTEntry {
  id: string;
  section: string;
  description: string;
  grossAmount: number;
  whtRate: number;
  whtDeducted: number;
  whtDeposited: number;
  variance: number;
  status: "reconciled" | "variance" | "pending";
  challanNo: string;
  depositDate: string;
}

interface AdvanceTaxEntry {
  id: string;
  section: string;
  description: string;
  quarterDate: string;
  amount: number;
  challanNo: string;
  status: "paid" | "pending" | "overdue";
}

interface TaxAdjustment {
  id: string;
  category: string;
  description: string;
  incomeTaxRef: string;
  currentYear: number;
  priorYear: number;
  nature: "permanent" | "temporary";
}

interface NTNValidation {
  ntn: string;
  strn: string;
  ntnStatus: "valid" | "invalid" | "not_verified";
  strnStatus: "valid" | "invalid" | "not_verified" | "not_applicable";
  lastVerified: string;
  registeredName: string;
  taxOffice: string;
  businessType: string;
}

const DEFAULT_TAX_COMPUTATION: TaxComputationLine[] = [
  { id: "1", description: "Accounting Profit Before Tax", reference: "P&L", amount: 0, adjustmentType: "none", notes: "Per audited financial statements" },
  { id: "2", description: "Add: Depreciation per accounts", reference: "Note 5", amount: 0, adjustmentType: "add_back", notes: "Accounting depreciation" },
  { id: "3", description: "Less: Tax depreciation (Sec 22-23)", reference: "Sec 22", amount: 0, adjustmentType: "deduction", notes: "As per Income Tax Ordinance 2001" },
  { id: "4", description: "Add: Provision for doubtful debts", reference: "Note 12", amount: 0, adjustmentType: "add_back", notes: "Not allowed under S.29" },
  { id: "5", description: "Add: Penalties & fines", reference: "S.21(l)", amount: 0, adjustmentType: "add_back", notes: "Inadmissible expenses" },
  { id: "6", description: "Add: Donations in excess of limit", reference: "S.61", amount: 0, adjustmentType: "add_back", notes: "Excess over prescribed limit" },
  { id: "7", description: "Add: Entertainment expenses (disallowable)", reference: "S.21(m)", amount: 0, adjustmentType: "add_back", notes: "Personal/non-business entertainment" },
  { id: "8", description: "Less: Capital gains exempt", reference: "S.37A", amount: 0, adjustmentType: "exempt", notes: "Capital gains on listed securities" },
  { id: "9", description: "Less: Dividend income (separate block)", reference: "S.5(3)", amount: 0, adjustmentType: "deduction", notes: "Taxed at separate rates" },
  { id: "10", description: "Add: WWF & WPPF disallowance", reference: "S.60A", amount: 0, adjustmentType: "add_back", notes: "If not actually contributed" },
  { id: "11", description: "Less: Tax credit u/s 65B", reference: "S.65B", amount: 0, adjustmentType: "deduction", notes: "Investment in plant & machinery" },
  { id: "12", description: "Add: Other inadmissible expenses", reference: "S.21", amount: 0, adjustmentType: "add_back", notes: "Other disallowable items" },
];

const DEFAULT_WHT_ENTRIES: WHTEntry[] = [
  { id: "1", section: "S.149", description: "WHT on Salaries", grossAmount: 0, whtRate: 0, whtDeducted: 0, whtDeposited: 0, variance: 0, status: "pending", challanNo: "", depositDate: "" },
  { id: "2", section: "S.151", description: "WHT on Profit on Debt", grossAmount: 0, whtRate: 15, whtDeducted: 0, whtDeposited: 0, variance: 0, status: "pending", challanNo: "", depositDate: "" },
  { id: "3", section: "S.153(1)(a)", description: "WHT on Supply of Goods", grossAmount: 0, whtRate: 4.5, whtDeducted: 0, whtDeposited: 0, variance: 0, status: "pending", challanNo: "", depositDate: "" },
  { id: "4", section: "S.153(1)(b)", description: "WHT on Rendering of Services", grossAmount: 0, whtRate: 8, whtDeducted: 0, whtDeposited: 0, variance: 0, status: "pending", challanNo: "", depositDate: "" },
  { id: "5", section: "S.153(1)(c)", description: "WHT on Execution of Contracts", grossAmount: 0, whtRate: 7.5, whtDeducted: 0, whtDeposited: 0, variance: 0, status: "pending", challanNo: "", depositDate: "" },
  { id: "6", section: "S.155", description: "WHT on Rent", grossAmount: 0, whtRate: 15, whtDeducted: 0, whtDeposited: 0, variance: 0, status: "pending", challanNo: "", depositDate: "" },
  { id: "7", section: "S.156", description: "WHT on Prizes & Winnings", grossAmount: 0, whtRate: 20, whtDeducted: 0, whtDeposited: 0, variance: 0, status: "pending", challanNo: "", depositDate: "" },
  { id: "8", section: "S.156A", description: "WHT on Commission/Brokerage", grossAmount: 0, whtRate: 12, whtDeducted: 0, whtDeposited: 0, variance: 0, status: "pending", challanNo: "", depositDate: "" },
];

const DEFAULT_ADVANCE_TAX: AdvanceTaxEntry[] = [
  { id: "1", section: "S.147", description: "Advance Tax - Q1 (Sep)", quarterDate: "", amount: 0, challanNo: "", status: "pending" },
  { id: "2", section: "S.147", description: "Advance Tax - Q2 (Dec)", quarterDate: "", amount: 0, challanNo: "", status: "pending" },
  { id: "3", section: "S.147", description: "Advance Tax - Q3 (Mar)", quarterDate: "", amount: 0, challanNo: "", status: "pending" },
  { id: "4", section: "S.147", description: "Advance Tax - Q4 (Jun)", quarterDate: "", amount: 0, challanNo: "", status: "pending" },
];

const DEFAULT_TAX_ADJUSTMENTS: TaxAdjustment[] = [
  { id: "1", category: "Depreciation", description: "Difference in accounting vs tax depreciation", incomeTaxRef: "S.22-23", currentYear: 0, priorYear: 0, nature: "temporary" },
  { id: "2", category: "Provisions", description: "Provisions not allowable until paid", incomeTaxRef: "S.29", currentYear: 0, priorYear: 0, nature: "temporary" },
  { id: "3", category: "Amortization", description: "Intangible amortization differences", incomeTaxRef: "S.24", currentYear: 0, priorYear: 0, nature: "temporary" },
  { id: "4", category: "Penalties", description: "Penalties and fines not deductible", incomeTaxRef: "S.21(l)", currentYear: 0, priorYear: 0, nature: "permanent" },
  { id: "5", category: "Donations", description: "Donations in excess of limits", incomeTaxRef: "S.61", currentYear: 0, priorYear: 0, nature: "permanent" },
  { id: "6", category: "WWF/WPPF", description: "Workers Welfare Fund / Workers Profit Participation Fund", incomeTaxRef: "S.60A", currentYear: 0, priorYear: 0, nature: "permanent" },
];

const DEFAULT_NTN_VALIDATION: NTNValidation = {
  ntn: "",
  strn: "",
  ntnStatus: "not_verified",
  strnStatus: "not_verified",
  lastVerified: "",
  registeredName: "",
  taxOffice: "",
  businessType: "",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "reconciled":
    case "valid":
    case "paid":
      return <Badge variant="default" data-testid={`badge-status-${status}`}><CheckCircle2 className="h-3 w-3 mr-1" />{ status === "valid" ? "Valid" : status === "paid" ? "Paid" : "Reconciled" }</Badge>;
    case "variance":
    case "invalid":
    case "overdue":
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}><XCircle className="h-3 w-3 mr-1" />{ status === "invalid" ? "Invalid" : status === "overdue" ? "Overdue" : "Variance" }</Badge>;
    case "pending":
    case "not_verified":
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}><AlertTriangle className="h-3 w-3 mr-1" />{ status === "not_verified" ? "Not Verified" : "Pending" }</Badge>;
    case "not_applicable":
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>N/A</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

function TaxComputationTab() {
  const [lines, setLines] = useState<TaxComputationLine[]>(DEFAULT_TAX_COMPUTATION);
  const [taxRate, setTaxRate] = useState(29);

  const updateLine = (id: string, field: keyof TaxComputationLine, value: any) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const totals = useMemo(() => {
    const accountingProfit = lines[0]?.amount || 0;
    const addBacks = lines.filter(l => l.adjustmentType === "add_back").reduce((s, l) => s + l.amount, 0);
    const deductions = lines.filter(l => l.adjustmentType === "deduction").reduce((s, l) => s + l.amount, 0);
    const exemptions = lines.filter(l => l.adjustmentType === "exempt").reduce((s, l) => s + l.amount, 0);
    const taxableIncome = accountingProfit + addBacks - deductions - exemptions;
    const taxLiability = Math.max(0, taxableIncome * (taxRate / 100));
    return { accountingProfit, addBacks, deductions, exemptions, taxableIncome, taxLiability };
  }, [lines, taxRate]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Taxable Income</div>
            <div className="text-2xl font-bold" data-testid="text-taxable-income">{formatCurrency(totals.taxableIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Tax Rate</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-20"
                data-testid="input-tax-rate"
              />
              <span className="text-lg font-semibold">%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Tax Liability</div>
            <div className="text-2xl font-bold text-destructive" data-testid="text-tax-liability">{formatCurrency(totals.taxLiability)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Tax Computation Worksheet
          </CardTitle>
          <CardDescription>Income Tax Ordinance 2001 — Computation of Taxable Income</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Reference</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-40">Amount (PKR)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={line.id} data-testid={`row-tax-computation-${line.id}`}>
                    <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{line.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{line.reference}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={line.adjustmentType}
                        onValueChange={(v) => updateLine(line.id, "adjustmentType", v)}
                      >
                        <SelectTrigger className="text-xs" data-testid={`select-adj-type-${line.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Base</SelectItem>
                          <SelectItem value="add_back">Add Back</SelectItem>
                          <SelectItem value="deduction">Deduction</SelectItem>
                          <SelectItem value="exempt">Exempt</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={line.amount || ""}
                        onChange={(e) => updateLine(line.id, "amount", Number(e.target.value))}
                        className="text-right"
                        data-testid={`input-amount-${line.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{line.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="mt-4 border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Add-Backs</span>
              <span className="font-mono" data-testid="text-total-add-backs">{formatCurrency(totals.addBacks)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Deductions</span>
              <span className="font-mono" data-testid="text-total-deductions">({formatCurrency(totals.deductions)})</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Exemptions</span>
              <span className="font-mono" data-testid="text-total-exemptions">({formatCurrency(totals.exemptions)})</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Taxable Income</span>
              <span className="font-mono" data-testid="text-final-taxable-income">{formatCurrency(totals.taxableIncome)}</span>
            </div>
            <div className="flex justify-between font-bold text-destructive">
              <span>Tax Liability @ {taxRate}%</span>
              <span className="font-mono" data-testid="text-final-tax-liability">{formatCurrency(totals.taxLiability)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WHTReconciliationTab() {
  const [entries, setEntries] = useState<WHTEntry[]>(DEFAULT_WHT_ENTRIES);

  const updateEntry = (id: string, field: keyof WHTEntry, value: any) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      if (field === "whtDeducted" || field === "whtDeposited") {
        updated.variance = updated.whtDeducted - updated.whtDeposited;
        updated.status = updated.variance === 0 && updated.whtDeducted > 0 ? "reconciled" : updated.variance !== 0 ? "variance" : "pending";
      }
      return updated;
    }));
  };

  const totalDeducted = entries.reduce((s, e) => s + e.whtDeducted, 0);
  const totalDeposited = entries.reduce((s, e) => s + e.whtDeposited, 0);
  const totalVariance = entries.reduce((s, e) => s + e.variance, 0);
  const reconciledCount = entries.filter(e => e.status === "reconciled").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total WHT Deducted</div>
            <div className="text-xl font-bold" data-testid="text-wht-deducted">{formatCurrency(totalDeducted)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total WHT Deposited</div>
            <div className="text-xl font-bold" data-testid="text-wht-deposited">{formatCurrency(totalDeposited)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Variance</div>
            <div className={`text-xl font-bold ${totalVariance !== 0 ? "text-destructive" : ""}`} data-testid="text-wht-variance">
              {formatCurrency(totalVariance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Reconciled</div>
            <div className="text-xl font-bold" data-testid="text-wht-reconciled">{reconciledCount}/{entries.length}</div>
            <Progress value={(reconciledCount / entries.length) * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            WHT Reconciliation Tracker
          </CardTitle>
          <CardDescription>Withholding Tax deduction and deposit reconciliation per Income Tax Ordinance 2001</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">Gross Amount</TableHead>
                  <TableHead className="w-20">Rate %</TableHead>
                  <TableHead className="w-32">WHT Deducted</TableHead>
                  <TableHead className="w-32">WHT Deposited</TableHead>
                  <TableHead className="w-24">Variance</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-28">Challan No.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-wht-${entry.id}`}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{entry.section}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{entry.description}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.grossAmount || ""}
                        onChange={(e) => updateEntry(entry.id, "grossAmount", Number(e.target.value))}
                        className="text-right"
                        data-testid={`input-wht-gross-${entry.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center font-mono">{entry.whtRate}%</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.whtDeducted || ""}
                        onChange={(e) => updateEntry(entry.id, "whtDeducted", Number(e.target.value))}
                        className="text-right"
                        data-testid={`input-wht-deducted-${entry.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.whtDeposited || ""}
                        onChange={(e) => updateEntry(entry.id, "whtDeposited", Number(e.target.value))}
                        className="text-right"
                        data-testid={`input-wht-deposited-${entry.id}`}
                      />
                    </TableCell>
                    <TableCell className={`text-right font-mono ${entry.variance !== 0 ? "text-destructive font-bold" : ""}`}>
                      {formatCurrency(entry.variance)}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        value={entry.challanNo}
                        onChange={(e) => updateEntry(entry.id, "challanNo", e.target.value)}
                        placeholder="CPR No."
                        className="text-xs"
                        data-testid={`input-wht-challan-${entry.id}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function AdvanceTaxTab() {
  const [entries, setEntries] = useState<AdvanceTaxEntry[]>(DEFAULT_ADVANCE_TAX);

  const updateEntry = (id: string, field: keyof AdvanceTaxEntry, value: any) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const totalPaid = entries.filter(e => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const totalDue = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Advance Tax Due</div>
            <div className="text-xl font-bold" data-testid="text-advance-total">{formatCurrency(totalDue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Paid</div>
            <div className="text-xl font-bold" data-testid="text-advance-paid">{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="text-xl font-bold text-destructive" data-testid="text-advance-outstanding">{formatCurrency(totalDue - totalPaid)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Advance Tax Computation (S.147)
          </CardTitle>
          <CardDescription>Quarterly advance tax installments per Income Tax Ordinance 2001, Section 147</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                <TableHead>Quarter</TableHead>
                <TableHead className="w-32">Due Date</TableHead>
                <TableHead className="w-36">Amount (PKR)</TableHead>
                <TableHead className="w-32">Challan No.</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} data-testid={`row-advance-tax-${entry.id}`}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{entry.section}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{entry.description}</TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={entry.quarterDate}
                      onChange={(e) => updateEntry(entry.id, "quarterDate", e.target.value)}
                      data-testid={`input-advance-date-${entry.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={entry.amount || ""}
                      onChange={(e) => updateEntry(entry.id, "amount", Number(e.target.value))}
                      className="text-right"
                      data-testid={`input-advance-amount-${entry.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      value={entry.challanNo}
                      onChange={(e) => updateEntry(entry.id, "challanNo", e.target.value)}
                      placeholder="CPR No."
                      data-testid={`input-advance-challan-${entry.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={entry.status}
                      onValueChange={(v) => updateEntry(entry.id, "status", v)}
                    >
                      <SelectTrigger data-testid={`select-advance-status-${entry.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TaxAdjustmentsTab() {
  const [adjustments, setAdjustments] = useState<TaxAdjustment[]>(DEFAULT_TAX_ADJUSTMENTS);

  const updateAdjustment = (id: string, field: keyof TaxAdjustment, value: any) => {
    setAdjustments(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const totalPermanent = adjustments.filter(a => a.nature === "permanent").reduce((s, a) => s + a.currentYear, 0);
  const totalTemporary = adjustments.filter(a => a.nature === "temporary").reduce((s, a) => s + a.currentYear, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Permanent Differences</div>
            <div className="text-xl font-bold" data-testid="text-permanent-diff">{formatCurrency(totalPermanent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Temporary Differences</div>
            <div className="text-xl font-bold" data-testid="text-temporary-diff">{formatCurrency(totalTemporary)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Tax Adjustment Summaries
          </CardTitle>
          <CardDescription>Permanent and temporary differences between accounting and tax treatment</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>ITO Reference</TableHead>
                <TableHead className="w-32">Current Year</TableHead>
                <TableHead className="w-32">Prior Year</TableHead>
                <TableHead className="w-28">Nature</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adj) => (
                <TableRow key={adj.id} data-testid={`row-adjustment-${adj.id}`}>
                  <TableCell className="font-medium">{adj.category}</TableCell>
                  <TableCell className="text-sm">{adj.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{adj.incomeTaxRef}</Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={adj.currentYear || ""}
                      onChange={(e) => updateAdjustment(adj.id, "currentYear", Number(e.target.value))}
                      className="text-right"
                      data-testid={`input-adj-current-${adj.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={adj.priorYear || ""}
                      onChange={(e) => updateAdjustment(adj.id, "priorYear", Number(e.target.value))}
                      className="text-right"
                      data-testid={`input-adj-prior-${adj.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={adj.nature === "permanent" ? "default" : "secondary"}>
                      {adj.nature === "permanent" ? "Permanent" : "Temporary"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NTNValidationTab() {
  const [validation, setValidation] = useState<NTNValidation>(DEFAULT_NTN_VALIDATION);

  const updateField = (field: keyof NTNValidation, value: string) => {
    setValidation(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              NTN Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ntn">National Tax Number (NTN)</Label>
              <div className="flex gap-2">
                <Input
                  id="ntn"
                  value={validation.ntn}
                  onChange={(e) => updateField("ntn", e.target.value)}
                  placeholder="Enter NTN (7 digits)"
                  data-testid="input-ntn"
                />
                {getStatusBadge(validation.ntnStatus)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registered-name">Registered Name (per FBR)</Label>
              <Input
                id="registered-name"
                value={validation.registeredName}
                onChange={(e) => updateField("registeredName", e.target.value)}
                placeholder="Name as registered with FBR"
                data-testid="input-registered-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-office">Tax Office / RTO</Label>
              <Input
                id="tax-office"
                value={validation.taxOffice}
                onChange={(e) => updateField("taxOffice", e.target.value)}
                placeholder="Regional Tax Office"
                data-testid="input-tax-office"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-type">Business Type</Label>
              <Input
                id="business-type"
                value={validation.businessType}
                onChange={(e) => updateField("businessType", e.target.value)}
                placeholder="e.g., Private Limited Company"
                data-testid="input-business-type"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (validation.ntn && validation.ntn.length >= 7) {
                  setValidation(prev => ({
                    ...prev,
                    ntnStatus: "valid",
                    lastVerified: new Date().toISOString(),
                  }));
                } else {
                  setValidation(prev => ({ ...prev, ntnStatus: "invalid" }));
                }
              }}
              data-testid="button-verify-ntn"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Verify NTN
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              STRN Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="strn">Sales Tax Registration Number (STRN)</Label>
              <div className="flex gap-2">
                <Input
                  id="strn"
                  value={validation.strn}
                  onChange={(e) => updateField("strn", e.target.value)}
                  placeholder="Enter STRN (13 digits)"
                  data-testid="input-strn"
                />
                {getStatusBadge(validation.strnStatus)}
              </div>
            </div>
            <div className="p-4 rounded-md bg-muted/50 space-y-2">
              <div className="text-sm font-medium">Validation Summary</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>NTN Status</span>
                  {getStatusBadge(validation.ntnStatus)}
                </div>
                <div className="flex justify-between">
                  <span>STRN Status</span>
                  {getStatusBadge(validation.strnStatus)}
                </div>
                {validation.lastVerified && (
                  <div className="flex justify-between">
                    <span>Last Verified</span>
                    <span>{new Date(validation.lastVerified).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (validation.strn && validation.strn.length >= 13) {
                  setValidation(prev => ({
                    ...prev,
                    strnStatus: "valid",
                    lastVerified: new Date().toISOString(),
                  }));
                } else if (!validation.strn) {
                  setValidation(prev => ({ ...prev, strnStatus: "not_applicable" }));
                } else {
                  setValidation(prev => ({ ...prev, strnStatus: "invalid" }));
                }
              }}
              data-testid="button-verify-strn"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Verify STRN
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExportTab() {
  const [exporting, setExporting] = useState(false);

  const handleExport = (format: "excel" | "pdf") => {
    setExporting(true);
    setTimeout(() => {
      const blob = new Blob(
        [generateExportContent(format)],
        { type: format === "excel" ? "text/csv" : "text/plain" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FBR_Documentation_${new Date().toISOString().split("T")[0]}.${format === "excel" ? "csv" : "txt"}`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export FBR Documentation
          </CardTitle>
          <CardDescription>Generate and download FBR documentation package</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover-elevate cursor-pointer" onClick={() => handleExport("excel")} data-testid="card-export-excel">
              <CardContent className="pt-4 flex items-center gap-4">
                <div className="p-3 rounded-md bg-muted">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <div>
                  <div className="font-medium">Export to Excel (CSV)</div>
                  <div className="text-sm text-muted-foreground">Tax computation, WHT reconciliation, and advance tax data</div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => handleExport("pdf")} data-testid="card-export-pdf">
              <CardContent className="pt-4 flex items-center gap-4">
                <div className="p-3 rounded-md bg-muted">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <div className="font-medium">Export to PDF</div>
                  <div className="text-sm text-muted-foreground">Complete FBR documentation report with all sections</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {exporting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Generating export...
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Export Contents</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                Tax Computation Worksheet (Income Tax Ordinance 2001)
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                WHT Reconciliation Tracker (S.149-156A)
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                Advance Tax Computation (S.147)
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                Tax Adjustment Summaries (Permanent & Temporary)
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                NTN/STRN Validation Status
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function generateExportContent(format: "excel" | "pdf"): string {
  if (format === "excel") {
    const lines = [
      "FBR Documentation Export",
      `Generated: ${new Date().toISOString()}`,
      "",
      "TAX COMPUTATION WORKSHEET",
      "Description,Reference,Adjustment Type,Amount (PKR),Notes",
      ...DEFAULT_TAX_COMPUTATION.map(l =>
        `"${l.description}","${l.reference}","${l.adjustmentType}",${l.amount},"${l.notes}"`
      ),
      "",
      "WHT RECONCILIATION",
      "Section,Description,Gross Amount,Rate %,WHT Deducted,WHT Deposited,Variance,Status",
      ...DEFAULT_WHT_ENTRIES.map(e =>
        `"${e.section}","${e.description}",${e.grossAmount},${e.whtRate},${e.whtDeducted},${e.whtDeposited},${e.variance},"${e.status}"`
      ),
      "",
      "ADVANCE TAX",
      "Section,Quarter,Amount,Challan No,Status",
      ...DEFAULT_ADVANCE_TAX.map(e =>
        `"${e.section}","${e.description}",${e.amount},"${e.challanNo}","${e.status}"`
      ),
    ];
    return lines.join("\n");
  }
  return `FBR Documentation Report\nGenerated: ${new Date().toISOString()}\n\nThis is a summary export of all FBR documentation sections.\nPlease use Excel export for detailed data.`;
}

export default function FBRDocumentation() {
  const [activeTab, setActiveTab] = useState("computation");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FBR Documentation</h1>
          <p className="text-sm text-muted-foreground">
            Federal Board of Revenue — Tax computations, WHT reconciliation, and compliance documentation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Income Tax Ordinance 2001
          </Badge>
          <Badge variant="outline" className="text-xs">
            Sales Tax Act 1990
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="computation" data-testid="tab-computation">
            <Calculator className="h-4 w-4 mr-1.5" />
            Tax Computation
          </TabsTrigger>
          <TabsTrigger value="wht" data-testid="tab-wht">
            <Receipt className="h-4 w-4 mr-1.5" />
            WHT Reconciliation
          </TabsTrigger>
          <TabsTrigger value="advance" data-testid="tab-advance">
            <Landmark className="h-4 w-4 mr-1.5" />
            Advance Tax
          </TabsTrigger>
          <TabsTrigger value="adjustments" data-testid="tab-adjustments">
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            Tax Adjustments
          </TabsTrigger>
          <TabsTrigger value="ntn" data-testid="tab-ntn">
            <Shield className="h-4 w-4 mr-1.5" />
            NTN/STRN Validation
          </TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="computation">
          <TaxComputationTab />
        </TabsContent>
        <TabsContent value="wht">
          <WHTReconciliationTab />
        </TabsContent>
        <TabsContent value="advance">
          <AdvanceTaxTab />
        </TabsContent>
        <TabsContent value="adjustments">
          <TaxAdjustmentsTab />
        </TabsContent>
        <TabsContent value="ntn">
          <NTNValidationTab />
        </TabsContent>
        <TabsContent value="export">
          <ExportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}