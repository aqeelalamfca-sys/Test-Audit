import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Banknote,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  FileText,
  Activity,
  Building2,
  Calendar,
  Mail,
  MailCheck,
  MailX,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface InvoiceRow {
  id: string;
  invoiceNo: string | null;
  amount: string;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface SubscriptionRow {
  id: string;
  status: string;
  trialStart: string | null;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextInvoiceAt: string | null;
  priceSnapshot: any;
  plan: { id: string; code: string; name: string; monthlyPrice: string } | null;
  invoices: InvoiceRow[];
}

interface FirmRow {
  id: string;
  name: string;
  displayName: string | null;
  email: string;
  status: string;
  subscriptions: SubscriptionRow[];
}

function formatPkr(amount: number | string) {
  return Number(amount).toLocaleString("en-PK");
}

function fmt(date: string | null | undefined) {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy");
}

function subStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    TRIAL: { label: "Trial", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    ACTIVE: { label: "Active", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    PAST_DUE: { label: "Past Due", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    GRACE: { label: "Grace", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    DORMANT: { label: "Dormant", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    SUSPENDED: { label: "Suspended", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    CANCELED: { label: "Canceled", className: "bg-gray-100 text-gray-500" },
    EXPIRED: { label: "Expired", className: "bg-gray-100 text-gray-500" },
  };
  const cfg = map[status] || { label: status, className: "bg-gray-100 text-gray-600" };
  return <Badge className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>;
}

function invStatusBadge(status: string) {
  const map: Record<string, { label: string; icon: any; className: string }> = {
    DRAFT: { label: "Draft", icon: FileText, className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    ISSUED: { label: "Dispatched", icon: Send, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    PAID: { label: "Paid", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    OVERDUE: { label: "Overdue", icon: AlertTriangle, className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    VOID: { label: "Void", icon: XCircle, className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
  };
  const cfg = map[status] || { label: status, icon: FileText, className: "bg-gray-100 text-gray-600" };
  const Icon = cfg.icon;
  return (
    <Badge className={`text-[10px] px-1.5 py-0 flex items-center gap-0.5 w-fit ${cfg.className}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </Badge>
  );
}

function DispatchDialog({
  invoice,
  firmName,
  onClose,
}: {
  invoice: InvoiceRow;
  firmName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [daysUntilDue, setDaysUntilDue] = useState(15);

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platform/invoices/${invoice.id}/dispatch`, { daysUntilDue });
      return res.json();
    },
    onSuccess: (data: any) => {
      const emailMsg = data.emailResult?.sent
        ? `Invoice emailed to firm contact.`
        : data.emailResult?.message || "";
      toast({
        title: "Invoice Dispatched",
        description: `Invoice dispatched to ${firmName}. Due in ${daysUntilDue} days. ${emailMsg}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/billing-summary"] });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e.message || "Could not dispatch invoice", variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-500" />
            Dispatch Invoice
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm text-muted-foreground">
            Firm: <span className="font-medium text-foreground">{firmName}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Amount: <span className="font-semibold text-foreground">PKR {formatPkr(invoice.amount)}</span>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Days until due date</label>
            <Input
              type="number"
              min={1}
              max={90}
              value={daysUntilDue}
              onChange={(e) => setDaysUntilDue(Number(e.target.value))}
              className="h-8 text-sm"
              data-testid="input-days-until-due"
            />
            <p className="text-[11px] text-muted-foreground">
              Due date will be: {format(new Date(Date.now() + daysUntilDue * 86400000), "dd MMM yyyy")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => dispatchMutation.mutate()}
            disabled={dispatchMutation.isPending}
            data-testid="button-confirm-dispatch"
          >
            {dispatchMutation.isPending ? "Dispatching..." : "Dispatch Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FirmBillingRow({ firm }: { firm: FirmRow }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [dispatchingInvoice, setDispatchingInvoice] = useState<InvoiceRow | null>(null);

  const sub = firm.subscriptions[0] || null;
  const plan = sub?.plan;
  const latestInvoice = sub?.invoices[0] || null;
  const firmLabel = firm.displayName || firm.name;

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!sub) throw new Error("No subscription");
      const res = await apiRequest("POST", `/api/platform/invoices/generate/${sub.id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      const emailMsg = data.emailResult?.sent
        ? `Invoice emailed to ${firm.email}`
        : data.emailResult?.message || "Email not sent";
      toast({
        title: "Invoice Generated & Issued",
        description: `${data.invoiceNo || "Invoice"} for ${firmLabel}. ${emailMsg}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/billing-summary"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e.message || "Could not generate invoice", variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/platform/invoices/${invoiceId}/mark-paid`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marked Paid", description: `Invoice for ${firmLabel} marked as paid.` });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/billing-summary"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e.message || "Could not mark paid", variant: "destructive" });
    },
  });

  const isTrial = sub?.status === "TRIAL";
  const trialEnd = sub?.trialEnd ? new Date(sub.trialEnd) : null;
  const trialExpired = trialEnd && trialEnd < new Date();
  const canGenerate = sub && (!latestInvoice || latestInvoice.status === "PAID" || latestInvoice.status === "VOID");
  const canDispatch = latestInvoice && latestInvoice.status === "DRAFT";
  const canMarkPaid = latestInvoice && (latestInvoice.status === "ISSUED" || latestInvoice.status === "OVERDUE");

  return (
    <>
      {dispatchingInvoice && (
        <DispatchDialog
          invoice={dispatchingInvoice}
          firmName={firmLabel}
          onClose={() => setDispatchingInvoice(null)}
        />
      )}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <TableRow
            className="cursor-pointer hover:bg-muted/40"
            data-testid={`row-firm-${firm.id}`}
          >
            <TableCell className="py-2">
              <div className="flex items-center gap-1.5">
                {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium" data-testid={`text-firm-name-${firm.id}`}>{firmLabel}</p>
                  <p className="text-[11px] text-muted-foreground">{firm.email}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="py-2">
              {plan ? (
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-[11px] text-muted-foreground">PKR {formatPkr(plan.monthlyPrice)}/mo</p>
                </div>
              ) : <span className="text-muted-foreground text-sm">—</span>}
            </TableCell>
            <TableCell className="py-2">
              {sub ? subStatusBadge(sub.status) : <span className="text-muted-foreground text-sm">—</span>}
            </TableCell>
            <TableCell className="py-2">
              {isTrial && trialEnd ? (
                <div>
                  <p className="text-sm">{fmt(sub?.trialEnd)}</p>
                  <p className={`text-[11px] ${trialExpired ? "text-red-500" : "text-muted-foreground"}`}>
                    {trialExpired ? "Expired" : `Ends ${formatDistanceToNow(trialEnd, { addSuffix: true })}`}
                  </p>
                </div>
              ) : <span className="text-muted-foreground text-sm">—</span>}
            </TableCell>
            <TableCell className="py-2">
              {latestInvoice ? (
                <div className="space-y-0.5">
                  {invStatusBadge(latestInvoice.status)}
                  <p className="text-[11px] text-muted-foreground">
                    PKR {formatPkr(latestInvoice.amount)}
                  </p>
                </div>
              ) : <span className="text-xs text-muted-foreground">No invoice</span>}
            </TableCell>
            <TableCell className="py-2">
              <p className="text-sm">{fmt(latestInvoice?.issuedAt)}</p>
            </TableCell>
            <TableCell className="py-2">
              {latestInvoice?.dueAt ? (
                <div>
                  <p className="text-sm">{fmt(latestInvoice.dueAt)}</p>
                  {latestInvoice.status !== "PAID" && new Date(latestInvoice.dueAt) < new Date() && (
                    <p className="text-[10px] text-red-500 font-medium">OVERDUE</p>
                  )}
                </div>
              ) : <span className="text-sm text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="py-2">
              <div className="flex gap-1 flex-wrap">
                {canGenerate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2"
                    disabled={generateMutation.isPending}
                    onClick={(e) => { e.stopPropagation(); generateMutation.mutate(); }}
                    data-testid={`button-generate-invoice-${firm.id}`}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Generate
                  </Button>
                )}
                {canDispatch && (
                  <Button
                    size="sm"
                    className="h-7 text-[11px] px-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={(e) => { e.stopPropagation(); setDispatchingInvoice(latestInvoice); }}
                    data-testid={`button-dispatch-invoice-${firm.id}`}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Dispatch
                  </Button>
                )}
                {canMarkPaid && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                    disabled={markPaidMutation.isPending}
                    onClick={(e) => { e.stopPropagation(); markPaidMutation.mutate(latestInvoice!.id); }}
                    data-testid={`button-mark-paid-${firm.id}`}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Mark Paid
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <TableRow className="bg-muted/20">
            <TableCell colSpan={8} className="py-3 px-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice History</p>
                {sub?.invoices.length ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left pb-1">Invoice No</th>
                        <th className="text-left pb-1">Amount</th>
                        <th className="text-left pb-1">Status</th>
                        <th className="text-left pb-1">Dispatch Date</th>
                        <th className="text-left pb-1">Due Date</th>
                        <th className="text-left pb-1">Paid Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sub.invoices.map((inv) => (
                        <tr key={inv.id} className="border-t border-border/30">
                          <td className="py-1">{inv.invoiceNo || <span className="text-muted-foreground">Draft</span>}</td>
                          <td className="py-1">PKR {formatPkr(inv.amount)}</td>
                          <td className="py-1">{invStatusBadge(inv.status)}</td>
                          <td className="py-1">{fmt(inv.issuedAt)}</td>
                          <td className="py-1">{fmt(inv.dueAt)}</td>
                          <td className="py-1">{fmt(inv.paidAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-muted-foreground">No invoices yet.</p>
                )}
                {sub && (
                  <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Trial Period</p>
                      <p className="font-medium">{fmt(sub.trialStart)} — {fmt(sub.trialEnd)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current Period</p>
                      <p className="font-medium">{fmt(sub.currentPeriodStart)} — {fmt(sub.currentPeriodEnd)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next Invoice At</p>
                      <p className="font-medium">{fmt(sub.nextInvoiceAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

export default function BillingManagement() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery<{ firms: FirmRow[] }>({
    queryKey: ["/api/platform/billing-summary"],
    refetchInterval: 30000,
  });

  const lifecycleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform/billing/enforce-lifecycle");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Lifecycle Enforced", description: data.message || "Billing lifecycle enforcement completed." });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not enforce lifecycle", variant: "destructive" });
    },
  });

  const firms = (data?.firms || []).filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      (f.displayName || "").toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q)
    );
  });

  const counts = {
    trial: firms.filter((f) => f.subscriptions[0]?.status === "TRIAL").length,
    active: firms.filter((f) => f.subscriptions[0]?.status === "ACTIVE").length,
    pastDue: firms.filter((f) => f.subscriptions[0]?.status === "PAST_DUE" || f.subscriptions[0]?.status === "GRACE").length,
    suspended: firms.filter((f) => f.subscriptions[0]?.status === "SUSPENDED").length,
  };

  const pendingDispatch = firms.filter((f) => f.subscriptions[0]?.invoices[0]?.status === "DRAFT").length;
  const overdueInvoices = firms.filter((f) => {
    const inv = f.subscriptions[0]?.invoices[0];
    return inv && inv.status === "ISSUED" && inv.dueAt && new Date(inv.dueAt) < new Date();
  }).length;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold" data-testid="heading-billing-management">Billing Management</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => lifecycleMutation.mutate()}
          disabled={lifecycleMutation.isPending}
          data-testid="button-enforce-lifecycle"
        >
          <Activity className="h-3.5 w-3.5 mr-1.5" />
          {lifecycleMutation.isPending ? "Running..." : "Enforce Lifecycle"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Trial</p>
              <p className="text-xl font-bold" data-testid="count-trial">{counts.trial}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Active</p>
              <p className="text-xl font-bold" data-testid="count-active">{counts.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Send className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Pending Dispatch</p>
              <p className="text-xl font-bold" data-testid="count-pending-dispatch">{pendingDispatch}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Overdue</p>
              <p className="text-xl font-bold" data-testid="count-overdue">{overdueInvoices}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              Firm-wise Billing
            </CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search firms..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm w-52"
                  data-testid="input-search-billing"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} data-testid="button-refresh-billing">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading billing data...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead className="py-2">Firm</TableHead>
                  <TableHead className="py-2">Plan</TableHead>
                  <TableHead className="py-2">Status</TableHead>
                  <TableHead className="py-2 flex items-center gap-1"><Calendar className="h-3 w-3" />Trial End</TableHead>
                  <TableHead className="py-2">Latest Invoice</TableHead>
                  <TableHead className="py-2">Dispatch Date</TableHead>
                  <TableHead className="py-2">Due Date</TableHead>
                  <TableHead className="py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      No firms found.
                    </TableCell>
                  </TableRow>
                ) : (
                  firms.map((firm) => <FirmBillingRow key={firm.id} firm={firm} />)
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/15">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            Billing Workflow Guide
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[12px] text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 font-bold text-[10px] shrink-0 mt-0.5">1</div>
              <p><span className="font-medium text-foreground">Generate</span> — Create a draft invoice for the firm's current billing cycle.</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 font-bold text-[10px] shrink-0 mt-0.5">2</div>
              <p><span className="font-medium text-foreground">Dispatch</span> — Set invoice as ISSUED, record dispatch date & due date (15 days default). Send via courier/email.</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 font-bold text-[10px] shrink-0 mt-0.5">3</div>
              <p><span className="font-medium text-foreground">Mark Paid</span> — After receiving bank transfer/cash deposit receipt from firm.</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 font-bold text-[10px] shrink-0 mt-0.5">!</div>
              <p><span className="font-medium text-foreground">Enforce Lifecycle</span> — Automatically suspends accounts &gt;50 days overdue. Run periodically.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
