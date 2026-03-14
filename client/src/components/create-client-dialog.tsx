import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Plus, Building2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import {
  PAKISTAN_CITIES,
  COUNTRIES,
  ENTITY_TYPES,
  INDUSTRY_SECTORS as INDUSTRIES,
} from "@/lib/form-constants";

const initialFormState = {
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
  entityType: "private_limited",
  industry: "general",
  focalPersonName: "",
  focalPersonMobile: "",
  focalPersonEmail: "",
};

interface CreateClientDialogProps {
  onSuccess?: (client: any) => void;
  trigger?: React.ReactNode;
}

export function CreateClientDialog({ onSuccess, trigger }: CreateClientDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...initialFormState });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!formData.clientLegalName.trim()) missing.push("Legal Name");
    if (!formData.ntn.trim()) missing.push("NTN/CNIC");
    if (!formData.focalPersonName.trim()) missing.push("Focal Person Name");
    if (!formData.focalPersonMobile.trim()) missing.push("Focal Person Mobile");
    if (!formData.focalPersonEmail.trim()) missing.push("Focal Person Email");
    if (missing.length > 0) {
      toast({ title: "Validation Error", description: `Required: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: formData.clientLegalName.trim(),
        tradingName: formData.tradeName || "",
        ntn: formData.ntn.trim(),
        secpNo: formData.secpNo || "",
        dateOfIncorporation: formData.dateOfIncorporation || undefined,
        address: formData.registeredAddress || "",
        city: formData.city || "",
        country: formData.country || "Pakistan",
        email: formData.contactEmail || "",
        phone: formData.contactPhone || "",
        entityType: formData.entityType || "private_limited",
        industry: formData.industry || "general",
        focalPersonName: formData.focalPersonName.trim(),
        focalPersonMobile: formData.focalPersonMobile.trim(),
        focalPersonEmail: formData.focalPersonEmail.trim(),
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
      setDialogOpen(false);
      setFormData({ ...initialFormState });
      toast({ title: "Client Created", description: `${created.name} has been added successfully` });
      if (onSuccess) {
        onSuccess(created);
      } else {
        navigate(`/clients/${created.id}`);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open) setFormData({ ...initialFormState });
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="button-add-client">
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-create-client">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Add New Client
          </DialogTitle>
          <DialogDescription className="text-xs">Client Master Data | Quick Add</DialogDescription>
        </DialogHeader>

        <fieldset className="border rounded-lg p-2.5 space-y-3">
          <legend className="text-xs font-medium text-muted-foreground px-1">Client Identification</legend>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2">
              <Label htmlFor="cc-legal-name" className="text-xs">Legal Name <span className="text-destructive">*</span></Label>
              <Input
                id="cc-legal-name"
                data-testid="input-cc-legal-name"
                placeholder="e.g., ABC Private Limited"
                value={formData.clientLegalName}
                onChange={(e) => setFormData({ ...formData, clientLegalName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="cc-trade-name" className="text-xs">Trade Name</Label>
              <Input
                id="cc-trade-name"
                data-testid="input-cc-trade-name"
                value={formData.tradeName}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-ntn" className="text-xs">NTN/CNIC <span className="text-destructive">*</span></Label>
              <Input
                id="cc-ntn"
                data-testid="input-cc-ntn"
                placeholder="NTN or CNIC number"
                value={formData.ntn}
                onChange={(e) => setFormData({ ...formData, ntn: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-secp" className="text-xs">SECP No.</Label>
              <Input
                id="cc-secp"
                data-testid="input-cc-secp"
                value={formData.secpNo}
                onChange={(e) => setFormData({ ...formData, secpNo: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-incorp-date" className="text-xs">Incorporation Date</Label>
              <Input
                id="cc-incorp-date"
                data-testid="input-cc-incorp-date"
                type="date"
                value={formData.dateOfIncorporation}
                onChange={(e) => setFormData({ ...formData, dateOfIncorporation: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-entity-type" className="text-xs">Entity Type</Label>
              <Select value={formData.entityType} onValueChange={(v) => setFormData({ ...formData, entityType: v })}>
                <SelectTrigger id="cc-entity-type" data-testid="select-cc-entity-type" className="h-8 text-sm">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>

        <fieldset className="border rounded-lg p-2.5 space-y-3">
          <legend className="text-xs font-medium text-muted-foreground px-1">Focal Person</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cc-focal-name" className="text-xs">Person Name <span className="text-destructive">*</span></Label>
              <Input
                id="cc-focal-name"
                data-testid="input-cc-focal-name"
                placeholder="e.g., Ali Khan"
                value={formData.focalPersonName}
                onChange={(e) => setFormData({ ...formData, focalPersonName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-focal-mobile" className="text-xs">Mobile Number <span className="text-destructive">*</span></Label>
              <Input
                id="cc-focal-mobile"
                data-testid="input-cc-focal-mobile"
                placeholder="e.g., +92 300 1234567"
                value={formData.focalPersonMobile}
                onChange={(e) => setFormData({ ...formData, focalPersonMobile: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-focal-email" className="text-xs">Email <span className="text-destructive">*</span></Label>
              <Input
                id="cc-focal-email"
                data-testid="input-cc-focal-email"
                type="email"
                placeholder="e.g., ali@company.com"
                value={formData.focalPersonEmail}
                onChange={(e) => setFormData({ ...formData, focalPersonEmail: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="border rounded-lg p-2.5 space-y-3">
          <legend className="text-xs font-medium text-muted-foreground px-1">Location & Contact</legend>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cc-city" className="text-xs">City</Label>
              <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                <SelectTrigger id="cc-city" data-testid="select-cc-city" className="h-8 text-sm">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {PAKISTAN_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-country" className="text-xs">Country</Label>
              <Select value={formData.country} onValueChange={(v) => setFormData({ ...formData, country: v })}>
                <SelectTrigger id="cc-country" data-testid="select-cc-country" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-industry" className="text-xs">Industry</Label>
              <Select value={formData.industry} onValueChange={(v) => setFormData({ ...formData, industry: v })}>
                <SelectTrigger id="cc-industry" data-testid="select-cc-industry" className="h-8 text-sm">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-phone" className="text-xs">Phone</Label>
              <Input
                id="cc-phone"
                data-testid="input-cc-phone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="cc-email" className="text-xs">Email</Label>
              <Input
                id="cc-email"
                data-testid="input-cc-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 col-span-2 md:col-span-4">
              <Label htmlFor="cc-address" className="text-xs">Registered Address</Label>
              <Textarea
                id="cc-address"
                data-testid="input-cc-address"
                value={formData.registeredAddress}
                onChange={(e) => setFormData({ ...formData, registeredAddress: e.target.value })}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} data-testid="button-cancel-create-client">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || !formData.clientLegalName.trim() || !formData.ntn.trim() || !formData.focalPersonName.trim() || !formData.focalPersonMobile.trim() || !formData.focalPersonEmail.trim()}
            data-testid="button-save-create-client"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
