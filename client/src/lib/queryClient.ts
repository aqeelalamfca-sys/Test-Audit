import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken, refreshAccessToken } from "./auth";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json") && !contentType.includes("text/event-stream")) {
    throw new Error("Server returned non-JSON response. It may be restarting — please retry.");
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchWithAutoRefresh(url: string, options: RequestInit = {}): Promise<Response> {
  let res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders: Record<string, string> = {};
      if (options.headers) {
        Object.assign(retryHeaders, options.headers);
      }
      retryHeaders["Authorization"] = `Bearer ${newToken}`;

      res = await fetch(url, {
        ...options,
        headers: retryHeaders,
        credentials: "include",
      });
    }
  }

  return res;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetchWithAutoRefresh(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetchWithAutoRefresh(queryKey.join("/") as string);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export function flushDraftSave(
  method: string,
  url: string,
  payload: unknown
): void {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "include",
    }).catch(() => {});
  } catch {
    // last resort fallback
  }
}

function handleGlobalError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.startsWith("401:")) {
    toast({
      title: "Session Expired",
      description: "Your session has expired. Please sign in again.",
      variant: "destructive",
    });
    localStorage.removeItem("auditwise_token");
    setTimeout(() => { window.location.href = "/"; }, 1500);
    return;
  }

  if (msg.startsWith("403:")) {
    toast({
      title: "Access Denied",
      description: "You don't have permission to perform this action.",
      variant: "destructive",
    });
    setTimeout(() => { window.location.href = "/"; }, 2000);
    return;
  }

  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    toast({
      title: "Connection Error",
      description: "Unable to reach the server. Please check your connection.",
      variant: "destructive",
    });
    return;
  }

  if (msg.includes("non-JSON response")) {
    toast({
      title: "Server Restarting",
      description: "The server is restarting. Please wait a moment and try again.",
      variant: "destructive",
    });
    return;
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        const msg = error instanceof Error ? error.message : "";
        if (msg.startsWith("401:") || msg.startsWith("403:")) return false;
        return msg.includes("non-JSON response") || msg.includes("Failed to fetch");
      },
      retryDelay: 2000,
    },
    mutations: {
      retry: false,
      onError: handleGlobalError,
    },
  },
});
