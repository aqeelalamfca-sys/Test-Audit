import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Bell, Shield, Palette, Globe, Sparkles, CheckCircle, XCircle, Loader2, ArrowUp, ArrowDown, AlertTriangle, Info, Save, Download, Upload, HardDrive, FileJson } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Provider = "openai" | "gemini" | "deepseek";

interface AISettingsData {
  aiEnabled: boolean;
  preferredProvider: string;
  providerPriority: Provider[];
  hasOpenAI: boolean;
  openaiEnabled: boolean;
  openaiTestStatus: string | null;
  openaiLastTested: string | null;
  hasGemini: boolean;
  geminiEnabled: boolean;
  geminiTestStatus: string | null;
  geminiLastTested: string | null;
  hasDeepseek: boolean;
  deepseekEnabled: boolean;
  deepseekTestStatus: string | null;
  deepseekLastTested: string | null;
  maxTokensPerResponse: number;
  autoSuggestionsEnabled: boolean;
  manualTriggerOnly: boolean;
  requestTimeout: number;
}

function loadLocalPrefs<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return defaults;
}

function saveLocalPrefs(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [profileSaving, setProfileSaving] = useState(false);

  const [notifications, setNotifications] = useState(() =>
    loadLocalPrefs("auditwise_notifications", {
      emailAlerts: true,
      reviewReminders: true,
      deadlineWarnings: true,
      teamUpdates: false,
    })
  );

  const [preferences, setPreferences] = useState(() =>
    loadLocalPrefs("auditwise_preferences", {
      language: "en",
      dateFormat: "DD/MM/YYYY",
      timezone: "PKT",
    })
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [providerPriority, setProviderPriority] = useState<Provider[]>(["openai", "gemini", "deepseek"]);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiEnabled, setOpenaiEnabled] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [deepseekEnabled, setDeepseekEnabled] = useState(false);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [requestTimeout, setRequestTimeout] = useState(30000);
  const [autoSuggestions, setAutoSuggestions] = useState(true);
  const [testingProvider, setTestingProvider] = useState<Provider | null>(null);

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
  }, [user?.fullName]);

  const { data: aiSettings } = useQuery<AISettingsData>({
    queryKey: ['/api/ai/settings'],
    enabled: user?.role === 'ADMIN',
  });

  useEffect(() => {
    if (aiSettings) {
      setAiEnabled(aiSettings.aiEnabled);
      setProviderPriority(aiSettings.providerPriority || ["openai", "gemini", "deepseek"]);
      setOpenaiEnabled(aiSettings.openaiEnabled);
      setGeminiEnabled(aiSettings.geminiEnabled);
      setDeepseekEnabled(aiSettings.deepseekEnabled);
      setMaxTokens(aiSettings.maxTokensPerResponse || 2000);
      setRequestTimeout(aiSettings.requestTimeout || 30000);
      setAutoSuggestions(aiSettings.autoSuggestionsEnabled);
    }
  }, [aiSettings]);

  const updateAISettings = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetchWithAuth('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update AI settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/settings'] });
      toast({ title: "Success", description: "AI settings updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update AI settings", variant: "destructive" });
    },
  });

  const testConnection = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: Provider; apiKey?: string }) => {
      setTestingProvider(provider);
      const response = await fetchWithAuth('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/settings'] });
      if (data.success) {
        toast({ title: "Connection Successful", description: `${variables.provider.toUpperCase()} connection verified (${data.latency}ms)` });
      } else {
        toast({ title: "Connection Failed", description: data.message, variant: "destructive" });
      }
      setTestingProvider(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Connection test failed", variant: "destructive" });
      setTestingProvider(null);
    },
  });

  const handleSaveProfile = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast({ title: "Validation Error", description: "Full name must be at least 2 characters", variant: "destructive" });
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetchWithAuth('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update profile");
      }
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: "Profile Updated", description: "Your profile has been saved successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    saveLocalPrefs("auditwise_notifications", notifications);
    toast({ title: "Preferences Saved", description: "Notification preferences updated" });
  };

  const handleSavePreferences = () => {
    saveLocalPrefs("auditwise_preferences", preferences);
    toast({ title: "Preferences Saved", description: "Display preferences updated" });
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast({ title: "Error", description: "Current password is required", variant: "destructive" });
      return;
    }
    const pwErrors: string[] = [];
    if (newPassword.length < 8) pwErrors.push("at least 8 characters");
    if (!/[a-z]/.test(newPassword)) pwErrors.push("a lowercase letter");
    if (!/[A-Z]/.test(newPassword)) pwErrors.push("an uppercase letter");
    if (!/\d/.test(newPassword)) pwErrors.push("a number");
    if (!/[@$!%*?&#^()_+\-=\[\]{}|\\:";'<>,./~`]/.test(newPassword)) pwErrors.push("a special character");
    if (pwErrors.length > 0) {
      toast({ title: "Weak Password", description: `Password must contain ${pwErrors.join(", ")}`, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to change password");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password Changed", description: "Your password has been updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSaveAISettings = () => {
    updateAISettings.mutate({
      aiEnabled,
      preferredProvider: providerPriority[0] || "openai",
      providerPriority,
      openaiApiKey: openaiApiKey || undefined,
      openaiEnabled,
      geminiApiKey: geminiApiKey || undefined,
      geminiEnabled,
      deepseekApiKey: deepseekApiKey || undefined,
      deepseekEnabled,
      maxTokensPerResponse: maxTokens,
      autoSuggestionsEnabled: autoSuggestions,
      manualTriggerOnly: !autoSuggestions,
      requestTimeout,
    });
  };

  const moveProviderUp = (index: number) => {
    if (index === 0) return;
    const newPriority = [...providerPriority];
    [newPriority[index - 1], newPriority[index]] = [newPriority[index], newPriority[index - 1]];
    setProviderPriority(newPriority);
  };

  const moveProviderDown = (index: number) => {
    if (index === providerPriority.length - 1) return;
    const newPriority = [...providerPriority];
    [newPriority[index], newPriority[index + 1]] = [newPriority[index + 1], newPriority[index]];
    setProviderPriority(newPriority);
  };

  const getProviderStatus = (provider: Provider) => {
    if (!aiSettings) return null;
    switch (provider) {
      case "openai":
        return { hasKey: aiSettings.hasOpenAI, enabled: aiSettings.openaiEnabled, testStatus: aiSettings.openaiTestStatus };
      case "gemini":
        return { hasKey: aiSettings.hasGemini, enabled: aiSettings.geminiEnabled, testStatus: aiSettings.geminiTestStatus };
      case "deepseek":
        return { hasKey: aiSettings.hasDeepseek, enabled: aiSettings.deepseekEnabled, testStatus: aiSettings.deepseekTestStatus };
    }
  };

  const providerNames: Record<Provider, string> = {
    openai: "OpenAI (GPT-4o)",
    gemini: "Google Gemini",
    deepseek: "DeepSeek",
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="page-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your preferences and account settings</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-2.5">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <Palette className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="ai" data-testid="tab-ai">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Configuration
            </TabsTrigger>
          )}
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="backup" data-testid="tab-backup">
              <HardDrive className="h-4 w-4 mr-2" />
              Backup
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-2.5">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    data-testid="input-full-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email || ""} disabled data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" defaultValue={user?.username || ""} disabled data-testid="input-username" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" defaultValue={user?.role || ""} disabled data-testid="input-role" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={profileSaving} data-testid="button-save-profile">
                  {profileSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {profileSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-2.5">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Alerts</Label>
                  <p className="text-sm text-muted-foreground">Receive email notifications for important updates</p>
                </div>
                <Switch
                  checked={notifications.emailAlerts}
                  onCheckedChange={(v) => setNotifications({ ...notifications, emailAlerts: v })}
                  data-testid="switch-email-alerts"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Review Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get reminded about pending reviews</p>
                </div>
                <Switch
                  checked={notifications.reviewReminders}
                  onCheckedChange={(v) => setNotifications({ ...notifications, reviewReminders: v })}
                  data-testid="switch-review-reminders"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Deadline Warnings</Label>
                  <p className="text-sm text-muted-foreground">Receive warnings about approaching deadlines</p>
                </div>
                <Switch
                  checked={notifications.deadlineWarnings}
                  onCheckedChange={(v) => setNotifications({ ...notifications, deadlineWarnings: v })}
                  data-testid="switch-deadline-warnings"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Team Updates</Label>
                  <p className="text-sm text-muted-foreground">Get notified when team members complete tasks</p>
                </div>
                <Switch
                  checked={notifications.teamUpdates}
                  onCheckedChange={(v) => setNotifications({ ...notifications, teamUpdates: v })}
                  data-testid="switch-team-updates"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} data-testid="button-save-notifications">
                  <Save className="h-4 w-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-2.5">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>Customize your display settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={preferences.language} onValueChange={(v) => setPreferences({ ...preferences, language: v })}>
                    <SelectTrigger data-testid="select-language">
                      <Globe className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ur">Urdu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select value={preferences.dateFormat} onValueChange={(v) => setPreferences({ ...preferences, dateFormat: v })}>
                    <SelectTrigger data-testid="select-date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={preferences.timezone} onValueChange={(v) => setPreferences({ ...preferences, timezone: v })}>
                    <SelectTrigger data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKT">Pakistan Standard Time (PKT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="GST">Gulf Standard Time (GST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSavePreferences} data-testid="button-save-preferences">
                  <Save className="h-4 w-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {user?.role === 'ADMIN' && (
          <TabsContent value="ai" className="space-y-2.5">
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Professional Judgment Supremacy:</strong> AI is an assistive drafting tool only. 
                AI must never replace, override, or simulate professional judgment, decisions, approvals, or conclusions.
                All AI-generated content requires human review before use.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Configuration
                </CardTitle>
                <CardDescription>
                  Configure AI features for audit assistance. AI helps draft documentation while maintaining full professional judgment control.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable AI Features</Label>
                    <p className="text-sm text-muted-foreground">
                      Turn on AI-powered suggestions and content generation
                    </p>
                  </div>
                  <Switch
                    checked={aiEnabled}
                    onCheckedChange={setAiEnabled}
                    data-testid="switch-ai-enabled"
                  />
                </div>

                {!aiEnabled && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      AI assistance unavailable — professional judgment required. Enable AI above to use AI features.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Providers</CardTitle>
                <CardDescription>
                  Configure and prioritize AI providers. If the primary provider fails, the system will automatically try the next available provider.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="space-y-2.5">
                  <Label className="text-base">Provider Priority Order</Label>
                  <p className="text-sm text-muted-foreground">
                    Drag providers to set fallback order. The first enabled provider with a valid API key will be used.
                  </p>
                  
                  <div className="space-y-2">
                    {providerPriority.map((provider, index) => {
                      const status = getProviderStatus(provider);
                      const isEnabled = provider === "openai" ? openaiEnabled : provider === "gemini" ? geminiEnabled : deepseekEnabled;
                      
                      return (
                        <div
                          key={provider}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isEnabled && status?.hasKey ? "bg-green-50 border-green-200" : "bg-muted"
                          }`}
                          data-testid={`provider-${provider}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-6">#{index + 1}</span>
                            <div>
                              <span className="font-medium">{providerNames[provider]}</span>
                              <div className="flex items-center gap-2 mt-1">
                                {status?.hasKey ? (
                                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    API Key Set
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    No API Key
                                  </Badge>
                                )}
                                {status?.testStatus === "success" && (
                                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                                    Verified
                                  </Badge>
                                )}
                                {status?.testStatus === "failed" && (
                                  <Badge variant="outline" className="text-xs bg-red-100 text-red-700">
                                    Failed
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => moveProviderUp(index)}
                                    disabled={index === 0}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Move up in priority</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => moveProviderDown(index)}
                                    disabled={index === providerPriority.length - 1}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Move down in priority</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2.5">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">OpenAI (GPT-4o)</Label>
                      <Switch checked={openaiEnabled} onCheckedChange={setOpenaiEnabled} disabled={!aiEnabled} data-testid="switch-openai" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                      <div className="md:col-span-3 space-y-2">
                        <Input
                          type="password"
                          placeholder="sk-proj-..."
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                          disabled={!aiEnabled || !openaiEnabled}
                          data-testid="input-openai-key"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to use environment variable
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => testConnection.mutate({ provider: "openai", apiKey: openaiApiKey || undefined })}
                        disabled={!aiEnabled || !openaiEnabled || testingProvider === "openai"}
                        data-testid="button-test-openai"
                      >
                        {testingProvider === "openai" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Google Gemini</Label>
                      <Switch checked={geminiEnabled} onCheckedChange={setGeminiEnabled} disabled={!aiEnabled} data-testid="switch-gemini" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                      <div className="md:col-span-3 space-y-2">
                        <Input
                          type="password"
                          placeholder="AIza..."
                          value={geminiApiKey}
                          onChange={(e) => setGeminiApiKey(e.target.value)}
                          disabled={!aiEnabled || !geminiEnabled}
                          data-testid="input-gemini-key"
                        />
                        <p className="text-xs text-muted-foreground">
                          Get from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => testConnection.mutate({ provider: "gemini", apiKey: geminiApiKey || undefined })}
                        disabled={!aiEnabled || !geminiEnabled || !geminiApiKey || testingProvider === "gemini"}
                        data-testid="button-test-gemini"
                      >
                        {testingProvider === "gemini" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">DeepSeek</Label>
                      <Switch checked={deepseekEnabled} onCheckedChange={setDeepseekEnabled} disabled={!aiEnabled} data-testid="switch-deepseek" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                      <div className="md:col-span-3 space-y-2">
                        <Input
                          type="password"
                          placeholder="sk-..."
                          value={deepseekApiKey}
                          onChange={(e) => setDeepseekApiKey(e.target.value)}
                          disabled={!aiEnabled || !deepseekEnabled}
                          data-testid="input-deepseek-key"
                        />
                        <p className="text-xs text-muted-foreground">
                          Get from <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">DeepSeek Platform</a>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => testConnection.mutate({ provider: "deepseek", apiKey: deepseekApiKey || undefined })}
                        disabled={!aiEnabled || !deepseekEnabled || !deepseekApiKey || testingProvider === "deepseek"}
                        data-testid="button-test-deepseek"
                      >
                        {testingProvider === "deepseek" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>Fine-tune AI behavior and performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">Max Tokens Per Response</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min="100"
                      max="8000"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      disabled={!aiEnabled}
                      data-testid="input-max-tokens"
                    />
                    <p className="text-xs text-muted-foreground">
                      Controls response length (100-8000)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeout">Request Timeout (ms)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      min="5000"
                      max="120000"
                      step="1000"
                      value={requestTimeout}
                      onChange={(e) => setRequestTimeout(parseInt(e.target.value))}
                      disabled={!aiEnabled}
                      data-testid="input-timeout"
                    />
                    <p className="text-xs text-muted-foreground">
                      How long to wait before trying fallback (5-120 seconds)
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Suggestions</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically show AI suggestions as you work (not recommended)
                    </p>
                  </div>
                  <Switch
                    checked={autoSuggestions}
                    onCheckedChange={setAutoSuggestions}
                    disabled={!aiEnabled}
                    data-testid="switch-auto-suggestions"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (aiSettings) {
                        setAiEnabled(aiSettings.aiEnabled);
                        setProviderPriority(aiSettings.providerPriority || ["openai", "gemini", "deepseek"]);
                        setOpenaiEnabled(aiSettings.openaiEnabled);
                        setGeminiEnabled(aiSettings.geminiEnabled);
                        setDeepseekEnabled(aiSettings.deepseekEnabled);
                        setOpenaiApiKey("");
                        setGeminiApiKey("");
                        setDeepseekApiKey("");
                        setMaxTokens(aiSettings.maxTokensPerResponse || 2000);
                        setRequestTimeout(aiSettings.requestTimeout || 30000);
                        setAutoSuggestions(aiSettings.autoSuggestionsEnabled);
                      }
                    }}
                    data-testid="button-reset-ai"
                  >
                    Reset
                  </Button>
                  <Button onClick={handleSaveAISettings} disabled={updateAISettings.isPending} data-testid="button-save-ai">
                    {updateAISettings.isPending ? "Saving..." : "Save AI Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Safeguards</CardTitle>
                <CardDescription>Professional judgment protection measures</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="space-y-2">
                    <p className="font-medium text-green-700">AI CAN assist with:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />Narrative descriptions</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />Risk descriptions (not levels)</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />Procedure documentation</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />Variance explanations</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />Report language drafting</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-red-700">AI CANNOT perform:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-600 mt-0.5" />Audit opinion selection</li>
                      <li className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-600 mt-0.5" />Risk ratings or scores</li>
                      <li className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-600 mt-0.5" />Materiality calculations</li>
                      <li className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-600 mt-0.5" />Phase approvals or sign-offs</li>
                      <li className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-600 mt-0.5" />Evidence sufficiency conclusions</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="security" className="space-y-2.5">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password (minimum 8 characters)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                  data-testid="button-change-password"
                >
                  {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                  {passwordSaving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {user?.role === 'ADMIN' && (
          <TabsContent value="backup" className="space-y-2.5">
            <BackupTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function BackupTab() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ restored: string[]; errors: string[]; message: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetchWithAuth("/api/admin/backup/download");
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Download failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `auditwise-backup-${new Date().toISOString().split("T")[0]}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded successfully" });
    } catch (error: any) {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setRestoreResult(null);
    try {
      const formData = new FormData();
      formData.append("backup", selectedFile);
      const response = await fetchWithAuth("/api/admin/backup/restore", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Restore failed");
      setRestoreResult(result);
      toast({ title: "Backup restored", description: result.message });
      setSelectedFile(null);
      const input = document.getElementById("backup-file-input") as HTMLInputElement;
      if (input) input.value = "";
    } catch (error: any) {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Download Backup
          </CardTitle>
          <CardDescription>
            Export your firm's complete data as a JSON file. Includes firm profile, settings, clients, engagements, templates, and role configurations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What's included in the backup:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Firm profile and settings</li>
                <li>User accounts (without passwords)</li>
                <li>Client records</li>
                <li>Engagement data and audit phases</li>
                <li>Document templates</li>
                <li>AI configuration (without API keys)</li>
                <li>Role configurations</li>
              </ul>
            </div>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              data-testid="btn-download-backup"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {downloading ? "Generating Backup..." : "Download Backup"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Restore from Backup
          </CardTitle>
          <CardDescription>
            Upload a previously downloaded AuditWise backup file (.json) to restore your data. Existing records with matching names will not be duplicated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Restoring a backup will update your firm profile and add any missing clients, templates, and configurations. This action cannot be undone — download a current backup first.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="backup-file-input">Select Backup File</Label>
              <Input
                id="backup-file-input"
                type="file"
                accept=".json"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                data-testid="input-backup-file"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileJson className="h-4 w-4" />
                  <span>{selectedFile.name}</span>
                  <span className="text-xs">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleRestore}
              disabled={!selectedFile || uploading}
              variant="outline"
              data-testid="btn-restore-backup"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Restoring..." : "Restore Backup"}
            </Button>
            {restoreResult && (
              <div className="space-y-2 p-3 rounded-lg border">
                <p className="text-sm font-medium">{restoreResult.message}</p>
                {restoreResult.restored.length > 0 && (
                  <div className="text-xs text-green-700">
                    <p className="font-medium">Restored:</p>
                    <ul className="list-disc list-inside">
                      {restoreResult.restored.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {restoreResult.errors.length > 0 && (
                  <div className="text-xs text-red-700">
                    <p className="font-medium">Issues:</p>
                    <ul className="list-disc list-inside">
                      {restoreResult.errors.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
