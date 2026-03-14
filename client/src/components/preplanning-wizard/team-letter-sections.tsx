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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  FileSignature,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  FileText,
  AlertTriangle,
  Upload,
  GraduationCap,
  ClipboardList,
  FolderOpen,
  AlertCircle,
  FileCheck,
  Sparkles,
  Target,
  BookOpen,
  Handshake,
  DollarSign,
  KeyRound,
  PenLine,
} from "lucide-react";
import { QAFormChecklist, ChecklistItem, ChecklistSection } from "@/components/compliance-checklist";
import { EvidenceUploader, EvidenceFile } from "@/components/evidence-uploader";
import type { SignOffData } from "@/components/sign-off-bar";

export type TeamMemberRole = "associate" | "senior" | "manager" | "partner" | "eqcr" | "";

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  email: string;
  qualifications: string;
  industryExperience: string;
  yearsExperience: number;
  competenceConfirmed: boolean;
  competenceNotes: string;
  trainingNeeds: string;
  briefingCompleted: boolean;
  briefingDate: string;
  allocationHours: number;
  reviewLevel: "preparer" | "reviewer" | "approver" | "";
}

export interface SupervisionMilestone {
  id: string;
  milestone: string;
  targetDate: string;
  reviewLevel: "manager" | "partner" | "eqcr" | "";
  status: "pending" | "in_progress" | "completed" | "";
  remarks: string;
}

export interface EngagementTeamData {
  engagementId: string;
  teamMembers: TeamMember[];
  supervisionMilestones: SupervisionMilestone[];
  briefingNotes: string;
  teamCompetenceConclusion: string;
  signOff: SignOffData;
}

export type LetterStatus = "drafted" | "sent" | "signed" | "filed" | "";

export interface EngagementLetterData {
  engagementId: string;
  status: LetterStatus;
  templateVariables: {
    clientName: string;
    engagementPartner: string;
    scopeOfAudit: string;
    auditObjective: string;
    periodsCovered: string;
    managementResponsibilities: string;
    auditorResponsibilities: string;
    reportingFramework: string;
    auditingStandards: string;
    reportForm: string;
    deliverables: string;
    timeline: string;
    accessToInformation: string;
    accessRestrictions: string;
    feeStructure: string;
    paymentTerms: string;
    liabilityLimitation: string;
  };
  generatedLetterUrl: string;
  generatedDate: string;
  sentDate: string;
  signedDate: string;
  filedDate: string;
  signedLetterFileId: string;
  signedByClient: string;
  signedByFirm: string;
  checklistSection: ChecklistSection;
  evidenceFiles: EvidenceFile[];
  signOff: SignOffData;
}

export interface EngagementTeamSectionProps {
  engagementId: string;
  data: EngagementTeamData;
  onChange: (data: EngagementTeamData) => void;
  currentUser?: string;
  readOnly?: boolean;
}

