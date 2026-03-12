import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { PageShell } from "@/components/page-shell";
import {
  Bot,
  Zap,
  ArrowDown,
  ArrowUp,
  Key,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Settings,
  Play,
  Trash2,
  Save,
  RefreshCw,
  Globe,
  Clock,
  Activity,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AIProviderExtraField {
  key: string;
  label: string;
  placeholder: string;
  settingsKey: string;
}

interface AIProviderInfo {
  id: string;
  name: string;
  description: string;
  models: string[];
  keyPrefix: string;
  docsUrl: string;
  color: string;
  icon: string;
  extraFields: AIProviderExtraField[];
}

const PROVIDERS: AIProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o for audit documentation, risk analysis, and compliance drafting",
    models: ["gpt-4o", "gpt-4o-mini"],
    keyPrefix: "sk-",
    docsUrl: "https://platform.openai.com/api-keys",
    color: "bg-emerald-500",
    icon: "O",
    extraFields: [
      { key: "accountName", label: "Account Name", placeholder: "e.g. Firm AI Account", settingsKey: "openaiAccountName" },
      { key: "accountEmail", label: "Account Email", placeholder: "e.g. ai-admin@yourfirm.com", settingsKey: "openaiAccountEmail" },
      { key: "organizationId", label: "Organization ID", placeholder: "e.g. org-xxxxxxxx", settingsKey: "openaiOrganizationId" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude for nuanced audit analysis, complex reasoning, and detailed documentation",
    models: ["claude-sonnet-4-20250514"],
    keyPrefix: "sk-ant-",
    docsUrl: "https://console.anthropic.com/settings/keys",
    color: "bg-orange-500",
    icon: "A",
    extraFields: [
      { key: "accountName", label: "Account Name", placeholder: "e.g. Firm AI Account", settingsKey: "anthropicAccountName" },
      { key: "accountEmail", label: "Account Email", placeholder: "e.g. ai-admin@yourfirm.com", settingsKey: "anthropicAccountEmail" },
      { key: "organizationId", label: "Organization ID", placeholder: "e.g. org-xxxxxxxx", settingsKey: "anthropicOrganizationId" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini for multimodal analysis, document understanding, and data extraction",
    models: ["gemini-1.5-flash", "gemini-1.5-pro"],
    keyPrefix: "AI",
    docsUrl: "https://aistudio.google.com/apikey",
    color: "bg-blue-500",
    icon: "G",
    extraFields: [
      { key: "accountName", label: "Account Name", placeholder: "e.g. Firm Google Account", settingsKey: "geminiAccountName" },
      { key: "accountEmail", label: "Account Email", placeholder: "e.g. ai-admin@yourfirm.com", settingsKey: "geminiAccountEmail" },
      { key: "organizationId", label: "Project ID", placeholder: "e.g. my-audit-project-123", settingsKey: "geminiProjectId" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Cost-effective AI for routine documentation and bulk processing tasks",
    models: ["deepseek-chat"],
    keyPrefix: "sk-",
    docsUrl: "https://platform.deepseek.com/api_keys",
    color: "bg-purple-500",
    icon: "D",
    extraFields: [
      { key: "accountName", label: "Account Name", placeholder: "e.g. Firm AI Account", settingsKey: "deepseekAccountName" },
      { key: "accountEmail", label: "Account Email", placeholder: "e.g. ai-admin@yourfirm.com", settingsKey: "deepseekAccountEmail" },
    ],
  },
];

const VIEW_TABS = [
  { id: "providers", label: "AI Providers", icon: <Key className="w-3.5 h-3.5" /> },
  { id: "config", label: "Configuration", icon: <Settings className="w-3.5 h-3.5" /> },
  { id: "usage", label: "Usage Analytics", icon: <Activity className="w-3.5 h-3.5" /> },
];

function ProviderCard({
  provider,
  settings,
  onSetKey,
  onToggle,
  onTest,
  onRemoveKey,
  isTesting,
}: {
  provider: AIProviderInfo;
  settings: any;
  onSetKey: (provider: string) => void;
  onToggle: (provider: string, enabled: boolean) => void;
  onTest: (provider: string) => void;
  onRemoveKey: (provider: string) => void;
  isTesting: string | null;
}) {
  const enabled = settings?.[`${provider.id}Enabled`] ?? false;
  const configured = settings?.[`${provider.id}Configured`] ?? false;
  const lastTested = settings?.[`${provider.id}LastTested`];
  const testStatus = settings?.[`${provider.id}TestStatus`];
  const isPreferred = settings?.preferredProvider === provider.id;
  const testing = isTesting === provider.id;

  return (
    <Card className={`relative overflow-hidden transition-all ${enabled ? "ring-1 ring-primary/30" : "opacity-80"}`} data-testid={`provider-card-${provider.id}`}>
      {isPreferred && (
        <div className="absolute top-0 right-0">
          <Badge className="rounded-none rounded-bl-md bg-primary text-primary-foreground text-[10px] border-0">
            Preferred
          </Badge>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg ${provider.color} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
            {provider.icon}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {provider.name}
              {configured && testStatus === "success" && (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              {configured && testStatus === "failed" && (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">{provider.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              onCheckedChange={(val) => onToggle(provider.id, val)}
              data-testid={`switch-${provider.id}`}
            />
            <Label className="text-sm">{enabled ? "Enabled" : "Disabled"}</Label>
          </div>
          <div className="flex items-center gap-1.5">
            {configured ? (
              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                <Key className="w-3 h-3 mr-1" />
                Key Set
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-500">
                No Key
              </Badge>
            )}
          </div>
        </div>

        {configured && (
          <div className="space-y-1 text-[10px] text-muted-foreground bg-muted/40 rounded-md p-2">
            {provider.extraFields.map((field) => {
              const val = settings?.[field.settingsKey];
              if (!val) return null;
              return (
                <div key={field.key} className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground/70">{field.label}:</span>
                  <span className="truncate">{val}</span>
                </div>
              );
            })}
            {lastTested && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last tested: {new Date(lastTested).toLocaleString()}
                {testStatus === "success" && <span className="text-green-600 ml-1">- Passed</span>}
                {testStatus === "failed" && <span className="text-red-500 ml-1">- Failed</span>}
              </div>
            )}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground">
          Models: {provider.models.join(", ")}
        </div>

        <Separator />

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={configured ? "outline" : "default"}
            className="text-xs h-7"
            onClick={() => onSetKey(provider.id)}
            data-testid={`button-set-key-${provider.id}`}
          >
            <Key className="w-3 h-3 mr-1" />
            {configured ? "Update" : "Configure"}
          </Button>
          {configured && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => onTest(provider.id)}
                disabled={testing}
                data-testid={`button-test-${provider.id}`}
              >
                {testing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                Test
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => onRemoveKey(provider.id)}
                data-testid={`button-remove-${provider.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProvidersTab({ settings, refetch }: { settings: any; refetch: () => void }) {
  const { toast } = useToast();
  const [keyDialog, setKeyDialog] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [extraFieldValues, setExtraFieldValues] = useState<Record<string, string>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [removeDialog, setRemoveDialog] = useState<string | null>(null);

  const openKeyDialog = (providerId: string) => {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      const vals: Record<string, string> = {};
      provider.extraFields.forEach(f => {
        vals[f.key] = settings?.[f.settingsKey] || "";
      });
      setExtraFieldValues(vals);
    }
    setApiKey("");
    setKeyDialog(providerId);
  };

  const setKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey, accountName, accountEmail, organizationId }: {
      provider: string; apiKey?: string; accountName?: string | null; accountEmail?: string | null; organizationId?: string | null;
    }) => {
      const payload: any = { provider, enabled: true };
      if (apiKey) payload.apiKey = apiKey;
      if (accountName !== undefined) payload.accountName = accountName;
      if (accountEmail !== undefined) payload.accountEmail = accountEmail;
      if (organizationId !== undefined) payload.organizationId = organizationId;
      const res = await apiRequest("POST", "/api/tenant/ai-settings/provider-key", payload);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Settings Saved", description: `${variables.provider} configuration has been saved.` });
      setKeyDialog(null);
      setApiKey("");
      setExtraFieldValues({});
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/ai-settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message || "Failed to save API key", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ provider, enabled }: { provider: string; enabled: boolean }) => {
      const res = await apiRequest("POST", "/api/tenant/ai-settings/provider-toggle", { provider, enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/ai-settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (provider: string) => {
      setTestingProvider(provider);
      const res = await apiRequest("POST", "/api/tenant/ai-settings/test-provider", { provider });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Connection Successful", description: data.message });
      } else {
        toast({ title: "Connection Failed", description: data.message, variant: "destructive" });
      }
      setTestingProvider(null);
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/ai-settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Test Failed", description: err.message, variant: "destructive" });
      setTestingProvider(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await apiRequest("DELETE", `/api/tenant/ai-settings/provider-key/${provider}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Key Removed", description: "API key has been removed." });
      setRemoveDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/ai-settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const activeCount = PROVIDERS.filter(p => settings?.[`${p.id}Enabled`] && settings?.[`${p.id}Configured`]).length;
  const configuredCount = PROVIDERS.filter(p => settings?.[`${p.id}Configured`]).length;

  const currentKeyProvider = PROVIDERS.find(p => p.id === keyDialog);
  const currentRemoveProvider = PROVIDERS.find(p => p.id === removeDialog);

  return (
    <div className="space-y-4" data-testid="tab-providers">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{configuredCount}</div>
          <div className="text-[10px] text-muted-foreground">Providers Configured</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-[10px] text-muted-foreground">Active Providers</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold">{settings?.aiEnabled ? "On" : "Off"}</div>
          <div className="text-[10px] text-muted-foreground">AI Status</div>
        </Card>
      </div>

      {settings?.platformKeyAvailable && (
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50">
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-blue-800 dark:text-blue-200">
              Platform OpenAI key is available as fallback. Add your own keys below for dedicated usage and higher limits.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            settings={settings}
            onSetKey={(p) => openKeyDialog(p)}
            onToggle={(p, enabled) => toggleMutation.mutate({ provider: p, enabled })}
            onTest={(p) => testMutation.mutate(p)}
            onRemoveKey={(p) => setRemoveDialog(p)}
            isTesting={testingProvider}
          />
        ))}
      </div>

      <Dialog open={!!keyDialog} onOpenChange={(open) => !open && setKeyDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentKeyProvider && (
                <div className={`w-6 h-6 rounded ${currentKeyProvider.color} flex items-center justify-center text-white text-xs font-bold`}>
                  {currentKeyProvider.icon}
                </div>
              )}
              {settings?.[`${keyDialog}Configured`] ? "Update" : "Configure"} {currentKeyProvider?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your account details and API key. The key is encrypted at rest using AES-256-GCM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {currentKeyProvider?.extraFields.map((field) => (
              <div key={field.key}>
                <Label className="text-sm">{field.label}</Label>
                <Input
                  type={field.key === "accountEmail" ? "email" : "text"}
                  value={extraFieldValues[field.key] || ""}
                  onChange={(e) => setExtraFieldValues({ ...extraFieldValues, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
            <Separator />
            <div>
              <Label className="text-sm">API Key <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={currentKeyProvider ? `${currentKeyProvider.keyPrefix}...` : "Enter API key"}
                data-testid="input-api-key"
              />
              {settings?.[`${keyDialog}Configured`] && !apiKey && (
                <p className="text-[10px] text-amber-600 mt-1">Leave blank to keep existing key (enter new key to replace)</p>
              )}
            </div>
            {currentKeyProvider && (
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a href={currentKeyProvider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  {currentKeyProvider.name} Console
                </a>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDialog(null)}>Cancel</Button>
            <Button
              onClick={() => keyDialog && setKeyMutation.mutate({
                provider: keyDialog,
                apiKey: apiKey || undefined,
                accountName: extraFieldValues.accountName ?? null,
                accountEmail: extraFieldValues.accountEmail ?? null,
                organizationId: extraFieldValues.organizationId ?? null,
              })}
              disabled={
                (!settings?.[`${keyDialog}Configured`] && (!apiKey || apiKey.length < 5))
                || (apiKey.length > 0 && apiKey.length < 5)
                || setKeyMutation.isPending
              }
              data-testid="button-save-api-key"
            >
              {setKeyMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              {apiKey ? "Save & Encrypt" : "Save Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeDialog} onOpenChange={(open) => !open && setRemoveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {currentRemoveProvider?.name} API Key</DialogTitle>
            <DialogDescription>
              This will permanently remove the stored API key and disable {currentRemoveProvider?.name} as a provider. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => removeDialog && removeMutation.mutate(removeDialog)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Remove Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigurationTab({ settings }: { settings: any }) {
  const { toast } = useToast();
  const [config, setConfig] = useState({
    aiEnabled: settings?.aiEnabled ?? false,
    preferredProvider: settings?.preferredProvider ?? "openai",
    maxTokensPerResponse: settings?.maxTokensPerResponse ?? 2000,
    autoSuggestionsEnabled: settings?.autoSuggestionsEnabled ?? false,
    manualTriggerOnly: settings?.manualTriggerOnly ?? true,
    requestTimeout: settings?.requestTimeout ?? 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/tenant/ai-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings Saved", description: "AI configuration updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/ai-settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const configuredProviders = PROVIDERS.filter(p => settings?.[`${p.id}Configured`] || (p.id === "openai" && settings?.platformKeyAvailable));

  return (
    <div className="space-y-4" data-testid="tab-config">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Engine Settings
          </CardTitle>
          <CardDescription>Configure how AI assists your audit workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Enable AI Features</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Turn AI assistance on or off for your entire firm</p>
            </div>
            <Switch
              checked={config.aiEnabled}
              onCheckedChange={(val) => setConfig({ ...config, aiEnabled: val })}
              data-testid="switch-ai-enabled"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Preferred Provider</Label>
            <p className="text-xs text-muted-foreground mb-2">Primary AI provider for all requests. Others serve as fallbacks.</p>
            <Select value={config.preferredProvider} onValueChange={(val) => setConfig({ ...config, preferredProvider: val })}>
              <SelectTrigger className="w-64" data-testid="select-preferred-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {configuredProviders.length > 0 ? (
                  configuredProviders.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded text-[10px] ${p.color} text-white flex items-center justify-center font-bold`}>{p.icon}</span>
                        {p.name}
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  PROVIDERS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="text-sm font-medium">Auto-Suggestions</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Show AI suggestions automatically while working</p>
              </div>
              <Switch
                checked={config.autoSuggestionsEnabled}
                onCheckedChange={(val) => setConfig({ ...config, autoSuggestionsEnabled: val })}
                data-testid="switch-auto-suggestions"
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="text-sm font-medium">Manual Trigger Only</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Require explicit click to invoke AI</p>
              </div>
              <Switch
                checked={config.manualTriggerOnly}
                onCheckedChange={(val) => setConfig({ ...config, manualTriggerOnly: val })}
                data-testid="switch-manual-trigger"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Max Tokens Per Response</Label>
              <p className="text-xs text-muted-foreground mb-2">Maximum output length for AI-generated content</p>
              <Select
                value={config.maxTokensPerResponse.toString()}
                onValueChange={(val) => setConfig({ ...config, maxTokensPerResponse: parseInt(val) })}
              >
                <SelectTrigger data-testid="select-max-tokens">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">500 tokens (Short)</SelectItem>
                  <SelectItem value="1000">1,000 tokens</SelectItem>
                  <SelectItem value="2000">2,000 tokens (Default)</SelectItem>
                  <SelectItem value="4000">4,000 tokens</SelectItem>
                  <SelectItem value="8000">8,000 tokens (Long)</SelectItem>
                  <SelectItem value="16000">16,000 tokens (Maximum)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Request Timeout</Label>
              <p className="text-xs text-muted-foreground mb-2">Maximum wait time for AI responses</p>
              <Select
                value={config.requestTimeout.toString()}
                onValueChange={(val) => setConfig({ ...config, requestTimeout: parseInt(val) })}
              >
                <SelectTrigger data-testid="select-timeout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15000">15 seconds</SelectItem>
                  <SelectItem value="30000">30 seconds (Default)</SelectItem>
                  <SelectItem value="60000">60 seconds</SelectItem>
                  <SelectItem value="120000">120 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <Button
            onClick={() => saveMutation.mutate(config)}
            disabled={saveMutation.isPending}
            data-testid="button-save-config"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            AI Governance
          </CardTitle>
          <CardDescription>Audit trail and compliance safeguards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-2 bg-muted/50 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">All AI interactions are logged</div>
                <div className="text-xs text-muted-foreground">Every AI request, response, and user edit is captured in the audit trail</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 bg-muted/50 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">AI output labeled as AI-Assisted</div>
                <div className="text-xs text-muted-foreground">All AI-generated content carries "Subject to Professional Judgment" disclaimer</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 bg-muted/50 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Prohibited fields protected</div>
                <div className="text-xs text-muted-foreground">AI cannot set risk ratings, materiality amounts, audit opinions, or other judgment fields</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 bg-muted/50 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">API keys encrypted at rest</div>
                <div className="text-xs text-muted-foreground">All stored API keys use AES-256-GCM encryption and are never displayed after saving</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsageTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/tenant/ai-usage"],
  });

  const records = data?.records || [];
  const summary = data?.summary || {};

  const providerStats = useMemo(() => {
    const stats: Record<string, { count: number; tokensIn: number; tokensOut: number }> = {};
    records.forEach((r: any) => {
      const p = r.provider || "unknown";
      if (!stats[p]) stats[p] = { count: 0, tokensIn: 0, tokensOut: 0 };
      stats[p].count++;
      stats[p].tokensIn += r.tokensIn || 0;
      stats[p].tokensOut += r.tokensOut || 0;
    });
    return stats;
  }, [records]);

  return (
    <div className="space-y-4" data-testid="tab-usage">
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

      {Object.keys(providerStats).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usage by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(providerStats).map(([provider, stats]) => {
                const providerInfo = PROVIDERS.find(p => p.id === provider);
                const totalTokens = stats.tokensIn + stats.tokensOut;
                const maxTokens = Math.max(...Object.values(providerStats).map(s => s.tokensIn + s.tokensOut), 1);
                return (
                  <div key={provider} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded ${providerInfo?.color || "bg-gray-400"} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {providerInfo?.icon || provider[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{providerInfo?.name || provider}</span>
                        <span className="text-muted-foreground">{stats.count} requests</span>
                      </div>
                      <Progress value={(totalTokens / maxTokens) * 100} className="h-1.5 mt-1" />
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {stats.tokensIn.toLocaleString()} in / {stats.tokensOut.toLocaleString()} out
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading usage data...</span>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent AI Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No AI usage recorded yet</p>
                <p className="text-xs mt-1">AI requests will appear here once you start using AI features</p>
              </div>
            ) : (
              <div className="space-y-2">
                {records.slice(0, 20).map((r: any) => {
                  const providerInfo = PROVIDERS.find(p => p.id === r.provider);
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-2 border rounded-md text-sm" data-testid={`row-ai-usage-${r.id}`}>
                      <div className={`w-6 h-6 rounded ${providerInfo?.color || "bg-gray-400"} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                        {providerInfo?.icon || "?"}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{r.provider}</Badge>
                      <span className="font-medium text-xs">{r.model || "-"}</span>
                      <span className="text-muted-foreground text-xs">{r.tokensIn || 0} in / {r.tokensOut || 0} out</span>
                      <span className="text-muted-foreground text-xs ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function FirmAIUsage() {
  const [activeTab, setActiveTab] = useState("providers");

  const { data: settings, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/tenant/ai-settings"],
  });

  if (isLoading) {
    return (
      <PageShell
        title="AI Integration"
        description="Configure AI providers and manage your firm's AI capabilities"
        icon={<Bot className="w-5 h-5" />}
        testId="page-ai-integration"
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading AI settings...</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="AI Integration"
      description="Configure AI providers and manage your firm's AI capabilities"
      icon={<Bot className="w-5 h-5" />}
      testId="page-ai-integration"
    >
      <div className="space-y-4">
        <SimpleTabNavigation
          tabs={VIEW_TABS}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {activeTab === "providers" && (
          <ProvidersTab settings={settings} refetch={refetch} />
        )}
        {activeTab === "config" && (
          <ConfigurationTab settings={settings} />
        )}
        {activeTab === "usage" && (
          <UsageTab />
        )}
      </div>
    </PageShell>
  );
}
