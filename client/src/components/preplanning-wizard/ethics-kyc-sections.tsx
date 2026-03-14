import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Building2,
  Search,
  FileText,
  Plus,
  Trash2,
  Clock,
} from "lucide-react";
import { ChecklistItem, ChecklistSection, QAFormChecklist } from "@/components/compliance-checklist";
import { EvidenceUploader, EvidenceFile } from "@/components/evidence-uploader";
import type { SignOffData } from "@/components/sign-off-bar";

export interface TeamMemberIndependence {
  id: string;
  name: string;
  role: "partner" | "manager" | "senior" | "staff" | "";
  hasFinancialInterest: boolean;
  hasFamilyRelationship: boolean;
  hasBusinessRelationship: boolean;
  hasPriorEmployment: boolean;
  declarationDate: string;
  declarationConfirmed: boolean;
  remarks: string;
}

export interface ThreatSafeguard {
  id: string;
  threatType: "self-interest" | "self-review" | "advocacy" | "familiarity" | "intimidation" | "";
  description: string;
  severity: "low" | "medium" | "high" | "";
  safeguardApplied: string;
  residualRisk: "acceptable" | "unacceptable" | "";
  remarks: string;
}

export interface EthicsIndependenceData {
  engagementId: string;
  teamDeclarations: TeamMemberIndependence[];
  threatsIdentified: ThreatSafeguard[];
  nonAuditServicesProvided: boolean;
  nonAuditServicesDescription: string;
  longAssociationYears: number;
  rotationRequired: boolean;
  rotationNotes: string;
  independenceChecklistSection: ChecklistSection;
  overallConclusion: "independent" | "not_independent" | "";
  conclusionRationale: string;
  managerSignOff: SignOffData;
  partnerSignOff: SignOffData;
}

export interface EntityIdentity {
  registrationNumber: string;
  secpNtn: string;
  incorporationDate: string;
  registeredAddress: string;
  natureOfBusiness: string;
  principalActivities: string;
  sourceOfFunds: string;
  expectedTransactionVolume: string;
}

export interface DirectorBeneficialOwner {
  id: string;
  name: string;
  role: "director" | "beneficial_owner" | "shareholder" | "";
  cnicPassport: string;
  nationality: string;
  ownershipPercentage: number;
  isPEP: boolean;
  pepDetails: string;
  verified: boolean;
}

export interface ScreeningResult {
  id: string;
  checkType: "pep" | "sanctions" | "adverse_media" | "high_risk_jurisdiction" | "";
  result: "clear" | "hit" | "pending" | "";
  details: string;
  evidenceId: string;
  checkedDate: string;
  checkedBy: string;
}

export interface KYCAMLData {
  engagementId: string;
  entityIdentity: EntityIdentity;
  directorsAndOwners: DirectorBeneficialOwner[];
  screeningResults: ScreeningResult[];
  kycChecklistSection: ChecklistSection;
  evidenceFiles: EvidenceFile[];
  riskFactors: {
    clientType: "low" | "medium" | "high" | "";
    geographicRisk: "low" | "medium" | "high" | "";
    industryRisk: "low" | "medium" | "high" | "";
    transactionRisk: "low" | "medium" | "high" | "";
  };
  overallAMLRiskScore: "low" | "medium" | "high" | "";
  riskScoreRationale: string;
  conclusion: string;
  signOff: SignOffData;
}

export interface EthicsIndependenceSectionProps {
  engagementId: string;
  data: EthicsIndependenceData;
  onChange: (data: EthicsIndependenceData) => void;
  currentUser?: string;
  readOnly?: boolean;
}

export interface KYCAMLSectionProps {
  engagementId: string;
  data: KYCAMLData;
  onChange: (data: KYCAMLData) => void;
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
    </Label>
    {children}
    {helperText && (
      <p className="text-xs text-muted-foreground">{helperText}</p>
    )}
  </div>
);

