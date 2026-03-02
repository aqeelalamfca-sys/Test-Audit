import { prisma } from "../db";

export interface GLCodeValidationResult {
  isValid: boolean;
  errors: GLCodeValidationError[];
  warnings: GLCodeValidationError[];
  summary: {
    totalCodes: number;
    validCodes: number;
    missingCodes: number;
    duplicateCodes: number;
    invalidCodes: number;
  };
}

export interface GLCodeValidationError {
  type: 'MISSING' | 'DUPLICATE' | 'NOT_IN_COA' | 'CONFLICT';
  glCode: string;
  dataset: 'TB' | 'GL' | 'AR' | 'AP' | 'BANK' | 'PARTY';
  rowReference?: string;
  message: string;
  details?: Record<string, any>;
}

export interface GLCodeIntegritySummary {
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  coaUniqueness: {
    status: 'PASS' | 'FAIL' | 'WARNING';
    duplicateCount: number;
    errors: GLCodeValidationError[];
  };
  tbValidation: {
    status: 'PASS' | 'FAIL' | 'WARNING';
    totalCodes: number;
    validCodes: number;
    missingCodes: number;
    invalidCodes: number;
    errors: GLCodeValidationError[];
  };
  glValidation: {
    status: 'PASS' | 'FAIL' | 'WARNING';
    totalCodes: number;
    validCodes: number;
    missingCodes: number;
    invalidCodes: number;
    errors: GLCodeValidationError[];
  };
  openItemValidation: {
    status: 'PASS' | 'FAIL' | 'WARNING';
    arErrors: GLCodeValidationError[];
    apErrors: GLCodeValidationError[];
  };
  bankAccountValidation: {
    status: 'PASS' | 'FAIL' | 'WARNING';
    errors: GLCodeValidationError[];
  };
  summary: {
    totalCodes: number;
    validCodes: number;
    missingCodes: number;
    duplicateCodes: number;
    invalidCodes: number;
  };
}

export async function validateGLCodeUniqueness(engagementId: string): Promise<GLCodeValidationResult> {
  const errors: GLCodeValidationError[] = [];
  const warnings: GLCodeValidationError[] = [];
  
  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountClass: true,
      nature: true,
    },
  });

  const codeGroups = new Map<string, typeof coaAccounts>();
  
  for (const account of coaAccounts) {
    const code = account.accountCode?.trim();
    if (!code) continue;
    
    if (!codeGroups.has(code)) {
      codeGroups.set(code, []);
    }
    codeGroups.get(code)!.push(account);
  }

  let duplicateCount = 0;
  
  for (const [code, accounts] of codeGroups) {
    if (accounts.length > 1) {
      const uniqueNames = [...new Set(accounts.map(a => a.accountName?.trim()))];
      const uniqueClasses = [...new Set(accounts.map(a => a.accountClass?.trim()).filter(Boolean))];
      
      if (uniqueNames.length > 1 || uniqueClasses.length > 1) {
        duplicateCount++;
        errors.push({
          type: 'DUPLICATE',
          glCode: code,
          dataset: 'TB',
          message: `GL_CODE duplicate conflict: ${code} has multiple names/types`,
          details: {
            count: accounts.length,
            names: uniqueNames,
            classes: uniqueClasses,
            accountIds: accounts.map(a => a.id),
          },
        });
      } else {
        warnings.push({
          type: 'CONFLICT',
          glCode: code,
          dataset: 'TB',
          message: `GL_CODE ${code} appears ${accounts.length} times with same name/type`,
          details: {
            count: accounts.length,
            name: uniqueNames[0],
          },
        });
      }
    }
  }

  const totalCodes = codeGroups.size;
  const validCodes = totalCodes - duplicateCount;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalCodes,
      validCodes,
      missingCodes: 0,
      duplicateCodes: duplicateCount,
      invalidCodes: 0,
    },
  };
}

