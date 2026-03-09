import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Shield, Users, Settings, Building2, FileText, Activity, Database, Loader2, CheckCircle, AlertTriangle, RefreshCw, Zap, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AdminStats {
  stats: {
    totalUsers: number;
    totalClients: number;
    totalEngagements: number;
    activeSessions: number;
  };
  recentAuditLogs: AuditLog[];
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user: {
    fullName: string;
    email: string;
    role: string;
  };
}

interface UserSummary {
  users: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }[];
  roleDistribution: {
    role: string;
    _count: number;
  }[];
}

const roleHierarchy = [
  { role: "PARTNER", label: "Engagement Partner", description: "Final review, approval, sign-off, overall engagement responsibility", permissions: ["Approve engagements", "Lock phases", "View all data", "Final sign-off"] },
  { role: "EQCR", label: "Engagement Quality Reviewer", description: "Independent review access, challenge/comment, no edit rights", permissions: ["EQCR reviews", "Quality oversight", "Challenge conclusions"] },
  { role: "MANAGER", label: "Manager", description: "Planning, supervision, review rights, budget/timeline management", permissions: ["Manage teams", "Review work", "Approve checklists", "Planning approval"] },
  { role: "SENIOR", label: "Senior", description: "Workpaper preparation, initial review, team support", permissions: ["Execute procedures", "Prepare workpapers", "Initial review"] },
  { role: "STAFF", label: "Audit Team", description: "Workpaper completion, task execution", permissions: ["Execute assigned tasks", "Prepare documentation", "Upload evidence"] },
];

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isInitializing, setIsInitializing] = useState(false);

  const { data: adminStats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!token && user?.role === "FIRM_ADMIN",
  });

  const { data: userSummary, isLoading: usersLoading } = useQuery<UserSummary>({
    queryKey: ["/api/admin/users-summary"],
    enabled: !!token && user?.role === "FIRM_ADMIN",
  });

  const { data: auditLogs } = useQuery<{ logs: AuditLog[]; pagination: any }>({
    queryKey: ["/api/admin/audit-logs"],
    enabled: !!token && user?.role === "FIRM_ADMIN",
  });

  const initializeData = useMutation({
    mutationFn: async () => {
      setIsInitializing(true);
      const response = await fetchWithAuth("/api/admin/initialize-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initialize data");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Data Initialized Successfully",
        description: `Created ${data.summary.clientsCreated} clients, ${data.summary.engagementsCreated} engagements, and related audit data.`,
      });
      queryClient.invalidateQueries();
      setIsInitializing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Initialization Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsInitializing(false);
    },
  });

  const stats = adminStats?.stats || { totalUsers: 0, totalClients: 0, totalEngagements: 0, activeSessions: 0 };

  if (user?.role !== "FIRM_ADMIN") {
    return (
      <div className="px-4 py-3">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <h2 className="text-lg font-semibold text-red-700">Access Denied</h2>
                <p className="text-red-600">You do not have permission to access the Admin Dashboard.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">System administration and configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => initializeData.mutate()}
            disabled={isInitializing}
            variant="outline"
          >
            {isInitializing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Initialize Audit Data
              </>
            )}
          </Button>
          <Badge>{user?.role || "Admin"}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{statsLoading ? "..." : stats.totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-2xl font-bold">{statsLoading ? "..." : stats.totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Engagements</p>
                <p className="text-2xl font-bold">{statsLoading ? "..." : stats.totalEngagements}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{statsLoading ? "..." : stats.activeSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage system users and their access</CardDescription>
              </div>
              <Link href="/users">
                <Button>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : userSummary?.users && userSummary.users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userSummary.users.slice(0, 10).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.fullName}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {u.isActive ? (
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.lastLoginAt ? format(new Date(u.lastLoginAt), "MMM d, yyyy HH:mm") : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No users found. Create users from the User Management page to get started.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Roles & Permissions Matrix</CardTitle>
              <CardDescription>Role-based access control configuration (ISA 220, ISQM-1)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roleHierarchy.map((role, index) => (
                  <div key={role.role} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge className={index === 0 ? "bg-purple-100 text-purple-700" : index < 4 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}>
                          Level {index + 1}
                        </Badge>
                        <h3 className="font-semibold">{role.label}</h3>
                      </div>
                      <Badge variant="outline">{role.role}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure system-wide settings and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Settings className="h-5 w-5 text-blue-500" />
                      <h3 className="font-semibold">General Settings</h3>
                    </div>
                    <Link href="/settings">
                      <Button variant="outline" className="w-full">
                        Configure Settings
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Shield className="h-5 w-5 text-green-500" />
                      <h3 className="font-semibold">Firm Controls (ISQM-1)</h3>
                    </div>
                    <Link href="/firm-controls">
                      <Button variant="outline" className="w-full">
                        Manage Controls
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>View system activity logs for compliance tracking</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] })}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {auditLogs?.logs && auditLogs.logs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.logs.slice(0, 20).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.user?.fullName || "System"}</p>
                            <p className="text-xs text-muted-foreground">{log.user?.role}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.entityType}
                          {log.entityId && <span className="text-xs ml-1">({log.entityId.slice(0, 8)}...)</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No audit logs available yet. Activity will be logged as users interact with the system.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
