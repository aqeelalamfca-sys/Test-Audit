import { useState, useCallback, useMemo } from 'react';
import { LinkBreak, BreakCategory, BREAK_DEFINITIONS, WorkflowTabKey, DataSource } from './workflow-spec';

interface LinkIntegrityInput {
  dataSources: Partial<Record<WorkflowTabKey, DataSource | null>>;
  reconSummary: {
    hasTbData: boolean;
    hasGlData: boolean;
    tbGlReconciled: boolean;
    arReconciled: boolean;
    apReconciled: boolean;
    bankReconciled: boolean;
    mappingCompleteness: number;
    unmappedCount: number;
    orphanConfirmations: number;
    staleSyncTabs: WorkflowTabKey[];
  } | null;
}

interface LinkIntegrityResult {
  breaks: LinkBreak[];
  highBreaks: LinkBreak[];
  medBreaks: LinkBreak[];
  breaksByTab: Record<WorkflowTabKey, LinkBreak[]>;
  hasHighBreaks: boolean;
  hasMedBreaks: boolean;
  totalBreaks: number;
  isHealthy: boolean;
  autoFixableCount: number;
  needsReviewCount: number;
  fixBreaks: (breakIds?: string[]) => Promise<{ fixed: number; needsReview: number }>;
  isFixing: boolean;
  refreshBreaks: () => void;
}

const ALL_TAB_KEYS: WorkflowTabKey[] = ['upload', 'tb', 'gl', 'ap', 'ar', 'bank', 'confirmations', 'mapping', 'draft-fs'];

