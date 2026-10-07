import crypto from "crypto";
import { ROLE_MATCH_THRESHOLDS } from "./role-match";

export function createRoleMatchToken(role: string, matchPercent: number): string {
  const secret = process.env.GROQ_API_KEY || "role-match-secret-fallback";
  const payload = {
    role: role.trim().toLowerCase(),
    matchPercent,
    timestamp: Date.now(),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifyRoleMatchToken(token: unknown, targetRole: string): { valid: boolean; matchPercent?: number; reason?: string } {
  if (typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "Missing or malformed role match token." };
  }
  const [data, signature] = token.split(".");
  if (!data || !signature) {
    return { valid: false, reason: "Invalid token segments." };
  }

  const secret = process.env.GROQ_API_KEY || "role-match-secret-fallback";
  const expectedSig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (signature !== expectedSig) {
    return { valid: false, reason: "Invalid token signature." };
  }

  try {
    const json = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (typeof json !== "object" || json === null) return { valid: false, reason: "Invalid token payload." };
    const { role, matchPercent, timestamp } = json as { role?: unknown; matchPercent?: unknown; timestamp?: unknown };

    // Check expiration (valid for 2 hours)
    if (typeof timestamp !== "number" || Date.now() - timestamp > 2 * 60 * 60 * 1000) {
      return { valid: false, reason: "Role match token expired." };
    }
    // Check role matches targetRole (normalized)
    if (typeof role !== "string" || role !== targetRole.trim().toLowerCase()) {
      return { valid: false, reason: "Token role mismatch." };
    }
    if (typeof matchPercent !== "number" || !Number.isFinite(matchPercent)) {
      return { valid: false, reason: "Invalid token match percent." };
    }
    return { valid: true, matchPercent };
  } catch {
    return { valid: false, reason: "Failed to parse token payload." };
  }
}

