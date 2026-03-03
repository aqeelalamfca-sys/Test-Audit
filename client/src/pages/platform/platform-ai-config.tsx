import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PlatformAIConfig() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    defaultApiKey: "",
    provider: "openai",
    modelName: "gpt-4o",
    tokenLimit: 100000,
  });

  const { data: config, isLoading } = useQuery<any>({ queryKey: ["/api/platform/ai-config"] });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/platform/ai-config", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "AI Configuration Saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/ai-config"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto" data-testid="platform-ai-config-page">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform AI Configuration</h1>
      </div>

      {config && (
        <Card>
          <CardHeader><CardTitle className="text-base">Current Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="font-medium">Provider:</span> {config.provider}</div>
            <div><span className="font-medium">Model:</span> {config.modelName}</div>
            <div><span className="font-medium">API Key:</span> {config.defaultApiKey}</div>
            <div><span className="font-medium">Token Limit:</span> {config.tokenLimit?.toLocaleString()}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Update Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default API Key *</Label>
            <Input
              data-testid="input-api-key"
              type="password"
              value={form.defaultApiKey}
              onChange={(e) => setForm({ ...form, defaultApiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger data-testid="select-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              <Input data-testid="input-model" value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Token Limit (Monthly)</Label>
            <Input data-testid="input-token-limit" type="number" value={form.tokenLimit} onChange={(e) => setForm({ ...form, tokenLimit: parseInt(e.target.value) || 0 })} />
          </div>
          <Button
            data-testid="button-save-ai-config"
            disabled={saveMutation.isPending || !form.defaultApiKey}
            onClick={() => saveMutation.mutate(form)}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
