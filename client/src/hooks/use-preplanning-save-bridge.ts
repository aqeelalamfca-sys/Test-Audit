import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SaveStatus } from "./use-save-engine";

export interface PreplanningSavePayload {
  [key: string]: any;
}

export interface PreplanningSaveBridgeResult {
  isDirty: boolean;
  isSaving: boolean;
  status: SaveStatus;
  lastSavedAt: Date | null;
  saveDraft: () => Promise<boolean>;
  saveFinal: () => Promise<boolean>;
  saveAndClose: (redirectPath?: string) => Promise<boolean>;
  resetDirty: () => void;
  initializeBaseline: () => void;
  signalChange: () => void;
}

const AUTO_SAVE_DELAY = 3000;

export function usePreplanningSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => PreplanningSavePayload
): PreplanningSaveBridgeResult {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  const lastSavedSignatureRef = useRef<string>("");
  const hasBaselineRef = useRef(false);
  const changeCountRef = useRef(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const dataLoadedRef = useRef(false);

  const signalChange = useCallback(() => {
    changeCountRef.current += 1;
    setIsDirty(true);
    setStatus("dirty");
  }, []);

  const initializeBaseline = useCallback(() => {
    hasBaselineRef.current = true;
    dataLoadedRef.current = true;
    lastSavedSignatureRef.current = JSON.stringify(buildPayload());
    setIsDirty(false);
    setStatus("idle");
  }, [buildPayload]);

  const resetDirty = useCallback(() => {
    setIsDirty(false);
    setStatus("idle");
    lastSavedSignatureRef.current = JSON.stringify(buildPayload());
  }, [buildPayload]);

  const doSave = useCallback(async (asDraft: boolean, silent = false): Promise<boolean> => {
    if (!engagementId) return false;
    if (isSavingRef.current) return false;
    if (!dataLoadedRef.current) return false;
    
    isSavingRef.current = true;
    setIsSaving(true);
    setStatus("saving");
    
    const MAX_RETRIES = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const payload = buildPayload();
        const currentSignature = JSON.stringify(payload);
        
        if (currentSignature === lastSavedSignatureRef.current) {
          setStatus("saved");
          setIsDirty(false);
          isSavingRef.current = false;
          setIsSaving(false);
          return true;
        }
        
        await apiRequest("PUT", `/api/engagements/${engagementId}/pre-planning`, {
          ...payload,
          isDraft: asDraft,
        });
        
        lastSavedSignatureRef.current = currentSignature;
        setIsDirty(false);
        setStatus("saved");
        setLastSavedAt(new Date());
        
        queryClient.invalidateQueries({ queryKey: [`/api/engagements/${engagementId}/pre-planning`] });
        
        if (!silent) {
          toast({
            title: asDraft ? "Draft Saved" : "Progress Saved",
            description: `Pre-planning ${asDraft ? "draft" : "progress"} saved successfully.`,
          });
        }
        
        isSavingRef.current = false;
        setIsSaving(false);
        return true;
      } catch (error: any) {
        lastError = error;
        const errorStatus = error?.status || error?.statusCode || 0;
        const isRetryable = errorStatus === 0 || errorStatus >= 500 || 
          String(error?.message || "").includes("fetch") ||
          String(error?.message || "").includes("network") ||
          String(error?.message || "").includes("Failed to fetch");
        
        if (attempt < MAX_RETRIES - 1 && isRetryable) {
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          continue;
        }
      }
    }
    
    console.error("Pre-planning save error after retries:", lastError);
    setStatus("error");
    
    if (!silent) {
      toast({
        title: "Save Failed",
        description: "Failed to save pre-planning data. Please try again.",
        variant: "destructive",
      });
    }
    
    isSavingRef.current = false;
    setIsSaving(false);
    return false;
  }, [engagementId, buildPayload, toast]);

  useEffect(() => {
    if (!hasBaselineRef.current) {
      return;
    }

    const currentSignature = JSON.stringify(buildPayload());
    
    if (currentSignature === lastSavedSignatureRef.current) {
      setIsDirty(false);
      setStatus(prev => prev === "saved" ? "saved" : "idle");
    } else {
      setIsDirty(true);
      setStatus(prev => prev === "saving" ? "saving" : "dirty");
      
      if (dataLoadedRef.current && !isSavingRef.current) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
          doSave(true, true);
        }, AUTO_SAVE_DELAY);
      }
    }
  }, [buildPayload, doSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    return doSave(true);
  }, [doSave]);

  const saveFinal = useCallback(async (): Promise<boolean> => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    return doSave(false);
  }, [doSave]);

  const saveAndClose = useCallback(async (redirectPath?: string): Promise<boolean> => {
    const success = await doSave(false);
    if (success) {
      const path = redirectPath || `/engagement/${engagementId}`;
      navigate(path);
    }
    return success;
  }, [doSave, engagementId, navigate]);

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

  return {
    isDirty,
    isSaving,
    status,
    lastSavedAt,
    saveDraft,
    saveFinal,
    saveAndClose,
    resetDirty,
    initializeBaseline,
    signalChange,
  };
}
