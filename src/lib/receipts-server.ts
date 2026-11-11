import { db } from "@/db";
import { folioCharges, hotelSettings, receiptItems, receipts } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import {
  formatReceipt,
  makeReceiptNo,
  type Department,
  type PaymentAllocation,
  type PaymentComponent,
  type PaymentMethod,
  type ReceiptDetail,
  type ReceiptItemView,
  type ReceiptView,
  type RoomCategory,
} from "@/lib/crs";

export type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ChargeForReceipt = {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  department: string;
};

export type CreateReceiptInput = {
  charges: ChargeForReceipt[];
  guestName: string;
  roomNumber: number | null;
  roomCategory?: RoomCategory | null;
  department: Department;
  staffId: string;
  staffName?: string;
  paymentMethod?: PaymentComponent | PaymentMethod;
  payments?: PaymentAllocation[];
  bookingId?: number | null;
  notes?: string | null;
  issuedAt?: Date;
};

function parseBreakdown(value: string): PaymentAllocation[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.method === "string" && Number.isFinite(Number(item.amount)))
          .map((item) => ({ method: item.method as PaymentComponent, amount: Number(item.amount) }))
      : [];
  } catch {
    return [];
  }
}

export async function createReceiptForCharges(
  tx: TransactionClient,
  input: CreateReceiptInput,
): Promise<{ id: number; receiptNo: string; totalAmount: number }> {
  if (!input.charges.length) throw new ApiError("There are no payable charges on this folio.");
  const totalAmount = input.charges.reduce((sum, charge) => sum + charge.amount, 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new ApiError("The receipt total must be greater than zero.");
  const [settings] = await tx.select().from(hotelSettings).limit(1);
  const vatBps = settings?.vatBps ?? 1800;
  const netAmount = Math.round((totalAmount * 10_000) / (10_000 + vatBps));
  const vatAmount = totalAmount - netAmount;
  const allocations: PaymentAllocation[] =
    input.payments && input.payments.length
      ? input.payments
      : [{ method: (input.paymentMethod && input.paymentMethod !== "Split Payment" ? input.paymentMethod : "Cash") as PaymentComponent, amount: totalAmount }];
  if (allocations.reduce((sum, allocation) => sum + allocation.amount, 0) !== totalAmount) {
    throw new ApiError("Split payment allocations must equal the receipt total.");
  }
  const paymentMethod: PaymentMethod = allocations.length > 1 ? "Split Payment" : allocations[0].method;
  const issuedAt = input.issuedAt ?? new Date();
  const receiptNo = makeReceiptNo(issuedAt);

  const [receipt] = await tx.insert(receipts).values({
    receiptNo,
    issuedAt,
    guestName: input.guestName,
    roomNumber: input.roomNumber,
    roomCategory: input.roomCategory ?? null,
    department: input.department,
    staffId: input.staffId,
    staffName: input.staffName ?? "Buloba Hotel Staff",
    paymentMethod,
    paymentBreakdown: JSON.stringify(allocations),
    totalAmount,
    netAmount,
    vatAmount,
    vatBps,
    notes: input.notes ?? null,
    bookingId: input.bookingId ?? null,
  }).returning();

  await tx.insert(receiptItems).values(
    input.charges.map((charge) => ({
      receiptId: receipt.id,
      chargeId: charge.id,
      description: charge.description,
      quantity: charge.quantity,
      unitPrice: charge.unitPrice,
      amount: charge.amount,
      department: charge.department,
    })),
  );
  await tx.update(folioCharges).set({ status: "Paid", receiptId: receipt.id }).where(
    inArray(folioCharges.id, input.charges.map((charge) => charge.id)),
  );
  return { id: receipt.id, receiptNo, totalAmount };
}

export async function getReceiptDetail(id: number): Promise<ReceiptDetail> {
  const [row] = await db.select().from(receipts).where(eq(receipts.id, id)).limit(1);
  if (!row) throw new ApiError("Receipt not found.", 404);
  const [settings] = await db.select().from(hotelSettings).limit(1);
  const itemRows = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, id)).orderBy(receiptItems.id);
  const items: ReceiptItemView[] = itemRows.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount,
    department: item.department as Department,
  }));
  const view: ReceiptView = {
    id: row.id,
    receiptNo: row.receiptNo,
    issuedAt: row.issuedAt.toISOString(),
    guestName: row.guestName,
    roomNumber: row.roomNumber,
    roomCategory: (row.roomCategory as RoomCategory | null) ?? null,
    department: row.department as Department,
    staffId: row.staffId,
    staffName: row.staffName,
    paymentMethod: row.paymentMethod as PaymentMethod,
    paymentBreakdown: parseBreakdown(row.paymentBreakdown),
    totalAmount: row.totalAmount,
    netAmount: row.netAmount,
    vatAmount: row.vatAmount,
    vatBps: row.vatBps,
    notes: row.notes,
    voided: row.voided,
    bookingId: row.bookingId,
    itemCount: items.length,
  };
  const detail: Omit<ReceiptDetail, "text"> = {
    ...view,
    items,
    hotelName: settings?.hotelName,
    hotelLocation: settings?.location,
    contactPhone: settings?.contactPhone,
    contactEmail: settings?.contactEmail,
  };
  return { ...detail, text: formatReceipt(detail) };
}
