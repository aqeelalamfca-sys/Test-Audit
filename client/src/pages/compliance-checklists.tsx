import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Plus,
  Save,
  Loader2,
  Trash2,
  ListChecks,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  MinusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  ref: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "NOT_APPLICABLE";
  notes?: string;
  evidence?: string;
  lawRegulation?: string;
  sectionRule?: string;
  applicability?: string;
  complianceRequirement?: string;
  complianceStatus?: string;
  remarks?: string;
}

interface ComplianceChecklist {
  id: string;
  engagementId: string;
  checklistType: string;
  checklistReference: string;
  items: ChecklistItem[];
  totalItems: number;
  completedItems: number;
  notApplicableItems: number;
  isComplete: boolean;
  preparedBy?: { id: string; fullName: string } | null;
  preparedDate?: string | null;
  reviewedBy?: { id: string; fullName: string } | null;
  reviewedDate?: string | null;
  partnerApprovedBy?: { id: string; fullName: string } | null;
  partnerApprovalDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

const CHECKLIST_TYPE_LABELS: Record<string, string> = {
  COMPANIES_ACT_2017: "Companies Act 2017",
  FBR_TAX_COMPLIANCE: "FBR Tax Compliance",
  FBR_WHT_RECONCILIATION: "FBR WHT Reconciliation",
  FBR_NTN_VERIFICATION: "FBR NTN Verification",
  SECP_COMPLIANCE: "SECP Compliance",
  SECP_XBRL_READINESS: "SECP XBRL Readiness",
  ISA_DOCUMENTATION: "ISA Documentation",
  ISQM_QUALITY_CONTROL: "ISQM Quality Control",
  CUSTOM: "Custom Checklist",
};

const STATUS_CONFIG = {
  PENDING: { label: "Pending", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
  IN_PROGRESS: { label: "In Progress", icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
  NOT_APPLICABLE: { label: "N/A", icon: MinusCircle, color: "text-gray-400", bg: "bg-gray-50 dark:bg-gray-950/20" },
};

const COMPLIANCE_STATUS_OPTIONS = [
  "Compliant",
  "Non-Compliant",
  "Partially Compliant",
  "Not Applicable",
  "Under Review",
];

const APPLICABILITY_OPTIONS = [
  "Applicable",
  "Not Applicable",
  "Conditionally Applicable",
];

function emptyItem(srNo: number): ChecklistItem {
  return {
    ref: String(srNo),
    description: "",
    status: "PENDING",
    lawRegulation: "",
    sectionRule: "",
    applicability: "Applicable",
    complianceRequirement: "",
    complianceStatus: "Pending",
    evidence: "",
    remarks: "",
  };
}

export default function ComplianceChecklistsPage() {
  const params = useParams<{ engagementId: string }>();
  const engagementId = params.engagementId || "";
  const { user } = useAuth();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [newChecklistType, setNewChecklistType] = useState("COMPANIES_ACT_2017");
  const [newChecklistRef, setNewChecklistRef] = useState("");
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<Record<string, ChecklistItem[]>>({});
  const [hasUnsaved, setHasUnsaved] = useState<Record<string, boolean>>({});

  const { data: checklists, isLoading } = useQuery<ComplianceChecklist[]>({
    queryKey: ["/api/compliance/checklists", engagementId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/compliance/checklists/${engagementId}`);
      return res.json();
    },
    enabled: !!engagementId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ checklistType, checklistReference, items }: { checklistType: string; checklistReference: string; items: ChecklistItem[] }) => {
      const res = await apiRequest("POST", `/api/compliance/checklists/${engagementId}`, {
        checklistType,
        checklistReference,
        items,
      });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists", engagementId] });
      toast({ title: "Checklist saved successfully" });
      setHasUnsaved((prev) => ({ ...prev, [vars.checklistType]: false }));
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save checklist", variant: "destructive" });
    },
  });

  const handleCreateChecklist = () => {
    if (!newChecklistRef.trim()) {
      toast({ title: "Please provide a checklist reference", variant: "destructive" });
      return;
    }

    const existing = checklists?.find((c) => c.checklistType === newChecklistType);
    if (existing) {
      toast({ title: "A checklist of this type already exists", variant: "destructive" });
      return;
    }

    const initialItems: ChecklistItem[] = Array.from({ length: 5 }, (_, i) => emptyItem(i + 1));

    saveMutation.mutate({
      checklistType: newChecklistType,
      checklistReference: newChecklistRef,
      items: initialItems,
    });

    setCreateOpen(false);
    setNewChecklistType("COMPANIES_ACT_2017");
    setNewChecklistRef("");
  };

  const getItems = (checklist: ComplianceChecklist): ChecklistItem[] => {
    return editingItems[checklist.checklistType] || (checklist.items as ChecklistItem[]) || [];
  };

  const updateItem = (checklistType: string, checklist: ComplianceChecklist, index: number, field: keyof ChecklistItem, value: string) => {
    const items = [...getItems(checklist)];
    items[index] = { ...items[index], [field]: value };
    setEditingItems((prev) => ({ ...prev, [checklistType]: items }));
    setHasUnsaved((prev) => ({ ...prev, [checklistType]: true }));
  };

  const addRow = (checklistType: string, checklist: ComplianceChecklist) => {
    const items = [...getItems(checklist)];
    items.push(emptyItem(items.length + 1));
    setEditingItems((prev) => ({ ...prev, [checklistType]: items }));
    setHasUnsaved((prev) => ({ ...prev, [checklistType]: true }));
  };

  const removeRow = (checklistType: string, checklist: ComplianceChecklist, index: number) => {
    const items = [...getItems(checklist)];
    items.splice(index, 1);
    items.forEach((item, i) => { item.ref = String(i + 1); });
    setEditingItems((prev) => ({ ...prev, [checklistType]: items }));
    setHasUnsaved((prev) => ({ ...prev, [checklistType]: true }));
  };

  const saveChecklist = (checklist: ComplianceChecklist) => {
    const items = getItems(checklist);
    saveMutation.mutate({
      checklistType: checklist.checklistType,
      checklistReference: checklist.checklistReference,
      items,
    });
  };

  const toggleExpand = (checklistType: string) => {
    setExpandedChecklist((prev) => (prev === checklistType ? null : checklistType));
  };

  const availableTypes = Object.keys(CHECKLIST_TYPE_LABELS).filter(
    (t) => !checklists?.some((c) => c.checklistType === t)
  );

  const summary = useMemo(() => {
    if (!checklists) return { total: 0, complete: 0, items: 0, completed: 0 };
    return {
      total: checklists.length,
      complete: checklists.filter((c) => c.isComplete).length,
      items: checklists.reduce((sum, c) => sum + c.totalItems, 0),
      completed: checklists.reduce((sum, c) => sum + c.completedItems, 0),
    };
  }, [checklists]);

  return (
    <div className="px-5 py-3 space-y-3 max-w-[1400px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Compliance Checklists</h1>
          <span className="text-xs text-muted-foreground">
            {summary.total} checklist{summary.total !== 1 ? "s" : ""} · {summary.completed}/{summary.items} items done
          </span>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5" disabled={availableTypes.length === 0}>
          <Plus className="h-4 w-4" />
          Add Checklist
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !checklists || checklists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <ListChecks className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <h3 className="text-base font-semibold">No checklists yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Add compliance checklists for regulatory requirements
            </p>
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Checklist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {checklists.map((checklist) => {
            const isExpanded = expandedChecklist === checklist.checklistType;
            const items = getItems(checklist);
            const progress = checklist.totalItems > 0 ? Math.round(((checklist.completedItems + checklist.notApplicableItems) / checklist.totalItems) * 100) : 0;

            return (
              <Card key={checklist.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(checklist.checklistType)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <h3 className="font-medium text-sm">
                        {CHECKLIST_TYPE_LABELS[checklist.checklistType] || checklist.checklistType}
                      </h3>
                      <p className="text-xs text-muted-foreground">{checklist.checklistReference}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10">{progress}%</span>
                    </div>
                    <Badge variant={checklist.isComplete ? "default" : "outline"} className="text-xs">
                      {checklist.isComplete ? "Complete" : `${checklist.completedItems}/${checklist.totalItems}`}
                    </Badge>
                    {hasUnsaved[checklist.checklistType] && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Unsaved</Badge>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-left">
                            <th className="px-3 py-2 font-medium text-xs w-14">Sr. No.</th>
                            <th className="px-3 py-2 font-medium text-xs min-w-[140px]">Law / Regulation</th>
                            <th className="px-3 py-2 font-medium text-xs min-w-[120px]">Section / Rule</th>
                            <th className="px-3 py-2 font-medium text-xs min-w-[120px]">Applicability</th>
                            <th className="px-3 py-2 font-medium text-xs min-w-[180px]">Compliance Requirement</th>
                            <th className="px-3 py-2 font-medium text-xs min-w-[130px]">Compliance Status</th>
                            <th className="px-3 py-2 font-medium text-xs min-w-[140px]">Evidence</th>
                            <th className="px-3 py-2 font-medium text-xs min-w-[140px]">Remarks</th>
                            <th className="px-3 py-2 font-medium text-xs w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={idx} className="border-t hover:bg-muted/20">
                              <td className="px-3 py-1.5 text-center text-xs text-muted-foreground font-mono">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-1.5">
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="e.g. Companies Act 2017"
                                  value={item.lawRegulation || ""}
                                  onChange={(e) => updateItem(checklist.checklistType, checklist, idx, "lawRegulation", e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="e.g. Section 223"
                                  value={item.sectionRule || ""}
                                  onChange={(e) => updateItem(checklist.checklistType, checklist, idx, "sectionRule", e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <Select
                                  value={item.applicability || "Applicable"}
                                  onValueChange={(v) => updateItem(checklist.checklistType, checklist, idx, "applicability", v)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {APPLICABILITY_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-1.5">
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Describe requirement..."
                                  value={item.complianceRequirement || ""}
                                  onChange={(e) => updateItem(checklist.checklistType, checklist, idx, "complianceRequirement", e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <Select
                                  value={item.complianceStatus || "Pending"}
                                  onValueChange={(v) => {
                                    updateItem(checklist.checklistType, checklist, idx, "complianceStatus", v);
                                    const statusMap: Record<string, ChecklistItem["status"]> = {
                                      "Compliant": "COMPLETED",
                                      "Non-Compliant": "IN_PROGRESS",
                                      "Partially Compliant": "IN_PROGRESS",
                                      "Not Applicable": "NOT_APPLICABLE",
                                      "Under Review": "PENDING",
                                    };
                                    updateItem(checklist.checklistType, checklist, idx, "status", statusMap[v] || "PENDING");
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {COMPLIANCE_STATUS_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-1.5">
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Reference evidence..."
                                  value={item.evidence || ""}
                                  onChange={(e) => updateItem(checklist.checklistType, checklist, idx, "evidence", e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Remarks..."
                                  value={item.remarks || ""}
                                  onChange={(e) => updateItem(checklist.checklistType, checklist, idx, "remarks", e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeRow(checklist.checklistType, checklist, idx)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between p-3 border-t bg-muted/20">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => addRow(checklist.checklistType, checklist)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Row
                      </Button>
                      <div className="flex items-center gap-2">
                        {checklist.preparedBy && (
                          <span className="text-xs text-muted-foreground">
                            Prepared by: {checklist.preparedBy.fullName}
                          </span>
                        )}
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => saveChecklist(checklist)}
                          disabled={saveMutation.isPending}
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Add Compliance Checklist
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Checklist Type</Label>
              <Select value={newChecklistType} onValueChange={setNewChecklistType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CHECKLIST_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Reference / Title</Label>
              <Input
                placeholder="e.g. Companies Act 2017 — Annual Compliance"
                value={newChecklistRef}
                onChange={(e) => setNewChecklistRef(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateChecklist}
              disabled={!newChecklistRef.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
