import { ensureSeeded } from "@/db/seed";
import { db } from "@/db";
import {
  auditLogs,
  bookings,
  folioCharges,
  guests,
  hotelSettings,
  receiptItems,
  receipts,
  roomStatusLogs,
  rooms,
  staff,
  staffApplications,
} from "@/db/schema";
import { desc } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import {
  bookingOverlaps,
  dateKeysBetween,
  dateRangeForPeriod,
  kampalaDateKey,
  nightsBetween,
  ROOM_CATEGORIES,
  shiftDate,
  type AuditView,
  type BookingStatus,
  type BookingView,
  type ChargeStatus,
  type ChargeView,
  type CrsState,
  type Department,
  type GuestView,
  type PaymentAllocation,
  type PaymentMethod,
  type ReceiptView,
  type ReportData,
  type ReportSection,
  type Role,
  type RoomCategory,
  type RoomStatus,
  type RoomView,
  type SettingsView,
  type StaffApplicationView,
  type StaffView,
  type StatusLogView,
} from "@/lib/crs";

export const REPORT_PERMISSIONS: Record<ReportSection, readonly Role[]> = {
  occupancy: ["Reception", "Admin/Manager", "Finance"],
  revenue: ["Restaurant", "Bar", "Laundry", "Admin/Manager", "Finance"],
  cashier: ["Admin/Manager", "Finance"],
  maintenance: ["Housekeeping", "Admin/Manager", "Finance"],
};

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

function parseBreakdown(value: string): PaymentAllocation[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => ({ method: String(item.method) as PaymentAllocation["method"], amount: Number(item.amount) }))
      : [];
  } catch {
    return [];
  }
}

function mapRoom(row: typeof rooms.$inferSelect): RoomView {
  return {
    number: row.number,
    category: row.category as RoomCategory,
    rate: row.rate,
    status: row.status as RoomStatus,
    statusNote: row.statusNote,
    statusUpdatedAt: row.statusUpdatedAt.toISOString(),
  };
}

function mapReceipt(row: typeof receipts.$inferSelect, itemCount = 0): ReceiptView {
  return {
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
    itemCount,
  };
}

