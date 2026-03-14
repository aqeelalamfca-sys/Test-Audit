import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CreateClientDialog } from "@/components/create-client-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  FileText,
  Save,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Building2,
  Shield,
  Users,
  AlertTriangle,
  Bot,
  X,
  Calendar,
  Clock,
} from "lucide-react";
import {
  ENGAGEMENT_TYPES,
  SIZE_CLASSIFICATIONS,
  RISK_RATINGS,
  REPORTING_FRAMEWORKS,
} from "@/lib/form-constants";

interface Client {
  id: string;
  name: string;
  tradingName?: string;
  ntn?: string;
  sizeClassification?: string;
  city?: string;
  fiscalYearEndDate?: string;
  reportingFramework?: string;
}

interface FirmUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

const engagementFormSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  sizeClassification: z.string().min(1, "Company size is required"),
  engagementType: z.string().min(1, "Audit type is required"),
  reportingFramework: z.string().optional(),
  periodStart: z.string().min(1, "Period start date is required"),
  periodEnd: z.string().min(1, "Period end date is required"),
  fiscalYearEnd: z.string().optional(),
  riskRating: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  eqcrRequired: z.boolean().default(false),
  eqcrRationale: z.string().optional(),
  eqcrPartnerUserId: z.string().optional(),
  engagementPartnerId: z.string().optional(),
  engagementManagerId: z.string().optional(),
  teamLeadId: z.string().optional(),
  budgetHours: z.number().optional(),
  fieldworkStartDate: z.string().optional(),
  fieldworkEndDate: z.string().optional(),
  reportDeadline: z.string().optional(),
  filingDeadline: z.string().optional(),
  isGroupAudit: z.boolean().default(false),
  isComponentAudit: z.boolean().default(false),
}).refine((data) => {
  if (data.periodStart && data.periodEnd) {
    return new Date(data.periodEnd) > new Date(data.periodStart);
  }
  return true;
}, {
  message: "Period end date must be after start date",
  path: ["periodEnd"],
}).refine((data) => {
  if (data.eqcrRequired && !data.eqcrPartnerUserId) {
    return false;
  }
  return true;
}, {
  message: "EQCR Partner must be selected when EQCR is required",
  path: ["eqcrPartnerUserId"],
});

type EngagementFormData = z.infer<typeof engagementFormSchema>;

const REQUIRED_FIELD_LABELS: { key: keyof EngagementFormData; label: string }[] = [
  { key: "clientId", label: "Client" },
  { key: "engagementType", label: "Engagement Type" },
  { key: "periodStart", label: "Period Start" },
  { key: "periodEnd", label: "Period End" },
  { key: "sizeClassification", label: "Company Size" },
  { key: "engagementPartnerId", label: "Engagement Partner" },
  { key: "engagementManagerId", label: "Engagement Manager" },
];

function computeSetupCompleteness(data: EngagementFormData): { pct: number; missing: string[] } {
  const missing: string[] = [];
  for (const f of REQUIRED_FIELD_LABELS) {
    const val = data[f.key];
    if (!val || (typeof val === "string" && !val.trim())) {
      missing.push(f.label);
    }
  }
  const filled = REQUIRED_FIELD_LABELS.length - missing.length;
  return { pct: Math.round((filled / REQUIRED_FIELD_LABELS.length) * 100), missing };
}

