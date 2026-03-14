import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Scale, AlertTriangle, FileText, Building2 } from "lucide-react";

interface LawsRegulationsPanelProps {
  engagementId: string;
  readOnly?: boolean;
  onFieldChange?: (field: string, value: any) => void;
  planningData?: any;
}

const DEFAULT_COMPLIANCE_AREAS = [
  { id: "companies-act", label: "Companies Act 2017", category: "Company Law", description: "Filing requirements, statutory disclosures, director duties" },
  { id: "income-tax", label: "Income Tax Ordinance 2001", category: "Tax", description: "Tax compliance, withholding, advance tax, returns" },
  { id: "sales-tax", label: "Sales Tax Act 1990", category: "Tax", description: "Sales tax registration, returns, input adjustment" },
  { id: "secp-regulations", label: "SECP Regulations", category: "Regulatory", description: "Listed company requirements, corporate governance" },
  { id: "sbp-regulations", label: "SBP Regulations", category: "Banking", description: "Banking sector regulations, prudential norms" },
  { id: "labor-laws", label: "Labor Laws & EOBI", category: "Employment", description: "Employment regulations, social security, EOBI contributions" },
  { id: "environmental", label: "Environmental Regulations", category: "Environment", description: "EPA compliance, environmental reporting" },
  { id: "industry-specific", label: "Industry-Specific Regulations", category: "Industry", description: "Sector-specific regulations and licensing" },
  { id: "customs", label: "Customs Act 1969", category: "Trade", description: "Import/export duties, customs declarations" },
  { id: "exchange-control", label: "Foreign Exchange Regulations", category: "FX", description: "Foreign exchange controls and reporting" },
];

export function LawsRegulationsPanel({ engagementId, readOnly, onFieldChange, planningData }: LawsRegulationsPanelProps) {
  const complianceData = planningData?.compliancePlanning || {};

  const getFieldValue = (areaId: string, field: string) => complianceData?.[areaId]?.[field] || "";
  const isAreaApplicable = (areaId: string) => complianceData?.[areaId]?.applicable !== false;

  const updateAreaField = (areaId: string, field: string, value: any) => {
    const updated = { ...complianceData, [areaId]: { ...complianceData?.[areaId], [field]: value } };
    onFieldChange?.("compliancePlanning", updated);
  };

  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Laws & Regulations / Compliance Planning
            </CardTitle>
            <Badge variant="outline" className="text-xs">ISA 250</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Identify applicable laws and regulations, assess compliance risks, and plan audit responses per ISA 250.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            General Compliance Notes
          </h4>
          <Textarea
            value={planningData?.complianceGeneralNotes || ""}
            onChange={(e) => onFieldChange?.("complianceGeneralNotes", e.target.value)}
            placeholder="Document general regulatory environment observations..."
            className="text-xs min-h-[60px]"
            disabled={readOnly}
          />
        </CardContent>
      </Card>

      {DEFAULT_COMPLIANCE_AREAS.map((area) => (
        <Card key={area.id} className={!isAreaApplicable(area.id) ? "opacity-50" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`applicable-${area.id}`}
                  checked={isAreaApplicable(area.id)}
                  onCheckedChange={(checked) => updateAreaField(area.id, "applicable", checked)}
                  disabled={readOnly}
                />
                <CardTitle className="text-sm">{area.label}</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{area.category}</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground ml-6">{area.description}</p>
          </CardHeader>
          {isAreaApplicable(area.id) && (
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Compliance Considerations</Label>
                  <Textarea
                    value={getFieldValue(area.id, "considerations")}
                    onChange={(e) => updateAreaField(area.id, "considerations", e.target.value)}
                    placeholder="Key compliance requirements and considerations..."
                    className="mt-1 text-xs min-h-[50px]"
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label className="text-xs">Non-Compliance Indicators / Risks</Label>
                  <Textarea
                    value={getFieldValue(area.id, "risks")}
                    onChange={(e) => updateAreaField(area.id, "risks", e.target.value)}
                    placeholder="Any indicators of non-compliance observed..."
                    className="mt-1 text-xs min-h-[50px]"
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Planned Response / Specialist Required</Label>
                <Textarea
                  value={getFieldValue(area.id, "plannedResponse")}
                  onChange={(e) => updateAreaField(area.id, "plannedResponse", e.target.value)}
                  placeholder="Planned audit procedures and specialist involvement..."
                  className="mt-1 text-xs min-h-[40px]"
                  disabled={readOnly}
                />
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
