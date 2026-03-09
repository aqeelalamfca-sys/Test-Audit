import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { getAuthToken } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Loader2, ShieldX, RefreshCw, AlertCircle, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface WorkspaceAccessGuardProps {
  engagementId: string;
  children: React.ReactNode;
}

type AccessResult = 
  | { status: "loading"; message: string }
  | { status: "granted" }
  | { status: "denied"; reason: string }
  | { status: "error"; reason: string }
  | { status: "timeout"; reason: string }
  | { status: "redirect"; to: string };

export function WorkspaceAccessGuard({ engagementId, children }: WorkspaceAccessGuardProps) {
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<AccessResult>({ status: "loading", message: "Initializing..." });
  const [retryKey, setRetryKey] = useState(0);
  const mountedRef = useRef(true);
  const verificationRunning = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    verificationRunning.current = false;

    const verify = async () => {
      if (verificationRunning.current) {
        console.log("[Guard] Verification already running, skipping");
        return;
      }
      verificationRunning.current = true;
      
      const id = Date.now().toString(36);
      console.log(`[Guard:${id}] Starting for engagementId=${engagementId}`);

      const safeSetResult = (newResult: AccessResult) => {
        if (newResult.status !== "loading") {
          verificationRunning.current = false;
        }
        if (mountedRef.current) {
          console.log(`[Guard:${id}] Setting result:`, newResult.status);
          setResult(newResult);
        } else {
          console.log(`[Guard:${id}] Component unmounted, skipping state update`);
        }
      };

      if (!engagementId) {
        safeSetResult({ status: "redirect", to: "/engagements" });
        return;
      }

      const token = getAuthToken();
      if (!token) {
        safeSetResult({ status: "redirect", to: "/login" });
        return;
      }

      safeSetResult({ status: "loading", message: "Verifying authentication..." });

      try {
        console.log(`[Guard:${id}] Fetching auth ping...`);
        const pingRes = await fetchWithAuth("/api/auth/ping");

        if (!mountedRef.current) {
          console.log(`[Guard:${id}] Unmounted after ping`);
          return;
        }

        const pingData = await pingRes.json();
        console.log(`[Guard:${id}] Ping result:`, pingData);

        if (!pingData.authenticated) {
          if (pingData.reason === "DB_TIMEOUT") {
            safeSetResult({ status: "error", reason: "Server is temporarily slow. Please try again." });
            return;
          }
          if (["session_expired", "session_not_found", "missing_token", "invalid_token_format"].includes(pingData.reason)) {
            localStorage.removeItem("auditwise_token");
            safeSetResult({ status: "redirect", to: "/login" });
            return;
          }
          if (pingData.reason === "user_inactive") {
            safeSetResult({ status: "denied", reason: "Your account has been deactivated." });
            return;
          }
          safeSetResult({ status: "error", reason: pingData.message || "Authentication failed" });
          return;
        }

        if (!mountedRef.current) return;
        safeSetResult({ status: "loading", message: "Checking engagement access..." });

        console.log(`[Guard:${id}] Fetching access check...`);
        const accessRes = await fetchWithAuth(`/api/workspace/engagements/${engagementId}/access`);

        if (!mountedRef.current) {
          console.log(`[Guard:${id}] Unmounted after access check`);
          return;
        }

        console.log(`[Guard:${id}] Access response status: ${accessRes.status}`);

        if (accessRes.status === 401) {
          localStorage.removeItem("auditwise_token");
          safeSetResult({ status: "redirect", to: "/login" });
          return;
        }
        if (accessRes.status === 403) {
          safeSetResult({ status: "denied", reason: "You don't have permission to access this engagement." });
          return;
        }
        if (accessRes.status === 503) {
          safeSetResult({ status: "error", reason: "Server is temporarily slow. Please try again." });
          return;
        }
        if (accessRes.status === 404) {
          safeSetResult({ status: "denied", reason: "This engagement does not exist." });
          return;
        }

        const accessData = await accessRes.json();
        console.log(`[Guard:${id}] Access data:`, accessData);

        if (!mountedRef.current) return;

        if (accessData.hasAccess) {
          console.log(`[Guard:${id}] ACCESS GRANTED - setting state`);
          safeSetResult({ status: "granted" });
          console.log(`[Guard:${id}] State set to granted`);
        } else {
          safeSetResult({ status: "denied", reason: "You are not allocated to this engagement." });
        }
      } catch (err: any) {
        console.error(`[Guard:${id}] Error:`, err);
        if (!mountedRef.current) return;
        if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
          safeSetResult({ status: "timeout", reason: "Network connection issue. Please check your connection." });
        } else {
          safeSetResult({ status: "error", reason: err.message || "Unable to verify access." });
        }
      }
    };

    verify();

    const timeoutId = setTimeout(() => {
      console.log("[Guard] Timeout check - mounted:", mountedRef.current, "verificationRunning:", verificationRunning.current);
      if (mountedRef.current && verificationRunning.current) {
        console.log("[Guard] Timeout triggered - forcing timeout state");
        verificationRunning.current = false;
        setResult({ status: "timeout", reason: "Connection timed out. Please try again." });
      }
    }, 10000);

    return () => {
      console.log("[Guard] Cleanup - setting mountedRef to false");
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [engagementId, retryKey]);

  useEffect(() => {
    if (result.status === "redirect") {
      console.log("[Guard] Redirecting to:", result.to);
      setLocation(result.to);
    }
  }, [result, setLocation]);

  const handleRetry = () => {
    console.log("[Guard] Retry clicked");
    setResult({ status: "loading", message: "Retrying..." });
    setRetryKey(k => k + 1);
  };

  const handleGoToEngagements = () => setLocation("/engagements");
  const handleGoToLogin = () => {
    localStorage.removeItem("auditwise_token");
    setLocation("/login");
  };

  console.log("[Guard] Rendering with status:", result.status);

  if (result.status === "loading") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{result.message}</p>
        </div>
      </div>
    );
  }

  if (result.status === "granted") {
    console.log("[Guard] Rendering children");
    return <>{children}</>;
  }

  if (result.status === "timeout") {
    return (
      <div className="flex items-center justify-center h-[60vh] p-4">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <WifiOff className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Connection Timeout</CardTitle>
            <CardDescription>{result.reason}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={handleRetry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" onClick={handleGoToEngagements} className="w-full">
              Go to Engagements
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="flex items-center justify-center h-[60vh] p-4">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{result.reason}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={handleRetry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline" onClick={handleGoToEngagements} className="w-full">
              Go to Engagements
            </Button>
            <Button variant="ghost" onClick={handleGoToLogin} className="w-full text-sm">
              Sign in again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result.status === "denied") {
    return (
      <div className="flex items-center justify-center h-[60vh] p-4">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{result.reason}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={handleGoToEngagements} className="w-full">
              Go to Engagements
            </Button>
            <Button variant="outline" onClick={handleRetry} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
