import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatAccounting } from "@/lib/formatters";
import { Lock, Unlock, Check, X, Edit2, RotateCcw, Info, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FieldBlueprint {
  id: string;
  module: string;
  tab: string;
  fieldKey: string;
  label: string;
  description?: string | null;
  fieldType: string;
  required: boolean;
  requiredWhen?: any;
  dataSource: string;
  defaultValue?: any;
  validationRules?: any;
  roleLockRule?: string | null;
  minRoleToEdit?: string | null;
  standardsRef?: string | null;
  orderIndex: number;
}

interface FieldInstance {
  id: string;
  engagementId: string;
  blueprintId: string;
  module: string;
  tab: string;
  fieldKey: string;
  valueJson: any;
  displayValue?: string | null;
  status: string;
  signOffLevel: string;
  isLocked: boolean;
  overrideSnapshot?: any;
  overrideReason?: string | null;
  sourceBatchId?: string | null;
  sourceMappingId?: string | null;
  sourceRef?: string | null;
  preparedById?: string | null;
  preparedAt?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  lockedById?: string | null;
  lockedAt?: string | null;
  lockReason?: string | null;
  blueprint: FieldBlueprint;
}

interface FieldRendererProps {
  instance: FieldInstance;
  userRole: string;
  onUpdate?: (instanceId: string, value: any) => void;
  onSignOff?: (instanceId: string, level: string) => void;
  readOnly?: boolean;
  className?: string;
}

const statusBadgeConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  MISSING: { label: "Missing", variant: "destructive" },
  POPULATED: { label: "Populated", variant: "secondary" },
  OVERRIDDEN: { label: "Overridden", variant: "default" },
  LOCKED: { label: "Locked", variant: "outline" },
  NOT_APPLICABLE: { label: "N/A", variant: "outline" },
};

const signOffLevelConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  NONE: { label: "Not Signed", variant: "outline" },
  PREPARED: { label: "Prepared", variant: "secondary" },
  REVIEWED: { label: "Reviewed", variant: "default" },
  APPROVED: { label: "Approved", variant: "default" },
};

const roleHierarchy = ["STAFF", "SENIOR", "MANAGER", "EQCR", "PARTNER", "FIRM_ADMIN"];

function canUserEdit(userRole: string, minRoleToEdit?: string | null): boolean {
  if (!minRoleToEdit) return true;
  const userIndex = roleHierarchy.indexOf(userRole);
  const minIndex = roleHierarchy.indexOf(minRoleToEdit);
  return userIndex >= minIndex;
}

function canUserSignOff(userRole: string, level: string): boolean {
  const roleToLevels: Record<string, string[]> = {
    STAFF: ["PREPARED"],
    SENIOR: ["PREPARED"],
    MANAGER: ["PREPARED", "REVIEWED"],
    EQCR: ["PREPARED", "REVIEWED"],
    PARTNER: ["PREPARED", "REVIEWED", "APPROVED"],
    FIRM_ADMIN: ["PREPARED", "REVIEWED", "APPROVED"],
  };
  return (roleToLevels[userRole] || []).includes(level);
}

