import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { auditLogs, bookings, folioCharges, guests, roomStatusLogs, rooms } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiFailure, ApiError, parsePaymentAllocations, readBody, requireInteger, requireText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { createReceiptForCharges } from "@/lib/receipts-server";
import type { RoomCategory } from "@/lib/crs";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await ensureSeeded();
    const session = await requireApiSession(["Reception", "Admin/Manager"]);
    const { id } = await context.params;
    const bookingId = requireInteger(id, "Booking ID");
    const body = await readBody(request);
    const staffId = session.staffId;
    const action = requireText(body.action, "Action", 32);
    if (!["check-in", "check-out", "cancel"].includes(action)) throw new ApiError("Supported actions are check-in, check-out and cancel.");

    const result = await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
      if (!booking) throw new ApiError("Booking not found.", 404);
      const [guest] = await tx.select().from(guests).where(eq(guests.id, booking.guestId)).limit(1);
      const [room] = await tx.select().from(rooms).where(eq(rooms.number, booking.roomNumber)).limit(1);
      const guestName = guest?.fullName ?? "Guest";
      let receipt: { id: number; receiptNo: string; totalAmount: number } | null = null;

      if (action === "check-in") {
        if (booking.status !== "Reserved") throw new ApiError(`Only reserved bookings can check in. Current status: ${booking.status}.`);
        const occupied = await tx.select({ id: bookings.id }).from(bookings)
          .where(and(eq(bookings.roomNumber, booking.roomNumber), eq(bookings.status, "Checked In"))).limit(1);
        if (occupied.length) throw new ApiError(`Room ${booking.roomNumber} already has an in-house guest.`);
        await tx.update(bookings).set({ status: "Checked In", actualCheckIn: new Date() }).where(eq(bookings.id, bookingId));
        if (room) {
          await tx.update(rooms).set({ status: "Dirty", statusNote: `In-house · ${guestName}`, statusUpdatedAt: new Date() }).where(eq(rooms.number, booking.roomNumber));
          await tx.insert(roomStatusLogs).values({ roomNumber: booking.roomNumber, previousStatus: room.status, newStatus: "Dirty", note: `Check-in: ${guestName}`, staffId });
        }
        await tx.insert(auditLogs).values({ action: "CHECK-IN", module: "Reception", details: `${guestName} checked into room ${booking.roomNumber}`, staffId });
      }

      if (action === "check-out") {
        if (booking.status !== "Checked In") throw new ApiError(`Only in-house bookings can check out. Current status: ${booking.status}.`);
        const openCharges = await tx.select().from(folioCharges).where(and(eq(folioCharges.bookingId, bookingId), eq(folioCharges.status, "Open")));
        if (openCharges.length) {
          const total = openCharges.reduce((sum, charge) => sum + charge.amount, 0);
          const payments = parsePaymentAllocations(body, total);
          receipt = await createReceiptForCharges(tx, {
            charges: openCharges.map((charge) => ({ id: charge.id, description: charge.description, quantity: charge.quantity, unitPrice: charge.unitPrice, amount: charge.amount, department: charge.department })),
            guestName, roomNumber: booking.roomNumber, roomCategory: (room?.category as RoomCategory | undefined) ?? null,
            department: "Front Desk", staffId, staffName: session.staffName, payments,
            bookingId, notes: "Folio settled at checkout",
          });
        }
        await tx.update(bookings).set({ status: "Checked Out", actualCheckOut: new Date() }).where(eq(bookings.id, bookingId));
        if (room) {
          await tx.update(rooms).set({ status: "Dirty", statusNote: "Checkout — housekeeping cleaning required", statusUpdatedAt: new Date() }).where(eq(rooms.number, booking.roomNumber));
          await tx.insert(roomStatusLogs).values({ roomNumber: booking.roomNumber, previousStatus: room.status, newStatus: "Dirty", note: `Checkout: ${guestName}`, staffId });
        }
        await tx.insert(auditLogs).values({ action: "CHECKOUT", module: "Reception", details: `${guestName} checked out of room ${booking.roomNumber}${receipt ? ` · ${receipt.receiptNo}` : ""}`, staffId });
      }

      if (action === "cancel") {
        if (booking.status === "Checked In") throw new ApiError("An in-house booking must be checked out, not cancelled.");
        if (booking.status === "Checked Out" || booking.status === "Cancelled") throw new ApiError(`Booking is already ${booking.status.toLowerCase()}.`);
        await tx.update(bookings).set({ status: "Cancelled" }).where(eq(bookings.id, bookingId));
        await tx.update(folioCharges).set({ status: "Cancelled" }).where(and(eq(folioCharges.bookingId, bookingId), eq(folioCharges.status, "Open")));
        await tx.insert(auditLogs).values({ action: "BOOKING CANCELLED", module: "Reception", details: `Booking #${bookingId} · ${guestName} · room ${booking.roomNumber}`, staffId });
      }
      return { guestName, receipt };
    });

    const messages: Record<string, string> = {
      "check-in": `${result.guestName} checked in successfully.`,
      "check-out": result.receipt ? `Checkout complete. Receipt ${result.receipt.receiptNo} issued for UGX ${result.receipt.totalAmount.toLocaleString("en-UG")}.` : `${result.guestName} checked out; folio was already settled.`,
      cancel: `Booking #${bookingId} cancelled and open folio items voided.`,
    };
    return Response.json({ ok: true, message: messages[action], receiptId: result.receipt?.id ?? null, receiptNo: result.receipt?.receiptNo ?? null });
  } catch (error) {
    return apiFailure(error);
  }
}
