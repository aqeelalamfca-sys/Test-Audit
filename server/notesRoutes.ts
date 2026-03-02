import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import XLSX from "xlsx";
import { generateAIContent, type AISettings } from "./services/aiService";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), "uploads", "notes-references");
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".xlsx", ".xls", ".txt", ".zip", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Accepted: ${allowed.join(", ")}`));
    }
  },
});

router.get("/:engagementId/reference-docs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const docs = await prisma.notesReferenceDocument.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    });
    res.json(docs);
  } catch (error: any) {
    console.error("Error fetching reference docs:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:engagementId/reference-docs", requireAuth, upload.array("files", 20), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const docs = await Promise.all(
      files.map((file) =>
        prisma.notesReferenceDocument.create({
          data: {
            engagementId,
            fileName: file.originalname,
            fileType: path.extname(file.originalname).toLowerCase(),
            filePath: file.path,
            fileSize: file.size,
            description: req.body.description || null,
            uploadedById: req.user!.id,
          },
        })
      )
    );

    res.json({ uploaded: docs.length, documents: docs });
  } catch (error: any) {
    console.error("Error uploading reference docs:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:engagementId/reference-docs/:docId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { docId } = req.params;
    const doc = await prisma.notesReferenceDocument.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ error: "Document not found" });

    try {
      await fs.access(doc.filePath);
      await fs.unlink(doc.filePath);
    } catch {}

    await prisma.notesReferenceDocument.delete({ where: { id: docId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting reference doc:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:engagementId/generated", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const notes = await prisma.generatedNote.findMany({
      where: { engagementId },
      orderBy: { noteNumber: "asc" },
    });
    res.json(notes);
  } catch (error: any) {
    console.error("Error fetching generated notes:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:engagementId/generate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { noteGroups, clientName, periodEnd, reportingFramework } = req.body;

    if (!noteGroups || !Array.isArray(noteGroups) || noteGroups.length === 0) {
      return res.status(400).json({ error: "Note groups data is required" });
    }

    const aiConfig = await prisma.aISettings.findFirst({ where: { firmId: req.user!.firmId } });

    const settings: AISettings = {
      aiEnabled: aiConfig?.aiEnabled ?? true,
      preferredProvider: aiConfig?.preferredProvider || "openai",
      providerPriority: (aiConfig?.providerPriority as string[]) || ["openai", "gemini", "deepseek"],
      openaiApiKey: aiConfig?.openaiApiKey || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      openaiEnabled: aiConfig?.openaiEnabled ?? true,
      geminiApiKey: aiConfig?.geminiApiKey,
      geminiEnabled: aiConfig?.geminiEnabled ?? false,
      deepseekApiKey: aiConfig?.deepseekApiKey,
      deepseekEnabled: aiConfig?.deepseekEnabled ?? false,
      maxTokensPerResponse: aiConfig?.maxTokensPerResponse || 4000,
      requestTimeout: aiConfig?.requestTimeout || 60000,
    };

    const refDocs = await prisma.notesReferenceDocument.findMany({
      where: { engagementId },
      select: { fileName: true, description: true, fileType: true },
    });

    const refDocContext = refDocs.length > 0
      ? `\n\nReference documents available:\n${refDocs.map((d) => `- ${d.fileName} (${d.fileType})${d.description ? ` — ${d.description}` : ""}`).join("\n")}\nFollow the format from ICAP illustrative financial statements and Companies Act 2017 Third Schedule.`
      : "";

    const financialDataContext = noteGroups
      .map((g: any) => {
        const accountsList = g.accounts
          .slice(0, 20)
          .map((a: any) => `  ${a.accountCode} ${a.accountName}: OB PKR ${(a.openingBalance || 0).toLocaleString()} | CB PKR ${(a.closingBalance || 0).toLocaleString()}`)
          .join("\n");
        return `${g.noteRef} (${g.accounts.length} accounts, FS: ${g.fsLineItems?.join(", ") || "N/A"}):\n  Total Opening: PKR ${(g.totalOpening || 0).toLocaleString()}\n  Total Closing: PKR ${(g.totalClosing || 0).toLocaleString()}\n${accountsList}`;
      })
      .join("\n\n");

    const systemPrompt = `You are an expert Pakistani statutory auditor and financial reporting specialist.
