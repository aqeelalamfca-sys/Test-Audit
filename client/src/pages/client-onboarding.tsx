import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Building2,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Bot,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  PAKISTAN_CITIES,
  COUNTRIES,
  ENTITY_TYPES,
  INDUSTRY_SECTORS,
  SIZE_CLASSIFICATIONS,
  OWNERSHIP_TYPES,
  REGULATORY_CATEGORIES,
  SPECIAL_ENTITY_TYPES,
  TAX_PROFILES,
  LIFECYCLE_STATUSES,
  REPORTING_FRAMEWORKS,
} from "@/lib/form-constants";

interface ContactPerson {
  name: string;
  designation: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

interface ClientFormData {
  clientLegalName: string;
  tradeName: string;
  ntn: string;
  secpNo: string;
  dateOfIncorporation: string;
  registeredAddress: string;
  city: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
  companyType: string;
  sizeClassification: string;
  ownershipType: string;
  industrySector: string;
  specialEntityType: string;
  lifecycleStatus: string;
  regulatoryCategories: string[];
  taxProfiles: string[];
  reportingFramework: string;
  fiscalYearEnd: string;
  parentCompany: string;
  subsidiaries: string;
  contactPersons: ContactPerson[];
  portalAccessEnabled: boolean;
  portalContactFirstName: string;
  portalContactLastName: string;
  portalContactEmail: string;
  portalContactDesignation: string;
  portalContactPassword: string;
}

const emptyContact: ContactPerson = { name: "", designation: "", email: "", phone: "", isPrimary: false };

const initialFormData: ClientFormData = {
  clientLegalName: "",
  tradeName: "",
  ntn: "",
  secpNo: "",
  dateOfIncorporation: "",
  registeredAddress: "",
  city: "",
  country: "Pakistan",
  contactEmail: "",
  contactPhone: "",
  companyType: "",
  sizeClassification: "",
  ownershipType: "",
  industrySector: "",
  specialEntityType: "",
  lifecycleStatus: "",
  regulatoryCategories: [],
  taxProfiles: [],
  reportingFramework: "IFRS",
  fiscalYearEnd: "",
  parentCompany: "",
  subsidiaries: "",
  contactPersons: [],
  portalAccessEnabled: false,
  portalContactFirstName: "",
  portalContactLastName: "",
  portalContactEmail: "",
  portalContactDesignation: "",
  portalContactPassword: "",
};

const REQUIRED_FIELDS: { key: keyof ClientFormData; label: string }[] = [
  { key: "clientLegalName", label: "Legal Name" },
  { key: "companyType", label: "Entity Type" },
  { key: "industrySector", label: "Industry Sector" },
  { key: "city", label: "City" },
  { key: "reportingFramework", label: "Reporting Framework" },
  { key: "fiscalYearEnd", label: "Fiscal Year-End" },
];

function computeCompleteness(data: ClientFormData): { pct: number; filled: string[]; missing: string[] } {
  const filled: string[] = [];
  const missing: string[] = [];
  for (const f of REQUIRED_FIELDS) {
    const val = data[f.key];
    if (val && (typeof val === "string" ? val.trim() : true)) {
      filled.push(f.label);
    } else {
      missing.push(f.label);
    }
  }
  const pct = Math.round((filled.length / REQUIRED_FIELDS.length) * 100);
  return { pct, filled, missing };
}

export default function ClientOnboarding() {
  const [, navigate] = useLocation();
  const params = useParams();
  const clientId = params.id;
  const isEditMode = !!clientId;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [fetchingClient, setFetchingClient] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({ ...initialFormData });
  const [savedClientId, setSavedClientId] = useState<string | null>(clientId || null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineRef = useRef<string>("");

  const completeness = useMemo(() => computeCompleteness(formData), [formData]);

  useEffect(() => {
    if (isEditMode && clientId) {
      setFetchingClient(true);
      apiRequest("GET", `/api/clients/${clientId}`)
        .then(async (response) => {
          if (response.ok) {
            const client = await response.json();
            const loaded: ClientFormData = {
              clientLegalName: client.name || "",
              tradeName: client.tradingName || "",
              ntn: client.ntn || "",
              secpNo: client.secpNo || "",
              dateOfIncorporation: client.dateOfIncorporation ? client.dateOfIncorporation.slice(0, 10) : "",
              registeredAddress: client.address || "",
              city: client.city || "",
              country: client.country || "Pakistan",
              contactEmail: client.email || "",
              contactPhone: client.phone || "",
              companyType: client.entityType || "",
              sizeClassification: client.sizeClassification || "",
              ownershipType: client.ownershipStructure || "",
              industrySector: client.industry || "",
              specialEntityType: client.specialEntityType || "",
              lifecycleStatus: client.lifecycleStatus || "",
              regulatoryCategories: client.regulatoryCategory ? client.regulatoryCategory.split(",").filter(Boolean) : [],
              taxProfiles: client.taxProfile ? client.taxProfile.split(",").filter(Boolean) : [],
              reportingFramework: client.reportingFramework || "IFRS",
              fiscalYearEnd: client.fiscalYearEndDate ? client.fiscalYearEndDate.slice(0, 10) : "",
              parentCompany: client.parentCompany || "",
              subsidiaries: Array.isArray(client.subsidiaries) ? client.subsidiaries.join(", ") : client.subsidiaries || "",
              contactPersons: Array.isArray(client.contactPersons) ? client.contactPersons : [],
              portalAccessEnabled: false,
              portalContactFirstName: "",
              portalContactLastName: "",
              portalContactEmail: "",
              portalContactDesignation: "",
              portalContactPassword: "",
            };
            setFormData(loaded);
            setSavedClientId(clientId);
            baselineRef.current = JSON.stringify(loaded);
          } else {
            toast({ title: "Error", description: "Failed to load client data", variant: "destructive" });
            navigate("/clients");
          }
        })
        .catch(() => {
          toast({ title: "Error", description: "Failed to load client data", variant: "destructive" });
          navigate("/clients");
        })
        .finally(() => setFetchingClient(false));
    }
  }, [isEditMode, clientId]);

  const buildPayload = useCallback((data: ClientFormData) => ({
    name: data.clientLegalName,
    tradingName: data.tradeName || "",
    ntn: data.ntn,
    secpNo: data.secpNo || "",
    dateOfIncorporation: data.dateOfIncorporation || undefined,
    address: data.registeredAddress,
    city: data.city,
    country: data.country,
    email: data.contactEmail || "",
    phone: data.contactPhone || "",
    entityType: data.companyType,
    regulatoryCategory: data.regulatoryCategories.join(","),
    sizeClassification: data.sizeClassification,
    ownershipStructure: data.ownershipType,
    industry: data.industrySector,
    specialEntityType: data.specialEntityType,
    taxProfile: data.taxProfiles.join(","),
    lifecycleStatus: data.lifecycleStatus,
    reportingFramework: data.reportingFramework || undefined,
    fiscalYearEndDate: data.fiscalYearEnd || undefined,
    parentCompany: data.parentCompany || undefined,
    subsidiaries: data.subsidiaries ? data.subsidiaries.split(",").map(s => s.trim()).filter(Boolean) : [],
    contactPersons: data.contactPersons.length > 0 ? data.contactPersons : undefined,
    portalContact: data.portalAccessEnabled ? {
      firstName: data.portalContactFirstName,
      lastName: data.portalContactLastName,
      email: data.portalContactEmail,
      designation: data.portalContactDesignation || undefined,
      password: data.portalContactPassword,
    } : undefined,
  }), []);

  const doAutoSave = useCallback(async (data: ClientFormData) => {
    if (!savedClientId) return;
    const currentJson = JSON.stringify(data);
    if (currentJson === baselineRef.current) return;

    setAutoSaving(true);
    try {
      const payload = buildPayload(data);
      const res = await fetchWithAuth(`/api/clients/${savedClientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        baselineRef.current = currentJson;
        setLastSaved(new Date());
        qc.invalidateQueries({ queryKey: ["/api/clients"] });
      }
    } catch {
    } finally {
      setAutoSaving(false);
    }
  }, [savedClientId, buildPayload, qc]);

  const updateField = useCallback((updates: Partial<ClientFormData>) => {
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (savedClientId) {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => doAutoSave(next), 1500);
      }
      return next;
    });
  }, [savedClientId, doAutoSave]);

  const handleMultiSelectChange = useCallback((field: "regulatoryCategories" | "taxProfiles", value: string, checked: boolean) => {
    setFormData(prev => {
      const currentValues = prev[field];
      const next = { ...prev, [field]: checked ? [...currentValues, value] : currentValues.filter(v => v !== value) };
      if (savedClientId) {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => doAutoSave(next), 1500);
      }
      return next;
    });
  }, [savedClientId, doAutoSave]);

  const addContactPerson = useCallback(() => {
    updateField({ contactPersons: [...formData.contactPersons, { ...emptyContact }] });
  }, [formData.contactPersons, updateField]);

  const removeContactPerson = useCallback((index: number) => {
    updateField({ contactPersons: formData.contactPersons.filter((_, i) => i !== index) });
  }, [formData.contactPersons, updateField]);

  const updateContactPerson = useCallback((index: number, updates: Partial<ContactPerson>) => {
    const updated = formData.contactPersons.map((c, i) => i === index ? { ...c, ...updates } : c);
    updateField({ contactPersons: updated });
  }, [formData.contactPersons, updateField]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientLegalName || !formData.companyType || !formData.industrySector) {
      toast({ title: "Validation Error", description: "Please fill required fields: Legal Name, Entity Type, and Industry", variant: "destructive" });
      return;
    }

    if (formData.portalAccessEnabled) {
      if (!formData.portalContactFirstName || !formData.portalContactLastName ||
          !formData.portalContactEmail || !formData.portalContactPassword) {
        toast({ title: "Portal Access Error", description: "Please fill all portal contact fields when enabling portal access", variant: "destructive" });
        return;
      }
      if (formData.portalContactPassword.length < 6) {
        toast({ title: "Portal Access Error", description: "Portal password must be at least 6 characters", variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const payload = buildPayload(formData);
      const url = savedClientId ? `/api/clients/${savedClientId}` : "/api/clients";
      const method = savedClientId ? "PATCH" : "POST";

      const response = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        if (!savedClientId) {
          setSavedClientId(result.id);
        }
        baselineRef.current = JSON.stringify(formData);
        setLastSaved(new Date());
        qc.invalidateQueries({ queryKey: ["/api/clients"] });
        globalQueryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        toast({ title: "Success", description: savedClientId ? "Client updated successfully" : "Client created successfully" });
        navigate("/clients");
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || `Failed to ${savedClientId ? "update" : "create"} client`;
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: `Failed to ${savedClientId ? "update" : "create"} client`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientLegalName) {
      toast({ title: "Validation Error", description: "Legal Name is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = buildPayload(formData);
      const url = savedClientId ? `/api/clients/${savedClientId}` : "/api/clients";
      const method = savedClientId ? "PATCH" : "POST";
      const response = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        const cId = savedClientId || result.id;
        setSavedClientId(cId);
        baselineRef.current = JSON.stringify(formData);
        qc.invalidateQueries({ queryKey: ["/api/clients"] });
        globalQueryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        toast({ title: "Client Saved", description: "Proceeding to create engagement..." });
        navigate(`/engagements/new?clientId=${cId}`);
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: errorData.error || "Failed to save client", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save client", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateAiSummary = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetchWithAuth("/api/ai/phase/client-creation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capabilityId: "client-summary-draft",
          additionalContext: {
            clientName: formData.clientLegalName,
            entityType: formData.companyType,
            industry: formData.industrySector,
            city: formData.city,
            ownership: formData.ownershipType,
            reportingFramework: formData.reportingFramework,
            size: formData.sizeClassification,
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
  }, [formData]);

  if (fetchingClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading client data...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Clients
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumbs items={[
            { label: "Dashboard", href: "/" },
            { label: "Clients", href: "/clients" },
            { label: isEditMode ? "Edit Client" : "New Client" },
          ]} />
        </div>
        <div className="flex items-center gap-2">
          {autoSaving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving...</span>}
          {lastSaved && !autoSaving && <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Saved {lastSaved.toLocaleTimeString()}</span>}
          <Button variant={showAiPanel ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setShowAiPanel(!showAiPanel)}>
            <Bot className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto p-4 space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">{isEditMode ? "Edit Client" : "Client Creation"}</h1>
              <p className="text-xs text-muted-foreground">Phase 1 of 19 — Register client with KYC and classification data</p>
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
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Missing required: {completeness.missing.join(", ")}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Client Profile</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Legal Name <span className="text-destructive">*</span></Label>
                    <Input value={formData.clientLegalName} onChange={(e) => updateField({ clientLegalName: e.target.value })} placeholder="e.g., ABC Private Limited" required />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Trade Name</Label>
                    <Input value={formData.tradeName} onChange={(e) => updateField({ tradeName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NTN</Label>
                    <Input value={formData.ntn} onChange={(e) => updateField({ ntn: e.target.value })} placeholder="7 digits" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SECP No.</Label>
                    <Input value={formData.secpNo} onChange={(e) => updateField({ secpNo: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Incorporation Date</Label>
                    <Input type="date" value={formData.dateOfIncorporation} onChange={(e) => updateField({ dateOfIncorporation: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Entity Type <span className="text-destructive">*</span></Label>
                    <Select value={formData.companyType} onValueChange={(v) => updateField({ companyType: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2 md:col-span-4">
                    <Label className="text-xs">Registered Address</Label>
                    <Textarea value={formData.registeredAddress} onChange={(e) => updateField({ registeredAddress: e.target.value })} rows={2} className="resize-none text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">City <span className="text-destructive">*</span></Label>
                    <Select value={formData.city} onValueChange={(v) => updateField({ city: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {PAKISTAN_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Country</Label>
                    <Select value={formData.country} onValueChange={(v) => updateField({ country: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={formData.contactEmail} onChange={(e) => updateField({ contactEmail: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input value={formData.contactPhone} onChange={(e) => updateField({ contactPhone: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Industry & Classification</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Industry <span className="text-destructive">*</span></Label>
                    <Select value={formData.industrySector} onValueChange={(v) => updateField({ industrySector: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {INDUSTRY_SECTORS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Size</Label>
                    <Select value={formData.sizeClassification} onValueChange={(v) => updateField({ sizeClassification: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {SIZE_CLASSIFICATIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ownership</Label>
                    <Select value={formData.ownershipType} onValueChange={(v) => updateField({ ownershipType: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {OWNERSHIP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lifecycle Status</Label>
                    <Select value={formData.lifecycleStatus} onValueChange={(v) => updateField({ lifecycleStatus: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {LIFECYCLE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Special Entity</Label>
                    <Select value={formData.specialEntityType} onValueChange={(v) => updateField({ specialEntityType: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {SPECIAL_ENTITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Reporting & Financial Year</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Reporting Framework <span className="text-destructive">*</span></Label>
                    <Select value={formData.reportingFramework} onValueChange={(v) => updateField({ reportingFramework: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {REPORTING_FRAMEWORKS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fiscal Year-End <span className="text-destructive">*</span></Label>
                    <Input type="date" value={formData.fiscalYearEnd} onChange={(e) => updateField({ fiscalYearEnd: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Group / Component Relationship</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Parent Company</Label>
                    <Input value={formData.parentCompany} onChange={(e) => updateField({ parentCompany: e.target.value })} placeholder="Leave blank if standalone" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subsidiaries / Components</Label>
                    <Input value={formData.subsidiaries} onChange={(e) => updateField({ subsidiaries: e.target.value })} placeholder="Comma-separated names" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Contact Persons</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addContactPerson} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add Contact
                  </Button>
                </div>
                {formData.contactPersons.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No contact persons added. Click "Add Contact" to add one.</p>
                )}
                {formData.contactPersons.map((cp, idx) => (
                  <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end border-b pb-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input value={cp.name} onChange={(e) => updateContactPerson(idx, { name: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Designation</Label>
                      <Input value={cp.designation} onChange={(e) => updateContactPerson(idx, { designation: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={cp.email} onChange={(e) => updateContactPerson(idx, { email: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone</Label>
                      <Input value={cp.phone} onChange={(e) => updateContactPerson(idx, { phone: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Checkbox checked={cp.isPrimary} onCheckedChange={(c) => updateContactPerson(idx, { isPrimary: !!c })} />
                        <Label className="text-xs">Primary</Label>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeContactPerson(idx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Regulatory & Tax (Optional)</h3>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Regulatory Categories</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {REGULATORY_CATEGORIES.map(cat => (
                      <div key={cat.value} className="flex items-center space-x-1.5">
                        <Checkbox
                          checked={formData.regulatoryCategories.includes(cat.value)}
                          onCheckedChange={(checked) => handleMultiSelectChange("regulatoryCategories", cat.value, !!checked)}
                          className="h-3.5 w-3.5"
                        />
                        <Label className="text-xs font-normal cursor-pointer">{cat.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Tax Profile</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {TAX_PROFILES.map(p => (
                      <div key={p.value} className="flex items-center space-x-1.5">
                        <Checkbox
                          checked={formData.taxProfiles.includes(p.value)}
                          onCheckedChange={(checked) => handleMultiSelectChange("taxProfiles", p.value, !!checked)}
                          className="h-3.5 w-3.5"
                        />
                        <Label className="text-xs font-normal cursor-pointer">{p.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Client Portal Access</h3>
                    <p className="text-xs text-muted-foreground">Allow client login for document submission</p>
                  </div>
                  <Switch checked={formData.portalAccessEnabled} onCheckedChange={(c) => updateField({ portalAccessEnabled: c })} />
                </div>
                {formData.portalAccessEnabled && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t">
                    <div className="space-y-1">
                      <Label className="text-xs">First Name *</Label>
                      <Input value={formData.portalContactFirstName} onChange={(e) => updateField({ portalContactFirstName: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name *</Label>
                      <Input value={formData.portalContactLastName} onChange={(e) => updateField({ portalContactLastName: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Designation</Label>
                      <Input value={formData.portalContactDesignation} onChange={(e) => updateField({ portalContactDesignation: e.target.value })} />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Portal Email *</Label>
                      <Input type="email" value={formData.portalContactEmail} onChange={(e) => updateField({ portalContactEmail: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Password *</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={formData.portalContactPassword}
                          onChange={(e) => updateField({ portalContactPassword: e.target.value })}
                          placeholder="Min 6 characters"
                          className="pr-8"
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-8" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-4 pt-2 pb-4">
              <Button type="button" variant="outline" size="sm" onClick={() => navigate("/clients")}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={loading}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {loading ? "Saving..." : isEditMode ? "Update Client" : "Save Client"}
                </Button>
                {!isEditMode && (
                  <Button type="button" size="sm" variant="default" disabled={loading} onClick={handleSaveAndContinue}>
                    Save & Create Engagement
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                )}
              </div>
            </div>
          </form>
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
                Generate Client Summary
              </Button>
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                if (completeness.missing.length > 0) {
                  setAiSummary(`Missing mandatory fields:\n${completeness.missing.map(m => `• ${m}`).join("\n")}\n\nPlease complete these before proceeding to Engagement Setup.`);
                } else {
                  setAiSummary("All mandatory fields are complete. You can proceed to Engagement Setup.");
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
