import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Users, Calendar, Clock, Target, Briefcase } from "lucide-react";

interface TeamPlanningPanelProps {
  engagementId: string;
  readOnly?: boolean;
  onFieldChange?: (field: string, value: any) => void;
  planningData?: any;
}

export function TeamPlanningPanel({ engagementId, readOnly, onFieldChange, planningData }: TeamPlanningPanelProps) {
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "readiness"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/readiness`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  const team = dashboardData?.team || [];
  const teamBudget = planningData?.teamBudget || {};
  const milestones = planningData?.milestones || {};

  const updateBudget = (userId: string, field: string, value: any) => {
    const updated = { ...teamBudget, [userId]: { ...teamBudget?.[userId], [field]: value } };
    onFieldChange?.("teamBudget", updated);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Planning, Budget & Timelines
            </CardTitle>
            <Badge variant="outline" className="text-xs">ISA 220 / ISQM 1</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Plan staffing, review layers, time budgets, milestone dates, and specialist involvement.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Team Composition & Budgeted Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Team Member</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Team Role</TableHead>
                <TableHead className="text-xs text-right">Budgeted Hours</TableHead>
                <TableHead className="text-xs">Assigned Areas</TableHead>
                <TableHead className="text-xs">Review Layer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">
                    No team members assigned. Configure team in Pre-Planning.
                  </TableCell>
                </TableRow>
              ) : (
                team.map((member: any) => (
                  <TableRow key={member.userId}>
                    <TableCell className="text-xs font-medium">{member.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{member.role}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{member.teamRole || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={teamBudget?.[member.userId]?.hours || ""}
                        onChange={(e) => updateBudget(member.userId, "hours", e.target.value)}
                        placeholder="0"
                        className="w-20 text-xs h-7 text-right ml-auto"
                        disabled={readOnly}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={teamBudget?.[member.userId]?.areas || ""}
                        onChange={(e) => updateBudget(member.userId, "areas", e.target.value)}
                        placeholder="e.g., Revenue, Receivables"
                        className="text-xs h-7 min-w-[150px]"
                        disabled={readOnly}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={teamBudget?.[member.userId]?.reviewLayer || ""}
                        onChange={(e) => updateBudget(member.userId, "reviewLayer", e.target.value)}
                        placeholder="1st / 2nd / Final"
                        className="text-xs h-7 w-28"
                        disabled={readOnly}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Key Milestones & Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { id: "planningCompletion", label: "Planning Completion Date" },
              { id: "interimFieldwork", label: "Interim Fieldwork Date" },
              { id: "finalFieldwork", label: "Final Fieldwork Date" },
              { id: "draftReport", label: "Draft Report Date" },
              { id: "managementLetter", label: "Management Letter Date" },
              { id: "auditReport", label: "Audit Report Date" },
              { id: "filingDeadline", label: "Filing Deadline" },
              { id: "agmDate", label: "AGM Date" },
            ].map((milestone) => (
              <div key={milestone.id} className="flex items-center gap-2">
                <Label className="text-xs w-48 flex-shrink-0">{milestone.label}</Label>
                <Input
                  type="date"
                  value={milestones?.[milestone.id] || ""}
                  onChange={(e) => {
                    const updated = { ...milestones, [milestone.id]: e.target.value };
                    onFieldChange?.("milestones", updated);
                  }}
                  className="text-xs h-7"
                  disabled={readOnly}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" />
            Specialist Involvement & Branch/Component Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs font-medium">Specialist / Expert Involvement</Label>
            <Textarea
              value={planningData?.specialistInvolvement || ""}
              onChange={(e) => onFieldChange?.("specialistInvolvement", e.target.value)}
              placeholder="e.g., IT auditor for systems review, tax specialist for transfer pricing, valuation expert for investment properties..."
              className="mt-1 text-xs min-h-[60px]"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Branch / Component Coverage Plan</Label>
            <Textarea
              value={planningData?.branchComponentPlan || ""}
              onChange={(e) => onFieldChange?.("branchComponentPlan", e.target.value)}
              placeholder="Document branch coverage plan, component auditor coordination..."
              className="mt-1 text-xs min-h-[60px]"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Training / Competence Requirements</Label>
            <Textarea
              value={planningData?.trainingRequirements || ""}
              onChange={(e) => onFieldChange?.("trainingRequirements", e.target.value)}
              placeholder="Document any specific training or competence requirements for the audit team..."
              className="mt-1 text-xs min-h-[40px]"
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
