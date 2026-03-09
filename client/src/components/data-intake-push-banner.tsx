import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Database, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface PushForwardStatus {
  hasPushed: boolean;
  pushedAt?: string;
  pushedBy?: string;
  targets?: string[];
  summary?: {
    fsHeadCount: number;
    workingPapersCount: number;
    confirmationPopulations: number;
    planningInputs?: {
      totalAssets: number;
      totalRevenue: number;
      profitBeforeTax: number;
    } | null;
    riskSummary?: Array<{
      fsHeadKey: string;
      fsHeadName: string;
      balance: number;
      transactionCount: number;
      inherentRisk: string;
    }>;
  };
}

interface DataIntakePushBannerProps {
  engagementId: string | undefined;
  context: 'planning' | 'execution' | 'fs-heads';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

const CONTEXT_COLORS = {
  planning: {
    pending: { border: 'border-amber-300 dark:border-amber-700', bg: 'bg-amber-50/60 dark:bg-amber-950/20', icon: 'text-amber-500 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-300' },
    done: { border: 'border-teal-300 dark:border-teal-700', bg: 'bg-teal-50/60 dark:bg-teal-950/20', icon: 'text-teal-500 dark:text-teal-400', text: 'text-teal-700 dark:text-teal-300' },
  },
  execution: {
    pending: { border: 'border-orange-300 dark:border-orange-700', bg: 'bg-orange-50/60 dark:bg-orange-950/20', icon: 'text-orange-500 dark:text-orange-400', text: 'text-orange-700 dark:text-orange-300' },
    done: { border: 'border-blue-300 dark:border-blue-700', bg: 'bg-blue-50/60 dark:bg-blue-950/20', icon: 'text-blue-500 dark:text-blue-400', text: 'text-blue-700 dark:text-blue-300' },
  },
  'fs-heads': {
    pending: { border: 'border-rose-300 dark:border-rose-700', bg: 'bg-rose-50/60 dark:bg-rose-950/20', icon: 'text-rose-500 dark:text-rose-400', text: 'text-rose-700 dark:text-rose-300' },
    done: { border: 'border-indigo-300 dark:border-indigo-700', bg: 'bg-indigo-50/60 dark:bg-indigo-950/20', icon: 'text-indigo-500 dark:text-indigo-400', text: 'text-indigo-700 dark:text-indigo-300' },
  },
};

const PENDING_MESSAGES: Record<string, string> = {
  planning: 'Data Intake not complete — push forward to populate materiality benchmarks and FS Head data.',
  execution: 'Data Intake not complete — push forward to create FS Head working papers.',
  'fs-heads': 'Data Intake not complete — push forward to populate FS Head balances and linked accounts.',
};

export function DataIntakePushBanner({ engagementId, context }: DataIntakePushBannerProps) {
  const { data: pushStatus } = useQuery<PushForwardStatus>({
    queryKey: ['/api/review-mapping/push-forward-status', engagementId],
    enabled: !!engagementId,
  });

  if (!pushStatus) return null;

  const colors = CONTEXT_COLORS[context];

  if (!pushStatus.hasPushed) {
    const c = colors.pending;
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${c.border} ${c.bg}`} data-testid="alert-no-data-intake">
        <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${c.icon}`} />
        <span className={`text-xs font-medium ${c.text} truncate`}>{PENDING_MESSAGES[context]}</span>
      </div>
    );
  }

  const c = colors.done;
  const pushedDate = pushStatus.pushedAt ? new Date(pushStatus.pushedAt).toLocaleString() : 'Unknown';
  const summary = pushStatus.summary;

  const contextDetails = (() => {
    switch (context) {
      case 'planning':
        return summary?.planningInputs ? [
          `Assets: ${formatCurrency(summary.planningInputs.totalAssets)}`,
          `Revenue: ${formatCurrency(summary.planningInputs.totalRevenue)}`,
          `PBT: ${formatCurrency(summary.planningInputs.profitBeforeTax)}`,
        ] : [];
      case 'execution':
        return [
          `${summary?.workingPapersCount || 0} working papers`,
          `${summary?.confirmationPopulations || 0} confirmations`,
        ];
      case 'fs-heads':
        return [
          `${summary?.fsHeadCount || 0} FS Heads`,
          `${summary?.workingPapersCount || 0} working papers`,
        ];
    }
  })();

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${c.border} ${c.bg}`} data-testid="alert-data-intake-pushed">
      <Database className={`h-3.5 w-3.5 flex-shrink-0 ${c.icon}`} />
      <span className={`text-xs font-medium ${c.text} flex-shrink-0`}>Data Intake Received</span>
      <Badge variant="outline" className="no-default-hover-elevate text-[10px] px-1.5 py-0 h-4 gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700 flex-shrink-0" data-testid="badge-push-timestamp">
        <CheckCircle2 className="h-2.5 w-2.5" />
        {pushedDate}
      </Badge>
      {pushStatus.pushedBy && (
        <span className={`text-[10px] ${c.text} opacity-70 flex-shrink-0`}>by {pushStatus.pushedBy}</span>
      )}
      <div className="h-3 w-px bg-border mx-1 flex-shrink-0 hidden sm:block" />
      <div className="flex items-center gap-2 flex-wrap overflow-hidden">
        {contextDetails.map((detail, i) => (
          <span key={i} className={`text-[11px] flex items-center gap-1 ${c.text} opacity-80 whitespace-nowrap`}>
            <Clock className="h-2.5 w-2.5" />
            {detail}
          </span>
        ))}
      </div>
    </div>
  );
}
