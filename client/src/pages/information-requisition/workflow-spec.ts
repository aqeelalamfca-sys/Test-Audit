export type WorkflowTabKey = 'upload' | 'tb' | 'gl' | 'ap' | 'ar' | 'bank' | 'confirmations' | 'mapping' | 'draft-fs' | 'checks';

export type TabStatus = 'NOT_STARTED' | 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';

export interface TabPhaseState {
  tabKey: WorkflowTabKey;
  status: TabStatus;
  version: number;
  lastCompletedAt: string | null;
  lastModifiedAt: string | null;
  upstreamDirty: boolean;
  upstreamChangedTabs: WorkflowTabKey[];
  gatesPassed: boolean;
  outputVersion: number;
  completionPercent: number;
}

export interface PhaseEngineState {
  tabs: Record<WorkflowTabKey, TabPhaseState>;
  activeTab: WorkflowTabKey;
  canProceed: boolean;
  blockingReasons: string[];
  lastComputedAt: string;
}

export interface AIProposal {
  id: string;
  tabKey: WorkflowTabKey;
  proposalType: 'MAPPING' | 'CLASSIFICATION' | 'RISK_ASSESSMENT' | 'PROCEDURE' | 'CORRECTION';
  title: string;
  description: string;
  status: 'PROPOSED' | 'REVIEWED' | 'APPROVED' | 'APPLIED' | 'REJECTED';
  proposedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  appliedAt: string | null;
  changes: AIProposedChange[];
  confidence: number;
  reasoning: string;
}

export interface AIProposedChange {
  field: string;
  entityId: string;
  entityType: string;
  currentValue: string | null;
  proposedValue: string;
  reason: string;
}

export interface DataSource {
  datasetId: string | null;
  datasetType: string;
  version: number;
  fileName: string | null;
  lastSynced: string | null;
  status: 'CURRENT' | 'STALE' | 'MISSING';
  rowCount: number;
}

export type BreakSeverity = 'HIGH' | 'MEDIUM';
export type BreakCategory =
  | 'MISSING_TB' | 'MISSING_GL'
  | 'UNMAPPED_GL_FS' | 'TIEOUT_FAIL'
  | 'ORPHAN_CONFIRMATION' | 'UNMAPPED_ACCOUNT'
  | 'STALE_SYNC' | 'MISSING_METADATA'
  | 'UNBALANCED_TB' | 'TB_GL_MISMATCH'
  | 'MISSING_AP_CONTROL' | 'MISSING_AR_CONTROL';

export interface LinkBreak {
  id: string;
  category: BreakCategory;
  severity: BreakSeverity;
  message: string;
  sourceTab: WorkflowTabKey;
  targetTab: WorkflowTabKey | null;
  accountCode?: string;
  autoFixable: boolean;
  fixAction?: string;
  status: 'OPEN' | 'AUTO_FIXED' | 'NEEDS_REVIEW' | 'RESOLVED';
}

export interface TabGate {
  gateId: string;
  label: string;
  description: string;
  check: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
  blocking: boolean;
  isaRef?: string;
}

export interface PullSource {
  fromTab: WorkflowTabKey;
  dataType: string;
  description: string;
  required: boolean;
}

export interface PushTarget {
  toTab: WorkflowTabKey | 'planning' | 'fs-heads' | 'execution';
  dataType: string;
  description: string;
  gated: boolean;
}

export interface TabWorkflowConfig {
  key: WorkflowTabKey;
  label: string;
  icon: string;
  order: number;
  phase: 'data-upload' | 'validation' | 'mapping' | 'output';
  pulls: PullSource[];
  pushes: PushTarget[];
  gates: TabGate[];
  contextualActions: { id: string; label: string; icon: string }[];
  nextTab: WorkflowTabKey | null;
  prevTab: WorkflowTabKey | null;
}

export interface MappingVersion {
  id: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'LOCKED';
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  snapshotId: string | null;
  totalMapped: number;
  totalAccounts: number;
  completeness: number;
}

export interface PushForwardPayload {
  mappingVersionId: string;
  snapshotId: string;
  materialityInputs: {
    totalAssets: number;
    totalRevenue: number;
    profitBeforeTax: number;
  };
  fsHeadPopulations: { fsHeadKey: string; population: number; accountCount: number }[];
  riskInputs: { fsHeadKey: string; inherentRisk: 'HIGH' | 'MEDIUM' | 'LOW' }[];
}

