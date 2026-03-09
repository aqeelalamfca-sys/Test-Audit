import { Router, Request, Response } from 'express';
import { 
  auditChainIntegrityService, 
  ChainIntegrityResult, 
  ChainGraph, 
  ChainNode 
} from './services/auditChainIntegrityService';

const router = Router();

router.post('/:engagementId/full-fix', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { autoRepair = true, userId } = req.body;
    const effectiveUserId = userId || (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(
      engagementId, 
      effectiveUserId, 
      autoRepair
    );

    res.json({
      success: true,
      ...result,
      workflow: {
        detect: true,
        repair: autoRepair,
        regenerate: autoRepair,
        gateCheck: true,
      },
    });
  } catch (error) {
    console.error('Full chain fix failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to run full chain fix workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:engagementId/graph', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const chainGraph = await auditChainIntegrityService.buildChainGraph(engagementId);

    const nodesArray: Array<{
      nodeId: string;
      nodeType: string;
      entityId: string;
      entityName: string;
      status: string;
      lockStatus: string;
      parentLinks: { nodeId: string; linkType: string }[];
      childLinks: { nodeId: string; linkType: string }[];
      metadata: Record<string, unknown>;
    }> = [];
    
    chainGraph.nodes.forEach((node: ChainNode, nodeId: string) => {
      nodesArray.push({
        nodeId,
        nodeType: node.nodeType,
        entityId: node.entityId,
        entityName: node.entityName,
        status: node.status,
        lockStatus: node.lockStatus,
        parentLinks: node.parentLinks,
        childLinks: node.childLinks,
        metadata: node.metadata,
      });
    });

    const linksArray: Array<{ source: string; target: string; linkType: string }> = [];
    chainGraph.nodes.forEach((node: ChainNode) => {
      node.childLinks.forEach(link => {
        linksArray.push({
          source: node.nodeId,
          target: link.nodeId,
          linkType: link.linkType,
        });
      });
    });

    const assertionTracksObj: Record<string, Array<{ nodeId: string; nodeType: string; entityName: string }>> = {};
    chainGraph.assertionTracks.forEach((track, fsHeadId) => {
      assertionTracksObj[fsHeadId] = track.map(node => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityName: node.entityName,
      }));
    });

    res.json({
      engagementId: chainGraph.engagementId,
      buildTimestamp: chainGraph.buildTimestamp,
      summary: {
        totalNodes: chainGraph.nodes.size,
        totalLinks: linksArray.length,
        orphanCount: chainGraph.orphanNodes.length,
        fsLevelChainLength: chainGraph.fsLevelChain.length,
        assertionTrackCount: chainGraph.assertionTracks.size,
      },
      nodes: nodesArray,
      links: linksArray,
      fsLevelChain: chainGraph.fsLevelChain.map(node => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityName: node.entityName,
        status: node.status,
      })),
      assertionTracks: assertionTracksObj,
      orphanNodes: chainGraph.orphanNodes.map(node => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityId: node.entityId,
        entityName: node.entityName,
        status: node.status,
      })),
    });
  } catch (error) {
    console.error('Chain graph fetch failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to build chain graph',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:engagementId/gate-status', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId, false);

    res.json({
      engagementId,
      timestamp: result.healthSummary.timestamp,
      gateStatus: {
        overall: result.gateResult.overall,
        fsLevel: result.gateResult.fsLevel,
        assertionTrack: result.gateResult.assertionTrack,
        needsReviewList: result.gateResult.needsReviewList,
      },
      gateCheckResult: result.gateCheckResult,
      scores: {
        completeness: result.healthSummary.completenessScore,
        integrity: result.healthSummary.integrityScore,
        isaCompliance: result.healthSummary.isaComplianceScore,
      },
      breakCounts: {
        total: result.breakRegister.length,
        high: result.breakRegister.filter(b => b.severity === 'HIGH').length,
        medium: result.breakRegister.filter(b => b.severity === 'MEDIUM').length,
        low: result.breakRegister.filter(b => b.severity === 'LOW').length,
      },
    });
  } catch (error) {
    console.error('Gate status fetch failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get gate status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:engagementId/validate-only', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { userId } = req.body;
    const effectiveUserId = userId || (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(
      engagementId, 
      effectiveUserId, 
      false
    );

    res.json({
      success: true,
      engagementId,
      timestamp: result.healthSummary.timestamp,
      validationOnly: true,
      healthSummary: result.healthSummary,
      breakRegister: result.breakRegister,
      breakSummary: {
        total: result.breakRegister.length,
        high: result.breakRegister.filter(b => b.severity === 'HIGH').length,
        medium: result.breakRegister.filter(b => b.severity === 'MEDIUM').length,
        low: result.breakRegister.filter(b => b.severity === 'LOW').length,
        byCategory: groupBreaksByCategory(result.breakRegister),
        byChainLevel: {
          fsLevel: result.breakRegister.filter(b => b.chainLevel === 'FS_LEVEL').length,
          assertionTrack: result.breakRegister.filter(b => b.chainLevel === 'ASSERTION_TRACK').length,
        },
      },
      autoRepairableBreaks: result.breakRegister.filter(b => b.autoRepairable),
      manualReviewRequired: result.breakRegister.filter(b => !b.autoRepairable),
    });
  } catch (error) {
    console.error('Validation-only check failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to run validation-only check',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:engagementId/regenerated-artifacts', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const artifacts = auditChainIntegrityService.getLastArtifacts(engagementId);

    if (artifacts.length === 0) {
      return res.json({
        engagementId,
        timestamp: new Date(),
        total: 0,
        artifacts: [],
        byType: {},
        message: 'No regenerated artifacts available. Run a full chain check with autoRepair=true to generate artifacts.',
      });
    }

    res.json({
      engagementId,
      timestamp: new Date(),
      total: artifacts.length,
      artifacts,
      byType: groupArtifactsByType(artifacts),
    });
  } catch (error) {
    console.error('Regenerated artifacts fetch failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get regenerated artifacts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/engagements/:engagementId/chain-health', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId);

    res.json(result);
  } catch (error) {
    console.error('Chain health check failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to run chain health check',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/engagements/:engagementId/chain-health/summary', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId);

    res.json(result.healthSummary);
  } catch (error) {
    console.error('Chain health summary failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get chain health summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/engagements/:engagementId/chain-health/breaks', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { severity, category, chainLevel } = req.query;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId);

    let breaks = result.breakRegister;

    if (severity) {
      breaks = breaks.filter(b => b.severity === severity);
    }
    if (category) {
      breaks = breaks.filter(b => b.category === category);
    }
    if (chainLevel) {
      breaks = breaks.filter(b => b.chainLevel === chainLevel);
    }

    res.json({
      total: breaks.length,
      breaks,
      filters: { severity, category, chainLevel },
    });
  } catch (error) {
    console.error('Chain breaks fetch failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get chain breaks',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/engagements/:engagementId/chain-health/repairs', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId);

    res.json({
      total: result.autoRepairLog.length,
      repairs: result.autoRepairLog,
    });
  } catch (error) {
    console.error('Chain repairs fetch failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get auto-repair log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/engagements/:engagementId/chain-health/artifacts', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId);

    res.json({
      total: result.regeneratedArtifacts.length,
      artifacts: result.regeneratedArtifacts,
    });
  } catch (error) {
    console.error('Regenerated artifacts fetch failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get regenerated artifacts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/engagements/:engagementId/chain-health/gate', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId);

    res.json(result.gateResult);
  } catch (error) {
    console.error('Gate result fetch failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get gate result',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/engagements/:engagementId/chain-health/run', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { autoRepair = true } = req.body;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId, autoRepair);

    res.json(result);
  } catch (error) {
    console.error('Chain integrity run failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to run chain integrity check',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/engagements/:engagementId/formatted-report', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id || 'system';

    if (!engagementId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'engagementId is required',
      });
    }

    const result = await auditChainIntegrityService.runFullChainCheck(engagementId, userId, false);

    res.type('text/plain').send(result.formattedReport || '');
  } catch (error) {
    console.error('Formatted report generation failed:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to generate formatted report',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function groupBreaksByCategory(breaks: ChainIntegrityResult['breakRegister']): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const brk of breaks) {
    grouped[brk.category] = (grouped[brk.category] || 0) + 1;
  }
  return grouped;
}

function groupArtifactsByType(artifacts: ChainIntegrityResult['regeneratedArtifacts']): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const artifact of artifacts) {
    grouped[artifact.artifactType] = (grouped[artifact.artifactType] || 0) + 1;
  }
  return grouped;
}

export default router;
