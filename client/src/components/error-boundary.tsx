import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    if (error.message?.includes("dynamically imported module") || error.message?.includes("Failed to fetch")) {
      window.location.reload();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred while loading this content.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {this.state.error && (
                <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md font-mono overflow-auto max-h-24">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={this.handleReset}
                  data-testid="button-error-retry"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="default"
                  className="flex-1"
                  onClick={() => window.location.href = "/"}
                  data-testid="button-error-home"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({ message, onRetry }: QueryErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" data-testid="query-error">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Failed to load data</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        {message || "There was a problem loading the requested information. Please try again."}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" data-testid="button-query-retry">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}
