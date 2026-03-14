import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText, Download, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Search, BookOpen, Table2, ClipboardCheck, AlertCircle, Info, Settings,
  Eye, List, Building, Scale
} from "lucide-react";
import type { DraftFSData, CoAAccountData, FSPriorYear, TrialBalanceData } from "../planning/fs-types";
import type { EntityProfile, ReportingFramework, CompanyType, ListingStatus } from "./notes-disclosure-registry";
import { determineFramework, buildDefaultEntityProfile } from "./notes-disclosure-registry";
import type { DisclosurePackage, GeneratedNoteContent, GeneratedTable, ChecklistEntry, MissingInfoItem } from "./notes-disclosure-generator";
import { buildDisclosurePackage, formatCurrency, getFrameworkLabel, getCompanyTypeLabel } from "./notes-disclosure-generator";
import { useAuth } from "@/lib/auth";

interface NotesDisclosurePanelProps {
  draftFsData: DraftFSData | undefined;
  coaAccounts: CoAAccountData[];
  fsPriorYear: FSPriorYear | undefined;
  trialBalance: TrialBalanceData | undefined;
  engagementId: string;
  clientName: string;
  periodEnd: string;
  entityType?: string;
  industry?: string;
  secpNo?: string;
  fileStatus?: 'open' | 'locked';
}

const CATEGORY_LABELS: Record<string, string> = {
  general_info: 'General',
  accounting_policies: 'Policies',
  critical_estimates: 'Estimates',
  balance_sheet: 'Balance Sheet',
  profit_loss: 'Profit & Loss',
  cash_flow: 'Cash Flow',
  equity: 'Equity',
  related_parties: 'Related Parties',
  contingencies: 'Contingencies',
  commitments: 'Commitments',
  events_after: 'Subsequent Events',
  going_concern: 'Going Concern',
  other_mandatory: 'Other',
};

const TOGGLE_FIELDS: { key: keyof EntityProfile; label: string }[] = [
  { key: 'hasSubsidiaries', label: 'Subsidiaries' },
  { key: 'hasAssociates', label: 'Associates' },
  { key: 'hasLeases', label: 'Leases' },
  { key: 'hasEmployeeBenefits', label: 'Employee Benefits' },
  { key: 'hasBorrowings', label: 'Borrowings' },
  { key: 'hasRelatedPartyTransactions', label: 'Related Party Txns' },
  { key: 'hasTaxation', label: 'Taxation' },
  { key: 'hasContingencies', label: 'Contingencies' },
  { key: 'hasCommitments', label: 'Commitments' },
  { key: 'hasGovernmentGrants', label: 'Govt Grants' },
  { key: 'hasForeignCurrency', label: 'Foreign Currency' },
  { key: 'isRegulated', label: 'Regulated Entity' },
  { key: 'isNPO', label: 'Not-for-Profit' },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'complete':
      return <Badge variant="default" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />Complete</Badge>;
    case 'partial':
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>;
    case 'missing_data':
    case 'missing':
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}><AlertTriangle className="w-3 h-3 mr-1" />Missing Data</Badge>;
    case 'not_applicable':
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>N/A</Badge>;
    case 'required':
      return <Badge variant="default" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />Required</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <Badge variant="destructive" data-testid={`badge-severity-${severity}`}>Critical</Badge>;
    case 'important':
      return <Badge variant="default" data-testid={`badge-severity-${severity}`}>Important</Badge>;
    case 'optional':
      return <Badge variant="outline" data-testid={`badge-severity-${severity}`}>Optional</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

function CompletenessBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2" data-testid="completeness-bar">
      <div className="w-20 h-2 rounded-full bg-muted overflow-visible">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}

