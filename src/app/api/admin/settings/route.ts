import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, hotelSettings, rooms } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { apiFailure, ApiError, optionalText, readBody, requireInteger, requireText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const session = await requireApiSession(["Admin/Manager"]);
    await ensureSeeded();
    const body = await readBody(request);
    const values = {
      hotelName: requireText(body.hotelName, "Hotel name", 120),
      location: requireText(body.location, "Location", 160),
      contactPhone: requireText(body.contactPhone, "Contact phone", 60),
      contactEmail: requireText(body.contactEmail, "Contact email", 160),
      standardRate: requireInteger(body.standardRate, "Standard rate", 10_000, 5_000_000),
      deluxeRate: requireInteger(body.deluxeRate, "Deluxe rate", 10_000, 5_000_000),
      suiteRate: requireInteger(body.suiteRate, "Suite rate", 10_000, 5_000_000),
      vatBps: requireInteger(body.vatBps, "VAT basis points", 0, 10_000),
      serviceChargeBps: requireInteger(body.serviceChargeBps, "Service charge basis points", 0, 10_000),
      updatedAt: new Date(),
      updatedBy: session.staffId,
    };
    if (!values.contactEmail.includes("@")) throw new ApiError("Enter a valid contact email.");
    await db.transaction(async (tx) => {
      await tx.update(hotelSettings).set(values).where(eq(hotelSettings.id, 1));
      await tx.update(rooms).set({ rate: values.standardRate }).where(eq(rooms.category, "Standard"));
      await tx.update(rooms).set({ rate: values.deluxeRate }).where(eq(rooms.category, "Deluxe"));
      await tx.update(rooms).set({ rate: values.suiteRate }).where(eq(rooms.category, "Suite"));
      await tx.insert(auditLogs).values({
        action: "SYSTEM SETTINGS UPDATED",
        module: "Administration",
        details: `Room rates and VAT updated by ${session.staffName}`,
        staffId: session.staffId,
      });
    });
    return Response.json({ ok: true, message: "System settings and category room rates updated." });
  } catch (error) {
    return apiFailure(error);
  }
}