Generate Notes to the Financial Statements following the exact format used in Pakistani annual reports:

FORMAT RULES (follow ICAP Illustrative Financial Statements exactly):
1. Each note starts with its number and UPPERCASE title (e.g., "6  PROPERTY, PLANT AND EQUIPMENT")
2. Sub-notes use decimal numbering (6.1, 6.2, etc.)
3. Quantitative notes MUST show two columns: current year and prior year amounts in PKR
4. Use movement schedules for PPE, intangibles, ROU assets: Cost (Opening + Additions - Disposals = Closing) then Depreciation (Opening + Charge - On Disposals = Closing) then Net Book Value
5. Amounts in Rupees with thousand separators, right-aligned
6. Cross-reference accounting policies (e.g., "see note 4.1")
7. Include standard Pakistani disclosures: basis of preparation, statement of compliance, functional/presentation currency
8. For policy notes, reference "IFRS as notified under the Companies Act, 2017"

OUTPUT: Return a JSON array. Each element:
{
  "noteNumber": <integer>,
  "noteTitle": "<UPPERCASE TITLE>",
  "noteRef": "<e.g. Note 6>",
  "content": "<full note text with tables using | separators for columns>"
}

Mark all content with [AI-Generated - Subject to Professional Review]`;

    const prompt = `Generate Notes to the Financial Statements for "${clientName || "the entity"}" for the period ended ${periodEnd || "year end"}.
Framework: ${reportingFramework || "IFRS as adopted in Pakistan (Companies Act 2017)"}

FINANCIAL DATA BY NOTE REFERENCE:

${financialDataContext}
${refDocContext}

