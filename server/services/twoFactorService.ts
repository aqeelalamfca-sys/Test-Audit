import { generateSecret, generateURI, verify } from "otplib";
import * as QRCode from "qrcode";

const APP_NAME = "AuditWise";

export function generateTwoFactorSecret(userEmail: string): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    strategy: "totp",
    issuer: APP_NAME,
    label: userEmail,
    secret,
  });
  return { secret, otpauthUrl };
}

export async function generateQRCodeDataURL(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export async function verifyTwoFactorToken(token: string, secret: string): Promise<boolean> {
  return verify({ token, secret, strategy: "totp" });
}
