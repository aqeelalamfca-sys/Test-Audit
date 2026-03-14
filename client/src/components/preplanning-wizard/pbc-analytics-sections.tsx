import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FolderOpen,
  TrendingUp,
  Plus,
  Trash2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { EvidenceUploader, EvidenceFile } from "@/components/evidence-uploader";
import { InformationRequestsPanel } from "./information-requests-panel";
import type { SignOffData } from "@/components/sign-off-bar";

export interface PBCItem {
  id: string;
  item: string;
  category: "financial_statements" | "schedules" | "contracts" | "legal" | "tax" | "other" | "";
  description: string;
  owner: string;
  dueDate: string;
  status: "pending" | "requested" | "received" | "reviewed" | "not_applicable" | "";
  receivedDate: string;
  remarks: string;
  evidenceIds: string[];
}

export interface PBCTrackerData {
  engagementId: string;
  items: PBCItem[];
  overallNotes: string;
  signOff: SignOffData;
}

export interface AnalyticalProcedure {
  id: string;
  area: string;
  expectation: string;
  threshold: string;
  actualResult: string;
  variance: string;
  anomalyFlag: boolean;
  investigationNotes: string;
  conclusion: "no_issues" | "further_investigation" | "potential_risk" | "";
}

export interface PreliminaryAnalyticsData {
  engagementId: string;
  procedures: AnalyticalProcedure[];
  dataSources: string;
  overallConclusion: string;
  linkedObservationIds: string[];
  signOff: SignOffData;
}

export interface PBCTrackerSectionProps {
  engagementId: string;
  data: PBCTrackerData;
  onChange: (data: PBCTrackerData) => void;
  currentUser?: string;
  readOnly?: boolean;
}

export interface PreliminaryAnalyticsSectionProps {
  engagementId: string;
  data: PreliminaryAnalyticsData;
  onChange: (data: PreliminaryAnalyticsData) => void;
  currentUser?: string;
  readOnly?: boolean;
}

const FormSection = ({
  icon,
  title,
  description,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Card className={`overflow-hidden ${className}`}>
    <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          {icon}
        </div>
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-6 space-y-3">
      {children}
    </CardContent>
  </Card>
);

const SectionDivider = ({ title, icon }: { title: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-3 pt-4 pb-2">
    {icon && <span className="text-muted-foreground">{icon}</span>}
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    <div className="flex-1 h-px bg-border/60" />
  </div>
);

const PBC_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "financial_statements", label: "Financial Statements" },
  { value: "schedules", label: "Schedules" },
  { value: "contracts", label: "Contracts" },
  { value: "legal", label: "Legal" },
  { value: "tax", label: "Tax" },
  { value: "other", label: "Other" },
];

const PBC_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "requested", label: "Requested" },
  { value: "received", label: "Received" },
  { value: "reviewed", label: "Reviewed" },
  { value: "not_applicable", label: "N/A" },
];

const CONCLUSION_OPTIONS: { value: string; label: string }[] = [
  { value: "no_issues", label: "No Issues" },
  { value: "further_investigation", label: "Further Investigation" },
  { value: "potential_risk", label: "Potential Risk" },
];

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "received":
    case "reviewed":
      return "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200";
    case "requested":
      return "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200";
    case "pending":
      return "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200";
    case "not_applicable":
      return "bg-muted text-muted-foreground";
    default:
      return "";
  }
}

export function getDefaultPBCTrackerData(engagementId: string): PBCTrackerData {
  return {
    engagementId,
    items: [],
    overallNotes: "",
    signOff: {
      preparedBy: "",
      preparedDate: "",
      reviewedBy: "",
      reviewedDate: "",
      status: "DRAFT",
    },
  };
}

export function getDefaultPreliminaryAnalyticsData(engagementId: string): PreliminaryAnalyticsData {
  return {
    engagementId,
    procedures: [],
    dataSources: "",
    overallConclusion: "",
    linkedObservationIds: [],
    signOff: {
      preparedBy: "",
      preparedDate: "",
      reviewedBy: "",
      reviewedDate: "",
      status: "DRAFT",
    },
  };
}

