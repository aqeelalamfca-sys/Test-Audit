import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Shield,
  Eye,
  EyeOff,
  Users,
  Building2,
  CheckCircle2,
  Lock,
  FileCheck,
  BarChart3,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const features = [
  {
    icon: FileCheck,
    title: "Complete Audit Lifecycle",
    desc: "End-to-end workflow from engagement acceptance through finalization and reporting",
  },
  {
    icon: Lock,
    title: "ISA / ISQM-1 Compliance",
    desc: "Built-in enforcement engine ensures every step meets international audit standards",
  },
  {
    icon: BarChart3,
    title: "AI-Powered Analytics",
    desc: "Intelligent risk assessment, auto-classification, and real-time data quality monitoring",
  },
  {
    icon: Shield,
    title: "Immutable Audit Trail",
    desc: "Tamper-proof logging with maker-checker controls and sign-off authority matrix",
  },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginType, setLoginType] = useState<"firm" | "portal">("firm");

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const portalForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const result = await login(data.email, data.password);
      toast({
        title: "Welcome back",
        description: "You have been successfully logged in.",
      });
      const userRole = (result as any)?.role?.toUpperCase();
      if (userRole === "SUPER_ADMIN") {
        setLocation("/platform");
      } else if (userRole === "FIRM_ADMIN") {
        setLocation("/firm-admin");
      } else {
        setLocation("/");
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPortalSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/client-portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (response.ok) {
        toast({
          title: "Welcome to Client Portal",
          description: "You have been successfully logged in.",
        });
        setLocation("/portal/dashboard");
      } else {
        const error = await response.json();
        throw new Error(error.error || "Invalid credentials");
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 right-0 w-64 h-64 rounded-full bg-white/[0.03] translate-x-1/2" />

        <div className="relative z-10 flex flex-col justify-between w-full p-10 xl:p-14">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">AuditWise</h1>
              </div>
            </div>
            <p className="text-sm text-primary-foreground/60 ml-14">Statutory Audit Management</p>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-lg py-8">
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-xs font-medium text-white/90">AI-Powered Audit Intelligence</span>
              </div>
              <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
                Streamline Your<br />
                Statutory Audits
              </h2>
              <p className="text-base text-primary-foreground/70 leading-relaxed max-w-md">
                The complete platform for managing statutory audit engagements with built-in ISA compliance, 
                intelligent automation, and real-time collaboration.
              </p>
            </div>

            <div className="space-y-4">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-3.5 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/10 transition-all duration-300 hover-elevate group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors">
                    <feature.icon className="h-4.5 w-4.5 text-white/90" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">{feature.title}</h3>
                    <p className="text-xs text-primary-foreground/55 leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex -space-x-2.5">
              {["AK", "FZ", "MR", "SA"].map((initials, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary text-[10px] font-semibold text-white"
                  style={{
                    backgroundColor: [
                      "rgba(255,255,255,0.2)",
                      "rgba(255,255,255,0.15)",
                      "rgba(255,255,255,0.12)",
                      "rgba(255,255,255,0.1)",
                    ][i],
                  }}
                >
                  {initials}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-white/90">Trusted by audit professionals</p>
              <p className="text-xs text-primary-foreground/50">ISA 230 / ISQM-1 Compliant Platform</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <Shield className="h-7 w-7" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">AuditWise</h1>
            <p className="text-sm text-muted-foreground mt-1">Statutory Audit Management Software</p>
          </div>

          <div className="mb-8 hidden lg:block">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1.5">Sign in to continue to your audit workspace</p>
          </div>

          <Card className="border-border/60 shadow-lg">
            <CardContent className="p-6">
              <Tabs defaultValue="firm" onValueChange={(v) => setLoginType(v as "firm" | "portal")}>
                <TabsList className="grid w-full grid-cols-2 mb-6 h-11">
                  <TabsTrigger value="firm" className="flex items-center gap-2 text-sm" data-testid="tab-firm-login">
                    <Building2 className="h-4 w-4" />
                    Firm Login
                  </TabsTrigger>
                  <TabsTrigger value="portal" className="flex items-center gap-2 text-sm" data-testid="tab-client-portal">
                    <Users className="h-4 w-4" />
                    Client Portal
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="firm">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Email Address</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="you@auditwise.pk"
                                autoComplete="email"
                                className="h-11"
                                {...field}
                                data-testid="input-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter your password"
                                  autoComplete="current-password"
                                  className="h-11 pr-11"
                                  {...field}
                                  data-testid="input-password"
                                />
                                <span
                                  role="button"
                                  tabIndex={0}
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground cursor-pointer opacity-70 hover:opacity-100 no-default-hover-elevate"
                                  onClick={() => setShowPassword(!showPassword)}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowPassword(!showPassword); }}}
                                  data-testid="button-toggle-password"
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full h-11 text-sm font-semibold gap-2"
                        disabled={isSubmitting || isLoading}
                        data-testid="button-login"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>

                  <div className="mt-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">New to AuditWise?</p>
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm font-medium p-0 h-auto"
                      onClick={() => setLocation("/pricing")}
                      data-testid="link-start-trial"
                    >
                      Start your 30-day free trial
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>

                  {import.meta.env.DEV && (
                  <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border/60" data-testid="dev-credentials">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-foreground">Demo Credentials</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">Test@123</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {[
                        { role: "Admin", email: "admin@auditwise.pk" },
                        { role: "Partner", email: "partner@auditwise.pk" },
                        { role: "Manager", email: "manager@auditwise.pk" },
                        { role: "Team Lead", email: "teamlead@auditwise.pk" },
                        { role: "Senior", email: "senior@auditwise.pk" },
                        { role: "Staff", email: "staff@auditwise.pk" },
                      ].map((cred) => (
                        <button
                          key={cred.email}
                          type="button"
                          className="flex items-center gap-1.5 py-1 px-1.5 -mx-1.5 rounded-md hover-elevate transition-colors text-left group cursor-pointer"
                          onClick={() => {
                            form.setValue("email", cred.email);
                            form.setValue("password", "Test@123");
                          }}
                          data-testid={`quick-login-${cred.role.toLowerCase()}`}
                        >
                          <span className="text-muted-foreground transition-colors">{cred.role}:</span>
                          <span className="font-mono text-[11px] text-foreground/70 transition-colors truncate">{cred.email.split("@")[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  )}
                </TabsContent>

                <TabsContent value="portal">
                  <Form {...portalForm}>
                    <form onSubmit={portalForm.handleSubmit(onPortalSubmit)} className="space-y-5">
                      <FormField
                        control={portalForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Email Address</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="your-email@company.pk"
                                autoComplete="email"
                                className="h-11"
                                {...field}
                                data-testid="portal-input-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={portalForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter your password"
                                  autoComplete="current-password"
                                  className="h-11 pr-11"
                                  {...field}
                                  data-testid="portal-input-password"
                                />
                                <span
                                  role="button"
                                  tabIndex={0}
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground cursor-pointer opacity-70 hover:opacity-100 no-default-hover-elevate"
                                  onClick={() => setShowPassword(!showPassword)}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowPassword(!showPassword); }}}
                                  data-testid="portal-button-toggle-password"
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full h-11 text-sm font-semibold gap-2"
                        disabled={isSubmitting}
                        data-testid="portal-button-login"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            Access Client Portal
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>

                  {import.meta.env.DEV && (
                  <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border/60" data-testid="dev-portal-credentials">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-foreground">Demo Client Login</p>
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md hover-elevate transition-colors text-left group cursor-pointer text-xs"
                      onClick={() => {
                        portalForm.setValue("email", "client@company.pk");
                        portalForm.setValue("password", "Client@123");
                      }}
                      data-testid="quick-login-client"
                    >
                      <span className="text-muted-foreground transition-colors">Email:</span>
                      <span className="font-mono text-[11px] text-foreground/70 transition-colors">client@company.pk</span>
                      <span className="text-muted-foreground/50 mx-1">|</span>
                      <span className="text-muted-foreground transition-colors">Pass:</span>
                      <span className="font-mono text-[11px] text-foreground/70 transition-colors">Client@123</span>
                    </button>
                  </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="mt-6 text-[11px] text-muted-foreground/50 text-center">
            ISA / ISQM-1 Compliant Audit Platform
          </p>
        </div>
      </div>
    </div>
  );
}
