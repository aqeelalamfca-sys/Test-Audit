import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "dirty";

export interface SaveEngineConfig {
  entityType: string;
  entityId?: string;
  engagementId?: string;
  clientId?: string;
  pageKey: string;
  baseEndpoint?: string;
  onSaveSuccess?: (data: any) => void;
  onSaveError?: (error: any) => void;
  enableDraftAutosave?: boolean;
  autosaveDebounceMs?: number;
}

export interface SaveEngineResult<T extends Record<string, any>> {
  data: T;
  setData: (data: T) => void;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  isDirty: boolean;
  isSaving: boolean;
  status: SaveStatus;
  lastSavedAt: Date | null;
  errors: Record<string, string>;
  saveDraft: () => Promise<boolean>;
  saveFinal: () => Promise<boolean>;
  saveAndClose: (redirectPath?: string) => Promise<boolean>;
  resetDirty: () => void;
  setErrors: (errors: Record<string, string>) => void;
  hasUnsavedChanges: () => boolean;
}

export function useSaveEngine<T extends Record<string, any>>(
  initialData: T,
  config: SaveEngineConfig
): SaveEngineResult<T> {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [data, setDataInternal] = useState<T>(initialData);
  const [originalData, setOriginalData] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getEndpoint = useCallback((isDraft: boolean) => {
    const base = config.baseEndpoint || `/api/workspace/${config.engagementId}/${config.pageKey}`;
    return isDraft ? `${base}/draft` : base;
  }, [config.baseEndpoint, config.engagementId, config.pageKey]);

  const saveMutation = useMutation({
    mutationFn: async ({ isDraft, silent }: { isDraft: boolean; silent?: boolean }) => {
      const endpoint = getEndpoint(isDraft);
      const method = config.entityId ? "PUT" : "POST";
      
      const payload = {
        ...data,
        entityType: config.entityType,
        pageKey: config.pageKey,
        clientId: config.clientId,
        engagementId: config.engagementId,
        isDraft,
      };

      const MAX_RETRIES = 3;
      let lastError: any;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const response = await apiRequest(method, endpoint, payload);
          return response.json();
        } catch (error: any) {
          lastError = error;
          const status = error?.status || error?.statusCode || 0;
          const isRetryable = status === 0 || status >= 500 || 
            String(error?.message || "").includes("fetch") ||
            String(error?.message || "").includes("network") ||
            String(error?.message || "").includes("Failed to fetch");
          if (attempt < MAX_RETRIES - 1 && isRetryable) {
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
            continue;
          }
        }
      }
      throw lastError;
    },
    onSuccess: (result, variables) => {
      if (result.success !== false) {
        setStatus("saved");
        setLastSavedAt(new Date());
        setIsDirty(false);
        setOriginalData(data);
        setErrors({});
        
        if (!variables.silent) {
          toast({
            title: variables.isDraft ? "Draft Saved" : "Changes Saved",
            description: result.message || "Your changes have been saved successfully.",
          });
        }

        if (config.onSaveSuccess) {
          config.onSaveSuccess(result.data || result);
        }

        queryClient.invalidateQueries({ 
          queryKey: [`/api/workspace/${config.engagementId}/${config.pageKey}`] 
        });
      } else {
        throw new Error(result.message || "Save failed");
      }
    },
    onError: (error: any, variables: { isDraft: boolean; silent?: boolean }) => {
      setStatus("error");
      
      if (!variables.silent) {
        const errorMessage = error.message || "Failed to save changes";
        toast({
          title: "Save Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }

      if (error.errors && typeof error.errors === "object") {
        setErrors(error.errors);
      }

      if (config.onSaveError) {
        config.onSaveError(error);
      }
    },
  });

  const setData = useCallback((newData: T) => {
    setDataInternal(newData);
    setIsDirty(true);
    setStatus("dirty");
  }, []);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setDataInternal(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setStatus("dirty");
  }, []);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (saveMutation.isPending) return false;
    setStatus("saving");
    
    try {
      await saveMutation.mutateAsync({ isDraft: true });
      return true;
    } catch {
      return false;
    }
  }, [saveMutation]);

  const saveFinal = useCallback(async (): Promise<boolean> => {
    if (saveMutation.isPending) return false;
    setStatus("saving");
    
    try {
      await saveMutation.mutateAsync({ isDraft: false });
      return true;
    } catch {
      return false;
    }
  }, [saveMutation]);

  const saveAndClose = useCallback(async (redirectPath?: string): Promise<boolean> => {
    const success = await saveFinal();
    if (success) {
      const path = redirectPath || `/workspace/${config.engagementId}`;
      navigate(path);
    }
    return success;
  }, [saveFinal, navigate, config.engagementId]);

  const resetDirty = useCallback(() => {
    setIsDirty(false);
    setStatus("idle");
    setOriginalData(data);
  }, [data]);

  const hasUnsavedChanges = useCallback(() => {
    return isDirty;
  }, [isDirty]);

  useEffect(() => {
    if ((config.enableDraftAutosave !== false) && isDirty) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      
      autosaveTimerRef.current = setTimeout(() => {
        if (saveMutation.isPending) return;
        setStatus("saving");
        saveMutation.mutateAsync({ isDraft: true, silent: true }).catch(() => {});
      }, config.autosaveDebounceMs || 10000);
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isDirty, config.enableDraftAutosave, config.autosaveDebounceMs, saveDraft]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    setDataInternal(initialData);
    setOriginalData(initialData);
    setIsDirty(false);
    setStatus("idle");
  }, [initialData]);

  return {
    data,
    setData,
    updateField,
    isDirty,
    isSaving: saveMutation.isPending,
    status,
    lastSavedAt,
    errors,
    saveDraft,
    saveFinal,
    saveAndClose,
    resetDirty,
    setErrors,
    hasUnsavedChanges,
  };
}

