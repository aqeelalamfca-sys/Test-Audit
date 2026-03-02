import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { AIRephraseModal } from "./ai-rephrase-modal";

interface AIFieldWrapperProps {
  engagementId: string;
  tabId: string;
  fieldKey: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}

export function AIFieldWrapper({
  engagementId,
  tabId,
  fieldKey,
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled = false,
  hideLabel = false,
}: AIFieldWrapperProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRephrasing, setIsRephrasing] = useState(false);
  const [showRephraseModal, setShowRephraseModal] = useState(false);
  const [rephrasedText, setRephrasedText] = useState("");
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!engagementId) {
      toast({ title: "Error", description: "No engagement selected", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetchWithAuth("/api/ai/preplanning/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          tabId,
          fieldKeys: [fieldKey],
          existingFieldValues: { [fieldKey]: value },
          action: "fill",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate content");
      }

      const data = await response.json();
      if (data.results && data.results[fieldKey]) {
        onChange(data.results[fieldKey].content);
        toast({ title: "Generated", description: `${label} has been filled with AI-generated content` });
      } else {
        toast({ title: "No content", description: "AI did not generate content for this field", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRephrase = async () => {
    if (!value.trim()) {
      toast({ title: "Nothing to rephrase", description: "Please enter some text first", variant: "destructive" });
      return;
    }

    setIsRephrasing(true);
    try {
      const response = await fetchWithAuth("/api/ai/preplanning/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          tabId,
          fieldKeys: [fieldKey],
          existingFieldValues: { [fieldKey]: value },
          action: "rephrase",
          selectedFieldKey: fieldKey,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to rephrase content");
      }

      const data = await response.json();
      if (data.results && data.results[fieldKey]) {
        setRephrasedText(data.results[fieldKey].content);
        setShowRephraseModal(true);
      } else {
        toast({ title: "No content", description: "AI did not generate rephrased content", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsRephrasing(false);
    }
  };

  const handleRephraseAction = (action: "replace" | "append" | "cancel") => {
    if (action === "replace") {
      onChange(rephrasedText);
      toast({ title: "Applied", description: "Rephrased text has been applied" });
    } else if (action === "append") {
      onChange(value + "\n\n" + rephrasedText);
      toast({ title: "Appended", description: "Rephrased text has been appended" });
    }
    setShowRephraseModal(false);
    setRephrasedText("");
  };

  const isLoading = isGenerating || isRephrasing;
  const hasContent = value.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {!hideLabel && <Label>{label}</Label>}
        <div className="flex items-center gap-1 ml-auto">
          {!hasContent && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={isLoading || disabled || !engagementId}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Fill
                </>
              )}
            </Button>
          )}
          {hasContent && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRephrase}
              disabled={isLoading || disabled || !engagementId}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
            >
              {isRephrasing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Rephrase
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className={isLoading ? "opacity-50" : ""}
      />

      <AIRephraseModal
        open={showRephraseModal}
        onOpenChange={setShowRephraseModal}
        original={value}
        proposed={rephrasedText}
        fieldLabel={label}
        onAction={handleRephraseAction}
      />
    </div>
  );
}