export async function validateGLCodesAgainstCOA(
  engagementId: string,
  glCodes: string[],
  dataset: 'TB' | 'GL' | 'AR' | 'AP' | 'BANK' | 'PARTY'
): Promise<GLCodeValidationResult> {
  const errors: GLCodeValidationError[] = [];
  const warnings: GLCodeValidationError[] = [];

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: { accountCode: true },
  });

  const validCodes = new Set(coaAccounts.map(a => a.accountCode?.trim()).filter(Boolean));
  
  const uniqueInputCodes = [...new Set(glCodes.map(c => c?.trim()).filter(Boolean))];
  const missingCodes: string[] = [];
  const nullOrEmptyCodes: number = glCodes.filter(c => !c || !c.trim()).length;

  for (const code of uniqueInputCodes) {
    if (!validCodes.has(code)) {
      missingCodes.push(code);
      errors.push({
        type: 'NOT_IN_COA',
        glCode: code,
        dataset,
        message: `GL_CODE not found in COA: ${code}`,
      });
    }
  }

  if (nullOrEmptyCodes > 0) {
    errors.push({
      type: 'MISSING',
      glCode: '',
      dataset,
      message: 'GL_CODE missing (required)',
      details: { count: nullOrEmptyCodes },
    });
  }

  const validCodeCount = uniqueInputCodes.length - missingCodes.length;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalCodes: glCodes.length,
      validCodes: validCodeCount,
      missingCodes: missingCodes.length,
      duplicateCodes: 0,
      invalidCodes: nullOrEmptyCodes,
    },
  };
}

export async function validateTBGLCodes(engagementId: string): Promise<GLCodeValidationResult> {
  const errors: GLCodeValidationError[] = [];
  const warnings: GLCodeValidationError[] = [];

  const tbEntries = await prisma.tBEntry.findMany({
    where: { engagementId },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      rowNumber: true,
    },
  });

  if (tbEntries.length === 0) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        totalCodes: 0,
        validCodes: 0,
        missingCodes: 0,
        duplicateCodes: 0,
        invalidCodes: 0,
      },
    };
  }

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: { accountCode: true },
  });

  const validCodes = new Set(coaAccounts.map(a => a.accountCode?.trim()).filter(Boolean));
  
  let missingCount = 0;
  let invalidCount = 0;
  const checkedCodes = new Set<string>();

  for (const entry of tbEntries) {
    const code = entry.accountCode?.trim();
    
    if (!code) {
      invalidCount++;
      errors.push({
        type: 'MISSING',
        glCode: '',
        dataset: 'TB',
        rowReference: `Row ${entry.rowNumber || entry.id}`,
        message: 'GL_CODE missing (required)',
        details: { entryId: entry.id },
      });
      continue;
    }

    if (checkedCodes.has(code)) continue;
    checkedCodes.add(code);

    if (!validCodes.has(code)) {
      missingCount++;
      errors.push({
        type: 'NOT_IN_COA',
        glCode: code,
        dataset: 'TB',
        rowReference: `Row ${entry.rowNumber || entry.id}`,
        message: `GL_CODE not found in COA: ${code}`,
        details: { entryId: entry.id, accountName: entry.accountName },
      });
    }
  }

  const validCodeCount = checkedCodes.size - missingCount;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalCodes: checkedCodes.size,
      validCodes: validCodeCount,
      missingCodes: missingCount,
      duplicateCodes: 0,
      invalidCodes: missingCount,
    },
  };
}

