import { Router } from "express";
import { getReconciliationStatus, validatePhaseTransition } from "./services/reconciliationService";
import { requireAuth } from "./auth";

const router = Router();

interface HardControl {
  id: string;
  category: string;
  label: string;
  status: "PASS" | "FAIL" | "WARNING" | "NOT_APPLICABLE";
  isaReference: string;
  details: string;
  fixRoute?: string;
  fixAction?: string;
}

router.get("/api/hard-controls/:engagementId", requireAuth, async (req, res) => {
  try {
    const { engagementId } = req.params;
    const reconStatus = await getReconciliationStatus(engagementId);
    
    const reconDetails: string[] = [];
    if (!reconStatus.tbStatus.hasData || !reconStatus.glStatus.hasData) {
      reconDetails.push("Both TB and GL data are required for reconciliation");
    } else if (reconStatus.glCodeRecon.isReconciled) {
      reconDetails.push("TB and GL are reconciled (code-wise)");
    } else {
      if (reconStatus.glCodeRecon.unmatchedInTb.length > 0) {
        reconDetails.push(`Codes in TB but not GL: ${reconStatus.glCodeRecon.unmatchedInTb.slice(0, 5).join(", ")}${reconStatus.glCodeRecon.unmatchedInTb.length > 5 ? ` (+${reconStatus.glCodeRecon.unmatchedInTb.length - 5} more)` : ""}`);
      }
      if (reconStatus.glCodeRecon.unmatchedInGl.length > 0) {
        reconDetails.push(`Codes in GL but not TB: ${reconStatus.glCodeRecon.unmatchedInGl.slice(0, 5).join(", ")}${reconStatus.glCodeRecon.unmatchedInGl.length > 5 ? ` (+${reconStatus.glCodeRecon.unmatchedInGl.length - 5} more)` : ""}`);
      }
      if (reconStatus.glCodeRecon.amountMismatches.length > 0) {
        reconDetails.push(`${reconStatus.glCodeRecon.amountMismatches.length} code(s) with amount mismatches`);
      }
      if (reconStatus.glCodeRecon.duplicateGlCodes.length > 0) {
        reconDetails.push(`Duplicate codes in TB: ${reconStatus.glCodeRecon.duplicateGlCodes.join(", ")}`);
      }
    }

    const controls: HardControl[] = [
      {
        id: "TB_BALANCE",
        category: "Trial Balance",
        label: "TB Debits = Credits",
        status: !reconStatus.tbStatus.hasData ? "NOT_APPLICABLE" : reconStatus.tbBalanced ? "PASS" : "FAIL",
        isaReference: "ISA 500",
        details: reconStatus.tbStatus.hasData 
          ? `Debits: ${reconStatus.tbStatus.totalDebits.toLocaleString()}, Credits: ${reconStatus.tbStatus.totalCredits.toLocaleString()}, Difference: ${reconStatus.tbStatus.difference.toLocaleString()}`
          : "No Trial Balance data uploaded",
        fixRoute: "tb-review",
        fixAction: "Review and correct Trial Balance entries"
      },
      {
        id: "GL_BALANCE",
        category: "General Ledger",
        label: "GL Debits = Credits",
        status: !reconStatus.glStatus.hasData ? "NOT_APPLICABLE" : reconStatus.glBalanced ? "PASS" : "FAIL",
        isaReference: "ISA 500",
        details: reconStatus.glStatus.hasData 
          ? `Debits: ${reconStatus.glStatus.totalDebits.toLocaleString()}, Credits: ${reconStatus.glStatus.totalCredits.toLocaleString()}, Difference: ${reconStatus.glStatus.difference.toLocaleString()}`
          : "No General Ledger data uploaded",
        fixRoute: "requisition",
        fixAction: "Upload and validate General Ledger"
      },
      {
        id: "TB_GL_RECON",
        category: "Reconciliation",
        label: "GL Code-wise TB/GL Reconciliation",
        status: !reconStatus.tbStatus.hasData || !reconStatus.glStatus.hasData 
          ? "NOT_APPLICABLE" 
          : reconStatus.tbGlReconciled ? "PASS" : "FAIL",
        isaReference: "ISA 500/520",
        details: reconDetails.join("; "),
        fixRoute: "tb-review",
        fixAction: "Review TB/GL reconciliation differences"
      },
    ];

    const summary = {
      totalControls: controls.length,
      passed: controls.filter(c => c.status === "PASS").length,
      failed: controls.filter(c => c.status === "FAIL").length,
      warnings: controls.filter(c => c.status === "WARNING").length,
      notApplicable: controls.filter(c => c.status === "NOT_APPLICABLE").length,
      overallStatus: controls.some(c => c.status === "FAIL") ? "BLOCKED" 
        : controls.some(c => c.status === "WARNING") ? "WARNINGS" 
        : "CLEAR"
    };

    res.json({ controls, summary, phaseRequirements: reconStatus.phaseRequirements });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to validate hard controls" });
  }
});

