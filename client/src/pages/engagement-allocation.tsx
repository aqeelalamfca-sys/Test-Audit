import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserCheck, Search, Edit, Users, AlertCircle, Loader2, Shield } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Engagement {
  id: string;
  engagementCode: string;
  status: string;
  eqcrRequired?: boolean;
  client?: {
    name: string;
  };
  fiscalYearEnd?: string;
  team?: Array<{
    id?: string;
    role: string;
    userId?: string;
    user?: {
      id: string;
      fullName: string;
    };
  }>;
}

interface User {
  id: string;
  fullName: string;
  role: string;
}

export default function EngagementAllocation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(false);
  const [allocationData, setAllocationData] = useState({
    partnerId: "",
    managerId: "",
    seniorId: "",
    staffId: "",
    eqcrId: "",
    eqcrRequired: false,
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "partner";

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const partners = users?.filter(u => u.role === "PARTNER" || u.role === "MANAGING_PARTNER") || [];
  const managers = users?.filter(u => u.role === "MANAGER" || u.role === "TEAM_LEAD") || [];
  const seniors = users?.filter(u => u.role === "SENIOR" || u.role === "TEAM_LEAD") || [];
  const staff = users?.filter(u => u.role === "STAFF" || u.role === "SENIOR") || [];
  const eqcrs = users?.filter(u => u.role === "EQCR") || [];

  const openEditDialog = (eng: Engagement) => {
    setSelectedEngagement(eng);
    const getTeamUserId = (role: string) => {
      const member = eng.team?.find(t => t.role === role);
      return member?.user?.id || member?.userId || "";
    };
    setAllocationData({
      partnerId: getTeamUserId("Partner"),
      managerId: getTeamUserId("Manager"),
      seniorId: getTeamUserId("Senior"),
      staffId: getTeamUserId("Staff"),
      eqcrId: getTeamUserId("EQCR"),
      eqcrRequired: eng.eqcrRequired || false,
    });
    setDialogOpen(true);
  };

  const handleSaveAllocation = async () => {
    if (!selectedEngagement) return;
    setLoading(true);
    try {
      const team = [];
      if (allocationData.partnerId) team.push({ userId: allocationData.partnerId, role: "Partner", isLead: true });
      if (allocationData.managerId) team.push({ userId: allocationData.managerId, role: "Manager", isLead: false });
      if (allocationData.seniorId) team.push({ userId: allocationData.seniorId, role: "Senior", isLead: false });
      if (allocationData.staffId) team.push({ userId: allocationData.staffId, role: "Staff", isLead: false });
      if (allocationData.eqcrId) team.push({ userId: allocationData.eqcrId, role: "EQCR", isLead: false });

      const response = await fetchWithAuth(`/api/engagements/${selectedEngagement.id}/team`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, eqcrRequired: allocationData.eqcrRequired }),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Team allocation updated successfully" });
        setDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to update allocation", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update allocation", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const { data: engagements } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
  });

  const filteredEngagements = engagements?.filter((eng) => {
    return (eng.client?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (eng.engagementCode || "").toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const getTeamMember = (team?: Engagement["team"], role?: string) => {
    const member = team?.find(t => t.role === role);
    return member?.user?.fullName;
  };

  const pendingAllocations = filteredEngagements.filter(eng => {
    const partner = getTeamMember(eng.team, "Partner");
    const manager = getTeamMember(eng.team, "Manager");
    return !partner || !manager;
  }).length;

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Engagement Allocation</h1>
            <p className="text-muted-foreground">Assign teams to engagements</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Engagements</p>
                <p className="text-2xl font-bold">{filteredEngagements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Allocation</p>
                <p className="text-2xl font-bold">{pendingAllocations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Fully Allocated</p>
                <p className="text-2xl font-bold">{filteredEngagements.length - pendingAllocations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search engagements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Allocation</CardTitle>
          <CardDescription>Assign Partner, Manager, Senior, and Team Members to each engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engagement</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Senior</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>EQCR</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEngagements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                    No engagements found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEngagements.map((eng) => {
                  const partner = getTeamMember(eng.team, "Partner");
                  const manager = getTeamMember(eng.team, "Manager");
                  const senior = getTeamMember(eng.team, "Senior");
                  const staff = getTeamMember(eng.team, "Staff");
                  const eqcr = getTeamMember(eng.team, "EQCR");

                  return (
                    <TableRow key={eng.id}>
                      <TableCell className="font-mono">{eng.engagementCode}</TableCell>
                      <TableCell className="font-medium">{eng.client?.name || "-"}</TableCell>
                      <TableCell>
                        {partner ? (
                          <span className="text-sm">{partner}</span>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">Not Assigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {manager ? (
                          <span className="text-sm">{manager}</span>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">Not Assigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {senior ? (
                          <span className="text-sm">{senior}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {staff ? (
                          <span className="text-sm">{staff}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {eqcr ? (
                          <span className="text-sm">{eqcr}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Edit Allocation"
                            onClick={() => openEditDialog(eng)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Team Allocation</DialogTitle>
            <DialogDescription>
              {selectedEngagement?.engagementCode} - {selectedEngagement?.client?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedEngagement?.team && selectedEngagement.team.length > 0 && (
            <div className="bg-muted/50 p-3 rounded-lg border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Currently Assigned Team:</p>
              <div className="flex flex-wrap gap-2">
                {selectedEngagement.team.map((member, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {member.role}: {member.user?.fullName || "Unknown"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partnerId">Engagement Partner *</Label>
              <Select 
                value={allocationData.partnerId} 
                onValueChange={(v) => setAllocationData({ ...allocationData, partnerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="managerId">Engagement Manager</Label>
              <Select 
                value={allocationData.managerId} 
                onValueChange={(v) => setAllocationData({ ...allocationData, managerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seniorId">Senior Auditor</Label>
              <Select 
                value={allocationData.seniorId} 
                onValueChange={(v) => setAllocationData({ ...allocationData, seniorId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Senior" />
                </SelectTrigger>
                <SelectContent>
                  {seniors.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffId">Staff Member</Label>
              <Select 
                value={allocationData.staffId} 
                onValueChange={(v) => setAllocationData({ ...allocationData, staffId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="eqcrRequired" className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    EQCR Required
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable if this engagement requires Engagement Quality Control Review
                  </p>
                </div>
                <Switch
                  id="eqcrRequired"
                  checked={allocationData.eqcrRequired}
                  onCheckedChange={(checked) => setAllocationData({ ...allocationData, eqcrRequired: checked })}
                />
              </div>

              {allocationData.eqcrRequired && (
                <div className="space-y-2">
                  <Label htmlFor="eqcrId">EQCR Reviewer</Label>
                  <Select 
                    value={allocationData.eqcrId} 
                    onValueChange={(v) => setAllocationData({ ...allocationData, eqcrId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select EQCR" />
                    </SelectTrigger>
                    <SelectContent>
                      {eqcrs.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAllocation} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
