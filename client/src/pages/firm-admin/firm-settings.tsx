import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient as qc, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Settings,
  Bot,
  Save,
  Shield,
  Calendar,
  CreditCard,
  Receipt,
  FileText,
  User,
  Bell,
  Palette,
  Globe,
  Sparkles,
  Loader2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  HardDrive,
  FileJson,
  Lock,
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type Provider = "openai" | "gemini" | "deepseek";

interface AISettingsData {
  aiEnabled: boolean;
  preferredProvider: string;
  providerPriority: Provider[];
  hasOpenAI: boolean;
  openaiEnabled: boolean;
  openaiTestStatus: string | null;
  openaiLastTested: string | null;
  hasGemini: boolean;
  geminiEnabled: boolean;
  geminiTestStatus: string | null;
  geminiLastTested: string | null;
  hasDeepseek: boolean;
  deepseekEnabled: boolean;
  deepseekTestStatus: string | null;
  deepseekLastTested: string | null;
  maxTokensPerResponse: number;
  autoSuggestionsEnabled: boolean;
  manualTriggerOnly: boolean;
  requestTimeout: number;
}

function loadLocalPrefs<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return defaults;
}

function saveLocalPrefs(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function SubscriptionBillingTab({ settings, settingsLoading, subscription, subLoading, aiKeyForm, setAiKeyForm, setAiKeyMutation }: any) {
  const formatPkr = (amount: number | string | null | undefined) => {
    if (amount == null) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `PKR ${num.toLocaleString("en-PK")}`;
  };
  const formatDate = (date: string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  };

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

  const sub = subscription?.subscription;
  const plan = sub?.plan;
  const snap = sub?.priceSnapshot as any;
  const invoices = sub?.invoices || [];
  const monthlyPrice = snap?.monthlyPrice || (plan?.monthlyPrice ? Number(plan.monthlyPrice) : null);
  const yearlyPrice = snap?.yearlyPrice || (monthlyPrice ? monthlyPrice * 12 : null);

  return (
    <div className="space-y-6">
      <Card>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                onChange={(e: any) => setAiKeyForm({ ...aiKeyForm, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div>
              <Label>Provider</Label>
              <Select value={aiKeyForm.provider} onValueChange={(v: string) => setAiKeyForm({ ...aiKeyForm, provider: v })}>
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

        {settings && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Firm Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
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
    </div>
  );
}

function FirmProfileTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [firmData, setFirmData] = useState({ name: "", licenseNo: "", address: "", phone: "", email: "" });

  const { data: firm, isLoading } = useQuery({
    queryKey: ["/api/firms/current"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/firms/current");
      if (!res.ok) throw new Error("Failed to fetch firm");
      return res.json();
    },
  });

  useEffect(() => {
    if (firm) {
      setFirmData({
        name: firm.name || "",
        licenseNo: firm.licenseNo || "",
        address: firm.address || "",
        phone: firm.phone || "",
        email: firm.email || "",
      });
    }
  }, [firm]);

  const handleSaveFirm = async () => {
    if (!firmData.name.trim()) {
      toast({ title: "Validation Error", description: "Firm name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/firms/${firm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(firmData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update firm");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/firms/current"] });
      toast({ title: "Firm Updated", description: "Firm profile has been saved successfully" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update firm";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firm Profile</CardTitle>
        <CardDescription>Manage your firm's basic information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firmName">Firm Name *</Label>
            <Input id="firmName" value={firmData.name} onChange={(e) => setFirmData({ ...firmData, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="licenseNo">License / Registration No</Label>
            <Input id="licenseNo" value={firmData.licenseNo} onChange={(e) => setFirmData({ ...firmData, licenseNo: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firmEmail">Email</Label>
            <Input id="firmEmail" type="email" value={firmData.email} onChange={(e) => setFirmData({ ...firmData, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firmPhone">Phone</Label>
            <Input id="firmPhone" value={firmData.phone} onChange={(e) => setFirmData({ ...firmData, phone: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="firmAddress">Address</Label>
          <Input id="firmAddress" value={firmData.address} onChange={(e) => setFirmData({ ...firmData, address: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSaveFirm} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
  }, [user?.fullName]);

  const handleSaveProfile = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast({ title: "Validation Error", description: "Full name must be at least 2 characters", variant: "destructive" });
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetchWithAuth('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update profile");
      }
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: "Profile Updated", description: "Your profile has been saved successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="input-full-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={user?.email || ""} disabled data-testid="input-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" defaultValue={user?.username || ""} disabled data-testid="input-username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" defaultValue={user?.role || ""} disabled data-testid="input-role" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSaveProfile} disabled={profileSaving} data-testid="button-save-profile">
            {profileSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {profileSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(() =>
    loadLocalPrefs("auditwise_notifications", {
      emailAlerts: true,
      reviewReminders: true,
      deadlineWarnings: true,
      teamUpdates: false,
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose what notifications you receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Email Alerts</Label>
            <p className="text-sm text-muted-foreground">Receive email notifications for important updates</p>
          </div>
          <Switch checked={notifications.emailAlerts} onCheckedChange={(v) => setNotifications({ ...notifications, emailAlerts: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Review Reminders</Label>
            <p className="text-sm text-muted-foreground">Get reminded about pending reviews</p>
          </div>
          <Switch checked={notifications.reviewReminders} onCheckedChange={(v) => setNotifications({ ...notifications, reviewReminders: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Deadline Warnings</Label>
            <p className="text-sm text-muted-foreground">Receive warnings about approaching deadlines</p>
          </div>
          <Switch checked={notifications.deadlineWarnings} onCheckedChange={(v) => setNotifications({ ...notifications, deadlineWarnings: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Team Updates</Label>
            <p className="text-sm text-muted-foreground">Get notified when team members complete tasks</p>
          </div>
          <Switch checked={notifications.teamUpdates} onCheckedChange={(v) => setNotifications({ ...notifications, teamUpdates: v })} />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => { saveLocalPrefs("auditwise_notifications", notifications); toast({ title: "Preferences Saved", description: "Notification preferences updated" }); }}>
            <Save className="h-4 w-4 mr-2" />
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PreferencesTab() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState(() =>
    loadLocalPrefs("auditwise_preferences", {
      language: "en",
      dateFormat: "DD/MM/YYYY",
      timezone: "PKT",
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display Preferences</CardTitle>
        <CardDescription>Customize your display settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={preferences.language} onValueChange={(v) => setPreferences({ ...preferences, language: v })}>
              <SelectTrigger>
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ur">Urdu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={preferences.dateFormat} onValueChange={(v) => setPreferences({ ...preferences, dateFormat: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={preferences.timezone} onValueChange={(v) => setPreferences({ ...preferences, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PKT">Pakistan Standard Time (PKT)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="GST">Gulf Standard Time (GST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => { saveLocalPrefs("auditwise_preferences", preferences); toast({ title: "Preferences Saved", description: "Display preferences updated" }); }}>
            <Save className="h-4 w-4 mr-2" />
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast({ title: "Error", description: "Current password is required", variant: "destructive" });
      return;
    }
    const pwErrors: string[] = [];
    if (newPassword.length < 8) pwErrors.push("at least 8 characters");
    if (!/[a-z]/.test(newPassword)) pwErrors.push("a lowercase letter");
    if (!/[A-Z]/.test(newPassword)) pwErrors.push("an uppercase letter");
    if (!/\d/.test(newPassword)) pwErrors.push("a number");
    if (!/[@$!%*?&#^()_+\-=\[\]{}|\\:";'<>,./~`]/.test(newPassword)) pwErrors.push("a special character");
    if (pwErrors.length > 0) {
      toast({ title: "Weak Password", description: `Password must contain ${pwErrors.join(", ")}`, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to change password");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password Changed", description: "Your password has been updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleChangePassword} disabled={passwordSaving}>
            {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            {passwordSaving ? "Updating..." : "Change Password"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const AUDIT_PHASES_CONFIG = [
  { key: "pre-planning", label: "Pre-Planning", description: "Engagement acceptance, independence, and initial setup" },
  { key: "requisition", label: "Data Intake", description: "Financial data upload, validation, and reconciliation" },
  { key: "planning", label: "Planning", description: "Risk assessment, materiality, and audit strategy" },
  { key: "execution", label: "Execution", description: "Substantive testing, controls testing, and fieldwork" },
  { key: "fs-heads", label: "FS Heads", description: "Financial statement working papers" },
  { key: "evidence", label: "Evidence", description: "Evidence vault and documentation" },
  { key: "finalization", label: "Finalization", description: "Going concern, subsequent events, and opinion" },
  { key: "deliverables", label: "Deliverables", description: "Audit reports and management letters" },
  { key: "eqcr", label: "QR / EQCR", description: "Quality review and engagement quality control review" },
  { key: "inspection", label: "Inspection", description: "ISQM-1 inspection readiness and quality monitoring" },
];

function LockingPhasesTab({ settings, settingsLoading }: { settings: any; settingsLoading: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const phaseLockingEnabled = settings?.phaseLockingEnabled ?? true;

  const handleToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseLockingEnabled: enabled }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/settings/public"] });
      toast({
        title: enabled ? "Phase Locking Activated" : "Phase Locking Deactivated",
        description: enabled
          ? "Audit phases will now require sequential completion before the next phase unlocks."
          : "All audit phases are now accessible without sequential completion requirements.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update phase locking", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Phase Locking System
          </CardTitle>
          <CardDescription>
            Control whether audit phases must be completed sequentially before the next phase becomes accessible
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Enable Phase Locking</Label>
                    <Badge
                      className={phaseLockingEnabled
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }
                    >
                      {phaseLockingEnabled ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {phaseLockingEnabled
                      ? "Phases are locked until the previous phase is completed. This ensures sequential audit workflow."
                      : "All phases are unlocked and accessible regardless of previous phase completion status."}
                  </p>
                </div>
                <Switch
                  checked={phaseLockingEnabled}
                  onCheckedChange={handleToggle}
                  disabled={saving}
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Audit Phase Sequence</h3>
                <div className="space-y-2">
                  {AUDIT_PHASES_CONFIG.map((phase, index) => (
                    <div
                      key={phase.key}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{phase.label}</span>
                          {phaseLockingEnabled && index > 0 && phase.key !== "requisition" && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                          {phase.key === "requisition" && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">Always Open</Badge>
                          )}
                          {index === 0 && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">Starting Phase</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{phase.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Note:</strong> Phase locking applies to all 10 audit phases. The "Data Intake" phase is 
                  always accessible regardless of locking status, as auditors need to upload financial data early 
                  in the engagement. "QR / EQCR" and "Inspection" phases are only visible to authorized roles 
                  (Firm Admin, Partner, Manager, EQCR). When phase locking is active, all other phases require the 
                  previous phase to reach at least "In Progress" status before they unlock.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FirmSettingsPage() {
  const { user } = useAuth();
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
      qc.invalidateQueries({ queryKey: ["/api/tenant/settings"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isFirmAdmin = user?.role === "FIRM_ADMIN";

  return (
    <div className="page-container" data-testid="firm-settings-page">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Firm Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage firm configuration and your account settings</p>
      </div>

      <Tabs defaultValue="firm" className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="firm" data-testid="tab-firm">
            <Shield className="h-4 w-4 mr-1.5" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="firm-profile" data-testid="tab-firm-profile">
            <Building2 className="h-4 w-4 mr-1.5" />
            Firm Profile
          </TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="h-4 w-4 mr-1.5" />
            My Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-1.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <Palette className="h-4 w-4 mr-1.5" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="h-4 w-4 mr-1.5" />
            Security
          </TabsTrigger>
          <TabsTrigger value="locking-phases" data-testid="tab-locking-phases">
            <Lock className="h-4 w-4 mr-1.5" />
            Locking Phases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="firm">
          <SubscriptionBillingTab
            settings={settings}
            settingsLoading={settingsLoading}
            subscription={subscription}
            subLoading={subLoading}
            aiKeyForm={aiKeyForm}
            setAiKeyForm={setAiKeyForm}
            setAiKeyMutation={setAiKeyMutation}
          />
        </TabsContent>

        <TabsContent value="firm-profile">
          <FirmProfileTab />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="locking-phases">
          <LockingPhasesTab settings={settings} settingsLoading={settingsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
