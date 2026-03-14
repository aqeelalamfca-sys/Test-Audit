import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Building2,
  Calendar,
  FileText,
  Globe,
  Users,
  ClipboardCheck,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { QAFormChecklist, ChecklistItem, ChecklistSection } from "@/components/compliance-checklist";
import type { SignOffData } from "@/components/sign-off-bar";

export interface EngagementSetupData {
  clientName: string;
  engagementCode: string;
  fiscalYear: string;
  status: string;
  reportingFramework: "IFRS" | "SME" | "";
  currency: string;
  isGroupAudit: boolean;
  hasComponentAuditors: boolean;
  componentAuditorDetails: string;
  engagementType: "statutory" | "non-statutory" | "review" | "compilation" | "";
  reportingDeadline: string;
  fieldworkStartDate: string;
  fieldworkEndDate: string;
  planningDeadline: string;
}

export interface AcceptanceContinuanceData {
  clientIntegrityAssessment: "pass" | "fail" | "";
  clientIntegrityRationale: string;
  predecessorAuditorStatus: "communicated" | "pending" | "not_applicable" | "";
  predecessorAuditorRemarks: string;
  scopeLimitations: string;
  hasConditions: boolean;
  conditionsDescription: string;
  acceptanceDecision: "accept" | "decline" | "accept_with_conditions" | "";
  declineReason: string;
  checklistSection: ChecklistSection;
  signOff: SignOffData;
}

export interface EngagementSetupSectionProps {
  engagementId: string;
  data: EngagementSetupData;
  onChange: (data: EngagementSetupData) => void;
  readOnly?: boolean;
}

export interface AcceptanceContinuanceSectionProps {
  engagementId: string;
  data: AcceptanceContinuanceData;
  onChange: (data: AcceptanceContinuanceData) => void;
  currentUser?: string;
  readOnly?: boolean;
}

