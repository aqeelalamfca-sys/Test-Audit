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
import { AlertCircle, TrendingUp, ArrowUpDown, ExternalLink } from "lucide-react";
import { formatAccounting } from "@/lib/formatters";
import type {
  DraftFSData,
  FSPriorYear,
  TrialBalanceData,
  CoAAccountData,
} from "./fs-types";
import { parseNum } from "./fs-types";

interface FSSoCFProps {
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

function getFsHeadOpening(
  coaAccounts: CoAAccountData[],
  fsLineItem: string
): number {
  const matched = coaAccounts.filter((a) => a.fsLineItem === fsLineItem);
  return matched.reduce((sum, a) => sum + (a.openingBalance ?? 0), 0);
}

export function FSSoCF({
  draftFsData,
  fsPriorYear,
  trialBalance,
  coaAccounts,
  engagementId,
  clientName,
  periodEnd,
  onSwitchTab,
}: FSSoCFProps) {
  const cashFlowData = useMemo(() => {
    const tbPbt = parseNum(trialBalance.profitBeforeTax);
    const netProfit = draftFsData?.profitLoss?.netProfit ?? 0;
    const rawIncomeTax = parseNum(fsPriorYear.incomeTax);
    const profitBeforeTax = tbPbt !== 0
      ? tbPbt
      : (netProfit + Math.abs(rawIncomeTax));

    const depreciation = getFsHeadBalance(draftFsData, coaAccounts, "DEPRECIATION");
    const financeCosts = getFsHeadBalance(draftFsData, coaAccounts, "FINANCE_COSTS");
    const financeIncome = Math.abs(getFsHeadBalance(draftFsData, coaAccounts, "FINANCE_INCOME"));

    const currentInventory = getFsHeadBalance(draftFsData, coaAccounts, "INVENTORIES");
    const priorInventory = parseNum(fsPriorYear.inventories);
    const inventoryChange = priorInventory - currentInventory;

    const currentReceivables = getFsHeadBalance(draftFsData, coaAccounts, "TRADE_RECEIVABLES");
    const priorReceivables = parseNum(fsPriorYear.tradeReceivables);
    const receivablesChange = priorReceivables - currentReceivables;

    const currentPayables = getFsHeadBalance(draftFsData, coaAccounts, "TRADE_PAYABLES");
    const priorPayables = getFsHeadOpening(coaAccounts, "TRADE_PAYABLES");
    const payablesChange = currentPayables - priorPayables;

    const operatingCashBeforeTax =
      profitBeforeTax + depreciation + financeCosts - financeIncome +
      inventoryChange + receivablesChange + payablesChange;

    const currentTaxFromFs = getFsHeadBalance(draftFsData, coaAccounts, "INCOME_TAX");
    const incomeTaxPaid = currentTaxFromFs !== 0
      ? -(currentTaxFromFs)
      : -(Math.abs(parseNum(trialBalance.profitBeforeTax) - (draftFsData?.profitLoss?.netProfit ?? parseNum(trialBalance.profitBeforeTax))));
    const netOperating = operatingCashBeforeTax + incomeTaxPaid;

    const currentPPE = getFsHeadBalance(draftFsData, coaAccounts, "PPE");
    const priorPPE = parseNum(fsPriorYear.propertyPlantEquipment);
    const ppeMovement = -(currentPPE - priorPPE + depreciation);

    const currentIntangibles = getFsHeadBalance(draftFsData, coaAccounts, "INTANGIBLE_ASSETS");
    const priorIntangibles = parseNum(fsPriorYear.intangibleAssets);
    const intangiblesMovement = -(currentIntangibles - priorIntangibles);

    const netInvesting = ppeMovement + intangiblesMovement;

    const currentShareCapital = getFsHeadBalance(draftFsData, coaAccounts, "SHARE_CAPITAL");
    const priorShareCapital = parseNum(fsPriorYear.shareCapital);
    const shareCapitalChange = currentShareCapital - priorShareCapital;

    const currentRetainedEarnings = getFsHeadBalance(draftFsData, coaAccounts, "RETAINED_EARNINGS");
    const priorRetainedEarnings = parseNum(fsPriorYear.retainedEarnings);
    const retainedEarningsMovement = currentRetainedEarnings - priorRetainedEarnings;
    const profitAfterTax = profitBeforeTax + incomeTaxPaid;
    const dividendsCalc = retainedEarningsMovement - profitAfterTax;
    const effectiveDividendsPaid = dividendsCalc < 0 ? dividendsCalc : 0;

    const finCostsPaid = -financeCosts;
    const netFinancing = shareCapitalChange + effectiveDividendsPaid + finCostsPaid;

    const netChangeInCash = netOperating + netInvesting + netFinancing;

    const openingCash = parseNum(fsPriorYear.cashBankBalances);
    const actualClosingCash = getFsHeadBalance(draftFsData, coaAccounts, "CASH_EQUIVALENTS");
    const closingCash = actualClosingCash !== 0 ? actualClosingCash : (openingCash + netChangeInCash);

    return {
      profitBeforeTax,
      depreciation,
      financeCosts,
      financeIncome,
      inventoryChange,
      receivablesChange,
      payablesChange,
      operatingCashBeforeTax,
      incomeTaxPaid,
      netOperating,
      ppeMovement,
      intangiblesMovement,
      netInvesting,
      shareCapitalChange,
      effectiveDividendsPaid,
      finCostsPaid,
      netFinancing,
      netChangeInCash,
      openingCash,
      closingCash,
      actualClosingCash,
      currentInventory,
      priorInventory,
      currentReceivables,
      priorReceivables,
      currentPayables,
      currentPPE,
      priorPPE,
      currentIntangibles,
      priorIntangibles,
      currentShareCapital,
      priorShareCapital,
    };
  }, [draftFsData, fsPriorYear, trialBalance, coaAccounts]);

  const priorYearCashFlow = useMemo(() => {
    return {
      profitBeforeTax: 0,
      depreciation: 0,
      financeCosts: 0,
      financeIncome: 0,
      inventoryChange: 0,
      receivablesChange: 0,
      payablesChange: 0,
      operatingCashBeforeTax: 0,
      incomeTaxPaid: 0,
      netOperating: 0,
      ppeMovement: 0,
      intangiblesMovement: 0,
      netInvesting: 0,
      shareCapitalChange: 0,
      effectiveDividendsPaid: 0,
      finCostsPaid: 0,
      netFinancing: 0,
      netChangeInCash: 0,
      openingCash: 0,
      closingCash: parseNum(fsPriorYear.cashBankBalances),
    };
  }, [fsPriorYear]);

  const currency = trialBalance.currency || "PKR";

  const renderRow = (
    label: string,
    currentValue: number,
    priorValue: number,
    options?: {
      bold?: boolean;
      indent?: boolean;
      topBorder?: boolean;
      doubleBorder?: boolean;
      testId?: string;
      linkTab?: { tab: string; label: string };
    }
  ) => {
    const {
      bold = false,
      indent = false,
      topBorder = false,
      doubleBorder = false,
      testId,
      linkTab,
    } = options || {};

    return (
      <TableRow
        key={label}
        data-testid={testId || `row-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        className={
          (topBorder ? "border-t-2 border-foreground/20 " : "") +
          (doubleBorder ? "border-t-4 border-double border-foreground/30 " : "")
        }
      >
        <TableCell
          className={
            "border-r border-border " + (bold ? "font-semibold " : "") + (indent ? "pl-8 " : "")
          }
        >
          {label}
          {linkTab && onSwitchTab && (
            <button
              className="ml-2 text-xs text-primary hover:underline cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onSwitchTab(linkTab.tab); }}
              data-testid={`link-${testId || label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-to-${linkTab.tab}`}
            >
              &rarr; {linkTab.label}
            </button>
          )}
        </TableCell>
        <TableCell
          className={
            "text-right tabular-nums border-r border-border " + (bold ? "font-semibold " : "")
          }
          data-testid={`value-current-${(testId || label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        >
          {formatAccounting(currentValue)}
        </TableCell>
        <TableCell
          className={
            "text-right tabular-nums text-muted-foreground border-r border-border " +
            (bold ? "font-semibold " : "")
          }
          data-testid={`value-prior-${(testId || label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        >
          {formatAccounting(priorValue)}
        </TableCell>
      </TableRow>
    );
  };

  const renderSectionHeader = (label: string) => (
    <TableRow
      key={`header-${label}`}
      data-testid={`section-header-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
    >
      <TableCell
        colSpan={3}
        className="font-semibold text-sm bg-muted/50 py-2 border-r border-border"
      >
        {label}
      </TableCell>
    </TableRow>
  );

  const cashBadgeVariant =
    cashFlowData.netChangeInCash >= 0 ? "default" : "destructive";

  return (
    <div className="space-y-4" data-testid="fs-socf-container">
      <div className="print-only mb-4 text-center hidden print:block" data-testid="print-header">
        <h2 className="text-lg font-bold">{clientName}</h2>
        <h3 className="text-base font-semibold">Statement of Cash Flows</h3>
        <p className="text-sm text-muted-foreground">
          For the period ended {periodEnd}
        </p>
        <p className="text-xs text-muted-foreground">
          (Amounts in {currency})
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between" data-testid="socf-header-bar">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold" data-testid="text-socf-title">
            Statement of Cash Flows (IAS 7)
          </h3>
          <Badge variant="outline" data-testid="badge-indirect-method">
            Indirect Method
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSwitchTab && (
            <button
              className="text-xs text-primary hover:underline cursor-pointer"
              onClick={() => onSwitchTab("soce")}
              data-testid="link-socf-to-soce"
            >
              &rarr; SoCE
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="summary-cards">
        <Card data-testid="card-net-cash">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Net Cash Change
            </CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums" data-testid="value-net-cash-change">
              {formatAccounting(cashFlowData.netChangeInCash)}
            </div>
            <Badge
              variant={cashBadgeVariant}
              className="mt-1"
              data-testid="badge-net-cash-status"
            >
              {cashFlowData.netChangeInCash >= 0 ? "Increase" : "Decrease"}
            </Badge>
          </CardContent>
        </Card>

        <Card data-testid="card-operating">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Operating Activities
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums" data-testid="value-operating-total">
              {formatAccounting(cashFlowData.netOperating)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-investing">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Investing Activities
            </CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums" data-testid="value-investing-total">
              {formatAccounting(cashFlowData.netInvesting)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-financing">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Financing Activities
            </CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums" data-testid="value-financing-total">
              {formatAccounting(cashFlowData.netFinancing)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-cash-flow-statement">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
          <CardTitle className="text-sm" data-testid="text-cash-flow-heading">
            {clientName} &mdash; Statement of Cash Flows
          </CardTitle>
          <Badge variant="outline" data-testid="badge-currency">
            {currency}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table data-testid="table-cash-flow">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%] border-r border-border">Particulars</TableHead>
                <TableHead className="text-right border-r border-border" data-testid="col-current-year">
                  Current Year
                </TableHead>
                <TableHead className="text-right border-r border-border" data-testid="col-prior-year">
                  Prior Year
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderSectionHeader("A. Cash Flows from Operating Activities")}

              {renderRow(
                "Profit before tax",
                cashFlowData.profitBeforeTax,
                priorYearCashFlow.profitBeforeTax,
                { bold: true, testId: "profit-before-tax", linkTab: { tab: "profit-loss", label: "P&L" } }
              )}

              {renderSectionHeader("Adjustments for:")}

              {renderRow(
                "Depreciation & amortisation",
                cashFlowData.depreciation,
                priorYearCashFlow.depreciation,
                { indent: true, testId: "depreciation" }
              )}
              {renderRow(
                "Finance costs",
                cashFlowData.financeCosts,
                priorYearCashFlow.financeCosts,
                { indent: true, testId: "finance-costs" }
              )}
              {renderRow(
                "Finance income",
                -cashFlowData.financeIncome,
                -priorYearCashFlow.financeIncome,
                { indent: true, testId: "finance-income" }
              )}

              {renderSectionHeader("Working capital changes:")}

              {renderRow(
                "(Increase)/Decrease in inventories",
                cashFlowData.inventoryChange,
                priorYearCashFlow.inventoryChange,
                { indent: true, testId: "inventory-change" }
              )}
              {renderRow(
                "(Increase)/Decrease in trade receivables",
                cashFlowData.receivablesChange,
                priorYearCashFlow.receivablesChange,
                { indent: true, testId: "receivables-change" }
              )}
              {renderRow(
                "Increase/(Decrease) in trade payables",
                cashFlowData.payablesChange,
                priorYearCashFlow.payablesChange,
                { indent: true, testId: "payables-change" }
              )}

              {renderRow(
                "Cash generated from operations",
                cashFlowData.operatingCashBeforeTax,
                priorYearCashFlow.operatingCashBeforeTax,
                { bold: true, topBorder: true, testId: "cash-from-operations" }
              )}

              {renderRow(
                "Income tax paid",
                cashFlowData.incomeTaxPaid,
                priorYearCashFlow.incomeTaxPaid,
                { indent: true, testId: "income-tax-paid" }
              )}

              {renderRow(
                "Net cash from operating activities",
                cashFlowData.netOperating,
                priorYearCashFlow.netOperating,
                { bold: true, topBorder: true, testId: "net-operating" }
              )}

              {renderSectionHeader("B. Cash Flows from Investing Activities")}

              {renderRow(
                "Purchase of property, plant & equipment",
                cashFlowData.ppeMovement,
                priorYearCashFlow.ppeMovement,
                { indent: true, testId: "ppe-purchases" }
              )}
              {renderRow(
                "Purchase of intangible assets",
                cashFlowData.intangiblesMovement,
                priorYearCashFlow.intangiblesMovement,
                { indent: true, testId: "intangibles-purchases" }
              )}

              {renderRow(
                "Net cash used in investing activities",
                cashFlowData.netInvesting,
                priorYearCashFlow.netInvesting,
                { bold: true, topBorder: true, testId: "net-investing" }
              )}

              {renderSectionHeader("C. Cash Flows from Financing Activities")}

              {renderRow(
                "Proceeds from / (repayment of) share capital",
                cashFlowData.shareCapitalChange,
                priorYearCashFlow.shareCapitalChange,
                { indent: true, testId: "share-capital-change" }
              )}
              {renderRow(
                "Dividends paid",
                cashFlowData.effectiveDividendsPaid,
                priorYearCashFlow.effectiveDividendsPaid,
                { indent: true, testId: "dividends-paid" }
              )}
              {renderRow(
                "Finance costs paid",
                cashFlowData.finCostsPaid,
                priorYearCashFlow.finCostsPaid,
                { indent: true, testId: "finance-costs-paid" }
              )}

              {renderRow(
                "Net cash from / (used in) financing activities",
                cashFlowData.netFinancing,
                priorYearCashFlow.netFinancing,
                { bold: true, topBorder: true, testId: "net-financing" }
              )}

              {renderSectionHeader("D. Net Change in Cash and Cash Equivalents")}

              {renderRow(
                "Net increase / (decrease) in cash",
                cashFlowData.netChangeInCash,
                priorYearCashFlow.netChangeInCash,
                { bold: true, testId: "net-change-cash" }
              )}
              {renderRow(
                "Cash and cash equivalents at beginning of period",
                cashFlowData.openingCash,
                priorYearCashFlow.openingCash,
                { indent: true, testId: "opening-cash" }
              )}
              {renderRow(
                "Cash and cash equivalents at end of period",
                cashFlowData.closingCash,
                priorYearCashFlow.closingCash,
                { bold: true, doubleBorder: true, testId: "closing-cash", linkTab: { tab: "balance-sheet", label: "BS" } }
              )}

              {cashFlowData.actualClosingCash !== 0 && (
                <TableRow data-testid="row-actual-closing-cash">
                  <TableCell className="pl-8 text-xs text-muted-foreground italic border-r border-border">
                    Per Trial Balance (cash & bank)
                  </TableCell>
                  <TableCell
                    className="text-right tabular-nums text-xs text-muted-foreground border-r border-border"
                    data-testid="value-actual-closing-cash"
                  >
                    {formatAccounting(cashFlowData.actualClosingCash)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground border-r border-border">
                    -
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card data-testid="card-socf-note">
        <CardContent className="py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground" data-testid="text-socf-note">
            The above Statement of Cash Flows has been auto-derived using the
            indirect method (IAS 7) from available trial balance data, prior
            year figures, and FS head mappings. Figures are indicative and
            should be reviewed by the engagement team. Adjustments for
            non-cash items, working capital movements, and investing /
            financing activities are computed from period movements and may
            require manual refinement for items not captured in the current
            mapping (e.g., asset disposals, loan drawdowns, non-cash
            transactions).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
