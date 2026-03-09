import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Search, Ban, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES = [
  { value: "STAFF", label: "Staff / Associate" },
  { value: "SENIOR", label: "Senior" },
  { value: "MANAGER", label: "Manager / Reviewer" },
  { value: "PARTNER", label: "Partner / Approver" },
  { value: "EQCR", label: "Engagement Quality Reviewer" },
];

export default function FirmUsers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({
    email: "", username: "", fullName: "", password: "", role: "STAFF",
  });

  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["/api/tenant/users", search],
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

  const roleColor: Record<string, string> = {
    FIRM_ADMIN: "bg-red-100 text-red-800",
    PARTNER: "bg-purple-100 text-purple-800",
    EQCR: "bg-amber-100 text-amber-800",
    MANAGER: "bg-blue-100 text-blue-800",
    SENIOR: "bg-green-100 text-green-800",
    STAFF: "bg-gray-100 text-gray-800",
  };

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    SUSPENDED: "bg-red-100 text-red-800",
    DELETED: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="firm-users-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Firm User Management</h1>
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

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-users"
          placeholder="Search users..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                  {user.status === "ACTIVE" && (
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
    </div>
  );
}
