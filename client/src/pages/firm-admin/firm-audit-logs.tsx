import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Search } from "lucide-react";

export default function FirmAuditLogs() {
  const [actionFilter, setActionFilter] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/tenant/audit-logs", actionFilter],
  });

  const logs = data?.logs || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="firm-audit-logs-page">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Firm Audit Logs</h1>
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
                <Badge variant="secondary">{log.action}</Badge>
                <span className="text-sm font-medium">{log.entity}</span>
                {log.entityId && <span className="text-xs text-muted-foreground font-mono">{log.entityId.substring(0, 8)}</span>}
                <span className="text-xs text-muted-foreground ml-auto">{new Date(log.createdAt).toLocaleString()}</span>
              </CardContent>
            </Card>
          ))}
          {logs.length === 0 && <div className="text-center py-10 text-muted-foreground">No audit logs found</div>}
        </div>
      )}
    </div>
  );
}
