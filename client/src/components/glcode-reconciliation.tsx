import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GLCodeReconciliationProps {
  engagementId: string;
}

type ReconciliationType = "tb-gl" | "ar-control" | "ap-control" | "bank-control";

type ReconciliationStatus = "PASS" | "FAIL" | "WARNING";

type RowStatus = "MATCHED" | "VARIANCE" | "MISSING_SOURCE" | "MISSING_TARGET";

interface DatasetError {
  dataset: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  errorCount: number;
  errors: Array<{
    type: string;
    glCode: string;
    message: string;
    rowReference?: string;
  }>;
}

interface IntegrityData {
  overallStatus: ReconciliationStatus;
  totalGLCodes: number;
  validCount: number;
  missingCount: number;
  duplicateCount: number;
  invalidCount: number;
  datasetErrors: DatasetError[];
}

interface ReconciliationsData {
  reconciliations: ReconciliationSummary[];
  overallStatus: ReconciliationStatus;
}

interface ReconciliationSummary {
  type: ReconciliationType;
  label: string;
  status: ReconciliationStatus;
  matchedCount: number;
  totalCount: number;
  netVariance: number;
}

interface ReconciliationDetail {
  glCode: string;
  glName: string;
  sourceAmount: number;
  targetAmount: number;
  difference: number;
  status: RowStatus;
}

interface DrilldownItem {
  description: string;
  amount: number;
  reference?: string;
  date?: string;
}

