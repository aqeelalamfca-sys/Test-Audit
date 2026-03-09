import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "./auth";
import { 
  getGLCodeIntegritySummary, 
  validateGLCodeUniqueness,
  validateTBGLCodes,
  validateGLEntryGLCodes,
  validateOpenItemGLCodes,
  validateBankAccountGLCodes,
  GLCodeValidationError
} from "./services/glCodeValidationService";
import {
  reconcileTBvsGL,
  reconcileARControl,
  reconcileAPControl,
  reconcileBankControl,
  getAllReconciliations,
  getReconciliationDrilldown,
  ReconciliationResult
} from "./services/glCodeReconciliationService";

const router = Router();

function transformErrorsToMessages(errors: GLCodeValidationError[]): string[] {
  return errors.map(e => {
    if (e.rowReference) {
      return `${e.message} (${e.rowReference})`;
    }
    return e.message;
  });
}

function mapReconciliationType(type: string): 'tb-gl' | 'ar-control' | 'ap-control' | 'bank-control' {
  const typeMap: Record<string, 'tb-gl' | 'ar-control' | 'ap-control' | 'bank-control'> = {
    'TB_GL': 'tb-gl',
    'AR_CONTROL': 'ar-control',
    'AP_CONTROL': 'ap-control',
    'BANK_CONTROL': 'bank-control',
  };
  return typeMap[type] || 'tb-gl';
}

function getReconciliationLabel(type: string): string {
  const labelMap: Record<string, string> = {
    'TB_GL': 'TB ↔ GL',
    'AR_CONTROL': 'AR ↔ Control',
    'AP_CONTROL': 'AP ↔ Control',
    'BANK_CONTROL': 'Bank ↔ Control',
  };
  return labelMap[type] || type;
}

function transformReconciliationToSummary(result: ReconciliationResult) {
  return {
    type: mapReconciliationType(result.reconciliationType),
    label: getReconciliationLabel(result.reconciliationType),
    status: result.status,
    matchedCount: result.matchedCount,
    totalCount: result.items.length,
    netVariance: result.summary.netDifference,
  };
}

router.get("/:engagementId/glcode/integrity", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const result = await getGLCodeIntegritySummary(engagementId);
    
    const transformedResponse = {
      overallStatus: result.overallStatus,
      totalGLCodes: result.summary.totalCodes,
      validCount: result.summary.validCodes,
      missingCount: result.summary.missingCodes,
      duplicateCount: result.summary.duplicateCodes,
      invalidCount: result.summary.invalidCodes,
      datasetErrors: [
        {
          dataset: 'COA',
          status: result.coaUniqueness.status,
          errorCount: result.coaUniqueness.errors.length,
          errors: result.coaUniqueness.errors.map(e => ({
            type: e.type,
            glCode: e.glCode,
            message: e.message,
            rowReference: e.rowReference,
          })),
        },
        {
          dataset: 'TB',
          status: result.tbValidation.status,
          errorCount: result.tbValidation.errors.length,
          errors: result.tbValidation.errors.map(e => ({
            type: e.type,
            glCode: e.glCode,
            message: e.message,
            rowReference: e.rowReference,
          })),
        },
        {
          dataset: 'GL',
          status: result.glValidation.status,
          errorCount: result.glValidation.errors.length,
          errors: result.glValidation.errors.map(e => ({
            type: e.type,
            glCode: e.glCode,
            message: e.message,
            rowReference: e.rowReference,
          })),
        },
        {
          dataset: 'AR',
          status: result.openItemValidation.arErrors.length > 0 ? 'FAIL' : 'PASS',
          errorCount: result.openItemValidation.arErrors.length,
          errors: result.openItemValidation.arErrors.map(e => ({
            type: e.type,
            glCode: e.glCode,
            message: e.message,
            rowReference: e.rowReference,
          })),
        },
        {
          dataset: 'AP',
          status: result.openItemValidation.apErrors.length > 0 ? 'FAIL' : 'PASS',
          errorCount: result.openItemValidation.apErrors.length,
          errors: result.openItemValidation.apErrors.map(e => ({
            type: e.type,
            glCode: e.glCode,
            message: e.message,
            rowReference: e.rowReference,
          })),
        },
        {
          dataset: 'BANK',
          status: result.bankAccountValidation.status,
          errorCount: result.bankAccountValidation.errors.length,
          errors: result.bankAccountValidation.errors.map(e => ({
            type: e.type,
            glCode: e.glCode,
            message: e.message,
            rowReference: e.rowReference,
          })),
        },
      ],
    };
    
    res.json(transformedResponse);
  } catch (error) {
    console.error("GL_CODE integrity summary error:", error);
    res.status(500).json({ error: "Failed to get GL_CODE integrity summary" });
  }
});

