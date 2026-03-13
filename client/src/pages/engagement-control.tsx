import { useParams, useLocation, Link } from "wouter";
import { AgentsLoadingInline } from "@/components/agents-loading";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  RotateCcw,
  Loader2,
  Calendar,
  User,
  Clock,
  MapPin,
  Building2,
  Edit,
  Save,
  X,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useWorkspace, useEngagement } from "@/lib/workspace-context";
import { format, formatDistanceToNow } from "date-fns";

interface EngagementControl {
  id: string;
  engagementCode: string;
  engagementType: string;
  status: string;
  currentPhase: string;
  fiscalYearEnd?: string;
  periodStart?: string;
  periodEnd?: string;
  reportingFramework?: string;
  startedAt?: string;
  startedBy?: { id: string; fullName: string };
  lastRoute?: string;
  lastActivityAt?: string;
  lastActivityBy?: { id: string; fullName: string };
  client?: {
    id: string;
    name: string;
    tradingName?: string;
    ntn?: string;
    secpNo?: string;
    address?: string;
    email?: string;
    phone?: string;
    ceoName?: string;
    cfoName?: string;
  };
  team?: Array<{
    role: string;
    user?: { id: string; fullName: string; role: string };
  }>;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  route?: string;
  details?: string;
  performedAt: string;
  performedBy?: { id: string; fullName: string };
}

const PHASE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  PRE_PLANNING: "Pre-Planning",
  PLANNING: "Planning",
  EXECUTION: "Execution",
  FINALIZATION: "Finalization",
  REPORTING: "Reporting",
  EQCR: "Quality Review",
  INSPECTION: "Inspection",
};

const SLUG_LABELS: Record<string, string> = {
  "acceptance": "Acceptance & Continuance",
  "independence": "Independence / Ethics",
  "tb-gl-upload": "TB / GL Upload",
  "validation": "Validation & Parsing",
  "coa-mapping": "CoA / FS Mapping",
  "pre-planning": "Pre-Planning",
  "materiality": "Materiality",
  "risk-assessment": "Risk Assessment",
  "planning-strategy": "Planning Strategy",
  "procedures-sampling": "Procedures & Sampling",
  "execution-testing": "Execution & Testing",
  "evidence-linking": "Evidence Linking",
  "observations": "Observations",
  "adjustments": "Adjustments",
  "finalization": "Finalization",
  "opinion-reports": "Opinion & Reports",
  "eqcr": "Quality Review",
  "inspection": "Inspection",
  "requisition": "Data Intake",
  "planning": "Planning",
  "execution": "Execution",
  "evidence": "Evidence Vault",
  "fs-heads": "FS Heads",
  "outputs": "Outputs",
  "deliverables": "Deliverables",
  "ethics": "Ethics & Independence",
};

function getRouteLabel(route?: string): string {
  if (!route) return "Not started";
  const slug = route.split("/").pop() || "";
  if (SLUG_LABELS[slug]) return SLUG_LABELS[slug];
  if (slug.includes("controls")) return "Internal Controls";
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Unknown";
}