export default function NewEngagement() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const qc = useQueryClient();

  const searchParams = new URLSearchParams(searchString);
  const preselectedClientId = searchParams.get("clientId") || "";

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: clients = [], isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: firmUsers = [] } = useQuery<FirmUser[]>({
    queryKey: ["/api/firm/users"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/firm/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const partners = firmUsers.filter(u => ["PARTNER", "FIRM_ADMIN"].includes(u.role));
  const managers = firmUsers.filter(u => ["MANAGER", "PARTNER", "FIRM_ADMIN"].includes(u.role));
  const seniors = firmUsers.filter(u => ["SENIOR", "MANAGER", "PARTNER", "FIRM_ADMIN"].includes(u.role));
  const eqcrPartners = firmUsers.filter(u => ["EQCR", "PARTNER"].includes(u.role));

  const form = useForm<EngagementFormData>({
    resolver: zodResolver(engagementFormSchema),
    defaultValues: {
      clientId: preselectedClientId,
      sizeClassification: "",
      engagementType: "statutory_audit",
      reportingFramework: "",
      periodStart: "",
      periodEnd: "",
      fiscalYearEnd: "",
      riskRating: "MEDIUM",
      eqcrRequired: false,
      eqcrRationale: "",
      eqcrPartnerUserId: "",
      engagementPartnerId: "",
      engagementManagerId: "",
      teamLeadId: "",
      budgetHours: undefined,
      fieldworkStartDate: "",
      fieldworkEndDate: "",
      reportDeadline: "",
      filingDeadline: "",
      isGroupAudit: false,
      isComponentAudit: false,
    },
  });

  const formValues = form.watch();
  const completeness = useMemo(() => computeSetupCompleteness(formValues), [formValues]);

  const eqcrRequired = form.watch("eqcrRequired");
  const selectedClientId = form.watch("clientId");
  const selectedClient = clients.find(c => c.id === selectedClientId);

  useEffect(() => {
    if (selectedClient) {
      if (selectedClient.sizeClassification && !form.getValues("sizeClassification")) {
        form.setValue("sizeClassification", selectedClient.sizeClassification);
      }
      if (selectedClient.fiscalYearEndDate && !form.getValues("fiscalYearEnd")) {
        form.setValue("fiscalYearEnd", selectedClient.fiscalYearEndDate.slice(0, 10));
      }
      if (selectedClient.reportingFramework && !form.getValues("reportingFramework")) {
        form.setValue("reportingFramework", selectedClient.reportingFramework);
      }
    }
  }, [selectedClient]);

  const createEngagementMutation = useMutation({
    mutationFn: async (data: EngagementFormData) => {
      const response = await apiRequest("POST", "/api/engagements", {
        clientId: data.clientId,
        sizeClassification: data.sizeClassification,
        engagementType: data.engagementType,
        reportingFramework: data.reportingFramework || undefined,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        fiscalYearEnd: data.fiscalYearEnd || undefined,
        riskRating: data.riskRating,
        eqcrRequired: data.eqcrRequired,
        eqcrRationale: data.eqcrRationale || undefined,
        eqcrPartnerUserId: data.eqcrPartnerUserId || undefined,
        engagementPartnerId: data.engagementPartnerId || undefined,
        engagementManagerId: data.engagementManagerId || undefined,
        teamLeadId: data.teamLeadId || undefined,
        budgetHours: data.budgetHours,
        fieldworkStartDate: data.fieldworkStartDate || undefined,
        fieldworkEndDate: data.fieldworkEndDate || undefined,
        reportDeadline: data.reportDeadline || undefined,
        filingDeadline: data.filingDeadline || undefined,
        isGroupAudit: data.isGroupAudit,
        isComponentAudit: data.isComponentAudit,
      });
      return response.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/engagements"] });
      qc.invalidateQueries({ queryKey: ["/api/workspace/engagements"] });
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      globalQueryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
      globalQueryClient.invalidateQueries({ queryKey: ["/api/workspace/engagements"] });
      toast({
        title: "Engagement Created",
        description: `Engagement created successfully. Proceeding to workspace...`,
      });
      setLocation(`/workspace/${data.id}/acceptance`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create engagement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EngagementFormData) => {
    createEngagementMutation.mutate(data);
  };

  const generateAiSummary = useCallback(async () => {
    setAiLoading(true);
    try {
      const vals = form.getValues();
      const client = clients.find(c => c.id === vals.clientId);
      const res = await fetchWithAuth("/api/ai/phase/engagement-setup/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capabilityId: "engagement-setup-summary",
          additionalContext: {
            clientName: client?.name || "",
            engagementType: vals.engagementType,
            periodStart: vals.periodStart,
            periodEnd: vals.periodEnd,
            riskRating: vals.riskRating,
            eqcrRequired: String(vals.eqcrRequired),
            sizeClassification: vals.sizeClassification,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.content || "Summary generated.");
      } else {
        setAiSummary("AI summary unavailable — ensure the AI service is configured.");
      }
    } catch {
      setAiSummary("AI summary unavailable — ensure the AI service is configured.");
    } finally {
      setAiLoading(false);
    }
  }, [form, clients]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/engagements")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Engagements
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumbs items={[
            { label: "Dashboard", href: "/" },
            { label: "Engagements", href: "/engagements" },
            { label: "New Engagement" },
          ]} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant={showAiPanel ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setShowAiPanel(!showAiPanel)}>
            <Bot className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto p-2.5 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Engagement Setup</h1>
              <p className="text-xs text-muted-foreground">Phase 2 of 19 — Create engagement with period, team, and timeline</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Completeness</div>
                <div className="text-sm font-semibold">{completeness.pct}%</div>
              </div>
              <Progress value={completeness.pct} className="w-24 h-2" />
            </div>
          </div>

          {completeness.missing.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 mb-2.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Missing required: {completeness.missing.join(", ")}</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Client & Type
                  </h3>
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client *</FormLabel>
                        <div className="flex gap-2">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select a registered client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {loadingClients ? (
                                <div className="p-2 text-center text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading...
                                </div>
                              ) : clients.length === 0 ? (
                                <div className="p-2 text-center text-muted-foreground">No clients. Create one first.</div>
                              ) : (
                                clients.map(client => (
                                  <SelectItem key={client.id} value={client.id}>
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span>{client.name}</span>
                                      {client.city && <span className="text-muted-foreground text-xs">({client.city})</span>}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <CreateClientDialog
                            onSuccess={(client) => {
                              qc.invalidateQueries({ queryKey: ["/api/clients"] });
                              form.setValue("clientId", client.id);
                            }}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedClient && (
                    <div className="p-3 rounded-md bg-muted/50 border text-sm">
                      <div className="font-medium mb-1">{selectedClient.name}</div>
                      {selectedClient.tradingName && <div className="text-muted-foreground text-xs">Trading as: {selectedClient.tradingName}</div>}
                      {selectedClient.ntn && <div className="text-muted-foreground text-xs">NTN: {selectedClient.ntn}</div>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="engagementType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Engagement Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {ENGAGEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sizeClassification"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Size *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {SIZE_CLASSIFICATIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="reportingFramework"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reporting Framework</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select framework" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {REPORTING_FRAMEWORKS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="riskRating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Risk Rating</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {RISK_RATINGS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-2.5">
                    <FormField
                      control={form.control}
                      name="isGroupAudit"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-xs font-normal">Group Audit</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isComponentAudit"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-xs font-normal">Component Audit</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Period & Timelines
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="periodStart" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Period Start *</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="periodEnd" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Period End *</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="fiscalYearEnd" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fiscal Year-End</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <Separator />
                  <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Audit Timeline & Deadlines
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <FormField control={form.control} name="fieldworkStartDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Fieldwork Start</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="fieldworkEndDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Fieldwork End</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="reportDeadline" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Report Deadline</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="filingDeadline" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Filing Deadline</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Team Assignment
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="engagementPartnerId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partner *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {partners.map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="engagementManagerId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manager *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {managers.map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="teamLeadId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Lead (Senior)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {seniors.map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="budgetHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 120"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          className="max-w-xs"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Estimated total audit hours</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> EQCR & Regulatory Flags
                  </h3>
                  <div className="p-3 rounded-md border bg-muted/30 space-y-3">
                    <FormField control={form.control} name="eqcrRequired" render={({ field }) => (
                      <FormItem className="flex items-center gap-3 space-y-0">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div>
                          <FormLabel className="font-medium">EQCR Required</FormLabel>
                          <FormDescription className="text-xs">Required for listed, public interest, or high-risk engagements</FormDescription>
                        </div>
                      </FormItem>
                    )} />

                    {eqcrRequired && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <FormField control={form.control} name="eqcrPartnerUserId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>EQCR Partner *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select reviewer" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {eqcrPartners.map(u => <SelectItem key={u.id} value={u.id}>{u.fullName} ({u.role})</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-xs">Must differ from engagement partner</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="eqcrRationale" render={({ field }) => (
                          <FormItem>
                            <FormLabel>EQCR Rationale</FormLabel>
                            <FormControl><Input {...field} placeholder="e.g., Listed entity, high risk" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between gap-2.5 pt-2 pb-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/engagements")}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Cancel
                </Button>
                <Button type="submit" disabled={createEngagementMutation.isPending} size="sm">
                  {createEngagementMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-1.5" />Create & Open Workspace<ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {showAiPanel && (
          <div className="w-72 border-l bg-muted/30 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Bot className="h-4 w-4 text-primary" /> AI Assistant
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowAiPanel(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 p-3 overflow-auto space-y-3">
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={generateAiSummary} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bot className="h-3 w-3 mr-1" />}
                Generate Setup Summary
              </Button>
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                if (completeness.missing.length > 0) {
                  setAiSummary(`Missing mandatory fields:\n${completeness.missing.map(m => `• ${m}`).join("\n")}\n\nComplete these before creating the engagement.`);
                } else {
                  setAiSummary("All mandatory fields are complete. Ready to create the engagement.");
                }
              }}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                Check Missing Fields
              </Button>
              {aiSummary && (
                <div className="p-3 rounded-md bg-background border text-xs whitespace-pre-wrap">
                  {aiSummary}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
