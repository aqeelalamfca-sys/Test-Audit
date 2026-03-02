import { getAuthToken } from "./auth";

export interface FetchWithAuthOptions extends RequestInit {
  timeout?: number;
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

  const timeout = init?.timeout ?? 10000; // Default 10 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(input, {
      ...init,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
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