Generate notes for ALL ${noteGroups.length} note groups above, numbered sequentially starting from the first group.
Each quantitative note must have: title, line items with CY and PY columns, subtotals, and cross-reference to accounting policy.
For PPE/intangibles, include a movement schedule (Cost + Accumulated Depreciation).
Return ONLY valid JSON array.`;

    const result = await generateAIContent(settings, {
      prompt,
      context: "",
      systemPrompt,
      maxTokens: 4000,
      temperature: 0.3,
      timeout: 90000,
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    let parsedNotes: any[] = [];
    try {
      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedNotes = JSON.parse(jsonMatch[0]);
      } else {
        parsedNotes = noteGroups.map((g: any, idx: number) => ({
          noteNumber: idx + 1,
          noteTitle: g.noteRef,
          noteRef: g.noteRef,
          content: result.content,
        }));
      }
    } catch {
      parsedNotes = noteGroups.map((g: any, idx: number) => ({
        noteNumber: idx + 1,
        noteTitle: g.noteRef,
        noteRef: g.noteRef,
        content: result.content,
      }));
    }

    const savedNotes = [];
    for (const note of parsedNotes) {
      const saved = await prisma.generatedNote.upsert({
        where: {
          engagementId_noteNumber: {
            engagementId,
            noteNumber: note.noteNumber,
          },
        },
        update: {
          noteTitle: note.noteTitle,
          content: note.content,
          noteRef: note.noteRef,
          isAIGenerated: true,
          generatedBy: req.user!.id,
          status: "draft",
        },
        create: {
          engagementId,
          noteNumber: note.noteNumber,
          noteTitle: note.noteTitle,
          content: note.content,
          noteRef: note.noteRef,
          isAIGenerated: true,
          generatedBy: req.user!.id,
          status: "draft",
        },
      });
      savedNotes.push(saved);
    }

    res.json({
      generated: savedNotes.length,
      notes: savedNotes,
      provider: result.provider,
      tokens: {
        prompt: result.promptTokens,
        completion: result.completionTokens,
      },
    });
  } catch (error: any) {
    console.error("Error generating notes:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/:engagementId/generated/:noteId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { noteId } = req.params;
    const { content, noteTitle, status } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (content !== undefined) updateData.content = content;
    if (noteTitle !== undefined) updateData.noteTitle = noteTitle;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "reviewed") {
        updateData.reviewedBy = req.user!.id;
        updateData.reviewedAt = new Date();
      } else if (status === "approved") {
        updateData.approvedBy = req.user!.id;
        updateData.approvedAt = new Date();
      }
    }

    const note = await prisma.generatedNote.update({
      where: { id: noteId },
      data: updateData,
    });

    res.json(note);
  } catch (error: any) {
    console.error("Error updating note:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:engagementId/generated/:noteId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { noteId } = req.params;
    await prisma.generatedNote.delete({ where: { id: noteId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting note:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:engagementId/export-excel", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: true },
    });

    const notes = await prisma.generatedNote.findMany({
      where: { engagementId },
      orderBy: { noteNumber: "asc" },
    });

    if (notes.length === 0) {
      return res.status(400).json({ error: "No generated notes to export" });
    }

    const clientName = engagement?.client?.name || "Company";
    const periodEnd = engagement?.periodEnd
      ? new Date(engagement.periodEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : "Year End";

    const wb = XLSX.utils.book_new();

    const notesRows: any[][] = [];
    notesRows.push([clientName]);
    notesRows.push([]);
    notesRows.push(["NOTES TO THE FINANCIAL STATEMENTS"]);
    notesRows.push([`FOR THE PERIOD ENDED ${periodEnd.toUpperCase()}`]);
    notesRows.push([]);

    for (const note of notes) {
      notesRows.push([]);

      notesRows.push([note.noteNumber, note.noteTitle?.toUpperCase()]);
      notesRows.push([]);

      const contentLines = note.content.split("\n");
      for (const line of contentLines) {
        if (line.includes("|")) {
          const cells = line
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c !== "" && !c.match(/^[-:]+$/));
          if (cells.length > 0) {
            const processedCells = cells.map((cell) => {
              const num = cell.replace(/,/g, "").replace(/PKR\s*/i, "");
              if (/^-?\d[\d,]*\.?\d*$/.test(num.trim())) {
                return parseFloat(num.trim().replace(/,/g, ""));
              }
              return cell;
            });
            notesRows.push([null, ...processedCells]);
          }
        } else if (line.trim()) {
          notesRows.push([null, line.trim()]);
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(notesRows);

    ws["!cols"] = [
      { wch: 6 },
      { wch: 45 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 20 },
      { wch: 20 },
    ];

    const titleStyle = { font: { bold: true, sz: 14 } };
    if (ws["A1"]) ws["A1"].s = titleStyle;

    XLSX.utils.book_append_sheet(wb, ws, "Notes");

    const indexRows: any[][] = [];
    indexRows.push([clientName]);
    indexRows.push(["NOTES TO THE FINANCIAL STATEMENTS — INDEX"]);
    indexRows.push([`FOR THE PERIOD ENDED ${periodEnd.toUpperCase()}`]);
    indexRows.push([]);
    indexRows.push(["Note No.", "Title", "Status"]);
    for (const note of notes) {
      indexRows.push([
        note.noteNumber,
        note.noteTitle,
        note.status.charAt(0).toUpperCase() + note.status.slice(1),
      ]);
    }

    const wsIndex = XLSX.utils.aoa_to_sheet(indexRows);
    wsIndex["!cols"] = [{ wch: 10 }, { wch: 50 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsIndex, "Index");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const fileName = `${safeClientName}_Notes_to_FS.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error exporting notes:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
