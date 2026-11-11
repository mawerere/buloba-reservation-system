import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, staff, staffApplications } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { apiFailure, ApiError, readBody, requireInteger, requireText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { isRole } from "@/lib/crs";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    await ensureSeeded();
    const session = await requireApiSession(["Admin/Manager"]);
    const body = await readBody(request);
    const id = requireInteger(body.id, "Application ID");
    const action = requireText(body.action, "Review action", 20).toLowerCase();
    if (!["approve", "reject"].includes(action)) throw new ApiError("Action must be approve or reject.");
    const result = await db.transaction(async (tx) => {
      const [application] = await tx.select().from(staffApplications).where(eq(staffApplications.id, id)).limit(1);
      if (!application) throw new ApiError("Application not found.", 404);
      if (application.status !== "Pending") throw new ApiError(`Application is already ${application.status.toLowerCase()}.`);
      if (action === "approve") {
        if (!isRole(application.requestedRole)) throw new ApiError("The requested role is no longer valid.");
        const [duplicate] = await tx.select({ id: staff.id }).from(staff)
          .where(or(eq(staff.email, application.email), eq(staff.staffCode, application.staffCode))).limit(1);
        if (duplicate) throw new ApiError("A staff account already uses this email or staff code.");
        await tx.insert(staff).values({
          fullName: application.fullName,
          email: application.email,
          staffCode: application.staffCode,
          role: application.requestedRole,
          passwordHash: application.passwordHash,
          active: true,
        });
        await tx.insert(auditLogs).values({
          action: "EMPLOYEE APPROVED",
          module: "Recruitment",
          details: `${application.fullName} approved as ${application.requestedRole} · ${application.email}`,
          staffId: session.staffId,
        });
      } else {
        await tx.insert(auditLogs).values({
          action: "EMPLOYEE APPLICATION REJECTED",
          module: "Recruitment",
          details: `${application.fullName} · ${application.email}`,
          staffId: session.staffId,
        });
      }
      await tx.update(staffApplications).set({
        status: action === "approve" ? "Approved" : "Rejected",
        reviewedAt: new Date(),
        reviewedBy: session.staffId,
      }).where(eq(staffApplications.id, id));
      return { fullName: application.fullName, email: application.email, role: application.requestedRole };
    });
    return Response.json({
      ok: true,
      message: action === "approve"
        ? `${result.fullName} is now an active ${result.role} employee. They can sign in with ${result.email} and the password chosen during onboarding.`
        : `${result.fullName}'s application was rejected.`,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
