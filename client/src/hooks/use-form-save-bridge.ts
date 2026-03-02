import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";

export type FormSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface FormSaveBridgeResult {
  isDirty: boolean;
  isSaving: boolean;
  status: FormSaveStatus;
  setIsSaving: (saving: boolean) => void;
  setSaved: () => void;
  setError: () => void;
  resetDirty: () => void;
  initializeBaseline: () => void;
  signalChange: () => void;
  goBack: (path: string) => void;
}

export function useFormSaveBridge<T extends Record<string, any>>(
  formData: T,
  defaultBackPath: string = "/"
): FormSaveBridgeResult {
  const [, navigate] = useLocation();
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState<FormSaveStatus>("idle");
  
  const lastSavedSignatureRef = useRef<string>("");
  const hasBaselineRef = useRef(false);

  const buildSignature = useCallback(() => {
    return JSON.stringify(formData);
  }, [formData]);

  const initializeBaseline = useCallback(() => {
    lastSavedSignatureRef.current = buildSignature();
    hasBaselineRef.current = true;
    setIsDirty(false);
    setStatus("idle");
  }, [buildSignature]);

  useEffect(() => {
    if (!hasBaselineRef.current) {
      initializeBaseline();
      return;
    }

    const currentSignature = buildSignature();
    
    if (currentSignature === lastSavedSignatureRef.current) {
      setIsDirty(false);
      setStatus(prev => prev === "saved" ? "saved" : "idle");
    } else {
      setIsDirty(true);
      setStatus(prev => prev === "saving" ? "saving" : "dirty");
    }
  }, [buildSignature, initializeBaseline]);

  const setIsSaving = useCallback((saving: boolean) => {
    if (saving) {
      setStatus("saving");
    }
  }, []);

  const setSaved = useCallback(() => {
    lastSavedSignatureRef.current = buildSignature();
    setIsDirty(false);
    setStatus("saved");
  }, [buildSignature]);

  const setError = useCallback(() => {
    setStatus("error");
  }, []);

  const resetDirty = useCallback(() => {
    initializeBaseline();
  }, [initializeBaseline]);

  const signalChange = useCallback(() => {
    setIsDirty(true);
    setStatus("dirty");
  }, []);

  const goBack = useCallback((path?: string) => {
    if (isDirty) {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmed) return;
    }
    navigate(path || defaultBackPath);
  }, [isDirty, navigate, defaultBackPath]);

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
    isSaving: status === "saving",
    status,
    setIsSaving,
    setSaved,
    setError,
    resetDirty,
    initializeBaseline,
    signalChange,
    goBack
  };
}