function mapSettings(row: typeof hotelSettings.$inferSelect): SettingsView {
  return {
    id: row.id,
    hotelName: row.hotelName,
    location: row.location,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    standardRate: row.standardRate,
    deluxeRate: row.deluxeRate,
    suiteRate: row.suiteRate,
    vatBps: row.vatBps,
    serviceChargeBps: row.serviceChargeBps,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function getState(): Promise<CrsState> {
  await ensureSeeded();
  const [roomRows, guestRows, bookingRows, chargeRows, receiptRows, itemRows, logRows, auditRows, settingsRows, staffRows, applicationRows] =
    await Promise.all([
      db.select().from(rooms).orderBy(rooms.number),
      db.select().from(guests).orderBy(desc(guests.createdAt)),
      db.select().from(bookings).orderBy(desc(bookings.createdAt)),
      db.select().from(folioCharges).orderBy(desc(folioCharges.createdAt)),
      db.select().from(receipts).orderBy(desc(receipts.issuedAt)),
      db.select().from(receiptItems),
      db.select().from(roomStatusLogs).orderBy(desc(roomStatusLogs.createdAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40),
      db.select().from(hotelSettings).limit(1),
      db.select().from(staff).orderBy(staff.fullName),
      db.select().from(staffApplications).orderBy(desc(staffApplications.createdAt)),
    ]);

  const guestMap = new Map(guestRows.map((guest) => [guest.id, guest]));
  const itemCountMap = new Map<number, number>();
  for (const item of itemRows) itemCountMap.set(item.receiptId, (itemCountMap.get(item.receiptId) ?? 0) + 1);
  const balanceMap = new Map<number, { total: number; count: number }>();
  for (const charge of chargeRows) {
    if (!charge.bookingId || charge.status !== "Open") continue;
    const current = balanceMap.get(charge.bookingId) ?? { total: 0, count: 0 };
    balanceMap.set(charge.bookingId, { total: current.total + charge.amount, count: current.count + 1 });
  }

  const bookingViews: BookingView[] = bookingRows.map((booking) => {
    const guest = guestMap.get(booking.guestId);
    const folio = balanceMap.get(booking.id) ?? { total: 0, count: 0 };
    return {
      id: booking.id,
      guestId: booking.guestId,
      guestName: guest?.fullName ?? "Guest record missing",
      guestPhone: guest?.phone ?? "—",
      roomNumber: booking.roomNumber,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestsCount: booking.guestsCount,
      status: booking.status as BookingStatus,
      nightlyRate: booking.nightlyRate,
      notes: booking.notes,
      actualCheckIn: iso(booking.actualCheckIn),
      actualCheckOut: iso(booking.actualCheckOut),
      createdAt: booking.createdAt.toISOString(),
      createdBy: booking.createdBy,
      folioBalance: folio.total,
      chargeCount: folio.count,
    };
  });

  const roomViews = roomRows.map(mapRoom);
  const today = kampalaDateKey();
  const inHouse = bookingViews.filter((booking) => booking.status === "Checked In");
  const occupiedRooms = new Set(inHouse.map((booking) => booking.roomNumber));
  const outOfOrder = roomViews.filter((room) => room.status === "Under Maintenance").length;
  const receiptsToday = receiptRows.filter(
    (receipt) => !receipt.voided && kampalaDateKey(receipt.issuedAt) === today,
  );

  return {
    generatedAt: new Date().toISOString(),
    settings: mapSettings(settingsRows[0] ?? fallbackSettings()),
    staff: staffRows.map((row): StaffView => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      staffCode: row.staffCode,
      role: row.role as Role,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: iso(row.lastLoginAt),
    })),
    applications: applicationRows.map((row): StaffApplicationView => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      staffCode: row.staffCode,
      requestedRole: row.requestedRole as Role,
      reason: row.reason,
      status: row.status as StaffApplicationView["status"],
      createdAt: row.createdAt.toISOString(),
      reviewedAt: iso(row.reviewedAt),
      reviewedBy: row.reviewedBy,
    })),
    stats: {
      totalRooms: roomViews.length,
      inHouse: inHouse.length,
      reservations: bookingViews.filter((booking) => booking.status === "Reserved").length,
      readyRooms: roomViews.filter((room) => room.status === "Clean" && !occupiedRooms.has(room.number)).length,
      dirtyRooms: roomViews.filter((room) => room.status === "Dirty").length,
      outOfOrder,
      occupancyRate: Math.round((inHouse.length / Math.max(1, roomViews.length - outOfOrder)) * 1000) / 10,
      arrivalsToday: bookingViews.filter((booking) => booking.checkIn === today && booking.status === "Reserved").length,
      departuresToday: bookingViews.filter((booking) => booking.checkOut === today && booking.status === "Checked In").length,
      collectedToday: receiptsToday.reduce((sum, receipt) => sum + receipt.totalAmount, 0),
      openFolio: chargeRows.filter((charge) => charge.status === "Open").reduce((sum, charge) => sum + charge.amount, 0),
      receiptsToday: receiptsToday.length,
      today,
    },
    rooms: roomViews,
    guests: guestRows.map((row): GuestView => ({
      id: row.id,
      fullName: row.fullName,
      phone: row.phone,
      nationality: row.nationality,
      createdAt: row.createdAt.toISOString(),
    })),
    bookings: bookingViews,
    charges: chargeRows.map((row): ChargeView => ({
      id: row.id,
      bookingId: row.bookingId,
      roomNumber: row.roomNumber,
      guestName: row.guestName,
      department: row.department as Department,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      amount: row.amount,
      status: row.status as ChargeStatus,
      receiptId: row.receiptId,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    })),
    receipts: receiptRows.map((row) => mapReceipt(row, itemCountMap.get(row.id) ?? 0)),
    statusLogs: logRows.map((row): StatusLogView => ({
      id: row.id,
      roomNumber: row.roomNumber,
      previousStatus: row.previousStatus as RoomStatus,
      newStatus: row.newStatus as RoomStatus,
      note: row.note,
      staffId: row.staffId,
      createdAt: row.createdAt.toISOString(),
    })),
    audits: auditRows.map((row): AuditView => ({
      id: row.id,
      action: row.action,
      module: row.module,
      details: row.details,
      staffId: row.staffId,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

function fallbackSettings(): typeof hotelSettings.$inferSelect {
  const now = new Date();
  return {
    id: 1,
    hotelName: "Buloba Hotel",
    location: "Kiwesa, Wakiso District",
    contactPhone: "+256 414 250 118",
    contactEmail: "reservations@bulobahotel.ug",
    standardRate: 120_000,
    deluxeRate: 220_000,
    suiteRate: 380_000,
    vatBps: 1800,
    serviceChargeBps: 0,
    updatedAt: now,
    updatedBy: "SYS-001",
  };
}

export async function getReport(input: {
  period?: string;
  from?: string | null;
  to?: string | null;
  section?: string;
  department?: string | null;
  category?: string | null;
}): Promise<ReportData> {
  await ensureSeeded();
  const range = dateRangeForPeriod(input.period ?? "daily", input.from, input.to);
  const dates = dateKeysBetween(range.from, range.to);
  const departmentFilter = input.department && input.department !== "All" ? input.department : "All";
  const categoryFilter = input.category && input.category !== "All" ? input.category : "All";
  const [roomRows, bookingRows, guestRows, chargeRows, receiptRows, itemRows, logRows] = await Promise.all([
    db.select().from(rooms),
    db.select().from(bookings),
    db.select().from(guests),
    db.select().from(folioCharges),
    db.select().from(receipts),
    db.select().from(receiptItems),
    db.select().from(roomStatusLogs).orderBy(desc(roomStatusLogs.createdAt)),
  ]);
  const inRange = (date: Date) => {
    const key = kampalaDateKey(date);
    return key >= range.from && key <= range.to;
  };
  const roomMap = new Map(roomRows.map((room) => [room.number, room]));
  const guestMap = new Map(guestRows.map((guest) => [guest.id, guest.fullName]));
  const receiptMap = new Map(receiptRows.map((receipt) => [receipt.id, receipt]));
  const scopedRooms = roomRows.filter((room) => categoryFilter === "All" || room.category === categoryFilter);
  const scopedRoomNumbers = new Set(scopedRooms.map((room) => room.number));
  const activeBookings = bookingRows.filter(
    (booking) => booking.status !== "Cancelled" && scopedRoomNumbers.has(booking.roomNumber),
  );
  const paidReceipts = receiptRows.filter((receipt) => !receipt.voided && inRange(receipt.issuedAt));
  const paidReceiptIds = new Set(paidReceipts.map((receipt) => receipt.id));
  const collectedItems = itemRows.filter(
    (item) => paidReceiptIds.has(item.receiptId) && (departmentFilter === "All" || item.department === departmentFilter),
  );
  const postedCharges = chargeRows.filter(
    (charge) =>
      charge.status !== "Cancelled" &&
      inRange(charge.createdAt) &&
      (departmentFilter === "All" || charge.department === departmentFilter),
  );

  const daily = dates.map((date) => {
    const occupied = activeBookings.filter((booking) => booking.checkIn <= date && booking.checkOut > date).length;
    return {
      date,
      occupied,
      available: Math.max(0, scopedRooms.length - occupied),
      rate: Math.round((occupied / Math.max(1, scopedRooms.length)) * 1000) / 10,
    };
  });
  const occupiedRoomNights = daily.reduce((sum, day) => sum + day.occupied, 0);
  const availableRoomNights = dates.length * Math.max(1, scopedRooms.length);
  const byCategory = ROOM_CATEGORIES.filter((category) => categoryFilter === "All" || categoryFilter === category).map((category) => {
    const categoryRooms = roomRows.filter((room) => room.category === category);
    const categoryNumbers = new Set(categoryRooms.map((room) => room.number));
    const nights = dates.reduce(
      (sum, date) => sum + activeBookings.filter((booking) => categoryNumbers.has(booking.roomNumber) && booking.checkIn <= date && booking.checkOut > date).length,
      0,
    );
    return {
      category,
      rooms: categoryRooms.length,
      occupiedRoomNights: nights,
      rate: Math.round((nights / Math.max(1, categoryRooms.length * dates.length)) * 1000) / 10,
    };
  });

  const relevantDepartments: Department[] = ["Accommodation", "Restaurant", "Bar", "Laundry"];
  const byDepartment = relevantDepartments.filter((department) => departmentFilter === "All" || departmentFilter === department).map((department) => ({
    department,
    collected: collectedItems.filter((item) => item.department === department).reduce((sum, item) => sum + item.amount, 0),
    posted: postedCharges.filter((charge) => charge.department === department).reduce((sum, charge) => sum + charge.amount, 0),
    transactions: collectedItems.filter((item) => item.department === department).length,
  }));
  const byDateMap = new Map(dates.map((date) => [date, 0]));
  for (const item of collectedItems) {
    const receipt = receiptMap.get(item.receiptId);
    if (!receipt) continue;
    const key = kampalaDateKey(receipt.issuedAt);
    byDateMap.set(key, (byDateMap.get(key) ?? 0) + item.amount);
  }

  const group = <K extends string>(rows: { key: K; amount: number }[]) => {
    const map = new Map<K, { count: number; total: number }>();
    for (const row of rows) {
      const value = map.get(row.key) ?? { count: 0, total: 0 };
      map.set(row.key, { count: value.count + 1, total: value.total + row.amount });
    }
    return map;
  };
  const methodMap = group(paidReceipts.map((receipt) => ({ key: receipt.paymentMethod as PaymentMethod, amount: receipt.totalAmount })));
  const staffMap = group(paidReceipts.map((receipt) => ({ key: receipt.staffId, amount: receipt.totalAmount })));
  const deptMap = group(paidReceipts.map((receipt) => ({ key: receipt.department as Department, amount: receipt.totalAmount })));
  const rangeEnd = shiftDate(range.to, 1);
  const overlapBookings = activeBookings.filter((booking) => bookingOverlaps(range.from, rangeEnd, booking.checkIn, booking.checkOut));
  const maintenanceEvents = logRows.filter((row) => inRange(row.createdAt) && (row.newStatus === "Under Maintenance" || row.previousStatus === "Under Maintenance"));
  const collected = collectedItems.reduce((sum, item) => sum + item.amount, 0);
  const posted = postedCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const openFolio = chargeRows.filter((charge) => charge.status === "Open").reduce((sum, charge) => sum + charge.amount, 0);
  const outOfOrder = roomRows.filter((room) => room.status === "Under Maintenance").length;
  const occupancyRate = Math.round((occupiedRoomNights / Math.max(1, availableRoomNights)) * 1000) / 10;
  const flags = [
    outOfOrder ? `${outOfOrder} room(s) out of order; verify maintenance completion.` : "All rooms are sellable.",
    openFolio ? `${openFolio.toLocaleString("en-UG")} UGX remains on open guest folios.` : "All guest folios are settled.",
    posted > collected ? "Posted charge value exceeds collected receipts; review unsettled folios." : "Posted and collected values are reconcilable.",
    paidReceipts.length ? "" : "No paid transactions recorded for this period.",
  ].filter(Boolean);

  return {
    meta: {
      from: range.from,
      to: range.to,
      period: range.period,
      section: input.section ?? "all",
      department: departmentFilter,
      category: categoryFilter,
      generatedAt: new Date().toISOString(),
      days: dates.length,
    },
    occupancy: {
      availableRoomNights,
      occupiedRoomNights,
      occupancyRate,
      arrivals: activeBookings.filter((booking) => booking.checkIn >= range.from && booking.checkIn <= range.to).length,
      departures: activeBookings.filter((booking) => booking.checkOut >= range.from && booking.checkOut <= range.to).length,
      inHouse: bookingRows.filter((booking) => booking.status === "Checked In").length,
      activeReservations: bookingRows.filter((booking) => booking.status === "Reserved" && scopedRoomNumbers.has(booking.roomNumber) && bookingOverlaps(range.from, rangeEnd, booking.checkIn, booking.checkOut)).length,
      cancelled: bookingRows.filter((booking) => booking.status === "Cancelled" && inRange(booking.createdAt)).length,
      daily,
      byCategory,
      bookings: overlapBookings.map((booking) => ({
        id: booking.id,
        guestName: guestMap.get(booking.guestId) ?? `Guest #${booking.guestId}`,
        roomNumber: booking.roomNumber,
        category: (roomMap.get(booking.roomNumber)?.category ?? "Standard") as RoomCategory,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status as BookingStatus,
        nights: nightsBetween(booking.checkIn, booking.checkOut),
      })).sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    },
    revenue: {
      collected,
      posted,
      byDepartment,
      byDate: dates.map((date) => ({ date, amount: byDateMap.get(date) ?? 0 })),
      items: collectedItems.map((item) => ({
        date: receiptMap.get(item.receiptId) ? kampalaDateKey(receiptMap.get(item.receiptId)!.issuedAt) : range.from,
        department: item.department as Department,
        description: item.description,
        amount: item.amount,
        receiptNo: receiptMap.get(item.receiptId)?.receiptNo ?? "—",
      })),
    },
    cashier: {
      total: paidReceipts.reduce((sum, receipt) => sum + receipt.totalAmount, 0),
      count: paidReceipts.length,
      byMethod: [...methodMap.entries()].map(([method, value]) => ({ method, count: value.count, total: value.total })),
      byStaff: [...staffMap.entries()].map(([staffId, value]) => ({ staffId, count: value.count, total: value.total })),
      byDepartment: [...deptMap.entries()].map(([department, value]) => ({ department, count: value.count, total: value.total })),
      receipts: paidReceipts.map((receipt) => mapReceipt(receipt, itemRows.filter((item) => item.receiptId === receipt.id).length)).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    },
    maintenance: {
      currentOutOfOrder: outOfOrder,
      dirtyRooms: roomRows.filter((room) => room.status === "Dirty").length,
      events: maintenanceEvents.map((row): StatusLogView => ({
        id: row.id,
        roomNumber: row.roomNumber,
        previousStatus: row.previousStatus as RoomStatus,
        newStatus: row.newStatus as RoomStatus,
        note: row.note,
        staffId: row.staffId,
        createdAt: row.createdAt.toISOString(),
      })),
      openEvents: outOfOrder,
    },
    audit: {
      collected,
      receipts: paidReceipts.length,
      posted,
      openFolio,
      outOfOrder,
      occupancyRate,
      flags,
    },
  };
}

export function assertReportAccess(role: Role, section: string): void {
  if (section === "all") {
    if (role !== "Admin/Manager" && role !== "Finance") {
      throw new ApiError("Only Admin/Manager and Finance may run a consolidated audit.", 403);
    }
    return;
  }
  const permissions = REPORT_PERMISSIONS[section as ReportSection];
  if (!permissions || !permissions.includes(role)) {
    throw new ApiError(`${role} is not authorized to generate this report.`, 403);
  }
}