export async function validateGLEntryGLCodes(engagementId: string): Promise<GLCodeValidationResult> {
  const errors: GLCodeValidationError[] = [];
  const warnings: GLCodeValidationError[] = [];

  const glEntries = await prisma.gLEntry.findMany({
    where: { engagementId },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      rowNumber: true,
      voucherNumber: true,
    },
  });

  if (glEntries.length === 0) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        totalCodes: 0,
        validCodes: 0,
        missingCodes: 0,
        duplicateCodes: 0,
        invalidCodes: 0,
      },
    };
  }

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: { accountCode: true },
  });

  const validCodes = new Set(coaAccounts.map(a => a.accountCode?.trim()).filter(Boolean));
  
  let invalidCount = 0;
  const missingCodeSet = new Set<string>();
  const checkedCodes = new Set<string>();

  for (const entry of glEntries) {
    const code = entry.accountCode?.trim();
    
    if (!code) {
      invalidCount++;
      errors.push({
        type: 'MISSING',
        glCode: '',
        dataset: 'GL',
        rowReference: `Row ${entry.rowNumber}, Voucher ${entry.voucherNumber || 'N/A'}`,
        message: 'GL_CODE missing (required)',
        details: { entryId: entry.id },
      });
      continue;
    }

    checkedCodes.add(code);

    if (!validCodes.has(code) && !missingCodeSet.has(code)) {
      missingCodeSet.add(code);
      errors.push({
        type: 'NOT_IN_COA',
        glCode: code,
        dataset: 'GL',
        rowReference: `Row ${entry.rowNumber}`,
        message: `GL_CODE not found in COA: ${code}`,
        details: { entryId: entry.id, accountName: entry.accountName },
      });
    }
  }

  const validCodeCount = checkedCodes.size - missingCodeSet.size;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalCodes: checkedCodes.size,
      validCodes: validCodeCount,
      missingCodes: missingCodeSet.size,
      duplicateCodes: 0,
      invalidCodes: missingCodeSet.size,
    },
  };
}

export async function validateOpenItemGLCodes(engagementId: string): Promise<{
  arResult: GLCodeValidationResult;
  apResult: GLCodeValidationResult;
}> {
  const arErrors: GLCodeValidationError[] = [];
  const apErrors: GLCodeValidationError[] = [];
  const arWarnings: GLCodeValidationError[] = [];
  const apWarnings: GLCodeValidationError[] = [];

  const partyBalances = await prisma.importPartyBalance.findMany({
    where: { engagementId },
    select: {
      id: true,
      partyCode: true,
      partyName: true,
      partyType: true,
      controlAccountCode: true,
    },
  });

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: { accountCode: true },
  });

  const validCodes = new Set(coaAccounts.map(a => a.accountCode?.trim()).filter(Boolean));

  let arMissing = 0, arInvalid = 0, arTotal = 0, arValid = 0;
  let apMissing = 0, apInvalid = 0, apTotal = 0, apValid = 0;

  const arCheckedCodes = new Set<string>();
  const apCheckedCodes = new Set<string>();

  for (const item of partyBalances) {
    const isAR = item.partyType?.toUpperCase() === 'CUSTOMER';
    const isAP = item.partyType?.toUpperCase() === 'VENDOR';
    
    if (!isAR && !isAP) continue;

    const controlCode = item.controlAccountCode?.trim();
    
    if (isAR) {
      arTotal++;
      
      if (!controlCode) {
        arInvalid++;
        arErrors.push({
          type: 'MISSING',
          glCode: '',
          dataset: 'AR',
          rowReference: `Party: ${item.partyCode}`,
          message: 'AR control GL_CODE missing/invalid',
          details: { partyId: item.id, partyCode: item.partyCode, partyName: item.partyName },
        });
      } else if (!arCheckedCodes.has(controlCode)) {
        arCheckedCodes.add(controlCode);
        if (!validCodes.has(controlCode)) {
          arMissing++;
          arErrors.push({
            type: 'NOT_IN_COA',
            glCode: controlCode,
            dataset: 'AR',
            rowReference: `Party: ${item.partyCode}`,
            message: 'AR control GL_CODE missing/invalid',
            details: { partyId: item.id, partyCode: item.partyCode, controlCode },
          });
        } else {
          arValid++;
        }
      }
    }

    if (isAP) {
      apTotal++;
      
      if (!controlCode) {
        apInvalid++;
        apErrors.push({
          type: 'MISSING',
          glCode: '',
          dataset: 'AP',
          rowReference: `Party: ${item.partyCode}`,
          message: 'AP control GL_CODE missing/invalid',
          details: { partyId: item.id, partyCode: item.partyCode, partyName: item.partyName },
        });
      } else if (!apCheckedCodes.has(controlCode)) {
        apCheckedCodes.add(controlCode);
        if (!validCodes.has(controlCode)) {
          apMissing++;
          apErrors.push({
            type: 'NOT_IN_COA',
            glCode: controlCode,
            dataset: 'AP',
            rowReference: `Party: ${item.partyCode}`,
            message: 'AP control GL_CODE missing/invalid',
            details: { partyId: item.id, partyCode: item.partyCode, controlCode },
          });
        } else {
          apValid++;
        }
      }
    }
  }

  return {
    arResult: {
      isValid: arErrors.length === 0,
      errors: arErrors,
      warnings: arWarnings,
      summary: {
        totalCodes: arCheckedCodes.size,
        validCodes: arValid,
        missingCodes: arMissing,
        duplicateCodes: 0,
        invalidCodes: arInvalid,
      },
    },
    apResult: {
      isValid: apErrors.length === 0,
      errors: apErrors,
      warnings: apWarnings,
      summary: {
        totalCodes: apCheckedCodes.size,
        validCodes: apValid,
        missingCodes: apMissing,
        duplicateCodes: 0,
        invalidCodes: apInvalid,
      },
    },
  };
}

