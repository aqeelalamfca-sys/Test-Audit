import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, BarChart3, Shield, Bot, Bell, FileText, TrendingUp, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function PlatformDashboard() {
  const [, setLocation] = useLocation();

  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ["/api/platform/analytics"],
  });

  const stats = [
    {
      label: "Total Firms", value: analytics?.totalFirms || 0,
      icon: Building2, color: "text-primary", bg: "bg-primary/10",
      href: "/platform/firms", description: "View all registered firms",
    },
    {
      label: "Active Firms", value: analytics?.activeFirms || 0,
      icon: Shield, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950",
      href: "/platform/firms?status=ACTIVE", description: "Firms with active subscriptions",
    },
    {
      label: "Trial Firms", value: analytics?.trialFirms || 0,
      icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950",
      href: "/platform/firms?status=TRIAL", description: "Firms in trial period",
    },
    {
      label: "Suspended", value: analytics?.suspendedFirms || 0,
      icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950",
      href: "/platform/firms?status=SUSPENDED", description: "Firms currently suspended",
    },
    {
      label: "Total Users", value: analytics?.totalUsers || 0,
      icon: Users, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950",
      href: "/platform/firms", description: "Active users across all firms",
    },
    {
      label: "Engagements", value: analytics?.totalEngagements || 0,
      icon: FileText, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950",
      href: "/platform/firms", description: "Total engagements created",
    },
    {
      label: "AI Usage", value: analytics?.aiUsageThisMonth || 0,
      icon: Bot, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950",
      href: "/platform/ai-config", description: "AI requests this month",
    },
  ];

  const navItems = [
    { label: "Firm Management", href: "/platform/firms", icon: Building2, description: "Create, manage, and monitor all tenant firms", accent: "text-primary" },
    { label: "Plan Management", href: "/platform/plans", icon: BarChart3, description: "Configure subscription plans and pricing", accent: "text-blue-600" },
    { label: "Notifications", href: "/platform/notifications", icon: Bell, description: "Send global or firm-specific alerts", accent: "text-amber-600" },
    { label: "Audit Logs", href: "/platform/audit-logs", icon: FileText, description: "View all platform activity logs", accent: "text-green-600" },
    { label: "AI Configuration", href: "/platform/ai-config", icon: Bot, description: "Manage default AI API keys and settings", accent: "text-purple-600" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="platform-dashboard">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform Administration</h1>
          <p className="text-muted-foreground">Super Admin Dashboard — Manage all firms, plans, and platform settings</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] group"
            onClick={() => setLocation(stat.href)}
            data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <CardContent className="p-4 text-center">
              <div className={`inline-flex items-center justify-center h-9 w-9 rounded-lg ${stat.bg} mb-2`}>
                <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold" data-testid={`text-stat-value-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
                {isLoading ? "..." : stat.value}
              </div>
              <div className="text-[11px] text-muted-foreground leading-tight">{stat.label}</div>
              <div className="text-[9px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                View <ChevronRight className="h-2.5 w-2.5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group" data-testid={`link-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <item.icon className={`h-5 w-5 ${item.accent}`} />
                  {item.label}
                  <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
