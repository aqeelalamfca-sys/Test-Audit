import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { usePageAIContext } from "@/hooks/use-page-ai-context";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  FileText,
  AlertTriangle,
  Scale,
  Shield,
  PenLine,
  Loader2,
  Copy,
  Check,
  Plus,
  Replace,
  ClipboardPaste,
  ChevronDown,
  BookOpen,
  Target,
  ListChecks,
  Bot,
} from "lucide-react";

interface AIAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  pageKey: string;
}

interface SeedResult {
  content: string;
  mode: string;
  pageId: string;
  generated: boolean;
  module: string;
  disclaimer: string;
}

const ACTION_CONFIGS = [
  {
    id: "draft",
    label: "Seed Conclusion",
    description: "Draft professional conclusion from page data",
    icon: FileText,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    featured: true,
  },
  {
    id: "summary",
    label: "Draft Summary",
    description: "Summarize work performed on this page",
    icon: PenLine,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    id: "missing-fields",
    label: "Check Missing Fields",
    description: "Identify incomplete areas and gaps",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    id: "review-section",
    label: "Review This Section",
    description: "Reviewer-level quality assessment",
    icon: Shield,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    id: "fill-narratives",
    label: "Fill Empty Narratives",
    description: "Generate text for blank narrative fields",
    icon: ListChecks,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
  },
];

export function AIAssistantDrawer({ open, onOpenChange, engagementId, pageKey }: AIAssistantDrawerProps) {
  const { pageId, profile, standards, isLoading: contextLoading, hasProfile } = usePageAIContext();
  const { toast } = useToast();
  const [activeResult, setActiveResult] = useState<SeedResult | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showStandards, setShowStandards] = useState(false);

  const seedMutation = useMutation({
    mutationFn: async (mode: string) => {
      const res = await fetchWithAuth("/api/ai/copilot-enhanced/seed-conclusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageId || pageKey,
          engagementId,
          mode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Failed to generate content");
      }
      return res.json() as Promise<SeedResult>;
    },
    onSuccess: (data) => {
      setActiveResult(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = useCallback((mode: string) => {
    setActiveMode(mode);
    setActiveResult(null);
    setCopied(false);
    seedMutation.mutate(mode);
  }, [seedMutation]);

  const handleCopy = useCallback(() => {
    if (activeResult?.content) {
      navigator.clipboard.writeText(activeResult.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }
  }, [activeResult, toast]);

  const dispatchTextEvent = useCallback((action: "insert" | "replace" | "append") => {
    if (!activeResult?.content) return;
    window.dispatchEvent(new CustomEvent("ai-conclusion-text", {
      detail: { text: activeResult.content, action, pageKey },
    }));
    toast({
      title: action === "insert" ? "Inserted into conclusion" : action === "replace" ? "Replaced conclusion text" : "Appended to conclusion",
    });
  }, [activeResult, pageKey, toast]);

  const moduleName = profile?.module || pageId || pageKey || "Current Page";
  const pageObjective = profile?.objective || "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-[420px] p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b bg-gradient-to-r from-violet-600/5 to-indigo-600/5 shrink-0">
          <div className="flex items-center gap-3 pr-6">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base">AI Assistant</SheetTitle>
              <SheetDescription className="text-xs truncate">
                {contextLoading ? "Loading context..." : moduleName}
              </SheetDescription>
            </div>
          </div>
          {pageObjective && (
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5 line-clamp-2">
              {pageObjective}
            </p>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {contextLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    AI Actions
                  </h4>
                  {ACTION_CONFIGS.map((action) => {
                    const isActive = activeMode === action.id && seedMutation.isPending;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleAction(action.id)}
                        disabled={seedMutation.isPending}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                          "hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm",
                          action.featured && "border-violet-200 dark:border-violet-800",
                          isActive && "border-violet-400 dark:border-violet-600 bg-violet-50/50 dark:bg-violet-950/20",
                          !action.featured && "border-border",
                          seedMutation.isPending && !isActive && "opacity-60",
                        )}
                      >
                        <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5", action.bg)}>
                          {isActive ? (
                            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                          ) : (
                            <action.icon className={cn("h-4 w-4", action.color)} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{action.label}</span>
                            {action.featured && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">
                                Universal
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{action.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {activeResult && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Generated Content
                        </h4>
                        <div className="flex items-center gap-1">
                          {activeResult.generated ? (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI Generated
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                              Template
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="relative rounded-lg border bg-muted/30 p-3 max-h-[280px] overflow-y-auto">
                        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                          {activeResult.content}
                        </pre>
                      </div>

                      <p className="text-[10px] text-muted-foreground italic">
                        {activeResult.disclaimer}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 flex-1"
                          onClick={handleCopy}
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5 flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                          onClick={() => dispatchTextEvent("insert")}
                        >
                          <Plus className="h-3 w-3" />
                          Insert
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 flex-1"
                          onClick={() => dispatchTextEvent("replace")}
                        >
                          <Replace className="h-3 w-3" />
                          Replace
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 flex-1"
                          onClick={() => dispatchTextEvent("append")}
                        >
                          <ClipboardPaste className="h-3 w-3" />
                          Append
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {standards.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowStandards(!showStandards)}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen className="h-3 w-3" />
                          Applicable Standards ({standards.length})
                        </h4>
                        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", showStandards && "rotate-180")} />
                      </button>
                      {showStandards && (
                        <div className="space-y-1.5">
                          {standards.map((s) => (
                            <div key={s.code} className="rounded-md border bg-card p-2.5 text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">{s.code}</Badge>
                                <span className="font-medium text-[11px]">{s.title}</span>
                              </div>
                              <p className="text-muted-foreground leading-relaxed">{s.summary}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {profile?.suggestionTemplates && profile.suggestionTemplates.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="h-3 w-3" />
                        Page-Specific Templates
                      </h4>
                      {profile.suggestionTemplates.map((t) => (
                        <div key={t.id} className="rounded-md border bg-card p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{t.label}</span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                              {t.type.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          {t.targetField && (
                            <p className="text-muted-foreground mt-0.5">Target: {t.targetField}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!hasProfile && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">AI Assistant Ready</p>
                    <p className="text-xs mt-1">
                      Use the actions above to generate content for this page.
                      Context detection improves with more engagement data.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