router.get("/api/hard-controls/:engagementId/phase/:targetPhase", requireAuth, async (req, res) => {
  try {
    const { engagementId, targetPhase } = req.params;
    const result = await validatePhaseTransition(engagementId, targetPhase);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to validate phase transition" });
  }
});

router.post("/api/validate-push/:engagementId", requireAuth, async (req, res) => {
  try {
    const { engagementId } = req.params;
    const reconStatus = await getReconciliationStatus(engagementId);

    const reconDetails: string[] = [];
    if (reconStatus.tbStatus.hasData && reconStatus.glStatus.hasData && !reconStatus.tbGlReconciled) {
      const gc = reconStatus.glCodeRecon;
      if (gc.unmatchedInTb.length > 0) reconDetails.push(`Codes in TB but not GL: ${gc.unmatchedInTb.slice(0, 5).join(", ")}${gc.unmatchedInTb.length > 5 ? ` (+${gc.unmatchedInTb.length - 5} more)` : ""}`);
      if (gc.unmatchedInGl.length > 0) reconDetails.push(`Codes in GL but not TB: ${gc.unmatchedInGl.slice(0, 5).join(", ")}${gc.unmatchedInGl.length > 5 ? ` (+${gc.unmatchedInGl.length - 5} more)` : ""}`);
      if (gc.amountMismatches.length > 0) reconDetails.push(`${gc.amountMismatches.length} code(s) with amount mismatches`);
      if (gc.duplicateGlCodes.length > 0) reconDetails.push(`Duplicate codes in TB: ${gc.duplicateGlCodes.join(", ")}`);
    }

    const results = [
      {
        id: "TB_BALANCE",
        label: "TB Debits = Credits",
        passed: reconStatus.tbStatus.hasData ? reconStatus.tbBalanced : false,
        applicable: reconStatus.tbStatus.hasData,
        details: reconStatus.tbStatus.hasData
          ? `Debits: ${reconStatus.tbStatus.totalDebits.toLocaleString()}, Credits: ${reconStatus.tbStatus.totalCredits.toLocaleString()}, Difference: ${reconStatus.tbStatus.difference.toLocaleString()}`
          : "No Trial Balance data uploaded",
      },
      {
        id: "GL_BALANCE",
        label: "GL Debits = Credits",
        passed: reconStatus.glStatus.hasData ? reconStatus.glBalanced : false,
        applicable: reconStatus.glStatus.hasData,
        details: reconStatus.glStatus.hasData
          ? `Debits: ${reconStatus.glStatus.totalDebits.toLocaleString()}, Credits: ${reconStatus.glStatus.totalCredits.toLocaleString()}, Difference: ${reconStatus.glStatus.difference.toLocaleString()}`
          : "No General Ledger data uploaded",
      },
      {
        id: "TB_GL_RECON",
        label: "GL Code-wise TB/GL Reconciliation",
        passed: reconStatus.tbGlReconciled,
        applicable: reconStatus.tbStatus.hasData && reconStatus.glStatus.hasData,
        details: !reconStatus.tbStatus.hasData || !reconStatus.glStatus.hasData
          ? "Both TB and GL must be uploaded first"
          : reconStatus.tbGlReconciled
          ? "TB and GL are reconciled (code-wise)"
          : reconDetails.join("; "),
        glCodeRecon: reconStatus.glCodeRecon,
      },
    ];

    const errors: string[] = [];
    for (const r of results) {
      if (!r.applicable) continue;
      if (!r.passed) {
        errors.push(`${r.label}: ${r.details || "Failed"}`);
      }
    }

    const applicableResults = results.filter(r => r.applicable);
    const noDataYet = applicableResults.length === 0;
    const allPassed = applicableResults.length > 0 && applicableResults.every(r => r.passed);

    res.json({
      validated: allPassed,
      pushed: allPassed,
      noDataYet,
      results,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to validate and push" });
  }
});

export default router;
