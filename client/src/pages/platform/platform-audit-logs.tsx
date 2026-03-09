import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, Globe, Building2, User, Calendar, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  FIRM_CREATED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  FIRM_SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  FIRM_ACTIVATED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  FIRM_TERMINATED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  USER_CREATED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  USER_UPDATED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  USER_SUSPENDED: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  USER_REACTIVATED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  SETTINGS_UPDATED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  AI_CONFIG_UPDATED: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  SUPER_ADMIN_BOOTSTRAP: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function LogsTable({ logs, showFirm }: { logs: any[]; showFirm: boolean }) {
  if (logs.length === 0) {
    return <div className="text-center py-10 text-muted-foreground">No audit logs found matching your filters</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Action</TableHead>
            <TableHead>User</TableHead>
            {showFirm && <TableHead>Firm</TableHead>}
            <TableHead>Entity</TableHead>
            <TableHead className="w-[130px]">IP Address</TableHead>
            <TableHead className="w-[170px]">Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log: any) => (
            <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
              <TableCell>
                <Badge className={ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"} variant="secondary">
                  {log.action}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{log.userName || "System"}</span>
                  {log.userEmail && <span className="text-xs text-muted-foreground">{log.userEmail}</span>}
                  {log.userRole && (
                    <Badge variant="outline" className="text-[10px] w-fit mt-0.5 px-1 py-0">{log.userRole}</Badge>
                  )}
                </div>
              </TableCell>
              {showFirm && (
                <TableCell>
                  <span className="text-sm">{log.firmName || "—"}</span>
                </TableCell>
              )}
              <TableCell>
                <span className="text-sm">{log.entity}</span>
                {log.entityId && (
                  <span className="text-xs text-muted-foreground font-mono ml-1">({log.entityId.substring(0, 8)})</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-xs font-mono text-muted-foreground">{log.ip || "—"}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PlatformAuditLogs() {
  const [activeTab, setActiveTab] = useState("global");
  const [actionFilter, setActionFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedFirm, setSelectedFirm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (selectedUser) params.set("userId", selectedUser);
    if (activeTab === "firm" && selectedFirm && selectedFirm !== "__all__") {
      if (selectedFirm === "__platform__") {
        params.set("firmId", "null");
      } else {
        params.set("firmId", selectedFirm);
      }
    }
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    return `/api/platform/audit-logs?${params.toString()}`;
  }, [actionFilter, selectedUser, selectedFirm, activeTab, startDate, endDate, page]);

  const { data, isLoading } = useQuery<any>({
    queryKey: [queryUrl],
    refetchInterval: 30000,
  });

  const { data: firmsSummary } = useQuery<any[]>({
    queryKey: ["/api/platform/audit-logs/firms-summary"],
    refetchInterval: 30000,
  });

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/platform/audit-logs/users"],
    refetchInterval: 60000,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const hasFilters = actionFilter || selectedUser || selectedFirm || startDate || endDate;

  const clearFilters = () => {
    setActionFilter("");
    setSelectedUser("");
    setSelectedFirm("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    if (activeTab === "firm" && selectedFirm && selectedFirm !== "__platform__") {
      return allUsers.filter(u => u.firmId === selectedFirm);
    }
    return allUsers;
  }, [allUsers, activeTab, selectedFirm]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" data-testid="platform-audit-logs-page">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform Audit Logs</h1>
        {total > 0 && (
          <Badge variant="secondary" className="ml-2">{total.toLocaleString()} total</Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); setSelectedFirm(""); }}>
        <TabsList>
          <TabsTrigger value="global" data-testid="tab-global-logs" className="gap-1.5">
            <Globe className="h-4 w-4" /> Global Logs
          </TabsTrigger>
          <TabsTrigger value="firm" data-testid="tab-firm-logs" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Firm-wise Logs
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs" data-testid="button-clear-filters">
                <X className="h-3 w-3 mr-1" /> Clear all
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {activeTab === "firm" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Firm</label>
                <Select value={selectedFirm} onValueChange={(v) => { setSelectedFirm(v); setSelectedUser(""); setPage(1); }}>
                  <SelectTrigger data-testid="select-firm-filter">
                    <SelectValue placeholder="All firms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Firms</SelectItem>
                    {(firmsSummary || []).map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} ({f.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">User</label>
              <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v === "__all__" ? "" : v); setPage(1); }}>
                <SelectTrigger data-testid="select-user-filter">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Users</SelectItem>
                  {filteredUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Action</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-action-filter"
                  placeholder="Filter by action..."
                  className="pl-8"
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                <Input
                  data-testid="input-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
                <Input
                  data-testid="input-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>
        </div>

        <TabsContent value="global" className="mt-4">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading logs...</div>
          ) : (
            <LogsTable logs={logs} showFirm={true} />
          )}
        </TabsContent>

        <TabsContent value="firm" className="mt-4">
          {!selectedFirm || selectedFirm === "__all__" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select a firm to view its logs, or browse all firms below:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(firmsSummary || []).map((firm: any) => (
                  <Card
                    key={firm.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedFirm(firm.id)}
                    data-testid={`card-firm-${firm.id}`}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{firm.name}</span>
                      </div>
                      <Badge variant="secondary">{firm.count} logs</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {(!firmsSummary || firmsSummary.length === 0) && (
                <div className="text-center py-10 text-muted-foreground">No firm activity recorded yet</div>
              )}
            </div>
          ) : (
            <>
              {isLoading ? (
                <div className="text-center py-10 text-muted-foreground">Loading logs...</div>
              ) : (
                <LogsTable logs={logs} showFirm={false} />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {total > limit && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total.toLocaleString()} logs)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
