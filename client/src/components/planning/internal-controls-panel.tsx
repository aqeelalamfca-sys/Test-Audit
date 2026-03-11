import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from "@/lib/formatters";
import { Loader2, Shield, CheckCircle2, AlertCircle, Building2 } from "lucide-react";

interface InternalControlsPanelProps {
  engagementId: string;
  readOnly?: boolean;
  onFieldChange?: (field: string, value: any) => void;
  planningData?: any;
}

export function InternalControlsPanel({ engagementId, readOnly, onFieldChange, planningData }: InternalControlsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "control-cycles"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/control-cycles`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading control cycles...</span>
      </div>
    );
  }

  const cycles = data?.cycles || [];
  const controlData = planningData?.controlCycles || {};

  const getFieldValue = (cycleId: string, field: string) => {
    return controlData?.[cycleId]?.[field] || "";
  };

  const updateCycleField = (cycleId: string, field: string, value: any) => {
    const updated = { ...controlData, [cycleId]: { ...controlData?.[cycleId], [field]: value } };
    onFieldChange?.("controlCycles", updated);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Internal Control / Process Understanding / Walkthroughs
            </CardTitle>
            <Badge variant="outline" className="text-xs">ISA 315</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cycle-based control planning auto-populated from Data Intake financial data. Material cycles are flagged as required.
          </p>
        </CardHeader>
      </Card>

      {cycles.map((cycle: any) => (
        <Card key={cycle.id} className={cycle.isMaterial ? "border-l-4 border-l-amber-500" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {cycle.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                {cycle.isMaterial ? (
                  <Badge variant="destructive" className="text-[10px]">Material — Required</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Not Material</Badge>
                )}
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {cycle.accountCount} accounts · {formatAccounting(cycle.totalBalance)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Process Description</Label>
                <Textarea
                  value={getFieldValue(cycle.id, "processDescription")}
                  onChange={(e) => updateCycleField(cycle.id, "processDescription", e.target.value)}
                  placeholder={`Describe the ${cycle.name.toLowerCase()} process flow...`}
                  className="mt-1 text-xs min-h-[60px]"
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label className="text-xs">Key Controls Identified</Label>
                <Textarea
                  value={getFieldValue(cycle.id, "keyControls")}
                  onChange={(e) => updateCycleField(cycle.id, "keyControls", e.target.value)}
                  placeholder="List key controls and their nature (preventive/detective)..."
                  className="mt-1 text-xs min-h-[60px]"
                  disabled={readOnly}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Walkthrough Status</Label>
                <Select
                  value={getFieldValue(cycle.id, "walkthroughStatus") || "not-started"}
                  onValueChange={(val) => updateCycleField(cycle.id, "walkthroughStatus", val)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="mt-1 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-started" className="text-xs">Not Started</SelectItem>
                    <SelectItem value="in-progress" className="text-xs">In Progress</SelectItem>
                    <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Checkbox
                  id={`reliance-${cycle.id}`}
                  checked={getFieldValue(cycle.id, "reliancePlanned") === true}
                  onCheckedChange={(checked) => updateCycleField(cycle.id, "reliancePlanned", checked)}
                  disabled={readOnly}
                />
                <Label htmlFor={`reliance-${cycle.id}`} className="text-xs">Plan to rely on controls</Label>
              </div>
              <div>
                <Label className="text-xs">IT Dependencies</Label>
                <Textarea
                  value={getFieldValue(cycle.id, "itDependencies")}
                  onChange={(e) => updateCycleField(cycle.id, "itDependencies", e.target.value)}
                  placeholder="IT systems, automated controls..."
                  className="mt-1 text-xs min-h-[40px]"
                  disabled={readOnly}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Control Deficiencies</Label>
              <Textarea
                value={getFieldValue(cycle.id, "controlDeficiencies")}
                onChange={(e) => updateCycleField(cycle.id, "controlDeficiencies", e.target.value)}
                placeholder="Document any control deficiencies identified..."
                className="mt-1 text-xs min-h-[40px]"
                disabled={readOnly}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
