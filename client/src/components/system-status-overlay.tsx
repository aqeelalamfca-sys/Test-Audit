import { useSystemStatus } from "@/hooks/use-system-status";
import { AlertTriangle, Database, Loader2, RefreshCw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SystemStatusOverlay() {
  const { status, checking, checkStatus } = useSystemStatus();

  if (!status || status.ready) return null;

  const dbState = status.database.state;
  const isConnecting = dbState === "connecting" || dbState === "initializing";
  const isReconnecting = dbState === "reconnecting";
  const isError = dbState === "error";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      data-testid="system-status-overlay"
    >
      <div className="max-w-md w-full mx-4 bg-card border rounded-lg shadow-lg p-3 space-y-2.5">
        <div className="flex items-center gap-3">
          {isError ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
              <ServerCrash className="h-5 w-5 text-destructive" />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 shrink-0">
              <Database className="h-5 w-5 text-amber-500" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-status-title">
              {isError
                ? "System Unavailable"
                : isReconnecting
                  ? "Reconnecting..."
                  : "System Initializing"}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-status-message">
              {isError
                ? "The system is experiencing a database connection issue. Please wait or contact your administrator."
                : isReconnecting
                  ? "Database connection was lost. Attempting to reconnect automatically."
                  : "System is initializing the database. This may take a moment."}
            </p>
          </div>
        </div>

        {(isConnecting || isReconnecting) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="status-connecting">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{status.database.message}</span>
          </div>
        )}

        {isError && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive" data-testid="text-error-detail">
                {status.database.message}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {status.database.retryCount > 0 && `Retry attempts: ${status.database.retryCount}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={checking}
            data-testid="button-check-status"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1.5" />
            )}
            Check Status
          </Button>
        </div>
      </div>
    </div>
  );
}
