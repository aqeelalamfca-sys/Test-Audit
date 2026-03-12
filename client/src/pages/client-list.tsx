import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Search, Eye, Edit, FolderOpen, Loader2, Download } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { CreateClientDialog } from "@/components/create-client-dialog";
import * as XLSX from "xlsx";

interface Client {
  id: string;
  clientCode?: string;
  name: string;
  tradingName?: string;
  ntn?: string;
  secpNo?: string;
  entityType?: string;
  industry?: string;
  city?: string;
  address?: string;
  country?: string;
  phone?: string;
  email?: string;
  dateOfIncorporation?: string;
  focalPersonName?: string;
  focalPersonMobile?: string;
  focalPersonEmail?: string;
  sizeClassification?: string;
  lifecycleStatus?: string;
  acceptanceStatus?: string;
  status: string;
  _count?: {
    engagements: number;
  };
}

const statusBadge = (client: Client) => {
  const status = client.acceptanceStatus || client.status || "PENDING";
  switch (status.toUpperCase()) {
    case "APPROVED":
      return <Badge className="bg-emerald-100 text-emerald-700 border-0" data-testid={`badge-status-${client.id}`}>Approved</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-100 text-red-700 border-0" data-testid={`badge-status-${client.id}`}>Rejected</Badge>;
    case "PENDING":
    case "PENDING_REVIEW":
      return <Badge className="bg-amber-100 text-amber-700 border-0" data-testid={`badge-status-${client.id}`}>Pending</Badge>;
    default:
      return <Badge variant="secondary" data-testid={`badge-status-${client.id}`}>{status}</Badge>;
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "-";
  }
};

export default function ClientList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const exportToExcel = () => {
    if (!filteredClients.length) return;
    const rows = filteredClients.map((c) => ({
      "Client Code": c.clientCode || "",
      "Client Name": c.name || "",
      "Trade Name": c.tradingName || "",
      "NTN / CNIC": c.ntn || "",
      "SECP No.": c.secpNo || "",
      "Entity Type": c.entityType?.replace(/_/g, " ") || "",
      "Industry": c.industry?.replace(/_/g, " ") || "",
      "Incorporation Date": c.dateOfIncorporation ? new Date(c.dateOfIncorporation).toLocaleDateString() : "",
      "City": c.city || "",
      "Address": c.address || "",
      "Country": c.country || "",
      "Email": c.email || "",
      "Phone": c.phone || "",
      "Focal Person": c.focalPersonName || "",
      "Focal Mobile": c.focalPersonMobile || "",
      "Focal Email": c.focalPersonEmail || "",
      "Status": c.acceptanceStatus || c.status || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients");
    XLSX.writeFile(wb, `Clients_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const filteredClients = clients?.filter(
    (client) =>
      (client.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.ntn || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.tradingName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.city || "").toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="page-container" data-testid="client-list-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients ? `${clients.length} client${clients.length !== 1 ? "s" : ""} registered` : "Manage client master records"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!filteredClients.length} className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <CreateClientDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/clients"] })} />
        </div>
      </div>

      <div className="filter-bar">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-clients"
            placeholder="Search by name, NTN, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {filteredClients.length > 0 && (
          <span className="text-xs text-muted-foreground">{filteredClients.length} result{filteredClients.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>NTN / CNIC</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Focal Person</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading clients...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10" data-testid="text-no-clients">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? "No clients match your search." : 'No clients found. Click "Add Client" to create one.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id} data-testid={`row-client-${client.id}`} className="cursor-pointer" onClick={() => setLocation(`/clients/${client.id}`)}>
                    <TableCell className="font-mono text-xs">{client.clientCode || "-"}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm" data-testid={`text-client-name-${client.id}`}>{client.name}</span>
                        {client.tradingName && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{client.tradingName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs" data-testid={`text-client-ntn-${client.id}`}>{client.ntn || "-"}</TableCell>
                    <TableCell className="text-sm">{client.entityType?.replace(/_/g, " ") || "-"}</TableCell>
                    <TableCell className="text-sm">{client.city || "-"}</TableCell>
                    <TableCell className="text-sm">{client.focalPersonName || "-"}</TableCell>
                    <TableCell>{statusBadge(client)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/clients/${client.id}`}>
                          <Button variant="ghost" size="sm" title="View Details" data-testid={`button-view-client-${client.id}`} className="h-7 w-7 p-0">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/clients/${client.id}/edit`}>
                          <Button variant="ghost" size="sm" title="Edit Client" data-testid={`button-edit-client-${client.id}`} className="h-7 w-7 p-0">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Engagements"
                          data-testid={`button-engagements-client-${client.id}`}
                          onClick={() => setLocation(`/engagements?client=${client.id}`)}
                          className="h-7 w-7 p-0"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
