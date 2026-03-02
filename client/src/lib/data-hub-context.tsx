import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type DataHubEntityType = 
  | "LEDGER"
  | "TRIAL_BALANCE"
  | "FINANCIAL_STATEMENTS"
  | "RISK_ASSESSMENT"
  | "AUDIT_PROCEDURE"
  | "ADJUSTMENT"
  | "EVIDENCE"
  | "SIGNOFF"
  | "PDF_PACK";

type DataHubVersionStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SUPERSEDED"
  | "REJECTED";

interface DataHubVersion {
  id: string;
  versionNumber: number;
  status: DataHubVersionStatus;
  createdAt: string;
  approvedAt?: string;
}

interface DataHubReadResult {
  data: any;
  version: DataHubVersion;
  isDraft: boolean;
}

interface DataHubEntityStatus {
  entityId: string;
  entityType: DataHubEntityType;
  entityCode: string;
  entityName: string;
  hasDraft: boolean;
  latestApprovedVersion: {
    id: string;
    versionNumber: number;
    approvedAt: string;
  } | null;
  currentDraft: {
    id: string;
    versionNumber: number;
    status: string;
    createdAt: string;
  } | null;
}

interface DataHubContextValue {
  draftMode: boolean;
  setDraftMode: (enabled: boolean) => void;
  hasDraftPermission: boolean;
  checkDraftPermission: (engagementId: string, entityType?: DataHubEntityType) => Promise<boolean>;
  
  read: (engagementId: string, entityType: DataHubEntityType, entityCode: string) => Promise<DataHubReadResult | null>;
  getApproved: (engagementId: string, entityType: DataHubEntityType, entityCode: string) => Promise<DataHubReadResult | null>;
  getStatus: (engagementId: string, entityType: DataHubEntityType, entityCode: string) => Promise<DataHubEntityStatus | null>;
  getHistory: (engagementId: string, entityType: DataHubEntityType, entityCode: string) => Promise<any[]>;
  
  startDraft: (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    entityName: string;
    data: any;
    changeDescription?: string;
    isaReference?: string;
  }) => Promise<any>;
  
  updateDraft: (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    data: any;
    changeDescription?: string;
  }) => Promise<any>;
  
  discardDraft: (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    reason?: string;
  }) => Promise<any>;
  
  submitForReview: (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
  }) => Promise<any>;
  
  review: (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    approved: boolean;
    comments?: string;
  }) => Promise<any>;
  
  approve: (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    approved: boolean;
    comments?: string;
    partnerPinUsed?: boolean;
  }) => Promise<any>;
}

const DataHubContext = createContext<DataHubContextValue | null>(null);

