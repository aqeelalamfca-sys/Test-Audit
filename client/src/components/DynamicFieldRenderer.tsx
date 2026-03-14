import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Edit3,
  Check,
  X,
  Eye,
  FileText,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FieldDefinition {
  blueprintId: string;
  fieldKey: string;
  label: string;
  description?: string;
  helpText?: string;
  inputType: string;
  fieldType: string;
  required: boolean;
  isReadonly: boolean;
  optionsJson?: unknown;
  validationRules?: unknown;
  isaTags?: string[];
  fetchRuleName?: string;
  currentValue?: unknown;
  displayValue?: string;
  status: string;
  signOffLevel: string;
  isLocked: boolean;
}

interface DrilldownItem {
  id: string;
  label: string;
  value: unknown;
  metadata?: Record<string, unknown>;
}

interface DynamicFieldRendererProps {
  engagementId: string;
  module: string;
  tab?: string;
  scopeType?: "ENGAGEMENT" | "FS_HEAD" | "PROCEDURE" | "CONFIRMATION";
  scopeId?: string;
  onFieldChange?: (fieldKey: string, value: unknown) => void;
  readOnly?: boolean;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  MISSING: "destructive",
  POPULATED: "default",
  OVERRIDDEN: "secondary",
  LOCKED: "outline",
  NOT_APPLICABLE: "outline",
};

