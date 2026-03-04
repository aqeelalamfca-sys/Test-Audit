import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, fetchWithAutoRefresh } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Plus,
  Search,
  Filter,
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  MoreVertical,
  FileText,
  ArrowRight,
  Loader2,
  ClipboardList,
  Users,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface ReviewNoteData {
  id: string;
  engagementId: string;
  phase: string;
  title: string | null;
  content: string;
  noteType: string;
  severity: string;
  status: string;
  sectionKey: string | null;
  dueDate: string | null;
  isLocked: boolean;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  author: { id: string; fullName: string; role: string; username: string };
  resolvedBy: { id: string; fullName: string; role: string } | null;
  assignees: Array<{
    id: string;
    user: { id: string; fullName: string; role: string; username: string };
  }>;
  engagement: {
    id: string;
    engagementCode: string;
    engagementType: string;
    fiscalYearEnd: string;
    client: { id: string; name: string };
  };
  threads: Array<{
    id: string;
    message: string;
    createdAt: string;
    author: { id: string; fullName: string; role: string };
  }>;
}

interface Stats {
  myOpen: number;
  myTotal: number;
  createdOpen: number;
  createdTotal: number;
}

const severityConfig = {
  INFO: { icon: Info, label: "Info", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
  LOW: { icon: Info, label: "Low", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800" },
  MEDIUM: { icon: AlertTriangle, label: "Medium", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
  WARNING: { icon: AlertTriangle, label: "Warning", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
  HIGH: { icon: AlertCircle, label: "High", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" },
  CRITICAL: { icon: AlertCircle, label: "Critical", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle },
  ADDRESSED: { label: "Addressed", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  CLEARED: { label: "Cleared", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
};

const noteTypeConfig: Record<string, { label: string; color: string }> = {
  ISSUE: { label: "Issue", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  QUESTION: { label: "Question", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  TODO: { label: "To-Do", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

const MANAGER_ROLES = ["ADMIN", "PARTNER", "MANAGING_PARTNER", "MANAGER", "EQCR", "FIRM_ADMIN", "SENIOR_MANAGER"];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function NoteCard({ note, onStatusChange, onReply, userId }: {
  note: ReviewNoteData;
  onStatusChange: (noteId: string, status: string, resolution?: string) => void;
  onReply: (noteId: string) => void;
  userId: string;
}) {
  const sev = severityConfig[note.severity as keyof typeof severityConfig] || severityConfig.INFO;
  const SevIcon = sev.icon;
  const stat = statusConfig[note.status] || statusConfig.OPEN;
  const nType = noteTypeConfig[note.noteType] || noteTypeConfig.ISSUE;

  return (
    <Card className={cn("transition-all hover:shadow-md", sev.bg)} data-testid={`review-note-card-${note.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
              {getInitials(note.author.fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold truncate" data-testid={`note-title-${note.id}`}>
                    {note.title || note.content.slice(0, 60)}
                  </h4>
                  <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", nType.color)}>
                    {nType.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span>{note.author.fullName}</span>
                  <span>&middot;</span>
                  <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <SevIcon className={cn("h-4 w-4", sev.color)} />
                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", stat.color)} data-testid={`note-status-${note.id}`}>
                  {stat.label}
                </Badge>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{note.content}</p>

            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
              <Link href={`/workspace/${note.engagementId}/control`}>
                <span className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer" data-testid={`note-engagement-link-${note.id}`}>
                  <FileText className="h-3 w-3" />
                  {note.engagement.client.name} — {note.engagement.engagementCode}
                </span>
              </Link>
              <span>&middot;</span>
              <span>{note.phase.replace(/_/g, " ")}</span>
              {note.dueDate && (
                <>
                  <span>&middot;</span>
                  <span className={cn(
                    new Date(note.dueDate) < new Date() && note.status === "OPEN" ? "text-red-600 font-medium" : ""
                  )}>
                    Due {format(new Date(note.dueDate), "dd MMM yyyy")}
                  </span>
                </>
              )}
              {note.assignees.length > 0 && (
                <>
                  <span>&middot;</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {note.assignees.map((a) => a.user.fullName).join(", ")}
                  </span>
                </>
              )}
            </div>

            {note.resolution && note.status === "CLEARED" && (
              <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                  {note.resolution}
                  {note.resolvedBy && (
                    <span className="text-muted-foreground ml-1">— {note.resolvedBy.fullName}</span>
                  )}
                </p>
              </div>
            )}

            {note.threads.length > 0 && (
              <div className="mt-2 border-t pt-2 space-y-1.5">
                {note.threads.slice(-2).map((t) => (
                  <div key={t.id} className="flex items-start gap-2 text-xs">
                    <Avatar className="h-5 w-5 flex-shrink-0 mt-0.5">
                      <AvatarFallback className="text-[8px] bg-muted">{getInitials(t.author.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="font-medium">{t.author.fullName}</span>
                      <span className="text-muted-foreground ml-1">{t.message}</span>
                    </div>
                  </div>
                ))}
                {note.threads.length > 2 && (
                  <p className="text-[10px] text-muted-foreground pl-7">+{note.threads.length - 2} more replies</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => onReply(note.id)}
                data-testid={`button-reply-note-${note.id}`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Reply ({note.threads.length})
              </Button>

              {note.status === "OPEN" && !note.isLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-amber-600"
                  onClick={() => onStatusChange(note.id, "ADDRESSED")}
                  data-testid={`button-address-note-${note.id}`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Address
                </Button>
              )}

              {note.status === "ADDRESSED" && !note.isLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-green-600"
                  onClick={() => onStatusChange(note.id, "CLEARED")}
                  data-testid={`button-clear-note-${note.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}

              {note.status !== "OPEN" && !note.isLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-red-600"
                  onClick={() => onStatusChange(note.id, "OPEN")}
                  data-testid={`button-reopen-note-${note.id}`}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Reopen
                </Button>
              )}

              <Link href={`/workspace/${note.engagementId}/control`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 ml-auto"
                  data-testid={`button-view-engagement-${note.id}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Engagement
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReviewNotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("assigned");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyNoteId, setReplyNoteId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [resolveNoteId, setResolveNoteId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const isManager = MANAGER_ROLES.includes(user?.role || "");

  const statsQuery = useQuery<Stats>({
    queryKey: ["/api/review-notes-v2/stats/summary"],
  });

  const myNotesQuery = useQuery<ReviewNoteData[]>({
    queryKey: ["/api/review-notes-v2/my"],
    enabled: activeTab === "assigned",
  });

  const createdNotesQuery = useQuery<ReviewNoteData[]>({
    queryKey: ["/api/review-notes-v2/created-by-me"],
    enabled: activeTab === "created",
  });

  const allNotesQuery = useQuery<ReviewNoteData[]>({
    queryKey: ["/api/review-notes-v2/all"],
    enabled: activeTab === "all" && isManager,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ noteId, status, resolution }: { noteId: string; status: string; resolution?: string }) => {
      const res = await apiRequest("PATCH", `/api/review-notes-v2/${noteId}/status`, { status, resolution });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/review-notes-v2/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-notes-v2/created-by-me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-notes-v2/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-notes-v2/stats/summary"] });
      toast({ title: "Note updated" });
      setResolveNoteId(null);
      setResolution("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ noteId, message }: { noteId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/review-notes-v2/${noteId}/messages`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/review-notes-v2/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-notes-v2/created-by-me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-notes-v2/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-notes-v2/stats/summary"] });
      toast({ title: "Reply added" });
      setReplyNoteId(null);
      setReplyMessage("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to reply", variant: "destructive" });
    },
  });

  const currentNotes = useMemo(() => {
    let notes: ReviewNoteData[] = [];
    if (activeTab === "assigned") notes = myNotesQuery.data || [];
    else if (activeTab === "created") notes = createdNotesQuery.data || [];
    else if (activeTab === "all") notes = allNotesQuery.data || [];

    if (statusFilter !== "all") {
      notes = notes.filter((n) => n.status === statusFilter);
    }
    if (severityFilter !== "all") {
      notes = notes.filter((n) => n.severity === severityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      notes = notes.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.engagement.client.name.toLowerCase().includes(q) ||
          n.engagement.engagementCode.toLowerCase().includes(q) ||
          n.author.fullName.toLowerCase().includes(q)
      );
    }
    return notes;
  }, [activeTab, myNotesQuery.data, createdNotesQuery.data, allNotesQuery.data, statusFilter, severityFilter, searchQuery]);

  const isLoading =
    (activeTab === "assigned" && myNotesQuery.isLoading) ||
    (activeTab === "created" && createdNotesQuery.isLoading) ||
    (activeTab === "all" && allNotesQuery.isLoading);

  const handleStatusChange = (noteId: string, status: string, res?: string) => {
    if (status === "CLEARED" && !resolveNoteId) {
      setResolveNoteId(noteId);
      return;
    }
    statusMutation.mutate({ noteId, status, resolution: res });
  };

  const handleReply = (noteId: string) => {
    setReplyNoteId(noteId);
    setReplyMessage("");
  };

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-background" data-testid="review-notes-page">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Review Notes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track and manage review observations across all engagements
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10 border-red-200 dark:border-red-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Assigned Open</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400" data-testid="stat-my-open">{stats?.myOpen ?? "—"}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-400/60" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Assigned Total</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400" data-testid="stat-my-total">{stats?.myTotal ?? "—"}</p>
                </div>
                <ClipboardList className="h-8 w-8 text-blue-400/60" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Created Open</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400" data-testid="stat-created-open">{stats?.createdOpen ?? "—"}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-400/60" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Created Total</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="stat-created-total">{stats?.createdTotal ?? "—"}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList data-testid="tabs-review-notes">
              <TabsTrigger value="assigned" data-testid="tab-assigned">
                Assigned to Me
              </TabsTrigger>
              <TabsTrigger value="created" data-testid="tab-created">
                Created by Me
              </TabsTrigger>
              {isManager && (
                <TabsTrigger value="all" data-testid="tab-all">
                  All Notes
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-48"
                data-testid="input-search-notes"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-32" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="ADDRESSED">Addressed</SelectItem>
                <SelectItem value="CLEARED">Cleared</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-9 w-32" data-testid="select-severity-filter">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : currentNotes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground" data-testid="text-empty-state">No review notes found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab === "assigned"
                  ? "You have no review notes assigned to you."
                  : activeTab === "created"
                  ? "You haven't created any review notes yet."
                  : "No review notes match the current filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground" data-testid="text-note-count">
              {currentNotes.length} note{currentNotes.length !== 1 ? "s" : ""}
            </p>
            {currentNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onStatusChange={handleStatusChange}
                onReply={handleReply}
                userId={user?.id || ""}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!replyNoteId} onOpenChange={(open) => !open && setReplyNoteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reply</DialogTitle>
          </DialogHeader>
          <Textarea
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Type your reply..."
            rows={4}
            data-testid="input-reply-message"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-cancel-reply">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => replyNoteId && replyMutation.mutate({ noteId: replyNoteId, message: replyMessage })}
              disabled={!replyMessage.trim() || replyMutation.isPending}
              data-testid="button-send-reply"
            >
              {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resolveNoteId} onOpenChange={(open) => !open && setResolveNoteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Review Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Provide a resolution note for clearing this review note.</p>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution / justification..."
            rows={4}
            data-testid="input-resolution"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-cancel-clear">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => resolveNoteId && statusMutation.mutate({ noteId: resolveNoteId, status: "CLEARED", resolution })}
              disabled={!resolution.trim() || statusMutation.isPending}
              data-testid="button-confirm-clear"
            >
              {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Clear Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
