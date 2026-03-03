import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, Ban, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FirmManagement() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "", adminEmail: "", adminFullName: "", email: "",
    country: "", currency: "PKR", planCode: "BASIC", trialDays: 30,
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/platform/firms", search, statusFilter],
  });

  const { data: plans } = useQuery<any>({ queryKey: ["/api/platform/plans"] });

  const createFirmMutation = useMutation({
    mutationFn: async (formData: any) => {
      const res = await apiRequest("POST", "/api/platform/firms", formData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Firm Created",
        description: `${data.firm.name} created. Admin temp password: ${data.firmAdmin.tempPassword}`,
      });
      setShowCreateDialog(false);
      setCreateForm({ name: "", adminEmail: "", adminFullName: "", email: "", country: "", currency: "PKR", planCode: "BASIC", trialDays: 30 });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/firms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/analytics"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const firmActionMutation = useMutation({
    mutationFn: async ({ firmId, action }: { firmId: string; action: string }) => {
      const res = await apiRequest("POST", `/api/platform/firms/${firmId}/${action}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Firm status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/firms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/analytics"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetAdminMutation = useMutation({
    mutationFn: async (firmId: string) => {
      const res = await apiRequest("POST", `/api/platform/firms/${firmId}/reset-admin`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Admin Reset", description: `New password for ${data.email}: ${data.tempPassword}` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const firms = data?.firms || [];

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    TRIAL: "bg-amber-100 text-amber-800",
    SUSPENDED: "bg-red-100 text-red-800",
    TERMINATED: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="firm-management-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-red-600" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Firm Management</h1>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-firm"><Plus className="h-4 w-4 mr-2" /> Create Firm</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Firm</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Firm Name *</Label>
                <Input data-testid="input-firm-name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Firm Email</Label>
                <Input data-testid="input-firm-email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Country</Label>
                  <Input data-testid="input-firm-country" value={createForm.country} onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={createForm.currency} onValueChange={(v) => setCreateForm({ ...createForm, currency: v })}>
                    <SelectTrigger data-testid="select-firm-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                      <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                      <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                      <SelectItem value="BDT">BDT - Bangladeshi Taka</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Admin Full Name *</Label>
                <Input data-testid="input-admin-name" value={createForm.adminFullName} onChange={(e) => setCreateForm({ ...createForm, adminFullName: e.target.value })} />
              </div>
              <div>
                <Label>Admin Email *</Label>
                <Input data-testid="input-admin-email" type="email" value={createForm.adminEmail} onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plan</Label>
                  <Select value={createForm.planCode} onValueChange={(v) => setCreateForm({ ...createForm, planCode: v })}>
                    <SelectTrigger data-testid="select-plan"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(plans || []).map((p: any) => (
                        <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trial Days</Label>
                  <Input data-testid="input-trial-days" type="number" value={createForm.trialDays} onChange={(e) => setCreateForm({ ...createForm, trialDays: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <Button
                className="w-full"
                data-testid="button-submit-create-firm"
                disabled={createFirmMutation.isPending || !createForm.name || !createForm.adminEmail || !createForm.adminFullName}
                onClick={() => createFirmMutation.mutate(createForm)}
              >
                {createFirmMutation.isPending ? "Creating..." : "Create Firm"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-firms"
            placeholder="Search firms..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading firms...</div>
      ) : (
        <div className="space-y-3">
          {firms.map((firm: any) => (
            <Card key={firm.id} data-testid={`card-firm-${firm.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg" data-testid={`text-firm-name-${firm.id}`}>{firm.name}</h3>
                      <Badge className={statusColor[firm.status] || "bg-gray-100"} data-testid={`badge-firm-status-${firm.id}`}>
                        {firm.status}
                      </Badge>
                      {firm.subscriptions?.[0]?.plan && (
                        <Badge variant="outline" data-testid={`badge-firm-plan-${firm.id}`}>
                          {firm.subscriptions[0].plan.name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {firm.email && <span>{firm.email} · </span>}
                      <span>{firm._count?.users || 0} users</span>
                      <span> · {firm._count?.engagements || 0} engagements</span>
                      {firm.country && <span> · {firm.country}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {firm.status === "ACTIVE" && (
                      <Button
                        variant="outline" size="sm"
                        data-testid={`button-suspend-firm-${firm.id}`}
                        onClick={() => firmActionMutation.mutate({ firmId: firm.id, action: "suspend" })}
                      >
                        <Ban className="h-3 w-3 mr-1" /> Suspend
                      </Button>
                    )}
                    {firm.status === "SUSPENDED" && (
                      <Button
                        variant="outline" size="sm"
                        data-testid={`button-activate-firm-${firm.id}`}
                        onClick={() => firmActionMutation.mutate({ firmId: firm.id, action: "activate" })}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Activate
                      </Button>
                    )}
                    {firm.status !== "TERMINATED" && (
                      <Button
                        variant="destructive" size="sm"
                        data-testid={`button-terminate-firm-${firm.id}`}
                        onClick={() => {
                          if (confirm("Are you sure you want to terminate this firm? This action is serious.")) {
                            firmActionMutation.mutate({ firmId: firm.id, action: "terminate" });
                          }
                        }}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Terminate
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm"
                      data-testid={`button-reset-admin-${firm.id}`}
                      onClick={() => resetAdminMutation.mutate(firm.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset Admin
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {firms.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No firms found</div>
          )}
        </div>
      )}
    </div>
  );
}
