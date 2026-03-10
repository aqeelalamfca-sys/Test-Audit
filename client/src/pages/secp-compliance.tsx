import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { PageShell } from "@/components/page-shell";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  BarChart3,
  ClipboardList,
  Loader2,
  Download,
  Building2,
  Scale,
  Clock,
  Gavel,
  Save,
  FileSpreadsheet,
  FileText,
  Eye,
  Search,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ComplianceStatus = "met" | "partial" | "not_met" | "na";
type BackendStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "NOT_APPLICABLE";

function toBackendStatus(s: ComplianceStatus): BackendStatus {
  switch (s) {
    case "met": return "COMPLETED";
    case "partial": return "IN_PROGRESS";
    case "not_met": return "PENDING";
    case "na": return "NOT_APPLICABLE";
  }
}

function fromBackendStatus(s: string): ComplianceStatus {
  switch (s) {
    case "COMPLETED": return "met";
    case "IN_PROGRESS": return "partial";
    case "PENDING": return "not_met";
    case "NOT_APPLICABLE": return "na";
    default: return "not_met";
  }
}

interface ChecklistItem {
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
  reportReference: string | null;
}

interface XBRLItem {
  id: string;
  requirement: string;
  category: string;
  ready: boolean;
  notes: string;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "s223", section: "S.223", title: "Books of Account", description: "Every company shall keep proper books of account with respect to all sums of money received and expended, all sales and purchases, and assets and liabilities.", category: "Financial Records", status: "not_met", evidenceRef: "Trial Balance / GL Records", notes: "" },
  { id: "s225", section: "S.225", title: "Financial Statements Preparation", description: "Directors shall prepare financial statements for every financial year which give a true and fair view of the state of affairs and profit or loss.", category: "Financial Statements", status: "not_met", evidenceRef: "Draft FS / Board Approval", notes: "" },
  { id: "s226", section: "S.226", title: "Auditor Rights", description: "Auditor has right of access at all times to the books, accounts and vouchers of the company, and is entitled to require information and explanations.", category: "Audit Rights", status: "not_met", evidenceRef: "Management Representation Letter", notes: "" },
  { id: "s227", section: "S.227", title: "Audit Report Requirements", description: "Auditor shall make a report to the members on the accounts examined. Report must state whether FS give a true and fair view per applicable framework.", category: "Reporting", status: "not_met", evidenceRef: "Audit Report Draft", notes: "" },
  { id: "s228", section: "S.228", title: "Auditor Qualifications", description: "Only qualified persons (practicing chartered accountants) meeting independence criteria can be appointed as auditors.", category: "Independence", status: "not_met", evidenceRef: "Ethics & Independence Declaration", notes: "" },
  { id: "s204", section: "S.204", title: "Related Party Transactions - Disclosure", description: "Every company shall maintain a register of related party transactions and disclose them in financial statements.", category: "Related Parties", status: "not_met", evidenceRef: "FS Note on Related Parties", notes: "" },
  { id: "s205", section: "S.205", title: "Related Party Transactions - Board Approval", description: "Related party transactions must be approved by the board of directors with interested directors not participating.", category: "Related Parties", status: "not_met", evidenceRef: "Board Minutes", notes: "" },
  { id: "s206", section: "S.206", title: "Related Party Transactions - Arm's Length", description: "Related party transactions shall be carried out at arm's length price and on arm's length terms.", category: "Related Parties", status: "not_met", evidenceRef: "Transfer Pricing Documentation", notes: "" },
  { id: "s233", section: "S.233", title: "Declaration and Payment of Dividend", description: "Dividend shall be declared or paid only out of profits and in accordance with the provisions of this Act.", category: "Dividends & Reserves", status: "not_met", evidenceRef: "Board Resolution / FS Appropriation", notes: "" },
  { id: "s234", section: "S.234", title: "Unpaid Dividend Account", description: "Any dividend that remains unpaid after 30 days of declaration shall be transferred to a separate unpaid dividend account.", category: "Dividends & Reserves", status: "not_met", evidenceRef: "", notes: "" },
  { id: "s235", section: "S.235", title: "Transfer to Reserve Fund", description: "Where applicable, a portion of profits to be transferred to reserve fund before dividend declaration.", category: "Dividends & Reserves", status: "not_met", evidenceRef: "FS Statement of Changes in Equity", notes: "" },
  { id: "s236", section: "S.236", title: "Bonus Shares", description: "A company may issue bonus shares if authorized by its articles and approved by the members by a special resolution.", category: "Dividends & Reserves", status: "not_met", evidenceRef: "", notes: "" },
  { id: "s230", section: "S.230", title: "Directors Report", description: "Directors shall attach to every balance sheet a report with respect to state of company affairs, amount of dividend recommended, and material changes.", category: "Reporting", status: "not_met", evidenceRef: "Directors Report Draft", notes: "" },
  { id: "s247", section: "S.247", title: "Annual Return", description: "Every company shall file annual return with the registrar within the prescribed period.", category: "Regulatory Filing", status: "not_met", evidenceRef: "SECP Filing Record", notes: "" },
  { id: "fourth_schedule", section: "Fourth Schedule", title: "Form and Contents of Financial Statements", description: "Financial statements shall comply with the Fourth Schedule requirements regarding form, content, and disclosures.", category: "Financial Statements", status: "not_met", evidenceRef: "FS Disclosure Checklist", notes: "" },
];

