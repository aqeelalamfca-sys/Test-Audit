import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from "docx";
import { prisma } from "./db";
import { getFirmLogoParagraph } from "./utils/docxLogo";

interface ExportOptions {
  engagementId: string;
  firmId: string;
  includeProvided?: boolean;
}

export async function generateInformationRequestLetter(options: ExportOptions): Promise<Buffer> {
  const { engagementId, firmId, includeProvided = false } = options;

  const [engagement, firm, requests, teamMembers] = await Promise.all([
    prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: true },
    }),
    prisma.firm.findUnique({ where: { id: firmId } }),
    prisma.informationRequest.findMany({
      where: { engagementId },
      orderBy: [{ headOfAccounts: "asc" }, { createdAt: "asc" }],
    }),
    prisma.engagementTeam.findMany({
      where: { engagementId },
      include: { user: true },
    }),
  ]);

  if (!engagement || !firm) {
    throw new Error("Engagement or firm not found");
  }

  const teamLead = teamMembers.find(tm => tm.role === "TEAM_LEAD" || tm.role === "SENIOR");
  const partner = teamMembers.find(tm => tm.role === "PARTNER");
  const manager = teamMembers.find(tm => tm.role === "MANAGER");

  const periodStart = engagement.periodStart ? new Date(engagement.periodStart).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "N/A";
  const periodEnd = engagement.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "N/A";
  const fiscalYearEnd = engagement.fiscalYearEnd ? new Date(engagement.fiscalYearEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "N/A";
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const filteredRequests = includeProvided 
    ? requests 
    : requests.filter(r => r.provided !== "YES");

  const groupedByHead = filteredRequests.reduce((acc, req) => {
    const head = req.headOfAccounts || "General";
    if (!acc[head]) acc[head] = [];
    acc[head].push(req);
    return acc;
  }, {} as Record<string, typeof requests>);

  const docChildren: (Paragraph | Table)[] = [];

  const logoParagraph = getFirmLogoParagraph(firm.logoUrl);
  if (logoParagraph) {
    docChildren.push(logoParagraph);
  }

  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: firm.name.toUpperCase(), bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Chartered Accountants", italics: true, size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [new TextRun({ text: firm.address || "", size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Tel: ${firm.phone || "N/A"} | Email: ${firm.email || "N/A"}`, size: 18 }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "_".repeat(80), color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  docChildren.push(
    new Paragraph({
      text: "INFORMATION REQUISITION LETTER",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: `Date: ${today}`, bold: true })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Ref: ${engagement.engagementCode || "N/A"}` })],
      spacing: { after: 400 },
    })
  );

  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: "To," })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: engagement.client?.name || "The Management", bold: true })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: engagement.client?.address || "" })],
      spacing: { after: 300 },
    })
  );

  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: "Subject: ", bold: true }), new TextRun({ text: "Request for Information and Documents for Statutory Audit", bold: true, underline: {} })],
      spacing: { after: 300 },
    })
  );

  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: "ENGAGEMENT DETAILS", bold: true, size: 24 })],
      spacing: { before: 200, after: 200 },
    })
  );

  const detailsTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Client Name", bold: true })] })],
            width: { size: 30, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ text: engagement.client?.name || "N/A" })],
            width: { size: 70, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Engagement Code", bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ text: engagement.engagementCode || "N/A" })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Audit Period", bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ text: `${periodStart} to ${periodEnd}` })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Year Ended", bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ text: fiscalYearEnd })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Engagement Partner", bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ text: partner?.user?.fullName || "N/A" })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Engagement Manager", bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ text: manager?.user?.fullName || "N/A" })],
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  docChildren.push(detailsTable);

  docChildren.push(
    new Paragraph({ text: "", spacing: { after: 300 } }),
    new Paragraph({
      text: "Dear Sir/Madam,",
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `In connection with our audit of the financial statements of ${engagement.client?.name || "your organization"} for the year ended ${fiscalYearEnd}, we request the following information and documents. Please provide these at your earliest convenience to enable us to complete the audit in a timely manner.`,
      spacing: { after: 300 },
    })
  );

  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: "INFORMATION REQUESTED", bold: true, size: 26 })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 300 },
    })
  );

  let globalSrNo = 1;
  for (const [headOfAccounts, items] of Object.entries(groupedByHead)) {
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: headOfAccounts.replace(/_/g, " "), bold: true, size: 24 })],
        spacing: { before: 300, after: 200 },
        shading: { fill: "E8E8E8" },
      })
    );

    const requestTableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Sr.", bold: true, size: 20, color: "FFFFFF" })] })],
            width: { size: 5, type: WidthType.PERCENTAGE },
            shading: { fill: "4472C4" },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Description of Information Required", bold: true, size: 20, color: "FFFFFF" })] })],
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: "4472C4" },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Date Demanded", bold: true, size: 20, color: "FFFFFF" })] })],
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: "4472C4" },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Date Provided", bold: true, size: 20, color: "FFFFFF" })] })],
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: "4472C4" },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Remarks", bold: true, size: 20, color: "FFFFFF" })] })],
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: "4472C4" },
          }),
        ],
      }),
    ];

    for (const item of items) {
      const demandedDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : today;
      const providedDate = item.providedDate ? new Date(item.providedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

      requestTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: String(globalSrNo), alignment: AlignmentType.CENTER })],
            }),
            new TableCell({
              children: [new Paragraph({ text: item.description || "" })],
            }),
            new TableCell({
              children: [new Paragraph({ text: demandedDate, alignment: AlignmentType.CENTER })],
            }),
            new TableCell({
              children: [new Paragraph({ text: providedDate, alignment: AlignmentType.CENTER })],
            }),
            new TableCell({
              children: [new Paragraph({ text: item.provided === "YES" ? "Received" : "", alignment: AlignmentType.CENTER })],
            }),
          ],
        })
      );
      globalSrNo++;
    }

    docChildren.push(
      new Table({
        rows: requestTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  docChildren.push(
    new Paragraph({ text: "", spacing: { after: 400 } }),
    new Paragraph({
      text: "We appreciate your prompt attention to this request. Please do not hesitate to contact the undersigned if you require any clarification regarding the above requirements.",
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "Thank you for your cooperation.",
      spacing: { after: 400 },
    })
  );

  docChildren.push(
    new Paragraph({ text: "", spacing: { after: 300 } }),
    new Paragraph({
      text: "Yours faithfully,",
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `For ${firm.name}`, bold: true })],
      spacing: { after: 400 },
    }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({
      text: "_".repeat(40),
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: teamLead?.user?.fullName || manager?.user?.fullName || "Team Lead", bold: true })],
      spacing: { after: 50 },
    }),
    new Paragraph({
      text: teamLead?.role?.replace(/_/g, " ") || manager?.role?.replace(/_/g, " ") || "Audit Team Lead",
      spacing: { after: 200 },
    })
  );

  docChildren.push(
    new Paragraph({ text: "", spacing: { after: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: "CLIENT ACKNOWLEDGMENT", bold: true, size: 24 })],
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      text: "We acknowledge receipt of this information requisition letter and confirm that we shall provide the requested information as soon as possible.",
      spacing: { after: 300 },
    }),
    new Paragraph({
      text: "Name: _______________________________     Designation: _______________________________",
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "Signature: ____________________________     Date: _______________________________",
      spacing: { after: 200 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
