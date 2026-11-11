import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { auditLogs, bookings, folioCharges, guests, rooms } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiFailure, ApiError, parsePaymentAllocations, readBody, requireInteger } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { createReceiptForCharges } from "@/lib/receipts-server";
import type { RoomCategory } from "@/lib/crs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const session = await requireApiSession(["Reception", "Admin/Manager", "Finance"]);
    const body = await readBody(request);
    const bookingId = requireInteger(body.bookingId, "Booking ID");
    const result = await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
      if (!booking) throw new ApiError("Booking not found.", 404);
      const [guest] = await tx.select().from(guests).where(eq(guests.id, booking.guestId)).limit(1);
      const [room] = await tx.select().from(rooms).where(eq(rooms.number, booking.roomNumber)).limit(1);
      const openCharges = await tx.select().from(folioCharges).where(and(eq(folioCharges.bookingId, bookingId), eq(folioCharges.status, "Open")));
      if (!openCharges.length) throw new ApiError("This folio has no outstanding charges to settle.");
      const total = openCharges.reduce((sum, charge) => sum + charge.amount, 0);
      const payments = parsePaymentAllocations(body, total);
      const receipt = await createReceiptForCharges(tx, {
        charges: openCharges.map((charge) => ({ id: charge.id, description: charge.description, quantity: charge.quantity, unitPrice: charge.unitPrice, amount: charge.amount, department: charge.department })),
        guestName: guest?.fullName ?? "Guest",
        roomNumber: booking.roomNumber,
        roomCategory: (room?.category as RoomCategory | undefined) ?? null,
        department: session.role === "Finance" ? "Finance" : "Front Desk",
        staffId: session.staffId,
        staffName: session.staffName,
        payments, bookingId, notes: "Guest folio settlement",
      });
      await tx.insert(auditLogs).values({
        action: "FOLIO SETTLED", module: session.role === "Finance" ? "Finance" : "Reception",
        details: `${guest?.fullName ?? "Guest"} · room ${booking.roomNumber} · ${receipt.receiptNo}`, staffId: session.staffId,
      });
      return receipt;
    });
    return Response.json({ ok: true, message: `Folio settled. Receipt ${result.receiptNo} issued for UGX ${result.totalAmount.toLocaleString("en-UG")}.`, receiptId: result.id, receiptNo: result.receiptNo });
  } catch (error) {
    return apiFailure(error);
  }
}