interface DrilldownData {
  glCode: string;
  glName: string;
  sourceItems: DrilldownItem[];
  targetItems: DrilldownItem[];
  sourceTotal: number;
  targetTotal: number;
  difference: number;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(status: ReconciliationStatus) {
  switch (status) {
    case "PASS":
      return (
        <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          PASS
        </Badge>
      );
    case "FAIL":
      return (
        <Badge className="bg-red-500/15 text-red-600 border-red-500/30">
          <XCircle className="w-3 h-3 mr-1" />
          FAIL
        </Badge>
      );
    case "WARNING":
      return (
        <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">
          <AlertTriangle className="w-3 h-3 mr-1" />
          WARNING
        </Badge>
      );
  }
}

function getRowStatusBadge(status: RowStatus) {
  switch (status) {
    case "MATCHED":
      return (
        <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
          MATCHED
        </Badge>
      );
    case "VARIANCE":
      return (
        <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">
          VARIANCE
        </Badge>
      );
    case "MISSING_SOURCE":
      return (
        <Badge className="bg-red-500/15 text-red-600 border-red-500/30">
          MISSING SOURCE
        </Badge>
      );
    case "MISSING_TARGET":
      return (
        <Badge className="bg-red-500/15 text-red-600 border-red-500/30">
          MISSING TARGET
        </Badge>
      );
  }
}

function getReconciliationLabel(type: ReconciliationType): string {
  switch (type) {
    case "tb-gl":
      return "TB ↔ GL";
    case "ar-control":
      return "AR ↔ Control";
    case "ap-control":
      return "AP ↔ Control";
    case "bank-control":
      return "Bank ↔ Control";
  }
}

function IntegrityStatusCard({
  integrity,
  isLoading,
}: {
  integrity: IntegrityData | undefined;
  isLoading: boolean;
}) {
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  if (isLoading) {
    return (
      <Card data-testid="glcode-integrity-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            GL_CODE Integrity Status
            <Loader2 className="w-4 h-4 animate-spin" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2.5">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!integrity) {
    return (
      <Card data-testid="glcode-integrity-card">
        <CardHeader>
          <CardTitle className="text-lg">GL_CODE Integrity Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No integrity data available. Upload GL and TB data to begin analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  const validPercent = integrity.totalGLCodes > 0
    ? (integrity.validCount / integrity.totalGLCodes) * 100
    : 0;

  return (
    <Card data-testid="glcode-integrity-card">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">GL_CODE Integrity Status</CardTitle>
          {getStatusBadge(integrity.overallStatus)}
        </div>
        <CardDescription>
          Cross-dataset GL_CODE validation and integrity check
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold font-mono">{integrity.totalGLCodes}</p>
            <p className="text-xs text-muted-foreground">Total GL_CODEs</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <p className="text-lg font-bold font-mono text-green-600">
              {integrity.validCount}
            </p>
            <p className="text-xs text-muted-foreground">Valid</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10">
            <p className="text-lg font-bold font-mono text-yellow-600">
              {integrity.missingCount}
            </p>
            <p className="text-xs text-muted-foreground">Missing</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-orange-500/10">
            <p className="text-lg font-bold font-mono text-orange-600">
              {integrity.duplicateCount}
            </p>
            <p className="text-xs text-muted-foreground">Duplicate</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10">
            <p className="text-lg font-bold font-mono text-red-600">
              {integrity.invalidCount}
            </p>
            <p className="text-xs text-muted-foreground">Invalid</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Validation Progress</span>
            <span className="font-mono">{validPercent.toFixed(1)}%</span>
          </div>
          <Progress value={validPercent} className="h-2" />
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Dataset Errors</h4>
          {integrity.datasetErrors.map((datasetInfo) => {
            const hasErrors = datasetInfo.errorCount > 0;
            const isExpanded = expandedSections.includes(datasetInfo.dataset);

            return (
              <Collapsible
                key={datasetInfo.dataset}
                open={isExpanded}
                onOpenChange={() => toggleSection(datasetInfo.dataset)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between px-3 py-2 h-auto"
                    data-testid={`integrity-dataset-${datasetInfo.dataset.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium">{datasetInfo.dataset}</span>
                    </div>
                    {hasErrors ? (
                      <Badge variant="destructive" className="text-xs">
                        {datasetInfo.errorCount} errors
                      </Badge>
                    ) : (
                      <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-xs">
                        OK
                      </Badge>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {hasErrors ? (
                    <ScrollArea className="h-32 rounded-md border p-2 ml-6 mt-1">
                      <ul className="space-y-1 text-sm">
                        {datasetInfo.errors.map((error, idx) => (
                          <li
                            key={idx}
                            className="text-red-600 flex items-start gap-2"
                          >
                            <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>
                              {error.message}
                              {error.rowReference && ` (${error.rowReference})`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground ml-6 mt-1">
                      No errors found in {datasetInfo.dataset} dataset.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ReconciliationCard({
  summary,
  onViewDetails,
}: {
  summary: ReconciliationSummary;
  onViewDetails: () => void;
}) {
  const matchPercent =
    summary.totalCount > 0
      ? (summary.matchedCount / summary.totalCount) * 100
      : 0;

  return (
    <Card
      data-testid={`reconciliation-card-${summary.type}`}
      className="hover-elevate cursor-pointer"
      onClick={onViewDetails}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            {summary.label}
          </CardTitle>
          {getStatusBadge(summary.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Matched</span>
          <span className="font-mono text-sm">
            {summary.matchedCount} / {summary.totalCount}
          </span>
        </div>

        <Progress value={matchPercent} className="h-2" />

        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Net Variance</span>
          <span
            className={cn(
              "font-mono text-sm font-medium",
              summary.netVariance === 0
                ? "text-green-600"
                : summary.netVariance > 0
                ? "text-red-600"
                : "text-yellow-600"
            )}
          >
            {summary.netVariance >= 0 ? "" : "-"}
            {formatAmount(Math.abs(summary.netVariance))}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
          data-testid={`view-details-${summary.type}`}
        >
          <Eye className="w-4 h-4 mr-2" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

function ReconciliationTable({
  engagementId,
  type,
  details,
  isLoading,
  onRowClick,
}: {
  engagementId: string;
  type: ReconciliationType;
  details: ReconciliationDetail[];
  isLoading: boolean;
  onRowClick: (glCode: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (details.length === 0) {
    return (
      <div className="text-center py-2 text-muted-foreground">
        No reconciliation data available for this type.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <Table data-testid={`reconciliation-table-${type}`}>
        <TableHeader>
          <TableRow>
            <TableHead>GL_CODE</TableHead>
            <TableHead>GL Name</TableHead>
            <TableHead className="text-right">Source Amount</TableHead>
            <TableHead className="text-right">Target Amount</TableHead>
            <TableHead className="text-right">Difference</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {details.map((row) => (
            <TableRow
              key={row.glCode}
              className="cursor-pointer hover:bg-muted/80"
              onClick={() => onRowClick(row.glCode)}
              data-testid={`drilldown-row-${row.glCode}`}
            >
              <TableCell className="font-mono font-medium">
                {row.glCode}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {row.glName}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatAmount(row.sourceAmount)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatAmount(row.targetAmount)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono font-medium",
                  row.difference === 0
                    ? "text-green-600"
                    : row.difference > 0
                    ? "text-red-600"
                    : "text-yellow-600"
                )}
              >
                {row.difference >= 0 ? "" : "-"}
                {formatAmount(Math.abs(row.difference))}
              </TableCell>
              <TableCell className="text-center">
                {getRowStatusBadge(row.status)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function TransactionDrilldown({
  engagementId,
  type,
  glCode,
  onClose,
}: {
  engagementId: string;
  type: ReconciliationType;
  glCode: string;
  onClose: () => void;
}) {
  const { data: drilldown, isLoading } = useQuery<DrilldownData>({
    queryKey: [
      "/api/engagements",
      engagementId,
      "reconciliations",
      type,
      "drilldown",
      glCode,
    ],
    enabled: !!glCode,
  });

  return (
    <Sheet open={!!glCode} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Transaction Drilldown: {glCode}</SheetTitle>
        </SheetHeader>
        <div className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !drilldown ? (
            <div className="text-center py-2 text-muted-foreground">
              No data found for this GL_CODE.
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-150px)]">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">{drilldown.glName}</span>
                  <span
                    className={cn(
                      "font-mono font-medium",
                      drilldown.difference === 0
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    Difference: {formatAmount(drilldown.difference)}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Source Items</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldown.sourceItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No source items
                          </TableCell>
                        </TableRow>
                      ) : (
                        drilldown.sourceItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="max-w-[150px] truncate">
                              {item.description}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {item.date || "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(item.amount)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {item.reference || "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(drilldown.sourceTotal)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Target Items</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldown.targetItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No target items
                          </TableCell>
                        </TableRow>
                      ) : (
                        drilldown.targetItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="max-w-[150px] truncate">
                              {item.description}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {item.date || "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(item.amount)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {item.reference || "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(drilldown.targetTotal)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function GLCodeReconciliation({
  engagementId,
}: GLCodeReconciliationProps) {
  const [selectedReconciliation, setSelectedReconciliation] =
    useState<ReconciliationType | null>(null);
  const [selectedGlCode, setSelectedGlCode] = useState<string | null>(null);

  const { data: integrity, isLoading: integrityLoading } =
    useQuery<IntegrityData>({
      queryKey: ["/api/engagements", engagementId, "glcode", "integrity"],
    });

  const { data: reconciliationsData, isLoading: reconciliationsLoading } =
    useQuery<ReconciliationsData>({
      queryKey: ["/api/engagements", engagementId, "reconciliations"],
    });

  const { data: reconciliationDetails, isLoading: detailsLoading } =
    useQuery<ReconciliationDetail[]>({
      queryKey: [
        "/api/engagements",
        engagementId,
        "reconciliations",
        selectedReconciliation,
        "details",
      ],
      enabled: !!selectedReconciliation,
    });

  const defaultReconciliations: ReconciliationSummary[] = [
    {
      type: "tb-gl",
      label: "TB ↔ GL",
      status: "PASS",
      matchedCount: 0,
      totalCount: 0,
      netVariance: 0,
    },
    {
      type: "ar-control",
      label: "AR ↔ Control",
      status: "PASS",
      matchedCount: 0,
      totalCount: 0,
      netVariance: 0,
    },
    {
      type: "ap-control",
      label: "AP ↔ Control",
      status: "PASS",
      matchedCount: 0,
      totalCount: 0,
      netVariance: 0,
    },
    {
      type: "bank-control",
      label: "Bank ↔ Control",
      status: "PASS",
      matchedCount: 0,
      totalCount: 0,
      netVariance: 0,
    },
  ];

  const reconList = reconciliationsData?.reconciliations || defaultReconciliations;

  return (
    <div className="space-y-3">
      <IntegrityStatusCard integrity={integrity} isLoading={integrityLoading} />

      <div className="space-y-2.5">
        <h3 className="text-lg font-semibold">Reconciliations</h3>

        {reconciliationsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-6 bg-muted rounded w-1/4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded" />
                    <div className="h-2 bg-muted rounded" />
                    <div className="h-4 bg-muted rounded" />
                    <div className="h-8 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {reconList.map((summary) => (
              <ReconciliationCard
                key={summary.type}
                summary={summary}
                onViewDetails={() => setSelectedReconciliation(summary.type)}
              />
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={!!selectedReconciliation}
        onOpenChange={() => setSelectedReconciliation(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>
              {selectedReconciliation
                ? getReconciliationLabel(selectedReconciliation)
                : ""}{" "}
              Reconciliation Details
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3">
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-2.5">
                <TabsTrigger value="all">All Items</TabsTrigger>
                <TabsTrigger value="variances">Variances Only</TabsTrigger>
                <TabsTrigger value="missing">Missing Items</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <ReconciliationTable
                  engagementId={engagementId}
                  type={selectedReconciliation || "tb-gl"}
                  details={reconciliationDetails || []}
                  isLoading={detailsLoading}
                  onRowClick={(glCode) => setSelectedGlCode(glCode)}
                />
              </TabsContent>
              <TabsContent value="variances">
                <ReconciliationTable
                  engagementId={engagementId}
                  type={selectedReconciliation || "tb-gl"}
                  details={
                    reconciliationDetails?.filter(
                      (d) => d.status === "VARIANCE"
                    ) || []
                  }
                  isLoading={detailsLoading}
                  onRowClick={(glCode) => setSelectedGlCode(glCode)}
                />
              </TabsContent>
              <TabsContent value="missing">
                <ReconciliationTable
                  engagementId={engagementId}
                  type={selectedReconciliation || "tb-gl"}
                  details={
                    reconciliationDetails?.filter(
                      (d) =>
                        d.status === "MISSING_SOURCE" ||
                        d.status === "MISSING_TARGET"
                    ) || []
                  }
                  isLoading={detailsLoading}
                  onRowClick={(glCode) => setSelectedGlCode(glCode)}
                />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {selectedGlCode && selectedReconciliation && (
        <TransactionDrilldown
          engagementId={engagementId}
          type={selectedReconciliation}
          glCode={selectedGlCode}
          onClose={() => setSelectedGlCode(null)}
        />
      )}
    </div>
  );
}
