import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Bot,
  Clock,
  ShieldAlert,
  History,
  ThumbsUp,
  ThumbsDown,
  Edit,
  RefreshCw,
  Eye,
  X,
} from "lucide-react";
import { usePhaseAI } from "@/hooks/use-phase-ai";
import { useAISuggestions, type AISuggestionRecord, type AIAuditLogEntry } from "@/hooks/use-ai-suggestions";
import { useToast } from "@/hooks/use-toast";

interface AIAssistantPanelProps {
  engagementId: string;
  phaseKey: string;
  className?: string;
  onSuggestionApplied?: (capabilityId: string, content: string) => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8)
    return <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px] h-5">High Confidence ({Math.round(confidence * 100)}%)</Badge>;
  if (confidence >= 0.5)
    return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] h-5"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Medium ({Math.round(confidence * 100)}%)</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] h-5"><ShieldAlert className="h-2.5 w-2.5 mr-0.5" />Low ({Math.round(confidence * 100)}%)</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "AI_SUGGESTED":
      return <Badge variant="outline" className="text-[10px] h-5 border-purple-300 text-purple-700"><Sparkles className="h-2.5 w-2.5 mr-0.5" />AI Draft</Badge>;
    case "USER_ACCEPTED":
      return <Badge variant="outline" className="text-[10px] h-5 border-green-300 text-green-700"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Accepted</Badge>;
    case "USER_OVERRIDE":
      return <Badge variant="outline" className="text-[10px] h-5 border-blue-300 text-blue-700"><Edit className="h-2.5 w-2.5 mr-0.5" />User Edited</Badge>;
    case "MANUAL":
      return <Badge variant="outline" className="text-[10px] h-5 border-gray-300 text-gray-700">Rejected</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] h-5">{status}</Badge>;
  }
}

