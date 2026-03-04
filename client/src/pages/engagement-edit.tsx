import { useParams, Link, useLocation } from "wouter";
import { AgentsLoadingInline } from "@/components/agents-loading";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Engagement {
  id: string;
  engagementCode: string;
  engagementType: string;
  status: string;
  riskRating: string;
  fiscalYearEnd?: string;
  periodStart?: string;
  periodEnd?: string;
  fieldworkStartDate?: string;
  fieldworkEndDate?: string;
  reportDeadline?: string;
  filingDeadline?: string;
  reportingFramework?: string;
  applicableLaw?: string;
  budgetHours?: number;
  priorAuditor?: string;
  priorAuditorReason?: string;
  client?: {
    id: string;
    name: string;
  };
}

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export default function EngagementEdit() {
  const params = useParams();
  const engagementId = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    engagementType: "",
    status: "",
    riskRating: "",
    fiscalYearEnd: "",
    periodStart: "",
    periodEnd: "",
    fieldworkStartDate: "",
    fieldworkEndDate: "",
    reportDeadline: "",
    filingDeadline: "",
    reportingFramework: "",
    applicableLaw: "",
    budgetHours: "",
    priorAuditor: "",
    priorAuditorReason: "",
  });

  const { data: engagement, isLoading, error } = useQuery<Engagement>({
    queryKey: [`/api/engagements/${engagementId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}`);
      if (!res.ok) throw new Error("Failed to fetch engagement");
      return res.json();
    },
  });

  useEffect(() => {
    if (engagement) {
      setFormData({
        engagementType: engagement.engagementType || "statutory_audit",
        status: engagement.status || "DRAFT",
        riskRating: engagement.riskRating || "MEDIUM",
        fiscalYearEnd: formatDateForInput(engagement.fiscalYearEnd),
        periodStart: formatDateForInput(engagement.periodStart),
        periodEnd: formatDateForInput(engagement.periodEnd),
        fieldworkStartDate: formatDateForInput(engagement.fieldworkStartDate),
        fieldworkEndDate: formatDateForInput(engagement.fieldworkEndDate),
        reportDeadline: formatDateForInput(engagement.reportDeadline),
        filingDeadline: formatDateForInput(engagement.filingDeadline),
        reportingFramework: engagement.reportingFramework || "IFRS",
        applicableLaw: engagement.applicableLaw || "",
        budgetHours: engagement.budgetHours?.toString() || "",
        priorAuditor: engagement.priorAuditor || "",
        priorAuditorReason: engagement.priorAuditorReason || "",
      });
    }
  }, [engagement]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        engagementType: formData.engagementType,
        status: formData.status,
        riskRating: formData.riskRating,
        fiscalYearEnd: formData.fiscalYearEnd || null,
        periodStart: formData.periodStart || null,
        periodEnd: formData.periodEnd || null,
        fieldworkStartDate: formData.fieldworkStartDate || null,
        fieldworkEndDate: formData.fieldworkEndDate || null,
        reportDeadline: formData.reportDeadline || null,
        filingDeadline: formData.filingDeadline || null,
        reportingFramework: formData.reportingFramework,
        applicableLaw: formData.applicableLaw || null,
        priorAuditor: formData.priorAuditor || null,
        priorAuditorReason: formData.priorAuditorReason || null,
      };

      if (formData.budgetHours) {
        payload.budgetHours = parseInt(formData.budgetHours, 10);
      }

      const res = await fetchWithAuth(`/api/engagements/${engagementId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Engagement updated successfully" });
        queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
        queryClient.invalidateQueries({ queryKey: [`/api/engagements/${engagementId}`] });
        navigate("/engagements");
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to update engagement", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update engagement", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <AgentsLoadingInline showDelay={1000} />;
  }

  if (error || !engagement) {
    return (
      <div className="px-4 py-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">Failed to load engagement details.</p>
            <Link href="/engagements">
              <Button variant="outline" className="mt-4">Back to Engagements</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-4">
        <Link href="/engagements">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Engagements
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Engagement</h1>
          <p className="text-muted-foreground">
            {engagement.engagementCode} - {engagement.client?.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Engagement Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="engagementType">Engagement Type</Label>
              <Select
                value={formData.engagementType}
                onValueChange={(v) => setFormData({ ...formData, engagementType: v })}
              >
                <SelectTrigger id="engagementType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="statutory_audit">Statutory Audit</SelectItem>
                  <SelectItem value="special_audit">Special Audit</SelectItem>
                  <SelectItem value="review_engagement">Review Engagement</SelectItem>
                  <SelectItem value="agreed_upon_procedures">Agreed Upon Procedures</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="riskRating">Risk Rating</Label>
              <Select
                value={formData.riskRating}
                onValueChange={(v) => setFormData({ ...formData, riskRating: v })}
              >
                <SelectTrigger id="riskRating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reportingFramework">Reporting Framework</Label>
              <Select
                value={formData.reportingFramework}
                onValueChange={(v) => setFormData({ ...formData, reportingFramework: v })}
              >
                <SelectTrigger id="reportingFramework">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IFRS">IFRS</SelectItem>
                  <SelectItem value="LOCAL_GAAP">Local GAAP</SelectItem>
                  <SelectItem value="US_GAAP">US GAAP</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budgetHours">Budget Hours</Label>
              <Input
                id="budgetHours"
                type="number"
                value={formData.budgetHours}
                onChange={(e) => setFormData({ ...formData, budgetHours: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicableLaw">Applicable Law</Label>
              <Input
                id="applicableLaw"
                value={formData.applicableLaw}
                onChange={(e) => setFormData({ ...formData, applicableLaw: e.target.value })}
                placeholder="e.g., Companies Act 2017"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Period Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fiscalYearEnd">Fiscal Year End</Label>
                <Input
                  id="fiscalYearEnd"
                  type="date"
                  value={formData.fiscalYearEnd}
                  onChange={(e) => setFormData({ ...formData, fiscalYearEnd: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Key Dates</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fieldworkStartDate">Fieldwork Start</Label>
                <Input
                  id="fieldworkStartDate"
                  type="date"
                  value={formData.fieldworkStartDate}
                  onChange={(e) => setFormData({ ...formData, fieldworkStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fieldworkEndDate">Fieldwork End</Label>
                <Input
                  id="fieldworkEndDate"
                  type="date"
                  value={formData.fieldworkEndDate}
                  onChange={(e) => setFormData({ ...formData, fieldworkEndDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportDeadline">Report Deadline</Label>
                <Input
                  id="reportDeadline"
                  type="date"
                  value={formData.reportDeadline}
                  onChange={(e) => setFormData({ ...formData, reportDeadline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filingDeadline">Filing Deadline</Label>
                <Input
                  id="filingDeadline"
                  type="date"
                  value={formData.filingDeadline}
                  onChange={(e) => setFormData({ ...formData, filingDeadline: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Prior Auditor Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priorAuditor">Prior Auditor Name</Label>
                <Input
                  id="priorAuditor"
                  value={formData.priorAuditor}
                  onChange={(e) => setFormData({ ...formData, priorAuditor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priorAuditorReason">Change Reason</Label>
                <Textarea
                  id="priorAuditorReason"
                  value={formData.priorAuditorReason}
                  onChange={(e) => setFormData({ ...formData, priorAuditorReason: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link href="/engagements">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