export async function validateBankAccountGLCodes(engagementId: string): Promise<GLCodeValidationResult> {
  const errors: GLCodeValidationError[] = [];
  const warnings: GLCodeValidationError[] = [];

  const bankBalances = await prisma.importBankBalance.findMany({
    where: { engagementId },
    select: {
      id: true,
      bankAccountCode: true,
      glBankAccountCode: true,
    },
  });

  if (bankBalances.length === 0) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        totalCodes: 0,
        validCodes: 0,
        missingCodes: 0,
        duplicateCodes: 0,
        invalidCodes: 0,
      },
    };
  }

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: { accountCode: true },
  });

  const validCodes = new Set(coaAccounts.map(a => a.accountCode?.trim()).filter(Boolean));

  let missingCount = 0;
  let invalidCount = 0;
  const checkedCodes = new Set<string>();

  for (const balance of bankBalances) {
    const glCode = balance.glBankAccountCode?.trim();
    
    if (!glCode) {
      invalidCount++;
      errors.push({
        type: 'MISSING',
        glCode: '',
        dataset: 'BANK',
        rowReference: `Bank Account: ${balance.bankAccountCode}`,
        message: 'Bank account GL_CODE missing/invalid',
        details: { balanceId: balance.id, bankAccountCode: balance.bankAccountCode },
      });
      continue;
    }

    if (checkedCodes.has(glCode)) continue;
    checkedCodes.add(glCode);

    if (!validCodes.has(glCode)) {
      missingCount++;
      errors.push({
        type: 'NOT_IN_COA',
        glCode,
        dataset: 'BANK',
        rowReference: `Bank Account: ${balance.bankAccountCode}`,
        message: 'Bank account GL_CODE missing/invalid',
        details: { balanceId: balance.id, bankAccountCode: balance.bankAccountCode },
      });
    }
  }

  const validCodeCount = checkedCodes.size - missingCount;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalCodes: checkedCodes.size,
      validCodes: validCodeCount,
      missingCodes: missingCount,
      duplicateCodes: 0,
      invalidCodes: missingCount,
    },
  };
}

