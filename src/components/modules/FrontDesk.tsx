"use client";

import { useMemo, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  FileText,
  LogIn,
  LogOut,
  Plus,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";
import { Button, Card, EmptyState, Field, StatusBadge } from "@/components/ui";
import type { ModuleProps } from "@/components/types";
import {
  isRoomAvailable,
  PAYMENT_COMPONENTS,
  ROOM_CATEGORIES,
  shiftDate,
  ugx,
  type PaymentAllocation,
  type PaymentComponent,
} from "@/lib/crs";

type Tab = "availability" | "reservations" | "folios";

export default function FrontDesk(props: ModuleProps) {
  const { state, busy, run, intent } = props;
  const today = state.stats.today;
  const initialIntentBooking = intent?.kind === "folio"
    ? state.bookings.find((item) => item.roomNumber === intent.roomNumber && (item.status === "Checked In" || item.status === "Reserved"))
    : undefined;
  const [tab, setTab] = useState<Tab>(intent?.kind === "folio" ? "folios" : "availability");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(shiftDate(today, 1));
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState<PaymentComponent>("Cash");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitMethod, setSplitMethod] = useState<PaymentComponent>("MTN Mobile Money");
  const [splitFirstAmount, setSplitFirstAmount] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(intent?.roomNumber ?? 105);
  const [folioBookingId, setFolioBookingId] = useState<number | null>(initialIntentBooking?.id ?? null);
  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    nationality: "Ugandan",
    idNumber: "",
    roomNumber: intent?.roomNumber ?? 105,
    checkIn: today,
    checkOut: shiftDate(today, 1),
    guestsCount: 1,
    notes: "",
  });

  const updateForm = (key: keyof typeof form, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));

  const dateRangeValid = from < to;
  const availableRooms = useMemo(
    () =>
      dateRangeValid
        ? state.rooms.filter(
            (room) =>
              (category === "All" || room.category === category) &&
              isRoomAvailable(room, state.bookings, from, to),
          )
        : [],
    [state.rooms, state.bookings, from, to, category, dateRangeValid],
  );
  const activeBookings = useMemo(
    () =>
      state.bookings
        .filter((booking) => booking.status === "Reserved" || booking.status === "Checked In")
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    [state.bookings],
  );
  const folioBookings = useMemo(
    () =>
      state.bookings
        .filter((booking) => booking.status !== "Cancelled")
        .sort((a, b) => b.id - a.id),
    [state.bookings],
  );
  const selectedFolio =
    folioBookings.find((booking) => booking.id === folioBookingId) ?? folioBookings[0] ?? null;
  const folioCharges = selectedFolio
    ? state.charges.filter((charge) => charge.bookingId === selectedFolio.id)
    : [];
  const selectedRoomInfo = state.rooms.find((room) => room.number === form.roomNumber);
  const inHouseRoomNumbers = new Set(
    state.bookings.filter((booking) => booking.status === "Checked In").map((booking) => booking.roomNumber),
  );

  const createBooking = async () => {
    const result = await run({
      url: "/api/bookings",
      body: { ...form },
      openReceipt: false,
    });
    if (result) {
      setForm((current) => ({
        ...current,
        guestName: "",
        guestPhone: "",
        idNumber: "",
        notes: "",
        guestsCount: 1,
      }));
      setTab("reservations");
    }
  };

  const paymentAllocations = (total: number): PaymentAllocation[] => {
    if (!splitEnabled || total <= 0) return [{ method: paymentMethod, amount: total }];
    const first = Math.max(0, Math.min(total, Math.round(splitFirstAmount)));
    if (first <= 0 || first >= total) return [{ method: paymentMethod, amount: total }];
    return [{ method: paymentMethod, amount: first }, { method: splitMethod, amount: total - first }];
  };

  const bookingAction = (id: number, action: "check-in" | "check-out" | "cancel", balance = 0) =>
    run({
      url: `/api/bookings/${id}`,
      method: "PATCH",
      body: { action, paymentMethod, payments: action === "check-out" ? paymentAllocations(balance) : undefined },
    });

  const settleFolio = (bookingId: number, balance: number) =>
    run({ url: "/api/payments", body: { bookingId, paymentMethod, payments: paymentAllocations(balance) } });

  const paymentControls = (total: number) => (
    <div className="crs-note" style={{ marginBottom: 14 }}>
      <div className="crs-inline" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <strong>Payment setup · total {ugx(total)}</strong>
        <div className="crs-toggle">
          <button className={!splitEnabled ? "active" : ""} onClick={() => setSplitEnabled(false)}>Single</button>
          <button className={splitEnabled ? "active" : ""} onClick={() => setSplitEnabled(true)}>Split payment</button>
        </div>
      </div>
      <div className="crs-form-grid four">
        <Field label="Primary method"><select className="crs-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentComponent)}>{PAYMENT_COMPONENTS.map((method) => <option key={method}>{method}</option>)}</select></Field>
        {splitEnabled && <Field label="Secondary method"><select className="crs-select" value={splitMethod} onChange={(e) => setSplitMethod(e.target.value as PaymentComponent)}>{PAYMENT_COMPONENTS.filter((method) => method !== paymentMethod).map((method) => <option key={method}>{method}</option>)}</select></Field>}
        {splitEnabled && <Field label="Primary amount (UGX)"><input className="crs-input crs-mono" type="number" min={0} max={total} value={splitFirstAmount} onChange={(e) => setSplitFirstAmount(Number(e.target.value))} /></Field>}
        {splitEnabled && <div><div className="crs-label">Secondary amount</div><div className="crs-note"><strong>{ugx(Math.max(0, total - Math.min(total, Math.round(splitFirstAmount))))}</strong></div></div>}
      </div>
    </div>
  );

  return (
    <div className="crs-section-grid">
      <div className="crs-page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="crs-eyebrow">Departmental module · Reception</div>
          <h1 className="crs-h1">Front Desk Operations</h1>
          <p className="crs-subtle">Availability, reservations, arrivals, departures and guest stay billing.</p>
        </div>
        <div className="crs-inline">
          <span className="crs-chip chip-clean"><CheckCircle2 size={12} /> 100-room inventory</span>
          <span className="crs-chip chip-inhouse">{state.stats.inHouse} in-house</span>
        </div>
      </div>

      <div className="crs-card">
        <div className="crs-tabs no-print">
          {([
            ["availability", "Availability & New Booking", Search],
            ["reservations", "Reservations & Check-in", BedDouble],
            ["folios", "Guest Folios & Billing", Receipt],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              className={`crs-tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {tab === "availability" && (
          <div className="crs-card-body">
            <div className="crs-two-col">
              <Card
                title="Room availability check"
                description="Date ranges use check-out exclusive nights."
                icon={<CalendarDays size={15} />}
                className="crs-card"
              >
                <div className="crs-form-grid three">
                  <Field label="Check-in">
                    <input className="crs-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </Field>
                  <Field label="Check-out">
                    <input className="crs-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </Field>
                  <Field label="Category">
                    <select className="crs-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option>All</option>
                      {ROOM_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                </div>
                {!dateRangeValid && <div className="crs-note danger" style={{ marginTop: 12 }}>Check-out must be after check-in.</div>}
                <div className="crs-divider" />
                <div className="crs-inline" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                  <strong className="crs-mono">{availableRooms.length} rooms available</strong>
                  <span className="crs-subtle">Click a room to prefill the booking form</span>
                </div>
                <div className="crs-room-grid">
                  {availableRooms.slice(0, 60).map((room) => (
                    <button
                      key={room.number}
                      className={`crs-room-tile ${room.status.toLowerCase().replace(" ", "-")} ${selectedRoom === room.number ? "selected" : ""}`}
                      title={`${room.category} · ${room.status} · ${ugx(room.rate)}/night`}
                      onClick={() => {
                        setSelectedRoom(room.number);
                        updateForm("roomNumber", room.number);
                      }}
                    >
                      {room.number}
                    </button>
                  ))}
                </div>
                {availableRooms.length > 60 && (
                  <div className="crs-field-hint" style={{ marginTop: 8 }}>
                    Showing first 60 of {availableRooms.length}. Use the room number field to select any room.
                  </div>
                )}
                {!availableRooms.length && dateRangeValid && (
                  <EmptyState>No rooms match this date range and category.</EmptyState>
                )}
              </Card>

              <Card title="Create reservation" description="Overlapping stays are blocked server-side." icon={<Plus size={15} />}>
                <div className="crs-form-grid">
                  <Field label="Guest full name">
                    <input className="crs-input" value={form.guestName} placeholder="e.g. Sarah Namukisa" onChange={(e) => updateForm("guestName", e.target.value)} />
                  </Field>
                  <Field label="Phone / Mobile Money">
                    <input className="crs-input" value={form.guestPhone} placeholder="+256 7..." onChange={(e) => updateForm("guestPhone", e.target.value)} />
                  </Field>
                  <Field label="Nationality">
                    <input className="crs-input" value={form.nationality} onChange={(e) => updateForm("nationality", e.target.value)} />
                  </Field>
                  <Field label="ID / Passport (optional)">
                    <input className="crs-input" value={form.idNumber} onChange={(e) => updateForm("idNumber", e.target.value)} />
                  </Field>
                  <Field label="Room number (101–200)">
                    <input className="crs-input crs-mono" type="number" min={101} max={200} value={form.roomNumber} onChange={(e) => updateForm("roomNumber", Number(e.target.value))} />
                  </Field>
                  <Field label="Guests">
                    <input className="crs-input" type="number" min={1} max={6} value={form.guestsCount} onChange={(e) => updateForm("guestsCount", Number(e.target.value))} />
                  </Field>
                  <Field label="Check-in">
                    <input className="crs-input" type="date" value={form.checkIn} onChange={(e) => updateForm("checkIn", e.target.value)} />
                  </Field>
                  <Field label="Check-out">
                    <input className="crs-input" type="date" value={form.checkOut} onChange={(e) => updateForm("checkOut", e.target.value)} />
                  </Field>
                </div>
                <div className="crs-note" style={{ margin: "12px 0" }}>
                  {selectedRoomInfo
                    ? `Room ${selectedRoomInfo.number} · ${selectedRoomInfo.category} · ${ugx(selectedRoomInfo.rate)} / night · ${selectedRoomInfo.status}${inHouseRoomNumbers.has(selectedRoomInfo.number) ? " · occupied" : ""}`
                    : "Enter a room between 101 and 200."}
                </div>
                <Field label="Notes / special requests">
                  <textarea className="crs-textarea" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Late arrival, airport transfer, dietary needs…" />
                </Field>
                <Button block loading={busy} onClick={createBooking} style={{ marginTop: 14 }}>
                  <Plus /> Confirm booking & post accommodation charge
                </Button>
              </Card>
            </div>
          </div>
        )}

        {tab === "reservations" && (
          <div className="crs-card-body">
            {paymentControls(state.stats.openFolio)}
            <div className="crs-note" style={{ marginBottom: 14 }}>Checkout settles every open folio item and produces one official receipt. Split allocations are applied to the selected booking balance.</div>
            <div className="crs-table-wrap">
              <table className="crs-table">
                <thead>
                  <tr>
                    <th>Booking</th><th>Guest</th><th>Room</th><th>Stay</th><th>Status</th>
                    <th className="num">Open folio</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="strong crs-mono">#{booking.id}</td>
                      <td><div className="strong">{booking.guestName}</div><div className="muted">{booking.guestPhone}</div></td>
                      <td className="crs-mono strong">{booking.roomNumber}</td>
                      <td className="crs-mono">{booking.checkIn} → {booking.checkOut}</td>
                      <td><StatusBadge status={booking.status} /></td>
                      <td className="num strong">{ugx(booking.folioBalance)}</td>
                      <td>
                        <div className="crs-inline">
                          {booking.status === "Reserved" && (
                            <>
                              <Button small loading={busy} onClick={() => bookingAction(booking.id, "check-in")}><LogIn /> Check in</Button>
                              <Button small variant="danger" loading={busy} onClick={() => bookingAction(booking.id, "cancel")}><Trash2 /> Cancel</Button>
                            </>
                          )}
                          {booking.status === "Checked In" && (
                            <>
                              <Button small variant="gold" loading={busy} onClick={() => settleFolio(booking.id, booking.folioBalance)}><CreditCard /> Settle</Button>
                              <Button small loading={busy} onClick={() => bookingAction(booking.id, "check-out", booking.folioBalance)}><LogOut /> Check out</Button>
                            </>
                          )}
                          <Button small variant="ghost" onClick={() => { setFolioBookingId(booking.id); setTab("folios"); }}><FileText /> Folio</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!activeBookings.length && <EmptyState>No active reservations. Create one in the availability tab.</EmptyState>}
            </div>
          </div>
        )}

        {tab === "folios" && (
          <div className="crs-card-body">
            <div className="crs-form-grid">
              <Field label="Guest folio">
                <select className="crs-select" value={selectedFolio?.id ?? ""} onChange={(e) => setFolioBookingId(Number(e.target.value))}>
                  {folioBookings.map((booking) => <option key={booking.id} value={booking.id}>#{booking.id} · {booking.guestName} · Room {booking.roomNumber}</option>)}
                </select>
              </Field>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <Button block variant="gold" disabled={!selectedFolio || selectedFolio.folioBalance <= 0} loading={busy} onClick={() => selectedFolio && settleFolio(selectedFolio.id, selectedFolio.folioBalance)}>
                  <Receipt /> Settle folio & print receipt
                </Button>
              </div>
            </div>
            {paymentControls(selectedFolio?.folioBalance ?? 0)}
            {selectedFolio && (
              <>
                <div className="crs-note" style={{ marginTop: 14 }}>
                  <strong>{selectedFolio.guestName}</strong> · Room {selectedFolio.roomNumber} · {selectedFolio.checkIn} → {selectedFolio.checkOut} · <StatusBadge status={selectedFolio.status} />
                </div>
                <div className="crs-table-wrap" style={{ marginTop: 14 }}>
                  <table className="crs-table">
                    <thead><tr><th>Posted</th><th>Department</th><th>Item / service</th><th className="num">Qty × Rate</th><th className="num">Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {folioCharges.map((charge) => (
                        <tr key={charge.id}>
                          <td className="crs-mono muted">{charge.createdAt.slice(0, 10)}</td>
                          <td>{charge.department}</td>
                          <td className="strong">{charge.description}</td>
                          <td className="num crs-mono">{charge.quantity} × {charge.unitPrice.toLocaleString("en-UG")}</td>
                          <td className="num strong">{ugx(charge.amount)}</td>
                          <td><StatusBadge status={charge.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!folioCharges.length && <EmptyState>No charges posted to this folio.</EmptyState>}
                </div>
                <div className="crs-kv" style={{ maxWidth: 320, marginLeft: "auto", marginTop: 12 }}>
                  <span>Outstanding balance</span><span>{ugx(selectedFolio.folioBalance)}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