export function useFormSaveEngine<T extends Record<string, any>>(
  form: { getValues: () => T; reset: (values: T) => void; formState: { isDirty: boolean } },
  config: SaveEngineConfig
) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getEndpoint = useCallback((isDraft: boolean) => {
    const base = config.baseEndpoint || `/api/workspace/${config.engagementId}/${config.pageKey}`;
    return isDraft ? `${base}/draft` : base;
  }, [config.baseEndpoint, config.engagementId, config.pageKey]);

  const saveMutation = useMutation({
    mutationFn: async ({ isDraft }: { isDraft: boolean }) => {
      const endpoint = getEndpoint(isDraft);
      const method = config.entityId ? "PUT" : "POST";
      const formData = form.getValues();
      
      const payload = {
        ...formData,
        entityType: config.entityType,
        pageKey: config.pageKey,
        clientId: config.clientId,
        engagementId: config.engagementId,
        isDraft,
      };

      const response = await apiRequest(method, endpoint, payload);
      return response.json();
    },
    onSuccess: (result, variables) => {
      if (result.success !== false) {
        setStatus("saved");
        setLastSavedAt(new Date());
        setErrors({});
        form.reset(form.getValues());
        
        toast({
          title: variables.isDraft ? "Draft Saved" : "Changes Saved",
          description: result.message || "Your changes have been saved successfully.",
        });

        if (config.onSaveSuccess) {
          config.onSaveSuccess(result.data || result);
        }

        queryClient.invalidateQueries({ 
          queryKey: [`/api/workspace/${config.engagementId}/${config.pageKey}`] 
        });
      } else {
        throw new Error(result.message || "Save failed");
      }
    },
    onError: (error: any) => {
      setStatus("error");
      
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });

      if (error.errors) {
        setErrors(error.errors);
      }

      if (config.onSaveError) {
        config.onSaveError(error);
      }
    },
  });

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (saveMutation.isPending) return false;
    setStatus("saving");
    try {
      await saveMutation.mutateAsync({ isDraft: true });
      return true;
    } catch {
      return false;
    }
  }, [saveMutation]);

  const saveFinal = useCallback(async (): Promise<boolean> => {
    if (saveMutation.isPending) return false;
    setStatus("saving");
    try {
      await saveMutation.mutateAsync({ isDraft: false });
      return true;
    } catch {
      return false;
    }
  }, [saveMutation]);

  const saveAndClose = useCallback(async (redirectPath?: string): Promise<boolean> => {
    const success = await saveFinal();
    if (success) {
      const path = redirectPath || `/workspace/${config.engagementId}`;
      navigate(path);
    }
    return success;
  }, [saveFinal, navigate, config.engagementId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.formState.isDirty]);

  return {
    isDirty: form.formState.isDirty,
    isSaving: saveMutation.isPending,
    status,
    lastSavedAt,
    errors,
    saveDraft,
    saveFinal,
    saveAndClose,
    setErrors,
  };
}
