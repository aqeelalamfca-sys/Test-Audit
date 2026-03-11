import { useQuery } from "@tanstack/react-query";
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
import { Building2, Search, Eye, Edit, FolderOpen, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { CreateClientDialog } from "@/components/create-client-dialog";

interface Client {
  id: string;
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

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filteredClients = clients?.filter(
    (client) =>
      (client.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.ntn || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.tradingName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.city || "").toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="px-4 py-3 space-y-3" data-testid="client-list-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">Clients</h1>
            <p className="text-muted-foreground">
              {clients ? `${clients.length} client${clients.length !== 1 ? "s" : ""} registered` : "Manage client master records"}
            </p>
          </div>
        </div>
        <CreateClientDialog />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-clients"
            placeholder="Search by name, NTN, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Client Name</TableHead>
                <TableHead className="whitespace-nowrap">Trade Name</TableHead>
                <TableHead className="whitespace-nowrap">NTN / CNIC</TableHead>
                <TableHead className="whitespace-nowrap">SECP No.</TableHead>
                <TableHead className="whitespace-nowrap">Entity Type</TableHead>
                <TableHead className="whitespace-nowrap">Industry</TableHead>
                <TableHead className="whitespace-nowrap">Incorporation Date</TableHead>
                <TableHead className="whitespace-nowrap">City</TableHead>
                <TableHead className="whitespace-nowrap">Address</TableHead>
                <TableHead className="whitespace-nowrap">Country</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
                <TableHead className="whitespace-nowrap">Phone</TableHead>
                <TableHead className="whitespace-nowrap">Focal Person</TableHead>
                <TableHead className="whitespace-nowrap">Focal Mobile</TableHead>
                <TableHead className="whitespace-nowrap">Focal Email</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading clients...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center py-8 text-muted-foreground" data-testid="text-no-clients">
                    {searchQuery ? "No clients match your search." : 'No clients found. Click "Add Client" to create one.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium" data-testid={`text-client-name-${client.id}`}>{client.name}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{client.tradingName || "-"}</TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap" data-testid={`text-client-ntn-${client.id}`}>{client.ntn || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.secpNo || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.entityType?.replace(/_/g, " ") || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.industry?.replace(/_/g, " ") || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(client.dateOfIncorporation)}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.city || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap max-w-[200px] truncate" title={client.address || ""}>{client.address || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.country || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.email || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.phone || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.focalPersonName || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.focalPersonMobile || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{client.focalPersonEmail || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{statusBadge(client)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/clients/${client.id}`}>
                          <Button variant="ghost" size="sm" title="View Details" data-testid={`button-view-client-${client.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/clients/${client.id}/edit`}>
                          <Button variant="ghost" size="sm" title="Edit Client" data-testid={`button-edit-client-${client.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Engagements"
                          data-testid={`button-engagements-client-${client.id}`}
                          onClick={() => setLocation(`/engagements?client=${client.id}`)}
                        >
                          <FolderOpen className="h-4 w-4" />
                          {client._count?.engagements ? (
                            <span className="ml-1 text-xs">{client._count.engagements}</span>
                          ) : null}
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
