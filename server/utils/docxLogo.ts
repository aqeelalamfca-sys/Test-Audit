import { ImageRun, Paragraph, AlignmentType } from "docx";
import fs from "fs";
import path from "path";

const LOGO_WIDTH_PX = 130;
const LOGO_MAX_HEIGHT_PX = 50;

export function getFirmLogoImageRun(logoUrl: string | null | undefined): ImageRun | null {
  if (!logoUrl) return null;

  try {
    const filename = path.basename(logoUrl);
    const filePath = path.join(process.cwd(), "uploads", "logos", filename);

    if (!fs.existsSync(filePath)) return null;

    const imageBuffer = fs.readFileSync(filePath);
    if (imageBuffer.length === 0) return null;

    return new ImageRun({
      data: imageBuffer,
      transformation: {
        width: LOGO_WIDTH_PX,
        height: LOGO_MAX_HEIGHT_PX,
      },
      type: "png",
    });
  } catch {
    return null;
  }
}

export function getFirmLogoParagraph(logoUrl: string | null | undefined): Paragraph | null {
  const imageRun = getFirmLogoImageRun(logoUrl);
  if (!imageRun) return null;

  return new Paragraph({
    children: [imageRun],
    alignment: AlignmentType.LEFT,
    spacing: { after: 200 },
  });
}
