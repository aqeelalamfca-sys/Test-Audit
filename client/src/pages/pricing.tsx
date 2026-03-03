import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Shield,
  Check,
  Zap,
  Building2,
  Users,
  HardDrive,
  Brain,
  Crown,
  ArrowRight,
  ChevronLeft,
  Briefcase,
} from "lucide-react";

interface Plan {
  id: string;
  code: string;
  name: string;
  maxUsers: number;
  maxEngagements: number;
  maxOffices: number;
  storageGb: number;
  allowCustomAi: boolean;
  platformAiIncluded: boolean;
  monthlyPrice: string;
  supportLevel: string;
  featureFlags: any;
}

const tierConfig: Record<string, { color: string; icon: any; tagline: string; popular?: boolean }> = {
  STARTER: {
    color: "border-blue-500",
    icon: Zap,
    tagline: "Perfect for solo practitioners",
  },
  GROWTH: {
    color: "border-emerald-500",
    icon: Building2,
    tagline: "For growing audit teams",
    popular: true,
  },
  PROFESSIONAL: {
    color: "border-purple-500",
    icon: Crown,
    tagline: "For established firms",
  },
  ENTERPRISE: {
    color: "border-amber-500",
    icon: Shield,
    tagline: "Unlimited scale & support",
  },
};

function formatPrice(price: string | number) {
  return Number(price).toLocaleString("en-PK");
}

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/auth/plans"],
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            data-testid="link-back-login"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Login
          </Button>
        </div>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-foreground" data-testid="text-page-title">
              AuditWise
            </h1>
          </div>
          <p className="text-xl text-muted-foreground mb-2">
            Choose the plan that fits your firm
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              60-day free trial
            </Badge>
            <span className="text-sm text-muted-foreground">No credit card required</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 h-[500px]" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans?.map((plan) => {
              const config = tierConfig[plan.code] || tierConfig.STARTER;
              const Icon = config.icon;
              const isUnlimited = plan.maxUsers >= 9999;

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col border-t-4 ${config.color} ${
                    config.popular ? "ring-2 ring-emerald-500 shadow-lg scale-[1.02]" : ""
                  } transition-all hover:shadow-lg`}
                  data-testid={`card-plan-${plan.code.toLowerCase()}`}
                >
                  {config.popular && (
                    <Badge
                      className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white"
                      data-testid="badge-most-popular"
                    >
                      Most Popular
                    </Badge>
                  )}

                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">{config.tagline}</p>
                    <div className="mt-4">
                      <span className="text-3xl font-bold" data-testid={`text-price-${plan.code.toLowerCase()}`}>
                        PKR {formatPrice(plan.monthlyPrice)}
                      </span>
                      <span className="text-muted-foreground text-sm">/month</span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1 mb-6">
                      <li className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-primary shrink-0" />
                        <span>
                          {isUnlimited ? "Unlimited" : `Up to ${plan.maxUsers}`} users
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span>
                          {isUnlimited ? "Unlimited" : `${plan.maxOffices}`} office{plan.maxOffices !== 1 ? "s" : ""}
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-primary shrink-0" />
                        <span>
                          {isUnlimited ? "Unlimited" : `${plan.maxEngagements}`} engagements/year
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <HardDrive className="h-4 w-4 text-primary shrink-0" />
                        <span>{plan.storageGb} GB storage</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Brain className="h-4 w-4 text-primary shrink-0" />
                        <span>
                          {plan.platformAiIncluded ? "Platform AI included" : "No AI"}
                        </span>
                      </li>
                      {plan.allowCustomAi && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>Custom AI key support</span>
                        </li>
                      )}
                      {plan.featureFlags?.advancedReporting && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>Advanced reporting</span>
                        </li>
                      )}
                      {plan.featureFlags?.apiAccess && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>API access</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="capitalize">{plan.supportLevel} support</span>
                      </li>
                    </ul>

                    <Button
                      className="w-full"
                      variant={config.popular ? "default" : "outline"}
                      onClick={() => navigate(`/signup?plan=${plan.code.toLowerCase()}`)}
                      data-testid={`button-start-trial-${plan.code.toLowerCase()}`}
                    >
                      Start Free Trial
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-center mt-12 space-y-2">
          <p className="text-sm text-muted-foreground">
            All plans include a 60-day free trial. No credit card required to start.
          </p>
          <p className="text-sm text-muted-foreground">
            Prices shown in Pakistani Rupees (PKR). Cancel anytime during the trial.
          </p>
        </div>
      </div>
    </div>
  );
}
