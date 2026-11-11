import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { auditLogs, bookings, folioCharges, guests } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiFailure, ApiError, optionalText, parsePaymentAllocations, readBody, requireInteger, requireText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { createReceiptForCharges } from "@/lib/receipts-server";
import type { Department } from "@/lib/crs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const session = await requireApiSession(["Restaurant", "Bar", "Laundry", "Admin/Manager"]);
    const body = await readBody(request);
    const staffId = session.staffId;
    const department = requireText(body.department, "Department", 32) as Department;
    if (!["Restaurant", "Bar", "Laundry"].includes(department)) throw new ApiError("Department must be Restaurant, Bar or Laundry.");
    if (session.role !== "Admin/Manager") {
      const expected = department === "Restaurant" ? "Restaurant" : department === "Bar" ? "Bar" : "Laundry";
      if (session.role !== expected) throw new ApiError(`${session.role} cannot post ${department} charges.`, 403);
    }
    const mode = requireText(body.mode, "Charge mode", 20);
    if (!["room", "walkin"].includes(mode)) throw new ApiError("Charge mode must be room or walkin.");
    if (mode === "walkin" && department === "Laundry") throw new ApiError("Direct walk-in payments are available for Restaurant and Bar.");
    const description = requireText(body.description, "Service / item", 160);
    const quantity = requireInteger(body.quantity, "Quantity", 1, 100);
    const unitPrice = requireInteger(body.unitPrice, "Unit price", 100, 10_000_000);
    const amount = quantity * unitPrice;

    const result = await db.transaction(async (tx) => {
      let bookingId: number | null = null;
      let roomNumber: number | null = null;
      let guestName = optionalText(body.guestName, 160) ?? "Walk-in Guest";
      if (mode === "room") {
        const parsedRoom = Number(body.roomNumber);
        if (!Number.isInteger(parsedRoom) || parsedRoom < 101 || parsedRoom > 200) throw new ApiError("Room number must be between 101 and 200.");
        roomNumber = parsedRoom;
        const [activeBooking] = await tx.select().from(bookings)
          .where(and(eq(bookings.roomNumber, roomNumber), eq(bookings.status, "Checked In")))
          .orderBy(desc(bookings.createdAt)).limit(1);
        if (!activeBooking) throw new ApiError(`Room ${roomNumber} has no in-house guest. Charges can only be posted to an occupied folio.`);
        const [guest] = await tx.select().from(guests).where(eq(guests.id, activeBooking.guestId)).limit(1);
        guestName = guest?.fullName ?? "In-house Guest";
        bookingId = activeBooking.id;
      }
      const [charge] = await tx.insert(folioCharges).values({
        bookingId, roomNumber, guestName, department, description, quantity, unitPrice, amount,
        status: "Open", createdBy: staffId,
      }).returning();
      let receipt: { id: number; receiptNo: string; totalAmount: number } | null = null;
      if (mode === "walkin") {
        const payments = parsePaymentAllocations(body, amount);
        receipt = await createReceiptForCharges(tx, {
          charges: [{ id: charge.id, description: charge.description, quantity: charge.quantity, unitPrice: charge.unitPrice, amount: charge.amount, department: charge.department }],
          guestName, roomNumber: null, roomCategory: null, department, staffId,
          staffName: session.staffName, payments, notes: "Direct walk-in payment — no room folio",
        });
      }
      await tx.insert(auditLogs).values({
        action: mode === "walkin" ? "WALK-IN PAYMENT" : "CHARGE POSTED",
        module: department,
        details: `${description} × ${quantity} · UGX ${amount.toLocaleString("en-UG")}${roomNumber ? ` → room ${roomNumber}` : " · walk-in"}`,
        staffId,
      });
      return { charge, receipt, roomNumber };
    });
    return Response.json({
      ok: true,
      message: result.receipt ? `Payment recorded. Receipt ${result.receipt.receiptNo} is ready to print.` : `${department} charge of UGX ${amount.toLocaleString("en-UG")} posted to room ${result.roomNumber} folio.`,
      receiptId: result.receipt?.id ?? null,
      receiptNo: result.receipt?.receiptNo ?? null,
      chargeId: result.charge.id,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
