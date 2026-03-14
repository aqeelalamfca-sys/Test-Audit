import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Upload, Loader2, Trash2, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface SectionAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  documentType?: string;
}

interface SuggestedDocument {
  name: string;
}

interface SectionAttachmentsProps {
  sectionId: string;
  engagementId: string;
  title?: string;
  description?: string;
  maxFiles?: number;
  suggestedDocuments?: SuggestedDocument[];
}

export function SectionAttachments({ 
  sectionId, 
  engagementId, 
  title = "Section Attachments", 
  description, 
  maxFiles = 10,
  suggestedDocuments = []
}: SectionAttachmentsProps) {
  const [attachments, setAttachments] = useState<SectionAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  if (!engagementId || engagementId === 'undefined') {
    return null;
  }

  useEffect(() => {
    const loadAttachments = async () => {
      try {
        const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
        if (response.ok) {
          const result = await response.json();
          const savedAttachments = result.data?.sectionAttachments?.[sectionId];
          if (savedAttachments && Array.isArray(savedAttachments)) {
            setAttachments(savedAttachments);
          }
        }
      } catch (error) {
        console.error("Failed to load attachments:", error);
      }
    };
    if (engagementId) {
      loadAttachments();
    }
  }, [engagementId, sectionId]);

  const saveAttachments = async (updatedAttachments: SectionAttachment[]) => {
    try {
      const loadResponse = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
      let existingData: Record<string, unknown> = {};
      if (loadResponse.ok) {
        const result = await loadResponse.json();
        if (result.data) existingData = result.data;
      }

      const sectionAttachments = (existingData.sectionAttachments as Record<string, SectionAttachment[]>) || {};
      sectionAttachments[sectionId] = updatedAttachments;

      const response = await fetchWithAuth(
        `/api/workspace/${engagementId}/pre-planning`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...existingData,
            sectionAttachments,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save attachments");
      }
    } catch (error) {
      console.error("Save attachments error:", error);
      throw error;
    }
  };

  const handleDocTypeSelect = (docType: string) => {
    setSelectedDocType(docType);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setSelectedDocType(null);
      return;
    }

    if (attachments.length + files.length > maxFiles) {
      toast({
        title: "Too Many Files",
        description: `Maximum ${maxFiles} files allowed per section`,
        variant: "destructive",
      });
      setSelectedDocType(null);
      return;
    }

    setIsUploading(true);
    try {
      const newAttachments: SectionAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        newAttachments.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: "Current User",
          documentType: selectedDocType || undefined,
        });
      }

      const updatedAttachments = [...attachments, ...newAttachments];
      await saveAttachments(updatedAttachments);
      setAttachments(updatedAttachments);
      
      toast({
        title: "Files Attached",
        description: `${files.length} file(s) attached successfully`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to attach files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setSelectedDocType(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      const updatedAttachments = attachments.filter(a => a.id !== attachmentId);
      await saveAttachments(updatedAttachments);
      setAttachments(updatedAttachments);
      toast({
        title: "File Removed",
        description: "Attachment removed successfully",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to remove attachment",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getAttachmentsForDocType = (docName: string) => {
    return attachments.filter(a => a.documentType === docName);
  };

  const getUnassignedAttachments = () => {
    return attachments.filter(a => !a.documentType);
  };

  const totalAttachments = attachments.length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          {totalAttachments > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalAttachments} file{totalAttachments !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        
        {suggestedDocuments.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isUploading || attachments.length >= maxFiles}
                data-testid={`button-upload-${sectionId}`}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Select document type:
              </div>
              <DropdownMenuSeparator />
              {suggestedDocuments.map((doc, index) => {
                const existingCount = getAttachmentsForDocType(doc.name).length;
                return (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => handleDocTypeSelect(doc.name)}
                    className="flex items-center justify-between"
                    data-testid={`dropdown-doc-${sectionId}-${index}`}
                  >
                    <span className="flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      {doc.name}
                    </span>
                    {existingCount > 0 && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        {existingCount}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDocTypeSelect("Other")}
                data-testid={`dropdown-doc-${sectionId}-other`}
              >
                <span className="flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  Other document
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || attachments.length >= maxFiles}
            data-testid={`button-upload-${sectionId}`}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Upload
          </Button>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          data-testid={`input-file-${sectionId}`}
        />
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {suggestedDocuments.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2">Suggested documents:</p>
          <div className="space-y-2">
            {suggestedDocuments.map((doc, index) => {
              const docAttachments = getAttachmentsForDocType(doc.name);
              const hasAttachments = docAttachments.length > 0;
              
              return (
                <div key={index} className="space-y-1">
                  <div 
                    className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-sm ${
                      hasAttachments 
                        ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" 
                        : "bg-muted/30"
                    }`}
                    data-testid={`suggested-doc-${sectionId}-${index}`}
                  >
                    {hasAttachments ? (
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={hasAttachments ? "text-green-700 dark:text-green-300 font-medium" : "text-foreground"}>
                      {doc.name}
                    </span>
                    {hasAttachments && (
                      <Badge variant="secondary" className="text-xs ml-auto bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300">
                        {docAttachments.length} attached
                      </Badge>
                    )}
                  </div>
                  
                  {docAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between py-1.5 px-2 ml-6 rounded-md bg-muted/50 hover:bg-muted transition-colors border-l-2 border-green-400"
                      data-testid={`attachment-item-${attachment.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate" title={attachment.fileName}>
                            {attachment.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.fileSize)} • {formatDate(attachment.uploadedAt)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(attachment.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-7 w-7 p-0"
                        data-testid={`button-delete-attachment-${attachment.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {getUnassignedAttachments().length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Other uploaded files:</p>
          {getUnassignedAttachments().map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
              data-testid={`attachment-item-${attachment.id}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" title={attachment.fileName}>
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.fileSize)} • {formatDate(attachment.uploadedAt)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(attachment.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                data-testid={`button-delete-attachment-${attachment.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && suggestedDocuments.length === 0 && (
        <div className="text-center py-2 text-xs text-muted-foreground border border-dashed rounded-md">
          No files attached. Click upload to add supporting documents.
        </div>
      )}
    </div>
  );
}

export default SectionAttachments;
