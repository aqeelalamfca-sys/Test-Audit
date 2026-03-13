import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient, flushDraftSave } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SaveStatus } from "./use-save-engine";

const AUTO_SAVE_DELAY = 3000;

export interface SimpleSaveBridgeConfig {
  /** Entity type used in API path and request body (e.g. "deliverables", "evidence"). */
  entityType: string;
  /** Page key sent in the request body. Defaults to `entityType`. */
  pageKey?: string;
  /** Default path to navigate to after saveAndClose. Defaults to `/engagement/${engagementId}`. */
  defaultRedirectPath?: string;
  /** Toast description for draft/final saves. Defaults to generic message. */
  successDescription?: (isDraft: boolean) => string;
  /** Toast description on error. Defaults to a generic message. */
  errorDescription?: string;
}

export interface SimpleSaveBridgeResult {
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

/**
 * Generic save-bridge hook for sections that do NOT require workspace context
 * integration (e.g. deliverables, evidence, inspection).
 *
 * Specific hooks are thin wrappers that supply their entity-specific config.
 */
export function useSimpleSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => Record<string, any>,
  config: SimpleSaveBridgeConfig
): SimpleSaveBridgeResult {
  const { entityType, successDescription, errorDescription } = config;
  const pageKey = config.pageKey ?? entityType;

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

  const doSave = useCallback(
    async (asDraft: boolean): Promise<boolean> => {
      if (!engagementId) return false;
      if (isSavingRef.current) return false;

      isSavingRef.current = true;
      setIsSaving(true);
      setStatus("saving");

      try {
        const payload = buildPayload();
        const endpoint = asDraft
          ? `/api/workspace/${engagementId}/${entityType}/draft`
          : `/api/workspace/${engagementId}/${entityType}`;

        await apiRequest(asDraft ? "POST" : "PUT", endpoint, {
          data: payload,
          entityType,
          pageKey,
          engagementId,
          isDraft: asDraft,
        });

        lastSavedSignatureRef.current = JSON.stringify(payload);
        setIsDirty(false);
        setStatus("saved");
        setLastSavedAt(new Date());

        queryClient.invalidateQueries({
          queryKey: [`/api/workspace/${engagementId}/${entityType}`],
        });

        toast({
          title: asDraft ? "Draft Saved" : "Progress Saved",
          description: successDescription
            ? successDescription(asDraft)
            : `${entityType} ${asDraft ? "draft" : "progress"} saved successfully.`,
        });

        return true;
      } catch (error) {
        setStatus("error");
        toast({
          title: "Save Failed",
          description:
            errorDescription ?? `Failed to save ${entityType}. Please try again.`,
          variant: "destructive",
        });
        return false;
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [engagementId, entityType, pageKey, buildPayload, toast, successDescription, errorDescription]
  );

  // Auto-save when dirty
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
  }, [isDirty, changeCountRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush unsaved draft on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      const eid = engagementIdRef.current;
      if (isDirtyRef.current && !isSavingRef.current && eid) {
        const payload = buildPayloadRef.current();
        flushDraftSave("POST", `/api/workspace/${eid}/${entityType}/draft`, {
          data: payload,
          entityType,
          pageKey,
          engagementId: eid,
          isDraft: true,
        });
      }
    };
  }, [entityType, pageKey]);

  const saveDraft = useCallback(() => doSave(true), [doSave]);
  const saveFinal = useCallback(() => doSave(false), [doSave]);

  const saveAndClose = useCallback(
    async (redirectPath?: string): Promise<boolean> => {
      const success = await doSave(false);
      if (success) {
        const defaultPath =
          config.defaultRedirectPath ?? `/engagement/${engagementId}`;
        navigate(redirectPath || defaultPath);
      }
      return success;
    },
    [doSave, engagementId, navigate, config.defaultRedirectPath]
  );

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
