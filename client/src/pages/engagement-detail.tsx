import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EngagementStatusHeader,
} from "@/components/engagement-status-header";
import {
  StatusBadge,
  ProgressBar,
  SectionIndicator,
  AttachmentIndicator,
  type EntityStatus,
  type SectionStatus,
} from "@/components/ui/visual-indicators";
import {
  Scale,
  Calculator,
  Database,
  TestTube2,
  FolderOpen,
  FileCheck,
  Shield,
  ArrowLeft,
  Calendar,
  User,
  Building2,
  FileText,
  Clock,
  CheckCircle2,
} from "lucide-react";

interface PhaseCard {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const phaseCards: PhaseCard[] = [
  { id: "pre-planning", name: "Pre-Planning", icon: FileText, path: "pre-planning" },
  { id: "ethics", name: "Ethics & Independence", icon: Scale, path: "ethics" },
  { id: "planning", name: "Planning & Risk", icon: Calculator, path: "planning" },
  { id: "execution", name: "Execution", icon: Database, path: "execution" },
  { id: "fs-heads", name: "FS Working Papers", icon: TestTube2, path: "fs-heads" },
  { id: "evidence", name: "Evidence Vault", icon: FolderOpen, path: "evidence" },
  { id: "finalization", name: "Finalization", icon: FileCheck, path: "finalization" },
  { id: "eqcr", name: "EQCR", icon: Shield, path: "eqcr" },
];

function getPhaseStatus(phase: any): SectionStatus {
  if (!phase) return "NOT_STARTED";
  if (phase.status === "COMPLETED" || phase.status === "LOCKED") return "COMPLETE";
  if (phase.completionPercentage > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function getEntityStatus(phase: any): EntityStatus {
  if (!phase) return "DRAFT";
  if (phase.status === "LOCKED" || phase.status === "APPROVED") return "APPROVED";
  if (phase.status === "COMPLETED") return "REVIEWED";
  if (phase.completionPercentage > 50) return "PREPARED";
  return "DRAFT";
}

export default function EngagementDetail() {
  const params = useParams();
  const engagementId = params.id;

  const { data: engagement, isLoading: engagementLoading } = useQuery({
    queryKey: ["/api/engagements", engagementId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!engagementId,
  });

  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["/api/progress", engagementId, "comprehensive"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/progress/${engagementId}/comprehensive`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!engagementId,
  });

  const phases = progressData?.phases || [];
  const overallProgress = progressData?.overall?.completionPercentage || 0;

  const getPhaseData = (phaseId: string) => {
    const phaseMap: Record<string, string> = {
      "pre-planning": "PRE_PLANNING",
      "ethics": "PRE_PLANNING",
      "planning": "PLANNING",
      "controls": "EXECUTION",
      "substantive": "EXECUTION",
      "analytical": "PLANNING",
      "evidence": "EVIDENCE",
      "finalization": "FINALIZATION",
      "eqcr": "QR",
    };
    const mappedPhase = phaseMap[phaseId];
    return phases.find((p: any) => p.phase === mappedPhase);
  };

  if (engagementLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const engagementName = engagement?.engagementCode || `Engagement ${engagementId}`;

  return (
    <div className="page-container">
      <div className="flex items-center gap-4">
        <Link href="/engagements">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {engagementId && (
        <EngagementStatusHeader
          engagementId={engagementId}
          engagementName={engagementName}
          showAIBanner={true}
          showProgressDetails={true}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary/70" />
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{engagement?.client?.name || "Loading..."}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary/70" />
              <div>
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="font-medium">
                  {engagement?.periodStart && engagement?.periodEnd
                    ? `${new Date(engagement.periodStart).toLocaleDateString()} - ${new Date(engagement.periodEnd).toLocaleDateString()}`
                    : "Not set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary/70" />
              <div>
                <p className="text-sm text-muted-foreground">Engagement Type</p>
                <p className="font-medium">{engagement?.engagementType || "Not specified"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Phases</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500" /> Complete
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-500" /> In Progress
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-muted-foreground/30" /> Not Started
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {phaseCards.map((phase) => {
              const Icon = phase.icon;
              const phaseData = getPhaseData(phase.id);
              const progress = phaseData?.completionPercentage || 0;
              const status = getPhaseStatus(phaseData);
              const entityStatus = getEntityStatus(phaseData);

              return (
                <Link key={phase.id} href={`/workspace/${engagementId}/${phase.path}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium text-sm">{phase.name}</span>
                        </div>
                        <SectionIndicator status={status} />
                      </div>
                      <ProgressBar value={progress} size="sm" showPercentage={false} />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">{progress}% Complete</p>
                        <StatusBadge status={entityStatus} size="sm" showTooltip={false} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Evidence Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Documents Collected</span>
                <AttachmentIndicator status="PRESENT" count={progressData?.metrics?.evidence?.total || 0} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Required Attachments</span>
                <AttachmentIndicator status={(progressData?.metrics?.evidence?.total || 0) > 0 ? "PRESENT" : "MISSING"} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completion Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Checklists</span>
                <span className="text-sm font-medium">
                  {progressData?.metrics?.checklists?.completed || 0} / {progressData?.metrics?.checklists?.total || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Substantive Tests</span>
                <span className="text-sm font-medium">
                  {progressData?.metrics?.tests?.completed || 0} / {progressData?.metrics?.tests?.total || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Risk Assessments</span>
                <span className="text-sm font-medium">
                  {progressData?.metrics?.risks?.total || 0} identified
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
