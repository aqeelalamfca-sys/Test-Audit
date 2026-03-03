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
import { BarChart3, Plus, Users, FileText, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PlanManagement() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", maxUsers: 10, maxEngagements: 50,
    allowCustomAi: false, monthlyPrice: 0,
  });

  const { data: plans, isLoading } = useQuery<any[]>({ queryKey: ["/api/platform/plans"] });

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/platform/plans", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Plan Created" });
      setShowCreateDialog(false);
      setForm({ code: "", name: "", maxUsers: 10, maxEngagements: 50, allowCustomAi: false, monthlyPrice: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/plans"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="plan-management-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Plan Management</h1>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-plan"><Plus className="h-4 w-4 mr-2" /> Create Plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Plan</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plan Code *</Label>
                  <Input data-testid="input-plan-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label>Plan Name *</Label>
                  <Input data-testid="input-plan-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Max Users</Label>
                  <Input data-testid="input-max-users" type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Max Engagements</Label>
                  <Input data-testid="input-max-engagements" type="number" value={form.maxEngagements} onChange={(e) => setForm({ ...form, maxEngagements: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Monthly Price ($)</Label>
                  <Input data-testid="input-monthly-price" type="number" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.allowCustomAi} onCheckedChange={(v) => setForm({ ...form, allowCustomAi: v })} data-testid="switch-custom-ai" />
                <Label>Allow Custom AI Key</Label>
              </div>
              <Button
                className="w-full"
                data-testid="button-submit-create-plan"
                disabled={createPlanMutation.isPending || !form.code || !form.name}
                onClick={() => createPlanMutation.mutate(form)}
              >
                {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading plans...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(plans || []).map((plan: any) => (
            <Card key={plan.id} data-testid={`card-plan-${plan.code}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  <Badge variant="outline">{plan.code}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold">${Number(plan.monthlyPrice)}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Up to {plan.maxUsers} users</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Up to {plan.maxEngagements} engagements</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span>{plan.allowCustomAi ? "Custom AI keys allowed" : "Platform AI only"}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {plan._count?.subscriptions || 0} active subscriptions
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
