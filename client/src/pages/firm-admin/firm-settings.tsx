import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Bot, Save, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FirmSettingsPage() {
  const { toast } = useToast();
  const [aiKeyForm, setAiKeyForm] = useState({ apiKey: "", provider: "openai" });

  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/tenant/settings"],
  });

  const { data: subscription, isLoading: subLoading } = useQuery<any>({
    queryKey: ["/api/tenant/subscription"],
  });

  const setAiKeyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tenant/settings/ai-key", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "AI Key Saved", description: "Your firm AI key has been encrypted and stored." });
      setAiKeyForm({ apiKey: "", provider: "openai" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/settings"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    TRIAL: "bg-amber-100 text-amber-800",
    SUSPENDED: "bg-red-100 text-red-800",
    PAST_DUE: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" data-testid="firm-settings-page">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Firm Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Firm Status:</span>
                  <Badge className={statusColor[subscription?.firmStatus] || ""} data-testid="badge-firm-status">
                    {subscription?.firmStatus || "Unknown"}
                  </Badge>
                </div>
                {subscription?.subscription && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Plan:</span>
                      <Badge variant="outline" data-testid="badge-plan-name">{subscription.subscription.plan?.name}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Subscription:</span>
                      <Badge className={statusColor[subscription.subscription.status] || ""} data-testid="badge-sub-status">
                        {subscription.subscription.status}
                      </Badge>
                    </div>
                    {subscription.subscription.trialEnd && (
                      <div className="text-sm text-muted-foreground">
                        Trial ends: {new Date(subscription.subscription.trialEnd).toLocaleDateString()}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Max Users: {subscription.subscription.plan?.maxUsers} · Max Engagements: {subscription.subscription.plan?.maxEngagements}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" /> AI API Override
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.aiOverrideEnabled && (
              <Badge className="bg-green-100 text-green-800" data-testid="badge-ai-override-active">AI Override Active</Badge>
            )}
            <div>
              <Label>API Key</Label>
              <Input
                data-testid="input-firm-ai-key"
                type="password"
                value={aiKeyForm.apiKey}
                onChange={(e) => setAiKeyForm({ ...aiKeyForm, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div>
              <Label>Provider</Label>
              <Select value={aiKeyForm.provider} onValueChange={(v) => setAiKeyForm({ ...aiKeyForm, provider: v })}>
                <SelectTrigger data-testid="select-ai-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              data-testid="button-save-ai-key"
              disabled={setAiKeyMutation.isPending || !aiKeyForm.apiKey}
              onClick={() => setAiKeyMutation.mutate(aiKeyForm)}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {setAiKeyMutation.isPending ? "Saving..." : "Save & Encrypt"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Your API key is encrypted at rest using AES-256-GCM. It will be used instead of the platform default.
            </p>
          </CardContent>
        </Card>
      </div>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Firm Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><span className="font-medium">RBAC Enforced:</span> {settings.enforceRBAC ? "Yes" : "No"}</div>
              <div><span className="font-medium">AI Enabled:</span> {settings.aiEnabled ? "Yes" : "No"}</div>
              <div><span className="font-medium">AI Requires Approval:</span> {settings.aiRequiresHumanApproval ? "Yes" : "No"}</div>
              <div><span className="font-medium">Digital Signatures:</span> {settings.requireDigitalSignatures ? "Yes" : "No"}</div>
              <div><span className="font-medium">Partner PIN:</span> {settings.requirePartnerPIN ? "Yes" : "No"}</div>
              <div><span className="font-medium">Maker-Checker:</span> {settings.makerCheckerMode}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
