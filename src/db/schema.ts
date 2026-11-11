import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const rooms = pgTable(
  "rooms",
  {
    number: integer("number").primaryKey(),
    category: varchar("category", { length: 24 }).notNull(),
    rate: integer("rate").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("Clean"),
    statusNote: text("status_note"),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("rooms_number_range", sql`${table.number} between 101 and 200`),
    check("rooms_rate_positive", sql`${table.rate} > 0`),
    index("rooms_status_idx").on(table.status),
  ],
);

export const staff = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 160 }).notNull().unique(),
    staffCode: varchar("staff_code", { length: 32 }).notNull().unique(),
    role: varchar("role", { length: 40 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [index("staff_role_idx").on(table.role)],
);

export const hotelSettings = pgTable("hotel_settings", {
  id: integer("id").primaryKey().default(1),
  hotelName: varchar("hotel_name", { length: 120 }).notNull(),
  location: varchar("location", { length: 160 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 60 }).notNull(),
  contactEmail: varchar("contact_email", { length: 160 }).notNull(),
  standardRate: integer("standard_rate").notNull(),
  deluxeRate: integer("deluxe_rate").notNull(),
  suiteRate: integer("suite_rate").notNull(),
  vatBps: integer("vat_bps").notNull().default(1800),
  serviceChargeBps: integer("service_charge_bps").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: varchar("updated_by", { length: 32 }).notNull(),
});

export const guests = pgTable(
  "guests",
  {
    id: serial("id").primaryKey(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull().unique(),
    nationality: varchar("nationality", { length: 80 }),
    idNumber: varchar("id_number", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("guests_name_idx").on(table.fullName)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    guestId: integer("guest_id").notNull().references(() => guests.id),
    roomNumber: integer("room_number").notNull().references(() => rooms.number),
    checkIn: date("check_in", { mode: "string" }).notNull(),
    checkOut: date("check_out", { mode: "string" }).notNull(),
    guestsCount: integer("guests_count").notNull().default(1),
    status: varchar("status", { length: 24 }).notNull().default("Reserved"),
    nightlyRate: integer("nightly_rate").notNull(),
    notes: text("notes"),
    actualCheckIn: timestamp("actual_check_in", { withTimezone: true }),
    actualCheckOut: timestamp("actual_check_out", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 32 }).notNull(),
  },
  (table) => [
    check("bookings_dates_valid", sql`${table.checkOut} > ${table.checkIn}`),
    check("bookings_guests_positive", sql`${table.guestsCount} > 0`),
    index("bookings_room_dates_idx").on(table.roomNumber, table.checkIn, table.checkOut),
    index("bookings_status_idx").on(table.status),
  ],
);

export const folioCharges = pgTable(
  "folio_charges",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id").references(() => bookings.id),
    roomNumber: integer("room_number").references(() => rooms.number),
    guestName: varchar("guest_name", { length: 160 }).notNull(),
    department: varchar("department", { length: 32 }).notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull(),
    amount: integer("amount").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("Open"),
    receiptId: integer("receipt_id"),
    createdBy: varchar("created_by", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("folio_charges_amount_positive", sql`${table.amount} > 0`),
    check("folio_charges_quantity_positive", sql`${table.quantity} > 0`),
    index("folio_charges_booking_idx").on(table.bookingId),
    index("folio_charges_status_idx").on(table.status),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: serial("id").primaryKey(),
    receiptNo: varchar("receipt_no", { length: 40 }).notNull().unique(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    guestName: varchar("guest_name", { length: 160 }).notNull(),
    roomNumber: integer("room_number"),
    roomCategory: varchar("room_category", { length: 24 }),
    department: varchar("department", { length: 32 }).notNull(),
    staffId: varchar("staff_id", { length: 32 }).notNull(),
    staffName: varchar("staff_name", { length: 160 }).notNull().default("Staff"),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull(),
    paymentBreakdown: text("payment_breakdown").notNull().default("[]"),
    totalAmount: integer("total_amount").notNull(),
    netAmount: integer("net_amount").notNull().default(0),
    vatAmount: integer("vat_amount").notNull().default(0),
    vatBps: integer("vat_bps").notNull().default(1800),
    notes: text("notes"),
    voided: boolean("voided").notNull().default(false),
    bookingId: integer("booking_id").references(() => bookings.id),
  },
  (table) => [
    check("receipts_total_positive", sql`${table.totalAmount} > 0`),
    check("receipts_vat_valid", sql`${table.vatBps} between 0 and 10000`),
    index("receipts_issued_idx").on(table.issuedAt),
  ],
);

export const receiptItems = pgTable(
  "receipt_items",
  {
    id: serial("id").primaryKey(),
    receiptId: integer("receipt_id").notNull().references(() => receipts.id, { onDelete: "cascade" }),
    chargeId: integer("charge_id"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    amount: integer("amount").notNull(),
    department: varchar("department", { length: 32 }).notNull(),
  },
  (table) => [index("receipt_items_receipt_idx").on(table.receiptId)],
);

export const roomStatusLogs = pgTable(
  "room_status_logs",
  {
    id: serial("id").primaryKey(),
    roomNumber: integer("room_number").notNull().references(() => rooms.number),
    previousStatus: varchar("previous_status", { length: 32 }).notNull(),
    newStatus: varchar("new_status", { length: 32 }).notNull(),
    note: text("note"),
    staffId: varchar("staff_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("room_status_logs_created_idx").on(table.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    action: varchar("action", { length: 80 }).notNull(),
    module: varchar("module", { length: 48 }).notNull(),
    details: text("details").notNull(),
    staffId: varchar("staff_id", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)],
);

export const staffApplications = pgTable(
  "staff_applications",
  {
    id: serial("id").primaryKey(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 160 }).notNull().unique(),
    staffCode: varchar("staff_code", { length: 32 }).notNull().unique(),
    requestedRole: varchar("requested_role", { length: 40 }).notNull(),
    reason: text("reason"),
    passwordHash: text("password_hash").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("Pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: varchar("reviewed_by", { length: 32 }),
  },
  (table) => [
    index("staff_applications_status_idx").on(table.status),
    index("staff_applications_created_idx").on(table.createdAt),
  ],
);
