import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { auditLogs, bookings, folioCharges, guests, rooms } from "@/db/schema";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { apiFailure, ApiError, optionalText, readBody, requireInteger, requireText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { assertDateKey, nightsBetween, parseRoomNumber } from "@/lib/crs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const session = await requireApiSession(["Reception", "Admin/Manager"]);
    const body = await readBody(request);
    const staffId = session.staffId;
    const guestName = requireText(body.guestName, "Guest name", 160);
    const guestPhone = requireText(body.guestPhone, "Guest phone", 40);
    const nationality = optionalText(body.nationality, 80);
    const idNumber = optionalText(body.idNumber, 80);
    const roomNumber = parseRoomNumber(body.roomNumber);
    const checkInDate = assertDateKey(body.checkIn, "Check-in date");
    const checkOutDate = assertDateKey(body.checkOut, "Check-out date");
    const nights = nightsBetween(checkInDate, checkOutDate);
    const guestsCount = requireInteger(body.guestsCount, "Guest count", 1, 6);
    const notes = optionalText(body.notes, 400);

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${roomNumber})`);
      const [room] = await tx.select().from(rooms).where(eq(rooms.number, roomNumber)).limit(1);
      if (!room) throw new ApiError(`Room ${roomNumber} is not in the inventory.`, 404);
      if (room.status === "Under Maintenance") throw new ApiError(`Room ${roomNumber} is out of order and cannot be reserved.`);
      const conflicts = await tx.select({ id: bookings.id, checkIn: bookings.checkIn, checkOut: bookings.checkOut })
        .from(bookings)
        .where(and(eq(bookings.roomNumber, roomNumber), inArray(bookings.status, ["Reserved", "Checked In"]), lt(bookings.checkIn, checkOutDate), gt(bookings.checkOut, checkInDate)))
        .limit(1);
      if (conflicts.length) throw new ApiError(`Double booking blocked: room ${roomNumber} is booked ${conflicts[0].checkIn} → ${conflicts[0].checkOut}.`, 409);
      let [guest] = await tx.select().from(guests).where(eq(guests.phone, guestPhone)).limit(1);
      if (!guest) {
        const inserted = await tx.insert(guests).values({ fullName: guestName, phone: guestPhone, nationality, idNumber }).onConflictDoNothing().returning();
        guest = inserted[0] ?? (await tx.select().from(guests).where(eq(guests.phone, guestPhone)).limit(1))[0];
      }
      if (!guest) throw new ApiError("Could not create or locate the guest profile.");
      const [booking] = await tx.insert(bookings).values({
        guestId: guest.id, roomNumber, checkIn: checkInDate, checkOut: checkOutDate,
        guestsCount, status: "Reserved", nightlyRate: room.rate, notes, createdBy: staffId,
      }).returning();
      await tx.insert(folioCharges).values({
        bookingId: booking.id, roomNumber, guestName: guest.fullName, department: "Accommodation",
        description: `Room ${roomNumber} — ${nights} night(s), ${checkInDate} to ${checkOutDate}`,
        quantity: nights, unitPrice: room.rate, amount: nights * room.rate,
        status: "Open", createdBy: staffId,
      });
      await tx.insert(auditLogs).values({
        action: "BOOKING CREATED", module: "Reception",
        details: `${guest.fullName} · Room ${roomNumber} · ${checkInDate} → ${checkOutDate}`, staffId,
      });
      return booking;
    });
    return Response.json({ ok: true, bookingId: result.id, message: `Booking #${result.id} confirmed for room ${roomNumber}. Accommodation charge posted to folio.` });
  } catch (error) {
    return apiFailure(error);
  }
}
