import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient, flushDraftSave } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/lib/workspace-context";
import type { SaveStatus } from "./use-save-engine";

const AUTO_SAVE_DELAY = 3000;

export interface SubstantiveSavePayload {
  [key: string]: any;
}

export interface SubstantiveSaveBridgeResult {
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

export function useSubstantiveSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => SubstantiveSavePayload
): SubstantiveSaveBridgeResult {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { registerSection, unregisterSection, markSectionDirty, markSectionSaving, markSectionSaved, markSectionError } = useWorkspace();
  
  const sectionKey = `substantive-${engagementId || "unknown"}`;
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  const lastSavedSignatureRef = useRef<string>("");
  const hasBaselineRef = useRef(false);
  const changeCountRef = useRef(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const isDirtyRef = useRef(false);
  const buildPayloadRef = useRef(buildPayload);
  const dataLoadedRef = useRef(false);

  buildPayloadRef.current = buildPayload;
  isDirtyRef.current = isDirty;
  isSavingRef.current = isSaving;

  useEffect(() => {
    if (engagementId) { registerSection(sectionKey); }
    return () => { if (engagementId) { unregisterSection(sectionKey); } };
  }, [sectionKey, engagementId, registerSection, unregisterSection]);

  useEffect(() => {
    if (engagementId) { markSectionDirty(sectionKey, isDirty); }
  }, [isDirty, sectionKey, engagementId, markSectionDirty]);

  useEffect(() => {
    if (engagementId) { markSectionSaving(sectionKey, isSaving); }
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
    setIsDirty(false);
    setStatus("idle");
  }, [buildPayload]);

  const saveMutation = useCallback(async (isDraft: boolean, silent?: boolean): Promise<boolean> => {
    if (!engagementId) return false;
    if (isSavingRef.current) return false;
    
    isSavingRef.current = true;
    setIsSaving(true);
    setStatus("saving");
    
    try {
      const payload = buildPayloadRef.current();
      const endpoint = isDraft 
        ? `/api/workspace/${engagementId}/substantive/draft`
        : `/api/workspace/${engagementId}/substantive`;
      
      const method = isDraft ? "POST" : "PUT";
      const response = await apiRequest(method, endpoint, {
        data: payload,
        entityType: "substantive",
        pageKey: "substantive",
        engagementId,
        isDraft
      });
      
      const result = await response.json();
      
      if (result.success !== false) {
        setStatus("saved");
        setLastSavedAt(new Date());
        setIsDirty(false);
        isDirtyRef.current = false;
        lastSavedSignatureRef.current = JSON.stringify(payload);
        markSectionSaved(sectionKey);
        
        if (!silent) {
          toast({
            title: isDraft ? "Draft Saved" : "Changes Saved",
            description: result.message || "Your substantive testing data has been saved successfully.",
          });
        }
        
        queryClient.invalidateQueries({ 
          queryKey: [`/api/workspace/${engagementId}/substantive`] 
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
          description: error.message || "Failed to save substantive testing data",
          variant: "destructive",
        });
      }
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [engagementId, toast, sectionKey, markSectionSaved, markSectionError]);

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
          if (isDirtyRef.current && !isSavingRef.current) {
            saveMutation(true, true);
          }
        }, AUTO_SAVE_DELAY);
      }
    }
  }, [buildPayload, initializeBaseline, saveMutation]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (isDirtyRef.current && !isSavingRef.current && dataLoadedRef.current && engagementId) {
        const payload = buildPayloadRef.current();
        const endpoint = `/api/workspace/${engagementId}/substantive/draft`;
        flushDraftSave("POST", endpoint, {
          data: payload,
          entityType: "substantive",
          pageKey: "substantive",
          engagementId,
          isDraft: true
        });
      }
    };
  }, [engagementId]);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    return saveMutation(true);
  }, [saveMutation]);

  const saveFinal = useCallback(async (): Promise<boolean> => {
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
