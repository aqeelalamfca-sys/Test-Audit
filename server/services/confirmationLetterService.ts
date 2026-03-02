import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageBreak,
  VerticalAlign,
  TabStopPosition,
  TabStopType,
} from "docx";

interface ConfirmationData {
  type: "AR" | "AP" | "BANK" | "LEGAL" | "TAX";
  partyCode?: string;
  partyName: string;
  contactEmail?: string;
  contactPerson?: string;
  balance: number;
  currency?: string;
  asOfDate?: string;
  engagementName?: string;
  clientName?: string;
  auditorFirmName?: string;
  auditorAddress?: string;
  auditorPhone?: string;
  bankBranch?: string;
  bankAddress?: string;
  refNumber?: string;
  periodStartDate?: string;
  partyAddress?: string;
  partyCity?: string;
}

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function createHeaderCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    borders: tableBorders,
    shading: { fill: "E8E8E8" },
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  });
}

function createCell(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18 })],
        alignment,
      }),
    ],
    borders: tableBorders,
    verticalAlign: VerticalAlign.CENTER,
  });
}

function createEmptyCell(): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: " ", size: 18 })] })],
    borders: tableBorders,
    verticalAlign: VerticalAlign.CENTER,
  });
}

export async function generateBankConfirmationLetter(
  data: ConfirmationData,
  clientInfo: {
    clientName: string;
    fiscalYearEnd: string;
    auditorFirmName: string;
    auditorAddress: string;
    periodStartDate?: string;
  }
): Promise<Buffer> {
  const currentDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const fiscalYearEnd = data.asOfDate || clientInfo.fiscalYearEnd;
  const periodStartDate = clientInfo.periodStartDate || "July 01, " + (new Date().getFullYear() - 1);
  const refNumber = data.refNumber || `${clientInfo.clientName.substring(0, 3).toUpperCase()}/FY${new Date().getFullYear().toString().slice(-2)}/BC-01`;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: `Dated: ${currentDate}`, size: 20 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Ref: ${refNumber}`, size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "The Manager", size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyName + ",", size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.bankBranch || "Main Branch,", size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.bankAddress || "Lahore.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Dear Sir/ Madam,", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: clientInfo.clientName.toUpperCase(), bold: true, size: 22 }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `In accordance with your above-named customer's instructions given hereon, please send DIRECT to us at the address given below, as auditors of your customer, the following information relating to their affairs at your branch as of the close of business on ${fiscalYearEnd}, and, in the case of items 2, 4 and 9, during the period since ${periodStartDate}.`,
                size: 20,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Please state against each item any factors which may limit the completeness of your reply; if there is nothing to report, state 'NONE.'",
                size: 20,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "It is understood that any replies given are in strict confidence, for the purposes of audit.",
                size: 20,
                italics: true,
              }),
            ],
            spacing: { after: 300 },
          }),

          // Section 1: Bank Accounts
          new Paragraph({
            children: [new TextRun({ text: "Bank Accounts", bold: true, size: 22, underline: {} })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "1)\tFull titles of all accounts, including overdrafts and running and term finances under markup arrangements, whether in rupee or in any other currency together with the account numbers and balances thereon, including NIL balances:",
                size: 20,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "a)\twhere your customer's name is the sole name in the title;", size: 20 })],
            indent: { left: 720 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "b)\twhere your customer's name is joint with that of other parties;", size: 20 })],
            indent: { left: 720 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "c)\tWhere the account is in a trade name.", size: 20 })],
            indent: { left: 720 },
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell("Full title of account"),
                  createHeaderCell("Type of account"),
                  createHeaderCell("Account number"),
                  createHeaderCell("Currency"),
                  createHeaderCell("Balance (Dr./Cr.)"),
                ],
              }),
              new TableRow({ children: [createEmptyCell(), createEmptyCell(), createEmptyCell(), createEmptyCell(), createEmptyCell()] }),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),

          new Paragraph({
            children: [new TextRun({ text: "Notes", bold: true, size: 20 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "(i)\tWhere the amount is subject to any restriction (e.g. garnishee order or arrestment) or exchange control consideration (e.g. 'blocked account') information regarding the nature and extent of restriction should be stated.",
                size: 18,
              }),
            ],
            indent: { left: 360 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "(ii)\tWhere the authority upon which you are providing this information does not cover any amounts held jointly with other parties, please refer to your customer in order to obtain the requisite authority of the other parties with a copy to us.",
                size: 18,
              }),
            ],
            indent: { left: 360 },
            spacing: { after: 200 },
          }),

          // Section 2-14 abbreviated for space
          new Paragraph({
            children: [new TextRun({ text: "2)\tFull titles and dates of closure of all accounts closed during the period.", size: 20 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "3)\tDetails of amounts accrued but not charged or credited as at the above date.", size: 20 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "4)\tThe amount of mark-up/interest charged during the period.", size: 20 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "5)\tParticulars of any written acknowledgment of set-off.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Facilities", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "6)\tDetails of leasing facilities, loans, overdrafts, cash credit facilities.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Contingent Liabilities", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "7)\tNature, currency, amount and extent of all contingent liabilities.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Derivatives and Commodity Trading", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "8)\tDetails of all outstanding contracts.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Security", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "9)\tInformation regarding securities in respect of facilities.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Custodies", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "10)\tInvestments, bills of exchange, documents of title held but not charged.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Assets under the Islamic Modes of Finance", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "11)\tDetails of assets covered under Islamic mode of finance.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Customer's other Assets Held", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "12)\tFull details of investments, bills of exchange, documents of title.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Additional Banking Relationship", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "13)\tA list of other banks where a relationship has been established.", size: 20 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Other Information", bold: true, size: 22, underline: {} })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "14)\tOther related information, if any.", size: 20 })],
            spacing: { after: 400 },
          }),

          new Paragraph({
            children: [new TextRun({ text: "Yours faithfully,", size: 20 })],
            spacing: { after: 300 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "For and on behalf of;", bold: true, size: 20 })] }),
                      new Paragraph({ text: "", spacing: { after: 400 } }),
                      new Paragraph({ children: [new TextRun({ text: "_________________________", size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: clientInfo.clientName, bold: true, size: 20 })] }),
                    ],
                    borders: noBorders,
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "For and on behalf of;", bold: true, size: 20 })] }),
                      new Paragraph({ text: "", spacing: { after: 400 } }),
                      new Paragraph({ children: [new TextRun({ text: "_________________________", size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: clientInfo.auditorFirmName, bold: true, size: 20 })] }),
                    ],
                    borders: noBorders,
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

