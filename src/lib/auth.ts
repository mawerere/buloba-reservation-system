import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import type { Role, SessionInfo } from "@/lib/crs";

export async function getSession(): Promise<SessionInfo | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const [row] = await db.select().from(staff).where(eq(staff.id, claims.staffDbId)).limit(1);
  if (!row || !row.active || row.email !== claims.email || row.staffCode !== claims.staffId) return null;
  return {
    staffDbId: row.id,
    staffId: row.staffCode,
    staffName: row.fullName,
    email: row.email,
    role: row.role as Role,
  };
}

export async function requirePageSession(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireApiSession(allowed?: readonly Role[]): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) throw new ApiError("Your session has expired. Please sign in again.", 401);
  if (allowed && !allowed.includes(session.role)) {
    throw new ApiError(`${session.role} is not authorized for this operation.`, 403);
  }
  return session;
}
