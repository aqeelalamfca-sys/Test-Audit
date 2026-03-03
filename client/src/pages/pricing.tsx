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
  CreditCard,
  FileText,
  Mail,
  AlertTriangle,
  Banknote,
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

const tierConfig: Record<string, {
  color: string;
  borderColor: string;
  icon: any;
  tagline: string;
  popular?: boolean;
  yearlyDiscount: number;
  monthlyDiscount: number;
}> = {
  STARTER: {
    color: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500",
    icon: Zap,
    tagline: "Perfect for solo practitioners",
    yearlyDiscount: 0,
    monthlyDiscount: 0,
  },
  GROWTH: {
    color: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500",
    icon: Building2,
    tagline: "For growing audit teams",
    popular: true,
    yearlyDiscount: 40,
    monthlyDiscount: 20,
  },
  PROFESSIONAL: {
    color: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500",
    icon: Crown,
    tagline: "For established firms",
    yearlyDiscount: 30,
    monthlyDiscount: 15,
  },
  ENTERPRISE: {
    color: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500",
    icon: Shield,
    tagline: "Unlimited scale & support",
    yearlyDiscount: 45,
    monthlyDiscount: 22,
  },
};

const PKR_TO_USD = 278;

function formatPrice(price: number) {
  return price.toLocaleString("en-PK");
}

function formatUsd(pkr: number) {
  return Math.round(pkr / PKR_TO_USD).toLocaleString("en-US");
}

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/auth/plans"],
  });

  function getPrice(plan: Plan) {
    const base = Number(plan.monthlyPrice);
    const config = tierConfig[plan.code] || tierConfig.STARTER;
    const discount = billingCycle === "yearly" ? config.yearlyDiscount : config.monthlyDiscount;
    const discounted = Math.round(base * (1 - discount / 100));
    return { base, discounted, discount };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950">
      <div className="absolute top-3 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4 pb-8">
        <div className="flex items-center gap-2 mb-4">
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

        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
              AuditWise
            </h1>
          </div>
          <p className="text-lg text-muted-foreground mb-4">
            Choose the plan that fits your firm
          </p>

          <div className="inline-flex items-center bg-muted/60 dark:bg-muted/30 rounded-full p-1 mb-2">
            <button
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white dark:bg-gray-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setBillingCycle("monthly")}
              data-testid="toggle-monthly"
            >
              Monthly
            </button>
            <button
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                billingCycle === "yearly"
                  ? "bg-white dark:bg-gray-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setBillingCycle("yearly")}
              data-testid="toggle-yearly"
            >
              Yearly
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                Save up to 45%
              </Badge>
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
              30-day free trial
            </Badge>
            <span className="text-xs text-muted-foreground">No credit card required</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 h-[350px]" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans?.map((plan) => {
              const config = tierConfig[plan.code] || tierConfig.STARTER;
              const Icon = config.icon;
              const isUnlimited = plan.maxUsers >= 9999;
              const { base, discounted, discount } = getPrice(plan);

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col border-t-4 ${config.borderColor} ${
                    config.popular ? "ring-2 ring-emerald-500 shadow-xl scale-[1.02]" : ""
                  } transition-all hover:shadow-lg`}
                  data-testid={`card-plan-${plan.code.toLowerCase()}`}
                >
                  {config.popular && (
                    <Badge
                      className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px]"
                      data-testid="badge-most-popular"
                    >
                      Most Popular
                    </Badge>
                  )}

                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">{config.tagline}</p>

                    <div className="mt-2">
                      {discount > 0 && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm text-muted-foreground line-through">
                            PKR {formatPrice(base)}
                          </span>
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 font-semibold">
                            {discount}% OFF
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold" data-testid={`text-price-${plan.code.toLowerCase()}`}>
                          PKR {formatPrice(discounted)}
                        </span>
                        <span className="text-muted-foreground text-xs">/mo</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5" data-testid={`text-usd-${plan.code.toLowerCase()}`}>
                        ≈ USD {formatUsd(discounted)}/mo
                        {billingCycle === "yearly" && (
                          <span> · Billed PKR {formatPrice(discounted * 12)}/year</span>
                        )}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col pt-0 px-4 pb-4">
                    <ul className="space-y-1.5 flex-1 mb-3 text-[13px]">
                      <li className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{isUnlimited ? "Unlimited" : `Up to ${plan.maxUsers}`} users</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{isUnlimited ? "Unlimited" : `${plan.maxOffices}`} office{plan.maxOffices !== 1 ? "s" : ""}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{isUnlimited ? "Unlimited" : `${plan.maxEngagements}`} engagements/year</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <HardDrive className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{plan.storageGb} GB storage</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Brain className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{plan.platformAiIncluded ? "Platform AI included" : "No AI"}</span>
                      </li>
                      {plan.allowCustomAi && (
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>Custom AI key support</span>
                        </li>
                      )}
                      {plan.featureFlags?.advancedReporting && (
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>Advanced reporting</span>
                        </li>
                      )}
                      {plan.featureFlags?.apiAccess && (
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>API access</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="capitalize">{plan.supportLevel} support</span>
                      </li>
                    </ul>

                    <Button
                      className="w-full h-9 text-sm"
                      variant={config.popular ? "default" : "outline"}
                      onClick={() => navigate(`/signup?plan=${plan.code.toLowerCase()}`)}
                      data-testid={`button-start-trial-${plan.code.toLowerCase()}`}
                    >
                      Start Free Trial
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-10 max-w-4xl mx-auto">
          <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/15 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground" data-testid="heading-pricing-justified">Why This Pricing is Justified</h3>
                <p className="text-[11px] text-muted-foreground">Built-in compliance coverage across every plan</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {[
                "ISA 200\u2013720 full mapping",
                "ISQM-1 firm-wide controls",
                "Automated risk assessment engine",
                "End-to-end engagement lifecycle control",
                "Preparer\u2013Reviewer\u2013Partner digital sign-off workflow",
                "AI-assisted working paper drafting",
                "Secure Postgres encrypted database",
                "Pakistan Companies Act 2017 integration",
                "FBR-ready documentation structure",
                "SECP compliance alignment",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 py-1" data-testid={`pricing-feature-${i}`}>
                  <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span className="text-[12.5px] text-muted-foreground leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 max-w-4xl mx-auto">
          <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                Payment & Billing Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CreditCard className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                  <p>We are currently working on online payment processes including credit card and virtual payment media. Updates coming soon.</p>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                  <p>Invoice shall be delivered through courier, depending upon your selected package, and shall be deposited in Pakistani Bank account mentioned on the Invoice.</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                  <p>If payment is not received within 15 days of invoice date, your account shall be suspended. After 50 days of non-payment, the account and all associated data shall be permanently deleted.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Banknote className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                  <p>Payment shall be made via Cash Deposit or Online Bank Transfer.</p>
                </div>
                <div className="flex items-start gap-2 md:col-span-2">
                  <Mail className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                  <p>After payment, send the receipt to <span className="font-medium text-foreground">invoice@auditwise.tech</span> along with your firm name for confirmation.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-6 space-y-1">
          <p className="text-xs text-muted-foreground">
            All plans include a 30-day free trial. No credit card required to start.
          </p>
          <p className="text-xs text-muted-foreground">
            Prices shown in Pakistani Rupees (PKR). USD equivalents are approximate (1 USD ≈ {PKR_TO_USD} PKR).
          </p>
          <p className="text-xs text-muted-foreground">
            Cancel anytime during the trial.
          </p>
        </div>
      </div>
    </div>
  );
}
