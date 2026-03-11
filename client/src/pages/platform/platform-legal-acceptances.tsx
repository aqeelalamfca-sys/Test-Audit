import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Shield,
  Globe,
  Calendar,
  Phone,
  Mail,
  Building2,
  User,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LegalAcceptance {
  id: string;
  firmId: string;
  acceptedByUserId: string;
  firmNameSnapshot: string;
  adminName: string;
  email: string;
  mobileNumber: string | null;
  ipAddress: string | null;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
  createdAt: string;
}

interface LegalAcceptanceResponse {
  acceptances: LegalAcceptance[];
  total: number;
  page: number;
  limit: number;
}

export default function PlatformLegalAcceptances() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedAcceptance, setSelectedAcceptance] = useState<LegalAcceptance | null>(null);
  const limit = 20;

  const { data, isLoading } = useQuery<LegalAcceptanceResponse>({
    queryKey: ["/api/platform/legal-acceptances", search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      const res = await apiRequest("GET", `/api/platform/legal-acceptances?${params}`);
      return res.json();
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Legal Acceptances
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all Terms of Service and Privacy Policy acceptances across firms
          </p>
        </div>
        {data && (
          <Badge variant="outline" className="text-sm">
            {data.total} total acceptance{data.total !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by firm, name, or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
                data-testid="input-search-legal"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : !data?.acceptances?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-50" />
              <p>No legal acceptances found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Firm Name</TableHead>
                      <TableHead>Admin Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>Versions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.acceptances.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium max-w-[180px] truncate">{a.firmNameSnapshot}</TableCell>
                        <TableCell>{a.adminName}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{a.email}</TableCell>
                        <TableCell>{a.mobileNumber || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{a.ipAddress || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(a.acceptedAt)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="secondary" className="text-[10px]">ToS v{a.termsVersion}</Badge>
                            <Badge variant="secondary" className="text-[10px]">PP v{a.privacyVersion}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAcceptance(a)}
                            data-testid={`btn-view-${a.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({data.total} records)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAcceptance} onOpenChange={() => setSelectedAcceptance(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Legal Acceptance Details
            </DialogTitle>
          </DialogHeader>
          {selectedAcceptance && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Firm Name</p>
                  <p className="text-sm font-medium">{selectedAcceptance.firmNameSnapshot}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Admin Name</p>
                  <p className="text-sm font-medium">{selectedAcceptance.adminName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
                  <p className="text-sm font-medium">{selectedAcceptance.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Mobile</p>
                  <p className="text-sm font-medium">{selectedAcceptance.mobileNumber || "Not provided"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> IP Address</p>
                  <p className="text-sm font-mono">{selectedAcceptance.ipAddress || "Not captured"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Accepted At</p>
                  <p className="text-sm font-medium">{formatDate(selectedAcceptance.acceptedAt)}</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">Document Versions</p>
                <div className="flex gap-2">
                  <Badge>Terms of Service v{selectedAcceptance.termsVersion}</Badge>
                  <Badge>Privacy Policy v{selectedAcceptance.privacyVersion}</Badge>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-1">Record ID</p>
                <p className="text-xs font-mono text-muted-foreground">{selectedAcceptance.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
