import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, Ban, CheckCircle, XCircle, RotateCcw, Upload, X, MapPin, Mail, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const emptyForm = {
  name: "", displayName: "", adminEmail: "", adminFullName: "", email: "",
  phone: "", country: "Pakistan", currency: "PKR", planCode: "STARTER", trialDays: 14,
  headOfficeAddress: "", ntn: "",
  branches: [] as { name: string; address: string }[],
};

export default function FirmManagement() {
  const { toast } = useToast();
  const { } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyForm });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/platform/firms", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const url = `/api/platform/firms${params.toString() ? `?${params}` : ""}`;
      const token = localStorage.getItem("auditwise_token");
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: plans } = useQuery<any>({ queryKey: ["/api/platform/plans"] });

  const uploadLogo = async (firmId: string, file: File) => {
    const formData = new FormData();
    formData.append("logo", file);
    const token = localStorage.getItem("auditwise_token");
    const res = await fetch(`/api/platform/firms/${firmId}/logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || "Logo upload failed");
    }
    return res.json();
  };

  const createFirmMutation = useMutation({
    mutationFn: async (formData: any) => {
      const res = await apiRequest("POST", "/api/platform/firms", formData);
      return res.json();
    },
    onSuccess: async (data) => {
      if (logoFile && data.firm?.id) {
        try {
          await uploadLogo(data.firm.id, logoFile);
        } catch {
          toast({ title: "Warning", description: "Firm created but logo upload failed", variant: "destructive" });
        }
      }
      toast({
        title: "Firm Created",
        description: `${data.firm.name} created. Invite link sent to ${data.invite?.email || "admin"}.`,
      });
      setShowCreateDialog(false);
      setCreateForm({ ...emptyForm });
      setLogoFile(null);
      setLogoPreview(null);
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
      toast({ title: "Admin Reset", description: `New invite link generated for ${data.email}. Share the link with the admin.` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [inviteFirmId, setInviteFirmId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("FIRM_ADMIN");

  const { data: invitesData } = useQuery<any[]>({
    queryKey: ["/api/platform/firms", inviteFirmId, "invites"],
    enabled: !!inviteFirmId,
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platform/firms/${inviteFirmId}/invite-admin`, {
        email: inviteEmail,
        role: inviteRole,
      });
      return res.json();
    },
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}/invite/${data.token}`;
      navigator.clipboard.writeText(fullUrl).catch(() => {});
      toast({
        title: "Invite Created",
        description: `Invite link copied to clipboard. Expires in 48 hours.`,
      });
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/platform/firms", inviteFirmId, "invites"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await apiRequest("DELETE", `/api/platform/invites/${inviteId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite Revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/firms", inviteFirmId, "invites"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Logo must be under 5MB", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addBranch = () => {
    setCreateForm({
      ...createForm,
      branches: [...createForm.branches, { name: "", address: "" }],
    });
  };

  const updateBranch = (index: number, field: "name" | "address", value: string) => {
    const updated = [...createForm.branches];
    updated[index] = { ...updated[index], [field]: value };
    setCreateForm({ ...createForm, branches: updated });
  };

  const removeBranch = (index: number) => {
    setCreateForm({
      ...createForm,
      branches: createForm.branches.filter((_, i) => i !== index),
    });
  };

  const firms = data?.firms || [];

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    TRIAL: "bg-amber-100 text-amber-800",
    DORMANT: "bg-orange-100 text-orange-800",
    SUSPENDED: "bg-red-100 text-red-800",
    TERMINATED: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="page-container" data-testid="firm-management-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Firm Management</h1>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setCreateForm({ ...emptyForm });
            setLogoFile(null);
            setLogoPreview(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-firm"><Plus className="h-4 w-4 mr-2" /> Create Firm</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Firm</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                <Building2 className="h-3.5 w-3.5" />
                Firm Information
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Firm Legal Name *</Label>
                  <Input data-testid="input-firm-name" placeholder="e.g. Ahmad & Co. Chartered Accountants" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>Display Name (optional)</Label>
                  <Input data-testid="input-firm-display-name" placeholder="e.g. Ahmad & Co." value={createForm.displayName} onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Firm Email (optional)</Label>
                  <Input data-testid="input-firm-email" type="email" placeholder="firm@example.com" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
                </div>
                <div>
                  <Label>Mobile Number (optional)</Label>
                  <Input data-testid="input-firm-phone" type="tel" placeholder="e.g. +92 300 1234567" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>NTN (National Tax Number)</Label>
                  <Input data-testid="input-firm-ntn" placeholder="e.g. 1234567-8" value={createForm.ntn} onChange={(e) => setCreateForm({ ...createForm, ntn: e.target.value })} />
                </div>
                <div>
                  <Label>Firm Logo (optional)</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoSelect}
                      data-testid="input-firm-logo"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => logoInputRef.current?.click()}
                      data-testid="button-upload-logo"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {logoFile ? logoFile.name : "Choose Logo"}
                    </Button>
                    {logoPreview && (
                      <div className="relative h-9 w-9 rounded border overflow-hidden flex-shrink-0">
                        <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain" />
                        <button
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px]"
                          onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label>Head Office Address (optional)</Label>
                <Input
                  data-testid="input-firm-address"
                  placeholder="e.g. Suite 201, 2nd Floor, Business Tower, Lahore"
                  value={createForm.headOfficeAddress}
                  onChange={(e) => setCreateForm({ ...createForm, headOfficeAddress: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Branch Offices</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addBranch} data-testid="button-add-branch">
                    <Plus className="h-3 w-3 mr-1" /> Add Branch
                  </Button>
                </div>
                {createForm.branches.length === 0 && (
                  <p className="text-xs text-muted-foreground">No branches added. Click "Add Branch" to add branch offices.</p>
                )}
                <div className="space-y-2">
                  {createForm.branches.map((branch, idx) => (
                    <div key={idx} className="flex gap-2 items-start p-2 border rounded-md bg-muted/30">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-2 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Input
                          placeholder="Branch name (e.g. Lahore Office)"
                          value={branch.name}
                          onChange={(e) => updateBranch(idx, "name", e.target.value)}
                          className="h-8 text-sm"
                          data-testid={`input-branch-name-${idx}`}
                        />
                        <Input
                          placeholder="Branch address"
                          value={branch.address}
                          onChange={(e) => updateBranch(idx, "address", e.target.value)}
                          className="h-8 text-sm"
                          data-testid={`input-branch-address-${idx}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-red-600"
                        onClick={() => removeBranch(idx)}
                        data-testid={`button-remove-branch-${idx}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Admin Full Name *</Label>
                    <Input data-testid="input-admin-name" value={createForm.adminFullName} onChange={(e) => setCreateForm({ ...createForm, adminFullName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Admin Email *</Label>
                    <Input data-testid="input-admin-email" type="email" value={createForm.adminEmail} onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })} />
                  </div>
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
              </div>

              <Button
                className="w-full"
                data-testid="button-submit-create-firm"
                disabled={createFirmMutation.isPending || !createForm.name || !createForm.adminEmail || !createForm.adminFullName}
                onClick={() => {
                  const { branches, displayName, phone, email, ...rest } = createForm;
                  const payload = {
                    ...rest,
                    displayName: displayName || undefined,
                    phone: phone || undefined,
                    email: email || undefined,
                    branches: branches.filter(b => b.name || b.address),
                  };
                  createFirmMutation.mutate(payload);
                }}
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
            <SelectItem value="DORMANT">Dormant</SelectItem>
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
                <div className="flex items-start justify-between">
                  <div className="flex gap-3 flex-1">
                    {firm.logoUrl && (
                      <img
                        src={firm.logoUrl}
                        alt={`${firm.name} logo`}
                        className="h-10 w-10 rounded object-contain border flex-shrink-0"
                        data-testid={`img-firm-logo-${firm.id}`}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-lg" data-testid={`text-firm-name-${firm.id}`}>{firm.name}</h3>
                        <Badge className={statusColor[firm.status] || "bg-gray-100"} data-testid={`badge-firm-status-${firm.id}`}>
                          {firm.status}
                        </Badge>
                        {firm.subscriptions?.[0]?.plan && (
                          <Badge variant="outline" data-testid={`badge-firm-plan-${firm.id}`}>
                            {firm.subscriptions[0].plan.name} — PKR {Number(firm.subscriptions[0].plan.monthlyPrice).toLocaleString()}/mo
                          </Badge>
                        )}
                        {firm.subscriptions?.[0]?.status && (
                          <Badge variant="secondary" className="text-[10px]" data-testid={`badge-sub-status-${firm.id}`}>
                            Sub: {firm.subscriptions[0].status}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {firm.email && <span>{firm.email}</span>}
                          <span>{firm._count?.users || 0}/{firm.subscriptions?.[0]?.plan?.maxUsers || '?'} users</span>
                          <span>{firm._count?.engagements || 0}/{firm.subscriptions?.[0]?.plan?.maxEngagements >= 9999 ? '∞' : firm.subscriptions?.[0]?.plan?.maxEngagements || '?'} engagements</span>
                          {firm.country && <span>{firm.country}</span>}
                        </div>
                        {firm.subscriptions?.[0]?.trialEnd && firm.subscriptions[0].status === "TRIAL" && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            Trial ends: {new Date(firm.subscriptions[0].trialEnd).toLocaleDateString()}
                          </div>
                        )}
                        {firm.subscriptions?.[0]?.graceEndAt && (firm.subscriptions[0].status === "GRACE" || firm.subscriptions[0].status === "PAST_DUE") && (
                          <div className="text-xs text-red-600 dark:text-red-400">
                            Grace ends: {new Date(firm.subscriptions[0].graceEndAt).toLocaleDateString()}
                          </div>
                        )}
                        {firm.taxId && (
                          <div className="text-xs">NTN: {firm.taxId}</div>
                        )}
                        {firm.headOfficeAddress && (
                          <div className="text-xs flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {firm.headOfficeAddress}
                          </div>
                        )}
                        {firm.offices && Array.isArray(firm.offices) && (firm.offices as any[]).length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {(firm.offices as any[]).length} branch{(firm.offices as any[]).length > 1 ? "es" : ""}: {(firm.offices as any[]).map((b: any) => b.name).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {firm.status === "ACTIVE" && (
                      <Button
                        variant="outline" size="sm"
                        data-testid={`button-suspend-firm-${firm.id}`}
                        onClick={() => firmActionMutation.mutate({ firmId: firm.id, action: "suspend" })}
                      >
                        <Ban className="h-3 w-3 mr-1" /> Suspend
                      </Button>
                    )}
                    {(firm.status === "SUSPENDED" || firm.status === "DORMANT") && (
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
                    <Button
                      variant="outline" size="sm"
                      data-testid={`button-invite-admin-${firm.id}`}
                      onClick={() => setInviteFirmId(firm.id)}
                    >
                      <Mail className="h-3 w-3 mr-1" /> Invite Admin
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

      <Dialog open={!!inviteFirmId} onOpenChange={(open) => { if (!open) { setInviteFirmId(null); setInviteEmail(""); } }}>
        <DialogContent className="max-w-lg" data-testid="invite-admin-dialog">
          <DialogHeader>
            <DialogTitle>Invite Firm Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Email Address</Label>
                <Input
                  data-testid="input-invite-email"
                  type="email"
                  placeholder="admin@firm.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="w-40">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIRM_ADMIN">Firm Admin</SelectItem>
                    <SelectItem value="PARTNER">Engagement Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full"
              data-testid="button-send-invite"
              disabled={!inviteEmail || createInviteMutation.isPending}
              onClick={() => createInviteMutation.mutate()}
            >
              {createInviteMutation.isPending ? "Sending..." : "Send Invite & Copy Link"}
            </Button>

            {invitesData && invitesData.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <h4 className="font-medium text-sm">Pending Invites</h4>
                {invitesData.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm border rounded p-2" data-testid={`invite-row-${inv.id}`}>
                    <div>
                      <span className="font-medium">{inv.email}</span>
                      <span className="text-muted-foreground ml-2">{inv.role?.replace(/_/g, " ")}</span>
                      {inv.acceptedAt && <Badge className="ml-2 bg-green-100 text-green-800">Accepted</Badge>}
                      {inv.revokedAt && <Badge className="ml-2 bg-red-100 text-red-800">Revoked</Badge>}
                      {!inv.acceptedAt && !inv.revokedAt && new Date(inv.expiresAt) < new Date() && (
                        <Badge className="ml-2 bg-gray-100 text-gray-800">Expired</Badge>
                      )}
                      {!inv.acceptedAt && !inv.revokedAt && new Date(inv.expiresAt) >= new Date() && (
                        <Badge className="ml-2 bg-amber-100 text-amber-800">Pending</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {!inv.acceptedAt && !inv.revokedAt && new Date(inv.expiresAt) >= new Date() && (
                        <>
                          <Button
                            variant="ghost" size="sm"
                            data-testid={`button-copy-invite-${inv.id}`}
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`);
                              toast({ title: "Copied", description: "Invite link copied to clipboard" });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            data-testid={`button-revoke-invite-${inv.id}`}
                            onClick={() => revokeInviteMutation.mutate(inv.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