export function PBCTrackerSection({
  engagementId,
  data,
  onChange,
  currentUser,
  readOnly = false,
}: PBCTrackerSectionProps) {
  const handleAddItem = () => {
    const newItem: PBCItem = {
      id: `pbc-${Date.now()}`,
      item: "",
      category: "",
      description: "",
      owner: "",
      dueDate: "",
      status: "pending",
      receivedDate: "",
      remarks: "",
      evidenceIds: [],
    };
    onChange({ ...data, items: [...data.items, newItem] });
  };

  const handleUpdateItem = (id: string, field: keyof PBCItem, value: any) => {
    onChange({
      ...data,
      items: data.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const handleDeleteItem = (id: string) => {
    onChange({
      ...data,
      items: data.items.filter((item) => item.id !== id),
    });
  };

  const receivedCount = data.items.filter(
    (i) => i.status === "received" || i.status === "reviewed" || i.status === "not_applicable"
  ).length;

  return (
    <div className="space-y-3">
      <FormSection
        icon={<FolderOpen className="h-5 w-5" />}
        title="PBC Tracker (Prepared By Client)"
        description="Manage items the client needs to provide for the audit"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="badge-pbc-progress">
              {receivedCount}/{data.items.length} items received
            </Badge>
          </div>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="gap-1"
              data-testid="button-add-pbc-item"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs w-[40px]">Sr.</TableHead>
                <TableHead className="text-xs min-w-[150px]">Item</TableHead>
                <TableHead className="text-xs w-[150px]">Category</TableHead>
                <TableHead className="text-xs w-[120px]">Owner</TableHead>
                <TableHead className="text-xs w-[130px]">Due Date</TableHead>
                <TableHead className="text-xs w-[140px]">Status</TableHead>
                {!readOnly && <TableHead className="text-xs w-[50px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 6 : 7}
                    className="text-center text-sm text-muted-foreground py-2"
                  >
                    No PBC items added yet. Click "Add Item" to begin.
                  </TableCell>
                </TableRow>
              )}
              {data.items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{item.item}</span>
                    ) : (
                      <Input
                        value={item.item}
                        onChange={(e) => handleUpdateItem(item.id, "item", e.target.value)}
                        placeholder="PBC item name..."
                        className="h-8 text-xs"
                        data-testid={`input-pbc-item-${item.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <Badge variant="outline" className="text-xs">
                        {PBC_CATEGORY_OPTIONS.find((o) => o.value === item.category)?.label || "—"}
                      </Badge>
                    ) : (
                      <Select
                        value={item.category}
                        onValueChange={(v) => handleUpdateItem(item.id, "category", v)}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-pbc-category-${item.id}`}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PBC_CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{item.owner}</span>
                    ) : (
                      <Input
                        value={item.owner}
                        onChange={(e) => handleUpdateItem(item.id, "owner", e.target.value)}
                        placeholder="Owner..."
                        className="h-8 text-xs"
                        data-testid={`input-pbc-owner-${item.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{item.dueDate || "—"}</span>
                    ) : (
                      <Input
                        type="date"
                        value={item.dueDate}
                        onChange={(e) => handleUpdateItem(item.id, "dueDate", e.target.value)}
                        className="h-8 text-xs"
                        data-testid={`input-pbc-due-date-${item.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <Badge variant="outline" className={`text-xs ${getStatusBadgeClass(item.status)}`}>
                        {PBC_STATUS_OPTIONS.find((o) => o.value === item.status)?.label || "—"}
                      </Badge>
                    ) : (
                      <Select
                        value={item.status}
                        onValueChange={(v) => handleUpdateItem(item.id, "status", v)}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-pbc-status-${item.id}`}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PBC_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-destructive"
                        data-testid={`button-delete-pbc-item-${item.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <SectionDivider title="Overall Notes" />

        <Textarea
          value={data.overallNotes}
          onChange={(e) => onChange({ ...data, overallNotes: e.target.value })}
          placeholder="Enter any overall notes regarding PBC items..."
          rows={4}
          readOnly={readOnly}
          disabled={readOnly}
          data-testid="textarea-pbc-overall-notes"
        />

      </FormSection>

      <FormSection
        icon={<FolderOpen className="h-5 w-5" />}
        title="Information Requests"
        description="Information items requested from the client for the audit engagement"
      >
        <InformationRequestsPanel
          engagementId={engagementId}
          readOnly={readOnly}
        />
      </FormSection>
    </div>
  );
}

export function PreliminaryAnalyticsSection({
  engagementId,
  data,
  onChange,
  currentUser,
  readOnly = false,
}: PreliminaryAnalyticsSectionProps) {
  const handleAddProcedure = () => {
    const newProcedure: AnalyticalProcedure = {
      id: `ap-${Date.now()}`,
      area: "",
      expectation: "",
      threshold: "",
      actualResult: "",
      variance: "",
      anomalyFlag: false,
      investigationNotes: "",
      conclusion: "",
    };
    onChange({ ...data, procedures: [...data.procedures, newProcedure] });
  };

  const handleUpdateProcedure = (id: string, field: keyof AnalyticalProcedure, value: any) => {
    onChange({
      ...data,
      procedures: data.procedures.map((proc) =>
        proc.id === id ? { ...proc, [field]: value } : proc
      ),
    });
  };

  const handleDeleteProcedure = (id: string) => {
    onChange({
      ...data,
      procedures: data.procedures.filter((proc) => proc.id !== id),
    });
  };

  const anomalyCount = data.procedures.filter((p) => p.anomalyFlag).length;

  return (
    <div className="space-y-3">
      <FormSection
        icon={<TrendingUp className="h-5 w-5" />}
        title="Preliminary Analytical Procedures (ISA 520)"
        description="Identify areas of potential risk through analytical review"
      >
        <SectionDivider title="Data Sources" />

        <Textarea
          value={data.dataSources}
          onChange={(e) => onChange({ ...data, dataSources: e.target.value })}
          placeholder="Describe the data sources used for analytical procedures (e.g., trial balance, prior year financials, industry benchmarks)..."
          rows={3}
          readOnly={readOnly}
          disabled={readOnly}
          data-testid="textarea-analytics-data-sources"
        />

        <SectionDivider title="Analytical Procedures" />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="badge-procedure-count">
              {data.procedures.length} procedure(s)
            </Badge>
            {anomalyCount > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 gap-1"
                data-testid="badge-anomaly-count"
              >
                <AlertTriangle className="h-3 w-3" />
                {anomalyCount} anomal{anomalyCount === 1 ? "y" : "ies"}
              </Badge>
            )}
          </div>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddProcedure}
              className="gap-1"
              data-testid="button-add-procedure"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Procedure
            </Button>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs w-[40px]">Sr.</TableHead>
                <TableHead className="text-xs min-w-[120px]">Area</TableHead>
                <TableHead className="text-xs min-w-[120px]">Expectation</TableHead>
                <TableHead className="text-xs w-[100px]">Threshold</TableHead>
                <TableHead className="text-xs w-[100px]">Actual</TableHead>
                <TableHead className="text-xs w-[100px]">Variance</TableHead>
                <TableHead className="text-xs w-[70px]">Anomaly</TableHead>
                <TableHead className="text-xs w-[150px]">Conclusion</TableHead>
                {!readOnly && <TableHead className="text-xs w-[50px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.procedures.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 8 : 9}
                    className="text-center text-sm text-muted-foreground py-2"
                  >
                    No analytical procedures added yet. Click "Add Procedure" to begin.
                  </TableCell>
                </TableRow>
              )}
              {data.procedures.map((proc, index) => (
                <TableRow key={proc.id} className={proc.anomalyFlag ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{proc.area}</span>
                    ) : (
                      <Input
                        value={proc.area}
                        onChange={(e) => handleUpdateProcedure(proc.id, "area", e.target.value)}
                        placeholder="Area..."
                        className="h-8 text-xs"
                        data-testid={`input-procedure-area-${proc.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{proc.expectation}</span>
                    ) : (
                      <Input
                        value={proc.expectation}
                        onChange={(e) => handleUpdateProcedure(proc.id, "expectation", e.target.value)}
                        placeholder="Expected..."
                        className="h-8 text-xs"
                        data-testid={`input-procedure-expectation-${proc.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{proc.threshold}</span>
                    ) : (
                      <Input
                        value={proc.threshold}
                        onChange={(e) => handleUpdateProcedure(proc.id, "threshold", e.target.value)}
                        placeholder="e.g. 5%"
                        className="h-8 text-xs"
                        data-testid={`input-procedure-threshold-${proc.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{proc.actualResult}</span>
                    ) : (
                      <Input
                        value={proc.actualResult}
                        onChange={(e) => handleUpdateProcedure(proc.id, "actualResult", e.target.value)}
                        placeholder="Actual..."
                        className="h-8 text-xs"
                        data-testid={`input-procedure-actual-${proc.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{proc.variance}</span>
                    ) : (
                      <Input
                        value={proc.variance}
                        onChange={(e) => handleUpdateProcedure(proc.id, "variance", e.target.value)}
                        placeholder="Variance..."
                        className="h-8 text-xs"
                        data-testid={`input-procedure-variance-${proc.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={proc.anomalyFlag}
                        onCheckedChange={(checked) =>
                          handleUpdateProcedure(proc.id, "anomalyFlag", !!checked)
                        }
                        disabled={readOnly}
                        data-testid={`checkbox-procedure-anomaly-${proc.id}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          proc.conclusion === "no_issues"
                            ? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200"
                            : proc.conclusion === "further_investigation"
                            ? "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200"
                            : proc.conclusion === "potential_risk"
                            ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200"
                            : ""
                        }`}
                      >
                        {CONCLUSION_OPTIONS.find((o) => o.value === proc.conclusion)?.label || "—"}
                      </Badge>
                    ) : (
                      <Select
                        value={proc.conclusion}
                        onValueChange={(v) => handleUpdateProcedure(proc.id, "conclusion", v)}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-procedure-conclusion-${proc.id}`}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CONCLUSION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteProcedure(proc.id)}
                        className="text-destructive"
                        data-testid={`button-delete-procedure-${proc.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data.procedures.some((p) => p.anomalyFlag) && (
          <div className="space-y-2.5">
            <SectionDivider
              title="Investigation Notes"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            {data.procedures
              .filter((p) => p.anomalyFlag)
              .map((proc) => (
                <div key={proc.id} className="space-y-2 p-3 border rounded-lg bg-amber-50/30 dark:bg-amber-950/10">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="text-xs font-medium">
                      {proc.area || "Unnamed Area"} — Investigation Notes
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      data-testid={`button-create-observation-${proc.id}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Create Observation
                    </Button>
                  </div>
                  <Textarea
                    value={proc.investigationNotes}
                    onChange={(e) =>
                      handleUpdateProcedure(proc.id, "investigationNotes", e.target.value)
                    }
                    placeholder="Document investigation findings for this anomaly..."
                    rows={3}
                    readOnly={readOnly}
                    disabled={readOnly}
                    data-testid={`textarea-investigation-notes-${proc.id}`}
                  />
                </div>
              ))}
          </div>
        )}

        <SectionDivider title="Overall Conclusion" />

        <Textarea
          value={data.overallConclusion}
          onChange={(e) => onChange({ ...data, overallConclusion: e.target.value })}
          placeholder="Summarize the overall conclusion from preliminary analytical procedures..."
          rows={4}
          readOnly={readOnly}
          disabled={readOnly}
          data-testid="textarea-analytics-overall-conclusion"
        />

      </FormSection>
    </div>
  );
}
