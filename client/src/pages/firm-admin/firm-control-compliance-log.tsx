import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { AgentsLoadingInline } from "@/components/agents-loading";
import {
  Shield,
  Search,
  Users,
  Activity,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  BarChart3,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: FileText },
  REVIEWED: { label: "Reviewed", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: Eye },
  APPROVED: { label: "Approved", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: CheckCircle2 },
  PENDING: { label: "Pending", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: Clock },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
};

const DOMAIN_COLORS: Record<string, string> = {
  "Governance & Leadership": "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  "Ethical Requirements": "bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800",
  "Acceptance & Continuance": "bg-teal-50 border-teal-200 dark:bg-teal-950 dark:border-teal-800",
  "Engagement Performance": "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800",
  "Resources": "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
  "Information & Communication": "bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800",
  "Monitoring & Remediation": "bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800",
  "ISQM 2 / Engagement Quality Review": "bg-pink-50 border-pink-200 dark:bg-pink-950 dark:border-pink-800",
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} text-xs gap-1`} data-testid={`badge-status-${status.toLowerCase()}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function formatAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SummaryTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/firm-control-compliance-log/summary"],
  });

  if (isLoading) return <AgentsLoadingInline showDelay={1000} />;
  if (!data) return <div className="text-center py-10 text-muted-foreground">No data available</div>;

  return (
    <div className="space-y-4" data-testid="summary-tab">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3" data-testid="card-total-logs">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Activities</span>
          </div>
          <p className="text-2xl font-bold">{data.totalLogs}</p>
        </Card>
        <Card className="p-3" data-testid="card-last-30-days">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Last 30 Days</span>
          </div>
          <p className="text-2xl font-bold">{data.last30Days}</p>
        </Card>
        <Card className="p-3" data-testid="card-pending">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{data.pendingCount}</p>
        </Card>
        <Card className="p-3" data-testid="card-approved">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Approved</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{data.approvedCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-domain-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Activity by Control Domain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byDomain?.map((d: any) => (
              <div key={d.domain} className="flex items-center justify-between" data-testid={`domain-${d.domain?.replace(/\s/g, '-').toLowerCase()}`}>
                <span className="text-sm truncate mr-2">{d.domain}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min((d.count / Math.max(data.totalLogs, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">{d.count}</span>
                </div>
              </div>
            ))}
            {(!data.byDomain || data.byDomain.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No domain activity recorded yet</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-recent-activity">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentActivity?.map((a: any) => (
              <div key={a.id} className="flex items-start gap-2 py-1 border-b last:border-0" data-testid={`recent-${a.id}`}>
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.description || formatAction(a.action)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.actor?.fullName} ({a.actor?.role}) — {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {(!data.recentActivity || data.recentActivity.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/firm-control-compliance-log/users"],
  });

  if (isLoading) return <AgentsLoadingInline showDelay={1000} />;

  const users = data?.users || [];

  return (
    <div className="space-y-3" data-testid="users-tab">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role / Designation</TableHead>
                <TableHead className="text-center">Activities</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell className="font-medium text-sm">{u.fullName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">{u.role}</Badge>
                      {u.designation && <span className="text-xs text-muted-foreground">({u.designation})</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm font-semibold">{u.activityCount}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.lastActivity ? new Date(u.lastActivity).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LogsTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "30");
    if (search) params.set("search", search);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (domainFilter !== "all") params.set("controlDomain", domainFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    return params.toString();
  }, [page, search, roleFilter, domainFilter, statusFilter]);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/firm-control-compliance-log?${queryParams}`],
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const meta = data?.meta || {};

  return (
    <div className="space-y-3" data-testid="logs-tab">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search-logs"
              placeholder="Search activities..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9" data-testid="select-role-filter">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="PARTNER">Engagement Partner</SelectItem>
            <SelectItem value="EQCR">Engagement Quality Reviewer</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="SENIOR">Senior</SelectItem>
            <SelectItem value="STAFF">Audit Team</SelectItem>
            <SelectItem value="FIRM_ADMIN">Firm Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={domainFilter} onValueChange={(v) => { setDomainFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] h-9" data-testid="select-domain-filter">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            {(meta.controlDomains || []).map((d: string) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9" data-testid="select-status-filter">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(meta.validStatuses || ["SUBMITTED", "REVIEWED", "APPROVED", "PENDING", "REJECTED"]).map((s: string) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <AgentsLoadingInline showDelay={1000} />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Control Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id} data-testid={`row-log-${log.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.actor?.fullName || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.actorRole || log.actor?.role || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.description || formatAction(log.action)}
                      </TableCell>
                      <TableCell>
                        {log.controlDomain ? (
                          <Badge variant="secondary" className="text-xs">{log.controlDomain}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={log.status} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" data-testid={`button-view-${log.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No compliance log entries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground" data-testid="text-log-count">
              Showing {logs.length} of {total} entries
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-log-detail">
          <DialogHeader>
            <DialogTitle className="text-base">Activity Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">User</p>
                  <p className="font-medium">{selectedLog.actor?.fullName || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant="outline">{selectedLog.actorRole || selectedLog.actor?.role}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Action</p>
                  <p className="font-medium">{formatAction(selectedLog.action)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={selectedLog.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Control Domain</p>
                  <p>{selectedLog.controlDomain || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entity Type</p>
                  <p>{selectedLog.entityType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timestamp</p>
                  <p className="font-mono text-xs">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IP Address</p>
                  <p className="font-mono text-xs">{selectedLog.ipAddress || "—"}</p>
                </div>
              </div>
              {selectedLog.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm bg-muted/50 p-2 rounded">{selectedLog.description}</p>
                </div>
              )}
              {(selectedLog.beforeJson || selectedLog.afterJson) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Audit Trail (Before / After)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded text-xs overflow-auto max-h-32">
                      <p className="font-semibold text-red-600 dark:text-red-400 mb-1">Before</p>
                      <pre className="whitespace-pre-wrap">{selectedLog.beforeJson ? JSON.stringify(selectedLog.beforeJson, null, 2) : "—"}</pre>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded text-xs overflow-auto max-h-32">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">After</p>
                      <pre className="whitespace-pre-wrap">{selectedLog.afterJson ? JSON.stringify(selectedLog.afterJson, null, 2) : "—"}</pre>
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t">
                <p className="text-[11px] text-muted-foreground">
                  Log ID: <span className="font-mono">{selectedLog.id}</span> | Firm ID: <span className="font-mono">{selectedLog.firmId?.substring(0, 8)}</span> | User ID: <span className="font-mono">{selectedLog.actorUserId?.substring(0, 8)}</span>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TABS = [
  { id: "summary", label: "Summary", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: "logs", label: "Compliance Log", icon: <Activity className="w-3.5 h-3.5" /> },
  { id: "users", label: "User Activity", icon: <Users className="w-3.5 h-3.5" /> },
];

export default function FirmControlComplianceLog() {
  const [activeTab, setActiveTab] = useState("summary");

  return (
    <div className="page-container" data-testid="firm-control-compliance-log-page">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Firm-Wide Control Compliance Log</h1>
          <p className="text-xs text-muted-foreground">ISQM-1 compliance activity tracking — immutable audit trail for all firm-wide control actions</p>
        </div>
      </div>

      <SimpleTabNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabs={TABS}
        ariaLabel="Compliance Log Sections"
        data-testid="tabs-compliance-log"
      />

      {activeTab === "summary" && <SummaryTab />}
      {activeTab === "logs" && <LogsTab />}
      {activeTab === "users" && <UsersTab />}
    </div>
  );
}
