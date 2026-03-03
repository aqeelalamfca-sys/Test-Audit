import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PlatformNotifications() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({
    title: "", message: "", scope: "GLOBAL" as string, type: "POPUP" as string, priority: 0,
  });

  const { data: notifications, isLoading } = useQuery<any[]>({ queryKey: ["/api/platform/notifications"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/platform/notifications", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Notification Created" });
      setShowCreateDialog(false);
      setForm({ title: "", message: "", scope: "GLOBAL", type: "POPUP", priority: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/notifications"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/platform/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/notifications"] });
    },
  });

  const scopeColor: Record<string, string> = {
    GLOBAL: "bg-blue-100 text-blue-800",
    FIRM: "bg-green-100 text-green-800",
    ENGAGEMENT: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="platform-notifications-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-red-600" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform Notifications</h1>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-notification"><Plus className="h-4 w-4 mr-2" /> New Notification</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Notification</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input data-testid="input-notification-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Message *</Label>
                <Textarea data-testid="input-notification-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Scope</Label>
                  <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                    <SelectTrigger data-testid="select-scope"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL">Global</SelectItem>
                      <SelectItem value="FIRM">Firm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POPUP">Pop-up</SelectItem>
                      <SelectItem value="BANNER">Banner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                data-testid="button-submit-notification"
                disabled={createMutation.isPending || !form.title || !form.message}
                onClick={() => createMutation.mutate(form)}
              >
                {createMutation.isPending ? "Creating..." : "Send Notification"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-3">
          {(notifications || []).map((n: any) => (
            <Card key={n.id} data-testid={`card-notification-${n.id}`}>
              <CardContent className="p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{n.title}</h3>
                    <Badge className={scopeColor[n.scope] || ""} variant="secondary">{n.scope}</Badge>
                    <Badge variant="outline">{n.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(n.id)} data-testid={`button-delete-notification-${n.id}`}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {(notifications || []).length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No notifications yet</div>
          )}
        </div>
      )}
    </div>
  );
}
