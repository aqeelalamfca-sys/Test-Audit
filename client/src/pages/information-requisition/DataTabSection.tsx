import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { EditableDataGrid } from "@/components/editable-data-grid";

interface SummaryMetric {
  label: string;
  value: string | number;
  testId?: string;
}

interface BalanceCheck {
  debit: number;
  credit: number;
  label?: string;
}

interface DataTabSectionProps {
  engagementId: string;
  datasetType: string;
  uploaderType: 'tb' | 'gl' | 'ap' | 'ar' | 'bank';
  title: string;
  description: string;
  icon: ReactNode;
  columns: any[];
  pageSize?: number;
  additionalFilters?: Record<string, any>;
  enableSelection?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  selectionActionLabel?: string;
  onSelectionAction?: (rows: Record<string, any>[]) => void;
  summaryMetrics?: SummaryMetric[];
  balanceChecks?: BalanceCheck[];
  extraSummary?: ReactNode;
}

export function DataTabSection({
  engagementId,
  datasetType,
  uploaderType,
  title,
  description,
  icon,
  columns,
  pageSize = 20,
  additionalFilters,
  enableSelection,
  selectedIds,
  onSelectionChange,
  selectionActionLabel,
  onSelectionAction,
  summaryMetrics,
  balanceChecks,
  extraSummary,
}: DataTabSectionProps) {
  const hasSummary = (summaryMetrics && summaryMetrics.length > 0) || (balanceChecks && balanceChecks.length > 0);

  return (
    <>
      {hasSummary && (
        <div className="mt-2 flex items-center flex-wrap gap-x-5 gap-y-1 border rounded-md px-3 py-2 bg-muted/20 text-sm" data-testid={`card-${uploaderType}-summary`}>
          {summaryMetrics?.map((metric, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{metric.label}:</span>
              <span className="text-xs font-semibold" data-testid={metric.testId}>{typeof metric.value === 'number' ? metric.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : metric.value}</span>
            </div>
          ))}
          {balanceChecks?.map((check, i) => (
            <div key={`bc-${i}`} className="flex items-center gap-1.5">
              {Math.abs(check.debit - check.credit) < 1 ? (
                <Badge variant="outline" className="text-xs gap-0.5"><CheckCircle2 className="h-3 w-3" />{check.label || 'Balanced'}</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs gap-0.5"><AlertCircle className="h-3 w-3" />Diff: {Math.abs(check.debit - check.credit).toLocaleString()}</Badge>
              )}
            </div>
          ))}
          {extraSummary}
        </div>
      )}
      <Card data-testid={`card-review-${uploaderType}`} className="mt-1">
        <CardHeader className="py-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              {icon}
              {title}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <EditableDataGrid
            apiEndpoint="/api/import"
            columns={columns}
            pageSize={pageSize}
            engagementId={engagementId}
            datasetType={datasetType}
            additionalFilters={additionalFilters}
            enableSelection={enableSelection}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
            selectionActionLabel={selectionActionLabel}
            onSelectionAction={onSelectionAction}
          />
        </CardContent>
      </Card>
    </>
  );
}
