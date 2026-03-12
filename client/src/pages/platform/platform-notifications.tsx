import { useState, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell, Plus, Trash2, Image, Youtube, Sparkles, Loader2, Upload, X,
  Building2, Globe, Search, CheckCircle2, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAutoRefresh } from "@/lib/queryClient";

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

interface NotificationForm {
  title: string;
  message: string;
  scope: string;
  type: string;
  priority: number;
  imageUrl: string;
  youtubeUrl: string;
  firmIds: string[];
}

const INITIAL_FORM: NotificationForm = {
  title: "",
  message: "",
  scope: "GLOBAL",
  type: "POPUP",
  priority: 0,
  imageUrl: "",
  youtubeUrl: "",
  firmIds: [],
};

export default function PlatformNotifications() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState<NotificationForm>({ ...INITIAL_FORM });
  const [firmSearch, setFirmSearch] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewNotification, setPreviewNotification] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: notifications, isLoading } = useQuery<any[]>({ queryKey: ["/api/platform/notifications"], refetchInterval: 30000 });
  const { data: firmsResponse } = useQuery<any>({
    queryKey: ["/api/platform/firms", "notifications"],
    queryFn: async () => {
      const token = localStorage.getItem("auditwise_token");
      const res = await fetch("/api/platform/firms?limit=500", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
  const firms: any[] = firmsResponse?.firms || firmsResponse || [];

  const createMutation = useMutation({
    mutationFn: async (data: NotificationForm) => {
      const payload: any = {
        title: data.title,
        message: data.message,
        scope: data.scope,
        type: data.type,
        priority: data.priority,
        imageUrl: data.imageUrl || undefined,
        youtubeUrl: data.youtubeUrl || undefined,
      };
      if (data.scope === "FIRM" && data.firmIds.length > 0) {
        payload.firmIds = data.firmIds;
      }
      const res = await apiRequest("POST", "/api/platform/notifications", payload);
      return res.json();
    },
    onSuccess: () => {
      const targetLabel = form.scope === "GLOBAL"
        ? "all firms"
        : form.firmIds.length === (firms || []).length
          ? "all firms"
          : `${form.firmIds.length} firm(s)`;
      toast({ title: "Notification Sent", description: `Notification delivered to ${targetLabel}.` });
      setShowCreateDialog(false);
      setForm({ ...INITIAL_FORM });
      setAiTopic("");
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

  const aiGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform/notifications/ai-generate", {
        topic: aiTopic,
        tone: aiTone,
        type: form.type,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        message: data.message || prev.message,
      }));
      toast({ title: "AI Content Generated", description: "Title and message populated. Feel free to edit." });
    },
    onError: (error: any) => {
      toast({ title: "AI Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const imageUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetchWithAutoRefresh("/api/platform/notifications/upload-image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: (data: any) => {
      setForm((prev) => ({ ...prev, imageUrl: data.imageUrl }));
      toast({ title: "Image Uploaded" });
    },
    onError: () => {
      toast({ title: "Upload Failed", variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) imageUploadMutation.mutate(file);
    e.target.value = "";
  };

  const toggleFirm = (firmId: string) => {
    setForm((prev) => ({
      ...prev,
      firmIds: prev.firmIds.includes(firmId)
        ? prev.firmIds.filter((id) => id !== firmId)
        : [...prev.firmIds, firmId],
    }));
  };

  const selectAllFirms = () => {
    if (!firms) return;
    setForm((prev) => ({ ...prev, firmIds: firms.map((f: any) => f.id) }));
  };

  const deselectAllFirms = () => {
    setForm((prev) => ({ ...prev, firmIds: [] }));
  };

  const filteredFirms = (firms || []).filter((f: any) =>
    (f.displayName || f.name || "").toLowerCase().includes(firmSearch.toLowerCase())
  );

  const scopeColor: Record<string, string> = {
    GLOBAL: "bg-blue-100 text-blue-800",
    FIRM: "bg-green-100 text-green-800",
    ENGAGEMENT: "bg-purple-100 text-purple-800",
  };

  const ytId = form.youtubeUrl ? extractYoutubeId(form.youtubeUrl) : null;

  return (
    <div className="page-container" data-testid="platform-notifications-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Platform Notifications</h1>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) { setForm({ ...INITIAL_FORM }); setAiTopic(""); }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-notification"><Plus className="h-4 w-4 mr-2" /> New Notification</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Notification</DialogTitle></DialogHeader>

            <div className="space-y-5">
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  AI Content Generator
                </div>
                <div className="flex gap-2">
                  <Input
                    data-testid="input-ai-topic"
                    placeholder="Describe the notification topic (e.g., 'System maintenance this weekend')"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger data-testid="select-ai-tone" className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    data-testid="button-ai-generate"
                    variant="secondary"
                    disabled={!aiTopic || aiGenerateMutation.isPending}
                    onClick={() => aiGenerateMutation.mutate()}
                  >
                    {aiGenerateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <Label>Title *</Label>
                <Input
                  data-testid="input-notification-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Notification title"
                />
              </div>

              <div>
                <Label>Message *</Label>
                <Textarea
                  data-testid="input-notification-message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  placeholder="Write your notification message..."
                />
                <span className="text-xs text-muted-foreground">{form.message.length}/1000 characters</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Image className="h-3.5 w-3.5" /> Image (optional)
                  </Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {form.imageUrl ? (
                    <div className="relative group">
                      <img
                        src={form.imageUrl}
                        alt="Preview"
                        className="w-full h-28 object-cover rounded-md border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setForm({ ...form, imageUrl: "" })}
                        data-testid="button-remove-image"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-28 border-dashed flex flex-col gap-1"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imageUploadMutation.isPending}
                      data-testid="button-upload-image"
                    >
                      {imageUploadMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Upload Image</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Youtube className="h-3.5 w-3.5 text-red-500" /> YouTube Link (optional)
                  </Label>
                  <Input
                    data-testid="input-youtube-url"
                    value={form.youtubeUrl}
                    onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                  {ytId && (
                    <div className="mt-2 rounded-md overflow-hidden border">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        className="w-full h-[120px]"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="YouTube preview"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Scope</Label>
                  <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v, firmIds: [] })}>
                    <SelectTrigger data-testid="select-scope"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL">
                        <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Global (All Firms)</span>
                      </SelectItem>
                      <SelectItem value="FIRM">
                        <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Selected Firms</span>
                      </SelectItem>
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

              {form.scope === "FIRM" && (
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Select Firms ({form.firmIds.length} of {(firms || []).length} selected)
                    </Label>
                    <div className="flex gap-2">
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectAllFirms} data-testid="button-select-all-firms">
                        Select All
                      </Button>
                      <span className="text-muted-foreground">|</span>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={deselectAllFirms} data-testid="button-deselect-all-firms">
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      data-testid="input-firm-search"
                      className="pl-8 h-8 text-sm"
                      placeholder="Search firms..."
                      value={firmSearch}
                      onChange={(e) => setFirmSearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[140px]">
                    <div className="space-y-1">
                      {filteredFirms.map((f: any) => (
                        <label
                          key={f.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                          data-testid={`checkbox-firm-${f.id}`}
                        >
                          <Checkbox
                            checked={form.firmIds.includes(f.id)}
                            onCheckedChange={() => toggleFirm(f.id)}
                          />
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{f.displayName || f.name}</span>
                          <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                            {f.status}
                          </Badge>
                        </label>
                      ))}
                      {filteredFirms.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No firms found</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Button
                className="w-full"
                data-testid="button-submit-notification"
                disabled={
                  createMutation.isPending ||
                  !form.title ||
                  !form.message ||
                  (form.scope === "FIRM" && form.firmIds.length === 0)
                }
                onClick={() => createMutation.mutate(form)}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Send Notification
                    {form.scope === "FIRM" && form.firmIds.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{form.firmIds.length} firm(s)</Badge>
                    )}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-3">
          {(notifications || []).map((n: any) => {
            const nYtId = n.youtubeUrl ? extractYoutubeId(n.youtubeUrl) : null;
            return (
              <Card key={n.id} data-testid={`card-notification-${n.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{n.title}</h3>
                        <Badge className={scopeColor[n.scope] || ""} variant="secondary">{n.scope}</Badge>
                        <Badge variant="outline">{n.type}</Badge>
                        {n.firmIds && Array.isArray(n.firmIds) && (
                          <Badge variant="secondary" className="text-[10px]">{n.firmIds.length} firm(s)</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {(n.imageUrl || nYtId) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setPreviewNotification(n); setPreviewOpen(true); }}
                          data-testid={`button-preview-notification-${n.id}`}
                        >
                          <Eye className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(n.id)} data-testid={`button-delete-notification-${n.id}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {(n.imageUrl || nYtId) && (
                    <div className="mt-3 flex gap-3 flex-wrap">
                      {n.imageUrl && (
                        <img src={n.imageUrl} alt="Notification" className="h-20 rounded-md border object-cover" />
                      )}
                      {nYtId && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600">
                          <Youtube className="h-4 w-4" />
                          <span>Video attached</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {(notifications || []).length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No notifications yet</div>
          )}
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewNotification?.title}</DialogTitle>
          </DialogHeader>
          {previewNotification && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{previewNotification.message}</p>

              {previewNotification.imageUrl && (
                <img
                  src={previewNotification.imageUrl}
                  alt="Notification"
                  className="w-full rounded-lg border"
                />
              )}

              {previewNotification.youtubeUrl && extractYoutubeId(previewNotification.youtubeUrl) && (
                <div className="rounded-lg overflow-hidden border">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYoutubeId(previewNotification.youtubeUrl)}`}
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube video"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge className={scopeColor[previewNotification.scope] || ""} variant="secondary">
                  {previewNotification.scope}
                </Badge>
                <Badge variant="outline">{previewNotification.type}</Badge>
                <span className="ml-auto">{new Date(previewNotification.createdAt).toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
