import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Users, 
  Shield, 
  FileText, 
  Flag, 
  History, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Save,
  RefreshCw,
  Server,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Landmark,
  Plus,
  Trash2,
  MapPin,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatAccounting } from '@/lib/formatters';

interface FirmSettings {
  id: string;
  firmId: string;
  enforceRBAC: boolean;
  allowRoleOverrides: boolean;
  maxOverrideDurationDays: number;
  requireOverrideApproval: boolean;
  makerCheckerMode: string;
  makerCheckerEntities: string[];
  allowSelfApproval: boolean;
  requireDifferentApprovers: boolean;
  defaultQRRequired: boolean;
  defaultEQCRRequired: boolean;
  eqcrThresholdAssets: number | null;
  eqcrThresholdRevenue: number | null;
  eqcrRequiredForPIE: boolean;
  eqcrRequiredForHighRisk: boolean;
  requireDigitalSignatures: boolean;
  signOffExpiryDays: number;
  requirePartnerPIN: boolean;
  pinExpiryMinutes: number;
  aiEnabled: boolean;
  aiRequiresHumanApproval: boolean;
  aiOutputLabel: string;
  logAllAIInteractions: boolean;
  immutableAuditTrail: boolean;
  logFieldChanges: boolean;
  captureIPAddress: boolean;
  captureDeviceInfo: boolean;
  version: number;
}

interface RoleConfiguration {
  id: string;
  role: string;
  displayName: string;
  description: string;
  hierarchyLevel: number;
  canApproveOwnWork: boolean;
  canOverrideControls: boolean;
  requiresPartnerPIN: boolean;
  accessiblePhases: string[];
  signOffCategories: string[];
  makerCheckerPosition: string;
  canActAsReviewer: boolean;
  canActAsApprover: boolean;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityName: string;
  changedFields: string[];
  timestamp: string;
  user: { fullName: string; role: string };
}

interface ClientAuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  field: string | null;
  beforeValue: any;
  afterValue: any;
  reason: string | null;
  isaReference: string | null;
  module: string | null;
  screen: string | null;
  createdAt: string;
  user: { fullName: string; email: string; role: string };
  engagement: { engagementCode: string; client: { name: string } } | null;
}

