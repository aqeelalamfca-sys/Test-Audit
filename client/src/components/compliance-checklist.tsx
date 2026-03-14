import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Upload, Plus, Trash2, FileText, CheckCircle2, AlertCircle, Clock, X, XCircle, ChevronLeft, ChevronRight, Shield, AlertTriangle } from "lucide-react";

export interface ChecklistItem {
  id: string;
  itemCode: string;
  requirement: string;
  isaReference?: string;
  status: "pending" | "completed" | "not_applicable" | "in_progress" | "";
  evidenceIds: string[];
  remarks: string;
  preparedBy?: string;
  preparedDate?: string;
  reviewedBy?: string;
  reviewedDate?: string;
  isCustom?: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  description?: string;
  items: ChecklistItem[];
}

interface ComplianceChecklistProps {
  section: ChecklistSection;
  onUpdateItem: (itemId: string, field: keyof ChecklistItem, value: any) => void;
  onAddItem?: () => void;
  onRemoveItem?: (itemId: string) => void;
  onUploadEvidence?: (itemId: string, files: FileList) => void;
  showPreparedBy?: boolean;
  showReviewedBy?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  pageSize?: number;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: Clock, color: "text-amber-500" },
  { value: "in_progress", label: "In Progress", icon: AlertCircle, color: "text-blue-500" },
  { value: "completed", label: "Completed", icon: CheckCircle2, color: "text-green-500" },
  { value: "not_applicable", label: "N/A", icon: X, color: "text-muted-foreground" },
];

function StatusBadge({ status }: { status: string }) {
  const option = STATUS_OPTIONS.find(o => o.value === status);
  if (!option) return <Badge variant="outline">Select</Badge>;

  const Icon = option.icon;
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${
        status === "completed" ? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800" :
        status === "in_progress" ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" :
        status === "pending" ? "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
        "bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {option.label}
    </Badge>
  );
}