const DEFAULT_XBRL: XBRLItem[] = [
  { id: "xbrl1", requirement: "XBRL Taxonomy Mapping Complete", category: "Data Preparation", ready: false, notes: "SECP XBRL taxonomy alignment pending" },
  { id: "xbrl2", requirement: "Chart of Accounts Tagged", category: "Data Preparation", ready: false, notes: "CoA to XBRL element mapping required" },
  { id: "xbrl3", requirement: "Financial Statement Elements Identified", category: "Data Preparation", ready: false, notes: "All FS line items identified from trial balance" },
  { id: "xbrl4", requirement: "Disclosure Notes Structured", category: "Content", ready: false, notes: "Notes need structured data format" },
  { id: "xbrl5", requirement: "Validation Rules Applied", category: "Quality", ready: false, notes: "XBRL validation formulas not yet applied" },
  { id: "xbrl6", requirement: "Instance Document Generation", category: "Output", ready: false, notes: "XBRL instance document generation not configured" },
  { id: "xbrl7", requirement: "Filing Format Compliance", category: "Output", ready: false, notes: "SECP e-filing format compliance check pending" },
  { id: "xbrl8", requirement: "Comparative Data Available", category: "Data Preparation", ready: false, notes: "Prior year data available in system" },
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
  checklist: ChecklistItem[];
  engagements: OpinionTracker[];
  xbrlItems: XBRLItem[];
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
        <KPICard title="Compliance Score" value={`${compliancePct}%`} subtitle={`${met}/${applicable} requirements met`} color={compliancePct >= 90 ? "green" : compliancePct >= 70 ? "amber" : "red"} icon={<Shield className="w-4 h-4" />} testId="kpi-compliance-score" />
        <KPICard title="Partial Compliance" value={partial} color={partial > 0 ? "amber" : "green"} icon={<AlertTriangle className="w-4 h-4" />} testId="kpi-partial" />
        <KPICard title="Non-Compliant" value={notMet} color={notMet > 0 ? "red" : "green"} icon={<XCircle className="w-4 h-4" />} testId="kpi-non-compliant" />
        <KPICard title="Engagements" value={totalEngagements} subtitle={`${issuedCount} issued`} color="neutral" icon={<Building2 className="w-4 h-4" />} testId="kpi-engagements" />
        <KPICard title="Opinions" value={`${unmodifiedCount}U / ${modifiedCount}M`} subtitle="Unmodified / Modified" color={modifiedCount > 0 ? "amber" : "green"} icon={<Gavel className="w-4 h-4" />} testId="kpi-opinions" />
        <KPICard title="XBRL Ready" value={`${xbrlPct}%`} subtitle={`${xbrlReady}/${xbrlTotal} items`} color={xbrlPct >= 80 ? "green" : xbrlPct >= 50 ? "amber" : "red"} icon={<FileCheck className="w-4 h-4" />} testId="kpi-xbrl" />
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
                      <div className="text-[10px] text-muted-foreground">{eng.yearEnd ? new Date(eng.yearEnd).toLocaleDateString() : "-"}</div>
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

function RegulatoryChecklistTab({ checklist, onStatusChange, onNotesChange, onSave, isSaving, hasChanges }: {
  checklist: ChecklistItem[];
  onStatusChange: (id: string, status: ComplianceStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
}) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(checklist.map(c => c.category))], [checklist]);

  const filtered = useMemo(() => {
    return checklist.filter(item => {
      if (filterCategory !== "all" && item.category !== filterCategory) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return item.title.toLowerCase().includes(term) ||
          item.section.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term);
      }
      return true;
    });
  }, [checklist, filterCategory, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const met = checklist.filter(c => c.status === "met").length;
    const partial = checklist.filter(c => c.status === "partial").length;
    const notMet = checklist.filter(c => c.status === "not_met").length;
    const na = checklist.filter(c => c.status === "na").length;
    return { met, partial, notMet, na };
  }, [checklist]);

  return (
    <div className="space-y-4" data-testid="tab-regulatory-checklist">
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-2 text-center">
          <div className="text-lg font-bold text-green-600">{stats.met}</div>
          <div className="text-[10px] text-muted-foreground">Met</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-lg font-bold text-amber-600">{stats.partial}</div>
          <div className="text-[10px] text-muted-foreground">Partial</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-lg font-bold text-red-600">{stats.notMet}</div>
          <div className="text-[10px] text-muted-foreground">Not Met</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-lg font-bold text-gray-500">{stats.na}</div>
          <div className="text-[10px] text-muted-foreground">N/A</div>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requirements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
            data-testid="input-search-checklist"
          />
        </div>

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

        <span className="text-sm text-muted-foreground">
          Showing {filtered.length} of {checklist.length} items
        </span>

        <div className="ml-auto">
          <Button
            onClick={onSave}
            disabled={isSaving || !hasChanges}
            size="sm"
            data-testid="button-save-checklist"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {hasChanges ? "Save Changes" : "Saved"}
          </Button>
        </div>
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
                <TableHead className="w-48">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => (
                <TableRow key={item.id} data-testid={`checklist-row-${item.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}>
                  <TableCell className="font-mono font-semibold text-sm">{item.section}</TableCell>
                  <TableCell className="font-medium text-sm">{item.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {expandedRow === item.id ? item.description : (item.description.length > 80 ? item.description.slice(0, 80) + "..." : item.description)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={item.status}
                      onValueChange={(val: string) => onStatusChange(item.id, val as ComplianceStatus)}
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Textarea
                      value={item.notes}
                      onChange={(e) => onNotesChange(item.id, e.target.value)}
                      placeholder="Add notes..."
                      className="h-8 min-h-[32px] text-xs resize-none"
                      data-testid={`input-notes-${item.id}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    No items match your filters
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

function OpinionTrackerTab({ engagements, isLoading }: { engagements: OpinionTracker[]; isLoading: boolean }) {
  const [filterOpinion, setFilterOpinion] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedEngagement, setSelectedEngagement] = useState<OpinionTracker | null>(null);

  const opinionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    engagements.forEach(e => {
      const opinion = e.opinionType || "PENDING";
      counts[opinion] = (counts[opinion] || 0) + 1;
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

  const filtered = useMemo(() => {
    return engagements.filter(eng => {
      if (filterOpinion !== "all" && (eng.opinionType || "PENDING") !== filterOpinion) return false;
      if (filterStatus !== "all") {
        const engStatus = eng.status || "DRAFT";
        if (engStatus !== filterStatus) return false;
      }
      return true;
    });
  }, [engagements, filterOpinion, filterStatus]);

  const uniqueStatuses = useMemo(() => {
    return [...new Set(engagements.map(e => e.status || "DRAFT"))];
  }, [engagements]);

  if (isLoading) return <LoadingState message="Loading opinion data..." />;

  return (
    <div className="space-y-4" data-testid="tab-opinion-tracker">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(opinionBreakdown).map(([opinion, count]) => (
          <Card
            key={opinion}
            className={`p-3 cursor-pointer transition-all ${filterOpinion === opinion ? "ring-2 ring-primary" : "hover:shadow-md"}`}
            data-testid={`opinion-count-${opinion.toLowerCase()}`}
            onClick={() => setFilterOpinion(filterOpinion === opinion ? "all" : opinion)}
          >
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{opinion.replace(/_/g, " ")}</div>
            <div className="text-2xl font-bold mt-1">{count}</div>
            <div className={`w-full h-1 rounded-full mt-2 ${opinionColors[opinion] || "bg-gray-300"}`} />
          </Card>
        ))}
        {Object.keys(opinionBreakdown).length === 0 && (
          <Card className="p-3 col-span-full">
            <div className="text-sm text-muted-foreground text-center py-4">No engagement opinions available</div>
          </Card>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterOpinion} onValueChange={setFilterOpinion}>
          <SelectTrigger className="w-48" data-testid="select-filter-opinion">
            <SelectValue placeholder="Filter by Opinion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Opinions</SelectItem>
            <SelectItem value="UNMODIFIED">Unmodified</SelectItem>
            <SelectItem value="QUALIFIED">Qualified</SelectItem>
            <SelectItem value="ADVERSE">Adverse</SelectItem>
            <SelectItem value="DISCLAIMER">Disclaimer</SelectItem>
            <SelectItem value="NOT_APPLICABLE">Not Applicable</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40" data-testid="select-filter-opinion-status">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {uniqueStatuses.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          Showing {filtered.length} of {engagements.length} engagements
        </span>
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
                <TableHead className="w-16">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(eng => (
                <TableRow key={eng.engagementId} data-testid={`opinion-detail-${eng.engagementId}`}>
                  <TableCell className="font-medium text-sm">{eng.engagementName || "-"}</TableCell>
                  <TableCell className="text-sm">{eng.clientName || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{eng.yearEnd ? new Date(eng.yearEnd).toLocaleDateString() : "-"}</TableCell>
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setSelectedEngagement(eng)}
                      data-testid={`button-view-${eng.engagementId}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    {engagements.length === 0 ? "No engagement data available" : "No engagements match your filters"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEngagement} onOpenChange={(open) => !open && setSelectedEngagement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opinion Details</DialogTitle>
            <DialogDescription>
              {selectedEngagement?.engagementName || selectedEngagement?.clientName}
            </DialogDescription>
          </DialogHeader>
          {selectedEngagement && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">Client</Label>
                  <div className="font-medium">{selectedEngagement.clientName || "-"}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Engagement</Label>
                  <div className="font-medium">{selectedEngagement.engagementName || "-"}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Year End</Label>
                  <div className="font-medium">{selectedEngagement.yearEnd ? new Date(selectedEngagement.yearEnd).toLocaleDateString() : "-"}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Opinion Type</Label>
                  <div>
                    <Badge className={`text-[10px] border-0 text-white no-default-hover-elevate no-default-active-elevate ${opinionColors[selectedEngagement.opinionType] || opinionColors.PENDING}`}>
                      {(selectedEngagement.opinionType || "PENDING").replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Report Status</Label>
                  <div>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedEngagement.status || "DRAFT"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Delivered Date</Label>
                  <div className="font-medium">{selectedEngagement.deliveredDate ? new Date(selectedEngagement.deliveredDate).toLocaleDateString() : "Not yet delivered"}</div>
                </div>
                {selectedEngagement.reportReference && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Report Reference</Label>
                    <div className="font-medium font-mono text-xs">{selectedEngagement.reportReference}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEngagement(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function XBRLReadinessTab({ xbrlItems, onToggle, onNotesChange, onSave, isSaving, hasChanges }: {
  xbrlItems: XBRLItem[];
  onToggle: (id: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
}) {
  const readyCount = xbrlItems.filter(x => x.ready).length;
  const total = xbrlItems.length;
  const pct = total > 0 ? Math.round((readyCount / total) * 100) : 0;
  const [editingNotes, setEditingNotes] = useState<string | null>(null);

  const categories = [...new Set(xbrlItems.map(x => x.category))];

  const categoryStats = categories.map(cat => {
    const items = xbrlItems.filter(x => x.category === cat);
    const ready = items.filter(x => x.ready).length;
    return { category: cat, total: items.length, ready, pct: items.length > 0 ? Math.round((ready / items.length) * 100) : 0 };
  });

  return (
    <div className="space-y-4" data-testid="tab-xbrl-readiness">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categoryStats.map(cat => (
          <Card key={cat.category} className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{cat.category}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="text-lg font-bold">{cat.ready}/{cat.total}</div>
              <Badge className={`text-[10px] border-0 text-white no-default-hover-elevate no-default-active-elevate ${cat.pct === 100 ? "bg-green-500" : cat.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                {cat.pct}%
              </Badge>
            </div>
          </Card>
        ))}
      </div>

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
              <Button
                onClick={onSave}
                disabled={isSaving || !hasChanges}
                size="sm"
                data-testid="button-save-xbrl"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {hasChanges ? "Save" : "Saved"}
              </Button>
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
                    className="flex items-start gap-3 p-3 rounded-md border"
                    data-testid={`xbrl-readiness-${item.id}`}
                  >
                    <button
                      onClick={() => onToggle(item.id)}
                      className="flex-shrink-0 mt-0.5"
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
                      {editingNotes === item.id ? (
                        <Textarea
                          value={item.notes}
                          onChange={(e) => onNotesChange(item.id, e.target.value)}
                          onBlur={() => setEditingNotes(null)}
                          placeholder="Add notes..."
                          className="mt-1 text-xs min-h-[40px] resize-none"
                          autoFocus
                          data-testid={`input-xbrl-notes-${item.id}`}
                        />
                      ) : (
                        <div
                          className="text-xs text-muted-foreground mt-0.5 cursor-pointer hover:text-foreground flex items-center gap-1"
                          onClick={(e) => { e.stopPropagation(); setEditingNotes(item.id); }}
                        >
                          {item.notes || "Click to add notes..."}
                          <Pencil className="w-3 h-3 opacity-50" />
                        </div>
                      )}
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

function ComplianceExportTab({ checklist, engagements, xbrlItems, selectedEngagementId, engagementsList }: {
  checklist: ChecklistItem[];
  engagements: OpinionTracker[];
  xbrlItems: XBRLItem[];
  selectedEngagementId: string | null;
  engagementsList: any[];
}) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const generateReportLines = useCallback(() => {
    const met = checklist.filter(c => c.status === "met").length;
    const partial = checklist.filter(c => c.status === "partial").length;
    const notMet = checklist.filter(c => c.status === "not_met").length;
    const applicable = checklist.filter(c => c.status !== "na").length;
    const compliancePct = applicable > 0 ? Math.round((met / applicable) * 100) : 0;
    const xbrlReady = xbrlItems.filter(x => x.ready).length;

    const selectedEng = engagementsList.find((e: any) => e.id === selectedEngagementId);

    const lines: string[] = [];
    lines.push("SECP COMPLIANCE REPORT");
    lines.push("=".repeat(60));
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    if (selectedEng) {
      lines.push(`Engagement: ${selectedEng.engagementCode || selectedEng.client?.name || selectedEng.id}`);
    }
    lines.push(`Overall Compliance: ${compliancePct}% (${met}/${applicable} requirements met)`);
    lines.push(`Partial: ${partial} | Not Met: ${notMet}`);
    lines.push("");

    lines.push("REGULATORY CHECKLIST - COMPANIES ACT 2017");
    lines.push("-".repeat(60));
    const categories = [...new Set(checklist.map(c => c.category))];
    categories.forEach(cat => {
      lines.push("");
      lines.push(`  ${cat.toUpperCase()}`);
      checklist.filter(c => c.category === cat).forEach(item => {
        const statusLabel = STATUS_CONFIG[item.status].label;
        lines.push(`  [${statusLabel.padEnd(7)}] ${item.section} - ${item.title}`);
        if (item.evidenceRef) lines.push(`             Evidence: ${item.evidenceRef}`);
        if (item.notes) lines.push(`             Notes: ${item.notes}`);
      });
    });
    lines.push("");

    lines.push("ENGAGEMENT OPINION TRACKER");
    lines.push("-".repeat(60));
    if (engagements.length > 0) {
      lines.push(`Total Engagements: ${engagements.length}`);
      lines.push(`Issued: ${engagements.filter(e => e.status === "ISSUED").length}`);
      lines.push(`Unmodified: ${engagements.filter(e => e.opinionType === "UNMODIFIED").length}`);
      lines.push(`Modified: ${engagements.filter(e => ["QUALIFIED", "ADVERSE", "DISCLAIMER"].includes(e.opinionType)).length}`);
      lines.push("");
      engagements.forEach(eng => {
        const yearEnd = eng.yearEnd ? new Date(eng.yearEnd).toLocaleDateString() : "N/A";
        lines.push(`  ${(eng.engagementName || eng.clientName).padEnd(30)} | ${yearEnd.padEnd(12)} | Opinion: ${(eng.opinionType || "PENDING").replace(/_/g, " ").padEnd(15)} | ${eng.status || "DRAFT"}`);
        if (eng.deliveredDate) lines.push(`  ${"".padEnd(30)} | Delivered: ${new Date(eng.deliveredDate).toLocaleDateString()}`);
        if (eng.reportReference) lines.push(`  ${"".padEnd(30)} | Ref: ${eng.reportReference}`);
      });
    } else {
      lines.push("No engagement data available");
    }
    lines.push("");

    lines.push("XBRL READINESS");
    lines.push("-".repeat(60));
    lines.push(`Overall: ${xbrlReady}/${xbrlItems.length} items ready (${xbrlItems.length > 0 ? Math.round((xbrlReady / xbrlItems.length) * 100) : 0}%)`);
    lines.push("");
    const xbrlCats = [...new Set(xbrlItems.map(x => x.category))];
    xbrlCats.forEach(cat => {
      lines.push(`  ${cat}`);
      xbrlItems.filter(x => x.category === cat).forEach(item => {
        lines.push(`    [${item.ready ? "READY  " : "PENDING"}] ${item.requirement}`);
        if (item.notes) lines.push(`              ${item.notes}`);
      });
    });

    lines.push("");
    lines.push("=".repeat(60));
    lines.push("End of SECP Compliance Report");

    return lines;
  }, [checklist, engagements, xbrlItems, selectedEngagementId, engagementsList]);

  const handleExport = () => {
    setIsExporting(true);
    try {
      const lines = generateReportLines();
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secp-compliance-report-${new Date().toISOString().split("T")[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export Complete", description: "SECP compliance report downloaded successfully." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const rows: string[][] = [["Section", "Title", "Category", "Status", "Evidence", "Notes"]];
      checklist.forEach(item => {
        rows.push([item.section, item.title, item.category, STATUS_CONFIG[item.status].label, item.evidenceRef, item.notes]);
      });
      const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secp-checklist-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV Export Complete", description: "Checklist exported as CSV." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportOpinionsCSV = () => {
    setIsExporting(true);
    try {
      const rows: string[][] = [["Engagement", "Client", "Year End", "Opinion Type", "Status", "Delivered Date", "Report Reference"]];
      engagements.forEach(eng => {
        rows.push([
          eng.engagementName || "",
          eng.clientName || "",
          eng.yearEnd ? new Date(eng.yearEnd).toLocaleDateString() : "",
          (eng.opinionType || "PENDING").replace(/_/g, " "),
          eng.status || "DRAFT",
          eng.deliveredDate ? new Date(eng.deliveredDate).toLocaleDateString() : "",
          eng.reportReference || "",
        ]);
      });
      const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secp-opinions-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV Export Complete", description: "Opinion tracker exported as CSV." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXBRLCSV = () => {
    setIsExporting(true);
    try {
      const rows: string[][] = [["Requirement", "Category", "Status", "Notes"]];
      xbrlItems.forEach(item => {
        rows.push([item.requirement, item.category, item.ready ? "Ready" : "Pending", item.notes]);
      });
      const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secp-xbrl-readiness-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV Export Complete", description: "XBRL readiness exported as CSV." });
    } finally {
      setIsExporting(false);
    }
  };

  const met = checklist.filter(c => c.status === "met").length;
  const partial = checklist.filter(c => c.status === "partial").length;
  const notMet = checklist.filter(c => c.status === "not_met").length;
  const applicable = checklist.filter(c => c.status !== "na").length;
  const xbrlReady = xbrlItems.filter(x => x.ready).length;
  const compliancePct = applicable > 0 ? Math.round((met / applicable) * 100) : 0;

  return (
    <div className="space-y-4" data-testid="tab-compliance-export">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Regulatory Compliance
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compliance Score</span>
              <span className={`font-bold ${compliancePct >= 80 ? "text-green-600" : compliancePct >= 50 ? "text-amber-600" : "text-red-600"}`}>{compliancePct}%</span>
            </div>
            <Progress value={compliancePct} className="h-2" />
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
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Gavel className="w-4 h-4" />
            Opinion Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Engagements</span>
              <span className="font-medium">{engagements.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reports Issued</span>
              <span className="font-medium text-green-600">{engagements.filter(e => e.status === "ISSUED").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unmodified Opinions</span>
              <span className="font-medium">{engagements.filter(e => e.opinionType === "UNMODIFIED").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modified Opinions</span>
              <span className="font-medium text-amber-600">{engagements.filter(e => ["QUALIFIED", "ADVERSE", "DISCLAIMER"].includes(e.opinionType)).length}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            XBRL Readiness
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overall Readiness</span>
              <span className={`font-bold ${xbrlItems.length > 0 && Math.round((xbrlReady / xbrlItems.length) * 100) >= 80 ? "text-green-600" : "text-amber-600"}`}>
                {xbrlItems.length > 0 ? Math.round((xbrlReady / xbrlItems.length) * 100) : 0}%
              </span>
            </div>
            <Progress value={xbrlItems.length > 0 ? Math.round((xbrlReady / xbrlItems.length) * 100) : 0} className="h-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items Ready</span>
              <span className="font-medium text-green-600">{xbrlReady}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items Pending</span>
              <span className="font-medium text-red-600">{xbrlItems.length - xbrlReady}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total Items</span>
              <span>{xbrlItems.length}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Options
          </CardTitle>
          <CardDescription>Download compliance data for regulatory submission or internal review</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={handleExport} disabled={isExporting} className="justify-start h-auto py-3" data-testid="button-export-txt">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Full Compliance Report (TXT)</div>
                  <div className="text-xs opacity-80 font-normal">Complete report with checklist, opinions, and XBRL status</div>
                </div>
              </div>
            </Button>
            <Button onClick={handleExportCSV} disabled={isExporting} variant="outline" className="justify-start h-auto py-3" data-testid="button-export-csv">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Regulatory Checklist (CSV)</div>
                  <div className="text-xs opacity-80 font-normal">Companies Act 2017 compliance checklist data</div>
                </div>
              </div>
            </Button>
            <Button onClick={handleExportOpinionsCSV} disabled={isExporting} variant="outline" className="justify-start h-auto py-3" data-testid="button-export-opinions-csv">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Opinion Tracker (CSV)</div>
                  <div className="text-xs opacity-80 font-normal">Engagement opinions and audit report status</div>
                </div>
              </div>
            </Button>
            <Button onClick={handleExportXBRLCSV} disabled={isExporting} variant="outline" className="justify-start h-auto py-3" data-testid="button-export-xbrl-csv">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium">XBRL Readiness (CSV)</div>
                  <div className="text-xs opacity-80 font-normal">SECP XBRL filing readiness assessment data</div>
                </div>
              </div>
            </Button>
          </div>

          <Separator className="my-4" />

          <Button variant="secondary" onClick={() => setPreviewOpen(true)} className="w-full" data-testid="button-preview-report">
            <Eye className="w-4 h-4 mr-2" />
            Preview Full Report
          </Button>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Report Preview</DialogTitle>
            <DialogDescription>SECP Compliance Report</DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] bg-muted rounded-md p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap">{generateReportLines().join("\n")}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SECPCompliancePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [xbrlItems, setXbrlItems] = useState<XBRLItem[]>(DEFAULT_XBRL);
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [xbrlDirty, setXbrlDirty] = useState(false);
  const { toast } = useToast();

  const opinionsQuery = useQuery<OpinionTracker[]>({
    queryKey: ["/api/secp/opinions"],
  });

  const engagementsQuery = useQuery<any[]>({
    queryKey: ["/api/engagements"],
  });

  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);

  useEffect(() => {
    if (engagementsQuery.data?.length && !selectedEngagementId) {
      setSelectedEngagementId(engagementsQuery.data[0]?.id || null);
    }
  }, [engagementsQuery.data, selectedEngagementId]);

  const savedChecklistQuery = useQuery<any[]>({
    queryKey: ["/api/compliance/checklists", selectedEngagementId],
    enabled: !!selectedEngagementId,
  });

  useEffect(() => {
    if (!savedChecklistQuery.data?.length) return;

    const secpChecklist = savedChecklistQuery.data.find((cl: any) => cl.checklistType === "SECP_COMPLIANCE");
    if (secpChecklist?.items && Array.isArray(secpChecklist.items)) {
      setChecklist(prev => prev.map(item => {
        const saved = (secpChecklist.items as any[]).find((s: any) => s.ref === item.id);
        if (saved) {
          return {
            ...item,
            status: fromBackendStatus(saved.status),
            notes: saved.notes ?? "",
          };
        }
        return item;
      }));
    }

    const xbrlChecklist = savedChecklistQuery.data.find((cl: any) => cl.checklistType === "SECP_XBRL_READINESS");
    if (xbrlChecklist?.items && Array.isArray(xbrlChecklist.items)) {
      setXbrlItems(prev => prev.map(item => {
        const saved = (xbrlChecklist.items as any[]).find((s: any) => s.ref === item.id);
        if (saved) {
          return {
            ...item,
            ready: saved.status === "COMPLETED",
            notes: saved.notes ?? item.notes,
          };
        }
        return item;
      }));
    }

    setChecklistDirty(false);
    setXbrlDirty(false);
  }, [savedChecklistQuery.data]);

  const saveChecklistMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEngagementId) throw new Error("No engagement selected");
      const items = checklist.map(item => ({
        ref: item.id,
        description: `${item.section} - ${item.title}`,
        status: toBackendStatus(item.status),
        notes: item.notes,
        evidence: item.evidenceRef,
      }));
      await apiRequest("POST", `/api/compliance/checklists/${selectedEngagementId}`, {
        checklistType: "SECP_COMPLIANCE",
        checklistReference: "Companies Act 2017 - SECP Compliance Checklist",
        items,
      });
    },
    onSuccess: () => {
      setChecklistDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists", selectedEngagementId] });
      toast({ title: "Saved", description: "Regulatory checklist saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Save Failed", description: error?.message || "Failed to save checklist.", variant: "destructive" });
    },
  });

  const saveXbrlMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEngagementId) throw new Error("No engagement selected");
      const items = xbrlItems.map(item => ({
        ref: item.id,
        description: item.requirement,
        status: item.ready ? "COMPLETED" as const : "PENDING" as const,
        notes: item.notes,
      }));
      await apiRequest("POST", `/api/compliance/checklists/${selectedEngagementId}`, {
        checklistType: "SECP_XBRL_READINESS",
        checklistReference: "SECP XBRL Filing Readiness Assessment",
        items,
      });
    },
    onSuccess: () => {
      setXbrlDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists", selectedEngagementId] });
      toast({ title: "Saved", description: "XBRL readiness saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Save Failed", description: error?.message || "Failed to save XBRL readiness.", variant: "destructive" });
    },
  });

  const handleStatusChange = (id: string, status: ComplianceStatus) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    setChecklistDirty(true);
  };

  const handleNotesChange = (id: string, notes: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, notes } : item));
    setChecklistDirty(true);
  };

  const handleXbrlToggle = (id: string) => {
    setXbrlItems(prev => prev.map(item => item.id === id ? { ...item, ready: !item.ready } : item));
    setXbrlDirty(true);
  };

  const handleXbrlNotesChange = (id: string, notes: string) => {
    setXbrlItems(prev => prev.map(item => item.id === id ? { ...item, notes } : item));
    setXbrlDirty(true);
  };

  const handleEngagementChange = (val: string) => {
    setSelectedEngagementId(val);
    setChecklist(DEFAULT_CHECKLIST.map(item => ({ ...item })));
    setXbrlItems(DEFAULT_XBRL.map(item => ({ ...item })));
    setChecklistDirty(false);
    setXbrlDirty(false);
  };

  const deliverableEngagements = opinionsQuery.data || [];
  const isLoading = opinionsQuery.isLoading || engagementsQuery.isLoading;

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
          setActiveTab={setActiveTab}
        />

        {engagementsQuery.data && engagementsQuery.data.length >= 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Engagement:</span>
            <Select value={selectedEngagementId || ""} onValueChange={handleEngagementChange}>
              <SelectTrigger className="w-64" data-testid="select-engagement">
                <SelectValue placeholder="Select Engagement" />
              </SelectTrigger>
              <SelectContent>
                {engagementsQuery.data.map((eng: any) => (
                  <SelectItem key={eng.id} value={eng.id}>
                    {eng.engagementCode || eng.client?.name || eng.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savedChecklistQuery.isLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
            {savedChecklistQuery.isSuccess && selectedEngagementId && (
              <Badge variant="outline" className="text-[10px]">
                {savedChecklistQuery.data?.length || 0} checklists saved
              </Badge>
            )}
          </div>
        )}

        {isLoading && activeTab === "overview" ? (
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
                onNotesChange={handleNotesChange}
                onSave={() => saveChecklistMutation.mutate()}
                isSaving={saveChecklistMutation.isPending}
                hasChanges={checklistDirty}
              />
            )}
            {activeTab === "opinions" && (
              <OpinionTrackerTab
                engagements={deliverableEngagements}
                isLoading={opinionsQuery.isLoading}
              />
            )}
            {activeTab === "xbrl" && (
              <XBRLReadinessTab
                xbrlItems={xbrlItems}
                onToggle={handleXbrlToggle}
                onNotesChange={handleXbrlNotesChange}
                onSave={() => saveXbrlMutation.mutate()}
                isSaving={saveXbrlMutation.isPending}
                hasChanges={xbrlDirty}
              />
            )}
            {activeTab === "export" && (
              <ComplianceExportTab
                checklist={checklist}
                engagements={deliverableEngagements}
                xbrlItems={xbrlItems}
                selectedEngagementId={selectedEngagementId}
                engagementsList={engagementsQuery.data || []}
              />
            )}
          </>
        )}

        {!selectedEngagementId && !isLoading && (activeTab === "checklist" || activeTab === "xbrl") && (
          <Card className="p-6">
            <div className="text-center text-sm text-muted-foreground">
              <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
              No engagements found. Create an engagement first to enable checklist persistence.
              <br />
              Changes will work locally but won't be saved to the database.
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
