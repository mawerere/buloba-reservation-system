"use client";

import Dexie, { type Table } from "dexie";
import type {
  ChargeView,
  CrsState,
  BookingView,
  RoomView,
  RoomStatus,
  BookingStatus,
  Department,
  ChargeStatus,
} from "@/lib/crs";

export type OfflineRoom = RoomView & { cachedAt: string };
export type OfflineFolio = BookingView & { charges: ChargeView[]; cachedAt: string };
export type OfflineAction = {
  id?: number;
  clientRef: string;
  url: string;
  method: "POST" | "PATCH";
  body: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "synced" | "failed";
  error?: string;
};
type MetaRecord = { key: string; value: unknown; updatedAt: string };

class BulobaOfflineDB extends Dexie {
  rooms!: Table<OfflineRoom, number>;
  folios!: Table<OfflineFolio, number>;
  outbox!: Table<OfflineAction, number>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super("BulobaHotelCRS");
    this.version(1).stores({
      rooms: "number, category, status, cachedAt",
      folios: "id, roomNumber, status, checkIn, checkOut, cachedAt",
      outbox: "++id, status, createdAt, clientRef",
      meta: "key, updatedAt",
    });
  }
}

let database: BulobaOfflineDB | null = null;
let syncing = false;

function getDb(): BulobaOfflineDB | null {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  if (!database) database = new BulobaOfflineDB();
  return database;
}

function emitSyncUpdate(pending: number, synced = 0, failed = 0) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bh:sync-update", { detail: { pending, synced, failed } }));
}

export async function cacheState(state: CrsState): Promise<void> {
  const db = getDb();
  if (!db) return;
  const cachedAt = new Date().toISOString();
  const rooms: OfflineRoom[] = state.rooms.map((room) => ({ ...room, cachedAt }));
  const folios: OfflineFolio[] = state.bookings
    .filter((booking) => booking.status !== "Cancelled")
    .map((booking) => ({
      ...booking,
      charges: state.charges.filter((charge) => charge.bookingId === booking.id),
      cachedAt,
    }));
  await db.transaction("rw", db.rooms, db.folios, db.meta, async () => {
    await db.rooms.clear();
    await db.folios.clear();
    await db.rooms.bulkPut(rooms);
    await db.folios.bulkPut(folios);
    await db.meta.put({ key: "state", value: state, updatedAt: cachedAt });
  });
}

export async function getCachedState(): Promise<CrsState | null> {
  const db = getDb();
  if (!db) return null;
  const record = await db.meta.get("state");
  return (record?.value as CrsState | undefined) ?? null;
}

export async function queueOfflineAction(action: Omit<OfflineAction, "id">): Promise<number> {
  const db = getDb();
  if (!db) throw new Error("IndexedDB is not available in this browser.");
  const id = await db.outbox.add(action);
  emitSyncUpdate(await getPendingCount());
  return id;
}

export async function getPendingCount(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  return db.outbox.where("status").equals("pending").count();
}

export async function getOutbox(limit = 12): Promise<OfflineAction[]> {
  const db = getDb();
  if (!db) return [];
  return db.outbox.orderBy("createdAt").reverse().limit(limit).toArray();
}

export async function syncOutbox(): Promise<{ synced: number; failed: number; pending: number }> {
  const db = getDb();
  if (!db || syncing || typeof navigator === "undefined" || !navigator.onLine) {
    return { synced: 0, failed: 0, pending: await getPendingCount() };
  }
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const pending = await db.outbox.where("status").equals("pending").sortBy("createdAt");
    for (const action of pending) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.body),
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error ?? `Sync failed (${response.status})`);
        if (action.id) await db.outbox.update(action.id, { status: "synced", error: undefined });
        synced += 1;
      } catch (error) {
        failed += 1;
        if (action.id) {
          await db.outbox.update(action.id, {
            status: "failed",
            error: error instanceof Error ? error.message : "Sync failed",
          });
        }
      }
    }
    if (synced > 0) {
      const stale = await db.outbox.where("status").equals("synced").toArray();
      await db.outbox.bulkDelete(stale.map((row) => row.id!).filter(Boolean));
    }
  } finally {
    syncing = false;
  }
  const pending = await getPendingCount();
  emitSyncUpdate(pending, synced, failed);
  return { synced, failed, pending };
}

export async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    await registration.sync?.register("buloba-outbox-sync");
  } catch {
    // Background Sync is optional; online/focus listeners still replay the outbox.
  }
}

