import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient, flushDraftSave } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/lib/workspace-context";
import type { SaveStatus } from "./use-save-engine";

export interface ExecutionSavePayload {
  [key: string]: any;
}

export interface ExecutionSaveBridgeResult {
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

export function useExecutionSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => ExecutionSavePayload
): ExecutionSaveBridgeResult {
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
  
  const sectionKey = `execution-${engagementId || "unknown"}`;
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  const lastSavedSignatureRef = useRef<string>("");
  const hasBaselineRef = useRef(false);
  const changeCountRef = useRef(0);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const dataLoadedRef = useRef(false);
  const isDirtyRef = useRef(false);
  const buildPayloadRef = useRef(buildPayload);

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

  useEffect(() => {
    buildPayloadRef.current = buildPayload;
  }, [buildPayload]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

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
      
      if (currentSignature === lastSavedSignatureRef.current && isDraft) {
        setStatus("saved");
        setIsDirty(false);
        isSavingRef.current = false;
        setIsSaving(false);
        return true;
      }
      
      const endpoint = isDraft 
        ? `/api/workspace/${engagementId}/execution/draft`
        : `/api/workspace/${engagementId}/execution`;
      
      const method = isDraft ? "POST" : "PUT";
      const response = await apiRequest(method, endpoint, {
        data: payload,
        entityType: "execution",
        pageKey: "execution",
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
            description: result.message || "Your execution data has been saved successfully.",
          });
        }
        
        queryClient.invalidateQueries({ 
          queryKey: [`/api/workspace/${engagementId}/execution`] 
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
          description: error.message || "Failed to save execution data",
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
      setStatus((prev: SaveStatus) => prev === "saved" ? "saved" : "idle");
    } else {
      setIsDirty(true);
      setStatus((prev: SaveStatus) => prev === "saving" ? "saving" : "dirty");

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
    const eid = engagementId;
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (isDirtyRef.current && dataLoadedRef.current && !isSavingRef.current && eid) {
        try {
          const payload = buildPayloadRef.current();
          const currentSignature = JSON.stringify(payload);
          if (currentSignature !== lastSavedSignatureRef.current) {
            const endpoint = `/api/workspace/${eid}/execution/draft`;
            flushDraftSave("POST", endpoint, {
              data: payload,
              entityType: "execution",
              pageKey: "execution",
              engagementId: eid,
              isDraft: true,
            });
          }
        } catch (_e) {}
      }
    };
  }, [engagementId]);

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
      const path = redirectPath || `/workspace/${engagementId}`;
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
        e.returnValue = "";
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
    signalChange
  };
}
