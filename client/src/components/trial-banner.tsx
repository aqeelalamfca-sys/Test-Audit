import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface SubscriptionInfo {
  subscription: {
    id: string;
    status: string;
    trialStart: string | null;
    trialEnd: string | null;
    deleteAt: string | null;
    isActivated: boolean;
    plan: {
      code: string;
      name: string;
    };
  } | null;
  firmStatus: string;
}

export function TrialBanner() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/tenant/subscription"],
    enabled: !!user?.firmId && user?.role !== "SUPER_ADMIN",
    refetchInterval: 5 * 60 * 1000,
  });

  if (!data?.subscription) return null;

  const sub = data.subscription;

  if (sub.status !== "TRIAL" && sub.status !== "EXPIRED") return null;

  if (sub.status === "EXPIRED" && !sub.isActivated) {
    return (
      <div
        className="bg-destructive text-destructive-foreground px-4 py-2.5 flex items-center justify-center gap-3 text-sm"
        data-testid="banner-trial-expired"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          Your trial has expired. Please contact support to activate your account.
        </span>
      </div>
    );
  }

  if (sub.status !== "TRIAL") return null;

  const trialEnd = sub.trialEnd ? new Date(sub.trialEnd) : null;
  if (!trialEnd) return null;

  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isUrgent = daysRemaining <= 7;
  const trialEndFormatted = trialEnd.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className={`px-4 py-2 flex items-center justify-center gap-3 text-sm ${
        isUrgent
          ? "bg-amber-500 text-white"
          : "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-b border-blue-100 dark:border-blue-900"
      }`}
      data-testid="banner-trial-active"
    >
      {isUrgent ? (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      ) : (
        <Sparkles className="h-4 w-4 shrink-0" />
      )}
      <span>
        <span className="font-medium">
          {isUrgent ? `Only ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left!` : "Free Trial"}
        </span>
        {" "}
        Trial ends on {trialEndFormatted} ({daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining)
      </span>
      <Button
        variant={isUrgent ? "secondary" : "outline"}
        size="sm"
        className="h-7 text-xs ml-2"
        onClick={() => navigate("/firm-admin/settings")}
        data-testid="button-activate-now"
      >
        <Clock className="h-3 w-3 mr-1" />
        Activate Now
      </Button>
    </div>
  );
}
