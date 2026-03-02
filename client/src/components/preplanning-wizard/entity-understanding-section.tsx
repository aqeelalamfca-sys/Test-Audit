import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Building2,
  Globe,
  Briefcase,
  Users,
  ShieldCheck,
  Link2,
  FileText,
  Plus,
  Trash2,
  Monitor,
  Server,
  Lock,
  Cloud,
  ShieldAlert,
} from "lucide-react";
import { AIFieldWrapper } from "@/components/ai-field-wrapper";
import { FormSection, FormField, FormRow, SectionDivider } from "./sections";
import type { EntityUnderstandingData, RelatedParty } from "./types";

export interface EntityUnderstandingSectionProps {
  engagementId: string;
  data: EntityUnderstandingData;
  onChange: (data: EntityUnderstandingData) => void;
  currentUser?: string;
  readOnly?: boolean;
}

function generateId(): string {
  return `rp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function getDefaultEntityUnderstandingData(engagementId: string = ""): EntityUnderstandingData {
  return {
    engagementId,
    entityBackground: {
      nature: "",
      legalStructure: "",
      ownership: "",
      sizeClassification: "",
      dateOfIncorporation: "",
      registeredOffice: "",
    },
    industryEnvironment: {
      industryRisks: "",
      regulatoryEnvironment: "",
      economicFactors: "",
      competitiveLandscape: "",
      technologicalFactors: "",
    },
    businessOperations: {
      revenueStreams: "",
      keyCustomers: "",
      keySuppliers: "",
      seasonalPatterns: "",
      geographicSpread: "",
      significantContracts: "",
    },
    governance: {
      governanceStructure: "",
      tcwgComposition: "",
      managementCompetence: "",
      auditCommitteeExists: false,
      auditCommitteeDetails: "",
    },
    internalControlEnvironment: {
      controlEnvironment: "",
      riskAssessmentProcess: "",
      informationSystems: "",
      controlActivities: "",
      monitoringOfControls: "",
      itEnvironment: "",
    },
    itEnvironmentAssessment: {
      itApplications: "",
      itInfrastructure: "",
      itGeneralControls: "",
      automatedControls: "",
      serviceOrganizations: "",
      cybersecurity: "",
      overallItComplexity: "",
      overallItRiskAssessment: "",
    },
    relatedParties: [],
    reportingFramework: {
      framework: "",
      specificRequirements: "",
      significantAccountingPolicies: "",
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

export function EntityUnderstandingSection({
  engagementId,
  data,
  onChange,
  currentUser = "Current User",
  readOnly = false,
}: EntityUnderstandingSectionProps) {
  const updateField = useCallback(
    <K extends keyof EntityUnderstandingData>(field: K, value: EntityUnderstandingData[K]) => {
      onChange({ ...data, [field]: value });
    },
    [data, onChange]
  );

  const updateNestedField = useCallback(
    <S extends "entityBackground" | "industryEnvironment" | "businessOperations" | "governance" | "internalControlEnvironment" | "itEnvironmentAssessment" | "reportingFramework">(
      section: S,
      field: keyof EntityUnderstandingData[S],
      value: any
    ) => {
      onChange({
        ...data,
        [section]: { ...data[section], [field]: value },
      });
    },
    [data, onChange]
  );

  const addRelatedParty = useCallback(() => {
    const newParty: RelatedParty = {
      id: generateId(),
      name: "",
      relationship: "",
      natureOfTransactions: "",
      significanceLevel: "",
      disclosureRequired: false,
    };
    onChange({ ...data, relatedParties: [...data.relatedParties, newParty] });
  }, [data, onChange]);

  const updateRelatedParty = useCallback(
    (id: string, field: keyof RelatedParty, value: any) => {
      onChange({
        ...data,
        relatedParties: data.relatedParties.map((rp) =>
          rp.id === id ? { ...rp, [field]: value } : rp
        ),
      });
    },
    [data, onChange]
  );

  const removeRelatedParty = useCallback(
    (id: string) => {
      onChange({
        ...data,
        relatedParties: data.relatedParties.filter((rp) => rp.id !== id),
      });
    },
    [data, onChange]
  );

  const handleSignOffChange = useCallback(
    (signOffData: SignOffData) => {
      updateField("signOff", signOffData);
    },
    [updateField]
  );

  return (
    <div className="space-y-6">
      <FormSection
        icon={<Building2 className="h-5 w-5" />}
        title="Entity Background"
        description="ISA 315.A1-A30 — Nature, legal structure, ownership, and size classification"
      >
        <FormRow cols={3}>
          <FormField label="Nature of Entity" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="entityBackground.nature"
              label="Nature of Entity"
              value={data.entityBackground.nature}
              onChange={(v) => updateNestedField("entityBackground", "nature", v)}
              rows={3}
              placeholder="Describe the nature of the entity (e.g., manufacturing, services, trading)..."
              disabled={readOnly}
              data-testid="ai-field-entity-nature"
            />
          </FormField>
          <FormField label="Legal Structure" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="entityBackground.legalStructure"
              label="Legal Structure"
              value={data.entityBackground.legalStructure}
              onChange={(v) => updateNestedField("entityBackground", "legalStructure", v)}
              rows={3}
              placeholder="Legal form (private limited, public limited, partnership, etc.)..."
              disabled={readOnly}
              data-testid="ai-field-legal-structure"
            />
          </FormField>
          <FormField label="Ownership Structure" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="entityBackground.ownership"
              label="Ownership Structure"
              value={data.entityBackground.ownership}
              onChange={(v) => updateNestedField("entityBackground", "ownership", v)}
              rows={3}
              placeholder="Describe ownership structure, major shareholders, group relationships..."
              disabled={readOnly}
              data-testid="ai-field-ownership"
            />
          </FormField>
        </FormRow>

        <FormRow cols={3}>
          <FormField label="Size Classification" required>
            <Select
              value={data.entityBackground.sizeClassification}
              onValueChange={(v) =>
                updateNestedField("entityBackground", "sizeClassification", v)
              }
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-size-classification">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small Entity</SelectItem>
                <SelectItem value="medium">Medium Entity</SelectItem>
                <SelectItem value="large">Large Entity</SelectItem>
                <SelectItem value="listed">Listed Entity</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Date of Incorporation">
            <Input
              type="date"
              value={data.entityBackground.dateOfIncorporation}
              onChange={(e) =>
                updateNestedField("entityBackground", "dateOfIncorporation", e.target.value)
              }
              disabled={readOnly}
              data-testid="input-date-incorporation"
            />
          </FormField>
          <FormField label="Registered Office">
            <Input
              value={data.entityBackground.registeredOffice}
              onChange={(e) =>
                updateNestedField("entityBackground", "registeredOffice", e.target.value)
              }
              placeholder="Address of registered office..."
              disabled={readOnly}
              data-testid="input-registered-office"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Globe className="h-5 w-5" />}
        title="Industry & External Environment"
        description="ISA 315.A31-A43 — Industry risks, regulatory environment, economic factors"
      >
        <FormRow cols={2}>
          <FormField label="Industry Risks" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="industryEnvironment.industryRisks"
              label="Industry Risks"
              value={data.industryEnvironment.industryRisks}
              onChange={(v) => updateNestedField("industryEnvironment", "industryRisks", v)}
              rows={4}
              placeholder="Identify key industry-specific risks, competitive dynamics, market conditions..."
              disabled={readOnly}
              data-testid="ai-field-industry-risks"
            />
          </FormField>
          <FormField label="Regulatory Environment" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="industryEnvironment.regulatoryEnvironment"
              label="Regulatory Environment"
              value={data.industryEnvironment.regulatoryEnvironment}
              onChange={(v) => updateNestedField("industryEnvironment", "regulatoryEnvironment", v)}
              rows={4}
              placeholder="Applicable laws, regulations, and compliance requirements..."
              disabled={readOnly}
              data-testid="ai-field-regulatory-env"
            />
          </FormField>
        </FormRow>

        <FormRow cols={3}>
          <FormField label="Economic Factors">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="industryEnvironment.economicFactors"
              label="Economic Factors"
              value={data.industryEnvironment.economicFactors}
              onChange={(v) => updateNestedField("industryEnvironment", "economicFactors", v)}
              rows={3}
              placeholder="General economic conditions affecting the entity..."
              disabled={readOnly}
              data-testid="ai-field-economic-factors"
            />
          </FormField>
          <FormField label="Competitive Landscape">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="industryEnvironment.competitiveLandscape"
              label="Competitive Landscape"
              value={data.industryEnvironment.competitiveLandscape}
              onChange={(v) => updateNestedField("industryEnvironment", "competitiveLandscape", v)}
              rows={3}
              placeholder="Market position, competitors, market share..."
              disabled={readOnly}
              data-testid="ai-field-competitive-landscape"
            />
          </FormField>
          <FormField label="Technological Factors">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="industryEnvironment.technologicalFactors"
              label="Technological Factors"
              value={data.industryEnvironment.technologicalFactors}
              onChange={(v) => updateNestedField("industryEnvironment", "technologicalFactors", v)}
              rows={3}
              placeholder="Technology impact, digital disruption, IT dependencies..."
              disabled={readOnly}
              data-testid="ai-field-tech-factors"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Briefcase className="h-5 w-5" />}
        title="Business Operations"
        description="ISA 315.A44-A60 — Revenue streams, key relationships, and operational patterns"
      >
        <FormRow cols={2}>
          <FormField label="Revenue Streams" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="businessOperations.revenueStreams"
              label="Revenue Streams"
              value={data.businessOperations.revenueStreams}
              onChange={(v) => updateNestedField("businessOperations", "revenueStreams", v)}
              rows={4}
              placeholder="Principal sources of revenue, revenue recognition methods..."
              disabled={readOnly}
              data-testid="ai-field-revenue-streams"
            />
          </FormField>
          <FormField label="Significant Contracts">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="businessOperations.significantContracts"
              label="Significant Contracts"
              value={data.businessOperations.significantContracts}
              onChange={(v) => updateNestedField("businessOperations", "significantContracts", v)}
              rows={4}
              placeholder="Material contracts, long-term agreements, joint ventures..."
              disabled={readOnly}
              data-testid="ai-field-significant-contracts"
            />
          </FormField>
        </FormRow>

        <FormRow cols={2}>
          <FormField label="Key Customers">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="businessOperations.keyCustomers"
              label="Key Customers"
              value={data.businessOperations.keyCustomers}
              onChange={(v) => updateNestedField("businessOperations", "keyCustomers", v)}
              rows={3}
              placeholder="Major customers, concentration risks, credit terms..."
              disabled={readOnly}
              data-testid="ai-field-key-customers"
            />
          </FormField>
          <FormField label="Key Suppliers">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="businessOperations.keySuppliers"
              label="Key Suppliers"
              value={data.businessOperations.keySuppliers}
              onChange={(v) => updateNestedField("businessOperations", "keySuppliers", v)}
              rows={3}
              placeholder="Major suppliers, dependency risks, payment terms..."
              disabled={readOnly}
              data-testid="ai-field-key-suppliers"
            />
          </FormField>
        </FormRow>

        <FormRow cols={2}>
          <FormField label="Seasonal Patterns">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="businessOperations.seasonalPatterns"
              label="Seasonal Patterns"
              value={data.businessOperations.seasonalPatterns}
              onChange={(v) => updateNestedField("businessOperations", "seasonalPatterns", v)}
              rows={3}
              placeholder="Seasonality in operations, peak periods, cyclical factors..."
              disabled={readOnly}
              data-testid="ai-field-seasonal-patterns"
            />
          </FormField>
          <FormField label="Geographic Spread">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="businessOperations.geographicSpread"
              label="Geographic Spread"
              value={data.businessOperations.geographicSpread}
              onChange={(v) => updateNestedField("businessOperations", "geographicSpread", v)}
              rows={3}
              placeholder="Operating locations, international operations, multi-currency exposure..."
              disabled={readOnly}
              data-testid="ai-field-geographic-spread"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Users className="h-5 w-5" />}
        title="Governance & Management"
        description="ISA 315.A61-A75 — Governance structure, TCWG composition, management competence"
      >
        <FormRow cols={2}>
          <FormField label="Governance Structure" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="governance.governanceStructure"
              label="Governance Structure"
              value={data.governance.governanceStructure}
              onChange={(v) => updateNestedField("governance", "governanceStructure", v)}
              rows={4}
              placeholder="Board composition, board committees, governance framework..."
              disabled={readOnly}
              data-testid="ai-field-governance-structure"
            />
          </FormField>
          <FormField label="TCWG Composition" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="governance.tcwgComposition"
              label="TCWG Composition"
              value={data.governance.tcwgComposition}
              onChange={(v) => updateNestedField("governance", "tcwgComposition", v)}
              rows={4}
              placeholder="Those Charged With Governance — names, roles, independence..."
              disabled={readOnly}
              data-testid="ai-field-tcwg-composition"
            />
          </FormField>
        </FormRow>

        <FormField label="Management Competence">
          <AIFieldWrapper hideLabel
            engagementId={engagementId}
            tabId="entity_understanding"
            fieldKey="governance.managementCompetence"
            label="Management Competence"
            value={data.governance.managementCompetence}
            onChange={(v) => updateNestedField("governance", "managementCompetence", v)}
            rows={3}
            placeholder="Assessment of management's experience, qualifications, and integrity..."
            disabled={readOnly}
            data-testid="ai-field-management-competence"
          />
        </FormField>

        <SectionDivider title="Audit Committee" />

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="auditCommitteeExists"
              checked={data.governance.auditCommitteeExists}
              onCheckedChange={(checked) =>
                updateNestedField("governance", "auditCommitteeExists", !!checked)
              }
              disabled={readOnly}
              data-testid="checkbox-audit-committee-exists"
            />
            <Label htmlFor="auditCommitteeExists" className="text-sm font-medium cursor-pointer">
              Entity has an Audit Committee
            </Label>
          </div>
          {data.governance.auditCommitteeExists && (
            <FormField label="Audit Committee Details">
              <AIFieldWrapper hideLabel
                engagementId={engagementId}
                tabId="entity_understanding"
                fieldKey="governance.auditCommitteeDetails"
                label="Audit Committee Details"
                value={data.governance.auditCommitteeDetails}
                onChange={(v) => updateNestedField("governance", "auditCommitteeDetails", v)}
                rows={3}
                placeholder="Audit committee composition, charter, meeting frequency..."
                disabled={readOnly}
                data-testid="ai-field-audit-committee-details"
              />
            </FormField>
          )}
        </div>
      </FormSection>

      <FormSection
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Internal Control Environment"
        description="ISA 315.A76-A105 — Control environment, risk assessment, information systems, monitoring"
      >
        <FormRow cols={2}>
          <FormField label="Control Environment" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="internalControlEnvironment.controlEnvironment"
              label="Control Environment"
              value={data.internalControlEnvironment.controlEnvironment}
              onChange={(v) => updateNestedField("internalControlEnvironment", "controlEnvironment", v)}
              rows={4}
              placeholder="Tone at the top, ethical values, HR policies, organizational structure..."
              disabled={readOnly}
              data-testid="ai-field-control-environment"
            />
          </FormField>
          <FormField label="Risk Assessment Process">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="internalControlEnvironment.riskAssessmentProcess"
              label="Risk Assessment Process"
              value={data.internalControlEnvironment.riskAssessmentProcess}
              onChange={(v) => updateNestedField("internalControlEnvironment", "riskAssessmentProcess", v)}
              rows={4}
              placeholder="Entity's process for identifying, analyzing, and managing business risks..."
              disabled={readOnly}
              data-testid="ai-field-risk-assessment-process"
            />
          </FormField>
        </FormRow>

        <FormRow cols={2}>
          <FormField label="Information Systems" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="internalControlEnvironment.informationSystems"
              label="Information Systems"
              value={data.internalControlEnvironment.informationSystems}
              onChange={(v) => updateNestedField("internalControlEnvironment", "informationSystems", v)}
              rows={4}
              placeholder="Accounting systems, ERP, financial reporting process, journal entry controls..."
              disabled={readOnly}
              data-testid="ai-field-information-systems"
            />
          </FormField>
          <FormField label="Control Activities">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="internalControlEnvironment.controlActivities"
              label="Control Activities"
              value={data.internalControlEnvironment.controlActivities}
              onChange={(v) => updateNestedField("internalControlEnvironment", "controlActivities", v)}
              rows={4}
              placeholder="Authorization, segregation of duties, reconciliations, physical controls..."
              disabled={readOnly}
              data-testid="ai-field-control-activities"
            />
          </FormField>
        </FormRow>

        <FormRow cols={2}>
          <FormField label="Monitoring of Controls">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="internalControlEnvironment.monitoringOfControls"
              label="Monitoring of Controls"
              value={data.internalControlEnvironment.monitoringOfControls}
              onChange={(v) => updateNestedField("internalControlEnvironment", "monitoringOfControls", v)}
              rows={3}
              placeholder="Internal audit function, management monitoring, deficiency remediation..."
              disabled={readOnly}
              data-testid="ai-field-monitoring-controls"
            />
          </FormField>
          <FormField label="IT Environment">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="internalControlEnvironment.itEnvironment"
              label="IT Environment"
              value={data.internalControlEnvironment.itEnvironment}
              onChange={(v) => updateNestedField("internalControlEnvironment", "itEnvironment", v)}
              rows={3}
              placeholder="IT general controls, application controls, cybersecurity, data integrity..."
              disabled={readOnly}
              data-testid="ai-field-it-environment"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Monitor className="h-5 w-5" />}
        title="IT Environment Understanding"
        description="ISA 315.26 (Revised) — Understanding the entity's IT environment and IT general controls"
      >
        <FormRow cols={2}>
          <FormField label="IT Applications Relevant to Financial Reporting" required helperText="ISA 315.A89 — ERP, accounting systems, spreadsheets, automated tools">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="itEnvironmentAssessment.itApplications"
              label="IT Applications"
              value={(data.itEnvironmentAssessment || {}).itApplications || ""}
              onChange={(v) => updateNestedField("itEnvironmentAssessment", "itApplications", v)}
              rows={4}
              placeholder="List IT applications used for financial reporting (e.g., ERP system, accounting software, payroll system, fixed asset register, inventory management)..."
              disabled={readOnly}
              data-testid="ai-field-it-applications"
            />
          </FormField>
          <FormField label="IT Infrastructure" helperText="ISA 315.A90 — Networks, databases, operating systems">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="itEnvironmentAssessment.itInfrastructure"
              label="IT Infrastructure"
              value={(data.itEnvironmentAssessment || {}).itInfrastructure || ""}
              onChange={(v) => updateNestedField("itEnvironmentAssessment", "itInfrastructure", v)}
              rows={4}
              placeholder="Describe IT infrastructure (servers, cloud hosting, database management systems, network architecture, disaster recovery)..."
              disabled={readOnly}
              data-testid="ai-field-it-infrastructure"
            />
          </FormField>
        </FormRow>

        <FormRow cols={2}>
          <FormField label="IT General Controls (ITGCs)" required helperText="ISA 315.A93 — Access, change management, operations, SDLC">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="itEnvironmentAssessment.itGeneralControls"
              label="IT General Controls"
              value={(data.itEnvironmentAssessment || {}).itGeneralControls || ""}
              onChange={(v) => updateNestedField("itEnvironmentAssessment", "itGeneralControls", v)}
              rows={4}
              placeholder="Document IT general controls:&#10;• Access controls (user provisioning, password policies, privileged access)&#10;• Change management (program changes, system updates, testing)&#10;• IT operations (backup, job scheduling, incident management)&#10;• System development lifecycle (SDLC controls)..."
              disabled={readOnly}
              data-testid="ai-field-it-general-controls"
            />
          </FormField>
          <FormField label="Automated Application Controls" helperText="ISA 315.A92 — Automated controls within IT applications">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="itEnvironmentAssessment.automatedControls"
              label="Automated Controls"
              value={(data.itEnvironmentAssessment || {}).automatedControls || ""}
              onChange={(v) => updateNestedField("itEnvironmentAssessment", "automatedControls", v)}
              rows={4}
              placeholder="Document automated application controls:&#10;• Input validation (data type, range, format checks)&#10;• Automated calculations&#10;• Interface/integration controls&#10;• Automated reconciliations&#10;• Workflow/approval controls..."
              disabled={readOnly}
              data-testid="ai-field-automated-controls"
            />
          </FormField>
        </FormRow>

        <FormRow cols={2}>
          <FormField label="Service Organizations" helperText="ISA 402 — Third-party IT service providers">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="itEnvironmentAssessment.serviceOrganizations"
              label="Service Organizations"
              value={(data.itEnvironmentAssessment || {}).serviceOrganizations || ""}
              onChange={(v) => updateNestedField("itEnvironmentAssessment", "serviceOrganizations", v)}
              rows={3}
              placeholder="Document service organizations used for IT services (cloud providers, managed hosting, payroll processing, etc.). Note availability of SOC 1/SOC 2 reports..."
              disabled={readOnly}
              data-testid="ai-field-service-organizations"
            />
          </FormField>
          <FormField label="Cybersecurity Considerations" helperText="ISA 315.A95 — Cyber threats and data protection">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="itEnvironmentAssessment.cybersecurity"
              label="Cybersecurity"
              value={(data.itEnvironmentAssessment || {}).cybersecurity || ""}
              onChange={(v) => updateNestedField("itEnvironmentAssessment", "cybersecurity", v)}
              rows={3}
              placeholder="Document cybersecurity posture (data protection policies, breach history, encryption, penetration testing, employee training)..."
              disabled={readOnly}
              data-testid="ai-field-cybersecurity"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Overall IT Environment Assessment" />

        <FormRow cols={2}>
          <FormField label="Overall IT Complexity" required>
            <Select
              value={(data.itEnvironmentAssessment || {}).overallItComplexity || ""}
              onValueChange={(v) => updateNestedField("itEnvironmentAssessment", "overallItComplexity", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-it-complexity">
                <SelectValue placeholder="Assess IT complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple — Manual/spreadsheet-based, minimal IT</SelectItem>
                <SelectItem value="moderate">Moderate — Standard ERP/accounting system</SelectItem>
                <SelectItem value="complex">Complex — Multiple integrated systems, custom apps</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="IT Risk Assessment" required>
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="itEnvironmentAssessment.overallItRiskAssessment"
              label="IT Risk Assessment"
              value={(data.itEnvironmentAssessment || {}).overallItRiskAssessment || ""}
              onChange={(v) => updateNestedField("itEnvironmentAssessment", "overallItRiskAssessment", v)}
              rows={3}
              placeholder="Overall assessment of IT-related risks, impact on audit strategy, need for IT specialist involvement..."
              disabled={readOnly}
              data-testid="ai-field-it-risk-assessment"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Link2 className="h-5 w-5" />}
        title="Related Parties"
        description="ISA 550 — Related party identification, relationships, and nature of transactions"
      >
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead className="w-[160px]">Relationship</TableHead>
                <TableHead>Nature of Transactions</TableHead>
                <TableHead className="w-[120px]">Significance</TableHead>
                <TableHead className="w-[100px]">Disclosure</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.relatedParties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No related parties added yet. Click the button below to add one.
                  </TableCell>
                </TableRow>
              ) : (
                data.relatedParties.map((rp) => (
                  <TableRow key={rp.id} data-testid={`row-related-party-${rp.id}`}>
                    <TableCell>
                      <Input
                        value={rp.name}
                        onChange={(e) => updateRelatedParty(rp.id, "name", e.target.value)}
                        placeholder="Party name"
                        disabled={readOnly}
                        data-testid={`input-rp-name-${rp.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={rp.relationship}
                        onChange={(e) => updateRelatedParty(rp.id, "relationship", e.target.value)}
                        placeholder="e.g., Subsidiary"
                        disabled={readOnly}
                        data-testid={`input-rp-relationship-${rp.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={rp.natureOfTransactions}
                        onChange={(e) =>
                          updateRelatedParty(rp.id, "natureOfTransactions", e.target.value)
                        }
                        placeholder="Nature of transactions"
                        disabled={readOnly}
                        data-testid={`input-rp-transactions-${rp.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={rp.significanceLevel}
                        onValueChange={(v) => updateRelatedParty(rp.id, "significanceLevel", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger data-testid={`select-rp-significance-${rp.id}`}>
                          <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={rp.disclosureRequired}
                        onCheckedChange={(checked) =>
                          updateRelatedParty(rp.id, "disclosureRequired", !!checked)
                        }
                        disabled={readOnly}
                        data-testid={`checkbox-rp-disclosure-${rp.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      {!readOnly && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRelatedParty(rp.id)}
                          data-testid={`button-remove-rp-${rp.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!readOnly && (
            <Button
              variant="outline"
              onClick={addRelatedParty}
              data-testid="button-add-related-party"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Related Party
            </Button>
          )}
        </div>
      </FormSection>

      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Applicable Financial Reporting Framework"
        description="IFRS/SME specific requirements and significant accounting policies"
      >
        <FormField label="Framework" required>
          <AIFieldWrapper hideLabel
            engagementId={engagementId}
            tabId="entity_understanding"
            fieldKey="reportingFramework.framework"
            label="Framework"
            value={data.reportingFramework.framework}
            onChange={(v) => updateNestedField("reportingFramework", "framework", v)}
            rows={3}
            placeholder="Applicable financial reporting framework (IFRS, local GAAP, etc.)..."
            disabled={readOnly}
            data-testid="ai-field-reporting-framework"
          />
        </FormField>

        <FormRow cols={2}>
          <FormField label="Specific Requirements">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="reportingFramework.specificRequirements"
              label="Specific Requirements"
              value={data.reportingFramework.specificRequirements}
              onChange={(v) => updateNestedField("reportingFramework", "specificRequirements", v)}
              rows={4}
              placeholder="Industry-specific reporting requirements, regulatory disclosures..."
              disabled={readOnly}
              data-testid="ai-field-specific-requirements"
            />
          </FormField>
          <FormField label="Significant Accounting Policies">
            <AIFieldWrapper hideLabel
              engagementId={engagementId}
              tabId="entity_understanding"
              fieldKey="reportingFramework.significantAccountingPolicies"
              label="Significant Accounting Policies"
              value={data.reportingFramework.significantAccountingPolicies}
              onChange={(v) =>
                updateNestedField("reportingFramework", "significantAccountingPolicies", v)
              }
              rows={4}
              placeholder="Key accounting policies, recent changes, areas of judgment..."
              disabled={readOnly}
              data-testid="ai-field-accounting-policies"
            />
          </FormField>
        </FormRow>
      </FormSection>

    </div>
  );
}
