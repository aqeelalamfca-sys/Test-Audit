import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";

const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
const MAX_FILE_SIZE = 300 * 1024;
const LOGOS_DIR = path.join(process.cwd(), "uploads", "logos");

export async function ensureLogosDir(): Promise<void> {
  await fs.mkdir(LOGOS_DIR, { recursive: true });
}

export async function processAndSaveLogo(
  buffer: Buffer,
  originalName: string,
  firmId: string
): Promise<string> {
  await ensureLogosDir();

  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  let resizeWidth = metadata.width;
  let resizeHeight = metadata.height;

  if (resizeWidth > MAX_WIDTH || resizeHeight > MAX_HEIGHT) {
    const widthRatio = MAX_WIDTH / resizeWidth;
    const heightRatio = MAX_HEIGHT / resizeHeight;
    const ratio = Math.min(widthRatio, heightRatio);
    resizeWidth = Math.round(resizeWidth * ratio);
    resizeHeight = Math.round(resizeHeight * ratio);
  }

  let outputBuffer = await image
    .resize(resizeWidth, resizeHeight, { fit: "inside", withoutEnlargement: true })
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();

  if (outputBuffer.length > MAX_FILE_SIZE) {
    outputBuffer = await sharp(buffer)
      .resize(resizeWidth, resizeHeight, { fit: "inside", withoutEnlargement: true })
      .png({ quality: 70, compressionLevel: 9 })
      .toBuffer();
  }

  if (outputBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`Processed image exceeds maximum size of ${MAX_FILE_SIZE / 1024}KB after optimization`);
  }

  const outputFilename = `firm-${firmId}-${Date.now()}-${randomBytes(4).toString("hex")}.png`;
  const outputPath = path.join(LOGOS_DIR, outputFilename);
  await fs.writeFile(outputPath, outputBuffer);

  return `/uploads/logos/${outputFilename}`;
}

export async function deleteLogo(logoUrl: string): Promise<void> {
  if (!logoUrl) return;
  try {
    const filename = path.basename(logoUrl);
    const filePath = path.join(LOGOS_DIR, filename);
    await fs.unlink(filePath);
  } catch {
  }
}

export function isValidLogoMimeType(mimetype: string): boolean {
  const allowed = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
  ];
  return allowed.includes(mimetype);
}

export function isValidLogoExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext);
}
