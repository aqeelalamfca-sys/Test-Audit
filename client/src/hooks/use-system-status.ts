import { useState, useEffect, useCallback } from "react";

interface DatabaseStatus {
  state: "initializing" | "connecting" | "ready" | "error" | "reconnecting";
  message: string;
  lastCheck: string;
  retryCount: number;
}

interface SystemStatus {
  ready: boolean;
  database: DatabaseStatus;
  timestamp: string;
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/system/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        ready: false,
        database: {
          state: "error",
          message: "Cannot reach server",
          lastCheck: new Date().toISOString(),
          retryCount: 0,
        },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (!status || status.ready) return;
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [status, checkStatus]);

  return { status, checking, checkStatus };
}
