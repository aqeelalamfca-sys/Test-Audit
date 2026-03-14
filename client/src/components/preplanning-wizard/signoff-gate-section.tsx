import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, AlertCircle, Lock, Shield, FileSignature,
  Users, Folder, ClipboardCheck, AlertTriangle,
  ArrowRight, Loader2, Sparkles, Target, Calendar,
  FileText, Compass, Eye,
} from "lucide-react";
import { QAFormChecklist, type ChecklistItem, type ChecklistSection } from "@/components/compliance-checklist";

export interface GateCheckItem {
  id: string;
  label: string;
  description: string;
  status: "passed" | "failed" | "pending";
  isBlocking: boolean;
  icon: React.ReactNode;
}

export interface SignOffGateData {
  gateChecks: GateCheckItem[];
  completionChecklist: ChecklistSection;
  riskAssessmentFinalized: boolean;
  materialityApproved: boolean;
  auditStrategyApproval: {
    natureTimingExtent: string;
    controlRelianceStrategy: string;
    staffingAndResources: string;
    approvalStatus: "draft" | "reviewed" | "approved" | "";
    approvalNotes: string;
  };
  eqcrClearance: {
    eqcrRequired: boolean;
    eqcrReviewer: string;
    eqcrDate: string;
    eqcrStatus: "not_required" | "pending" | "in_progress" | "cleared" | "issues_raised" | "";
    eqcrFindings: string;
    eqcrConcurrence: boolean;
  };
  partnerSignOff: {
    partnerName: string;
    signOffDate: string;
    confirmed: boolean;
    statement: string;
  };
  overrideReason: string;
  overrideBy: string;
  overrideDate: string;
  partnerConfirmation: boolean;
  isLocked: boolean;
}

interface SignOffGateSectionProps {
  engagementId: string;
  data: SignOffGateData;
  onChange: (data: SignOffGateData) => void;
  onProceedToPlanning?: () => void;
  currentUser?: string;
  isPartner?: boolean;
  readOnly?: boolean;
}

