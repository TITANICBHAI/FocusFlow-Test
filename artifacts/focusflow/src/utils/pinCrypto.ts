/**
 * pinCrypto.ts
 *
 * Password hashing (SHA-256) and random password generation utilities for
 * FocusFlow's two-PIN protection system:
 *
 *   Focus Session Password — gates ending any active focus session (native layer)
 *   Defense Password       — gates disabling protections and removing restrictions (JS layer)
 *
 * The raw password is NEVER stored anywhere. Only the SHA-256 hex digest is persisted.
 *
 * Hashing strategy (no new packages):
 *   1. Try Web Crypto API (crypto.subtle) — available in Hermes / RN 0.74+
 *   2. Fall back to a pure-JS SHA-256 implementation — works on any Hermes build
 */

// ─── Pure-JS SHA-256 fallback ─────────────────────────────────────────────────
// Standard FIPS 180-4 implementation. Used only when crypto.subtle is absent.

function _rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function _sha256Pure(msgBytes: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const bitLen = msgBytes.length * 8;
  const padded = new Uint8Array(((msgBytes.length + 9 + 63) & ~63));
  padded.set(msgBytes);
  padded[msgBytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = _rotr32(w[j - 15], 7) ^ _rotr32(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = _rotr32(w[j - 2], 17) ^ _rotr32(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1  = _rotr32(e, 6) ^ _rotr32(e, 11) ^ _rotr32(e, 25);
      const ch  = (e & f) ^ (~e & g);
      const t1  = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0  = _rotr32(a, 2) ^ _rotr32(a, 13) ^ _rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2  = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, false); rv.setUint32(4, h1, false);
  rv.setUint32(8, h2, false); rv.setUint32(12, h3, false);
  rv.setUint32(16, h4, false); rv.setUint32(20, h5, false);
  rv.setUint32(24, h6, false); rv.setUint32(28, h7, false);
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of a UTF-8 password string.
 * Tries Web Crypto API first; falls back to a pure-JS implementation so
 * hashing works on every Hermes build without any additional packages.
 */
export async function hashPassword(password: string): Promise<string> {
  const buffer = new TextEncoder().encode(password);
  try {
    if (globalThis.crypto?.subtle) {
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // crypto.subtle unavailable or threw — fall through to pure-JS path
  }
  const hashArray = Array.from(_sha256Pure(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Character set for random passwords — visually ambiguous chars excluded:
 * 0, O, I, l, 1 → reduces transcription errors when writing down.
 */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!$';

/**
 * Generates a cryptographically random password using crypto.getRandomValues.
 * Default length: 16 characters.
 */
export function generateRandomPassword(length = 16): string {
  try {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => CHARSET[b % CHARSET.length])
      .join('');
  } catch {
    return Array.from({ length }, () =>
      CHARSET[Math.floor(Math.random() * CHARSET.length)],
    ).join('');
  }
}

export type StrengthLevel = 'too-short' | 'weak' | 'fair' | 'strong' | 'very-strong';

export interface PasswordStrength {
  level: StrengthLevel;
  label: string;
  color: string;
  barWidth: number;
  valid: boolean;
}

/**
 * Evaluates password strength. Minimum 8 characters required.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { level: 'too-short', label: '', color: '#e5e7eb', barWidth: 0, valid: false };
  }
  if (password.length < 8) {
    return {
      level: 'too-short',
      label: `${password.length}/8 characters minimum`,
      color: '#ef4444',
      barWidth: 15,
      valid: false,
    };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const variety = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  if (password.length >= 16 && variety >= 3) {
    return { level: 'very-strong', label: 'Very strong', color: '#10b981', barWidth: 100, valid: true };
  }
  if (password.length >= 12 && variety >= 2) {
    return { level: 'strong', label: 'Strong', color: '#22c55e', barWidth: 75, valid: true };
  }
  if (password.length >= 8 && variety >= 2) {
    return { level: 'fair', label: 'Fair — try adding symbols or numbers', color: '#f59e0b', barWidth: 50, valid: true };
  }
  return { level: 'weak', label: 'Weak — mix uppercase, lowercase, numbers & symbols', color: '#f97316', barWidth: 30, valid: true };
}

/** Common trivially-guessable passwords to block. */
export const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'qwerty123', 'qwerty',
  'abc123def', 'iloveyou1', 'admin1234', 'letmein1', 'welcome1',
  '12345678', '123456789', '1234567890', '11111111', '00000000',
  'aaaaaaaa', 'bbbbbbbb', 'zxcvbnm1', 'focusflow', 'focusflow1',
]);
