import { ImageRun, Paragraph, AlignmentType } from "docx";

const LOGO_WIDTH_PX = 130;
const LOGO_MAX_HEIGHT_PX = 50;

export async function getClientDocxLogoImageRun(logoUrl: string | null | undefined): Promise<ImageRun | null> {
  if (!logoUrl) return null;

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return null;

    return new ImageRun({
      data: new Uint8Array(arrayBuffer),
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

export async function getClientDocxLogoParagraph(logoUrl: string | null | undefined): Promise<Paragraph | null> {
  const imageRun = await getClientDocxLogoImageRun(logoUrl);
  if (!imageRun) return null;

  return new Paragraph({
    children: [imageRun],
    alignment: AlignmentType.LEFT,
    spacing: { after: 200 },
  });
}
