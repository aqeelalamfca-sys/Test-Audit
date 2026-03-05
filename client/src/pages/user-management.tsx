import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, Plus, Search, Eye, Edit, Shield, Loader2, Check, X, AlertCircle, Info } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface User {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
}

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  isFromRole?: boolean;
  isEffective?: boolean;
  hasOverride?: boolean;
  overrideGranted?: boolean;
  overrideReason?: string;
  overrideExpiresAt?: string;
  overrideGrantedBy?: string;
}

interface UserPermissions {
  user: { id: string; fullName: string; role: string };
  permissions: Permission[];
}

const ROLES = [
  { value: "PARTNER", label: "Engagement Partner", description: "Final review, approval, sign-off, overall engagement responsibility" },
  { value: "EQCR", label: "Engagement Quality Reviewer", description: "Independent review access, challenge/comment, no edit rights" },
  { value: "MANAGER", label: "Manager", description: "Planning, supervision, review rights, budget/timeline management" },
  { value: "SENIOR", label: "Senior", description: "Workpaper preparation, initial review, team support" },
  { value: "STAFF", label: "Audit Team", description: "Workpaper completion, task execution" },
];

const CATEGORY_LABELS: Record<string, string> = {
  SYSTEM: "System Access",
  ENGAGEMENT: "Engagement Management",
  CLIENT: "Client Management",
  PLANNING: "Planning Phase",
  EXECUTION: "Execution Phase",
  FINALIZATION: "Finalization Phase",
  QUALITY_CONTROL: "Quality Control",
  REPORTING: "Reporting",
  ADMINISTRATION: "Administration",
};

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const availableRoles = useMemo(() => {
    if (currentUser?.role === "FIRM_ADMIN") {
      return ROLES.filter(r => r.value !== "ADMIN" && r.value !== "FIRM_ADMIN");
    }
    return ROLES;
  }, [currentUser?.role]);

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
  });

  const { data: users, refetch } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: currentUserPermissions } = useQuery<{ permissions: string[] }>({
    queryKey: ["/api/rbac/permissions/my"],
  });

  const { data: userPermissions, isLoading: permissionsLoading } = useQuery<UserPermissions>({
    queryKey: ["/api/rbac/permissions/user", selectedUser?.id],
    enabled: !!selectedUser?.id && permissionsDialogOpen,
  });

  const isAdmin = currentUserPermissions?.permissions?.includes("SYSTEM_FULL_ACCESS") || 
                  currentUserPermissions?.permissions?.includes("ROLE_MANAGE");

  const handleOpenPermissions = (user: User) => {
    setSelectedUser(user);
    setPermissionsDialogOpen(true);
  };

  const handleOverridePermission = async (permissionCode: string, grant: boolean) => {
    if (!selectedUser) return;
    
    try {
      const response = await fetchWithAuth(`/api/rbac/permissions/user/${selectedUser.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissionCode,
          isGranted: grant,
          reason: overrideReason || `Admin override - ${grant ? 'granted' : 'revoked'}`,
        }),
      });

      if (response.ok) {
        toast({ title: "Success", description: `Permission ${grant ? 'granted' : 'revoked'} successfully` });
        queryClient.invalidateQueries({ queryKey: ["/api/rbac/permissions/user", selectedUser.id] });
        setOverrideReason("");
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to update permission", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update permission", variant: "destructive" });
    }
  };

  const handleRemoveOverride = async (permissionCode: string) => {
    if (!selectedUser) return;
    
    try {
      const response = await fetchWithAuth(`/api/rbac/permissions/user/${selectedUser.id}/override/${permissionCode}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({ title: "Success", description: "Override removed - permission reverted to role default" });
        queryClient.invalidateQueries({ queryKey: ["/api/rbac/permissions/user", selectedUser.id] });
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to remove override", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove override", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.username || !formData.email || !formData.password || !formData.role) {
      toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Validation Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (formData.password.length < 6) {
      toast({ title: "Validation Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      if (response.ok) {
        toast({ title: "Success", description: "User created successfully" });
        setDialogOpen(false);
        setFormData({
          fullName: "",
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
          role: "",
        });
        refetch();
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to create user", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users?.filter(
    (user) =>
      (user.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return "bg-red-100 text-red-700 border-0";
      case "PARTNER":
        return "bg-purple-100 text-purple-700 border-0";
      case "MANAGING_PARTNER":
        return "bg-indigo-100 text-indigo-700 border-0";
      case "MANAGER":
        return "bg-blue-100 text-blue-700 border-0";
      case "TEAM_LEAD":
        return "bg-teal-100 text-teal-700 border-0";
      case "SENIOR":
        return "bg-green-100 text-green-700 border-0";
      case "EQCR":
        return "bg-orange-100 text-orange-700 border-0";
      default:
        return "bg-gray-100 text-gray-700 border-0";
    }
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find(r => r.value === role)?.label || role;
  };

  const groupPermissionsByCategory = (permissions: Permission[]) => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach(perm => {
      if (!grouped[perm.category]) grouped[perm.category] = [];
      grouped[perm.category].push(perm);
    });
    return grouped;
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Users & Roles</h1>
            <p className="text-muted-foreground">Manage system users and role assignments</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with default role permissions
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex flex-col">
                          <span>{role.label}</span>
                          <span className="text-xs text-muted-foreground">{role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 ${user.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Manage Permissions"
                        onClick={() => handleOpenPermissions(user)}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions - {userPermissions?.user?.fullName}
            </DialogTitle>
            <DialogDescription>
              Role: <Badge className={getRoleBadgeColor(userPermissions?.user?.role || "")}>{getRoleLabel(userPermissions?.user?.role || "")}</Badge>
              {isAdmin && (
                <span className="ml-2 text-blue-600">Admin can customize permissions below</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {permissionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : userPermissions ? (
            <ScrollArea className="h-[55vh] pr-4">
              <div className="space-y-4">
                {Object.entries(groupPermissionsByCategory(userPermissions.permissions)).map(([category, perms]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">{CATEGORY_LABELS[category] || category}</h3>
                    <div className="grid gap-2">
                      {perms.map((perm) => (
                        <div 
                          key={perm.code} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            perm.hasOverride 
                              ? perm.overrideGranted 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-red-50 border-red-200'
                              : perm.isEffective 
                                ? 'bg-gray-50' 
                                : 'bg-gray-100'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {perm.isEffective ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-gray-400" />
                              )}
                              <span className="font-medium">{perm.name}</span>
                              {perm.hasOverride && (
                                <Badge variant="outline" className="text-xs">
                                  {perm.overrideGranted ? 'Granted Override' : 'Revoked Override'}
                                </Badge>
                              )}
                              {perm.isFromRole && !perm.hasOverride && (
                                <Badge variant="secondary" className="text-xs">From Role</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground ml-6">{perm.description}</p>
                            {perm.hasOverride && perm.overrideReason && (
                              <p className="text-xs text-muted-foreground ml-6 mt-1">
                                Reason: {perm.overrideReason} {perm.overrideGrantedBy && `(by ${perm.overrideGrantedBy})`}
                              </p>
                            )}
                          </div>
                          
                          {isAdmin && (
                            <div className="flex items-center gap-2 ml-4">
                              {perm.hasOverride ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveOverride(perm.code)}
                                >
                                  Reset to Default
                                </Button>
                              ) : (
                                <>
                                  {!perm.isEffective && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-green-600 hover:bg-green-50"
                                      onClick={() => handleOverridePermission(perm.code, true)}
                                    >
                                      Grant
                                    </Button>
                                  )}
                                  {perm.isEffective && perm.isFromRole && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 hover:bg-red-50"
                                      onClick={() => handleOverridePermission(perm.code, false)}
                                    >
                                      Revoke
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Unable to load permissions
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