export function ComplianceChecklist({
  section,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  onUploadEvidence,
  showPreparedBy = true,
  showReviewedBy = true,
  readOnly = false,
  compact = false,
  pageSize = 5,
}: ComplianceChecklistProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPaginated, setIsPaginated] = useState(true);

  const completedCount = section.items.filter(i => i.status === "completed" || i.status === "not_applicable").length;
  const totalItems = section.items.length;
  const totalPages = isPaginated ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;

  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  const displayedItems = isPaginated
    ? section.items.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : section.items;

  const globalStartIndex = isPaginated ? (currentPage - 1) * pageSize : 0;

  return (
    <div className="space-y-2.5" data-testid="compliance-checklist">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {section.title}
          </h4>
          {section.description && (
            <p className="text-xs text-muted-foreground">{section.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onAddItem && !readOnly && (
            <Button variant="outline" size="sm" onClick={onAddItem} className="gap-1" data-testid="button-add-checklist-item">
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Switch
              checked={isPaginated}
              onCheckedChange={setIsPaginated}
              data-testid="switch-paginate-checklist"
            />
            <span className="text-xs text-muted-foreground font-medium tabular-nums" data-testid="text-checklist-progress">
              {completedCount}/{totalItems}
            </span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden" data-testid="checklist-table-container">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[50px] text-xs font-semibold text-foreground/70">Sr.</TableHead>
              <TableHead className="min-w-[220px] text-xs font-semibold text-foreground/70">Requirement</TableHead>
              <TableHead className="w-[100px] text-xs font-semibold text-foreground/70">ISA Ref</TableHead>
              <TableHead className="w-[140px] text-xs font-semibold text-foreground/70">Status</TableHead>
              <TableHead className="w-[90px] text-xs font-semibold text-foreground/70">Evidence</TableHead>
              <TableHead className="min-w-[130px] text-xs font-semibold text-foreground/70">Remarks</TableHead>
              {showPreparedBy && <TableHead className="w-[100px] text-xs font-semibold text-foreground/70">Prepared</TableHead>}
              {showReviewedBy && <TableHead className="w-[100px] text-xs font-semibold text-foreground/70">Reviewed</TableHead>}
              {!readOnly && onRemoveItem && <TableHead className="w-[44px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedItems.map((item, index) => (
              <TableRow key={item.id} className="group hover:bg-muted/20" data-testid={`checklist-row-${item.id}`}>
                <TableCell className="text-sm text-muted-foreground tabular-nums" data-testid={`text-checklist-sr-${item.id}`}>
                  {globalStartIndex + index + 1}
                </TableCell>
                <TableCell>
                  {item.isCustom && !readOnly ? (
                    <Input
                      value={item.requirement}
                      onChange={(e) => onUpdateItem(item.id, "requirement", e.target.value)}
                      placeholder="Enter requirement..."
                      className="h-8 text-sm"
                      data-testid={`input-checklist-requirement-${item.id}`}
                    />
                  ) : (
                    <span className="text-sm leading-snug" data-testid={`text-checklist-requirement-${item.id}`}>{item.requirement}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground" data-testid={`text-checklist-isa-${item.id}`}>
                    {item.isaReference || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  {readOnly ? (
                    <StatusBadge status={item.status} />
                  ) : (
                    <Select
                      value={item.status || undefined}
                      onValueChange={(v) => onUpdateItem(item.id, "status", v)}
                    >
                      <SelectTrigger className="h-8 text-sm border-border/60" data-testid={`select-checklist-status-${item.id}`}>
                        <SelectValue placeholder="Select">
                          {item.status ? (
                            <StatusBadge status={item.status} />
                          ) : (
                            <span className="text-muted-foreground">Select</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-1.5">
                              <opt.icon className={`h-3.5 w-3.5 ${opt.color}`} />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {item.evidenceIds.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5" data-testid={`badge-evidence-count-${item.id}`}>
                        {item.evidenceIds.length}
                      </Badge>
                    )}
                    {!readOnly && onUploadEvidence && (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => e.target.files && onUploadEvidence(item.id, e.target.files)}
                          data-testid={`input-evidence-upload-${item.id}`}
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                          <span>
                            <Upload className="h-3.5 w-3.5" />
                          </span>
                        </Button>
                      </label>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {readOnly ? (
                    <span className="text-sm">{item.remarks || "-"}</span>
                  ) : (
                    <Input
                      value={item.remarks}
                      onChange={(e) => onUpdateItem(item.id, "remarks", e.target.value)}
                      placeholder="Optional"
                      className="h-8 text-sm border-border/60"
                      data-testid={`input-checklist-remarks-${item.id}`}
                    />
                  )}
                </TableCell>
                {showPreparedBy && (
                  <TableCell>
                    <div className="text-sm text-center" data-testid={`text-checklist-prepared-${item.id}`}>
                      <div className="font-medium truncate">{item.preparedBy || "-"}</div>
                      {item.preparedDate && (
                        <div className="text-xs text-muted-foreground">{item.preparedDate}</div>
                      )}
                    </div>
                  </TableCell>
                )}
                {showReviewedBy && (
                  <TableCell>
                    <div className="text-sm text-center" data-testid={`text-checklist-reviewed-${item.id}`}>
                      <div className="font-medium truncate">{item.reviewedBy || "-"}</div>
                      {item.reviewedDate && (
                        <div className="text-xs text-muted-foreground">{item.reviewedDate}</div>
                      )}
                    </div>
                  </TableCell>
                )}
                {!readOnly && onRemoveItem && item.isCustom && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(item.id)}
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      data-testid={`button-remove-checklist-${item.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isPaginated && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2" data-testid="checklist-pagination">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="h-7 w-7 p-0"
            data-testid="button-checklist-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-checklist-page">
            {currentPage}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="h-7 w-7 p-0"
            data-testid="button-checklist-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function useChecklistState(initialSections: ChecklistSection[]) {
  const [sections, setSections] = useState<ChecklistSection[]>(initialSections);

  const updateItem = (sectionId: string, itemId: string, field: keyof ChecklistItem, value: any) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        items: section.items.map(item => {
          if (item.id !== itemId) return item;
          return { ...item, [field]: value };
        }),
      };
    }));
  };

  const addItem = (sectionId: string, itemCode: string) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      const newItem: ChecklistItem = {
        id: `${sectionId}-custom-${Date.now()}`,
        itemCode: itemCode,
        requirement: "",
        status: "",
        evidenceIds: [],
        remarks: "",
        isCustom: true,
      };
      return { ...section, items: [...section.items, newItem] };
    }));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        items: section.items.filter(item => item.id !== itemId),
      };
    }));
  };

  const getProgress = () => {
    const allItems = sections.flatMap(s => s.items);
    const completed = allItems.filter(i => i.status === "completed" || i.status === "not_applicable").length;
    return { completed, total: allItems.length, percent: allItems.length > 0 ? Math.round((completed / allItems.length) * 100) : 0 };
  };

  return { sections, setSections, updateItem, addItem, removeItem, getProgress };
}

const QA_STATUS_OPTIONS = [
  { value: "completed", label: "Yes", icon: CheckCircle2, bg: "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300", activeBg: "bg-green-600 text-white border-green-600" },
  { value: "pending", label: "No", icon: XCircle, bg: "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300", activeBg: "bg-red-600 text-white border-red-600" },
  { value: "in_progress", label: "In Progress", icon: Clock, bg: "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300", activeBg: "bg-amber-500 text-white border-amber-500" },
  { value: "not_applicable", label: "N/A", icon: AlertTriangle, bg: "bg-muted border-border text-muted-foreground", activeBg: "bg-muted-foreground text-background border-muted-foreground" },
];

export function QAFormChecklist({
  section,
  onUpdateItem,
  readOnly = false,
}: {
  section: ChecklistSection;
  onUpdateItem: (itemId: string, field: keyof ChecklistItem, value: unknown) => void;
  readOnly?: boolean;
}) {
  const completedCount = section.items.filter(i => i.status === "completed" || i.status === "not_applicable").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            {section.title}
          </Badge>
          {section.description && (
            <span className="text-xs text-muted-foreground hidden sm:inline">{section.description}</span>
          )}
        </div>
        <Badge variant={completedCount === section.items.length ? "default" : "secondary"} className="text-xs">
          {completedCount}/{section.items.length} Answered
        </Badge>
      </div>

      <div className="space-y-2">
        {section.items.map((item, idx) => {
          const isAnswered = !!item.status;
          return (
            <div
              key={item.id}
              className={`rounded-lg border p-2.5 transition-colors ${
                isAnswered
                  ? item.status === "completed" ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20"
                  : item.status === "pending" ? "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20"
                  : item.status === "in_progress" ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20"
                  : "border-border bg-muted/20"
                  : "border-border bg-background"
              }`}
              data-testid={`qa-item-${item.id}`}
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-snug" data-testid={`qa-question-${item.id}`}>
                        {item.requirement}
                      </p>
                      {item.isaReference && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                          {item.isaReference}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {QA_STATUS_OPTIONS.map((opt) => {
                      const isActive = item.status === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={readOnly}
                          onClick={() => onUpdateItem(item.id, "status", isActive ? "" : opt.value)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                            isActive ? opt.activeBg : `${opt.bg} hover:opacity-80`
                          } ${readOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                          data-testid={`qa-status-${item.id}-${opt.value}`}
                        >
                          <Icon className="h-3 w-3" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <Input
                    value={item.remarks || ""}
                    onChange={(e) => onUpdateItem(item.id, "remarks", e.target.value)}
                    placeholder="Remarks / observations..."
                    disabled={readOnly}
                    className="h-8 text-xs"
                    data-testid={`qa-remarks-${item.id}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
