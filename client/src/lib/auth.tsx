import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { apiRequest, queryClient } from "./queryClient";

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  firmId: string | null;
  isActive: boolean;
  status?: string;
  lastLoginAt: string | null;
}

interface Firm {
  id: string;
  name: string;
  displayName: string | null;
  licenseNo: string | null;
  logoUrl: string | null;
}

interface AuthContextType {
  user: User | null;
  firm: Firm | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User | void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  fullName: string;
  firmId?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auditwise_token";
const REFRESH_TOKEN_KEY = "auditwise_refresh_token";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        return null;
      }

      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      return data.token as string;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export { refreshAccessToken };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleRefresh = useCallback((expiresInSeconds: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    const refreshIn = Math.max((expiresInSeconds - 60) * 1000, 30000);
    refreshTimerRef.current = setTimeout(async () => {
      const newToken = await refreshAccessToken();
      if (newToken) {
        setToken(newToken);
        scheduleRefresh(900);
      } else {
        setToken(null);
        setUser(null);
        setFirm(null);
      }
    }, refreshIn);
  }, []);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const pingResponse = await fetch("/api/auth/ping", {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      const pingData = await pingResponse.json();

      if (!pingData.authenticated) {
        if (pingData.needsRefresh || pingData.reason === "token_expired") {
          const newToken = await refreshAccessToken();
          if (newToken) {
            setToken(newToken);
            clearTimeout(timeoutId);
            setIsLoading(false);
            return;
          }
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setToken(null);
        setUser(null);
        setFirm(null);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setFirm(data.firm);
        scheduleRefresh(900);

        try {
          if (data.user?.activeClientId) {
            localStorage.setItem("activeClientId", data.user.activeClientId);
          }
          if (data.user?.activePeriodId) {
            localStorage.setItem("activePeriodId", data.user.activePeriodId);
          }
          try { queryClient.invalidateQueries(); } catch (e) {}
        } catch (e) {}
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setToken(null);
        setUser(null);
        setFirm(null);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Failed to fetch user:", error);
      if (error.name === "AbortError") {
        console.warn("Auth request timed out - clearing session");
      }
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, scheduleRefresh]);

  useEffect(() => {
    fetchUser();
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    setToken(data.token);
    setUser(data.user);
    scheduleRefresh(data.expiresIn || 900);
    await fetchUser();
    return data.user;
  };

  const register = async (data: RegisterData) => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Registration failed");
    }

    const result = await response.json();
    localStorage.setItem(TOKEN_KEY, result.token);
    if (result.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    }
    setToken(result.token);
    setUser(result.user);
    scheduleRefresh(result.expiresIn || 900);
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setFirm(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firm,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}
