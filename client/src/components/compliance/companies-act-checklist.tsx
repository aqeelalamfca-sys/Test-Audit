import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Link2,
  Scale,
  BookOpen,
  Download,
  Save,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ComplianceStatus = "met" | "partial" | "not_met" | "not_applicable" | "";

interface ChecklistItem {
  id: string;
  sectionRef: string;
  requirement: string;
  status: ComplianceStatus;
  evidenceLink: string;
  notes: string;
}

interface ChecklistGroup {
  id: string;
  title: string;
  description: string;
  items: ChecklistItem[];
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  met: {
    label: "Met",
    variant: "outline",
    className: "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  partial: {
    label: "Partial",
    variant: "outline",
    className: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  not_met: {
    label: "Not Met",
    variant: "outline",
    className: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  not_applicable: {
    label: "N/A",
    variant: "outline",
    className: "bg-muted text-muted-foreground border-border",
  },
};

function StatusIcon({ status }: { status: ComplianceStatus }) {
  if (status === "met") return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
  if (status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  if (status === "not_met") return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return null;
}

function buildInitialGroups(): ChecklistGroup[] {
  return [
    {
      id: "books-of-account",
      title: "S.223 — Books of Account",
      description: "Every company shall keep proper books of account with respect to its affairs",
      items: [
        { id: "s223-1", sectionRef: "S.223(1)", requirement: "Proper books of account maintained at registered office or other place approved by the board", status: "", evidenceLink: "", notes: "" },
        { id: "s223-2", sectionRef: "S.223(2)", requirement: "Books give true and fair view of the state of affairs and explain transactions", status: "", evidenceLink: "", notes: "" },
        { id: "s223-3", sectionRef: "S.223(3)", requirement: "Books of account include records of all sums received/expended and assets/liabilities", status: "", evidenceLink: "", notes: "" },
        { id: "s223-4", sectionRef: "S.223(4)", requirement: "Books maintained on accrual basis and according to double entry system of accounting", status: "", evidenceLink: "", notes: "" },
        { id: "s223-5", sectionRef: "S.223(5)", requirement: "Books preserved for a minimum period of ten years", status: "", evidenceLink: "", notes: "" },
      ],
    },
    {
      id: "fs-preparation",
      title: "S.225 — Financial Statement Preparation",
      description: "Directors shall prepare financial statements for each financial year",
      items: [
        { id: "s225-1", sectionRef: "S.225(1)", requirement: "Directors prepare financial statements for each financial year laid before members in annual general meeting", status: "", evidenceLink: "", notes: "" },
        { id: "s225-2", sectionRef: "S.225(2)", requirement: "Financial statements give true and fair view of state of affairs and profit/loss", status: "", evidenceLink: "", notes: "" },
        { id: "s225-3", sectionRef: "S.225(3)", requirement: "Financial statements comply with Fourth Schedule requirements", status: "", evidenceLink: "", notes: "" },
        { id: "s225-4", sectionRef: "S.225(4)", requirement: "Financial statements prepared in accordance with applicable accounting standards (IFRS/IFRS for SMEs)", status: "", evidenceLink: "", notes: "" },
        { id: "s225-5", sectionRef: "S.225(5)", requirement: "Directors' report attached to financial statements covering prescribed matters", status: "", evidenceLink: "", notes: "" },
        { id: "s225-6", sectionRef: "S.225(6)", requirement: "Statement of compliance with Companies Act 2017 and applicable standards included", status: "", evidenceLink: "", notes: "" },
      ],
    },
    {
      id: "auditor-rights",
      title: "S.226 — Auditor Rights",
      description: "Rights of auditor to access books, accounts and vouchers",
      items: [
        { id: "s226-1", sectionRef: "S.226(1)", requirement: "Auditor has right of access at all times to the books, accounts and vouchers of the company", status: "", evidenceLink: "", notes: "" },
        { id: "s226-2", sectionRef: "S.226(2)", requirement: "Auditor entitled to require from officers of the company such information and explanations as necessary", status: "", evidenceLink: "", notes: "" },
        { id: "s226-3", sectionRef: "S.226(3)", requirement: "Auditor entitled to attend and speak at any general meeting of the company", status: "", evidenceLink: "", notes: "" },
        { id: "s226-4", sectionRef: "S.226(4)", requirement: "Auditor entitled to receive notices of and other communications relating to general meetings", status: "", evidenceLink: "", notes: "" },
        { id: "s226-5", sectionRef: "S.226(5)", requirement: "If company has subsidiaries, auditor has right to access subsidiary books/accounts as necessary", status: "", evidenceLink: "", notes: "" },
      ],
    },
    {
      id: "audit-report",
      title: "S.227 — Audit Report Requirements",
      description: "Auditor shall make a report to the members on accounts and financial statements",
      items: [
        { id: "s227-1", sectionRef: "S.227(1)", requirement: "Auditor report states whether financial statements give true and fair view", status: "", evidenceLink: "", notes: "" },
        { id: "s227-2", sectionRef: "S.227(2)(a)", requirement: "Report states whether proper books of account have been kept by the company", status: "", evidenceLink: "", notes: "" },
        { id: "s227-3", sectionRef: "S.227(2)(b)", requirement: "Report states whether returns adequate for audit received from branches not visited by auditor", status: "", evidenceLink: "", notes: "" },
        { id: "s227-4", sectionRef: "S.227(2)(c)", requirement: "Report states whether financial statements agree with the books of account and returns", status: "", evidenceLink: "", notes: "" },
        { id: "s227-5", sectionRef: "S.227(2)(d)", requirement: "Report includes observations/comments on financial statements affecting working of the company", status: "", evidenceLink: "", notes: "" },
        { id: "s227-6", sectionRef: "S.227(3)", requirement: "Auditor signs report specifying whether qualified or unqualified, with reasons for qualification", status: "", evidenceLink: "", notes: "" },
        { id: "s227-7", sectionRef: "S.227(4)", requirement: "Report includes matters prescribed by SECP through regulations or directives", status: "", evidenceLink: "", notes: "" },
      ],
    },
    {
      id: "auditor-qualifications",
      title: "S.228 — Auditor Qualifications & Independence",
      description: "Qualifications and disqualifications of auditors",
      items: [
        { id: "s228-1", sectionRef: "S.228(1)", requirement: "Auditor is a chartered accountant within the meaning of the Chartered Accountants Ordinance, 1961", status: "", evidenceLink: "", notes: "" },
        { id: "s228-2", sectionRef: "S.228(2)", requirement: "Auditor is not an officer or employee of the company", status: "", evidenceLink: "", notes: "" },
        { id: "s228-3", sectionRef: "S.228(3)", requirement: "Auditor is not a partner of, or in employment of, any officer of the company", status: "", evidenceLink: "", notes: "" },
        { id: "s228-4", sectionRef: "S.228(4)", requirement: "Auditor is not indebted to the company or its subsidiary", status: "", evidenceLink: "", notes: "" },
        { id: "s228-5", sectionRef: "S.228(5)", requirement: "Auditor rotation requirements complied with as applicable under SECP regulations", status: "", evidenceLink: "", notes: "" },
      ],
    },
    {
      id: "related-party",
      title: "S.204–208 — Related Party Transactions",
      description: "Related party transactions disclosure and approval requirements",
      items: [
        { id: "s204-1", sectionRef: "S.204", requirement: "Register of related parties maintained and updated", status: "", evidenceLink: "", notes: "" },
        { id: "s205-1", sectionRef: "S.205(1)", requirement: "Related party transactions conducted at arm's length price", status: "", evidenceLink: "", notes: "" },
        { id: "s205-2", sectionRef: "S.205(2)", requirement: "Prior approval of board of directors obtained for related party transactions", status: "", evidenceLink: "", notes: "" },
        { id: "s206-1", sectionRef: "S.206", requirement: "Interested directors disclosed interest in related party transactions", status: "", evidenceLink: "", notes: "" },
        { id: "s207-1", sectionRef: "S.207", requirement: "Transactions with associated companies/undertakings disclosed in financial statements", status: "", evidenceLink: "", notes: "" },
        { id: "s208-1", sectionRef: "S.208", requirement: "Pricing policy for related party transactions documented and available", status: "", evidenceLink: "", notes: "" },
        { id: "s208-2", sectionRef: "S.208(2)", requirement: "Details of all related party transactions included in directors' report", status: "", evidenceLink: "", notes: "" },
      ],
    },
    {
      id: "dividends-reserves",
      title: "S.233–236 — Dividends & Reserves",
      description: "Distribution of profits and maintenance of reserves",
      items: [
        { id: "s233-1", sectionRef: "S.233(1)", requirement: "Dividends declared only out of profits of the company", status: "", evidenceLink: "", notes: "" },
        { id: "s233-2", sectionRef: "S.233(2)", requirement: "No dividend declared or paid except as recommended by directors and approved by members", status: "", evidenceLink: "", notes: "" },
        { id: "s233-3", sectionRef: "S.233(3)", requirement: "Interim dividend declared only by board of directors in accordance with articles", status: "", evidenceLink: "", notes: "" },
        { id: "s234-1", sectionRef: "S.234", requirement: "Dividend paid only to registered shareholders or their mandatees within prescribed time", status: "", evidenceLink: "", notes: "" },
        { id: "s235-1", sectionRef: "S.235", requirement: "Unpaid dividend transferred to separate bank account within prescribed period", status: "", evidenceLink: "", notes: "" },
        { id: "s236-1", sectionRef: "S.236(1)", requirement: "Reserves created/maintained as required under applicable regulations", status: "", evidenceLink: "", notes: "" },
        { id: "s236-2", sectionRef: "S.236(2)", requirement: "Capitalization of reserves and issue of bonus shares compliant with prescribed conditions", status: "", evidenceLink: "", notes: "" },
      ],
    },
  ];
}

function toBackendStatus(status: ComplianceStatus): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "NOT_APPLICABLE" {
  switch (status) {
    case "met": return "COMPLETED";
    case "partial": return "IN_PROGRESS";
    case "not_met": return "PENDING";
    case "not_applicable": return "NOT_APPLICABLE";
    default: return "PENDING";
  }
}

function fromBackendStatus(status: string): ComplianceStatus {
  switch (status) {
    case "COMPLETED": return "met";
    case "IN_PROGRESS": return "partial";
    case "NOT_APPLICABLE": return "not_applicable";
    default: return "";
  }
}

export function CompaniesActChecklist({ engagementId }: { engagementId?: string }) {
  const [groups, setGroups] = useState<ChecklistGroup[]>(buildInitialGroups);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();

  const savedChecklistQuery = useQuery<any[]>({
    queryKey: ["/api/compliance/checklists", engagementId],
    enabled: !!engagementId,
  });

  useEffect(() => {
    if (!savedChecklistQuery.data?.length) return;
    const saved = savedChecklistQuery.data.find((cl: any) => cl.checklistType === "COMPANIES_ACT_2017");
    if (saved?.items && Array.isArray(saved.items)) {
      setGroups(prev =>
        prev.map(g => ({
          ...g,
          items: g.items.map(item => {
            const s = (saved.items as any[]).find((si: any) => si.ref === item.id);
            if (s) {
              return {
                ...item,
                status: fromBackendStatus(s.status),
                notes: s.notes ?? item.notes,
                evidenceLink: s.evidence ?? item.evidenceLink,
              };
            }
            return item;
          }),
        }))
      );
      setIsDirty(false);
    }
  }, [savedChecklistQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!engagementId) throw new Error("No engagement selected");
      const items = groups.flatMap(g =>
        g.items.map(item => ({
          ref: item.id,
          description: `${item.sectionRef} - ${item.requirement}`,
          status: toBackendStatus(item.status),
          notes: item.notes,
          evidence: item.evidenceLink,
        }))
      );
      await apiRequest("POST", `/api/compliance/checklists/${engagementId}`, {
        checklistType: "COMPANIES_ACT_2017",
        checklistReference: "Companies Act 2017 - Statutory Compliance Checklist",
        items,
      });
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists", engagementId] });
      toast({ title: "Saved", description: "Companies Act checklist saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Save Failed", description: error?.message || "Failed to save checklist.", variant: "destructive" });
    },
  });

  const updateItem = (groupId: string, itemId: string, field: keyof ChecklistItem, value: string) => {
    setGroups(prev =>
      prev.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map(item => {
            if (item.id !== itemId) return item;
            return { ...item, [field]: value };
          }),
        };
      })
    );
    setIsDirty(true);
  };

  const stats = useMemo(() => {
    const all = groups.flatMap(g => g.items);
    const met = all.filter(i => i.status === "met").length;
    const partial = all.filter(i => i.status === "partial").length;
    const notMet = all.filter(i => i.status === "not_met").length;
    const na = all.filter(i => i.status === "not_applicable").length;
    const pending = all.filter(i => !i.status).length;
    const total = all.length;
    const assessed = total - pending;
    const percent = total > 0 ? Math.round((assessed / total) * 100) : 0;
    return { met, partial, notMet, na, pending, total, assessed, percent };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (filterStatus === "all") return groups;
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(i =>
          filterStatus === "pending" ? !i.status : i.status === filterStatus
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [groups, filterStatus]);

  const handleExport = () => {
    const rows = groups.flatMap(g =>
      g.items.map(item => ({
        Group: g.title,
        Section: item.sectionRef,
        Requirement: item.requirement,
        Status: item.status ? STATUS_CONFIG[item.status]?.label || "" : "Pending",
        Evidence: item.evidenceLink,
        Notes: item.notes,
      }))
    );
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => `"${String((r as any)[h] || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "companies-act-2017-checklist.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3" data-testid="companies-act-checklist">
      <div className="flex items-start justify-between gap-2.5 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-checklist-title">
            <Scale className="h-5 w-5 text-primary" />
            Companies Act 2017 — Director Report Checklist
          </h2>
          <p className="text-sm text-muted-foreground">
            Compliance checklist covering key statutory requirements for directors and auditors
          </p>
        </div>
        <div className="flex items-center gap-2">
          {engagementId && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !isDirty}
              className="gap-1.5"
              data-testid="button-save-checklist"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5" data-testid="button-export-checklist">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card data-testid="card-checklist-summary">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <StatBadge label="Met" count={stats.met} className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" />
              <StatBadge label="Partial" count={stats.partial} className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300" />
              <StatBadge label="Not Met" count={stats.notMet} className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300" />
              <StatBadge label="N/A" count={stats.na} className="bg-muted text-muted-foreground" />
              <StatBadge label="Pending" count={stats.pending} className="bg-muted text-muted-foreground" />
            </div>
            <span className="text-sm font-medium tabular-nums" data-testid="text-overall-progress">
              {stats.assessed}/{stats.total} assessed ({stats.percent}%)
            </span>
          </div>
          <Progress value={stats.percent} className="h-2" data-testid="progress-overall" />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="met">Met</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="not_met">Not Met</SelectItem>
            <SelectItem value="not_applicable">N/A</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Accordion type="multiple" defaultValue={filteredGroups.map(g => g.id)} className="space-y-3">
        {filteredGroups.map(group => {
          const groupMet = group.items.filter(i => i.status === "met" || i.status === "not_applicable").length;
          const groupTotal = group.items.length;
          return (
            <AccordionItem key={group.id} value={group.id} className="border rounded-md" data-testid={`group-${group.id}`}>
              <AccordionTrigger className="px-3 py-3 hover:no-underline" data-testid={`trigger-${group.id}`}>
                <div className="flex items-center gap-3 flex-1 text-left">
                  <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{group.title}</div>
                    <div className="text-xs text-muted-foreground">{group.description}</div>
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0" data-testid={`badge-group-progress-${group.id}`}>
                    {groupMet}/{groupTotal}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4">
                <div className="space-y-3">
                  {group.items.map(item => (
                    <div
                      key={item.id}
                      className={`rounded-md border p-2.5 space-y-3 ${
                        item.status === "met"
                          ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20"
                          : item.status === "partial"
                          ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20"
                          : item.status === "not_met"
                          ? "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20"
                          : "border-border"
                      }`}
                      data-testid={`checklist-item-${item.id}`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <StatusIcon status={item.status} />
                          <div className="space-y-1 min-w-0">
                            <Badge variant="outline" className="text-[10px] font-mono" data-testid={`badge-section-ref-${item.id}`}>
                              {item.sectionRef}
                            </Badge>
                            <p className="text-sm leading-snug" data-testid={`text-requirement-${item.id}`}>
                              {item.requirement}
                            </p>
                          </div>
                        </div>

                        <Select
                          value={item.status || undefined}
                          onValueChange={(v) => updateItem(group.id, item.id, "status", v as ComplianceStatus)}
                        >
                          <SelectTrigger className="w-[130px] flex-shrink-0" data-testid={`select-status-${item.id}`}>
                            <SelectValue placeholder="Select status">
                              {item.status && STATUS_CONFIG[item.status] ? (
                                <Badge variant={STATUS_CONFIG[item.status].variant} className={`text-xs ${STATUS_CONFIG[item.status].className}`}>
                                  {STATUS_CONFIG[item.status].label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">Select</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="met">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                Met
                              </div>
                            </SelectItem>
                            <SelectItem value="partial">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                Partial
                              </div>
                            </SelectItem>
                            <SelectItem value="not_met">
                              <div className="flex items-center gap-1.5">
                                <XCircle className="h-3.5 w-3.5 text-red-600" />
                                Not Met
                              </div>
                            </SelectItem>
                            <SelectItem value="not_applicable">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                N/A
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <Input
                            value={item.evidenceLink}
                            onChange={(e) => updateItem(group.id, item.id, "evidenceLink", e.target.value)}
                            placeholder="Evidence reference or link..."
                            className="text-sm"
                            data-testid={`input-evidence-${item.id}`}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <Input
                            value={item.notes}
                            onChange={(e) => updateItem(group.id, item.id, "notes", e.target.value)}
                            placeholder="Notes..."
                            className="text-sm"
                            data-testid={`input-notes-${item.id}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function StatBadge({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${className}`} data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <span className="font-semibold tabular-nums">{count}</span>
      {label}
    </div>
  );
}
