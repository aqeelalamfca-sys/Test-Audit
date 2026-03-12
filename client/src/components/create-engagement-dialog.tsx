import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Building2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { CreateClientDialog } from "@/components/create-client-dialog";

interface Client {
  id: string;
  name: string;
  tradingName?: string;
  ntn?: string;
  city?: string;
}

interface User {
  id: string;
  fullName: string;
  role: string;
}

interface Engagement {
  id: string;
  engagementCode: string;
  clientId: string;
  engagementType?: string;
  shareCapital?: number;
  authorizedCapital?: number;
  paidUpCapital?: number;
  numberOfEmployees?: number;
  lastYearRevenue?: number;
  previousYearRevenue?: number;
  periodStart?: string;
  periodEnd?: string;
  fiscalYearEnd?: string;
  priorAuditor?: string;
  priorAuditorEmail?: string;
  priorAuditorPhone?: string;
  priorAuditorAddress?: string;
  priorAuditOpinion?: string;
  udin?: string;
  eqcrRequired?: boolean;
  companyCategory?: string;
  companyCategoryOther?: string;
  engagementPartnerId?: string;
  engagementManagerId?: string;
  teamLeadId?: string;
  client?: Client;
}

interface EngagementDialogProps {
  mode: "create" | "edit";
  engagementId?: string;
  preselectedClientId?: string;
  onSuccess?: (engagement: any) => void;
  trigger?: React.ReactNode;
}

const generateEngagementCode = () => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 900) + 100;
  return `ENG-${year}-${randomNum}`;
};

const ENGAGEMENT_TYPES = [
  { value: "statutory_audit", label: "Statutory Audit" },
  { value: "tax_audit", label: "Tax Audit" },
  { value: "internal_audit", label: "Internal Audit" },
  { value: "special_purpose", label: "Special Purpose Audit" },
  { value: "review_engagement", label: "Review Engagement" },
];

const TAX_PERIODS = [
  { value: "jan_dec", label: "January – December", start: "01-01", end: "12-31" },
  { value: "apr_mar", label: "April – March", start: "04-01", end: "03-31" },
  { value: "jul_jun", label: "July – June", start: "07-01", end: "06-30" },
  { value: "oct_sep", label: "October – September", start: "10-01", end: "09-30" },
  { value: "custom", label: "Custom Period", start: "", end: "" },
];

const COMPANY_CATEGORIES = [
  { value: "listed", label: "Listed Company" },
  { value: "public_interest", label: "Public Interest Company" },
  { value: "public_unlisted", label: "Public Unlisted Company" },
  { value: "large_sized", label: "Large Sized Company" },
  { value: "medium_sized", label: "Medium Sized Company" },
  { value: "small_sized", label: "Small Sized Company (SSC)" },
  { value: "single_member", label: "Single Member Company" },
  { value: "private_limited", label: "Private Limited Company" },
  { value: "npo", label: "Not-for-Profit Organization (NPO)" },
  { value: "trust", label: "Trust" },
  { value: "cooperative", label: "Cooperative Society" },
  { value: "association", label: "Association / Body of Persons" },
  { value: "government", label: "Government Entity" },
  { value: "statutory_body", label: "Statutory Body" },
  { value: "other", label: "Other" },
];

const initialFormState = {
  engagementCode: "",
  clientId: "",
  engagementType: "statutory_audit",
  taxPeriod: "",
  authorizedCapital: "",
  paidUpCapital: "",
  numberOfEmployees: "",
  lastYearRevenue: "",
  previousYearRevenue: "",
  periodStart: "",
  periodEnd: "",
  companyCategory: "",
  companyCategoryOther: "",
  partnerId: "",
  managerId: "",
  seniorId: "",
  previousAuditorName: "",
  previousAuditorEmail: "",
  previousAuditorPhone: "",
  previousAuditorAddress: "",
  lastYearAuditOpinion: "",
  udin: "",
  eqcrRequired: false,
};

