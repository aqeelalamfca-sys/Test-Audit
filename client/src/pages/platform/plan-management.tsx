import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Plus, Users, FileText, Bot, Building2, HardDrive, Crown, ChevronRight, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emptyForm = {
  code: "", name: "", maxUsers: 10, maxEngagements: 50, maxOffices: 1, storageGb: 5,
  allowCustomAi: false, platformAiIncluded: true, monthlyPrice: 0,
  monthlyDiscount: 0, yearlyDiscount: 0, specialOffer: "",
  userOveragePkr: 0, officeOveragePkr: 0, engagementPackSize: 10, engagementPackPkr: 0,
  isPublic: true, isActive: true, supportLevel: "standard",
};

const PKR_TO_USD = 278;

function formatPkr(value: number | string) {
  return Number(value).toLocaleString("en-PK");
}

function formatUsd(pkr: number | string) {
  return Math.round(Number(pkr) / PKR_TO_USD).toLocaleString("en-US");
}

function isUnlimited(value: number) {
  return value >= 9999;
}

export default function PlanManagement() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: plans, isLoading } = useQuery<any[]>({ queryKey: ["/api/platform/plans"], refetchInterval: 30000 });

  const savePlanMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingPlan) {
        const res = await apiRequest("PATCH", `/api/platform/plans/${editingPlan.id}`, data);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/platform/plans", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editingPlan ? "Plan Updated" : "Plan Created" });
      setShowCreateDialog(false);
      setEditingPlan(null);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/plans"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setForm({
      code: plan.code,
      name: plan.name,
      maxUsers: plan.maxUsers,
      maxEngagements: plan.maxEngagements,
      maxOffices: plan.maxOffices || 1,
      storageGb: plan.storageGb || 5,
      allowCustomAi: plan.allowCustomAi,
      platformAiIncluded: plan.platformAiIncluded ?? true,
      monthlyPrice: Number(plan.monthlyPrice),
      monthlyDiscount: plan.monthlyDiscount || 0,
      yearlyDiscount: plan.yearlyDiscount || 0,
      specialOffer: plan.specialOffer || "",
      userOveragePkr: Number(plan.userOveragePkr || 0),
      officeOveragePkr: Number(plan.officeOveragePkr || 0),
      engagementPackSize: plan.engagementPackSize || 10,
      engagementPackPkr: Number(plan.engagementPackPkr || 0),
      isPublic: plan.isPublic ?? true,
      isActive: plan.isActive ?? true,
      supportLevel: plan.supportLevel || "standard",
    });
    setShowCreateDialog(true);
  };

  const tierColors: Record<string, string> = {
    STARTER: "border-blue-200 dark:border-blue-800",
    GROWTH: "border-green-200 dark:border-green-800",
    PROFESSIONAL: "border-purple-200 dark:border-purple-800",
    ENTERPRISE: "border-amber-200 dark:border-amber-800",
  };

  const tierBadgeColors: Record<string, string> = {
    STARTER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    GROWTH: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    PROFESSIONAL: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    ENTERPRISE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };

  const activePlans = (plans || []).filter((p: any) => p.isActive !== false);
  const inactivePlans = (plans || []).filter((p: any) => p.isActive === false);

  return (
    <div className="page-container" data-testid="plan-management-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Plan Management</h1>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setEditingPlan(null);
            setForm({ ...emptyForm });
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-plan"><Plus className="h-4 w-4 mr-2" /> Create Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? `Edit Plan: ${editingPlan.name}` : "Create Plan"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plan Code *</Label>
                  <Input
                    data-testid="input-plan-code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    disabled={!!editingPlan}
                  />
                </div>
                <div>
                  <Label>Plan Name *</Label>
                  <Input data-testid="input-plan-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Included Limits</p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Max Users</Label>
                  <Input data-testid="input-max-users" type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Max Offices</Label>
                  <Input data-testid="input-max-offices" type="number" value={form.maxOffices} onChange={(e) => setForm({ ...form, maxOffices: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Max Engagements</Label>
                  <Input data-testid="input-max-engagements" type="number" value={form.maxEngagements} onChange={(e) => setForm({ ...form, maxEngagements: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Storage (GB)</Label>
                  <Input data-testid="input-storage-gb" type="number" value={form.storageGb} onChange={(e) => setForm({ ...form, storageGb: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Pricing (PKR / Monthly)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Base Price</Label>
                  <Input data-testid="input-monthly-price" type="number" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Support Level</Label>
                  <Input data-testid="input-support-level" value={form.supportLevel} onChange={(e) => setForm({ ...form, supportLevel: e.target.value })} placeholder="standard / priority / dedicated" />
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Discounts & Offers</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monthly Discount (%)</Label>
                  <Input data-testid="input-monthly-discount" type="number" min={0} max={100} value={form.monthlyDiscount} onChange={(e) => setForm({ ...form, monthlyDiscount: parseInt(e.target.value) || 0 })} />
                  {form.monthlyDiscount > 0 && form.monthlyPrice > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Monthly: PKR {formatPkr(Math.round(form.monthlyPrice * (1 - form.monthlyDiscount / 100)))}/mo
                    </p>
                  )}
                </div>
                <div>
                  <Label>Annual Discount (%)</Label>
                  <Input data-testid="input-yearly-discount" type="number" min={0} max={100} value={form.yearlyDiscount} onChange={(e) => setForm({ ...form, yearlyDiscount: parseInt(e.target.value) || 0 })} />
                  {form.yearlyDiscount > 0 && form.monthlyPrice > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Annual: PKR {formatPkr(Math.round(form.monthlyPrice * (1 - form.yearlyDiscount / 100)))}/mo · PKR {formatPkr(Math.round(form.monthlyPrice * (1 - form.yearlyDiscount / 100)) * 12)}/yr
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label>Special Offer</Label>
                <Input data-testid="input-special-offer" value={form.specialOffer} onChange={(e) => setForm({ ...form, specialOffer: e.target.value })} placeholder="e.g. Launch offer — 50% off first 3 months" />
              </div>

              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Overage Pricing (PKR)</p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Per Extra User</Label>
                  <Input data-testid="input-user-overage" type="number" value={form.userOveragePkr} onChange={(e) => setForm({ ...form, userOveragePkr: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Per Extra Office</Label>
                  <Input data-testid="input-office-overage" type="number" value={form.officeOveragePkr} onChange={(e) => setForm({ ...form, officeOveragePkr: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Eng. Pack Size</Label>
                  <Input data-testid="input-eng-pack-size" type="number" value={form.engagementPackSize} onChange={(e) => setForm({ ...form, engagementPackSize: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label>Eng. Pack Price</Label>
                  <Input data-testid="input-eng-pack-price" type="number" value={form.engagementPackPkr} onChange={(e) => setForm({ ...form, engagementPackPkr: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium text-muted-foreground">AI & Visibility</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2">
                  <Switch checked={form.platformAiIncluded} onCheckedChange={(v) => setForm({ ...form, platformAiIncluded: v })} data-testid="switch-platform-ai" />
                  <Label>Platform AI Included</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.allowCustomAi} onCheckedChange={(v) => setForm({ ...form, allowCustomAi: v })} data-testid="switch-custom-ai" />
                  <Label>Allow Custom AI Key</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.isPublic} onCheckedChange={(v) => setForm({ ...form, isPublic: v })} data-testid="switch-is-public" />
                  <Label>Public Plan</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-testid="switch-is-active" />
                  <Label>Active</Label>
                </div>
              </div>

              <Button
                className="w-full"
                data-testid="button-submit-plan"
                disabled={savePlanMutation.isPending || !form.code || !form.name}
                onClick={() => savePlanMutation.mutate({
                  ...form,
                  specialOffer: form.specialOffer || null,
                })}
              >
                {savePlanMutation.isPending ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading plans...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {activePlans.map((plan: any) => {
              const borderColor = tierColors[plan.code] || "border-border";
              const badgeColor = tierBadgeColors[plan.code] || "bg-gray-100 text-gray-800";
              const isEnterprise = plan.code === "ENTERPRISE";
              const subCount = plan._count?.subscriptions || 0;

              return (
                <Card
                  key={plan.id}
                  className={`relative border-2 ${borderColor} transition-shadow hover:shadow-md`}
                  data-testid={`card-plan-${plan.code}`}
                >
                  {isEnterprise && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-500 text-white text-[10px] px-2 py-0.5 gap-1">
                        <Crown className="h-3 w-3" /> PREMIUM
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2 pt-5">
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-lg">{plan.name}</span>
                      <Badge className={`${badgeColor} text-[10px] font-semibold`}>{plan.code}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <div>
                      <span className="text-xl font-bold">PKR {formatPkr(plan.monthlyPrice)}</span>
                      <span className="text-sm text-muted-foreground">/mo</span>
                      <p className="text-xs text-muted-foreground mt-0.5">≈ USD {formatUsd(plan.monthlyPrice)}/mo</p>
                      {(plan.monthlyDiscount > 0 || plan.yearlyDiscount > 0) && (
                        <div className="mt-1.5 space-y-0.5">
                          {plan.monthlyDiscount > 0 && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                              Monthly: PKR {formatPkr(Math.round(Number(plan.monthlyPrice) * (1 - plan.monthlyDiscount / 100)))}/mo ({plan.monthlyDiscount}% off)
                            </p>
                          )}
                          {plan.yearlyDiscount > 0 && (
                            <p className="text-[11px] text-blue-600 dark:text-blue-400">
                              Annual: PKR {formatPkr(Math.round(Number(plan.monthlyPrice) * (1 - plan.yearlyDiscount / 100)))}/mo ({plan.yearlyDiscount}% off) · PKR {formatPkr(Math.round(Number(plan.monthlyPrice) * (1 - plan.yearlyDiscount / 100)) * 12)}/yr
                            </p>
                          )}
                        </div>
                      )}
                      {plan.specialOffer && (
                        <Badge variant="outline" className="mt-1.5 text-[10px] text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                          {plan.specialOffer}
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2" data-testid={`text-plan-users-${plan.code}`}>
                        <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{isUnlimited(plan.maxUsers) ? "Unlimited" : `Up to ${plan.maxUsers}`} users</span>
                      </div>
                      <div className="flex items-center gap-2" data-testid={`text-plan-offices-${plan.code}`}>
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{isUnlimited(plan.maxOffices) ? "Unlimited" : `Up to ${plan.maxOffices}`} office{plan.maxOffices !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2" data-testid={`text-plan-engagements-${plan.code}`}>
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{isUnlimited(plan.maxEngagements) ? "Unlimited" : `Up to ${plan.maxEngagements}`} engagements/yr</span>
                      </div>
                      <div className="flex items-center gap-2" data-testid={`text-plan-storage-${plan.code}`}>
                        <HardDrive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{plan.storageGb || 5} GB storage</span>
                      </div>
                      <div className="flex items-center gap-2" data-testid={`text-plan-ai-${plan.code}`}>
                        <Bot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{plan.allowCustomAi ? "Custom AI keys allowed" : "Platform AI only"}</span>
                      </div>
                    </div>

                    {!isEnterprise && Number(plan.userOveragePkr) > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground text-[11px]">Overages</p>
                          <p>+PKR {formatPkr(plan.userOveragePkr)}/extra user</p>
                          <p>+PKR {formatPkr(plan.officeOveragePkr)}/extra office</p>
                          <p>+PKR {formatPkr(plan.engagementPackPkr)}/{plan.engagementPackSize} engagements</p>
                        </div>
                      </>
                    )}

                    {isEnterprise && plan.supportLevel === "dedicated" && (
                      <>
                        <Separator />
                        <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                          Priority Support + Dedicated Manager
                        </div>
                      </>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground" data-testid={`text-plan-subs-${plan.code}`}>
                        {subCount} active subscription{subCount !== 1 ? "s" : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => openEdit(plan)}
                        data-testid={`button-edit-plan-${plan.code}`}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {inactivePlans.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Inactive / Legacy Plans</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {inactivePlans.map((plan: any) => (
                  <Card key={plan.id} className="opacity-60 border-dashed" data-testid={`card-plan-inactive-${plan.code}`}>
                    <CardContent className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{plan.name} <Badge variant="outline" className="ml-1 text-[10px]">{plan.code}</Badge></div>
                        <div className="text-sm text-muted-foreground">PKR {formatPkr(plan.monthlyPrice)}/mo · {plan._count?.subscriptions || 0} subscriptions</div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => openEdit(plan)} data-testid={`button-edit-legacy-${plan.code}`}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
