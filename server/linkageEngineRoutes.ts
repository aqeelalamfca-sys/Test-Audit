import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { linkageEngineService } from './services/linkageEngineService';

const router = Router();

const populationRequestSchema = z.object({
  engagementId: z.string().min(1, 'engagementId is required'),
  procedureId: z.string().optional().nullable(),
  sourceType: z.enum(['GL_JOURNAL', 'TB_LINE', 'CUSTOM']),
  filters: z.record(z.unknown()).optional().default({}),
  name: z.string().min(1, 'name is required'),
  userId: z.string().min(1, 'userId is required'),
});

const samplingRequestSchema = z.object({
  engagementId: z.string().min(1),
  populationItems: z.array(z.object({
    id: z.string(),
    sourceRef: z.string(),
    value: z.number(),
  })),
  method: z.enum([
    'STATISTICAL_RANDOM',
    'SYSTEMATIC',
    'MONETARY_UNIT_SAMPLING',
    'HAPHAZARD',
    'BLOCK',
    'JUDGMENTAL',
  ]),
  targetSize: z.number().int().positive(),
  materialityThreshold: z.number().optional().nullable(),
  randomSeed: z.number().optional().nullable(),
  userId: z.string().min(1),
  populationId: z.string().optional(),
  fsHeadId: z.string().optional(),
  procedureId: z.string().optional(),
});

const confirmationsRequestSchema = z.object({
  engagementId: z.string().min(1),
  type: z.enum(['DEBTOR', 'CREDITOR', 'BANK', 'LAWYER']),
  name: z.string().min(1),
  userId: z.string().min(1),
  filters: z.record(z.unknown()).optional().default({}),
});

const materialityAllocationSchema = z.object({
  engagementId: z.string().min(1),
  materialityId: z.string().min(1),
  allocations: z.array(z.object({
    fsHeadId: z.string().min(1),
    percentage: z.number().min(0).max(100),
  })),
  userId: z.string().min(1),
});

const riskProcedureLinkSchema = z.object({
  engagementId: z.string().min(1),
  riskAssessmentId: z.string().min(1),
  procedureId: z.string().min(1),
  assertion: z.string().min(1),
  responseType: z.enum(['SUBSTANTIVE', 'CONTROL', 'COMBINED']),
  userId: z.string().min(1),
});

router.get('/engagement/:engagementId/summary', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const summaries = await linkageEngineService.getEngagementLinkageSummary(engagementId);
    res.json({
      success: true,
      data: summaries,
      meta: {
        totalFSHeads: summaries.length,
        overallCompletion: summaries.length > 0 
          ? Math.round(summaries.reduce((sum, s) => sum + s.completionPercentage, 0) / summaries.length) 
          : 0,
        qualityGatesStatus: summaries.every(s => s.qualityGatesStatus === 'PASS') 
          ? 'PASS' 
          : summaries.some(s => s.qualityGatesStatus === 'BLOCK') 
            ? 'BLOCK' 
            : 'WARN',
      },
    });
  } catch (error) {
    console.error('Error fetching engagement linkage summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch engagement linkage summary' 
    });
  }
});

router.get('/fs-head/:fsHeadId/summary', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;
    const { engagementId } = req.query;
    
    if (!engagementId || typeof engagementId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'engagementId query parameter is required' 
      });
    }
    
    const summary = await linkageEngineService.getFSHeadSummary(engagementId, fsHeadId);
    if (!summary) {
      return res.status(404).json({ 
        success: false, 
        error: 'FS Head not found' 
      });
    }
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching FS Head summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch FS Head summary' 
    });
  }
});

router.post('/fs-head/:fsHeadId/population', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;
    
    const validation = populationRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }
    
    const { engagementId, procedureId, sourceType, filters, name, userId } = validation.data;
    
    const result = await linkageEngineService.computePopulation(
      engagementId,
      fsHeadId,
      procedureId || null,
      sourceType,
      filters,
      name,
      userId
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error computing population:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to compute population' 
    });
  }
});

router.post('/sample/generate', async (req: Request, res: Response) => {
  try {
    const validation = samplingRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }
    
    const { engagementId, populationItems, method, targetSize, materialityThreshold, randomSeed, userId, populationId, fsHeadId, procedureId } = validation.data;
    
    const result = await linkageEngineService.generateSample(
      engagementId,
      populationItems,
      method,
      targetSize,
      materialityThreshold || null,
      randomSeed || null,
      userId,
      populationId,
      fsHeadId,
      procedureId
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error generating sample:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate sample' 
    });
  }
});

