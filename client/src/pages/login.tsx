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
  ArrowRight,
  Sparkles,
  Lock,
  Brain,
  FileText,
  Database,
  Scale,
  BarChart3,
  ClipboardCheck,
  UserCheck,
  AlertTriangle,
  BookOpen,
  Layers,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function isSuperAdminAccess(): boolean {
  return window.location.pathname === "/platform-login" ||
    window.location.search.includes("portal=admin");
}

const FEATURES = [
  { icon: BookOpen,      label: "ISA 200–720 Full Mapping" },
  { icon: Shield,        label: "ISQM-1 Firm-Wide Controls" },
  { icon: AlertTriangle, label: "Automated Risk Assessment" },
  { icon: Layers,        label: "Engagement Lifecycle Control" },
  { icon: UserCheck,     label: "Preparer-Reviewer-Partner Sign-off" },
  { icon: Brain,         label: "AI Working Paper Drafting" },
  { icon: Database,      label: "PostgreSQL Secure Database" },
  { icon: Scale,         label: "Companies Act 2017 Integrated" },
  { icon: FileText,      label: "FBR-Ready Documentation" },
  { icon: BarChart3,     label: "SECP Alignment Built-in" },
];

const STATS = [
  { value: "ISA 200–720", label: "Standards Covered" },
  { value: "ISQM-1", label: "Quality Framework" },
  { value: "SECP + FBR", label: "Local Compliance" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [showFirmPassword, setShowFirmPassword] = useState(false);
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginType, setLoginType] = useState<"firm" | "portal">("firm");
  const isSuperAdmin = isSuperAdminAccess();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const portalForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const result = await login(data.email, data.password);
      toast({ title: "Welcome back", description: "You have been successfully logged in." });
      const userRole = (result as any)?.role?.toUpperCase();
      if (userRole === "SUPER_ADMIN") setLocation("/platform");
      else if (userRole === "FIRM_ADMIN") setLocation("/firm-admin");
      else setLocation("/");
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
        toast({ title: "Welcome to Client Portal", description: "You have been successfully logged in." });
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

  const PasswordField = ({ formInstance, prefix = "", showPw, setShowPw }: { formInstance: any; prefix?: string; showPw: boolean; setShowPw: (v: boolean) => void }) => (
    <FormField
      control={formInstance.control}
      name="password"
      render={({ field }: any) => (
        <FormItem>
          <FormLabel className="text-xs font-medium">Password</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="pr-10"
                {...field}
                data-testid={`${prefix}input-password`}
              />
              <span
                role="button"
                tabIndex={0}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground cursor-pointer opacity-70 hover:opacity-100 no-default-hover-elevate"
                onClick={() => setShowPw(!showPw)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowPw(!showPw); }}}
                data-testid={`${prefix}button-toggle-password`}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  if (isSuperAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute top-3 right-3 z-50">
          <ThemeToggle />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M20 18v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="relative z-10 w-full max-w-[420px] px-6">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/90 shadow-lg shadow-red-900/30 border border-red-500/30">
                <Shield className="h-7 w-7 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Platform Administration</h1>
            <p className="text-sm text-slate-400 mt-1.5">AuditWise SuperAdmin Console</p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 mt-3">
              <Lock className="h-3 w-3 text-red-400" />
              <span className="text-[11px] font-medium text-red-300">Restricted Access</span>
            </div>
          </div>

          <Card className="border-slate-700/60 bg-slate-800/50 backdrop-blur-sm shadow-2xl">
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="superadmin-login-form">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-slate-300">Admin Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="aqeelalam2010@gmail.com"
                            autoComplete="email"
                            className="bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500"
                            {...field}
                            data-testid="superadmin-input-email"
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
                        <FormLabel className="text-xs font-medium text-slate-300">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showFirmPassword ? "text" : "password"}
                              placeholder="Enter admin password"
                              autoComplete="current-password"
                              className="pr-10 bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500"
                              {...field}
                              data-testid="superadmin-input-password"
                            />
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={showFirmPassword ? "Hide password" : "Show password"}
                              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-md text-slate-400 cursor-pointer opacity-70 hover:opacity-100 no-default-hover-elevate"
                              onClick={() => setShowFirmPassword(!showFirmPassword)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowFirmPassword(!showFirmPassword); }}}
                              data-testid="superadmin-toggle-password"
                            >
                              {showFirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full text-sm font-semibold gap-2 bg-red-600 hover:bg-red-700 text-white"
                    disabled={isSubmitting || isLoading}
                    data-testid="superadmin-button-login"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        Access Platform Console
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <p className="mt-6 text-[10px] text-slate-600 text-center">
            IP-Restricted Access Point &middot; All attempts are logged
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <div className="absolute top-3 right-3 z-50">
        <ThemeToggle />
      </div>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative overflow-hidden">
        {/* Multi-layer gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d2a6b] via-[#0f3485] to-[#0a1f55]" />
        {/* Radial glow top-right */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        {/* Radial glow bottom-left */}
        <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M20 18v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative z-10 flex flex-col w-full px-10 xl:px-14 py-8">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">AuditWise</h1>
              <p className="text-[11px] text-white/45 font-medium tracking-wide uppercase">Statutory Audit Management</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="flex-1 flex flex-col justify-center max-w-xl mt-8">

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/25 mb-6 w-fit">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-[11px] font-semibold text-amber-200 tracking-wide">AI-Powered Audit Intelligence · Pakistan's #1 Platform</span>
            </div>

            {/* Headline */}
            <h2 className="text-3xl xl:text-[2.4rem] font-extrabold text-white leading-[1.15] mb-3 tracking-tight">
              The Complete Platform for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-blue-200">
                Statutory Audit
              </span>{" "}
              Excellence
            </h2>
            <p className="text-[13px] xl:text-sm text-white/55 leading-relaxed mb-7 max-w-md">
              Built ground-up for Pakistani audit firms — full ISA 200–720 coverage, ISQM-1 quality controls, and deep local regulatory integration in one platform.
            </p>

            {/* Stats bar */}
            <div className="flex items-center gap-0 mb-7 rounded-xl overflow-hidden border border-white/10">
              {STATS.map((s, i) => (
                <div
                  key={i}
                  className={`flex-1 px-4 py-3 text-center ${i < STATS.length - 1 ? "border-r border-white/10" : ""} bg-white/[0.04]`}
                >
                  <div className="text-sm xl:text-base font-extrabold text-white leading-tight">{s.value}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 font-medium">{s.label}</div>
                </div>
              ))}
            </div>

            {/* 10 Features — 2 columns */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 group">
                  <div className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 border border-emerald-400/20">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-[12px] xl:text-[12.5px] text-white/75 font-medium leading-snug">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer trust strip */}
          <div className="flex items-center justify-between pt-5 border-t border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {["AK", "FZ", "MR", "SA"].map((initials, i) => (
                  <div
                    key={i}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0f3485] text-[9px] font-bold text-white bg-white/15 shadow"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-white/75">Trusted by audit professionals</p>
                <p className="text-[10px] text-white/35">ISA 230 / ISQM-1 Compliant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {["SECP", "FBR", "ICAP"].map((tag) => (
                <span key={tag} className="text-[9px] font-bold px-2 py-0.5 rounded border border-white/15 text-white/40 tracking-wider bg-white/[0.04]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel (login form) ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* Mobile-only header */}
          <div className="lg:hidden text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <Shield className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight">AuditWise</h1>
            <p className="text-xs text-muted-foreground mt-1">Statutory Audit Management</p>
          </div>

          <div className="mb-5 hidden lg:block">
            <h2 className="text-xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to continue to your audit workspace</p>
          </div>

          <Card className="border-border/60 shadow-md">
            <CardContent className="p-5">
              <Tabs defaultValue="firm" onValueChange={(v) => setLoginType(v as "firm" | "portal")}>
                <TabsList className="grid w-full grid-cols-2 mb-5 h-10">
                  <TabsTrigger value="firm" className="flex items-center gap-1.5 text-sm" data-testid="tab-firm-login">
                    <Building2 className="h-3.5 w-3.5" />
                    Firm Login
                  </TabsTrigger>
                  <TabsTrigger value="portal" className="flex items-center gap-1.5 text-sm" data-testid="tab-client-portal">
                    <Users className="h-3.5 w-3.5" />
                    Client Portal
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="firm">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                {...field}
                                data-testid="input-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <PasswordField formInstance={form} showPw={showFirmPassword} setShowPw={setShowFirmPassword} />

                      <Button
                        type="submit"
                        className="w-full text-sm font-semibold gap-2"
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

                  <div className="mt-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      New to AuditWise?{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="text-xs font-medium p-0 h-auto"
                        onClick={() => setLocation("/pricing")}
                        data-testid="link-start-trial"
                      >
                        Start your 30-day free trial <ArrowRight className="h-3 w-3 ml-0.5 inline" />
                      </Button>
                    </p>
                  </div>

                  {import.meta.env.DEV && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/60" data-testid="dev-credentials">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        <p className="text-[11px] font-semibold text-foreground">Demo Credentials</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Test@123</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        {[
                          { role: "Admin", email: "admin" },
                          { role: "Partner", email: "partner" },
                          { role: "Manager", email: "manager" },
                          { role: "Team Lead", email: "teamlead" },
                          { role: "Senior", email: "senior" },
                          { role: "Staff", email: "staff" },
                        ].map((cred) => (
                          <button
                            key={cred.email}
                            type="button"
                            className="flex items-center gap-1 py-0.5 rounded hover:bg-muted transition-colors text-left cursor-pointer"
                            onClick={() => {
                              form.setValue("email", `${cred.email}@auditwise.pk`);
                              form.setValue("password", "Test@123");
                            }}
                            data-testid={`quick-login-${cred.role.toLowerCase().replace(" ", "")}`}
                          >
                            <span className="text-muted-foreground">{cred.role}:</span>
                            <span className="font-mono text-foreground/70">{cred.email}</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <button
                          type="button"
                          className="flex items-center gap-1 py-0.5 rounded hover:bg-muted transition-colors text-left cursor-pointer text-[11px] w-full"
                          onClick={() => {
                            form.setValue("email", "aqeelalam2010@gmail.com");
                            form.setValue("password", "Aqeel@123$");
                          }}
                          data-testid="quick-login-superadmin"
                        >
                          <span className="text-amber-600 font-semibold">Super Admin:</span>
                          <span className="font-mono text-foreground/70">aqeelalam2010@gmail.com</span>
                        </button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="portal">
                  <Form {...portalForm}>
                    <form onSubmit={portalForm.handleSubmit(onPortalSubmit)} className="space-y-4">
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
                                {...field}
                                data-testid="portal-input-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <PasswordField formInstance={portalForm} prefix="portal-" showPw={showPortalPassword} setShowPw={setShowPortalPassword} />

                      <Button
                        type="submit"
                        className="w-full text-sm font-semibold gap-2"
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
                    <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/60" data-testid="dev-portal-credentials">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        <p className="text-[11px] font-semibold text-foreground">Demo Client Login</p>
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-[11px] rounded hover:bg-muted transition-colors text-left cursor-pointer py-0.5"
                        onClick={() => {
                          portalForm.setValue("email", "client@company.pk");
                          portalForm.setValue("password", "Client@123");
                        }}
                        data-testid="quick-login-client"
                      >
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-mono text-foreground/70">client@company.pk</span>
                        <span className="text-muted-foreground/40 mx-0.5">|</span>
                        <span className="text-muted-foreground">Pass:</span>
                        <span className="font-mono text-foreground/70">Client@123</span>
                      </button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="mt-4 text-[10px] text-muted-foreground/40 text-center">
            ISA / ISQM-1 Compliant Audit Platform
          </p>
        </div>
      </div>
    </div>
  );
}
