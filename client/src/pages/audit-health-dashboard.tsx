import { useState } from "react";
import { useParams, Link } from "wouter";
import { AgentsLoadingInline } from "@/components/agents-loading";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Shield, AlertTriangle, CheckCircle2, XCircle, Activity, 
  Database, Brain, FileCheck, DollarSign, Lock, Award,
  RefreshCw, ChevronRight, ArrowLeft, Zap, AlertCircle,
  User, Users, Eye, Edit, Upload, UserCheck, ClipboardList
} from "lucide-react";
import { formatAccounting } from '@/lib/formatters';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface HealthScore {
  auditHealthScore: number;
  status: 'GREEN' | 'AMBER' | 'RED';
  auditDefensibility: 'YES' | 'AT_RISK' | 'NO';
  lastScan: string;
  lockedForReporting: boolean;
  criticalFailures: number;
  totalGaps: number;
}

interface ISARow {
  isa: string;
  area: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  compliancePercent: number;
  keyIssue: string | null;
  gapCount: number;
  openTasks?: number;
}

interface CriticalAlert {
  id: string;
  message: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  impactedISA: string;
  requiredAction: string;
  blocking: boolean;
  category: string;
}

interface DataNode {
  stage: string;
  status: 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'ERROR';
  issues: string[];
}

interface AIDiagnostic {
  area: string;
  insight: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedAction: string;
  confidence: number;
}

interface EvidenceCoverage {
  assertion: string;
  coveragePercent: number;
  evidenceStatus: 'COMPLETE' | 'PARTIAL' | 'MISSING';
  linkedTests: number;
  linkedEvidence: number;
  missing?: string[];
}

interface MisstatementRow {
  id: string;
  reference: string;
  description: string;
  amount: number;
  status: string;
  fsImpact: boolean;
  materialityPercent: number;
}

interface QualityControl {
  control: string;
  status: boolean;
  required: boolean;
  isaReference: string;
  blocksReport: boolean;
}

interface AutoFix {
  id: string;
  issue: string;
  isaReference: string;
  severity: string;
  fixDescription: string;
  fixType: string;
  autoFixAvailable: boolean;
  requiresReview: boolean;
  area?: string;
  impact?: string;
  requiredSteps?: string[];
}

interface HealthCertificate {
  eligible: boolean;
  score: number;
  criticalFailures: number;
  allRisksAddressed: boolean;
  eqcrComplete: boolean;
  fileLocked: boolean;
  blockers: string[];
}

interface DashboardData {
  healthScore: HealthScore;
  isaMatrix: ISARow[];
  criticalAlerts: CriticalAlert[];
  dataIntegrity: DataNode[];
  aiDiagnostics: AIDiagnostic[];
  evidenceCoverage: EvidenceCoverage[];
  misstatements: { rows: MisstatementRow[]; summary: any };
  qualityControls: QualityControl[];
  autoFixes: AutoFix[];
  healthCertificate: HealthCertificate;
}

interface Engagement {
  id: string;
  clientName: string;
  fiscalYear: string;
  entityType?: string;
  partnerName?: string;
  managerName?: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'PARTNER' | 'MANAGER' | 'SENIOR' | 'STAFF' | 'ADMIN';
}

const statusColors = {
  GREEN: 'bg-green-500',
  AMBER: 'bg-amber-500',
  RED: 'bg-red-500'
};

const statusBadgeColors = {
  GREEN: 'bg-green-100 text-green-800',
  AMBER: 'bg-amber-100 text-amber-800',
  RED: 'bg-red-100 text-red-800'
};

const statusIcons = {
  GREEN: <CheckCircle2 className="h-4 w-4" />,
  AMBER: <AlertTriangle className="h-4 w-4" />,
  RED: <XCircle className="h-4 w-4" />
};

