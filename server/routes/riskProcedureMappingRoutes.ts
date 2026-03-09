// Risk → Procedure → Evidence Mapping API Routes
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import {
  generateFSHeadProcedureMapping,
  generateAISuggestions,
  validateFSHeadEnforcement,
  generateEvidenceSlots,
  type IdentifiedRisk,
  type MappedProcedure,
  type RiskLevel,
  type EvidenceRequirement,
  type ProcedureType,
} from '../services/riskProcedureAutoMapper';
import { detectFSHeadType, FS_HEAD_TEMPLATES } from '../services/fsHeadProcedureTemplates';

// Evidence requirements by procedure type
const EVIDENCE_REQUIREMENTS: Record<ProcedureType, { type: string; description: string }[]> = {
  TOC: [
    { type: 'PROCESS_DOC', description: 'Process documentation / flowchart' },
    { type: 'CONTROL_MATRIX', description: 'Control matrices / risk-control mapping' },
    { type: 'REPERFORMANCE', description: 'Reperformance screenshots / walkthrough notes' },
  ],
  TOD: [
    { type: 'SOURCE_DOC', description: 'Source documents (invoice, contract, GRN, bank statement)' },
    { type: 'RECALCULATION', description: 'Recalculation workings' },
    { type: 'CONFIRMATION', description: 'External confirmation replies (if applicable)' },
  ],
  ANALYTICS: [
    { type: 'ANALYSIS', description: 'System-generated analysis / data extract' },
    { type: 'EXPECTATION', description: 'Auditor expectation and explanation' },
    { type: 'CONCLUSION_NOTE', description: 'Analytical conclusion note' },
  ]
};

// Batch fetch evidence for multiple procedures in single query
async function batchFetchEvidence(engagementId: string, procedureIds: string[]) {
  if (procedureIds.length === 0) return new Map<string, any[]>();
  
  const evidenceFiles = await prisma.evidenceFile.findMany({
    where: {
      engagementId,
      status: 'ACTIVE',
      procedureIds: { hasSome: procedureIds }
    },
    select: { id: true, procedureIds: true, description: true, fileType: true }
  });
  
  // Group by procedure ID
  const evidenceMap = new Map<string, any[]>();
  for (const file of evidenceFiles) {
    for (const procId of file.procedureIds) {
      if (procedureIds.includes(procId)) {
        if (!evidenceMap.has(procId)) evidenceMap.set(procId, []);
        evidenceMap.get(procId)!.push(file);
      }
    }
  }
  return evidenceMap;
}

// Generate evidence slots using pre-fetched evidence data
function generateEvidenceSlotsWithData(
  procedureId: string,
  fsHeadId: string,
  procedureType: ProcedureType,
  evidenceFiles: any[] = []
): EvidenceRequirement[] {
  const requirements = EVIDENCE_REQUIREMENTS[procedureType] || [];
  
  return requirements.map((req, index) => {
    const matchingEvidence = evidenceFiles.filter(e => 
      e.description?.toLowerCase().includes(req.type.toLowerCase()) ||
      e.fileType?.includes(req.type.toLowerCase())
    );
    const uploadedCount = matchingEvidence.length > 0 ? matchingEvidence.length : 
                          (evidenceFiles.length > 0 ? Math.ceil(evidenceFiles.length / requirements.length) : 0);
    
    return {
      id: `${procedureId}-EV-${index + 1}`,
      procedureId,
      fsHeadId,
      evidenceType: req.type,
      description: req.description,
      status: uploadedCount > 0 ? 'UPLOADED' as const : 'PENDING' as const,
      uploadedCount,
      requiredCount: 1,
    };
  });
}