const FormRow = ({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) => (
  <div className={`grid gap-2.5 ${cols === 2 ? 'md:grid-cols-2' : cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
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

const THREAT_TYPES = [
  { value: "self-interest", label: "Self-Interest" },
  { value: "self-review", label: "Self-Review" },
  { value: "advocacy", label: "Advocacy" },
  { value: "familiarity", label: "Familiarity" },
  { value: "intimidation", label: "Intimidation" },
];

const ROLE_OPTIONS = [
  { value: "partner", label: "Partner" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff" },
];

const RISK_LEVELS = [
  { value: "low", label: "Low", color: "bg-green-50 text-green-600 border-green-200" },
  { value: "medium", label: "Medium", color: "bg-amber-50 text-amber-600 border-amber-200" },
  { value: "high", label: "High", color: "bg-red-50 text-red-600 border-red-200" },
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

export function EthicsIndependenceSection({
  engagementId,
  data,
  onChange,
  currentUser = "Current User",
  readOnly = false,
}: EthicsIndependenceSectionProps) {
  const handleChange = <K extends keyof EthicsIndependenceData>(
    field: K,
    value: EthicsIndependenceData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const handleTeamMemberChange = (
    id: string,
    field: keyof TeamMemberIndependence,
    value: unknown
  ) => {
    const updated = data.teamDeclarations.map(member =>
      member.id === id ? { ...member, [field]: value } : member
    );
    handleChange("teamDeclarations", updated);
  };

  const addTeamMember = () => {
    const newMember: TeamMemberIndependence = {
      id: `team-${Date.now()}`,
      name: "",
      role: "",
      hasFinancialInterest: false,
      hasFamilyRelationship: false,
      hasBusinessRelationship: false,
      hasPriorEmployment: false,
      declarationDate: new Date().toISOString().split("T")[0],
      declarationConfirmed: false,
      remarks: "",
    };
    handleChange("teamDeclarations", [...data.teamDeclarations, newMember]);
  };

  const removeTeamMember = (id: string) => {
    handleChange("teamDeclarations", data.teamDeclarations.filter(m => m.id !== id));
  };

  const handleThreatChange = (
    id: string,
    field: keyof ThreatSafeguard,
    value: unknown
  ) => {
    const updated = data.threatsIdentified.map(threat =>
      threat.id === id ? { ...threat, [field]: value } : threat
    );
    handleChange("threatsIdentified", updated);
  };

  const addThreat = () => {
    const newThreat: ThreatSafeguard = {
      id: `threat-${Date.now()}`,
      threatType: "",
      description: "",
      severity: "",
      safeguardApplied: "",
      residualRisk: "",
      remarks: "",
    };
    handleChange("threatsIdentified", [...data.threatsIdentified, newThreat]);
  };

  const removeThreat = (id: string) => {
    handleChange("threatsIdentified", data.threatsIdentified.filter(t => t.id !== id));
  };

  const handleChecklistUpdate = (itemId: string, field: keyof ChecklistItem, value: unknown) => {
    const updatedSection: ChecklistSection = {
      ...data.independenceChecklistSection,
      items: data.independenceChecklistSection.items.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    };
    handleChange("independenceChecklistSection", updatedSection);
  };

  const allDeclarationsConfirmed = data.teamDeclarations.every(m => m.declarationConfirmed);
  const hasUnacceptableThreats = data.threatsIdentified.some(t => t.residualRisk === "unacceptable");

  return (
    <div className="space-y-3">
      <FormSection
        icon={<Shield className="h-5 w-5" />}
        title="Independence Register (IESBA + ISA 220)"
        description="Merged register documenting all independence items and team member declarations"
      >
        <QAFormChecklist
          section={data.independenceChecklistSection}
          onUpdateItem={handleChecklistUpdate}
          readOnly={readOnly}
        />
      </FormSection>

      <FormSection
        icon={<UserCheck className="h-5 w-5" />}
        title="Team Member Independence Declarations"
        description="Independence confirmations from each engagement team member"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {data.teamDeclarations.length} team member(s)
              </span>
              {allDeclarationsConfirmed && data.teamDeclarations.length > 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  All Confirmed
                </Badge>
              )}
            </div>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addTeamMember} className="gap-1" data-testid="button-add-team-member">
                <Plus className="h-3.5 w-3.5" />
                Add Team Member
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[150px] text-xs">Name</TableHead>
                  <TableHead className="w-[100px] text-xs">Role</TableHead>
                  <TableHead className="w-[80px] text-xs text-center">Financial Interest</TableHead>
                  <TableHead className="w-[80px] text-xs text-center">Family Relationship</TableHead>
                  <TableHead className="w-[80px] text-xs text-center">Business Relationship</TableHead>
                  <TableHead className="w-[80px] text-xs text-center">Prior Employment</TableHead>
                  <TableHead className="w-[100px] text-xs">Declaration Date</TableHead>
                  <TableHead className="w-[80px] text-xs text-center">Confirmed</TableHead>
                  {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.teamDeclarations.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Input
                        value={member.name}
                        onChange={(e) => handleTeamMemberChange(member.id, "name", e.target.value)}
                        placeholder="Team member name"
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-member-name-${member.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleTeamMemberChange(member.id, "role", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-member-role-${member.id}`}>
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={member.hasFinancialInterest}
                        onCheckedChange={(checked) => handleTeamMemberChange(member.id, "hasFinancialInterest", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-financial-${member.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={member.hasFamilyRelationship}
                        onCheckedChange={(checked) => handleTeamMemberChange(member.id, "hasFamilyRelationship", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-family-${member.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={member.hasBusinessRelationship}
                        onCheckedChange={(checked) => handleTeamMemberChange(member.id, "hasBusinessRelationship", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-business-${member.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={member.hasPriorEmployment}
                        onCheckedChange={(checked) => handleTeamMemberChange(member.id, "hasPriorEmployment", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-employment-${member.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={member.declarationDate}
                        onChange={(e) => handleTeamMemberChange(member.id, "declarationDate", e.target.value)}
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-declaration-date-${member.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={member.declarationConfirmed}
                        onCheckedChange={(checked) => handleTeamMemberChange(member.id, "declarationConfirmed", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-confirmed-${member.id}`}
                      />
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamMember(member.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          data-testid={`button-remove-member-${member.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {data.teamDeclarations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-2">
                      No team members added. Click "Add Team Member" to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Conflicts & Threats Identified"
        description="Document independence threats and safeguards applied (IESBA)"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {data.threatsIdentified.length} threat(s) documented
              </span>
              {hasUnacceptableThreats && (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Unacceptable Threats Present
                </Badge>
              )}
            </div>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addThreat} className="gap-1" data-testid="button-add-threat">
                <Plus className="h-3.5 w-3.5" />
                Add Threat
              </Button>
            )}
          </div>

          {data.threatsIdentified.map((threat) => (
            <Card key={threat.id} className="p-2.5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    Threat #{data.threatsIdentified.indexOf(threat) + 1}
                  </Badge>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeThreat(threat.id)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      data-testid={`button-remove-threat-${threat.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <FormRow cols={3}>
                  <FormField label="Threat Type" required>
                    <Select
                      value={threat.threatType}
                      onValueChange={(v) => handleThreatChange(threat.id, "threatType", v)}
                      disabled={readOnly}
                    >
                      <SelectTrigger data-testid={`select-threat-type-${threat.id}`}>
                        <SelectValue placeholder="Select threat type" />
                      </SelectTrigger>
                      <SelectContent>
                        {THREAT_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Severity" required>
                    <Select
                      value={threat.severity}
                      onValueChange={(v) => handleThreatChange(threat.id, "severity", v)}
                      disabled={readOnly}
                    >
                      <SelectTrigger data-testid={`select-severity-${threat.id}`}>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_LEVELS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Residual Risk" required>
                    <Select
                      value={threat.residualRisk}
                      onValueChange={(v) => handleThreatChange(threat.id, "residualRisk", v)}
                      disabled={readOnly}
                    >
                      <SelectTrigger data-testid={`select-residual-${threat.id}`}>
                        <SelectValue placeholder="After safeguards" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acceptable">Acceptable</SelectItem>
                        <SelectItem value="unacceptable">Unacceptable</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </FormRow>
                <FormRow cols={2}>
                  <FormField label="Description">
                    <Textarea
                      value={threat.description}
                      onChange={(e) => handleThreatChange(threat.id, "description", e.target.value)}
                      placeholder="Describe the threat..."
                      className="min-h-[60px]"
                      disabled={readOnly}
                      data-testid={`textarea-threat-desc-${threat.id}`}
                    />
                  </FormField>
                  <FormField label="Safeguards Applied">
                    <Textarea
                      value={threat.safeguardApplied}
                      onChange={(e) => handleThreatChange(threat.id, "safeguardApplied", e.target.value)}
                      placeholder="Document safeguards..."
                      className="min-h-[60px]"
                      disabled={readOnly}
                      data-testid={`textarea-safeguard-${threat.id}`}
                    />
                  </FormField>
                </FormRow>
              </div>
            </Card>
          ))}

          {data.threatsIdentified.length === 0 && (
            <div className="text-center py-2 text-sm text-muted-foreground border rounded-lg bg-muted/30">
              No threats documented. Click "Add Threat" if any independence threats exist.
            </div>
          )}
        </div>

        <SectionDivider title="Non-Audit Services & Long Association" icon={<Clock className="h-4 w-4" />} />

        <FormRow cols={2}>
          <div className="space-y-2.5">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="nonAuditServices"
                checked={data.nonAuditServicesProvided}
                onCheckedChange={(checked) => handleChange("nonAuditServicesProvided", !!checked)}
                disabled={readOnly}
                data-testid="checkbox-non-audit-services"
              />
              <Label htmlFor="nonAuditServices" className="text-sm font-medium cursor-pointer">
                Non-audit services provided to client
              </Label>
            </div>
            {data.nonAuditServicesProvided && (
              <FormField label="Description of Non-Audit Services">
                <Textarea
                  value={data.nonAuditServicesDescription}
                  onChange={(e) => handleChange("nonAuditServicesDescription", e.target.value)}
                  placeholder="Describe non-audit services and independence assessment..."
                  className="min-h-[80px]"
                  disabled={readOnly}
                  data-testid="textarea-non-audit-desc"
                />
              </FormField>
            )}
          </div>
          <div className="space-y-2.5">
            <FormField label="Years of Long Association">
              <Input
                type="number"
                min={0}
                value={data.longAssociationYears}
                onChange={(e) => handleChange("longAssociationYears", parseInt(e.target.value) || 0)}
                disabled={readOnly}
                data-testid="input-long-association"
              />
            </FormField>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="rotationRequired"
                checked={data.rotationRequired}
                onCheckedChange={(checked) => handleChange("rotationRequired", !!checked)}
                disabled={readOnly}
                data-testid="checkbox-rotation"
              />
              <Label htmlFor="rotationRequired" className="text-sm font-medium cursor-pointer">
                Partner rotation required
              </Label>
            </div>
            {data.rotationRequired && (
              <FormField label="Rotation Notes">
                <Textarea
                  value={data.rotationNotes}
                  onChange={(e) => handleChange("rotationNotes", e.target.value)}
                  placeholder="Document rotation plan..."
                  className="min-h-[60px]"
                  disabled={readOnly}
                  data-testid="textarea-rotation-notes"
                />
              </FormField>
            )}
          </div>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Independence Conclusion"
        description="Overall determination and sign-off"
      >
        <FormRow cols={2}>
          <FormField label="Overall Conclusion" required>
            <RadioGroup
              value={data.overallConclusion}
              onValueChange={(v) => handleChange("overallConclusion", v as EthicsIndependenceData["overallConclusion"])}
              disabled={readOnly}
              className="flex gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="independent" id="conclusion-independent" data-testid="radio-independent" />
                <Label htmlFor="conclusion-independent" className="flex items-center gap-1.5 cursor-pointer">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Independent
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="not_independent" id="conclusion-not-independent" data-testid="radio-not-independent" />
                <Label htmlFor="conclusion-not-independent" className="flex items-center gap-1.5 cursor-pointer">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Not Independent
                </Label>
              </div>
            </RadioGroup>
          </FormField>
          <FormField label="Conclusion Rationale" required>
            <Textarea
              value={data.conclusionRationale}
              onChange={(e) => handleChange("conclusionRationale", e.target.value)}
              placeholder="Document basis for independence conclusion..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-conclusion-rationale"
            />
          </FormField>
        </FormRow>

      </FormSection>
    </div>
  );
}

export function KYCAMLSection({
  engagementId,
  data,
  onChange,
  currentUser = "Current User",
  readOnly = false,
}: KYCAMLSectionProps) {
  const handleChange = <K extends keyof KYCAMLData>(
    field: K,
    value: KYCAMLData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const handleEntityChange = <K extends keyof EntityIdentity>(
    field: K,
    value: EntityIdentity[K]
  ) => {
    handleChange("entityIdentity", { ...data.entityIdentity, [field]: value });
  };

  const handleOwnerChange = (
    id: string,
    field: keyof DirectorBeneficialOwner,
    value: unknown
  ) => {
    const updated = data.directorsAndOwners.map(owner =>
      owner.id === id ? { ...owner, [field]: value } : owner
    );
    handleChange("directorsAndOwners", updated);
  };

  const addOwner = () => {
    const newOwner: DirectorBeneficialOwner = {
      id: `owner-${Date.now()}`,
      name: "",
      role: "",
      cnicPassport: "",
      nationality: "",
      ownershipPercentage: 0,
      isPEP: false,
      pepDetails: "",
      verified: false,
    };
    handleChange("directorsAndOwners", [...data.directorsAndOwners, newOwner]);
  };

  const removeOwner = (id: string) => {
    handleChange("directorsAndOwners", data.directorsAndOwners.filter(o => o.id !== id));
  };

  const handleScreeningChange = (
    id: string,
    field: keyof ScreeningResult,
    value: unknown
  ) => {
    const updated = data.screeningResults.map(result =>
      result.id === id ? { ...result, [field]: value } : result
    );
    handleChange("screeningResults", updated);
  };

  const handleRiskFactorChange = <K extends keyof KYCAMLData["riskFactors"]>(
    field: K,
    value: KYCAMLData["riskFactors"][K]
  ) => {
    const updatedFactors = { ...data.riskFactors, [field]: value };
    handleChange("riskFactors", updatedFactors);
    
    const riskValues = Object.values(updatedFactors).filter(v => v !== "");
    if (riskValues.length > 0) {
      const riskScores = { low: 1, medium: 2, high: 3 };
      const avgScore = riskValues.reduce((sum, v) => sum + (riskScores[v as keyof typeof riskScores] || 0), 0) / riskValues.length;
      let overallRisk: "low" | "medium" | "high" = "low";
      if (avgScore >= 2.5) overallRisk = "high";
      else if (avgScore >= 1.5) overallRisk = "medium";
      handleChange("overallAMLRiskScore", overallRisk);
    }
  };

  const handleChecklistUpdate = (itemId: string, field: keyof ChecklistItem, value: unknown) => {
    const updatedSection: ChecklistSection = {
      ...data.kycChecklistSection,
      items: data.kycChecklistSection.items.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    };
    handleChange("kycChecklistSection", updatedSection);
  };

  const handleEvidenceUpload = (files: FileList, tags: string[]) => {
    const newFiles: EvidenceFile[] = Array.from(files).map((file, idx) => ({
      id: `evidence-${Date.now()}-${idx}`,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedBy: currentUser,
      uploadedDate: new Date().toISOString().split("T")[0],
      phase: "Pre-Planning",
      section: "KYC/AML",
      tags,
    }));
    handleChange("evidenceFiles", [...data.evidenceFiles, ...newFiles]);
  };

  const handleEvidenceDelete = (fileId: string) => {
    handleChange("evidenceFiles", data.evidenceFiles.filter(f => f.id !== fileId));
  };

  const hasPEP = data.directorsAndOwners.some(o => o.isPEP);
  const hasSanctionsHit = data.screeningResults.some(r => r.result === "hit");

  return (
    <div className="space-y-3">
      <FormSection
        icon={<Building2 className="h-5 w-5" />}
        title="Entity Identity"
        description="SECP/NTN registration and business details"
      >
        <FormRow cols={3}>
          <FormField label="Registration Number" required>
            <Input
              value={data.entityIdentity.registrationNumber}
              onChange={(e) => handleEntityChange("registrationNumber", e.target.value)}
              placeholder="Company registration number"
              disabled={readOnly}
              data-testid="input-registration-number"
            />
          </FormField>
          <FormField label="SECP/NTN" required>
            <Input
              value={data.entityIdentity.secpNtn}
              onChange={(e) => handleEntityChange("secpNtn", e.target.value)}
              placeholder="SECP/NTN number"
              disabled={readOnly}
              data-testid="input-secp-ntn"
            />
          </FormField>
          <FormField label="Incorporation Date">
            <Input
              type="date"
              value={data.entityIdentity.incorporationDate}
              onChange={(e) => handleEntityChange("incorporationDate", e.target.value)}
              disabled={readOnly}
              data-testid="input-incorporation-date"
            />
          </FormField>
        </FormRow>

        <FormField label="Registered Address">
          <Textarea
            value={data.entityIdentity.registeredAddress}
            onChange={(e) => handleEntityChange("registeredAddress", e.target.value)}
            placeholder="Full registered address"
            className="min-h-[60px]"
            disabled={readOnly}
            data-testid="textarea-registered-address"
          />
        </FormField>

        <SectionDivider title="Nature of Business & Source of Funds" icon={<FileText className="h-4 w-4" />} />

        <FormRow cols={2}>
          <FormField label="Nature of Business" required>
            <Textarea
              value={data.entityIdentity.natureOfBusiness}
              onChange={(e) => handleEntityChange("natureOfBusiness", e.target.value)}
              placeholder="Describe the nature of business..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-nature-business"
            />
          </FormField>
          <FormField label="Principal Activities">
            <Textarea
              value={data.entityIdentity.principalActivities}
              onChange={(e) => handleEntityChange("principalActivities", e.target.value)}
              placeholder="List principal activities..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-principal-activities"
            />
          </FormField>
        </FormRow>

        <FormRow cols={2}>
          <FormField label="Source of Funds" required>
            <Textarea
              value={data.entityIdentity.sourceOfFunds}
              onChange={(e) => handleEntityChange("sourceOfFunds", e.target.value)}
              placeholder="Document source of funds..."
              className="min-h-[60px]"
              disabled={readOnly}
              data-testid="textarea-source-funds"
            />
          </FormField>
          <FormField label="Expected Transaction Volume">
            <Input
              value={data.entityIdentity.expectedTransactionVolume}
              onChange={(e) => handleEntityChange("expectedTransactionVolume", e.target.value)}
              placeholder="e.g., PKR 10-50 million annually"
              disabled={readOnly}
              data-testid="input-transaction-volume"
            />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection
        icon={<Users className="h-5 w-5" />}
        title="Directors & Beneficial Owners"
        description="Identify and verify all directors and beneficial owners (UBOs)"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {data.directorsAndOwners.length} person(s)
              </span>
              {hasPEP && (
                <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  PEP Identified
                </Badge>
              )}
            </div>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addOwner} className="gap-1" data-testid="button-add-owner">
                <Plus className="h-3.5 w-3.5" />
                Add Person
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[150px] text-xs">Name</TableHead>
                  <TableHead className="w-[120px] text-xs">Role</TableHead>
                  <TableHead className="w-[120px] text-xs">CNIC/Passport</TableHead>
                  <TableHead className="w-[100px] text-xs">Nationality</TableHead>
                  <TableHead className="w-[80px] text-xs">Ownership %</TableHead>
                  <TableHead className="w-[60px] text-xs text-center">PEP</TableHead>
                  <TableHead className="w-[60px] text-xs text-center">Verified</TableHead>
                  {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.directorsAndOwners.map((owner) => (
                  <TableRow key={owner.id}>
                    <TableCell>
                      <Input
                        value={owner.name}
                        onChange={(e) => handleOwnerChange(owner.id, "name", e.target.value)}
                        placeholder="Full name"
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-owner-name-${owner.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={owner.role}
                        onValueChange={(v) => handleOwnerChange(owner.id, "role", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-owner-role-${owner.id}`}>
                          <SelectValue placeholder="Select" />
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
                        value={owner.cnicPassport}
                        onChange={(e) => handleOwnerChange(owner.id, "cnicPassport", e.target.value)}
                        placeholder="ID number"
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-owner-cnic-${owner.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={owner.nationality}
                        onChange={(e) => handleOwnerChange(owner.id, "nationality", e.target.value)}
                        placeholder="Nationality"
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-owner-nationality-${owner.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={owner.ownershipPercentage}
                        onChange={(e) => handleOwnerChange(owner.id, "ownershipPercentage", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-owner-percentage-${owner.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={owner.isPEP}
                        onCheckedChange={(checked) => handleOwnerChange(owner.id, "isPEP", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-pep-${owner.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={owner.verified}
                        onCheckedChange={(checked) => handleOwnerChange(owner.id, "verified", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-verified-${owner.id}`}
                      />
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOwner(owner.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          data-testid={`button-remove-owner-${owner.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {data.directorsAndOwners.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-2">
                      No directors/owners added. Click "Add Person" to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={<Search className="h-5 w-5" />}
        title="Sanctions & PEP Screening"
        description="Document screening checks and results"
      >
        <div className="space-y-2.5">
          {hasSanctionsHit && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Sanctions/PEP hit detected - requires enhanced due diligence</span>
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[150px] text-xs">Check Type</TableHead>
                  <TableHead className="w-[100px] text-xs">Result</TableHead>
                  <TableHead className="min-w-[200px] text-xs">Details</TableHead>
                  <TableHead className="w-[100px] text-xs">Checked Date</TableHead>
                  <TableHead className="w-[120px] text-xs">Checked By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.screeningResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <Select
                        value={result.checkType}
                        onValueChange={(v) => handleScreeningChange(result.id, "checkType", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-check-type-${result.id}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pep">PEP Screening</SelectItem>
                          <SelectItem value="sanctions">Sanctions Check</SelectItem>
                          <SelectItem value="adverse_media">Adverse Media</SelectItem>
                          <SelectItem value="high_risk_jurisdiction">High-Risk Jurisdiction</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={result.result}
                        onValueChange={(v) => handleScreeningChange(result.id, "result", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-result-${result.id}`}>
                          <SelectValue placeholder="Result" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              Clear
                            </div>
                          </SelectItem>
                          <SelectItem value="hit">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                              Hit
                            </div>
                          </SelectItem>
                          <SelectItem value="pending">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-amber-500" />
                              Pending
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={result.details}
                        onChange={(e) => handleScreeningChange(result.id, "details", e.target.value)}
                        placeholder="Details/findings..."
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-screening-details-${result.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={result.checkedDate}
                        onChange={(e) => handleScreeningChange(result.id, "checkedDate", e.target.value)}
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-checked-date-${result.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={result.checkedBy}
                        onChange={(e) => handleScreeningChange(result.id, "checkedBy", e.target.value)}
                        placeholder="Checked by"
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-checked-by-${result.id}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={<AlertTriangle className="h-5 w-5" />}
        title="AML Risk Assessment"
        description="Risk-rated due diligence with auto-calculated overall score"
      >
        <FormRow cols={4}>
          <FormField label="Client Type Risk">
            <Select
              value={data.riskFactors.clientType}
              onValueChange={(v) => handleRiskFactorChange("clientType", v as KYCAMLData["riskFactors"]["clientType"])}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-client-type-risk">
                <SelectValue placeholder="Select risk" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Geographic Risk">
            <Select
              value={data.riskFactors.geographicRisk}
              onValueChange={(v) => handleRiskFactorChange("geographicRisk", v as KYCAMLData["riskFactors"]["geographicRisk"])}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-geographic-risk">
                <SelectValue placeholder="Select risk" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Industry Risk">
            <Select
              value={data.riskFactors.industryRisk}
              onValueChange={(v) => handleRiskFactorChange("industryRisk", v as KYCAMLData["riskFactors"]["industryRisk"])}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-industry-risk">
                <SelectValue placeholder="Select risk" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Transaction Risk">
            <Select
              value={data.riskFactors.transactionRisk}
              onValueChange={(v) => handleRiskFactorChange("transactionRisk", v as KYCAMLData["riskFactors"]["transactionRisk"])}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-transaction-risk">
                <SelectValue placeholder="Select risk" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormRow>

        <div className="p-2.5 bg-muted/30 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Overall AML Risk Score</Label>
              <p className="text-xs text-muted-foreground">
                Auto-calculated based on individual risk factors
              </p>
            </div>
            <RiskBadge level={data.overallAMLRiskScore} />
          </div>
        </div>

        <FormField label="Risk Score Rationale">
          <Textarea
            value={data.riskScoreRationale}
            onChange={(e) => handleChange("riskScoreRationale", e.target.value)}
            placeholder="Document rationale for risk score..."
            className="min-h-[80px]"
            disabled={readOnly}
            data-testid="textarea-risk-rationale"
          />
        </FormField>
      </FormSection>

      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="KYC Compliance Checklist"
        description="Complete required KYC/AML procedures per SECP/ICAP requirements"
      >
        <QAFormChecklist
          section={data.kycChecklistSection}
          onUpdateItem={handleChecklistUpdate}
          readOnly={readOnly}
        />
      </FormSection>

      <FormSection
        icon={<FileText className="h-5 w-5" />}
        title="Supporting Evidence"
        description="Upload KYC documentation and verification evidence"
      >
        <EvidenceUploader
          phase="Pre-Planning"
          section="KYC/AML"
          files={data.evidenceFiles}
          onUpload={handleEvidenceUpload}
          onDelete={handleEvidenceDelete}
          readOnly={readOnly}
        />
      </FormSection>

      <FormSection
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Conclusion & Sign-Off"
        description="Final KYC/AML assessment conclusion"
      >
        <FormField label="KYC/AML Conclusion" required>
          <Textarea
            value={data.conclusion}
            onChange={(e) => handleChange("conclusion", e.target.value)}
            placeholder="Document overall KYC/AML assessment conclusion..."
            className="min-h-[100px]"
            disabled={readOnly}
            data-testid="textarea-kyc-conclusion"
          />
        </FormField>

      </FormSection>
    </div>
  );
}

export function getDefaultEthicsIndependenceData(engagementId: string): EthicsIndependenceData {
  return {
    engagementId,
    teamDeclarations: [],
    threatsIdentified: [],
    nonAuditServicesProvided: false,
    nonAuditServicesDescription: "",
    longAssociationYears: 0,
    rotationRequired: false,
    rotationNotes: "",
    independenceChecklistSection: {
      id: "iesba-isa220",
      title: "IESBA & ISA 220 Independence Requirements",
      description: "Mandatory independence assessment procedures",
      items: [
        {
          id: "ind-1",
          itemCode: "IND-1",
          requirement: "Independence threats identified and documented",
          isaReference: "IESBA 400",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-2",
          itemCode: "IND-2",
          requirement: "Safeguards applied where threats exist",
          isaReference: "IESBA 300",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-3",
          itemCode: "IND-3",
          requirement: "Financial interests in client assessed",
          isaReference: "IESBA 510",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-4",
          itemCode: "IND-4",
          requirement: "Business relationships evaluated",
          isaReference: "IESBA 520",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-5",
          itemCode: "IND-5",
          requirement: "Family and personal relationships assessed",
          isaReference: "IESBA 521",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-6",
          itemCode: "IND-6",
          requirement: "Long association / rotation considered",
          isaReference: "IESBA 540",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-7",
          itemCode: "IND-7",
          requirement: "Non-audit services assessed for independence impact",
          isaReference: "IESBA 600",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-8",
          itemCode: "IND-8",
          requirement: "Gifts and hospitality evaluated",
          isaReference: "IESBA 420",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-9",
          itemCode: "IND-9",
          requirement: "Overall independence conclusion documented",
          isaReference: "ISA 220.11",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "ind-10",
          itemCode: "IND-10",
          requirement: "Engagement partner confirmed independence of engagement team",
          isaReference: "ISA 220.12",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
      ],
    },
    overallConclusion: "",
    conclusionRationale: "",
    managerSignOff: {
      preparedBy: "",
      preparedDate: "",
      reviewedBy: "",
      reviewedDate: "",
      status: "DRAFT",
    },
    partnerSignOff: {
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

export function getDefaultKYCAMLData(engagementId: string): KYCAMLData {
  return {
    engagementId,
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
    screeningResults: [
      {
        id: "screen-1",
        checkType: "pep",
        result: "",
        details: "",
        evidenceId: "",
        checkedDate: "",
        checkedBy: "",
      },
      {
        id: "screen-2",
        checkType: "sanctions",
        result: "",
        details: "",
        evidenceId: "",
        checkedDate: "",
        checkedBy: "",
      },
      {
        id: "screen-3",
        checkType: "adverse_media",
        result: "",
        details: "",
        evidenceId: "",
        checkedDate: "",
        checkedBy: "",
      },
      {
        id: "screen-4",
        checkType: "high_risk_jurisdiction",
        result: "",
        details: "",
        evidenceId: "",
        checkedDate: "",
        checkedBy: "",
      },
    ],
    kycChecklistSection: {
      id: "kyc-aml",
      title: "KYC/AML Due Diligence Checklist",
      description: "Required KYC/AML procedures per SECP/ICAP guidelines",
      items: [
        {
          id: "kyc-1",
          itemCode: "KYC-1",
          requirement: "Nature of business verified",
          isaReference: "AML/CFT",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-2",
          itemCode: "KYC-2",
          requirement: "Principal line of business assessed",
          isaReference: "AML/CFT",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-3",
          itemCode: "KYC-3",
          requirement: "Source of funds identified and verified",
          isaReference: "AML/CFT",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-4",
          itemCode: "KYC-4",
          requirement: "Ultimate beneficial owners identified",
          isaReference: "SECP",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-5",
          itemCode: "KYC-5",
          requirement: "Ownership structure documented",
          isaReference: "SECP",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-6",
          itemCode: "KYC-6",
          requirement: "CNIC/Passport of UBOs obtained",
          isaReference: "SECP",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-7",
          itemCode: "KYC-7",
          requirement: "PEP screening performed",
          isaReference: "AML/CFT",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-8",
          itemCode: "KYC-8",
          requirement: "Sanctions screening completed",
          isaReference: "AML/CFT",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-9",
          itemCode: "KYC-9",
          requirement: "High-risk jurisdiction exposure assessed",
          isaReference: "AML/CFT",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-10",
          itemCode: "KYC-10",
          requirement: "AML/CFT risk rating determined",
          isaReference: "AML/CFT",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-11",
          itemCode: "KYC-11",
          requirement: "KYC Compliance Checklist (SECP/ICAP) completed",
          isaReference: "ICAP",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
        {
          id: "kyc-12",
          itemCode: "KYC-12",
          requirement: "Compliance Officer Sign-off obtained",
          isaReference: "ICAP",
          status: "",
          evidenceIds: [],
          remarks: "",
        },
      ],
    },
    evidenceFiles: [],
    riskFactors: {
      clientType: "",
      geographicRisk: "",
      industryRisk: "",
      transactionRisk: "",
    },
    overallAMLRiskScore: "",
    riskScoreRationale: "",
    conclusion: "",
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
