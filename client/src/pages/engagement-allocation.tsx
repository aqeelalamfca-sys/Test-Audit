import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserCheck,
  Search,
  Edit,
  Users,
  AlertCircle,
  Loader2,
  Save,
  History,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Engagement {
  id: string;
  engagementCode: string;
  status: string;
  eqcrRequired?: boolean;
  client?: {
    name: string;
  };
  fiscalYearEnd?: string;
  team?: Array<{
    id?: string;
    role: string;
    userId?: string;
    user?: {
      id: string;
      fullName: string;
    };
  }>;
}

interface User {
  id: string;
  fullName: string;
  role: string;
}

interface TeamHistoryEntry {
  id: string;
  action: string;
  beforeValue: any;
  afterValue: any;
  justification: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    role: string;
  };
}

const ROLE_SLOTS = ["Partner", "Manager", "Senior", "Staff", "EQCR"] as const;

const statusStyles: Record<string, { label: string; className: string }> = {
  PLANNING: { label: "Planning", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  FIELDWORK: { label: "Fieldwork", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  REVIEW: { label: "Review", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300" },
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300" },
};

function getUsersByRole(users: User[], role: string): User[] {
  switch (role) {
    case "Partner": return users.filter(u => u.role === "PARTNER");
    case "Manager": return users.filter(u => u.role === "MANAGER");
    case "Senior": return users.filter(u => u.role === "SENIOR");
    case "Staff": return users.filter(u => u.role === "STAFF" || u.role === "SENIOR");
    case "EQCR": return users.filter(u => u.role === "EQCR");
    default: return users;
  }
}

function getTeamUserId(team: Engagement["team"], role: string): string {
  const member = team?.find(t => t.role === role);
  return member?.user?.id || member?.userId || "";
}

function getTeamUserName(team: Engagement["team"], role: string): string | undefined {
  const member = team?.find(t => t.role === role);
  return member?.user?.fullName;
}

function parseTeamFromTrailValue(value: any): Record<string, string> {
  if (!value) return {};
  const result: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const item of value) {
      const role = item.role || "Unknown";
      const name = item.user?.fullName || item.fullName || item.userId || "Unknown";
      result[role] = name;
    }
  }
  return result;
}

function InlineAllocationRow({
  eng,
  users,
  isAdmin,
}: {
  eng: Engagement;
  users: User[];
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [alloc, setAlloc] = useState({
    Partner: getTeamUserId(eng.team, "Partner"),
    Manager: getTeamUserId(eng.team, "Manager"),
    Senior: getTeamUserId(eng.team, "Senior"),
    Staff: getTeamUserId(eng.team, "Staff"),
    EQCR: getTeamUserId(eng.team, "EQCR"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const team: any[] = [];
      if (alloc.Partner) team.push({ userId: alloc.Partner, role: "Partner", isLead: true });
      if (alloc.Manager) team.push({ userId: alloc.Manager, role: "Manager", isLead: false });
      if (alloc.Senior) team.push({ userId: alloc.Senior, role: "Senior", isLead: false });
      if (alloc.Staff) team.push({ userId: alloc.Staff, role: "Staff", isLead: false });
      if (alloc.EQCR) team.push({ userId: alloc.EQCR, role: "EQCR", isLead: false });

      const response = await fetchWithAuth(`/api/engagements/${eng.id}/team`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, eqcrRequired: !!alloc.EQCR }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Team allocation saved" });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const historyQuery = useQuery<TeamHistoryEntry[]>({
    queryKey: [`/api/engagements/${eng.id}/team-history`],
    enabled: historyOpen,
  });

  const statusInfo = statusStyles[eng.status] || statusStyles.DRAFT;

  const startEdit = () => {
    setAlloc({
      Partner: getTeamUserId(eng.team, "Partner"),
      Manager: getTeamUserId(eng.team, "Manager"),
      Senior: getTeamUserId(eng.team, "Senior"),
      Staff: getTeamUserId(eng.team, "Staff"),
      EQCR: getTeamUserId(eng.team, "EQCR"),
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  return (
    <>
      <TableRow className={cn(historyOpen && "border-b-0")}>
        <TableCell>
          <div>
            <span className="font-mono text-sm">{eng.engagementCode}</span>
            <Badge variant="secondary" className={cn("text-[10px] ml-2 px-1.5 py-0", statusInfo.className)}>
              {statusInfo.label}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="font-medium text-sm">{eng.client?.name || "-"}</TableCell>

        {ROLE_SLOTS.map((role) => {
          const currentName = getTeamUserName(eng.team, role);
          const roleUsers = getUsersByRole(users, role);

          if (editing) {
            return (
              <TableCell key={role} className="p-1">
                <Select
                  value={alloc[role]}
                  onValueChange={(v) => setAlloc({ ...alloc, [role]: v === "__clear" ? "" : v })}
                >
                  <SelectTrigger className="h-8 text-xs w-full min-w-[100px]">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear">
                      <span className="text-muted-foreground">-- None --</span>
                    </SelectItem>
                    {roleUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            );
          }

          return (
            <TableCell key={role}>
              {currentName ? (
                <span className="text-sm">{currentName}</span>
              ) : (
                <span className="text-xs text-orange-500">Not Assigned</span>
              )}
            </TableCell>
          );
        })}

        <TableCell>
          <div className="flex items-center gap-1 justify-end">
            {editing ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={cancelEdit}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={startEdit}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setHistoryOpen(!historyOpen)}
                >
                  <History className="h-3.5 w-3.5" />
                  {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {historyOpen && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-0">
            <div className="px-4 py-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Allocation Change History — {eng.engagementCode}
              </h4>
              {historyQuery.isLoading ? (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading history...
                </div>
              ) : !historyQuery.data || historyQuery.data.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No allocation changes recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {historyQuery.data.map((entry) => {
                    const before = parseTeamFromTrailValue(entry.beforeValue);
                    const after = parseTeamFromTrailValue(entry.afterValue);
                    const allRoles = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
                    const changes = allRoles.filter(r => before[r] !== after[r]);

                    return (
                      <div key={entry.id} className="border rounded-md p-2.5 bg-background text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium">
                            {entry.user.fullName}
                            <span className="text-muted-foreground ml-1 font-normal">changed allocation</span>
                          </span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {changes.length > 0 ? (
                          <div className="space-y-1">
                            {changes.map((role) => (
                              <div key={role} className="flex items-center gap-1.5 text-[11px]">
                                <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">{role}</Badge>
                                <span className="text-red-500 line-through">{before[role] || "None"}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-green-600 font-medium">{after[role] || "Removed"}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">Team re-saved (no changes)</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function EngagementAllocation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const { user } = useAuth();
  const isAdmin = ["FIRM_ADMIN", "PARTNER"].includes((user?.role || "").toUpperCase());

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: engagements, isLoading } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
  });

  const filteredEngagements = useMemo(() => {
    let list = engagements || [];

    if (statusFilter === "active") {
      list = list.filter(e => e.status !== "COMPLETED" && e.status !== "ARCHIVED");
    } else if (statusFilter === "completed") {
      list = list.filter(e => e.status === "COMPLETED" || e.status === "ARCHIVED");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        (e.client?.name || "").toLowerCase().includes(q) ||
        (e.engagementCode || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [engagements, statusFilter, searchQuery]);

  const activeCount = (engagements || []).filter(e => e.status !== "COMPLETED" && e.status !== "ARCHIVED").length;
  const completedCount = (engagements || []).filter(e => e.status === "COMPLETED" || e.status === "ARCHIVED").length;

  const pendingAllocations = filteredEngagements.filter(eng => {
    const partner = getTeamUserName(eng.team, "Partner");
    const manager = getTeamUserName(eng.team, "Manager");
    return !partner || !manager;
  }).length;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Engagement Allocation</h1>
            <p className="text-muted-foreground">Assign teams to engagements</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Engagements</p>
                <p className="text-2xl font-bold">{(engagements || []).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Pending Allocation</p>
                <p className="text-2xl font-bold">{pendingAllocations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All ({(engagements || []).length})</TabsTrigger>
            <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search engagements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Team Allocation</CardTitle>
          <CardDescription>Assign Partner, Manager, Senior, Staff and EQCR to each engagement. Click Edit to change, then Save.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Engagement</TableHead>
                  <TableHead className="min-w-[120px]">Client</TableHead>
                  <TableHead className="min-w-[110px]">Partner</TableHead>
                  <TableHead className="min-w-[110px]">Manager</TableHead>
                  <TableHead className="min-w-[110px]">Senior</TableHead>
                  <TableHead className="min-w-[110px]">Staff</TableHead>
                  <TableHead className="min-w-[110px]">EQCR</TableHead>
                  <TableHead className="text-right min-w-[130px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredEngagements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No engagements found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEngagements.map((eng) => (
                    <InlineAllocationRow
                      key={eng.id}
                      eng={eng}
                      users={users || []}
                      isAdmin={isAdmin}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
