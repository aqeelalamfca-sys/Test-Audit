import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "wouter";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { SignOffBar } from "@/components/sign-off-bar";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";
import { useEngagement } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Scale,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Save,
  Loader2,
  Bot,
  X,
  FileText,
  Users,
  Lock,
  UserCheck,
  Handshake,
  Ban,
  Eye,
  ClipboardCheck,
  Plus,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface DeclarationRow {
  id: string;
  memberName: string;
  role: string;
  userId: string;
  status: "Pending" | "Confirmed" | "Partner Approved";
  declarationDate: string;
  hasFinancialInterest: boolean;
  hasBusinessRelationship: boolean;
  hasFamilyRelationship: boolean;
  partnerApproved: boolean;
}

interface ThreatRow {
  id: string;
  category: string;
  description: string;
  severity: string;
  status: string;
  safeguards: { id: string; description: string; safeguardType: string }[];
}

interface ConflictRow {
  id: string;
  conflictType: string;
  description: string;
  status: string;
  safeguardsApplied: string;
}

interface NonAuditServiceRow {
  id: string;
  serviceName: string;
  serviceType: string;
  prohibitedService: boolean;
  threatCategory: string;
  safeguardsApplied: string;
  approvedById: string | null;
}

interface EthicsFormData {
  restrictedRelationshipsChecked: boolean;
  restrictedRelationshipsNotes: string;
  ethicsComplianceConfirmed: boolean;
  ethicsComplianceNotes: string;
  conclusionNarrative: string;
  overallAssessment: string;
}

const DEFAULT_FORM: EthicsFormData = {
  restrictedRelationshipsChecked: false,
  restrictedRelationshipsNotes: "",
  ethicsComplianceConfirmed: false,
  ethicsComplianceNotes: "",
  conclusionNarrative: "",
  overallAssessment: "",
};

const TABS = [
  { id: "declarations", label: "Independence Confirmations", icon: UserCheck },
  { id: "conflicts", label: "Conflicts of Interest", icon: Handshake },
  { id: "non-audit", label: "Non-Audit Services", icon: Ban },
  { id: "safeguards", label: "Safeguards", icon: Shield },
  { id: "ethics-compliance", label: "Ethics Compliance", icon: ClipboardCheck },
  { id: "restricted", label: "Restricted Relationships", icon: Eye },
  { id: "staff-declarations", label: "Partner / Staff Declarations", icon: Users },
  { id: "conclusion", label: "Ethics Conclusion", icon: CheckCircle2 },
];