router.get('/fs-head/:fsHeadId/analytics', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;
    const { engagementId } = req.query;
    
    if (!engagementId || typeof engagementId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'engagementId query parameter is required' 
      });
    }
    
    const analytics = await linkageEngineService.computeAnalytics(engagementId, fsHeadId);
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error computing analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to compute analytics' 
    });
  }
});

router.post('/fs-head/:fsHeadId/confirmations', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;
    const { engagementId, partyType, confirmationType, filters, userId } = req.body;
    
    if (!engagementId || !partyType || !confirmationType || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'engagementId, partyType, confirmationType, and userId are required' 
      });
    }
    
    const result = await linkageEngineService.buildConfirmationsPopulation(
      engagementId,
      fsHeadId,
      partyType,
      confirmationType,
      filters || {},
      userId
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error building confirmation population:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to build confirmation population' 
    });
  }
});

router.post('/fs-head/:fsHeadId/adjusted-balance', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;
    const { engagementId, userId } = req.body;
    
    if (!engagementId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'engagementId and userId are required' 
      });
    }
    
    const result = await linkageEngineService.computeAdjustedBalance(
      engagementId,
      fsHeadId,
      userId
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error computing adjusted balance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to compute adjusted balance' 
    });
  }
});

router.post('/materiality/allocate', async (req: Request, res: Response) => {
  try {
    const validation = materialityAllocationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }
    
    const { engagementId, materialityId, allocations, userId } = validation.data;
    
    await linkageEngineService.allocateMateriality(
      engagementId,
      materialityId,
      allocations,
      userId
    );
    
    res.json({
      success: true,
      message: 'Materiality allocated successfully',
    });
  } catch (error) {
    console.error('Error allocating materiality:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to allocate materiality' 
    });
  }
});

router.post('/risk-procedure/link', async (req: Request, res: Response) => {
  try {
    const validation = riskProcedureLinkSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }
    
    const { engagementId, riskAssessmentId, procedureId, assertion, responseType, userId } = validation.data;
    
    const linkId = await linkageEngineService.linkRiskToProcedure(
      engagementId,
      riskAssessmentId,
      procedureId,
      assertion,
      responseType,
      userId
    );
    
    res.json({
      success: true,
      data: { linkId },
    });
  } catch (error) {
    console.error('Error linking risk to procedure:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to link risk to procedure' 
    });
  }
});

router.get('/fs-head/:fsHeadId/quality-gates', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;
    const { engagementId } = req.query;
    
    if (!engagementId || typeof engagementId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'engagementId query parameter is required' 
      });
    }
    
    const gates = await linkageEngineService.runQualityGates(engagementId, fsHeadId);
    
    const passCount = gates.filter(g => g.status === 'PASS').length;
    const failCount = gates.filter(g => g.status === 'FAIL').length;
    const warnCount = gates.filter(g => g.status === 'WARN').length;
    const blockingFailures = gates.filter(g => g.blocking && g.status === 'FAIL');
    
    res.json({
      success: true,
      data: {
        gates,
        summary: {
          total: gates.length,
          passed: passCount,
          failed: failCount,
          warnings: warnCount,
          canFinalize: blockingFailures.length === 0,
          blockingIssues: blockingFailures.map(g => g.name),
        },
      },
    });
  } catch (error) {
    console.error('Error running quality gates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to run quality gates' 
    });
  }
});

router.post('/sample-item/:sampleItemId/result', async (req: Request, res: Response) => {
  try {
    const { sampleItemId } = req.params;
    const { hasException, exceptionDetails, userId } = req.body;
    
    if (typeof hasException !== 'boolean' || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'hasException (boolean) and userId are required' 
      });
    }
    
    await linkageEngineService.recordSampleResult(
      sampleItemId,
      hasException,
      exceptionDetails || null,
      userId
    );
    
    res.json({
      success: true,
      message: 'Sample result recorded successfully',
    });
  } catch (error) {
    console.error('Error recording sample result:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record sample result' 
    });
  }
});

export default router;
