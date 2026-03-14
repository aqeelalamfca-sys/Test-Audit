import { useState, useEffect, useCallback, useRef } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Trash2,
  Check,
  X,
  Eye,
  Loader2,
  ClipboardList,
  ListPlus,
  Sparkles,
  Download,
  Paperclip,
  Mail,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useEngagement } from "@/lib/workspace-context";
import {
  HEAD_OF_ACCOUNTS,
  TEMPLATE_OPTIONS,
  COMMON_REQUISITION_ITEMS,
  INDUSTRY_TEMPLATES,
} from "@/pages/information-requisition/data";

interface InformationRequest {
  id: string;
  srNumber: number;
  requestCode: string;
  requestTitle: string;
  headOfAccounts: string;
  description: string;
  priority: string;
  status: string;
  clientResponse?: string;
  clientResponseDate?: string;
  provided?: "YES" | "NO" | null;
  providedDate?: string;
  createdAt: string;
  attachments?: Attachment[];
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

interface EditingRow {
  id: string;
  headOfAccounts: string;
  description: string;
}

interface InformationRequestsPanelProps {
  engagementId: string;
  readOnly?: boolean;
}

export function InformationRequestsPanel({
  engagementId,
  readOnly = false,
}: InformationRequestsPanelProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const { engagement } = useEngagement();

  const [requests, setRequests] = useState<InformationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRows, setEditingRows] = useState<Map<string, EditingRow>>(
    new Map()
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRow, setNewRow] = useState({ headOfAccounts: "", description: "" });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(
    new Set()
  );
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const saveTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editingRowsRef = useRef<Map<string, EditingRow>>(new Map());
  const engagementIdRef = useRef(engagementId);
  const tokenRef = useRef(token);
  editingRowsRef.current = editingRows;
  engagementIdRef.current = engagementId;
  tokenRef.current = token;

  useEffect(() => {
    return () => {
      saveTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      saveTimeoutRef.current.clear();
    };
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!engagementId) return;
    setIsLoading(true);
    try {
      const response = await fetchWithAuth(
        `/api/engagements/${engagementId}/requisitions`
      );
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setIsLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    if (engagementId) {
      fetchRequests();
    }
  }, [engagementId, fetchRequests]);

