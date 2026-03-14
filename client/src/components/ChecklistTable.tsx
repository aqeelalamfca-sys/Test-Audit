import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Eye, Pencil, Trash2, Upload, FileText, RefreshCw, CheckCircle2, CalendarIcon, User, Lock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export type ChecklistStatus = "not-started" | "in-progress" | "completed" | "failed" | "na";

export interface ChecklistItem {
  id: string;
  refNo: string;
  checkItem: string;
  status: ChecklistStatus;
  attachment: string;
  attachmentName: string;
  remarks: string;
  verifiedBy: string;
  verificationDate: string;
}

interface ChecklistTableProps {
  title: string;
  description?: string;
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
  icon?: React.ReactNode;
  teamMembers?: { id: string; name: string; role: string }[];
}

const statusOptions: { value: ChecklistStatus; label: string; color: string }[] = [
  { value: "not-started", label: "Not Started", color: "text-gray-500" },
  { value: "in-progress", label: "In Progress", color: "text-blue-500" },
  { value: "completed", label: "Completed", color: "text-green-500" },
  { value: "failed", label: "Failed", color: "text-red-500" },
  { value: "na", label: "N/A", color: "text-gray-400" },
];

const getStatusColor = (status: ChecklistStatus) => {
  const option = statusOptions.find(s => s.value === status);
  return option?.color || "text-gray-500";
};

const getStatusLabel = (status: ChecklistStatus) => {
  const option = statusOptions.find(s => s.value === status);
  return option?.label || "Not Started";
};

