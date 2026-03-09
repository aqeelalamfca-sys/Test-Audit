import { Router, Request, Response, NextFunction } from 'express';
import { materialityService } from './services/materialityService';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    name?: string;
    firmId?: string;
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
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
};

const requireSeniorOrAbove = requireRole('SENIOR', 'MANAGER', 'PARTNER', 'FIRM_ADMIN');
const requirePartner = requireRole('PARTNER', 'FIRM_ADMIN');

router.get('/benchmarks/:firmId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { firmId } = req.params;
    const benchmarks = await materialityService.getDefaultBenchmarks(firmId);
    res.json(benchmarks);
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch benchmarks' });
  }
});

router.post('/calculate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      engagementId,
      firmId,
      fiscalYear,
      selectedBenchmarkType,
      benchmarkAmount,
      selectedPercentage,
      pmPercentage,
      trivialThresholdPercentage,
      calculationRationale
    } = req.body;

    if (!engagementId || !firmId || !fiscalYear || !selectedBenchmarkType || !benchmarkAmount || !selectedPercentage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const calculation = await materialityService.calculateMateriality(
      {
        engagementId,
        firmId,
        fiscalYear,
        periodStart: new Date(),
        periodEnd: new Date(),
        primaryBenchmarkType: selectedBenchmarkType,
        primaryBenchmarkValue: benchmarkAmount,
        appliedPercentage: selectedPercentage,
        performanceMaterialityPct: pmPercentage,
        trivialThresholdPct: trivialThresholdPercentage,
        calculationNotes: calculationRationale,
        userId: req.user!.id
      },
      req.user!.role,
      req.user!.name
    );

    res.status(201).json(calculation);
  } catch (error) {
    console.error('Error calculating materiality:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to calculate materiality' });
  }
});

router.get('/engagement/:engagementId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const calculations = await materialityService.getCalculationsForEngagement(engagementId);
    res.json(calculations);
  } catch (error) {
    console.error('Error fetching calculations:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch calculations' });
  }
});

router.get('/calculation/:calculationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { calculationId } = req.params;
    const calculation = await materialityService.getCalculation(calculationId);
    
    if (!calculation) {
      return res.status(404).json({ error: 'Calculation not found' });
    }
    
    res.json(calculation);
  } catch (error) {
    console.error('Error fetching calculation:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch calculation' });
  }
});

router.get('/published/:engagementId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined;
    
    const materiality = await materialityService.getPublishedMateriality(engagementId, fiscalYear);
    
    if (!materiality) {
      return res.status(404).json({ error: 'No published materiality found for this engagement' });
    }
    
    res.json(materiality);
  } catch (error) {
    console.error('Error fetching published materiality:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch published materiality' });
  }
});

router.post('/submit-review/:calculationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { calculationId } = req.params;
    const calculation = await materialityService.submitForReview(
      calculationId,
      req.user!.id,
      req.user!.role,
      req.user!.name
    );
    res.json(calculation);
  } catch (error) {
    console.error('Error submitting for review:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to submit for review' });
  }
});

router.post('/review/:calculationId', requireSeniorOrAbove, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { calculationId } = req.params;
    const { approved, comments } = req.body;
    
    const calculation = await materialityService.reviewCalculation(
      calculationId,
      req.user!.id,
      req.user!.role,
      req.user!.name,
      approved !== false,
      comments
    );
    res.json(calculation);
  } catch (error) {
    console.error('Error reviewing calculation:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to review calculation' });
  }
});

router.post('/submit-approval/:calculationId', requireSeniorOrAbove, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { calculationId } = req.params;
    const calculation = await materialityService.submitForApproval(
      calculationId,
      req.user!.id,
      req.user!.role,
      req.user!.name
    );
    res.json(calculation);
  } catch (error) {
    console.error('Error submitting for approval:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to submit for approval' });
  }
});

router.post('/approve/:calculationId', requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { calculationId } = req.params;
    const { signOffPin } = req.body;
    
    const calculation = await materialityService.approveCalculation(
      calculationId,
      req.user!.id,
      req.user!.role,
      req.user!.name,
      signOffPin
    );
    res.json(calculation);
  } catch (error) {
    console.error('Error approving calculation:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to approve calculation' });
  }
});

router.post('/override', requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      calculationId,
      overrideType,
      originalValue,
      overriddenValue,
      justification,
      riskBasedRationale,
      signOffPin
    } = req.body;

    if (!calculationId || !overrideType || originalValue === undefined || 
        overriddenValue === undefined || !justification || !riskBasedRationale || !signOffPin) {
      return res.status(400).json({ error: 'Missing required fields for override' });
    }

    const override = await materialityService.applyOverride(
      {
        calculationId,
        overrideType,
        originalValue,
        overriddenValue,
        justification,
        riskBasedRationale,
        partnerApprovedById: req.user!.id,
        partnerSignOffPin: signOffPin
      },
      req.user!.name
    );
    res.status(201).json(override);
  } catch (error) {
    console.error('Error applying override:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to apply override' });
  }
});

router.post('/publish/:calculationId', requirePartner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { calculationId } = req.params;
    const calculation = await materialityService.publishToEngagement(
      calculationId,
      req.user!.id,
      req.user!.role,
      req.user!.name
    );
    res.json(calculation);
  } catch (error) {
    console.error('Error publishing materiality:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to publish materiality' });
  }
});

router.post('/evaluate-misstatement', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { misstatementId, misstatementAmount, engagementId } = req.body;

    if (!misstatementId || misstatementAmount === undefined || !engagementId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const evaluation = await materialityService.evaluateMisstatement(
      misstatementId,
      misstatementAmount,
      engagementId
    );
    res.json(evaluation);
  } catch (error) {
    console.error('Error evaluating misstatement:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to evaluate misstatement' });
  }
});

router.get('/misstatement-summary/:engagementId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const calculationId = req.query.calculationId as string | undefined;
    
    const summary = await materialityService.getMisstatementSummary(engagementId, calculationId);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching misstatement summary:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch misstatement summary' });
  }
});

router.get('/audit-logs/:calculationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { calculationId } = req.params;
    const logs = await materialityService.getAuditLogs(calculationId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch audit logs' });
  }
});

export default router;
