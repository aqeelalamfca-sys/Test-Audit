import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Target,
  Calendar,
  Users,
  MessageSquare,
  FileText,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  Compass,
  Shield,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { QAFormChecklist, type ChecklistItem, type ChecklistSection } from "@/components/compliance-checklist";
import { FormSection, FormField, FormRow, SectionDivider } from "./sections";
import type {
  AuditStrategyData,
  KeyFocusArea,
  PhasePlan,
  KeyDate,
  TCWGMember,
} from "./types";

export interface AuditStrategyTCWGSectionProps {
  engagementId: string;
  data: AuditStrategyData;
  onChange: (data: AuditStrategyData) => void;
  onAIGenerate?: (field: string) => void;
  currentUser?: string;
  readOnly?: boolean;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getDefaultTCWGChecklist(): ChecklistSection {
  return {
    id: "isa-260-checklist",
    title: "ISA 260 Communication Checklist",
    description: "Required communications with those charged with governance",
    items: [
      { id: "tcwg-1", itemCode: "TCWG-01", requirement: "Identify those charged with governance and their responsibilities", isaReference: "ISA 260.11", status: "", evidenceIds: [], remarks: "" },
      { id: "tcwg-2", itemCode: "TCWG-02", requirement: "Communicate planned scope and timing of the audit", isaReference: "ISA 260.15", status: "", evidenceIds: [], remarks: "" },
      { id: "tcwg-3", itemCode: "TCWG-03", requirement: "Communicate significant findings from the audit", isaReference: "ISA 260.16", status: "", evidenceIds: [], remarks: "" },
      { id: "tcwg-4", itemCode: "TCWG-04", requirement: "Document significant qualitative aspects of accounting practices", isaReference: "ISA 260.16a", status: "", evidenceIds: [], remarks: "" },
      { id: "tcwg-5", itemCode: "TCWG-05", requirement: "Communicate significant difficulties encountered during the audit", isaReference: "ISA 260.16b", status: "", evidenceIds: [], remarks: "" },
      { id: "tcwg-6", itemCode: "TCWG-06", requirement: "Communicate written representations requested", isaReference: "ISA 260.16c", status: "", evidenceIds: [], remarks: "" },
      { id: "tcwg-7", itemCode: "TCWG-07", requirement: "Document any other matters agreed upon for communication", isaReference: "ISA 260.17", status: "", evidenceIds: [], remarks: "" },
    ],
  };
}

export function getDefaultAuditStrategyData(engagementId: string = ""): AuditStrategyData {
  return {
    engagementId,
    overallStrategy: {
      scope: "",
      timing: "",
      direction: "",
      auditApproach: "",
      approachRationale: "",
    },
    keyAreasOfFocus: [],
    resourceTimingPlan: {
      plannedHoursByPhase: [
        { id: generateId(), phase: "Planning", plannedHours: 0, startDate: "", endDate: "" },
        { id: generateId(), phase: "Fieldwork", plannedHours: 0, startDate: "", endDate: "" },
        { id: generateId(), phase: "Completion", plannedHours: 0, startDate: "", endDate: "" },
        { id: generateId(), phase: "Reporting", plannedHours: 0, startDate: "", endDate: "" },
      ],
      keyDates: [],
      specialistNeeds: "",
    },
    tcwgIdentification: [],
    tcwgCommunication: {
      checklist: getDefaultTCWGChecklist(),
      plannedScopeTiming: "",
      identifiedSignificantRisks: "",
      independenceConfirmation: {
        confirmed: false,
        independenceStatement: "",
        threatsIdentified: "",
        safeguardsApplied: "",
      },
      materialityLevels: "",
      significantFindingsApproach: "",
      communicationSchedule: "",
      requiredEvidence: [],
    },
    plannedCommunications: {
      scopeTimingCommunication: "",
      significantFindingsApproach: "",
      communicationSchedule: "",
    },
    planningMemoSummary: "",
    signOff: {
      preparedBy: "",
      preparedDate: "",
      reviewedBy: "",
      reviewedDate: "",
      status: "DRAFT",
    },
  };
}

export function AuditStrategyTCWGSection({
  engagementId,
  data,
  onChange,
  onAIGenerate,
  currentUser = "Current User",
  readOnly = false,
}: AuditStrategyTCWGSectionProps) {
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null);

