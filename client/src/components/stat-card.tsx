import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  className?: string;
}

export function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  const TrendIcon = trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : Minus;

  const trendColorClass =
    trend?.direction === "up"
      ? "text-green-600 dark:text-green-400"
      : trend?.direction === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1" data-testid="stat-label">
              {label}
            </p>
            <p className="text-xl font-bold text-foreground font-mono tabular-nums" data-testid="stat-value">
              {value}
            </p>
            {trend && (
              <div className={cn("flex items-center gap-1 mt-2", trendColorClass)} data-testid="stat-trend">
                <TrendIcon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">
                  {trend.value > 0 && "+"}
                  {trend.value}%
                </span>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
