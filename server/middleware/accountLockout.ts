const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

const lockoutStore = new Map<string, LockoutEntry>();

export function checkAccountLockout(identifier: string): { locked: boolean; remainingSeconds?: number } {
  const entry = lockoutStore.get(identifier);
  if (!entry) return { locked: false };

  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return { locked: true, remainingSeconds };
  }

  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    lockoutStore.delete(identifier);
    return { locked: false };
  }

  return { locked: false };
}

export function recordFailedAttempt(identifier: string): { locked: boolean; attemptsRemaining: number } {
  let entry = lockoutStore.get(identifier);

  if (!entry) {
    entry = { failedAttempts: 0, lockedUntil: null, lastAttempt: Date.now() };
  }

  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    entry = { failedAttempts: 0, lockedUntil: null, lastAttempt: Date.now() };
  }

  entry.failedAttempts++;
  entry.lastAttempt = Date.now();

  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    lockoutStore.set(identifier, entry);
    return { locked: true, attemptsRemaining: 0 };
  }

  lockoutStore.set(identifier, entry);
  return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - entry.failedAttempts };
}

export function clearLockout(identifier: string): void {
  lockoutStore.delete(identifier);
}

setInterval(() => {
  const now = Date.now();
  const expiry = LOCKOUT_DURATION_MS * 2;
  for (const [key, entry] of lockoutStore.entries()) {
    if (now - entry.lastAttempt > expiry) {
      lockoutStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
