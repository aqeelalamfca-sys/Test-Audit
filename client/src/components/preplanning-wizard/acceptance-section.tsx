import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Users,
  FileText,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  Plus,
  Trash2,
  Sparkles,
  Building2,
  Scale,
  Briefcase,
  Gauge,
} from "lucide-react";
import { QAFormChecklist, type ChecklistItem, type ChecklistSection } from "@/components/compliance-checklist";
import { FormSection, FormField, FormRow, SectionDivider } from "./sections";
import type {
  AcceptanceDueDiligenceData,
  DirectorBeneficialOwnerEntry,
  ScreeningResultEntry,
} from "./types";

export interface AcceptanceDueDiligenceSectionProps {
  engagementId: string;
  data: AcceptanceDueDiligenceData;
  onChange: (data: AcceptanceDueDiligenceData) => void;
  onAIAutoFill?: (field: string) => void;
  currentUser?: string;
  readOnly?: boolean;
}

const RISK_LEVELS = [
  { value: "low", label: "Low", color: "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800" },
  { value: "medium", label: "Medium", color: "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  { value: "high", label: "High", color: "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800" },
];

const SCREENING_CHECK_TYPES = [
  { value: "pep", label: "PEP Check" },
  { value: "sanctions", label: "Sanctions Screening" },
  { value: "adverse_media", label: "Adverse Media" },
  { value: "high_risk_jurisdiction", label: "High-Risk Jurisdiction" },
];

function RiskBadge({ level }: { level: string }) {
  const config = RISK_LEVELS.find(r => r.value === level);
  if (!config) return <Badge variant="outline">Not Assessed</Badge>;
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  );
}

function AIAutoFillButton({ field, onAIAutoFill, disabled }: { field: string; onAIAutoFill?: (field: string) => void; disabled?: boolean }) {
  if (!onAIAutoFill) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onAIAutoFill(field)}
      disabled={disabled}
      className="flex-shrink-0"
      data-testid={`button-ai-autofill-${field}`}
    >
      <Sparkles className="h-4 w-4 text-primary" />
    </Button>
  );
}

export function getDefaultAcceptanceDueDiligenceData(engagementId: string = ""): AcceptanceDueDiligenceData {
  return {
    engagementId,
    clientIntegrityAssessment: "",
    clientIntegrityRationale: "",
    independenceCheck: {
      independenceConfirmed: "",
      conflictsIdentified: false,
      conflictDetails: "",
      safeguardsApplied: "",
      independenceRationale: "",
    },
    competenceAssessment: {
      hasCompetence: "",
      competenceDetails: "",
      resourcesAvailable: "",
      resourceDetails: "",
      specialistRequired: false,
      specialistDetails: "",
    },
    engagementRiskGrading: {
      overallRiskGrade: "",
      riskGradeRationale: "",
      riskFactors: {
        clientType: "",
        geographicRisk: "",
        industryRisk: "",
        transactionRisk: "",
      },
    },
    predecessorAuditorStatus: "",
    predecessorAuditorRemarks: "",
    predecessorAuditorFindings: "",
    dueDiligence: {
      entityIdentity: {
        registrationNumber: "",
        secpNtn: "",
        incorporationDate: "",
        registeredAddress: "",
        natureOfBusiness: "",
        principalActivities: "",
        sourceOfFunds: "",
        expectedTransactionVolume: "",
      },
      directorsAndOwners: [],
      screeningResults: [],
      overallAMLRiskScore: "",
      riskScoreRationale: "",
    },
    scopeLimitations: "",
    hasConditions: false,
    conditionsDescription: "",
    acceptanceDecision: "",
    declineReason: "",
    checklistSection: {
      id: "isa210-isqm-merged",
      title: "ISA 210 & ISQM 1 Requirements",
      description: "Mandatory acceptance and continuance procedures",
      items: [
        { id: "add-1", itemCode: "ADD-1", requirement: "Evaluate management's integrity and ethical values", isaReference: "ISA 210.6", status: "", evidenceIds: [], remarks: "" },
        { id: "add-2", itemCode: "ADD-2", requirement: "Assess competence to perform the engagement", isaReference: "ISQM 1.30", status: "", evidenceIds: [], remarks: "" },
        { id: "add-3", itemCode: "ADD-3", requirement: "Consider ethical requirements and independence", isaReference: "ISQM 1.29", status: "", evidenceIds: [], remarks: "" },
        { id: "add-4", itemCode: "ADD-4", requirement: "Communicate with predecessor auditor (if applicable)", isaReference: "ISA 300.13", status: "", evidenceIds: [], remarks: "" },
        { id: "add-5", itemCode: "ADD-5", requirement: "Evaluate preconditions for an audit (ISA 210)", isaReference: "ISA 210.6", status: "", evidenceIds: [], remarks: "" },
        { id: "add-6", itemCode: "ADD-6", requirement: "Assess resources and capability to complete engagement", isaReference: "ISQM 1.32", status: "", evidenceIds: [], remarks: "" },
        { id: "add-7", itemCode: "ADD-7", requirement: "Consider engagement risk and risk management policies", isaReference: "ISQM 1.23", status: "", evidenceIds: [], remarks: "" },
        { id: "add-8", itemCode: "ADD-8", requirement: "Perform KYC/AML due diligence checks", isaReference: "ISQM 1.28", status: "", evidenceIds: [], remarks: "" },
        { id: "add-9", itemCode: "ADD-9", requirement: "Verify entity identity and beneficial ownership", isaReference: "ISQM 1.28(a)", status: "", evidenceIds: [], remarks: "" },
        { id: "add-10", itemCode: "ADD-10", requirement: "Complete PEP and sanctions screening", isaReference: "ISQM 1.28(b)", status: "", evidenceIds: [], remarks: "" },
      ],
    },
    signOff: {
      preparedBy: "",
      preparedDate: "",
      reviewedBy: "",
      reviewedDate: "",
      status: "DRAFT",
    },
  };
}