const STATUS_CONFIG = {
  passed: {
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    badge: "bg-green-100 text-green-700 border-green-200",
  },
  failed: {
    icon: AlertCircle,
    color: "text-destructive",
    bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-700 border-red-200",
  },
  pending: {
    icon: AlertCircle,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

const APPROVAL_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
];

const EQCR_STATUS_OPTIONS = [
  { value: "not_required", label: "Not Required" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "cleared", label: "Cleared" },
  { value: "issues_raised", label: "Issues Raised" },
];

const SectionDivider = ({ title, icon }: { title: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-3 pt-4 pb-2">
    {icon && <span className="text-muted-foreground">{icon}</span>}
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    <div className="flex-1 h-px bg-border/60" />
  </div>
);

function getDefaultCompletionChecklist(): ChecklistSection {
  return {
    id: "completion-checklist",
    title: "Pre-Planning Completion Checklist",
    description: "Confirm all pre-planning requirements under ISA 300 and ISA 220",
    items: [
      { id: "cc-1", itemCode: "CC-01", requirement: "Engagement acceptance/continuance decision documented and approved (ISA 220.12)", isaReference: "ISA 220.12", status: "", evidenceIds: [], remarks: "" },
      { id: "cc-2", itemCode: "CC-02", requirement: "Ethics and independence requirements confirmed for all team members (ISA 220.9)", isaReference: "ISA 220.9", status: "", evidenceIds: [], remarks: "" },
      { id: "cc-3", itemCode: "CC-03", requirement: "Engagement team competence and resources assessed (ISA 220.14)", isaReference: "ISA 220.14", status: "", evidenceIds: [], remarks: "" },
      { id: "cc-4", itemCode: "CC-04", requirement: "Engagement letter signed by client (ISA 210.10)", isaReference: "ISA 210.10", status: "", evidenceIds: [], remarks: "" },
      { id: "cc-5", itemCode: "CC-05", requirement: "Understanding of entity and its environment obtained (ISA 315.12)", isaReference: "ISA 315.12", status: "", evidenceIds: [], remarks: "" },
      { id: "cc-6", itemCode: "CC-06", requirement: "Overall audit strategy established (ISA 300.7)", isaReference: "ISA 300.7", status: "", evidenceIds: [], remarks: "" },
      { id: "cc-7", itemCode: "CC-07", requirement: "Communication with TCWG planned (ISA 260.14)", isaReference: "ISA 260.14", status: "", evidenceIds: [], remarks: "" },
      { id: "cc-8", itemCode: "CC-08", requirement: "Fraud risk factors assessed (ISA 240.16)", isaReference: "ISA 240.16", status: "", evidenceIds: [], remarks: "" },
    ],
  };
}

export function SignOffGateSection({
  engagementId,
  data,
  onChange,
  onProceedToPlanning,
  currentUser = "Current User",
  isPartner = false,
  readOnly = false,
}: SignOffGateSectionProps) {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [isProceeding, setIsProceeding] = useState(false);
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null);

  const completionChecklist = data.completionChecklist || getDefaultCompletionChecklist();
  const auditStrategyApproval = data.auditStrategyApproval || getDefaultSignOffGateData().auditStrategyApproval;
  const eqcrClearance = data.eqcrClearance || getDefaultSignOffGateData().eqcrClearance;
  const partnerSignOff = data.partnerSignOff || getDefaultSignOffGateData().partnerSignOff;

  const gateChecks = data.gateChecks || [];
  const passedCount = gateChecks.filter((g) => g.status === "passed").length;
  const failedCount = gateChecks.filter((g) => g.status === "failed").length;
  const pendingCount = gateChecks.filter((g) => g.status === "pending").length;
  const blockingFailed = gateChecks.filter((g) => g.isBlocking && g.status !== "passed");

  const canProceed = blockingFailed.length === 0 && (data.partnerConfirmation || partnerSignOff.confirmed);
  const allPassed = gateChecks.every((g) => g.status === "passed");

  const handleChecklistUpdate = (itemId: string, field: keyof ChecklistItem, value: unknown) => {
    const updated: ChecklistSection = {
      ...completionChecklist,
      items: completionChecklist.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    };
    onChange({ ...data, completionChecklist: updated });
  };

  const updateAuditStrategyApproval = (field: string, value: unknown) => {
    onChange({
      ...data,
      auditStrategyApproval: { ...auditStrategyApproval, [field]: value },
    });
  };

  const updateEqcrClearance = (field: string, value: unknown) => {
    onChange({
      ...data,
      eqcrClearance: { ...eqcrClearance, [field]: value },
    });
  };

  const updatePartnerSignOff = (field: string, value: unknown) => {
    onChange({
      ...data,
      partnerSignOff: { ...partnerSignOff, [field]: value },
    });
  };

  const handleOverride = () => {
    if (!overrideReason.trim()) return;
    onChange({
      ...data,
      overrideReason: overrideReason,
      overrideBy: currentUser,
      overrideDate: new Date().toISOString().split("T")[0],
    });
    setShowOverrideForm(false);
    setOverrideReason("");
  };

  const handleProceed = async () => {
    if (!onProceedToPlanning) return;
    setIsProceeding(true);
    try {
      onChange({ ...data, isLocked: true });
      await onProceedToPlanning();
    } finally {
      setIsProceeding(false);
    }
  };

  const handleAIGenerate = (field: string) => {
    setAiLoadingField(field);
    setTimeout(() => setAiLoadingField(null), 3000);
  };

  const AIButton = ({ field, label }: { field: string; label?: string }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleAIGenerate(field)}
      disabled={readOnly || aiLoadingField === field}
      className="gap-1.5 text-xs"
      data-testid={`button-ai-${field}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {aiLoadingField === field ? "Generating..." : label || "AI Auto-Fill"}
    </Button>
  );

  return (
    <div className="space-y-3">
      {data.isLocked && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Pre-Planning Phase Completed & Locked
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You may now proceed to the Planning phase.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 1: Pre-Planning Completion & Sign-off (ISA 300 / ISA 220) */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base font-semibold">
                Pre-Planning Completion & Sign-off
              </CardTitle>
              <CardDescription className="text-sm">
                ISA 300 / ISA 220 — Confirm all pre-planning requirements are complete before establishing the audit plan
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-semibold text-foreground">Completion Checklist</h4>
            <AIButton field="completion_checklist" label="AI Suggest Status" />
          </div>

          <QAFormChecklist
            section={completionChecklist}
            onUpdateItem={handleChecklistUpdate}
            readOnly={readOnly}
          />

          <SectionDivider title="Checklist Completion Confirmation" icon={<CheckCircle2 className="h-4 w-4" />} />

          <SectionDivider title="EQCR Clearance" icon={<Eye className="h-4 w-4" />} />

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 mb-3">
            <Checkbox
              checked={eqcrClearance.eqcrRequired}
              onCheckedChange={(checked) => updateEqcrClearance("eqcrRequired", !!checked)}
              disabled={readOnly}
              data-testid="checkbox-eqcr-required"
            />
            <Label className="text-sm font-medium cursor-pointer">
              Engagement Quality Control Review (EQCR) is required for this engagement (ISA 220.19)
            </Label>
          </div>

          {eqcrClearance.eqcrRequired && (
            <div className="space-y-2.5 pl-4 border-l-2 border-primary/20">
              <div className="grid gap-2.5 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">EQCR Reviewer</Label>
                  <Input
                    value={eqcrClearance.eqcrReviewer}
                    onChange={(e) => updateEqcrClearance("eqcrReviewer", e.target.value)}
                    placeholder="Reviewer name"
                    disabled={readOnly}
                    data-testid="input-eqcr-reviewer"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Review Date</Label>
                  <Input
                    type="date"
                    value={eqcrClearance.eqcrDate}
                    onChange={(e) => updateEqcrClearance("eqcrDate", e.target.value)}
                    disabled={readOnly}
                    data-testid="input-eqcr-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">EQCR Status</Label>
                  <Select
                    value={eqcrClearance.eqcrStatus}
                    onValueChange={(v) => updateEqcrClearance("eqcrStatus", v)}
                    disabled={readOnly}
                  >
                    <SelectTrigger data-testid="select-eqcr-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {EQCR_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">EQCR Findings / Observations</Label>
                <Textarea
                  value={eqcrClearance.eqcrFindings}
                  onChange={(e) => updateEqcrClearance("eqcrFindings", e.target.value)}
                  placeholder="Document any findings or observations raised during the engagement quality control review..."
                  className="min-h-[60px]"
                  disabled={readOnly}
                  data-testid="textarea-eqcr-findings"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Checkbox
                  checked={eqcrClearance.eqcrConcurrence}
                  onCheckedChange={(checked) => updateEqcrClearance("eqcrConcurrence", !!checked)}
                  disabled={readOnly}
                  data-testid="checkbox-eqcr-concurrence"
                />
                <Label className="text-sm font-medium cursor-pointer">
                  EQCR reviewer concurs with the engagement team's significant judgments and conclusions (ISA 220.20)
                </Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Overall Audit Strategy & Audit Plan Approval (ISA 300) */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Compass className="h-5 w-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base font-semibold">
                Overall Audit Strategy & Audit Plan Approval
              </CardTitle>
              <CardDescription className="text-sm">
                ISA 300 — Document the nature, timing, and extent of planned audit procedures and obtain partner approval
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          <SectionDivider title="Nature, Timing & Extent of Procedures (ISA 300.7–9)" icon={<Target className="h-4 w-4" />} />

          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 space-y-2">
              <Label className="text-sm font-medium">
                Nature, Timing & Extent of Planned Procedures
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea
                value={auditStrategyApproval.natureTimingExtent}
                onChange={(e) => updateAuditStrategyApproval("natureTimingExtent", e.target.value)}
                placeholder="Document the planned:&#10;• Nature of procedures (substantive tests, tests of controls, analytical procedures)&#10;• Timing (interim vs. year-end, phased approach)&#10;• Extent (sample sizes, coverage percentages)&#10;• Key areas requiring substantive procedures&#10;• Areas where combined approach will be applied..."
                className="min-h-[120px]"
                disabled={readOnly}
                data-testid="textarea-nature-timing-extent"
              />
            </div>
            <AIButton field="nature_timing_extent" label="AI Draft" />
          </div>

          <SectionDivider title="Control Reliance Strategy" icon={<Shield className="h-4 w-4" />} />

          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 space-y-2">
              <Label className="text-sm font-medium">
                Control Reliance Strategy
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea
                value={auditStrategyApproval.controlRelianceStrategy}
                onChange={(e) => updateAuditStrategyApproval("controlRelianceStrategy", e.target.value)}
                placeholder="Document the planned control reliance approach:&#10;• Controls to be tested and rationale&#10;• Cycles/processes where control reliance is planned&#10;• IT general controls assessment approach&#10;• Impact on substantive procedures if controls found ineffective&#10;• Areas where no control reliance is planned (fully substantive)..."
                className="min-h-[100px]"
                disabled={readOnly}
                data-testid="textarea-control-reliance"
              />
            </div>
            <AIButton field="control_reliance" label="AI Draft" />
          </div>

          <SectionDivider title="Staffing & Resources" icon={<Users className="h-4 w-4" />} />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Staffing & Resources Confirmation</Label>
            <Textarea
              value={auditStrategyApproval.staffingAndResources}
              onChange={(e) => updateAuditStrategyApproval("staffingAndResources", e.target.value)}
              placeholder="Confirm staffing adequacy, specialist involvement, IT audit resources, and any resource constraints..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-staffing-resources"
            />
          </div>

          <SectionDivider title="Final Partner Approval (ISA 300.11)" icon={<FileSignature className="h-4 w-4" />} />

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Approval Status</Label>
              <Select
                value={auditStrategyApproval.approvalStatus}
                onValueChange={(v) => updateAuditStrategyApproval("approvalStatus", v)}
                disabled={readOnly}
              >
                <SelectTrigger data-testid="select-strategy-approval-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Approval Notes</Label>
              <Textarea
                value={auditStrategyApproval.approvalNotes}
                onChange={(e) => updateAuditStrategyApproval("approvalNotes", e.target.value)}
                placeholder="Any conditions or notes on the approval..."
                className="min-h-[40px]"
                disabled={readOnly}
                data-testid="textarea-approval-notes"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pre-Planning Sign-Off Gate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Pre-Planning Sign-Off Gate
          </CardTitle>
          <CardDescription>
            All mandatory items must be completed before proceeding to Planning phase (ISA 300)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={STATUS_CONFIG.passed.badge} data-testid="badge-passed-count">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {passedCount} Passed
              </Badge>
              {pendingCount > 0 && (
                <Badge variant="outline" className={STATUS_CONFIG.pending.badge} data-testid="badge-pending-count">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {pendingCount} Pending
                </Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="outline" className={STATUS_CONFIG.failed.badge} data-testid="badge-failed-count">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {failedCount} Failed
                </Badge>
              )}
            </div>
            <div className="flex-1" />
            <div className="text-sm text-muted-foreground">
              {passedCount}/{gateChecks.length} complete
            </div>
          </div>

          <div className="space-y-3">
            {gateChecks.map((check) => {
              const config = STATUS_CONFIG[check.status];
              const Icon = config.icon;

              return (
                <div
                  key={check.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${config.bg}`}
                  data-testid={`gate-check-${check.id}`}
                >
                  <div className={`mt-0.5 ${config.color}`}>
                    {check.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{check.label}</span>
                      {check.isBlocking && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/50 text-primary">
                          Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {check.description}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`${config.badge} flex items-center gap-1`}
                  >
                    <Icon className="h-3 w-3" />
                    {check.status === "passed" ? "Complete" :
                     check.status === "failed" ? "Incomplete" : "Pending"}
                  </Badge>
                </div>
              );
            })}
          </div>

          {blockingFailed.length > 0 && !data.isLocked && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-5 w-5" />
                  Prerequisites not yet complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                  {blockingFailed.map((check) => (
                    <li key={check.id}>"{check.label}" is {check.status === "failed" ? "incomplete" : "pending"}</li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                  Complete all required items to proceed to Planning phase.
                </p>
              </CardContent>
            </Card>
          )}

          {data.overrideReason && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Override by {data.overrideBy} on {data.overrideDate}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {data.overrideReason}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Engagement Partner Sign-off */}
      {!data.isLocked && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <FileSignature className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-base font-semibold">
                  Engagement Partner Sign-off
                </CardTitle>
                <CardDescription className="text-sm">
                  ISA 220.15 — The engagement partner shall take responsibility for the overall quality of the engagement
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Engagement Partner Name</Label>
                <Input
                  value={partnerSignOff.partnerName}
                  onChange={(e) => updatePartnerSignOff("partnerName", e.target.value)}
                  placeholder="Enter partner name"
                  disabled={readOnly}
                  data-testid="input-partner-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sign-off Date</Label>
                <Input
                  type="date"
                  value={partnerSignOff.signOffDate}
                  onChange={(e) => updatePartnerSignOff("signOffDate", e.target.value)}
                  disabled={readOnly}
                  data-testid="input-partner-signoff-date"
                />
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2.5 border rounded-lg bg-muted/30">
              <Checkbox
                id="partner-confirmation"
                checked={partnerSignOff.confirmed}
                onCheckedChange={(checked) => {
                  updatePartnerSignOff("confirmed", !!checked);
                  onChange({ ...data, partnerConfirmation: !!checked, partnerSignOff: { ...partnerSignOff, confirmed: !!checked } });
                }}
                disabled={readOnly}
                data-testid="checkbox-partner-confirmation"
              />
              <Label htmlFor="partner-confirmation" className="text-sm cursor-pointer leading-relaxed">
                I, as the Engagement Partner, confirm that all pre-planning requirements under
                ISA 210, ISA 220, ISA 300, ISA 315, ISA 320, and ISQM 1 have been satisfactorily
                completed, the overall audit strategy has been approved, and the engagement team
                may proceed to the Planning phase.
              </Label>
            </div>

            {isPartner && blockingFailed.length > 0 && !showOverrideForm && (
              <Button
                variant="outline"
                onClick={() => setShowOverrideForm(true)}
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                data-testid="button-partner-override"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Partner Override
              </Button>
            )}

            {showOverrideForm && (
              <div className="p-2.5 border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700">
                    Partner Override - Document Reason
                  </span>
                </div>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Enter detailed reason for overriding gate checks (required for audit trail)..."
                  className="min-h-[80px]"
                  data-testid="textarea-override-reason"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowOverrideForm(false);
                      setOverrideReason("");
                    }}
                    data-testid="button-cancel-override"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleOverride}
                    disabled={!overrideReason.trim()}
                    className="bg-amber-500 hover:bg-amber-600"
                    data-testid="button-confirm-override"
                  >
                    Confirm Override
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                onClick={handleProceed}
                disabled={(!canProceed && !data.overrideReason) || data.isLocked || isProceeding}
                className="gap-2"
                data-testid="button-proceed-planning"
              >
                {isProceeding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {data.isLocked ? "Locked" : "Lock & Proceed to Planning"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function getDefaultGateChecks(): GateCheckItem[] {
  return [
    {
      id: "acceptance",
      label: "Acceptance & Continuance (ISA 210/220)",
      description: "Client acceptance decision reviewed and approved by Partner",
      status: "pending",
      isBlocking: true,
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
    {
      id: "independence",
      label: "Ethics & Independence (ISA 220)",
      description: "All team members have confirmed independence, no unresolved threats",
      status: "pending",
      isBlocking: true,
      icon: <Shield className="h-4 w-4" />,
    },
    {
      id: "engagement-letter",
      label: "Engagement Letter (ISA 210)",
      description: "Signed engagement letter obtained from client and filed",
      status: "pending",
      isBlocking: true,
      icon: <FileSignature className="h-4 w-4" />,
    },
    {
      id: "entity-understanding",
      label: "Entity Understanding (ISA 315)",
      description: "Understanding of entity and its environment documented",
      status: "pending",
      isBlocking: true,
      icon: <FileText className="h-4 w-4" />,
    },
  ];
}

export function getDefaultSignOffGateData(): SignOffGateData {
  return {
    gateChecks: getDefaultGateChecks(),
    completionChecklist: getDefaultCompletionChecklist(),
    riskAssessmentFinalized: false,
    materialityApproved: false,
    auditStrategyApproval: {
      natureTimingExtent: "",
      controlRelianceStrategy: "",
      staffingAndResources: "",
      approvalStatus: "",
      approvalNotes: "",
    },
    eqcrClearance: {
      eqcrRequired: false,
      eqcrReviewer: "",
      eqcrDate: "",
      eqcrStatus: "",
      eqcrFindings: "",
      eqcrConcurrence: false,
    },
    partnerSignOff: {
      partnerName: "",
      signOffDate: "",
      confirmed: false,
      statement: "",
    },
    overrideReason: "",
    overrideBy: "",
    overrideDate: "",
    partnerConfirmation: false,
    isLocked: false,
  };
}
