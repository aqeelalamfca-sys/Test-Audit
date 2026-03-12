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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  firmEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  headOfficeAddress: z.string().optional(),
  mobileNumber: z.string().optional(),
  ntn: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
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
  monthlyDiscount: number;
  yearlyDiscount: number;
  specialOffer: string | null;
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
  const [legalModal, setLegalModal] = useState<{ open: boolean; type: "terms" | "privacy" }>({ open: false, type: "terms" });

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

  function getPlanDisplayPrice(plan: Plan) {
    const base = Number(plan.monthlyPrice);
    const discount = billingCycle === "yearly" ? (plan.yearlyDiscount || 0) : (plan.monthlyDiscount || 0);
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
      firmEmail: "",
      headOfficeAddress: "",
      mobileNumber: "",
      ntn: "",
      country: "",
      currency: "PKR",
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
          firmEmail: data.firmEmail || "",
          headOfficeAddress: data.headOfficeAddress || "",
          mobileNumber: data.mobileNumber || "",
          ntn: data.ntn || "",
          country: data.country || "Pakistan",
          currency: data.currency || "PKR",
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
                  {billingCycle === "yearly" && (
                    <span className="text-[11px] text-muted-foreground">
                      Billed PKR {discounted * 12 > 0 ? (discounted * 12).toLocaleString("en-PK") : 0}/year
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
                                {billingCycle === "yearly" ? ` · PKR ${(discounted * 12).toLocaleString("en-PK")}/yr` : ""}
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
                  <FormField
                    control={form.control}
                    name="firmEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Firm Email (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="e.g. info@yourfirm.com"
                            data-testid="input-firm-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="ntn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NTN - National Tax Number (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 1234567-8"
                            data-testid="input-ntn"
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
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Pakistan"
                              data-testid="input-country"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency (optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "PKR"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-currency">
                                <SelectValue placeholder="PKR - Pakistani Rupee" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                              <SelectItem value="USD">USD - US Dollar</SelectItem>
                              <SelectItem value="GBP">GBP - British Pound</SelectItem>
                              <SelectItem value="EUR">EUR - Euro</SelectItem>
                              <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                              <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                              <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                              <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                              <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                              <SelectItem value="BDT">BDT - Bangladeshi Taka</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
                          I agree to the{" "}
                          <button
                            type="button"
                            className="text-primary underline hover:text-primary/80 font-medium"
                            onClick={() => setLegalModal({ open: true, type: "terms" })}
                            data-testid="link-terms-of-service"
                          >
                            Terms of Service
                          </button>
                          {" "}and{" "}
                          <button
                            type="button"
                            className="text-primary underline hover:text-primary/80 font-medium"
                            onClick={() => setLegalModal({ open: true, type: "privacy" })}
                            data-testid="link-privacy-policy"
                          >
                            Privacy Policy
                          </button>
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

      <Dialog open={legalModal.open} onOpenChange={(open) => setLegalModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {legalModal.type === "terms" ? "Terms of Service" : "Privacy Policy"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 text-sm text-muted-foreground leading-relaxed space-y-4">
            {legalModal.type === "terms" ? (
              <>
                <p className="text-xs text-muted-foreground">Last Updated: March 2026 | Version 1.0</p>
                <h3 className="font-semibold text-foreground text-base">1. Acceptance of Terms</h3>
                <p>By accessing or using AuditWise ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Platform. These terms constitute a legally binding agreement between you ("User", "you") and AuditWise ("we", "us", "our").</p>

                <h3 className="font-semibold text-foreground text-base">2. Description of Service</h3>
                <p>AuditWise is a cloud-based statutory audit management platform designed for audit firms in Pakistan. The Platform provides tools for engagement management, audit planning, execution, quality control, compliance tracking (ISA 200–720, ISQM-1), team collaboration, AI-assisted features, and document management.</p>

                <h3 className="font-semibold text-foreground text-base">3. Account Registration</h3>
                <p>You must provide accurate, complete, and current information during registration. You are responsible for maintaining the confidentiality of your login credentials. Each user account is personal and non-transferable. Firm administrators are responsible for managing user access within their firm.</p>

                <h3 className="font-semibold text-foreground text-base">4. Acceptable Use</h3>
                <p>You agree not to: (a) use the Platform for any unlawful purpose; (b) attempt to gain unauthorized access to other users' data or firm records; (c) reverse-engineer, decompile, or disassemble the Platform; (d) upload malicious code, viruses, or harmful content; (e) share login credentials with unauthorized persons; (f) use the Platform to store data unrelated to audit engagements.</p>

                <h3 className="font-semibold text-foreground text-base">5. Data Ownership</h3>
                <p>All data you upload or create on the Platform ("User Data") remains your property. We do not claim ownership over your audit workpapers, client records, or engagement files. You grant us a limited license to process, store, and transmit your data solely for the purpose of providing the Service.</p>

                <h3 className="font-semibold text-foreground text-base">6. Service Availability</h3>
                <p>We strive to maintain 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance windows will be communicated in advance. We are not liable for outages caused by force majeure events, third-party service failures, or internet connectivity issues.</p>

                <h3 className="font-semibold text-foreground text-base">7. Subscription & Billing</h3>
                <p>Access to the Platform requires a valid subscription. Free trial periods may be offered at our discretion. Pricing is subject to change with 30 days' prior notice. No refunds are provided for partial billing periods unless required by applicable law.</p>

                <h3 className="font-semibold text-foreground text-base">8. Intellectual Property</h3>
                <p>The Platform, including its design, code, features, templates, and documentation, is the intellectual property of AuditWise. You may not copy, modify, distribute, or create derivative works from the Platform without our written consent.</p>

                <h3 className="font-semibold text-foreground text-base">9. Limitation of Liability</h3>
                <p>To the maximum extent permitted by law, AuditWise shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform. Our total liability shall not exceed the fees paid by you in the 12 months preceding the claim.</p>

                <h3 className="font-semibold text-foreground text-base">10. Termination</h3>
                <p>We may suspend or terminate your account if you violate these Terms. Upon termination, your right to use the Platform ceases immediately. You may request a data export within 30 days of termination, after which your data may be permanently deleted.</p>

                <h3 className="font-semibold text-foreground text-base">11. Governing Law</h3>
                <p>These Terms shall be governed by and construed in accordance with the laws of Pakistan. Any disputes arising shall be subject to the exclusive jurisdiction of the courts located in Lahore, Pakistan.</p>

                <h3 className="font-semibold text-foreground text-base">12. Changes to Terms</h3>
                <p>We reserve the right to update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the revised Terms. Material changes will be communicated via email or in-app notification.</p>

                <h3 className="font-semibold text-foreground text-base">13. Contact</h3>
                <p>For questions regarding these Terms, contact us at:</p>
                <div className="rounded-md bg-muted/50 border p-3 text-xs space-y-1">
                  <p>Aqeel Alam, FCA — +92 321 1112041</p>
                  <p>Muhammad Bin Qasim, FCA — +92 341 5001000</p>
                  <p>Email: support@auditwise.tech</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Last Updated: March 2026 | Version 1.0</p>
                <h3 className="font-semibold text-foreground text-base">1. Introduction</h3>
                <p>AuditWise ("we", "us", "our") is committed to protecting the privacy and security of your personal and professional information. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our platform.</p>

                <h3 className="font-semibold text-foreground text-base">2. Information We Collect</h3>
                <p><strong>Account Information:</strong> Name, email address, phone number, firm name, NTN, SECP registration number, and professional credentials provided during registration.</p>
                <p><strong>Usage Data:</strong> IP address, browser type, device information, pages visited, features used, and session duration collected automatically.</p>
                <p><strong>Audit Data:</strong> Engagement records, workpapers, client information, financial data, and documents you upload or create on the Platform.</p>
                <p><strong>Communication Data:</strong> Messages, review notes, and correspondence within the Platform.</p>

                <h3 className="font-semibold text-foreground text-base">3. How We Use Your Information</h3>
                <p>We use your information to: (a) provide and maintain the Platform services; (b) authenticate your identity and manage access; (c) process subscriptions and billing; (d) send service-related communications and updates; (e) improve Platform features and user experience; (f) comply with legal and regulatory obligations; (g) provide AI-assisted audit features (with anonymized data).</p>

                <h3 className="font-semibold text-foreground text-base">4. Data Security</h3>
                <p>We implement industry-standard security measures including: encryption in transit (TLS/SSL) and at rest; role-based access controls; regular security audits and penetration testing; secure data centers with physical access controls; automated backup and disaster recovery systems. An independent Australia-based IT security company has been engaged for cybersecurity review and E2E validation.</p>

                <h3 className="font-semibold text-foreground text-base">5. Data Sharing</h3>
                <p>We do not sell your personal information. We may share data with: (a) service providers who assist in Platform operations (hosting, analytics); (b) legal authorities when required by law or court order; (c) professional advisors for audit and compliance purposes. All third-party service providers are bound by confidentiality agreements.</p>

                <h3 className="font-semibold text-foreground text-base">6. Data Retention</h3>
                <p>We retain your data for as long as your account is active or as needed to provide services. After account termination, data is retained for 30 days to allow export, then permanently deleted. Certain data may be retained longer if required by law or for legitimate business purposes (e.g., billing records).</p>

                <h3 className="font-semibold text-foreground text-base">7. Your Rights</h3>
                <p>You have the right to: (a) access your personal data; (b) correct inaccurate information; (c) request deletion of your data (subject to legal requirements); (d) export your data in a standard format; (e) withdraw consent for optional data processing; (f) lodge a complaint with the relevant data protection authority.</p>

                <h3 className="font-semibold text-foreground text-base">8. Cookies & Tracking</h3>
                <p>We use essential cookies for authentication and session management. We may use analytics cookies to understand Platform usage patterns. You can control cookie settings through your browser preferences.</p>

                <h3 className="font-semibold text-foreground text-base">9. AI Features</h3>
                <p>Our AI-assisted features process audit data to provide suggestions and analysis. AI processing is performed using anonymized or aggregated data where possible. You can opt out of AI features through your account settings. No audit data is used to train external AI models.</p>

                <h3 className="font-semibold text-foreground text-base">10. Children's Privacy</h3>
                <p>The Platform is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors.</p>

                <h3 className="font-semibold text-foreground text-base">11. International Data Transfers</h3>
                <p>Your data may be processed and stored on servers located outside Pakistan. We ensure appropriate safeguards are in place for any international data transfers in compliance with applicable data protection laws.</p>

                <h3 className="font-semibold text-foreground text-base">12. Changes to This Policy</h3>
                <p>We may update this Privacy Policy from time to time. Changes will be communicated via email or in-app notification. Continued use of the Platform after changes constitutes acceptance of the updated policy.</p>

                <h3 className="font-semibold text-foreground text-base">13. Contact</h3>
                <p>For privacy-related inquiries, contact us at:</p>
                <div className="rounded-md bg-muted/50 border p-3 text-xs space-y-1">
                  <p>Aqeel Alam, FCA — +92 321 1112041</p>
                  <p>Muhammad Bin Qasim, FCA — +92 341 5001000</p>
                  <p>Email: support@auditwise.tech</p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