export function ChecklistTable({ title, description, items, onItemsChange, icon }: ChecklistTableProps) {
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<ChecklistItem>>({
    refNo: "",
    checkItem: "",
    status: "not-started",
    attachment: "",
    attachmentName: "",
    remarks: "",
    verifiedBy: "",
    verificationDate: ""
  });
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const { user } = useAuth();

  const currentUserName = user?.fullName || user?.email || "Unknown User";

  const generateRefNo = () => {
    const existingNums = items.map(item => {
      const match = item.refNo.match(/CHK-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
    const nextNum = Math.max(0, ...existingNums) + 1;
    return `CHK-${String(nextNum).padStart(3, '0')}`;
  };

  const handleAddItem = () => {
    const isVerified = newItem.status === "completed";
    const item: ChecklistItem = {
      id: `item-${Date.now()}`,
      refNo: newItem.refNo || generateRefNo(),
      checkItem: newItem.checkItem || "",
      status: newItem.status as ChecklistStatus || "not-started",
      attachment: newItem.attachment || "",
      attachmentName: newItem.attachmentName || "",
      remarks: newItem.remarks || "",
      verifiedBy: isVerified ? currentUserName : "",
      verificationDate: isVerified ? format(new Date(), "yyyy-MM-dd") : ""
    };
    onItemsChange([...items, item]);
    setNewItem({
      refNo: "",
      checkItem: "",
      status: "not-started",
      attachment: "",
      attachmentName: "",
      remarks: "",
      verifiedBy: "",
      verificationDate: ""
    });
    setIsAddDialogOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;
    const updatedItems = items.map(item => 
      item.id === editingItem.id ? editingItem : item
    );
    onItemsChange(updatedItems);
    setEditingItem(null);
  };

  const handleStatusChange = (id: string, status: ChecklistStatus) => {
    const updatedItems = items.map(item => {
      if (item.id !== id) return item;
      if (status === "completed" && !item.verifiedBy) {
        return {
          ...item,
          status,
          verifiedBy: currentUserName,
          verificationDate: format(new Date(), "yyyy-MM-dd")
        };
      }
      if (status !== "completed") {
        return { ...item, status, verifiedBy: "", verificationDate: "" };
      }
      return { ...item, status };
    });
    onItemsChange(updatedItems);
  };

  const handleRemarksChange = (id: string, remarks: string) => {
    const updatedItems = items.map(item => 
      item.id === id ? { ...item, remarks } : item
    );
    onItemsChange(updatedItems);
  };

  const handleFileUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const updatedItems = items.map(item => 
        item.id === id ? { 
          ...item, 
          attachment: reader.result as string,
          attachmentName: file.name 
        } : item
      );
      onItemsChange(updatedItems);
    };
    reader.readAsDataURL(file);
  };

  const handleViewAttachment = (item: ChecklistItem) => {
    if (item.attachment) {
      const link = document.createElement('a');
      link.href = item.attachment;
      link.download = item.attachmentName || 'attachment';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const triggerFileInput = (id: string) => {
    fileInputRefs.current[id]?.click();
  };

  const completedCount = items.filter(item => item.status === "completed" || item.status === "na").length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              {description && <CardDescription className="text-xs">{description}</CardDescription>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>{completedCount}/{items.length} ({progressPercent}%)</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px] whitespace-nowrap">Ref No.</TableHead>
                <TableHead className="min-w-[200px]">Check Item</TableHead>
                <TableHead className="w-[130px] whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[160px] whitespace-nowrap">Attachment</TableHead>
                <TableHead className="min-w-[180px]">Remarks</TableHead>
                <TableHead className="w-[150px] whitespace-nowrap">Verified By</TableHead>
                <TableHead className="w-[150px] whitespace-nowrap">Verification Date</TableHead>
                <TableHead className="w-[100px] text-center whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-2">
                    No checklist items. Click "Add More Line" to add items.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.refNo}</TableCell>
                    <TableCell className="text-sm">{item.checkItem}</TableCell>
                    <TableCell>
                      <Select 
                        value={item.status} 
                        onValueChange={(v) => handleStatusChange(item.id, v as ChecklistStatus)}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-status-${item.id}`}>
                          <SelectValue>
                            <span className={getStatusColor(item.status)}>
                              {getStatusLabel(item.status)}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className={opt.color}>{opt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <input
                        type="file"
                        ref={(el) => { fileInputRefs.current[item.id] = el; }}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(item.id, file);
                        }}
                      />
                      <div className="flex items-center gap-1">
                        {item.attachment ? (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => handleViewAttachment(item)}
                              title="View attachment"
                            >
                              <FileText className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => triggerFileInput(item.id)}
                              title="Replace attachment"
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-orange-500" />
                            </Button>
                            <span className="text-xs text-muted-foreground truncate max-w-[60px]" title={item.attachmentName}>
                              {item.attachmentName}
                            </span>
                          </>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => triggerFileInput(item.id)}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.remarks}
                        onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                        placeholder="Enter remarks..."
                        className="h-8 text-sm"
                        data-testid={`input-remarks-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <VerificationStamp value={item.verifiedBy} type="user" testId={`stamp-verified-by-${item.id}`} />
                    </TableCell>
                    <TableCell>
                      <VerificationStamp value={item.verificationDate} type="date" testId={`stamp-verification-date-${item.id}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`btn-view-${item.id}`}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>View Checklist Item</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <Label className="text-muted-foreground text-xs">Ref No.</Label>
                                  <p className="font-mono">{item.refNo}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground text-xs">Status</Label>
                                  <p className={getStatusColor(item.status)}>{getStatusLabel(item.status)}</p>
                                </div>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Check Item</Label>
                                <p>{item.checkItem}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Attachment</Label>
                                {item.attachment ? (
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-blue-500" />
                                    <span>{item.attachmentName}</span>
                                    <Button size="sm" variant="ghost" className="text-blue-500 hover:text-blue-600 p-0 h-auto" onClick={() => handleViewAttachment(item)}>
                                      View/Download
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground">No attachment</p>
                                )}
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Remarks</Label>
                                <p>{item.remarks || "No remarks"}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <Label className="text-muted-foreground text-xs">Verified By</Label>
                                  <p data-testid={`view-verified-by-${item.id}`}>{item.verifiedBy || "-"}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground text-xs">Verification Date</Label>
                                  <p data-testid={`view-verification-date-${item.id}`}>{item.verificationDate ? format(new Date(item.verificationDate), "dd/MM/yyyy") : "-"}</p>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem({...item})} data-testid={`btn-edit-${item.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Checklist Item</DialogTitle>
                            </DialogHeader>
                            {editingItem && (
                              <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div className="space-y-2">
                                    <Label>Ref No.</Label>
                                    <Input 
                                      value={editingItem.refNo} 
                                      onChange={(e) => setEditingItem({...editingItem, refNo: e.target.value})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select 
                                      value={editingItem.status} 
                                      onValueChange={(v) => {
                                        const newStatus = v as ChecklistStatus;
                                        if (newStatus === "completed" && !editingItem.verifiedBy) {
                                          setEditingItem({
                                            ...editingItem,
                                            status: newStatus,
                                            verifiedBy: currentUserName,
                                            verificationDate: format(new Date(), "yyyy-MM-dd")
                                          });
                                        } else if (newStatus !== "completed") {
                                          setEditingItem({
                                            ...editingItem,
                                            status: newStatus,
                                            verifiedBy: "",
                                            verificationDate: ""
                                          });
                                        } else {
                                          setEditingItem({...editingItem, status: newStatus});
                                        }
                                      }}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {statusOptions.map(opt => (
                                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Check Item</Label>
                                  <Textarea 
                                    value={editingItem.checkItem} 
                                    onChange={(e) => setEditingItem({...editingItem, checkItem: e.target.value})}
                                    rows={2}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Remarks</Label>
                                  <Textarea 
                                    value={editingItem.remarks} 
                                    onChange={(e) => setEditingItem({...editingItem, remarks: e.target.value})}
                                    rows={2}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div className="space-y-2">
                                    <Label className="flex items-center gap-1">Verified By <Lock className="h-3 w-3 text-muted-foreground" /></Label>
                                    <VerificationStamp value={editingItem.verifiedBy} type="user" testId="edit-verified-by" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="flex items-center gap-1">Verification Date <Lock className="h-3 w-3 text-muted-foreground" /></Label>
                                    <VerificationStamp value={editingItem.verificationDate} type="date" testId="edit-verification-date" />
                                  </div>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button onClick={handleUpdateItem}>Save Changes</Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                          data-testid={`btn-delete-${item.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-2.5 w-full" data-testid="btn-add-checklist-item" onClick={() => {
              setNewItem({
                refNo: generateRefNo(),
                checkItem: "",
                status: "not-started",
                attachment: "",
                attachmentName: "",
                remarks: "",
                verifiedBy: "",
                verificationDate: ""
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add More Line
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Checklist Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-2">
                  <Label>Ref No. <span className="text-destructive">*</span></Label>
                  <Input 
                    value={newItem.refNo} 
                    onChange={(e) => setNewItem({...newItem, refNo: e.target.value})}
                    placeholder="CHK-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={newItem.status} 
                    onValueChange={(v) => setNewItem({...newItem, status: v as ChecklistStatus})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Check Item <span className="text-destructive">*</span></Label>
                <Textarea 
                  value={newItem.checkItem} 
                  onChange={(e) => setNewItem({...newItem, checkItem: e.target.value})}
                  placeholder="Brief description of what to check"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea 
                  value={newItem.remarks} 
                  onChange={(e) => setNewItem({...newItem, remarks: e.target.value})}
                  placeholder="Notes or remarks"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-3 bg-muted/30 rounded-lg border border-dashed">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> Verified By
                  </Label>
                  <p className="text-xs text-muted-foreground" data-testid="add-verified-by-hint">
                    {newItem.status === "completed" ? currentUserName : "Auto-stamped on completion"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> Verification Date
                  </Label>
                  <p className="text-xs text-muted-foreground" data-testid="add-verification-date-hint">
                    {newItem.status === "completed" ? format(new Date(), "dd/MM/yyyy") : "Auto-stamped on completion"}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleAddItem} disabled={!newItem.checkItem} data-testid="btn-confirm-add-item">Add Item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function VerificationStamp({ value, type, testId }: { value: string; type: "user" | "date"; testId: string }) {
  if (!value) {
    return (
      <div className="flex items-center gap-1 h-8 px-2 rounded-md bg-muted/50 border border-dashed text-xs text-muted-foreground" data-testid={testId}>
        {type === "user" ? <User className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
        <span>Auto-stamped</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 h-8 px-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs font-medium text-green-700 dark:text-green-300" data-testid={testId}>
      {type === "user" ? <User className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
      <span className="truncate max-w-[100px]" title={type === "date" && value ? format(new Date(value), "dd/MM/yyyy") : value}>
        {type === "date" && value ? format(new Date(value), "dd/MM/yyyy") : value}
      </span>
      <Lock className="h-2.5 w-2.5 ml-auto flex-shrink-0 opacity-50" />
    </div>
  );
}

export function createDefaultChecklistItems(items: { refNo: string; checkItem: string }[]): ChecklistItem[] {
  return items.map((item, index) => ({
    id: `item-${index}`,
    refNo: item.refNo,
    checkItem: item.checkItem,
    status: "not-started" as ChecklistStatus,
    attachment: "",
    attachmentName: "",
    remarks: "",
    verifiedBy: "",
    verificationDate: ""
  }));
}
