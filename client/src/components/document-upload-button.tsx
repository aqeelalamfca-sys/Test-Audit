import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Check, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface DocumentUploadButtonProps {
  documentType: string;
  engagementId: string;
  onUploadComplete?: (fileName: string) => void;
}

interface UploadedDocument {
  id: string;
  fileName: string;
  fileReference: string;
  filePath: string;
  fileSize: number;
  createdAt: string;
}

export function DocumentUploadButton({ 
  documentType, 
  engagementId,
  onUploadComplete 
}: DocumentUploadButtonProps) {
  const [uploadedFile, setUploadedFile] = useState<UploadedDocument | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load existing document on mount
  useEffect(() => {
    const loadExistingDocument = async () => {
      try {
        const response = await fetchWithAuth(
          `/api/documents/${engagementId}?documentType=${encodeURIComponent(documentType)}`
        );
        if (response.ok) {
          const documents = await response.json();
          if (documents && documents.length > 0) {
            setUploadedFile(documents[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load existing document:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingDocument();
  }, [engagementId, documentType]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, Word, Excel, or image files only.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);
      formData.append("engagementId", engagementId);

      const response = await fetchWithAuth("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const newDoc: UploadedDocument = {
          id: result.document.id,
          fileName: file.name,
          fileReference: result.document.fileReference || "",
          filePath: "",
          fileSize: file.size,
          createdAt: new Date().toISOString()
        };
        setUploadedFile(newDoc);
        toast({
          title: "Uploaded",
          description: `${file.name} uploaded successfully.`
        });
        onUploadComplete?.(file.name);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!uploadedFile) return;

    try {
      const response = await fetchWithAuth(`/api/documents/${uploadedFile.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUploadedFile(null);
        toast({
          title: "Removed",
          description: "Document removed successfully."
        });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove document.",
        variant: "destructive"
      });
    }
  };

  const handleDownload = async () => {
    if (!uploadedFile) return;
    
    try {
      const downloadUrl = `/api/documents/download/${uploadedFile.id}`;
      const response = await fetchWithAuth(downloadUrl);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const finalBlob = blob.type && blob.type !== 'application/octet-stream' 
        ? blob 
        : new Blob([blob], { type: response.headers.get('content-type') || 'application/octet-stream' });

      const url = window.URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = uploadedFile.fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document.",
        variant: "destructive"
      });
    }
  };

  const handlePreview = async () => {
    if (!uploadedFile) return;
    
    try {
      const downloadUrl = `/api/documents/download/${uploadedFile.id}`;
      
      const response = await fetchWithAuth(downloadUrl);
      
      if (!response.ok) {
        throw new Error("Preview failed");
      }
      
      // Get the blob directly from response
      const blob = await response.blob();
      
      // If blob type is empty or generic, use the content-type from headers
      const finalBlob = blob.type && blob.type !== 'application/octet-stream' 
        ? blob 
        : new Blob([blob], { type: response.headers.get('content-type') || 'application/octet-stream' });
      
      const url = window.URL.createObjectURL(finalBlob);
      
      // Open in new tab
      const newWindow = window.open(url, '_blank');
      
      // Cleanup after window is opened
      if (newWindow) {
        newWindow.onload = () => {
          window.URL.revokeObjectURL(url);
        };
      } else {
        window.URL.revokeObjectURL(url);
        toast({
          title: "Preview Blocked",
          description: "Please allow popups to preview documents.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to preview document.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
      />
      
      {isLoading ? (
        <span className="text-xs text-muted-foreground">Loading...</span>
      ) : uploadedFile ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
            <Check className="h-3 w-3" />
            <FileText className="h-3 w-3" />
            <span className="max-w-[120px] truncate">{uploadedFile.fileName}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handlePreview}
            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-700"
            title="Preview"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDownload}
            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
            title="Download"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRemove}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            title="Remove"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleClick}
          disabled={isUploading}
        >
          <Upload className="h-3 w-3 mr-1" />
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
      )}
    </div>
  );
}
