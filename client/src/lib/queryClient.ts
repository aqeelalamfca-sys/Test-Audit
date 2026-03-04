import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken, refreshAccessToken } from "./auth";

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        const msg = error instanceof Error ? error.message : "";
        return msg.includes("non-JSON response") || msg.includes("Failed to fetch");
      },
      retryDelay: 2000,
    },
    mutations: {
      retry: false,
    },
  },
});