const FormSection = ({ 
  icon, 
  title, 
  description, 
  children,
  className = ""
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

const FormField = ({ 
  label, 
  source,
  required,
  children,
  helperText,
  className = ""
}: { 
  label: string; 
  source?: "engagement" | "client" | "auto" | "tb";
  required?: boolean;
  children: React.ReactNode;
  helperText?: string;
  className?: string;
}) => (
  <div className={`space-y-2 ${className}`}>
    <Label className="flex items-center gap-2 text-sm font-medium">
      {label}
      {required && <span className="text-destructive">*</span>}
      {source === "engagement" && (
        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
          From Engagement
        </Badge>
      )}
      {source === "client" && (
        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
          From Client
        </Badge>
      )}
      {source === "auto" && (
        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
          Auto
        </Badge>
      )}
      {source === "tb" && (
        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800">
          From TB
        </Badge>
      )}
    </Label>
    {children}
    {helperText && (
      <p className="text-xs text-muted-foreground">{helperText}</p>
    )}
  </div>
);

const FormRow = ({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) => (
  <div className={`grid gap-2.5 ${cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
    {children}
  </div>
);

const SectionDivider = ({ title, icon }: { title: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-3 pt-4 pb-2">
    {icon && <span className="text-muted-foreground">{icon}</span>}
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    <div className="flex-1 h-px bg-border/60" />
  </div>
);

export function EngagementSetupSection({
  engagementId,
  data,
  onChange,
  readOnly = false,
}: EngagementSetupSectionProps) {
  const handleChange = <K extends keyof EngagementSetupData>(
    field: K,
    value: EngagementSetupData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-3">
      <FormSection
        icon={<Building2 className="h-5 w-5" />}
        title="Engagement Identification"
        description="Read-only engagement header information"
      >
        <FormRow cols={4}>
          <FormField label="Client Name" source="client">
            <Input
              value={data.clientName}
              readOnly
              disabled
              className="bg-muted/50"
              data-testid="input-client-name"
            />
          </FormField>
          <FormField label="Engagement Code" source="engagement">
            <Input
              value={data.engagementCode}
              readOnly
              disabled
              className="bg-muted/50"
              data-testid="input-engagement-code"
            />
          </FormField>
          <FormField label="Fiscal Year" source="engagement">
            <Input
              value={data.fiscalYear}
              readOnly
              disabled
              className="bg-muted/50"
              data-testid="input-fiscal-year"
            />
          </FormField>
          <FormField label="Status" source="auto">
            <Badge 
              variant="outline" 
              className={`w-full justify-center py-2 ${
                data.status === "active" ? "bg-green-50 text-green-600 border-green-200" :
                data.status === "draft" ? "bg-amber-50 text-amber-600 border-amber-200" :
                "bg-muted"
              }`}
              data-testid="badge-status"
            >
              {data.status || "Draft"}
            </Badge>
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Reporting & Framework Settings"
        description="Configure audit reporting framework and currency settings"
      >
        <FormRow cols={3}>
          <FormField label="Reporting Framework" required>
            <Select
              value={data.reportingFramework}
              onValueChange={(v) => handleChange("reportingFramework", v as EngagementSetupData["reportingFramework"])}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-reporting-framework">
                <SelectValue placeholder="Select framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IFRS">IFRS (Full Standards)</SelectItem>
                <SelectItem value="SME">IFRS for SMEs</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Reporting Currency" required>
            <Select
              value={data.currency}
              onValueChange={(v) => handleChange("currency", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="AED">AED - UAE Dirham</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Engagement Type" required>
            <Select
              value={data.engagementType}
              onValueChange={(v) => handleChange("engagementType", v as EngagementSetupData["engagementType"])}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-engagement-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="statutory">Statutory Audit</SelectItem>
                <SelectItem value="non-statutory">Non-Statutory Audit</SelectItem>
                <SelectItem value="review">Review Engagement</SelectItem>
                <SelectItem value="compilation">Compilation Engagement</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </FormRow>

        <SectionDivider title="Group Audit Settings" icon={<Users className="h-4 w-4" />} />

        <FormRow cols={2}>
          <div className="space-y-2.5">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="isGroupAudit"
                checked={data.isGroupAudit}
                onCheckedChange={(checked) => handleChange("isGroupAudit", !!checked)}
                disabled={readOnly}
                data-testid="checkbox-group-audit"
              />
              <Label htmlFor="isGroupAudit" className="text-sm font-medium cursor-pointer">
                This is a Group Audit (ISA 600)
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="hasComponentAuditors"
                checked={data.hasComponentAuditors}
                onCheckedChange={(checked) => handleChange("hasComponentAuditors", !!checked)}
                disabled={readOnly || !data.isGroupAudit}
                data-testid="checkbox-component-auditors"
              />
              <Label 
                htmlFor="hasComponentAuditors" 
                className={`text-sm font-medium cursor-pointer ${!data.isGroupAudit ? "text-muted-foreground" : ""}`}
              >
                Component Auditors Involved
              </Label>
            </div>
          </div>
          {data.hasComponentAuditors && (
            <FormField label="Component Auditor Details">
              <Textarea
                value={data.componentAuditorDetails}
                onChange={(e) => handleChange("componentAuditorDetails", e.target.value)}
                placeholder="List component auditors and their responsibilities..."
                className="min-h-[80px]"
                disabled={readOnly}
                data-testid="textarea-component-auditors"
              />
            </FormField>
          )}
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Calendar className="h-5 w-5" />}
        title="Key Deadlines"
        description="Engagement timeline and milestone dates"
      >
        <FormRow cols={4}>
          <FormField label="Planning Deadline" required>
            <Input
              type="date"
              value={data.planningDeadline}
              onChange={(e) => handleChange("planningDeadline", e.target.value)}
              disabled={readOnly}
              data-testid="input-planning-deadline"
            />
          </FormField>
          <FormField label="Fieldwork Start">
            <Input
              type="date"
              value={data.fieldworkStartDate}
              onChange={(e) => handleChange("fieldworkStartDate", e.target.value)}
              disabled={readOnly}
              data-testid="input-fieldwork-start"
            />
          </FormField>
          <FormField label="Fieldwork End">
            <Input
              type="date"
              value={data.fieldworkEndDate}
              onChange={(e) => handleChange("fieldworkEndDate", e.target.value)}
              disabled={readOnly}
              data-testid="input-fieldwork-end"
            />
          </FormField>
          <FormField label="Reporting Deadline" required>
            <Input
              type="date"
              value={data.reportingDeadline}
              onChange={(e) => handleChange("reportingDeadline", e.target.value)}
              disabled={readOnly}
              data-testid="input-reporting-deadline"
            />
          </FormField>
        </FormRow>
      </FormSection>
    </div>
  );
}

export function AcceptanceContinuanceSection({
  engagementId,
  data,
  onChange,
  currentUser = "Current User",
  readOnly = false,
}: AcceptanceContinuanceSectionProps) {
  const handleChange = <K extends keyof AcceptanceContinuanceData>(
    field: K,
    value: AcceptanceContinuanceData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const handleChecklistUpdate = (itemId: string, field: keyof ChecklistItem, value: unknown) => {
    const updatedSection: ChecklistSection = {
      ...data.checklistSection,
      items: data.checklistSection.items.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    };
    handleChange("checklistSection", updatedSection);
  };

  const handleSignOffChange = (signOffData: SignOffData) => {
    handleChange("signOff", signOffData);
  };

  return (
    <div className="space-y-3">
      <FormSection
        icon={<Shield className="h-5 w-5" />}
        title="Client Integrity Assessment"
        description="ISA 210 & ISQM 1 - Evaluate client integrity and acceptance criteria"
      >
        <FormRow cols={2}>
          <FormField label="Client Integrity Assessment" required>
            <RadioGroup
              value={data.clientIntegrityAssessment}
              onValueChange={(v) => handleChange("clientIntegrityAssessment", v as AcceptanceContinuanceData["clientIntegrityAssessment"])}
              disabled={readOnly}
              className="flex gap-2.5"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pass" id="integrity-pass" data-testid="radio-integrity-pass" />
                <Label htmlFor="integrity-pass" className="flex items-center gap-1.5 cursor-pointer">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Pass
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fail" id="integrity-fail" data-testid="radio-integrity-fail" />
                <Label htmlFor="integrity-fail" className="flex items-center gap-1.5 cursor-pointer">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Fail
                </Label>
              </div>
            </RadioGroup>
          </FormField>
          <FormField label="Assessment Rationale" required>
            <Textarea
              value={data.clientIntegrityRationale}
              onChange={(e) => handleChange("clientIntegrityRationale", e.target.value)}
              placeholder="Document basis for integrity assessment..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-integrity-rationale"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Predecessor Auditor Communication" icon={<Users className="h-4 w-4" />} />

        <FormRow cols={2}>
          <FormField label="Communication Status" required>
            <Select
              value={data.predecessorAuditorStatus}
              onValueChange={(v) => handleChange("predecessorAuditorStatus", v as AcceptanceContinuanceData["predecessorAuditorStatus"])}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-predecessor-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="communicated">Communication Completed</SelectItem>
                <SelectItem value="pending">Communication Pending</SelectItem>
                <SelectItem value="not_applicable">Not Applicable (New Client)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Remarks">
            <Textarea
              value={data.predecessorAuditorRemarks}
              onChange={(e) => handleChange("predecessorAuditorRemarks", e.target.value)}
              placeholder="Document communication details or reasons..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-predecessor-remarks"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Scope & Conditions"
        description="Document any scope limitations or conditions for acceptance"
      >
        <FormField label="Scope Limitations">
          <Textarea
            value={data.scopeLimitations}
            onChange={(e) => handleChange("scopeLimitations", e.target.value)}
            placeholder="Document any known scope limitations or restrictions..."
            className="min-h-[80px]"
            disabled={readOnly}
            data-testid="textarea-scope-limitations"
          />
        </FormField>

        <div className="space-y-2.5">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="hasConditions"
              checked={data.hasConditions}
              onCheckedChange={(checked) => handleChange("hasConditions", !!checked)}
              disabled={readOnly}
              data-testid="checkbox-has-conditions"
            />
            <Label htmlFor="hasConditions" className="text-sm font-medium cursor-pointer">
              Acceptance subject to specific conditions
            </Label>
          </div>
          {data.hasConditions && (
            <FormField label="Conditions Description" required>
              <Textarea
                value={data.conditionsDescription}
                onChange={(e) => handleChange("conditionsDescription", e.target.value)}
                placeholder="Describe conditions that must be met..."
                className="min-h-[80px]"
                disabled={readOnly}
                data-testid="textarea-conditions-description"
              />
            </FormField>
          )}
        </div>
      </FormSection>

      <FormSection
        icon={<ClipboardCheck className="h-5 w-5" />}
        title="ISA 210 / ISQM Compliance Checklist"
        description="Complete required acceptance and continuance procedures"
      >
        <QAFormChecklist
          section={data.checklistSection}
          onUpdateItem={handleChecklistUpdate}
          readOnly={readOnly}
        />
      </FormSection>

      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Acceptance Decision"
        description="Final acceptance/decline decision with partner sign-off"
      >
        <FormField label="Acceptance Decision" required>
          <RadioGroup
            value={data.acceptanceDecision}
            onValueChange={(v) => handleChange("acceptanceDecision", v as AcceptanceContinuanceData["acceptanceDecision"])}
            disabled={readOnly}
            className="flex flex-wrap gap-2.5"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="accept" id="decision-accept" data-testid="radio-decision-accept" />
              <Label htmlFor="decision-accept" className="flex items-center gap-1.5 cursor-pointer">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Accept
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="accept_with_conditions" id="decision-conditional" data-testid="radio-decision-conditional" />
              <Label htmlFor="decision-conditional" className="flex items-center gap-1.5 cursor-pointer">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Accept with Conditions
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="decline" id="decision-decline" data-testid="radio-decision-decline" />
              <Label htmlFor="decision-decline" className="flex items-center gap-1.5 cursor-pointer">
                <XCircle className="h-4 w-4 text-destructive" />
                Decline
              </Label>
            </div>
          </RadioGroup>
        </FormField>

        {data.acceptanceDecision === "decline" && (
          <FormField label="Reason for Decline" required>
            <Textarea
              value={data.declineReason}
              onChange={(e) => handleChange("declineReason", e.target.value)}
              placeholder="Document reason for declining the engagement..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-decline-reason"
            />
          </FormField>
        )}

      </FormSection>
    </div>
  );
}

export function getDefaultEngagementSetupData(): EngagementSetupData {
  return {
    clientName: "",
    engagementCode: "",
    fiscalYear: "",
    status: "DRAFT",
    reportingFramework: "",
    currency: "",
    isGroupAudit: false,
    hasComponentAuditors: false,
    componentAuditorDetails: "",
    engagementType: "",
    reportingDeadline: "",
    fieldworkStartDate: "",
    fieldworkEndDate: "",
    planningDeadline: "",
  };
}

export function getDefaultAcceptanceContinuanceData(): AcceptanceContinuanceData {
  return {
    clientIntegrityAssessment: "",
    clientIntegrityRationale: "",
    predecessorAuditorStatus: "",
    predecessorAuditorRemarks: "",
    scopeLimitations: "",
    hasConditions: false,
    conditionsDescription: "",
    acceptanceDecision: "",
    declineReason: "",
    checklistSection: {
      id: "isa210-isqm",
      title: "ISA 210 & ISQM 1 Requirements",
      description: "Mandatory acceptance and continuance procedures",
      items: [
        {
          id: "acc-1",
          itemCode: "ACC-1",
          requirement: "Evaluate management's integrity and ethical values",
          isaReference: "ISA 210.6",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "acc-2",
          itemCode: "ACC-2",
          requirement: "Assess competence to perform the engagement",
          isaReference: "ISQM 1.30",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "acc-3",
          itemCode: "ACC-3",
          requirement: "Consider ethical requirements and independence",
          isaReference: "ISQM 1.29",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "acc-4",
          itemCode: "ACC-4",
          requirement: "Communicate with predecessor auditor (if applicable)",
          isaReference: "ISA 300.13",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "acc-5",
          itemCode: "ACC-5",
          requirement: "Evaluate preconditions for an audit (ISA 210)",
          isaReference: "ISA 210.6",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "acc-6",
          itemCode: "ACC-6",
          requirement: "Assess resources and capability to complete engagement",
          isaReference: "ISQM 1.32",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "acc-7",
          itemCode: "ACC-7",
          requirement: "Consider engagement risk and risk management policies",
          isaReference: "ISQM 1.23",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "acc-8",
          itemCode: "ACC-8",
          requirement: "Obtain agreement on terms of engagement",
          isaReference: "ISA 210.9",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
      ],
    },
    signOff: {
      preparedBy: "",
      preparedDate: "",
      reviewedBy: "",
      reviewedDate: "",
      approvedBy: "",
      approvedDate: "",
      status: "DRAFT",
    },
  };
}

export { FormSection, FormField, FormRow, SectionDivider };
