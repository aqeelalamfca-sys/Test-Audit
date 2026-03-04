import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROVIDERS = [
  { value: "openai", label: "OpenAI", keyPlaceholder: "sk-...", defaultModel: "gpt-4o", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { value: "azure_openai", label: "Azure OpenAI", keyPlaceholder: "Azure API key...", defaultModel: "gpt-4o", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-35-turbo"] },
  { value: "gemini", label: "Google Gemini", keyPlaceholder: "AIza...", defaultModel: "gemini-1.5-pro", models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"] },
  { value: "deepseek", label: "DeepSeek", keyPlaceholder: "sk-...", defaultModel: "deepseek-chat", models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"] },
];

export default function PlatformAIConfig() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    defaultApiKey: "",
    provider: "openai",
    modelName: "gpt-4o",
    tokenLimit: 100000,
    azureEndpoint: "",
    azureDeployment: "",
  });

  const { data: config, isLoading } = useQuery<any>({ queryKey: ["/api/platform/ai-config"] });

  useEffect(() => {
    if (config) {
      setForm({
        defaultApiKey: "",
        provider: config.provider || "openai",
        modelName: config.modelName || "gpt-4o",
        tokenLimit: config.tokenLimit || 100000,
        azureEndpoint: config.azureEndpoint || "",
        azureDeployment: config.azureDeployment || "",
      });
    }
  }, [config]);

  const selectedProvider = useMemo(() => {
    return PROVIDERS.find(p => p.value === form.provider) || PROVIDERS[0];
  }, [form.provider]);

  const handleProviderChange = (provider: string) => {
    const providerConfig = PROVIDERS.find(p => p.value === provider) || PROVIDERS[0];
    setForm({
      ...form,
      provider,
      modelName: providerConfig.defaultModel,
      azureEndpoint: provider === "azure_openai" ? form.azureEndpoint : "",
      azureDeployment: provider === "azure_openai" ? form.azureDeployment : "",
    });
  };

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

  const providerLabel = PROVIDERS.find(p => p.value === config?.provider)?.label || config?.provider;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto" data-testid="platform-ai-config-page">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform AI Configuration</h1>
      </div>

      {config && (
        <Card>
          <CardHeader><CardTitle className="text-base">Current Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-muted-foreground">Provider</span>
                <div className="mt-1">
                  <Badge variant="secondary" data-testid="badge-current-provider">{providerLabel}</Badge>
                </div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Model</span>
                <div className="mt-1 font-mono" data-testid="text-current-model">{config.modelName}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">API Key</span>
                <div className="mt-1 font-mono" data-testid="text-current-key">{config.defaultApiKey}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Token Limit</span>
                <div className="mt-1" data-testid="text-current-token-limit">{config.tokenLimit?.toLocaleString()}</div>
              </div>
            </div>
            {config.provider === "azure_openai" && config.azureEndpoint && (
              <div>
                <span className="font-medium text-muted-foreground">Azure Endpoint</span>
                <div className="mt-1 font-mono text-xs">{config.azureEndpoint}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Update Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={handleProviderChange}>
                <SelectTrigger data-testid="select-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              <Select value={form.modelName} onValueChange={(v) => setForm({ ...form, modelName: v })}>
                <SelectTrigger data-testid="select-model"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {selectedProvider.models.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>API Key *</Label>
            <Input
              data-testid="input-api-key"
              type="password"
              value={form.defaultApiKey}
              onChange={(e) => setForm({ ...form, defaultApiKey: e.target.value })}
              placeholder={selectedProvider.keyPlaceholder}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {form.provider === "openai" && "Get your key from platform.openai.com/api-keys"}
              {form.provider === "azure_openai" && "Get your key from Azure Portal > Cognitive Services"}
              {form.provider === "gemini" && "Get your key from aistudio.google.com/apikey"}
              {form.provider === "deepseek" && "Get your key from platform.deepseek.com/api_keys"}
            </p>
          </div>

          {form.provider === "azure_openai" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Azure Endpoint *</Label>
                <Input
                  data-testid="input-azure-endpoint"
                  value={form.azureEndpoint}
                  onChange={(e) => setForm({ ...form, azureEndpoint: e.target.value })}
                  placeholder="https://your-resource.openai.azure.com"
                />
              </div>
              <div>
                <Label>Deployment Name</Label>
                <Input
                  data-testid="input-azure-deployment"
                  value={form.azureDeployment}
                  onChange={(e) => setForm({ ...form, azureDeployment: e.target.value })}
                  placeholder="gpt-4o-deployment"
                />
              </div>
            </div>
          )}

          <div>
            <Label>Token Limit (Monthly)</Label>
            <Input
              data-testid="input-token-limit"
              type="number"
              value={form.tokenLimit}
              onChange={(e) => setForm({ ...form, tokenLimit: parseInt(e.target.value) || 0 })}
            />
          </div>

          {form.provider === "deepseek" && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                DeepSeek uses an OpenAI-compatible API at api.deepseek.com. The "deepseek-chat" model is recommended for general audit tasks. "deepseek-reasoner" is best for complex analytical work.
              </p>
            </div>
          )}

          <Button
            data-testid="button-save-ai-config"
            disabled={saveMutation.isPending || !form.defaultApiKey || (form.provider === "azure_openai" && !form.azureEndpoint)}
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