  const handleStrategyChange = (field: keyof AuditStrategyData["overallStrategy"], value: string) => {
    onChange({
      ...data,
      overallStrategy: { ...data.overallStrategy, [field]: value },
    });
  };

  const handleCommunicationsChange = (field: keyof AuditStrategyData["plannedCommunications"], value: string) => {
    onChange({
      ...data,
      plannedCommunications: { ...data.plannedCommunications, [field]: value },
    });
  };

  const handleSignOffChange = (signOffData: SignOffData) => {
    onChange({ ...data, signOff: signOffData });
  };

  const handleAIClick = (field: string) => {
    if (onAIGenerate) {
      setAiLoadingField(field);
      onAIGenerate(field);
      setTimeout(() => setAiLoadingField(null), 3000);
    }
  };

  const addKeyFocusArea = () => {
    onChange({
      ...data,
      keyAreasOfFocus: [
        ...data.keyAreasOfFocus,
        { id: generateId(), area: "", riskLevel: "", sourceRiskId: "", plannedResponse: "" },
      ],
    });
  };

  const updateKeyFocusArea = (id: string, field: keyof KeyFocusArea, value: string) => {
    onChange({
      ...data,
      keyAreasOfFocus: data.keyAreasOfFocus.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const removeKeyFocusArea = (id: string) => {
    onChange({
      ...data,
      keyAreasOfFocus: data.keyAreasOfFocus.filter((item) => item.id !== id),
    });
  };

  const updatePhasePlan = (id: string, field: keyof PhasePlan, value: string | number) => {
    onChange({
      ...data,
      resourceTimingPlan: {
        ...data.resourceTimingPlan,
        plannedHoursByPhase: data.resourceTimingPlan.plannedHoursByPhase.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      },
    });
  };

  const addPhasePlan = () => {
    onChange({
      ...data,
      resourceTimingPlan: {
        ...data.resourceTimingPlan,
        plannedHoursByPhase: [
          ...data.resourceTimingPlan.plannedHoursByPhase,
          { id: generateId(), phase: "", plannedHours: 0, startDate: "", endDate: "" },
        ],
      },
    });
  };

  const removePhasePlan = (id: string) => {
    onChange({
      ...data,
      resourceTimingPlan: {
        ...data.resourceTimingPlan,
        plannedHoursByPhase: data.resourceTimingPlan.plannedHoursByPhase.filter((item) => item.id !== id),
      },
    });
  };

  const addKeyDate = () => {
    onChange({
      ...data,
      resourceTimingPlan: {
        ...data.resourceTimingPlan,
        keyDates: [
          ...data.resourceTimingPlan.keyDates,
          { id: generateId(), description: "", date: "", responsible: "" },
        ],
      },
    });
  };

  const updateKeyDate = (id: string, field: keyof KeyDate, value: string) => {
    onChange({
      ...data,
      resourceTimingPlan: {
        ...data.resourceTimingPlan,
        keyDates: data.resourceTimingPlan.keyDates.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      },
    });
  };

  const removeKeyDate = (id: string) => {
    onChange({
      ...data,
      resourceTimingPlan: {
        ...data.resourceTimingPlan,
        keyDates: data.resourceTimingPlan.keyDates.filter((item) => item.id !== id),
      },
    });
  };

  const addTCWGMember = () => {
    onChange({
      ...data,
      tcwgIdentification: [
        ...data.tcwgIdentification,
        { id: generateId(), name: "", role: "", contact: "" },
      ],
    });
  };

  const updateTCWGMember = (id: string, field: keyof TCWGMember, value: string) => {
    onChange({
      ...data,
      tcwgIdentification: data.tcwgIdentification.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const removeTCWGMember = (id: string) => {
    onChange({
      ...data,
      tcwgIdentification: data.tcwgIdentification.filter((item) => item.id !== id),
    });
  };

  const defaults = getDefaultAuditStrategyData();
  const tcwgComm = data.tcwgCommunication || defaults.tcwgCommunication;
  const independenceConf = tcwgComm.independenceConfirmation || defaults.tcwgCommunication.independenceConfirmation;

  const handleTCWGChecklistUpdate = (itemId: string, field: keyof ChecklistItem, value: unknown) => {
    const updatedChecklist: ChecklistSection = {
      ...tcwgComm.checklist,
      items: tcwgComm.checklist.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    };
    onChange({
      ...data,
      tcwgCommunication: { ...tcwgComm, checklist: updatedChecklist },
    });
  };

  const updateTCWGComm = (field: string, value: unknown) => {
    onChange({
      ...data,
      tcwgCommunication: { ...tcwgComm, [field]: value },
    });
  };

  const updateIndependenceConf = (field: string, value: unknown) => {
    onChange({
      ...data,
      tcwgCommunication: {
        ...tcwgComm,
        independenceConfirmation: { ...independenceConf, [field]: value },
      },
    });
  };

  const totalPlannedHours = data.resourceTimingPlan.plannedHoursByPhase.reduce(
    (sum, p) => sum + (p.plannedHours || 0),
    0
  );

  const AIButton = ({ field, label }: { field: string; label?: string }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleAIClick(field)}
      disabled={readOnly || aiLoadingField === field}
      className="gap-1.5 text-xs"
      data-testid={`button-ai-${field}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {aiLoadingField === field ? "Generating..." : label || "AI Auto-Fill"}
    </Button>
  );

  return (
    <div className="space-y-6">
      <FormSection
        icon={<Compass className="h-5 w-5" />}
        title="Overall Audit Strategy (ISA 300)"
        description="ISA 300.7-8 — Establish the overall audit strategy that sets the scope, timing, and direction of the audit, and guides the development of the audit plan"
      >
        <div className="flex items-center justify-end">
          <AIButton field="overall_strategy" label="AI Draft Strategy" />
        </div>

        <FormField label="Scope of the Audit" required>
          <Textarea
            value={data.overallStrategy.scope}
            onChange={(e) => handleStrategyChange("scope", e.target.value)}
            placeholder="Define the scope including entities covered, reporting period, financial reporting framework, and any specific areas of focus..."
            className="min-h-[100px]"
            disabled={readOnly}
            data-testid="textarea-strategy-scope"
          />
        </FormField>

        <FormRow cols={2}>
          <FormField label="Timing" required>
            <Textarea
              value={data.overallStrategy.timing}
              onChange={(e) => handleStrategyChange("timing", e.target.value)}
              placeholder="Planned timing of audit phases, interim vs. year-end procedures, report issuance timeline..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-strategy-timing"
            />
          </FormField>
          <FormField label="Direction" required>
            <Textarea
              value={data.overallStrategy.direction}
              onChange={(e) => handleStrategyChange("direction", e.target.value)}
              placeholder="Overall direction of the audit including team briefing approach, supervision plan, and review structure..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-strategy-direction"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Audit Approach" icon={<Target className="h-4 w-4" />} />

        <FormRow cols={2}>
          <FormField label="Audit Approach" required>
            <RadioGroup
              value={data.overallStrategy.auditApproach}
              onValueChange={(v) => handleStrategyChange("auditApproach", v)}
              disabled={readOnly}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="substantive" id="approach-substantive" data-testid="radio-approach-substantive" />
                <Label htmlFor="approach-substantive" className="cursor-pointer">
                  Substantive Approach
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="combined" id="approach-combined" data-testid="radio-approach-combined" />
                <Label htmlFor="approach-combined" className="cursor-pointer">
                  Combined Approach
                </Label>
              </div>
            </RadioGroup>
          </FormField>
          <FormField label="Approach Rationale">
            <Textarea
              value={data.overallStrategy.approachRationale}
              onChange={(e) => handleStrategyChange("approachRationale", e.target.value)}
              placeholder="Justify the selected audit approach based on entity's control environment and risk assessment..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-approach-rationale"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Target className="h-5 w-5" />}
        title="Key Areas of Focus"
        description="Significant risks and accounts requiring focused audit attention (auto-populated from risk assessment)"
      >
        <div className="space-y-3">
          {data.keyAreasOfFocus.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No key areas of focus added. Add areas manually or auto-populate from risk assessment.
            </p>
          )}
          {data.keyAreasOfFocus.map((area, index) => (
            <div
              key={area.id}
              className="border rounded-md p-4 space-y-3"
              data-testid={`focus-area-${area.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-xs">
                  Focus Area {index + 1}
                </Badge>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeKeyFocusArea(area.id)}
                    data-testid={`button-remove-focus-${area.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <FormRow cols={3}>
                <FormField label="Area / Account">
                  <Input
                    value={area.area}
                    onChange={(e) => updateKeyFocusArea(area.id, "area", e.target.value)}
                    placeholder="e.g., Revenue Recognition"
                    disabled={readOnly}
                    data-testid={`input-focus-area-${area.id}`}
                  />
                </FormField>
                <FormField label="Risk Level">
                  <Select
                    value={area.riskLevel}
                    onValueChange={(v) => updateKeyFocusArea(area.id, "riskLevel", v)}
                    disabled={readOnly}
                  >
                    <SelectTrigger data-testid={`select-focus-risk-${area.id}`}>
                      <SelectValue placeholder="Select risk level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Source Risk ID">
                  <Input
                    value={area.sourceRiskId}
                    onChange={(e) => updateKeyFocusArea(area.id, "sourceRiskId", e.target.value)}
                    placeholder="e.g., RISK-001"
                    disabled={readOnly}
                    data-testid={`input-focus-source-${area.id}`}
                  />
                </FormField>
              </FormRow>
              <FormField label="Planned Response">
                <Textarea
                  value={area.plannedResponse}
                  onChange={(e) => updateKeyFocusArea(area.id, "plannedResponse", e.target.value)}
                  placeholder="Describe the planned audit response for this area..."
                  className="min-h-[60px]"
                  disabled={readOnly}
                  data-testid={`textarea-focus-response-${area.id}`}
                />
              </FormField>
            </div>
          ))}
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            onClick={addKeyFocusArea}
            className="gap-2"
            data-testid="button-add-focus-area"
          >
            <Plus className="h-4 w-4" />
            Add Focus Area
          </Button>
        )}
      </FormSection>

      <FormSection
        icon={<Clock className="h-5 w-5" />}
        title="Resource & Timing Plan"
        description="Plan staffing hours by audit phase and key milestone dates"
      >
        <SectionDivider title="Planned Hours by Phase" icon={<Calendar className="h-4 w-4" />} />

        <div className="space-y-3">
          {data.resourceTimingPlan.plannedHoursByPhase.map((phase) => (
            <div
              key={phase.id}
              className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-3 items-end"
              data-testid={`phase-row-${phase.id}`}
            >
              <FormField label="Phase">
                <Input
                  value={phase.phase}
                  onChange={(e) => updatePhasePlan(phase.id, "phase", e.target.value)}
                  placeholder="Phase name"
                  disabled={readOnly}
                  data-testid={`input-phase-name-${phase.id}`}
                />
              </FormField>
              <FormField label="Hours">
                <Input
                  type="number"
                  value={phase.plannedHours || ""}
                  onChange={(e) => updatePhasePlan(phase.id, "plannedHours", parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20"
                  disabled={readOnly}
                  data-testid={`input-phase-hours-${phase.id}`}
                />
              </FormField>
              <FormField label="Start Date">
                <Input
                  type="date"
                  value={phase.startDate}
                  onChange={(e) => updatePhasePlan(phase.id, "startDate", e.target.value)}
                  disabled={readOnly}
                  data-testid={`input-phase-start-${phase.id}`}
                />
              </FormField>
              <FormField label="End Date">
                <Input
                  type="date"
                  value={phase.endDate}
                  onChange={(e) => updatePhasePlan(phase.id, "endDate", e.target.value)}
                  disabled={readOnly}
                  data-testid={`input-phase-end-${phase.id}`}
                />
              </FormField>
              <div className="pb-0.5">
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhasePlan(phase.id)}
                    data-testid={`button-remove-phase-${phase.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {!readOnly && (
            <Button
              variant="outline"
              onClick={addPhasePlan}
              className="gap-2"
              data-testid="button-add-phase"
            >
              <Plus className="h-4 w-4" />
              Add Phase
            </Button>
          )}
          <Badge variant="secondary" data-testid="badge-total-hours">
            Total Planned Hours: {totalPlannedHours}
          </Badge>
        </div>

        <SectionDivider title="Key Dates & Milestones" icon={<Calendar className="h-4 w-4" />} />

        <div className="space-y-3">
          {data.resourceTimingPlan.keyDates.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2 text-center">
              No key dates added yet.
            </p>
          )}
          {data.resourceTimingPlan.keyDates.map((kd) => (
            <div
              key={kd.id}
              className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-end"
              data-testid={`keydate-row-${kd.id}`}
            >
              <FormField label="Description">
                <Input
                  value={kd.description}
                  onChange={(e) => updateKeyDate(kd.id, "description", e.target.value)}
                  placeholder="e.g., Inventory observation"
                  disabled={readOnly}
                  data-testid={`input-keydate-desc-${kd.id}`}
                />
              </FormField>
              <FormField label="Date">
                <Input
                  type="date"
                  value={kd.date}
                  onChange={(e) => updateKeyDate(kd.id, "date", e.target.value)}
                  disabled={readOnly}
                  data-testid={`input-keydate-date-${kd.id}`}
                />
              </FormField>
              <FormField label="Responsible">
                <Input
                  value={kd.responsible}
                  onChange={(e) => updateKeyDate(kd.id, "responsible", e.target.value)}
                  placeholder="Team member"
                  disabled={readOnly}
                  data-testid={`input-keydate-responsible-${kd.id}`}
                />
              </FormField>
              <div className="pb-0.5">
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeKeyDate(kd.id)}
                    data-testid={`button-remove-keydate-${kd.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            onClick={addKeyDate}
            className="gap-2"
            data-testid="button-add-keydate"
          >
            <Plus className="h-4 w-4" />
            Add Key Date
          </Button>
        )}

        <SectionDivider title="Specialist Needs" />

        <FormField label="Specialist Requirements">
          <Textarea
            value={data.resourceTimingPlan.specialistNeeds}
            onChange={(e) =>
              onChange({
                ...data,
                resourceTimingPlan: {
                  ...data.resourceTimingPlan,
                  specialistNeeds: e.target.value,
                },
              })
            }
            placeholder="Document any specialist expertise required (e.g., IT audit, actuarial, valuation experts)..."
            className="min-h-[80px]"
            disabled={readOnly}
            data-testid="textarea-specialist-needs"
          />
        </FormField>
      </FormSection>

      <FormSection
        icon={<MessageSquare className="h-5 w-5" />}
        title="Communication with Those Charged with Governance — ISA 260"
        description="ISA 260.14-17 — Communicate the planned scope and timing of the audit, significant findings, and auditor independence to those charged with governance in a timely manner"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-sm font-semibold text-foreground">Communication Checklist</h4>
          {!readOnly && (
            <AIButton field="tcwg_checklist" label="AI Suggest Status" />
          )}
        </div>

        <QAFormChecklist
          section={tcwgComm.checklist}
          onUpdateItem={handleTCWGChecklistUpdate}
          readOnly={readOnly}
        />

        <SectionDivider title="TCWG Identification" icon={<Users className="h-4 w-4" />} />

        <div className="space-y-3">
          {data.tcwgIdentification.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No TCWG members added. Add members to document governance structure.
            </p>
          )}
          {data.tcwgIdentification.map((member, index) => (
            <div
              key={member.id}
              className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end"
              data-testid={`tcwg-row-${member.id}`}
            >
              <FormField label={index === 0 ? "Name" : ""}>
                <Input
                  value={member.name}
                  onChange={(e) => updateTCWGMember(member.id, "name", e.target.value)}
                  placeholder="Full name"
                  disabled={readOnly}
                  data-testid={`input-tcwg-name-${member.id}`}
                />
              </FormField>
              <FormField label={index === 0 ? "Role" : ""}>
                <Input
                  value={member.role}
                  onChange={(e) => updateTCWGMember(member.id, "role", e.target.value)}
                  placeholder="e.g., Board Chairman, Audit Committee Chair"
                  disabled={readOnly}
                  data-testid={`input-tcwg-role-${member.id}`}
                />
              </FormField>
              <FormField label={index === 0 ? "Contact" : ""}>
                <Input
                  value={member.contact}
                  onChange={(e) => updateTCWGMember(member.id, "contact", e.target.value)}
                  placeholder="Email / Phone"
                  disabled={readOnly}
                  data-testid={`input-tcwg-contact-${member.id}`}
                />
              </FormField>
              <div className={index === 0 ? "pb-0.5" : "pb-0.5"}>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTCWGMember(member.id)}
                    data-testid={`button-remove-tcwg-${member.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            onClick={addTCWGMember}
            className="gap-2"
            data-testid="button-add-tcwg-member"
          >
            <Plus className="h-4 w-4" />
            Add TCWG Member
          </Button>
        )}

        {/* Sub-section 1: Planned Scope & Timing */}
        <SectionDivider title="Planned Scope & Timing (ISA 260.15)" icon={<Compass className="h-4 w-4" />} />

        <div className="flex items-end gap-2">
          <FormField label="Planned Scope & Timing Communication" required className="flex-1 min-w-0">
            <Textarea
              value={tcwgComm.plannedScopeTiming}
              onChange={(e) => updateTCWGComm("plannedScopeTiming", e.target.value)}
              placeholder="Describe the planned overall scope of the audit, including:&#10;• The planned timing and nature of audit procedures&#10;• Significant risks identified and audit response&#10;• Approach to internal control testing&#10;• Use of internal audit work (if applicable)&#10;• Planned involvement of component auditors (if group audit)..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-planned-scope-timing"
            />
          </FormField>
          {!readOnly && <AIButton field="tcwg_scope_timing" label="AI Draft" />}
        </div>

        {/* Sub-section 2: Identified Significant Risks */}
        <SectionDivider title="Identified Significant Risks (ISA 260.16)" icon={<AlertTriangle className="h-4 w-4" />} />

        <div className="flex items-end gap-2">
          <FormField label="Significant Risks to Communicate" required className="flex-1 min-w-0">
            <Textarea
              value={tcwgComm.identifiedSignificantRisks}
              onChange={(e) => updateTCWGComm("identifiedSignificantRisks", e.target.value)}
              placeholder="Document significant risks identified during the audit planning phase to be communicated to TCWG:&#10;• Revenue recognition fraud risk (ISA 240.26)&#10;• Management override of controls (ISA 240.31)&#10;• Going concern uncertainties (if any)&#10;• Other significant risks from risk assessment&#10;• Significant accounting estimates with high estimation uncertainty..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-significant-risks-tcwg"
            />
          </FormField>
          {!readOnly && <AIButton field="tcwg_significant_risks" label="AI Identify" />}
        </div>

        {/* Sub-section 3: Independence Confirmation */}
        <SectionDivider title="Independence Confirmation (ISA 260.17)" icon={<Shield className="h-4 w-4" />} />

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 mb-4">
          <Checkbox
            checked={independenceConf.confirmed}
            onCheckedChange={(checked) => updateIndependenceConf("confirmed", !!checked)}
            disabled={readOnly}
            data-testid="checkbox-independence-confirmed"
          />
          <Label className="text-sm font-medium cursor-pointer">
            We confirm that all relevant ethical requirements regarding independence have been complied with (IESBA Code / ISA 260.17)
          </Label>
        </div>

        <div className="flex items-end gap-2">
          <FormField label="Independence Statement" className="flex-1 min-w-0">
            <Textarea
              value={independenceConf.independenceStatement}
              onChange={(e) => updateIndependenceConf("independenceStatement", e.target.value)}
              placeholder="Provide a statement on independence covering all relationships and matters between the firm, network firms, and the entity that may reasonably be thought to bear on independence..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-independence-statement"
            />
          </FormField>
          {!readOnly && <AIButton field="tcwg_independence_statement" label="AI Draft" />}
        </div>

        <FormRow cols={2}>
          <FormField label="Threats to Independence Identified">
            <Textarea
              value={independenceConf.threatsIdentified}
              onChange={(e) => updateIndependenceConf("threatsIdentified", e.target.value)}
              placeholder="Document any threats to independence identified (self-interest, self-review, advocacy, familiarity, intimidation)..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-threats-identified"
            />
          </FormField>
          <FormField label="Safeguards Applied">
            <Textarea
              value={independenceConf.safeguardsApplied}
              onChange={(e) => updateIndependenceConf("safeguardsApplied", e.target.value)}
              placeholder="Document safeguards applied to reduce identified threats to an acceptable level..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-safeguards-applied"
            />
          </FormField>
        </FormRow>

        {/* Sub-section 4: Materiality Levels */}
        <SectionDivider title="Materiality Levels (ISA 260.A21)" icon={<BarChart3 className="h-4 w-4" />} />

        <div className="flex items-end gap-2">
          <FormField label="Materiality Levels Communication" required className="flex-1 min-w-0">
            <Textarea
              value={tcwgComm.materialityLevels}
              onChange={(e) => updateTCWGComm("materialityLevels", e.target.value)}
              placeholder="Document the materiality levels to be communicated to TCWG:&#10;• Overall materiality and the benchmark used&#10;• Performance materiality&#10;• Clearly trivial threshold&#10;• Any specific materiality for particular classes of transactions, account balances, or disclosures&#10;• Rationale for the levels selected..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-materiality-levels-tcwg"
            />
          </FormField>
          {!readOnly && <AIButton field="tcwg_materiality" label="AI Draft" />}
        </div>

        {/* Communication Schedule & Significant Findings */}
        <SectionDivider title="Communication Schedule & Approach" icon={<Calendar className="h-4 w-4" />} />

        <FormRow cols={2}>
          <FormField label="Significant Findings Approach">
            <Textarea
              value={tcwgComm.significantFindingsApproach}
              onChange={(e) => updateTCWGComm("significantFindingsApproach", e.target.value)}
              placeholder="Describe how significant audit findings, including deficiencies in internal control, will be communicated to TCWG..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-findings-approach"
            />
          </FormField>
          <FormField label="Communication Schedule">
            <Textarea
              value={tcwgComm.communicationSchedule}
              onChange={(e) => updateTCWGComm("communicationSchedule", e.target.value)}
              placeholder="Outline the schedule for TCWG communications:&#10;• Planning meeting date&#10;• Interim update date&#10;• Final reporting meeting date..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-comm-schedule"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Required Evidence" icon={<FileText className="h-4 w-4" />} />

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Required evidence per ISA 260:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            <li>Planning meeting minutes / attendance register</li>
            <li>Independence declaration letter</li>
            <li>Written communication of significant audit matters</li>
            <li>TCWG acknowledgment of materiality levels</li>
            <li>Documentation of any other agreed communications</li>
          </ul>
        </div>
      </FormSection>

      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Planning Memo Summary"
        description="AI-generated summary of all pre-planning conclusions"
      >
        <div className="flex items-center justify-end">
          <AIButton field="planning_memo_summary" label="AI Generate Summary" />
        </div>

        <FormField label="Planning Memorandum">
          <Textarea
            value={data.planningMemoSummary}
            onChange={(e) => onChange({ ...data, planningMemoSummary: e.target.value })}
            placeholder="Summary of all pre-planning conclusions including risk assessment results, materiality decisions, audit strategy, and key matters for attention..."
            className="min-h-[160px]"
            disabled={readOnly}
            data-testid="textarea-planning-memo"
          />
        </FormField>
      </FormSection>

    </div>
  );
}