const signOffBadges: Record<string, { label: string; className: string }> = {
  NONE: { label: "Not Signed", className: "bg-gray-100 text-gray-600" },
  PREPARED: { label: "Prepared", className: "bg-blue-100 text-blue-700" },
  REVIEWED: { label: "Reviewed", className: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700" },
};

export function DynamicFieldRenderer({
  engagementId,
  module,
  tab,
  scopeType = "ENGAGEMENT",
  scopeId,
  onFieldChange,
  readOnly = false,
}: DynamicFieldRendererProps) {
  const queryClientInstance = useQueryClient();
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldDefinition | null>(null);
  const [overrideValue, setOverrideValue] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [drilldownOpen, setDrilldownOpen] = useState<Record<string, boolean>>({});

  const queryKey = ["/api/fetch-engine/engagements", engagementId, "fields", { module, tab }];

  const { data, isLoading, refetch } = useQuery<{ fields: FieldDefinition[] }>({
    queryKey,
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      apiRequest(
        "POST",
        `/api/fetch-engine/engagements/${engagementId}/fields/refresh`,
        { scopeType, scopeId, forceRefresh: true }
      ),
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: (params: { instanceId: string; newValue: unknown; overrideReason: string }) =>
      apiRequest(
        "POST",
        `/api/fetch-engine/field-instances/${params.instanceId}/override`,
        { newValue: params.newValue, overrideReason: params.overrideReason }
      ),
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey });
      setOverrideDialogOpen(false);
      setOverrideValue("");
      setOverrideReason("");
    },
  });

  const lockMutation = useMutation({
    mutationFn: (params: { instanceId: string; lockReason: string }) =>
      apiRequest(
        "POST",
        `/api/fetch-engine/field-instances/${params.instanceId}/lock`,
        { lockReason: params.lockReason }
      ),
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (instanceId: string) =>
      apiRequest(
        "POST",
        `/api/fetch-engine/field-instances/${instanceId}/unlock`
      ),
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey });
    },
  });

  const handleOverrideClick = useCallback((field: FieldDefinition) => {
    setSelectedField(field);
    setOverrideValue(String(field.currentValue || ""));
    setOverrideDialogOpen(true);
  }, []);

  const handleOverrideSubmit = useCallback(() => {
    if (!selectedField) return;
    overrideMutation.mutate({
      instanceId: selectedField.blueprintId,
      newValue: overrideValue,
      overrideReason,
    });
  }, [selectedField, overrideValue, overrideReason, overrideMutation]);

  const toggleDrilldown = useCallback((fieldKey: string) => {
    setDrilldownOpen((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  }, []);

  const renderFieldInput = useCallback(
    (field: FieldDefinition) => {
      const isDisabled = readOnly || field.isLocked || field.isReadonly;
      const value = field.currentValue ?? "";

      switch (field.inputType) {
        case "textarea":
          return (
            <Textarea
              data-testid={`input-${field.fieldKey}`}
              value={String(value)}
              disabled={isDisabled}
              onChange={(e) => onFieldChange?.(field.fieldKey, e.target.value)}
              className="min-h-[80px]"
            />
          );
        case "select":
          const options = (field.optionsJson as { value: string; label: string }[]) || [];
          return (
            <Select
              value={String(value)}
              disabled={isDisabled}
              onValueChange={(val) => onFieldChange?.(field.fieldKey, val)}
            >
              <SelectTrigger data-testid={`select-${field.fieldKey}`}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        case "number":
        case "currency":
          return (
            <Input
              data-testid={`input-${field.fieldKey}`}
              type="text"
              value={field.displayValue || String(value)}
              disabled={isDisabled}
              onChange={(e) => onFieldChange?.(field.fieldKey, e.target.value)}
              className="text-right font-mono"
            />
          );
        case "date":
          return (
            <Input
              data-testid={`input-${field.fieldKey}`}
              type="date"
              value={String(value)}
              disabled={isDisabled}
              onChange={(e) => onFieldChange?.(field.fieldKey, e.target.value)}
            />
          );
        case "boolean":
        case "checkbox":
          return (
            <div className="flex items-center gap-2">
              <input
                data-testid={`checkbox-${field.fieldKey}`}
                type="checkbox"
                checked={Boolean(value)}
                disabled={isDisabled}
                onChange={(e) => onFieldChange?.(field.fieldKey, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">{value ? "Yes" : "No"}</span>
            </div>
          );
        default:
          return (
            <Input
              data-testid={`input-${field.fieldKey}`}
              type="text"
              value={String(value)}
              disabled={isDisabled}
              onChange={(e) => onFieldChange?.(field.fieldKey, e.target.value)}
            />
          );
      }
    },
    [readOnly, onFieldChange]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-2.5">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading fields...</span>
      </div>
    );
  }

  const fields = data?.fields || [];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" data-testid="text-field-section-title">
          {module} {tab ? `- ${tab}` : ""}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="button-refresh-fields"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh Auto-Fields
        </Button>
      </div>

      <div className="grid gap-2.5">
        {fields.map((field) => (
          <Card key={field.fieldKey} className="relative" data-testid={`card-field-${field.fieldKey}`}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={field.fieldKey}
                      className="text-sm font-medium"
                      data-testid={`label-${field.fieldKey}`}
                    >
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>

                    {field.helpText && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{field.helpText}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <Badge variant={statusVariants[field.status] || "outline"} className="text-xs">
                      {field.status}
                    </Badge>

                    {field.signOffLevel !== "NONE" && (
                      <Badge className={`text-xs ${signOffBadges[field.signOffLevel]?.className}`}>
                        {signOffBadges[field.signOffLevel]?.label}
                      </Badge>
                    )}

                    {field.isLocked && (
                      <Badge variant="outline" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}

                    {field.isaTags && field.isaTags.length > 0 && (
                      <div className="flex gap-1">
                        {field.isaTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {field.description && (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  )}

                  <div className="mt-2">{renderFieldInput(field)}</div>

                  {field.fetchRuleName && (
                    <Collapsible
                      open={drilldownOpen[field.fieldKey]}
                      onOpenChange={() => toggleDrilldown(field.fieldKey)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto" data-testid={`button-drilldown-${field.fieldKey}`}>
                          {drilldownOpen[field.fieldKey] ? (
                            <ChevronDown className="h-4 w-4 mr-1" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-1" />
                          )}
                          <Eye className="h-3 w-3 mr-1" />
                          View Source Details
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <DrilldownPanel
                          engagementId={engagementId}
                          blueprintId={field.blueprintId}
                          scopeType={scopeType}
                          scopeId={scopeId}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {!readOnly && !field.isLocked && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOverrideClick(field)}
                      data-testid={`button-override-${field.fieldKey}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  )}

                  {!readOnly && (
                    <>
                      {field.isLocked ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => unlockMutation.mutate(field.blueprintId)}
                          data-testid={`button-unlock-${field.fieldKey}`}
                        >
                          <Unlock className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            lockMutation.mutate({
                              instanceId: field.blueprintId,
                              lockReason: "Manual lock by user",
                            })
                          }
                          data-testid={`button-lock-${field.fieldKey}`}
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Field Value</DialogTitle>
            <DialogDescription>
              Overriding will mark this field as manually edited. The original value will be preserved
              for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-2">
            <div className="space-y-2">
              <Label>Field</Label>
              <p className="text-sm font-medium">{selectedField?.label}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-value">New Value</Label>
              <Input
                id="override-value"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                data-testid="input-override-value"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason for Override (Required)</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this value is being overridden..."
                data-testid="input-override-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOverrideDialogOpen(false)}
              data-testid="button-cancel-override"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOverrideSubmit}
              disabled={!overrideReason.trim() || overrideMutation.isPending}
              data-testid="button-confirm-override"
            >
              {overrideMutation.isPending ? "Saving..." : "Override Value"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DrilldownPanel({
  engagementId,
  blueprintId,
  scopeType,
  scopeId,
}: {
  engagementId: string;
  blueprintId: string;
  scopeType?: string;
  scopeId?: string;
}) {
  const queryParams = new URLSearchParams();
  if (scopeType) queryParams.set("scopeType", scopeType);
  if (scopeId) queryParams.set("scopeId", scopeId);

  const { data, isLoading } = useQuery<{ drilldownData: DrilldownItem[] }>({
    queryKey: [
      "/api/fetch-engine/engagements",
      engagementId,
      "fields",
      blueprintId,
      "drilldown",
      { scopeType, scopeId },
    ],
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Loading source details...
      </div>
    );
  }

  const items = data?.drilldownData || [];

  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-2">No source details available.</div>
    );
  }

  return (
    <div className="bg-muted/50 rounded-md p-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase">Source Breakdown</div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between text-sm p-2 bg-background rounded"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span>{item.label}</span>
            </div>
            <span className="font-mono text-xs">
              {typeof item.value === "number"
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(item.value)
                : String(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DynamicFieldRenderer;
