import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/lib/workspace-context";
import type { SaveStatus } from "./use-save-engine";

export interface ControlsSavePayload {
  [key: string]: any;
}

export interface ControlsSaveBridgeResult {
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

export function useControlsSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => ControlsSavePayload
): ControlsSaveBridgeResult {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { registerSection, unregisterSection, markSectionDirty, markSectionSaving, markSectionSaved, markSectionError } = useWorkspace();
  
  const sectionKey = `controls-${engagementId || "unknown"}`;
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  const lastSavedSignatureRef = useRef<string>("");
  const hasBaselineRef = useRef(false);
  const changeCountRef = useRef(0);

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
    setIsDirty(false);
    setStatus("idle");
  }, [buildPayload]);

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
    }
  }, [buildPayload, initializeBaseline]);

  const saveMutation = useCallback(async (isDraft: boolean): Promise<boolean> => {
    if (!engagementId) return false;
    
    setIsSaving(true);
    setStatus("saving");
    
    try {
      const payload = buildPayload();
      const endpoint = isDraft 
        ? `/api/workspace/${engagementId}/controls/draft`
        : `/api/workspace/${engagementId}/controls`;
      
      const method = isDraft ? "POST" : "PUT";
      const response = await apiRequest(method, endpoint, {
        data: payload,
        entityType: "controls",
        pageKey: "controls",
        engagementId,
        isDraft
      });
      
      const result = await response.json();
      
      if (result.success !== false) {
        setStatus("saved");
        setLastSavedAt(new Date());
        setIsDirty(false);
        lastSavedSignatureRef.current = JSON.stringify(payload);
        markSectionSaved(sectionKey);
        
        toast({
          title: isDraft ? "Draft Saved" : "Changes Saved",
          description: result.message || "Your controls data has been saved successfully.",
        });
        
        queryClient.invalidateQueries({ 
          queryKey: [`/api/workspace/${engagementId}/controls`] 
        });
        
        return true;
      } else {
        throw new Error(result.message || "Save failed");
      }
    } catch (error: any) {
      setStatus("error");
      markSectionError(sectionKey);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save controls data",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [engagementId, buildPayload, toast, sectionKey, markSectionSaved, markSectionError]);

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
