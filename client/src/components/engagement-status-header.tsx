import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  GlobalStatusBar,
  StatusBadge,
  ProgressBar,
  PhaseProgress,
  WhatsMissingPanel,
  AIAssistBanner,
  EntityStatus,
  MissingItem,
} from "./ui/visual-indicators";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface EngagementStatusHeaderProps {
  engagementId: string;
  engagementName: string;
  showAIBanner?: boolean;
  showProgressDetails?: boolean;
  className?: string;
}

interface SignOffData {
  preparedAt?: string;
  preparedBy?: { fullName: string };
  reviewedAt?: string;
  reviewedBy?: { fullName: string };
  approvedAt?: string;
  approvedBy?: { fullName: string };
}

interface PhaseData {
  phase: string;
  completedItems: number;
  totalItems: number;
  status: EntityStatus;
}

function deriveEntityStatus(signOff?: SignOffData): EntityStatus {
  if (!signOff) return "DRAFT";
  if (signOff.approvedAt) return "APPROVED";
  if (signOff.reviewedAt) return "REVIEWED";
  if (signOff.preparedAt) return "PREPARED";
  return "DRAFT";
}

function getStatusMarker(signOff?: SignOffData): { by?: string; at?: string } {
  if (!signOff) return {};
  if (signOff.approvedAt) {
    return { by: signOff.approvedBy?.fullName, at: signOff.approvedAt };
  }
  if (signOff.reviewedAt) {
    return { by: signOff.reviewedBy?.fullName, at: signOff.reviewedAt };
  }
  if (signOff.preparedAt) {
    return { by: signOff.preparedBy?.fullName, at: signOff.preparedAt };
  }
  return {};
}

export function EngagementStatusHeader({
  engagementId,
  engagementName,
  showAIBanner = true,
  showProgressDetails = true,
  className,
}: EngagementStatusHeaderProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: signOffData, isLoading: signOffLoading } = useQuery({
    queryKey: ["/api/progress", engagementId, "sign-off-summary"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/progress/${engagementId}/sign-off-summary`);
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
      const data = await res.json();
      return {
        overallProgress: data.overall?.completionPercentage || 0,
        phases: data.phases?.map((p: any) => ({
          phase: p.phase,
          completedItems: Math.round((p.completionPercentage / 100) * 10),
          totalItems: 10,
          status: p.status === 'COMPLETED' ? 'APPROVED' : p.status === 'IN_PROGRESS' ? 'PREPARED' : 'DRAFT',
        })) || [],
      };
    },
    enabled: !!engagementId && showProgressDetails,
  });

  const { data: missingItems } = useQuery({
    queryKey: ["/api/progress", engagementId, "missing-items"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/progress/${engagementId}/missing-items`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!engagementId && expanded,
  });

  if (signOffLoading) {
    return (
      <div className={className}>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  const status = deriveEntityStatus(signOffData);
  const marker = getStatusMarker(signOffData);
  const overallProgress = progressData?.overallProgress ?? 0;
  const phases: PhaseData[] = progressData?.phases ?? [];

  return (
    <div className={className}>
      <GlobalStatusBar
        status={status}
        entityName={engagementName}
        markedBy={marker.by}
        markedAt={marker.at}
      />

      {showAIBanner && (
        <div className="mt-1.5">
          <AIAssistBanner />
        </div>
      )}

      {showProgressDetails && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Overall Progress</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 px-2"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show Details
                </>
              )}
            </Button>
          </div>
          <ProgressBar value={overallProgress} size="md" showPercentage />

          {expanded && (
            <div className="mt-2.5 space-y-2.5">
              {phases.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {phases.map((phase) => (
                    <PhaseProgress
                      key={phase.phase}
                      phaseName={phase.phase}
                      completedItems={phase.completedItems}
                      totalItems={phase.totalItems}
                      signOffStatus={phase.status}
                    />
                  ))}
                </div>
              )}

              {missingItems && missingItems.length > 0 && (
                <WhatsMissingPanel items={missingItems} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EntityStatusCardProps {
  title: string;
  status: EntityStatus;
  markedBy?: string;
  markedAt?: string | Date;
  progress?: number;
  completedItems?: number;
  totalItems?: number;
  children?: React.ReactNode;
}

export function EntityStatusCard({
  title,
  status,
  markedBy,
  markedAt,
  progress,
  completedItems,
  totalItems,
  children,
}: EntityStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <StatusBadge status={status} markedBy={markedBy} markedAt={markedAt} />
        </div>
      </CardHeader>
      <CardContent>
        {progress !== undefined && (
          <div className="mb-3">
            <ProgressBar value={progress} size="sm" />
            {completedItems !== undefined && totalItems !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                {completedItems} of {totalItems} complete
              </p>
            )}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

interface SectionStatusBadgesProps {
  preparedAt?: string | Date;
  preparedBy?: string;
  reviewedAt?: string | Date;
  reviewedBy?: string;
  approvedAt?: string | Date;
  approvedBy?: string;
  className?: string;
}

export function SectionStatusBadges({
  preparedAt,
  preparedBy,
  reviewedAt,
  reviewedBy,
  approvedAt,
  approvedBy,
  className,
}: SectionStatusBadgesProps) {
  const badges: { status: EntityStatus; by?: string; at?: string | Date }[] = [];

  if (preparedAt) {
    badges.push({ status: "PREPARED", by: preparedBy, at: preparedAt });
  }
  if (reviewedAt) {
    badges.push({ status: "REVIEWED", by: reviewedBy, at: reviewedAt });
  }
  if (approvedAt) {
    badges.push({ status: "APPROVED", by: approvedBy, at: approvedAt });
  }

  if (badges.length === 0) {
    return <StatusBadge status="DRAFT" showTooltip={false} size="sm" />;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        {badges.map((badge) => (
          <StatusBadge
            key={badge.status}
            status={badge.status}
            markedBy={badge.by}
            markedAt={badge.at}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
}
