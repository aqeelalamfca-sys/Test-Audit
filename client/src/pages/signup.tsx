import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Shield,
  Eye,
  EyeOff,
  ArrowLeft,
  Building2,
  User,
  Loader2,
  CheckCircle2,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";

const signupSchema = z.object({
  firmLegalName: z.string().min(2, "Firm name must be at least 2 characters"),
  firmDisplayName: z.string().optional(),
  headOfficeAddress: z.string().optional(),
  mobileNumber: z.string().optional(),
  adminFullName: z.string().min(2, "Full name must be at least 2 characters"),
  adminEmail: z.string().email("Please enter a valid email"),
  password: z.string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/\d/, "Must contain at least one number")
    .regex(/[@$!%*?&#^()_+\-=\[\]{}|\\:";'<>,./~`]/, "Must contain at least one special character"),
  confirmPassword: z.string(),
  planKey: z.string().min(1, "Please select a plan"),
  acceptTerms: z.boolean(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((data) => data.acceptTerms === true, {
  message: "You must accept the terms and conditions",
  path: ["acceptTerms"],
});

type SignupFormData = z.infer<typeof signupSchema>;

interface Plan {
  id: string;
  code: string;
  name: string;
  monthlyPrice: string;
  maxUsers: number;
  maxEngagements: number;
}

export default function SignupPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Accepted formats: SVG, PNG, JPG, JPEG, WEBP", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB before processing", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const params = new URLSearchParams(searchString);
  const preselectedPlan = params.get("plan") || "";
  const billingCycle = (params.get("billing") || "monthly") as "monthly" | "yearly";

  const PLAN_DISCOUNTS: Record<string, { yearly: number; monthly: number }> = {
    STARTER:      { yearly: 0,  monthly: 0  },
    GROWTH:       { yearly: 40, monthly: 20 },
    PROFESSIONAL: { yearly: 30, monthly: 15 },
    ENTERPRISE:   { yearly: 45, monthly: 22 },
  };

  function getPlanDisplayPrice(plan: Plan) {
    const base = Number(plan.monthlyPrice);
    const discounts = PLAN_DISCOUNTS[plan.code] || { yearly: 0, monthly: 0 };
    const discount = billingCycle === "yearly" ? discounts.yearly : discounts.monthly;
    const discounted = Math.round(base * (1 - discount / 100));
    return { base, discounted, discount };
  }

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/auth/plans"],
  });

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firmLegalName: "",
      firmDisplayName: "",
      headOfficeAddress: "",
      mobileNumber: "",
      adminFullName: "",
      adminEmail: "",
      password: "",
      confirmPassword: "",
      planKey: preselectedPlan.toUpperCase(),
      acceptTerms: false,
    },
  });

  useEffect(() => {
    if (preselectedPlan && !form.getValues("planKey")) {
      form.setValue("planKey", preselectedPlan.toUpperCase());
    }
  }, [preselectedPlan]);

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmLegalName: data.firmLegalName,
          firmDisplayName: data.firmDisplayName,
          headOfficeAddress: data.headOfficeAddress || "",
          mobileNumber: data.mobileNumber || "",
          adminFullName: data.adminFullName,
          adminEmail: data.adminEmail,
          password: data.password,
          planKey: data.planKey,
          acceptTerms: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Signup Failed",
          description: result.error || "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("auditwise_token", result.token);
      localStorage.setItem("auditwise_refresh_token", result.refreshToken);

      if (logoFile && result.firm?.id) {
        try {
          const formData = new FormData();
          formData.append("logo", logoFile);
          await fetch(`/api/admin/firm-logo`, {
            method: "POST",
            headers: { Authorization: `Bearer ${result.token}` },
            body: formData,
          });
        } catch {
        }
      }

      toast({
        title: "Welcome to AuditWise!",
        description: "Your 30-day free trial has started. You can now set up your firm.",
      });

      window.location.href = "/";
    } catch (err) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlan = plans?.find((p) => p.code === form.watch("planKey"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/pricing")}
            data-testid="link-back-pricing"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Pricing
          </Button>
        </div>

        <Card className="border-t-4 border-t-primary">
          <CardHeader className="text-center pb-2 pt-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield className="h-7 w-7 text-primary" />
              <CardTitle className="text-xl">Start Your Free Trial</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              30 days free. No credit card required. Cancel anytime.
            </p>
            {selectedPlan && (() => {
              const { discounted, discount } = getPlanDisplayPrice(selectedPlan);
              return (
                <div className="mt-2 flex flex-col items-center gap-1">
                  <Badge variant="outline">
                    {selectedPlan.name} Plan — PKR {discounted.toLocaleString("en-PK")}/mo after trial
                  </Badge>
                  {discount > 0 && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {billingCycle === "yearly" ? "Yearly" : "Monthly"} billing — {discount}% discount applied
                    </span>
                  )}
                </div>
              );
            })()}
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="planKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plan">
                            <SelectValue placeholder="Select a plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plans?.map((plan) => {
                            const { discounted, discount } = getPlanDisplayPrice(plan);
                            return (
                              <SelectItem key={plan.code} value={plan.code}>
                                {plan.name} — PKR {discounted.toLocaleString("en-PK")}/mo
                                {discount > 0 ? ` (${discount}% off)` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-3">
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    Firm Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firmLegalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Firm Legal Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Ahmad & Co. Chartered Accountants"
                              data-testid="input-firm-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="firmDisplayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Ahmad & Co."
                              data-testid="input-firm-display-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FormLabel>Firm Logo (optional)</FormLabel>
                    <div className="flex items-center gap-3">
                      {logoPreview ? (
                        <div className="relative border rounded-lg p-2 bg-white dark:bg-gray-900 flex items-center justify-center" style={{ minWidth: 120, minHeight: 50 }}>
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="max-h-[50px] w-auto object-contain"
                            data-testid="img-logo-preview"
                          />
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                            data-testid="button-remove-logo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <label
                          className="flex items-center gap-2 border border-dashed rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground"
                          data-testid="label-upload-logo"
                        >
                          <Upload className="h-4 w-4" />
                          Upload logo
                          <input
                            type="file"
                            accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={handleLogoSelect}
                            data-testid="input-logo-file"
                          />
                        </label>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Max 600x200px. SVG, PNG, JPG, WEBP accepted. Auto-optimized to PNG.
                      </p>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="headOfficeAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Head Office Address (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Suite 201, 2nd Floor, Business Tower, Lahore"
                            data-testid="input-head-office-address"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mobileNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="e.g. +92 300 1234567"
                            data-testid="input-mobile-number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border-t pt-3">
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Admin Account
                  </h3>
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="adminFullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Your full name"
                              data-testid="input-admin-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="adminEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="you@yourfirm.com"
                              data-testid="input-admin-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  className="pr-10"
                                  placeholder="Min 10 characters"
                                  data-testid="input-password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={() => setShowPassword(!showPassword)}
                                  data-testid="button-toggle-password"
                                  tabIndex={-1}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  className="pr-10"
                                  placeholder="Repeat password"
                                  data-testid="input-confirm-password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={() => setShowPassword(!showPassword)}
                                  tabIndex={-1}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground -mt-1">
                      Min 10 characters with uppercase, lowercase, number, and special character required.
                    </p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-3 space-y-0 border-t pt-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-accept-terms"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          I agree to the Terms of Service and Privacy Policy
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={isSubmitting}
                  data-testid="button-create-account"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating your account...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Create Account & Start Trial
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm"
                    onClick={() => navigate("/")}
                    data-testid="link-sign-in"
                  >
                    Sign in
                  </Button>
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
