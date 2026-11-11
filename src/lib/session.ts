import { SignJWT, jwtVerify } from "jose";
import { isRole, type Role } from "@/lib/crs";

export const SESSION_COOKIE = "bh_session";
export const SESSION_MAX_AGE = 60 * 60 * 12;

export type SessionClaims = {
  staffDbId: number;
  staffId: string;
  staffName: string;
  email: string;
  role: Role;
  sid: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return new TextEncoder().encode(secret ?? "buloba-local-session-fallback");
}

export async function createSessionToken(info: Omit<SessionClaims, "sid">): Promise<string> {
  return new SignJWT({
    staffDbId: info.staffDbId,
    staffId: info.staffId,
    staffName: info.staffName,
    email: info.email,
    role: info.role,
    sid: globalThis.crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(info.staffDbId))
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE)
    .sign(secretKey());
}

export async function verifySessionToken(token?: string | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.staffDbId !== "number" ||
      typeof payload.staffId !== "string" ||
      typeof payload.staffName !== "string" ||
      typeof payload.email !== "string" ||
      !isRole(payload.role) ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }
    return {
      staffDbId: payload.staffDbId,
      staffId: payload.staffId,
      staffName: payload.staffName,
      email: payload.email,
      role: payload.role,
      sid: payload.sid,
    };
  } catch {
    return null;
  }
}
