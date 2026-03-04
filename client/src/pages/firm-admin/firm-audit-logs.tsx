import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, User, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  USER_CREATED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  USER_UPDATED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  USER_SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  USER_REACTIVATED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  SETTINGS_UPDATED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  PASSWORD_RESET: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  AI_CONFIG_UPDATED: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
};

export default function FirmAuditLogs() {
  const [actionFilter, setActionFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (selectedUser) params.set("userId", selectedUser);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    return `/api/tenant/audit-logs?${params.toString()}`;
  }, [actionFilter, selectedUser, startDate, endDate, page]);

  const { data, isLoading } = useQuery<any>({
    queryKey: [queryUrl],
  });

  const { data: firmUsers } = useQuery<any[]>({
    queryKey: ["/api/tenant/audit-logs/users"],
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const hasFilters = actionFilter || selectedUser || startDate || endDate;

  const clearFilters = () => {
    setActionFilter("");
    setSelectedUser("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" data-testid="firm-audit-logs-page">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Firm Audit Logs</h1>
        {total > 0 && (
          <Badge variant="secondary" className="ml-2">{total.toLocaleString()} total</Badge>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs" data-testid="button-clear-filters">
              <X className="h-3 w-3 mr-1" /> Clear all
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">User</label>
            <Select value={selectedUser || "__all__"} onValueChange={(v) => { setSelectedUser(v === "__all__" ? "" : v); setPage(1); }}>
              <SelectTrigger data-testid="select-user-filter">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span>All Users</span>
                  </div>
                </SelectItem>
                {(firmUsers || []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex items-center gap-2">
                      <span>{u.fullName}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{u.role}</Badge>
                    </div>
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

      {selectedUser && firmUsers && (
        <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Showing activity for: {firmUsers.find(u => u.id === selectedUser)?.fullName || "Unknown"}
          </span>
          <Badge variant="outline" className="text-xs">
            {firmUsers.find(u => u.id === selectedUser)?.role}
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">No audit logs found matching your filters</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Action</TableHead>
                <TableHead>User</TableHead>
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
      )}

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
