import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Search } from "lucide-react";

export default function PlatformAuditLogs() {
  const [actionFilter, setActionFilter] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/platform/audit-logs", actionFilter],
  });

  const logs = data?.logs || [];

  const actionColor: Record<string, string> = {
    FIRM_CREATED: "bg-green-100 text-green-800",
    FIRM_SUSPENDED: "bg-red-100 text-red-800",
    FIRM_ACTIVATED: "bg-blue-100 text-blue-800",
    FIRM_TERMINATED: "bg-gray-100 text-gray-800",
    USER_CREATED: "bg-purple-100 text-purple-800",
    USER_SUSPENDED: "bg-orange-100 text-orange-800",
    SETTINGS_UPDATED: "bg-cyan-100 text-cyan-800",
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="platform-audit-logs-page">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-red-600" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform Audit Logs</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search-logs"
          placeholder="Filter by action..."
          className="pl-9"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading logs...</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <Card key={log.id} data-testid={`card-log-${log.id}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <Badge className={actionColor[log.action] || "bg-gray-100 text-gray-800"} variant="secondary">
                  {log.action}
                </Badge>
                <span className="text-sm font-medium">{log.entity}</span>
                {log.entityId && <span className="text-xs text-muted-foreground font-mono">{log.entityId.substring(0, 8)}</span>}
                <span className="text-xs text-muted-foreground ml-auto">{log.ip}</span>
                <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
              </CardContent>
            </Card>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No audit logs found</div>
          )}
          {data?.total > 0 && (
            <div className="text-center text-sm text-muted-foreground py-2">
              Showing {logs.length} of {data.total} logs
            </div>
          )}
        </div>
      )}
    </div>
  );
}
