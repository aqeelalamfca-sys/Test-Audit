import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, ArrowDown, ArrowUp } from "lucide-react";

export default function FirmAIUsage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/tenant/ai-usage"],
  });

  const records = data?.records || [];
  const summary = data?.summary || {};

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="firm-ai-usage-page">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Usage Analytics</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-6 w-6 mx-auto mb-2 text-amber-600" />
            <div className="text-2xl font-bold" data-testid="text-total-requests">{data?.total || 0}</div>
            <div className="text-sm text-muted-foreground">Total AI Requests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ArrowUp className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold" data-testid="text-tokens-in">{(summary.totalTokensIn || 0).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Tokens In (Prompts)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ArrowDown className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold" data-testid="text-tokens-out">{(summary.totalTokensOut || 0).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Tokens Out (Completions)</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent AI Usage</CardTitle></CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">No AI usage recorded yet</div>
            ) : (
              <div className="space-y-2">
                {records.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-2 border rounded text-sm" data-testid={`row-ai-usage-${r.id}`}>
                    <Badge variant="outline">{r.provider}</Badge>
                    <span className="font-medium">{r.model}</span>
                    <span className="text-muted-foreground">{r.tokensIn} in / {r.tokensOut} out</span>
                    <span className="text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
