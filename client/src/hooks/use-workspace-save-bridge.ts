import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient, flushDraftSave } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/lib/workspace-context";
import type { SaveStatus } from "./use-save-engine";

const AUTO_SAVE_DELAY = 3000;

export interface WorkspaceSaveBridgeConfig {
  /** Entity type used in API path and request body (e.g. "controls", "planning"). */
  entityType: string;
  /** Page key sent in the request body. Defaults to `entityType`. */
  pageKey?: string;
  /** Prefix for the workspace section key. Defaults to `entityType`. */
  sectionKeyPrefix?: string;
  /**
   * URL prefix segment used to build the default redirect path after saveAndClose.
   * Resulting path will be `/${defaultRedirectPrefix}/${engagementId}`.
   * Defaults to `"workspace"`.
   */
  defaultRedirectPrefix?: "engagement" | "workspace";
}

export interface WorkspaceSaveBridgeResult {
  isDirty: boolean;
  isSaving: boolean;
  status: SaveStatus;
  lastSavedAt: Date | null;
  dataLoaded: boolean;
  saveDraft: () => Promise<boolean>;
  saveFinal: () => Promise<boolean>;
  saveAndClose: (redirectPath?: string) => Promise<boolean>;
  resetDirty: () => void;
  initializeBaseline: () => void;
  signalChange: () => void;
}

/**
 * Generic save-bridge hook for workspace sections that integrate with the
 * global WorkspaceContext (section dirty/saving state tracking).
 *
 * Specific hooks (e.g. useControlsSaveBridge) are thin wrappers around this
 * hook that supply their entity-specific configuration.
 */
export function useWorkspaceSaveBridge(
  engagementId: string | undefined,
  buildPayload: () => Record<string, any>,
  config: WorkspaceSaveBridgeConfig
): WorkspaceSaveBridgeResult {
  const { entityType } = config;
  const pageKey = config.pageKey ?? entityType;
  const sectionKeyPrefix = config.sectionKeyPrefix ?? entityType;

  const { toast } = useToast();
  const [, navigate] = useLocation();
  const {
    registerSection,
    unregisterSection,
    markSectionDirty,
    markSectionSaving,
    markSectionSaved,
    markSectionError,
  } = useWorkspace();

  const sectionKey = `${sectionKeyPrefix}-${engagementId || "unknown"}`;

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
  const isDirtyRef = useRef(false);
  const dataLoadedRef = useRef(false);
  const buildPayloadRef = useRef(buildPayload);
  const engagementIdRef = useRef(engagementId);

  buildPayloadRef.current = buildPayload;
  engagementIdRef.current = engagementId;
  isDirtyRef.current = isDirty;

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
    isDirtyRef.current = true;
    setIsDirty(true);
    setStatus("dirty");
  }, []);

  const initializeBaseline = useCallback(() => {
    const currentSignature = JSON.stringify(buildPayload());
    lastSavedSignatureRef.current = currentSignature;
    hasBaselineRef.current = true;
    dataLoadedRef.current = true;
    isDirtyRef.current = false;
    setDataLoaded(true);
    setIsDirty(false);
    setStatus("idle");
  }, [buildPayload]);

  const saveMutation = useCallback(
    async (isDraft: boolean, silent?: boolean): Promise<boolean> => {
      if (!engagementId) return false;
      if (isSavingRef.current) return false;
      if (!dataLoadedRef.current) return false;

      isSavingRef.current = true;
      setIsSaving(true);
      setStatus("saving");

      try {
        const payload = buildPayloadRef.current();
        const endpoint = isDraft
          ? `/api/workspace/${engagementId}/${entityType}/draft`
          : `/api/workspace/${engagementId}/${entityType}`;

        const response = await apiRequest(isDraft ? "POST" : "PUT", endpoint, {
          data: payload,
          entityType,
          pageKey,
          engagementId,
          isDraft,
        });

        const result = await response.json();

        if (result.success !== false) {
          setStatus("saved");
          setLastSavedAt(new Date());
          isDirtyRef.current = false;
          setIsDirty(false);
          lastSavedSignatureRef.current = JSON.stringify(payload);
          markSectionSaved(sectionKey);

          if (!silent) {
            toast({
              title: isDraft ? "Draft Saved" : "Changes Saved",
              description:
                result.message || `Your ${entityType} data has been saved successfully.`,
            });
          }

          queryClient.invalidateQueries({
            queryKey: [`/api/workspace/${engagementId}/${entityType}`],
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
            description: error.message || `Failed to save ${entityType} data`,
            variant: "destructive",
          });
        }
        return false;
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    // entityType and pageKey are stable config values, safe to include
    [engagementId, entityType, pageKey, toast, sectionKey, markSectionSaved, markSectionError]
  );

  useEffect(() => {
    if (!hasBaselineRef.current) {
      initializeBaseline();
      return;
    }

    const currentSignature = JSON.stringify(buildPayload());

    if (currentSignature === lastSavedSignatureRef.current) {
      isDirtyRef.current = false;
      setIsDirty(false);
      setStatus((prev: SaveStatus) => (prev === "saved" ? "saved" : "idle"));
    } else {
      isDirtyRef.current = true;
      setIsDirty(true);
      setStatus((prev: SaveStatus) => (prev === "saving" ? "saving" : "dirty"));

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
        autoSaveTimerRef.current = null;
      }
      const eid = engagementIdRef.current;
      if (isDirtyRef.current && !isSavingRef.current && dataLoadedRef.current && eid) {
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

  const saveAndClose = useCallback(
    async (redirectPath?: string): Promise<boolean> => {
      const success = await saveFinal();
      if (success) {
        const prefix = config.defaultRedirectPrefix ?? "workspace";
        const defaultPath = `/${prefix}/${engagementId}`;
        navigate(redirectPath || defaultPath);
      }
      return success;
    },
    [saveFinal, navigate, engagementId, config.defaultRedirectPrefix]
  );

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
    dataLoaded,
    saveDraft,
    saveFinal,
    saveAndClose,
    resetDirty,
    initializeBaseline,
    signalChange,
  };
}
