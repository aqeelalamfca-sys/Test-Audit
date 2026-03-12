import { useParams, Link, useLocation } from "wouter";
import { AgentsLoadingInline } from "@/components/agents-loading";
import { CreateEngagementDialog } from "@/components/create-engagement-dialog";
import { EngagementLink } from "@/components/engagement-link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Building2, FileText, Users, Calendar, Eye, Edit, Trash2, Plus, Loader2, ExternalLink, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useWorkspace } from "@/lib/workspace-context";

interface Client {
  id: string;
  name: string;
  tradingName?: string;
  secpNo?: string;
  ntn?: string;
  strn?: string;
  entityType?: string;
  industry?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  ownershipStructure?: string;
  parentCompany?: string;
  ceoName?: string;
  ceoContact?: string;
  cfoName?: string;
  cfoContact?: string;
  priorAuditorName?: string;
  priorAuditorContact?: string;
  auditorChangeReason?: string;
  riskCategory?: string;
  acceptanceStatus?: string;
  _count?: { engagements: number };
}

interface Engagement {
  id: string;
  engagementCode: string;
  engagementType: string;
  status: string;
  currentPhase: string;
  fiscalYearEnd?: string;
  periodStart?: string;
  periodEnd?: string;
  team?: Array<{
    role: string;
    user?: { id: string; fullName: string; role: string };
  }>;
}

interface Document {
  id: string;
  documentType: string;
  documentName: string;
  documentNumber?: string;
  storagePath?: string;
  originalFileName?: string;
  uploadedAt: string;
  uploadedBy?: { id: string; fullName: string };
}

interface PermanentDocument {
  id: string;
  source: "TAB" | "REQUEST";
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  description: string | null;
  tabType: string;
  uploadedAt: string;
  uploadedBy: string;
  engagementCode: string | null;
  engagementId: string | null;
}

const DOCUMENT_TYPES = [
  "Certificate of Incorporation",
  "NTN Certificate",
  "SECP Registration",
  "Memorandum of Association",
  "Articles of Association",
  "Board Resolution",
  "Business License",
  "Tax Registration",
  "Bank Statement",
  "Financial Statements",
  "Other",
];

