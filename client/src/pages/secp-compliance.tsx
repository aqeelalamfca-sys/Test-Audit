import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { PageShell } from "@/components/page-shell";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileCheck,
  BarChart3,
  ClipboardList,
  Loader2,
  FileText,
  Download,
  Building2,
  Scale,
  XCircle,
  Clock,
  Eye,
  Gavel,
  BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type ComplianceStatus = "met" | "partial" | "not_met" | "na";

interface RegulatoryChecklistItem {
  id: string;
  section: string;
  title: string;
  description: string;
  category: string;
  status: ComplianceStatus;
  evidenceRef: string;
  notes: string;
}

interface OpinionTracker {
  engagementId: string;
  engagementName: string;
  clientName: string;
  yearEnd: string;
  opinionType: string;
  status: string;
  deliveredDate: string | null;
}

interface XBRLReadinessItem {
  id: string;
  requirement: string;
  category: string;
  ready: boolean;
  notes: string;
}

const COMPANIES_ACT_CHECKLIST: RegulatoryChecklistItem[] = [
  {
    id: "s223",
    section: "S.223",
    title: "Books of Account",
    description: "Every company shall keep proper books of account with respect to all sums of money received and expended, all sales and purchases, and assets and liabilities.",
    category: "Financial Records",
    status: "met",
    evidenceRef: "Trial Balance / GL Records",
    notes: "",
  },
  {
    id: "s225",
    section: "S.225",
    title: "Financial Statements Preparation",
    description: "Directors shall prepare financial statements for every financial year which give a true and fair view of the state of affairs and profit or loss.",
    category: "Financial Statements",
    status: "met",
    evidenceRef: "Draft FS / Board Approval",
    notes: "",
  },
  {
    id: "s226",
    section: "S.226",
    title: "Auditor Rights",
    description: "Auditor has right of access at all times to the books, accounts and vouchers of the company, and is entitled to require information and explanations.",
    category: "Audit Rights",
    status: "met",
    evidenceRef: "Management Representation Letter",
    notes: "",
  },
  {
    id: "s227",
    section: "S.227",
    title: "Audit Report Requirements",
    description: "Auditor shall make a report to the members on the accounts examined. Report must state whether FS give a true and fair view per applicable framework.",
    category: "Reporting",
    status: "met",
    evidenceRef: "Audit Report Draft",
    notes: "",
  },
  {
    id: "s228",
    section: "S.228",
    title: "Auditor Qualifications",
    description: "Only qualified persons (practicing chartered accountants) meeting independence criteria can be appointed as auditors.",
    category: "Independence",
    status: "met",
    evidenceRef: "Ethics & Independence Declaration",
    notes: "",
  },
  {
    id: "s204",
    section: "S.204",
    title: "Related Party Transactions - Disclosure",
    description: "Every company shall maintain a register of related party transactions and disclose them in financial statements.",
    category: "Related Parties",
    status: "partial",
    evidenceRef: "FS Note on Related Parties",
    notes: "",
  },
  {
    id: "s205",
    section: "S.205",
    title: "Related Party Transactions - Board Approval",
    description: "Related party transactions must be approved by the board of directors with interested directors not participating.",
    category: "Related Parties",
    status: "partial",
    evidenceRef: "Board Minutes",
    notes: "",
  },
  {
    id: "s206",
    section: "S.206",
    title: "Related Party Transactions - Arm's Length",
    description: "Related party transactions shall be carried out at arm's length price and on arm's length terms.",
    category: "Related Parties",
    status: "partial",
    evidenceRef: "Transfer Pricing Documentation",
    notes: "",
  },
  {
    id: "s233",
    section: "S.233",
    title: "Declaration and Payment of Dividend",
    description: "Dividend shall be declared or paid only out of profits and in accordance with the provisions of this Act.",
    category: "Dividends & Reserves",
    status: "met",
    evidenceRef: "Board Resolution / FS Appropriation",
    notes: "",
  },
  {
    id: "s234",
    section: "S.234",
    title: "Unpaid Dividend Account",
    description: "Any dividend that remains unpaid after 30 days of declaration shall be transferred to a separate unpaid dividend account.",
    category: "Dividends & Reserves",
    status: "na",
    evidenceRef: "",
    notes: "",
  },
  {
    id: "s235",
    section: "S.235",
    title: "Transfer to Reserve Fund",
    description: "Where applicable, a portion of profits to be transferred to reserve fund before dividend declaration.",
    category: "Dividends & Reserves",
    status: "met",
    evidenceRef: "FS Statement of Changes in Equity",
    notes: "",
  },
  {
    id: "s236",
    section: "S.236",
    title: "Bonus Shares",
    description: "A company may issue bonus shares if authorized by its articles and approved by the members by a special resolution.",
    category: "Dividends & Reserves",
    status: "na",
    evidenceRef: "",
    notes: "",
  },
  {
    id: "s230",
    section: "S.230",
    title: "Directors Report",
    description: "Directors shall attach to every balance sheet a report with respect to state of company affairs, amount of dividend recommended, and material changes.",
    category: "Reporting",
    status: "met",
    evidenceRef: "Directors Report Draft",
    notes: "",
  },
  {
    id: "s247",
    section: "S.247",
    title: "Annual Return",
    description: "Every company shall file annual return with the registrar within the prescribed period.",
    category: "Regulatory Filing",
    status: "met",
    evidenceRef: "SECP Filing Record",
    notes: "",
  },
  {
    id: "fourth_schedule",
    section: "Fourth Schedule",
    title: "Form and Contents of Financial Statements",
    description: "Financial statements shall comply with the Fourth Schedule requirements regarding form, content, and disclosures.",
    category: "Financial Statements",
    status: "met",
    evidenceRef: "FS Disclosure Checklist",
    notes: "",
  },
];

