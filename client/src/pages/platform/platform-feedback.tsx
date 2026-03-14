import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Building2, AlertTriangle, CheckCircle2, Clock, ArrowLeft,
  Filter, RefreshCw, ChevronDown, ChevronRight, AlertCircle, Info
} from "lucide-react";
import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FeedbackItem {
  id: string;
  firmId: string;
  moduleKey: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  firm: { id: string; name: string; displayName: string | null; logoUrl: string | null };
  createdBy: { id: string; fullName: string; role: string; email: string };
}

interface FeedbackResponse {
  items: FeedbackItem[];
  total: number;
  page: number;
  totalPages: number;
  stats: Record<string, number>;
}

interface FirmWithFeedback {
  id: string;
  name: string;
  displayName: string | null;
  logoUrl: string | null;
  feedbacks: Array<{
    id: string;
    moduleKey: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    createdBy: { fullName: string; role: string };
  }>;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-red-500 text-red-600 dark:text-red-400",
  high: "border-orange-500 text-orange-600 dark:text-orange-400",
  medium: "border-yellow-500 text-yellow-600 dark:text-yellow-400",
  low: "border-gray-400 text-gray-500 dark:text-gray-400",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  open: { label: "Open", variant: "destructive", icon: AlertCircle },
  in_review: { label: "In Review", variant: "secondary", icon: Clock },
  acknowledged: { label: "Acknowledged", variant: "outline", icon: Info },
  resolved: { label: "Resolved", variant: "default", icon: CheckCircle2 },
  fixed: { label: "Fixed", variant: "default", icon: CheckCircle2 },
};

const POLL_INTERVAL = 15000;