export function applyOptimisticAction(state: CrsState, action: OfflineAction): CrsState {
  const body = action.body;
  const now = new Date().toISOString();
  const negativeId = -Date.now();
  if (action.method === "PATCH" && /^\/api\/rooms\/\d+$/.test(action.url)) {
    const number = Number(action.url.split("/").pop());
    const status = body.status as RoomStatus | undefined;
    const note = typeof body.note === "string" ? body.note : null;
    if (!status) return state;
    const previous = state.rooms.find((room) => room.number === number)?.status ?? "Clean";
    return {
      ...state,
      rooms: state.rooms.map((room) =>
        room.number === number
          ? { ...room, status, statusNote: note ?? room.statusNote, statusUpdatedAt: now }
          : room,
      ),
      statusLogs: [
        {
          id: negativeId,
          roomNumber: number,
          previousStatus: previous,
          newStatus: status,
          note,
          staffId: typeof body.staffId === "string" ? body.staffId : "OFFLINE",
          createdAt: now,
        },
        ...state.statusLogs,
      ],
    };
  }
  if (action.url === "/api/charges" && action.method === "POST") {
    const amount = Number(body.quantity ?? 1) * Number(body.unitPrice ?? 0);
    if (!amount) return state;
    const roomNumber = typeof body.roomNumber === "number" ? body.roomNumber : null;
    const booking = state.bookings.find(
      (item) => item.roomNumber === roomNumber && item.status === "Checked In",
    );
    const charge: ChargeView = {
      id: negativeId,
      bookingId: booking?.id ?? null,
      roomNumber,
      guestName: booking?.guestName ?? (typeof body.guestName === "string" ? body.guestName : "Offline guest"),
      department: (body.department as Department) ?? "Restaurant",
      description: String(body.description ?? "Offline charge"),
      quantity: Number(body.quantity ?? 1),
      unitPrice: Number(body.unitPrice ?? amount),
      amount,
      status: "Open" as ChargeStatus,
      receiptId: null,
      createdBy: typeof body.staffId === "string" ? body.staffId : "OFFLINE",
      createdAt: now,
    };
    return {
      ...state,
      charges: [charge, ...state.charges],
      bookings: state.bookings.map((item) =>
        item.id === booking?.id
          ? { ...item, folioBalance: item.folioBalance + amount, chargeCount: item.chargeCount + 1 }
          : item,
      ),
      stats: { ...state.stats, openFolio: state.stats.openFolio + amount },
    };
  }
  if (action.url === "/api/bookings" && action.method === "POST") {
    const roomNumber = Number(body.roomNumber ?? 0);
    const room = state.rooms.find((item) => item.number === roomNumber);
    const nights = Math.max(1, Math.round((Date.parse(String(body.checkOut)) - Date.parse(String(body.checkIn))) / 86_400_000) || 1);
    const amount = nights * (room?.rate ?? 120_000);
    const booking: BookingView = {
      id: negativeId,
      guestId: negativeId,
      guestName: String(body.guestName ?? "Offline guest"),
      guestPhone: String(body.guestPhone ?? "—"),
      roomNumber,
      checkIn: String(body.checkIn ?? state.stats.today),
      checkOut: String(body.checkOut ?? state.stats.today),
      guestsCount: Number(body.guestsCount ?? 1),
      status: "Reserved" as BookingStatus,
      nightlyRate: room?.rate ?? 120_000,
      notes: typeof body.notes === "string" ? body.notes : "Queued offline",
      actualCheckIn: null,
      actualCheckOut: null,
      createdAt: now,
      createdBy: typeof body.staffId === "string" ? body.staffId : "OFFLINE",
      folioBalance: amount,
      chargeCount: 1,
    };
    const charge: ChargeView = {
      id: negativeId - 1,
      bookingId: negativeId,
      roomNumber,
      guestName: booking.guestName,
      department: "Accommodation",
      description: `Offline accommodation · Room ${roomNumber}`,
      quantity: nights,
      unitPrice: room?.rate ?? 120_000,
      amount,
      status: "Open",
      receiptId: null,
      createdBy: booking.createdBy,
      createdAt: now,
    };
    return {
      ...state,
      bookings: [booking, ...state.bookings],
      charges: [charge, ...state.charges],
      stats: { ...state.stats, reservations: state.stats.reservations + 1, openFolio: state.stats.openFolio + amount },
    };
  }
  return state;
}
