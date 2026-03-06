import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FileText, Save, Loader2, ArrowLeft, Building2, Shield, Users, AlertTriangle, Plus } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const PAKISTAN_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan",
  "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Abbottabad",
  "Bahawalpur", "Sargodha", "Sukkur", "Larkana", "Sheikhupura", "Jhang",
  "Rahim Yar Khan", "Gujrat", "Mardan", "Kasur", "Dera Ghazi Khan",
  "Sahiwal", "Nawabshah", "Mirpur Khas", "Chiniot", "Kamoke", "Other",
];

const newClientInitial = {
  clientLegalName: "",
  tradeName: "",
  ntn: "",
  secpNo: "",
  dateOfIncorporation: "",
  city: "",
  registeredAddress: "",
  contactEmail: "",
  contactPhone: "",
  country: "Pakistan",
};

interface Client {
  id: string;
  name: string;
  tradingName?: string;
  ntn?: string;
  sizeClassification?: string;
  city?: string;
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
  periodStart: z.string().min(1, "Period start date is required"),
  periodEnd: z.string().min(1, "Period end date is required"),
  riskRating: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  eqcrRequired: z.boolean().default(false),
  eqcrPartnerUserId: z.string().optional(),
  engagementPartnerId: z.string().optional(),
  engagementManagerId: z.string().optional(),
  budgetHours: z.number().optional(),
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

export default function NewEngagement() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  
  const searchParams = new URLSearchParams(searchString);
  const preselectedClientId = searchParams.get("clientId") || "";

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ ...newClientInitial });
  const [newClientLoading, setNewClientLoading] = useState(false);

  const handleNewClientSubmit = async () => {
    if (!newClientForm.clientLegalName.trim()) {
      toast({ title: "Validation Error", description: "Legal Name is required", variant: "destructive" });
      return;
    }
    setNewClientLoading(true);
    try {
      const payload = {
        name: newClientForm.clientLegalName.trim(),
        tradingName: newClientForm.tradeName || "",
        ntn: newClientForm.ntn || "",
        secpNo: newClientForm.secpNo || "",
        dateOfIncorporation: newClientForm.dateOfIncorporation || undefined,
        address: newClientForm.registeredAddress || "",
        city: newClientForm.city || "",
        country: newClientForm.country || "Pakistan",
        email: newClientForm.contactEmail || "",
        phone: newClientForm.contactPhone || "",
        entityType: "private_limited",
        industry: "general",
      };
      const response = await fetchWithAuth("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to create client" }));
        throw new Error(err.error || "Failed to create client");
      }
      const created = await response.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      form.setValue("clientId", created.id);
      setNewClientOpen(false);
      setNewClientForm({ ...newClientInitial });
      toast({ title: "Client Created", description: `${created.name} has been added successfully` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setNewClientLoading(false);
    }
  };

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

  const partners = firmUsers.filter(u => ["PARTNER", "EQCR"].includes(u.role));
  const managers = firmUsers.filter(u => ["MANAGER", "PARTNER"].includes(u.role));
  const eqcrPartners = firmUsers.filter(u => ["EQCR", "PARTNER"].includes(u.role));

  const form = useForm<EngagementFormData>({
    resolver: zodResolver(engagementFormSchema),
    defaultValues: {
      clientId: preselectedClientId,
      sizeClassification: "",
      engagementType: "statutory_audit",
      periodStart: "",
      periodEnd: "",
      riskRating: "MEDIUM",
      eqcrRequired: false,
      eqcrPartnerUserId: "",
      engagementPartnerId: "",
      engagementManagerId: "",
      budgetHours: undefined,
    },
  });

  const eqcrRequired = form.watch("eqcrRequired");

  const selectedClientId = form.watch("clientId");
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const createEngagementMutation = useMutation({
    mutationFn: async (data: EngagementFormData) => {
      const response = await apiRequest("POST", "/api/engagements", {
        clientId: data.clientId,
        sizeClassification: data.sizeClassification,
        engagementType: data.engagementType,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        riskRating: data.riskRating,
        eqcrRequired: data.eqcrRequired,
        eqcrPartnerUserId: data.eqcrPartnerUserId || undefined,
        engagementPartnerId: data.engagementPartnerId || undefined,
        engagementManagerId: data.engagementManagerId || undefined,
        budgetHours: data.budgetHours,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Engagement Created",
        description: `New audit engagement has been created successfully.`,
      });
      setLocation(`/workspace/${data.id}/pre-planning`);
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Engagements", href: "/engagements" },
            { label: "New Engagement" },
          ]}
          className="mb-3"
        />

        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary p-2 rounded-xl">
              <FileText className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">New Audit Engagement</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Create a new audit engagement for an existing client
          </p>
        </div>

        <Card>
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-lg">Engagement Details</CardTitle>
            <CardDescription>Select the client and specify the audit period</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client" className="flex-1">
                              <SelectValue placeholder="Select a registered client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingClients ? (
                              <div className="p-2 text-center text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                Loading clients...
                              </div>
                            ) : clients.length === 0 ? (
                              <div className="p-2 text-center text-muted-foreground">
                                No clients found. Create a client first.
                              </div>
                            ) : (
                              clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span>{client.name}</span>
                                    {client.city && (
                                      <span className="text-muted-foreground text-xs">({client.city})</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-10"
                          data-testid="button-new-client-page"
                          onClick={() => {
                            setNewClientForm({ ...newClientInitial });
                            setNewClientOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          New Client
                        </Button>
                      </div>
                      <FormDescription>
                        Select an existing client or add a new one.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedClient && (
                  <div className="p-3 rounded-md bg-muted/50 border text-sm">
                    <div className="font-medium mb-1">{selectedClient.name}</div>
                    {selectedClient.tradingName && (
                      <div className="text-muted-foreground">Trading as: {selectedClient.tradingName}</div>
                    )}
                    {selectedClient.ntn && (
                      <div className="text-muted-foreground">NTN: {selectedClient.ntn}</div>
                    )}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="sizeClassification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Size *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-size">
                            <SelectValue placeholder="Select company size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="large">Large Company</SelectItem>
                          <SelectItem value="medium">Medium-Sized Company</SelectItem>
                          <SelectItem value="small">Small Company</SelectItem>
                          <SelectItem value="sme">SME (SECP / ICAP)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Size classification affects audit scope and procedures
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="engagementType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audit Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-audit-type">
                            <SelectValue placeholder="Select audit type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="statutory_audit">Statutory Audit</SelectItem>
                          <SelectItem value="internal_audit">Internal Audit</SelectItem>
                          <SelectItem value="tax_audit">Tax Audit</SelectItem>
                          <SelectItem value="forensic_audit">Forensic Audit</SelectItem>
                          <SelectItem value="compliance_audit">Compliance Audit</SelectItem>
                          <SelectItem value="special_purpose">Special Purpose Audit</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Determines audit approach per ISA 315: Statutory = full ISA compliance, Special Purpose = tailored scope
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Audit Period *</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="periodStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              data-testid="input-period-start"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="periodEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              data-testid="input-period-end"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormDescription>
                    The financial period being audited (e.g., Jan 1, 2025 to Dec 31, 2025)
                  </FormDescription>
                </div>

                <Separator />

                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full justify-between" data-testid="button-advanced-options">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Advanced Options
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    
                    <FormField
                      control={form.control}
                      name="riskRating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Initial Risk Rating
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-risk-rating">
                                <SelectValue placeholder="Select risk level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="LOW">Low Risk</SelectItem>
                              <SelectItem value="MEDIUM">Medium Risk</SelectItem>
                              <SelectItem value="HIGH">High Risk</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Initial assessment - can be updated during planning phase
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="engagementPartnerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Engagement Partner</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-partner">
                                  <SelectValue placeholder="Select partner" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {partners.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="engagementManagerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Engagement Manager</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-manager">
                                  <SelectValue placeholder="Select manager" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {managers.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="budgetHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Budget Hours</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="e.g., 120"
                              data-testid="input-budget-hours"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormDescription>
                            Estimated total hours for this engagement
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="p-4 rounded-md border bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-primary mt-0.5" />
                        <div className="space-y-3 flex-1">
                          <FormField
                            control={form.control}
                            name="eqcrRequired"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-eqcr"
                                  />
                                </FormControl>
                                <div>
                                  <FormLabel className="font-medium">Engagement Quality Control Review (EQCR)</FormLabel>
                                  <FormDescription className="text-xs">
                                    Required for listed entities, public interest entities, or high-risk engagements
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />

                          {eqcrRequired && (
                            <FormField
                              control={form.control}
                              name="eqcrPartnerUserId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>EQCR Partner *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-eqcr-partner">
                                        <SelectValue placeholder="Select EQCR reviewer" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {eqcrPartners.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                          {user.fullName} ({user.role})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Must be different from the engagement partner
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                  </CollapsibleContent>
                </Collapsible>

                <div className="flex justify-between gap-4 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setLocation("/engagements")}
                    data-testid="button-cancel"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createEngagementMutation.isPending}
                    data-testid="button-create-engagement"
                  >
                    {createEngagementMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Engagement
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-new-client">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Add New Client
            </DialogTitle>
            <DialogDescription className="text-xs">Master Data | Quick Add</DialogDescription>
          </DialogHeader>

          <fieldset className="border rounded-lg p-4 space-y-3">
            <legend className="text-xs font-medium text-muted-foreground px-1">Client Identification</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2">
                <Label htmlFor="nc-legal-name" className="text-xs">Legal Name <span className="text-destructive">*</span></Label>
                <Input
                  id="nc-legal-name"
                  data-testid="input-nc-legal-name"
                  placeholder="e.g., ABC Private Limited"
                  value={newClientForm.clientLegalName}
                  onChange={(e) => setNewClientForm({ ...newClientForm, clientLegalName: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="nc-trade-name" className="text-xs">Trade Name</Label>
                <Input
                  id="nc-trade-name"
                  data-testid="input-nc-trade-name"
                  value={newClientForm.tradeName}
                  onChange={(e) => setNewClientForm({ ...newClientForm, tradeName: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-ntn" className="text-xs">NTN</Label>
                <Input
                  id="nc-ntn"
                  data-testid="input-nc-ntn"
                  placeholder="7 digits"
                  value={newClientForm.ntn}
                  onChange={(e) => setNewClientForm({ ...newClientForm, ntn: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-secp" className="text-xs">SECP No.</Label>
                <Input
                  id="nc-secp"
                  data-testid="input-nc-secp"
                  value={newClientForm.secpNo}
                  onChange={(e) => setNewClientForm({ ...newClientForm, secpNo: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-incorp-date" className="text-xs">Incorporation Date</Label>
                <Input
                  id="nc-incorp-date"
                  data-testid="input-nc-incorp-date"
                  type="date"
                  value={newClientForm.dateOfIncorporation}
                  onChange={(e) => setNewClientForm({ ...newClientForm, dateOfIncorporation: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-city" className="text-xs">City</Label>
                <Select value={newClientForm.city} onValueChange={(v) => setNewClientForm({ ...newClientForm, city: v })}>
                  <SelectTrigger id="nc-city" data-testid="select-nc-city" className="h-8 text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAKISTAN_CITIES.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2 md:col-span-4">
                <Label htmlFor="nc-address" className="text-xs">Registered Address</Label>
                <Textarea
                  id="nc-address"
                  data-testid="input-nc-address"
                  value={newClientForm.registeredAddress}
                  onChange={(e) => setNewClientForm({ ...newClientForm, registeredAddress: e.target.value })}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-email" className="text-xs">Email</Label>
                <Input
                  id="nc-email"
                  data-testid="input-nc-email"
                  type="email"
                  value={newClientForm.contactEmail}
                  onChange={(e) => setNewClientForm({ ...newClientForm, contactEmail: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-phone" className="text-xs">Phone</Label>
                <Input
                  id="nc-phone"
                  data-testid="input-nc-phone"
                  value={newClientForm.contactPhone}
                  onChange={(e) => setNewClientForm({ ...newClientForm, contactPhone: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-country" className="text-xs">Country</Label>
                <Select value={newClientForm.country} onValueChange={(v) => setNewClientForm({ ...newClientForm, country: v })}>
                  <SelectTrigger id="nc-country" data-testid="select-nc-country" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pakistan">Pakistan</SelectItem>
                    <SelectItem value="UAE">UAE</SelectItem>
                    <SelectItem value="Saudi Arabia">Saudi Arabia</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewClientOpen(false)} data-testid="button-cancel-new-client">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleNewClientSubmit}
              disabled={newClientLoading || !newClientForm.clientLegalName.trim()}
              data-testid="button-save-new-client"
            >
              {newClientLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