function createBreak(category: BreakCategory, overrides?: Partial<LinkBreak>): LinkBreak {
  const def = BREAK_DEFINITIONS[category];
  return {
    id: `break-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    severity: def.severity,
    message: def.defaultMessage,
    sourceTab: def.sourceTab,
    targetTab: def.targetTab,
    autoFixable: def.autoFixable,
    fixAction: def.fixAction,
    status: 'OPEN',
    ...overrides,
  };
}

function evaluateBreaks(input: LinkIntegrityInput): LinkBreak[] {
  const { reconSummary } = input;
  if (!reconSummary) return [];

  const breaks: LinkBreak[] = [];

  if (!reconSummary.hasTbData) {
    breaks.push(createBreak('MISSING_TB'));
  }

  if (!reconSummary.hasGlData) {
    breaks.push(createBreak('MISSING_GL'));
  }

  if (reconSummary.hasTbData && reconSummary.hasGlData && !reconSummary.tbGlReconciled) {
    breaks.push(createBreak('TIEOUT_FAIL'));
    breaks.push(createBreak('TB_GL_MISMATCH'));
  }

  if (reconSummary.mappingCompleteness < 100 && reconSummary.unmappedCount > 0) {
    breaks.push(
      createBreak('UNMAPPED_GL_FS', {
        message: `${reconSummary.unmappedCount} GL account${reconSummary.unmappedCount !== 1 ? 's are' : ' is'} not mapped to an FS line item. Complete mapping before generating Draft FS.`,
      })
    );
  }

  if (reconSummary.unmappedCount > 0) {
    breaks.push(
      createBreak('UNMAPPED_ACCOUNT', {
        message: `${reconSummary.unmappedCount} TB account${reconSummary.unmappedCount !== 1 ? 's have' : ' has'} no FS Head mapping assigned.`,
      })
    );
  }

  if (reconSummary.orphanConfirmations > 0) {
    breaks.push(
      createBreak('ORPHAN_CONFIRMATION', {
        message: `${reconSummary.orphanConfirmations} confirmation record${reconSummary.orphanConfirmations !== 1 ? 's exist' : ' exists'} without a matching source entry.`,
      })
    );
  }

  if (reconSummary.staleSyncTabs.length > 0) {
    for (const tab of reconSummary.staleSyncTabs) {
      breaks.push(
        createBreak('STALE_SYNC', {
          sourceTab: tab,
          message: `Data in the ${tab.toUpperCase()} tab was modified after the last validation run. Re-run validation to refresh.`,
        })
      );
    }
  }


  const tbSource = input.dataSources.tb;
  if (tbSource && tbSource.status === 'STALE') {
    breaks.push(
      createBreak('MISSING_METADATA', {
        message: 'Required metadata fields (e.g., account class, nature) may be missing or outdated on TB accounts.',
      })
    );
  }

  if (reconSummary.hasTbData && !reconSummary.tbGlReconciled && reconSummary.hasGlData) {
    const alreadyHasUnbalanced = breaks.some((b) => b.category === 'UNBALANCED_TB');
    if (!alreadyHasUnbalanced) {
      breaks.push(createBreak('UNBALANCED_TB'));
    }
  }

  return breaks;
}

function groupBreaksByTab(breaks: LinkBreak[]): Record<WorkflowTabKey, LinkBreak[]> {
  const grouped: Record<WorkflowTabKey, LinkBreak[]> = {} as Record<WorkflowTabKey, LinkBreak[]>;
  for (const key of ALL_TAB_KEYS) {
    grouped[key] = [];
  }
  for (const brk of breaks) {
    if (grouped[brk.sourceTab]) {
      grouped[brk.sourceTab].push(brk);
    }
  }
  return grouped;
}

export function useLinkIntegrity(input: LinkIntegrityInput): LinkIntegrityResult {
  const [fixedBreakIds, setFixedBreakIds] = useState<Set<string>>(new Set());
  const [reviewBreakIds, setReviewBreakIds] = useState<Set<string>>(new Set());
  const [isFixing, setIsFixing] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const rawBreaks = useMemo(() => {
    void refreshCounter;
    return evaluateBreaks(input);
  }, [input, refreshCounter]);

  const breaks = useMemo(() => {
    return rawBreaks.map((brk) => {
      if (fixedBreakIds.has(brk.id)) {
        return { ...brk, status: 'AUTO_FIXED' as const };
      }
      if (reviewBreakIds.has(brk.id)) {
        return { ...brk, status: 'NEEDS_REVIEW' as const };
      }
      return brk;
    });
  }, [rawBreaks, fixedBreakIds, reviewBreakIds]);

  const openBreaks = useMemo(() => breaks.filter((b) => b.status === 'OPEN'), [breaks]);

  const highBreaks = useMemo(() => openBreaks.filter((b) => b.severity === 'HIGH'), [openBreaks]);
  const medBreaks = useMemo(() => openBreaks.filter((b) => b.severity === 'MEDIUM'), [openBreaks]);

  const breaksByTab = useMemo(() => groupBreaksByTab(openBreaks), [openBreaks]);

  const autoFixableCount = useMemo(() => openBreaks.filter((b) => b.autoFixable).length, [openBreaks]);
  const needsReviewCount = useMemo(() => breaks.filter((b) => b.status === 'NEEDS_REVIEW').length, [breaks]);

  const fixBreaks = useCallback(
    async (breakIds?: string[]): Promise<{ fixed: number; needsReview: number }> => {
      setIsFixing(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));

        const targetBreaks = breakIds
          ? openBreaks.filter((b) => breakIds.includes(b.id))
          : openBreaks;

        let fixedCount = 0;
        let reviewCount = 0;
        const newFixed = new Set(fixedBreakIds);
        const newReview = new Set(reviewBreakIds);

        for (const brk of targetBreaks) {
          if (brk.autoFixable) {
            newFixed.add(brk.id);
            fixedCount++;
          } else {
            newReview.add(brk.id);
            reviewCount++;
          }
        }

        setFixedBreakIds(newFixed);
        setReviewBreakIds(newReview);

        return { fixed: fixedCount, needsReview: reviewCount };
      } finally {
        setIsFixing(false);
      }
    },
    [openBreaks, fixedBreakIds, reviewBreakIds]
  );

  const refreshBreaks = useCallback(() => {
    setFixedBreakIds(new Set());
    setReviewBreakIds(new Set());
    setRefreshCounter((c) => c + 1);
  }, []);

  return {
    breaks: openBreaks,
    highBreaks,
    medBreaks,
    breaksByTab,
    hasHighBreaks: highBreaks.length > 0,
    hasMedBreaks: medBreaks.length > 0,
    totalBreaks: openBreaks.length,
    isHealthy: openBreaks.length === 0,
    autoFixableCount,
    needsReviewCount,
    fixBreaks,
    isFixing,
    refreshBreaks,
  };
}
