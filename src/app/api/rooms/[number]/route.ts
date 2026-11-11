import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { auditLogs, bookings, roomStatusLogs, rooms } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiFailure, ApiError, optionalText, readBody, requireText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { isRoomStatus, parseRoomNumber } from "@/lib/crs";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ number: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await ensureSeeded();
    const session = await requireApiSession(["Housekeeping", "Reception", "Admin/Manager"]);
    const { number } = await context.params;
    const roomNumber = parseRoomNumber(number);
    const body = await readBody(request);
    if (!isRoomStatus(body.status)) throw new ApiError("Status must be Clean, Dirty or Under Maintenance.");
    const status = body.status;
    const note = optionalText(body.note, 300);
    if (status === "Under Maintenance" && !note) throw new ApiError("A maintenance reason is required for out-of-order rooms.");
    const result = await db.transaction(async (tx) => {
      const [room] = await tx.select().from(rooms).where(eq(rooms.number, roomNumber)).limit(1);
      if (!room) throw new ApiError("Room not found.", 404);
      if (status === "Under Maintenance") {
        const [occupied] = await tx.select({ id: bookings.id }).from(bookings)
          .where(and(eq(bookings.roomNumber, roomNumber), eq(bookings.status, "Checked In"))).limit(1);
        if (occupied) throw new ApiError("An occupied room cannot be placed under maintenance.");
      }
      if (room.status === status) throw new ApiError(`Room ${roomNumber} is already ${status}.`);
      await tx.update(rooms).set({ status, statusNote: note ?? `Status changed to ${status}`, statusUpdatedAt: new Date() }).where(eq(rooms.number, roomNumber));
      await tx.insert(roomStatusLogs).values({ roomNumber, previousStatus: room.status, newStatus: status, note, staffId: session.staffId });
      await tx.insert(auditLogs).values({
        action: status === "Under Maintenance" ? "MAINTENANCE OPENED" : "ROOM STATUS UPDATE",
        module: "Housekeeping",
        details: `Room ${roomNumber}: ${room.status} → ${status}${note ? ` · ${note}` : ""}`, staffId: session.staffId,
      });
      return { previousStatus: room.status, newStatus: status };
    });
    return Response.json({ ok: true, message: `Room ${roomNumber} updated: ${result.previousStatus} → ${result.newStatus}. Log written to maintenance register.` });
  } catch (error) {
    return apiFailure(error);
  }
}
