import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, staff } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { apiFailure, ApiError, isRoleSafe, readBody, requireInteger, requireText } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { requireApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireApiSession(["Admin/Manager"]);
    await ensureSeeded();
    const body = await readBody(request);
    const fullName = requireText(body.fullName, "Full name", 160);
    const email = requireText(body.email, "Email", 160).toLowerCase();
    const staffCode = requireText(body.staffCode, "Staff code", 32).toUpperCase();
    const password = requireText(body.password, "Password", 200);
    if (!email.includes("@")) throw new ApiError("Enter a valid staff email address.");
    if (password.length < 8) throw new ApiError("Password must be at least 8 characters.");
    const role = body.role;
    if (!isRoleSafe(role)) throw new ApiError("Select a valid staff role.");
    const [created] = await db.insert(staff).values({
      fullName,
      email,
      staffCode,
      role,
      passwordHash: hashPassword(password),
      active: true,
    }).returning();
    await db.insert(auditLogs).values({
      action: "STAFF CREATED",
      module: "Administration",
      details: `${created.fullName} · ${created.role} · ${created.staffCode}`,
      staffId: staffCode,
    });
    return Response.json({ ok: true, message: `Staff account ${created.staffCode} created.`, staffId: created.id });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireApiSession(["Admin/Manager"]);
    await ensureSeeded();
    const body = await readBody(request);
    const id = requireInteger(body.id, "Staff ID");
    if (id === session.staffDbId && body.active === false) {
      throw new ApiError("You cannot deactivate your own active session.");
    }
    const updates: Record<string, unknown> = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (body.role !== undefined) {
      if (!isRoleSafe(body.role)) throw new ApiError("Select a valid staff role.");
      updates.role = body.role;
    }
    if (!Object.keys(updates).length) throw new ApiError("No staff changes were supplied.");
    const [updated] = await db.update(staff).set(updates).where(eq(staff.id, id)).returning();
    if (!updated) throw new ApiError("Staff account not found.", 404);
    await db.insert(auditLogs).values({
      action: "STAFF UPDATED",
      module: "Administration",
      details: `${updated.fullName} · ${Object.keys(updates).join(", ")}`,
      staffId: session.staffId,
    });
    return Response.json({ ok: true, message: `${updated.fullName}'s account was updated.` });
  } catch (error) {
    return apiFailure(error);
  }
}
