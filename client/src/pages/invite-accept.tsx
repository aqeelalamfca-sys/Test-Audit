import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteInfo {
  email: string;
  role: string;
  firm: { id: string; name: string; logoUrl?: string | null };
  expiresAt: string;
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function validateInvite() {
      try {
        const res = await fetch(`/api/auth/invite/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Invalid invite link");
          return;
        }
        const data = await res.json();
        setInviteInfo(data);
        setUsername(data.email.split("@")[0] + "_admin");
      } catch {
        setError("Failed to validate invite link");
      } finally {
        setLoading(false);
      }
    }
    validateInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (password.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to accept invite", variant: "destructive" });
        return;
      }

      const data = await res.json();

      localStorage.setItem("auditwise_token", data.token);
      localStorage.setItem("auditwise_refresh_token", data.refreshToken);

      setSuccess(true);
      toast({ title: "Account Created", description: "Your account has been set up successfully" });

      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40" data-testid="invite-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md" data-testid="invite-error">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Invalid Invite</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => setLocation("/login")} data-testid="link-login">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md" data-testid="invite-success">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <h2 className="text-xl font-semibold">Account Created!</h2>
            <p className="text-muted-foreground">Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md" data-testid="invite-form">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {inviteInfo?.firm.logoUrl ? (
              <img src={inviteInfo.firm.logoUrl} alt="" className="h-12 object-contain" />
            ) : (
              <Building2 className="w-12 h-12 text-primary" />
            )}
          </div>
          <CardTitle>Join {inviteInfo?.firm.name}</CardTitle>
          <CardDescription>
            You've been invited as <strong>{inviteInfo?.role?.replace(/_/g, " ")}</strong>.
            Set up your account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={inviteInfo?.email || ""} disabled data-testid="input-email" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                minLength={2}
                data-testid="input-fullname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                minLength={3}
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                data-testid="input-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                data-testid="input-confirm-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting} data-testid="button-accept-invite">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
