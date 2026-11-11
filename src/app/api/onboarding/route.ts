import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, staff, staffApplications } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { apiFailure, ApiError, isRoleSafe, optionalText, readBody, requireText } from "@/lib/api";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await readBody(request);
    const fullName = requireText(body.fullName, "Full name", 160);
    const email = requireText(body.email, "Email", 160).toLowerCase();
    const staffCode = requireText(body.staffCode, "Staff code", 32).toUpperCase();
    const password = requireText(body.password, "Password", 200);
    const reason = optionalText(body.reason, 500);
    const requestedRole = body.requestedRole;
    if (!email.includes("@")) throw new ApiError("Enter a valid work email address.");
    if (password.length < 8) throw new ApiError("Choose a password with at least 8 characters.");
    if (!isRoleSafe(requestedRole) || requestedRole === "Admin/Manager") {
      throw new ApiError("Choose a department role. Admin/Manager accounts are created by existing administrators.");
    }
    const [existingStaff] = await db.select({ id: staff.id }).from(staff)
      .where(or(eq(staff.email, email), eq(staff.staffCode, staffCode))).limit(1);
    const [existingApplication] = await db.select({ id: staffApplications.id }).from(staffApplications)
      .where(or(eq(staffApplications.email, email), eq(staffApplications.staffCode, staffCode))).limit(1);
    if (existingStaff || existingApplication) {
      throw new ApiError("An account or pending application already uses this email or staff code.");
    }
    const [created] = await db.insert(staffApplications).values({
      fullName,
      email,
      staffCode,
      requestedRole,
      reason,
      passwordHash: hashPassword(password),
      status: "Pending",
    }).returning();
    await db.insert(auditLogs).values({
      action: "EMPLOYEE APPLICATION",
      module: "Recruitment",
      details: `${fullName} applied for ${requestedRole} · ${staffCode}`,
      staffId: "PUBLIC",
    });
    return Response.json({
      ok: true,
      applicationId: created.id,
      message: `Application #${created.id} submitted. An Admin/Manager must approve it before ${email} can sign in.`,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
