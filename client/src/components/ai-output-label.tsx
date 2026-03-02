import { useEnforcementOptional } from "@/lib/enforcement-context";
import { Bot, AlertCircle, Edit3, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AIOutputLabelProps {
  className?: string;
  showFull?: boolean;
}

export function AIOutputLabel({ className, showFull = false }: AIOutputLabelProps) {
  const enforcement = useEnforcementOptional();
  
  const label = enforcement?.aiConfig?.label || "AI-Assisted - Subject to Professional Judgment";
  
  if (showFull) {
    return (
      <div className={cn(
        "flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2",
        className
      )}>
        <Bot className="h-4 w-4 text-blue-500" />
        <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
          {label}
        </span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn(
            "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 cursor-help",
            className
          )}
        >
          <Bot className="h-3 w-3 mr-1" />
          AI-Assisted
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <p className="font-medium">{label}</p>
          <ul className="text-xs space-y-1">
            <li className="flex items-center gap-1">
              <Edit3 className="h-3 w-3" /> Always editable by user
            </li>
            <li className="flex items-center gap-1">
              <Check className="h-3 w-3" /> Requires human approval before finalization
            </li>
            <li className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Non-authoritative output
            </li>
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface AIOutputWrapperProps {
  children: React.ReactNode;
  className?: string;
  onAccept?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  showActions?: boolean;
}

export function AIOutputWrapper({ 
  children, 
  className,
  onAccept,
  onReject,
  onEdit,
  showActions = true
}: AIOutputWrapperProps) {
  return (
    <div className={cn(
      "relative border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden",
      className
    )}>
      <div className="absolute top-2 right-2 z-10">
        <AIOutputLabel />
      </div>
      
      <div className="pt-10 p-4">
        {children}
      </div>
      
      {showActions && (onAccept || onReject || onEdit) && (
        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-4 py-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Edit3 className="h-3 w-3" />
              Edit
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
            >
              <X className="h-3 w-3" />
              Reject
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              className="flex items-center gap-1 text-xs text-green-500 hover:text-green-600 transition-colors"
            >
              <Check className="h-3 w-3" />
              Accept
            </button>
          )}
        </div>
      )}
    </div>
  );
}