function SuggestionCard({
  suggestion,
  onView,
  onAccept,
  onReject,
}: {
  suggestion: AISuggestionRecord;
  onView: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const displayValue = suggestion.status === "USER_OVERRIDE" ? suggestion.userValue : (suggestion.status === "USER_ACCEPTED" && suggestion.userValue ? suggestion.userValue : suggestion.aiValue);
  const truncated = (displayValue || "").length > 150 ? displayValue!.substring(0, 150) + "..." : displayValue;

  return (
    <div className="border rounded-md p-2.5 space-y-1.5 bg-white dark:bg-gray-950">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
          {suggestion.fieldKey.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <StatusBadge status={suggestion.status} />
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
      </div>

      {suggestion.confidence < 0.6 && (
        <div className="flex items-start gap-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Low confidence — additional context or professional review recommended before accepting.</span>
        </div>
      )}

      {truncated && (
        <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded font-mono leading-relaxed">
          {truncated}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Clock className="h-2.5 w-2.5" />
          {new Date(suggestion.generatedAt).toLocaleString()}
          {suggestion.generatedBy && <span>by {suggestion.generatedBy}</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={onView}>
            <Eye className="h-3 w-3 mr-0.5" />View
          </Button>
          {suggestion.status === "AI_SUGGESTED" && (
            <>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-green-700 hover:bg-green-50" onClick={onAccept}>
                <ThumbsUp className="h-3 w-3 mr-0.5" />Accept
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-red-700 hover:bg-red-50" onClick={onReject}>
                <ThumbsDown className="h-3 w-3 mr-0.5" />Reject
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditLogSection({ entries }: { entries: AIAuditLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7 text-gray-500">
          <span className="flex items-center gap-1"><History className="h-3 w-3" />AI Audit Trail ({entries.length})</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-[10px] text-gray-500 px-2 py-1 border-l-2 border-gray-200">
              <span className="font-medium">{entry.action.replace(/_/g, " ")}</span>
              <span className="truncate">{entry.fieldKey.replace(/-/g, " ")}</span>
              <span className="ml-auto flex-shrink-0">{entry.userName} · {new Date(entry.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AIAssistantPanel({
  engagementId,
  phaseKey,
  className = "",
  onSuggestionApplied,
}: AIAssistantPanelProps) {
  const { capabilities, isLoading: capsLoading, generate, generateAsync, isGenerating, generationResult, generationError } = usePhaseAI(phaseKey);
  const { suggestions, auditLog, isLoading: sugLoading, accept, reject, isAccepting, isRejecting, refetch } = useAISuggestions(phaseKey);
  const { toast } = useToast();

  const [isExpanded, setIsExpanded] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeCapability, setActiveCapability] = useState<string | null>(null);
  const [viewingSuggestion, setViewingSuggestion] = useState<AISuggestionRecord | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [generatingCapId, setGeneratingCapId] = useState<string | null>(null);
  const [dialogContent, setDialogContent] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);

  const activeSuggestions = useMemo(() =>
    suggestions.filter(s => s.status !== "MANUAL"),
    [suggestions]
  );

  const pendingCount = useMemo(() =>
    suggestions.filter(s => s.status === "AI_SUGGESTED").length,
    [suggestions]
  );

  const handleGenerate = async (capabilityId: string) => {
    setGeneratingCapId(capabilityId);
    setActiveCapability(capabilityId);
    setDialogOpen(true);
    setDialogLoading(true);
    setDialogContent("");
    setEditedContent("");
    setConfirmed(false);

    try {
      const result = await generateAsync({ capabilityId });
      setDialogContent(result.content || "");
      setEditedContent(result.content || "");
    } catch (err: any) {
      toast({
        title: "AI Generation Failed",
        description: err.message || "Failed to generate content",
        variant: "destructive",
      });
      setDialogOpen(false);
    } finally {
      setDialogLoading(false);
      setGeneratingCapId(null);
    }
  };

  const handleViewSuggestion = (suggestion: AISuggestionRecord) => {
    setViewingSuggestion(suggestion);
    const content = suggestion.status === "USER_OVERRIDE" ? suggestion.userValue : suggestion.aiValue;
    setDialogContent(content || "");
    setEditedContent(content || "");
    setActiveCapability(suggestion.fieldKey);
    setConfirmed(false);
    setDialogOpen(true);
    setDialogLoading(false);
  };

  const handleAcceptFromDialog = async () => {
    if (!confirmed || !activeCapability) return;
    try {
      await accept({
        fieldKey: activeCapability,
        userValue: editedContent !== dialogContent ? editedContent : undefined,
        overrideReason: editedContent !== dialogContent ? "Edited by user before acceptance" : undefined,
      });
      if (onSuggestionApplied) {
        onSuggestionApplied(activeCapability, editedContent);
      }
      toast({ title: "Suggestion Applied", description: "AI content has been accepted with your professional review." });
      setDialogOpen(false);
      setViewingSuggestion(null);
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to save acceptance", variant: "destructive" });
    }
  };

  const handleRejectFromDialog = async () => {
    if (!activeCapability) return;
    try {
      await reject({ fieldKey: activeCapability });
      toast({ title: "Suggestion Rejected", description: "AI suggestion has been rejected." });
      setDialogOpen(false);
      setViewingSuggestion(null);
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to reject suggestion", variant: "destructive" });
    }
  };

  const handleAcceptCard = (s: AISuggestionRecord) => {
    handleViewSuggestion(s);
  };

  const handleRejectCard = (s: AISuggestionRecord) => {
    reject({ fieldKey: s.fieldKey });
    toast({ title: "Rejected", description: `Suggestion for "${s.fieldKey.replace(/-/g, " ")}" rejected.` });
  };

  if (capsLoading || capabilities.length === 0) return null;

  return (
    <>
      <Card className={`border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 ${className}`}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                  AI Assistant
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  {capabilities.length} capabilities
                </Badge>
                {pendingCount > 0 && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-800 border-amber-300">
                    {pendingCount} pending review
                  </Badge>
                )}
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-100">
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="px-3 pb-3 pt-0 space-y-3">
              <div>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1.5 uppercase tracking-wide">Generate</p>
                <div className="flex flex-wrap gap-1.5">
                  {capabilities.map((cap) => (
                    <Button
                      key={cap.id}
                      variant="outline"
                      size="sm"
                      className="gap-1 bg-white hover:bg-purple-50 border-purple-200 text-purple-700 hover:text-purple-800 h-7 text-[11px]"
                      onClick={() => handleGenerate(cap.id)}
                      disabled={generatingCapId === cap.id}
                    >
                      {generatingCapId === cap.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {cap.label}
                    </Button>
                  ))}
                </div>
              </div>

              {activeSuggestions.length > 0 && (
                <div>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1.5 uppercase tracking-wide">
                    Stored Suggestions ({activeSuggestions.length})
                  </p>
                  <ScrollArea className={activeSuggestions.length > 3 ? "h-[240px]" : ""}>
                    <div className="space-y-2">
                      {activeSuggestions.map((s) => (
                        <SuggestionCard
                          key={s.id}
                          suggestion={s}
                          onView={() => handleViewSuggestion(s)}
                          onAccept={() => handleAcceptCard(s)}
                          onReject={() => handleRejectCard(s)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <AuditLogSection entries={auditLog} />

              <p className="text-[10px] text-purple-500 flex items-center gap-1 pt-1 border-t border-purple-100">
                <ShieldAlert className="h-2.5 w-2.5" />
                AI outputs require professional judgment. All interactions are logged for audit trail.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setViewingSuggestion(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {activeCapability
                ? capabilities.find(c => c.id === activeCapability)?.label
                  || activeCapability.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
                : "AI Assistant"}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {capabilities.find(c => c.id === activeCapability)?.description || "Review the AI-generated content below."}
              {capabilities.find(c => c.id === activeCapability)?.isaReference && (
                <Badge variant="outline" className="text-[10px]">
                  {capabilities.find(c => c.id === activeCapability)?.isaReference}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialogLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <span className="text-sm text-muted-foreground">Generating AI content using engagement context...</span>
                <p className="text-[10px] text-muted-foreground max-w-md text-center">
                  Content is generated using your engagement data, industry context, and applicable standards.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded-md">
                  <Bot className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <span className="text-xs text-purple-800 font-medium">AI-Generated Draft</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">Subject to Professional Judgment</Badge>
                </div>

                {viewingSuggestion && viewingSuggestion.confidence < 0.6 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-800">Low Confidence Warning</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        This suggestion has {Math.round((viewingSuggestion.confidence) * 100)}% confidence.
                        Some context may be missing or incomplete. Review carefully before accepting.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Content</Label>
                    {viewingSuggestion && (
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={viewingSuggestion.status} />
                        <ConfidenceBadge confidence={viewingSuggestion.confidence} />
                      </div>
                    )}
                  </div>
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={14}
                    className="font-mono text-sm"
                    placeholder="AI-generated content will appear here..."
                  />
                  <p className="text-[10px] text-muted-foreground">
                    You may modify, replace, or completely rewrite this content. Edits are tracked in the audit trail.
                  </p>
                </div>

                {viewingSuggestion?.rationale && (
                  <div className="p-2 bg-gray-50 border rounded-md">
                    <p className="text-[10px] text-gray-500 font-medium mb-0.5">AI Rationale</p>
                    <p className="text-xs text-gray-600">{viewingSuggestion.rationale}</p>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Checkbox
                    id="confirm-ai-judgment"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked === true)}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label htmlFor="confirm-ai-judgment" className="text-amber-800 font-medium cursor-pointer text-sm">
                      Professional Judgment Confirmation
                    </Label>
                    <p className="text-xs text-amber-700">
                      I confirm this content has been reviewed and reflects my professional judgment.
                      AI-generated content will never silently finalize any audit conclusion.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); setViewingSuggestion(null); }}>
              <X className="h-3.5 w-3.5 mr-1" />Cancel
            </Button>
            {!dialogLoading && activeCapability && (
              <Button variant="outline" size="sm" onClick={() => handleGenerate(activeCapability)} disabled={dialogLoading}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Regenerate
              </Button>
            )}
            {!dialogLoading && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 hover:bg-red-50"
                onClick={handleRejectFromDialog}
                disabled={isRejecting}
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1" />Reject
              </Button>
            )}
            {!dialogLoading && (
              <Button
                size="sm"
                onClick={handleAcceptFromDialog}
                disabled={!confirmed || isAccepting || !editedContent}
                className="bg-green-700 hover:bg-green-800"
              >
                {isAccepting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Accept & Apply
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