export default function AuditHealthDashboard() {
  const params = useParams();
  const engagementId = params.engagementId as string;
  const queryClient = useQueryClient();
  
  const [selectedGap, setSelectedGap] = useState<AutoFix | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [lockDialogOpen, setLockDialogOpen] = useState(false);

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await fetchWithAuth('/api/auth/me');
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    }
  });

  const { data: engagement } = useQuery<Engagement>({
    queryKey: ['/api/engagements', engagementId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}`);
      if (!res.ok) throw new Error('Failed to fetch engagement');
      return res.json();
    }
  });

  const { data: dashboard, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['/api/audit-health/engagements', engagementId, 'dashboard'],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/audit-health/engagements/${engagementId}/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      return res.json();
    },
    refetchInterval: 30000
  });

  const lockFileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(`/api/audit-health/engagements/${engagementId}/lock-for-reporting`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.reason || 'Failed to lock file');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit-health/engagements', engagementId] });
      setLockDialogOpen(false);
    }
  });

  const overrideMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetchWithAuth(`/api/audit-health/engagements/${engagementId}/partner-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to apply override');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit-health/engagements', engagementId] });
      setOverrideDialogOpen(false);
      setOverrideReason("");
    }
  });

  const requestEqcrMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(`/api/audit-health/engagements/${engagementId}/request-eqcr`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to request EQCR');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit-health/engagements', engagementId] });
    }
  });

  const approveIssuanceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(`/api/audit-health/engagements/${engagementId}/approve-report-issuance`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.reason || 'Failed to approve report issuance');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit-health/engagements', engagementId] });
    }
  });

  const aiRecommendationMutation = useMutation({
    mutationFn: async ({ recommendationId, action, editedValue, reason }: { recommendationId: string; action: 'ACCEPT' | 'REJECT' | 'EDIT'; editedValue?: string; reason?: string }) => {
      const res = await fetchWithAuth(`/api/audit-health/engagements/${engagementId}/ai-recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId, action, editedValue, reason })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process AI recommendation');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit-health/engagements', engagementId] });
    }
  });

  const markFixedMutation = useMutation({
    mutationFn: async (gapId: string) => {
      const res = await fetchWithAuth(`/api/audit-health/engagements/${engagementId}/gap/${gapId}/mark-fixed`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to mark gap as fixed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit-health/engagements', engagementId] });
      setSelectedGap(null);
    }
  });

  const assignStaffMutation = useMutation({
    mutationFn: async ({ gapId, assigneeId }: { gapId: string; assigneeId: string }) => {
      const res = await fetchWithAuth(`/api/audit-health/engagements/${engagementId}/gap/${gapId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to assign staff');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit-health/engagements', engagementId] });
    }
  });

  const userRole = currentUser?.role || 'STAFF';
  const isPartner = userRole === 'PARTNER' || userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER' || isPartner;

  if (isLoading) {
    return <AgentsLoadingInline showDelay={1000} />;
  }

  if (!dashboard) {
    return (
      <div className="px-4 py-3">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load audit health dashboard</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { healthScore, isaMatrix, criticalAlerts, dataIntegrity, aiDiagnostics, evidenceCoverage, misstatements, qualityControls, autoFixes, healthCertificate } = dashboard;

  const blockingAlerts = criticalAlerts.filter(a => a.blocking);
  const openTasks = autoFixes.filter(f => !f.autoFixAvailable).length;
  const inReviewTasks = autoFixes.filter(f => f.requiresReview).length;
  const completedControls = qualityControls.filter(c => c.status).length;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <Link href="/engagements">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">AUDIT HEALTH DASHBOARD</h1>
                <Badge variant="outline" className="ml-2">
                  {isPartner ? 'PARTNER VIEW' : 'MANAGER VIEW'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Client: <strong>{engagement?.clientName || 'Loading...'}</strong> | 
                FY: <strong>{engagement?.fiscalYear || '—'}</strong> | 
                Status: <Badge className={statusBadgeColors[healthScore.status]}>
                  {healthScore.status === 'RED' ? 'AT RISK' : healthScore.status === 'AMBER' ? 'REVIEW REQUIRED' : 'COMPLIANT'}
                </Badge>
              </p>
              {isPartner && engagement?.partnerName && (
                <p className="text-xs text-muted-foreground">Engagement Partner: {engagement.partnerName}</p>
              )}
            </div>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className={`border-l-4 ${statusColors[healthScore.status]}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${statusBadgeColors[healthScore.status]}`}>
                  <span className="text-2xl font-bold">{healthScore.auditHealthScore}%</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AUDIT SCORE</p>
                  <p className="text-xs text-muted-foreground/60">Target &ge;95%</p>
                  {healthScore.status === 'RED' && (
                    <Badge variant="destructive" className="mt-1 text-xs">BLOCKING</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">ISA COMPLIANCE SNAPSHOT</p>
              <div className="space-y-1">
                {isaMatrix.slice(0, 3).map(row => (
                  <div key={row.isa} className="flex items-center justify-between text-sm">
                    <span>{row.isa}</span>
                    <span className={row.status === 'GREEN' ? 'text-green-600' : row.status === 'AMBER' ? 'text-amber-600' : 'text-red-600'}>
                      {row.status === 'GREEN' ? '🟢' : row.status === 'AMBER' ? '🟠' : '🔴'} {row.compliancePercent}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">FILE LOCK</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {healthScore.lockedForReporting ? (
                    <><Lock className="h-5 w-5 text-green-600" /> <span className="text-green-600 font-medium">Locked</span></>
                  ) : (
                    <><Lock className="h-5 w-5 text-muted-foreground/60" /> <span className="text-muted-foreground">Open</span></>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">EQCR</span>
                  {healthCertificate.eqcrComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {blockingAlerts.length > 0 && (
          <Card className="border-red-500 border-2 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                CRITICAL BLOCKERS (REPORT ISSUANCE BLOCKED)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {blockingAlerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-2 text-red-700">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{alert.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isPartner ? (
          <PartnerView 
            dashboard={dashboard}
            engagement={engagement}
            onLockFile={() => setLockDialogOpen(true)}
            onOverride={() => setOverrideDialogOpen(true)}
            lockFileMutation={lockFileMutation}
            requestEqcrMutation={requestEqcrMutation}
            approveIssuanceMutation={approveIssuanceMutation}
            aiRecommendationMutation={aiRecommendationMutation}
          />
        ) : (
          <ManagerView 
            dashboard={dashboard}
            selectedGap={selectedGap}
            onSelectGap={setSelectedGap}
            openTasks={openTasks}
            inReviewTasks={inReviewTasks}
            markFixedMutation={markFixedMutation}
            assignStaffMutation={assignStaffMutation}
            aiRecommendationMutation={aiRecommendationMutation}
            engagementId={engagementId}
          />
        )}

        <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lock Audit File for Reporting</DialogTitle>
              <DialogDescription>
                This action will lock the engagement file per ISA 230.14. No further changes will be allowed after locking.
              </DialogDescription>
            </DialogHeader>
            {healthCertificate.blockers.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cannot Lock File</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2">
                    {healthCertificate.blockers.map((b, i) => (
                      <li key={i} className="text-sm">{b}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setLockDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => lockFileMutation.mutate()} 
                disabled={healthCertificate.blockers.length > 0 || lockFileMutation.isPending}
              >
                <Lock className="h-4 w-4 mr-2" />
                Lock File
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Partner Override</DialogTitle>
              <DialogDescription>
                Provide mandatory justification for this override. This will be logged for QCR review.
                Minimum 10 characters required.
              </DialogDescription>
            </DialogHeader>
            <Textarea 
              placeholder="Enter override justification (required for audit trail, minimum 10 characters)..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={4}
            />
            {overrideReason.trim().length > 0 && overrideReason.trim().length < 10 && (
              <p className="text-xs text-red-500">Justification must be at least 10 characters</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
              <Button 
                disabled={overrideReason.trim().length < 10 || overrideMutation.isPending}
                onClick={() => overrideMutation.mutate(overrideReason)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {overrideMutation.isPending ? 'Applying...' : 'Confirm Override'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function PartnerView({ dashboard, engagement, onLockFile, onOverride, lockFileMutation, requestEqcrMutation, approveIssuanceMutation, aiRecommendationMutation }: {
  dashboard: DashboardData;
  engagement?: Engagement;
  onLockFile: () => void;
  onOverride: () => void;
  lockFileMutation: any;
  requestEqcrMutation: any;
  approveIssuanceMutation: any;
  aiRecommendationMutation: any;
}) {
  const { healthScore, dataIntegrity, aiDiagnostics, misstatements, qualityControls, healthCertificate } = dashboard;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            GL → TB → FS INTEGRITY
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-4">
            {dataIntegrity.map((node, idx) => (
              <div key={node.stage} className="flex items-center">
                <div className={`px-4 py-2 rounded text-center text-sm ${
                  node.status === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                  node.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {node.stage} {node.status === 'COMPLETE' ? '✓' : node.status === 'PARTIAL' ? '!' : '✗'}
                </div>
                {idx < dataIntegrity.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/60" />
                )}
              </div>
            ))}
          </div>
          {dataIntegrity.some(n => n.issues.length > 0) && (
            <Button variant="ghost" size="sm" className="text-blue-600">[View Breaks]</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-purple-500" />
            AI DIAGNOSTICS (Partner Review Required)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {aiDiagnostics.slice(0, 3).map((diag, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground/60">•</span>
                <span>{diag.insight} → <span className="text-blue-600">{diag.suggestedAction}</span></span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            AI-Assisted — Subject to Professional Judgment
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-5 w-5" />
            MISSTATEMENTS & OPINION IMPACT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Aggregate Misstatement</p>
              <p className="text-lg font-bold">Rs {formatAccounting(misstatements.summary.totalAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Materiality</p>
              <p className="text-lg font-bold">Rs {formatAccounting(misstatements.summary.materialityThreshold)}</p>
              {misstatements.summary.exceedsMateriality && (
                <Badge variant="destructive" className="text-xs">Exceeds</Badge>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Opinion Impact</p>
              <Badge className={misstatements.summary.opinionImpact === 'MODIFIED' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                {misstatements.summary.opinionImpact || 'Unmodified'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-5 w-5" />
            QUALITY & SIGN-OFF CONTROLS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {qualityControls.map((control, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {control.status ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">{control.control}</span>
                {control.blocksReport && !control.status && (
                  <Badge variant="destructive" className="text-xs ml-2">Blocks Report</Badge>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => requestEqcrMutation.mutate()}
              disabled={requestEqcrMutation.isPending}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {requestEqcrMutation.isPending ? 'REQUESTING...' : 'REQUEST EQCR'}
            </Button>
            <Button variant="outline" size="sm" onClick={onOverride}>
              <Edit className="h-4 w-4 mr-2" />
              OVERRIDE (WITH REASON)
            </Button>
            <Button 
              size="sm" 
              onClick={onLockFile}
              disabled={!healthCertificate.eligible || lockFileMutation.isPending}
            >
              <Lock className="h-4 w-4 mr-2" />
              LOCK FILE
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Partner Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View Critical Gaps
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                aiDiagnostics.forEach((diag, idx) => {
                  aiRecommendationMutation.mutate({ 
                    recommendationId: `ai-diag-${idx}`, 
                    action: 'ACCEPT' as const 
                  });
                });
              }}
            >
              <Brain className="h-4 w-4 mr-2" />
              Accept AI Recommendations
            </Button>
            <Button variant="outline" size="sm" onClick={onOverride}>
              <Edit className="h-4 w-4 mr-2" />
              Partner Override
            </Button>
            <Button variant="outline" size="sm" onClick={onLockFile} disabled={!healthCertificate.eligible}>
              <Lock className="h-4 w-4 mr-2" />
              Lock Audit File
            </Button>
            <Button 
              size="sm" 
              disabled={!healthCertificate.eligible || approveIssuanceMutation.isPending}
              onClick={() => approveIssuanceMutation.mutate()}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {approveIssuanceMutation.isPending ? 'Approving...' : 'Approve for Report Issuance'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ManagerView({ dashboard, selectedGap, onSelectGap, openTasks, inReviewTasks, markFixedMutation, assignStaffMutation, aiRecommendationMutation, engagementId }: {
  dashboard: DashboardData;
  selectedGap: AutoFix | null;
  onSelectGap: (gap: AutoFix | null) => void;
  openTasks: number;
  inReviewTasks: number;
  markFixedMutation: any;
  assignStaffMutation: any;
  aiRecommendationMutation: any;
  engagementId: string;
}) {
  const { isaMatrix, autoFixes, evidenceCoverage, aiDiagnostics } = dashboard;
  const completedTasks = autoFixes.length - openTasks - inReviewTasks;

  const tasksByISA = isaMatrix.map(isa => ({
    ...isa,
    openTasks: autoFixes.filter(f => f.isaReference.includes(isa.isa) && !f.autoFixAvailable).length
  }));

  const highPriorityGaps = autoFixes.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-2">TASK HEALTH</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Open:</span>
                <span className={openTasks > 10 ? 'text-red-600 font-bold' : ''}>{openTasks} {openTasks > 10 ? '🔴' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span>In Review:</span>
                <span className="text-amber-600">{inReviewTasks}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="text-green-600">{completedTasks}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-2">ISA TASK BREAKDOWN</p>
            <div className="space-y-1 text-sm">
              {tasksByISA.filter(t => t.openTasks > 0).slice(0, 3).map(isa => (
                <div key={isa.isa} className="flex justify-between">
                  <span>{isa.isa}</span>
                  <span className="text-red-600">{isa.openTasks} Open</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-2">DEADLINES</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>High Priority:</span>
                <span className="text-red-600 font-bold">{highPriorityGaps.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Medium Priority:</span>
                <span className="text-amber-600">{autoFixes.filter(f => f.severity === 'MEDIUM').length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-amber-500" />
            ACTIONABLE GAPS (CLICK TO FIX)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {autoFixes.slice(0, 6).map(gap => (
              <div 
                key={gap.id} 
                className={`flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-background ${selectedGap?.id === gap.id ? 'bg-blue-50 border border-blue-200' : ''}`}
                onClick={() => onSelectGap(selectedGap?.id === gap.id ? null : gap)}
              >
                <XCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${gap.severity === 'CRITICAL' ? 'text-red-500' : gap.severity === 'HIGH' ? 'text-amber-500' : 'text-blue-500'}`} />
                <span className="text-sm">{gap.issue}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedGap && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-5 w-5" />
              GAP DETAIL (SELECTED ITEM)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Issue</p>
                <p className="text-sm font-medium">{selectedGap.issue}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Area</p>
                <p className="text-sm">{selectedGap.area || 'General'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ISA</p>
                <p className="text-sm">{selectedGap.isaReference}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impact</p>
                <Badge className={selectedGap.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : selectedGap.severity === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}>
                  {selectedGap.severity}
                </Badge>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Required Fix:</p>
              <ul className="text-sm space-y-1">
                {selectedGap.requiredSteps?.map((step, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground/60">▸</span>
                    {step}
                  </li>
                )) || (
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground/60">▸</span>
                    {selectedGap.fixDescription}
                  </li>
                )}
              </ul>
            </div>
            <div className="flex gap-2">
              <Link href={`/workspace/${engagementId}/execution`}>
                <Button size="sm">
                  <ChevronRight className="h-4 w-4 mr-1" />
                  GO TO PROCEDURE
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const assigneeId = prompt('Enter staff user ID to assign:');
                  if (assigneeId) {
                    assignStaffMutation.mutate({ gapId: selectedGap.id, assigneeId });
                  }
                }}
                disabled={assignStaffMutation.isPending}
              >
                <Users className="h-4 w-4 mr-1" />
                {assignStaffMutation.isPending ? 'ASSIGNING...' : 'ASSIGN STAFF'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => markFixedMutation.mutate(selectedGap.id)}
                disabled={markFixedMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {markFixedMutation.isPending ? 'MARKING...' : 'MARK FIXED'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-5 w-5" />
            EVIDENCE & ASSERTION MAP
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evidenceCoverage.slice(0, 3).map(cov => (
            <div key={cov.assertion} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">Assertion: {cov.assertion}</p>
                {cov.missing && cov.missing.length > 0 && (
                  <p className="text-xs text-red-600">Missing: {cov.missing.join(', ')}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${cov.coveragePercent < 70 ? 'text-red-600' : cov.coveragePercent < 90 ? 'text-amber-600' : 'text-green-600'}`}>
                  Coverage: {cov.coveragePercent}% {cov.coveragePercent < 70 ? '🔴' : ''}
                </span>
                <Button variant="ghost" size="sm">
                  <Upload className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-purple-500" />
            AI ASSISTS (OPTIONAL)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {aiDiagnostics.slice(0, 2).map((diag, idx) => (
              <div key={idx} className="p-3 bg-background rounded">
                <p className="text-sm mb-2">{diag.suggestedAction}</p>
                <p className="text-xs text-amber-600 mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Requires reviewer approval
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-green-600 border-green-600"
                    onClick={() => aiRecommendationMutation.mutate({ 
                      recommendationId: `ai-diag-${idx}`, 
                      action: 'ACCEPT' as const 
                    })}
                    disabled={aiRecommendationMutation.isPending}
                  >
                    ACCEPT
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => aiRecommendationMutation.mutate({ 
                      recommendationId: `ai-diag-${idx}`, 
                      action: 'EDIT' as const,
                      editedValue: diag.suggestedAction
                    })}
                    disabled={aiRecommendationMutation.isPending}
                  >
                    EDIT
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-red-600 border-red-600"
                    onClick={() => aiRecommendationMutation.mutate({ 
                      recommendationId: `ai-diag-${idx}`, 
                      action: 'REJECT' as const 
                    })}
                    disabled={aiRecommendationMutation.isPending}
                  >
                    REJECT
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
