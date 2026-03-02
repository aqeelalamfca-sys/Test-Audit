import { useState } from "react";
import { formatAccounting } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, X, AlertTriangle, Shield, TestTube2, BarChart3, FileText, CheckCircle2 } from "lucide-react";

const ASSERTIONS = [
  { id: "existence", label: "Existence / Occurrence", abbr: "E/O" },
  { id: "completeness", label: "Completeness", abbr: "C" },
  { id: "accuracy", label: "Accuracy", abbr: "A" },
  { id: "valuation", label: "Valuation / Allocation", abbr: "V/A" },
  { id: "rights", label: "Rights & Obligations", abbr: "R&O" },
  { id: "presentation", label: "Presentation & Disclosure", abbr: "P&D" },
  { id: "cutoff", label: "Cutoff", abbr: "CO" },
  { id: "classification", label: "Classification", abbr: "CL" }
];

const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"];
const CONTROL_TYPES = ["Preventive", "Detective", "Corrective", "Manual", "Automated", "IT-Dependent"];
const CONTROL_FREQUENCIES = ["Transaction", "Daily", "Weekly", "Monthly", "Quarterly", "Annually"];
const SAMPLING_METHODS = ["Random", "Systematic", "Haphazard", "MUS", "Stratified", "Block", "Judgmental", "100% coverage"];
const TOC_RESULTS = ["NOT_TESTED", "EFFECTIVE", "INEFFECTIVE", "NOT_RELIED_UPON", "DEVIATION_FOUND"];
const TOD_RESULTS = ["NOT_TESTED", "SATISFACTORY", "EXCEPTION_FOUND", "INCONCLUSIVE"];
const ANALYTICAL_TYPES = ["YoY Comparison", "Trend Analysis", "Ratio Analysis", "Budget vs Actual", "Industry Comparison", "Predictive Analysis"];

interface RiskAssessmentFormProps {
  onSave: (data: RiskAssessmentData) => void;
  onCancel: () => void;
  initialData?: Partial<RiskAssessmentData>;
  fsHeadName: string;
}

interface RiskAssessmentData {
  riskDescription: string;
  inherentRisk: string;
  controlRisk: string;
  isFraudRisk: boolean;
  riskDrivers: string[];
  assertions: string[];
}

