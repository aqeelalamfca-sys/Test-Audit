import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Trash2, AlertTriangle, Shield, FileText } from "lucide-react";

interface RelatedPartiesPanelProps {
  engagementId: string;
  readOnly?: boolean;
  onFieldChange?: (field: string, value: any) => void;
  planningData?: any;
}

const ISA_550_PROCEDURES = [
  { id: "inquire-mgmt", label: "Inquire management about related parties and transactions", isa: "ISA 550.13" },
  { id: "review-prior", label: "Review prior period working papers for known related parties", isa: "ISA 550.14(a)" },
  { id: "review-procedures", label: "Review entity's procedures for identifying related parties", isa: "ISA 550.14(b)" },
  { id: "identify-unusual", label: "Identify transactions outside normal course of business", isa: "ISA 550.16" },
  { id: "evaluate-disclosures", label: "Evaluate related party disclosures in financial statements", isa: "ISA 550.25" },
  { id: "assess-fraud", label: "Assess risk of fraud through related party relationships", isa: "ISA 550.18" },
  { id: "review-board-minutes", label: "Review board minutes for related party approvals", isa: "ISA 550.14(c)" },
  { id: "review-register", label: "Review statutory register of related parties (if maintained)", isa: "Companies Act 2017" },
];

interface RelatedParty {
  id: string;
  name: string;
  relationship: string;
  natureOfTransactions: string;
  volumeEstimate: string;
  riskLevel: string;
  auditResponse: string;
}

export function RelatedPartiesPanel({ engagementId, readOnly, onFieldChange, planningData }: RelatedPartiesPanelProps) {
  const procedureStatuses = planningData?.relatedPartyProcedures || {};
  const parties: RelatedParty[] = planningData?.identifiedRelatedParties || [];
  const generalNotes = planningData?.relatedPartyNotes || "";

  const updateProcedure = (id: string, checked: boolean) => {
    const updated = { ...procedureStatuses, [id]: checked };
    onFieldChange?.("relatedPartyProcedures", updated);
  };

  const addParty = () => {
    const newParty: RelatedParty = {
      id: `rp-${Date.now()}`,
      name: "",
      relationship: "",
      natureOfTransactions: "",
      volumeEstimate: "",
      riskLevel: "LOW",
      auditResponse: "",
    };
    onFieldChange?.("identifiedRelatedParties", [...parties, newParty]);
  };

  const updateParty = (id: string, field: string, value: string) => {
    const updated = parties.map(p => p.id === id ? { ...p, [field]: value } : p);
    onFieldChange?.("identifiedRelatedParties", updated);
  };

  const removeParty = (id: string) => {
    onFieldChange?.("identifiedRelatedParties", parties.filter(p => p.id !== id));
  };

  const completedCount = Object.values(procedureStatuses).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Related Parties (ISA 550)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Identify related party relationships and transactions, assess associated risks, and plan audit responses.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{completedCount}/{ISA_550_PROCEDURES.length} procedures</Badge>
              <Badge variant="outline" className="text-xs">ISA 550</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Required Procedures (ISA 550)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {ISA_550_PROCEDURES.map((proc) => (
              <div key={proc.id} className={`flex items-start gap-3 p-2 rounded-md border transition-colors ${procedureStatuses[proc.id] ? "border-green-200 bg-green-50/30 dark:bg-green-950/10 dark:border-green-800" : "border-muted hover:bg-muted/30"}`}>
                <Checkbox
                  id={proc.id}
                  checked={!!procedureStatuses[proc.id]}
                  onCheckedChange={(checked) => updateProcedure(proc.id, !!checked)}
                  disabled={readOnly}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <label htmlFor={proc.id} className="text-xs font-medium cursor-pointer">{proc.label}</label>
                </div>
                <Badge variant="secondary" className="text-[9px] flex-shrink-0">{proc.isa}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Identified Related Parties ({parties.length})
            </CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addParty} className="text-xs gap-1.5 h-7">
                <Plus className="h-3.5 w-3.5" />
                Add Party
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {parties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No related parties identified yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add related parties as they are identified during planning</p>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={addParty} className="mt-3 text-xs gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add First Party
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {parties.map((party) => (
                <div key={party.id} className={`p-3 rounded-md border space-y-2 ${party.riskLevel === "HIGH" ? "border-red-200 bg-red-50/20 dark:bg-red-950/10" : party.riskLevel === "MEDIUM" ? "border-amber-200 bg-amber-50/20 dark:bg-amber-950/10" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase">Party Name</Label>
                        <Input
                          value={party.name}
                          onChange={(e) => updateParty(party.id, "name", e.target.value)}
                          placeholder="e.g., ABC Holdings Ltd."
                          className="text-xs h-7 mt-0.5"
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase">Relationship</Label>
                        <Input
                          value={party.relationship}
                          onChange={(e) => updateParty(party.id, "relationship", e.target.value)}
                          placeholder="e.g., Parent company, Director entity"
                          className="text-xs h-7 mt-0.5"
                          disabled={readOnly}
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground uppercase">Risk Level</Label>
                          <Select
                            value={party.riskLevel}
                            onValueChange={(val) => updateParty(party.id, "riskLevel", val)}
                            disabled={readOnly}
                          >
                            <SelectTrigger className="text-xs h-7 mt-0.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LOW" className="text-xs">Low</SelectItem>
                              <SelectItem value="MEDIUM" className="text-xs">Medium</SelectItem>
                              <SelectItem value="HIGH" className="text-xs">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 mt-4 text-muted-foreground hover:text-destructive"
                            onClick={() => removeParty(party.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Nature of Transactions</Label>
                      <Textarea
                        value={party.natureOfTransactions}
                        onChange={(e) => updateParty(party.id, "natureOfTransactions", e.target.value)}
                        placeholder="Sales, purchases, loans, management fees..."
                        className="text-xs min-h-[40px] mt-0.5"
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Planned Audit Response</Label>
                      <Textarea
                        value={party.auditResponse}
                        onChange={(e) => updateParty(party.id, "auditResponse", e.target.value)}
                        placeholder="Verify arm's length, confirm balances, review agreements..."
                        className="text-xs min-h-[40px] mt-0.5"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            General Notes & Observations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generalNotes}
            onChange={(e) => onFieldChange?.("relatedPartyNotes", e.target.value)}
            placeholder="Document overall observations about related party environment, significant unusual transactions, concerns about completeness of identification..."
            className="text-xs min-h-[80px]"
            disabled={readOnly}
          />
        </CardContent>
      </Card>
    </div>
  );
}
