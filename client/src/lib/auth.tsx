import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest, queryClient } from "./queryClient";

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  firmId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface Firm {
  id: string;
  name: string;
  licenseNo: string | null;
}

interface AuthContextType {
  user: User | null;
  firm: Firm | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
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

  const fetchUser = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      // PHASE 1: Quick ping to verify session is valid (fast, guaranteed response)
      const pingResponse = await fetch("/api/auth/ping", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      const pingData = await pingResponse.json();
      
      // If session is invalid, clear immediately without waiting for /me
      if (!pingData.authenticated) {
        console.log("Auth ping failed:", pingData.reason);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setFirm(null);
        setIsLoading(false);
        return;
      }

      // PHASE 2: Fetch full user data (session is confirmed valid)
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setFirm(data.firm);

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
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
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
    setToken(data.token);
    setUser(data.user);
    await fetchUser();
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
    setToken(result.token);
    setUser(result.user);
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }

    localStorage.removeItem(TOKEN_KEY);
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
