import { prisma } from "../db";
import { classifyAccount } from "./accountClassificationService";
import { Decimal } from "@prisma/client/runtime/library";

export interface SyncResult {
  success: boolean;
  engagementId: string;
  uploadVersionId: string | null;
  counts: {
    tbBatchCreated: boolean;
    tbEntries: number;
    glBatchCreated: boolean;
    glEntries: number;
    coaAccounts: number;
  };
  error?: string;
}

export async function syncImportDataToCore(
  engagementId: string,
  userId: string
): Promise<SyncResult> {
  try {
    const activeVersion = await prisma.uploadVersion.findFirst({
      where: { engagementId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    if (!activeVersion) {
      return {
        success: false,
        engagementId,
        uploadVersionId: null,
        counts: {
          tbBatchCreated: false,
          tbEntries: 0,
          glBatchCreated: false,
          glEntries: 0,
          coaAccounts: 0,
        },
        error: "No active upload version found for this engagement",
      };
    }

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: {
        id: true,
        firmId: true,
        periodStart: true,
        periodEnd: true,
        fiscalYearEnd: true,
      },
    });

    if (!engagement) {
      return {
        success: false,
        engagementId,
        uploadVersionId: activeVersion.id,
        counts: {
          tbBatchCreated: false,
          tbEntries: 0,
          glBatchCreated: false,
          glEntries: 0,
          coaAccounts: 0,
        },
        error: "Engagement not found",
      };
    }

    const periodStart = engagement.periodStart || new Date();
    const periodEnd = engagement.periodEnd || new Date();
    const fiscalYear = engagement.fiscalYearEnd
      ? engagement.fiscalYearEnd.getFullYear()
      : periodEnd.getFullYear();

    const batchName = `Import Sync - Version ${activeVersion.version}`;

    const result = await prisma.$transaction(async (tx) => {
      let tbBatchCreated = false;
      let tbEntries = 0;
      let glBatchCreated = false;
      let glEntries = 0;
      let coaAccounts = 0;

      const accountBalances = await tx.importAccountBalance.findMany({
        where: { engagementId },
        orderBy: { accountCode: "asc" },
      });

      if (accountBalances.length > 0) {
        let tbBatch = await tx.tBBatch.findFirst({
          where: {
            engagementId,
            sourceType: "CLIENT_PROVIDED",
            batchName,
          },
        });

        if (!tbBatch) {
          const maxBatchNumber = await tx.tBBatch.aggregate({
            where: { engagementId },
            _max: { batchNumber: true },
          });

          tbBatch = await tx.tBBatch.create({
            data: {
              engagementId,
              firmId: engagement.firmId,
              batchNumber: (maxBatchNumber._max.batchNumber || 0) + 1,
              batchName,
              version: 1,
              periodStart,
              periodEnd,
              fiscalYear,
              sourceType: "CLIENT_PROVIDED",
              sourceFileName: activeVersion.fileName,
              status: "DRAFT",
              uploadedById: userId,
              totalOpeningDebit: 0,
              totalOpeningCredit: 0,
              totalMovementDebit: 0,
              totalMovementCredit: 0,
              totalClosingDebit: 0,
              totalClosingCredit: 0,
            },
          });
          tbBatchCreated = true;
        } else {
          await tx.tBEntry.deleteMany({
            where: { batchId: tbBatch.id },
          });
        }

        const accountMap = new Map<
          string,
          {
            accountCode: string;
            accountName: string;
            openingDebit: Decimal;
            openingCredit: Decimal;
            closingDebit: Decimal;
            closingCredit: Decimal;
            accountClass: string | null;
            accountSubclass: string | null;
            fsHeadKey: string | null;
          }
        >();

        for (const balance of accountBalances) {
          const existing = accountMap.get(balance.accountCode) || {
            accountCode: balance.accountCode,
            accountName: balance.accountName || balance.accountCode,
            openingDebit: new Decimal(0),
            openingCredit: new Decimal(0),
            closingDebit: new Decimal(0),
            closingCredit: new Decimal(0),
            accountClass: balance.accountClass,
            accountSubclass: balance.accountSubclass,
            fsHeadKey: balance.fsHeadKey,
          };

          if (balance.balanceType === "OB") {
            existing.openingDebit = balance.debitAmount;
            existing.openingCredit = balance.creditAmount;
          } else if (balance.balanceType === "CB") {
            existing.closingDebit = balance.debitAmount;
            existing.closingCredit = balance.creditAmount;
          }

          accountMap.set(balance.accountCode, existing);
        }

        let totalOpeningDebit = new Decimal(0);
        let totalOpeningCredit = new Decimal(0);
        let totalClosingDebit = new Decimal(0);
        let totalClosingCredit = new Decimal(0);

        let rowNumber = 1;
        for (const [accountCode, data] of accountMap) {
          const openingBalance = data.openingDebit.minus(data.openingCredit);
          const closingBalance = data.closingDebit.minus(data.closingCredit);
          const movementDebit = data.closingDebit.minus(data.openingDebit);
          const movementCredit = data.closingCredit.minus(data.openingCredit);
          const movementNet = closingBalance.minus(openingBalance);

          await tx.tBEntry.create({
            data: {
              batchId: tbBatch.id,
              engagementId,
              accountCode,
              accountName: data.accountName,
              accountType: data.accountClass,
              accountCategory: data.accountSubclass,
              openingDebit: data.openingDebit,
              openingCredit: data.openingCredit,
              movementDebit,
              movementCredit,
              closingDebit: data.closingDebit,
              closingCredit: data.closingCredit,
              openingBalance,
              movementNet,
              closingBalance,
              sourceType: "CLIENT_PROVIDED",
              rowNumber: rowNumber++,
            },
          });

          tbEntries++;

          totalOpeningDebit = totalOpeningDebit.plus(data.openingDebit);
          totalOpeningCredit = totalOpeningCredit.plus(data.openingCredit);
          totalClosingDebit = totalClosingDebit.plus(data.closingDebit);
          totalClosingCredit = totalClosingCredit.plus(data.closingCredit);
        }

        await tx.tBBatch.update({
          where: { id: tbBatch.id },
          data: {
            totalOpeningDebit,
            totalOpeningCredit,
            totalMovementDebit: totalClosingDebit.minus(totalOpeningDebit),
            totalMovementCredit: totalClosingCredit.minus(totalOpeningCredit),
            totalClosingDebit,
            totalClosingCredit,
            status: "APPROVED",
          },
        });
      }

      const journalHeaders = await tx.importJournalHeader.findMany({
        where: { engagementId },
        include: { lines: true },
        orderBy: { voucherDate: "asc" },
      });

      if (journalHeaders.length > 0) {
        let glBatch = await tx.gLBatch.findFirst({
          where: {
            engagementId,
            batchName,
          },
        });

        if (!glBatch) {
          const maxGLBatchNumber = await tx.gLBatch.aggregate({
            where: { engagementId },
            _max: { batchNumber: true },
          });

          const totalDebits = journalHeaders.reduce(
            (sum, jh) => sum.plus(jh.totalDebit),
            new Decimal(0)
          );
          const totalCredits = journalHeaders.reduce(
            (sum, jh) => sum.plus(jh.totalCredit),
            new Decimal(0)
          );
          const totalEntries = journalHeaders.reduce(
            (sum, jh) => sum + jh.lines.length,
            0
          );

          glBatch = await tx.gLBatch.create({
            data: {
              engagementId,
              firmId: engagement.firmId,
              batchNumber: (maxGLBatchNumber._max.batchNumber || 0) + 1,
              batchName,
              periodStart,
              periodEnd,
              fiscalYear,
              version: 1,
              status: "DRAFT",
              uploadedById: userId,
              sourceFileName: activeVersion.fileName,
              totalDebits,
              totalCredits,
              entryCount: totalEntries,
              isBalanced: totalDebits.equals(totalCredits),
            },
          });
          glBatchCreated = true;
        } else {
          await tx.gLEntry.deleteMany({
            where: { batchId: glBatch.id },
          });

          const totalDebits = journalHeaders.reduce(
            (sum, jh) => sum.plus(jh.totalDebit),
            new Decimal(0)
          );
          const totalCredits = journalHeaders.reduce(
            (sum, jh) => sum.plus(jh.totalCredit),
            new Decimal(0)
          );
          const totalEntries = journalHeaders.reduce(
            (sum, jh) => sum + jh.lines.length,
            0
          );

          await tx.gLBatch.update({
            where: { id: glBatch.id },
            data: {
              totalDebits,
              totalCredits,
              entryCount: totalEntries,
              isBalanced: totalDebits.equals(totalCredits),
            },
          });
        }

        let glRowNumber = 1;
        for (const header of journalHeaders) {
          for (const line of header.lines) {
            await tx.gLEntry.create({
              data: {
                batchId: glBatch.id,
                engagementId,
                accountCode: line.accountCode,
                accountName: line.accountName || line.accountCode,
                transactionDate: header.voucherDate,
                debit: line.debit,
                credit: line.credit,
                voucherNumber: header.voucherNo,
                documentType: header.voucherType,
                narrative: line.narration || header.narration,
                description: line.description,
                costCenter: line.costCenter,
                counterparty: line.partyName,
                localCurrency: line.currency,
                transactionMonth: header.voucherDate.getMonth() + 1,
                transactionYear: header.voucherDate.getFullYear(),
                rowNumber: glRowNumber++,
              },
            });

            glEntries++;
          }
        }
      }

      const uniqueAccountsFromTB = await tx.importAccountBalance.findMany({
        where: { engagementId },
        distinct: ["accountCode"],
        select: {
          accountCode: true,
          accountName: true,
          accountClass: true,
          accountSubclass: true,
          fsHeadKey: true,
          classificationSource: true,
          classificationConfidence: true,
        },
      });

      const uniqueAccountsFromGL = await tx.importJournalLine.findMany({
        where: {
          journalHeader: { engagementId },
        },
        distinct: ["accountCode"],
        select: {
          accountCode: true,
          accountName: true,
        },
      });

      const coaAccountsToSync = new Map<
        string,
        {
          accountCode: string;
          accountName: string;
          accountClass: string | null;
          accountSubclass: string | null;
          fsHeadKey: string | null;
          classificationSource: string | null;
          classificationConfidence: number | null;
        }
      >();

      for (const acc of uniqueAccountsFromTB) {
        coaAccountsToSync.set(acc.accountCode, {
          accountCode: acc.accountCode,
          accountName: acc.accountName || acc.accountCode,
          accountClass: acc.accountClass,
          accountSubclass: acc.accountSubclass,
          fsHeadKey: acc.fsHeadKey,
          classificationSource: acc.classificationSource,
          classificationConfidence: acc.classificationConfidence
            ? Number(acc.classificationConfidence)
            : null,
        });
      }

      for (const acc of uniqueAccountsFromGL) {
        if (!coaAccountsToSync.has(acc.accountCode)) {
          const classification = classifyAccount(
            acc.accountCode,
            acc.accountName || acc.accountCode
          );

          coaAccountsToSync.set(acc.accountCode, {
            accountCode: acc.accountCode,
            accountName: acc.accountName || acc.accountCode,
            accountClass: classification?.accountClass || null,
            accountSubclass: classification?.accountSubclass || null,
            fsHeadKey: classification?.fsHeadKey || null,
            classificationSource: classification ? "RULE" : null,
            classificationConfidence: classification?.confidence || null,
          });
        }
      }

      const tbEntriesForCoa = await tx.tBEntry.findMany({
        where: { engagementId },
        select: {
          accountCode: true,
          openingBalance: true,
          closingBalance: true,
          openingDebit: true,
          openingCredit: true,
          closingDebit: true,
          closingCredit: true,
          movementDebit: true,
          movementCredit: true,
        },
      });

      const balanceMap = new Map(
        tbEntriesForCoa.map((e: { accountCode: string; openingBalance: any; closingBalance: any; openingDebit: any; openingCredit: any; closingDebit: any; closingCredit: any; movementDebit: any; movementCredit: any }) => [e.accountCode, e])
      );

      for (const [accountCode, data] of coaAccountsToSync) {
        const balances = balanceMap.get(accountCode);
        const openingBalance = balances?.openingBalance || new Decimal(0);
        const closingBalance = balances?.closingBalance || new Decimal(0);
        const periodDr =
          balances?.movementDebit ||
          (balances?.closingDebit || new Decimal(0)).minus(
            balances?.openingDebit || new Decimal(0)
          );
        const periodCr =
          balances?.movementCredit ||
          (balances?.closingCredit || new Decimal(0)).minus(
            balances?.openingCredit || new Decimal(0)
          );

        await tx.coAAccount.upsert({
          where: {
            engagementId_accountCode: {
              engagementId,
              accountCode,
            },
          },
          create: {
            engagementId,
            accountCode,
            accountName: data.accountName,
            accountClass: data.accountClass,
            accountSubclass: data.accountSubclass,
            fsLineItem: data.fsHeadKey,
            openingBalance,
            closingBalance,
            periodDr,
            periodCr,
            aiSuggestedFSLine: data.fsHeadKey,
            aiConfidence: data.classificationConfidence,
          },
          update: {
            accountName: data.accountName,
            accountClass: data.accountClass,
            accountSubclass: data.accountSubclass,
            openingBalance,
            closingBalance,
            periodDr,
            periodCr,
          },
        });

        coaAccounts++;
      }

      return {
        tbBatchCreated,
        tbEntries,
        glBatchCreated,
        glEntries,
        coaAccounts,
      };
    });

    return {
      success: true,
      engagementId,
      uploadVersionId: activeVersion.id,
      counts: result,
    };
  } catch (error: any) {
    console.error("Import sync error:", error);
    return {
      success: false,
      engagementId,
      uploadVersionId: null,
      counts: {
        tbBatchCreated: false,
        tbEntries: 0,
        glBatchCreated: false,
        glEntries: 0,
        coaAccounts: 0,
      },
      error: error.message || "An error occurred during sync",
    };
  }
}
