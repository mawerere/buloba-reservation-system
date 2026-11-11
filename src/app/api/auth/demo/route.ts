import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { apiFailure, ApiError } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { isRole } from "@/lib/crs";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("Demo login is unavailable.", 404);
    }
    await ensureSeeded();
    const [row] = await db.select().from(staff).where(eq(staff.email, "admin@bulobahotel.ug")).limit(1);
    if (!row || !row.active) throw new ApiError("The demo administrator account is unavailable.", 401);
    if (!isRole(row.role)) throw new ApiError("The demo administrator role is not configured.", 403);
    const token = await createSessionToken({
      staffDbId: row.id,
      staffId: row.staffCode,
      staffName: row.fullName,
      email: row.email,
      role: row.role,
    });
    await db.update(staff).set({ lastLoginAt: new Date() }).where(eq(staff.id, row.id));
    const response = NextResponse.json({
      ok: true,
      message: "Demo workspace opened as Admin/Manager.",
      staff: { staffId: row.staffCode, staffName: row.fullName, role: row.role, email: row.email },
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}