export default function ClientDetail() {
  const params = useParams();
  const clientId = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { switchToClient, switchToEngagement } = useWorkspace();

  const [editMode, setEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Client>>({});
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [newDoc, setNewDoc] = useState({ documentType: "", documentName: "", documentNumber: "" });
  const [saving, setSaving] = useState(false);

  const isManager = ["FIRM_ADMIN", "PARTNER", "MANAGER"].includes(user?.role || "");

  const { data: client, isLoading, error } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      return res.json();
    },
  });

  const { data: engagements = [] } = useQuery<Engagement[]>({
    queryKey: [`/api/clients/${clientId}/engagements`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${clientId}/engagements`);
      if (!res.ok) throw new Error("Failed to fetch engagements");
      return res.json();
    },
    enabled: !!clientId,
  });

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: [`/api/clients/${clientId}/documents`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${clientId}/documents`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!clientId,
  });

  const { data: permanentDocs = [] } = useQuery<PermanentDocument[]>({
    queryKey: ['/api/evidence', 'client', clientId, 'permanent-documents'],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/evidence/client/${clientId}/permanent-documents`);
      if (!res.ok) throw new Error("Failed to fetch permanent documents");
      return res.json();
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (client) {
      setEditFormData(client);
    }
  }, [client]);

  const handleSaveClient = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Client updated successfully" });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}`] });
        setEditMode(false);
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to update client", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update client", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDocument = async () => {
    if (!newDoc.documentName || !newDoc.documentType) {
      toast({ title: "Error", description: "Document name and type are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDoc),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Document added successfully" });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/documents`] });
        setDocDialogOpen(false);
        setNewDoc({ documentType: "", documentName: "", documentNumber: "" });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to add document", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add document", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocId) return;

    try {
      const res = await fetchWithAuth(`/api/clients/${clientId}/documents/${deleteDocId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({ title: "Success", description: "Document deleted" });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/documents`] });
      } else {
        toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
    } finally {
      setDeleteDocId(null);
    }
  };

  const handleOpenEngagement = (eng: Engagement) => {
    if (client) {
      switchToClient(client.id);
      switchToEngagement(eng.id);
    }
  };

  const getPartner = (team?: Engagement["team"]) => {
    const partner = team?.find(t => t.role === "Partner" || t.role === "Engagement Partner");
    return partner?.user?.fullName || "-";
  };

  const getManager = (team?: Engagement["team"]) => {
    const manager = team?.find(t => t.role === "Manager" || t.role === "Engagement Manager");
    return manager?.user?.fullName || "-";
  };

  if (isLoading) {
    return <AgentsLoadingInline showDelay={1000} />;
  }

  if (error || !client) {
    return (
      <div className="px-4 py-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">Failed to load client details.</p>
            <Link href="/clients">
              <Button variant="outline" className="mt-4">Back to Clients</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            {client.tradingName && (
              <p className="text-muted-foreground">Trading as: {client.tradingName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={client.acceptanceStatus === "APPROVED" ? "default" : "secondary"}>
            {client.acceptanceStatus || "Pending"}
          </Badge>
          {client.riskCategory && (
            <Badge variant="outline">{client.riskCategory} Risk</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="engagements">
        <TabsList>
          <TabsTrigger value="engagements">Engagements</TabsTrigger>
          <TabsTrigger value="contact">Contact Information</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="engagements" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Client Engagements</CardTitle>
              {isManager && (
                <CreateEngagementDialog 
                  preselectedClientId={clientId} 
                  onSuccess={() => queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/engagements`] })}
                  trigger={
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      New Engagement
                    </Button>
                  }
                />
              )}
            </CardHeader>
            <CardContent>
              {engagements.length === 0 ? (
                <div className="text-center py-4">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">No engagements found for this client.</p>
                  {isManager && (
                    <CreateEngagementDialog 
                      preselectedClientId={clientId} 
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/engagements`] })}
                      trigger={
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Engagement
                        </Button>
                      }
                    />
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Engagement Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>FY End</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {engagements.map((eng) => (
                      <TableRow key={eng.id}>
                        <TableCell className="font-medium font-mono">
                          <EngagementLink
                            engagementId={eng.id}
                            engagementCode={eng.engagementCode}
                            clientId={clientId}
                          />
                        </TableCell>
                        <TableCell>{eng.engagementType?.replace("_", " ")}</TableCell>
                        <TableCell>
                          {eng.fiscalYearEnd ? new Date(eng.fiscalYearEnd).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>
                          {eng.periodStart && eng.periodEnd
                            ? `${new Date(eng.periodStart).toLocaleDateString()} - ${new Date(eng.periodEnd).toLocaleDateString()}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{eng.status}</Badge>
                        </TableCell>
                        <TableCell>{getPartner(eng.team)}</TableCell>
                        <TableCell>{getManager(eng.team)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEngagement(eng)}
                              title="Open Engagement"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            {isManager && (
                              <Link href={`/engagement/${eng.id}/edit`}>
                                <Button variant="ghost" size="sm" title="Edit">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Client Master Information</CardTitle>
              {isManager && (
                <Button
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => editMode ? handleSaveClient() : setEditMode(true)}
                  disabled={saving}
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editMode ? "Save Changes" : "Edit"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Legal Name</Label>
                    <Input
                      value={editFormData.name || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Trading Name</Label>
                    <Input
                      value={editFormData.tradingName || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, tradingName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NTN</Label>
                    <Input
                      value={editFormData.ntn || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, ntn: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SECP No.</Label>
                    <Input
                      value={editFormData.secpNo || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, secpNo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>STRN</Label>
                    <Input
                      value={editFormData.strn || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, strn: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Entity Type</Label>
                    <Input
                      value={editFormData.entityType || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, entityType: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input
                      value={editFormData.industry || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editFormData.phone || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={editFormData.email || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={editFormData.address || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={editFormData.website || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CEO Name</Label>
                    <Input
                      value={editFormData.ceoName || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, ceoName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CEO Contact</Label>
                    <Input
                      value={editFormData.ceoContact || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, ceoContact: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CFO Name</Label>
                    <Input
                      value={editFormData.cfoName || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, cfoName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CFO Contact</Label>
                    <Input
                      value={editFormData.cfoContact || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, cfoContact: e.target.value })}
                    />
                  </div>
                  <div className="col-span-full flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => { setEditMode(false); setEditFormData(client); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoRow label="Legal Name" value={client.name} />
                  <InfoRow label="Trading Name" value={client.tradingName} />
                  <InfoRow label="NTN" value={client.ntn} />
                  <InfoRow label="SECP No." value={client.secpNo} />
                  <InfoRow label="STRN" value={client.strn} />
                  <InfoRow label="Entity Type" value={client.entityType?.replace(/_/g, " ")} />
                  <InfoRow label="Industry" value={client.industry} />
                  <InfoRow label="Phone" value={client.phone} />
                  <InfoRow label="Email" value={client.email} />
                  <InfoRow label="Website" value={client.website} className="md:col-span-2" />
                  <InfoRow label="Address" value={client.address} className="md:col-span-3" />
                  <div className="col-span-full border-t pt-4 mt-2">
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">Key Contacts</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <InfoRow label="CEO Name" value={client.ceoName} />
                      <InfoRow label="CEO Contact" value={client.ceoContact} />
                      <InfoRow label="CFO Name" value={client.cfoName} />
                      <InfoRow label="CFO Contact" value={client.cfoContact} />
                    </div>
                  </div>
                  {client.priorAuditorName && (
                    <div className="col-span-full border-t pt-4 mt-2">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Prior Auditor</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InfoRow label="Auditor Name" value={client.priorAuditorName} />
                        <InfoRow label="Contact" value={client.priorAuditorContact} />
                        <InfoRow label="Change Reason" value={client.auditorChangeReason} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Master Client Documents</CardTitle>
              {isManager && (
                <Button size="sm" onClick={() => setDocDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-4">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">No master documents uploaded for this client.</p>
                  {isManager && (
                    <Button onClick={() => setDocDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Upload First Document
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Document No.</TableHead>
                      <TableHead>Uploaded On</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id} data-testid={`row-master-doc-${doc.id}`}>
                        <TableCell className="font-medium">{doc.documentName}</TableCell>
                        <TableCell>{doc.documentType}</TableCell>
                        <TableCell>{doc.documentNumber || "-"}</TableCell>
                        <TableCell>{new Date(doc.uploadedAt).toLocaleDateString()}</TableCell>
                        <TableCell>{doc.uploadedBy?.fullName || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {doc.storagePath && (
                              <Button variant="ghost" size="sm" title="View">
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {isManager && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Delete"
                                onClick={() => setDeleteDocId(doc.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permanent Documents from Engagements</CardTitle>
              <p className="text-sm text-muted-foreground">
                Documents marked as permanent during audit phases are linked here for future reference.
              </p>
            </CardHeader>
            <CardContent>
              {permanentDocs.length === 0 ? (
                <div className="text-center py-4">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No permanent documents from engagements yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Mark documents as "Permanent" in the Evidence tab during audits to link them here.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Engagement</TableHead>
                      <TableHead>Uploaded On</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permanentDocs.map((doc) => (
                      <TableRow key={`${doc.source}-${doc.id}`} data-testid={`row-permanent-doc-${doc.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{doc.fileName}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground">{doc.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {doc.tabType?.replace(/_/g, ' ') || doc.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {doc.engagementCode && doc.engagementId ? (
                            <EngagementLink
                              engagementId={doc.engagementId}
                              engagementCode={doc.engagementCode}
                              clientId={clientId}
                              className="text-sm font-mono"
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(doc.uploadedAt).toLocaleDateString()}</TableCell>
                        <TableCell>{doc.uploadedBy || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {doc.filePath && (
                              <Button variant="ghost" size="sm" title="View">
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {doc.engagementId && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Go to Engagement"
                                onClick={() => navigate(`/workspace/${doc.engagementId}/evidence`)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>
              Add a new permanent document for this client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="docName">Document Name *</Label>
              <Input
                id="docName"
                value={newDoc.documentName}
                onChange={(e) => setNewDoc({ ...newDoc, documentName: e.target.value })}
                placeholder="e.g., Certificate of Incorporation 2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="docType">Document Type *</Label>
              <Select
                value={newDoc.documentType}
                onValueChange={(v) => setNewDoc({ ...newDoc, documentType: v })}
              >
                <SelectTrigger id="docType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="docNumber">Document Number (Optional)</Label>
              <Input
                id="docNumber"
                value={newDoc.documentNumber}
                onChange={(e) => setNewDoc({ ...newDoc, documentNumber: e.target.value })}
                placeholder="e.g., REG-2024-12345"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDocument} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocument} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}