export function EngagementDialog({
  mode,
  engagementId,
  preselectedClientId,
  onSuccess,
  trigger,
}: EngagementDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const isEditMode = mode === "edit";

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const partners = users?.filter(u => u.role === "PARTNER") || [];
  const managers = users?.filter(u => u.role === "MANAGER") || [];
  const seniors = users?.filter(u => u.role === "SENIOR") || [];

  useEffect(() => {
    if (dialogOpen) {
      if (isEditMode && engagementId) {
        fetchEngagementData();
      } else {
        setFormData({
          ...initialFormState,
          engagementCode: generateEngagementCode(),
          clientId: preselectedClientId || "",
        });
      }
    }
  }, [dialogOpen, isEditMode, engagementId, preselectedClientId]);

  const fetchEngagementData = async () => {
    if (!engagementId) return;
    
    setFetchingData(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}`);
      
      if (response.ok) {
        const engagement: Engagement = await response.json();
        setFormData({
          engagementCode: engagement.engagementCode || "",
          clientId: engagement.clientId || "",
          engagementType: engagement.engagementType || "statutory_audit",
          taxPeriod: "",
          authorizedCapital: engagement.authorizedCapital?.toString() || "",
          paidUpCapital: engagement.paidUpCapital?.toString() || engagement.shareCapital?.toString() || "",
          numberOfEmployees: engagement.numberOfEmployees?.toString() || "",
          companyCategory: engagement.companyCategory || "",
          companyCategoryOther: engagement.companyCategoryOther || "",
          lastYearRevenue: engagement.lastYearRevenue?.toString() || "",
          previousYearRevenue: engagement.previousYearRevenue?.toString() || "",
          periodStart: engagement.periodStart?.split("T")[0] || "",
          periodEnd: engagement.periodEnd?.split("T")[0] || engagement.fiscalYearEnd?.split("T")[0] || "",
          partnerId: engagement.engagementPartnerId || "",
          managerId: engagement.engagementManagerId || "",
          seniorId: engagement.teamLeadId || "",
          previousAuditorName: engagement.priorAuditor || "",
          previousAuditorEmail: engagement.priorAuditorEmail || "",
          previousAuditorPhone: engagement.priorAuditorPhone || "",
          previousAuditorAddress: engagement.priorAuditorAddress || "",
          lastYearAuditOpinion: engagement.priorAuditOpinion || "",
          udin: engagement.udin || "",
          eqcrRequired: engagement.eqcrRequired || false,
        });
      } else {
        toast({ title: "Error", description: "Failed to load engagement data", variant: "destructive" });
        setDialogOpen(false);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load engagement data", variant: "destructive" });
      setDialogOpen(false);
    } finally {
      setFetchingData(false);
    }
  };

  const handleNewClientCreated = (client: any) => {
    setFormData({ ...formData, clientId: client.id });
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
  };

  const isFormValid = formData.clientId && formData.periodStart && formData.periodEnd && formData.partnerId;

  const handleSubmit = async (shouldStartAudit = false) => {
    if (!isFormValid) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill all required fields (Client, Dates, Partner)", 
        variant: "destructive" 
      });
      return;
    }

    if (new Date(formData.periodStart) >= new Date(formData.periodEnd)) {
      toast({ 
        title: "Validation Error", 
        description: "Financial year start date must be before end date", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        engagementCode: formData.engagementCode,
        clientId: formData.clientId,
        engagementType: formData.engagementType || "statutory_audit",
        reportingFramework: "IFRS",
        fiscalYearEnd: formData.periodEnd,
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        shareCapital: formData.paidUpCapital ? parseFloat(formData.paidUpCapital) : undefined,
        authorizedCapital: formData.authorizedCapital ? parseFloat(formData.authorizedCapital) : undefined,
        paidUpCapital: formData.paidUpCapital ? parseFloat(formData.paidUpCapital) : undefined,
        numberOfEmployees: formData.numberOfEmployees ? parseInt(formData.numberOfEmployees) : undefined,
        lastYearRevenue: formData.lastYearRevenue ? parseFloat(formData.lastYearRevenue) : undefined,
        previousYearRevenue: formData.previousYearRevenue ? parseFloat(formData.previousYearRevenue) : undefined,
        companyCategory: formData.companyCategory === "other" ? formData.companyCategoryOther : formData.companyCategory || undefined,
        priorAuditor: formData.previousAuditorName || undefined,
        priorAuditorEmail: formData.previousAuditorEmail || undefined,
        priorAuditorPhone: formData.previousAuditorPhone || undefined,
        priorAuditorAddress: formData.previousAuditorAddress || undefined,
        priorAuditOpinion: formData.lastYearAuditOpinion || undefined,
        udin: formData.udin || undefined,
        eqcrRequired: formData.eqcrRequired,
        engagementPartnerId: formData.partnerId || undefined,
        engagementManagerId: formData.managerId || undefined,
        teamLeadId: formData.seniorId || undefined,
      };

      const url = isEditMode ? `/api/engagements/${engagementId}` : "/api/engagements";
      const method = isEditMode ? "PATCH" : "POST";
      
      const response = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
        queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId] });
        queryClient.invalidateQueries({ queryKey: ["/api/workspace/engagements"] });
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });

        if (shouldStartAudit && !isEditMode) {
          toast({ title: "Engagement created", description: "Starting audit workspace..." });
          setDialogOpen(false);
          setFormData(initialFormState);
          const startRes = await fetchWithAuth(`/api/engagements/${result.id}/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (startRes.ok) {
            const startData = await startRes.json();
            navigate(startData.resumeRoute || `/workspace/${result.id}/pre-planning`);
          } else {
            navigate(`/engagements`);
          }
        } else {
          toast({ 
            title: "Success", 
            description: isEditMode ? "Engagement updated successfully" : "Engagement created successfully",
          });
          setDialogOpen(false);
          setFormData(initialFormState);
          onSuccess?.(result);
        }
      } else {
        const error = await response.json();
        toast({ 
          title: "Error", 
          description: error.error || `Failed to ${isEditMode ? "update" : "create"} engagement`, 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error?.message || `Failed to ${isEditMode ? "update" : "create"} engagement`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedClient = clients?.find(c => c.id === formData.clientId);

  const defaultTrigger = isEditMode ? (
    <Button variant="ghost" size="icon" data-testid="button-edit-engagement">
      <Pencil className="h-4 w-4" />
    </Button>
  ) : (
    <Button data-testid="button-new-engagement">
      <Plus className="h-4 w-4 mr-2" />
      New Engagement
    </Button>
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Engagement" : "Create New Engagement"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the engagement details below" : "Fill in the engagement details below"}
          </DialogDescription>
        </DialogHeader>

        {fetchingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading engagement data...</span>
          </div>
        ) : (
          <>
            <div className="grid gap-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="engagementCode" className="text-xs">Engagement Code</Label>
                  <Input
                    id="engagementCode"
                    data-testid="input-engagement-code"
                    value={formData.engagementCode}
                    onChange={(e) => setFormData({ ...formData, engagementCode: e.target.value })}
                    disabled={isEditMode}
                    className="h-8 text-sm bg-muted"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clientId" className="text-xs">Client Name *</Label>
                  <div className="flex gap-1.5">
                    <Select 
                      value={formData.clientId} 
                      onValueChange={(v) => setFormData({ ...formData, clientId: v })}
                      disabled={!!preselectedClientId || isEditMode}
                    >
                      <SelectTrigger id="clientId" data-testid="select-client" className="h-8 text-sm flex-1">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name} {client.city ? `(${client.city})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isEditMode && !preselectedClientId && (
                      <CreateClientDialog
                        onSuccess={handleNewClientCreated}
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 shrink-0"
                            data-testid="button-new-client"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">New</span>
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="engagementType" className="text-xs">Engagement Type</Label>
                <Select
                  value={formData.engagementType}
                  onValueChange={(v) => setFormData({ ...formData, engagementType: v })}
                >
                  <SelectTrigger id="engagementType" data-testid="select-engagement-type" className="h-8 text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGAGEMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClient && (
                <div className="p-2 bg-muted/50 rounded-md text-xs">
                  <p className="font-medium">{selectedClient.name}</p>
                  {selectedClient.tradingName && (
                    <span className="text-muted-foreground">Trading: {selectedClient.tradingName} | </span>
                  )}
                  {selectedClient.ntn && (
                    <span className="text-muted-foreground">NTN: {selectedClient.ntn}</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="taxPeriod" className="text-xs">Tax Period</Label>
                  <Select
                    value={formData.taxPeriod}
                    onValueChange={(v) => {
                      const tp = TAX_PERIODS.find(t => t.value === v);
                      if (tp && tp.start && tp.end) {
                        const currentYear = new Date().getFullYear();
                        let startYear = currentYear;
                        let endYear = currentYear;
                        if (v === "jul_jun" || v === "apr_mar" || v === "oct_sep") {
                          const startMonth = parseInt(tp.start.split("-")[0]);
                          if (startMonth > 6) {
                            endYear = currentYear + 1;
                          } else {
                            startYear = currentYear - 1;
                          }
                        }
                        setFormData({
                          ...formData,
                          taxPeriod: v,
                          periodStart: `${startYear}-${tp.start}`,
                          periodEnd: `${endYear}-${tp.end}`,
                        });
                      } else {
                        setFormData({ ...formData, taxPeriod: v });
                      }
                    }}
                  >
                    <SelectTrigger id="taxPeriod" data-testid="select-tax-period" className="h-8 text-sm">
                      <SelectValue placeholder="Select tax period" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_PERIODS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="periodStart" className="text-xs">Period Start *</Label>
                  <Input
                    id="periodStart"
                    data-testid="input-period-start"
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="periodEnd" className="text-xs">Period End *</Label>
                  <Input
                    id="periodEnd"
                    data-testid="input-period-end"
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="authorizedCapital" className="text-xs">Authorized Capital</Label>
                  <Input
                    id="authorizedCapital"
                    data-testid="input-authorized-capital"
                    type="number"
                    min="0"
                    placeholder="PKR"
                    value={formData.authorizedCapital}
                    onChange={(e) => setFormData({ ...formData, authorizedCapital: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="paidUpCapital" className="text-xs">Paid-up Capital</Label>
                  <Input
                    id="paidUpCapital"
                    data-testid="input-paid-up-capital"
                    type="number"
                    min="0"
                    placeholder="PKR"
                    value={formData.paidUpCapital}
                    onChange={(e) => setFormData({ ...formData, paidUpCapital: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="numberOfEmployees" className="text-xs">No. of Employees</Label>
                  <Input
                    id="numberOfEmployees"
                    data-testid="input-employees"
                    type="number"
                    min="0"
                    value={formData.numberOfEmployees}
                    onChange={(e) => setFormData({ ...formData, numberOfEmployees: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="companyCategory" className="text-xs">Category of Company</Label>
                  <Select
                    value={formData.companyCategory}
                    onValueChange={(v) => setFormData({ ...formData, companyCategory: v, companyCategoryOther: v !== "other" ? "" : formData.companyCategoryOther })}
                  >
                    <SelectTrigger id="companyCategory" data-testid="select-company-category" className="h-8 text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.companyCategory === "other" && (
                <div className="space-y-1">
                  <Label htmlFor="companyCategoryOther" className="text-xs">Specify Category</Label>
                  <Input
                    id="companyCategoryOther"
                    data-testid="input-company-category-other"
                    placeholder="Enter company category"
                    value={formData.companyCategoryOther}
                    onChange={(e) => setFormData({ ...formData, companyCategoryOther: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="lastYearRevenue" className="text-xs">Revenue (Last Year)</Label>
                  <Input
                    id="lastYearRevenue"
                    data-testid="input-last-year-revenue"
                    type="number"
                    min="0"
                    placeholder="PKR"
                    value={formData.lastYearRevenue}
                    onChange={(e) => setFormData({ ...formData, lastYearRevenue: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="previousYearRevenue" className="text-xs">Revenue (Year Before Last)</Label>
                  <Input
                    id="previousYearRevenue"
                    data-testid="input-previous-year-revenue"
                    type="number"
                    min="0"
                    placeholder="PKR"
                    value={formData.previousYearRevenue}
                    onChange={(e) => setFormData({ ...formData, previousYearRevenue: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="border-t pt-3 mt-1">
                <h4 className="text-sm font-medium mb-2">Team Assignment</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="partnerId" className="text-xs">Partner *</Label>
                    <Select 
                      value={formData.partnerId} 
                      onValueChange={(v) => setFormData({ ...formData, partnerId: v })}
                    >
                      <SelectTrigger id="partnerId" data-testid="select-partner" className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="managerId" className="text-xs">Manager</Label>
                    <Select 
                      value={formData.managerId} 
                      onValueChange={(v) => setFormData({ ...formData, managerId: v })}
                    >
                      <SelectTrigger id="managerId" data-testid="select-manager" className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="seniorId" className="text-xs">Senior</Label>
                    <Select 
                      value={formData.seniorId} 
                      onValueChange={(v) => setFormData({ ...formData, seniorId: v })}
                    >
                      <SelectTrigger id="seniorId" data-testid="select-senior" className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {seniors.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-md">
                <Checkbox
                  id="eqcrRequired"
                  data-testid="checkbox-eqcr-required"
                  checked={formData.eqcrRequired}
                  onCheckedChange={(checked) => setFormData({ ...formData, eqcrRequired: !!checked })}
                />
                <Label htmlFor="eqcrRequired" className="text-sm font-normal cursor-pointer">
                  EQCR Required - Engagement Quality Control Review is mandatory for this engagement
                </Label>
              </div>

              <div className="border-t pt-3 mt-1">
                <h4 className="text-sm font-medium mb-2">Previous Auditor Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="previousAuditorName" className="text-xs">Auditor Name</Label>
                    <Input
                      id="previousAuditorName"
                      data-testid="input-previous-auditor-name"
                      value={formData.previousAuditorName}
                      onChange={(e) => setFormData({ ...formData, previousAuditorName: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="previousAuditorEmail" className="text-xs">Auditor Email</Label>
                    <Input
                      id="previousAuditorEmail"
                      data-testid="input-previous-auditor-email"
                      type="email"
                      value={formData.previousAuditorEmail}
                      onChange={(e) => setFormData({ ...formData, previousAuditorEmail: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="previousAuditorPhone" className="text-xs">Auditor Phone</Label>
                    <Input
                      id="previousAuditorPhone"
                      data-testid="input-previous-auditor-phone"
                      value={formData.previousAuditorPhone}
                      onChange={(e) => setFormData({ ...formData, previousAuditorPhone: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastYearAuditOpinion" className="text-xs">Prior Audit Opinion</Label>
                    <Select 
                      value={formData.lastYearAuditOpinion} 
                      onValueChange={(v) => setFormData({ ...formData, lastYearAuditOpinion: v })}
                    >
                      <SelectTrigger id="lastYearAuditOpinion" data-testid="select-audit-opinion" className="h-8 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmodified">Unmodified</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="adverse">Adverse</SelectItem>
                        <SelectItem value="disclaimer">Disclaimer</SelectItem>
                        <SelectItem value="not_applicable">Not Applicable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1">
                    <Label htmlFor="previousAuditorAddress" className="text-xs">Auditor Address</Label>
                    <Textarea
                      id="previousAuditorAddress"
                      data-testid="input-previous-auditor-address"
                      value={formData.previousAuditorAddress}
                      onChange={(e) => setFormData({ ...formData, previousAuditorAddress: e.target.value })}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="udin" className="text-xs">UDIN</Label>
                    <Input
                      id="udin"
                      data-testid="input-udin"
                      value={formData.udin}
                      onChange={(e) => setFormData({ ...formData, udin: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => handleSubmit(false)} 
                disabled={loading || !isFormValid}
                data-testid={isEditMode ? "button-update-engagement" : "button-create-engagement"}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditMode ? "Update Engagement" : "Save"}
              </Button>
              {!isEditMode && (
                <Button 
                  size="sm"
                  onClick={() => handleSubmit(true)} 
                  disabled={loading || !isFormValid}
                  data-testid="button-save-start-audit"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save & Start Audit
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>

    </Dialog>
  );
}

export function CreateEngagementDialog({
  preselectedClientId,
  onSuccess,
  trigger,
}: {
  preselectedClientId?: string;
  onSuccess?: (engagement: any) => void;
  trigger?: React.ReactNode;
}) {
  return (
    <EngagementDialog
      mode="create"
      preselectedClientId={preselectedClientId}
      onSuccess={onSuccess}
      trigger={trigger}
    />
  );
}

export function EditEngagementDialog({
  engagementId,
  onSuccess,
  trigger,
}: {
  engagementId: string;
  onSuccess?: (engagement: any) => void;
  trigger?: React.ReactNode;
}) {
  return (
    <EngagementDialog
      mode="edit"
      engagementId={engagementId}
      onSuccess={onSuccess}
      trigger={trigger}
    />
  );
}