router.get("/:engagementId/glcode/integrity/coa", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const result = await validateGLCodeUniqueness(engagementId);
    res.json(result);
  } catch (error) {
    console.error("COA uniqueness validation error:", error);
    res.status(500).json({ error: "Failed to validate COA uniqueness" });
  }
});

router.get("/:engagementId/glcode/integrity/tb", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const result = await validateTBGLCodes(engagementId);
    res.json(result);
  } catch (error) {
    console.error("TB GL_CODE validation error:", error);
    res.status(500).json({ error: "Failed to validate TB GL_CODEs" });
  }
});

router.get("/:engagementId/glcode/integrity/gl", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const result = await validateGLEntryGLCodes(engagementId);
    res.json(result);
  } catch (error) {
    console.error("GL entries GL_CODE validation error:", error);
    res.status(500).json({ error: "Failed to validate GL entry GL_CODEs" });
  }
});

router.get("/:engagementId/glcode/integrity/openitems", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const result = await validateOpenItemGLCodes(engagementId);
    res.json(result);
  } catch (error) {
    console.error("Open items GL_CODE validation error:", error);
    res.status(500).json({ error: "Failed to validate open item GL_CODEs" });
  }
});

router.get("/:engagementId/glcode/integrity/bank", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const result = await validateBankAccountGLCodes(engagementId);
    res.json(result);
  } catch (error) {
    console.error("Bank account GL_CODE validation error:", error);
    res.status(500).json({ error: "Failed to validate bank account GL_CODEs" });
  }
});

router.get("/:engagementId/reconciliations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await getAllReconciliations(engagementId, tolerance);
    
    const reconciliations = [
      transformReconciliationToSummary(result.tbGl),
      transformReconciliationToSummary(result.arControl),
      transformReconciliationToSummary(result.apControl),
      transformReconciliationToSummary(result.bankControl),
    ];
    
    res.json({
      reconciliations,
      overallStatus: result.overallStatus,
    });
  } catch (error) {
    console.error("All reconciliations error:", error);
    res.status(500).json({ error: "Failed to get reconciliations" });
  }
});

router.get("/:engagementId/reconciliations/tb-gl", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await reconcileTBvsGL(engagementId, tolerance);
    res.json(result);
  } catch (error) {
    console.error("TB vs GL reconciliation error:", error);
    res.status(500).json({ error: "Failed to reconcile TB vs GL" });
  }
});

router.get("/:engagementId/reconciliations/ar-control", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await reconcileARControl(engagementId, tolerance);
    res.json(result);
  } catch (error) {
    console.error("AR control reconciliation error:", error);
    res.status(500).json({ error: "Failed to reconcile AR control" });
  }
});

router.get("/:engagementId/reconciliations/ap-control", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await reconcileAPControl(engagementId, tolerance);
    res.json(result);
  } catch (error) {
    console.error("AP control reconciliation error:", error);
    res.status(500).json({ error: "Failed to reconcile AP control" });
  }
});

router.get("/:engagementId/reconciliations/bank-control", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await reconcileBankControl(engagementId, tolerance);
    res.json(result);
  } catch (error) {
    console.error("Bank control reconciliation error:", error);
    res.status(500).json({ error: "Failed to reconcile bank control" });
  }
});

