import { Router, Request, Response, NextFunction } from 'express';
import { fsService } from './services/fsService';
import { FSType, FSMappingDecisionType } from '@prisma/client';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    firmId: string;
    name?: string;
  };
}

const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Insufficient permissions. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
};

const getAuditContext = (req: AuthenticatedRequest) => ({
  userId: req.user!.id,
  userRole: req.user!.role,
  userName: req.user!.name,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

router.post('/structures', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, name, fsType, reportingFramework, fiscalYear } = req.body;

    if (!engagementId || !name || !fsType || !fiscalYear) {
      return res.status(400).json({ error: 'engagementId, name, fsType, and fiscalYear are required' });
    }

    if (!Object.values(FSType).includes(fsType)) {
      return res.status(400).json({ error: 'Invalid fsType' });
    }

    const structure = await fsService.createFSStructure(
      engagementId,
      req.user!.firmId,
      { name, fsType, reportingFramework, fiscalYear },
      getAuditContext(req)
    );

    await fsService.createDefaultCaptions(
      structure.id,
      engagementId,
      fsType,
      getAuditContext(req)
    );

    const fullStructure = await fsService.getStructure(structure.id);
    res.status(201).json(fullStructure);
  } catch (error: any) {
    console.error('Create FS structure error:', error);
    res.status(500).json({ error: error.message || 'Failed to create FS structure' });
  }
});

router.get('/structures/:structureId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const structure = await fsService.getStructure(structureId);

    if (!structure) {
      return res.status(404).json({ error: 'Structure not found' });
    }

    res.json(structure);
  } catch (error: any) {
    console.error('Get FS structure error:', error);
    res.status(500).json({ error: error.message || 'Failed to get FS structure' });
  }
});

router.post('/structures/:structureId/ai-suggestions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const { tbBatchId, performanceMateriality } = req.body;

    if (!tbBatchId || performanceMateriality === undefined) {
      return res.status(400).json({ error: 'tbBatchId and performanceMateriality are required' });
    }

    const structure = await fsService.getStructure(structureId);
    if (!structure) {
      return res.status(404).json({ error: 'Structure not found' });
    }

    const suggestions = await fsService.getAIMappingSuggestions(
      structureId,
      structure.engagementId,
      tbBatchId,
      Number(performanceMateriality),
      getAuditContext(req)
    );

    res.json({ suggestions, count: suggestions.length });
  } catch (error: any) {
    console.error('AI suggestions error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI suggestions' });
  }
});

router.post('/structures/:structureId/mappings/from-suggestions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const { tbBatchId, suggestions } = req.body;

    if (!tbBatchId || !suggestions || !Array.isArray(suggestions)) {
      return res.status(400).json({ error: 'tbBatchId and suggestions array are required' });
    }

    const structure = await fsService.getStructure(structureId);
    if (!structure) {
      return res.status(404).json({ error: 'Structure not found' });
    }

    const mappings = await fsService.createMappingsFromSuggestions(
      structureId,
      structure.engagementId,
      tbBatchId,
      suggestions,
      getAuditContext(req)
    );

    res.status(201).json({ mappings, count: mappings.length });
  } catch (error: any) {
    console.error('Create mappings error:', error);
    res.status(500).json({ error: error.message || 'Failed to create mappings' });
  }
});

router.post('/mappings/:mappingId/decision', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mappingId } = req.params;
    const { decisionType, rationale, newCaptionId, newAmount, splitDetails, regroupDetails, engagementId } = req.body;

    if (!decisionType || !rationale) {
      return res.status(400).json({ error: 'decisionType and rationale are required' });
    }

    if (!Object.values(FSMappingDecisionType).includes(decisionType)) {
      return res.status(400).json({ error: 'Invalid decisionType' });
    }

    const decision = await fsService.recordMappingDecision(
      mappingId,
      engagementId,
      {
        decisionType,
        rationale,
        newCaptionId,
        newAmount,
        splitDetails,
        regroupDetails,
      },
      getAuditContext(req)
    );

    res.status(201).json(decision);
  } catch (error: any) {
    console.error('Mapping decision error:', error);
    res.status(500).json({ error: error.message || 'Failed to record decision' });
  }
});