const XBRL_READINESS_ITEMS: XBRLReadinessItem[] = [
  { id: "xbrl1", requirement: "XBRL Taxonomy Mapping Complete", category: "Data Preparation", ready: false, notes: "SECP XBRL taxonomy alignment pending" },
  { id: "xbrl2", requirement: "Chart of Accounts Tagged", category: "Data Preparation", ready: false, notes: "CoA to XBRL element mapping required" },
  { id: "xbrl3", requirement: "Financial Statement Elements Identified", category: "Data Preparation", ready: true, notes: "All FS line items identified from trial balance" },
  { id: "xbrl4", requirement: "Disclosure Notes Structured", category: "Content", ready: false, notes: "Notes need structured data format" },
  { id: "xbrl5", requirement: "Validation Rules Applied", category: "Quality", ready: false, notes: "XBRL validation formulas not yet applied" },
  { id: "xbrl6", requirement: "Instance Document Generation", category: "Output", ready: false, notes: "XBRL instance document generation not configured" },
  { id: "xbrl7", requirement: "Filing Format Compliance", category: "Output", ready: false, notes: "SECP e-filing format compliance check pending" },
  { id: "xbrl8", requirement: "Comparative Data Available", category: "Data Preparation", ready: true, notes: "Prior year data available in system" },
];

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  met: { label: "Met", color: "bg-green-500", icon: CheckCircle2 },
  partial: { label: "Partial", color: "bg-amber-500", icon: AlertTriangle },
  not_met: { label: "Not Met", color: "bg-red-500", icon: XCircle },
  na: { label: "N/A", color: "bg-gray-400", icon: Clock },
};

const VIEW_TABS = [
  { id: "overview", label: "Overview", icon: <Shield className="w-3.5 h-3.5" /> },
  { id: "checklist", label: "Regulatory Checklist", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "opinions", label: "Opinion Tracker", icon: <Gavel className="w-3.5 h-3.5" /> },
  { id: "xbrl", label: "XBRL Readiness", icon: <FileCheck className="w-3.5 h-3.5" /> },
  { id: "export", label: "Compliance Export", icon: <Download className="w-3.5 h-3.5" /> },
];

function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">{message}</span>
    </div>
  );
}

function StatusBadgeDisplay({ status }: { status: ComplianceStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge className={`text-[10px] ${config.color} text-white border-0 no-default-hover-elevate no-default-active-elevate`} data-testid={`badge-compliance-${status}`}>
      {config.label}
    </Badge>
  );
}

