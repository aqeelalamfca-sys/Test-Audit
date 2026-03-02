import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import { Scale, TrendingUp, ExternalLink } from "lucide-react";
import { formatAccounting } from "@/lib/formatters";
import type {
  DraftFSData,
  FSPriorYear,
  TrialBalanceData,
  CoAAccountData,
} from "./fs-types";
import { parseNum } from "./fs-types";

interface FSSoCEProps {
  draftFsData: DraftFSData | undefined;
  fsPriorYear: FSPriorYear;
  trialBalance: TrialBalanceData;
  coaAccounts: CoAAccountData[];
  engagementId: string;
  clientName: string;
  periodEnd: string;
  onSwitchTab?: (tab: string) => void;
}

function getFsHeadBalance(
  draftFsData: DraftFSData | undefined,
  coaAccounts: CoAAccountData[],
  fsLineItem: string
): number {
  const head = draftFsData?.fsHeads?.find(
    (h) => h.fsLineItem === fsLineItem
  );
  if (head) return head.adjustedNetBalance ?? head.netBalance ?? 0;
  const matched = coaAccounts.filter((a) => a.fsLineItem === fsLineItem);
  return matched.reduce((sum, a) => sum + (a.closingBalance ?? 0), 0);
}

export function FSSoCE({
  draftFsData,
  fsPriorYear,
  trialBalance,
  coaAccounts,
  engagementId,
  clientName,
  periodEnd,
  onSwitchTab,
}: FSSoCEProps) {
  const equityData = useMemo(() => {
    const priorShareCapital = parseNum(fsPriorYear.shareCapital);
    const priorRetainedEarnings = parseNum(fsPriorYear.retainedEarnings);
    const priorOtherReserves = 0;
    const priorTotalEquity = priorShareCapital + priorRetainedEarnings + priorOtherReserves;

    const pbt = parseNum(trialBalance.profitBeforeTax);
    const incomeTaxExpense = getFsHeadBalance(draftFsData, coaAccounts, "INCOME_TAX")
      || getFsHeadBalance(draftFsData, coaAccounts, "TAX_EXPENSE");
    const taxRate = (pbt !== 0 && incomeTaxExpense !== 0)
      ? Math.abs(incomeTaxExpense) / Math.abs(pbt)
      : 0.29;
    const profitForYear =
      draftFsData?.profitLoss?.netProfit ?? (pbt * (1 - taxRate));

    const otherComprehensiveIncome = 0;

    const currentShareCapital = getFsHeadBalance(draftFsData, coaAccounts, "SHARE_CAPITAL");
    const currentRetainedEarnings = getFsHeadBalance(draftFsData, coaAccounts, "RETAINED_EARNINGS");

    const shareIssuance = currentShareCapital - priorShareCapital;

    const dividendsPaid = priorRetainedEarnings + profitForYear - currentRetainedEarnings;
    const effectiveDividends = dividendsPaid > 0 ? -dividendsPaid : 0;

    const currentOtherReserves = 0;
    const currentTotalEquity = currentShareCapital + currentRetainedEarnings + currentOtherReserves;

    const equityChange = currentTotalEquity - priorTotalEquity;

    return {
      priorShareCapital,
      priorRetainedEarnings,
      priorOtherReserves,
      priorTotalEquity,
      profitForYear,
      otherComprehensiveIncome,
      effectiveDividends,
      shareIssuance,
      currentShareCapital,
      currentRetainedEarnings,
      currentOtherReserves,
      currentTotalEquity,
      equityChange,
    };
  }, [draftFsData, fsPriorYear, trialBalance, coaAccounts]);

  const priorYearMovements = useMemo(() => {
    return {
      openingShareCapital: 0,
      openingRetainedEarnings: 0,
      openingOtherReserves: 0,
      openingTotal: 0,
      profitForYear: 0,
      otherComprehensiveIncome: 0,
      dividends: 0,
      shareIssuance: 0,
      closingShareCapital: parseNum(fsPriorYear.shareCapital),
      closingRetainedEarnings: parseNum(fsPriorYear.retainedEarnings),
      closingOtherReserves: 0,
      closingTotal:
        parseNum(fsPriorYear.shareCapital) + parseNum(fsPriorYear.retainedEarnings),
    };
  }, [fsPriorYear]);

  const currency = trialBalance.currency || "PKR";

  const equityChangePct =
    equityData.priorTotalEquity !== 0
      ? ((equityData.equityChange / Math.abs(equityData.priorTotalEquity)) * 100).toFixed(1)
      : null;

  const shareCapitalPct =
    equityData.currentTotalEquity !== 0
      ? ((equityData.currentShareCapital / equityData.currentTotalEquity) * 100).toFixed(1)
      : "0.0";

  const retainedEarningsPct =
    equityData.currentTotalEquity !== 0
      ? ((equityData.currentRetainedEarnings / equityData.currentTotalEquity) * 100).toFixed(1)
      : "0.0";

  interface MatrixRow {
    label: string;
    shareCapital: number;
    retainedEarnings: number;
    otherReserves: number;
    total: number;
    bold?: boolean;
    topBorder?: boolean;
    doubleBorder?: boolean;
    testId: string;
    linkTab?: { tab: string; label: string };
  }

  const currentYearRows: MatrixRow[] = [
    {
      label: "Balance at beginning of year",
      shareCapital: equityData.priorShareCapital,
      retainedEarnings: equityData.priorRetainedEarnings,
      otherReserves: equityData.priorOtherReserves,
      total: equityData.priorTotalEquity,
      bold: true,
      testId: "opening-balance",
      linkTab: { tab: "balance-sheet", label: "BS" },
    },
    {
      label: "Profit for the year",
      shareCapital: 0,
      retainedEarnings: equityData.profitForYear,
      otherReserves: 0,
      total: equityData.profitForYear,
      testId: "profit-for-year",
      linkTab: { tab: "profit-loss", label: "P&L" },
    },
    {
      label: "Other comprehensive income",
      shareCapital: 0,
      retainedEarnings: 0,
      otherReserves: equityData.otherComprehensiveIncome,
      total: equityData.otherComprehensiveIncome,
      testId: "other-comprehensive-income",
    },
    {
      label: "Dividends",
      shareCapital: 0,
      retainedEarnings: equityData.effectiveDividends,
      otherReserves: 0,
      total: equityData.effectiveDividends,
      testId: "dividends",
    },
    {
      label: "Share issuance / (redemption)",
      shareCapital: equityData.shareIssuance,
      retainedEarnings: 0,
      otherReserves: 0,
      total: equityData.shareIssuance,
      testId: "share-issuance",
    },
    {
      label: "Balance at end of year",
      shareCapital: equityData.currentShareCapital,
      retainedEarnings: equityData.currentRetainedEarnings,
      otherReserves: equityData.currentOtherReserves,
      total: equityData.currentTotalEquity,
      bold: true,
      doubleBorder: true,
      testId: "closing-balance",
      linkTab: { tab: "balance-sheet", label: "BS" },
    },
  ];

  const priorYearRows: MatrixRow[] = [
    {
      label: "Balance at beginning of year",
      shareCapital: priorYearMovements.openingShareCapital,
      retainedEarnings: priorYearMovements.openingRetainedEarnings,
      otherReserves: priorYearMovements.openingOtherReserves,
      total: priorYearMovements.openingTotal,
      bold: true,
      testId: "prior-opening-balance",
    },
    {
      label: "Profit for the year",
      shareCapital: 0,
      retainedEarnings: priorYearMovements.profitForYear,
      otherReserves: 0,
      total: priorYearMovements.profitForYear,
      testId: "prior-profit-for-year",
    },
    {
      label: "Other comprehensive income",
      shareCapital: 0,
      retainedEarnings: 0,
      otherReserves: priorYearMovements.otherComprehensiveIncome,
      total: priorYearMovements.otherComprehensiveIncome,
      testId: "prior-other-comprehensive-income",
    },
    {
      label: "Dividends",
      shareCapital: 0,
      retainedEarnings: priorYearMovements.dividends,
      otherReserves: 0,
      total: priorYearMovements.dividends,
      testId: "prior-dividends",
    },
    {
      label: "Share issuance / (redemption)",
      shareCapital: priorYearMovements.shareIssuance,
      retainedEarnings: 0,
      otherReserves: 0,
      total: priorYearMovements.shareIssuance,
      testId: "prior-share-issuance",
    },
    {
      label: "Balance at end of year",
      shareCapital: priorYearMovements.closingShareCapital,
      retainedEarnings: priorYearMovements.closingRetainedEarnings,
      otherReserves: priorYearMovements.closingOtherReserves,
      total: priorYearMovements.closingTotal,
      bold: true,
      doubleBorder: true,
      testId: "prior-closing-balance",
    },
  ];

  const renderMatrixRow = (row: MatrixRow) => (
    <TableRow
      key={row.testId}
      data-testid={`row-${row.testId}`}
      className={
        (row.topBorder ? "border-t-2 border-foreground/20 " : "") +
        (row.doubleBorder ? "border-t-4 border-double border-foreground/30 " : "")
      }
    >
      <TableCell className={"border-r border-border " + (row.bold ? "font-semibold" : "")}>
        {row.label}
        {row.linkTab && onSwitchTab && (
          <button
            className="ml-2 text-xs text-primary hover:underline cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onSwitchTab(row.linkTab!.tab); }}
            data-testid={`link-${row.testId}-to-${row.linkTab.tab}`}
          >
            &rarr; {row.linkTab.label}
          </button>
        )}
      </TableCell>
      <TableCell
        className={"text-right tabular-nums border-r border-border " + (row.bold ? "font-semibold" : "")}
        data-testid={`value-share-capital-${row.testId}`}
      >
        {formatAccounting(row.shareCapital)}
      </TableCell>
      <TableCell
        className={"text-right tabular-nums border-r border-border " + (row.bold ? "font-semibold" : "")}
        data-testid={`value-retained-earnings-${row.testId}`}
      >
        {formatAccounting(row.retainedEarnings)}
      </TableCell>
      <TableCell
        className={"text-right tabular-nums border-r border-border " + (row.bold ? "font-semibold" : "")}
        data-testid={`value-other-reserves-${row.testId}`}
      >
        {formatAccounting(row.otherReserves)}
      </TableCell>
      <TableCell
        className={"text-right tabular-nums border-r border-border " + (row.bold ? "font-semibold" : "")}
        data-testid={`value-total-${row.testId}`}
      >
        {formatAccounting(row.total)}
      </TableCell>
    </TableRow>
  );

  const renderSectionHeader = (label: string) => (
    <TableRow
      key={`header-${label}`}
      data-testid={`section-header-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
    >
      <TableCell
        colSpan={5}
        className="font-semibold text-sm bg-muted/50 py-2 border-r border-border"
      >
        {label}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4" data-testid="fs-soce-container">
      <div className="print-only mb-4 text-center hidden print:block" data-testid="print-header">
        <h2 className="text-lg font-bold">{clientName}</h2>
        <h3 className="text-base font-semibold">Statement of Changes in Equity</h3>
        <p className="text-sm text-muted-foreground">
          For the period ended {periodEnd}
        </p>
        <p className="text-xs text-muted-foreground">
          (Amounts in {currency})
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between" data-testid="soce-header-bar">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold" data-testid="text-soce-title">
            Statement of Changes in Equity (IAS 1)
          </h3>
          <Badge variant="outline" data-testid="badge-matrix-format">
            Matrix Format
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSwitchTab && (
            <button
              className="text-xs text-primary hover:underline cursor-pointer"
              onClick={() => onSwitchTab("socf")}
              data-testid="link-soce-to-socf"
            >
              &rarr; SoCF
            </button>
          )}
          <Link
            href={`/workspace/${engagementId}/fs-heads`}
            data-testid="link-fs-heads"
          >
            <Badge variant="secondary" className="cursor-pointer gap-1">
              <ExternalLink className="h-3 w-3" />
              FS Heads
            </Badge>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="summary-cards">
        <Card data-testid="card-total-equity">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Equity
            </CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums" data-testid="value-total-equity">
              {formatAccounting(equityData.currentTotalEquity)}
            </div>
            <p className="text-xs text-muted-foreground mt-1" data-testid="text-equity-currency">
              {currency}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-equity-change">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Equity Change
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums" data-testid="value-equity-change">
              {formatAccounting(equityData.equityChange)}
            </div>
            <Badge
              variant={equityData.equityChange >= 0 ? "default" : "destructive"}
              className="mt-1"
              data-testid="badge-equity-change-status"
            >
              {equityChangePct !== null
                ? `${equityData.equityChange >= 0 ? "+" : ""}${equityChangePct}%`
                : "N/A"}
            </Badge>
          </CardContent>
        </Card>

        <Card data-testid="card-composition">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Composition
            </CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Share Capital</span>
                <span className="text-xs font-medium tabular-nums" data-testid="value-share-capital-pct">
                  {shareCapitalPct}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Retained Earnings</span>
                <span className="text-xs font-medium tabular-nums" data-testid="value-retained-earnings-pct">
                  {retainedEarningsPct}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-soce-statement">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
          <CardTitle className="text-sm" data-testid="text-soce-heading">
            {clientName} &mdash; Statement of Changes in Equity
          </CardTitle>
          <Badge variant="outline" data-testid="badge-currency">
            {currency}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table data-testid="table-soce">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%] border-r border-border">Particulars</TableHead>
                <TableHead className="text-right border-r border-border" data-testid="col-share-capital">
                  Share Capital
                </TableHead>
                <TableHead className="text-right border-r border-border" data-testid="col-retained-earnings">
                  Revenue Reserves / Retained Earnings
                </TableHead>
                <TableHead className="text-right border-r border-border" data-testid="col-other-reserves">
                  Other Reserves
                </TableHead>
                <TableHead className="text-right border-r border-border" data-testid="col-total-equity">
                  Total Equity
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderSectionHeader("Current Year")}
              {currentYearRows.map(renderMatrixRow)}

              {renderSectionHeader("Prior Year (Comparative)")}
              {priorYearRows.map(renderMatrixRow)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card data-testid="card-soce-note">
        <CardContent className="py-3 flex items-start gap-2">
          <Scale className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground" data-testid="text-soce-note">
            The above Statement of Changes in Equity has been auto-derived from
            available trial balance data, prior year figures, and FS head
            mappings in accordance with IAS 1. Figures are indicative and should
            be reviewed by the engagement team. Other comprehensive income and
            dividend amounts are placeholders and may require manual adjustment.
            Share issuance / (redemption) is computed from the movement in share
            capital between periods.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
