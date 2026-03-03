import { authenticator } from "otplib";
import * as QRCode from "qrcode";

const APP_NAME = "AuditWise";

export function generateTwoFactorSecret(userEmail: string): { secret: string; otpauthUrl: string } {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(userEmail, APP_NAME, secret);
  return { secret, otpauthUrl };
}

export async function generateQRCodeDataURL(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTwoFactorToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
