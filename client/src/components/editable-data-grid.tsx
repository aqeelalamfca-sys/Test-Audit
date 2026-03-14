import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Pencil, Trash2, Check, X, Search, ChevronLeft, ChevronRight, AlertCircle, Save, AlertTriangle, XCircle, ExternalLink, Hash, Type, FolderOpen, DollarSign, Calendar, FileText, Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from "@/lib/formatters";

export interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'drilldown';
  options?: string[];
  optionValueMap?: Record<string, string>;
  required?: boolean;
  width?: string;
  minWidth?: string;
  editable?: boolean;
  drilldownType?: 'movement';
  sticky?: 'left' | 'right';
  stickyOffset?: number;
  truncate?: boolean;
}

interface ValidationError {
  field: string;
  message: string;
  type?: 'error' | 'warning';
}

interface ApiValidationResponse {
  error?: string;
  validationErrors?: ValidationError[];
  validationWarnings?: ValidationError[];
  _validationWarnings?: ValidationError[];
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface EditableDataGridProps {
  apiEndpoint?: string;
  columns: ColumnDef[];
  datasetType?: string;
  dataType?: string; // Alias for datasetType for backward compatibility
  engagementId: string;
  title?: string;
  description?: string;
  readOnly?: boolean;
  pageSize?: number;
  additionalFilters?: Record<string, string>;
  data?: Record<string, any>[]; // Static data mode - if provided, uses this instead of API
  onSave?: (data: Record<string, any>[]) => Promise<void>; // Callback for static data mode saves
  enableSelection?: boolean; // Enable row selection with checkboxes
  selectedIds?: string[]; // Currently selected row IDs
  onSelectionChange?: (selectedIds: string[], selectedRows: Record<string, any>[]) => void; // Callback when selection changes
  selectionActionLabel?: string; // Label for bulk selection action button
  onSelectionAction?: (selectedRows: Record<string, any>[]) => void; // Callback for bulk action on selected rows
}

export function EditableDataGrid({
  apiEndpoint,
  columns,
  datasetType,
  dataType,
  engagementId,
  title,
  description,
  readOnly = false,
  pageSize = 50,
  additionalFilters = {},
  data: staticData,
  onSave,
  enableSelection = false,
  selectedIds = [],
  onSelectionChange,
  selectionActionLabel,
  onSelectionAction,
}: EditableDataGridProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use dataType as alias for datasetType if provided
  const effectiveDatasetType = datasetType || dataType || 'data';
  
  // Determine if we're in static data mode (data prop provided) or API mode
  const isStaticMode = Array.isArray(staticData);
  
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, any>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [localData, setLocalData] = useState<Record<string, any>[]>([]);
  
  // Drilldown state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownAccount, setDrilldownAccount] = useState<{ glCode: string; glName: string; columnKey: string } | null>(null);
  const [drilldownEditingId, setDrilldownEditingId] = useState<string | null>(null);
  const [drilldownEditData, setDrilldownEditData] = useState<Record<string, any>>({});

  // Sync static data to local state when it changes
  useMemo(() => {
    if (isStaticMode && staticData) {
      setLocalData(staticData);
    }
  }, [isStaticMode, staticData]);

  const effectivePageSize = currentPageSize;

  const queryKey = useMemo(() => [
    apiEndpoint,
    engagementId,
    effectiveDatasetType,
    page,
    effectivePageSize,
    searchTerm,
    additionalFilters
  ], [apiEndpoint, engagementId, effectiveDatasetType, page, effectivePageSize, searchTerm, additionalFilters]);

  const buildUrl = useCallback(() => {
    if (!apiEndpoint) return '';
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: effectivePageSize === -1 ? '999999' : effectivePageSize.toString(),
      ...(searchTerm && { search: searchTerm }),
      ...additionalFilters,
    });
    return `${apiEndpoint}/${engagementId}/${effectiveDatasetType}?${params.toString()}`;
  }, [apiEndpoint, engagementId, effectiveDatasetType, page, effectivePageSize, searchTerm, additionalFilters]);

  // API query - only enabled when NOT in static mode and apiEndpoint is provided
  const { data: apiResponse, isLoading: apiLoading, error: apiError, refetch } = useQuery<PaginatedResponse<Record<string, any>>>({
    queryKey,
    queryFn: async () => {
      const res = await fetchWithAuth(buildUrl());
      if (!res.ok) throw new Error('Failed to fetch data');
      return res.json();
    },
    enabled: !isStaticMode && !!engagementId && !!apiEndpoint,
  });

  // Compute response based on mode (static or API)
  const response = useMemo(() => {
    if (isStaticMode) {
      // Apply local pagination and search for static data
      let filteredData = localData || [];
      
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filteredData = filteredData.filter(row => 
          Object.values(row).some(val => 
            String(val || '').toLowerCase().includes(lowerSearch)
          )
        );
      }
      
      const totalCount = filteredData.length;
      const showAll = effectivePageSize === -1;
      const actualPageSize = showAll ? totalCount : effectivePageSize;
      const totalPages = showAll ? 1 : (Math.ceil(totalCount / actualPageSize) || 1);
      const startIdx = showAll ? 0 : (page - 1) * actualPageSize;
      const paginatedData = showAll ? filteredData : filteredData.slice(startIdx, startIdx + actualPageSize);
      
      return {
        data: paginatedData,
        meta: {
          page: showAll ? 1 : page,
          pageSize: actualPageSize,
          totalCount,
          totalPages,
          hasNextPage: !showAll && page < totalPages,
          hasPrevPage: !showAll && page > 1,
        }
      };
    }
    return apiResponse;
  }, [isStaticMode, localData, apiResponse, page, effectivePageSize, searchTerm]);
  
  const isLoading = isStaticMode ? false : apiLoading;
  const error = isStaticMode ? null : apiError;

  const handleApiValidationError = useCallback((err: any) => {
    try {
      const errorData = err.data as ApiValidationResponse;
      if (errorData?.validationErrors && Array.isArray(errorData.validationErrors)) {
        setValidationErrors(errorData.validationErrors);
        const errorMessages = errorData.validationErrors.map(e => e.message).join(', ');
        toast({ 
          title: "Validation Failed", 
          description: errorMessages || "Please fix the validation errors.", 
          variant: "destructive" 
        });
        return true;
      }
    } catch {
      // Not a validation error response
    }
    return false;
  }, [toast]);

  const handleValidationWarnings = useCallback((data: any) => {
    const warnings = data?._validationWarnings || data?.validationWarnings;
    if (warnings && Array.isArray(warnings) && warnings.length > 0) {
      const warningMessages = warnings.map((w: ValidationError) => w.message).join(', ');
      toast({ 
        title: "⚠️ Validation Warnings", 
        description: warningMessages,
      });
    }
  }, [toast]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("POST", `${apiEndpoint}/${engagementId}/${datasetType}`, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint, engagementId, datasetType] });
      setIsAddDialogOpen(false);
      setNewRowData({});
      setValidationErrors([]);
      toast({ title: "Row added", description: "New row has been added successfully." });
      handleValidationWarnings(data);
    },
    onError: (err: any) => {
      if (!handleApiValidationError(err)) {
        toast({ title: "Error", description: err.message || "Failed to add row", variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      return apiRequest("PATCH", `${apiEndpoint}/${engagementId}/${datasetType}/${id}`, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint, engagementId, datasetType] });
      setEditingRowId(null);
      setEditingData({});
      setValidationErrors([]);
      toast({ title: "Row updated", description: "Row has been updated successfully." });
      handleValidationWarnings(data);
    },
    onError: (err: any) => {
      if (!handleApiValidationError(err)) {
        toast({ title: "Error", description: err.message || "Failed to update row", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `${apiEndpoint}/${engagementId}/${datasetType}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint, engagementId, datasetType] });
      setDeleteConfirmId(null);
      toast({ title: "Row deleted", description: "Row has been deleted successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete row", variant: "destructive" });
    },
  });

  // Drilldown query to fetch GL entries for a specific account
  const drilldownQueryKey = useMemo(() => [
    '/api/import',
    engagementId,
    'data/gl',
    drilldownAccount?.glCode,
  ], [engagementId, drilldownAccount?.glCode]);

  const { data: drilldownData, isLoading: drilldownLoading } = useQuery<PaginatedResponse<Record<string, any>>>({
    queryKey: drilldownQueryKey,
    queryFn: async () => {
      if (!drilldownAccount?.glCode) return { data: [], meta: { page: 1, pageSize: 100, totalCount: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        accountCode: drilldownAccount.glCode,
      });
      const res = await fetchWithAuth(`/api/import/${engagementId}/data/gl?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch GL entries');
      return res.json();
    },
    enabled: drilldownOpen && !!drilldownAccount?.glCode && !!engagementId,
  });

  const drilldownUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      return apiRequest("PATCH", `/api/import/${engagementId}/data/gl/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: drilldownQueryKey });
      queryClient.invalidateQueries({ queryKey: [apiEndpoint, engagementId, effectiveDatasetType] });
      setDrilldownEditingId(null);
      setDrilldownEditData({});
      toast({ title: "Updated", description: "GL entry has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update GL entry", variant: "destructive" });
    },
  });

  const openDrilldown = useCallback((row: Record<string, any>, columnKey: string) => {
    setDrilldownAccount({ 
      glCode: row.glCode || row.accountCode, 
      glName: row.glName || row.accountName || row.glCode || row.accountCode,
      columnKey 
    });
    setDrilldownOpen(true);
  }, []);

  const closeDrilldown = useCallback(() => {
    setDrilldownOpen(false);
    setDrilldownAccount(null);
    setDrilldownEditingId(null);
    setDrilldownEditData({});
  }, []);

  const validateRow = useCallback((data: Record<string, any>): ValidationError[] => {
    const errors: ValidationError[] = [];
    columns.forEach(col => {
      if (col.required && (data[col.key] === undefined || data[col.key] === null || data[col.key] === '')) {
        errors.push({ field: col.key, message: `${col.label} is required` });
      }
      if (col.type === 'number' && data[col.key] !== undefined && data[col.key] !== '' && isNaN(Number(data[col.key]))) {
        errors.push({ field: col.key, message: `${col.label} must be a number` });
      }
    });
    return errors;
  }, [columns]);

  const startEditing = useCallback((row: Record<string, any>) => {
    setEditingRowId(row.id);
    setEditingData({ ...row });
    setValidationErrors([]);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingRowId(null);
    setEditingData({});
    setValidationErrors([]);
  }, []);

  const saveEditing = useCallback(() => {
    const errors = validateRow(editingData);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    updateMutation.mutate({ id: editingRowId!, data: editingData });
  }, [editingData, editingRowId, validateRow, updateMutation]);

  const handleAddRow = useCallback(() => {
    const errors = validateRow(newRowData);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    createMutation.mutate(newRowData);
  }, [newRowData, validateRow, createMutation]);

  const getFieldError = useCallback((fieldKey: string) => {
    return validationErrors.find(e => e.field === fieldKey)?.message;
  }, [validationErrors]);

  const renderCellValue = useCallback((row: Record<string, any>, col: ColumnDef) => {
    const value = row[col.key];
    
    if (col.type === 'checkbox') {
      return <Checkbox checked={!!value} disabled />;
    }
    
    // Drilldown type - clickable cell with drill-down icon
    if (col.type === 'drilldown') {
      const numValue = value !== undefined && value !== null ? Number(value) : 0;
      return (
        <button
          type="button"
          onClick={() => openDrilldown(row, col.key)}
          className="flex items-center gap-1 font-mono text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
          data-testid={`drilldown-${col.key}-${row.id}`}
        >
          {formatAccounting(numValue)}
          <ExternalLink className="h-3 w-3 opacity-50" />
        </button>
      );
    }
    
    if (col.type === 'number' && value !== undefined && value !== null) {
      return <span className="font-mono text-right whitespace-nowrap">{formatAccounting(Number(value))}</span>;
    }
    
    if (col.type === 'date' && value) {
      return <span className="whitespace-nowrap">{new Date(value).toLocaleDateString()}</span>;
    }
    
    if (col.type === 'select' && value) {
      const displayLabel = col.optionValueMap?.[value] || value;
      const formattedLabel = displayLabel.replace(/_/g, ' ').split(' ').map(
        (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      const truncatedLabel = formattedLabel.length > 14 ? formattedLabel.substring(0, 12) + '..' : formattedLabel;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block px-1 py-0.5 text-[10px] bg-muted/50 rounded text-foreground/80 truncate max-w-[110px] cursor-default leading-tight">
              {truncatedLabel}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">{formattedLabel}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    const displayValue = value ?? '-';
    const stringValue = String(displayValue);
    
    if (col.truncate !== false && col.type === 'text' && stringValue.length > 25) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block truncate max-w-[180px] cursor-help">{stringValue}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs break-words">{stringValue}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return displayValue;
  }, [openDrilldown]);

  const renderEditableCell = useCallback((col: ColumnDef, data: Record<string, any>, setData: (d: Record<string, any>) => void, variant: 'inline' | 'dialog' = 'inline') => {
    const value = data[col.key];
    const fieldError = getFieldError(col.key);
    const isEditable = col.editable !== false;

    if (!isEditable) {
      return <span className="text-muted-foreground">{value ?? '-'}</span>;
    }

    const isDialog = variant === 'dialog';
    const prefix = isDialog ? 'dialog' : 'inline';
    const fieldId = isDialog ? `add-field-${col.key}` : undefined;
    const heightClass = isDialog ? "h-9" : "h-8";
    const textClass = isDialog ? "text-sm" : "text-xs";
    const errorBorder = fieldError ? "border-red-500 focus-visible:ring-red-500/25" : "";
    const focusRing = isDialog ? "focus-visible:ring-2 focus-visible:ring-primary/20" : "";

    switch (col.type) {
      case 'select':
        return (
          <div className="space-y-1">
            <Select
              value={value ?? ''}
              onValueChange={(v) => setData({ ...data, [col.key]: v })}
            >
              <SelectTrigger
                id={fieldId}
                className={`${heightClass} ${textClass} ${errorBorder} ${focusRing}`}
                style={{ width: isDialog ? '100%' : (col.width || '100%') }}
                data-testid={`${prefix}-select-${col.key}`}
              >
                <SelectValue placeholder={`Select ${col.label}...`} />
              </SelectTrigger>
              <SelectContent>
                {col.options?.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError && <span className="text-xs text-red-500">{fieldError}</span>}
          </div>
        );
      
      case 'checkbox':
        return (
          <Checkbox
            id={fieldId}
            checked={!!value}
            onCheckedChange={(checked) => setData({ ...data, [col.key]: checked })}
            data-testid={`${prefix}-checkbox-${col.key}`}
          />
        );
      
      case 'date':
        return (
          <div className="space-y-1">
            <Input
              id={fieldId}
              type="date"
              value={value ? new Date(value).toISOString().split('T')[0] : ''}
              onChange={(e) => setData({ ...data, [col.key]: e.target.value })}
              className={`${heightClass} ${textClass} ${errorBorder} ${focusRing}`}
              style={{ width: isDialog ? '100%' : (col.width || '100%') }}
              data-testid={`${prefix}-input-${col.key}`}
            />
            {fieldError && <span className="text-xs text-red-500">{fieldError}</span>}
          </div>
        );
      
      case 'number':
        return (
          <div className="space-y-1">
            <Input
              id={fieldId}
              type="number"
              step="0.01"
              value={value ?? ''}
              onChange={(e) => setData({ ...data, [col.key]: e.target.value })}
              placeholder={isDialog ? "0.00" : ""}
              className={`${heightClass} ${textClass} font-mono ${errorBorder} ${focusRing}`}
              style={{ width: isDialog ? '100%' : (col.width || '100%') }}
              data-testid={`${prefix}-input-${col.key}`}
            />
            {fieldError && <span className="text-xs text-red-500">{fieldError}</span>}
          </div>
        );
      
      default:
        return (
          <div className="space-y-1">
            <Input
              id={fieldId}
              type="text"
              value={value ?? ''}
              onChange={(e) => setData({ ...data, [col.key]: e.target.value })}
              placeholder={isDialog ? `Enter ${col.label.toLowerCase()}...` : ""}
              className={`${heightClass} ${textClass} ${errorBorder} ${focusRing}`}
              style={{ width: isDialog ? '100%' : (col.width || '100%') }}
              data-testid={`${prefix}-input-${col.key}`}
            />
            {fieldError && <span className="text-xs text-red-500">{fieldError}</span>}
          </div>
        );
    }
  }, [getFieldError]);

  const data = response?.data ?? [];
  const meta = response?.meta ?? { page: 1, pageSize: effectivePageSize === -1 ? 0 : effectivePageSize, totalCount: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
        <p className="text-sm">Failed to load data</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-8 h-8 w-48 text-xs"
              data-testid={`input-search-${datasetType}`}
            />
          </div>
          
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => {
                setNewRowData({});
                setValidationErrors([]);
                setIsAddDialogOpen(true);
              }}
              data-testid={`button-add-${datasetType}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          )}
        </div>
      </div>

      {/* Validation Summary Banner */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive" data-testid={`alert-validation-${datasetType}`}>
          <XCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">Validation Errors</AlertTitle>
          <AlertDescription className="text-xs">
            <ul className="list-disc pl-4 mt-1 space-y-1">
              {validationErrors.map((error, idx) => (
                <li key={idx}><strong>{error.field}:</strong> {error.message}</li>
              ))}
            </ul>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-6 text-xs"
              onClick={() => setValidationErrors([])}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Selection Action Bar */}
      {enableSelection && selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2" data-testid="selection-action-bar">
          <span className="text-sm font-medium">
            {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            {selectionActionLabel && onSelectionAction && (
              <Button
                size="sm"
                onClick={() => {
                  const selectedRows = data.filter(row => selectedIds.includes(row.id));
                  onSelectionAction(selectedRows);
                }}
                data-testid="btn-selection-action"
              >
                {selectionActionLabel}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectionChange?.([], [])}
              data-testid="btn-clear-selection"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading data...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-3 text-muted-foreground border rounded-lg">
          <p className="text-sm">No data found</p>
          {searchTerm && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchTerm('')}>
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Table container with horizontal scroll - page stays locked */}
          <div className="relative border rounded-lg">
            {/* Scroll hint gradient on left when scrolled */}
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background/80 to-transparent pointer-events-none z-10 opacity-0 transition-opacity" id="scroll-hint-left" />
            {/* Scroll hint gradient on right */}
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background/80 to-transparent pointer-events-none z-10" id="scroll-hint-right" />
            
            <div className="overflow-x-scroll max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-muted/20" style={{ scrollbarWidth: 'thin' }} data-testid="table-scroll-container">
              <Table className="w-full min-w-max">
                <TableHeader className="bg-primary/10 sticky top-0 z-20 border-b-2 border-primary/30">
                  <TableRow>
                    {enableSelection && (
                      <TableHead className="w-[32px] px-2 py-2 sticky left-0 bg-primary/10 z-30 font-semibold">
                        <Checkbox
                          checked={data.length > 0 && data.every(row => selectedIds.includes(row.id))}
                          onCheckedChange={(checked) => {
                            if (onSelectionChange) {
                              if (checked) {
                                const allIds = data.map(row => row.id);
                                onSelectionChange(allIds, data);
                              } else {
                                onSelectionChange([], []);
                              }
                            }
                          }}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                    )}
                    {columns.map((col, colIdx) => {
                      const isFirstCol = colIdx === 0;
                      const stickyLeft = col.sticky === 'left' || isFirstCol;
                      const leftOffset = enableSelection ? (isFirstCol ? 32 : 0) : (isFirstCol ? 0 : undefined);
                      
                      return (
                        <TableHead
                          key={col.key}
                          className={`text-[10px] whitespace-nowrap px-1.5 py-1 font-medium border-r border-border/50 ${stickyLeft ? 'sticky bg-primary/10 z-30' : ''} ${col.type === 'number' || col.type === 'drilldown' ? 'text-right' : ''}`}
                          style={{ 
                            width: col.width,
                            minWidth: col.minWidth || (col.type === 'number' ? '50px' : undefined),
                            left: stickyLeft ? `${leftOffset}px` : undefined,
                          }}
                        >
                          {col.label}
                          {col.required && <span className="text-red-500 ml-0.5">*</span>}
                        </TableHead>
                      );
                    })}
                    {!readOnly && (
                      <TableHead className="w-[70px] text-center px-1 py-2 sticky right-0 bg-primary/10 z-30 font-semibold">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, rowIndex) => (
                    <TableRow key={row.id} data-testid={`row-${datasetType}-${row.id}`} className={`${selectedIds.includes(row.id) ? 'bg-primary/10' : rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-primary/5 transition-colors`}>
                      {enableSelection && (
                        <TableCell className="w-[32px] px-2 py-1 sticky left-0 bg-background z-10">
                          <Checkbox
                            checked={selectedIds.includes(row.id)}
                            onCheckedChange={(checked) => {
                              if (onSelectionChange) {
                                let newSelectedIds: string[];
                                let newSelectedRows: Record<string, any>[];
                                if (checked) {
                                  newSelectedIds = [...selectedIds, row.id];
                                  newSelectedRows = data.filter(r => newSelectedIds.includes(r.id));
                                } else {
                                  newSelectedIds = selectedIds.filter(id => id !== row.id);
                                  newSelectedRows = data.filter(r => newSelectedIds.includes(r.id));
                                }
                                onSelectionChange(newSelectedIds, newSelectedRows);
                              }
                            }}
                            data-testid={`checkbox-select-${row.id}`}
                          />
                        </TableCell>
                      )}
                      {columns.map((col, colIdx) => {
                        const isFirstCol = colIdx === 0;
                        const stickyLeft = col.sticky === 'left' || isFirstCol;
                        const leftOffset = enableSelection ? (isFirstCol ? 32 : 0) : (isFirstCol ? 0 : undefined);
                        
                        return (
                          <TableCell 
                            key={col.key} 
                            className={`text-xs px-1.5 py-0.5 border-r border-border/30 ${stickyLeft ? 'sticky bg-background z-10' : ''} ${col.type === 'number' || col.type === 'drilldown' ? 'text-right' : ''}`}
                            style={{
                              left: stickyLeft ? `${leftOffset}px` : undefined,
                              minWidth: col.minWidth || (col.type === 'number' ? '50px' : undefined),
                            }}
                          >
                            {editingRowId === row.id ? (
                              renderEditableCell(col, editingData, setEditingData)
                            ) : (
                              renderCellValue(row, col)
                            )}
                          </TableCell>
                        );
                      })}
                      {!readOnly && (
                        <TableCell className="text-center px-1 py-1 sticky right-0 bg-background z-10">
                          {editingRowId === row.id ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={saveEditing}
                                disabled={updateMutation.isPending}
                                data-testid={`button-save-${row.id}`}
                              >
                                {updateMutation.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={cancelEditing}
                                disabled={updateMutation.isPending}
                                data-testid={`button-cancel-${row.id}`}
                              >
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => startEditing(row)}
                                data-testid={`button-edit-${row.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setDeleteConfirmId(row.id)}
                                data-testid={`button-delete-${row.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {effectivePageSize === -1
                  ? `Showing all ${meta.totalCount} entries`
                  : `Showing ${((meta.page - 1) * meta.pageSize) + 1} - ${Math.min(meta.page * meta.pageSize, meta.totalCount)} of ${meta.totalCount}`}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <Select
                  value={currentPageSize.toString()}
                  onValueChange={(val) => {
                    setCurrentPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 w-[70px] text-xs" data-testid={`select-pagesize-${effectiveDatasetType}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10" data-testid="option-pagesize-10">10</SelectItem>
                    <SelectItem value="30" data-testid="option-pagesize-30">30</SelectItem>
                    <SelectItem value="50" data-testid="option-pagesize-50">50</SelectItem>
                    <SelectItem value="100" data-testid="option-pagesize-100">100</SelectItem>
                    <SelectItem value="-1" data-testid="option-pagesize-all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {effectivePageSize !== -1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => p - 1)}
                  disabled={!meta.hasPrevPage}
                  data-testid={`button-prev-${datasetType}`}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-xs">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!meta.hasNextPage}
                  data-testid={`button-next-${datasetType}`}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
          <div className="bg-primary/5 dark:bg-primary/10 px-3 py-2.5 border-b">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="flex items-center gap-2 text-lg" data-testid="text-add-entry-title">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
                  <Plus className="h-4 w-4" />
                </div>
                Add New Entry
              </DialogTitle>
              <DialogDescription className="text-sm">
                Complete the required fields marked with <span className="text-red-500 font-medium">*</span> to add a new record to the {datasetType} dataset.
              </DialogDescription>
            </DialogHeader>
          </div>

          {validationErrors.length > 0 && (
            <div className="px-3 pt-4">
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm font-medium">Please fix the following errors</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  {validationErrors.map((err, i) => (
                    <span key={i} className="block">{err.message}</span>
                  ))}
                </AlertDescription>
              </Alert>
            </div>
          )}

          <ScrollArea className="px-3 py-2.5 max-h-[calc(85vh-180px)]">
            <div className="space-y-3">
              {(() => {
                const editableCols = columns.filter(col => col.editable !== false);
                const identityCols = editableCols.filter(col =>
                  col.key.toLowerCase().includes('code') ||
                  col.key.toLowerCase().includes('name') ||
                  col.key.toLowerCase().includes('id') ||
                  col.key.toLowerCase().includes('no')
                );
                const categoryCols = editableCols.filter(col =>
                  col.type === 'select' && !identityCols.includes(col)
                );
                const numericCols = editableCols.filter(col =>
                  col.type === 'number' && !identityCols.includes(col)
                );
                const dateCols = editableCols.filter(col => col.type === 'date');
                const otherCols = editableCols.filter(col =>
                  !identityCols.includes(col) &&
                  !categoryCols.includes(col) &&
                  !numericCols.includes(col) &&
                  !dateCols.includes(col)
                );

                const renderFieldGroup = (
                  title: string,
                  icon: React.ReactNode,
                  cols: ColumnDef[],
                  gridCols: string = "grid-cols-2"
                ) => {
                  if (cols.length === 0) return null;
                  return (
                    <div className="space-y-3" data-testid={`fieldgroup-${title.toLowerCase().replace(/\s/g, '-')}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-muted text-muted-foreground">
                          {icon}
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                        <Separator className="flex-1" />
                      </div>
                      <div className={`grid ${gridCols} gap-x-4 gap-y-3 pl-8`}>
                        {cols.map(col => {
                          const fieldError = getFieldError(col.key);
                          return (
                            <div key={col.key} className="space-y-1.5">
                              <Label
                                htmlFor={`add-field-${col.key}`}
                                className={`text-xs font-medium ${fieldError ? 'text-red-500' : 'text-muted-foreground'}`}
                              >
                                {col.label}
                                {col.required && <span className="text-red-500 ml-0.5">*</span>}
                              </Label>
                              {renderEditableCell(col, newRowData, setNewRowData, 'dialog')}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                const hasAnyGroup = identityCols.length > 0 || categoryCols.length > 0 ||
                  numericCols.length > 0 || dateCols.length > 0 || otherCols.length > 0;

                if (!hasAnyGroup) {
                  return renderFieldGroup("Entry Details", <FileText className="h-3.5 w-3.5" />, editableCols);
                }

                return (
                  <>
                    {renderFieldGroup("Identification", <Hash className="h-3.5 w-3.5" />, identityCols)}
                    {renderFieldGroup("Classification", <FolderOpen className="h-3.5 w-3.5" />, categoryCols)}
                    {renderFieldGroup("Amounts", <DollarSign className="h-3.5 w-3.5" />, numericCols)}
                    {renderFieldGroup("Dates", <Calendar className="h-3.5 w-3.5" />, dateCols)}
                    {renderFieldGroup("Other Details", <FileText className="h-3.5 w-3.5" />, otherCols)}
                  </>
                );
              })()}
            </div>
          </ScrollArea>

          <div className="border-t bg-muted/30 px-3 py-2">
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => { setIsAddDialogOpen(false); setValidationErrors([]); }}
                className="min-w-[90px]"
                data-testid="button-cancel-add-row"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddRow}
                disabled={createMutation.isPending}
                className="min-w-[120px]"
                data-testid="button-submit-add-row"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Row</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this row? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Movement Drilldown Dialog */}
      <Dialog open={drilldownOpen} onOpenChange={(open) => !open && closeDrilldown()}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Movement Details - {drilldownAccount?.glCode}
            </DialogTitle>
            <DialogDescription>
              General Ledger entries for account: {drilldownAccount?.glName}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 max-h-[50vh]">
            {drilldownLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading GL entries...</span>
              </div>
            ) : drilldownData?.data && drilldownData.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Voucher #</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Debit</TableHead>
                    <TableHead className="text-xs text-right">Credit</TableHead>
                    <TableHead className="text-xs text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownData.data.map((entry: Record<string, any>) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs py-2 text-muted-foreground">
                        {entry.postingDate ? new Date(entry.postingDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground">
                        {entry.voucherNo || '-'}
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        {drilldownEditingId === entry.id ? (
                          <Input
                            value={drilldownEditData.narration || drilldownEditData.description || ''}
                            onChange={(e) => setDrilldownEditData({ ...drilldownEditData, narration: e.target.value })}
                            className="h-7 text-xs w-40"
                            placeholder="Narration/Description"
                          />
                        ) : (
                          entry.narration || entry.description || '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono">
                        {drilldownEditingId === entry.id ? (
                          <Input
                            type="number"
                            value={drilldownEditData.debit || ''}
                            onChange={(e) => setDrilldownEditData({ ...drilldownEditData, debit: e.target.value })}
                            className="h-7 text-xs w-24 text-right"
                          />
                        ) : (
                          Number(entry.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono">
                        {drilldownEditingId === entry.id ? (
                          <Input
                            type="number"
                            value={drilldownEditData.credit || ''}
                            onChange={(e) => setDrilldownEditData({ ...drilldownEditData, credit: e.target.value })}
                            className="h-7 text-xs w-24 text-right"
                          />
                        ) : (
                          Number(entry.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-center">
                        {drilldownEditingId === entry.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => drilldownUpdateMutation.mutate({ id: entry.id, data: drilldownEditData })}
                              disabled={drilldownUpdateMutation.isPending}
                              className="h-7 w-7"
                              data-testid={`drilldown-save-${entry.id}`}
                            >
                              {drilldownUpdateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setDrilldownEditingId(null); setDrilldownEditData({}); }}
                              className="h-7 w-7"
                              data-testid={`drilldown-cancel-${entry.id}`}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setDrilldownEditingId(entry.id); setDrilldownEditData({ ...entry }); }}
                            className="h-7 w-7"
                            data-testid={`drilldown-edit-${entry.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-2 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>No GL entries found for this account</p>
                <p className="text-xs mt-1">Movement may come from opening/closing balance adjustments</p>
              </div>
            )}
          </ScrollArea>
          
          {drilldownData?.data && drilldownData.data.length > 0 && (
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Totals:</span>
                <div className="flex gap-2.5">
                  <span className="font-mono">
                    DR: {drilldownData.data.reduce((sum: number, e: Record<string, any>) => sum + Number(e.debit || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="font-mono">
                    CR: {drilldownData.data.reduce((sum: number, e: Record<string, any>) => sum + Number(e.credit || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDrilldown}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const CATEGORY_OPTIONS = [
  'Non-Current Assets',
  'Current Assets',
  'Equity',
  'Non-Current Liabilities',
  'Current Liabilities',
  'Revenue',
  'Cost of Sales',
  'Operating Expenses',
  'Finance Costs',
  'Tax',
  'OCI'
];

export const FS_LINE_ITEM_OPTIONS = [
  'Property, Plant and Equipment',
  'Right-of-Use Assets',
  'Investment Property',
  'Intangible Assets',
  'Goodwill',
  'Biological Assets (Non-Current)',
  'Financial Assets / Investments (Non-Current)',
  'Investments in Associates',
  'Investments in Joint Ventures',
  'Deferred Tax Assets',
  'Long-term Loans & Advances',
  'Long-term Deposits / Security Deposits',
  'Long-term Prepayments',
  'Other Non-Current Assets',
  'Inventories',
  'Trade Receivables',
  'Contract Assets',
  'Other Receivables',
  'Short-term Loans & Advances',
  'Prepayments',
  'Income Tax Receivable / Refundable',
  'Sales Tax / VAT Receivable',
  'Other Taxes Receivable',
  'Cash and Cash Equivalents',
  'Bank Balances (Restricted / Non-Cash)',
  'Assets Held for Sale',
  'Other Current Assets',
  'Share Capital',
  'Share Premium',
  'Capital Contribution / APIC',
  'Revaluation Reserve',
  'OCI / Other Reserves',
  'Statutory / General Reserves',
  'Retained Earnings / Accumulated Losses',
  'Non-controlling Interests',
  'Long-term Borrowings',
  'Lease Liabilities (Non-Current)',
  'Deferred Tax Liabilities',
  'Long-term Provisions',
  'Retirement / Gratuity Obligation',
  'Deferred Revenue / Contract Liabilities (Non-Current)',
  'Other Non-Current Liabilities',
  'Short-term Borrowings',
  'Current Portion of Long-term Borrowings',
  'Lease Liabilities (Current)',
  'Trade Payables',
  'Contract Liabilities (Current)',
  'Accrued / Other Payables',
  'Advances from Customers',
  'Taxes Payable',
  'Payroll Liabilities',
  'Short-term Provisions',
  'Dividend Payable',
  'Other Current Liabilities',
  'Revenue from Contracts with Customers',
  'Contra Revenue',
  'Other Income',
  'Cost of Sales / Cost of Revenue',
  'Selling & Distribution Expenses',
  'Administrative Expenses',
  'Other Operating Expenses',
  'Finance Costs',
  'Taxation',
  'Other Comprehensive Income'
];

export const CLASS_OPTIONS = [
  'Land',
  'Buildings',
  'Plant & Machinery',
  'Furniture & Fixtures',
  'Office Equipment',
  'Computers / IT Equipment',
  'Vehicles',
  'Capital Work-in-Progress (CWIP)',
  'Assets under Installation',
  'Accumulated Depreciation — PPE',
  'ROU — Property/Buildings',
  'ROU — Vehicles',
  'ROU — Equipment',
  'Accumulated Depreciation — ROU',
  'Investment Property — Cost',
  'Accumulated Depreciation — Investment Property',
  'Fair Value Adjustment — Investment Property',
  'Software',
  'Licenses / Permits',
  'Development Costs',
  'Other Intangibles',
  'Accumulated Amortization — Intangibles',
  'Goodwill — Cost',
  'Impairment — Goodwill',
  'Biological Assets — Non-Current',
  'Investments — Equity Instruments',
  'Investments — Debt Instruments',
  'Term Deposits (Non-Current)',
  'Long-term Investment in Funds / Sukuk / Bonds',
  'Investment in Associate',
  'Investment in Joint Venture',
  'Deferred Tax Asset',
  'Loans to Employees — Long-term',
  'Loans to Related Parties — Long-term',
  'Loans to Others — Long-term',
  'Advances — Long-term',
  'Security Deposits — Utilities',
  'Security Deposits — Rent/Lease',
  'Other Long-term Deposits',
  'Prepaid Insurance — Long-term',
  'Prepaid Rent — Long-term',
  'Other Long-term Prepayments',
  'Other Non-Current Assets',
  'Raw Materials',
  'Work-in-Process (WIP)',
  'Finished Goods',
  'Stores & Spares',
  'Packing Materials',
  'Goods in Transit',
  'Inventory Obsolescence Provision',
  'Trade Debtors — Local',
  'Trade Debtors — Export',
  'Bills Receivable',
  'Expected Credit Loss (ECL) / Provision for Doubtful Debts',
  'Contract Assets',
  'Advances to Employees — Current',
  'Advances to Suppliers — Current',
  'Deposits — Current',
  'Receivable from Related Parties — Current',
  'Other Receivables — General',
  'Short-term Loans',
  'Short-term Advances',
  'Prepaid Insurance — Current',
  'Prepaid Rent — Current',
  'Prepaid Expenses — Other',
  'Income Tax Refundable',
  'Sales Tax / VAT Input',
  'Other Taxes Receivable',
  'Cash in Hand',
  'Cash at Bank — Current Accounts',
  'Cash at Bank — Saving Accounts',
  'Short-term Deposits (≤ 3 months)',
  'Restricted Bank Balances',
  'Margin Deposits',
  'LCs / BGs Margins',
  'Assets Held for Sale',
  'Other Current Assets',
  'Ordinary Share Capital',
  'Preference Share Capital',
  'Share Premium',
  'Capital Contribution',
  'Revaluation Reserve',
  'Hedging Reserve',
  'FVOCI Reserve',
  'Translation Reserve',
  'General Reserve',
  'Statutory Reserve',
  'Retained Earnings',
  'Accumulated Losses',
  'Non-controlling Interests',
  'Bank Term Loans',
  'Sukuk / Bonds / Debentures',
  'Related Party Loans — Long-term',
  'Other Long-term Loans',
  'Lease Liability — Non-Current',
  'Deferred Tax Liability',
  'Provision — Litigation / Claims',
  'Provision — Decommissioning / Restoration',
  'Other Long-term Provisions',
  'Gratuity / Pension Obligation',
  'Deferred Revenue — Non-Current',
  'Other Non-Current Liabilities',
  'Bank Overdraft',
  'Running Finance / Working Capital Facilities',
  'CPLTB',
  'Lease Liability — Current',
  'Trade Creditors — Local',
  'Trade Creditors — Import',
  'Goods Received Not Invoiced (GRNI)',
  'Contract Liabilities — Current',
  'Accrued Expenses',
  'Other Payables',
  'Payable to Related Parties — Current',
  'Customer Advances',
  'Income Tax Payable',
  'Sales Tax / VAT Payable',
  'Withholding Tax Payable',
  'Other Taxes Payable',
  'Salaries Payable',
  'Bonus Payable',
  'Payroll Statutory Deductions Payable',
  'Provision — Warranty',
  'Provision — Claims',
  'Other Short-term Provisions',
  'Dividend Payable',
  'Other Current Liabilities',
  'Local Sales Revenue',
  'Export Sales Revenue',
  'Service Revenue',
  'Contract Revenue',
  'Sales Returns',
  'Trade Discounts / Rebates',
  'Other Operating Income',
  'Rental Income',
  'Commission Income',
  'Dividend Income',
  'Interest Income',
  'Opening Stock',
  'Purchases',
  'Direct Labour',
  'Factory Overheads',
  'Freight Inwards',
  'Closing Stock',
  'Inventory Write-down',
  'Freight Outwards',
  'Sales Salaries',
  'Marketing & Advertising',
  'Commission Expense',
  'Selling Others',
  'Admin Salaries',
  'Rent Expense',
  'Utilities',
  'Repairs & Maintenance',
  'Legal & Professional',
  'Communication / IT',
  'Insurance',
  'Depreciation',
  'Amortization',
  'Office Supplies / Stationery',
  'Admin Others',
  'Bad Debts / ECL Expense',
  'Donations / CSR',
  'Penalties / Fines (if reported)',
  'Other Operating Expenses',
  'Interest / Mark-up Expense',
  'Bank Charges',
  'Lease Finance Cost',
  'FX Loss (Net)',
  'Current Tax Expense',
  'Deferred Tax Expense / (Credit)',
  'Revaluation Surplus',
  'Actuarial Gains/Losses',
  'FVOCI Movements',
  'Hedge Reserve Movement',
  'Translation Differences'
];

export const TB_COLUMNS: ColumnDef[] = [
  { key: 'glCode', label: 'GL Code', type: 'text', required: true, width: '50px', sticky: 'left', truncate: false },
  { key: 'glName', label: 'GL Name', type: 'text', required: true, width: '140px', minWidth: '100px', truncate: true },
  { key: 'accountSubclass', label: 'Category', type: 'select', options: CATEGORY_OPTIONS, width: '100px' },
  { key: 'fsHeadKey', label: 'FS Head', type: 'select', options: FS_LINE_ITEM_OPTIONS, width: '120px' },
  { key: 'accountClass', label: 'Class', type: 'select', options: CLASS_OPTIONS, width: '60px' },
  { key: 'openingDebit', label: 'Open Dr', type: 'number', width: '80px', minWidth: '70px' },
  { key: 'openingCredit', label: 'Open Cr', type: 'number', width: '80px', minWidth: '70px' },
  { key: 'debit', label: 'Debit', type: 'drilldown', drilldownType: 'movement', width: '70px', minWidth: '60px' },
  { key: 'credit', label: 'Credit', type: 'drilldown', drilldownType: 'movement', width: '70px', minWidth: '60px' },
  { key: 'closingDebit', label: 'Close Dr', type: 'number', width: '80px', minWidth: '70px' },
  { key: 'closingCredit', label: 'Close Cr', type: 'number', width: '80px', minWidth: '70px' },
];

export const GL_COLUMNS: ColumnDef[] = [
  { key: 'glCode', label: 'GL Code', type: 'text', required: true, width: '90px', sticky: 'left', truncate: false },
  { key: 'glName', label: 'GL Name', type: 'text', width: '150px', truncate: true },
  { key: 'postingDate', label: 'Date', type: 'date', required: true, width: '90px' },
  { key: 'voucherNo', label: 'Voucher', type: 'text', width: '100px', truncate: true },
  { key: 'voucherType', label: 'Type', type: 'text', width: '65px' },
  { key: 'documentNo', label: 'Ref', type: 'text', width: '90px', truncate: true },
  { key: 'debit', label: 'Debit', type: 'number', width: '95px', minWidth: '80px' },
  { key: 'credit', label: 'Credit', type: 'number', width: '95px', minWidth: '80px' },
  { key: 'currency', label: 'CCY', type: 'text', width: '55px' },
  { key: 'narration', label: 'Narration', type: 'text', width: '150px', truncate: true },
];

export const PARTY_COLUMNS: ColumnDef[] = [
  { key: 'partyCode', label: 'Party Code', type: 'text', required: true, width: '90px', sticky: 'left', truncate: false },
  { key: 'partyName', label: 'Party Name', type: 'text', required: true, width: '150px', truncate: true },
  { key: 'partyType', label: 'Type', type: 'select', options: ['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'BANK', 'RP', 'OTHER'], width: '90px' },
  { key: 'glCode', label: 'Control A/C', type: 'text', width: '90px', truncate: false },
  { key: 'balanceType', label: 'DR/CR', type: 'select', options: ['DEBIT', 'CREDIT'], width: '70px' },
  { key: 'openingBalance', label: 'Opening', type: 'number', width: '100px', minWidth: '80px' },
  { key: 'balance', label: 'Balance', type: 'number', width: '100px', minWidth: '80px' },
  { key: 'email', label: 'Email', type: 'text', width: '140px', truncate: true },
];

export const BANK_COLUMNS: ColumnDef[] = [
  { key: 'bankAccountId', label: 'Bank ID', type: 'text', required: true, width: '80px', sticky: 'left', truncate: false },
  { key: 'bankName', label: 'Bank Name', type: 'text', required: true, width: '140px', truncate: true },
  { key: 'branch', label: 'Branch', type: 'text', width: '120px', truncate: true },
  { key: 'accountNumber', label: 'Account #', type: 'text', required: true, width: '120px', truncate: true },
  { key: 'accountTitle', label: 'Title', type: 'text', width: '90px' },
  { key: 'currency', label: 'CCY', type: 'text', width: '60px' },
  { key: 'closingBalance', label: 'Balance', type: 'number', width: '100px', minWidth: '85px' },
];

export default EditableDataGrid;
