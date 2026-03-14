import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { usePageAIContext } from "@/hooks/use-page-ai-context";
import { usePageFormData, type PageFormSnapshot } from "@/hooks/use-page-form-data";
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
  Compass,
  ArrowRight,
  Lightbulb,
  ClipboardList,
  Eye,
  RefreshCw,
} from "lucide-react";

interface AIAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  pageKey: string;
}

interface StandardRef {
  code: string;
  relevance: string;
}

interface PageAnalysis {
  pageSummary?: string;
  guidance?: string[];
  inputSuggestions?: string[];
  missingFields?: string[];
  standardsReferences?: StandardRef[];
  procedures?: string[];
  reviewNotes?: string[];
  nextActions?: string[];
  rawContent?: string;
}

interface PageAssistantResult {
  pageId: string;
  module: string;
  objective: string;
  generated: boolean;
  analysis: PageAnalysis;
  context: {
    totalFields: number;
    filledFields: number;
    completionPercent: number;
    activeTab: string;
    hasConclusion: boolean;
  };
  standards: Array<{ code: string; title: string; summary: string; auditImplication: string }>;
  disclaimer: string;
}

interface SeedResult {
  content: string;
  mode: string;
  generated: boolean;
  disclaimer: string;
}

type DrawerTab = "analysis" | "actions";

