import { useState, useCallback, useId } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatAccounting } from "@/lib/formatters";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Eye,
  RefreshCw,
  Loader2,
  FileText
} from "lucide-react";

type UploadStep = 'upload' | 'validating' | 'validated' | 'error';

interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  totalAmount?: number;
  errors: string[];
  warnings: string[];
}

interface UploadCardProps {
  title: string;
  description?: string;
  accept?: string;
  maxSize?: number;
  onUpload: (file: File) => Promise<ValidationResult>;
  onViewResults?: () => void;
  onReupload?: () => void;
  existingFile?: {
    name: string;
    uploadedAt: Date;
    validationResult?: ValidationResult;
  };
  className?: string;
}

export function UploadCard({
  title,
  description,
  accept = ".xlsx,.xls,.csv",
  maxSize = 10 * 1024 * 1024,
  onUpload,
  onViewResults,
  onReupload,
  existingFile,
  className,
}: UploadCardProps) {
  const inputId = useId();
  const [step, setStep] = useState<UploadStep>(
    existingFile?.validationResult?.isValid ? 'validated' : 
    existingFile?.validationResult ? 'error' : 'upload'
  );
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(
    existingFile?.validationResult || null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (selectedFile.size > maxSize) {
      setValidationResult({
        isValid: false,
        totalRows: 0,
        errors: [`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`],
        warnings: []
      });
      setStep('error');
      return;
    }

    setFile(selectedFile);
    setStep('validating');
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await onUpload(selectedFile);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setValidationResult(result);
      setStep(result.isValid ? 'validated' : 'error');
    } catch (error) {
      clearInterval(progressInterval);
      setValidationResult({
        isValid: false,
        totalRows: 0,
        errors: [error instanceof Error ? error.message : 'Upload failed'],
        warnings: []
      });
      setStep('error');
    }
  }, [maxSize, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setValidationResult(null);
    setUploadProgress(0);
    onReupload?.();
  };

  return (
    <Card className={cn("", className)} data-testid="upload-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <StepIndicator currentStep={step} />
        </div>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {step === 'upload' && (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById(inputId)?.click()}
            data-testid="upload-dropzone"
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">Drop file here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Supports {accept.replace(/\./g, '').toUpperCase()} files up to {Math.round(maxSize / 1024 / 1024)}MB
            </p>
            <input
              id={inputId}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
              data-testid="input-file"
            />
          </div>
        )}

        {step === 'validating' && (
          <div className="py-4" data-testid="upload-validating">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file?.name}</p>
                <p className="text-xs text-muted-foreground">Validating...</p>
              </div>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {step === 'validated' && validationResult && (
          <div className="space-y-3" data-testid="upload-validated">
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file?.name || existingFile?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {validationResult.totalRows.toLocaleString()} rows
                  {validationResult.totalAmount !== undefined && (
                    <> | Total: {formatAccounting(validationResult.totalAmount)}</>
                  )}
                </p>
              </div>
            </div>
            {validationResult.warnings.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-500">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  {validationResult.warnings.slice(0, 2).map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                  {validationResult.warnings.length > 2 && (
                    <p className="text-muted-foreground">+{validationResult.warnings.length - 2} more warnings</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {onViewResults && (
                <Button size="sm" variant="outline" onClick={onViewResults} className="gap-1.5" data-testid="button-view-results">
                  <Eye className="h-4 w-4" />
                  View Results
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleReset} className="gap-1.5" data-testid="button-reupload">
                <RefreshCw className="h-4 w-4" />
                Re-upload
              </Button>
            </div>
          </div>
        )}

        {step === 'error' && validationResult && (
          <div className="space-y-3" data-testid="upload-error">
            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg">
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file?.name || 'Upload failed'}</p>
                <p className="text-xs text-destructive">Validation failed</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Fix these issues:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-5">
                {validationResult.errors.slice(0, 3).map((err, i) => (
                  <li key={i} className="list-disc">{err}</li>
                ))}
                {validationResult.errors.length > 3 && (
                  <li className="text-muted-foreground">+{validationResult.errors.length - 3} more errors</li>
                )}
              </ul>
            </div>
            <Button size="sm" onClick={handleReset} className="gap-1.5" data-testid="button-try-again">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepIndicator({ currentStep }: { currentStep: UploadStep }) {
  const steps = [
    { key: 'upload', label: '1' },
    { key: 'validating', label: '2' },
    { key: 'validated', label: '3' },
  ];

  const getStepIndex = () => {
    if (currentStep === 'upload') return 0;
    if (currentStep === 'validating') return 1;
    return 2;
  };

  const currentIndex = getStepIndex();

  return (
    <div className="flex items-center gap-1" data-testid="step-indicator">
      {steps.map((step, idx) => (
        <div
          key={step.key}
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium",
            idx < currentIndex && "bg-primary text-primary-foreground",
            idx === currentIndex && "bg-primary text-primary-foreground ring-2 ring-primary/30",
            idx > currentIndex && "bg-muted text-muted-foreground"
          )}
        >
          {idx < currentIndex ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            step.label
          )}
        </div>
      ))}
    </div>
  );
}