export default function EngagementControl() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement: contextEngagement, 
    client,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { switchToClient, switchToEngagement } = useWorkspace();

  const [editClientOpen, setEditClientOpen] = useState(false);
  const [clientFormData, setClientFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resuming, setResuming] = useState(false);

  const canEditClient = ["FIRM_ADMIN", "PARTNER", "MANAGER"].includes(user?.role || "");

  const { data: engagement, isLoading, error } = useQuery<EngagementControl>({
    queryKey: [`/api/engagements/${engagementId}/control`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}/control`);
      if (!res.ok) {
        const fallbackRes = await fetchWithAuth(`/api/engagements/${engagementId}`);
        if (!fallbackRes.ok) throw new Error("Failed to fetch engagement");
        return fallbackRes.json();
      }
      return res.json();
    },
    retry: 1,
  });

  const { data: activityLog = [] } = useQuery<AuditLogEntry[]>({
    queryKey: [`/api/engagements/${engagementId}/activity`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}/activity?limit=10`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!engagementId,
  });

  useEffect(() => {
    if (engagement?.client) {
      setClientFormData({
        name: engagement.client.name || "",
        tradingName: engagement.client.tradingName || "",
        ntn: engagement.client.ntn || "",
        secpNo: engagement.client.secpNo || "",
        address: engagement.client.address || "",
        email: engagement.client.email || "",
        phone: engagement.client.phone || "",
        ceoName: engagement.client.ceoName || "",
        cfoName: engagement.client.cfoName || "",
      });
    }
  }, [engagement]);

  const isStarted = !!engagement?.startedAt;

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        toast({ title: "Engagement Started", description: "Redirecting to workspace..." });
        
        if (engagement?.client?.id) {
          switchToClient(engagement.client.id);
        }
        switchToEngagement(engagementId!, false);
        
        const targetRoute = data.resumeRoute || `/workspace/${engagementId}/pre-planning`;
        navigate(targetRoute);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to start engagement", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to start engagement", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}/resume`);

      if (res.ok) {
        const data = await res.json();
        toast({ title: "Resuming...", description: "Returning to your last location" });
        
        if (data.clientId) {
          switchToClient(data.clientId);
        } else if (engagement?.client?.id) {
          switchToClient(engagement.client.id);
        }
        switchToEngagement(engagementId!, false);
        
        const targetRoute = data.resumeRoute || engagement?.lastRoute || `/workspace/${engagementId}/pre-planning`;
        navigate(targetRoute);
      } else {
        const fallbackRoute = engagement?.lastRoute || `/workspace/${engagementId}/pre-planning`;
        if (engagement?.client?.id) {
          switchToClient(engagement.client.id);
        }
        switchToEngagement(engagementId!, false);
        navigate(fallbackRoute);
      }
    } catch (error) {
      const fallbackRoute = engagement?.lastRoute || `/workspace/${engagementId}/pre-planning`;
      if (engagement?.client?.id) {
        switchToClient(engagement.client.id);
      }
      switchToEngagement(engagementId!, false);
      navigate(fallbackRoute);
    } finally {
      setResuming(false);
    }
  };

  const handleSaveClient = async () => {
    if (!engagement?.client?.id) return;
    
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/clients/${engagement.client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientFormData),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Client updated successfully" });
        queryClient.invalidateQueries({ queryKey: [`/api/engagements/${engagementId}/control`] });
        setEditClientOpen(false);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to update client", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update client", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getPartner = () => {
    const partner = engagement?.team?.find(t => t.role === "Partner" || t.role === "Engagement Partner");
    return partner?.user?.fullName || "-";
  };

  const getManager = () => {
    const manager = engagement?.team?.find(t => t.role === "Manager" || t.role === "Engagement Manager");
    return manager?.user?.fullName || "-";
  };

  const getStatusVariant = (status?: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
      case "IN_PROGRESS":
        return "default";
      case "COMPLETED":
        return "secondary";
      case "DRAFT":
        return "outline";
      case "ARCHIVED":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return <AgentsLoadingInline showDelay={1000} />;
  }

  if (error || !engagement) {
    return (
      <div className="px-4 py-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Engagement Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested engagement could not be loaded.</p>
            <Link href="/engagements">
              <Button>Back to Engagements</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-semibold tracking-tight">{engagement.client?.name || "Client"}</h1>
            <Badge variant={getStatusVariant(engagement.status)}>
              {engagement.status?.replace("_", " ") || "Draft"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-mono">{engagement.engagementCode}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>{engagement.engagementType?.replace("_", " ")}</span>
            {engagement.fiscalYearEnd && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>FY End: {format(new Date(engagement.fiscalYearEnd), "MMM dd, yyyy")}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isStarted ? (
            <Button size="lg" onClick={handleStart} disabled={starting} className="gap-2">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start Engagement
            </Button>
          ) : (
            <Button size="lg" onClick={handleResume} disabled={resuming} className="gap-2">
              {resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Resume
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Engagement Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{PHASE_LABELS[engagement.currentPhase] || engagement.currentPhase || "Not Started"}</div>
            <p className="text-xs text-muted-foreground">Current Phase</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            {engagement.startedAt ? (
              <>
                <div className="text-lg font-semibold">{format(new Date(engagement.startedAt), "MMM dd, yyyy")}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {engagement.startedBy?.fullName || "Unknown"}
                </p>
              </>
            ) : (
              <div className="text-lg text-muted-foreground">Not yet started</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {engagement.lastActivityAt ? (
              <>
                <div className="text-lg font-semibold">{formatDistanceToNow(new Date(engagement.lastActivityAt), { addSuffix: true })}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {engagement.lastActivityBy?.fullName || "Unknown"}
                </p>
              </>
            ) : (
              <div className="text-lg text-muted-foreground">No activity yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Last Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{getRouteLabel(engagement.lastRoute)}</div>
            <p className="text-xs text-muted-foreground">Resume point</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Client Details
              </CardTitle>
              <CardDescription>Client master information</CardDescription>
            </div>
            {canEditClient && (
              <Button variant="outline" size="sm" onClick={() => setEditClientOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Legal Name</p>
                <p className="font-medium">{engagement.client?.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trading Name</p>
                <p className="font-medium">{engagement.client?.tradingName || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NTN</p>
                <p className="font-medium">{engagement.client?.ntn || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SECP No.</p>
                <p className="font-medium">{engagement.client?.secpNo || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{engagement.client?.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{engagement.client?.phone || "-"}</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Partner</p>
                <p className="font-medium">{getPartner()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Manager</p>
                <p className="font-medium">{getManager()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Last 10 actions on this engagement</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLog.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No activity recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {activityLog.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.performedBy?.fullName || "System"} • {format(new Date(entry.performedAt), "MMM dd, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Client Details</DialogTitle>
            <DialogDescription>Update the client master information for this engagement.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Legal Name *</Label>
              <Input
                id="name"
                value={clientFormData.name || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradingName">Trading Name</Label>
              <Input
                id="tradingName"
                value={clientFormData.tradingName || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, tradingName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ntn">NTN</Label>
              <Input
                id="ntn"
                value={clientFormData.ntn || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, ntn: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secpNo">SECP No.</Label>
              <Input
                id="secpNo"
                value={clientFormData.secpNo || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, secpNo: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={clientFormData.address || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={clientFormData.email || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={clientFormData.phone || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ceoName">CEO Name</Label>
              <Input
                id="ceoName"
                value={clientFormData.ceoName || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, ceoName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfoName">CFO Name</Label>
              <Input
                id="cfoName"
                value={clientFormData.cfoName || ""}
                onChange={(e) => setClientFormData({ ...clientFormData, cfoName: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClientOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveClient} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
