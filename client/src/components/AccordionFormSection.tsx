import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Upload, FileText, RefreshCw, Eye, CalendarIcon, Trash2, CheckCircle2, User, Lock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export interface FormSectionItem {
  id: string;
  refNo: string;
  title: string;
  content: string;
  attachment: string;
  attachmentName: string;
  remarks: string;
  verifiedBy: string;
  verificationDate: string;
}

interface AccordionFormSectionProps {
  title: string;
  description?: string;
  items: FormSectionItem[];
  onItemsChange: (items: FormSectionItem[]) => void;
  icon?: React.ReactNode;
}

export function AccordionFormSection({ title, description, items, onItemsChange, icon }: AccordionFormSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<FormSectionItem>>({
    refNo: "",
    title: "",
    content: "",
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
      const match = item.refNo.match(/SEC-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
    const nextNum = Math.max(0, ...existingNums) + 1;
    return `SEC-${String(nextNum).padStart(3, '0')}`;
  };

  const handleAddItem = () => {
    const item: FormSectionItem = {
      id: `section-${Date.now()}`,
      refNo: newItem.refNo || generateRefNo(),
      title: newItem.title || "",
      content: newItem.content || "",
      attachment: newItem.attachment || "",
      attachmentName: newItem.attachmentName || "",
      remarks: newItem.remarks || "",
      verifiedBy: "",
      verificationDate: ""
    };
    onItemsChange([...items, item]);
    setNewItem({
      refNo: "",
      title: "",
      content: "",
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

  const handleContentChange = (id: string, content: string) => {
    onItemsChange(items.map(item => item.id === id ? { ...item, content } : item));
  };

  const handleRemarksChange = (id: string, remarks: string) => {
    onItemsChange(items.map(item => item.id === id ? { ...item, remarks } : item));
  };

  const handleVerify = (id: string) => {
    onItemsChange(items.map(item => {
      if (item.id !== id) return item;
      if (item.verifiedBy && item.verificationDate) return item;
      return {
        ...item,
        verifiedBy: currentUserName,
        verificationDate: format(new Date(), "yyyy-MM-dd")
      };
    }));
  };

  const handleFileUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      onItemsChange(items.map(item => 
        item.id === id ? { ...item, attachment: reader.result as string, attachmentName: file.name } : item
      ));
    };
    reader.readAsDataURL(file);
  };

  const handleViewAttachment = (item: FormSectionItem) => {
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

  const completedCount = items.filter(item => item.verifiedBy && item.verificationDate).length;
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
        <Accordion type="multiple" className="w-full">
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <span className="font-mono text-xs text-muted-foreground">{item.refNo}</span>
                  <span>{item.title}</span>
                  {item.verifiedBy && item.verificationDate && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-2" />
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <input
                    type="file"
                    ref={(el) => { fileInputRefs.current[item.id] = el; }}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(item.id, file);
                    }}
                  />
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Content / Analysis</Label>
                    <Textarea
                      value={item.content}
                      onChange={(e) => handleContentChange(item.id, e.target.value)}
                      placeholder="Enter detailed analysis, notes, and findings..."
                      rows={6}
                      className="resize-y min-h-[150px]"
                      data-testid={`textarea-content-${item.id}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Remarks</Label>
                    <Textarea
                      value={item.remarks}
                      onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                      placeholder="Additional remarks or notes..."
                      rows={2}
                      className="resize-y"
                      data-testid={`textarea-remarks-${item.id}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Attachment</Label>
                      <div className="flex items-center gap-2">
                        {item.attachment ? (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8"
                              onClick={() => handleViewAttachment(item)}
                              data-testid={`btn-view-attachment-${item.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8"
                              onClick={() => triggerFileInput(item.id)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Replace
                            </Button>
                            <span className="text-xs text-muted-foreground truncate max-w-[80px]" title={item.attachmentName}>
                              {item.attachmentName}
                            </span>
                          </>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-8"
                            onClick={() => triggerFileInput(item.id)}
                            data-testid={`btn-upload-${item.id}`}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1 text-xs font-medium">
                        Verified By <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                      </Label>
                      <VerificationStamp value={item.verifiedBy} type="user" testId={`stamp-verified-by-${item.id}`} />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1 text-xs font-medium">
                        Verification Date <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                      </Label>
                      <VerificationStamp value={item.verificationDate} type="date" testId={`stamp-verification-date-${item.id}`} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Actions</Label>
                      <div className="flex items-center gap-2">
                        {!(item.verifiedBy && item.verificationDate) && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => handleVerify(item.id)}
                            data-testid={`btn-verify-${item.id}`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Verify
                          </Button>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8" data-testid={`btn-view-${item.id}`}>
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{item.refNo} - {item.title}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-muted-foreground text-xs">Content</Label>
                                <p className="whitespace-pre-wrap text-sm">{item.content || "No content"}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Remarks</Label>
                                <p className="text-sm">{item.remarks || "No remarks"}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-xs">Attachment</Label>
                                {item.attachment ? (
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm">{item.attachmentName}</span>
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground text-sm">No attachment</p>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-muted-foreground text-xs">Verified By</Label>
                                  <p className="text-sm" data-testid={`view-verified-by-${item.id}`}>{item.verifiedBy || "-"}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground text-xs">Verification Date</Label>
                                  <p className="text-sm" data-testid={`view-verification-date-${item.id}`}>{item.verificationDate ? format(new Date(item.verificationDate), "dd/MM/yyyy") : "-"}</p>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                          data-testid={`btn-delete-${item.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-4 w-full" data-testid="btn-add-section" onClick={() => {
              setNewItem({
                refNo: generateRefNo(),
                title: "",
                content: "",
                attachment: "",
                attachmentName: "",
                remarks: "",
                verifiedBy: "",
                verificationDate: ""
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add More Section
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Section</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ref No. <span className="text-destructive">*</span></Label>
                  <Input 
                    value={newItem.refNo} 
                    onChange={(e) => setNewItem({...newItem, refNo: e.target.value})}
                    placeholder="SEC-001"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Section Title <span className="text-destructive">*</span></Label>
                <Input 
                  value={newItem.title} 
                  onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                  placeholder="e.g., Industry Analysis Summary (ISA 315.11)"
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Content</Label>
                <Textarea 
                  value={newItem.content} 
                  onChange={(e) => setNewItem({...newItem, content: e.target.value})}
                  placeholder="Enter initial content or notes..."
                  rows={4}
                />
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border border-dashed">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Verified By and Verification Date will be auto-stamped when you click Verify
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleAddItem} disabled={!newItem.title} data-testid="btn-confirm-add-section">Add Section</Button>
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

export function createDefaultFormSectionItems(items: { refNo: string; title: string; placeholder?: string }[]): FormSectionItem[] {
  return items.map((item, index) => ({
    id: `section-${index}`,
    refNo: item.refNo,
    title: item.title,
    content: "",
    attachment: "",
    attachmentName: "",
    remarks: "",
    verifiedBy: "",
    verificationDate: ""
  }));
}
