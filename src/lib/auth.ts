import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SESSION_DAYS = 30;

// scrypt with a random salt per password, stored as "salt:hash" (both hex) in
// one column — no extra table, and the salt travels with the hash it belongs
// to. No bcrypt/argon2 dependency: this keeps the native-module surface down
// to just better-sqlite3, which the Dockerfile already builds for.
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function newSessionId(): string {
  return randomUUID();
}

export function sessionExpiry(): string {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