export async function generateARAPConfirmationLetter(
  data: ConfirmationData,
  clientInfo: {
    clientName: string;
    fiscalYearEnd: string;
    auditorFirmName: string;
    auditorAddress: string;
    auditorPhone?: string;
  }
): Promise<Buffer> {
  const currentDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const asOfDate = data.asOfDate || clientInfo.fiscalYearEnd;
  const isAR = data.type === "AR";
  const confirmationType = isAR ? "RECEIVABLES" : "PAYABLE";
  const balanceType = isAR ? "receivable" : "payable";
  const oppositeType = isAR ? "payable" : "receivable";
  const refPrefix = isAR ? "RC" : "PC";
  const refNumber = data.refNumber || `____/${refPrefix}/${new Date().getFullYear()}/01`;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children: [
          // Reference and Date
          new Paragraph({
            children: [
              new TextRun({ text: "Ref:\t", bold: true, size: 22 }),
              new TextRun({ text: refNumber, size: 22 }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Dated:\t", bold: true, size: 22 }),
              new TextRun({ text: currentDate, size: 22 }),
            ],
            spacing: { after: 200 },
          }),

          // Addressee
          new Paragraph({
            children: [new TextRun({ text: data.contactPerson || "Name of Coordinating Person", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyName, size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyAddress || "Address,", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyCity || "City,", size: 22 })],
            spacing: { after: 300 },
          }),

          // Salutation
          new Paragraph({
            children: [new TextRun({ text: "Dear Sir,", size: 22 })],
            spacing: { after: 200 },
          }),

          // Title
          new Paragraph({
            children: [
              new TextRun({ text: `${confirmationType} CONFIRMATION REQUEST`, bold: true, size: 24, underline: {} }),
            ],
            spacing: { after: 300 },
          }),

          // Body
          new Paragraph({
            children: [
              new TextRun({
                text: `Our records show a ${balanceType} balance of Rs. `,
                size: 22,
              }),
              new TextRun({
                text: data.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }),
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: ` at the close of business on ${asOfDate}.`,
                size: 22,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `To ensure an independent verification of this balance, we shall appreciate, if you will kindly check this balance with your records and send your confirmation DIRECT to our auditors, `,
                size: 22,
              }),
              new TextRun({
                text: `${clientInfo.auditorFirmName} (Chartered Accountants)`,
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: `, ${clientInfo.auditorAddress}`,
                size: 22,
              }),
              clientInfo.auditorPhone ? new TextRun({ text: `, Phone # ${clientInfo.auditorPhone}`, size: 22 }) : new TextRun({ text: "", size: 22 }),
              new TextRun({
                text: ` by completing the form below.`,
                size: 22,
              }),
            ],
            spacing: { after: 300 },
          }),

          // Closing
          new Paragraph({
            children: [new TextRun({ text: "Yours faithfully,", size: 22 })],
            spacing: { after: 200 },
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: "_______________________", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Signature", size: 22 })],
            spacing: { after: 200 },
          }),

          // Note for AR only
          ...(isAR ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: `This is not a request for payment and remittances should not be sent to ${clientInfo.auditorFirmName}, (Chartered Accountants).`,
                  size: 20,
                  italics: true,
                }),
              ],
              spacing: { after: 400 },
            }),
          ] : [new Paragraph({ text: "", spacing: { after: 200 } })]),

          // Separator
          new Paragraph({
            children: [new TextRun({ text: "─".repeat(80), size: 18 })],
            spacing: { after: 300 },
          }),

          // Reply Section
          new Paragraph({
            children: [
              new TextRun({ text: `COMPANY NAME: `, bold: true, size: 22 }),
              new TextRun({ text: clientInfo.clientName, size: 22 }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `We confirm that the ${oppositeType} balance of Rs. __________________ as at ${asOfDate} is in agreement with our books.`,
                size: 22,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "The details of difference are as follows:", size: 22 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "________________________________________________________________________", size: 22 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "________________________________________________________________________", size: 22 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "________________________________________________________________________", size: 22 })],
            spacing: { after: 300 },
          }),

          // Signature block
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "____________________", size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: "Name", size: 18 })] }),
                    ],
                    borders: noBorders,
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "____________________", size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: "Designation", size: 18 })] }),
                    ],
                    borders: noBorders,
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "____________________", size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: "Signature", size: 18 })] }),
                    ],
                    borders: noBorders,
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "____________________", size: 20 })] }),
                      new Paragraph({ children: [new TextRun({ text: "Date", size: 18 })] }),
                    ],
                    borders: noBorders,
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