function renderNarrative(text: string) {
  const paragraphs = text.split('\n').filter(Boolean);
  return paragraphs.map((p, i) => {
    const parts = p.split(/(\[[\w]+\])/g);
    return (
      <p key={i} className="mb-2 text-sm leading-relaxed">
        {parts.map((part, j) => {
          if (/^\[[\w]+\]$/.test(part)) {
            return (
              <span key={j} className="px-1 py-0.5 rounded text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 font-mono text-xs">
                {part}
              </span>
            );
          }
          return <span key={j}>{part}</span>;
        })}
      </p>
    );
  });
}

function formatCellValue(value: string | number | null, format?: string): string {
  if (value === null || value === undefined) return '-';
  if (format === 'currency' && typeof value === 'number') return formatCurrency(value);
  if (format === 'percentage' && typeof value === 'number') return `${value}%`;
  return String(value);
}

export function NotesDisclosurePanel({
  draftFsData,
  coaAccounts,
  fsPriorYear,
  trialBalance,
  engagementId,
  clientName,
  periodEnd,
  entityType,
  industry,
  secpNo,
  fileStatus = 'open',
}: NotesDisclosurePanelProps) {
  const { firm } = useAuth();
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('notes-index');
  const [notesSearch, setNotesSearch] = useState('');
  const [selectedNoteKey, setSelectedNoteKey] = useState<string | null>(null);

  const [profile, setProfile] = useState<EntityProfile>(() => {
    const detected = determineFramework(entityType, industry, secpNo);
    const defaults = buildDefaultEntityProfile();
    return { ...defaults, ...detected, industry: industry || '' };
  });

  const updateProfile = useCallback(<K extends keyof EntityProfile>(key: K, value: EntityProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  }, []);

  const disclosurePackage = useMemo<DisclosurePackage>(() => {
    return buildDisclosurePackage(
      profile,
      draftFsData,
      coaAccounts,
      fsPriorYear,
      trialBalance,
      clientName,
      periodEnd,
      engagementId,
    );
  }, [profile, draftFsData, coaAccounts, fsPriorYear, trialBalance, clientName, periodEnd, engagementId]);

  const stats = disclosurePackage.statistics;
  const applicableNotes = disclosurePackage.notes.filter(n => n.isApplicable);

  const filteredNotes = useMemo(() => {
    if (!notesSearch.trim()) return applicableNotes;
    const q = notesSearch.toLowerCase();
    return applicableNotes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.noteNumber.includes(q) ||
      n.key.toLowerCase().includes(q)
    );
  }, [applicableNotes, notesSearch]);

  const allTables = useMemo(() => {
    const result: { noteNumber: string; noteTitle: string; table: GeneratedTable }[] = [];
    for (const note of applicableNotes) {
      for (const table of note.tables) {
        result.push({ noteNumber: note.noteNumber, noteTitle: note.title, table });
      }
    }
    return result;
  }, [applicableNotes]);

  const handleScrollToNote = useCallback((noteKey: string) => {
    setActiveTab('draft-notes');
    setSelectedNoteKey(noteKey);
    setTimeout(() => {
      const el = document.getElementById(`note-${noteKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const handleDownload = useCallback(() => {
    const firmName = firm?.displayName || firm?.name || "AuditWise";
    const lines: string[] = [];
    lines.push(firmName);
    lines.push('');
    lines.push(`NOTES TO THE FINANCIAL STATEMENTS`);
    lines.push(`${clientName}`);
    lines.push(`For the year ended ${periodEnd}`);
    lines.push(`Framework: ${disclosurePackage.frameworkLabel}`);
    lines.push(`Generated: ${disclosurePackage.generatedAt}`);
    lines.push('');
    lines.push('='.repeat(80));
    lines.push('');

    for (const note of applicableNotes) {
      lines.push(`${note.noteNumber}. ${note.title}`);
      lines.push(`   [${note.ifrsReference}]`);
      lines.push('');
      lines.push(note.narrativeText);
      lines.push('');

      if (note.subItems.length > 0) {
        for (const item of note.subItems) {
          const cy = item.currentYear !== null ? String(item.currentYear) : '-';
          const py = item.priorYear !== null ? String(item.priorYear) : '-';
          lines.push(`   ${item.label}: ${cy} (Prior: ${py})`);
        }
        lines.push('');
      }

      if (note.missingFields.length > 0) {
        lines.push(`   Missing: ${note.missingFields.join(', ')}`);
        lines.push('');
      }

      lines.push('-'.repeat(40));
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(firm?.displayName || firm?.name || 'AuditWise').replace(/\s+/g, '_')}_notes-disclosures-${clientName.replace(/\s+/g, '-')}-${periodEnd}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [applicableNotes, clientName, periodEnd, disclosurePackage]);

  if (!draftFsData && coaAccounts.length === 0) {
    return (
      <div className="text-center py-2 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">Financial data not yet available</p>
        <p className="text-sm">Complete the Financial Statements in Planning phase and map your Chart of Accounts before generating Notes & Disclosures.</p>
      </div>
    );
  }

  if (!draftFsData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-2.5">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center" data-testid="text-no-fs-data">
            Financial data not yet available. Please complete the Draft Financial Statements first.
          </p>
        </CardContent>
      </Card>
    );
  }

  const completenessVariant: "default" | "secondary" | "destructive" = stats.overallCompleteness >= 80
    ? 'default'
    : stats.overallCompleteness >= 50
    ? 'secondary'
    : 'destructive';

  return (
    <div className="space-y-2.5" data-testid="notes-disclosure-panel">
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center justify-between gap-2 space-y-0 pb-2" data-testid="button-toggle-config">
              <div className="flex items-center gap-2 flex-wrap">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">Entity Profile Configuration</CardTitle>
                <Badge variant="secondary">{getFrameworkLabel(profile.reportingFramework).split('(')[0].trim()}</Badge>
                <Badge variant="outline">{getCompanyTypeLabel(profile.companyType)}</Badge>
              </div>
              {configOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">Reporting Framework</label>
                  <Select
                    value={profile.reportingFramework}
                    onValueChange={(v) => updateProfile('reportingFramework', v as ReportingFramework)}
                    data-testid="select-framework"
                  >
                    <SelectTrigger data-testid="select-framework-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_ifrs">Full IFRS</SelectItem>
                      <SelectItem value="ifrs_sme">IFRS for SMEs</SelectItem>
                      <SelectItem value="companies_act_2017">Companies Act 2017</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">Company Type</label>
                  <Select
                    value={profile.companyType}
                    onValueChange={(v) => updateProfile('companyType', v as CompanyType)}
                    data-testid="select-company-type"
                  >
                    <SelectTrigger data-testid="select-company-type-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="public_unlisted">Public Unlisted</SelectItem>
                      <SelectItem value="listed">Listed</SelectItem>
                      <SelectItem value="section_42_npo">Section 42 NPO</SelectItem>
                      <SelectItem value="regulated_bank">Regulated Bank</SelectItem>
                      <SelectItem value="regulated_nbfc">Regulated NBFC</SelectItem>
                      <SelectItem value="regulated_insurance">Regulated Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">Listing Status</label>
                  <Select
                    value={profile.listingStatus}
                    onValueChange={(v) => updateProfile('listingStatus', v as ListingStatus)}
                    data-testid="select-listing-status"
                  >
                    <SelectTrigger data-testid="select-listing-status-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="listed">Listed</SelectItem>
                      <SelectItem value="public_unlisted">Public Unlisted</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="npo">NPO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Entity Characteristics</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {TOGGLE_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`toggle-${key}`}
                        checked={!!profile[key]}
                        onCheckedChange={(checked) => updateProfile(key, !!checked as never)}
                        data-testid={`checkbox-${key}`}
                      />
                      <label htmlFor={`toggle-${key}`} className="text-sm cursor-pointer select-none">
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardContent className="py-3 px-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="text-sm font-medium" data-testid="text-total-notes">{stats.totalNotes}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Applicable:</span>
              <span className="text-sm font-medium" data-testid="text-applicable-notes">{stats.applicableNotes}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-sm" data-testid="text-complete-notes">{stats.completeNotes}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-sm" data-testid="text-partial-notes">{stats.partialNotes}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-sm" data-testid="text-missing-notes">{stats.missingDataNotes}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">N/A:</span>
              <span className="text-sm" data-testid="text-na-notes">{stats.notApplicableNotes}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant={completenessVariant} data-testid="badge-overall-completeness">
              {stats.overallCompleteness}% Complete
            </Badge>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Missing Items:</span>
              <span className="text-sm font-medium" data-testid="text-total-missing">{stats.totalMissingItems}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Critical:</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400" data-testid="text-critical-missing">{stats.criticalMissing}</span>
            </div>
            <div className="ml-auto">
              <Button size="sm" variant="outline" onClick={handleDownload} data-testid="button-download-notes">
                <Download className="w-4 h-4 mr-1" />
                Download Notes Draft
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="notes-index" data-testid="tab-notes-index" className="gap-1">
            <List className="w-4 h-4" />Notes Index
          </TabsTrigger>
          <TabsTrigger value="draft-notes" data-testid="tab-draft-notes" className="gap-1">
            <BookOpen className="w-4 h-4" />Draft Notes
          </TabsTrigger>
          <TabsTrigger value="tables-schedules" data-testid="tab-tables-schedules" className="gap-1">
            <Table2 className="w-4 h-4" />Tables & Schedules
          </TabsTrigger>
          <TabsTrigger value="disclosure-checklist" data-testid="tab-disclosure-checklist" className="gap-1">
            <ClipboardCheck className="w-4 h-4" />Disclosure Checklist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes-index" className="mt-2.5">
          <NotesIndexTab
            noteIndex={disclosurePackage.noteIndex}
            onScrollToNote={handleScrollToNote}
          />
        </TabsContent>

        <TabsContent value="draft-notes" className="mt-2.5">
          <DraftNotesTab
            notes={filteredNotes}
            search={notesSearch}
            onSearchChange={setNotesSearch}
            selectedNoteKey={selectedNoteKey}
          />
        </TabsContent>

        <TabsContent value="tables-schedules" className="mt-2.5">
          <TablesSchedulesTab tables={allTables} />
        </TabsContent>

        <TabsContent value="disclosure-checklist" className="mt-2.5">
          <DisclosureChecklistTab
            checklist={disclosurePackage.checklist}
            missingInfo={disclosurePackage.missingInfo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotesIndexTab({
  noteIndex,
  onScrollToNote,
}: {
  noteIndex: DisclosurePackage['noteIndex'];
  onScrollToNote: (key: string) => void;
}) {
  const applicableNotes = noteIndex.filter(n => n.status !== 'not_applicable');
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <List className="w-4 h-4" />
          Notes Index
        </CardTitle>
        <CardDescription>{applicableNotes.length} applicable notes</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Note</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-28">Category</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-32">Completeness</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applicableNotes.map((note) => (
              <TableRow
                key={note.noteNumber}
                className="cursor-pointer hover-elevate"
                onClick={() => onScrollToNote(note.noteNumber)}
                data-testid={`row-note-index-${note.noteNumber}`}
              >
                <TableCell className="font-medium">{note.noteNumber}</TableCell>
                <TableCell>{note.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[note.category] || note.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={note.status} />
                </TableCell>
                <TableCell>
                  <CompletenessBar value={note.dataCompleteness} />
                </TableCell>
              </TableRow>
            ))}
            {applicableNotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-2">
                  No applicable notes found for the current entity profile.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DraftNotesTab({
  notes,
  search,
  onSearchChange,
  selectedNoteKey,
}: {
  notes: GeneratedNoteContent[];
  search: string;
  onSearchChange: (v: string) => void;
  selectedNoteKey: string | null;
}) {
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => {
    if (selectedNoteKey) return new Set([selectedNoteKey]);
    return new Set<string>();
  });

  const toggleNote = useCallback((key: string) => {
    setOpenNotes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search notes by title or number..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-search-notes"
        />
      </div>

      {notes.length === 0 && (
        <Card>
          <CardContent className="py-2 text-center text-muted-foreground">
            {search ? 'No notes match your search.' : 'No applicable notes found.'}
          </CardContent>
        </Card>
      )}

      {notes.map((note) => (
        <div key={note.key} id={`note-${note.noteNumber}`}>
          <Collapsible open={openNotes.has(note.key)} onOpenChange={() => toggleNote(note.key)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader
                  className="cursor-pointer flex flex-row items-center justify-between gap-2 space-y-0 pb-2"
                  data-testid={`button-toggle-note-${note.noteNumber}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {openNotes.has(note.key) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-semibold text-sm">Note {note.noteNumber}</span>
                    <span className="text-sm">{note.title}</span>
                    <Badge variant="outline" className="text-xs">{note.ifrsReference}</Badge>
                    {note.missingFields.length > 0 && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="w-3 h-3" />{note.missingFields.length} missing
                      </Badge>
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2.5">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {renderNarrative(note.narrativeText)}
                  </div>

                  {note.subItems.length > 0 && (
                    <>
                      <Separator />
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Current Year</TableHead>
                            <TableHead className="text-right">Prior Year</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {note.subItems.map((item, idx) => (
                            <TableRow key={idx} data-testid={`row-subitem-${note.noteNumber}-${idx}`}>
                              <TableCell className="flex items-center gap-1">
                                {item.isMissing && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                                {item.label}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {item.currentYear !== null ? (
                                  item.format === 'currency' && typeof item.currentYear === 'number'
                                    ? formatCurrency(item.currentYear)
                                    : String(item.currentYear)
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {item.priorYear !== null ? (
                                  item.format === 'currency' && typeof item.priorYear === 'number'
                                    ? formatCurrency(item.priorYear)
                                    : String(item.priorYear)
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}

                  {note.tables.map((table, tIdx) => (
                    <div key={tIdx} className="space-y-2">
                      <Separator />
                      <p className="text-sm font-medium">{table.title}</p>
                      <RenderedTable table={table} noteNumber={note.noteNumber} tableIndex={tIdx} />
                    </div>
                  ))}

                  {note.missingFields.length > 0 && (
                    <>
                      <Separator />
                      <div className="rounded-md bg-destructive/10 p-3 space-y-1">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          Missing Fields
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {note.missingFields.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      ))}
    </div>
  );
}

function RenderedTable({
  table,
  noteNumber,
  tableIndex,
}: {
  table: GeneratedTable;
  noteNumber: string;
  tableIndex: number;
}) {
  if (table.isEmpty) {
    return (
      <div className="rounded-md border border-dashed p-2.5 text-center text-muted-foreground text-sm" data-testid={`table-empty-${noteNumber}-${tableIndex}`}>
        <Info className="w-4 h-4 mx-auto mb-1" />
        No data available for this table.
        {table.footnotes.length > 0 && (
          <p className="mt-1 text-xs">{table.footnotes[0]}</p>
        )}
      </div>
    );
  }

  return (
    <div data-testid={`table-data-${noteNumber}-${tableIndex}`}>
      <Table>
        <TableHeader>
          <TableRow>
            {table.columns.map((col) => (
              <TableHead key={col.key} className={col.format === 'currency' || col.format === 'percentage' ? 'text-right' : ''}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, rIdx) => (
            <TableRow key={rIdx}>
              {table.columns.map((col) => (
                <TableCell key={col.key} className={col.format === 'currency' || col.format === 'percentage' ? 'text-right font-mono text-sm' : ''}>
                  {formatCellValue(row[col.key], col.format)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {table.footnotes.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {table.footnotes.map((fn, i) => (
            <p key={i} className="text-xs text-muted-foreground italic">{fn}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function TablesSchedulesTab({
  tables,
}: {
  tables: { noteNumber: string; noteTitle: string; table: GeneratedTable }[];
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { noteNumber: string; noteTitle: string; table: GeneratedTable }[]>();
    for (const entry of tables) {
      const key = `${entry.noteNumber} - ${entry.noteTitle}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return map;
  }, [tables]);

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="py-2 text-center text-muted-foreground">
          <Table2 className="w-8 h-8 mx-auto mb-2" />
          No tables or schedules generated for the current profile.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {Array.from(grouped.entries()).map(([groupKey, entries]) => (
        <Card key={groupKey}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Table2 className="w-4 h-4" />
              Note {groupKey}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {entries.map((entry, idx) => (
              <div key={idx} className="space-y-2">
                <p className="text-sm font-medium">{entry.table.title}</p>
                <RenderedTable table={entry.table} noteNumber={entry.noteNumber} tableIndex={idx} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DisclosureChecklistTab({
  checklist,
  missingInfo,
}: {
  checklist: ChecklistEntry[];
  missingInfo: MissingInfoItem[];
}) {
  const required = checklist.filter(c => c.status === 'required');
  const notApplicable = checklist.filter(c => c.status === 'not_applicable');

  const criticalItems = missingInfo.filter(m => m.severity === 'critical');
  const importantItems = missingInfo.filter(m => m.severity === 'important');
  const optionalItems = missingInfo.filter(m => m.severity === 'optional');

  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Required Disclosures
          </CardTitle>
          <CardDescription>{required.length} required disclosure notes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Note</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-32">IFRS Ref</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24">Data</TableHead>
                <TableHead>Missing Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {required.map((entry) => (
                <TableRow key={entry.noteNumber} data-testid={`row-checklist-req-${entry.noteNumber}`}>
                  <TableCell className="font-medium">{entry.noteNumber}</TableCell>
                  <TableCell>
                    <div>
                      <span className="text-sm">{entry.noteTitle}</span>
                      {entry.rationale && (
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.rationale}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{entry.ifrsReference}</Badge></TableCell>
                  <TableCell><StatusBadge status={entry.status} /></TableCell>
                  <TableCell><StatusBadge status={entry.dataStatus} /></TableCell>
                  <TableCell>
                    {entry.missingItems.length > 0 ? (
                      <ul className="list-disc list-inside text-xs text-muted-foreground">
                        {entry.missingItems.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {required.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-3">No required disclosures.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {notApplicable.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4" />
              Not Applicable Disclosures
            </CardTitle>
            <CardDescription>{notApplicable.length} notes deemed not applicable</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Note</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-32">IFRS Ref</TableHead>
                  <TableHead>Rationale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notApplicable.map((entry) => (
                  <TableRow key={entry.noteNumber} data-testid={`row-checklist-na-${entry.noteNumber}`}>
                    <TableCell className="font-medium">{entry.noteNumber}</TableCell>
                    <TableCell className="text-sm">{entry.noteTitle}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{entry.ifrsReference}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.rationale || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {missingInfo.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Missing Information Summary
            </CardTitle>
            <CardDescription>
              {criticalItems.length} critical, {importantItems.length} important, {optionalItems.length} optional
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { label: 'Critical', items: criticalItems, severity: 'critical' as const },
              { label: 'Important', items: importantItems, severity: 'important' as const },
              { label: 'Optional', items: optionalItems, severity: 'optional' as const },
            ].map(({ label, items, severity }) =>
              items.length > 0 ? (
                <div key={severity} className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <SeverityBadge severity={severity} />
                    {label} ({items.length})
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Note</TableHead>
                        <TableHead className="w-36">Field</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24">Severity</TableHead>
                        <TableHead>Suggested Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow key={`${item.noteNumber}-${item.field}-${idx}`} data-testid={`row-missing-${severity}-${idx}`}>
                          <TableCell className="font-medium">{item.noteNumber}</TableCell>
                          <TableCell className="text-sm">{item.field}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.description}</TableCell>
                          <TableCell><SeverityBadge severity={item.severity} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.suggestedSource || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
