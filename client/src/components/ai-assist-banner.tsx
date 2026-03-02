import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Lightbulb,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Edit,
  Bot,
} from "lucide-react";
import { useAI } from "@/lib/ai-context";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";

export interface AIAction {
  id: string;
  label: string;
  description: string;
  promptType: string;
  icon?: React.ReactNode;
  variant?: "default" | "outline" | "secondary";
}

export interface AIPhaseBannerConfig {
  phase: string;
  title?: string;
  description?: string;
  actions: AIAction[];
  contextBuilder: () => string;
  onActionComplete?: (actionId: string, content: string) => void;
}

interface AIAssistBannerProps {
  engagementId: string;
  config: AIPhaseBannerConfig;
  className?: string;
  dismissible?: boolean;
  defaultExpanded?: boolean;
}

const PHASE_ICONS: Record<string, React.ReactNode> = {
  planning: <FileText className="h-4 w-4" />,
  execution: <CheckCircle2 className="h-4 w-4" />,
  finalization: <Wand2 className="h-4 w-4" />,
  "pre-planning": <Lightbulb className="h-4 w-4" />,
  requisition: <FileText className="h-4 w-4" />,
  controls: <AlertTriangle className="h-4 w-4" />,
  substantive: <CheckCircle2 className="h-4 w-4" />,
  eqcr: <AlertTriangle className="h-4 w-4" />,
  "trial-balance": <FileText className="h-4 w-4" />,
};

