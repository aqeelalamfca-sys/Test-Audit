import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, FileText, Image, File, Trash2, Eye, Download, 
  FolderOpen, Tag, Calendar, User, X, Plus, CheckCircle2 
} from "lucide-react";

export interface EvidenceFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedDate: string;
  phase: string;
  section: string;
  tags: string[];
  url?: string;
}

interface EvidenceUploaderProps {
  phase: string;
  section: string;
  files: EvidenceFile[];
  onUpload: (files: FileList, tags: string[]) => void;
  onDelete?: (fileId: string) => void;
  onView?: (file: EvidenceFile) => void;
  allowedTypes?: string[];
  maxFileSize?: number;
  readOnly?: boolean;
  compact?: boolean;
}

const PHASE_OPTIONS = [
  "Pre-Planning",
  "Planning",
  "Execution",
  "Finalization",
];

const SECTION_OPTIONS: Record<string, string[]> = {
  "Pre-Planning": [
    "Engagement Setup",
    "Acceptance & Continuance",
    "Independence",
    "Ethics",
    "KYC/AML",
    "Team Allocation",
    "Engagement Letter",
    "PBC",
    "Analytics",
  ],
  Planning: ["Materiality", "Risk Assessment", "Audit Strategy"],
  Execution: ["Substantive Testing", "Controls Testing", "Sampling"],
  Finalization: ["Review", "Reporting", "Sign-off"],
};

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileText,
  xlsx: FileText,
  jpg: Image,
  jpeg: Image,
  png: Image,
  default: File,
};

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenceUploader({
  phase,
  section,
  files,
  onUpload,
  onDelete,
  onView,
  allowedTypes = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"],
  maxFileSize = 10 * 1024 * 1024,
  readOnly = false,
  compact = false,
}: EvidenceUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !readOnly) {
      onUpload(e.dataTransfer.files, selectedTags);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files, selectedTags);
    }
  };

  const addTag = (tag: string) => {
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setCustomTag("");
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const sectionFiles = files.filter((f) => f.phase === phase && f.section === section);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>{sectionFiles.length} file(s)</span>
          </div>
          {!readOnly && (
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                accept={allowedTypes.join(",")}
                onChange={handleFileSelect}
              />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <span>
                  <Upload className="h-3 w-3" />
                  Upload
                </span>
              </Button>
            </label>
          )}
        </div>
        {sectionFiles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sectionFiles.slice(0, 3).map((file) => {
              const Icon = getFileIcon(file.name);
              return (
                <Badge key={file.id} variant="secondary" className="text-xs gap-1">
                  <Icon className="h-3 w-3" />
                  {file.name.length > 15 ? file.name.slice(0, 12) + "..." : file.name}
                </Badge>
              );
            })}
            {sectionFiles.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{sectionFiles.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Evidence Documents
          </h4>
          <p className="text-xs text-muted-foreground">
            Phase: {phase} | Section: {section}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" />
          {sectionFiles.length} file(s)
        </Badge>
      </div>

      {!readOnly && (
        <>
          <div className="space-y-2">
            <Label className="text-xs">Tags (optional)</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Add tag..."
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === "Enter" && addTag(customTag)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addTag(customTag)}
                disabled={!customTag}
                className="h-8"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div
            className={`
              border-2 border-dashed rounded-lg p-3 text-center transition-colors
              ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={allowedTypes.join(",")}
              onChange={handleFileSelect}
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              Drag and drop files here, or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline font-medium"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              Max {formatFileSize(maxFileSize)} | {allowedTypes.join(", ")}
            </p>
          </div>
        </>
      )}

      {sectionFiles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Uploaded Files</Label>
          <div className="divide-y border rounded-lg">
            {sectionFiles.map((file) => {
              const Icon = getFileIcon(file.name);
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors group"
                >
                  <div className="p-2 bg-muted rounded">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size)}</span>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {file.uploadedBy}
                      </span>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {file.uploadedDate}
                      </span>
                    </div>
                    {file.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {file.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onView && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(file)}
                        className="h-7 w-7 p-0"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!readOnly && onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(file.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sectionFiles.length === 0 && readOnly && (
        <div className="p-2.5 text-center text-muted-foreground border border-dashed rounded-lg">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No evidence documents uploaded</p>
        </div>
      )}
    </Card>
  );
}
