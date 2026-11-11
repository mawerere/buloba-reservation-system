import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { apiFailure, ApiError, readBody, requireText } from "@/lib/api";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { isRole } from "@/lib/crs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readBody(request);
    const email = requireText(body.email, "Email", 160).toLowerCase();
    const password = requireText(body.password, "Password", 200);
    const [row] = await db.select().from(staff).where(eq(staff.email, email)).limit(1);
    if (!row || !row.active || !verifyPassword(password, row.passwordHash)) {
      throw new ApiError("Invalid credentials or inactive account.", 401);
    }
    if (!isRole(row.role)) throw new ApiError("This staff role is not configured.", 403);
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
      message: `Welcome back, ${row.fullName}.`,
      staff: {
        staffDbId: row.id,
        staffId: row.staffCode,
        staffName: row.fullName,
        email: row.email,
        role: row.role,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}
