export const PASSWORD_MIN_LENGTH = 10;

const COMMON_PASSWORDS = new Set([
  "password123", "qwerty12345", "123456789a", "abcdefghij",
  "iloveyou12", "letmein1234", "welcome1234", "monkey12345",
  "dragon12345", "master12345", "admin12345!", "password1!",
  "changeme123", "trustno1234", "baseball123", "football123",
  "shadow12345", "michael1234", "jennifer123", "password12!",
  "qwertyuiop", "1234567890", "0987654321", "abcdefgh12",
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: "weak" | "fair" | "strong" | "very_strong";
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  if (password && password.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[@$!%*?&#^()_+\-=\[\]{}|\\:";'<>,./~`]/.test(password)) {
    errors.push("Password must contain at least one special character (@$!%*?&#^)");
  }

  if (/(.)\1{3,}/.test(password)) {
    errors.push("Password must not contain 4 or more repeated characters in a row");
  }

  if (/^(abc|123|qwe|asd|zxc)/i.test(password)) {
    errors.push("Password must not start with a common sequence");
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common. Choose a more unique password");
  }

  let score = 0;
  if (password && password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password && password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[@$!%*?&#^()_+\-=\[\]{}|\\:";'<>,./~`]/.test(password)) score++;
  if (password && password.length >= 16 && /[A-Z].*[A-Z]/.test(password)) score++;

  let strength: PasswordValidationResult["strength"] = "weak";
  if (score >= 5) strength = "very_strong";
  else if (score >= 4) strength = "strong";
  else if (score >= 3) strength = "fair";

  return { valid: errors.length === 0, errors, strength };
}

export function validatePasswordNotContainsUserInfo(password: string, email?: string, fullName?: string): string[] {
  const errors: string[] = [];

  if (email) {
    const emailLocal = email.split("@")[0].toLowerCase();
    if (emailLocal.length >= 4 && password.toLowerCase().includes(emailLocal)) {
      errors.push("Password must not contain your email address");
    }
  }

  if (fullName) {
    const nameParts = fullName.toLowerCase().split(/\s+/).filter(p => p.length >= 4);
    for (const part of nameParts) {
      if (password.toLowerCase().includes(part)) {
        errors.push("Password must not contain your name");
        break;
      }
    }
  }

  return errors;
}
