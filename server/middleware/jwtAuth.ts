import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";
import { prisma } from "../db";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";
import fs from "fs";
import path from "path";

function getOrCreateJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const secretFile = path.join(process.cwd(), ".jwt_secret");
  try {
    if (fs.existsSync(secretFile)) {
      return fs.readFileSync(secretFile, "utf-8").trim();
    }
  } catch {}

  const secret = randomBytes(64).toString("hex");
  try {
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  } catch {}
  console.warn("[JWT] No JWT_SECRET env var set. Generated and persisted secret to .jwt_secret file.");
  return secret;
}

const JWT_SECRET = getOrCreateJwtSecret();
const JWT_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 7;

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  firmId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  jwtPayload?: JwtPayload;
  activeClientId?: string | null;
  activePeriodId?: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAccessToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    firmId: user.firmId,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function isExpiredJwt(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return false;
  } catch (err: any) {
    return err?.name === "TokenExpiredError";
  }
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const rawToken = randomBytes(48).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, token: tokenHash, expiresAt },
  });

  return rawToken;
}

export async function rotateRefreshToken(oldRawToken: string): Promise<{ accessToken: string; refreshToken: string; user: User } | null> {
  const oldHash = hashToken(oldRawToken);

  const existing = await prisma.refreshToken.findFirst({
    where: { token: oldHash, revokedAt: null },
    include: { user: true },
  });

  if (!existing || existing.expiresAt < new Date()) {
    if (existing) {
      await prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
    }
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const user = existing.user;

  if (!user.isActive || user.status === "DELETED" || user.status === "SUSPENDED") {
    return null;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return { accessToken, refreshToken, user };
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function jwtAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);

  const jwtPayload = verifyAccessToken(token);
  if (jwtPayload) {
    const user = await prisma.user.findUnique({ where: { id: jwtPayload.userId } });
    if (user && user.isActive && user.status !== "DELETED" && user.status !== "SUSPENDED") {
      req.user = user;
      req.jwtPayload = jwtPayload;
    }
    return next();
  }

  next();
}
