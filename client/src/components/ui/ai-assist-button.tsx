import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles, Loader2, Copy, Check, RotateCcw, Wand2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export type AIPromptType = 
  | "entity_understanding"
  | "risk_description"
  | "audit_procedure"
  | "observation_wording"
  | "deficiency_narrative"
  | "audit_summary"
  | "management_letter_point"
  | "variance_explanation"
  | "materiality_rationale";

const PROHIBITED_FIELDS = [
  "riskLevel", "riskRating",
  "materialityAmount", "performanceMateriality", "trivialThreshold",
  "auditOpinion", "opinionType",
  "isApproved", "approvedBy", "signedOff", "partnerApproval", "managerApproval",
  "testResult", "conclusion", "evidenceSufficient",
  "sampleSize"
];

interface AIAssistButtonProps {
  fieldName: string;
  fieldLabel?: string;
  promptType: AIPromptType;
  context: string;
  engagementId?: string;
  page?: string;
  section?: string;
  isaReferences?: string[];
  onInsert: (content: string) => void;
  currentValue?: string;
  disabled?: boolean;
  variant?: "icon" | "inline" | "full";
}

export function AIAssistButton({
  fieldName,
  fieldLabel,
  promptType,
  context,
  engagementId,
  page,
  section,
  isaReferences,
  onInsert,
  currentValue,
  disabled,
  variant = "icon",
}: AIAssistButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [copied, setCopied] = useState(false);

  const isProhibited = PROHIBITED_FIELDS.some(f => 
    fieldName.toLowerCase().includes(f.toLowerCase())
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/generate", {
        promptType,
        context,
        engagementId,
        page,
        fieldName,
        section: section || promptType,
        isaReferences,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.content) {
        setGeneratedContent(data.content);
      } else if (data.error) {
        toast({
          title: "AI Generation Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "AI Error",
        description: error.message || "Failed to generate content",
        variant: "destructive",
      });
    },
  });

  const rephraseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/rephrase", {
        content: currentValue || generatedContent,
        context,
        engagementId,
        page,
        fieldName,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.content) {
        setGeneratedContent(data.content);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Rephrase Failed",
        description: error.message || "Failed to rephrase content",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleRephrase = () => {
    rephraseMutation.mutate();
  };

  const handleInsert = () => {
    onInsert(generatedContent);
    setOpen(false);
    setGeneratedContent("");
    toast({
      title: "Content Inserted",
      description: "AI-generated content has been added to the field.",
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isProhibited) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            disabled
            className="opacity-30 cursor-not-allowed"
            data-testid={`button-ai-disabled-${fieldName}`}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          AI assistance not available for this field. Professional judgment required.
        </TooltipContent>
      </Tooltip>
    );
  }

  const isLoading = generateMutation.isPending || rephraseMutation.isPending;

  if (variant === "icon") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                disabled={disabled || isLoading}
                className="text-purple-500 hover:text-purple-600 hover:bg-purple-50"
                data-testid={`button-ai-assist-${fieldName}`}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>AI Assist</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-[400px] p-2.5" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">AI Assistant</h4>
              <span className="text-xs text-muted-foreground">{fieldLabel || fieldName}</span>
            </div>
            
            {!generatedContent ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Generate professional audit content based on your context.
                </p>
                <Button 
                  onClick={handleGenerate} 
                  disabled={isLoading}
                  className="w-full"
                  data-testid={`button-ai-generate-${fieldName}`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Content
                    </>
                  )}
                </Button>
                {currentValue && (
                  <Button 
                    onClick={handleRephrase}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full"
                    data-testid={`button-ai-rephrase-${fieldName}`}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Improve Existing Text
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="min-h-[120px] text-sm"
                  data-testid={`textarea-ai-content-${fieldName}`}
                />
                <p className="text-xs text-muted-foreground">
                  AI-generated content is subject to professional judgment. Review before using.
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleInsert}
                    className="flex-1"
                    data-testid={`button-ai-insert-${fieldName}`}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Insert
                  </Button>
                  <Button 
                    onClick={handleCopy}
                    variant="outline"
                    data-testid={`button-ai-copy-${fieldName}`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button 
                    onClick={handleGenerate}
                    variant="outline"
                    disabled={isLoading}
                    data-testid={`button-ai-regenerate-${fieldName}`}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setOpen(true)}
      disabled={disabled || isLoading}
      className="gap-2"
      data-testid={`button-ai-assist-inline-${fieldName}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4 text-purple-500" />
      )}
      AI Assist
    </Button>
  );
}