export function AcceptanceDueDiligenceSection({
  engagementId,
  data,
  onChange,
  onAIAutoFill,
  currentUser = "Current User",
  readOnly = false,
}: AcceptanceDueDiligenceSectionProps) {
  const handleChange = <K extends keyof AcceptanceDueDiligenceData>(
    field: K,
    value: AcceptanceDueDiligenceData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const handleIndependenceChange = (
    field: keyof AcceptanceDueDiligenceData["independenceCheck"],
    value: unknown
  ) => {
    onChange({
      ...data,
      independenceCheck: { ...data.independenceCheck, [field]: value },
    });
  };

  const handleCompetenceChange = (
    field: keyof AcceptanceDueDiligenceData["competenceAssessment"],
    value: unknown
  ) => {
    onChange({
      ...data,
      competenceAssessment: { ...data.competenceAssessment, [field]: value },
    });
  };

  const handleRiskGradingChange = (
    field: keyof Omit<AcceptanceDueDiligenceData["engagementRiskGrading"], "riskFactors">,
    value: unknown
  ) => {
    onChange({
      ...data,
      engagementRiskGrading: { ...data.engagementRiskGrading, [field]: value },
    });
  };

  const handleRiskFactorChange = (
    field: keyof AcceptanceDueDiligenceData["engagementRiskGrading"]["riskFactors"],
    value: string
  ) => {
    onChange({
      ...data,
      engagementRiskGrading: {
        ...data.engagementRiskGrading,
        riskFactors: { ...data.engagementRiskGrading.riskFactors, [field]: value },
      },
    });
  };

  const handleDueDiligenceChange = (
    section: keyof AcceptanceDueDiligenceData["dueDiligence"],
    value: unknown
  ) => {
    onChange({
      ...data,
      dueDiligence: { ...data.dueDiligence, [section]: value },
    });
  };

  const handleEntityIdentityChange = (
    field: keyof AcceptanceDueDiligenceData["dueDiligence"]["entityIdentity"],
    value: string
  ) => {
    onChange({
      ...data,
      dueDiligence: {
        ...data.dueDiligence,
        entityIdentity: { ...data.dueDiligence.entityIdentity, [field]: value },
      },
    });
  };

  const addDirector = () => {
    const newEntry: DirectorBeneficialOwnerEntry = {
      id: `dir-${Date.now()}`,
      name: "",
      role: "",
      cnicPassport: "",
      nationality: "",
      ownershipPercentage: 0,
      isPEP: false,
      pepDetails: "",
      verified: false,
    };
    handleDueDiligenceChange("directorsAndOwners", [
      ...data.dueDiligence.directorsAndOwners,
      newEntry,
    ]);
  };

  const removeDirector = (id: string) => {
    handleDueDiligenceChange(
      "directorsAndOwners",
      data.dueDiligence.directorsAndOwners.filter((d) => d.id !== id)
    );
  };

  const handleDirectorChange = (
    id: string,
    field: keyof DirectorBeneficialOwnerEntry,
    value: unknown
  ) => {
    handleDueDiligenceChange(
      "directorsAndOwners",
      data.dueDiligence.directorsAndOwners.map((d) =>
        d.id === id ? { ...d, [field]: value } : d
      )
    );
  };

  const addScreeningResult = () => {
    const newEntry: ScreeningResultEntry = {
      id: `scr-${Date.now()}`,
      checkType: "",
      result: "",
      details: "",
      evidenceId: "",
      checkedDate: new Date().toISOString().split("T")[0],
      checkedBy: currentUser,
    };
    handleDueDiligenceChange("screeningResults", [
      ...data.dueDiligence.screeningResults,
      newEntry,
    ]);
  };

  const removeScreeningResult = (id: string) => {
    handleDueDiligenceChange(
      "screeningResults",
      data.dueDiligence.screeningResults.filter((s) => s.id !== id)
    );
  };

  const handleScreeningChange = (
    id: string,
    field: keyof ScreeningResultEntry,
    value: unknown
  ) => {
    handleDueDiligenceChange(
      "screeningResults",
      data.dueDiligence.screeningResults.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  };

  const handleChecklistUpdate = (itemId: string, field: keyof ChecklistItem, value: unknown) => {
    const updatedSection: ChecklistSection = {
      ...data.checklistSection,
      items: data.checklistSection.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    };
    handleChange("checklistSection", updatedSection);
  };

  const handleSignOffChange = (signOffData: SignOffData) => {
    handleChange("signOff", signOffData);
  };

  const independenceCheck = data.independenceCheck || getDefaultAcceptanceDueDiligenceData().independenceCheck;
  const competenceAssessment = data.competenceAssessment || getDefaultAcceptanceDueDiligenceData().competenceAssessment;
  const engagementRiskGrading = data.engagementRiskGrading || getDefaultAcceptanceDueDiligenceData().engagementRiskGrading;
  const riskFactors = engagementRiskGrading.riskFactors || getDefaultAcceptanceDueDiligenceData().engagementRiskGrading.riskFactors;

  return (
    <div className="space-y-6">
      {/* 1. Client Integrity Evaluation (ISA 210, ISQM 1) */}
      <FormSection
        icon={<Shield className="h-5 w-5" />}
        title="Client Integrity Assessment"
        description="ISA 210.6-8 & ISQM 1 — Evaluate management integrity, ethical values, and determine whether preconditions for an audit are present"
      >
        <FormRow cols={2}>
          <FormField label="Client Integrity Assessment" required>
            <RadioGroup
              value={data.clientIntegrityAssessment}
              onValueChange={(v) =>
                handleChange("clientIntegrityAssessment", v as AcceptanceDueDiligenceData["clientIntegrityAssessment"])
              }
              disabled={readOnly}
              className="flex gap-6"
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
            <div className="flex gap-2">
              <Textarea
                value={data.clientIntegrityRationale}
                onChange={(e) => handleChange("clientIntegrityRationale", e.target.value)}
                placeholder="Document basis for integrity assessment..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-integrity-rationale"
              />
              <AIAutoFillButton field="clientIntegrityRationale" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
      </FormSection>

      {/* 2. Independence & Conflict Check (ISA 220, IESBA Code) */}
      <FormSection
        icon={<Scale className="h-5 w-5" />}
        title="Independence & Conflict Check"
        description="ISA 220 & IESBA Code - Confirm independence and identify conflicts of interest"
      >
        <FormRow cols={2}>
          <FormField label="Independence Confirmed" required>
            <RadioGroup
              value={independenceCheck.independenceConfirmed}
              onValueChange={(v) => handleIndependenceChange("independenceConfirmed", v)}
              disabled={readOnly}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="independence-yes" data-testid="radio-independence-yes" />
                <Label htmlFor="independence-yes" className="flex items-center gap-1.5 cursor-pointer">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="independence-no" data-testid="radio-independence-no" />
                <Label htmlFor="independence-no" className="flex items-center gap-1.5 cursor-pointer">
                  <XCircle className="h-4 w-4 text-destructive" />
                  No
                </Label>
              </div>
            </RadioGroup>
          </FormField>
          <FormField label="Independence Rationale">
            <div className="flex gap-2">
              <Textarea
                value={independenceCheck.independenceRationale}
                onChange={(e) => handleIndependenceChange("independenceRationale", e.target.value)}
                placeholder="Basis for independence determination..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-independence-rationale"
              />
              <AIAutoFillButton field="independenceRationale" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="conflictsIdentified"
              checked={independenceCheck.conflictsIdentified}
              onCheckedChange={(checked) => handleIndependenceChange("conflictsIdentified", !!checked)}
              disabled={readOnly}
              data-testid="checkbox-conflicts-identified"
            />
            <Label htmlFor="conflictsIdentified" className="text-sm font-medium cursor-pointer">
              Conflicts of interest identified
            </Label>
          </div>
          {independenceCheck.conflictsIdentified && (
            <FormRow cols={2}>
              <FormField label="Conflict Details" required>
                <Textarea
                  value={independenceCheck.conflictDetails}
                  onChange={(e) => handleIndependenceChange("conflictDetails", e.target.value)}
                  placeholder="Describe identified conflicts..."
                  className="min-h-[80px]"
                  disabled={readOnly}
                  data-testid="textarea-conflict-details"
                />
              </FormField>
              <FormField label="Safeguards Applied">
                <div className="flex gap-2">
                  <Textarea
                    value={independenceCheck.safeguardsApplied}
                    onChange={(e) => handleIndependenceChange("safeguardsApplied", e.target.value)}
                    placeholder="Describe safeguards applied to mitigate conflicts..."
                    className="min-h-[80px] flex-1"
                    disabled={readOnly}
                    data-testid="textarea-safeguards-applied"
                  />
                  <AIAutoFillButton field="safeguardsApplied" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
                </div>
              </FormField>
            </FormRow>
          )}
        </div>
      </FormSection>

      {/* 3. Competence & Resource Assessment (ISQM 1) */}
      <FormSection
        icon={<Briefcase className="h-5 w-5" />}
        title="Competence & Resource Assessment"
        description="ISQM 1.30-32 - Assess firm competence, resources, and capability"
      >
        <FormRow cols={2}>
          <FormField label="Competence to Perform" required>
            <RadioGroup
              value={competenceAssessment.hasCompetence}
              onValueChange={(v) => handleCompetenceChange("hasCompetence", v)}
              disabled={readOnly}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="competence-yes" data-testid="radio-competence-yes" />
                <Label htmlFor="competence-yes" className="flex items-center gap-1.5 cursor-pointer">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="competence-no" data-testid="radio-competence-no" />
                <Label htmlFor="competence-no" className="flex items-center gap-1.5 cursor-pointer">
                  <XCircle className="h-4 w-4 text-destructive" />
                  No
                </Label>
              </div>
            </RadioGroup>
          </FormField>
          <FormField label="Competence Details">
            <div className="flex gap-2">
              <Textarea
                value={competenceAssessment.competenceDetails}
                onChange={(e) => handleCompetenceChange("competenceDetails", e.target.value)}
                placeholder="Document relevant industry experience, qualifications, and team expertise..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-competence-details"
              />
              <AIAutoFillButton field="competenceDetails" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
        <FormRow cols={2}>
          <FormField label="Resources Available" required>
            <RadioGroup
              value={competenceAssessment.resourcesAvailable}
              onValueChange={(v) => handleCompetenceChange("resourcesAvailable", v)}
              disabled={readOnly}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="resources-yes" data-testid="radio-resources-yes" />
                <Label htmlFor="resources-yes" className="flex items-center gap-1.5 cursor-pointer">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="resources-no" data-testid="radio-resources-no" />
                <Label htmlFor="resources-no" className="flex items-center gap-1.5 cursor-pointer">
                  <XCircle className="h-4 w-4 text-destructive" />
                  No
                </Label>
              </div>
            </RadioGroup>
          </FormField>
          <FormField label="Resource Details">
            <div className="flex gap-2">
              <Textarea
                value={competenceAssessment.resourceDetails}
                onChange={(e) => handleCompetenceChange("resourceDetails", e.target.value)}
                placeholder="Document staffing availability, time budgets, and resource allocation..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-resource-details"
              />
              <AIAutoFillButton field="resourceDetails" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="specialistRequired"
              checked={competenceAssessment.specialistRequired}
              onCheckedChange={(checked) => handleCompetenceChange("specialistRequired", !!checked)}
              disabled={readOnly}
              data-testid="checkbox-specialist-required"
            />
            <Label htmlFor="specialistRequired" className="text-sm font-medium cursor-pointer">
              Specialist/expert required (ISA 620)
            </Label>
          </div>
          {competenceAssessment.specialistRequired && (
            <FormField label="Specialist Details" required>
              <Textarea
                value={competenceAssessment.specialistDetails}
                onChange={(e) => handleCompetenceChange("specialistDetails", e.target.value)}
                placeholder="Describe specialist area, anticipated scope, and availability..."
                className="min-h-[80px]"
                disabled={readOnly}
                data-testid="textarea-specialist-details"
              />
            </FormField>
          )}
        </div>
      </FormSection>

      {/* 4. Engagement Risk Grading (ISQM 1) */}
      <FormSection
        icon={<Gauge className="h-5 w-5" />}
        title="Engagement Risk Grading"
        description="ISQM 1.23 - Assess engagement risk factors and assign overall risk grade"
      >
        <FormRow cols={4}>
          <FormField label="Client Type Risk">
            <Select
              value={riskFactors.clientType}
              onValueChange={(v) => handleRiskFactorChange("clientType", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-risk-client-type">
                <SelectValue placeholder="Assess" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Geographic Risk">
            <Select
              value={riskFactors.geographicRisk}
              onValueChange={(v) => handleRiskFactorChange("geographicRisk", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-risk-geographic">
                <SelectValue placeholder="Assess" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Industry Risk">
            <Select
              value={riskFactors.industryRisk}
              onValueChange={(v) => handleRiskFactorChange("industryRisk", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-risk-industry">
                <SelectValue placeholder="Assess" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Transaction Risk">
            <Select
              value={riskFactors.transactionRisk}
              onValueChange={(v) => handleRiskFactorChange("transactionRisk", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-risk-transaction">
                <SelectValue placeholder="Assess" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormRow>
        <FormRow cols={2}>
          <FormField label="Overall Engagement Risk Grade" required>
            <div className="flex items-center gap-3">
              <Select
                value={engagementRiskGrading.overallRiskGrade}
                onValueChange={(v) => handleRiskGradingChange("overallRiskGrade", v)}
                disabled={readOnly}
              >
                <SelectTrigger data-testid="select-overall-risk-grade">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {engagementRiskGrading.overallRiskGrade && (
                <RiskBadge level={engagementRiskGrading.overallRiskGrade} />
              )}
            </div>
          </FormField>
          <FormField label="Risk Grade Rationale" required>
            <div className="flex gap-2">
              <Textarea
                value={engagementRiskGrading.riskGradeRationale}
                onChange={(e) => handleRiskGradingChange("riskGradeRationale", e.target.value)}
                placeholder="Justify the overall engagement risk grade..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-risk-grade-rationale"
              />
              <AIAutoFillButton field="riskGradeRationale" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
      </FormSection>

      {/* 5. Predecessor Auditor Communication (ISA 300) */}
      <FormSection
        icon={<Users className="h-5 w-5" />}
        title="Predecessor Auditor Communication"
        description="ISA 300.13 - Communication with predecessor auditor (if applicable)"
      >
        <FormRow cols={2}>
          <FormField label="Communication Status" required>
            <Select
              value={data.predecessorAuditorStatus}
              onValueChange={(v) =>
                handleChange("predecessorAuditorStatus", v as AcceptanceDueDiligenceData["predecessorAuditorStatus"])
              }
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-predecessor-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="communicated">Communication Completed</SelectItem>
                <SelectItem value="pending">Communication Pending</SelectItem>
                <SelectItem value="not_applicable">Not Applicable (New Client / First Audit)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Remarks">
            <div className="flex gap-2">
              <Textarea
                value={data.predecessorAuditorRemarks}
                onChange={(e) => handleChange("predecessorAuditorRemarks", e.target.value)}
                placeholder="Document communication details or reasons..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-predecessor-remarks"
              />
              <AIAutoFillButton field="predecessorAuditorRemarks" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
        {data.predecessorAuditorStatus === "communicated" && (
          <FormField label="Key Findings from Predecessor">
            <div className="flex gap-2">
              <Textarea
                value={data.predecessorAuditorFindings || ""}
                onChange={(e) => handleChange("predecessorAuditorFindings", e.target.value)}
                placeholder="Document key findings, concerns, or matters raised by predecessor auditor..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-predecessor-findings"
              />
              <AIAutoFillButton field="predecessorAuditorFindings" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        )}
      </FormSection>

      {/* 6. Acceptance Approval */}
      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Acceptance Approval"
        description="Final acceptance/decline decision with partner sign-off"
      >
        <FormField label="Scope Limitations">
          <div className="flex gap-2">
            <Textarea
              value={data.scopeLimitations}
              onChange={(e) => handleChange("scopeLimitations", e.target.value)}
              placeholder="Document any known scope limitations or restrictions..."
              className="min-h-[80px] flex-1"
              disabled={readOnly}
              data-testid="textarea-scope-limitations"
            />
            <AIAutoFillButton field="scopeLimitations" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
          </div>
        </FormField>

        <div className="space-y-4">
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

        <FormField label="Acceptance Decision" required>
          <RadioGroup
            value={data.acceptanceDecision}
            onValueChange={(v) =>
              handleChange("acceptanceDecision", v as AcceptanceDueDiligenceData["acceptanceDecision"])
            }
            disabled={readOnly}
            className="flex flex-wrap gap-4"
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

      {/* Due Diligence (KYC/AML — ISQM 1) */}
      <FormSection
        icon={<Search className="h-5 w-5" />}
        title="Due Diligence & KYC"
        description="ISQM 1.28 - Entity identity, directors/UBOs, screening results"
      >
        <SectionDivider title="Entity Identity" icon={<Building2 className="h-4 w-4" />} />
        <FormRow cols={3}>
          <FormField label="Registration Number" required>
            <Input
              value={data.dueDiligence.entityIdentity.registrationNumber}
              onChange={(e) => handleEntityIdentityChange("registrationNumber", e.target.value)}
              placeholder="Company registration number"
              disabled={readOnly}
              data-testid="input-registration-number"
            />
          </FormField>
          <FormField label="SECP/NTN" required>
            <Input
              value={data.dueDiligence.entityIdentity.secpNtn}
              onChange={(e) => handleEntityIdentityChange("secpNtn", e.target.value)}
              placeholder="SECP/NTN number"
              disabled={readOnly}
              data-testid="input-secp-ntn"
            />
          </FormField>
          <FormField label="Incorporation Date">
            <Input
              type="date"
              value={data.dueDiligence.entityIdentity.incorporationDate}
              onChange={(e) => handleEntityIdentityChange("incorporationDate", e.target.value)}
              disabled={readOnly}
              data-testid="input-incorporation-date"
            />
          </FormField>
        </FormRow>
        <FormField label="Registered Address">
          <Input
            value={data.dueDiligence.entityIdentity.registeredAddress}
            onChange={(e) => handleEntityIdentityChange("registeredAddress", e.target.value)}
            placeholder="Full registered address"
            disabled={readOnly}
            data-testid="input-registered-address"
          />
        </FormField>
        <FormRow cols={2}>
          <FormField label="Nature of Business">
            <div className="flex gap-2">
              <Textarea
                value={data.dueDiligence.entityIdentity.natureOfBusiness}
                onChange={(e) => handleEntityIdentityChange("natureOfBusiness", e.target.value)}
                placeholder="Describe nature of business..."
                className="min-h-[60px] flex-1"
                disabled={readOnly}
                data-testid="textarea-nature-of-business"
              />
              <AIAutoFillButton field="natureOfBusiness" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
          <FormField label="Principal Activities">
            <div className="flex gap-2">
              <Textarea
                value={data.dueDiligence.entityIdentity.principalActivities}
                onChange={(e) => handleEntityIdentityChange("principalActivities", e.target.value)}
                placeholder="Describe principal activities..."
                className="min-h-[60px] flex-1"
                disabled={readOnly}
                data-testid="textarea-principal-activities"
              />
              <AIAutoFillButton field="principalActivities" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
        <FormRow cols={2}>
          <FormField label="Source of Funds">
            <div className="flex gap-2">
              <Textarea
                value={data.dueDiligence.entityIdentity.sourceOfFunds}
                onChange={(e) => handleEntityIdentityChange("sourceOfFunds", e.target.value)}
                placeholder="Document source of funds..."
                className="min-h-[60px] flex-1"
                disabled={readOnly}
                data-testid="textarea-source-of-funds"
              />
              <AIAutoFillButton field="sourceOfFunds" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
          <FormField label="Expected Transaction Volume">
            <Input
              value={data.dueDiligence.entityIdentity.expectedTransactionVolume}
              onChange={(e) => handleEntityIdentityChange("expectedTransactionVolume", e.target.value)}
              placeholder="Expected annual transaction volume"
              disabled={readOnly}
              data-testid="input-expected-transaction-volume"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Directors & Beneficial Owners" icon={<Users className="h-4 w-4" />} />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {data.dueDiligence.directorsAndOwners.length} director(s)/owner(s)
            </span>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addDirector} className="gap-1" data-testid="button-add-director">
                <Plus className="h-3.5 w-3.5" />
                Add Director/Owner
              </Button>
            )}
          </div>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Role</TableHead>
                  <TableHead className="text-xs font-semibold">CNIC/Passport</TableHead>
                  <TableHead className="text-xs font-semibold">Nationality</TableHead>
                  <TableHead className="text-xs font-semibold">Ownership %</TableHead>
                  <TableHead className="text-xs font-semibold text-center">PEP</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Verified</TableHead>
                  {!readOnly && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dueDiligence.directorsAndOwners.map((dir) => (
                  <TableRow key={dir.id} className="hover:bg-muted/20">
                    <TableCell>
                      <Input
                        value={dir.name}
                        onChange={(e) => handleDirectorChange(dir.id, "name", e.target.value)}
                        placeholder="Full name"
                        className="h-8 text-sm"
                        disabled={readOnly}
                        data-testid={`input-director-name-${dir.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={dir.role}
                        onValueChange={(v) => handleDirectorChange(dir.id, "role", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-director-role-${dir.id}`}>
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="director">Director</SelectItem>
                          <SelectItem value="beneficial_owner">Beneficial Owner</SelectItem>
                          <SelectItem value="shareholder">Shareholder</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={dir.cnicPassport}
                        onChange={(e) => handleDirectorChange(dir.id, "cnicPassport", e.target.value)}
                        placeholder="ID number"
                        className="h-8 text-sm"
                        disabled={readOnly}
                        data-testid={`input-director-cnic-${dir.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={dir.nationality}
                        onChange={(e) => handleDirectorChange(dir.id, "nationality", e.target.value)}
                        placeholder="Nationality"
                        className="h-8 text-sm"
                        disabled={readOnly}
                        data-testid={`input-director-nationality-${dir.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={dir.ownershipPercentage}
                        onChange={(e) => handleDirectorChange(dir.id, "ownershipPercentage", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm w-20"
                        disabled={readOnly}
                        data-testid={`input-director-ownership-${dir.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={dir.isPEP}
                        onCheckedChange={(checked) => handleDirectorChange(dir.id, "isPEP", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-director-pep-${dir.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={dir.verified}
                        onCheckedChange={(checked) => handleDirectorChange(dir.id, "verified", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-director-verified-${dir.id}`}
                      />
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDirector(dir.id)}
                          className="text-destructive"
                          data-testid={`button-remove-director-${dir.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {data.dueDiligence.directorsAndOwners.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={readOnly ? 7 : 8} className="text-center text-sm text-muted-foreground py-8">
                      No directors/owners added. Click "Add Director/Owner" to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <SectionDivider title="Screening Results" icon={<Search className="h-4 w-4" />} />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {data.dueDiligence.screeningResults.length} screening check(s)
            </span>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addScreeningResult} className="gap-1" data-testid="button-add-screening">
                <Plus className="h-3.5 w-3.5" />
                Add Screening Check
              </Button>
            )}
          </div>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Check Type</TableHead>
                  <TableHead className="text-xs font-semibold">Result</TableHead>
                  <TableHead className="text-xs font-semibold">Details</TableHead>
                  <TableHead className="text-xs font-semibold">Checked Date</TableHead>
                  <TableHead className="text-xs font-semibold">Checked By</TableHead>
                  {!readOnly && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dueDiligence.screeningResults.map((scr) => (
                  <TableRow key={scr.id} className="hover:bg-muted/20">
                    <TableCell>
                      <Select
                        value={scr.checkType}
                        onValueChange={(v) => handleScreeningChange(scr.id, "checkType", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-screening-type-${scr.id}`}>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {SCREENING_CHECK_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={scr.result}
                        onValueChange={(v) => handleScreeningChange(scr.id, "result", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-screening-result-${scr.id}`}>
                          <SelectValue placeholder="Result" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">Clear</SelectItem>
                          <SelectItem value="hit">Hit</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={scr.details}
                        onChange={(e) => handleScreeningChange(scr.id, "details", e.target.value)}
                        placeholder="Details"
                        className="h-8 text-sm"
                        disabled={readOnly}
                        data-testid={`input-screening-details-${scr.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={scr.checkedDate}
                        onChange={(e) => handleScreeningChange(scr.id, "checkedDate", e.target.value)}
                        className="h-8 text-sm"
                        disabled={readOnly}
                        data-testid={`input-screening-date-${scr.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={scr.checkedBy}
                        onChange={(e) => handleScreeningChange(scr.id, "checkedBy", e.target.value)}
                        placeholder="Checked by"
                        className="h-8 text-sm"
                        disabled={readOnly}
                        data-testid={`input-screening-checked-by-${scr.id}`}
                      />
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeScreeningResult(scr.id)}
                          className="text-destructive"
                          data-testid={`button-remove-screening-${scr.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {data.dueDiligence.screeningResults.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={readOnly ? 5 : 6} className="text-center text-sm text-muted-foreground py-8">
                      No screening checks added. Click "Add Screening Check" to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <FormRow cols={2}>
          <FormField label="Overall AML Risk Score" required>
            <div className="flex items-center gap-3">
              <Select
                value={data.dueDiligence.overallAMLRiskScore}
                onValueChange={(v) => handleDueDiligenceChange("overallAMLRiskScore", v)}
                disabled={readOnly}
              >
                <SelectTrigger data-testid="select-overall-aml-risk">
                  <SelectValue placeholder="Select score" />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.dueDiligence.overallAMLRiskScore && (
                <RiskBadge level={data.dueDiligence.overallAMLRiskScore} />
              )}
            </div>
          </FormField>
          <FormField label="Risk Score Rationale">
            <div className="flex gap-2">
              <Textarea
                value={data.dueDiligence.riskScoreRationale}
                onChange={(e) => handleDueDiligenceChange("riskScoreRationale", e.target.value)}
                placeholder="Justify the overall AML risk score..."
                className="min-h-[60px] flex-1"
                disabled={readOnly}
                data-testid="textarea-risk-score-rationale"
              />
              <AIAutoFillButton field="riskScoreRationale" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
      </FormSection>

      {/* ISA 210/ISQM Compliance Checklist */}
      <FormSection
        icon={<ClipboardCheck className="h-5 w-5" />}
        title="ISA 210 & ISQM 1 Requirements"
        description="Complete required acceptance and continuance procedures"
      >
        <QAFormChecklist
          section={data.checklistSection}
          onUpdateItem={handleChecklistUpdate}
          readOnly={readOnly}
        />
      </FormSection>
    </div>
  );
}