router.get("/:engagementId/reconciliations/tb-gl/details", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await reconcileTBvsGL(engagementId, tolerance);
    
    const details = result.items.map(item => ({
      glCode: item.glCode,
      glName: item.glName,
      sourceAmount: item.sourceAmount,
      targetAmount: item.targetAmount,
      difference: item.difference,
      status: item.status,
    }));
    
    res.json(details);
  } catch (error) {
    console.error("TB vs GL reconciliation details error:", error);
    res.status(500).json({ error: "Failed to get TB vs GL reconciliation details" });
  }
});

router.get("/:engagementId/reconciliations/ar-control/details", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await reconcileARControl(engagementId, tolerance);
    
    const details = result.items.map(item => ({
      glCode: item.glCode,
      glName: item.glName,
      sourceAmount: item.sourceAmount,
      targetAmount: item.targetAmount,
      difference: item.difference,
      status: item.status,
    }));
    
    res.json(details);
  } catch (error) {
    console.error("AR control reconciliation details error:", error);
    res.status(500).json({ error: "Failed to get AR control reconciliation details" });
  }
});

router.get("/:engagementId/reconciliations/ap-control/details", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await reconcileAPControl(engagementId, tolerance);
    
    const details = result.items.map(item => ({
      glCode: item.glCode,
      glName: item.glName,
      sourceAmount: item.sourceAmount,
      targetAmount: item.targetAmount,
      difference: item.difference,
      status: item.status,
    }));
    
    res.json(details);
  } catch (error) {
    console.error("AP control reconciliation details error:", error);
    res.status(500).json({ error: "Failed to get AP control reconciliation details" });
  }
});

router.get("/:engagementId/reconciliations/bank-control/details", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const tolerance = parseFloat(req.query.tolerance as string) || 0.01;
    const result = await reconcileBankControl(engagementId, tolerance);
    
    const details = result.items.map(item => ({
      glCode: item.glCode,
      glName: item.glName,
      sourceAmount: item.sourceAmount,
      targetAmount: item.targetAmount,
      difference: item.difference,
      status: item.status,
    }));
    
    res.json(details);
  } catch (error) {
    console.error("Bank control reconciliation details error:", error);
    res.status(500).json({ error: "Failed to get bank control reconciliation details" });
  }
});

router.get("/:engagementId/reconciliations/:type/drilldown/:glCode", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, type, glCode } = req.params;
    
    const typeMap: Record<string, string> = {
      'tb-gl': 'TB_GL',
      'tb_gl': 'TB_GL',
      'ar-control': 'AR_CONTROL',
      'ar_control': 'AR_CONTROL',
      'ap-control': 'AP_CONTROL',
      'ap_control': 'AP_CONTROL',
      'bank-control': 'BANK_CONTROL',
      'bank_control': 'BANK_CONTROL',
    };
    
    const reconciliationType = typeMap[type];
    if (!reconciliationType) {
      return res.status(400).json({ error: "Invalid reconciliation type" });
    }
    
    const result = await getReconciliationDrilldown(engagementId, reconciliationType, glCode);
    
    const transformedResponse = {
      glCode: result.glCode,
      glName: result.glName,
      sourceItems: result.sourceItems.map(item => ({
        description: item.description,
        amount: item.amount,
        reference: item.reference,
        date: item.date,
      })),
      targetItems: result.targetItems.map(item => ({
        description: item.description,
        amount: item.amount,
        reference: item.reference,
        date: item.date,
      })),
      sourceTotal: result.sourceTotal,
      targetTotal: result.targetTotal,
      difference: result.difference,
    };
    
    res.json(transformedResponse);
  } catch (error) {
    console.error("Reconciliation drilldown error:", error);
    res.status(500).json({ error: "Failed to get reconciliation drilldown" });
  }
});

export default router;
