import { useEffect, useCallback, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useSaveEngine, SaveEngineConfig, SaveEngineResult } from "./use-save-engine";

export interface GlobalSaveConfig extends SaveEngineConfig {
  sectionKey: string;
}

export function useGlobalSave<T extends Record<string, any>>(
  initialData: T,
  config: GlobalSaveConfig
): SaveEngineResult<T> {
  const { 
    registerSection, 
    unregisterSection, 
    markSectionDirty, 
    markSectionSaving, 
    markSectionSaved, 
    markSectionError 
  } = useWorkspace();

  const { sectionKey, ...saveEngineConfig } = config;
  const sectionKeyRef = useRef(sectionKey);

  useEffect(() => {
    registerSection(sectionKey);
    sectionKeyRef.current = sectionKey;
    return () => {
      unregisterSection(sectionKey);
    };
  }, [sectionKey, registerSection, unregisterSection]);

  const handleSaveSuccess = useCallback((data: any) => {
    markSectionSaved(sectionKeyRef.current);
    config.onSaveSuccess?.(data);
  }, [markSectionSaved, config]);

  const handleSaveError = useCallback((error: any) => {
    markSectionError(sectionKeyRef.current);
    config.onSaveError?.(error);
  }, [markSectionError, config]);

  const saveEngine = useSaveEngine<T>(initialData, {
    ...saveEngineConfig,
    onSaveSuccess: handleSaveSuccess,
    onSaveError: handleSaveError,
  });

  useEffect(() => {
    markSectionDirty(sectionKey, saveEngine.isDirty);
  }, [saveEngine.isDirty, sectionKey, markSectionDirty]);

  useEffect(() => {
    markSectionSaving(sectionKey, saveEngine.isSaving);
  }, [saveEngine.isSaving, sectionKey, markSectionSaving]);

  return saveEngine;
}

export function useSectionSaveTracking(sectionKey: string) {
  const {
    registerSection,
    unregisterSection,
    markSectionDirty,
    markSectionSaving,
    markSectionSaved,
    markSectionError,
    getSectionState,
  } = useWorkspace();

  useEffect(() => {
    registerSection(sectionKey);
    return () => {
      unregisterSection(sectionKey);
    };
  }, [sectionKey, registerSection, unregisterSection]);

  return {
    markDirty: useCallback((isDirty: boolean) => markSectionDirty(sectionKey, isDirty), [sectionKey, markSectionDirty]),
    markSaving: useCallback((isSaving: boolean) => markSectionSaving(sectionKey, isSaving), [sectionKey, markSectionSaving]),
    markSaved: useCallback(() => markSectionSaved(sectionKey), [sectionKey, markSectionSaved]),
    markError: useCallback(() => markSectionError(sectionKey), [sectionKey, markSectionError]),
    getState: useCallback(() => getSectionState(sectionKey), [sectionKey, getSectionState]),
  };
}
