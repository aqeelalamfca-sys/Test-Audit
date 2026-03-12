import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Code, Database, Server, Settings } from "lucide-react";

export default function DevDashboard() {
  return (
    <div className="page-container">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Code className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Developer Dashboard</h1>
            <p className="text-muted-foreground">System diagnostics and tools</p>
          </div>
        </div>
        <Badge variant="outline">Development Mode</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Server Status</p>
                <p className="font-medium text-green-600">Running</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Database</p>
                <p className="font-medium text-blue-600">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Environment</p>
                <p className="font-medium">Development</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
          <CardDescription>Available API routes for testing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <p>GET /api/auth/me - Current user info</p>
            <p>POST /api/auth/login - User login</p>
            <p>GET /api/clients - List clients</p>
            <p>GET /api/engagements - List engagements</p>
            <p>GET /api/users - List users</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