export interface EngagementLetterSectionProps {
  engagementId: string;
  data: EngagementLetterData;
  onChange: (data: EngagementLetterData) => void;
  onAIAutoFill?: (field: string) => void;
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
  required,
  children,
  helperText,
  className = ""
}: { 
  label: string; 
  required?: boolean;
  children: React.ReactNode;
  helperText?: string;
  className?: string;
}) => (
  <div className={`space-y-2 ${className}`}>
    <Label className="flex items-center gap-2 text-sm font-medium">
      {label}
      {required && <span className="text-destructive">*</span>}
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

const ROLE_OPTIONS: { value: TeamMemberRole; label: string }[] = [
  { value: "associate", label: "Associate" },
  { value: "senior", label: "Senior" },
  { value: "manager", label: "Manager" },
  { value: "partner", label: "Partner" },
  { value: "eqcr", label: "EQCR" },
];

const REVIEW_LEVEL_OPTIONS = [
  { value: "preparer", label: "Preparer" },
  { value: "reviewer", label: "Reviewer" },
  { value: "approver", label: "Approver" },
];

const SUPERVISION_REVIEW_OPTIONS = [
  { value: "manager", label: "Manager Review" },
  { value: "partner", label: "Partner Review" },
  { value: "eqcr", label: "EQCR Review" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const LETTER_STATUS_CONFIG: Record<LetterStatus | "", { label: string; icon: typeof Clock; color: string; step: number }> = {
  "": { label: "Not Started", icon: Clock, color: "bg-muted text-muted-foreground", step: 0 },
  drafted: { label: "Drafted", icon: FileText, color: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200", step: 1 },
  sent: { label: "Sent", icon: Send, color: "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200", step: 2 },
  signed: { label: "Signed", icon: CheckCircle2, color: "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200", step: 3 },
  filed: { label: "Filed", icon: FolderOpen, color: "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-purple-200", step: 4 },
};

function LetterStatusBadge({ status }: { status: LetterStatus | "" }) {
  const config = LETTER_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1.5 ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function LetterStatusStepper({ status }: { status: LetterStatus | "" }) {
  const currentStep = LETTER_STATUS_CONFIG[status]?.step || 0;
  const steps = ["Drafted", "Sent", "Signed", "Filed"];

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = currentStep >= stepNum;
        const isCurrent = currentStep === stepNum;

        return (
          <div key={step} className="flex items-center gap-2">
            <div className={`
              flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
              ${isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
              ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}
            `}>
              {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
            </div>
            <span className={`text-xs ${isCompleted ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {step}
            </span>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${currentStep > stepNum ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EngagementTeamSection({
  engagementId,
  data,
  onChange,
  currentUser = "Current User",
  readOnly = false,
}: EngagementTeamSectionProps) {
  const handleChange = <K extends keyof EngagementTeamData>(
    field: K,
    value: EngagementTeamData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const handleTeamMemberChange = (
    id: string,
    field: keyof TeamMember,
    value: unknown
  ) => {
    const updated = data.teamMembers.map(member =>
      member.id === id ? { ...member, [field]: value } : member
    );
    handleChange("teamMembers", updated);
  };

  const addTeamMember = () => {
    const newMember: TeamMember = {
      id: `team-${Date.now()}`,
      name: "",
      role: "",
      email: "",
      qualifications: "",
      industryExperience: "",
      yearsExperience: 0,
      competenceConfirmed: false,
      competenceNotes: "",
      trainingNeeds: "",
      briefingCompleted: false,
      briefingDate: "",
      allocationHours: 0,
      reviewLevel: "",
    };
    handleChange("teamMembers", [...data.teamMembers, newMember]);
  };

  const removeTeamMember = (id: string) => {
    handleChange("teamMembers", data.teamMembers.filter(m => m.id !== id));
  };

  const handleMilestoneChange = (
    id: string,
    field: keyof SupervisionMilestone,
    value: unknown
  ) => {
    const updated = data.supervisionMilestones.map(milestone =>
      milestone.id === id ? { ...milestone, [field]: value } : milestone
    );
    handleChange("supervisionMilestones", updated);
  };

  const addMilestone = () => {
    const newMilestone: SupervisionMilestone = {
      id: `milestone-${Date.now()}`,
      milestone: "",
      targetDate: "",
      reviewLevel: "",
      status: "pending",
      remarks: "",
    };
    handleChange("supervisionMilestones", [...data.supervisionMilestones, newMilestone]);
  };

  const removeMilestone = (id: string) => {
    handleChange("supervisionMilestones", data.supervisionMilestones.filter(m => m.id !== id));
  };

  const handleSignOffChange = (signOffData: SignOffData) => {
    handleChange("signOff", signOffData);
  };

  const allCompetenceConfirmed = data.teamMembers.every(m => m.competenceConfirmed);
  const allBriefingsCompleted = data.teamMembers.every(m => m.briefingCompleted);

  return (
    <div className="space-y-3">
      <FormSection
        icon={<Users className="h-5 w-5" />}
        title="Engagement Team Allocation (ISA 220 / ISQM)"
        description="Assign team members with appropriate competence and experience for this engagement"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {data.teamMembers.length} team member(s)
              </span>
              {allCompetenceConfirmed && data.teamMembers.length > 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  All Competence Confirmed
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

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[140px] text-xs">Name</TableHead>
                  <TableHead className="w-[100px] text-xs">Role</TableHead>
                  <TableHead className="w-[120px] text-xs">Qualifications</TableHead>
                  <TableHead className="w-[100px] text-xs">Industry Exp.</TableHead>
                  <TableHead className="w-[60px] text-xs text-center">Years</TableHead>
                  <TableHead className="w-[70px] text-xs text-center">Competent</TableHead>
                  <TableHead className="w-[60px] text-xs text-center">Hours</TableHead>
                  <TableHead className="w-[100px] text-xs">Review Level</TableHead>
                  {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.teamMembers.map((member) => (
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
                    <TableCell>
                      <Input
                        value={member.qualifications}
                        onChange={(e) => handleTeamMemberChange(member.id, "qualifications", e.target.value)}
                        placeholder="CA, ACCA..."
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-qualifications-${member.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={member.industryExperience}
                        onChange={(e) => handleTeamMemberChange(member.id, "industryExperience", e.target.value)}
                        placeholder="Manufacturing..."
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-industry-${member.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        value={member.yearsExperience || ""}
                        onChange={(e) => handleTeamMemberChange(member.id, "yearsExperience", parseInt(e.target.value) || 0)}
                        className="h-8 text-xs w-16"
                        disabled={readOnly}
                        data-testid={`input-years-${member.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={member.competenceConfirmed}
                        onCheckedChange={(checked) => handleTeamMemberChange(member.id, "competenceConfirmed", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-competence-${member.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        value={member.allocationHours || ""}
                        onChange={(e) => handleTeamMemberChange(member.id, "allocationHours", parseInt(e.target.value) || 0)}
                        className="h-8 text-xs w-16"
                        disabled={readOnly}
                        data-testid={`input-hours-${member.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.reviewLevel}
                        onValueChange={(v) => handleTeamMemberChange(member.id, "reviewLevel", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-review-level-${member.id}`}>
                          <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent>
                          {REVIEW_LEVEL_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                {data.teamMembers.length === 0 && (
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
        icon={<GraduationCap className="h-5 w-5" />}
        title="Training Needs & Briefing"
        description="Document training requirements and team briefing status"
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            {allBriefingsCompleted && data.teamMembers.length > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                All Briefings Completed
              </Badge>
            )}
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[140px] text-xs">Team Member</TableHead>
                  <TableHead className="w-[100px] text-xs">Role</TableHead>
                  <TableHead className="min-w-[180px] text-xs">Training Needs</TableHead>
                  <TableHead className="min-w-[180px] text-xs">Competence Notes</TableHead>
                  <TableHead className="w-[80px] text-xs text-center">Briefed</TableHead>
                  <TableHead className="w-[120px] text-xs">Briefing Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="text-xs font-medium">{member.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ROLE_OPTIONS.find(r => r.value === member.role)?.label || "Not Set"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={member.trainingNeeds}
                        onChange={(e) => handleTeamMemberChange(member.id, "trainingNeeds", e.target.value)}
                        placeholder="Identify training needs..."
                        className="min-h-[40px] text-xs"
                        disabled={readOnly}
                        data-testid={`textarea-training-${member.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={member.competenceNotes}
                        onChange={(e) => handleTeamMemberChange(member.id, "competenceNotes", e.target.value)}
                        placeholder="Competence assessment notes..."
                        className="min-h-[40px] text-xs"
                        disabled={readOnly}
                        data-testid={`textarea-competence-notes-${member.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={member.briefingCompleted}
                        onCheckedChange={(checked) => handleTeamMemberChange(member.id, "briefingCompleted", !!checked)}
                        disabled={readOnly}
                        data-testid={`checkbox-briefed-${member.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={member.briefingDate}
                        onChange={(e) => handleTeamMemberChange(member.id, "briefingDate", e.target.value)}
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-briefing-date-${member.id}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {data.teamMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-2">
                      Add team members above to configure training and briefing.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <FormField label="General Briefing Notes">
            <Textarea
              value={data.briefingNotes}
              onChange={(e) => handleChange("briefingNotes", e.target.value)}
              placeholder="Document general briefing notes, key points covered, client-specific considerations..."
              className="min-h-[100px]"
              disabled={readOnly}
              data-testid="textarea-briefing-notes"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        icon={<ClipboardList className="h-5 w-5" />}
        title="Supervision Plan"
        description="Define review levels and milestone checkpoints (ISA 220)"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {data.supervisionMilestones.length} milestone(s) defined
            </span>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addMilestone} className="gap-1" data-testid="button-add-milestone">
                <Plus className="h-3.5 w-3.5" />
                Add Milestone
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[200px] text-xs">Milestone</TableHead>
                  <TableHead className="w-[120px] text-xs">Target Date</TableHead>
                  <TableHead className="w-[120px] text-xs">Review Level</TableHead>
                  <TableHead className="w-[100px] text-xs">Status</TableHead>
                  <TableHead className="min-w-[150px] text-xs">Remarks</TableHead>
                  {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.supervisionMilestones.map((milestone) => (
                  <TableRow key={milestone.id}>
                    <TableCell>
                      <Input
                        value={milestone.milestone}
                        onChange={(e) => handleMilestoneChange(milestone.id, "milestone", e.target.value)}
                        placeholder="e.g., Planning Review, Interim Testing Review..."
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-milestone-${milestone.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={milestone.targetDate}
                        onChange={(e) => handleMilestoneChange(milestone.id, "targetDate", e.target.value)}
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-milestone-date-${milestone.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={milestone.reviewLevel}
                        onValueChange={(v) => handleMilestoneChange(milestone.id, "reviewLevel", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-milestone-level-${milestone.id}`}>
                          <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPERVISION_REVIEW_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={milestone.status}
                        onValueChange={(v) => handleMilestoneChange(milestone.id, "status", v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-milestone-status-${milestone.id}`}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={milestone.remarks}
                        onChange={(e) => handleMilestoneChange(milestone.id, "remarks", e.target.value)}
                        placeholder="Optional remarks..."
                        className="h-8 text-xs"
                        disabled={readOnly}
                        data-testid={`input-milestone-remarks-${milestone.id}`}
                      />
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMilestone(milestone.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          data-testid={`button-remove-milestone-${milestone.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {data.supervisionMilestones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-2">
                      No milestones defined. Click "Add Milestone" to create supervision checkpoints.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <FormField label="Team Competence Conclusion">
            <Textarea
              value={data.teamCompetenceConclusion}
              onChange={(e) => handleChange("teamCompetenceConclusion", e.target.value)}
              placeholder="Conclude on overall team competence and sufficiency of resources for the engagement..."
              className="min-h-[80px]"
              disabled={readOnly}
              data-testid="textarea-competence-conclusion"
            />
          </FormField>
        </div>

      </FormSection>
    </div>
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

export function EngagementLetterSection({
  engagementId,
  data,
  onChange,
  onAIAutoFill,
  currentUser = "Current User",
  readOnly = false,
}: EngagementLetterSectionProps) {
  const handleChange = <K extends keyof EngagementLetterData>(
    field: K,
    value: EngagementLetterData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const handleTemplateChange = (field: keyof EngagementLetterData["templateVariables"], value: string) => {
    handleChange("templateVariables", { ...data.templateVariables, [field]: value });
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

  const handleEvidenceUpload = (files: FileList, tags: string[]) => {
    const newFiles: EvidenceFile[] = Array.from(files).map((file, idx) => ({
      id: `evidence-${Date.now()}-${idx}`,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedBy: currentUser,
      uploadedDate: new Date().toISOString().split("T")[0],
      phase: "Pre-Planning",
      section: "Engagement Letter",
      tags,
    }));
    handleChange("evidenceFiles", [...data.evidenceFiles, ...newFiles]);
  };

  const handleEvidenceDelete = (fileId: string) => {
    handleChange("evidenceFiles", data.evidenceFiles.filter(f => f.id !== fileId));
  };

  const handleSignOffChange = (signOffData: SignOffData) => {
    handleChange("signOff", signOffData);
  };

  const handleGenerateLetter = () => {
    handleChange("status", "drafted");
    handleChange("generatedDate", new Date().toISOString().split("T")[0]);
  };

  const handleMarkSent = () => {
    handleChange("status", "sent");
    handleChange("sentDate", new Date().toISOString().split("T")[0]);
  };

  const handleMarkSigned = () => {
    handleChange("status", "signed");
    handleChange("signedDate", new Date().toISOString().split("T")[0]);
  };

  const handleMarkFiled = () => {
    handleChange("status", "filed");
    handleChange("filedDate", new Date().toISOString().split("T")[0]);
  };

  const canProceedToPlanning = data.status === "filed";
  const checklistComplete = data.checklistSection.items.every(
    item => item.status === "completed" || item.status === "not_applicable"
  );

  return (
    <div className="space-y-3">
      {/* Letter Workflow Status */}
      <FormSection
        icon={<FileSignature className="h-5 w-5" />}
        title="Engagement Letter Workflow (ISA 210)"
        description="Generate, send, and track the engagement letter through to filing"
      >
        <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Current Status:</span>
              <LetterStatusBadge status={data.status} />
            </div>
            <LetterStatusStepper status={data.status} />
          </div>
          <div className="flex gap-2">
            {data.status === "" && (
              <Button onClick={handleGenerateLetter} disabled={readOnly} data-testid="button-generate-letter">
                <FileText className="h-4 w-4 mr-2" />
                Generate Letter
              </Button>
            )}
            {data.status === "drafted" && (
              <Button onClick={handleMarkSent} disabled={readOnly} data-testid="button-mark-sent">
                <Send className="h-4 w-4 mr-2" />
                Mark as Sent
              </Button>
            )}
            {data.status === "sent" && (
              <Button onClick={handleMarkSigned} disabled={readOnly} data-testid="button-mark-signed">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Signed
              </Button>
            )}
            {data.status === "signed" && (
              <Button onClick={handleMarkFiled} disabled={readOnly} data-testid="button-mark-filed">
                <FolderOpen className="h-4 w-4 mr-2" />
                Mark as Filed
              </Button>
            )}
          </div>
        </div>

        {!canProceedToPlanning && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Hard-Stop: Engagement letter must be "Filed" before proceeding to Planning phase.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {canProceedToPlanning && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Engagement letter is filed. You may proceed to the Planning phase.
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </FormSection>

      {/* 1. Scope and Objective of Audit (ISA 210.10) */}
      <FormSection
        icon={<Target className="h-5 w-5" />}
        title="Scope & Objective of Audit"
        description="ISA 210.10 - Define the scope, objective, and periods covered by the audit"
      >
        <FormRow cols={2}>
          <FormField label="Client Name" required>
            <Input
              value={data.templateVariables.clientName}
              onChange={(e) => handleTemplateChange("clientName", e.target.value)}
              placeholder="Full legal client name"
              disabled={readOnly}
              data-testid="input-client-name"
            />
          </FormField>
          <FormField label="Engagement Partner" required>
            <Input
              value={data.templateVariables.engagementPartner}
              onChange={(e) => handleTemplateChange("engagementPartner", e.target.value)}
              placeholder="Partner name"
              disabled={readOnly}
              data-testid="input-engagement-partner"
            />
          </FormField>
        </FormRow>
        <FormField label="Objective of the Audit" required>
          <div className="flex gap-2">
            <Textarea
              value={data.templateVariables.auditObjective || ""}
              onChange={(e) => handleTemplateChange("auditObjective", e.target.value)}
              placeholder="State the objective of the audit engagement per ISA 200..."
              className="min-h-[80px] flex-1"
              disabled={readOnly}
              data-testid="textarea-audit-objective"
            />
            <AIAutoFillButton field="auditObjective" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
          </div>
        </FormField>
        <FormRow cols={2}>
          <FormField label="Scope of Audit" required>
            <div className="flex gap-2">
              <Textarea
                value={data.templateVariables.scopeOfAudit}
                onChange={(e) => handleTemplateChange("scopeOfAudit", e.target.value)}
                placeholder="Define the scope of the audit engagement (financial statements, entities covered)..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-scope"
              />
              <AIAutoFillButton field="scopeOfAudit" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
          <FormField label="Periods Covered">
            <div className="flex gap-2">
              <Textarea
                value={data.templateVariables.periodsCovered || ""}
                onChange={(e) => handleTemplateChange("periodsCovered", e.target.value)}
                placeholder="Financial year/period covered by the audit (e.g., Year ended June 30, 2025)..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-periods-covered"
              />
              <AIAutoFillButton field="periodsCovered" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
        <FormRow cols={2}>
          <FormField label="Deliverables">
            <div className="flex gap-2">
              <Textarea
                value={data.templateVariables.deliverables}
                onChange={(e) => handleTemplateChange("deliverables", e.target.value)}
                placeholder="List deliverables (audit report, management letter, etc.)..."
                className="min-h-[60px] flex-1"
                disabled={readOnly}
                data-testid="textarea-deliverables"
              />
              <AIAutoFillButton field="deliverables" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
          <FormField label="Timeline">
            <div className="flex gap-2">
              <Textarea
                value={data.templateVariables.timeline}
                onChange={(e) => handleTemplateChange("timeline", e.target.value)}
                placeholder="Key dates (fieldwork, report delivery, AGM deadline)..."
                className="min-h-[60px] flex-1"
                disabled={readOnly}
                data-testid="textarea-timeline"
              />
              <AIAutoFillButton field="timeline" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
      </FormSection>

      {/* 2. Reporting Framework (ISA 210.6(a)) */}
      <FormSection
        icon={<BookOpen className="h-5 w-5" />}
        title="Reporting Framework"
        description="ISA 210.6(a) - Applicable financial reporting framework and auditing standards"
      >
        <FormRow cols={3}>
          <FormField label="Financial Reporting Framework" required>
            <Select
              value={data.templateVariables.reportingFramework}
              onValueChange={(v) => handleTemplateChange("reportingFramework", v)}
              disabled={readOnly}
            >
              <SelectTrigger data-testid="select-framework">
                <SelectValue placeholder="Select framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IFRS">IFRS (Full)</SelectItem>
                <SelectItem value="IFRS-SME">IFRS for SMEs</SelectItem>
                <SelectItem value="AAOIFI">AAOIFI</SelectItem>
                <SelectItem value="Local-GAAP">Local GAAP</SelectItem>
                <SelectItem value="Companies-Act">Companies Act 2017</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Auditing Standards" required>
            <Input
              value={data.templateVariables.auditingStandards}
              onChange={(e) => handleTemplateChange("auditingStandards", e.target.value)}
              placeholder="ISAs as adopted by ICAP"
              disabled={readOnly}
              data-testid="input-standards"
            />
          </FormField>
          <FormField label="Report Form">
            <Input
              value={data.templateVariables.reportForm}
              onChange={(e) => handleTemplateChange("reportForm", e.target.value)}
              placeholder="Standard unmodified audit report per ISA 700..."
              disabled={readOnly}
              data-testid="input-report-form"
            />
          </FormField>
        </FormRow>
      </FormSection>

      {/* 3. Responsibilities of Management and Auditor (ISA 210.6(b), 210.10(c)) */}
      <FormSection
        icon={<Handshake className="h-5 w-5" />}
        title="Responsibilities of Management & Auditor"
        description="ISA 210.6(b) & 210.10(c) - Define respective responsibilities"
      >
        <FormRow cols={2}>
          <FormField label="Management Responsibilities" required>
            <div className="flex gap-2">
              <Textarea
                value={data.templateVariables.managementResponsibilities}
                onChange={(e) => handleTemplateChange("managementResponsibilities", e.target.value)}
                placeholder="Management's responsibilities for financial statements preparation, internal controls, going concern assessment, access to records..."
                className="min-h-[100px] flex-1"
                disabled={readOnly}
                data-testid="textarea-mgmt-responsibilities"
              />
              <AIAutoFillButton field="managementResponsibilities" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
          <FormField label="Auditor Responsibilities" required>
            <div className="flex gap-2">
              <Textarea
                value={data.templateVariables.auditorResponsibilities}
                onChange={(e) => handleTemplateChange("auditorResponsibilities", e.target.value)}
                placeholder="Auditor's responsibilities per ISA 200: form opinion on financial statements, comply with ISAs and ethical requirements, plan and perform audit to obtain reasonable assurance..."
                className="min-h-[100px] flex-1"
                disabled={readOnly}
                data-testid="textarea-auditor-responsibilities"
              />
              <AIAutoFillButton field="auditorResponsibilities" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
        <FormField label="Limitation of Liability">
          <div className="flex gap-2">
            <Textarea
              value={data.templateVariables.liabilityLimitation}
              onChange={(e) => handleTemplateChange("liabilityLimitation", e.target.value)}
              placeholder="Liability limitation clauses per ICAP guidelines and applicable law..."
              className="min-h-[60px] flex-1"
              disabled={readOnly}
              data-testid="textarea-liability"
            />
            <AIAutoFillButton field="liabilityLimitation" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
          </div>
        </FormField>
      </FormSection>

      {/* 4. Access to Information (ISA 210.6(b)(iii)) */}
      <FormSection
        icon={<KeyRound className="h-5 w-5" />}
        title="Access to Information"
        description="ISA 210.6(b)(iii) - Management agreement to provide unrestricted access to records"
      >
        <FormField label="Access to Records & Information" required>
          <div className="flex gap-2">
            <Textarea
              value={data.templateVariables.accessToInformation || ""}
              onChange={(e) => handleTemplateChange("accessToInformation", e.target.value)}
              placeholder="Management will provide unrestricted access to all records, documentation, and other matters relevant to the preparation of financial statements, including: accounting records, minutes of meetings, contracts, correspondence, bank statements, and any other information requested by the auditor..."
              className="min-h-[100px] flex-1"
              disabled={readOnly}
              data-testid="textarea-access-to-information"
            />
            <AIAutoFillButton field="accessToInformation" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
          </div>
        </FormField>
        <FormField label="Access Restrictions / Limitations">
          <div className="flex gap-2">
            <Textarea
              value={data.templateVariables.accessRestrictions || ""}
              onChange={(e) => handleTemplateChange("accessRestrictions", e.target.value)}
              placeholder="Document any known restrictions on access to information, locations, or personnel..."
              className="min-h-[60px] flex-1"
              disabled={readOnly}
              data-testid="textarea-access-restrictions"
            />
            <AIAutoFillButton field="accessRestrictions" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
          </div>
        </FormField>
      </FormSection>

      {/* 5. Fee Arrangements */}
      <FormSection
        icon={<DollarSign className="h-5 w-5" />}
        title="Fee Arrangements"
        description="Agreed fee structure, payment terms, and billing schedule"
      >
        <FormRow cols={2}>
          <FormField label="Fee Structure" required>
            <div className="flex gap-2">
              <Textarea
                value={data.templateVariables.feeStructure}
                onChange={(e) => handleTemplateChange("feeStructure", e.target.value)}
                placeholder="Audit fee amount, basis of calculation (fixed/hourly), out-of-pocket expenses..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-fees"
              />
              <AIAutoFillButton field="feeStructure" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
          <FormField label="Payment Terms">
            <div className="flex gap-2">
              <Textarea
                value={data.templateVariables.paymentTerms || ""}
                onChange={(e) => handleTemplateChange("paymentTerms", e.target.value)}
                placeholder="Payment schedule, milestones, advance requirements, overdue payment terms..."
                className="min-h-[80px] flex-1"
                disabled={readOnly}
                data-testid="textarea-payment-terms"
              />
              <AIAutoFillButton field="paymentTerms" onAIAutoFill={onAIAutoFill} disabled={readOnly} />
            </div>
          </FormField>
        </FormRow>
      </FormSection>

      {/* 6. Signed Acknowledgement */}
      <FormSection
        icon={<PenLine className="h-5 w-5" />}
        title="Signed Acknowledgement"
        description="ISA 210.9 - Obtain signed engagement letter from client management"
      >
        <FormRow cols={2}>
          <FormField label="Signed by Client (Name & Title)">
            <Input
              value={data.signedByClient || ""}
              onChange={(e) => handleChange("signedByClient", e.target.value)}
              placeholder="Name and title of client signatory"
              disabled={readOnly}
              data-testid="input-signed-by-client"
            />
          </FormField>
          <FormField label="Signed by Firm (Partner)">
            <Input
              value={data.signedByFirm || ""}
              onChange={(e) => handleChange("signedByFirm", e.target.value)}
              placeholder="Engagement partner name"
              disabled={readOnly}
              data-testid="input-signed-by-firm"
            />
          </FormField>
        </FormRow>

        <EvidenceUploader
          phase="Pre-Planning"
          section="Engagement Letter"
          files={data.evidenceFiles}
          onUpload={handleEvidenceUpload}
          onDelete={handleEvidenceDelete}
          readOnly={readOnly}
        />
      </FormSection>

      {/* ISA 210 Compliance Checklist */}
      <FormSection
        icon={<FileCheck className="h-5 w-5" />}
        title="ISA 210 Compliance Checklist"
        description="Verify all engagement letter requirements per ISA 210"
      >
        <QAFormChecklist
          section={data.checklistSection}
          onUpdateItem={handleChecklistUpdate}
          readOnly={readOnly}
        />

        {!checklistComplete && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 mt-2.5">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  Complete all checklist items to ensure ISA 210 compliance.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

      </FormSection>
    </div>
  );
}

export function getDefaultEngagementTeamData(engagementId: string): EngagementTeamData {
  return {
    engagementId,
    teamMembers: [],
    supervisionMilestones: [
      {
        id: "milestone-1",
        milestone: "Planning Review",
        targetDate: "",
        reviewLevel: "manager",
        status: "pending",
        remarks: "",
      },
      {
        id: "milestone-2",
        milestone: "Interim Testing Review",
        targetDate: "",
        reviewLevel: "manager",
        status: "pending",
        remarks: "",
      },
      {
        id: "milestone-3",
        milestone: "Final Fieldwork Review",
        targetDate: "",
        reviewLevel: "partner",
        status: "pending",
        remarks: "",
      },
      {
        id: "milestone-4",
        milestone: "Report Review (Pre-issuance)",
        targetDate: "",
        reviewLevel: "partner",
        status: "pending",
        remarks: "",
      },
    ],
    briefingNotes: "",
    teamCompetenceConclusion: "",
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

export function getDefaultEngagementLetterData(engagementId: string): EngagementLetterData {
  return {
    engagementId,
    status: "",
    templateVariables: {
      clientName: "",
      engagementPartner: "",
      scopeOfAudit: "",
      auditObjective: "",
      periodsCovered: "",
      managementResponsibilities: "",
      auditorResponsibilities: "",
      reportingFramework: "",
      auditingStandards: "International Standards on Auditing (ISAs) as adopted by ICAP",
      reportForm: "",
      deliverables: "",
      timeline: "",
      accessToInformation: "",
      accessRestrictions: "",
      feeStructure: "",
      paymentTerms: "",
      liabilityLimitation: "",
    },
    generatedLetterUrl: "",
    generatedDate: "",
    sentDate: "",
    signedDate: "",
    filedDate: "",
    signedLetterFileId: "",
    signedByClient: "",
    signedByFirm: "",
    checklistSection: {
      id: "engagement-letter-checklist",
      title: "ISA 210 Engagement Letter Compliance",
      description: "Verify all engagement letter requirements per ISA 210",
      items: [
        { id: "el-1", itemCode: "EL-1", requirement: "Preconditions for audit met (per ISA 210)", isaReference: "ISA 210.6", status: "", evidenceIds: [], remarks: "" },
        { id: "el-2", itemCode: "EL-2", requirement: "Client acceptance and continuance approved", isaReference: "ISQM 1", status: "", evidenceIds: [], remarks: "" },
        { id: "el-3", itemCode: "EL-3", requirement: "Scope of audit clearly defined", isaReference: "ISA 210.10", status: "", evidenceIds: [], remarks: "" },
        { id: "el-4", itemCode: "EL-4", requirement: "Management responsibilities acknowledged in writing", isaReference: "ISA 210.6(b)", status: "", evidenceIds: [], remarks: "" },
        { id: "el-5", itemCode: "EL-5", requirement: "Auditor responsibilities clearly stated", isaReference: "ISA 210.10(c)", status: "", evidenceIds: [], remarks: "" },
        { id: "el-6", itemCode: "EL-6", requirement: "Applicable financial reporting framework specified", isaReference: "ISA 210.6(a)", status: "", evidenceIds: [], remarks: "" },
        { id: "el-7", itemCode: "EL-7", requirement: "Fee structure and payment terms agreed", isaReference: "ICAP", status: "", evidenceIds: [], remarks: "" },
        { id: "el-8", itemCode: "EL-8", requirement: "Limitation of liability clauses included per ICAP guidelines", isaReference: "ICAP", status: "", evidenceIds: [], remarks: "" },
        { id: "el-9", itemCode: "EL-9", requirement: "Consent letter obtained from predecessor auditor (if applicable)", isaReference: "ISA 300", status: "", evidenceIds: [], remarks: "" },
        { id: "el-10", itemCode: "EL-10", requirement: "Draft engagement letter reviewed and finalized", isaReference: "ISA 210.9", status: "", evidenceIds: [], remarks: "" },
        { id: "el-11", itemCode: "EL-11", requirement: "Signed engagement letter obtained from client", isaReference: "ISA 210.9", status: "", evidenceIds: [], remarks: "" },
        { id: "el-12", itemCode: "EL-12", requirement: "Partner approval of engagement terms obtained", isaReference: "ISA 220", status: "", evidenceIds: [], remarks: "" },
      ],
    },
    evidenceFiles: [],
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
