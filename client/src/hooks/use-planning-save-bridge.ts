import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/lib/workspace-context";
import type { SaveStatus } from "./use-save-engine";

export interface PlanningSavePayload {
  [key: string]: any;
}

export interface PlanningSaveBridgeResult {
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
  dataLoaded: boolean;
}

const AUTO_SAVE_DELAY = 3000;

export function usePlanningSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => PlanningSavePayload
): PlanningSaveBridgeResult {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { 
    registerSection, 
    unregisterSection, 
    markSectionDirty, 
    markSectionSaving, 
    markSectionSaved, 
    markSectionError 
  } = useWorkspace();
  
  const sectionKey = `planning-${engagementId || "unknown"}`;
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const lastSavedSignatureRef = useRef<string>("");
  const hasBaselineRef = useRef(false);
  const changeCountRef = useRef(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (engagementId) {
      registerSection(sectionKey);
    }
    return () => {
      if (engagementId) {
        unregisterSection(sectionKey);
      }
    };
  }, [sectionKey, engagementId, registerSection, unregisterSection]);

  useEffect(() => {
    if (engagementId) {
      markSectionDirty(sectionKey, isDirty);
    }
  }, [isDirty, sectionKey, engagementId, markSectionDirty]);

  useEffect(() => {
    if (engagementId) {
      markSectionSaving(sectionKey, isSaving);
    }
  }, [isSaving, sectionKey, engagementId, markSectionSaving]);

  const signalChange = useCallback(() => {
    changeCountRef.current += 1;
    setIsDirty(true);
    setStatus("dirty");
  }, []);

  const initializeBaseline = useCallback(() => {
    const currentPayload = buildPayload();
    const currentSignature = JSON.stringify(currentPayload);
    lastSavedSignatureRef.current = currentSignature;
    hasBaselineRef.current = true;
    dataLoadedRef.current = true;
    setDataLoaded(true);
    setIsDirty(false);
    setStatus("idle");
  }, [buildPayload]);

  const saveMutation = useCallback(async (isDraft: boolean, silent = false): Promise<boolean> => {
    if (!engagementId) return false;
    if (isSavingRef.current) return false;
    if (!dataLoadedRef.current) return false;
    
    isSavingRef.current = true;
    setIsSaving(true);
    setStatus("saving");
    
    try {
      const payload = buildPayload();
      const currentSignature = JSON.stringify(payload);
      
      if (currentSignature === lastSavedSignatureRef.current && !isDraft) {
        setStatus("saved");
        setIsDirty(false);
        isSavingRef.current = false;
        setIsSaving(false);
        return true;
      }
      
      const endpoint = isDraft 
        ? `/api/workspace/${engagementId}/planning/draft`
        : `/api/workspace/${engagementId}/planning`;
      
      const method = isDraft ? "POST" : "PUT";
      const response = await apiRequest(method, endpoint, {
        data: payload,
        entityType: "planning",
        pageKey: "planning",
        engagementId,
        isDraft
      });
      
      const result = await response.json();
      
      if (result.success !== false) {
        setStatus("saved");
        setLastSavedAt(new Date());
        setIsDirty(false);
        lastSavedSignatureRef.current = currentSignature;
        markSectionSaved(sectionKey);
        
        if (!silent) {
          toast({
            title: isDraft ? "Draft Saved" : "Changes Saved",
            description: result.message || "Your planning data has been saved successfully.",
          });
        }
        
        queryClient.invalidateQueries({ 
          queryKey: [`/api/workspace/${engagementId}/planning`] 
        });
        
        return true;
      } else {
        throw new Error(result.message || "Save failed");
      }
    } catch (error: any) {
      setStatus("error");
      markSectionError(sectionKey);
      if (!silent) {
        toast({
          title: "Save Failed",
          description: error.message || "Failed to save planning data",
          variant: "destructive",
        });
      }
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [engagementId, buildPayload, toast, sectionKey, markSectionSaved, markSectionError]);

  useEffect(() => {
    if (!hasBaselineRef.current) {
      initializeBaseline();
      return;
    }

    const currentPayload = buildPayload();
    const currentSignature = JSON.stringify(currentPayload);
    
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
          saveMutation(true, true);
        }, AUTO_SAVE_DELAY);
      }
    }
  }, [buildPayload, initializeBaseline, saveMutation]);

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
    return saveMutation(true);
  }, [saveMutation]);

  const saveFinal = useCallback(async (): Promise<boolean> => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    return saveMutation(false);
  }, [saveMutation]);

  const saveAndClose = useCallback(async (redirectPath?: string): Promise<boolean> => {
    const success = await saveFinal();
    if (success) {
      const path = redirectPath || `/engagement/${engagementId}`;
      navigate(path);
    }
    return success;
  }, [saveFinal, navigate, engagementId]);

  const resetDirty = useCallback(() => {
    initializeBaseline();
  }, [initializeBaseline]);

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
    dataLoaded
  };
}