router.post('/structures/:structureId/mappings/submit-for-review', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const { mappingIds } = req.body;

    if (!mappingIds || !Array.isArray(mappingIds)) {
      return res.status(400).json({ error: 'mappingIds array is required' });
    }

    const result = await fsService.submitMappingsForReview(
      structureId,
      mappingIds,
      getAuditContext(req)
    );

    res.json({ updated: result.count });
  } catch (error: any) {
    console.error('Submit for review error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit for review' });
  }
});

router.post('/structures/:structureId/mappings/review', requireRole('SENIOR', 'MANAGER', 'PARTNER', 'FIRM_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const { mappingIds, approved, comments } = req.body;

    if (!mappingIds || !Array.isArray(mappingIds) || approved === undefined) {
      return res.status(400).json({ error: 'mappingIds, approved, and comments are required' });
    }

    const result = await fsService.reviewMappings(
      structureId,
      mappingIds,
      approved,
      comments || '',
      getAuditContext(req)
    );

    res.json({ updated: result.count });
  } catch (error: any) {
    console.error('Review mappings error:', error);
    res.status(500).json({ error: error.message || 'Failed to review mappings' });
  }
});

router.post('/structures/:structureId/mappings/approve', requireRole('PARTNER', 'FIRM_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const { mappingIds, comments } = req.body;

    if (!mappingIds || !Array.isArray(mappingIds)) {
      return res.status(400).json({ error: 'mappingIds array is required' });
    }

    const result = await fsService.approveMappings(
      structureId,
      mappingIds,
      comments || '',
      getAuditContext(req)
    );

    res.json({ updated: result.count });
  } catch (error: any) {
    console.error('Approve mappings error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve mappings' });
  }
});

router.get('/structures/:structureId/unmapped', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const { tbBatchId } = req.query;

    if (!tbBatchId) {
      return res.status(400).json({ error: 'tbBatchId query parameter is required' });
    }

    const unmapped = await fsService.getUnmappedAccounts(structureId, tbBatchId as string);
    res.json({ unmapped, count: unmapped.length });
  } catch (error: any) {
    console.error('Get unmapped error:', error);
    res.status(500).json({ error: error.message || 'Failed to get unmapped accounts' });
  }
});

router.get('/structures/:structureId/snapshot-readiness', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const { tbBatchId } = req.query;

    if (!tbBatchId) {
      return res.status(400).json({ error: 'tbBatchId query parameter is required' });
    }

    const readiness = await fsService.canGenerateSnapshot(structureId, tbBatchId as string);
    res.json(readiness);
  } catch (error: any) {
    console.error('Snapshot readiness error:', error);
    res.status(500).json({ error: error.message || 'Failed to check snapshot readiness' });
  }
});

router.post('/structures/:structureId/snapshots', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const { tbBatchId, snapshotName, snapshotType, engagementId } = req.body;

    if (!tbBatchId || !snapshotName || !engagementId) {
      return res.status(400).json({ error: 'tbBatchId, snapshotName, and engagementId are required' });
    }

    const snapshot = await fsService.generateSnapshot(
      structureId,
      engagementId,
      tbBatchId,
      snapshotName,
      snapshotType || 'UNADJUSTED',
      getAuditContext(req)
    );

    res.status(201).json(snapshot);
  } catch (error: any) {
    console.error('Generate snapshot error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate snapshot' });
  }
});

router.get('/snapshots/:snapshotId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { snapshotId } = req.params;
    const snapshot = await fsService.getSnapshot(snapshotId);

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    res.json(snapshot);
  } catch (error: any) {
    console.error('Get snapshot error:', error);
    res.status(500).json({ error: error.message || 'Failed to get snapshot' });
  }
});

router.get('/structures/:structureId/audit-logs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { structureId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await fsService.getAuditLogs(structureId, limit);
    res.json({ logs, count: logs.length });
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: error.message || 'Failed to get audit logs' });
  }
});

export default router;
