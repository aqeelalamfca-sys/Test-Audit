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
  Mail,
  Lock,
  Loader2,
  CheckCircle2,
} from "lucide-react";

const signupSchema = z.object({
  firmLegalName: z.string().min(2, "Firm name must be at least 2 characters"),
  firmDisplayName: z.string().optional(),
  adminFullName: z.string().min(2, "Full name must be at least 2 characters"),
  adminEmail: z.string().email("Please enter a valid email"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
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

  const params = new URLSearchParams(searchString);
  const preselectedPlan = params.get("plan") || "";

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/auth/plans"],
  });

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firmLegalName: "",
      firmDisplayName: "",
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

      toast({
        title: "Welcome to AuditWise!",
        description: "Your 60-day free trial has started. You can now set up your firm.",
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
        <div className="flex items-center gap-2 mb-6">
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
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-8 w-8 text-primary" />
              <CardTitle className="text-2xl">Start Your Free Trial</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              60 days free. No credit card required. Cancel anytime.
            </p>
            {selectedPlan && (
              <Badge variant="outline" className="mt-2 mx-auto">
                {selectedPlan.name} Plan - PKR {Number(selectedPlan.monthlyPrice).toLocaleString("en-PK")}/month after trial
              </Badge>
            )}
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                          {plans?.map((plan) => (
                            <SelectItem key={plan.code} value={plan.code}>
                              {plan.name} - PKR {Number(plan.monthlyPrice).toLocaleString("en-PK")}/mo
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Firm Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Admin Account
                  </h3>
                  <div className="space-y-4">
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
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="email"
                                className="pl-10"
                                placeholder="you@yourfirm.com"
                                data-testid="input-admin-email"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  className="pl-10 pr-10"
                                  placeholder="Min 8 characters"
                                  data-testid="input-password"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                                  onClick={() => setShowPassword(!showPassword)}
                                  data-testid="button-toggle-password"
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
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
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Repeat password"
                                data-testid="input-confirm-password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
