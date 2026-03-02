import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Save, Building2, Eye, EyeOff, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useFormSaveBridge } from "@/hooks/use-form-save-bridge";

const PAKISTAN_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan",
  "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Abbottabad",
  "Bahawalpur", "Sargodha", "Sukkur", "Larkana", "Sheikhupura", "Jhang",
  "Rahim Yar Khan", "Gujrat", "Mardan", "Kasur", "Dera Ghazi Khan",
  "Sahiwal", "Nawabshah", "Mirpur Khas", "Chiniot", "Kamoke", "Other",
];

const COMPANY_TYPES = [
  { value: "private_limited", label: "Private Limited Company" },
  { value: "smc_pvt", label: "Single Member Company (SMC – Pvt.)" },
  { value: "public_unlisted", label: "Public Limited Company (Unlisted)" },
  { value: "listed", label: "Listed Company" },
  { value: "limited_guarantee", label: "Company Limited by Guarantee" },
  { value: "unlimited", label: "Unlimited Company" },
  { value: "foreign_branch", label: "Foreign Company (Branch / Liaison Office)" },
  { value: "other", label: "Other (Specify)" },
];

const REGULATORY_CATEGORIES = [
  { value: "not_regulated", label: "Not Regulated (General Corporate)" },
  { value: "banking_sbp", label: "Banking Company (SBP)" },
  { value: "dfi", label: "Development Finance Institution (DFI)" },
  { value: "microfinance", label: "Microfinance Bank" },
  { value: "nbfc", label: "NBFC (Leasing / Modaraba / AMC / REIT / PE / VC)" },
  { value: "insurance", label: "Insurance Company" },
  { value: "takaful", label: "Takaful Operator" },
  { value: "stock_broker", label: "Stock Broker / Securities Company" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "pension_fund", label: "Pension Fund" },
  { value: "other", label: "Other (Specify)" },
];

const SIZE_CLASSIFICATIONS = [
  { value: "large", label: "Large Company" },
  { value: "medium", label: "Medium-Sized Company" },
  { value: "small", label: "Small Company" },
  { value: "sme", label: "SME (SECP / ICAP)" },
  { value: "other", label: "Other (Specify)" },
];

const OWNERSHIP_TYPES = [
  { value: "family_owned", label: "Family-Owned Company" },
  { value: "group_holding", label: "Group / Holding Company" },
  { value: "subsidiary", label: "Subsidiary Company" },
  { value: "associate_jv", label: "Associate / Joint Venture" },
  { value: "soe", label: "State-Owned Enterprise (SOE)" },
  { value: "foreign_multinational", label: "Foreign-Owned / Multinational Subsidiary" },
  { value: "other", label: "Other (Specify)" },
];

const INDUSTRY_SECTORS = [
  { value: "manufacturing", label: "Manufacturing" },
  { value: "trading_wholesale", label: "Trading / Wholesale" },
  { value: "retail", label: "Retail" },
  { value: "construction", label: "Construction" },
  { value: "real_estate", label: "Real Estate & Developers" },
  { value: "textile", label: "Textile & Apparel" },
  { value: "pharmaceuticals", label: "Pharmaceuticals" },
  { value: "cement", label: "Cement" },
  { value: "steel", label: "Steel" },
  { value: "fmcg", label: "FMCG" },
  { value: "it_software", label: "IT / Software / SaaS" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "media_entertainment", label: "Media & Entertainment" },
  { value: "logistics", label: "Logistics & Transportation" },
  { value: "education", label: "Education Institution" },
  { value: "healthcare", label: "Healthcare / Hospital" },
  { value: "power_generation", label: "Power Generation" },
  { value: "renewable_energy", label: "Renewable Energy (Solar / Wind)" },
  { value: "oil_gas", label: "Oil & Gas" },
  { value: "utilities", label: "Utilities" },
  { value: "other", label: "Other (Specify)" },
];

