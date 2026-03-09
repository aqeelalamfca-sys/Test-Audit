import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconColor?: string;
  trend?: { value: number; direction: "up" | "down" | "neutral" };
  onClick?: () => Promise<void>;
  isClickable?: boolean;
  subtitle?: string;
}

export function MetricCard({
  title,
  value,
  icon,
  iconColor = "text-blue-500",
  trend,
  onClick,
  isClickable = true,
  subtitle,
}: MetricCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!onClick || isLoading) return;
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={cn(
        "relative transition-all duration-200",
        isClickable && onClick && "cursor-pointer hover:shadow-md hover:border-primary/50",
        isLoading && "opacity-75"
      )}
      onClick={isClickable && onClick ? handleClick : undefined}
    >
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={cn("flex-shrink-0", iconColor)}>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              icon
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.direction === "up" && "text-green-500",
                    trend.direction === "down" && "text-red-500",
                    trend.direction === "neutral" && "text-muted-foreground"
                  )}
                >
                  {trend.direction === "up" && "↑"}
                  {trend.direction === "down" && "↓"}
                  {trend.value}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {isClickable && onClick && !isLoading && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </CardContent>
      {isClickable && onClick && (
        <div className="absolute top-2 right-2 text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
          Click for report
        </div>
      )}
    </Card>
  );
}
