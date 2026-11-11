/* Shared Buloba Hotel CRS domain types and pure helpers. */
export const HOTEL = {
  name: "Buloba Hotel",
  location: "Kiwesa, Wakiso District",
  phone: "+256 414 250 118",
  email: "reservations@bulobahotel.ug",
  rooms: 100,
  firstRoom: 101,
  lastRoom: 200,
  currency: "UGX",
  timezone: "Africa/Kampala",
} as const;

export const ROLES = [
  "Admin/Manager",
  "Reception",
  "Restaurant",
  "Bar",
  "Laundry",
  "Housekeeping",
  "Finance",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_STAFF: Record<Role, string> = {
  "Admin/Manager": "ADM-001",
  Reception: "FD-014",
  Restaurant: "FB-027",
  Bar: "BAR-018",
  Laundry: "LND-006",
  Housekeeping: "HK-009",
  Finance: "FN-003",
};

export const ROLE_DEFAULT_MODULE: Record<Role, ModuleId> = {
  "Admin/Manager": "admin",
  Reception: "front-desk",
  Restaurant: "food-beverage",
  Bar: "food-beverage",
  Laundry: "housekeeping",
  Housekeeping: "housekeeping",
  Finance: "finance",
};

export const ROOM_CATEGORIES = ["Standard", "Deluxe", "Suite"] as const;
export type RoomCategory = (typeof ROOM_CATEGORIES)[number];

export const ROOM_STATUSES = ["Clean", "Dirty", "Under Maintenance"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_DISPLAY_STATUSES = [
  "Available",
  "Occupied",
  "Reserved",
  "Under Maintenance",
  "Cleaning Needed",
] as const;
export type RoomDisplayStatus = (typeof ROOM_DISPLAY_STATUSES)[number];

export const BOOKING_STATUSES = ["Reserved", "Checked In", "Checked Out", "Cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const CHARGE_STATUSES = ["Open", "Paid", "Cancelled"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const DEPARTMENTS = [
  "Accommodation",
  "Restaurant",
  "Bar",
  "Laundry",
  "Front Desk",
  "Housekeeping",
  "Finance",
  "Administration",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const PAYMENT_COMPONENTS = [
  "Cash",
  "MTN Mobile Money",
  "Airtel Money",
  "Visa",
  "Mastercard",
] as const;
export type PaymentComponent = (typeof PAYMENT_COMPONENTS)[number];

export const PAYMENT_METHODS = [...PAYMENT_COMPONENTS, "Split Payment"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentAllocation = { method: PaymentComponent; amount: number };

export const REPORT_SECTIONS = ["occupancy", "revenue", "cashier", "maintenance"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const REPORT_PERIODS = ["daily", "weekly", "monthly", "custom"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export type ModuleId =
  | "dashboard"
  | "front-desk"
  | "food-beverage"
  | "housekeeping"
  | "finance"
  | "admin"
  | "reports"
  | "receipts";

export type SessionInfo = {
  staffId: string;
  staffName: string;
  email: string;
  role: Role;
  staffDbId: number;
};

export type RoomView = {
  number: number;
  category: RoomCategory;
  rate: number;
  status: RoomStatus;
  statusNote: string | null;
  statusUpdatedAt: string;
};

export type GuestView = {
  id: number;
  fullName: string;
  phone: string;
  nationality: string | null;
  createdAt: string;
};

export type BookingView = {
  id: number;
  guestId: number;
  guestName: string;
  guestPhone: string;
  roomNumber: number;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  status: BookingStatus;
  nightlyRate: number;
  notes: string | null;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  createdAt: string;
  createdBy: string;
  folioBalance: number;
  chargeCount: number;
};

export type ChargeView = {
  id: number;
  bookingId: number | null;
  roomNumber: number | null;
  guestName: string;
  department: Department;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  status: ChargeStatus;
  receiptId: number | null;
  createdBy: string;
  createdAt: string;
};

export type ReceiptView = {
  id: number;
  receiptNo: string;
  issuedAt: string;
  guestName: string;
  roomNumber: number | null;
  roomCategory: RoomCategory | null;
  department: Department;
  staffId: string;
  staffName: string;
  paymentMethod: PaymentMethod;
  paymentBreakdown: PaymentAllocation[];
  totalAmount: number;
  netAmount: number;
  vatAmount: number;
  vatBps: number;
  notes: string | null;
  voided: boolean;
  bookingId: number | null;
  itemCount: number;
};

export type ReceiptItemView = {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  department: Department;
};

export type ReceiptDetail = ReceiptView & {
  items: ReceiptItemView[];
  text: string;
  hotelName?: string;
  hotelLocation?: string;
  contactPhone?: string;
  contactEmail?: string;
};

export type StatusLogView = {
  id: number;
  roomNumber: number;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  note: string | null;
  staffId: string;
  createdAt: string;
};

export type AuditView = {
  id: number;
  action: string;
  module: string;
  details: string;
  staffId: string;
  createdAt: string;
};

export type SettingsView = {
  id: number;
  hotelName: string;
  location: string;
  contactPhone: string;
  contactEmail: string;
  standardRate: number;
  deluxeRate: number;
  suiteRate: number;
  vatBps: number;
  serviceChargeBps: number;
  updatedAt: string;
  updatedBy: string;
};

export type StaffView = {
  id: number;
  fullName: string;
  email: string;
  staffCode: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type StaffApplicationView = {
  id: number;
  fullName: string;
  email: string;
  staffCode: string;
  requestedRole: Role;
  reason: string | null;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type StatsView = {
  totalRooms: number;
  inHouse: number;
  reservations: number;
  readyRooms: number;
  dirtyRooms: number;
  outOfOrder: number;
  occupancyRate: number;
  arrivalsToday: number;
  departuresToday: number;
  collectedToday: number;
  openFolio: number;
  receiptsToday: number;
  today: string;
};

export type CrsState = {
  generatedAt: string;
  stats: StatsView;
  settings: SettingsView;
  staff: StaffView[];
  applications: StaffApplicationView[];
  rooms: RoomView[];
  guests: GuestView[];
  bookings: BookingView[];
  charges: ChargeView[];
  receipts: ReceiptView[];
  statusLogs: StatusLogView[];
  audits: AuditView[];
};

export type ReportData = {
  meta: {
    from: string;
    to: string;
    period: string;
    section: string;
    department: string;
    category: string;
    generatedAt: string;
    days: number;
  };
  occupancy: {
    availableRoomNights: number;
    occupiedRoomNights: number;
    occupancyRate: number;
    arrivals: number;
    departures: number;
    inHouse: number;
    activeReservations: number;
    cancelled: number;
    daily: { date: string; occupied: number; available: number; rate: number }[];
    byCategory: { category: RoomCategory; rooms: number; occupiedRoomNights: number; rate: number }[];
    bookings: {
      id: number;
      guestName: string;
      roomNumber: number;
      category: RoomCategory;
      checkIn: string;
      checkOut: string;
      status: BookingStatus;
      nights: number;
    }[];
  };
  revenue: {
    collected: number;
    posted: number;
    byDepartment: { department: Department; collected: number; posted: number; transactions: number }[];
    byDate: { date: string; amount: number }[];
    items: { date: string; department: Department; description: string; amount: number; receiptNo: string }[];
  };
  cashier: {
    total: number;
    count: number;
    byMethod: { method: PaymentMethod; count: number; total: number }[];
    byStaff: { staffId: string; count: number; total: number }[];
    byDepartment: { department: Department; count: number; total: number }[];
    receipts: ReceiptView[];
  };
  maintenance: {
    currentOutOfOrder: number;
    dirtyRooms: number;
    events: StatusLogView[];
    openEvents: number;
  };
  audit: {
    collected: number;
    receipts: number;
    posted: number;
    openFolio: number;
    outOfOrder: number;
    occupancyRate: number;
    flags: string[];
  };
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isPaymentComponent(value: unknown): value is PaymentComponent {
  return typeof value === "string" && (PAYMENT_COMPONENTS as readonly string[]).includes(value);
}

export function isRoomStatus(value: unknown): value is RoomStatus {
  return typeof value === "string" && (ROOM_STATUSES as readonly string[]).includes(value);
}

export function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && (DEPARTMENTS as readonly string[]).includes(value);
}

export function isReportSection(value: unknown): value is ReportSection {
  return typeof value === "string" && (REPORT_SECTIONS as readonly string[]).includes(value);
}

export function parseRoomNumber(value: unknown): number {
  const number = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isInteger(number) || number < HOTEL.firstRoom || number > HOTEL.lastRoom) {
    throw new Error(`Room number must be an integer from ${HOTEL.firstRoom} to ${HOTEL.lastRoom}.`);
  }
  return number;
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function assertDateKey(value: unknown, label = "Date"): string {
  if (!isDateKey(value)) throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  return value;
}

export function kampalaDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HOTEL.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function shiftDate(dateKey: string, days: number): string {
  assertDateKey(dateKey);
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function nightsBetween(from: string, to: string): number {
  assertDateKey(from, "Check-in");
  assertDateKey(to, "Check-out");
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (end <= start) throw new Error("Check-out date must be after check-in date.");
  return Math.round((end - start) / 86_400_000);
}

export function dateKeysBetween(from: string, to: string, maxDays = 92): string[] {
  assertDateKey(from, "Start date");
  assertDateKey(to, "End date");
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  if (days < 0) throw new Error("The report end date must be on or after the start date.");
  if (days >= maxDays) throw new Error(`Custom report ranges cannot exceed ${maxDays} days.`);
  return Array.from({ length: days + 1 }, (_, index) => shiftDate(from, index));
}

export function dateAt(dateKey: string, hour = 10, minute = 0): Date {
  assertDateKey(dateKey);
  const hh = String(Math.max(0, Math.min(23, hour))).padStart(2, "0");
  const mm = String(Math.max(0, Math.min(59, minute))).padStart(2, "0");
  return new Date(`${dateKey}T${hh}:${mm}:00+03:00`);
}

export function dateRangeForPeriod(
  period: string,
  from?: string | null,
  to?: string | null,
  today = kampalaDateKey(),
): { from: string; to: string; period: string } {
  if (period === "weekly") return { from: shiftDate(today, -6), to: today, period };
  if (period === "monthly") return { from: `${today.slice(0, 7)}-01`, to: today, period };
  if (period === "custom") {
    const start = assertDateKey(from, "Custom start date");
    const end = assertDateKey(to, "Custom end date");
    dateKeysBetween(start, end);
    return { from: start, to: end, period };
  }
  return { from: today, to: today, period: "daily" };
}

export function ugx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString("en-UG")}`;
}

export function compactUgx(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `UGX ${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000) return `UGX ${(amount / 1_000).toFixed(0)}K`;
  return `UGX ${Math.round(amount)}`;
}

export function dateTimeKampala(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HOTEL.timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(",", "");
}

export function shortDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HOTEL.timezone,
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(date);
}

export function makeReceiptNo(issuedAt: Date = new Date()): string {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 6) ?? Math.random().toString(36).slice(2, 8);
  return `BH-${kampalaDateKey(issuedAt).replace(/-/g, "")}-${random.toUpperCase()}`;
}

export function roomCategoryFor(number: number): RoomCategory {
  if (number >= 191) return "Suite";
  if (number >= 161) return "Deluxe";
  return "Standard";
}

export function roomRateFor(number: number): number {
  if (number >= 191) return 380_000;
  if (number >= 161) return 220_000;
  return 120_000;
}

export function bookingOverlaps(checkIn: string, checkOut: string, otherCheckIn: string, otherCheckOut: string): boolean {
  return checkIn < otherCheckOut && checkOut > otherCheckIn;
}

export function vatLabel(bps: number): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

export function isRoomAvailable(room: RoomView, bookings: BookingView[], checkIn: string, checkOut: string): boolean {
  if (room.status === "Under Maintenance") return false;
  return !bookings.some(
    (booking) =>
      booking.roomNumber === room.number &&
      (booking.status === "Reserved" || booking.status === "Checked In") &&
      bookingOverlaps(checkIn, checkOut, booking.checkIn, booking.checkOut),
  );
}

export function deriveRoomDisplayStatus(
  room: RoomView,
  bookings: BookingView[],
  today = kampalaDateKey(),
): RoomDisplayStatus {
  if (room.status === "Under Maintenance") return "Under Maintenance";
  const roomBookings = bookings.filter(
    (booking) =>
      booking.roomNumber === room.number &&
      booking.status !== "Cancelled" &&
      booking.status !== "Checked Out",
  );
  if (roomBookings.some((booking) => booking.status === "Checked In")) return "Occupied";
  if (roomBookings.some((booking) => bookingOverlaps(today, shiftDate(today, 1), booking.checkIn, booking.checkOut))) {
    return "Reserved";
  }
  if (room.status === "Dirty") return "Cleaning Needed";
  return "Available";
}

export function roomDisplayClass(status: RoomDisplayStatus): string {
  return status.toLowerCase().replace(/\s+/g, "-");
}

export function formatReceipt(receipt: Omit<ReceiptDetail, "text">): string {
  const width = 42;
  const separator = "-".repeat(width);
  const doubleSeparator = "=".repeat(width);
  const center = (value: string) => {
    const clean = value.length > width ? value.slice(0, width) : value;
    return clean.padStart(Math.floor((width + clean.length) / 2), " ").padEnd(width, " ");
  };
  const row = (left: string, right: string) => {
    const l = left.length > width - right.length - 1 ? left.slice(0, width - right.length - 1) : left;
    return `${l.padEnd(width - right.length, " ")}${right}`;
  };
  const net = receipt.netAmount ?? Math.round((receipt.totalAmount * 10_000) / (10_000 + receipt.vatBps));
  const vat = receipt.vatAmount ?? receipt.totalAmount - net;
  const vatPercent = vatLabel(receipt.vatBps ?? 1800);
  const breakdown = receipt.paymentBreakdown ?? [];
  const lines = [
    doubleSeparator,
    center((receipt.hotelName ?? HOTEL.name).toUpperCase()),
    center(receipt.hotelLocation ?? HOTEL.location),
    center(`${receipt.contactPhone ?? HOTEL.phone}  |  ${receipt.contactEmail ?? HOTEL.email}`.slice(0, width)),
    doubleSeparator,
    center("OFFICIAL PAYMENT RECEIPT"),
    separator,
    `Receipt ID : ${receipt.receiptNo}`,
    `Date/Time  : ${dateTimeKampala(receipt.issuedAt)} (EAT)`,
    `Guest      : ${receipt.guestName}`,
    `Room       : ${receipt.roomNumber ?? "WALK-IN / N/A"}${receipt.roomCategory ? ` (${receipt.roomCategory})` : ""}`,
    separator,
    row("ITEMISED CHARGES", "AMOUNT"),
    separator,
  ];
  for (const item of receipt.items) {
    lines.push(item.description.slice(0, width));
    lines.push(row(`  ${item.quantity} x ${Math.round(item.unitPrice).toLocaleString("en-UG")}  [${item.department}]`, Math.round(item.amount).toLocaleString("en-UG")));
  }
  lines.push(
    separator,
    row(`NET (EXCL. VAT ${vatPercent})`, Math.round(net).toLocaleString("en-UG")),
    row(`VAT ${vatPercent}`, Math.round(vat).toLocaleString("en-UG")),
    row("TOTAL AMOUNT PAID (UGX)", Math.round(receipt.totalAmount).toLocaleString("en-UG")),
    separator,
    `Payment Method   : ${receipt.paymentMethod}`,
  );
  if (breakdown.length > 1) {
    for (const allocation of breakdown) {
      lines.push(row(`  ${allocation.method}`, Math.round(allocation.amount).toLocaleString("en-UG")));
    }
  } else {
    lines.push(row(`  ${receipt.paymentMethod}`, Math.round(receipt.totalAmount).toLocaleString("en-UG")));
  }
  lines.push(
    `Issuing Dept.    : ${receipt.department}`,
    `Staff / Cashier  : ${receipt.staffName} (${receipt.staffId})`,
    `Status           : ${receipt.voided ? "VOIDED" : "PAID"}`,
    separator,
    center("Thank you for choosing Buloba Hotel"),
    center("Keep this receipt for VAT / audit"),
    doubleSeparator,
  );
  return lines.join("\n");
}