  const handleCreateRequest = async () => {
    if (!engagementId || !newRow.headOfAccounts || !newRow.description.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please fill in Head of Accounts and Description.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetchWithAuth(
        `/api/engagements/${engagementId}/requisitions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            headOfAccounts: newRow.headOfAccounts,
            description: newRow.description,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Request Created",
          description: "Information request added successfully.",
        });
        setIsAddingNew(false);
        setNewRow({ headOfAccounts: "", description: "" });
        fetchRequests();
      } else {
        throw new Error("Failed to create request");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create information request.",
        variant: "destructive",
      });
    }
  };

  const startEditing = (request: InformationRequest) => {
    setEditingRows(
      new Map(editingRows).set(request.id, {
        id: request.id,
        headOfAccounts: request.headOfAccounts,
        description: request.description,
      })
    );
  };

  const cancelEditing = (id: string) => {
    const newMap = new Map(editingRows);
    newMap.delete(id);
    setEditingRows(newMap);
    const timeout = saveTimeoutRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      saveTimeoutRef.current.delete(id);
    }
  };

  const updateEditingField = useCallback(
    (id: string, field: keyof EditingRow, value: string) => {
      setEditingRows((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, { ...existing, [field]: value });
        }
        return newMap;
      });

      const existingTimeout = saveTimeoutRef.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        autoSaveRow(id);
      }, 800);
      saveTimeoutRef.current.set(id, timeout);
    },
    []
  );

  const autoSaveRow = async (id: string) => {
    const editData = editingRowsRef.current.get(id);
    const currentEngId = engagementIdRef.current;
    const currentToken = tokenRef.current;
    if (!editData || !currentEngId) return;

    try {
      const response = await fetchWithAuth(
        `/api/engagements/${currentEngId}/requisitions/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            headOfAccounts: editData.headOfAccounts,
            description: editData.description,
          }),
        }
      );

      if (response.ok) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  headOfAccounts: editData.headOfAccounts,
                  description: editData.description,
                }
              : r
          )
        );
      } else {
        console.error("Auto-save failed: server returned", response.status);
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  };

  const handleToggleProvided = async (
    id: string,
    currentProvided: "YES" | "NO" | null | undefined
  ) => {
    const newValue = currentProvided === "YES" ? "NO" : "YES";
    try {
      const response = await fetchWithAuth(
        `/api/engagements/${engagementId}/requisitions/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ provided: newValue }),
        }
      );

      if (response.ok) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  provided: newValue as "YES" | "NO",
                  providedDate:
                    newValue === "YES"
                      ? new Date().toISOString()
                      : r.providedDate,
                }
              : r
          )
        );
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update provided status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      const response = await fetchWithAuth(
        `/api/engagements/${engagementId}/requisitions/${id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        toast({
          title: "Deleted",
          description: "Information request removed.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete request.",
        variant: "destructive",
      });
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !engagementId) return;
    setIsApplyingTemplate(true);

    try {
      const templateItems =
        INDUSTRY_TEMPLATES[selectedTemplate] || COMMON_REQUISITION_ITEMS;
      let created = 0;

      for (const item of templateItems) {
        try {
          const response = await fetchWithAuth(
            `/api/engagements/${engagementId}/requisitions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                headOfAccounts: item.headOfAccounts,
                description: item.description,
              }),
            }
          );
          if (response.ok) created++;
        } catch {}
      }

      toast({
        title: "Template Applied",
        description: `${created} information request items added from template.`,
      });
      setSelectedTemplate("");
      fetchRequests();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply template.",
        variant: "destructive",
      });
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRequestIds.size === 0) return;
    setIsDeletingMultiple(true);

    try {
      const ids = Array.from(selectedRequestIds);
      let deleted = 0;
      for (const id of ids) {
        try {
          const response = await fetchWithAuth(
            `/api/engagements/${engagementId}/requisitions/${id}`,
            {
              method: "DELETE",
            }
          );
          if (response.ok) deleted++;
        } catch {}
      }

      toast({
        title: "Deleted",
        description: `${deleted} request(s) removed.`,
      });
      setSelectedRequestIds(new Set());
      fetchRequests();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete requests.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const toggleRequestSelection = (id: string) => {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRequestIds.size === requests.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(requests.map((r) => r.id)));
    }
  };

  const stats = {
    total: requests.length,
    provided: requests.filter((r) => r.provided === "YES").length,
    pending: requests.filter((r) => r.provided !== "YES").length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">
          Loading information requests...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="badge-ir-total">
            {stats.total} Total
          </Badge>
          <Badge
            variant="default"
            className="bg-green-600"
            data-testid="badge-ir-provided"
          >
            {stats.provided} Provided
          </Badge>
          <Badge variant="secondary" data-testid="badge-ir-pending">
            {stats.pending} Pending
          </Badge>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
            >
              <SelectTrigger
                className="w-[180px] h-8 text-xs"
                data-testid="select-ir-template"
              >
                <SelectValue placeholder="Select Template..." />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleApplyTemplate}
                disabled={isApplyingTemplate}
                data-testid="button-apply-ir-template"
              >
                {isApplyingTemplate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <ListPlus className="h-3.5 w-3.5 mr-1" />
                )}
                Apply
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setIsAddingNew(true)}
              disabled={isAddingNew}
              data-testid="button-add-ir-row"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Row
            </Button>
          </div>
        )}
      </div>

      {selectedRequestIds.size > 0 && !readOnly && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
          <span className="text-xs text-muted-foreground">
            {selectedRequestIds.size} selected
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                disabled={isDeletingMultiple}
                data-testid="button-bulk-delete-ir"
              >
                {isDeletingMultiple ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                )}
                Delete Selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Selected Requests</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedRequestIds.size}{" "}
                  selected request(s)? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  data-testid="button-confirm-bulk-delete-ir"
                >
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {!readOnly && (
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={
                      requests.length > 0 &&
                      selectedRequestIds.size === requests.length
                    }
                    onChange={toggleAllSelection}
                    className="rounded border-muted-foreground"
                    data-testid="checkbox-select-all-ir"
                  />
                </TableHead>
              )}
              <TableHead className="text-xs w-[40px]">Sr.</TableHead>
              <TableHead className="text-xs min-w-[150px]">
                Head of Accounts
              </TableHead>
              <TableHead className="text-xs min-w-[200px]">
                Description
              </TableHead>
              <TableHead className="text-xs w-[120px]">
                Client Response
              </TableHead>
              <TableHead className="text-xs w-[80px]">Provided</TableHead>
              <TableHead className="text-xs w-[80px]">Attachments</TableHead>
              {!readOnly && (
                <TableHead className="text-xs w-[80px]">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAddingNew && (
              <TableRow className="bg-primary/5">
                {!readOnly && <TableCell />}
                <TableCell className="text-xs text-muted-foreground">
                  New
                </TableCell>
                <TableCell>
                  <Select
                    value={newRow.headOfAccounts}
                    onValueChange={(v) =>
                      setNewRow({ ...newRow, headOfAccounts: v })
                    }
                  >
                    <SelectTrigger
                      className="h-8 text-xs"
                      data-testid="select-new-ir-head"
                    >
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {HEAD_OF_ACCOUNTS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={newRow.description}
                    onChange={(e) =>
                      setNewRow({ ...newRow, description: e.target.value })
                    }
                    placeholder="Enter description..."
                    className="h-8 text-xs"
                    data-testid="input-new-ir-description"
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  No response yet
                </TableCell>
                <TableCell />
                <TableCell />
                {!readOnly && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCreateRequest}
                        data-testid="button-confirm-new-ir"
                      >
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingNew(false);
                          setNewRow({ headOfAccounts: "", description: "" });
                        }}
                        data-testid="button-cancel-new-ir"
                      >
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )}
            {requests.length === 0 && !isAddingNew && (
              <TableRow>
                <TableCell
                  colSpan={readOnly ? 7 : 8}
                  className="text-center text-sm text-muted-foreground py-2"
                >
                  No information requests yet. Click "Add Row" to create one or
                  apply a template.
                </TableCell>
              </TableRow>
            )}
            {requests.map((request, index) => {
              const isEditing = editingRows.has(request.id);
              const editData = editingRows.get(request.id);

              return (
                <TableRow
                  key={request.id}
                  className={
                    selectedRequestIds.has(request.id) ? "bg-primary/5" : ""
                  }
                >
                  {!readOnly && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedRequestIds.has(request.id)}
                        onChange={() => toggleRequestSelection(request.id)}
                        className="rounded border-muted-foreground"
                        data-testid={`checkbox-ir-${request.id}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    {isEditing && editData ? (
                      <Select
                        value={editData.headOfAccounts}
                        onValueChange={(v) =>
                          updateEditingField(request.id, "headOfAccounts", v)
                        }
                      >
                        <SelectTrigger
                          className="h-8 text-xs"
                          data-testid={`select-ir-head-${request.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HEAD_OF_ACCOUNTS.map((h) => (
                            <SelectItem key={h.value} value={h.value}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className="text-xs cursor-pointer"
                        onClick={() => !readOnly && startEditing(request)}
                        data-testid={`text-ir-head-${request.id}`}
                      >
                        {request.headOfAccounts || "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing && editData ? (
                      <Input
                        value={editData.description}
                        onChange={(e) =>
                          updateEditingField(
                            request.id,
                            "description",
                            e.target.value
                          )
                        }
                        className="h-8 text-xs"
                        data-testid={`input-ir-desc-${request.id}`}
                      />
                    ) : (
                      <span
                        className="text-xs cursor-pointer"
                        onClick={() => !readOnly && startEditing(request)}
                        data-testid={`text-ir-desc-${request.id}`}
                      >
                        {request.description || "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {request.clientResponse || "No response yet"}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            !readOnly &&
                            handleToggleProvided(request.id, request.provided)
                          }
                          disabled={readOnly}
                          data-testid={`button-ir-provided-${request.id}`}
                        >
                          {request.provided === "YES" ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {request.provided === "YES"
                          ? "Provided - click to mark as not provided"
                          : "Not provided - click to mark as provided"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      <Paperclip className="h-3 w-3 mr-1" />
                      {request.attachments?.length || 0}
                    </Badge>
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => cancelEditing(request.id)}
                            data-testid={`button-ir-cancel-edit-${request.id}`}
                          >
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEditing(request)}
                            data-testid={`button-ir-edit-${request.id}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              data-testid={`button-ir-delete-${request.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Request
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this information
                                request?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <Button
                                variant="destructive"
                                onClick={() =>
                                  handleDeleteRequest(request.id)
                                }
                                data-testid={`button-confirm-ir-delete-${request.id}`}
                              >
                                Delete
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
