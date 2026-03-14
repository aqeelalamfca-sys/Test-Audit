import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  Info,
  AlertCircle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  X,
  Sparkles,
  BookOpen,
  Target,
  ArrowRight,
  FileText,
  Loader2,
  Copy,
  Check,
  Shield,
  Compass,
  ClipboardList,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";
import { usePageAIContext } from "@/hooks/use-page-ai-context";
import { useToast } from "@/hooks/use-toast";

type TabKey = "overview" | "standards" | "suggestions" | "review" | "next";

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", badge: "outline" as const },
  info: { icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", badge: "secondary" as const },
  suggestion: { icon: Lightbulb, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30", badge: "secondary" as const },
};

interface EnhancedCopilotProps {
  engagementId?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AICopilotEnhanced({ engagementId, collapsed = false, onToggleCollapse }: EnhancedCopilotProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { pageId, profile, standards, engagementSnapshot, isLoading, hasProfile } = usePageAIContext();
  const { toast } = useToast();

  const draftMutation = useMutation({
    mutationFn: async ({ templateId }: { templateId: string }) => {
      if (!pageId || !engagementId) throw new Error("Missing context");
      const res = await fetchWithAuth("/api/ai/copilot-enhanced/section-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, engagementId, templateId }),
      });
      if (!res.ok) throw new Error("Failed to generate draft");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Draft Generated", description: `${data.templateLabel} has been generated. Copy it to use in your form.` });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate the draft. Please check your AI settings.", variant: "destructive" });
    },
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (collapsed) {
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <Button
          size="icon"
          variant="default"
          className="h-12 w-12 rounded-full shadow-lg bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          onClick={onToggleCollapse}
        >
          <Sparkles className="h-5 w-5 text-white" />
          {hasProfile && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
          )}
        </Button>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "overview", label: "Overview", icon: Compass },
    { key: "standards", label: "Standards", icon: BookOpen, count: standards.length },
    { key: "suggestions", label: "AI Actions", icon: Sparkles, count: profile?.suggestionTemplates?.length || 0 },
    { key: "review", label: "Review", icon: Shield, count: profile?.reviewRules?.length || 0 },
    { key: "next", label: "Next Steps", icon: ArrowRight, count: profile?.nextStepGuidance?.length || 0 },
  ];

  return (
    <div className="w-[380px] border-l bg-background flex flex-col shrink-0 h-full overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-600/10 to-indigo-600/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Audit Copilot</h3>
            {profile && (
              <p className="text-[10px] text-muted-foreground">{profile.module} — {pageId}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex border-b px-1 py-1 gap-0.5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
              activeTab === tab.key
                ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-0.5 px-1 py-0 rounded-full bg-violet-200 dark:bg-violet-800 text-[9px]">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : !hasProfile ? (
            <div className="text-center py-8 text-muted-foreground">
              <Compass className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No AI Profile Available</p>
              <p className="text-xs mt-1">Navigate to an audit workspace page to see page-specific AI guidance.</p>
            </div>
          ) : (
            <>
              {activeTab === "overview" && <OverviewTab profile={profile!} engagementSnapshot={engagementSnapshot} />}
              {activeTab === "standards" && <StandardsTab standards={standards} onCopy={handleCopy} copiedId={copiedId} />}
              {activeTab === "suggestions" && (
                <SuggestionsTab
                  profile={profile!}
                  engagementId={engagementId}
                  onGenerate={(templateId) => draftMutation.mutate({ templateId })}
                  isGenerating={draftMutation.isPending}
                  generatedContent={draftMutation.data?.content}
                  generatedTemplateId={draftMutation.variables?.templateId}
                  onCopy={handleCopy}
                  copiedId={copiedId}
                />
              )}
              {activeTab === "review" && <ReviewTab profile={profile!} />}
              {activeTab === "next" && <NextStepsTab profile={profile!} />}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t bg-muted/30">
        <p className="text-[9px] text-muted-foreground text-center">AI-assisted — subject to professional judgment</p>
      </div>
    </div>
  );
}

function OverviewTab({ profile, engagementSnapshot }: { profile: NonNullable<ReturnType<typeof usePageAIContext>["profile"]>; engagementSnapshot: Record<string, unknown> | null }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-violet-500" />
            Page Objective
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{profile.objective}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            Expected Outputs
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <ul className="space-y-1">
            {profile.expectedOutputs.map((output, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-blue-500 mt-0.5">•</span>
                {output}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {profile.requiredEvidence.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
              Required Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <ul className="space-y-1">
              {profile.requiredEvidence.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {engagementSnapshot && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-semibold">Engagement Context</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {(engagementSnapshot as any).client?.name && (
                <div>
                  <span className="text-muted-foreground">Client:</span>
                  <p className="font-medium">{(engagementSnapshot as any).client.name}</p>
                </div>
              )}
              {(engagementSnapshot as any).phase && (
                <div>
                  <span className="text-muted-foreground">Phase:</span>
                  <p className="font-medium">{(engagementSnapshot as any).phase}</p>
                </div>
              )}
              {(engagementSnapshot as any).materiality?.overallMateriality && (
                <div>
                  <span className="text-muted-foreground">Materiality:</span>
                  <p className="font-medium">{Number((engagementSnapshot as any).materiality.overallMateriality).toLocaleString()}</p>
                </div>
              )}
              {(engagementSnapshot as any).riskCount !== undefined && (
                <div>
                  <span className="text-muted-foreground">Risks:</span>
                  <p className="font-medium">{(engagementSnapshot as any).riskCount}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {profile.commonMistakes.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Common Pitfalls ({profile.commonMistakes.length})
            <ChevronRight className="h-3 w-3 ml-auto" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1.5">
              {profile.commonMistakes.map((mistake, i) => (
                <div key={i} className="text-[11px] text-muted-foreground bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1.5 border border-amber-200/50 dark:border-amber-800/30">
                  {mistake}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function StandardsTab({ standards, onCopy, copiedId }: {
  standards: Array<{ code: string; title: string; summary: string; auditImplication: string; category: string; keyParagraphs: Array<{ ref: string; text: string }> }>;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}) {
  const [expandedStd, setExpandedStd] = useState<Set<string>>(new Set());

  if (standards.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No standards mapped for this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {standards.map(std => {
        const isExpanded = expandedStd.has(std.code);
        return (
          <Card key={std.code} className="overflow-hidden">
            <button
              className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-muted/50"
              onClick={() => {
                setExpandedStd(prev => {
                  const next = new Set(prev);
                  if (next.has(std.code)) next.delete(std.code);
                  else next.add(std.code);
                  return next;
                });
              }}
            >
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{std.code}</Badge>
              <span className="text-xs font-medium flex-1 truncate">{std.title}</span>
              {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
            </button>
            {isExpanded && (
              <CardContent className="px-3 pb-3 pt-0 space-y-2">
                <p className="text-[11px] text-muted-foreground">{std.summary}</p>
                <Separator />
                <div>
                  <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 mb-1">Audit Implication</p>
                  <p className="text-[11px] text-muted-foreground">{std.auditImplication}</p>
                </div>
                {std.keyParagraphs.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-semibold mb-1">Key Paragraphs</p>
                      {std.keyParagraphs.map((p, i) => (
                        <div key={i} className="text-[11px] mb-1.5 flex gap-1">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0 h-4">{p.ref}</Badge>
                          <span className="text-muted-foreground">{p.text}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] w-full"
                  onClick={() => onCopy(`${std.code}: ${std.auditImplication}`, std.code)}
                >
                  {copiedId === std.code ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copiedId === std.code ? "Copied" : "Copy Reference"}
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function SuggestionsTab({
  profile,
  engagementId,
  onGenerate,
  isGenerating,
  generatedContent,
  generatedTemplateId,
  onCopy,
  copiedId,
}: {
  profile: NonNullable<ReturnType<typeof usePageAIContext>["profile"]>;
  engagementId?: string;
  onGenerate: (templateId: string) => void;
  isGenerating: boolean;
  generatedContent?: string;
  generatedTemplateId?: string;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}) {
  if (!profile.suggestionTemplates || profile.suggestionTemplates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No AI actions available for this page.</p>
        <p className="text-xs mt-1">AI actions are available on pages with narrative fields and drafting requirements.</p>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    fill_field: "Fill Field",
    draft_narrative: "Draft Narrative",
    review_section: "Review",
    generate_conclusion: "Generate Conclusion",
    suggest_evidence: "Suggest Evidence",
  };

  return (
    <div className="space-y-2">
      {profile.suggestionTemplates.map(template => (
        <Card key={template.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">{template.label}</p>
                <Badge variant="secondary" className="text-[9px] mt-0.5">{typeLabels[template.type] || template.type}</Badge>
              </div>
              <Button
                size="sm"
                className="h-7 text-[11px] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                onClick={() => onGenerate(template.id)}
                disabled={isGenerating || !engagementId}
              >
                {isGenerating && generatedTemplateId === template.id ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Generate
              </Button>
            </div>
            {generatedContent && generatedTemplateId === template.id && (
              <div className="mt-2 p-2 bg-violet-50 dark:bg-violet-950/20 rounded border border-violet-200 dark:border-violet-800/30">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">Generated Draft</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[9px] px-1.5"
                    onClick={() => onCopy(generatedContent, template.id)}
                  >
                    {copiedId === template.id ? <Check className="h-2.5 w-2.5 mr-0.5" /> : <Copy className="h-2.5 w-2.5 mr-0.5" />}
                    {copiedId === template.id ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">{generatedContent}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReviewTab({ profile }: { profile: NonNullable<ReturnType<typeof usePageAIContext>["profile"]> }) {
  if (!profile.reviewRules || profile.reviewRules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No review rules configured for this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="destructive" className="text-[10px]">
          {profile.reviewRules.filter(r => r.severity === "critical").length} Critical
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {profile.reviewRules.filter(r => r.severity === "warning").length} Warning
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {profile.reviewRules.filter(r => r.severity === "info").length} Info
        </Badge>
      </div>
      {profile.reviewRules.map(rule => {
        const config = severityConfig[rule.severity] || severityConfig.info;
        const Icon = config.icon;
        return (
          <div key={rule.id} className={cn("rounded-lg p-2.5 border", config.bg)}>
            <div className="flex items-start gap-2">
              <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", config.color)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{rule.message}</p>
                {rule.standardRef && (
                  <Badge variant="outline" className="text-[9px] mt-1 px-1.5 py-0">{rule.standardRef}</Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NextStepsTab({ profile }: { profile: NonNullable<ReturnType<typeof usePageAIContext>["profile"]> }) {
  if (!profile.nextStepGuidance || profile.nextStepGuidance.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ArrowRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No next step guidance available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profile.nextStepGuidance.map((step, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 border">
          <div className="h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">{i + 1}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
        </div>
      ))}
    </div>
  );
}
