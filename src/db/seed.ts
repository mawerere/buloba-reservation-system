import { db } from "@/db";
import {
  auditLogs,
  bookings,
  folioCharges,
  guests,
  receipts,
  roomStatusLogs,
  rooms,
  staff,
  staffApplications,
  hotelSettings,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import {
  createReceiptForCharges,
  type ChargeForReceipt,
  type TransactionClient,
} from "@/lib/receipts-server";
import { hashPassword } from "@/lib/password";
import {
  dateAt,
  HOTEL,
  kampalaDateKey,
  nightsBetween,
  roomCategoryFor,
  roomRateFor,
  shiftDate,
} from "@/lib/crs";

let seedPromise: Promise<void> | null = null;

async function seedCoreConfig(tx: TransactionClient): Promise<void> {
  await tx.insert(hotelSettings).values({
    id: 1,
    hotelName: HOTEL.name,
    location: HOTEL.location,
    contactPhone: HOTEL.phone,
    contactEmail: HOTEL.email,
    standardRate: 120_000,
    deluxeRate: 220_000,
    suiteRate: 380_000,
    vatBps: 1800,
    serviceChargeBps: 0,
    updatedBy: "SYS-001",
  }).onConflictDoUpdate({
    target: hotelSettings.id,
    set: {
      hotelName: HOTEL.name,
      location: HOTEL.location,
      contactPhone: HOTEL.phone,
      contactEmail: HOTEL.email,
      standardRate: 120_000,
      deluxeRate: 220_000,
      suiteRate: 380_000,
      vatBps: 1800,
      serviceChargeBps: 0,
      updatedAt: new Date(),
      updatedBy: "SYS-001",
    },
  });

  if (process.env.NODE_ENV === "production") {
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (Boolean(adminEmail) !== Boolean(adminPassword)) {
      throw new Error("Set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD");
    }
    if (adminEmail && adminPassword) {
      const adminName = process.env.INITIAL_ADMIN_NAME?.trim() || "Hotel Administrator";
      if (!adminEmail.includes("@") || adminEmail.length > 160 || adminPassword.length < 12 || adminName.length > 160) {
        throw new Error("Initial administrator details are invalid; use a valid email and a password of at least 12 characters");
      }
      await tx.insert(staff).values({
        fullName: adminName,
        email: adminEmail,
        staffCode: "ADM-001",
        role: "Admin/Manager",
        passwordHash: hashPassword(adminPassword),
      }).onConflictDoUpdate({
        target: staff.email,
        set: {
          fullName: adminName,
          staffCode: "ADM-001",
          role: "Admin/Manager",
          passwordHash: hashPassword(adminPassword),
          active: true,
        },
      });
    }
    return;
  }

  const passwordHash = hashPassword("Buloba@2026");
  await tx.insert(staff).values([
    { fullName: "Grace Mukisa", email: "admin@bulobahotel.ug", staffCode: "ADM-001", role: "Admin/Manager", passwordHash },
    { fullName: "Peter Ssali", email: "reception@bulobahotel.ug", staffCode: "FD-014", role: "Reception", passwordHash },
    { fullName: "Aisha Nanyonjo", email: "restaurant@bulobahotel.ug", staffCode: "FB-027", role: "Restaurant", passwordHash },
    { fullName: "Daniel Okello", email: "bar@bulobahotel.ug", staffCode: "BAR-018", role: "Bar", passwordHash },
    { fullName: "Joan Nabirye", email: "laundry@bulobahotel.ug", staffCode: "LND-006", role: "Laundry", passwordHash },
    { fullName: "Mary Namukisa", email: "housekeeping@bulobahotel.ug", staffCode: "HK-009", role: "Housekeeping", passwordHash },
    { fullName: "Moses Kintu", email: "finance@bulobahotel.ug", staffCode: "FN-003", role: "Finance", passwordHash },
  ]).onConflictDoUpdate({
    target: staff.email,
    set: {
      fullName: sql`excluded.full_name`,
      staffCode: sql`excluded.staff_code`,
      role: sql`excluded.role`,
      passwordHash: sql`excluded.password_hash`,
      active: true,
      lastLoginAt: null,
    },
  });

  await tx.insert(staffApplications).values({
    fullName: "Rebecca Nalwoga",
    email: "recruit.demo@bulobahotel.ug",
    staffCode: "NEW-101",
    requestedRole: "Reception",
    reason: "Recruited for the evening reception desk; awaiting manager approval.",
    passwordHash,
    status: "Pending",
  }).onConflictDoUpdate({
    target: staffApplications.email,
    set: {
      fullName: "Rebecca Nalwoga",
      staffCode: "NEW-101",
      requestedRole: "Reception",
      reason: "Recruited for the evening reception desk; awaiting manager approval.",
      passwordHash,
      status: "Pending",
      reviewedAt: null,
      reviewedBy: null,
    },
  });
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = performSeed().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  await seedPromise;
}

async function performSeed(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(918273)`);
    // Always backfill authentication and settings for pre-existing databases.
    await seedCoreConfig(tx);
    const existing = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(rooms);
    if ((existing[0]?.count ?? 0) >= 100) return;

    const isProduction = process.env.NODE_ENV === "production";
    const today = kampalaDateKey();
    const roomStatuses: Record<number, { status: string; note: string; day: number }> = {
      112: { status: "Dirty", note: "In-house: daily housekeeping due", day: 0 },
      118: { status: "Clean", note: "Serviced this morning", day: 0 },
      144: { status: "Under Maintenance", note: "AC compressor replacement", day: -2 },
      162: { status: "Clean", note: "Ready / occupied", day: 0 },
      176: { status: "Under Maintenance", note: "Bathroom plumbing leak", day: -1 },
      199: { status: "Dirty", note: "Suite linen change pending", day: 0 },
    };

    await tx.insert(rooms).values(
      Array.from({ length: 100 }, (_, index) => {
        const number = 101 + index;
        const override = isProduction ? undefined : roomStatuses[number];
        return {
          number,
          category: roomCategoryFor(number),
          rate: roomRateFor(number),
          status: override?.status ?? "Clean",
          statusNote: override?.note ?? null,
          statusUpdatedAt: override
            ? dateAt(shiftDate(today, override.day), 9, 30)
            : isProduction ? new Date() : dateAt(shiftDate(today, -3), 8, 0),
        };
      }),
    ).onConflictDoNothing();

    if (isProduction) return;

    const guestRows = await tx
      .insert(guests)
      .values([
        {
          fullName: "Sarah Namukisa",
          phone: "+256 772 100 241",
          nationality: "Ugandan",
          idNumber: "NIN-UG-1948A",
          createdAt: dateAt(shiftDate(today, -12), 9, 15),
        },
        {
          fullName: "Daniel Okello",
          phone: "+256 701 882 316",
          nationality: "Ugandan",
          idNumber: "NIN-UG-7712B",
          createdAt: dateAt(shiftDate(today, -9), 11, 40),
        },
        {
          fullName: "Aisha Nanyonjo",
          phone: "+256 755 204 908",
          nationality: "Ugandan",
          idNumber: "NIN-UG-3390C",
          createdAt: dateAt(shiftDate(today, -6), 13, 5),
        },
        {
          fullName: "Peter Ssemwogerere",
          phone: "+256 782 440 117",
          nationality: "Ugandan",
          idNumber: "NIN-UG-5571D",
          createdAt: dateAt(shiftDate(today, -3), 10, 25),
        },
        {
          fullName: "Grace Atieno",
          phone: "+254 722 660 190",
          nationality: "Kenyan",
          idNumber: "PASS-KA-90221",
          createdAt: dateAt(shiftDate(today, -2), 16, 15),
        },
        {
          fullName: "Moses Kintu",
          phone: "+256 774 319 502",
          nationality: "Ugandan",
          idNumber: "NIN-UG-1120E",
          createdAt: dateAt(shiftDate(today, -14), 9, 0),
        },
        {
          fullName: "Joan Nabirye",
          phone: "+256 705 913 774",
          nationality: "Ugandan",
          idNumber: "NIN-UG-4402F",
          createdAt: dateAt(shiftDate(today, -18), 12, 0),
        },
      ])
      .returning();

    const guestId = (name: string) => guestRows.find((guest) => guest.fullName === name)!.id;

    type BookingSpec = {
      key: string;
      guest: string;
      room: number;
      checkIn: string;
      checkOut: string;
      status: string;
      guestsCount: number;
      note?: string;
      createdBy: string;
    };

    const bookingSpecs: BookingSpec[] = [
      {
        key: "sarah",
        guest: "Sarah Namukisa",
        room: 112,
        checkIn: shiftDate(today, -1),
        checkOut: shiftDate(today, 2),
        status: "Checked In",
        guestsCount: 2,
        note: "Airport pickup requested",
        createdBy: "FD-014",
      },
      {
        key: "daniel",
        guest: "Daniel Okello",
        room: 118,
        checkIn: shiftDate(today, -2),
        checkOut: shiftDate(today, 1),
        status: "Checked In",
        guestsCount: 1,
        note: "Quiet room preference",
        createdBy: "FD-014",
      },
      {
        key: "aisha",
        guest: "Aisha Nanyonjo",
        room: 162,
        checkIn: today,
        checkOut: shiftDate(today, 3),
        status: "Checked In",
        guestsCount: 2,
        note: "Anniversary package",
        createdBy: "FD-014",
      },
      {
        key: "peter",
        guest: "Peter Ssemwogerere",
        room: 105,
        checkIn: shiftDate(today, 1),
        checkOut: shiftDate(today, 4),
        status: "Reserved",
        guestsCount: 1,
        createdBy: "FD-014",
      },
      {
        key: "grace",
        guest: "Grace Atieno",
        room: 195,
        checkIn: shiftDate(today, 2),
        checkOut: shiftDate(today, 5),
        status: "Reserved",
        guestsCount: 2,
        note: "Late arrival",
        createdBy: "FD-014",
      },
      {
        key: "moses",
        guest: "Moses Kintu",
        room: 130,
        checkIn: shiftDate(today, -4),
        checkOut: shiftDate(today, -1),
        status: "Checked Out",
        guestsCount: 2,
        createdBy: "FD-014",
      },
      {
        key: "joan",
        guest: "Joan Nabirye",
        room: 136,
        checkIn: shiftDate(today, -8),
        checkOut: shiftDate(today, -5),
        status: "Checked Out",
        guestsCount: 1,
        createdBy: "FD-014",
      },
    ];

    const bookingMap = new Map<string, typeof bookings.$inferSelect>();
    const accommodationCharges = new Map<string, ChargeForReceipt>();

    for (const spec of bookingSpecs) {
      const nights = nightsBetween(spec.checkIn, spec.checkOut);
      const rate = roomRateFor(spec.room);
      const [booking] = await tx
        .insert(bookings)
        .values({
          guestId: guestId(spec.guest),
          roomNumber: spec.room,
          checkIn: spec.checkIn,
          checkOut: spec.checkOut,
          guestsCount: spec.guestsCount,
          status: spec.status,
          nightlyRate: rate,
          notes: spec.note ?? null,
          actualCheckIn:
            spec.status === "Reserved"
              ? null
              : dateAt(spec.checkIn, 14, 20),
          actualCheckOut:
            spec.status === "Checked Out"
              ? dateAt(spec.checkOut, 10, 35)
              : null,
          createdAt: dateAt(shiftDate(spec.checkIn, -4), 10, 0),
          createdBy: spec.createdBy,
        })
        .returning();
      bookingMap.set(spec.key, booking);

      const [charge] = await tx
        .insert(folioCharges)
        .values({
          bookingId: booking.id,
          roomNumber: spec.room,
          guestName: spec.guest,
          department: "Accommodation",
          description: `Room ${spec.room} — ${nights} night(s), ${spec.checkIn} to ${spec.checkOut}`,
          quantity: nights,
          unitPrice: rate,
          amount: nights * rate,
          status: "Open",
          createdBy: "FD-014",
          createdAt: dateAt(shiftDate(spec.checkIn, -4), 10, 2),
        })
        .returning();
      accommodationCharges.set(spec.key, {
        id: charge.id,
        description: charge.description,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
        amount: charge.amount,
        department: charge.department,
      });
    }

    const chargesByBooking = new Map<string, ChargeForReceipt[]>();
    const addCharge = async (
      key: string,
      values: typeof folioCharges.$inferInsert,
    ): Promise<ChargeForReceipt> => {
      const [charge] = await tx.insert(folioCharges).values(values).returning();
      const mapped: ChargeForReceipt = {
        id: charge.id,
        description: charge.description,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
        amount: charge.amount,
        department: charge.department,
      };
      chargesByBooking.set(key, [...(chargesByBooking.get(key) ?? []), mapped]);
      return mapped;
    };

    await addCharge("sarah", {
      bookingId: bookingMap.get("sarah")!.id,
      roomNumber: 112,
      guestName: "Sarah Namukisa",
      department: "Restaurant",
      description: "Grilled tilapia plate",
      quantity: 2,
      unitPrice: 45_000,
      amount: 90_000,
      status: "Open",
      createdBy: "FB-027",
      createdAt: dateAt(shiftDate(today, -1), 19, 42),
    });
    await addCharge("sarah", {
      bookingId: bookingMap.get("sarah")!.id,
      roomNumber: 112,
      guestName: "Sarah Namukisa",
      department: "Bar",
      description: "House wine (glass)",
      quantity: 2,
      unitPrice: 18_000,
      amount: 36_000,
      status: "Open",
      createdBy: "FB-027",
      createdAt: dateAt(today, 20, 10),
    });
    await addCharge("daniel", {
      bookingId: bookingMap.get("daniel")!.id,
      roomNumber: 118,
      guestName: "Daniel Okello",
      department: "Laundry",
      description: "Express shirt service",
      quantity: 3,
      unitPrice: 7_000,
      amount: 21_000,
      status: "Open",
      createdBy: "HK-009",
      createdAt: dateAt(shiftDate(today, -1), 9, 15),
    });
    await addCharge("aisha", {
      bookingId: bookingMap.get("aisha")!.id,
      roomNumber: 162,
      guestName: "Aisha Nanyonjo",
      department: "Restaurant",
      description: "Breakfast buffet",
      quantity: 2,
      unitPrice: 30_000,
      amount: 60_000,
      status: "Open",
      createdBy: "FB-027",
      createdAt: dateAt(today, 8, 20),
    });

    const mosesRestaurant = await addCharge("moses", {
      bookingId: bookingMap.get("moses")!.id,
      roomNumber: 130,
      guestName: "Moses Kintu",
      department: "Restaurant",
      description: "Chicken luombo with matooke",
      quantity: 2,
      unitPrice: 38_000,
      amount: 76_000,
      status: "Open",
      createdBy: "FB-027",
      createdAt: dateAt(shiftDate(today, -3), 20, 5),
    });
    const mosesLaundry = await addCharge("moses", {
      bookingId: bookingMap.get("moses")!.id,
      roomNumber: 130,
      guestName: "Moses Kintu",
      department: "Laundry",
      description: "Bedding set",
      quantity: 1,
      unitPrice: 20_000,
      amount: 20_000,
      status: "Open",
      createdBy: "HK-009",
      createdAt: dateAt(shiftDate(today, -2), 11, 30),
    });

    const walkin = await addCharge("walkin", {
      bookingId: null,
      roomNumber: null,
      guestName: "Walk-in Guest",
      department: "Restaurant",
      description: "Walk-in lunch — beef steak",
      quantity: 2,
      unitPrice: 52_000,
      amount: 104_000,
      status: "Open",
      createdBy: "FB-027",
      createdAt: dateAt(today, 13, 15),
    });

    await createReceiptForCharges(tx, {
      charges: [
        accommodationCharges.get("moses")!,
        mosesRestaurant,
        mosesLaundry,
      ],
      guestName: "Moses Kintu",
      roomNumber: 130,
      roomCategory: roomCategoryFor(130),
      department: "Front Desk",
      staffId: "FD-014",
      staffName: "Peter Ssali",
      paymentMethod: "MTN Mobile Money",
      bookingId: bookingMap.get("moses")!.id,
      notes: "Folio settled at departure",
      issuedAt: dateAt(shiftDate(today, -1), 10, 32),
    });

    await createReceiptForCharges(tx, {
      charges: [accommodationCharges.get("joan")!],
      guestName: "Joan Nabirye",
      roomNumber: 136,
      roomCategory: roomCategoryFor(136),
      department: "Front Desk",
      staffId: "FD-014",
      staffName: "Peter Ssali",
      paymentMethod: "Visa",
      bookingId: bookingMap.get("joan")!.id,
      notes: "Corporate accommodation",
      issuedAt: dateAt(shiftDate(today, -5), 9, 10),
    });

    await createReceiptForCharges(tx, {
      charges: [walkin],
      guestName: "Walk-in Guest",
      roomNumber: null,
      roomCategory: null,
      department: "Restaurant",
      staffId: "FB-027",
      staffName: "Aisha Nanyonjo",
      paymentMethod: "Cash",
      notes: "Direct restaurant payment (no room folio)",
      issuedAt: dateAt(today, 13, 16),
    });

    // Cancelled reservation with a voided folio is not part of the seed, but
    // all open folio charges remain deliberately visible for the live demo.
    await tx.insert(roomStatusLogs).values([
      {
        roomNumber: 144,
        previousStatus: "Dirty",
        newStatus: "Under Maintenance",
        note: "AC compressor replacement; parts ordered",
        staffId: "HK-009",
        createdAt: dateAt(shiftDate(today, -2), 9, 30),
      },
      {
        roomNumber: 176,
        previousStatus: "Clean",
        newStatus: "Under Maintenance",
        note: "Bathroom plumbing leak; isolate water line",
        staffId: "HK-009",
        createdAt: dateAt(shiftDate(today, -1), 15, 10),
      },
      {
        roomNumber: 112,
        previousStatus: "Clean",
        newStatus: "Dirty",
        note: "In-house guest, daily service due",
        staffId: "HK-009",
        createdAt: dateAt(today, 8, 30),
      },
      {
        roomNumber: 199,
        previousStatus: "Clean",
        newStatus: "Dirty",
        note: "Suite linen change pending",
        staffId: "HK-009",
        createdAt: dateAt(today, 7, 45),
      },
      {
        roomNumber: 105,
        previousStatus: "Dirty",
        newStatus: "Clean",
        note: "Deep clean complete; ready for arrival",
        staffId: "HK-009",
        createdAt: dateAt(today, 10, 0),
      },
      {
        roomNumber: 162,
        previousStatus: "Dirty",
        newStatus: "Clean",
        note: "Deluxe turndown complete",
        staffId: "HK-009",
        createdAt: dateAt(today, 10, 30),
      },
    ]);

    await tx.insert(auditLogs).values([
      {
        action: "SYSTEM INITIALISED",
        module: "System",
        details: "100-room inventory loaded; CRS modules online",
        staffId: "SYS-001",
        createdAt: dateAt(shiftDate(today, -14), 7, 0),
      },
      {
        action: "MAINTENANCE OPENED",
        module: "Housekeeping",
        details: "Room 144 marked Under Maintenance",
        staffId: "HK-009",
        createdAt: dateAt(shiftDate(today, -2), 9, 30),
      },
      {
        action: "CHECK-IN",
        module: "Front Desk",
        details: "Sarah Namukisa checked into room 112",
        staffId: "FD-014",
        createdAt: dateAt(shiftDate(today, -1), 14, 20),
      },
      {
        action: "CHECKOUT & PAYMENT",
        module: "Front Desk",
        details: "Moses Kintu folio settled by MTN Mobile Money",
        staffId: "FD-014",
        createdAt: dateAt(shiftDate(today, -1), 10, 32),
      },
      {
        action: "CHARGE POSTED",
        module: "Restaurant",
        details: "Breakfast buffet posted to room 162",
        staffId: "FB-027",
        createdAt: dateAt(today, 8, 20),
      },
      {
        action: "WALK-IN PAYMENT",
        module: "Restaurant",
        details: "Walk-in lunch paid in cash",
        staffId: "FB-027",
        createdAt: dateAt(today, 13, 16),
      },
    ]);

    // A light query verifies the seeded receipts are present before commit.
    const receiptCount = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(receipts);
    if ((receiptCount[0]?.count ?? 0) < 3) {
      throw new Error("Seed failed to create sample receipts.");
    }
  });
}
