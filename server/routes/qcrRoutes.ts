import { Router, Request, Response } from 'express';
import { qcrChecklistGenerator } from '../services/qcrChecklistGenerator';
import { prisma } from '../db';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

router.get('/engagements/:engagementId/qcr-checklist', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const report = await qcrChecklistGenerator.generateChecklist(engagementId, userId);
    
    return res.json(report);
  } catch (error) {
    console.error('QCR Checklist generation error:', error);
    return res.status(500).json({ error: 'Failed to generate QCR checklist' });
  }
});

router.get('/engagements/:engagementId/qcr-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const report = await qcrChecklistGenerator.generateChecklist(engagementId, userId);
    
    const summary = {
      engagementId: report.engagementId,
      engagementCode: report.engagementCode,
      clientName: report.clientName,
      verdict: report.verdict,
      verdictReason: report.verdictReason,
      score: report.scoring.percentage,
      criticalFailures: report.summary.criticalFailures,
      highIssues: report.summary.highIssues,
      mediumIssues: report.summary.mediumIssues,
      lowIssues: report.summary.lowIssues,
      reportIssuanceBlocked: report.blockingControls.reportIssuanceBlocked,
      blockReasons: report.blockingControls.blockReasons,
      topActions: report.correctiveActions.slice(0, 5)
    };
    
    return res.json(summary);
  } catch (error) {
    console.error('QCR Summary error:', error);
    return res.status(500).json({ error: 'Failed to generate QCR summary' });
  }
});

router.get('/engagements/:engagementId/qcr-sections/:sectionNumber', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, sectionNumber } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sectionNum = parseInt(sectionNumber);
    if (isNaN(sectionNum) || sectionNum < 1 || sectionNum > 8) {
      return res.status(400).json({ error: 'Invalid section number. Must be 1-8.' });
    }

    const report = await qcrChecklistGenerator.generateChecklist(engagementId, userId);
    const section = report.sections.find(s => s.sectionNumber === sectionNum);
    
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    
    return res.json({
      ...section,
      verdictContext: {
        overallVerdict: report.verdict,
        overallScore: report.scoring.percentage
      }
    });
  } catch (error) {
    console.error('QCR Section error:', error);
    return res.status(500).json({ error: 'Failed to retrieve QCR section' });
  }
});

router.get('/engagements/:engagementId/aob-readiness', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const report = await qcrChecklistGenerator.generateChecklist(engagementId, userId);
    
    const aobMatrix = {
      engagementId: report.engagementId,
      engagementCode: report.engagementCode,
      assessmentDate: report.generatedAt,
      
      alignmentMatrix: [
        {
          icapAobArea: 'Audit Documentation',
          systemEnforcement: 'Mandatory ISA 230 trail agent',
          status: report.sections[0].criticalFailures === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
          score: Math.round((report.sections[0].sectionScore / report.sections[0].maxScore) * 100) || 0
        },
        {
          icapAobArea: 'Risk-Based Audit',
          systemEnforcement: 'Risk Agent blocks generic audits',
          status: report.sections[2].criticalFailures === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
          score: Math.round((report.sections[2].sectionScore / report.sections[2].maxScore) * 100) || 0
        },
        {
          icapAobArea: 'Sampling Review',
          systemEnforcement: 'Sampling Agent recalculates & flags',
          status: report.sections[3].criticalFailures === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
          score: Math.round((report.sections[3].sectionScore / report.sections[3].maxScore) * 100) || 0
        },
        {
          icapAobArea: 'Partner Review',
          systemEnforcement: 'Phase lock until partner sign-off',
          status: report.sections[7].criticalFailures === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
          score: Math.round((report.sections[7].sectionScore / report.sections[7].maxScore) * 100) || 0
        },
        {
          icapAobArea: 'EQCR (where applicable)',
          systemEnforcement: 'Mandatory before opinion',
          status: report.sections[7].checkpoints.find(c => c.checkpoint.includes('EQCR'))?.status || 'NOT_APPLICABLE',
          score: report.sections[7].checkpoints.find(c => c.checkpoint.includes('EQCR'))?.status === 'COMPLIANT' ? 100 : 0
        },
        {
          icapAobArea: 'FS Linkage',
          systemEnforcement: 'GL→TB→FS enforced, no exceptions',
          status: report.sections[5].criticalFailures === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
          score: Math.round((report.sections[5].sectionScore / report.sections[5].maxScore) * 100) || 0
        },
        {
          icapAobArea: 'Independence',
          systemEnforcement: 'User-role segregation enforced',
          status: report.sections[0].checkpoints.find(c => c.checkpoint.includes('Independence'))?.status || 'NON_COMPLIANT',
          score: report.sections[0].checkpoints.find(c => c.checkpoint.includes('Independence'))?.status === 'COMPLIANT' ? 100 : 0
        },
        {
          icapAobArea: 'Archiving',
          systemEnforcement: 'Read-only post-issuance',
          status: report.sections[7].checkpoints.find(c => c.checkpoint.includes('Archiving'))?.status || 'NON_COMPLIANT',
          score: report.sections[7].checkpoints.find(c => c.checkpoint.includes('Archiving'))?.status === 'COMPLIANT' ? 100 : 0
        }
      ],
      
      overallScore: report.scoring.percentage,
      verdict: report.verdict,
      verdictLogic: {
        anyCriticalFailure: report.summary.criticalFailures > 0,
        criticalCount: report.summary.criticalFailures,
        result: report.summary.criticalFailures > 0 
          ? 'QCR FAIL (Any critical failure → automatic fail)'
          : report.scoring.percentage >= 90 
            ? 'QCR PASS (≥90% with 0 critical)'
            : report.scoring.percentage >= 75 
              ? 'CONDITIONAL PASS (75-89%)'
              : 'QCR FAIL (<75%)'
      },
      
      inspectionReadiness: report.verdict === 'QCR_PASS',
      blockingIssues: report.correctiveActions.filter(a => a.priority === 'CRITICAL').length
    };
    
    return res.json(aobMatrix);
  } catch (error) {
    console.error('AOB Readiness error:', error);
    return res.status(500).json({ error: 'Failed to calculate AOB readiness' });
  }
});

export default router;
