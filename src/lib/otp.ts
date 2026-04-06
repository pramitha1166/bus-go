import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import db from "@/lib/db";

const OTP_TTL_MINUTES = 5;
const BCRYPT_ROUNDS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// generateOTP
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a random 6-digit numeric string e.g. "047382" */
export function generateOTP(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// createOTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes any existing (unused) OTPs for this phone+role, creates a new
 * OtpCode record with a bcrypt-hashed code and a 5-minute expiry, then
 * returns the plain-text code so the caller can send it via SMS.
 */
export async function createOTP(phone: string, role: Role): Promise<string> {
  const code = generateOTP();
  const hash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Delete any previously issued (unused) OTPs for this phone+role
  await db.otpCode.deleteMany({
    where: { phone, role, used: false },
  });

  await db.otpCode.create({
    data: { phone, code: hash, role, expiresAt },
  });
  console.log("OTP created:", code);

  return code; // plain-text — only sent via SMS, never stored or returned to client
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyOTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the active OTP for phone+role, checks it is not used or expired, and
 * bcrypt-compares the provided code against the stored hash.
 * Marks the record as used on success.
 *
 * @returns true if valid, false otherwise
 */
export async function verifyOTP(
  phone: string,
  code: string,
  role: Role
): Promise<boolean> {
  const record = await db.otpCode.findFirst({
    where: {
      phone,
      role,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return false;

  const match = await bcrypt.compare(code, record.code);
  if (!match) return false;

  await db.otpCode.update({
    where: { id: record.id },
    data: { used: true },
  });

  return true;
}