// Build procedures from FS Head data with batched evidence
async function buildProceduresFromFSHead(
  fsHead: any,
  risks: IdentifiedRisk[],
  includeEvidence: boolean = true
): Promise<MappedProcedure[]> {
  const allProcedureIds = [
    ...fsHead.testOfControls.map((p: any) => p.id),
    ...fsHead.testOfDetails.map((p: any) => p.id),
    ...fsHead.analyticalProcedures.map((p: any) => p.id)
  ];
  
  const evidenceMap = includeEvidence 
    ? await batchFetchEvidence(fsHead.engagementId, allProcedureIds)
    : new Map();
  
  const riskIds = risks.map(r => r.id);
  
  return [
    ...fsHead.testOfControls.map((p: any) => ({
      id: p.id,
      ref: p.tocRef || `TOC-${p.id.slice(0, 8)}`,
      type: 'TOC' as const,
      description: p.controlDescription || '',
      isaReference: 'ISA 315',
      mandatory: true,
      locked: true,
      linkedRiskIds: riskIds,
      status: p.result === 'SATISFACTORY' || p.result === 'COMPLETED' ? 'COMPLETED' as const : 
              p.result === 'IN_PROGRESS' ? 'IN_PROGRESS' as const : 'NOT_STARTED' as const,
      evidenceRequired: generateEvidenceSlotsWithData(p.id, fsHead.id, 'TOC', evidenceMap.get(p.id) || [])
    })),
    ...fsHead.testOfDetails.map((p: any) => ({
      id: p.id,
      ref: p.todRef || `TOD-${p.id.slice(0, 8)}`,
      type: 'TOD' as const,
      description: p.procedureDescription || '',
      isaReference: 'ISA 500',
      mandatory: true,
      locked: true,
      linkedRiskIds: riskIds,
      status: p.result === 'SATISFACTORY' || p.result === 'COMPLETED' ? 'COMPLETED' as const : 
              p.result === 'IN_PROGRESS' ? 'IN_PROGRESS' as const : 'NOT_STARTED' as const,
      evidenceRequired: generateEvidenceSlotsWithData(p.id, fsHead.id, 'TOD', evidenceMap.get(p.id) || [])
    })),
    ...fsHead.analyticalProcedures.map((p: any) => ({
      id: p.id,
      ref: p.procedureRef || `ANA-${p.id.slice(0, 8)}`,
      type: 'ANALYTICS' as const,
      description: p.description || '',
      isaReference: 'ISA 520',
      mandatory: false,
      locked: false,
      linkedRiskIds: riskIds,
      status: p.auditorConclusion ? 'COMPLETED' as const : 'NOT_STARTED' as const,
      evidenceRequired: generateEvidenceSlotsWithData(p.id, fsHead.id, 'ANALYTICS', evidenceMap.get(p.id) || [])
    }))
  ];
}

const router = Router();