function KPICard({ title, value, subtitle, color, icon, testId }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  icon: React.ReactNode;
  testId: string;
}) {
  const colorClasses = useMemo(() => {
    switch (color) {
      case "green": return { bg: "bg-green-100 dark:bg-green-950/40 text-green-600", text: "text-green-600" };
      case "red": return { bg: "bg-red-100 dark:bg-red-950/40 text-red-600", text: "text-red-600" };
      case "amber": return { bg: "bg-amber-100 dark:bg-amber-950/40 text-amber-600", text: "text-amber-600" };
      default: return { bg: "bg-muted text-muted-foreground", text: "" };
    }
  }, [color]);

  return (
    <Card className="p-3" data-testid={testId}>
      <div className="flex items-start gap-2">
        <div className={`p-1.5 rounded-md ${colorClasses.bg}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{title}</div>
          <div className={`text-xl font-bold ${colorClasses.text}`} data-testid={`${testId}-value`}>{value}</div>
          {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </Card>
  );
}

function OverviewTab({ checklist, engagements, xbrlItems }: {
  checklist: RegulatoryChecklistItem[];
  engagements: OpinionTracker[];
  xbrlItems: XBRLReadinessItem[];
}) {
  const met = checklist.filter(c => c.status === "met").length;
  const partial = checklist.filter(c => c.status === "partial").length;
  const notMet = checklist.filter(c => c.status === "not_met").length;
  const applicable = checklist.filter(c => c.status !== "na").length;
  const compliancePct = applicable > 0 ? Math.round((met / applicable) * 100) : 0;

  const totalEngagements = engagements.length;
  const issuedCount = engagements.filter(e => e.status === "ISSUED").length;
  const unmodifiedCount = engagements.filter(e => e.opinionType === "UNMODIFIED").length;
  const modifiedCount = engagements.filter(e => ["QUALIFIED", "ADVERSE", "DISCLAIMER"].includes(e.opinionType)).length;

  const xbrlReady = xbrlItems.filter(x => x.ready).length;
  const xbrlTotal = xbrlItems.length;
  const xbrlPct = xbrlTotal > 0 ? Math.round((xbrlReady / xbrlTotal) * 100) : 0;

  const categories = [...new Set(checklist.map(c => c.category))];
  const categoryStats = categories.map(cat => {
    const items = checklist.filter(c => c.category === cat);
    const catApplicable = items.filter(c => c.status !== "na").length;
    const catMet = items.filter(c => c.status === "met").length;
    return { category: cat, total: items.length, met: catMet, applicable: catApplicable, pct: catApplicable > 0 ? Math.round((catMet / catApplicable) * 100) : 100 };
  });

  return (
    <div className="space-y-4" data-testid="tab-secp-overview">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          title="Compliance Score"
          value={`${compliancePct}%`}
          subtitle={`${met}/${applicable} requirements met`}
          color={compliancePct >= 90 ? "green" : compliancePct >= 70 ? "amber" : "red"}
          icon={<Shield className="w-4 h-4" />}
          testId="kpi-compliance-score"
        />
        <KPICard
          title="Partial Compliance"
          value={partial}
          color={partial > 0 ? "amber" : "green"}
          icon={<AlertTriangle className="w-4 h-4" />}
          testId="kpi-partial"
        />
        <KPICard
          title="Non-Compliant"
          value={notMet}
          color={notMet > 0 ? "red" : "green"}
          icon={<XCircle className="w-4 h-4" />}
          testId="kpi-non-compliant"
        />
        <KPICard
          title="Engagements"
          value={totalEngagements}
          subtitle={`${issuedCount} issued`}
          color="neutral"
          icon={<Building2 className="w-4 h-4" />}
          testId="kpi-engagements"
        />
        <KPICard
          title="Opinions"
          value={`${unmodifiedCount}U / ${modifiedCount}M`}
          subtitle="Unmodified / Modified"
          color={modifiedCount > 0 ? "amber" : "green"}
          icon={<Gavel className="w-4 h-4" />}
          testId="kpi-opinions"
        />
        <KPICard
          title="XBRL Ready"
          value={`${xbrlPct}%`}
          subtitle={`${xbrlReady}/${xbrlTotal} items`}
          color={xbrlPct >= 80 ? "green" : xbrlPct >= 50 ? "amber" : "red"}
          icon={<FileCheck className="w-4 h-4" />}
          testId="kpi-xbrl"
        />
      </div>

      <Card data-testid="category-breakdown">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Compliance by Category
          </CardTitle>
          <CardDescription>Companies Act 2017 requirement categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryStats.map(cat => (
              <div key={cat.category} className="flex items-center gap-3" data-testid={`category-${cat.category.replace(/\s+/g, '-').toLowerCase()}`}>
                <div className="w-40 text-sm font-medium truncate flex-shrink-0">{cat.category}</div>
                <div className="flex-1">
                  <Progress value={cat.pct} className="h-2" />
                </div>
                <div className="w-20 text-right text-sm font-semibold flex-shrink-0">
                  {cat.pct}% <span className="text-[10px] text-muted-foreground">({cat.met}/{cat.applicable})</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="recent-opinions">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gavel className="w-4 h-4" />
              Recent Audit Opinions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Opinion</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {engagements.slice(0, 5).map(eng => (
                  <TableRow key={eng.engagementId} data-testid={`opinion-row-${eng.engagementId}`}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{eng.engagementName || eng.clientName}</div>
                      <div className="text-[10px] text-muted-foreground">{eng.yearEnd}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" data-testid={`badge-opinion-${eng.engagementId}`}>
                        {(eng.opinionType || "PENDING").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 no-default-hover-elevate no-default-active-elevate ${eng.status === "ISSUED" ? "bg-green-500 text-white" : eng.status === "FINAL" ? "bg-blue-500 text-white" : "bg-gray-400 text-white"}`}>
                        {eng.status || "DRAFT"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {engagements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      No engagement data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card data-testid="xbrl-summary">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              XBRL Readiness Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Progress value={xbrlPct} className="flex-1 h-3" />
                <span className="text-sm font-semibold">{xbrlPct}%</span>
              </div>
              {xbrlItems.map(item => (
                <div key={item.id} className="flex items-center gap-2" data-testid={`xbrl-item-${item.id}`}>
                  {item.ready ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-sm flex-1">{item.requirement}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RegulatoryChecklistTab({ checklist, onStatusChange }: {
  checklist: RegulatoryChecklistItem[];
  onStatusChange: (id: string, status: ComplianceStatus) => void;
}) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const categories = useMemo(() => [...new Set(checklist.map(c => c.category))], [checklist]);

  const filtered = useMemo(() => {
    return checklist.filter(item => {
      if (filterCategory !== "all" && item.category !== filterCategory) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      return true;
    });
  }, [checklist, filterCategory, filterStatus]);

  return (
    <div className="space-y-4" data-testid="tab-regulatory-checklist">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48" data-testid="select-filter-category">
            <SelectValue placeholder="Filter by Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40" data-testid="select-filter-status">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="met">Met</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="not_met">Not Met</SelectItem>
            <SelectItem value="na">N/A</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          Showing {filtered.length} of {checklist.length} items
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Section</TableHead>
                <TableHead className="w-48">Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-40">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => (
                <TableRow key={item.id} data-testid={`checklist-row-${item.id}`}>
                  <TableCell className="font-mono font-semibold text-sm">{item.section}</TableCell>
                  <TableCell className="font-medium text-sm">{item.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.status}
                      onValueChange={(val: ComplianceStatus) => onStatusChange(item.id, val)}
                    >
                      <SelectTrigger className="h-7 text-[10px] w-24" data-testid={`select-status-${item.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="met">Met</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="not_met">Not Met</SelectItem>
                        <SelectItem value="na">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.evidenceRef || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function OpinionTrackerTab({ engagements }: { engagements: OpinionTracker[] }) {
  const opinionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    engagements.forEach(e => {
      const opinion = e.opinionType || "PENDING";
      counts[opinion] = (counts[opinion] || 0) + 1;
    });
    return counts;
  }, [engagements]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    engagements.forEach(e => {
      const status = e.status || "DRAFT";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [engagements]);

  const opinionColors: Record<string, string> = {
    UNMODIFIED: "bg-green-500",
    QUALIFIED: "bg-amber-500",
    ADVERSE: "bg-red-500",
    DISCLAIMER: "bg-red-700",
    NOT_APPLICABLE: "bg-gray-400",
    PENDING: "bg-gray-400",
  };

  return (
    <div className="space-y-4" data-testid="tab-opinion-tracker">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(opinionBreakdown).map(([opinion, count]) => (
          <Card key={opinion} className="p-3" data-testid={`opinion-count-${opinion.toLowerCase()}`}>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{opinion.replace(/_/g, " ")}</div>
            <div className="text-2xl font-bold mt-1">{count}</div>
            <div className={`w-full h-1 rounded-full mt-2 ${opinionColors[opinion] || "bg-gray-300"}`} />
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Engagement Opinion Register
          </CardTitle>
          <CardDescription>Track audit opinions across all engagements</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engagement</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Year End</TableHead>
                <TableHead>Opinion Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivered Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {engagements.map(eng => (
                <TableRow key={eng.engagementId} data-testid={`opinion-detail-${eng.engagementId}`}>
                  <TableCell className="font-medium text-sm">{eng.engagementName || "-"}</TableCell>
                  <TableCell className="text-sm">{eng.clientName || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{eng.yearEnd || "-"}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] border-0 text-white no-default-hover-elevate no-default-active-elevate ${opinionColors[eng.opinionType] || opinionColors.PENDING}`}>
                      {(eng.opinionType || "PENDING").replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {eng.status || "DRAFT"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {eng.deliveredDate ? new Date(eng.deliveredDate).toLocaleDateString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {engagements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No engagement data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function XBRLReadinessTab({ xbrlItems, onToggle }: { xbrlItems: XBRLReadinessItem[]; onToggle: (id: string) => void }) {
  const readyCount = xbrlItems.filter(x => x.ready).length;
  const total = xbrlItems.length;
  const pct = total > 0 ? Math.round((readyCount / total) * 100) : 0;

  const categories = [...new Set(xbrlItems.map(x => x.category))];

  return (
    <div className="space-y-4" data-testid="tab-xbrl-readiness">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                XBRL Readiness Assessment
              </CardTitle>
              <CardDescription>SECP XBRL filing readiness indicators</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={pct} className="w-32 h-2" />
              <span className="text-sm font-bold">{pct}%</span>
              <Badge className={`text-[10px] border-0 text-white no-default-hover-elevate no-default-active-elevate ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                {pct >= 80 ? "Ready" : pct >= 50 ? "In Progress" : "Not Ready"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {categories.map(cat => (
            <div key={cat} className="mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{cat}</h3>
              <div className="space-y-2">
                {xbrlItems.filter(x => x.category === cat).map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-md border"
                    data-testid={`xbrl-readiness-${item.id}`}
                  >
                    <button
                      onClick={() => onToggle(item.id)}
                      className="flex-shrink-0"
                      data-testid={`button-toggle-${item.id}`}
                    >
                      {item.ready ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{item.requirement}</div>
                      <div className="text-xs text-muted-foreground">{item.notes}</div>
                    </div>
                    <StatusBadgeDisplay status={item.ready ? "met" : "not_met"} />
                  </div>
                ))}
              </div>
              <Separator className="mt-3" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceExportTab({ checklist, engagements, xbrlItems }: {
  checklist: RegulatoryChecklistItem[];
  engagements: OpinionTracker[];
  xbrlItems: XBRLReadinessItem[];
}) {
  const { toast } = useToast();

  const handleExport = (format: string) => {
    const met = checklist.filter(c => c.status === "met").length;
    const applicable = checklist.filter(c => c.status !== "na").length;
    const compliancePct = applicable > 0 ? Math.round((met / applicable) * 100) : 0;

    const lines: string[] = [];
    lines.push("SECP COMPLIANCE REPORT");
    lines.push("=" .repeat(60));
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Overall Compliance: ${compliancePct}% (${met}/${applicable} requirements met)`);
    lines.push("");

    lines.push("REGULATORY CHECKLIST - COMPANIES ACT 2017");
    lines.push("-".repeat(60));
    checklist.forEach(item => {
      lines.push(`[${item.status.toUpperCase().padEnd(7)}] ${item.section} - ${item.title}`);
      if (item.evidenceRef) lines.push(`          Evidence: ${item.evidenceRef}`);
    });
    lines.push("");

    lines.push("ENGAGEMENT OPINION TRACKER");
    lines.push("-".repeat(60));
    engagements.forEach(eng => {
      lines.push(`${eng.engagementName || eng.clientName} | ${eng.yearEnd} | Opinion: ${eng.opinionType || "PENDING"} | Status: ${eng.status || "DRAFT"}`);
    });
    lines.push("");

    lines.push("XBRL READINESS");
    lines.push("-".repeat(60));
    xbrlItems.forEach(item => {
      lines.push(`[${item.ready ? "READY  " : "PENDING"}] ${item.requirement}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `secp-compliance-report-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: "SECP compliance report downloaded successfully." });
  };

  const met = checklist.filter(c => c.status === "met").length;
  const partial = checklist.filter(c => c.status === "partial").length;
  const notMet = checklist.filter(c => c.status === "not_met").length;
  const applicable = checklist.filter(c => c.status !== "na").length;
  const xbrlReady = xbrlItems.filter(x => x.ready).length;

  return (
    <div className="space-y-4" data-testid="tab-compliance-export">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" />
            Compliance Export Summary
          </CardTitle>
          <CardDescription>Export comprehensive SECP compliance data for regulatory submission</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Regulatory Compliance Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requirements Met</span>
                  <span className="font-medium text-green-600">{met}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Partially Met</span>
                  <span className="font-medium text-amber-600">{partial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Not Met</span>
                  <span className="font-medium text-red-600">{notMet}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total Applicable</span>
                  <span>{applicable}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Filing Readiness</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Engagements Tracked</span>
                  <span className="font-medium">{engagements.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reports Issued</span>
                  <span className="font-medium">{engagements.filter(e => e.status === "ISSUED").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">XBRL Items Ready</span>
                  <span className="font-medium">{xbrlReady}/{xbrlItems.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>XBRL Readiness</span>
                  <span>{xbrlItems.length > 0 ? Math.round((xbrlReady / xbrlItems.length) * 100) : 0}%</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => handleExport("txt")} data-testid="button-export-txt">
              <Download className="w-4 h-4 mr-2" />
              Export Report (TXT)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SECPCompliancePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [checklist, setChecklist] = useState<RegulatoryChecklistItem[]>(COMPANIES_ACT_CHECKLIST);
  const [xbrlItems, setXbrlItems] = useState<XBRLReadinessItem[]>(XBRL_READINESS_ITEMS);

  const engagementsQuery = useQuery<any[]>({
    queryKey: ["/api/engagements"],
  });

  const deliverableEngagements: OpinionTracker[] = useMemo(() => {
    if (!engagementsQuery.data) return [];
    return engagementsQuery.data.map((eng: any) => ({
      engagementId: eng.id,
      engagementName: eng.engagementName || eng.name || "",
      clientName: eng.clientName || "",
      yearEnd: eng.yearEnd ? new Date(eng.yearEnd).toLocaleDateString() : "",
      opinionType: eng.opinionType || "NOT_APPLICABLE",
      status: eng.status || "DRAFT",
      deliveredDate: eng.deliveredDate || null,
    }));
  }, [engagementsQuery.data]);

  const handleStatusChange = (id: string, status: ComplianceStatus) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  const handleXbrlToggle = (id: string) => {
    setXbrlItems(prev => prev.map(item => item.id === id ? { ...item, ready: !item.ready } : item));
  };

  return (
    <PageShell
      title="SECP Compliance Dashboard"
      description="Securities and Exchange Commission of Pakistan — Regulatory compliance tracking, opinion monitoring, and XBRL readiness"
      icon={<Scale className="w-5 h-5" />}
      testId="page-secp-compliance"
    >
      <div className="space-y-4">
        <SimpleTabNavigation
          tabs={VIEW_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {engagementsQuery.isLoading ? (
          <LoadingState message="Loading compliance data..." />
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewTab
                checklist={checklist}
                engagements={deliverableEngagements}
                xbrlItems={xbrlItems}
              />
            )}
            {activeTab === "checklist" && (
              <RegulatoryChecklistTab
                checklist={checklist}
                onStatusChange={handleStatusChange}
              />
            )}
            {activeTab === "opinions" && (
              <OpinionTrackerTab engagements={deliverableEngagements} />
            )}
            {activeTab === "xbrl" && (
              <XBRLReadinessTab
                xbrlItems={xbrlItems}
                onToggle={handleXbrlToggle}
              />
            )}
            {activeTab === "export" && (
              <ComplianceExportTab
                checklist={checklist}
                engagements={deliverableEngagements}
                xbrlItems={xbrlItems}
              />
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