export function FieldRenderer({
  instance,
  userRole,
  onUpdate,
  onSignOff,
  readOnly = false,
  className,
}: FieldRendererProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<any>(instance.valueJson);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { blueprint, status, isLocked, signOffLevel } = instance;
  const isEditable = !readOnly && !isLocked && canUserEdit(userRole, blueprint.minRoleToEdit);
  const hasAutoPopulatedValue = status === "POPULATED" && (
    blueprint.dataSource !== "USER_INPUT"
  );

  const handleSave = useCallback(async () => {
    if (hasAutoPopulatedValue && !overrideReason) {
      setShowOverrideDialog(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(
        "PATCH",
        `/api/field-orchestration/instance/${instance.id}`,
        {
          value: editValue,
          overrideReason: hasAutoPopulatedValue ? overrideReason : undefined,
        }
      );

      toast({
        title: "Field Updated",
        description: "The field value has been saved.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/field-orchestration/instances", instance.engagementId] });
      onUpdate?.(instance.id, editValue);
      setIsEditing(false);
      setShowOverrideDialog(false);
      setOverrideReason("");
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Could not save the field value.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [instance, editValue, hasAutoPopulatedValue, overrideReason, onUpdate, toast]);

  const handleSignOff = useCallback(async (level: string) => {
    if (!canUserSignOff(userRole, level)) {
      toast({
        title: "Permission Denied",
        description: `Your role cannot sign off at ${level} level.`,
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest(
        "POST",
        `/api/field-orchestration/sign-off/${instance.id}`,
        { level }
      );

      toast({
        title: "Sign-Off Recorded",
        description: `Field signed off as ${level}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/field-orchestration/instances", instance.engagementId] });
      onSignOff?.(instance.id, level);
    } catch (error) {
      toast({
        title: "Sign-Off Failed",
        description: "Could not record the sign-off.",
        variant: "destructive",
      });
    }
  }, [instance, userRole, onSignOff, toast]);

  const renderValue = () => {
    if (isEditing) {
      return renderEditableField();
    }

    const value = instance.valueJson;
    if (value === null || value === undefined) {
      return (
        <span className="text-muted-foreground italic" data-testid="text-no-value">
          No value set
        </span>
      );
    }

    switch (blueprint.fieldType) {
      case "currency":
        return (
          <span data-testid="text-currency-value">
            {formatAccounting(typeof value === "string" ? parseFloat(value) : value)}
          </span>
        );
      case "number":
        return (
          <span data-testid="text-number-value">
            {new Intl.NumberFormat('en-US').format(Number(value))}
          </span>
        );
      case "boolean":
        return (
          <Badge variant={value ? "default" : "secondary"} data-testid="badge-boolean-value">
            {value ? "Yes" : "No"}
          </Badge>
        );
      case "date":
        return (
          <span data-testid="text-date-value">
            {new Date(value).toLocaleDateString()}
          </span>
        );
      case "json":
        return (
          <code className="text-xs bg-muted px-2 py-1 rounded" data-testid="text-json-value">
            {JSON.stringify(value, null, 2).substring(0, 100)}
            {JSON.stringify(value).length > 100 && "..."}
          </code>
        );
      case "evidence":
        return (
          <div className="flex items-center gap-2" data-testid="text-evidence-value">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{typeof value === "object" ? value.name || "Evidence linked" : value}</span>
          </div>
        );
      default:
        return (
          <span data-testid="text-value">
            {instance.displayValue || String(value)}
          </span>
        );
    }
  };

  const renderEditableField = () => {
    switch (blueprint.fieldType) {
      case "currency":
      case "number":
        return (
          <Input
            type="number"
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : null)}
            className="w-full"
            data-testid="input-number"
          />
        );
      case "boolean":
        return (
          <Select value={editValue ? "true" : "false"} onValueChange={(v) => setEditValue(v === "true")}>
            <SelectTrigger data-testid="select-boolean">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );
      case "date":
        return (
          <Input
            type="date"
            value={editValue ? editValue.split("T")[0] : ""}
            onChange={(e) => setEditValue(e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="w-full"
            data-testid="input-date"
          />
        );
      case "textarea":
        return (
          <Textarea
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value || null)}
            className="w-full"
            rows={3}
            data-testid="textarea-value"
          />
        );
      case "select":
        return (
          <Input
            type="text"
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value || null)}
            className="w-full"
            data-testid="input-select"
          />
        );
      default:
        return (
          <Input
            type="text"
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value || null)}
            className="w-full"
            data-testid="input-text"
          />
        );
    }
  };

  const getNextSignOffLevel = () => {
    if (signOffLevel === "NONE" && canUserSignOff(userRole, "PREPARED")) return "PREPARED";
    if (signOffLevel === "PREPARED" && canUserSignOff(userRole, "REVIEWED")) return "REVIEWED";
    if (signOffLevel === "REVIEWED" && canUserSignOff(userRole, "APPROVED")) return "APPROVED";
    return null;
  };

  const nextSignOff = getNextSignOffLevel();

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-2 p-3 rounded-lg border",
          isLocked && "bg-muted/50",
          status === "MISSING" && blueprint.required && "border-red-200 dark:border-red-800",
          className
        )}
        data-testid={`field-renderer-${instance.fieldKey}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium" data-testid="text-label">{blueprint.label}</span>
            {blueprint.required && (
              <span className="text-red-500 text-xs">*</span>
            )}
            {blueprint.description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{blueprint.description}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Badge variant={statusBadgeConfig[status]?.variant || "outline"} className="text-xs" data-testid="badge-status">
              {statusBadgeConfig[status]?.label || status}
            </Badge>
            <Badge variant={signOffLevelConfig[signOffLevel]?.variant || "outline"} className="text-xs" data-testid="badge-signoff-level">
              {signOffLevelConfig[signOffLevel]?.label || signOffLevel}
            </Badge>
            {isLocked && <Lock className="h-3 w-3 text-muted-foreground" data-testid="icon-locked" />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            {renderValue()}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1">
              {isEditing ? (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSave}
                    disabled={isSubmitting}
                    data-testid="button-save"
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setEditValue(instance.valueJson);
                    }}
                    disabled={isSubmitting}
                    data-testid="button-cancel"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </>
              ) : (
                isEditable && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                    data-testid="button-edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )
              )}

              {!isEditing && nextSignOff && status !== "MISSING" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSignOff(nextSignOff)}
                  data-testid="button-signoff"
                >
                  Sign as {nextSignOff}
                </Button>
              )}
            </div>
          )}
        </div>

        {blueprint.standardsRef && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span data-testid="text-standards-ref">Ref: {blueprint.standardsRef}</span>
          </div>
        )}

        {status === "OVERRIDDEN" && instance.overrideReason && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span data-testid="text-override-reason">Override: {instance.overrideReason}</span>
          </div>
        )}
      </div>

      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Auto-Populated Value</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This field was auto-populated from {blueprint.dataSource}. 
            Please provide a reason for overriding the value.
          </p>
          <Textarea
            placeholder="Enter reason for override..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-override-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)} data-testid="button-cancel-override">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!overrideReason.trim() || isSubmitting}
              data-testid="button-confirm-override"
            >
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


interface FieldGroupRendererProps {
  instances: FieldInstance[];
  userRole: string;
  readOnly?: boolean;
  className?: string;
}

export function FieldGroupRenderer({
  instances,
  userRole,
  readOnly = false,
  className,
}: FieldGroupRendererProps) {
  const sortedInstances = [...instances].sort((a, b) => 
    (a.blueprint.orderIndex || 0) - (b.blueprint.orderIndex || 0)
  );

  return (
    <div className={cn("space-y-3", className)} data-testid="field-group-renderer">
      {sortedInstances.map((instance) => (
        <FieldRenderer
          key={instance.id}
          instance={instance}
          userRole={userRole}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
