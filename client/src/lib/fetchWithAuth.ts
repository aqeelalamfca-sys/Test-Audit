import { getAuthToken } from "./auth";

export interface FetchWithAuthOptions extends RequestInit {
  timeout?: number;
  skipAuthRedirect?: boolean;
}

export async function fetchWithAuth(
  input: RequestInfo,
  init?: FetchWithAuthOptions
): Promise<Response> {
  const headers = new Headers(init?.headers as HeadersInit || {});
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const activeClientId = localStorage.getItem("activeClientId");
    const activePeriodId = localStorage.getItem("activePeriodId");
    if (activeClientId) headers.set("X-Active-Client-Id", activeClientId);
    if (activePeriodId) headers.set("X-Active-Period-Id", activePeriodId);
  } catch (e) {
    // ignore storage access errors
  }

  const timeout = init?.timeout ?? 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(input, {
      ...init,
      headers,
      credentials: "include",
      signal: controller.signal,
    });

    if (!init?.skipAuthRedirect) {
      const url = typeof input === "string" ? input : "";
      const isAuthEndpoint = url.includes("/auth/ping") || url.includes("/auth/refresh") || url.includes("/auth/login");
      if (res.status === 401 && !isAuthEndpoint) {
        localStorage.removeItem("auditwise_token");
        window.location.href = "/";
      }
    }

    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchWithAuthTimeout(
  input: RequestInfo,
  timeoutMs: number = 5000,
  init?: RequestInit
): Promise<Response> {
  return fetchWithAuth(input, { ...init, timeout: timeoutMs });
}

export async function fetchJsonWithAuth(input: RequestInfo, init?: FetchWithAuthOptions) {
  const res = await fetchWithAuth(input, init);
  let data: any = null;
  try {
    data = await res.json();
  } catch (e) {
    // ignore parse errors
  }

  if (!res.ok) {
    const message = data?.error || data?.message || res.statusText;
    throw new Error(message || `Request failed with status ${res.status}`);
  }

  return data;
}