const SPECIAL_ENTITY_TYPES = [
  { value: "not_applicable", label: "Not Applicable" },
  { value: "section_42", label: "Section-42 (Not-for-Profit)" },
  { value: "ngo_npo", label: "NGO / NPO" },
  { value: "trust", label: "Trust" },
  { value: "project_spv", label: "Project-Specific SPV" },
  { value: "sez_company", label: "SEZ Company" },
  { value: "ppp", label: "Public-Private Partnership (PPP)" },
  { value: "other", label: "Other (Specify)" },
];

const TAX_PROFILES = [
  { value: "fbr_registered", label: "FBR Registered" },
  { value: "sales_tax", label: "Sales Tax Registered" },
  { value: "export_oriented", label: "Export-Oriented Unit" },
  { value: "withholding_agent", label: "Withholding Agent" },
  { value: "tax_exempt", label: "Tax-Exempt / Reduced Rate" },
  { value: "sez_holiday", label: "SEZ / Tax Holiday" },
  { value: "other", label: "Other (Specify)" },
];

const LIFECYCLE_STATUSES = [
  { value: "newly_incorporated", label: "Newly Incorporated" },
  { value: "ongoing_operations", label: "Ongoing Operations" },
  { value: "dormant", label: "Dormant Company" },
  { value: "under_liquidation", label: "Under Liquidation" },
  { value: "winding_up", label: "Under Winding-Up / Easy Exit" },
  { value: "merger_amalgamation", label: "Under Merger / Amalgamation" },
  { value: "other", label: "Other (Specify)" },
];