const SECTIONS = [
  { key: "pageSummary", label: "Page Summary", icon: Compass, color: "text-blue-600 dark:text-blue-400" },
  { key: "guidance", label: "Guidance", icon: Lightbulb, color: "text-emerald-600 dark:text-emerald-400" },
  { key: "inputSuggestions", label: "Input Suggestions", icon: PenLine, color: "text-violet-600 dark:text-violet-400" },
  { key: "missingFields", label: "Missing Fields", icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400" },
  { key: "standardsReferences", label: "Standards References", icon: BookOpen, color: "text-indigo-600 dark:text-indigo-400" },
  { key: "procedures", label: "Procedures to Perform", icon: ClipboardList, color: "text-teal-600 dark:text-teal-400" },
  { key: "reviewNotes", label: "Review Notes", icon: Eye, color: "text-rose-600 dark:text-rose-400" },
  { key: "nextActions", label: "Next Actions", icon: ArrowRight, color: "text-sky-600 dark:text-sky-400" },
] as const;

const ACTION_CONFIGS = [
  { id: "draft", label: "Seed Conclusion", description: "Draft conclusion from page data", icon: FileText, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/30", featured: true },
  { id: "summary", label: "Draft Summary", description: "Summarize work performed", icon: PenLine, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { id: "missing-fields", label: "Check Missing Fields", description: "Identify gaps", icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
  { id: "review-section", label: "Review This Section", description: "Quality assessment", icon: Shield, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { id: "fill-narratives", label: "Fill Narratives", description: "Generate narrative text", icon: ListChecks, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
];

export function AIAssistantDrawer({ open, onOpenChange, engagementId, pageKey }: AIAssistantDrawerProps) {
  const { pageId, profile, isLoading: contextLoading, hasProfile } = usePageAIContext();
  const { extractFormData } = usePageFormData();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<DrawerTab>("analysis");
  const [analysisResult, setAnalysisResult] = useState<PageAssistantResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["pageSummary", "guidance", "missingFields"]));
  const [actionResult, setActionResult] = useState<SeedResult | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastAnalyzedPage = useRef<string>("");
  const formSnapshotRef = useRef<PageFormSnapshot | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const snapshot = extractFormData();
      formSnapshotRef.current = snapshot;

      const res = await fetchWithAuth("/api/ai/copilot-enhanced/page-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageId || pageKey,
          engagementId,
          formData: {
            totalFields: snapshot.totalFields,
            filledFields: snapshot.filledFields,
            emptyFields: snapshot.emptyFields,
            completionPercent: snapshot.completionPercent,
            fields: snapshot.fields.slice(0, 40),
            narrativeFields: snapshot.narrativeFields.slice(0, 10).map(f => ({
              name: f.name,
              label: f.label,
              value: f.value.substring(0, 300),
              isEmpty: f.isEmpty,
            })),
            selectedOptions: snapshot.selectedOptions.slice(0, 15),
            visibleTabs: snapshot.visibleTabs,
            activeTab: snapshot.activeTab,
            hasConclusion: snapshot.hasConclusion,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Analysis failed" }));
        throw new Error(err.error || "Failed to analyze page");
      }
      return res.json() as Promise<PageAssistantResult>;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      lastAnalyzedPage.current = pageId || pageKey;
    },
    onError: (error: Error) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (open && !contextLoading && (pageId || pageKey)) {
      const currentPage = pageId || pageKey;
      if (lastAnalyzedPage.current !== currentPage || !analysisResult) {
        analyzeMutation.mutate();
      }
    }
  }, [open, contextLoading, pageId, pageKey]);

  const seedMutation = useMutation({
    mutationFn: async (mode: string) => {
      const res = await fetchWithAuth("/api/ai/copilot-enhanced/seed-conclusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: pageId || pageKey, engagementId, mode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Failed to generate content");
      }
      return res.json() as Promise<SeedResult>;
    },
    onSuccess: (data) => setActionResult(data),
    onError: (error: Error) => toast({ title: "Generation Failed", description: error.message, variant: "destructive" }),
  });

  const handleAction = useCallback((mode: string) => {
    setActiveAction(mode);
    setActionResult(null);
    setCopied(false);
    seedMutation.mutate(mode);
  }, [seedMutation]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }).catch(() => {
      toast({ title: "Copy failed", description: "Clipboard access denied", variant: "destructive" });
    });
  }, [toast]);

  const dispatchTextEvent = useCallback((action: "insert" | "replace" | "append") => {
    if (!actionResult?.content) return;
    window.dispatchEvent(new CustomEvent("ai-conclusion-text", {
      detail: { text: actionResult.content, action, pageKey },
    }));
    toast({
      title: action === "insert" ? "Inserted into conclusion" : action === "replace" ? "Replaced conclusion text" : "Appended to conclusion",
    });
  }, [actionResult, pageKey, toast]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const moduleName = profile?.module || pageId || pageKey || "Current Page";
  const ctx = analysisResult?.context;
  const analysis = analysisResult?.analysis;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px] p-0 flex flex-col gap-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b bg-gradient-to-r from-violet-600/5 to-indigo-600/5 shrink-0">
          <div className="flex items-center gap-3 pr-6">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">AI Assistant</SheetTitle>
              <SheetDescription className="text-xs truncate">
                {contextLoading ? "Loading context..." : moduleName}
              </SheetDescription>
            </div>
          </div>
          {ctx && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5 gap-1">
                <Target className="h-2.5 w-2.5" />
                {ctx.totalFields} fields
              </Badge>
              <Badge
                variant={ctx.completionPercent >= 80 ? "default" : ctx.completionPercent >= 50 ? "secondary" : "outline"}
                className={cn("text-[10px] px-1.5 py-0.5 h-5 gap-1",
                  ctx.completionPercent >= 80 && "bg-emerald-600",
                  ctx.completionPercent >= 50 && ctx.completionPercent < 80 && "bg-amber-600 text-white",
                )}
              >
                {ctx.completionPercent}% complete
              </Badge>
              {ctx.activeTab && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5">
                  Tab: {ctx.activeTab}
                </Badge>
              )}
              {analysisResult?.generated && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-5 gap-0.5">
                  <Sparkles className="h-2.5 w-2.5" /> AI
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="flex border-b px-1 py-1 gap-0.5 shrink-0">
          {([
            { key: "analysis" as const, label: "Analysis", icon: Compass },
            { key: "actions" as const, label: "Smart Actions", icon: Sparkles },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {activeTab === "analysis" && (
              <>
                {analyzeMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Analyzing page...</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Reading form data, engagement context, and standards
                      </p>
                    </div>
                  </div>
                ) : analysis ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">
                        {analysisResult?.generated ? "AI-powered analysis" : "Template-based analysis"} for {moduleName}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => analyzeMutation.mutate()}
                        disabled={analyzeMutation.isPending}
                      >
                        <RefreshCw className={cn("h-3 w-3", analyzeMutation.isPending && "animate-spin")} />
                        Refresh
                      </Button>
                    </div>

                    {SECTIONS.map(section => {
                      const data = analysis[section.key as keyof PageAnalysis];
                      if (!data || (Array.isArray(data) && data.length === 0)) return null;

                      const isExpanded = expandedSections.has(section.key);
                      const Icon = section.icon;
                      const isString = typeof data === "string";
                      const items = isString ? null : (data as unknown[]);
                      const itemCount = items?.length || 0;

                      return (
                        <div key={section.key} className="rounded-lg border bg-card overflow-hidden">
                          <button
                            onClick={() => toggleSection(section.key)}
                            className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-3.5 w-3.5", section.color)} />
                              <span className="text-xs font-semibold">{section.label}</span>
                              {itemCount > 0 && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                  {itemCount}
                                </Badge>
                              )}
                            </div>
                            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 border-t">
                              {isString ? (
                                <p className="text-xs text-muted-foreground leading-relaxed pt-2">{data as string}</p>
                              ) : section.key === "standardsReferences" ? (
                                <div className="space-y-1.5 pt-2">
                                  {(data as StandardRef[]).map((s, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono shrink-0 mt-0.5">
                                        {s.code}
                                      </Badge>
                                      <span className="text-muted-foreground leading-relaxed">{s.relevance}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <ul className="space-y-1.5 pt-2">
                                  {(data as string[]).map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs">
                                      <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                                        section.key === "missingFields" ? "bg-amber-500" :
                                        section.key === "reviewNotes" ? "bg-rose-500" :
                                        section.key === "procedures" ? "bg-teal-500" :
                                        "bg-violet-500"
                                      )} />
                                      <span className="text-muted-foreground leading-relaxed">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {analysis.rawContent && !analysis.pageSummary && (
                      <div className="rounded-lg border bg-card p-3">
                        <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">
                          {analysis.rawContent as string}
                        </pre>
                      </div>
                    )}

                    {analysisResult?.standards && analysisResult.standards.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen className="h-3 w-3" />
                            Full Standards Detail ({analysisResult.standards.length})
                          </h4>
                          {analysisResult.standards.map(s => (
                            <div key={s.code} className="rounded-md border bg-card p-2.5 text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">{s.code}</Badge>
                                <span className="font-medium text-[11px]">{s.title}</span>
                              </div>
                              <p className="text-muted-foreground leading-relaxed">{s.summary}</p>
                              {s.auditImplication && (
                                <p className="text-muted-foreground leading-relaxed mt-1 italic text-[10px]">
                                  Implication: {s.auditImplication}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <p className="text-[10px] text-muted-foreground italic text-center pt-1">
                      {analysisResult?.disclaimer}
                    </p>
                  </>
                ) : !analyzeMutation.isPending && (
                  <div className="text-center py-10 text-muted-foreground">
                    <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">Ready to Analyze</p>
                    <p className="text-xs mt-1 mb-3">
                      Click below to scan the current page and get AI guidance
                    </p>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                      onClick={() => analyzeMutation.mutate()}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Analyze This Page
                    </Button>
                  </div>
                )}
              </>
            )}

            {activeTab === "actions" && (
              <>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Smart Actions
                  </h4>
                  {ACTION_CONFIGS.map((action) => {
                    const isActive = activeAction === action.id && seedMutation.isPending;
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

                {actionResult && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Generated Content
                        </h4>
                        {actionResult.generated ? (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">Template</Badge>
                        )}
                      </div>

                      <div className="rounded-lg border bg-muted/30 p-3 max-h-[260px] overflow-y-auto">
                        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                          {actionResult.content}
                        </pre>
                      </div>

                      <p className="text-[10px] text-muted-foreground italic">{actionResult.disclaimer}</p>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 flex-1" onClick={() => handleCopy(actionResult.content)}>
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5 flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                          onClick={() => dispatchTextEvent("insert")}
                        >
                          <Plus className="h-3 w-3" /> Insert
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 flex-1" onClick={() => dispatchTextEvent("replace")}>
                          <Replace className="h-3 w-3" /> Replace
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 flex-1" onClick={() => dispatchTextEvent("append")}>
                          <ClipboardPaste className="h-3 w-3" /> Append
                        </Button>
                      </div>
                    </div>
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
