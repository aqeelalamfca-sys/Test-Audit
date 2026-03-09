import { Router, Request, Response } from 'express';
import { linkIntegrityEngine } from './services/linkIntegrityEngine';
import { auditChainStateMachine } from './services/auditChainStateMachine';
import { requireAuth } from './auth';

const router = Router();

router.use(requireAuth);

const VALID_SEVERITIES = ['HIGH', 'MED'];
const VALID_CATEGORIES = ['ORPHAN_RECORD', 'MAPPING_BREAK', 'PHASE_INCONSISTENCY', 'DATA_MISSING', 'REFERENCE_BROKEN'];
const VALID_STATUSES = ['DETECTED', 'AUTO_REPAIRED', 'NEEDS_REVIEW', 'RESOLVED'];

router.get('/:engagementId/scan', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    if (!engagementId) {
      return res.status(400).json({ error: 'engagementId is required' });
    }

    const result = await linkIntegrityEngine.runFullScan(engagementId);
    res.json(result);
  } catch (error) {
    console.error('Link integrity scan failed:', error);
    res.status(500).json({
      error: 'Failed to run link integrity scan',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:engagementId/issues', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { severity, category, status } = req.query;

    if (!engagementId) {
      return res.status(400).json({ error: 'engagementId is required' });
    }

    if (severity && !VALID_SEVERITIES.includes(severity as string)) {
      return res.status(400).json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
    }
    if (category && !VALID_CATEGORIES.includes(category as string)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (status && !VALID_STATUSES.includes(status as string)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    let issues = linkIntegrityEngine.getStoredIssues(engagementId);

    if (severity) {
      issues = issues.filter(i => i.severity === severity);
    }
    if (category) {
      issues = issues.filter(i => i.category === category);
    }
    if (status) {
      issues = issues.filter(i => i.status === status);
    }

    res.json({
      engagementId,
      total: issues.length,
      issues,
      filters: { severity, category, status },
    });
  } catch (error) {
    console.error('Failed to fetch issues:', error);
    res.status(500).json({
      error: 'Failed to fetch integrity issues',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:engagementId/repair/:issueId', async (req: Request, res: Response) => {
  try {
    const { engagementId, issueId } = req.params;

    if (!engagementId || !issueId) {
      return res.status(400).json({ error: 'engagementId and issueId are required' });
    }

    const result = await linkIntegrityEngine.repairIssue(engagementId, issueId);

    if (!result) {
      return res.status(404).json({ error: 'Issue not found', issueId });
    }

    res.json({
      success: result.status === 'AUTO_REPAIRED' || result.status === 'RESOLVED',
      issue: result,
    });
  } catch (error) {
    console.error('Repair failed:', error);
    res.status(500).json({
      error: 'Failed to repair issue',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:engagementId/repair-all', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    if (!engagementId) {
      return res.status(400).json({ error: 'engagementId is required' });
    }

    const results = await linkIntegrityEngine.repairAllAutoRepairable(engagementId);

    res.json({
      engagementId,
      repaired: results.filter(r => r.status === 'AUTO_REPAIRED').length,
      needsReview: results.filter(r => r.status === 'NEEDS_REVIEW').length,
      total: results.length,
      issues: results,
    });
  } catch (error) {
    console.error('Repair-all failed:', error);
    res.status(500).json({
      error: 'Failed to repair all issues',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:engagementId/acknowledge/:issueId', async (req: Request, res: Response) => {
  try {
    const { engagementId, issueId } = req.params;

    if (!engagementId || !issueId) {
      return res.status(400).json({ error: 'engagementId and issueId are required' });
    }

    const result = await linkIntegrityEngine.acknowledgeIssue(engagementId, issueId);

    if (!result) {
      return res.status(404).json({ error: 'Issue not found', issueId });
    }

    res.json({
      success: true,
      issue: result,
    });
  } catch (error) {
    console.error('Acknowledge failed:', error);
    res.status(500).json({
      error: 'Failed to acknowledge issue',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:engagementId/gate-status', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    if (!engagementId) {
      return res.status(400).json({ error: 'engagementId is required' });
    }

    const chainValidation = await auditChainStateMachine.validateChain(engagementId);

    res.json({
      engagementId,
      timestamp: chainValidation.timestamp,
      isValid: chainValidation.isValid,
      currentPhase: chainValidation.currentPhase,
      nextAvailablePhase: chainValidation.nextAvailablePhase,
      phases: chainValidation.phases,
    });
  } catch (error) {
    console.error('Gate status check failed:', error);
    res.status(500).json({
      error: 'Failed to get gate status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