interface ClientAuditLogResponse {
  logs: ClientAuditLogEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface ClientInfo {
  id: string;
  name: string;
}

interface DocumentTemplate {
  id: string;
  templateCode: string;
  templateName: string;
  templateCategory: string;
  description: string | null;
  isaReferences: string[];
  applicablePhases: string[];
  isRequired: boolean;
  isActive: boolean;
  version: number;
}

const TEMPLATE_CATEGORIES = [
  { value: "PRE_ENGAGEMENT", label: "Pre-Engagement" },
  { value: "REQUISITION", label: "Requisition & Confirmations" },
  { value: "PLANNING", label: "Planning" },
  { value: "EXECUTION", label: "Execution" },
  { value: "WORKING_PAPER_BS", label: "Working Papers - Balance Sheet" },
  { value: "WORKING_PAPER_PL", label: "Working Papers - Profit & Loss" },
  { value: "FINALIZATION", label: "Finalization" },
  { value: "REPORTING", label: "Reporting" },
  { value: "QUALITY_REVIEW", label: "Quality Review (EQCR)" },
  { value: "ISQM", label: "ISQM / Firm Quality" },
  { value: "DOCUMENTATION", label: "Documentation & Indexing" },
];

interface FirmProfile {
  id: string;
  name: string;
  displayName: string | null;
  licenseNo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  establishmentDate: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  regulatoryBody: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  headOfficeAddress: string | null;
  logoUrl: string | null;
  numberOfPartners: number | null;
  partners: PartnerEntry[] | null;
  offices: OfficeEntry[] | null;
}

interface PartnerEntry {
  name: string;
  designation: string;
  experience: string;
  discipline: string;
  qualifications: string;
}

interface OfficeEntry {
  name: string;
  address: string;
  city: string;
  phone: string;
  isHeadOffice: boolean;
}

function FirmLogoUpload({ currentLogoUrl, onLogoChange }: { currentLogoUrl: string | null; onLogoChange: (url: string | null) => void }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Accepted: SVG, PNG, JPG, JPEG, WEBP", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetchWithAuth("/api/admin/firm-logo", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setPreview(data.logoUrl);
      onLogoChange(data.logoUrl);
      toast({ title: "Logo uploaded", description: "Firm logo has been updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      const res = await fetchWithAuth("/api/admin/firm-logo/delete", { method: "POST" });
      if (res.ok) {
        setPreview(null);
        onLogoChange(null);
        toast({ title: "Logo removed" });
      }
    } catch {
      toast({ title: "Failed to remove logo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {preview ? (
        <div className="relative border rounded-lg p-2 bg-white dark:bg-gray-900 flex items-center justify-center" style={{ minWidth: 120, minHeight: 50 }}>
          <img src={preview} alt="Firm logo" className="max-h-[50px] w-auto object-contain" data-testid="img-firm-logo-admin" />
          <button type="button" onClick={handleRemove} disabled={uploading} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5" data-testid="button-remove-firm-logo">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className={`flex items-center gap-2 border border-dashed rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground ${uploading ? "opacity-50 pointer-events-none" : ""}`} data-testid="label-upload-firm-logo">
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload logo"}
          <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleFileSelect} data-testid="input-firm-logo-file" />
        </label>
      )}
      <p className="text-[11px] text-muted-foreground">Max 600x200px. Auto-optimized to PNG.</p>
    </div>
  );
}

function FirmSettingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<FirmProfile>({
    queryKey: ["firm-profile"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/firm-profile");
      if (!res.ok) throw new Error("Failed to fetch firm profile");
      return res.json();
    }
  });

