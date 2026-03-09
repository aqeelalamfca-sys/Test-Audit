import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient, flushDraftSave } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SaveStatus } from "./use-save-engine";

const AUTO_SAVE_DELAY = 3000;

export interface InspectionSavePayload {
  [key: string]: any;
}

export interface InspectionSaveBridgeResult {
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

export function useInspectionSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => InspectionSavePayload
): InspectionSaveBridgeResult {
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
  const isDirtyRef = useRef(false);
  const buildPayloadRef = useRef(buildPayload);
  const engagementIdRef = useRef(engagementId);

  buildPayloadRef.current = buildPayload;
  engagementIdRef.current = engagementId;
  isDirtyRef.current = isDirty;

  const signalChange = useCallback(() => {
    changeCountRef.current += 1;
    setIsDirty(true);
    setStatus("dirty");
  }, []);

  const initializeBaseline = useCallback(() => {
    hasBaselineRef.current = true;
    lastSavedSignatureRef.current = JSON.stringify(buildPayload());
    setIsDirty(false);
    setStatus("idle");
  }, [buildPayload]);

  const resetDirty = useCallback(() => {
    setIsDirty(false);
    setStatus("idle");
    lastSavedSignatureRef.current = JSON.stringify(buildPayload());
  }, [buildPayload]);

  const doSave = useCallback(async (asDraft: boolean): Promise<boolean> => {
    if (!engagementId) return false;
    if (isSavingRef.current) return false;
    
    isSavingRef.current = true;
    setIsSaving(true);
    setStatus("saving");
    
    try {
      const payload = buildPayload();
      
      const endpoint = asDraft 
        ? `/api/workspace/${engagementId}/inspection/draft`
        : `/api/workspace/${engagementId}/inspection`;
      const method = asDraft ? "POST" : "PUT";
      await apiRequest(method, endpoint, {
        data: payload,
        entityType: "inspection",
        pageKey: "inspection",
        engagementId,
        isDraft: asDraft,
      });
      
      lastSavedSignatureRef.current = JSON.stringify(payload);
      setIsDirty(false);
      setStatus("saved");
      setLastSavedAt(new Date());
      
      queryClient.invalidateQueries({ queryKey: [`/api/workspace/${engagementId}/inspection`] });
      
      toast({
        title: asDraft ? "Draft Saved" : "Progress Saved",
        description: `Inspection data ${asDraft ? "draft" : "progress"} saved successfully.`,
      });
      
      return true;
    } catch (error) {
      console.error("Inspection save error:", error);
      setStatus("error");
      
      toast({
        title: "Save Failed",
        description: "Failed to save inspection data. Please try again.",
        variant: "destructive",
      });
      
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [engagementId, buildPayload, toast]);

  useEffect(() => {
    if (isDirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        doSave(true);
      }, AUTO_SAVE_DELAY);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isDirty, changeCountRef.current]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (isDirtyRef.current && !isSavingRef.current && engagementIdRef.current) {
        const payload = buildPayloadRef.current();
        const eid = engagementIdRef.current;
        flushDraftSave("POST", `/api/workspace/${eid}/inspection/draft`, {
          data: payload,
          entityType: "inspection",
          pageKey: "inspection",
          engagementId: eid,
          isDraft: true,
        });
      }
    };
  }, []);

  const saveDraft = useCallback(() => doSave(true), [doSave]);
  const saveFinal = useCallback(() => doSave(false), [doSave]);

  const saveAndClose = useCallback(async (redirectPath?: string): Promise<boolean> => {
    const success = await doSave(false);
    if (success) {
      const path = redirectPath || `/engagement/${engagementId}`;
      navigate(path);
    }
    return success;
  }, [doSave, engagementId, navigate]);

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