export function DataHubProvider({ children }: { children: ReactNode }) {
  const [draftMode, setDraftMode] = useState(false);
  const [hasDraftPermission, setHasDraftPermission] = useState(false);
  const queryClient = useQueryClient();

  const checkDraftPermission = useCallback(async (
    engagementId: string,
    entityType?: DataHubEntityType
  ): Promise<boolean> => {
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      
      const res = await fetch(
        `/api/data-hub/permissions/check-draft/${engagementId}?${params}`,
        { credentials: "include" }
      );
      
      if (!res.ok) return false;
      
      const result = await res.json();
      setHasDraftPermission(result.hasPermission);
      return result.hasPermission;
    } catch {
      return false;
    }
  }, []);

  const read = useCallback(async (
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string
  ): Promise<DataHubReadResult | null> => {
    const params = new URLSearchParams();
    if (draftMode && hasDraftPermission) {
      params.set("preferDraft", "true");
    }
    
    const res = await fetch(
      `/api/data-hub/entity/${engagementId}/${entityType}/${entityCode}?${params}`,
      { credentials: "include" }
    );
    
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error("Failed to read from Data Hub");
    }
    
    return res.json();
  }, [draftMode, hasDraftPermission]);

  const getApproved = useCallback(async (
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string
  ): Promise<DataHubReadResult | null> => {
    const res = await fetch(
      `/api/data-hub/entity/${engagementId}/${entityType}/${entityCode}/approved`,
      { credentials: "include" }
    );
    
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error("Failed to get approved version");
    }
    
    return res.json();
  }, []);

  const getStatus = useCallback(async (
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string
  ): Promise<DataHubEntityStatus | null> => {
    const res = await fetch(
      `/api/data-hub/entity/${engagementId}/${entityType}/${entityCode}/status`,
      { credentials: "include" }
    );
    
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error("Failed to get entity status");
    }
    
    return res.json();
  }, []);

  const getHistory = useCallback(async (
    engagementId: string,
    entityType: DataHubEntityType,
    entityCode: string
  ): Promise<any[]> => {
    const res = await fetch(
      `/api/data-hub/entity/${engagementId}/${entityType}/${entityCode}/history`,
      { credentials: "include" }
    );
    
    if (!res.ok) {
      throw new Error("Failed to get version history");
    }
    
    return res.json();
  }, []);

  const startDraft = useCallback(async (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    entityName: string;
    data: any;
    changeDescription?: string;
    isaReference?: string;
  }) => {
    const res = await fetch("/api/data-hub/draft/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to start draft");
    }
    
    queryClient.invalidateQueries({ queryKey: ["data-hub"] });
    return res.json();
  }, [queryClient]);

  const updateDraft = useCallback(async (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    data: any;
    changeDescription?: string;
  }) => {
    const res = await fetch("/api/data-hub/draft/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update draft");
    }
    
    queryClient.invalidateQueries({ queryKey: ["data-hub"] });
    return res.json();
  }, [queryClient]);

  const discardDraft = useCallback(async (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    reason?: string;
  }) => {
    const res = await fetch("/api/data-hub/draft/discard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to discard draft");
    }
    
    queryClient.invalidateQueries({ queryKey: ["data-hub"] });
    return res.json();
  }, [queryClient]);

  const submitForReview = useCallback(async (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
  }) => {
    const res = await fetch("/api/data-hub/workflow/submit-for-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to submit for review");
    }
    
    queryClient.invalidateQueries({ queryKey: ["data-hub"] });
    return res.json();
  }, [queryClient]);

  const review = useCallback(async (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    approved: boolean;
    comments?: string;
  }) => {
    const res = await fetch("/api/data-hub/workflow/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to review");
    }
    
    queryClient.invalidateQueries({ queryKey: ["data-hub"] });
    return res.json();
  }, [queryClient]);

  const approve = useCallback(async (params: {
    engagementId: string;
    entityType: DataHubEntityType;
    entityCode: string;
    approved: boolean;
    comments?: string;
    partnerPinUsed?: boolean;
  }) => {
    const res = await fetch("/api/data-hub/workflow/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params)
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to approve");
    }
    
    queryClient.invalidateQueries({ queryKey: ["data-hub"] });
    return res.json();
  }, [queryClient]);

  const value: DataHubContextValue = {
    draftMode,
    setDraftMode,
    hasDraftPermission,
    checkDraftPermission,
    read,
    getApproved,
    getStatus,
    getHistory,
    startDraft,
    updateDraft,
    discardDraft,
    submitForReview,
    review,
    approve
  };

  return (
    <DataHubContext.Provider value={value}>
      {children}
    </DataHubContext.Provider>
  );
}

export function useDataHub() {
  const context = useContext(DataHubContext);
  if (!context) {
    throw new Error("useDataHub must be used within a DataHubProvider");
  }
  return context;
}

export function useDataHubEntity(
  engagementId: string | undefined,
  entityType: DataHubEntityType,
  entityCode: string
) {
  const { draftMode, hasDraftPermission } = useDataHub();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["data-hub", engagementId, entityType, entityCode, draftMode],
    queryFn: async () => {
      if (!engagementId) return null;
      
      const params = new URLSearchParams();
      if (draftMode && hasDraftPermission) {
        params.set("preferDraft", "true");
      }
      
      const res = await fetch(
        `/api/data-hub/entity/${engagementId}/${entityType}/${entityCode}?${params}`,
        { credentials: "include" }
      );
      
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to read from Data Hub");
      }
      
      return res.json();
    },
    enabled: !!engagementId
  });

  return {
    data: data?.data,
    version: data?.version,
    isDraft: data?.isDraft ?? false,
    isLoading,
    error,
    refetch
  };
}

export function useDataHubStatus(
  engagementId: string | undefined,
  entityType: DataHubEntityType,
  entityCode: string
) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["data-hub-status", engagementId, entityType, entityCode],
    queryFn: async () => {
      if (!engagementId) return null;
      
      const res = await fetch(
        `/api/data-hub/entity/${engagementId}/${entityType}/${entityCode}/status`,
        { credentials: "include" }
      );
      
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to get entity status");
      }
      
      return res.json();
    },
    enabled: !!engagementId
  });

  return {
    status: data as DataHubEntityStatus | null,
    isLoading,
    error,
    refetch
  };
}

export function useDataHubHistory(
  engagementId: string | undefined,
  entityType: DataHubEntityType,
  entityCode: string
) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["data-hub-history", engagementId, entityType, entityCode],
    queryFn: async () => {
      if (!engagementId) return [];
      
      const res = await fetch(
        `/api/data-hub/entity/${engagementId}/${entityType}/${entityCode}/history`,
        { credentials: "include" }
      );
      
      if (!res.ok) {
        throw new Error("Failed to get version history");
      }
      
      return res.json();
    },
    enabled: !!engagementId
  });

  return {
    history: data ?? [],
    isLoading,
    error,
    refetch
  };
}