export function AIAssistBanner({
  engagementId,
  config,
  className = "",
  dismissible = true,
  defaultExpanded = true,
}: AIAssistBannerProps) {
  const { isAIEnabled, settings } = useAI();
  const { toast } = useToast();

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isDismissed, setIsDismissed] = useState(false);
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const phaseIcon = PHASE_ICONS[config.phase] || <Bot className="h-4 w-4" />;

  const handleActionClick = async (action: AIAction) => {
    setActiveAction(action);
    setDialogOpen(true);
    setIsGenerating(true);
    setGeneratedContent("");
    setEditedContent("");
    setConfirmed(false);

    try {
      const context = config.contextBuilder();
      const res = await fetchWithAuth("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: config.phase,
          context,
          promptType: action.promptType,
          engagementId,
          page: config.phase,
          fieldName: action.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate content");
      }

      const data = await res.json();
      setGeneratedContent(data.content || "");
      setEditedContent(data.content || "");
    } catch (err: any) {
      toast({
        title: "AI Generation Failed",
        description: err.message || "Failed to generate content",
        variant: "destructive",
      });
      setDialogOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!activeAction) return;
    handleActionClick(activeAction);
  };

  const handleAccept = async () => {
    if (!confirmed || !activeAction) return;

    try {
      await fetchWithAuth("/api/ai/log-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: config.phase,
          action: activeAction.promptType,
          engagementId,
          page: config.phase,
          fieldName: activeAction.id,
          aiDraftContent: generatedContent,
          finalUserContent: editedContent,
          userConfirmed: true,
          wasEdited: editedContent !== generatedContent,
        }),
      });
    } catch (err) {
      console.error("Failed to log AI usage:", err);
    }

    if (config.onActionComplete) {
      config.onActionComplete(activeAction.id, editedContent);
    }

    toast({
      title: "Content Applied",
      description: `AI-assisted ${activeAction.label.toLowerCase()} has been applied.`,
    });

    setDialogOpen(false);
    setActiveAction(null);
    setGeneratedContent("");
    setEditedContent("");
    setConfirmed(false);
  };

  if (!isAIEnabled || isDismissed) {
    return null;
  }

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className={`rounded-md border border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 ${className}`}>
          <div className="flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <span className="text-xs font-medium text-purple-900 dark:text-purple-200">
                {config.title || "AI Assistant"}
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                {phaseIcon}
                <span className="ml-0.5 capitalize">{config.phase}</span>
              </Badge>
              {!isExpanded && (
                <span className="text-[11px] text-purple-500 dark:text-purple-400">
                  {config.actions.length} actions available
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-100">
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </CollapsibleTrigger>
              {dismissible && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-400 hover:text-purple-600 hover:bg-purple-100" onClick={() => setIsDismissed(true)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <CollapsibleContent>
            <div className="px-3 pb-2 pt-0">
              {config.description && (
                <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">{config.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {config.actions.map((action) => (
                  <Button
                    key={action.id}
                    variant={action.variant || "outline"}
                    size="sm"
                    className="gap-1.5 bg-white hover:bg-purple-50 border-purple-200 text-purple-700 hover:text-purple-800 h-7 text-xs"
                    onClick={() => handleActionClick(action)}
                  >
                    {action.icon || <Sparkles className="h-3 w-3" />}
                    {action.label}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-purple-500 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                AI outputs are suggestions only. Professional judgment is required.
              </p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {activeAction?.label || "AI Assist"}
            </DialogTitle>
            <DialogDescription>
              {activeAction?.description || "Review and edit the AI-generated content below."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isGenerating ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600 mr-2" />
                <span className="text-muted-foreground">Generating content...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>AI-Generated Draft</Label>
                    <Badge variant="secondary" className="text-xs">
                      Review & Edit Required
                    </Badge>
                  </div>
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder="AI-generated content will appear here..."
                  />
                  <p className="text-xs text-muted-foreground">
                    You may modify, replace, or completely rewrite this content.
                  </p>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <Checkbox
                    id="confirm-ai"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked === true)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="confirm-ai" className="text-amber-800 font-medium cursor-pointer">
                      Professional Judgment Confirmation
                    </Label>
                    <p className="text-sm text-amber-700">
                      I confirm that this content has been reviewed and reflects my professional judgment.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleRegenerate} disabled={isGenerating}>
              <Sparkles className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!confirmed || isGenerating || !editedContent}
            >
              <Edit className="h-4 w-4 mr-2" />
              Accept & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const PHASE_AI_CONFIGS: Record<string, Omit<AIPhaseBannerConfig, "contextBuilder" | "onActionComplete">> = {
  planning: {
    phase: "planning",
    title: "Planning AI Assistant",
    description: "Get AI assistance with planning documentation, risk assessment, and audit strategy.",
    actions: [
      {
        id: "risk-assessment",
        label: "Assess Risks",
        description: "Generate risk assessment based on engagement context and industry factors.",
        promptType: "risk_description",
        icon: <AlertTriangle className="h-3 w-3" />,
      },
      {
        id: "audit-strategy",
        label: "Draft Strategy",
        description: "Generate audit strategy recommendations based on risk assessment.",
        promptType: "audit_summary",
        icon: <FileText className="h-3 w-3" />,
      },
      {
        id: "materiality-rationale",
        label: "Materiality Rationale",
        description: "Generate rationale for materiality determination.",
        promptType: "materiality_rationale",
        icon: <Lightbulb className="h-3 w-3" />,
      },
    ],
  },
  execution: {
    phase: "execution",
    title: "Execution AI Assistant",
    description: "Get AI help with audit procedures, testing documentation, and findings.",
    actions: [
      {
        id: "procedure-design",
        label: "Design Procedures",
        description: "Generate audit procedure recommendations for testing controls and assertions.",
        promptType: "audit_procedure",
        icon: <CheckCircle2 className="h-3 w-3" />,
      },
      {
        id: "observation-wording",
        label: "Draft Observations",
        description: "Generate professional wording for audit observations.",
        promptType: "observation_wording",
        icon: <Edit className="h-3 w-3" />,
      },
      {
        id: "deficiency-narrative",
        label: "Deficiency Narrative",
        description: "Generate control deficiency narrative for identified issues.",
        promptType: "deficiency_narrative",
        icon: <AlertTriangle className="h-3 w-3" />,
      },
    ],
  },
  finalization: {
    phase: "finalization",
    title: "Finalization AI Assistant",
    description: "Get AI assistance with audit conclusions, management letter points, and final reporting.",
    actions: [
      {
        id: "audit-summary",
        label: "Summarize Findings",
        description: "Generate a summary of audit findings and conclusions.",
        promptType: "audit_summary",
        icon: <FileText className="h-3 w-3" />,
      },
      {
        id: "management-letter",
        label: "Management Letter",
        description: "Generate management letter points based on identified issues.",
        promptType: "management_letter_point",
        icon: <Edit className="h-3 w-3" />,
      },
    ],
  },
  requisition: {
    phase: "requisition",
    title: "Data Intake AI Assistant",
    description: "Get AI help with document requests and client communication.",
    actions: [
      {
        id: "request-wording",
        label: "Draft Request",
        description: "Generate professional wording for information requests.",
        promptType: "observation_wording",
        icon: <FileText className="h-3 w-3" />,
      },
    ],
  },
  controls: {
    phase: "controls",
    title: "Controls Testing AI Assistant",
    description: "Get AI assistance with controls testing procedures and documentation.",
    actions: [
      {
        id: "control-procedure",
        label: "Control Procedure",
        description: "Generate control testing procedure recommendations.",
        promptType: "audit_procedure",
        icon: <CheckCircle2 className="h-3 w-3" />,
      },
      {
        id: "deficiency-narrative",
        label: "Deficiency Narrative",
        description: "Generate control deficiency narrative.",
        promptType: "deficiency_narrative",
        icon: <AlertTriangle className="h-3 w-3" />,
      },
    ],
  },
  substantive: {
    phase: "substantive",
    title: "Substantive Testing AI Assistant",
    description: "Get AI help with substantive testing procedures and variance explanations.",
    actions: [
      {
        id: "substantive-procedure",
        label: "Testing Procedure",
        description: "Generate substantive testing procedure recommendations.",
        promptType: "audit_procedure",
        icon: <CheckCircle2 className="h-3 w-3" />,
      },
      {
        id: "variance-explanation",
        label: "Variance Analysis",
        description: "Generate variance explanation for analytical procedures.",
        promptType: "variance_explanation",
        icon: <Lightbulb className="h-3 w-3" />,
      },
    ],
  },
  eqcr: {
    phase: "eqcr",
    title: "EQCR AI Assistant",
    description: "Get AI assistance with engagement quality control review documentation.",
    actions: [
      {
        id: "eqcr-summary",
        label: "Review Summary",
        description: "Generate EQCR summary based on engagement findings.",
        promptType: "audit_summary",
        icon: <FileText className="h-3 w-3" />,
      },
    ],
  },
  "trial-balance": {
    phase: "trial-balance",
    title: "Trial Balance AI Assistant",
    description: "Get AI help with trial balance analysis and variance explanations.",
    actions: [
      {
        id: "variance-explanation",
        label: "Variance Analysis",
        description: "Generate variance explanation for significant changes.",
        promptType: "variance_explanation",
        icon: <Lightbulb className="h-3 w-3" />,
      },
    ],
  },
  "pre-planning": {
    phase: "pre-planning",
    title: "Pre-Planning AI Assistant",
    description: "Get AI assistance with client acceptance, independence, and engagement setup.",
    actions: [
      {
        id: "entity-understanding",
        label: "Entity Understanding",
        description: "Generate understanding of the entity and its environment.",
        promptType: "entity_understanding",
        icon: <Lightbulb className="h-3 w-3" />,
      },
      {
        id: "risk-description",
        label: "Initial Risk Assessment",
        description: "Generate initial risk assessment for client acceptance.",
        promptType: "risk_description",
        icon: <AlertTriangle className="h-3 w-3" />,
      },
    ],
  },
};

export default AIAssistBanner;