export const BREAK_DEFINITIONS: Record<BreakCategory, { severity: BreakSeverity; defaultMessage: string; sourceTab: WorkflowTabKey; targetTab: WorkflowTabKey | null; autoFixable: boolean; fixAction?: string }> = {
  MISSING_TB: {
    severity: 'HIGH',
    defaultMessage: 'Trial Balance data has not been uploaded. Upload a TB dataset to proceed with reconciliation.',
    sourceTab: 'tb',
    targetTab: 'upload',
    autoFixable: false,
  },
  MISSING_GL: {
    severity: 'HIGH',
    defaultMessage: 'General Ledger data has not been uploaded. Upload GL entries to enable TB-GL tie-out.',
    sourceTab: 'gl',
    targetTab: 'upload',
    autoFixable: false,
  },
  UNMAPPED_GL_FS: {
    severity: 'MEDIUM',
    defaultMessage: 'One or more GL account codes are not mapped to an FS line item. Map all accounts before generating Draft FS.',
    sourceTab: 'mapping',
    targetTab: 'draft-fs',
    autoFixable: true,
    fixAction: 'Run AI auto-mapping to suggest FS line assignments for unmapped accounts.',
  },
  TIEOUT_FAIL: {
    severity: 'HIGH',
    defaultMessage: 'TB period movement does not tie to GL total debits/credits for one or more accounts.',
    sourceTab: 'gl',
    targetTab: 'tb',
    autoFixable: false,
  },
  ORPHAN_CONFIRMATION: {
    severity: 'MEDIUM',
    defaultMessage: 'A confirmation record exists without a matching AP, AR, or Bank source entry.',
    sourceTab: 'confirmations',
    targetTab: null,
    autoFixable: true,
    fixAction: 'Remove orphaned confirmation records that have no linked source balance.',
  },
  UNMAPPED_ACCOUNT: {
    severity: 'MEDIUM',
    defaultMessage: 'One or more TB accounts have no FS Head mapping assigned.',
    sourceTab: 'mapping',
    targetTab: 'tb',
    autoFixable: true,
    fixAction: 'Run AI auto-mapping to assign FS Head mappings based on account code and name patterns.',
  },
  STALE_SYNC: {
    severity: 'MEDIUM',
    defaultMessage: 'Data was modified after the last validation run. Re-run validation to refresh results.',
    sourceTab: 'upload',
    targetTab: null,
    autoFixable: true,
    fixAction: 'Trigger a re-validation run to synchronize results with current data.',
  },
  MISSING_METADATA: {
    severity: 'MEDIUM',
    defaultMessage: 'Required metadata fields (e.g., account class, nature) are missing on one or more TB accounts.',
    sourceTab: 'tb',
    targetTab: 'mapping',
    autoFixable: true,
    fixAction: 'Auto-populate missing metadata fields using account code pattern recognition.',
  },
  UNBALANCED_TB: {
    severity: 'HIGH',
    defaultMessage: 'Trial Balance does not balance — total debits do not equal total credits.',
    sourceTab: 'tb',
    targetTab: 'upload',
    autoFixable: false,
  },
  TB_GL_MISMATCH: {
    severity: 'HIGH',
    defaultMessage: 'Aggregate TB movement amounts do not match GL totals. Investigate period-end adjustments.',
    sourceTab: 'gl',
    targetTab: 'tb',
    autoFixable: false,
  },
  MISSING_AP_CONTROL: {
    severity: 'MEDIUM',
    defaultMessage: 'AP sub-ledger total does not reconcile to the AP control account in the GL.',
    sourceTab: 'ap',
    targetTab: 'gl',
    autoFixable: false,
  },
  MISSING_AR_CONTROL: {
    severity: 'MEDIUM',
    defaultMessage: 'AR sub-ledger total does not reconcile to the AR control account in the GL.',
    sourceTab: 'ar',
    targetTab: 'gl',
    autoFixable: false,
  },
};

