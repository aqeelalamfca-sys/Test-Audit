import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FileSpreadsheet,
  FileText,
  BookOpen,
  File,
  FileDown,
  Loader2,
  Library,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";

interface ModuleTemplate {
  id: string;
  fileName: string;
  category: string;
  subCategory: string;
  reference: string;
  title: string;
  description: string;
  fileType: string;
  phase: string;
  fsLineItems: string[];
  isaParagraph: string;
  sourceZip: string;
  linkedModule: string;
  prefillCapable: boolean;
  prefillFields: string[];
}

interface ModuleTemplatesResponse {
  module: string;
  templates: ModuleTemplate[];
  count: number;
}

interface ModuleTemplatesProps {
  moduleName: string;
  engagementId?: string;
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const fileIcon = (type: string) => {
  if (type === "xlsx") return <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />;
  if (type === "docx") return <FileText className="h-3.5 w-3.5 text-blue-600" />;
  if (type === "pdf") return <BookOpen className="h-3.5 w-3.5 text-red-600" />;
  return <File className="h-3.5 w-3.5 text-gray-500" />;
};

export function ModuleTemplates({
  moduleName,
  engagementId,
  title = "Related Templates",
  collapsible = true,
  defaultExpanded = false,
}: ModuleTemplatesProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ModuleTemplatesResponse>({
    queryKey: ["/api/template-vault/by-module", moduleName],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/template-vault/by-module/${moduleName}`);
      if (!res.ok) throw new Error("Failed to load module templates");
      return res.json();
    },
  });

  const downloadTemplate = async (template: ModuleTemplate, prefilled: boolean) => {
    const dlId = prefilled ? `prefill-${template.id}` : template.id;
    setDownloading(dlId);
    try {
      let url: string;
      if (prefilled && engagementId) {
        url = `/api/template-vault/download-prefilled/${template.id}?engagementId=${engagementId}`;
      } else {
        url = `/api/template-vault/download/${template.id}`;
      }
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = template.fileName === "__GENERATED__"
        ? `${template.reference}_${prefilled ? "Prefilled" : "Template"}.xlsx`
        : template.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast({ title: "Downloaded", description: `${template.title} downloaded` });
    } catch {
      toast({ title: "Error", description: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const templates = data?.templates || [];

  if (isLoading) {
    return null;
  }

  if (templates.length === 0) {
    return null;
  }

  const isExpanded = !collapsible || expanded;

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3 px-3">
        <div
          className={`flex items-center justify-between ${collapsible ? "cursor-pointer" : ""}`}
          onClick={collapsible ? () => setExpanded(!expanded) : undefined}
        >
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-indigo-500" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{templates.length}</Badge>
          </div>
          {collapsible && (
            isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 px-3 pb-3">
          <div className="space-y-1.5">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors group">
                {fileIcon(t.fileType)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground">{t.reference}</span>
                    <span className="text-xs font-medium truncate">{t.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t.prefillCapable && engagementId && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          disabled={downloading === `prefill-${t.id}`}
                          onClick={() => downloadTemplate(t, true)}
                        >
                          {downloading === `prefill-${t.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download prefilled</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={downloading === t.id}
                        onClick={() => downloadTemplate(t, false)}
                      >
                        {downloading === t.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <FileDown className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download template</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
