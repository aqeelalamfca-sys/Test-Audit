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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Shield,
  Target,
  TrendingDown,
  Plus,
  Trash2,
  Sparkles,
  BarChart3,
  Scale,
  Zap,
  Star,
} from "lucide-react";
import { FormSection, FormField, FormRow, SectionDivider } from "./sections";
import type {
  RiskAssessmentData,
  IdentifiedRisk,
  SignificantRisk,
  SignificantAccount,
} from "./types";

export interface RiskAssessmentSectionProps {
  engagementId: string;
  data: RiskAssessmentData;
  onChange: (data: RiskAssessmentData) => void;
  onAIGenerate?: (field: string) => void;
  currentUser?: string;
  readOnly?: boolean;
}

function generateId(): string {
  return `risk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function getDefaultRiskAssessmentData(engagementId: string): RiskAssessmentData {
  return {
    engagementId,
    identifiedRisks: [],
    significantRisks: [],
    inherentRiskFactors: {
      complexity: "",
      subjectivity: "",
      change: "",
      uncertainty: "",
      susceptibilityToFraud: "",
      managementBias: "",
      overallInherentRisk: "",
    },
    fraudRiskFactors: {
      pressureIndicators: "",
      opportunityIndicators: "",
      rationalizationIndicators: "",
      managementInquiries: "",
      aiSuggestions: "",
    },
    presumedRisks: {
      revenueRecognitionFraudRisk: true,
      revenueRecognitionDetails: "Revenue recognition is presumed to be a fraud risk per ISA 240.26. The auditor shall treat revenue recognition as a significant risk unless the presumption is rebutted.",
      revenueRecognitionRebuttal: "",
      managementOverrideRisk: true,
      managementOverrideDetails: "Management override of controls is always presumed to be a significant risk per ISA 240.31. This presumption cannot be rebutted.",
    },
    goingConcernAssessment: {
      financialIndicators: "",
      operationalIndicators: "",
      otherIndicators: "",
      conclusion: "",
      conclusionRationale: "",
    },
    significantAccounts: [],
    overallRiskAssessment: {
      inherentRiskLevel: "",
      controlRiskLevel: "",
      combinedAssessment: "",
      assessmentRationale: "",
      financialStatementLevelRisks: "",
      assertionLevelRisks: "",
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

const riskLevelBadge = (level: string) => {
  switch (level) {
    case "high":
      return <Badge variant="destructive" className="text-[10px]">High</Badge>;
    case "medium":
      return <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">Medium</Badge>;
    case "low":
      return <Badge variant="outline" className="text-[10px] bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">Low</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">Not Set</Badge>;
  }
};

export function RiskAssessmentSection({
  engagementId,
  data,
  onChange,
  onAIGenerate,
  currentUser = "Current User",
  readOnly = false,
}: RiskAssessmentSectionProps) {
  const updateField = <K extends keyof RiskAssessmentData>(
    field: K,
    value: RiskAssessmentData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const addRisk = () => {
    const newRisk: IdentifiedRisk = {
      id: generateId(),
      description: "",
      category: "",
      assertion: "",
      riskLevel: "",
      isaReference: "",
      response: "",
    };
    updateField("identifiedRisks", [...data.identifiedRisks, newRisk]);
  };

  const updateRisk = (id: string, field: keyof IdentifiedRisk, value: string) => {
    updateField(
      "identifiedRisks",
      data.identifiedRisks.map((r) =>
        r.id === id ? { ...r, [field]: value } : r
      )
    );
  };

  const removeRisk = (id: string) => {
    updateField(
      "identifiedRisks",
      data.identifiedRisks.filter((r) => r.id !== id)
    );
  };

  const addSignificantAccount = () => {
    const newAccount: SignificantAccount = {
      id: generateId(),
      accountName: "",
      balance: 0,
      exceedsMateriality: false,
      qualitativeSignificance: "",
      riskClassification: "",
    };
    updateField("significantAccounts", [...data.significantAccounts, newAccount]);
  };

  const updateSignificantAccount = (
    id: string,
    field: keyof SignificantAccount,
    value: string | number | boolean
  ) => {
    updateField(
      "significantAccounts",
      data.significantAccounts.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      )
    );
  };

  const removeSignificantAccount = (id: string) => {
    updateField(
      "significantAccounts",
      data.significantAccounts.filter((a) => a.id !== id)
    );
  };

  const addSignificantRisk = () => {
    const newSigRisk: SignificantRisk = {
      id: generateId(),
      description: "",
      whySignificant: "",
      relatedAssertions: "",
      plannedApproach: "",
      sourceRiskId: "",
      isaReference: "",
    };
    updateField("significantRisks", [...(data.significantRisks || []), newSigRisk]);
  };

  const updateSignificantRisk = (id: string, field: keyof SignificantRisk, value: string) => {
    updateField(
      "significantRisks",
      (data.significantRisks || []).map((r) =>
        r.id === id ? { ...r, [field]: value } : r
      )
    );
  };

  const removeSignificantRisk = (id: string) => {
    updateField(
      "significantRisks",
      (data.significantRisks || []).filter((r) => r.id !== id)
    );
  };

  const updateInherentRiskFactor = (field: string, value: string) => {
    updateField("inherentRiskFactors", {
      ...(data.inherentRiskFactors || getDefaultRiskAssessmentData("").inherentRiskFactors),
      [field]: value,
    });
  };

  const handleSignOffChange = (signOffData: SignOffData) => {
    updateField("signOff", signOffData);
  };

  return (
    <div className="space-y-6">
      <FormSection
        icon={<Target className="h-5 w-5" />}
        title="Preliminary Risk Identification"
        description="ISA 315.25-26 - Identify and assess risks of material misstatement at the financial statement and assertion levels"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Document identified risks including description, category, related assertion, and risk level.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {onAIGenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAIGenerate("identifiedRisks")}
                disabled={readOnly}
                data-testid="button-ai-identify-risks"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                AI Identify Risks
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={addRisk}
              disabled={readOnly}
              data-testid="button-add-risk"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Risk
            </Button>
          </div>
        </div>

        {data.identifiedRisks.length > 0 ? (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="min-w-[120px]">Category</TableHead>
                  <TableHead className="min-w-[120px]">Assertion</TableHead>
                  <TableHead className="min-w-[100px]">Risk Level</TableHead>
                  <TableHead className="min-w-[100px]">ISA Ref</TableHead>
                  <TableHead className="min-w-[150px]">Planned Response</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.identifiedRisks.map((risk, index) => (
                  <TableRow key={risk.id} data-testid={`row-risk-${index}`}>
                    <TableCell>
                      <Textarea
                        value={risk.description}
                        onChange={(e) => updateRisk(risk.id, "description", e.target.value)}
                        placeholder="Describe the risk..."
                        className="min-h-[60px] text-sm"
                        disabled={readOnly}
                        data-testid={`textarea-risk-description-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={risk.category}
                        onValueChange={(v) => updateRisk(risk.id, "category", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger data-testid={`select-risk-category-${index}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inherent">Inherent</SelectItem>
                          <SelectItem value="control">Control</SelectItem>
                          <SelectItem value="fraud">Fraud</SelectItem>
                          <SelectItem value="significant">Significant</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={risk.assertion}
                        onValueChange={(v) => updateRisk(risk.id, "assertion", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger data-testid={`select-risk-assertion-${index}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="existence">Existence</SelectItem>
                          <SelectItem value="completeness">Completeness</SelectItem>
                          <SelectItem value="accuracy">Accuracy</SelectItem>
                          <SelectItem value="valuation">Valuation</SelectItem>
                          <SelectItem value="rights">Rights & Obligations</SelectItem>
                          <SelectItem value="presentation">Presentation</SelectItem>
                          <SelectItem value="occurrence">Occurrence</SelectItem>
                          <SelectItem value="cutoff">Cut-off</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={risk.riskLevel}
                        onValueChange={(v) => updateRisk(risk.id, "riskLevel", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger data-testid={`select-risk-level-${index}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={risk.isaReference}
                        onChange={(e) => updateRisk(risk.id, "isaReference", e.target.value)}
                        placeholder="ISA xxx"
                        disabled={readOnly}
                        data-testid={`input-risk-isa-ref-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={risk.response}
                        onChange={(e) => updateRisk(risk.id, "response", e.target.value)}
                        placeholder="Planned response..."
                        className="min-h-[60px] text-sm"
                        disabled={readOnly}
                        data-testid={`textarea-risk-response-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRisk(risk.id)}
                        disabled={readOnly}
                        data-testid={`button-remove-risk-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-md" data-testid="text-no-risks">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No risks identified yet. Click "Add Risk" or use AI to identify risks.</p>
          </div>
        )}
      </FormSection>

      <FormSection
        icon={<Zap className="h-5 w-5" />}
        title="Inherent Risk Factors"
        description="ISA 315.A4 (Revised) — Spectrum of inherent risk assessment considering inherent risk factors"
      >
        <p className="text-sm text-muted-foreground mb-2">
          Assess each inherent risk factor on a spectrum from low to high. These factors determine the assessed level of inherent risk for significant classes of transactions, account balances, and disclosures.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { key: "complexity", label: "Complexity", helper: "ISA 315.A5 — Complexity of transactions, measurement, or presentation" },
            { key: "subjectivity", label: "Subjectivity", helper: "ISA 315.A6 — Degree of subjectivity in measurements or disclosures" },
            { key: "change", label: "Change", helper: "ISA 315.A7 — Degree of change in the entity or its environment" },
            { key: "uncertainty", label: "Uncertainty", helper: "ISA 315.A8 — Estimation or measurement uncertainty" },
            { key: "susceptibilityToFraud", label: "Susceptibility to Fraud", helper: "ISA 315.A9 — Susceptibility to misstatement due to management bias or fraud" },
            { key: "managementBias", label: "Management Bias", helper: "ISA 315.A10 — Susceptibility to management bias in judgment/estimates" },
          ].map((factor) => (
            <FormField key={factor.key} label={factor.label} helperText={factor.helper}>
              <Select
                value={(data.inherentRiskFactors || {})[factor.key as keyof typeof data.inherentRiskFactors] || ""}
                onValueChange={(v) => updateInherentRiskFactor(factor.key, v)}
                disabled={readOnly}
              >
                <SelectTrigger data-testid={`select-irf-${factor.key}`}>
                  <SelectValue placeholder="Assess level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          ))}
        </div>

        <SectionDivider title="Overall Inherent Risk Narrative" />

        <FormField label="Overall Inherent Risk Assessment" helperText="Document the overall assessment considering all inherent risk factors">
          <Textarea
            value={(data.inherentRiskFactors || {}).overallInherentRisk || ""}
            onChange={(e) => updateInherentRiskFactor("overallInherentRisk", e.target.value)}
            placeholder="Summarize the overall inherent risk assessment considering all factors above, noting areas where inherent risk is on the higher end of the spectrum and the implications for audit procedures..."
            className="min-h-[80px]"
            disabled={readOnly}
            data-testid="textarea-overall-inherent-risk"
          />
        </FormField>
      </FormSection>

      <FormSection
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Fraud Risk Factors"
        description="ISA 240.24-27 - Identify and assess risks of material misstatement due to fraud"
      >
        <div className="flex items-center justify-end gap-2">
          {onAIGenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAIGenerate("fraudRiskFactors")}
              disabled={readOnly}
              data-testid="button-ai-fraud-risk"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              AI Suggest Fraud Risks
            </Button>
          )}
        </div>

        <FormRow cols={3}>
          <FormField label="Pressure/Incentive Indicators" helperText="ISA 240.A1 - Incentives or pressures to commit fraud">
            <Textarea
              value={data.fraudRiskFactors.pressureIndicators}
              onChange={(e) =>
                updateField("fraudRiskFactors", {
                  ...data.fraudRiskFactors,
                  pressureIndicators: e.target.value,
                })
              }
              placeholder="Document pressure indicators (e.g., financial targets, bonus structures, debt covenants)..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-pressure-indicators"
            />
          </FormField>
          <FormField label="Opportunity Indicators" helperText="ISA 240.A1 - Circumstances that provide opportunity to commit fraud">
            <Textarea
              value={data.fraudRiskFactors.opportunityIndicators}
              onChange={(e) =>
                updateField("fraudRiskFactors", {
                  ...data.fraudRiskFactors,
                  opportunityIndicators: e.target.value,
                })
              }
              placeholder="Document opportunity indicators (e.g., weak controls, complex transactions, related party dealings)..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-opportunity-indicators"
            />
          </FormField>
          <FormField label="Rationalization Indicators" helperText="ISA 240.A1 - Attitudes or rationalizations for committing fraud">
            <Textarea
              value={data.fraudRiskFactors.rationalizationIndicators}
              onChange={(e) =>
                updateField("fraudRiskFactors", {
                  ...data.fraudRiskFactors,
                  rationalizationIndicators: e.target.value,
                })
              }
              placeholder="Document rationalization indicators (e.g., management attitude, ethical culture)..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-rationalization-indicators"
            />
          </FormField>
        </FormRow>

        <FormField label="Management Inquiries Regarding Fraud" helperText="ISA 240.17-21 — Document inquiries made of management regarding fraud">
          <Textarea
            value={data.fraudRiskFactors.managementInquiries || ""}
            onChange={(e) =>
              updateField("fraudRiskFactors", {
                ...data.fraudRiskFactors,
                managementInquiries: e.target.value,
              })
            }
            placeholder="Document inquiries made of management regarding:&#10;• Management's assessment of the risk that the financial statements may be materially misstated due to fraud&#10;• Management's process for identifying and responding to fraud risks&#10;• Management's communication to employees regarding business practices and ethical behavior&#10;• Whether management has knowledge of any actual, suspected, or alleged fraud..."
            className="min-h-[80px]"
            disabled={readOnly}
            data-testid="textarea-management-inquiries"
          />
        </FormField>

        {data.fraudRiskFactors.aiSuggestions && (
          <FormField label="AI Suggestions">
            <div className="p-3 bg-muted/50 rounded-md text-sm" data-testid="text-ai-fraud-suggestions">
              {data.fraudRiskFactors.aiSuggestions}
            </div>
          </FormField>
        )}
      </FormSection>

      <FormSection
        icon={<Shield className="h-5 w-5" />}
        title="Presumed Risks"
        description="ISA 240.26 (revenue recognition fraud risk) & ISA 240.31 (management override of controls) — Presumed significant risks that require specific audit responses unless rebutted"
      >
        <div className="space-y-6">
          <div className="p-4 border rounded-md space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="revenueRecognitionFraudRisk"
                  checked={data.presumedRisks.revenueRecognitionFraudRisk}
                  onCheckedChange={(checked) =>
                    updateField("presumedRisks", {
                      ...data.presumedRisks,
                      revenueRecognitionFraudRisk: !!checked,
                    })
                  }
                  disabled={readOnly}
                  data-testid="checkbox-revenue-recognition-risk"
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="revenueRecognitionFraudRisk" className="text-sm font-semibold cursor-pointer">
                  Revenue Recognition Fraud Risk (ISA 240.26)
                </Label>
                <Badge variant="destructive" className="text-[10px]">Presumed Risk</Badge>
                <Textarea
                  value={data.presumedRisks.revenueRecognitionDetails}
                  onChange={(e) =>
                    updateField("presumedRisks", {
                      ...data.presumedRisks,
                      revenueRecognitionDetails: e.target.value,
                    })
                  }
                  placeholder="Details of revenue recognition fraud risk..."
                  className="min-h-[60px]"
                  disabled={readOnly}
                  data-testid="textarea-revenue-recognition-details"
                />
                {!data.presumedRisks.revenueRecognitionFraudRisk && (
                  <FormField label="Rebuttal Justification" helperText="ISA 240.26 requires documented justification if this presumption is rebutted">
                    <Textarea
                      value={data.presumedRisks.revenueRecognitionRebuttal}
                      onChange={(e) =>
                        updateField("presumedRisks", {
                          ...data.presumedRisks,
                          revenueRecognitionRebuttal: e.target.value,
                        })
                      }
                      placeholder="Document justification for rebutting the revenue recognition fraud risk presumption..."
                      className="min-h-[80px]"
                      disabled={readOnly}
                      data-testid="textarea-revenue-rebuttal"
                    />
                  </FormField>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-md space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="managementOverrideRisk"
                  checked={data.presumedRisks.managementOverrideRisk}
                  disabled
                  data-testid="checkbox-management-override-risk"
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="managementOverrideRisk" className="text-sm font-semibold cursor-pointer">
                  Management Override of Controls (ISA 240.31)
                </Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="destructive" className="text-[10px]">Presumed Risk</Badge>
                  <Badge variant="outline" className="text-[10px]">Cannot Be Rebutted</Badge>
                </div>
                <Textarea
                  value={data.presumedRisks.managementOverrideDetails}
                  onChange={(e) =>
                    updateField("presumedRisks", {
                      ...data.presumedRisks,
                      managementOverrideDetails: e.target.value,
                    })
                  }
                  placeholder="Details of management override risk and planned responses..."
                  className="min-h-[60px]"
                  disabled={readOnly}
                  data-testid="textarea-management-override-details"
                />
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={<Star className="h-5 w-5" />}
        title="Identification of Significant Risks"
        description="ISA 315.28 — Risks requiring special audit consideration due to their nature or circumstances"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Significant risks are identified risks of material misstatement for which the assessment of inherent risk is close to the upper end of the spectrum. Document why each risk is considered significant and the planned audit approach.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {onAIGenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAIGenerate("significantRisks")}
                disabled={readOnly}
                data-testid="button-ai-significant-risks"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                AI Identify Significant Risks
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={addSignificantRisk}
              disabled={readOnly}
              data-testid="button-add-significant-risk"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Significant Risk
            </Button>
          </div>
        </div>

        {(data.significantRisks || []).length > 0 ? (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Risk Description</TableHead>
                  <TableHead className="min-w-[150px]">Why Significant</TableHead>
                  <TableHead className="min-w-[120px]">Related Assertions</TableHead>
                  <TableHead className="min-w-[150px]">Planned Audit Approach</TableHead>
                  <TableHead className="min-w-[80px]">ISA Ref</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.significantRisks || []).map((sigRisk, index) => (
                  <TableRow key={sigRisk.id} data-testid={`row-significant-risk-${index}`}>
                    <TableCell>
                      <Textarea
                        value={sigRisk.description}
                        onChange={(e) => updateSignificantRisk(sigRisk.id, "description", e.target.value)}
                        placeholder="Describe the significant risk..."
                        className="min-h-[60px] text-sm"
                        disabled={readOnly}
                        data-testid={`textarea-sig-risk-desc-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={sigRisk.whySignificant}
                        onChange={(e) => updateSignificantRisk(sigRisk.id, "whySignificant", e.target.value)}
                        placeholder="Reason for classification as significant..."
                        className="min-h-[60px] text-sm"
                        disabled={readOnly}
                        data-testid={`textarea-sig-risk-why-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={sigRisk.relatedAssertions}
                        onChange={(e) => updateSignificantRisk(sigRisk.id, "relatedAssertions", e.target.value)}
                        placeholder="e.g., Existence, Valuation"
                        disabled={readOnly}
                        data-testid={`input-sig-risk-assertions-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={sigRisk.plannedApproach}
                        onChange={(e) => updateSignificantRisk(sigRisk.id, "plannedApproach", e.target.value)}
                        placeholder="Planned response to the significant risk..."
                        className="min-h-[60px] text-sm"
                        disabled={readOnly}
                        data-testid={`textarea-sig-risk-approach-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={sigRisk.isaReference}
                        onChange={(e) => updateSignificantRisk(sigRisk.id, "isaReference", e.target.value)}
                        placeholder="ISA xxx"
                        disabled={readOnly}
                        data-testid={`input-sig-risk-isa-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSignificantRisk(sigRisk.id)}
                        disabled={readOnly}
                        data-testid={`button-remove-sig-risk-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-md" data-testid="text-no-significant-risks">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No significant risks identified yet. Revenue recognition fraud (ISA 240.26) and management override (ISA 240.31) are presumed significant risks documented in the section above.</p>
          </div>
        )}
      </FormSection>

      <FormSection
        icon={<TrendingDown className="h-5 w-5" />}
        title="Going Concern Assessment"
        description="ISA 570.10 - Evaluate whether events or conditions exist that may cast significant doubt on the entity's ability to continue as a going concern"
      >
        {onAIGenerate && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAIGenerate("goingConcern")}
              disabled={readOnly}
              data-testid="button-ai-going-concern"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              AI Assess Going Concern
            </Button>
          </div>
        )}

        <FormRow cols={3}>
          <FormField label="Financial Indicators" helperText="ISA 570.A3 - Net liability position, negative operating cash flows, etc.">
            <Textarea
              value={data.goingConcernAssessment.financialIndicators}
              onChange={(e) =>
                updateField("goingConcernAssessment", {
                  ...data.goingConcernAssessment,
                  financialIndicators: e.target.value,
                })
              }
              placeholder="Document financial indicators (e.g., recurring losses, working capital deficiency, loan defaults)..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-financial-indicators"
            />
          </FormField>
          <FormField label="Operational Indicators" helperText="ISA 570.A3 - Loss of key management, labor difficulties, etc.">
            <Textarea
              value={data.goingConcernAssessment.operationalIndicators}
              onChange={(e) =>
                updateField("goingConcernAssessment", {
                  ...data.goingConcernAssessment,
                  operationalIndicators: e.target.value,
                })
              }
              placeholder="Document operational indicators (e.g., loss of major customer, key management departure, supply chain issues)..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-operational-indicators"
            />
          </FormField>
          <FormField label="Other Indicators" helperText="ISA 570.A3 - Non-compliance with regulations, pending litigation, etc.">
            <Textarea
              value={data.goingConcernAssessment.otherIndicators}
              onChange={(e) =>
                updateField("goingConcernAssessment", {
                  ...data.goingConcernAssessment,
                  otherIndicators: e.target.value,
                })
              }
              placeholder="Document other indicators (e.g., regulatory non-compliance, major litigation, environmental issues)..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-other-indicators"
            />
          </FormField>
        </FormRow>

        <SectionDivider title="Going Concern Conclusion" />

        <FormRow cols={2}>
          <FormField label="Conclusion" required>
            <Select
              value={data.goingConcernAssessment.conclusion}
              onValueChange={(v) =>
                updateField("goingConcernAssessment", {
                  ...data.goingConcernAssessment,
                  conclusion: v as RiskAssessmentData["goingConcernAssessment"]["conclusion"],
                })
              }
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-going-concern-conclusion">
                <SelectValue placeholder="Select conclusion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_concern">No Going Concern Issues Identified</SelectItem>
                <SelectItem value="material_uncertainty">Material Uncertainty Exists</SelectItem>
                <SelectItem value="significant_doubt">Significant Doubt on Going Concern</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Conclusion Rationale" required>
            <Textarea
              value={data.goingConcernAssessment.conclusionRationale}
              onChange={(e) =>
                updateField("goingConcernAssessment", {
                  ...data.goingConcernAssessment,
                  conclusionRationale: e.target.value,
                })
              }
              placeholder="Document basis for going concern conclusion..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-going-concern-rationale"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<BarChart3 className="h-5 w-5" />}
        title="Significant Account Identification"
        description="ISA 315.A129-A131 - Identify significant classes of transactions, account balances, and disclosures"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Accounts exceeding performance materiality or with qualitative significance factors.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {onAIGenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAIGenerate("significantAccounts")}
                disabled={readOnly}
                data-testid="button-ai-significant-accounts"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                AI Identify from TB
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={addSignificantAccount}
              disabled={readOnly}
              data-testid="button-add-significant-account"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Account
            </Button>
          </div>
        </div>

        {data.significantAccounts.length > 0 ? (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Account Name</TableHead>
                  <TableHead className="min-w-[120px]">Balance</TableHead>
                  <TableHead className="min-w-[100px]">Exceeds Materiality</TableHead>
                  <TableHead className="min-w-[150px]">Qualitative Significance</TableHead>
                  <TableHead className="min-w-[120px]">Classification</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.significantAccounts.map((account, index) => (
                  <TableRow key={account.id} data-testid={`row-significant-account-${index}`}>
                    <TableCell>
                      <Input
                        value={account.accountName}
                        onChange={(e) => updateSignificantAccount(account.id, "accountName", e.target.value)}
                        placeholder="Account name"
                        disabled={readOnly}
                        data-testid={`input-account-name-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={account.balance || ""}
                        onChange={(e) => updateSignificantAccount(account.id, "balance", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        disabled={readOnly}
                        data-testid={`input-account-balance-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={account.exceedsMateriality}
                          onCheckedChange={(checked) => updateSignificantAccount(account.id, "exceedsMateriality", !!checked)}
                          disabled={readOnly}
                          data-testid={`checkbox-exceeds-materiality-${index}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={account.qualitativeSignificance}
                        onChange={(e) => updateSignificantAccount(account.id, "qualitativeSignificance", e.target.value)}
                        placeholder="Qualitative factors..."
                        disabled={readOnly}
                        data-testid={`input-qualitative-significance-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={account.riskClassification}
                        onValueChange={(v) => updateSignificantAccount(account.id, "riskClassification", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger data-testid={`select-risk-classification-${index}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="significant">Significant</SelectItem>
                          <SelectItem value="non_significant">Non-Significant</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSignificantAccount(account.id)}
                        disabled={readOnly}
                        data-testid={`button-remove-account-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-md" data-testid="text-no-significant-accounts">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No significant accounts identified. Use AI to auto-identify from TB data or add manually.</p>
          </div>
        )}
      </FormSection>

      <FormSection
        icon={<Scale className="h-5 w-5" />}
        title="Overall Risk Assessment"
        description="ISA 315.28-30 — Determine the overall assessment of the risks of material misstatement at the financial statement level and assertion level for classes of transactions, account balances, and disclosures"
      >
        {onAIGenerate && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAIGenerate("overallRiskAssessment")}
              disabled={readOnly}
              data-testid="button-ai-overall-risk"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              AI Assess Overall Risk
            </Button>
          </div>
        )}

        <FormRow cols={3}>
          <FormField label="Inherent Risk Level" required>
            <Select
              value={data.overallRiskAssessment.inherentRiskLevel}
              onValueChange={(v) =>
                updateField("overallRiskAssessment", {
                  ...data.overallRiskAssessment,
                  inherentRiskLevel: v as RiskAssessmentData["overallRiskAssessment"]["inherentRiskLevel"],
                })
              }
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-inherent-risk-level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Control Risk Level" required>
            <Select
              value={data.overallRiskAssessment.controlRiskLevel}
              onValueChange={(v) =>
                updateField("overallRiskAssessment", {
                  ...data.overallRiskAssessment,
                  controlRiskLevel: v as RiskAssessmentData["overallRiskAssessment"]["controlRiskLevel"],
                })
              }
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-control-risk-level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Combined Assessment" required>
            <Select
              value={data.overallRiskAssessment.combinedAssessment}
              onValueChange={(v) =>
                updateField("overallRiskAssessment", {
                  ...data.overallRiskAssessment,
                  combinedAssessment: v as RiskAssessmentData["overallRiskAssessment"]["combinedAssessment"],
                })
              }
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-combined-assessment">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </FormRow>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">Current Assessment:</span>
          {riskLevelBadge(data.overallRiskAssessment.inherentRiskLevel)}
          <span className="text-xs text-muted-foreground">Inherent</span>
          <span className="text-muted-foreground">&times;</span>
          {riskLevelBadge(data.overallRiskAssessment.controlRiskLevel)}
          <span className="text-xs text-muted-foreground">Control</span>
          <span className="text-muted-foreground">=</span>
          {riskLevelBadge(data.overallRiskAssessment.combinedAssessment)}
          <span className="text-xs text-muted-foreground">Combined</span>
        </div>

        <FormField label="Assessment Rationale" required>
          <Textarea
            value={data.overallRiskAssessment.assessmentRationale}
            onChange={(e) =>
              updateField("overallRiskAssessment", {
                ...data.overallRiskAssessment,
                assessmentRationale: e.target.value,
              })
            }
            placeholder="Document the basis for the overall risk assessment, including key factors considered..."
            className="min-h-[100px]"
            disabled={readOnly}
            data-testid="textarea-assessment-rationale"
          />
        </FormField>

        <SectionDivider title="Risk Assessment at Two Levels (ISA 315.28-30)" />

        <FormRow cols={2}>
          <FormField label="Financial Statement Level Risks" required helperText="ISA 315.28 — Risks that relate pervasively to the financial statements as a whole">
            <Textarea
              value={data.overallRiskAssessment.financialStatementLevelRisks || ""}
              onChange={(e) =>
                updateField("overallRiskAssessment", {
                  ...data.overallRiskAssessment,
                  financialStatementLevelRisks: e.target.value,
                })
              }
              placeholder="Document risks at the financial statement level:&#10;• Pervasive risks affecting multiple accounts/assertions&#10;• Management integrity concerns&#10;• Entity-wide control deficiencies&#10;• Going concern uncertainties&#10;• Impact on overall audit strategy..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-fs-level-risks"
            />
          </FormField>
          <FormField label="Assertion Level Risks" required helperText="ISA 315.29 — Risks at the assertion level for specific accounts/disclosures">
            <Textarea
              value={data.overallRiskAssessment.assertionLevelRisks || ""}
              onChange={(e) =>
                updateField("overallRiskAssessment", {
                  ...data.overallRiskAssessment,
                  assertionLevelRisks: e.target.value,
                })
              }
              placeholder="Document risks at the assertion level:&#10;• Specific accounts with higher risk assertions&#10;• Revenue — occurrence, completeness, cut-off&#10;• Inventory — existence, valuation&#10;• Receivables — existence, valuation&#10;• Estimates — accuracy, completeness&#10;• Impact on nature/timing/extent of procedures..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-assertion-level-risks"
            />
          </FormField>
        </FormRow>
      </FormSection>

    </div>
  );
}
