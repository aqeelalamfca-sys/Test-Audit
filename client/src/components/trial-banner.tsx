import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Clock, Sparkles, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionInfo {
  subscription: {
    id: string;
    status: string;
    trialStart: string | null;
    trialEnd: string | null;
    deleteAt: string | null;
    isActivated: boolean;
    dormantAt: string | null;
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
  const { toast } = useToast();

  const { data } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/tenant/subscription"],
    enabled: !!user?.firmId && user?.role !== "SUPER_ADMIN",
    refetchInterval: 5 * 60 * 1000,
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tenant/activate");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Activated", description: "Your subscription has been activated. Full access restored." });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/subscription"] });
      window.location.reload();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to activate", variant: "destructive" });
    },
  });

  if (!data?.subscription) return null;

  const sub = data.subscription;
  const firmStatus = data.firmStatus;

  if (firmStatus === "DORMANT" || sub.status === "DORMANT") {
    const dormantSince = sub.dormantAt ? new Date(sub.dormantAt).toLocaleDateString("en-PK", {
      year: "numeric", month: "long", day: "numeric",
    }) : null;

    return (
      <div
        className="bg-amber-600 text-white px-3 py-3 flex items-center justify-center gap-3 text-sm"
        data-testid="banner-dormant"
      >
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
          <span className="font-semibold">
            Dormant Account
          </span>
          <span className="hidden sm:inline">—</span>
          <span>
            Your trial expired{dormantSince ? ` on ${dormantSince}` : ""}. Activate to continue using AuditWise. Your data is safe and preserved.
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs ml-2 whitespace-nowrap"
          onClick={() => activateMutation.mutate()}
          disabled={activateMutation.isPending}
          data-testid="button-activate-dormant"
        >
          {activateMutation.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Clock className="h-3 w-3 mr-1" />
          )}
          Activate Now
        </Button>
      </div>
    );
  }

  if (sub.status === "EXPIRED" && !sub.isActivated) {
    return (
      <div
        className="bg-destructive text-destructive-foreground px-3 py-2.5 flex items-center justify-center gap-3 text-sm"
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
      className={`px-3 py-2 flex items-center justify-center gap-3 text-sm ${
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