export default function EthicsIndependence() {
  const params = useParams<{ engagementId: string }>();
  const { engagementId: contextEngagementId, engagement, client } = useEngagement();
  const { user } = useAuth();
  const engagementId = params.engagementId || contextEngagementId || "";
  const { toast } = useToast();
  const roleGuard = usePhaseRoleGuard("independence", "PRE_PLANNING");

  const [form, setForm] = useState<EthicsFormData>(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState("declarations");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [declarations, setDeclarations] = useState<DeclarationRow[]>([]);
  const [threats, setThreats] = useState<ThreatRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [nonAuditServices, setNonAuditServices] = useState<NonAuditServiceRow[]>([]);
  const [ethicsStatus, setEthicsStatus] = useState<any>(null);

  const [isApproved, setIsApproved] = useState(false);
  const [approvalData, setApprovalData] = useState<{ lockedDate?: string; lockedById?: string } | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approving, setApproving] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");

  const isPartner = user?.role === "PARTNER" || user?.role === "FIRM_ADMIN";
  const hasLoadedRef = useRef(false);

  const completeness = useMemo(() => {
    let filled = 0;
    let total = 8;
    if (declarations.length > 0) filled++;
    if (ethicsStatus?.allDeclarationsComplete) filled++;
    if (conflicts.length === 0 || conflicts.every(c => c.status !== "IDENTIFIED" && c.status !== "UNDER_REVIEW")) filled++;
    if (threats.length === 0 || threats.every(t => t.status !== "IDENTIFIED" && t.status !== "UNRESOLVED")) filled++;
    if (form.ethicsComplianceConfirmed) filled++;
    if (form.restrictedRelationshipsChecked) filled++;
    if (form.conclusionNarrative.trim()) filled++;
    if (form.overallAssessment) filled++;
    return Math.round((filled / total) * 100);
  }, [declarations, threats, conflicts, ethicsStatus, form]);

  useEffect(() => {
    if (!engagementId || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadAllData();
  }, [engagementId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [declRes, threatRes, ethicsRes] = await Promise.all([
        fetchWithAuth(`/api/ethics/engagements/${engagementId}/independence-declarations`),
        fetchWithAuth(`/api/ethics/engagements/${engagementId}/threats`),
        fetchWithAuth(`/api/ethics/engagements/${engagementId}/ethics-status`),
      ]);

      if (declRes.ok) {
        const declData = await declRes.json();
        setDeclarations(
          declData.map((d: any) => ({
            id: d.id,
            memberName: d.user?.fullName || "Unknown",
            role: d.user?.role || "",
            userId: d.userId,
            status: d.partnerId ? "Partner Approved" : d.status === "CONFIRMED" ? "Confirmed" : "Pending",
            declarationDate: d.confirmedAtStartDate ? new Date(d.confirmedAtStartDate).toLocaleDateString() : "",
            hasFinancialInterest: d.hasFinancialInterest,
            hasBusinessRelationship: d.hasBusinessRelationship,
            hasFamilyRelationship: d.hasFamilyRelationship,
            partnerApproved: !!d.partnerId,
          }))
        );
      }

      if (threatRes.ok) {
        const threatData = await threatRes.json();
        setThreats(
          threatData.map((t: any) => ({
            id: t.id,
            category: t.category,
            description: t.description,
            severity: t.severity,
            status: t.status,
            safeguards: (t.safeguards || []).map((s: any) => ({
              id: s.id,
              description: s.description,
              safeguardType: s.safeguardType,
            })),
          }))
        );
      }

      if (ethicsRes.ok) {
        const statusData = await ethicsRes.json();
        setEthicsStatus(statusData);
        if (statusData.isLocked) {
          setIsApproved(true);
          setApprovalData({ lockedDate: statusData.confirmation?.lockedDate });
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load independence data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setApproving(true);
      const res = await fetchWithAuth(`/api/ethics/engagements/${engagementId}/ethics-approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: approvalNotes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      setIsApproved(true);
      setApprovalData({ lockedDate: new Date().toISOString() });
      setShowApproveDialog(false);
      toast({ title: "Success", description: "Independence & Ethics phase approved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const requestAI = async (capability: string) => {
    setAiLoading(true);
    setAiResult("");
    try {
      const ctx = {
        clientName: client?.name || "",
        engagementCode: engagement?.engagementCode || "",
        declarations,
        threats,
        conflicts,
        ethicsStatus,
        form,
      };
      setAiResult(
        capability === "ethics-warning-alerts"
          ? generateEthicsWarnings(ctx)
          : capability === "missing-declaration-summary"
          ? generateMissingDeclarations(ctx)
          : capability === "conclusion-wording"
          ? generateEthicsConclusion(ctx)
          : "AI capability not available."
      );
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingDeclarations = ethicsStatus?.pendingDeclarations || 0;
  const totalTeam = ethicsStatus?.totalTeamMembers || 0;
  const unresolvedThreats = threats.filter(t => t.status === "IDENTIFIED" || t.status === "UNRESOLVED");

  return (
    <div className="page-container space-y-4">
      <SignOffBar phase="PRE_PLANNING" section="independence" className="mb-1" />
      <AIAssistantPanel engagementId={engagementId} phaseKey="independence" className="mb-2" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Independence / Ethics</h1>
            <p className="text-sm text-muted-foreground">
              {client?.name ? `${client.name} — ` : ""}ISA 200/220, IESBA Code of Ethics
              {engagement?.engagementCode && <span className="ml-2 text-xs opacity-70">({engagement.engagementCode})</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isApproved && (
            <Badge variant="default" className="bg-green-600">
              <Lock className="h-3 w-3 mr-1" /> Approved & Locked
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAI(!showAI)}>
            <Bot className="h-4 w-4 mr-1" /> AI Assistant
          </Button>
          {isPartner && !isApproved && (
            <Button size="sm" variant="default" onClick={() => setShowApproveDialog(true)} disabled={completeness < 50}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Declarations</p>
                <p className="text-lg font-bold">{declarations.length} / {totalTeam}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Unresolved Threats</p>
                <p className="text-lg font-bold">{unresolvedThreats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Handshake className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Conflicts</p>
                <p className="text-lg font-bold">{conflicts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Completeness</p>
                <p className="text-lg font-bold">{completeness}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-2">
          <Progress value={completeness} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full h-auto">
              {TABS.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs flex flex-col gap-1 py-2">
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="declarations" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Independence Confirmations (ISA 200/220)</CardTitle>
                  <CardDescription>
                    All engagement team members must confirm their independence. {pendingDeclarations > 0 && (
                      <span className="text-amber-600 font-medium">{pendingDeclarations} member(s) pending.</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {declarations.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                      <p>No independence declarations submitted yet.</p>
                      <p className="text-xs mt-1">Team members can submit their declarations from their individual dashboard.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Financial Interest</TableHead>
                          <TableHead>Business Rel.</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {declarations.map(d => (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium">{d.memberName}</TableCell>
                            <TableCell>{d.role}</TableCell>
                            <TableCell>{d.declarationDate}</TableCell>
                            <TableCell>
                              {d.hasFinancialInterest
                                ? <Badge variant="destructive">Yes</Badge>
                                : <Badge variant="outline" className="text-green-600">No</Badge>}
                            </TableCell>
                            <TableCell>
                              {d.hasBusinessRelationship
                                ? <Badge variant="destructive">Yes</Badge>
                                : <Badge variant="outline" className="text-green-600">No</Badge>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={d.status === "Partner Approved" ? "default" : d.status === "Confirmed" ? "secondary" : "outline"}>
                                {d.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {ethicsStatus?.pendingMembers?.length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">Pending Declarations:</p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {ethicsStatus.pendingMembers.map((m: any) => (
                          <li key={m.userId}>{m.user?.fullName || m.userId}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conflicts" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Conflicts of Interest (IESBA Code 310)</CardTitle>
                  <CardDescription>Identify and manage all conflicts of interest related to this engagement</CardDescription>
                </CardHeader>
                <CardContent>
                  {conflicts.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                      <p>No conflicts of interest have been identified.</p>
                      <p className="text-xs mt-1">Conflicts can be recorded via the Ethics routes or the acceptance phase.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Safeguards</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conflicts.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.conflictType.replace(/_/g, " ")}</TableCell>
                            <TableCell className="max-w-xs truncate">{c.description}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === "ACCEPTED" ? "default" : c.status === "SAFEGUARDED" ? "secondary" : "destructive"}>
                                {c.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.safeguardsApplied || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="non-audit" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Related Non-Audit Services (IESBA Code R600)</CardTitle>
                  <CardDescription>Evaluate all non-audit services provided to the audit client</CardDescription>
                </CardHeader>
                <CardContent>
                  {nonAuditServices.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                      <p>No non-audit services have been recorded for this client.</p>
                      <p className="text-xs mt-1">Non-audit services can be recorded via the client's profile.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Prohibited</TableHead>
                          <TableHead>Threat</TableHead>
                          <TableHead>Approved</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nonAuditServices.map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.serviceName}</TableCell>
                            <TableCell>{s.serviceType}</TableCell>
                            <TableCell>
                              {s.prohibitedService
                                ? <Badge variant="destructive">Prohibited</Badge>
                                : <Badge variant="outline" className="text-green-600">Allowed</Badge>}
                            </TableCell>
                            <TableCell>{s.threatCategory ? s.threatCategory.replace(/_/g, " ") : "—"}</TableCell>
                            <TableCell>{s.approvedById ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="safeguards" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Safeguards (IESBA Code 300)</CardTitle>
                  <CardDescription>Document safeguards applied to mitigate identified threats to independence</CardDescription>
                </CardHeader>
                <CardContent>
                  {threats.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                      <p>No threats have been identified. Safeguards are documented when threats are recorded.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {threats.map(t => (
                        <div key={t.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium">{t.category.replace(/_/g, " ")}</span>
                              <Badge variant={t.severity === "HIGH" ? "destructive" : t.severity === "MEDIUM" ? "secondary" : "outline"} className="ml-2">
                                {t.severity}
                              </Badge>
                            </div>
                            <Badge variant={t.status === "ACCEPTED" || t.status === "ELIMINATED" ? "default" : t.status === "SAFEGUARDED" ? "secondary" : "destructive"}>
                              {t.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{t.description}</p>
                          {t.safeguards.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs font-medium">Applied Safeguards:</p>
                              {t.safeguards.map(s => (
                                <div key={s.id} className="text-xs bg-muted p-2 rounded">
                                  <span className="font-medium">{s.safeguardType}:</span> {s.description}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ethics-compliance" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ethics Compliance (ICAP/IESBA Code)</CardTitle>
                  <CardDescription>Confirm compliance with applicable ethics requirements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Ethics Compliance Confirmed</Label>
                    <Select
                      value={form.ethicsComplianceConfirmed ? "yes" : "no"}
                      onValueChange={v => setForm(prev => ({ ...prev, ethicsComplianceConfirmed: v === "yes" }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes — All team members comply with ICAP/IESBA Code</SelectItem>
                        <SelectItem value="no">No — Issues identified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ethics Compliance Notes</Label>
                    <Textarea
                      value={form.ethicsComplianceNotes}
                      onChange={e => setForm(prev => ({ ...prev, ethicsComplianceNotes: e.target.value }))}
                      placeholder="Document compliance assessment including integrity, objectivity, professional competence, confidentiality, and professional behavior..."
                      rows={4}
                    />
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Key Ethics Requirements:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Integrity (IESBA Code 110)</li>
                      <li>Objectivity (IESBA Code 120)</li>
                      <li>Professional Competence and Due Care (IESBA Code 130)</li>
                      <li>Confidentiality (IESBA Code 140)</li>
                      <li>Professional Behavior (IESBA Code 150)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="restricted" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Restricted Relationships (IESBA Code 510-524)</CardTitle>
                  <CardDescription>Check for any restricted relationships that may impair independence</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Restricted Relationships Checked</Label>
                    <Select
                      value={form.restrictedRelationshipsChecked ? "yes" : "no"}
                      onValueChange={v => setForm(prev => ({ ...prev, restrictedRelationshipsChecked: v === "yes" }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes — All restricted relationship checks completed</SelectItem>
                        <SelectItem value="no">No — Checks pending or issues identified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Restricted Relationships Assessment</Label>
                    <Textarea
                      value={form.restrictedRelationshipsNotes}
                      onChange={e => setForm(prev => ({ ...prev, restrictedRelationshipsNotes: e.target.value }))}
                      placeholder="Document: (1) Financial interests in the client, (2) Loans/guarantees with the client, (3) Business relationships, (4) Family/personal relationships, (5) Employment relationships with the client..."
                      rows={4}
                    />
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Restricted Relationship Categories:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Direct/indirect financial interests (IESBA 510)</li>
                      <li>Loans and guarantees (IESBA 511)</li>
                      <li>Close business relationships (IESBA 520)</li>
                      <li>Family and personal relationships (IESBA 521)</li>
                      <li>Recent service with audit client (IESBA 522)</li>
                      <li>Serving as director/officer (IESBA 523)</li>
                      <li>Employment with audit client (IESBA 524)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="staff-declarations" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Partner / Staff Declarations (ISA 220)</CardTitle>
                  <CardDescription>Summary of all declarations submitted by engagement team members</CardDescription>
                </CardHeader>
                <CardContent>
                  {declarations.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                      <p>No declarations have been submitted yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {declarations.map(d => (
                        <div key={d.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{d.memberName}</p>
                              <p className="text-xs text-muted-foreground">{d.role} — Declared: {d.declarationDate || "N/A"}</p>
                            </div>
                            <Badge variant={d.partnerApproved ? "default" : d.status === "Confirmed" ? "secondary" : "outline"}>
                              {d.status}
                            </Badge>
                          </div>
                          <div className="mt-2 flex gap-3 text-xs">
                            <span>Financial: {d.hasFinancialInterest ? "⚠ Yes" : "✓ No"}</span>
                            <span>Business: {d.hasBusinessRelationship ? "⚠ Yes" : "✓ No"}</span>
                            <span>Family: {d.hasFamilyRelationship ? "⚠ Yes" : "✓ No"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conclusion" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ethics Conclusion (ISA 220.11)</CardTitle>
                  <CardDescription>Final ethics and independence conclusion requiring partner approval</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Overall Assessment</Label>
                    <Select value={form.overallAssessment} onValueChange={v => setForm(prev => ({ ...prev, overallAssessment: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select assessment" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SATISFACTORY">Satisfactory — No independence impairments</SelectItem>
                        <SelectItem value="SATISFACTORY_WITH_SAFEGUARDS">Satisfactory with safeguards — Threats mitigated</SelectItem>
                        <SelectItem value="UNSATISFACTORY">Unsatisfactory — Independence impaired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Conclusion Narrative</Label>
                    <Textarea
                      value={form.conclusionNarrative}
                      onChange={e => setForm(prev => ({ ...prev, conclusionNarrative: e.target.value }))}
                      placeholder="Document the overall ethics and independence conclusion covering all team members, conflicts, threats, safeguards, and compliance..."
                      rows={5}
                    />
                  </div>

                  {isApproved && approvalData && (
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-700 dark:text-green-400">Partner Approved & Locked</span>
                      </div>
                      {approvalData.lockedDate && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Locked on {new Date(approvalData.lockedDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}

                  {!isApproved && isPartner && (
                    <Button onClick={() => setShowApproveDialog(true)} disabled={completeness < 50} className="w-full">
                      <Lock className="h-4 w-4 mr-2" /> Approve & Lock Ethics Phase
                    </Button>
                  )}

                  {!isApproved && !isPartner && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <span className="text-sm text-amber-700 dark:text-amber-400">Partner approval required to complete this phase</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {showAI && (
          <div className="w-80 shrink-0">
            <Card className="sticky top-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" /> AI Assistant</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowAI(false)}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => requestAI("ethics-warning-alerts")} disabled={aiLoading}>
                  <AlertTriangle className="h-3 w-3 mr-2" /> Ethics Warning Alerts
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => requestAI("missing-declaration-summary")} disabled={aiLoading}>
                  <Users className="h-3 w-3 mr-2" /> Missing Declarations Summary
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => requestAI("conclusion-wording")} disabled={aiLoading}>
                  <FileText className="h-3 w-3 mr-2" /> Suggest Conclusion Wording
                </Button>
                {aiLoading && <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                {aiResult && (
                  <div className="mt-3 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {aiResult}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partner Approval — Independence & Ethics</DialogTitle>
            <DialogDescription>
              Approving will lock this phase. All team members must have submitted declarations and all threats must be resolved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <p>Declarations: {declarations.length} / {totalTeam} submitted</p>
              <p>Pending: {pendingDeclarations}</p>
              <p>Unresolved threats: {unresolvedThreats.length}</p>
            </div>
            <div>
              <Label>Approval Notes</Label>
              <Textarea
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                placeholder="Document any notes for the approval..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
              Approve & Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function generateEthicsWarnings(ctx: any): string {
  const warnings: string[] = [];
  const { declarations, threats, ethicsStatus, form } = ctx;

  if (ethicsStatus?.pendingDeclarations > 0) {
    warnings.push(`⚠ ${ethicsStatus.pendingDeclarations} team member(s) have not submitted independence declarations`);
  }

  const unresolvedThreats = threats.filter((t: any) => t.status === "IDENTIFIED" || t.status === "UNRESOLVED");
  if (unresolvedThreats.length > 0) {
    warnings.push(`⚠ ${unresolvedThreats.length} unresolved threat(s) to independence`);
    unresolvedThreats.forEach((t: any) => {
      warnings.push(`  - ${t.category.replace(/_/g, " ")}: ${t.description} (Severity: ${t.severity})`);
    });
  }

  const highSeverity = threats.filter((t: any) => t.severity === "HIGH");
  if (highSeverity.length > 0) {
    warnings.push(`⚠ ${highSeverity.length} HIGH severity threat(s) identified — require immediate attention`);
  }

  const financialInterests = declarations.filter((d: any) => d.hasFinancialInterest);
  if (financialInterests.length > 0) {
    warnings.push(`⚠ ${financialInterests.length} team member(s) declared financial interests in the client`);
  }

  const businessRelationships = declarations.filter((d: any) => d.hasBusinessRelationship);
  if (businessRelationships.length > 0) {
    warnings.push(`⚠ ${businessRelationships.length} team member(s) declared business relationships`);
  }

  if (!form.ethicsComplianceConfirmed) {
    warnings.push("⚠ Ethics compliance has not been confirmed");
  }

  if (!form.restrictedRelationshipsChecked) {
    warnings.push("⚠ Restricted relationships check not completed");
  }

  if (warnings.length === 0) return "✓ No ethics warnings. All checks pass.";
  return `ETHICS WARNING ALERTS (${warnings.length}):\n\n` + warnings.join("\n\n");
}

function generateMissingDeclarations(ctx: any): string {
  const { ethicsStatus, declarations } = ctx;
  const parts: string[] = ["MISSING DECLARATION SUMMARY:\n"];

  parts.push(`Total team members: ${ethicsStatus?.totalTeamMembers || 0}`);
  parts.push(`Declarations received: ${declarations.length}`);
  parts.push(`Pending: ${ethicsStatus?.pendingDeclarations || 0}`);

  if (ethicsStatus?.pendingMembers?.length > 0) {
    parts.push("\nPending members:");
    ethicsStatus.pendingMembers.forEach((m: any) => {
      parts.push(`  • ${m.user?.fullName || m.userId}`);
    });
  }

  const unapproved = declarations.filter((d: any) => !d.partnerApproved);
  if (unapproved.length > 0) {
    parts.push(`\nDeclarations awaiting partner approval: ${unapproved.length}`);
    unapproved.forEach((d: any) => {
      parts.push(`  • ${d.memberName} (${d.role})`);
    });
  }

  if (ethicsStatus?.pendingDeclarations === 0 && unapproved.length === 0) {
    parts.push("\n✓ All declarations complete and approved.");
  }

  return parts.join("\n");
}

function generateEthicsConclusion(ctx: any): string {
  const { clientName, declarations, threats, form } = ctx;
  const unresolvedThreats = threats.filter((t: any) => t.status === "IDENTIFIED" || t.status === "UNRESOLVED");
  const hasIssues = unresolvedThreats.length > 0 || declarations.some((d: any) => d.hasFinancialInterest || d.hasBusinessRelationship);

  return `SUGGESTED ETHICS CONCLUSION:\n\nBased on our assessment of independence and ethics requirements for ${clientName || "[Client Name]"} under ISA 200, ISA 220, and the IESBA Code of Ethics:\n\n1. Independence declarations have been ${declarations.length > 0 ? "obtained" : "not yet obtained"} from engagement team members.\n2. ${threats.length > 0 ? `${threats.length} threat(s) to independence were identified, of which ${unresolvedThreats.length} remain unresolved.` : "No threats to independence were identified."}\n3. Ethics compliance with ICAP/IESBA Code has been ${form.ethicsComplianceConfirmed ? "confirmed" : "not yet confirmed"}.\n4. Restricted relationship checks have been ${form.restrictedRelationshipsChecked ? "completed" : "not yet completed"}.\n\nOverall Assessment: ${hasIssues ? "Issues require resolution before the engagement can proceed." : "Independence and ethics requirements are satisfactorily met. The engagement team is independent of the audit client and compliant with applicable ethical standards."}\n\nThis conclusion is subject to partner review and approval.`;
}
