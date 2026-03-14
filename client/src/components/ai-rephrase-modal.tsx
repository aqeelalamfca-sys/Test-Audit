import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Plus, X } from "lucide-react";

interface AIRephraseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  original: string;
  proposed: string;
  fieldLabel: string;
  onAction: (action: "replace" | "append" | "cancel") => void;
}

export function AIRephraseModal({
  open,
  onOpenChange,
  original,
  proposed,
  fieldLabel,
  onAction,
}: AIRephraseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            AI Rephrase Preview
            <Badge variant="outline" className="text-xs font-normal">
              {fieldLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review the AI-generated rephrased version and choose how to apply it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Original</Badge>
            </div>
            <ScrollArea className="h-[300px] rounded-md border p-3 bg-muted/30">
              <p className="text-sm whitespace-pre-wrap">{original}</p>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="text-xs bg-primary/80">AI Proposed</Badge>
            </div>
            <ScrollArea className="h-[300px] rounded-md border p-3 bg-primary/5">
              <p className="text-sm whitespace-pre-wrap">{proposed}</p>
            </ScrollArea>
          </div>
        </div>

        <Separator />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <p className="text-xs text-muted-foreground mr-auto">
            AI-generated content is fully editable after applying.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onAction("cancel")}
              className="gap-1.5"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => onAction("append")}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Append
            </Button>
            <Button
              onClick={() => onAction("replace")}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              Replace
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