export default function PlatformFeedback() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeView, setActiveView] = useState("all");
  const [expandedFirms, setExpandedFirms] = useState<Set<string>>(new Set());

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (priorityFilter !== "all") queryParams.set("priority", priorityFilter);

  const { data: feedbackData, isLoading } = useQuery<FeedbackResponse>({
    queryKey: ["/api/platform/feedback", statusFilter, priorityFilter],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/platform/feedback?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL,
  });

  const { data: firmFeedback = [], isLoading: firmLoading } = useQuery<FirmWithFeedback[]>({
    queryKey: ["/api/platform/feedback/by-firm"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/platform/feedback/by-firm");
      if (!res.ok) throw new Error("Failed to fetch feedback by firm");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetchWithAuth(`/api/platform/feedback/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/feedback/by-firm"] });
      toast({ title: "Status updated", description: "Feedback status has been updated." });
    },
  });

  const toggleFirm = (firmId: string) => {
    setExpandedFirms(prev => {
      const next = new Set(prev);
      if (next.has(firmId)) next.delete(firmId); else next.add(firmId);
      return next;
    });
  };

  const stats = feedbackData?.stats || {};
  const totalOpen = (stats.open || 0);
  const totalInReview = (stats.in_review || 0);
  const totalResolved = (stats.resolved || 0) + (stats.fixed || 0);
  const totalAcknowledged = (stats.acknowledged || 0);

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;
    return (
      <Badge variant={config.variant} className="text-[10px] gap-0.5" data-testid={`badge-status-${status}`}>
        <config.icon className="h-2.5 w-2.5" />
        {config.label}
      </Badge>
    );
  };

  const renderPriorityBadge = (priority: string) => (
    <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );

  const renderFeedbackCard = (item: FeedbackItem | FirmWithFeedback["feedbacks"][0], showFirm = false) => {
    const feedbackItem = item as any;
    return (
      <Card key={feedbackItem.id} data-testid={`feedback-card-${feedbackItem.id}`} className="border-l-2 border-l-transparent hover:border-l-primary/40 transition-colors">
        <CardContent className="py-3 px-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {showFirm && feedbackItem.firm && (
                  <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <Building2 className="h-2.5 w-2.5 mr-0.5" />
                    {feedbackItem.firm.displayName || feedbackItem.firm.name}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">{feedbackItem.moduleKey}</Badge>
                {renderStatusBadge(feedbackItem.status)}
                {renderPriorityBadge(feedbackItem.priority)}
              </div>
              <p className="text-sm font-medium" data-testid={`feedback-title-${feedbackItem.id}`}>{feedbackItem.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{feedbackItem.description}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                By: {feedbackItem.createdBy?.fullName || "Unknown"} ({feedbackItem.createdBy?.role || ""}) · {new Date(feedbackItem.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <Select
              value={feedbackItem.status}
              onValueChange={status => updateStatusMutation.mutate({ id: feedbackItem.id, status })}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs" data-testid={`select-feedback-status-${feedbackItem.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-2.5 space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/platform">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-platform">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" data-testid="heading-platform-feedback">
              <MessageSquare className="h-5 w-5 text-primary" />
              Firm Feedback & Issues
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time issues, gaps, and feedback reported by firms · Auto-refreshes every 15s
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/platform/feedback"] });
            queryClient.invalidateQueries({ queryKey: ["/api/platform/feedback/by-firm"] });
          }}
          data-testid="button-refresh-feedback"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-3 text-center">
            <div className="text-lg font-bold text-red-600" data-testid="stat-open">{totalOpen}</div>
            <p className="text-xs text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-3 text-center">
            <div className="text-lg font-bold text-yellow-600" data-testid="stat-in-review">{totalInReview}</div>
            <p className="text-xs text-muted-foreground">In Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-3 text-center">
            <div className="text-lg font-bold text-blue-600" data-testid="stat-acknowledged">{totalAcknowledged}</div>
            <p className="text-xs text-muted-foreground">Acknowledged</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-3 text-center">
            <div className="text-lg font-bold text-green-600" data-testid="stat-resolved">{totalResolved}</div>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeView} onValueChange={setActiveView}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="all" className="gap-1" data-testid="tab-all-feedback">
              <MessageSquare className="h-3.5 w-3.5" />
              All Feedback
              {feedbackData?.total ? (
                <Badge variant="secondary" className="ml-1 text-[10px]">{feedbackData.total}</Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="by-firm" className="gap-1" data-testid="tab-by-firm">
              <Building2 className="h-3.5 w-3.5" />
              By Firm
              {firmFeedback.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{firmFeedback.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeView === "all" && (
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="filter-priority">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="all" className="mt-2.5 space-y-2">
          {isLoading ? (
            <Card>
              <CardContent className="py-2 text-center">
                <RefreshCw className="h-6 w-6 mx-auto animate-spin text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Loading feedback...</p>
              </CardContent>
            </Card>
          ) : !feedbackData?.items?.length ? (
            <Card>
              <CardContent className="py-2 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm font-medium">No feedback items</p>
                <p className="text-xs text-muted-foreground">No issues or gaps have been reported by any firm yet.</p>
              </CardContent>
            </Card>
          ) : (
            feedbackData.items.map(item => renderFeedbackCard(item, true))
          )}
        </TabsContent>

        <TabsContent value="by-firm" className="mt-2.5 space-y-3">
          {firmLoading ? (
            <Card>
              <CardContent className="py-2 text-center">
                <RefreshCw className="h-6 w-6 mx-auto animate-spin text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Loading firm feedback...</p>
              </CardContent>
            </Card>
          ) : firmFeedback.length === 0 ? (
            <Card>
              <CardContent className="py-2 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm font-medium">No firm feedback</p>
                <p className="text-xs text-muted-foreground">No firms have reported any issues yet.</p>
              </CardContent>
            </Card>
          ) : (
            firmFeedback.map(firm => {
              const openCount = firm.feedbacks.filter(f => f.status === "open").length;
              const isExpanded = expandedFirms.has(firm.id);
              return (
                <Collapsible key={firm.id} open={isExpanded} onOpenChange={() => toggleFirm(firm.id)}>
                  <Card data-testid={`firm-feedback-card-${firm.id}`}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {firm.logoUrl ? (
                              <img src={firm.logoUrl} alt="" className="h-8 w-auto max-w-[60px] object-contain rounded" />
                            ) : (
                              <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            <div>
                              <CardTitle className="text-sm">{firm.displayName || firm.name}</CardTitle>
                              <CardDescription className="text-[10px]">
                                {firm.feedbacks.length} item{firm.feedbacks.length !== 1 ? "s" : ""}
                                {openCount > 0 && <span className="text-red-500 ml-1">({openCount} open)</span>}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {openCount > 0 && (
                              <Badge variant="destructive" className="text-[10px]">{openCount} Open</Badge>
                            )}
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div className="p-3 space-y-2">
                        {firm.feedbacks.map(fb => (
                          <div key={fb.id} className="border rounded-md p-3" data-testid={`firm-fb-item-${fb.id}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                  <Badge variant="outline" className="text-[10px]">{fb.moduleKey}</Badge>
                                  {renderStatusBadge(fb.status)}
                                  {renderPriorityBadge(fb.priority)}
                                </div>
                                <p className="text-sm font-medium">{fb.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{fb.description}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  By: {fb.createdBy?.fullName || "Unknown"} · {new Date(fb.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                </p>
                              </div>
                              <Select
                                value={fb.status}
                                onValueChange={status => updateStatusMutation.mutate({ id: fb.id, status })}
                              >
                                <SelectTrigger className="w-[130px] h-8 text-xs" data-testid={`select-firm-fb-status-${fb.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="in_review">In Review</SelectItem>
                                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                                  <SelectItem value="resolved">Resolved</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