export default function ClientOnboarding() {
  const [, navigate] = useLocation();
  const params = useParams();
  const clientId = params.id;
  const isEditMode = !!clientId;
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingClient, setFetchingClient] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(!isEditMode);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [formData, setFormData] = useState({
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
    companyTypeOther: "",
    regulatoryCategories: [] as string[],
    regulatoryCategoryOther: "",
    sizeClassification: "",
    sizeClassificationOther: "",
    ownershipType: "",
    ownershipTypeOther: "",
    industrySector: "",
    industrySectorOther: "",
    specialEntityType: "",
    specialEntityTypeOther: "",
    taxProfiles: [] as string[],
    taxProfileOther: "",
    lifecycleStatus: "",
    lifecycleStatusOther: "",
    portalAccessEnabled: false,
    portalContactFirstName: "",
    portalContactLastName: "",
    portalContactEmail: "",
    portalContactDesignation: "",
    portalContactPassword: "",
  });

  const saveBridge = useFormSaveBridge(formData, "/clients");

  useEffect(() => {
    if (isEditMode && clientId) {
      setFetchingClient(true);
      apiRequest("GET", `/api/clients/${clientId}`)
        .then(async (response) => {
          if (response.ok) {
            const client = await response.json();
            setFormData({
              clientLegalName: client.name || "",
              tradeName: client.tradingName || "",
              ntn: client.ntn || "",
              secpNo: client.secpNo || "",
              dateOfIncorporation: client.dateOfIncorporation || "",
              registeredAddress: client.address || "",
              city: client.city || "",
              country: client.country || "Pakistan",
              contactEmail: client.email || "",
              contactPhone: client.phone || "",
              companyType: client.entityType || "",
              companyTypeOther: "",
              regulatoryCategories: client.regulatoryCategory ? client.regulatoryCategory.split(",") : [],
              regulatoryCategoryOther: "",
              sizeClassification: client.sizeClassification || "",
              sizeClassificationOther: "",
              ownershipType: client.ownershipStructure || "",
              ownershipTypeOther: "",
              industrySector: client.industry || "",
              industrySectorOther: "",
              specialEntityType: client.specialEntityType || "",
              specialEntityTypeOther: "",
              taxProfiles: client.taxProfile ? client.taxProfile.split(",") : [],
              taxProfileOther: "",
              lifecycleStatus: client.lifecycleStatus || "",
              lifecycleStatusOther: "",
              portalAccessEnabled: false,
              portalContactFirstName: "",
              portalContactLastName: "",
              portalContactEmail: "",
              portalContactDesignation: "",
              portalContactPassword: "",
            });
            setDataLoaded(true);
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

  useEffect(() => {
    if (dataLoaded) {
      saveBridge.initializeBaseline();
    }
  }, [dataLoaded]);

  const handleMultiSelectChange = (field: "regulatoryCategories" | "taxProfiles", value: string, checked: boolean) => {
    const currentValues = formData[field];
    if (checked) {
      setFormData({ ...formData, [field]: [...currentValues, value] });
    } else {
      setFormData({ ...formData, [field]: currentValues.filter((v) => v !== value) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientLegalName || !formData.ntn || !formData.registeredAddress || !formData.city || 
        !formData.companyType || !formData.sizeClassification || !formData.ownershipType || 
        !formData.industrySector || !formData.lifecycleStatus) {
      toast({ title: "Validation Error", description: "Please fill all mandatory fields", variant: "destructive" });
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

    if (formData.companyType === "other" && !formData.companyTypeOther) {
      toast({ title: "Validation Error", description: "Please specify other company type", variant: "destructive" });
      return;
    }

    setLoading(true);
    saveBridge.setIsSaving(true);
    try {
      const payload = {
        name: formData.clientLegalName,
        tradingName: formData.tradeName || "",
        ntn: formData.ntn,
        secpNo: formData.secpNo || "",
        dateOfIncorporation: formData.dateOfIncorporation || undefined,
        address: formData.registeredAddress,
        city: formData.city,
        country: formData.country,
        email: formData.contactEmail || "",
        phone: formData.contactPhone || "",
        entityType: formData.companyType === "other" ? formData.companyTypeOther : formData.companyType,
        regulatoryCategory: formData.regulatoryCategories.includes("other") 
          ? [...formData.regulatoryCategories.filter(c => c !== "other"), formData.regulatoryCategoryOther].join(",")
          : formData.regulatoryCategories.join(","),
        sizeClassification: formData.sizeClassification === "other" ? formData.sizeClassificationOther : formData.sizeClassification,
        ownershipStructure: formData.ownershipType === "other" ? formData.ownershipTypeOther : formData.ownershipType,
        industry: formData.industrySector === "other" ? formData.industrySectorOther : formData.industrySector,
        specialEntityType: formData.specialEntityType === "other" ? formData.specialEntityTypeOther : formData.specialEntityType,
        taxProfile: formData.taxProfiles.includes("other")
          ? [...formData.taxProfiles.filter(t => t !== "other"), formData.taxProfileOther].join(",")
          : formData.taxProfiles.join(","),
        lifecycleStatus: formData.lifecycleStatus === "other" ? formData.lifecycleStatusOther : formData.lifecycleStatus,
        portalContact: formData.portalAccessEnabled ? {
          firstName: formData.portalContactFirstName,
          lastName: formData.portalContactLastName,
          email: formData.portalContactEmail,
          designation: formData.portalContactDesignation || undefined,
          password: formData.portalContactPassword,
        } : undefined,
      };

      const response = await fetchWithAuth(
        isEditMode ? `/api/clients/${clientId}` : "/api/clients",
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        saveBridge.setSaved();
        toast({ title: "Success", description: isEditMode ? "Client updated successfully" : "Client created successfully" });
        navigate("/clients");
      } else {
        saveBridge.setError();
        const errorData = await response.json();
        const errorMessage = errorData.error || `Failed to ${isEditMode ? "update" : "create"} client`;
        
        if (errorMessage.includes("duplicate") || errorMessage.includes("NTN")) {
          toast({ title: "Duplicate Client", description: "A client with this NTN already exists. Please use a different NTN or edit the existing client.", variant: "destructive" });
        } else {
          toast({ title: "Error", description: errorMessage, variant: "destructive" });
        }
      }
    } catch (error) {
      saveBridge.setError();
      console.error("Client save error:", error);
      toast({ title: "Error", description: `Failed to ${isEditMode ? "update" : "create"} client. Please try again.`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingClient) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Loading client data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => saveBridge.goBack("/clients")}
          data-testid="button-back-to-clients"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Clients
        </Button>
      </div>
      
      <div className="p-4 space-y-4 max-w-4xl mx-auto flex-1 overflow-auto">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">
              {isEditMode ? "Edit Client" : "Add New Client"}
            </h1>
            <p className="text-xs text-muted-foreground">Master Data | Admin Access</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Client Identification</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="clientLegalName" className="text-xs">Legal Name *</Label>
                  <Input
                    id="clientLegalName"
                    data-testid="input-client-legal-name"
                    value={formData.clientLegalName}
                    onChange={(e) => setFormData({ ...formData, clientLegalName: e.target.value })}
                    className=""
                    required
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="tradeName" className="text-xs">Trade Name</Label>
                  <Input
                    id="tradeName"
                    data-testid="input-trade-name"
                    value={formData.tradeName}
                    onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                    className=""
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ntn" className="text-xs">NTN *</Label>
                  <Input
                    id="ntn"
                    data-testid="input-ntn"
                    value={formData.ntn}
                    onChange={(e) => setFormData({ ...formData, ntn: e.target.value })}
                    className=""
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="secpNo" className="text-xs">SECP No.</Label>
                  <Input
                    id="secpNo"
                    data-testid="input-secp-no"
                    value={formData.secpNo}
                    onChange={(e) => setFormData({ ...formData, secpNo: e.target.value })}
                    className=""
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dateOfIncorporation" className="text-xs">Incorporation Date</Label>
                  <Input
                    id="dateOfIncorporation"
                    data-testid="input-incorporation-date"
                    type="date"
                    value={formData.dateOfIncorporation}
                    onChange={(e) => setFormData({ ...formData, dateOfIncorporation: e.target.value })}
                    className=""
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-xs">City *</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger id="city" data-testid="select-city" className="">
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
                  <Label htmlFor="registeredAddress" className="text-xs">Registered Address *</Label>
                  <Textarea
                    id="registeredAddress"
                    data-testid="input-registered-address"
                    value={formData.registeredAddress}
                    onChange={(e) => setFormData({ ...formData, registeredAddress: e.target.value })}
                    required
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactEmail" className="text-xs">Email</Label>
                  <Input
                    id="contactEmail"
                    data-testid="input-contact-email"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className=""
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactPhone" className="text-xs">Phone</Label>
                  <Input
                    id="contactPhone"
                    data-testid="input-contact-phone"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className=""
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country" className="text-xs">Country</Label>
                  <Select value={formData.country} onValueChange={(v) => setFormData({ ...formData, country: v })}>
                    <SelectTrigger id="country" data-testid="select-country" className="">
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Company Classification *</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="companyType" className="text-xs">Company Type</Label>
                  <Select value={formData.companyType} onValueChange={(v) => setFormData({ ...formData, companyType: v })}>
                    <SelectTrigger id="companyType" data-testid="select-company-type" className="">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sizeClassification" className="text-xs">Size</Label>
                  <Select value={formData.sizeClassification} onValueChange={(v) => setFormData({ ...formData, sizeClassification: v })}>
                    <SelectTrigger id="sizeClassification" data-testid="select-size" className="">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZE_CLASSIFICATIONS.map((size) => (
                        <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ownershipType" className="text-xs">Ownership</Label>
                  <Select value={formData.ownershipType} onValueChange={(v) => setFormData({ ...formData, ownershipType: v })}>
                    <SelectTrigger id="ownershipType" data-testid="select-ownership" className="">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {OWNERSHIP_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="industrySector" className="text-xs">Industry</Label>
                  <Select value={formData.industrySector} onValueChange={(v) => setFormData({ ...formData, industrySector: v })}>
                    <SelectTrigger id="industrySector" data-testid="select-industry" className="">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_SECTORS.map((sector) => (
                        <SelectItem key={sector.value} value={sector.value}>{sector.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lifecycleStatus" className="text-xs">Status</Label>
                  <Select value={formData.lifecycleStatus} onValueChange={(v) => setFormData({ ...formData, lifecycleStatus: v })}>
                    <SelectTrigger id="lifecycleStatus" data-testid="select-lifecycle" className="">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {LIFECYCLE_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="specialEntityType" className="text-xs">Special Entity</Label>
                  <Select value={formData.specialEntityType} onValueChange={(v) => setFormData({ ...formData, specialEntityType: v })}>
                    <SelectTrigger id="specialEntityType" data-testid="select-special-entity" className="">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIAL_ENTITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {(formData.companyType === "other" || formData.sizeClassification === "other" || 
                formData.ownershipType === "other" || formData.industrySector === "other" || 
                formData.lifecycleStatus === "other" || formData.specialEntityType === "other") && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                  {formData.companyType === "other" && (
                    <div className="space-y-1">
                      <Label htmlFor="companyTypeOther" className="text-xs">Other Company Type *</Label>
                      <Input id="companyTypeOther" value={formData.companyTypeOther} onChange={(e) => setFormData({ ...formData, companyTypeOther: e.target.value })} className="" required />
                    </div>
                  )}
                  {formData.sizeClassification === "other" && (
                    <div className="space-y-1">
                      <Label htmlFor="sizeClassificationOther" className="text-xs">Other Size *</Label>
                      <Input id="sizeClassificationOther" value={formData.sizeClassificationOther} onChange={(e) => setFormData({ ...formData, sizeClassificationOther: e.target.value })} className="" required />
                    </div>
                  )}
                  {formData.ownershipType === "other" && (
                    <div className="space-y-1">
                      <Label htmlFor="ownershipTypeOther" className="text-xs">Other Ownership *</Label>
                      <Input id="ownershipTypeOther" value={formData.ownershipTypeOther} onChange={(e) => setFormData({ ...formData, ownershipTypeOther: e.target.value })} className="" required />
                    </div>
                  )}
                  {formData.industrySector === "other" && (
                    <div className="space-y-1">
                      <Label htmlFor="industrySectorOther" className="text-xs">Other Industry *</Label>
                      <Input id="industrySectorOther" value={formData.industrySectorOther} onChange={(e) => setFormData({ ...formData, industrySectorOther: e.target.value })} className="" required />
                    </div>
                  )}
                  {formData.lifecycleStatus === "other" && (
                    <div className="space-y-1">
                      <Label htmlFor="lifecycleStatusOther" className="text-xs">Other Status *</Label>
                      <Input id="lifecycleStatusOther" value={formData.lifecycleStatusOther} onChange={(e) => setFormData({ ...formData, lifecycleStatusOther: e.target.value })} className="" required />
                    </div>
                  )}
                  {formData.specialEntityType === "other" && (
                    <div className="space-y-1">
                      <Label htmlFor="specialEntityTypeOther" className="text-xs">Other Special Entity *</Label>
                      <Input id="specialEntityTypeOther" value={formData.specialEntityTypeOther} onChange={(e) => setFormData({ ...formData, specialEntityTypeOther: e.target.value })} className="" required />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
            className="w-full text-xs text-muted-foreground"
            data-testid="button-toggle-optional"
          >
            {showOptionalFields ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {showOptionalFields ? "Hide" : "Show"} Optional Fields (Regulatory, Tax)
          </Button>

          {showOptionalFields && (
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Regulatory Category</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {REGULATORY_CATEGORIES.map((category) => (
                      <div key={category.value} className="flex items-center space-x-1.5">
                        <Checkbox
                          id={`reg-${category.value}`}
                          data-testid={`checkbox-reg-${category.value}`}
                          checked={formData.regulatoryCategories.includes(category.value)}
                          onCheckedChange={(checked) => handleMultiSelectChange("regulatoryCategories", category.value, !!checked)}
                          className="h-3.5 w-3.5"
                        />
                        <Label htmlFor={`reg-${category.value}`} className="text-xs font-normal cursor-pointer">
                          {category.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.regulatoryCategories.includes("other") && (
                    <div className="mt-2 max-w-xs">
                      <Input
                        id="regulatoryCategoryOther"
                        placeholder="Specify other..."
                        value={formData.regulatoryCategoryOther}
                        onChange={(e) => setFormData({ ...formData, regulatoryCategoryOther: e.target.value })}
                        className=""
                      />
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tax Profile</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {TAX_PROFILES.map((profile) => (
                      <div key={profile.value} className="flex items-center space-x-1.5">
                        <Checkbox
                          id={`tax-${profile.value}`}
                          data-testid={`checkbox-tax-${profile.value}`}
                          checked={formData.taxProfiles.includes(profile.value)}
                          onCheckedChange={(checked) => handleMultiSelectChange("taxProfiles", profile.value, !!checked)}
                          className="h-3.5 w-3.5"
                        />
                        <Label htmlFor={`tax-${profile.value}`} className="text-xs font-normal cursor-pointer">
                          {profile.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.taxProfiles.includes("other") && (
                    <div className="mt-2 max-w-xs">
                      <Input
                        id="taxProfileOther"
                        placeholder="Specify other..."
                        value={formData.taxProfileOther}
                        onChange={(e) => setFormData({ ...formData, taxProfileOther: e.target.value })}
                        className=""
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Client Portal Access</h3>
                  <p className="text-xs text-muted-foreground">Allow client login for document submission</p>
                </div>
                <Switch
                  id="portalAccessEnabled"
                  data-testid="switch-portal-access"
                  checked={formData.portalAccessEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, portalAccessEnabled: checked })}
                />
              </div>
              
              {formData.portalAccessEnabled && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t">
                  <div className="space-y-1">
                    <Label htmlFor="portalContactFirstName" className="text-xs">First Name *</Label>
                    <Input
                      id="portalContactFirstName"
                      data-testid="input-portal-first-name"
                      value={formData.portalContactFirstName}
                      onChange={(e) => setFormData({ ...formData, portalContactFirstName: e.target.value })}
                      className=""
                      required={formData.portalAccessEnabled}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="portalContactLastName" className="text-xs">Last Name *</Label>
                    <Input
                      id="portalContactLastName"
                      data-testid="input-portal-last-name"
                      value={formData.portalContactLastName}
                      onChange={(e) => setFormData({ ...formData, portalContactLastName: e.target.value })}
                      className=""
                      required={formData.portalAccessEnabled}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="portalContactDesignation" className="text-xs">Designation</Label>
                    <Input
                      id="portalContactDesignation"
                      data-testid="input-portal-designation"
                      value={formData.portalContactDesignation}
                      onChange={(e) => setFormData({ ...formData, portalContactDesignation: e.target.value })}
                      className=""
                      placeholder="e.g., Finance Manager"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="portalContactEmail" className="text-xs">Portal Email *</Label>
                    <Input
                      id="portalContactEmail"
                      data-testid="input-portal-email"
                      type="email"
                      value={formData.portalContactEmail}
                      onChange={(e) => setFormData({ ...formData, portalContactEmail: e.target.value })}
                      className=""
                      required={formData.portalAccessEnabled}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="portalContactPassword" className="text-xs">Password *</Label>
                    <div className="relative">
                      <Input
                        id="portalContactPassword"
                        data-testid="input-portal-password"
                        type={showPassword ? "text" : "password"}
                        value={formData.portalContactPassword}
                        onChange={(e) => setFormData({ ...formData, portalContactPassword: e.target.value })}
                        className="h-8 text-sm pr-8"
                        placeholder="Min 6 characters"
                        required={formData.portalAccessEnabled}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-8 w-8"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => saveBridge.goBack("/clients")} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || fetchingClient} data-testid="button-save-client">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {loading ? "Saving..." : isEditMode ? "Update" : "Save Client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
