import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Bot, Save, Shield, Calendar, CreditCard, Receipt, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FirmSettingsPage() {
  const { toast } = useToast();
  const [aiKeyForm, setAiKeyForm] = useState({ apiKey: "", provider: "openai" });

  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/tenant/settings"],
  });

  const { data: subscription, isLoading: subLoading } = useQuery<any>({
    queryKey: ["/api/tenant/subscription"],
  });

  const setAiKeyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tenant/settings/ai-key", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "AI Key Saved", description: "Your firm AI key has been encrypted and stored." });
      setAiKeyForm({ apiKey: "", provider: "openai" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/settings"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    TRIAL: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    PAST_DUE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    GRACE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    DORMANT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    EXPIRED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };

  const invoiceStatusColor: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    ISSUED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    SENT: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    PAID: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    VOID: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };

  const formatPkr = (amount: number | string | null | undefined) => {
    if (amount == null) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `PKR ${num.toLocaleString("en-PK")}`;
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  };

  const sub = subscription?.subscription;
  const plan = sub?.plan;
  const snap = sub?.priceSnapshot as any;
  const invoices = sub?.invoices || [];
  const monthlyPrice = snap?.monthlyPrice || (plan?.monthlyPrice ? Number(plan.monthlyPrice) : null);
  const yearlyPrice = snap?.yearlyPrice || (monthlyPrice ? monthlyPrice * 12 : null);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="firm-settings-page">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Firm Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Subscription & Billing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Firm:</span>
                      <Badge className={statusColor[subscription?.firmStatus] || ""} data-testid="badge-firm-status">
                        {subscription?.firmStatus || "Unknown"}
                      </Badge>
                    </div>
                    {sub ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Subscription:</span>
                        <Badge className={statusColor[sub.status] || ""} data-testid="badge-sub-status">
                          {sub.status}
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground" data-testid="text-no-subscription">No subscription</div>
                    )}
                  </div>

                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</div>
                    {plan ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" data-testid="badge-plan-name" className="text-sm">{plan.name}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Max {plan.maxUsers} users · {plan.maxEngagements} engagements
                        </div>
                        {plan.storageGb && (
                          <div className="text-sm text-muted-foreground">Storage: {plan.storageGb} GB</div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">No plan assigned</div>
                    )}
                  </div>

                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" /> Pricing
                    </div>
                    {monthlyPrice != null ? (
                      <>
                        <div className="text-lg font-bold text-foreground" data-testid="text-monthly-price">
                          {formatPkr(monthlyPrice)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                        </div>
                        {yearlyPrice != null && (
                          <div className="text-sm text-muted-foreground" data-testid="text-yearly-price">
                            {formatPkr(yearlyPrice)}/year
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    )}
                  </div>
                </div>

                {sub && (
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Billing Dates
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {sub.trialEnd && (
                        <div>
                          <div className="text-xs text-muted-foreground">Trial Ends</div>
                          <div className="text-sm font-medium" data-testid="text-trial-end">{formatDate(sub.trialEnd)}</div>
                        </div>
                      )}
                      {sub.currentPeriodStart && (
                        <div>
                          <div className="text-xs text-muted-foreground">Billing Period Start</div>
                          <div className="text-sm font-medium" data-testid="text-period-start">{formatDate(sub.currentPeriodStart)}</div>
                        </div>
                      )}
                      {sub.currentPeriodEnd && (
                        <div>
                          <div className="text-xs text-muted-foreground">Billing Period End</div>
                          <div className="text-sm font-medium" data-testid="text-period-end">{formatDate(sub.currentPeriodEnd)}</div>
                        </div>
                      )}
                      {sub.nextInvoiceAt && (
                        <div>
                          <div className="text-xs text-muted-foreground">Next Invoice</div>
                          <div className="text-sm font-medium" data-testid="text-next-invoice">{formatDate(sub.nextInvoiceAt)}</div>
                        </div>
                      )}
                      {sub.graceEndAt && (
                        <div>
                          <div className="text-xs text-muted-foreground">Grace Period Ends</div>
                          <div className="text-sm font-medium text-orange-600" data-testid="text-grace-end">{formatDate(sub.graceEndAt)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {sub && (
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                      <Receipt className="h-3.5 w-3.5" /> Recent Invoices
                    </div>
                    {invoices.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-3 text-center" data-testid="text-no-invoices">No invoices yet</div>
                    ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground text-xs">
                            <th className="text-left pb-2 font-medium">Invoice #</th>
                            <th className="text-left pb-2 font-medium">Amount</th>
                            <th className="text-left pb-2 font-medium">Status</th>
                            <th className="text-left pb-2 font-medium">Issued</th>
                            <th className="text-left pb-2 font-medium">Due Date</th>
                            <th className="text-left pb-2 font-medium">Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((inv: any) => (
                            <tr key={inv.id} className="border-b last:border-0" data-testid={`row-invoice-${inv.id}`}>
                              <td className="py-2 font-medium">
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  {inv.invoiceNo || "—"}
                                </div>
                              </td>
                              <td className="py-2">{formatPkr(inv.amount)}</td>
                              <td className="py-2">
                                <Badge className={`text-xs ${invoiceStatusColor[inv.status] || ""}`} data-testid={`badge-invoice-status-${inv.id}`}>
                                  {inv.status}
                                </Badge>
                              </td>
                              <td className="py-2 text-muted-foreground">{formatDate(inv.issuedAt)}</td>
                              <td className="py-2">
                                {inv.dueAt ? (
                                  <span className={new Date(inv.dueAt) < new Date() && inv.status !== "PAID" ? "text-red-600 font-medium" : ""}>
                                    {formatDate(inv.dueAt)}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="py-2 text-muted-foreground">{formatDate(inv.paidAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" /> AI API Override
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.aiOverrideEnabled && (
              <Badge className="bg-green-100 text-green-800" data-testid="badge-ai-override-active">AI Override Active</Badge>
            )}
            <div>
              <Label>API Key</Label>
              <Input
                data-testid="input-firm-ai-key"
                type="password"
                value={aiKeyForm.apiKey}
                onChange={(e) => setAiKeyForm({ ...aiKeyForm, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div>
              <Label>Provider</Label>
              <Select value={aiKeyForm.provider} onValueChange={(v) => setAiKeyForm({ ...aiKeyForm, provider: v })}>
                <SelectTrigger data-testid="select-ai-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              data-testid="button-save-ai-key"
              disabled={setAiKeyMutation.isPending || !aiKeyForm.apiKey}
              onClick={() => setAiKeyMutation.mutate(aiKeyForm)}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {setAiKeyMutation.isPending ? "Saving..." : "Save & Encrypt"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Your API key is encrypted at rest using AES-256-GCM. It will be used instead of the platform default.
            </p>
          </CardContent>
        </Card>
      </div>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Firm Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><span className="font-medium">RBAC Enforced:</span> {settings.enforceRBAC ? "Yes" : "No"}</div>
              <div><span className="font-medium">AI Enabled:</span> {settings.aiEnabled ? "Yes" : "No"}</div>
              <div><span className="font-medium">AI Requires Approval:</span> {settings.aiRequiresHumanApproval ? "Yes" : "No"}</div>
              <div><span className="font-medium">Digital Signatures:</span> {settings.requireDigitalSignatures ? "Yes" : "No"}</div>
              <div><span className="font-medium">Partner PIN:</span> {settings.requirePartnerPIN ? "Yes" : "No"}</div>
              <div><span className="font-medium">Maker-Checker:</span> {settings.makerCheckerMode}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
