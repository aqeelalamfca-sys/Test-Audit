import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { Separator } from "@/components/ui/separator";
import {
  Users, Plus, Search, Ban, CheckCircle, Pencil, Loader2,
  Shield, Grid3X3, ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES = [
  { value: "STAFF", label: "Staff / Associate" },
  { value: "SENIOR", label: "Senior" },
  { value: "MANAGER", label: "Manager / Reviewer" },
  { value: "PARTNER", label: "Partner / Approver" },
  { value: "EQCR", label: "Engagement Quality Reviewer" },
];

const MATRIX_ROLES = ["STAFF", "SENIOR", "MANAGER", "EQCR", "PARTNER", "FIRM_ADMIN"];

const ROLE_SHORT: Record<string, string> = {
  STAFF: "Staff",
  SENIOR: "Senior",
  MANAGER: "Manager",
  EQCR: "EQCR",
  PARTNER: "Partner",
  FIRM_ADMIN: "Admin",
};

const CATEGORY_LABELS: Record<string, string> = {
  SYSTEM: "System Access",
  ENGAGEMENT: "Engagement Management",
  PLANNING: "Planning Phase",
  EXECUTION: "Execution Phase",
  COMPLETION: "Completion & Reporting",
  REVIEW: "Review & Approval",
  ADMINISTRATION: "Administration",
  QUALITY: "Quality Control",
  REPORT: "Reporting",
};

const VIEW_TABS = [
  { id: "users", label: "Users", icon: <Users className="w-3.5 h-3.5" /> },
  { id: "role-matrix", label: "Role Matrix", icon: <Grid3X3 className="w-3.5 h-3.5" /> },
];

function RoleMatrixTab() {
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["SYSTEM", "ENGAGEMENT"]));

  const { data: allPermissions, isLoading: permLoading } = useQuery<any[]>({
    queryKey: ["/api/rbac/permissions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/rbac/permissions");
      return res.json();
    },
  });

  const { data: rolePermsMap, isLoading: rolePermLoading } = useQuery<Record<string, any[]>>({
    queryKey: ["/api/rbac/permissions/roles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/rbac/permissions/roles");
      return res.json();
    },
  });

  const togglePermMutation = useMutation({
    mutationFn: async ({ role, permissionId, isGranted }: { role: string; permissionId: string; isGranted: boolean }) => {
      const res = await apiRequest("PUT", "/api/admin/role-permissions", { role, permissionId, isGranted });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/permissions/roles"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const permsByCategory = useMemo(() => {
    if (!allPermissions) return {};
    const grouped: Record<string, any[]> = {};
    for (const p of allPermissions) {
      const cat = p.category || "OTHER";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }
    return grouped;
  }, [allPermissions]);

  const rolePermSets = useMemo(() => {
    if (!rolePermsMap) return {};
    const sets: Record<string, Set<string>> = {};
    for (const role of MATRIX_ROLES) {
      const perms = rolePermsMap[role] || [];
      sets[role] = new Set(perms.map((p: any) => p.code));
    }
    return sets;
  }, [rolePermsMap]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const isLoading = permLoading || rolePermLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading role matrix...</span>
      </div>
    );
  }

  const categories = Object.keys(permsByCategory).sort();

  return (
    <div className="space-y-4" data-testid="tab-role-matrix">
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50">
        <CardContent className="p-3 flex items-start gap-2 text-sm">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-blue-800 dark:text-blue-200">
            <span className="font-medium">Role Permission Matrix</span>
            <span className="block text-xs mt-0.5">
              Toggle permissions for each role. Changes take effect immediately for all users with that role. 
              Click a category row to expand/collapse its permissions.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-role-matrix">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="text-left p-2.5 font-semibold min-w-[220px] sticky left-0 bg-muted/60 z-10">Permission</th>
                {MATRIX_ROLES.map(role => (
                  <th key={role} className="text-center p-2 font-semibold min-w-[70px]">
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {ROLE_SHORT[role]}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.flatMap(cat => {
                const perms = permsByCategory[cat];
                const isExpanded = expandedCategories.has(cat);
                const catLabel = CATEGORY_LABELS[cat] || cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                const rows = [];

                rows.push(
                  <tr
                    key={`cat-${cat}`}
                    className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors border-b"
                    onClick={() => toggleCategory(cat)}
                    data-testid={`row-category-${cat}`}
                  >
                    <td className="p-2 font-medium sticky left-0 bg-muted/30 z-10" colSpan={1}>
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        {catLabel}
                        <Badge variant="secondary" className="text-[10px] ml-1">{perms.length}</Badge>
                      </div>
                    </td>
                    {MATRIX_ROLES.map(role => {
                      const roleSet = rolePermSets[role];
                      const granted = roleSet ? perms.filter(p => roleSet.has(p.code)).length : 0;
                      return (
                        <td key={role} className="text-center p-2 text-[10px] text-muted-foreground">
                          {granted}/{perms.length}
                        </td>
                      );
                    })}
                  </tr>
                );

                if (isExpanded) {
                  for (const perm of perms) {
                    rows.push(
                      <tr key={perm.id} className="border-b hover:bg-muted/20 transition-colors" data-testid={`row-perm-${perm.code}`}>
                        <td className="p-2 pl-8 sticky left-0 bg-background z-10">
                          <div>
                            <span className="text-xs font-medium">{perm.name}</span>
                            {perm.description && (
                              <span className="block text-[10px] text-muted-foreground mt-0.5 max-w-[300px] truncate">{perm.description}</span>
                            )}
                          </div>
                        </td>
                        {MATRIX_ROLES.map(role => {
                          const roleSet = rolePermSets[role];
                          const hasPermission = roleSet ? roleSet.has(perm.code) : false;
                          const isFirmAdmin = role === "FIRM_ADMIN";

                          return (
                            <td key={role} className="text-center p-2">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={isFirmAdmin ? true : hasPermission}
                                  disabled={isFirmAdmin || togglePermMutation.isPending}
                                  onCheckedChange={(checked) => {
                                    if (isFirmAdmin) return;
                                    togglePermMutation.mutate({
                                      role,
                                      permissionId: perm.id,
                                      isGranted: !!checked,
                                    });
                                  }}
                                  data-testid={`checkbox-${role}-${perm.code}`}
                                  className="h-4 w-4"
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }
                }

                return rows;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <Checkbox checked disabled className="h-3 w-3" />
          <span>Granted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox checked={false} disabled className="h-3 w-3" />
          <span>Not granted</span>
        </div>
        <Separator orientation="vertical" className="h-3" />
        <span>FIRM_ADMIN always has all permissions</span>
      </div>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({
    email: "", username: "", fullName: "", password: "", role: "STAFF",
  });
  const [editForm, setEditForm] = useState({
    fullName: "", email: "", role: "",
  });

  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["/api/tenant/users", search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiRequest("GET", `/api/tenant/users${params}`);
      return res.json();
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tenant/users", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Created" });
      setShowCreateDialog(false);
      setForm({ email: "", username: "", fullName: "", password: "", role: "STAFF" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/users"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/tenant/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "User details have been saved" });
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/users"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await apiRequest("POST", `/api/tenant/users/${id}/${action}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/users"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEditDialog = (user: any) => {
    setEditUser(user);
    setEditForm({
      fullName: user.fullName || "",
      email: user.email || "",
      role: user.role || "STAFF",
    });
  };

  const handleSaveEdit = () => {
    if (!editUser) return;
    const changes: any = {};
    if (editForm.fullName !== editUser.fullName) changes.fullName = editForm.fullName;
    if (editForm.email !== editUser.email) changes.email = editForm.email;
    if (editForm.role !== editUser.role && editUser.role !== "FIRM_ADMIN") changes.role = editForm.role;

    if (Object.keys(changes).length === 0) {
      toast({ title: "No Changes", description: "No fields were modified" });
      return;
    }

    updateUserMutation.mutate({ id: editUser.id, data: changes });
  };

  const roleColor: Record<string, string> = {
    FIRM_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    PARTNER: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    EQCR: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    SENIOR: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    STAFF: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    DELETED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  return (
    <div className="space-y-4" data-testid="tab-users">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-users"
            placeholder="Search users..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user"><Plus className="h-4 w-4 mr-2" /> Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Full Name *</Label>
                <Input data-testid="input-user-fullname" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input data-testid="input-user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Username *</Label>
                <Input data-testid="input-user-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <Label>Password *</Label>
                <Input data-testid="input-user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                data-testid="button-submit-create-user"
                disabled={createUserMutation.isPending || !form.email || !form.username || !form.fullName || !form.password}
                onClick={() => createUserMutation.mutate(form)}
              >
                {createUserMutation.isPending ? "Creating..." : "Add User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading users...</div>
      ) : (
        <div className="space-y-2">
          {(users || []).map((user: any) => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" data-testid={`text-user-name-${user.id}`}>{user.fullName}</span>
                    <Badge className={roleColor[user.role] || ""} variant="secondary">{user.role}</Badge>
                    <Badge className={statusColor[user.status] || ""} variant="secondary">{user.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {user.email} · @{user.username}
                    {user.lastLoginAt && ` · Last login: ${new Date(user.lastLoginAt).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    data-testid={`button-edit-user-${user.id}`}
                    onClick={() => openEditDialog(user)}
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {user.status === "ACTIVE" && user.role !== "FIRM_ADMIN" && (
                    <Button
                      variant="outline" size="sm"
                      data-testid={`button-suspend-user-${user.id}`}
                      onClick={() => toggleStatusMutation.mutate({ id: user.id, action: "suspend" })}
                    >
                      <Ban className="h-3 w-3 mr-1" /> Suspend
                    </Button>
                  )}
                  {user.status === "SUSPENDED" && (
                    <Button
                      variant="outline" size="sm"
                      data-testid={`button-activate-user-${user.id}`}
                      onClick={() => toggleStatusMutation.mutate({ id: user.id, action: "activate" })}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Activate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(users || []).length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No users found</div>
          )}
        </div>
      )}

      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  data-testid="input-edit-fullname"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  data-testid="input-edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                {editUser.role === "FIRM_ADMIN" ? (
                  <Input value="FIRM_ADMIN" disabled className="bg-muted" />
                ) : (
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Username: @{editUser.username} · Status: {editUser.status}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              data-testid="button-save-edit-user"
              onClick={handleSaveEdit}
              disabled={updateUserMutation.isPending || !editForm.fullName || !editForm.email}
            >
              {updateUserMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FirmUsers() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto" data-testid="firm-users-page">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Firm User Management</h1>
      </div>

      <SimpleTabNavigation
        tabs={VIEW_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeTab === "users" && <UsersTab />}
      {activeTab === "role-matrix" && <RoleMatrixTab />}
    </div>
  );
}
