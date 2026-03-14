import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  FileQuestion, 
  Upload, 
  PlusCircle, 
  FolderOpen,
  Search,
  AlertCircle
} from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center py-12 px-3 text-center",
        className
      )}
      data-testid="empty-state"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/80 mb-2.5">
        {icon || <FileQuestion className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold mb-1" data-testid="text-empty-title">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-2.5" data-testid="text-empty-description">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action && (
            <Button onClick={action.onClick} className="gap-1.5" data-testid="button-empty-action">
              {action.icon}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button 
              variant="outline" 
              onClick={secondaryAction.onClick}
              data-testid="button-empty-secondary"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function NoDataEmptyState({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={<Upload className="h-8 w-8 text-muted-foreground" />}
      title="No data uploaded yet"
      description="Upload your Trial Balance or General Ledger to get started with the audit."
      action={onUpload ? {
        label: "Upload Data",
        onClick: onUpload,
        icon: <Upload className="h-4 w-4" />
      } : undefined}
    />
  );
}

export function NoItemsEmptyState({ 
  itemName, 
  onAdd 
}: { 
  itemName: string; 
  onAdd?: () => void;
}) {
  return (
    <EmptyState
      icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
      title={`No ${itemName} found`}
      description={`Get started by creating your first ${itemName.toLowerCase()}.`}
      action={onAdd ? {
        label: `Add ${itemName}`,
        onClick: onAdd,
        icon: <PlusCircle className="h-4 w-4" />
      } : undefined}
    />
  );
}

export function NoSearchResultsEmptyState({ 
  query, 
  onClear 
}: { 
  query: string; 
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8 text-muted-foreground" />}
      title="No results found"
      description={`No items match "${query}". Try adjusting your search or filters.`}
      action={onClear ? {
        label: "Clear Search",
        onClick: onClear
      } : undefined}
    />
  );
}

export function ErrorEmptyState({ 
  message, 
  onRetry 
}: { 
  message?: string; 
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-8 w-8 text-destructive" />}
      title="Something went wrong"
      description={message || "There was an error loading the data. Please try again."}
      action={onRetry ? {
        label: "Try Again",
        onClick: onRetry
      } : undefined}
    />
  );
}

interface SkeletonLoaderProps {
  rows?: number;
  className?: string;
}

export function TableSkeletonLoader({ rows = 5, className }: SkeletonLoaderProps) {
  return (
    <div className={cn("space-y-3 p-2.5", className)} data-testid="skeleton-loader">
      <div className="h-10 bg-muted rounded-md animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-muted/50 rounded-md animate-pulse" />
      ))}
    </div>
  );
}

export function CardSkeletonLoader({ className }: { className?: string }) {
  return (
    <div className={cn("p-2.5 border rounded-lg space-y-3", className)} data-testid="card-skeleton">
      <div className="h-5 w-1/3 bg-muted rounded animate-pulse" />
      <div className="h-4 w-2/3 bg-muted/50 rounded animate-pulse" />
      <div className="h-4 w-1/2 bg-muted/50 rounded animate-pulse" />
    </div>
  );
}
