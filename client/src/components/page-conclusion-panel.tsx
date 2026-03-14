import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FileCheck,
  Save,
  Pencil,
  X,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface PageConclusion {
  id: string;
  engagementId: string;
  pageKey: string;
  userId: string;
  userName: string;
  userRole: string;
  authorityLevel: number;
  status: string;
  conclusionText: string;
  isSuperseded: boolean;
  supersededById: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS = [
  { value: "Satisfactory", label: "Satisfactory", icon: CheckCircle2, color: "text-emerald-600" },
  { value: "Unsatisfactory", label: "Unsatisfactory", icon: XCircle, color: "text-red-600" },
  { value: "Satisfactory with Recommendation", label: "Satisfactory with Recommendation", icon: AlertTriangle, color: "text-amber-600" },
  { value: "N/A", label: "N/A", icon: MinusCircle, color: "text-slate-500" },
];

const ROLE_LABELS: Record<string, string> = {
  STAFF: "Staff",
  SENIOR: "Senior",
  MANAGER: "Manager",
  EQCR: "EQCR",
  PARTNER: "Partner",
  FIRM_ADMIN: "Firm Admin",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  const day = pkt.getUTCDate().toString().padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[pkt.getUTCMonth()];
  const year = pkt.getUTCFullYear();
  let hours = pkt.getUTCHours();
  const mins = pkt.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${mins} ${ampm}`;
}

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[3];
  const Icon = opt.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", opt.color)}>
      <Icon className="h-3 w-3" />
      {opt.label}
    </span>
  );
}

interface PageConclusionPanelProps {
  engagementId: string;
  pageKey: string;
}

export function PageConclusionPanel({ engagementId, pageKey }: PageConclusionPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editStatus, setEditStatus] = useState("N/A");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const queryKey = ["/api/page-conclusions", engagementId, pageKey];

  const { data: conclusions = [], isLoading } = useQuery<PageConclusion[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/page-conclusions/${engagementId}/${pageKey}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!engagementId && !!pageKey,
    staleTime: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { status: string; conclusionText: string; id?: string }) => {
      if (data.id) {
        const res = await fetchWithAuth(`/api/page-conclusions/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: data.status, conclusionText: data.conclusionText }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Save failed" }));
          throw new Error(err.error || "Save failed");
        }
        return res.json();
      } else {
        const res = await fetchWithAuth(`/api/page-conclusions/${engagementId}/${pageKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: data.status, conclusionText: data.conclusionText }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Save failed" }));
          throw new Error(err.error || "Save failed");
        }
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setIsEditing(false);
      setEditingId(null);
      setEditText("");
      setEditStatus("N/A");
      toast({ title: "Conclusion saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    },
  });

  const currentUserId = user?.id;
  const currentConclusions = conclusions.filter(c => !c.isSuperseded);
  const myCurrentConclusion = currentConclusions.find(c => c.userId === currentUserId);
  const otherConclusions = currentConclusions.filter(c => c.userId !== currentUserId);
  const supersededConclusions = conclusions.filter(c => c.isSuperseded);

  const handleAIText = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail?.text || (detail.pageKey && detail.pageKey !== pageKey)) return;

    setIsExpanded(true);
    setIsEditing(true);
    setEditingId(myCurrentConclusion?.id || null);

    if (detail.action === "replace") {
      setEditText(detail.text);
    } else if (detail.action === "append") {
      setEditText((prev) => prev ? `${prev}\n\n${detail.text}` : detail.text);
    } else {
      setEditText((prev) => prev || detail.text);
    }
  }, [pageKey, myCurrentConclusion]);

  useEffect(() => {
    window.addEventListener("ai-conclusion-text", handleAIText);
    return () => window.removeEventListener("ai-conclusion-text", handleAIText);
  }, [handleAIText]);

  const handleStartNew = () => {
    setEditText("");
    setEditStatus("N/A");
    setEditingId(null);
    setIsEditing(true);
  };

  const handleReEdit = (conclusion: PageConclusion) => {
    setEditText(conclusion.conclusionText);
    setEditStatus(conclusion.status);
    setEditingId(conclusion.id);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setEditText("");
    setEditStatus("N/A");
  };

  const handleSave = () => {
    if (!editText.trim()) {
      toast({ title: "Conclusion text is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ status: editStatus, conclusionText: editText.trim(), id: editingId || undefined });
  };

  if (!engagementId || !pageKey) return null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="mt-4 border rounded-lg bg-card" data-testid="page-conclusion-panel">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-accent/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Conclusion</span>
              {currentConclusions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {currentConclusions.length}
                </span>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="px-4 pb-4 space-y-3 border-t">
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading conclusions...
              </div>
            ) : (
              <>
                {myCurrentConclusion && !isEditing && (
                  <div className="mt-3 rounded-md border bg-primary/[0.02] p-3" data-testid="my-conclusion">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <User className="h-3 w-3 text-primary" />
                        <span className="font-semibold">{myCurrentConclusion.userName}</span>
                        <span className="text-muted-foreground">({ROLE_LABELS[myCurrentConclusion.userRole] || myCurrentConclusion.userRole})</span>
                      </div>
                      <StatusBadge status={myCurrentConclusion.status} />
                    </div>
                    <p className="text-sm whitespace-pre-wrap mb-2">{myCurrentConclusion.conclusionText}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Saved {formatTimestamp(myCurrentConclusion.updatedAt)}</span>
                        {myCurrentConclusion.createdAt !== myCurrentConclusion.updatedAt && (
                          <span className="italic">(edited)</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1"
                        onClick={() => handleReEdit(myCurrentConclusion)}
                      >
                        <Pencil className="h-3 w-3" />
                        Re-edit
                      </Button>
                    </div>
                  </div>
                )}

                {(isEditing || !myCurrentConclusion) && (
                  <div className="mt-3 space-y-2" data-testid="conclusion-editor">
                    {!isEditing && !myCurrentConclusion && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-1.5 text-xs"
                        onClick={handleStartNew}
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                        Add Conclusion
                      </Button>
                    )}
                    {isEditing && (
                      <>
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          placeholder="Enter your conclusion..."
                          className="min-h-[80px] text-sm"
                          data-testid="conclusion-text"
                        />
                        <div className="flex items-center gap-2">
                          <Select value={editStatus} onValueChange={setEditStatus}>
                            <SelectTrigger className="w-[240px] h-8 text-xs" data-testid="conclusion-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <opt.icon className={cn("h-3 w-3", opt.color)} />
                                    {opt.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex-1" />
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs gap-1" onClick={handleCancel}>
                            <X className="h-3 w-3" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs gap-1"
                            onClick={handleSave}
                            disabled={saveMutation.isPending || !editText.trim()}
                            data-testid="conclusion-save"
                          >
                            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {otherConclusions.length > 0 && (
                  <div className="space-y-2" data-testid="conclusion-trail">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide pt-1">
                      {myCurrentConclusion ? "Other Conclusions" : "Previous Conclusions"}
                    </p>
                    {otherConclusions
                      .sort((a, b) => b.authorityLevel - a.authorityLevel || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(c => (
                        <ConclusionCard key={c.id} conclusion={c} />
                      ))}
                  </div>
                )}

                {supersededConclusions.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground uppercase tracking-wide py-1 select-none">
                      Conclusion History ({supersededConclusions.length})
                    </summary>
                    <div className="space-y-1.5 mt-1.5 pl-2 border-l-2 border-muted">
                      {supersededConclusions
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(c => (
                          <ConclusionCard key={c.id} conclusion={c} muted />
                        ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ConclusionCard({ conclusion, muted }: { conclusion: PageConclusion; muted?: boolean }) {
  return (
    <div className={cn("rounded-md border p-2.5 text-xs", muted ? "bg-muted/30 opacity-70" : "bg-card")}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{conclusion.userName}</span>
          <span className="text-muted-foreground">
            ({ROLE_LABELS[conclusion.userRole] || conclusion.userRole})
          </span>
        </div>
        <StatusBadge status={conclusion.status} />
      </div>
      <p className={cn("whitespace-pre-wrap mb-1", muted ? "text-muted-foreground" : "")}>
        {conclusion.conclusionText}
      </p>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-2.5 w-2.5" />
        {formatTimestamp(conclusion.createdAt)}
        {conclusion.isSuperseded && <span className="italic ml-1">(superseded)</span>}
      </div>
    </div>
  );
}
