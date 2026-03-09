import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const isS3Enabled = !!process.env.AWS_S3_BUCKET;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const config: any = {
      region: process.env.AWS_REGION || "us-east-1",
    };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
    s3Client = new S3Client(config);
  }
  return s3Client;
}

function getBucket(): string {
  return process.env.AWS_S3_BUCKET!;
}

export interface UploadResult {
  key: string;
  location: string;
  bucket?: string;
}

export interface StorageFile {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
}

export function useS3(): boolean {
  return isS3Enabled;
}

export async function uploadFile(
  filePath: string,
  key: string,
  contentType?: string
): Promise<UploadResult> {
  if (!isS3Enabled) {
    return { key, location: filePath };
  }

  const fileBuffer = await fs.promises.readFile(filePath);
  return uploadBuffer(fileBuffer, key, contentType);
}

export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType?: string
): Promise<UploadResult> {
  if (!isS3Enabled) {
    const localPath = path.join(process.cwd(), key);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, buffer);
    return { key, location: localPath };
  }

  const client = getS3Client();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );

  return {
    key,
    location: `s3://${bucket}/${key}`,
    bucket,
  };
}

export async function getFile(keyOrPath: string): Promise<StorageFile> {
  if (!isS3Enabled) {
    const stream = fs.createReadStream(keyOrPath);
    const stats = await fs.promises.stat(keyOrPath);
    return {
      stream,
      contentLength: stats.size,
    };
  }

  const client = getS3Client();
  const bucket = getBucket();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: keyOrPath,
    })
  );

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
}

export async function getFileBuffer(keyOrPath: string): Promise<Buffer> {
  if (!isS3Enabled) {
    return fs.promises.readFile(keyOrPath);
  }

  const client = getS3Client();
  const bucket = getBucket();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: keyOrPath,
    })
  );

  const chunks: Buffer[] = [];
  const body = response.Body as Readable;
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteFile(keyOrPath: string): Promise<void> {
  if (!isS3Enabled) {
    try {
      if (fs.existsSync(keyOrPath)) {
        await fs.promises.unlink(keyOrPath);
      }
    } catch {}
    return;
  }

  const client = getS3Client();
  const bucket = getBucket();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: keyOrPath,
      })
    );
  } catch {}
}

export async function fileExists(keyOrPath: string): Promise<boolean> {
  if (!isS3Enabled) {
    return fs.existsSync(keyOrPath);
  }

  const client = getS3Client();
  const bucket = getBucket();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: keyOrPath,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!isS3Enabled) {
    return key;
  }

  const client = getS3Client();
  const bucket = getBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!isS3Enabled) {
    return key;
  }

  const client = getS3Client();
  const bucket = getBucket();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export function generateStorageKey(
  prefix: string,
  filename: string,
  firmId?: string
): string {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const safeName = base.replace(/[^a-zA-Z0-9_-]/g, "_");

  if (firmId) {
    return `${prefix}/${firmId}/${safeName}-${uniqueSuffix}${ext}`;
  }
  return `${prefix}/${safeName}-${uniqueSuffix}${ext}`;
}

export function resolveFilePath(keyOrPath: string): string {
  if (!isS3Enabled) {
    if (path.isAbsolute(keyOrPath)) {
      return keyOrPath;
    }
    return path.join(process.cwd(), keyOrPath);
  }
  return keyOrPath;
}

export function getPublicUrl(key: string): string {
  if (!isS3Enabled) {
    if (key.startsWith("/")) return key;
    const cwd = process.cwd();
    if (key.startsWith(cwd)) {
      return key.substring(cwd.length);
    }
    return `/${key}`;
  }

  const cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  if (cdnDomain) {
    return `https://${cdnDomain}/${key}`;
  }

  const bucket = getBucket();
  const region = process.env.AWS_REGION || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}