export async function generateLegalAdvisorConfirmationLetter(
  data: ConfirmationData,
  clientInfo: {
    clientName: string;
    fiscalYearEnd: string;
    auditorFirmName: string;
    auditorAddress: string;
  }
): Promise<Buffer> {
  const asOfDate = data.asOfDate || clientInfo.fiscalYearEnd;
  const refNumber = data.refNumber || `____/LAC/${new Date().getFullYear()}/01`;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Ref:\t", bold: true, size: 22 }),
              new TextRun({ text: refNumber, size: 22 }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Dated:\t", bold: true, size: 22 }),
              new TextRun({ text: "________________", size: 22 }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyName || "Name of Legal Advisor", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyAddress || "Address,", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyCity || "City,", size: 22 })],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Subject:\t", bold: true, size: 22 }),
              new TextRun({
                text: `Request for information of ${clientInfo.clientName.toUpperCase()} pending litigations for audit purposes for the year ended ${asOfDate}`,
                size: 22,
                bold: true,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Dear Sir,", size: 22 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Our auditors M/s ${clientInfo.auditorFirmName} (Chartered Accountants) will shortly be expressing their opinion as to the fairness with which financial statements present the financial position of our Company. Please furnish DIRECT to our auditors the information requested below involving matters as to which you have been engaged and to which you have devoted substantive attention on behalf of our entity in the form of legal consultation or representation.`,
                size: 22,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Please provide the information requested below, taking into consideration matters that existed at ${asOfDate} and for the period from that date to the effective date of your response. Please specify the effective date of your response if it is other than the date of reply.`,
                size: 22,
              }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Pending or Threatened Litigation", bold: true, size: 22, underline: {} }),
              new TextRun({ text: " (give details of existing litigation)", size: 22 }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "1.\tThe nature of the litigation.", size: 22 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "2.\tThe progress of the case to date.", size: 22 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "3.\tHow management is responding or intends to respond the litigation; for example, to contest the case vigorously or to seek out of court settlement, and",
                size: 22,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "4.\tEvaluation of the likelihood of an unfavorable outcome and an estimate, if one can be made, of the amount or the range of potential loss.",
                size: 22,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Also, please identify any pending or threatened litigation in addition to above.",
                size: 22,
                italics: true,
              }),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Yours faithfully,", size: 22 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "For and on behalf of,", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: clientInfo.clientName.toUpperCase(), bold: true, size: 22 })],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "____________________________", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Name of Authorized Signatory", size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Designation", size: 20 })],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

export async function generateTaxAdvisorConfirmationLetter(
  data: ConfirmationData,
  clientInfo: {
    clientName: string;
    fiscalYearEnd: string;
    auditorFirmName: string;
    auditorAddress: string;
  }
): Promise<Buffer> {
  const asOfDate = data.asOfDate || clientInfo.fiscalYearEnd;
  const refNumber = data.refNumber || `___/TAC/${new Date().getFullYear()}/01`;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Ref:\t", bold: true, size: 22 }),
              new TextRun({ text: refNumber, size: 22 }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Dated:\t", bold: true, size: 22 }),
              new TextRun({ text: "_________________", size: 22 }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyName || "Name of Tax Advisor", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyAddress || "Address,", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: data.partyCity || "City.", size: 22 })],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Subject:\t", bold: true, size: 22 }),
              new TextRun({
                text: `Request for information of ${clientInfo.clientName.toUpperCase()} for audit purposes for the year ended ${asOfDate}`,
                size: 22,
                bold: true,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Dear Sir,", size: 22 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Our auditors, M/s ${clientInfo.auditorFirmName} (Chartered Accountants), are engaged to the audit assignment of our organization as at ${asOfDate}. We shall be grateful if you, in the capacity of our tax advisors, furnish the following information:`,
                size: 22,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "1.\tCurrent status of tax assessments completed.", size: 22 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "2.\tEstimated tax liability for assessments not yet finalized.", size: 22 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "3.\tDetails of appeals filed either by the company or by the department indicating details of significant issues and quantum of amounts involved.",
                size: 22,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "4.\tAn evaluation of the likelihood of unfavorable outcome and an estimate, if one can be made, of the amount or range of potential liability.",
                size: 22,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "5.\tAny other matters which you feel that we should be aware of.", size: 22 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Your response should be sent directly to our auditors M/S ${clientInfo.auditorFirmName} (Chartered Accountants), ${clientInfo.auditorAddress}.`,
                size: 22,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "An early response in this regard would be highly appreciated.", size: 22 })],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Yours sincerely,", size: 22 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "For and on behalf of,", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: clientInfo.clientName.toUpperCase(), bold: true, size: 22 })],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "_______________________", size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Name of Signatory", size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Designation", size: 20 })],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

export async function generateAllConfirmationLetters(
  confirmations: ConfirmationData[],
  clientInfo: {
    clientName: string;
    fiscalYearEnd: string;
    auditorFirmName: string;
    auditorAddress: string;
  }
): Promise<Buffer> {
  const sections = [];

  for (let i = 0; i < confirmations.length; i++) {
    const data = confirmations[i];
    const currentDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const asOfDate = data.asOfDate || clientInfo.fiscalYearEnd;

    if (data.type === "BANK") {
      const refNumber = `${clientInfo.clientName.substring(0, 3).toUpperCase()}/FY${new Date().getFullYear().toString().slice(-2)}/BC-${(i + 1).toString().padStart(2, '0')}`;
      sections.push({
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: [
          new Paragraph({ children: [new TextRun({ text: `Dated: ${currentDate}`, size: 20 })], spacing: { after: 100 } }),
          new Paragraph({ children: [new TextRun({ text: `Ref: ${refNumber}`, size: 20 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "The Manager", size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: data.partyName + ",", size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: "Main Branch, Lahore.", size: 20 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "Dear Sir/ Madam,", size: 20 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: clientInfo.clientName.toUpperCase(), bold: true, size: 22 })], spacing: { after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: "(Bank Confirmation Request - Standard 14-section format applies)", size: 20, italics: true })],
            spacing: { after: 200 },
          }),
          new Paragraph({ children: [new TextRun({ text: "Yours faithfully,", size: 20 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "_________________________", size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: clientInfo.clientName, bold: true, size: 20 })] }),
        ],
      });
    } else if (data.type === "AR" || data.type === "AP") {
      const isAR = data.type === "AR";
      const confirmationType = isAR ? "RECEIVABLES" : "PAYABLE";
      const balanceType = isAR ? "receivable" : "payable";
      const refPrefix = isAR ? "RC" : "PC";
      sections.push({
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: [
          new Paragraph({ children: [new TextRun({ text: `Ref: ____/${refPrefix}/${new Date().getFullYear()}/01`, size: 22 })], spacing: { after: 100 } }),
          new Paragraph({ children: [new TextRun({ text: `Dated: ${currentDate}`, size: 22 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: data.partyName, size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: "Address, City", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "Dear Sir,", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: `${confirmationType} CONFIRMATION REQUEST`, bold: true, size: 24, underline: {} })], spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({ text: `Our records show a ${balanceType} balance of Rs. `, size: 22 }),
              new TextRun({ text: data.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }), bold: true, size: 22 }),
              new TextRun({ text: ` at the close of business on ${asOfDate}.`, size: 22 }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({ children: [new TextRun({ text: "Yours faithfully,", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "_______________________", size: 22 })] }),
        ],
      });
    } else if (data.type === "LEGAL") {
      sections.push({
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: [
          new Paragraph({ children: [new TextRun({ text: `Ref: ____/LAC/${new Date().getFullYear()}/01`, size: 22 })], spacing: { after: 100 } }),
          new Paragraph({ children: [new TextRun({ text: `Dated: ${currentDate}`, size: 22 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: data.partyName, size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: "Address, City", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: `Subject: Request for information of ${clientInfo.clientName.toUpperCase()} pending litigations for audit purposes`, bold: true, size: 22 })],
            spacing: { after: 200 },
          }),
          new Paragraph({ children: [new TextRun({ text: "Dear Sir,", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: "(Legal Advisor Confirmation - Pending/Threatened Litigation details requested)", size: 20, italics: true })],
            spacing: { after: 200 },
          }),
          new Paragraph({ children: [new TextRun({ text: "Yours faithfully,", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "_______________________", size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: clientInfo.clientName, bold: true, size: 22 })] }),
        ],
      });
    } else if (data.type === "TAX") {
      sections.push({
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: [
          new Paragraph({ children: [new TextRun({ text: `Ref: ___/TAC/${new Date().getFullYear()}/01`, size: 22 })], spacing: { after: 100 } }),
          new Paragraph({ children: [new TextRun({ text: `Dated: ${currentDate}`, size: 22 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: data.partyName, size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: "Address, City", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: `Subject: Request for information of ${clientInfo.clientName.toUpperCase()} for audit purposes`, bold: true, size: 22 })],
            spacing: { after: 200 },
          }),
          new Paragraph({ children: [new TextRun({ text: "Dear Sir,", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: "(Tax Advisor Confirmation - Tax assessments, appeals, and liability details requested)", size: 20, italics: true })],
            spacing: { after: 200 },
          }),
          new Paragraph({ children: [new TextRun({ text: "Yours sincerely,", size: 22 })], spacing: { after: 200 } }),
          new Paragraph({ children: [new TextRun({ text: "_______________________", size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: clientInfo.clientName, bold: true, size: 22 })] }),
        ],
      });
    }
  }

  const doc = new Document({ sections });
  return await Packer.toBuffer(doc);
}
