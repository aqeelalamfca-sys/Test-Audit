import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Search, User, Filter, X, ChevronLeft, ChevronRight, Clock, Globe, Shield, Settings, Eye, Pencil, Trash2, Plus, Key, LogIn, LogOut, RefreshCw, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ACTION_CATEGORIES: Record<string, { label: string; color: string; icon: any }> = {
  CREATE: { label: "Created", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200", icon: Plus },
  UPDATE: { label: "Updated", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200", icon: Pencil },
  DELETE: { label: "Deleted", color: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200", icon: Trash2 },
  VIEW: { label: "Viewed", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200", icon: Eye },
  LOGIN: { label: "Login", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200", icon: LogIn },
  LOGOUT: { label: "Logout", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: LogOut },
  SETTINGS: { label: "Settings", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200", icon: Settings },
  PASSWORD: { label: "Password", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200", icon: Key },
  SECURITY: { label: "Security", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200", icon: Shield },
  OTHER: { label: "Action", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: RefreshCw },
};

function categorizeAction(action: string): string {
  const upper = action.toUpperCase();
  if (upper.includes("LOGIN") || upper.includes("SIGN_IN")) return "LOGIN";
  if (upper.includes("LOGOUT") || upper.includes("SIGN_OUT")) return "LOGOUT";
  if (upper.includes("CREATE") || upper.startsWith("POST_")) return "CREATE";
  if (upper.includes("UPDATE") || upper.includes("PATCH") || upper.startsWith("PATCH_") || upper.includes("_DRAFT") || upper.includes("_PROGRESS")) return "UPDATE";
  if (upper.includes("DELETE") || upper.includes("REMOVE")) return "DELETE";
  if (upper.includes("VIEW") || upper.startsWith("GET_")) return "VIEW";
  if (upper.includes("SETTINGS") || upper.includes("CONFIG") || upper.includes("AIKEY")) return "SETTINGS";
  if (upper.includes("PASSWORD") || upper.includes("RESET")) return "PASSWORD";
  if (upper.includes("SECURITY") || upper.includes("SUSPEND") || upper.includes("LOCK")) return "SECURITY";
  return "OTHER";
}

function humanizeAction(action: string): string {
  let cleaned = action
    .replace(/^(POST|GET|PATCH|PUT|DELETE)__?/i, "")
    .replace(/[A-Fa-f0-9]{20,}/g, "")
    .replace(/__+/g, "_")
    .replace(/^_|_$/g, "");

  if (!cleaned) cleaned = action;

  const readable = cleaned
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bApi\b/g, "API")
    .replace(/\bIsa\b/g, "ISA")
    .replace(/\bSecp\b/g, "SECP")
    .replace(/\bFbr\b/g, "FBR")
    .replace(/\bIp\b/g, "IP")
    .replace(/\bUrl\b/g, "URL")
    .replace(/\bId\b/g, "ID")
    .replace(/\bDb\b/g, "DB")
    .trim();

  return readable || action;
}

function getEntityLabel(entity: string): string {
  if (!entity) return "—";
  return entity
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, "AI");
}

function formatTimestamp(ts: string): { date: string; time: string; relative: string } {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  let relative = "";
  if (diffMin < 1) relative = "Just now";
  else if (diffMin < 60) relative = `${diffMin}m ago`;
  else if (diffHr < 24) relative = `${diffHr}h ago`;
  else if (diffDay < 7) relative = `${diffDay}d ago`;
  else relative = d.toLocaleDateString();

  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    relative,
  };
}

async function exportAuditLogsPDF(logs: any[], filters: { user?: string; action?: string; startDate?: string; endDate?: string }) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("AuditWise - Audit Log Report", 14, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const now = new Date();
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 14, 24);

  let filterLine = "Filters: ";
  const filterParts: string[] = [];
  if (filters.user) filterParts.push(`User: ${filters.user}`);
  if (filters.action) filterParts.push(`Action: ${filters.action}`);
  if (filters.startDate) filterParts.push(`From: ${filters.startDate}`);
  if (filters.endDate) filterParts.push(`To: ${filters.endDate}`);
  if (filterParts.length === 0) filterParts.push("None");
  filterLine += filterParts.join(" | ");
  doc.text(filterLine, 14, 29);

  doc.text(`Total entries: ${logs.length}`, 14, 34);
  doc.setTextColor(0);

  const tableData = logs.map((log: any) => {
    const ts = new Date(log.createdAt);
    return [
      `${ts.toLocaleDateString()} ${ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      log.userName || "System",
      log.userRole || "-",
      humanizeAction(log.action),
      getEntityLabel(log.entity || log.entityType || ""),
      log.ip || log.ipAddress || "-",
    ];
  });

  autoTable(doc, {
    startY: 38,
    head: [["Timestamp", "User", "Role", "Action", "Entity", "IP Address"]],
    body: tableData,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 60 },
      4: { cellWidth: 45 },
      5: { cellWidth: 30 },
    },
    didDrawPage: (data: any) => {
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageNum}`,
        pageW - 30,
        doc.internal.pageSize.getHeight() - 8
      );
      doc.text("AuditWise - ISA Compliant Audit Platform", 14, doc.internal.pageSize.getHeight() - 8);
    },
  });

  doc.save(`audit-logs-${now.toISOString().slice(0, 10)}.pdf`);
}

export default function FirmAuditLogs() {
  const { toast } = useToast();
  const [actionFilter, setActionFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
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
    <div className="page-container" data-testid="firm-audit-logs-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">Activity trail for your firm</p>
          </div>
          {total > 0 && (
            <Badge variant="secondary" className="ml-1">{total.toLocaleString()} entries</Badge>
          )}
        </div>
        {logs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            data-testid="button-export-pdf"
            onClick={async () => {
              setExporting(true);
              try {
                const exportParams = new URLSearchParams();
                if (actionFilter) exportParams.set("action", actionFilter);
                if (selectedUser) exportParams.set("userId", selectedUser);
                if (startDate) exportParams.set("startDate", startDate);
                if (endDate) exportParams.set("endDate", endDate);
                exportParams.set("page", "1");
                exportParams.set("limit", "5000");
                const exportRes = await apiRequest("GET", `/api/tenant/audit-logs?${exportParams.toString()}`);
                const exportData = await exportRes.json();
                const allLogs = exportData?.logs || logs;

                const userName = firmUsers?.find((u: any) => u.id === selectedUser)?.fullName;
                await exportAuditLogsPDF(allLogs, {
                  user: userName,
                  action: actionFilter || undefined,
                  startDate: startDate || undefined,
                  endDate: endDate || undefined,
                });
                toast({ title: "PDF Exported", description: `${allLogs.length} audit log entries exported successfully.` });
              } catch (err: any) {
                toast({ title: "Export Failed", description: err.message, variant: "destructive" });
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export PDF
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs" data-testid="button-clear-filters">
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={selectedUser || "__all__"} onValueChange={(v) => { setSelectedUser(v === "__all__" ? "" : v); setPage(1); }}>
              <SelectTrigger data-testid="select-user-filter" className="h-9">
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
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-action-filter"
                placeholder="Search actions..."
                className="pl-8 h-9"
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              />
            </div>
            <Input
              data-testid="input-start-date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="h-9"
              placeholder="From"
            />
            <Input
              data-testid="input-end-date"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="h-9"
              placeholder="To"
            />
          </div>
        </CardContent>
      </Card>

      {selectedUser && firmUsers && (
        <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Showing activity for: {firmUsers.find((u: any) => u.id === selectedUser)?.fullName || "Unknown"}
          </span>
          <Badge variant="outline" className="text-xs">
            {firmUsers.find((u: any) => u.id === selectedUser)?.role}
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">No audit logs found matching your filters</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const category = categorizeAction(log.action);
            const catInfo = ACTION_CATEGORIES[category] || ACTION_CATEGORIES.OTHER;
            const CatIcon = catInfo.icon;
            const humanAction = humanizeAction(log.action);
            const entityLabel = getEntityLabel(log.entity || log.entityType || "");
            const ts = formatTimestamp(log.createdAt);
            const isExpanded = expandedLog === log.id;

            return (
              <Card
                key={log.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                data-testid={`row-log-${log.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${catInfo.color}`}>
                      <CatIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{humanAction}</span>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${catInfo.color}`}>
                          {catInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.userName || "System"}
                        </span>
                        {entityLabel !== "—" && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {entityLabel}
                            {log.entityId && (
                              <span className="font-mono text-[10px] opacity-60">({log.entityId.substring(0, 8)})</span>
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ts.relative}
                        </span>
                        {(log.ip || log.ipAddress) && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {log.ip || log.ipAddress}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {ts.date} {ts.time}
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-2 text-xs">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <span className="text-muted-foreground block">User</span>
                          <span className="font-medium">{log.userName || "System"}</span>
                          {log.userEmail && <span className="block text-muted-foreground">{log.userEmail}</span>}
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Role</span>
                          <Badge variant="outline" className="text-[10px] mt-0.5">{log.userRole || "—"}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">IP Address</span>
                          <span className="font-mono">{log.ip || log.ipAddress || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Timestamp</span>
                          <span>{ts.date} at {ts.time}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Raw Action</span>
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono break-all">{log.action}</code>
                      </div>
                      {(log.beforeValue || log.afterValue) && (
                        <div className="grid grid-cols-2 gap-3">
                          {log.beforeValue && (
                            <div>
                              <span className="text-muted-foreground block">Before</span>
                              <pre className="text-[10px] bg-red-50 dark:bg-red-950/30 p-2 rounded overflow-x-auto max-h-24">{typeof log.beforeValue === 'object' ? JSON.stringify(log.beforeValue, null, 2) : log.beforeValue}</pre>
                            </div>
                          )}
                          {log.afterValue && (
                            <div>
                              <span className="text-muted-foreground block">After</span>
                              <pre className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded overflow-x-auto max-h-24">{typeof log.afterValue === 'object' ? JSON.stringify(log.afterValue, null, 2) : log.afterValue}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {total > limit && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total.toLocaleString()} entries)
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
