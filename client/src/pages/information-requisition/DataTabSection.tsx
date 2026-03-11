import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onNavigateToUpload?: () => void;
}

const EMPTY_STATE_INFO: Record<string, { heading: string; detail: string; sheetName: string }> = {
  tb: {
    heading: "No Trial Balance Data",
    detail: "Upload your Trial Balance data to see account balances, opening/closing comparisons, and movement analysis.",
    sheetName: "TB",
  },
  gl: {
    heading: "No General Ledger Data",
    detail: "Upload your General Ledger to review journal entries, verify DR/CR totals, and reconcile against the Trial Balance.",
    sheetName: "GL",
  },
  ap: {
    heading: "No Accounts Payable Data",
    detail: "Upload your AP/vendor listing to review creditor balances, reconcile against control accounts, and select parties for confirmation.",
    sheetName: "AP",
  },
  ar: {
    heading: "No Accounts Receivable Data",
    detail: "Upload your AR/customer listing to review debtor balances, reconcile against control accounts, and select parties for confirmation.",
    sheetName: "AR",
  },
  bank: {
    heading: "No Bank Account Data",
    detail: "Upload your bank account listing to review balances, reconcile against control accounts, and prepare bank confirmations.",
    sheetName: "Bank",
  },
};

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
  onNavigateToUpload,
}: DataTabSectionProps) {
  const hasSummary = (summaryMetrics && summaryMetrics.length > 0) || (balanceChecks && balanceChecks.length > 0);
  const emptyInfo = EMPTY_STATE_INFO[uploaderType];
  const hasData = hasSummary;

  return (
    <>
      {hasSummary && (
        <div className="mt-2 border rounded-lg bg-gradient-to-r from-muted/30 to-muted/10 overflow-hidden" data-testid={`card-${uploaderType}-summary`}>
          <div className="px-4 py-2.5 flex items-center flex-wrap gap-x-6 gap-y-1.5">
            {summaryMetrics?.map((metric, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{metric.label}</span>
                <span className="text-sm font-semibold tabular-nums" data-testid={metric.testId}>{typeof metric.value === 'number' ? metric.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : metric.value}</span>
              </div>
            ))}
            {balanceChecks?.map((check, i) => (
              <div key={`bc-${i}`} className="flex items-center gap-1.5">
                {Math.abs(check.debit - check.credit) < 1 ? (
                  <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"><CheckCircle2 className="h-3 w-3" />{check.label || 'Balanced'}</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs gap-1"><AlertCircle className="h-3 w-3" />Diff: {Math.abs(check.debit - check.credit).toLocaleString()}</Badge>
                )}
              </div>
            ))}
            {extraSummary}
          </div>
        </div>
      )}

      {!hasData && emptyInfo && (
        <div className="mt-2 border-2 border-dashed rounded-lg py-10 px-6 text-center bg-muted/5" data-testid={`empty-state-${uploaderType}`}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted/40 mb-4">
            <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">{emptyInfo.heading}</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">{emptyInfo.detail}</p>
          <div className="flex items-center justify-center gap-3">
            {onNavigateToUpload && (
              <Button variant="default" size="sm" onClick={onNavigateToUpload}>
                <Upload className="h-4 w-4 mr-1.5" />
                Go to Upload
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Include a <span className="font-semibold">"{emptyInfo.sheetName}"</span> sheet in your workbook
            </p>
          </div>
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