// Get procedure mapping for an FS Head with auto-generated procedures
router.get('/fs-head/:fsHeadId/procedure-mapping', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;

    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: fsHeadId },
      include: {
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true,
      }
    });

    if (!fsHead) {
      return res.status(404).json({ error: 'FS Head not found' });
    }

    // Get risks and build procedures in parallel with batched evidence query
    const risks = await getRisksForFSHead(fsHeadId, fsHead.fsHeadName);
    const existingProcedures = await buildProceduresFromFSHead(fsHead, risks, true);

    const mapping = generateFSHeadProcedureMapping(fsHeadId, fsHead.fsHeadName, risks, existingProcedures);
    const aiSuggestions = generateAISuggestions(mapping, risks);

    res.json({
      mapping,
      risks,
      aiSuggestions,
      template: FS_HEAD_TEMPLATES[detectFSHeadType(fsHead.fsHeadName)] || null
    });
  } catch (error: any) {
    console.error('Error getting procedure mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate FS Head completion readiness
router.get('/fs-head/:fsHeadId/validate-completion', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;

    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: fsHeadId },
      include: {
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true,
      }
    });

    if (!fsHead) {
      return res.status(404).json({ error: 'FS Head not found' });
    }

    const fsHeadType = detectFSHeadType(fsHead.fsHeadName);
    const risks = await getRisksForFSHead(fsHeadId, fsHead.fsHeadName);
    const existingProcedures = await buildProceduresFromFSHead(fsHead, risks, true);

    const riskLevel = (fsHead.riskLevel as RiskLevel) || 'MEDIUM';
    const template = FS_HEAD_TEMPLATES[fsHeadType];
    
    const validation = validateFSHeadEnforcement(
      fsHeadId,
      fsHeadType,
      riskLevel,
      risks,
      existingProcedures,
      template?.fraudRiskPresumed || false
    );

    const hasConclusion = !!fsHead.conclusion && fsHead.conclusion.trim().length > 0;
    const canComplete = validation.isValid && hasConclusion;

    res.json({
      canComplete,
      validation,
      hasConclusion,
      blockers: [
        ...validation.blockers,
        ...(!hasConclusion ? ['Working paper conclusion is required'] : []),
      ]
    });
  } catch (error: any) {
    console.error('Error validating completion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add optional procedure to FS Head
router.post('/fs-head/:fsHeadId/add-procedure', async (req: Request, res: Response) => {
  try {
    const { fsHeadId } = req.params;
    const { procedureRef, procedureType, justification } = req.body;

    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({ error: 'Justification required for adding optional procedures (min 10 characters)' });
    }

    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: fsHeadId }
    });

    if (!fsHead) {
      return res.status(404).json({ error: 'FS Head not found' });
    }

    const template = FS_HEAD_TEMPLATES[detectFSHeadType(fsHead.fsHeadName)];
    const templateProc = template?.procedures.find(p => p.ref === procedureRef);

    if (!templateProc) {
      return res.status(400).json({ error: 'Procedure template not found' });
    }

    // Create the procedure based on type
    let newProcedure;
    
    if (procedureType === 'TOC') {
      newProcedure = await prisma.fSHeadTOC.create({
        data: {
          workingPaperId: fsHeadId,
          tocRef: procedureRef,
          controlDescription: templateProc.description,
          testSteps: `Added optional: ${justification}`,
          testSampleSize: 10,
          testPopulation: '0',
          testMethod: 'INQUIRY',
          result: 'PENDING',
        }
      });
    } else if (procedureType === 'TOD') {
      newProcedure = await prisma.fSHeadTOD.create({
        data: {
          workingPaperId: fsHeadId,
          todRef: procedureRef,
          procedureDescription: templateProc.description,
          assertions: [],
          populationCount: 0,
          samplingMethod: 'RANDOM',
          result: 'PENDING',
        }
      });
    } else {
      newProcedure = await prisma.fSHeadAnalyticalProcedure.create({
        data: {
          workingPaperId: fsHeadId,
          analyticalType: 'TREND',
          description: templateProc.description,
          expectation: justification,
        }
      });
    }

    res.json({
      success: true,
      procedure: newProcedure,
      message: 'Optional procedure added successfully'
    });
  } catch (error: any) {
    console.error('Error adding procedure:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get risk coverage summary for engagement
router.get('/engagement/:engagementId/risk-coverage', async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;

    const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId },
      include: {
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true,
      }
    });

    // Process FS Heads with optimized batched queries
    const coverageSummary = await Promise.all(fsHeads.map(async (fsHead: any) => {
      const risks = await getRisksForFSHead(fsHead.id, fsHead.fsHeadName);
      const existingProcedures = await buildProceduresFromFSHead(fsHead, risks, false); // Skip evidence for summary
      const mapping = generateFSHeadProcedureMapping(fsHead.id, fsHead.fsHeadName, risks, existingProcedures);
      
      return {
        fsHeadId: fsHead.id,
        fsHeadName: fsHead.fsHeadName,
        riskLevel: mapping.riskLevel,
        riskCoverage: mapping.riskCoverage.coveragePercentage,
        completedProcedures: mapping.completedCount,
        totalMandatory: mapping.totalMandatory,
        canComplete: mapping.canComplete,
        blockerCount: mapping.blockers.length
      };
    }));

    const overallCoverage = coverageSummary.length > 0
      ? Math.round(coverageSummary.reduce((sum, s) => sum + s.riskCoverage, 0) / coverageSummary.length)
      : 100;

    res.json({
      engagementId,
      overallCoverage,
      fsHeadCount: fsHeads.length,
      blockedFSHeads: coverageSummary.filter(s => !s.canComplete).length,
      summary: coverageSummary
    });
  } catch (error: any) {
    console.error('Error getting risk coverage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get risks for FS Head
async function getRisksForFSHead(fsHeadId: string, fsHeadName: string): Promise<IdentifiedRisk[]> {
  const fsHeadType = detectFSHeadType(fsHeadName);
  const template = FS_HEAD_TEMPLATES[fsHeadType];
  
  if (!template) {
    return [];
  }

  // Generate risks from template
  return template.keyRisks.map((risk, index) => ({
    id: `${fsHeadId}-RISK-${index + 1}`,
    fsHeadId,
    riskType: template.fraudRiskPresumed ? 'FRAUD' as const : 'INHERENT' as const,
    riskLevel: template.riskLevel === 'HIGH' ? 'HIGH' as const : 
               template.riskLevel === 'MODERATE' ? 'MEDIUM' as const : 'LOW' as const,
    description: risk.description,
    assertions: template.keyAssertions,
    isaReference: risk.isaReference || 'ISA 315',
    isFraudRisk: template.fraudRiskPresumed || risk.isaReference?.includes('240') || false
  }));
}

export default router;