export const WORKFLOW_TABS: TabWorkflowConfig[] = [
  {
    key: 'upload',
    label: 'Upload',
    icon: 'Upload',
    order: 0,
    phase: 'data-upload',
    pulls: [],
    pushes: [
      { toTab: 'tb', dataType: 'tb_dataset', description: 'Uploaded Trial Balance data pushed to TB tab for review', gated: false },
      { toTab: 'gl', dataType: 'gl_dataset', description: 'Uploaded General Ledger data pushed to GL tab for review', gated: false },
      { toTab: 'ap', dataType: 'ap_dataset', description: 'Uploaded Accounts Payable data pushed to AP tab for review', gated: false },
      { toTab: 'ar', dataType: 'ar_dataset', description: 'Uploaded Accounts Receivable data pushed to AR tab for review', gated: false },
      { toTab: 'bank', dataType: 'bank_dataset', description: 'Uploaded Bank data pushed to Bank tab for review', gated: false },
    ],
    gates: [
      { gateId: 'upload-has-data', label: 'Upload Data Present', description: 'At least one dataset has been uploaded and parsed successfully.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 500' },
    ],
    contextualActions: [
      { id: 'upload-dataset', label: 'Upload Dataset', icon: 'Upload' },
      { id: 'download-template', label: 'Download Template', icon: 'Download' },
    ],
    nextTab: 'tb',
    prevTab: null,
  },
  {
    key: 'tb',
    label: 'Trial Balance',
    icon: 'FileSpreadsheet',
    order: 1,
    phase: 'data-upload',
    pulls: [
      { fromTab: 'upload', dataType: 'tb_dataset', description: 'Uploaded Trial Balance dataset from Upload tab', required: true },
    ],
    pushes: [
      { toTab: 'gl', dataType: 'tb_accounts', description: 'Account codes and period movements for TB-GL tie-out reconciliation', gated: true },
      { toTab: 'mapping', dataType: 'tb_accounts', description: 'Full account list with balances for CoA-to-FS Head mapping', gated: true },
    ],
    gates: [
      { gateId: 'tb-uploaded', label: 'TB Uploaded', description: 'Trial Balance dataset has been uploaded and parsed with at least one account row.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 500' },
      { gateId: 'tb-balanced', label: 'TB Balanced (Dr = Cr)', description: 'Total closing debits equal total closing credits within rounding tolerance.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 500' },
      { gateId: 'tb-no-critical', label: 'No Critical Validation Errors', description: 'No critical-severity validation exceptions exist on the TB dataset.', check: 'NOT_RUN', blocking: false, isaRef: 'ISA 500' },
    ],
    contextualActions: [
      { id: 'export-csv', label: 'Export CSV', icon: 'Download' },
    ],
    nextTab: 'gl',
    prevTab: 'upload',
  },
  {
    key: 'gl',
    label: 'General Ledger',
    icon: 'Database',
    order: 2,
    phase: 'data-upload',
    pulls: [
      { fromTab: 'tb', dataType: 'tb_accounts', description: 'Account codes and period movements from TB for reconciliation matching', required: true },
    ],
    pushes: [
      { toTab: 'upload', dataType: 'gl_entries', description: 'GL debit/credit totals per account for TB-GL tie-out validation', gated: true },
      { toTab: 'confirmations', dataType: 'gl_entries', description: 'GL transaction details for confirmation letter supporting schedules', gated: false },
    ],
    gates: [
      { gateId: 'gl-uploaded', label: 'GL Uploaded', description: 'General Ledger dataset has been uploaded and parsed with at least one entry.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 500' },
      { gateId: 'gl-balanced', label: 'GL Balanced', description: 'Total GL debits equal total GL credits across all entries.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 500' },
      { gateId: 'gl-tb-tieout', label: 'TB-GL Tie-out Pass', description: 'Per-account GL movement totals match TB period movement within tolerance.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 500' },
    ],
    contextualActions: [
      { id: 'export-csv', label: 'Export CSV', icon: 'Download' },
    ],
    nextTab: 'ap',
    prevTab: 'tb',
  },
  {
    key: 'ap',
    label: 'Accounts Payable',
    icon: 'Building2',
    order: 3,
    phase: 'data-upload',
    pulls: [
      { fromTab: 'gl', dataType: 'ap_control_balance', description: 'AP control account balance from GL for sub-ledger reconciliation', required: true },
    ],
    pushes: [
      { toTab: 'confirmations', dataType: 'ap_balances', description: 'Selected AP vendor balances for external confirmation requests', gated: false },
      { toTab: 'upload', dataType: 'ap_control_recon', description: 'AP sub-ledger vs control account reconciliation result', gated: true },
    ],
    gates: [
      { gateId: 'ap-data-exists', label: 'AP Data Exists', description: 'Accounts Payable sub-ledger data has been uploaded with at least one vendor record.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 505' },
      { gateId: 'ap-control-recon', label: 'AP-Control Recon Passes', description: 'AP sub-ledger total reconciles to the AP control account balance in the GL.', check: 'NOT_RUN', blocking: false, isaRef: 'ISA 505' },
    ],
    contextualActions: [
      { id: 'select-for-confirmation', label: 'Select for Confirmation', icon: 'CheckSquare' },
    ],
    nextTab: 'ar',
    prevTab: 'gl',
  },
  {
    key: 'ar',
    label: 'Accounts Receivable',
    icon: 'Users',
    order: 4,
    phase: 'data-upload',
    pulls: [
      { fromTab: 'gl', dataType: 'ar_control_balance', description: 'AR control account balance from GL for sub-ledger reconciliation', required: true },
    ],
    pushes: [
      { toTab: 'confirmations', dataType: 'ar_balances', description: 'Selected AR customer balances for external confirmation requests', gated: false },
      { toTab: 'upload', dataType: 'ar_control_recon', description: 'AR sub-ledger vs control account reconciliation result', gated: true },
    ],
    gates: [
      { gateId: 'ar-data-exists', label: 'AR Data Exists', description: 'Accounts Receivable sub-ledger data has been uploaded with at least one customer record.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 505' },
      { gateId: 'ar-control-recon', label: 'AR-Control Recon Passes', description: 'AR sub-ledger total reconciles to the AR control account balance in the GL.', check: 'NOT_RUN', blocking: false, isaRef: 'ISA 505' },
    ],
    contextualActions: [
      { id: 'select-for-confirmation', label: 'Select for Confirmation', icon: 'CheckSquare' },
    ],
    nextTab: 'bank',
    prevTab: 'ap',
  },
  {
    key: 'bank',
    label: 'Bank',
    icon: 'Scale',
    order: 5,
    phase: 'data-upload',
    pulls: [
      { fromTab: 'gl', dataType: 'bank_account_balances', description: 'Bank account balances from GL for bank reconciliation reference', required: true },
    ],
    pushes: [
      { toTab: 'confirmations', dataType: 'bank_balances', description: 'Selected bank account balances for bank confirmation requests', gated: false },
    ],
    gates: [
      { gateId: 'bank-data-exists', label: 'Bank Data Exists', description: 'Bank account data has been uploaded with at least one bank record.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 505' },
    ],
    contextualActions: [
      { id: 'select-for-confirmation', label: 'Select for Confirmation', icon: 'CheckSquare' },
    ],
    nextTab: 'confirmations',
    prevTab: 'ar',
  },
  {
    key: 'confirmations',
    label: 'Confirmations',
    icon: 'Mail',
    order: 6,
    phase: 'validation',
    pulls: [
      { fromTab: 'ap', dataType: 'ap_balances', description: 'Selected AP vendor balances marked for external confirmation', required: false },
      { fromTab: 'ar', dataType: 'ar_balances', description: 'Selected AR customer balances marked for external confirmation', required: false },
      { fromTab: 'bank', dataType: 'bank_balances', description: 'Selected bank account balances marked for bank confirmation', required: false },
    ],
    pushes: [
      { toTab: 'upload', dataType: 'confirmation_status', description: 'Confirmation coverage and response status summary for validation dashboard', gated: false },
    ],
    gates: [
      { gateId: 'confirm-all-covered', label: 'All Selected Items Have Confirmations', description: 'Every balance selected for confirmation has an associated confirmation record created.', check: 'NOT_RUN', blocking: false, isaRef: 'ISA 505' },
      { gateId: 'confirm-no-orphans', label: 'No Orphan Confirmations', description: 'No confirmation records exist without a matching source balance in AP, AR, or Bank.', check: 'NOT_RUN', blocking: false, isaRef: 'ISA 505' },
    ],
    contextualActions: [
      { id: 'add-confirmation', label: 'Add Confirmation', icon: 'Plus' },
      { id: 'send-all', label: 'Send All', icon: 'Send' },
    ],
    nextTab: 'mapping',
    prevTab: 'bank',
  },
  {
    key: 'mapping',
    label: 'FS Mapping',
    icon: 'GitMerge',
    order: 7,
    phase: 'mapping',
    pulls: [
      { fromTab: 'tb', dataType: 'tb_accounts', description: 'Full TB account list with codes, names, and balances for FS Head assignment', required: true },
      { fromTab: 'gl', dataType: 'gl_transaction_counts', description: 'Per-account GL transaction counts for materiality and risk indicators', required: false },
    ],
    pushes: [
      { toTab: 'draft-fs', dataType: 'mapping_version', description: 'Approved and locked mapping version with account-to-FS-Head assignments', gated: true },
      { toTab: 'planning', dataType: 'mapping_version', description: 'Locked mapping version for planning phase FS Head population and risk inputs', gated: true },
      { toTab: 'fs-heads', dataType: 'mapping_version', description: 'Mapping version for FS Head balance aggregation and population counts', gated: true },
    ],
    gates: [
      { gateId: 'mapping-complete', label: '100% Mapped or Exceptions Documented', description: 'All TB accounts are mapped to an FS Head, or unmapped accounts have documented exception reasons.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 315' },
      { gateId: 'mapping-tb-available', label: 'TB Data Available', description: 'Trial Balance data is uploaded and available for mapping assignment.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 500' },
      { gateId: 'mapping-approved', label: 'Mapping Approved and Locked', description: 'The current mapping version has been reviewed, approved, and locked against further edits.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 315' },
    ],
    contextualActions: [
      { id: 'ai-map-all', label: 'AI Map All', icon: 'Wand2' },
      { id: 'approve-lock', label: 'Approve & Lock', icon: 'Lock' },
    ],
    nextTab: 'draft-fs',
    prevTab: 'confirmations',
  },
  {
    key: 'draft-fs',
    label: 'Draft FS',
    icon: 'FileText',
    order: 8,
    phase: 'output',
    pulls: [
      { fromTab: 'mapping', dataType: 'mapping_version', description: 'Approved mapping version defining account-to-FS-Head assignments for FS compilation', required: true },
      { fromTab: 'tb', dataType: 'tb_balances', description: 'TB closing balances for FS line item amount aggregation', required: true },
    ],
    pushes: [
      { toTab: 'planning', dataType: 'fs_snapshot', description: 'Generated FS snapshot with materiality inputs for planning phase materiality determination', gated: true },
      { toTab: 'fs-heads', dataType: 'fs_snapshot', description: 'FS snapshot for FS Head balance population and completeness tracking', gated: true },
      { toTab: 'execution', dataType: 'fs_snapshot', description: 'FS snapshot with risk inputs for execution phase audit program generation', gated: true },
    ],
    gates: [
      { gateId: 'draftfs-mapping-approved', label: 'Mapping Approved', description: 'The FS mapping version used for Draft FS compilation has been approved and locked.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 315' },
      { gateId: 'draftfs-snapshot-generated', label: 'FS Snapshot Generated', description: 'A Draft Financial Statements snapshot has been generated from the approved mapping.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 520' },
      { gateId: 'draftfs-all-gates', label: 'All Gates Pass for Push Forward', description: 'All prerequisite gates across upstream tabs pass before allowing Push Forward to planning.', check: 'NOT_RUN', blocking: true, isaRef: 'ISA 300' },
    ],
    contextualActions: [
      { id: 'generate-snapshot', label: 'Generate Snapshot', icon: 'Camera' },
      { id: 'push-forward', label: 'Push Forward', icon: 'ArrowRight' },
    ],
    nextTab: 'checks',
    prevTab: 'mapping',
  },
  {
    key: 'checks',
    label: 'Checks',
    icon: 'ClipboardCheck',
    order: 9,
    phase: 'output',
    pulls: [
      { fromTab: 'tb', dataType: 'tb_balances', description: 'TB data for balance verification', required: true },
      { fromTab: 'gl', dataType: 'gl_entries', description: 'GL data for reconciliation checks', required: false },
      { fromTab: 'mapping', dataType: 'mapping_version', description: 'Mapping data for completeness checks', required: true },
      { fromTab: 'draft-fs', dataType: 'fs_snapshot', description: 'Draft FS snapshot for output checks', required: false },
    ],
    pushes: [],
    gates: [],
    contextualActions: [],
    nextTab: null,
    prevTab: 'draft-fs',
  },
];

export function getTabConfig(key: WorkflowTabKey): TabWorkflowConfig | undefined {
  return WORKFLOW_TABS.find((tab) => tab.key === key);
}

export function getNextTab(key: WorkflowTabKey): WorkflowTabKey | null {
  const tab = getTabConfig(key);
  return tab?.nextTab ?? null;
}

export function getPrevTab(key: WorkflowTabKey): WorkflowTabKey | null {
  const tab = getTabConfig(key);
  return tab?.prevTab ?? null;
}

export function getTabsByPhase(phase: TabWorkflowConfig['phase']): TabWorkflowConfig[] {
  return WORKFLOW_TABS.filter((tab) => tab.phase === phase);
}