export async function getGLCodeIntegritySummary(engagementId: string): Promise<GLCodeIntegritySummary> {
  const [coaResult, tbResult, glResult, openItemResults, bankResult] = await Promise.all([
    validateGLCodeUniqueness(engagementId),
    validateTBGLCodes(engagementId),
    validateGLEntryGLCodes(engagementId),
    validateOpenItemGLCodes(engagementId),
    validateBankAccountGLCodes(engagementId),
  ]);

  const determineStatus = (result: GLCodeValidationResult): 'PASS' | 'FAIL' | 'WARNING' => {
    if (result.errors.length > 0) return 'FAIL';
    if (result.warnings.length > 0) return 'WARNING';
    return 'PASS';
  };

  const coaStatus = determineStatus(coaResult);
  const tbStatus = determineStatus(tbResult);
  const glStatus = determineStatus(glResult);
  const arStatus = determineStatus(openItemResults.arResult);
  const apStatus = determineStatus(openItemResults.apResult);
  const openItemStatus: 'PASS' | 'FAIL' | 'WARNING' = 
    arStatus === 'FAIL' || apStatus === 'FAIL' ? 'FAIL' :
    arStatus === 'WARNING' || apStatus === 'WARNING' ? 'WARNING' : 'PASS';
  const bankStatus = determineStatus(bankResult);

  const allStatuses = [coaStatus, tbStatus, glStatus, openItemStatus, bankStatus];
  const overallStatus: 'PASS' | 'FAIL' | 'WARNING' = 
    allStatuses.includes('FAIL') ? 'FAIL' :
    allStatuses.includes('WARNING') ? 'WARNING' : 'PASS';

  const totalCodes = 
    coaResult.summary.totalCodes +
    tbResult.summary.totalCodes +
    glResult.summary.totalCodes +
    openItemResults.arResult.summary.totalCodes +
    openItemResults.apResult.summary.totalCodes +
    bankResult.summary.totalCodes;

  const validCodes = 
    coaResult.summary.validCodes +
    tbResult.summary.validCodes +
    glResult.summary.validCodes +
    openItemResults.arResult.summary.validCodes +
    openItemResults.apResult.summary.validCodes +
    bankResult.summary.validCodes;

  const missingCodes = 
    coaResult.summary.missingCodes +
    tbResult.summary.missingCodes +
    glResult.summary.missingCodes +
    openItemResults.arResult.summary.missingCodes +
    openItemResults.apResult.summary.missingCodes +
    bankResult.summary.missingCodes;

  const duplicateCodes = coaResult.summary.duplicateCodes;

  const invalidCodes = 
    coaResult.summary.invalidCodes +
    tbResult.summary.invalidCodes +
    glResult.summary.invalidCodes +
    openItemResults.arResult.summary.invalidCodes +
    openItemResults.apResult.summary.invalidCodes +
    bankResult.summary.invalidCodes;

  return {
    overallStatus,
    coaUniqueness: {
      status: coaStatus,
      duplicateCount: coaResult.summary.duplicateCodes,
      errors: coaResult.errors,
    },
    tbValidation: {
      status: tbStatus,
      totalCodes: tbResult.summary.totalCodes,
      validCodes: tbResult.summary.validCodes,
      missingCodes: tbResult.summary.missingCodes,
      invalidCodes: tbResult.summary.invalidCodes,
      errors: tbResult.errors,
    },
    glValidation: {
      status: glStatus,
      totalCodes: glResult.summary.totalCodes,
      validCodes: glResult.summary.validCodes,
      missingCodes: glResult.summary.missingCodes,
      invalidCodes: glResult.summary.invalidCodes,
      errors: glResult.errors,
    },
    openItemValidation: {
      status: openItemStatus,
      arErrors: openItemResults.arResult.errors,
      apErrors: openItemResults.apResult.errors,
    },
    bankAccountValidation: {
      status: bankStatus,
      errors: bankResult.errors,
    },
    summary: {
      totalCodes,
      validCodes,
      missingCodes,
      duplicateCodes,
      invalidCodes,
    },
  };
}

export async function validateAllGLCodes(engagementId: string): Promise<GLCodeValidationResult> {
  const summary = await getGLCodeIntegritySummary(engagementId);
  
  const allErrors: GLCodeValidationError[] = [
    ...summary.coaUniqueness.errors,
    ...summary.tbValidation.errors,
    ...summary.glValidation.errors,
    ...summary.openItemValidation.arErrors,
    ...summary.openItemValidation.apErrors,
    ...summary.bankAccountValidation.errors,
  ];

  return {
    isValid: summary.overallStatus === 'PASS',
    errors: allErrors,
    warnings: [],
    summary: summary.summary,
  };
}