  const [form, setForm] = useState<Partial<FirmProfile>>({});
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [offices, setOffices] = useState<OfficeEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (profile && !initialized) {
    setForm({
      name: profile.name || "",
      displayName: profile.displayName || "",
      licenseNo: profile.licenseNo || "",
      address: profile.address || "",
      phone: profile.phone || "",
      email: profile.email || "",
      establishmentDate: profile.establishmentDate ? profile.establishmentDate.split("T")[0] : "",
      registrationNumber: profile.registrationNumber || "",
      taxId: profile.taxId || "",
      regulatoryBody: profile.regulatoryBody || "",
      website: profile.website || "",
      country: profile.country || "",
      city: profile.city || "",
      headOfficeAddress: profile.headOfficeAddress || "",
      logoUrl: profile.logoUrl || "",
      numberOfPartners: profile.numberOfPartners || 0,
    });
    setPartners(Array.isArray(profile.partners) ? profile.partners : []);
    setOffices(Array.isArray(profile.offices) ? profile.offices : []);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetchWithAuth("/api/admin/firm-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update firm profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firm-profile"] });
      toast({ title: "Saved", description: "Firm profile has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save firm profile", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      numberOfPartners: partners.length || form.numberOfPartners,
      partners,
      offices,
    });
  };

  const addPartner = () => setPartners([...partners, { name: "", designation: "", experience: "", discipline: "", qualifications: "" }]);
  const removePartner = (i: number) => setPartners(partners.filter((_, idx) => idx !== i));
  const updatePartner = (i: number, field: keyof PartnerEntry, value: string) => {
    const updated = [...partners];
    updated[i] = { ...updated[i], [field]: value };
    setPartners(updated);
  };

  const addOffice = () => setOffices([...offices, { name: "", address: "", city: "", phone: "", isHeadOffice: false }]);
  const removeOffice = (i: number) => setOffices(offices.filter((_, idx) => idx !== i));
  const updateOffice = (i: number, field: keyof OfficeEntry, value: any) => {
    const updated = [...offices];
    updated[i] = { ...updated[i], [field]: value };
    setOffices(updated);
  };

  if (isLoading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Loading firm profile...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Firm Profile</h3>
          <p className="text-sm text-muted-foreground">Core firm information shown on all printed and downloaded documents</p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="btn-save-firm-profile">
          <Save className="h-4 w-4 mr-1.5" />
          {saveMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Firm identity and registration details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Firm Legal Name <span className="text-red-500">*</span></Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-firm-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input value={form.displayName || ""} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Short name for display" data-testid="input-display-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Establishment Date</Label>
              <Input type="date" value={form.establishmentDate || ""} onChange={(e) => setForm({ ...form, establishmentDate: e.target.value })} data-testid="input-establishment-date" />
            </div>
            <div className="space-y-1.5">
              <Label>License / Practice Number</Label>
              <Input value={form.licenseNo || ""} onChange={(e) => setForm({ ...form, licenseNo: e.target.value })} placeholder="e.g., AF-12345" data-testid="input-license-no" />
            </div>
            <div className="space-y-1.5">
              <Label>Registration Number</Label>
              <Input value={form.registrationNumber || ""} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="Company/firm registration" data-testid="input-registration-no" />
            </div>
            <div className="space-y-1.5">
              <Label>Tax ID / NTN</Label>
              <Input value={form.taxId || ""} onChange={(e) => setForm({ ...form, taxId: e.target.value })} placeholder="e.g., 1234567-8" data-testid="input-tax-id" />
            </div>
            <div className="space-y-1.5">
              <Label>Regulatory Body</Label>
              <Input value={form.regulatoryBody || ""} onChange={(e) => setForm({ ...form, regulatoryBody: e.target.value })} placeholder="e.g., ICAP, ICAEW, AICPA" data-testid="input-regulatory-body" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Communication and web details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="firm@example.com" data-testid="input-firm-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92-21-1234567" data-testid="input-firm-phone" />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://www.yourfirm.com" data-testid="input-firm-website" />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Pakistan" data-testid="input-firm-country" />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Karachi" data-testid="input-firm-city" />
            </div>
            <div className="space-y-1.5">
              <Label>Firm Logo</Label>
              <FirmLogoUpload currentLogoUrl={form.logoUrl || profile?.logoUrl || null} onLogoChange={(url) => setForm({ ...form, logoUrl: url })} />
            </div>
            <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
              <Label>Head Office Address</Label>
              <Textarea value={form.headOfficeAddress || ""} onChange={(e) => setForm({ ...form, headOfficeAddress: e.target.value })} rows={2} placeholder="Full head office address" data-testid="input-head-office-address" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Partners</CardTitle>
              <CardDescription>Partners / principals of the firm ({partners.length} listed)</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addPartner} data-testid="btn-add-partner">
              <Plus className="h-4 w-4 mr-1" /> Add Partner
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No partners added yet. Click "Add Partner" to begin.
            </div>
          ) : (
            <div className="space-y-3">
              {partners.map((p, i) => (
                <div key={i} className="border rounded-lg p-3" data-testid={`partner-row-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Partner {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removePartner(i)} data-testid={`btn-remove-partner-${i}`}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Full Name</Label>
                      <Input value={p.name} onChange={(e) => updatePartner(i, "name", e.target.value)} placeholder="e.g., Ahmed Khan" data-testid={`input-partner-name-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Designation</Label>
                      <Input value={p.designation} onChange={(e) => updatePartner(i, "designation", e.target.value)} placeholder="e.g., Senior Partner" data-testid={`input-partner-designation-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Experience (years)</Label>
                      <Input value={p.experience} onChange={(e) => updatePartner(i, "experience", e.target.value)} placeholder="e.g., 20 years" data-testid={`input-partner-experience-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discipline / Specialization</Label>
                      <Input value={p.discipline} onChange={(e) => updatePartner(i, "discipline", e.target.value)} placeholder="e.g., Audit & Assurance" data-testid={`input-partner-discipline-${i}`} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">Qualifications</Label>
                      <Input value={p.qualifications} onChange={(e) => updatePartner(i, "qualifications", e.target.value)} placeholder="e.g., FCA, FCMA, CPA" data-testid={`input-partner-qualifications-${i}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Offices</CardTitle>
              <CardDescription>Branch offices and locations ({offices.length} listed)</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addOffice} data-testid="btn-add-office">
              <Plus className="h-4 w-4 mr-1" /> Add Office
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {offices.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No offices added yet. Click "Add Office" to begin.
            </div>
          ) : (
            <div className="space-y-3">
              {offices.map((o, i) => (
                <div key={i} className={`border rounded-lg p-3 ${o.isHeadOffice ? "border-primary/50 bg-primary/5" : ""}`} data-testid={`office-row-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Office {i + 1}</span>
                      {o.isHeadOffice && <Badge className="text-xs">Head Office</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeOffice(i)} data-testid={`btn-remove-office-${i}`}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Office Name</Label>
                      <Input value={o.name} onChange={(e) => updateOffice(i, "name", e.target.value)} placeholder="e.g., Main Branch" data-testid={`input-office-name-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">City</Label>
                      <Input value={o.city} onChange={(e) => updateOffice(i, "city", e.target.value)} placeholder="e.g., Karachi" data-testid={`input-office-city-${i}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone</Label>
                      <Input value={o.phone} onChange={(e) => updateOffice(i, "phone", e.target.value)} placeholder="+92-21-..." data-testid={`input-office-phone-${i}`} />
                    </div>
                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Switch checked={o.isHeadOffice} onCheckedChange={(v) => updateOffice(i, "isHeadOffice", v)} data-testid={`switch-head-office-${i}`} />
                        <Label className="text-xs">Head Office</Label>
                      </div>
                    </div>
                    <div className="space-y-1 md:col-span-2 lg:col-span-4">
                      <Label className="text-xs">Full Address</Label>
                      <Input value={o.address} onChange={(e) => updateOffice(i, "address", e.target.value)} placeholder="Complete office address" data-testid={`input-office-address-${i}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLogTab() {
  const [logType, setLogType] = useState<"system" | "client">("system");
  const [clientPage, setClientPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<string>("");

  const { data: systemLogs } = useQuery<AuditLogEntry[]>({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/admin-audit-log?limit=100");
      if (!res.ok) throw new Error("Failed to fetch system audit log");
      return res.json();
    }
  });

  const { data: clients } = useQuery<ClientInfo[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    }
  });

  const clientLogParams = new URLSearchParams({
    page: clientPage.toString(),
    limit: "50",
  });
  if (selectedClient) clientLogParams.set("clientId", selectedClient);

  const { data: clientLogs, isLoading: clientLogsLoading } = useQuery<ClientAuditLogResponse>({
    queryKey: ["client-audit-logs", clientPage, selectedClient],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/admin/audit-logs?${clientLogParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch client audit logs");
      return res.json();
    }
  });

  const getActionColor = (action: string) => {
    if (action === "CREATE" || action === "create") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (action === "UPDATE" || action === "update") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    if (action === "DELETE" || action === "delete") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (action === "APPROVE" || action === "approve") return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    if (action === "SIGN_OFF" || action === "sign_off") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={logType === "system" ? "default" : "outline"}
          size="sm"
          onClick={() => setLogType("system")}
          data-testid="btn-system-log"
        >
          <Server className="h-4 w-4 mr-1.5" />
          System Log
        </Button>
        <Button
          variant={logType === "client" ? "default" : "outline"}
          size="sm"
          onClick={() => setLogType("client")}
          data-testid="btn-client-log"
        >
          <Building2 className="h-4 w-4 mr-1.5" />
          Client Log
        </Button>
      </div>

      {logType === "system" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Audit Log
            </CardTitle>
            <CardDescription>Immutable log of all administrative and system-level changes (ISA 230)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {systemLogs?.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`system-log-${entry.id}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={getActionColor(entry.action)}>{entry.action}</Badge>
                      <span className="font-medium text-sm">{entry.entityType}</span>
                      {entry.entityName && (
                        <span className="text-muted-foreground text-sm">- {entry.entityName}</span>
                      )}
                    </div>
                    {entry.changedFields && entry.changedFields.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Changed: {entry.changedFields.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm">{entry.user?.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {(!systemLogs || systemLogs.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No system audit log entries yet. Changes to administration settings, roles, and templates will appear here.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {logType === "client" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Client Audit Log
                </CardTitle>
                <CardDescription>Engagement-level audit trail of all client data changes (ISA 230)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v === "all" ? "" : v); setClientPage(1); }}>
                  <SelectTrigger className="w-[200px]" data-testid="select-client-filter">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {clientLogsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading client audit trail...</div>
            ) : (
              <div className="space-y-2">
                {clientLogs?.logs?.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between p-3 border rounded-lg gap-4" data-testid={`client-log-${entry.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getActionColor(entry.action)}>{entry.action}</Badge>
                        <span className="font-medium text-sm">{entry.entityType}</span>
                        {entry.field && (
                          <span className="text-xs text-muted-foreground">({entry.field})</span>
                        )}
                        {entry.isaReference && (
                          <Badge variant="secondary" className="text-xs">{entry.isaReference}</Badge>
                        )}
                      </div>
                      {entry.engagement && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">{entry.engagement.client?.name}</span>
                          {" "}&middot;{" "}
                          <span>{entry.engagement.engagementCode}</span>
                          {entry.module && (
                            <>
                              {" "}&middot;{" "}
                              <span>{entry.module}{entry.screen ? ` / ${entry.screen}` : ""}</span>
                            </>
                          )}
                        </div>
                      )}
                      {entry.reason && (
                        <div className="text-xs text-muted-foreground mt-0.5 italic">
                          Reason: {entry.reason}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm">{entry.user?.fullName}</div>
                      <div className="text-xs text-muted-foreground">{entry.user?.role}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                {(!clientLogs?.logs || clientLogs.logs.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedClient
                      ? "No audit trail entries for the selected client."
                      : "No client audit trail entries yet. All engagement-level changes will appear here."}
                  </div>
                )}
              </div>
            )}
            {clientLogs?.pagination && clientLogs.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {clientLogs.pagination.page} of {clientLogs.pagination.totalPages} ({clientLogs.pagination.total} entries)
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clientPage <= 1}
                    onClick={() => setClientPage(p => p - 1)}
                    data-testid="btn-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clientPage >= clientLogs.pagination.totalPages}
                    onClick={() => setClientPage(p => p + 1)}
                    data-testid="btn-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TemplatesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    templateCode: "",
    templateName: "",
    templateCategory: "PRE_ENGAGEMENT",
    description: "",
  });

  const { data: templates, isLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/document-templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (template: typeof newTemplate) => {
      const res = await fetchWithAuth("/api/admin/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast({ title: "Template Created", description: "Document template has been added" });
      setShowForm(false);
      setNewTemplate({ templateCode: "", templateName: "", templateCategory: "PRE_ENGAGEMENT", description: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    },
  });

  const grouped = (templates || []).reduce((acc, t) => {
    const cat = t.templateCategory || "OTHER";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, DocumentTemplate[]>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Templates</CardTitle>
              <CardDescription>Manage firm-wide document templates for audit engagements</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowForm(!showForm)} data-testid="button-add-template">
              {showForm ? "Cancel" : "+ Add Template"}
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent className="border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div className="space-y-2">
                <Label>Template Code</Label>
                <Input
                  placeholder="e.g., ENG-LTR-001"
                  value={newTemplate.templateCode}
                  onChange={(e) => setNewTemplate({ ...newTemplate, templateCode: e.target.value })}
                  data-testid="input-template-code"
                />
              </div>
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  placeholder="e.g., Standard Engagement Letter"
                  value={newTemplate.templateName}
                  onChange={(e) => setNewTemplate({ ...newTemplate, templateName: e.target.value })}
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newTemplate.templateCategory}
                  onValueChange={(v) => setNewTemplate({ ...newTemplate, templateCategory: v })}
                >
                  <SelectTrigger data-testid="select-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Brief description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  data-testid="input-template-description"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => createMutation.mutate(newTemplate)}
                disabled={!newTemplate.templateCode || !newTemplate.templateName || createMutation.isPending}
                data-testid="button-save-template"
              >
                {createMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading templates...</CardContent></Card>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No document templates configured yet. Click "+ Add Template" to create your first template.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, categoryTemplates]) => {
          const catLabel = TEMPLATE_CATEGORIES.find(c => c.value === category)?.label || category;
          return (
            <Card key={category}>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{catLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categoryTemplates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`template-${t.templateCode}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{t.templateName}</span>
                          <Badge variant="outline" className="text-xs">{t.templateCode}</Badge>
                          <Badge variant="outline" className="text-xs">v{t.version}</Badge>
                        </div>
                        {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                        {t.isaReferences.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {t.isaReferences.map((ref) => (
                              <Badge key={ref} variant="secondary" className="text-xs">{ref}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {t.isRequired && <Badge className="bg-amber-100 text-amber-700 text-xs">Required</Badge>}
                        <Badge className={t.isActive ? "bg-green-100 text-green-700 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>
                          {t.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

export default function Administration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("firm");
  const [unsavedChanges, setUnsavedChanges] = useState<Partial<FirmSettings>>({});

  const { data: settings, isLoading: settingsLoading } = useQuery<FirmSettings>({
    queryKey: ["firm-settings"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/firm-settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    }
  });

  const { data: roleConfigs } = useQuery<RoleConfiguration[]>({
    queryKey: ["role-configurations"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/role-configurations");
      if (!res.ok) throw new Error("Failed to fetch role configurations");
      return res.json();
    }
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/admin/users-summary");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<FirmSettings> & { changeReason?: string }) => {
      const res = await fetchWithAuth("/api/admin/firm-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firm-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] });
      setUnsavedChanges({});
      toast({ title: "Settings saved", description: "Firm settings have been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleSettingChange = (key: keyof FirmSettings, value: any) => {
    setUnsavedChanges(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    if (Object.keys(unsavedChanges).length === 0) return;
    updateSettingsMutation.mutate({
      ...unsavedChanges,
      changeReason: "Settings updated via Administration panel"
    });
  };

  const getCurrentValue = <K extends keyof FirmSettings>(key: K): FirmSettings[K] => {
    if (key in unsavedChanges) {
      return unsavedChanges[key] as FirmSettings[K];
    }
    return settings?.[key] as FirmSettings[K];
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Administration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure firm-wide controls, RBAC, and governance settings</p>
        </div>
        {Object.keys(unsavedChanges).length > 0 && (
          <Button onClick={saveSettings} disabled={updateSettingsMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7 bg-muted/50">
          <TabsTrigger value="firm" className="flex items-center gap-2" data-testid="tab-firm">
            <Landmark className="h-4 w-4" />
            Firm Setting
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="rbac" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            RBAC
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="flags" className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Flags
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="firm" className="space-y-4 mt-3">
          <FirmSettingTab />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader>
                <CardTitle>Maker-Checker Controls</CardTitle>
                <CardDescription>Configure approval workflow requirements (ISA 220)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Maker-Checker Mode</Label>
                  <Select 
                    value={getCurrentValue("makerCheckerMode") || "THREE_TIER"}
                    onValueChange={(v) => handleSettingChange("makerCheckerMode", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DISABLED">Disabled</SelectItem>
                      <SelectItem value="TWO_TIER">Two-Tier (Preparer → Reviewer)</SelectItem>
                      <SelectItem value="THREE_TIER">Three-Tier (Preparer → Reviewer → Partner)</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Allow Self-Approval</Label>
                  <Switch 
                    checked={getCurrentValue("allowSelfApproval") ?? false}
                    onCheckedChange={(v) => handleSettingChange("allowSelfApproval", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Different Approvers</Label>
                  <Switch 
                    checked={getCurrentValue("requireDifferentApprovers") ?? true}
                    onCheckedChange={(v) => handleSettingChange("requireDifferentApprovers", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sign-Off Requirements</CardTitle>
                <CardDescription>Digital signature and authentication settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Require Digital Signatures</Label>
                  <Switch 
                    checked={getCurrentValue("requireDigitalSignatures") ?? true}
                    onCheckedChange={(v) => handleSettingChange("requireDigitalSignatures", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Partner PIN</Label>
                  <Switch 
                    checked={getCurrentValue("requirePartnerPIN") ?? true}
                    onCheckedChange={(v) => handleSettingChange("requirePartnerPIN", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PIN Expiry (minutes)</Label>
                  <Input 
                    type="number" 
                    value={getCurrentValue("pinExpiryMinutes") ?? 15}
                    onChange={(e) => handleSettingChange("pinExpiryMinutes", parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QR/EQCR Requirements</CardTitle>
                <CardDescription>Quality review and EQCR trigger settings (ISQM 1)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Default QR Required</Label>
                  <Switch 
                    checked={getCurrentValue("defaultQRRequired") ?? true}
                    onCheckedChange={(v) => handleSettingChange("defaultQRRequired", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Default EQCR Required</Label>
                  <Switch 
                    checked={getCurrentValue("defaultEQCRRequired") ?? false}
                    onCheckedChange={(v) => handleSettingChange("defaultEQCRRequired", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>EQCR Required for PIE</Label>
                  <Switch 
                    checked={getCurrentValue("eqcrRequiredForPIE") ?? true}
                    onCheckedChange={(v) => handleSettingChange("eqcrRequiredForPIE", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>EQCR Required for High Risk</Label>
                  <Switch 
                    checked={getCurrentValue("eqcrRequiredForHighRisk") ?? true}
                    onCheckedChange={(v) => handleSettingChange("eqcrRequiredForHighRisk", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Governance</CardTitle>
                <CardDescription>AI output labeling and approval settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>AI Features Enabled</Label>
                  <Switch 
                    checked={getCurrentValue("aiEnabled") ?? true}
                    onCheckedChange={(v) => handleSettingChange("aiEnabled", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>AI Requires Human Approval</Label>
                  <Switch 
                    checked={getCurrentValue("aiRequiresHumanApproval") ?? true}
                    onCheckedChange={(v) => handleSettingChange("aiRequiresHumanApproval", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Log All AI Interactions</Label>
                  <Switch 
                    checked={getCurrentValue("logAllAIInteractions") ?? true}
                    onCheckedChange={(v) => handleSettingChange("logAllAIInteractions", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>AI Output Label</Label>
                  <Input 
                    value={getCurrentValue("aiOutputLabel") ?? "AI-Assisted – Subject to Professional Judgment"}
                    onChange={(e) => handleSettingChange("aiOutputLabel", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audit Trail Settings</CardTitle>
                <CardDescription>Immutable logging configuration (ISA 230)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Immutable Audit Trail</Label>
                  <Switch 
                    checked={getCurrentValue("immutableAuditTrail") ?? true}
                    onCheckedChange={(v) => handleSettingChange("immutableAuditTrail", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Log Field Changes</Label>
                  <Switch 
                    checked={getCurrentValue("logFieldChanges") ?? true}
                    onCheckedChange={(v) => handleSettingChange("logFieldChanges", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Capture IP Address</Label>
                  <Switch 
                    checked={getCurrentValue("captureIPAddress") ?? true}
                    onCheckedChange={(v) => handleSettingChange("captureIPAddress", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Capture Device Info</Label>
                  <Switch 
                    checked={getCurrentValue("captureDeviceInfo") ?? true}
                    onCheckedChange={(v) => handleSettingChange("captureDeviceInfo", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>RBAC Settings</CardTitle>
                <CardDescription>Role-based access control configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enforce RBAC</Label>
                  <Switch 
                    checked={getCurrentValue("enforceRBAC") ?? true}
                    onCheckedChange={(v) => handleSettingChange("enforceRBAC", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Allow Role Overrides</Label>
                  <Switch 
                    checked={getCurrentValue("allowRoleOverrides") ?? false}
                    onCheckedChange={(v) => handleSettingChange("allowRoleOverrides", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require Override Approval</Label>
                  <Switch 
                    checked={getCurrentValue("requireOverrideApproval") ?? true}
                    onCheckedChange={(v) => handleSettingChange("requireOverrideApproval", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Override Duration (days)</Label>
                  <Input 
                    type="number" 
                    value={getCurrentValue("maxOverrideDurationDays") ?? 30}
                    onChange={(e) => handleSettingChange("maxOverrideDurationDays", parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {settings && (
            <Card>
              <CardHeader>
                <CardTitle>Settings Version</CardTitle>
                <CardDescription>Current configuration version and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">Version {settings.version}</Badge>
                  <span className="text-sm text-muted-foreground">
                    All changes are versioned and logged in the immutable audit trail
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rbac" className="space-y-4 mt-3">
          <Card>
            <CardHeader>
              <CardTitle>Role Configurations</CardTitle>
              <CardDescription>Configure capabilities for each role in the firm</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roleConfigs?.map((role) => (
                  <div key={role.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{role.displayName}</h4>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                      <Badge variant="outline">Level {role.hierarchyLevel}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        {role.canActAsReviewer ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>Can Review</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {role.canActAsApprover ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>Can Approve</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {role.canOverrideControls ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>Override Controls</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {role.requiresPartnerPIN ? (
                          <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>Requires PIN</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {role.accessiblePhases?.map((phase) => (
                        <Badge key={phase} variant="secondary" className="text-xs">
                          {phase}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-3">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage firm users and their roles</CardDescription>
            </CardHeader>
            <CardContent>
              {users?.roleDistribution && (
                <div className="mb-3 grid grid-cols-4 gap-4">
                  {users.roleDistribution.map((rd: any) => (
                    <Card key={rd.role}>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{rd._count}</div>
                        <div className="text-sm text-muted-foreground">{rd.role}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {users?.users?.map((user: any) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{user.fullName}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                      {user.lastLoginAt && (
                        <span className="text-xs text-muted-foreground">
                          Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="space-y-4 mt-3">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Flag Configuration</CardTitle>
              <CardDescription>Configure automatic QR/EQCR triggers based on engagement characteristics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Default Triggers (from Settings)</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      {settings?.eqcrRequiredForPIE ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>EQCR required for Public Interest Entities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {settings?.eqcrRequiredForHighRisk ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>EQCR required for High Risk engagements</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {settings?.eqcrThresholdAssets ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Asset threshold: {settings?.eqcrThresholdAssets ? formatAccounting(settings.eqcrThresholdAssets) : "Not set"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {settings?.eqcrThresholdRevenue ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>Revenue threshold: {settings?.eqcrThresholdRevenue ? formatAccounting(settings.eqcrThresholdRevenue) : "Not set"}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Additional custom flag configurations can be created to trigger specific requirements based on industry, entity type, or other criteria.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 mt-3">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-3">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
