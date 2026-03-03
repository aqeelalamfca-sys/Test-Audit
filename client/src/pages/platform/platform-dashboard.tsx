import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, BarChart3, Shield, Bot, Bell, FileText } from "lucide-react";
import { Link } from "wouter";

export default function PlatformDashboard() {
  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ["/api/platform/analytics"],
  });

  const stats = [
    { label: "Total Firms", value: analytics?.totalFirms || 0, icon: Building2, color: "text-red-600" },
    { label: "Active Firms", value: analytics?.activeFirms || 0, icon: Shield, color: "text-green-600" },
    { label: "Trial Firms", value: analytics?.trialFirms || 0, icon: BarChart3, color: "text-amber-600" },
    { label: "Suspended Firms", value: analytics?.suspendedFirms || 0, icon: Building2, color: "text-red-400" },
    { label: "Total Users", value: analytics?.totalUsers || 0, icon: Users, color: "text-purple-600" },
    { label: "Total Engagements", value: analytics?.totalEngagements || 0, icon: FileText, color: "text-indigo-600" },
    { label: "AI Usage (Month)", value: analytics?.aiUsageThisMonth || 0, icon: Bot, color: "text-cyan-600" },
  ];

  const navItems = [
    { label: "Firm Management", href: "/platform/firms", icon: Building2, description: "Create, manage, and monitor all tenant firms" },
    { label: "Plan Management", href: "/platform/plans", icon: BarChart3, description: "Configure subscription plans and pricing" },
    { label: "Notifications", href: "/platform/notifications", icon: Bell, description: "Send global or firm-specific alerts" },
    { label: "Audit Logs", href: "/platform/audit-logs", icon: FileText, description: "View all platform activity logs" },
    { label: "AI Configuration", href: "/platform/ai-config", icon: Bot, description: "Manage default AI API keys and settings" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="platform-dashboard">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Platform Administration</h1>
          <p className="text-muted-foreground">Super Admin Dashboard - Manage all firms, plans, and platform settings</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
            <CardContent className="p-4 text-center">
              <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
              <div className="text-2xl font-bold">{isLoading ? "..." : stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="cursor-pointer hover:border-red-400 transition-colors" data-testid={`link-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <item.icon className="h-5 w-5 text-red-600" />
                  {item.label}
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