export function RiskAssessmentForm({ onSave, onCancel, initialData, fsHeadName }: RiskAssessmentFormProps) {
  const [formData, setFormData] = useState<RiskAssessmentData>({
    riskDescription: initialData?.riskDescription || "",
    inherentRisk: initialData?.inherentRisk || "MEDIUM",
    controlRisk: initialData?.controlRisk || "MEDIUM",
    isFraudRisk: initialData?.isFraudRisk || false,
    riskDrivers: initialData?.riskDrivers || [],
    assertions: initialData?.assertions || []
  });

  const riskDriverOptions = [
    "Size vs PM",
    "Year-on-Year fluctuation",
    "Manual journals",
    "Estimation / judgment",
    "Weak controls",
    "Prior year issues",
    "New accounting standard",
    "Complex transactions"
  ];

  const toggleRiskDriver = (driver: string) => {
    setFormData(prev => ({
      ...prev,
      riskDrivers: prev.riskDrivers.includes(driver)
        ? prev.riskDrivers.filter(d => d !== driver)
        : [...prev.riskDrivers, driver]
    }));
  };

  const toggleAssertion = (assertion: string) => {
    setFormData(prev => ({
      ...prev,
      assertions: prev.assertions.includes(assertion)
        ? prev.assertions.filter(a => a !== assertion)
        : [...prev.assertions, assertion]
    }));
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Risk Assessment (ISA 315) - {fsHeadName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="risk-description">Risk Description</Label>
          <Textarea
            id="risk-description"
            placeholder="Describe the identified risk..."
            value={formData.riskDescription}
            onChange={(e) => setFormData(prev => ({ ...prev, riskDescription: e.target.value }))}
            className="min-h-[80px]"
            data-testid="input-risk-description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Inherent Risk</Label>
            <div className="flex gap-2">
              {RISK_LEVELS.map(level => (
                <Button
                  key={level}
                  type="button"
                  size="sm"
                  variant={formData.inherentRisk === level ? "default" : "outline"}
                  onClick={() => setFormData(prev => ({ ...prev, inherentRisk: level }))}
                  data-testid={`btn-ir-${level.toLowerCase()}`}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Control Risk</Label>
            <div className="flex gap-2">
              {RISK_LEVELS.map(level => (
                <Button
                  key={level}
                  type="button"
                  size="sm"
                  variant={formData.controlRisk === level ? "default" : "outline"}
                  onClick={() => setFormData(prev => ({ ...prev, controlRisk: level }))}
                  data-testid={`btn-cr-${level.toLowerCase()}`}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="fraud-risk"
            checked={formData.isFraudRisk}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFraudRisk: !!checked }))}
            data-testid="checkbox-fraud-risk"
          />
          <Label htmlFor="fraud-risk" className="text-sm">Fraud Risk (ISA 240)</Label>
        </div>

        <div className="space-y-2">
          <Label>Assertions Covered</Label>
          <div className="flex flex-wrap gap-2">
            {ASSERTIONS.map(assertion => (
              <Badge
                key={assertion.id}
                variant={formData.assertions.includes(assertion.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleAssertion(assertion.id)}
                data-testid={`badge-assertion-${assertion.id}`}
              >
                {assertion.abbr}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Risk Drivers</Label>
          <div className="grid grid-cols-2 gap-2">
            {riskDriverOptions.map(driver => (
              <div key={driver} className="flex items-center gap-2">
                <Checkbox
                  id={`driver-${driver}`}
                  checked={formData.riskDrivers.includes(driver)}
                  onCheckedChange={() => toggleRiskDriver(driver)}
                />
                <Label htmlFor={`driver-${driver}`} className="text-xs">{driver}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onCancel} data-testid="btn-cancel-risk">
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(formData)} data-testid="btn-save-risk">
            <Save className="h-3 w-3 mr-1" />
            Save Risk
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface TOCFormProps {
  onSave: (data: TOCData) => void;
  onCancel: () => void;
  initialData?: Partial<TOCData>;
}

interface TOCData {
  tocRef: string;
  controlDescription: string;
  controlOwner: string;
  controlType: string;
  controlFrequency: string;
  assertions: string[];
  testSteps: string;
  sampleSize: number;
  result: string;
  deviationsFound: number;
  conclusion: string;
}

export function TOCForm({ onSave, onCancel, initialData }: TOCFormProps) {
  const [formData, setFormData] = useState<TOCData>({
    tocRef: initialData?.tocRef || "",
    controlDescription: initialData?.controlDescription || "",
    controlOwner: initialData?.controlOwner || "",
    controlType: initialData?.controlType || "",
    controlFrequency: initialData?.controlFrequency || "",
    assertions: initialData?.assertions || [],
    testSteps: initialData?.testSteps || "",
    sampleSize: initialData?.sampleSize || 25,
    result: initialData?.result || "NOT_TESTED",
    deviationsFound: initialData?.deviationsFound || 0,
    conclusion: initialData?.conclusion || ""
  });

  const toggleAssertion = (assertion: string) => {
    setFormData(prev => ({
      ...prev,
      assertions: prev.assertions.includes(assertion)
        ? prev.assertions.filter(a => a !== assertion)
        : [...prev.assertions, assertion]
    }));
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="pb-3 bg-blue-50/50">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          Test of Controls (ISA 330)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="toc-ref">Control Reference</Label>
            <Input
              id="toc-ref"
              placeholder="e.g., TOC-CASH-001"
              value={formData.tocRef}
              onChange={(e) => setFormData(prev => ({ ...prev, tocRef: e.target.value }))}
              data-testid="input-toc-ref"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="control-owner">Control Owner</Label>
            <Input
              id="control-owner"
              placeholder="e.g., Finance Manager"
              value={formData.controlOwner}
              onChange={(e) => setFormData(prev => ({ ...prev, controlOwner: e.target.value }))}
              data-testid="input-control-owner"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="control-desc">Control Description</Label>
          <Textarea
            id="control-desc"
            placeholder="Describe the control activity..."
            value={formData.controlDescription}
            onChange={(e) => setFormData(prev => ({ ...prev, controlDescription: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-control-desc"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Control Type</Label>
            <Select
              value={formData.controlType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, controlType: value }))}
            >
              <SelectTrigger data-testid="select-control-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CONTROL_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={formData.controlFrequency}
              onValueChange={(value) => setFormData(prev => ({ ...prev, controlFrequency: value }))}
            >
              <SelectTrigger data-testid="select-control-freq">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {CONTROL_FREQUENCIES.map(freq => (
                  <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Assertions Addressed</Label>
          <div className="flex flex-wrap gap-2">
            {ASSERTIONS.map(assertion => (
              <Badge
                key={assertion.id}
                variant={formData.assertions.includes(assertion.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleAssertion(assertion.id)}
              >
                {assertion.abbr}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-steps">Test Steps Performed</Label>
          <Textarea
            id="test-steps"
            placeholder="1. Obtained understanding of control&#10;2. Selected sample of...&#10;3. Verified..."
            value={formData.testSteps}
            onChange={(e) => setFormData(prev => ({ ...prev, testSteps: e.target.value }))}
            className="min-h-[80px] font-mono text-sm"
            data-testid="input-test-steps"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sample-size">Sample Size</Label>
            <Input
              id="sample-size"
              type="number"
              value={formData.sampleSize}
              onChange={(e) => setFormData(prev => ({ ...prev, sampleSize: parseInt(e.target.value) || 0 }))}
              data-testid="input-toc-sample"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deviations">Deviations Found</Label>
            <Input
              id="deviations"
              type="number"
              value={formData.deviationsFound}
              onChange={(e) => setFormData(prev => ({ ...prev, deviationsFound: parseInt(e.target.value) || 0 }))}
              data-testid="input-deviations"
            />
          </div>
          <div className="space-y-2">
            <Label>Result</Label>
            <Select
              value={formData.result}
              onValueChange={(value) => setFormData(prev => ({ ...prev, result: value }))}
            >
              <SelectTrigger data-testid="select-toc-result">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOC_RESULTS.map(result => (
                  <SelectItem key={result} value={result}>{result.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="toc-conclusion">Conclusion on Control</Label>
          <Textarea
            id="toc-conclusion"
            placeholder="Based on testing, the control is..."
            value={formData.conclusion}
            onChange={(e) => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-toc-conclusion"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(formData)} data-testid="btn-save-toc">
            <Save className="h-3 w-3 mr-1" />
            Save Control Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface TODFormProps {
  onSave: (data: TODData) => void;
  onCancel: () => void;
  initialData?: Partial<TODData>;
}

interface TODData {
  todRef: string;
  procedureDescription: string;
  assertions: string[];
  populationDescription: string;
  populationCount: number;
  populationValue: number;
  samplingMethod: string;
  sampleSize: number;
  testSteps: string;
  exceptionsFound: number;
  exceptionDetails: string;
  projectedMisstatement: number;
  result: string;
  conclusion: string;
}

export function TODForm({ onSave, onCancel, initialData }: TODFormProps) {
  const [formData, setFormData] = useState<TODData>({
    todRef: initialData?.todRef || "",
    procedureDescription: initialData?.procedureDescription || "",
    assertions: initialData?.assertions || [],
    populationDescription: initialData?.populationDescription || "",
    populationCount: initialData?.populationCount || 0,
    populationValue: initialData?.populationValue || 0,
    samplingMethod: initialData?.samplingMethod || "",
    sampleSize: initialData?.sampleSize || 25,
    testSteps: initialData?.testSteps || "",
    exceptionsFound: initialData?.exceptionsFound || 0,
    exceptionDetails: initialData?.exceptionDetails || "",
    projectedMisstatement: initialData?.projectedMisstatement || 0,
    result: initialData?.result || "NOT_TESTED",
    conclusion: initialData?.conclusion || ""
  });

  const toggleAssertion = (assertion: string) => {
    setFormData(prev => ({
      ...prev,
      assertions: prev.assertions.includes(assertion)
        ? prev.assertions.filter(a => a !== assertion)
        : [...prev.assertions, assertion]
    }));
  };

  return (
    <Card className="border-2 border-green-200">
      <CardHeader className="pb-3 bg-green-50/50">
        <CardTitle className="text-sm flex items-center gap-2">
          <TestTube2 className="h-4 w-4 text-green-600" />
          Test of Details (ISA 330/500)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tod-ref">Procedure Reference</Label>
            <Input
              id="tod-ref"
              placeholder="e.g., TOD-CASH-001"
              value={formData.todRef}
              onChange={(e) => setFormData(prev => ({ ...prev, todRef: e.target.value }))}
              data-testid="input-tod-ref"
            />
          </div>
          <div className="space-y-2">
            <Label>Sampling Method</Label>
            <Select
              value={formData.samplingMethod}
              onValueChange={(value) => setFormData(prev => ({ ...prev, samplingMethod: value }))}
            >
              <SelectTrigger data-testid="select-sampling-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {SAMPLING_METHODS.map(method => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="proc-desc">Procedure Description</Label>
          <Textarea
            id="proc-desc"
            placeholder="Describe the substantive test procedure..."
            value={formData.procedureDescription}
            onChange={(e) => setFormData(prev => ({ ...prev, procedureDescription: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-proc-desc"
          />
        </div>

        <div className="space-y-2">
          <Label>Assertions Tested</Label>
          <div className="flex flex-wrap gap-2">
            {ASSERTIONS.map(assertion => (
              <Badge
                key={assertion.id}
                variant={formData.assertions.includes(assertion.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleAssertion(assertion.id)}
              >
                {assertion.abbr}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pop-desc">Population Description</Label>
          <Input
            id="pop-desc"
            placeholder="e.g., All sales invoices for the year"
            value={formData.populationDescription}
            onChange={(e) => setFormData(prev => ({ ...prev, populationDescription: e.target.value }))}
            data-testid="input-pop-desc"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pop-count">Population Count</Label>
            <Input
              id="pop-count"
              type="number"
              value={formData.populationCount}
              onChange={(e) => setFormData(prev => ({ ...prev, populationCount: parseInt(e.target.value) || 0 }))}
              data-testid="input-pop-count"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pop-value">Population Value</Label>
            <Input
              id="pop-value"
              type="number"
              value={formData.populationValue}
              onChange={(e) => setFormData(prev => ({ ...prev, populationValue: parseInt(e.target.value) || 0 }))}
              data-testid="input-pop-value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sample-size">Sample Size</Label>
            <Input
              id="sample-size"
              type="number"
              value={formData.sampleSize}
              onChange={(e) => setFormData(prev => ({ ...prev, sampleSize: parseInt(e.target.value) || 0 }))}
              data-testid="input-tod-sample"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tod-test-steps">Test Steps Performed</Label>
          <Textarea
            id="tod-test-steps"
            placeholder="1. Selected sample from population&#10;2. Vouched to supporting documents&#10;3. Verified calculations..."
            value={formData.testSteps}
            onChange={(e) => setFormData(prev => ({ ...prev, testSteps: e.target.value }))}
            className="min-h-[80px] font-mono text-sm"
            data-testid="input-tod-test-steps"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="exceptions">Exceptions Found</Label>
            <Input
              id="exceptions"
              type="number"
              value={formData.exceptionsFound}
              onChange={(e) => setFormData(prev => ({ ...prev, exceptionsFound: parseInt(e.target.value) || 0 }))}
              data-testid="input-exceptions"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-miss">Projected Misstatement</Label>
            <Input
              id="proj-miss"
              type="number"
              value={formData.projectedMisstatement}
              onChange={(e) => setFormData(prev => ({ ...prev, projectedMisstatement: parseInt(e.target.value) || 0 }))}
              data-testid="input-proj-miss"
            />
          </div>
          <div className="space-y-2">
            <Label>Result</Label>
            <Select
              value={formData.result}
              onValueChange={(value) => setFormData(prev => ({ ...prev, result: value }))}
            >
              <SelectTrigger data-testid="select-tod-result">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOD_RESULTS.map(result => (
                  <SelectItem key={result} value={result}>{result.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {formData.exceptionsFound > 0 && (
          <div className="space-y-2">
            <Label htmlFor="exception-details">Exception Details</Label>
            <Textarea
              id="exception-details"
              placeholder="Describe the nature of exceptions found..."
              value={formData.exceptionDetails}
              onChange={(e) => setFormData(prev => ({ ...prev, exceptionDetails: e.target.value }))}
              className="min-h-[60px]"
              data-testid="input-exception-details"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="tod-conclusion">Conclusion</Label>
          <Textarea
            id="tod-conclusion"
            placeholder="Based on testing, the balance is..."
            value={formData.conclusion}
            onChange={(e) => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-tod-conclusion"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(formData)} data-testid="btn-save-tod">
            <Save className="h-3 w-3 mr-1" />
            Save Test of Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface AnalyticalFormProps {
  onSave: (data: AnalyticalData) => void;
  onCancel: () => void;
  initialData?: Partial<AnalyticalData>;
  currentYearBalance?: number;
  priorYearBalance?: number;
}

interface AnalyticalData {
  procedureRef: string;
  analyticalType: string;
  description: string;
  expectation: string;
  thresholdPercentage: number;
  actualResult: string;
  varianceExplanation: string;
  conclusion: string;
  furtherWorkRequired: boolean;
}

export function AnalyticalForm({ onSave, onCancel, initialData, currentYearBalance, priorYearBalance }: AnalyticalFormProps) {
  const variance = (currentYearBalance || 0) - (priorYearBalance || 0);
  const variancePercent = priorYearBalance ? ((variance / priorYearBalance) * 100).toFixed(1) : "N/A";

  const [formData, setFormData] = useState<AnalyticalData>({
    procedureRef: initialData?.procedureRef || "",
    analyticalType: initialData?.analyticalType || "",
    description: initialData?.description || "",
    expectation: initialData?.expectation || "",
    thresholdPercentage: initialData?.thresholdPercentage || 10,
    actualResult: initialData?.actualResult || `CY: ${formatAccounting(currentYearBalance)}, PY: ${formatAccounting(priorYearBalance)}, Variance: ${variancePercent}%`,
    varianceExplanation: initialData?.varianceExplanation || "",
    conclusion: initialData?.conclusion || "",
    furtherWorkRequired: initialData?.furtherWorkRequired || false
  });

  return (
    <Card className="border-2 border-purple-200">
      <CardHeader className="pb-3 bg-purple-50/50">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-purple-600" />
          Analytical Procedure (ISA 520)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ana-ref">Procedure Reference</Label>
            <Input
              id="ana-ref"
              placeholder="e.g., AN-REV-001"
              value={formData.procedureRef}
              onChange={(e) => setFormData(prev => ({ ...prev, procedureRef: e.target.value }))}
              data-testid="input-ana-ref"
            />
          </div>
          <div className="space-y-2">
            <Label>Analysis Type</Label>
            <Select
              value={formData.analyticalType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, analyticalType: value }))}
            >
              <SelectTrigger data-testid="select-ana-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICAL_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ana-desc">Procedure Description</Label>
          <Textarea
            id="ana-desc"
            placeholder="Describe the analytical procedure performed..."
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-ana-desc"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expectation">Expectation</Label>
            <Textarea
              id="expectation"
              placeholder="What was the expected result/relationship..."
              value={formData.expectation}
              onChange={(e) => setFormData(prev => ({ ...prev, expectation: e.target.value }))}
              className="min-h-[60px]"
              data-testid="input-expectation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actual-result">Actual Result</Label>
            <Textarea
              id="actual-result"
              placeholder="What was the actual result..."
              value={formData.actualResult}
              onChange={(e) => setFormData(prev => ({ ...prev, actualResult: e.target.value }))}
              className="min-h-[60px]"
              data-testid="input-actual-result"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="threshold">Threshold (%)</Label>
          <Input
            id="threshold"
            type="number"
            value={formData.thresholdPercentage}
            onChange={(e) => setFormData(prev => ({ ...prev, thresholdPercentage: parseInt(e.target.value) || 0 }))}
            className="w-32"
            data-testid="input-threshold"
          />
          <p className="text-xs text-muted-foreground">Variances exceeding this threshold require investigation</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="variance-exp">Variance Explanation</Label>
          <Textarea
            id="variance-exp"
            placeholder="If variance exceeds threshold, explain the cause..."
            value={formData.varianceExplanation}
            onChange={(e) => setFormData(prev => ({ ...prev, varianceExplanation: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-variance-exp"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="further-work"
            checked={formData.furtherWorkRequired}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, furtherWorkRequired: !!checked }))}
            data-testid="checkbox-further-work"
          />
          <Label htmlFor="further-work" className="text-sm">Further substantive work required</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ana-conclusion">Conclusion</Label>
          <Textarea
            id="ana-conclusion"
            placeholder="Based on analysis performed..."
            value={formData.conclusion}
            onChange={(e) => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-ana-conclusion"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(formData)} data-testid="btn-save-ana">
            <Save className="h-3 w-3 mr-1" />
            Save Analytical
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface AdjustmentFormProps {
  onSave: (data: AdjustmentData) => void;
  onCancel: () => void;
  initialData?: Partial<AdjustmentData>;
  materialityThreshold?: number;
}

interface AdjustmentData {
  adjustmentRef: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  isPosted: boolean;
  reason: string;
}

export function AdjustmentForm({ onSave, onCancel, initialData, materialityThreshold }: AdjustmentFormProps) {
  const [formData, setFormData] = useState<AdjustmentData>({
    adjustmentRef: initialData?.adjustmentRef || "",
    description: initialData?.description || "",
    debitAccount: initialData?.debitAccount || "",
    creditAccount: initialData?.creditAccount || "",
    amount: initialData?.amount || 0,
    isPosted: initialData?.isPosted || false,
    reason: initialData?.reason || ""
  });

  const isMaterial = materialityThreshold && formData.amount > materialityThreshold;

  return (
    <Card className="border-2 border-orange-200">
      <CardHeader className="pb-3 bg-orange-50/50">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-orange-600" />
          Adjusting Entry (ISA 450)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="adj-ref">Reference</Label>
          <Input
            id="adj-ref"
            placeholder="e.g., AJE-001"
            value={formData.adjustmentRef}
            onChange={(e) => setFormData(prev => ({ ...prev, adjustmentRef: e.target.value }))}
            data-testid="input-adj-ref"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adj-desc">Description</Label>
          <Textarea
            id="adj-desc"
            placeholder="Describe the nature of the adjustment..."
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-adj-desc"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="debit-acc">Debit Account</Label>
            <Input
              id="debit-acc"
              placeholder="Account name/code"
              value={formData.debitAccount}
              onChange={(e) => setFormData(prev => ({ ...prev, debitAccount: e.target.value }))}
              data-testid="input-debit-acc"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-acc">Credit Account</Label>
            <Input
              id="credit-acc"
              placeholder="Account name/code"
              value={formData.creditAccount}
              onChange={(e) => setFormData(prev => ({ ...prev, creditAccount: e.target.value }))}
              data-testid="input-credit-acc"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
              data-testid="input-amount"
            />
          </div>
        </div>

        {isMaterial && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700">
              This adjustment exceeds materiality threshold ({formatAccounting(materialityThreshold)})
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="adj-reason">Reason for Adjustment</Label>
          <Textarea
            id="adj-reason"
            placeholder="Why is this adjustment required..."
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            className="min-h-[60px]"
            data-testid="input-adj-reason"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="is-posted"
            checked={formData.isPosted}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPosted: !!checked }))}
            data-testid="checkbox-posted"
          />
          <Label htmlFor="is-posted" className="text-sm">Posted by client</Label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(formData)} data-testid="btn-save-adj">
            <Save className="h-3 w-3 mr-1" />
            Save Adjustment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ConclusionFormProps {
  onSave: (data: ConclusionData) => void;
  onCancel?: () => void;
  fsHeadName?: string;
  procedureCount?: number;
  controlsTestedCount?: number;
  evidenceCount?: number;
  adjustmentsCount?: number;
  exceptionsCount?: number;
  initialConclusion?: string;
  workSummary?: {
    tocCount: number;
    todCount: number;
    analyticsCount: number;
    adjustmentCount: number;
    evidenceCount: number;
  };
}

interface ConclusionData {
  conclusion: string;
  sufficientEvidence: boolean;
  risksAddressed: boolean;
  conclusionType: "UNQUALIFIED" | "QUALIFIED" | "ADVERSE" | "DISCLAIMER";
}

export function ConclusionForm({ 
  onSave, 
  onCancel,
  fsHeadName, 
  procedureCount, 
  controlsTestedCount, 
  evidenceCount, 
  adjustmentsCount,
  exceptionsCount,
  initialConclusion,
  workSummary
}: ConclusionFormProps) {
  const [formData, setFormData] = useState<ConclusionData>({
    conclusion: initialConclusion || "",
    sufficientEvidence: false,
    risksAddressed: false,
    conclusionType: "UNQUALIFIED"
  });

  const tocCount = workSummary?.tocCount ?? controlsTestedCount ?? 0;
  const todCount = workSummary?.todCount ?? procedureCount ?? 0;
  const analyticsCount = workSummary?.analyticsCount ?? 0;
  const adjCount = workSummary?.adjustmentCount ?? adjustmentsCount ?? 0;
  const evCount = workSummary?.evidenceCount ?? evidenceCount ?? 0;
  const excCount = exceptionsCount ?? 0;
  const fsName = fsHeadName ?? "this FS Head";

  const defaultConclusion = `Based on the audit procedures performed, including:
- ${todCount} substantive test procedures executed
- ${tocCount} controls tested
- ${analyticsCount} analytical procedures completed
- ${evCount} evidence items obtained
${excCount > 0 ? `- ${excCount} exceptions identified and evaluated` : ''}
${adjCount > 0 ? `- ${adjCount} adjustments identified` : ''}

The balance of ${fsName} is fairly stated, in all material respects, in accordance with the applicable financial reporting framework.`;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Overall Conclusion (ISA 330.25-27) - {fsHeadName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-5 gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{tocCount}</div>
            <div className="text-xs text-muted-foreground">Controls</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{todCount}</div>
            <div className="text-xs text-muted-foreground">Details</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{analyticsCount}</div>
            <div className="text-xs text-muted-foreground">Analytics</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{evCount}</div>
            <div className="text-xs text-muted-foreground">Evidence</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{adjCount}</div>
            <div className="text-xs text-muted-foreground">Adjustments</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="sufficient-evidence"
              checked={formData.sufficientEvidence}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sufficientEvidence: !!checked }))}
              data-testid="checkbox-sufficient-evidence"
            />
            <Label htmlFor="sufficient-evidence" className="text-sm">Sufficient appropriate audit evidence obtained</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="risks-addressed"
              checked={formData.risksAddressed}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, risksAddressed: !!checked }))}
              data-testid="checkbox-risks-addressed"
            />
            <Label htmlFor="risks-addressed" className="text-sm">Risks addressed adequately</Label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="conclusion-text">Conclusion</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFormData(prev => ({ ...prev, conclusion: defaultConclusion }))}
              data-testid="btn-use-template"
            >
              Use Template
            </Button>
          </div>
          <Textarea
            id="conclusion-text"
            placeholder="Document your overall conclusion on the FS Head..."
            value={formData.conclusion}
            onChange={(e) => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
            className="min-h-[200px]"
            data-testid="input-conclusion-text"
          />
        </div>

        <div className="space-y-2">
          <Label>Conclusion Type</Label>
          <div className="flex gap-2">
            {(["UNQUALIFIED", "QUALIFIED", "ADVERSE", "DISCLAIMER"] as const).map(type => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={formData.conclusionType === type ? "default" : "outline"}
                onClick={() => setFormData(prev => ({ ...prev, conclusionType: type }))}
                data-testid={`btn-conclusion-${type.toLowerCase()}`}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={() => onSave(formData)} data-testid="btn-save-conclusion">
            <Save className="h-3 w-3 mr-1" />
            Save Conclusion
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { ASSERTIONS, RISK_LEVELS, CONTROL_TYPES, CONTROL_FREQUENCIES, SAMPLING_METHODS, TOC_RESULTS, TOD_RESULTS, ANALYTICAL_TYPES };
