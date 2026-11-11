"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Sparkles, WashingMachine, Wrench } from "lucide-react";
import { Button, Card, EmptyState, Field, StatusBadge } from "@/components/ui";
import type { ModuleProps } from "@/components/types";
import { ROOM_STATUSES, ugx, type RoomStatus } from "@/lib/crs";

const LAUNDRY_ITEMS = [
  { name: "Shirt / blouse", price: 5_000 },
  { name: "Trousers / skirt", price: 7_000 },
  { name: "Express shirt service", price: 7_000 },
  { name: "Bedding set", price: 20_000 },
  { name: "Suit dry cleaning", price: 25_000 },
  { name: "Express service surcharge", price: 15_000 },
];

export default function Housekeeping(props: ModuleProps) {
  const { state, role, busy, run } = props;
  const canStatus = role === "Housekeeping" || role === "Reception" || role === "Admin/Manager";
  const canLaundry = role === "Laundry" || role === "Admin/Manager";
  const [selectedRoom, setSelectedRoom] = useState(112);
  const [status, setStatus] = useState<RoomStatus>("Clean");
  const [note, setNote] = useState("");
  const [preset, setPreset] = useState("0");
  const [description, setDescription] = useState(LAUNDRY_ITEMS[0].name);
  const [unitPrice, setUnitPrice] = useState(LAUNDRY_ITEMS[0].price);
  const [quantity, setQuantity] = useState(1);
  const [laundryRoom, setLaundryRoom] = useState(112);

  const inHouse = useMemo(
    () => state.bookings.filter((booking) => booking.status === "Checked In"),
    [state.bookings],
  );
  const inHouseRoomNumbers = new Set(inHouse.map((booking) => booking.roomNumber));
  const selectedRoomInfo = state.rooms.find((room) => room.number === selectedRoom);
  const maintenanceLogs = state.statusLogs.filter(
    (log) => log.newStatus === "Under Maintenance" || log.previousStatus === "Under Maintenance",
  );
  const laundryCharges = state.charges.filter((charge) => charge.department === "Laundry");

  const chooseRoom = (number: number) => {
    setSelectedRoom(number);
    setLaundryRoom(number);
    const room = state.rooms.find((item) => item.number === number);
    if (room) setStatus(room.status);
  };

  const changePreset = (value: string) => {
    setPreset(value);
    if (value === "custom") {
      setDescription("");
      return;
    }
    const item = LAUNDRY_ITEMS[Number(value)];
    setDescription(item.name);
    setUnitPrice(item.price);
  };

  const submitStatus = async () => {
    const result = await run({
      url: `/api/rooms/${selectedRoom}`,
      method: "PATCH",
      body: { status, note },
    });
    if (result) setNote("");
  };

  const submitLaundry = async () => {
    const result = await run({
      url: "/api/charges",
      body: {
        mode: "room",
        department: "Laundry",
        description,
        quantity,
        unitPrice,
        roomNumber: laundryRoom,
      },
    });
    if (result) setQuantity(1);
  };

  return (
    <div className="crs-section-grid">
      <div className="crs-page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="crs-eyebrow">Departmental module · Housekeeping & Laundry</div>
          <h1 className="crs-h1">Room Status & Laundry</h1>
          <p className="crs-subtle">Maintain the 100-room rack, log out-of-order rooms and post laundry to guest folios.</p>
        </div>
        <div className="crs-inline">
          <span className="crs-chip chip-clean">{state.rooms.filter((r) => r.status === "Clean").length} clean</span>
          <span className="crs-chip chip-dirty">{state.stats.dirtyRooms} dirty</span>
          <span className="crs-chip chip-maintenance">{state.stats.outOfOrder} out of order</span>
        </div>
      </div>

      <Card
        title="Interactive room rack · 101–200"
        description="Click any room to load it into the status and laundry forms."
        icon={<ClipboardList size={15} />}
        actions={<div className="crs-legend"><span><i className="crs-swatch" style={{ background: "#c5e7da" }} /> Clean</span><span><i className="crs-swatch" style={{ background: "#efdcae" }} /> Dirty</span><span><i className="crs-swatch" style={{ background: "#f0c6c2" }} /> Maintenance</span><span><i className="crs-swatch" style={{ background: "#3d75c4" }} /> In-house underline</span></div>}
      >
        <div className="crs-room-grid">
          {state.rooms.map((room) => {
            const kind = room.status === "Under Maintenance" ? "maintenance" : room.status.toLowerCase();
            return (
              <button
                key={room.number}
                className={`crs-room-tile ${kind} ${inHouseRoomNumbers.has(room.number) ? "occupied" : ""} ${selectedRoom === room.number ? "selected" : ""}`}
                title={`Room ${room.number} · ${room.category} · ${room.status}${room.statusNote ? ` · ${room.statusNote}` : ""}`}
                onClick={() => chooseRoom(room.number)}
              >
                {room.number}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="crs-two-col">
        {canStatus && <Card title="Update cleaning / maintenance status" description={`Selected room: ${selectedRoom}${selectedRoomInfo ? ` · ${selectedRoomInfo.category}` : ""}`} icon={<Sparkles size={15} />}>
          {selectedRoomInfo && (
            <div className="crs-note" style={{ marginBottom: 14 }}>
              Current: <StatusBadge status={selectedRoomInfo.status} /> · {selectedRoomInfo.statusNote ?? "No note"}
            </div>
          )}
          <div className="crs-form-grid">
            <Field label="Room number">
              <input className="crs-input crs-mono" type="number" min={101} max={200} value={selectedRoom} onChange={(e) => setSelectedRoom(Number(e.target.value))} />
            </Field>
            <Field label="New status">
              <select className="crs-select" value={status} onChange={(e) => setStatus(e.target.value as RoomStatus)}>
                {ROOM_STATUSES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Service / maintenance note">
            <textarea className="crs-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === "Under Maintenance" ? "Required: describe the fault and action taken…" : "Linen changed, deep clean, inspection note…"} />
          </Field>
          <div className="crs-note warning" style={{ margin: "12px 0" }}>
            Out-of-order rooms cannot be reserved. A reason is required and every change is written to the maintenance log.
          </div>
          <Button block loading={busy} onClick={submitStatus}><Wrench /> Update room status & write log</Button>
        </Card>}

        {canLaundry && <Card title="Post laundry charge" description="Charges are added to the in-house guest folio." icon={<WashingMachine size={15} />}>
          <div className="crs-form-grid">
            <Field label="Room">
              <select className="crs-select" value={laundryRoom} onChange={(e) => setLaundryRoom(Number(e.target.value))}>
                {inHouse.map((booking) => (
                  <option key={booking.id} value={booking.roomNumber}>Room {booking.roomNumber} · {booking.guestName}</option>
                ))}
              </select>
            </Field>
            <Field label="Laundry item">
              <select className="crs-select" value={preset} onChange={(e) => changePreset(e.target.value)}>
                {LAUNDRY_ITEMS.map((item, index) => <option key={item.name} value={String(index)}>{item.name} — {ugx(item.price)}</option>)}
                <option value="custom">Custom item…</option>
              </select>
            </Field>
            <Field label="Description">
              <input className="crs-input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Quantity">
              <input className="crs-input crs-mono" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </Field>
            <Field label="Unit price (UGX)">
              <input className="crs-input crs-mono" type="number" min={100} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
            </Field>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <div className="crs-note" style={{ width: "100%" }}>Total: <strong>{ugx(quantity * unitPrice)}</strong></div>
            </div>
          </div>
          <Button block variant="gold" loading={busy} onClick={submitLaundry} style={{ marginTop: 14 }}>
            <ReceiptIcon /> Post laundry charge to room {laundryRoom}
          </Button>
          {!inHouse.length && <div className="crs-note danger" style={{ marginTop: 12 }}>No checked-in guests available for room charges.</div>}
        </Card>}
      </div>

      <div className="crs-two-col">
        <Card title="Out-of-order / room maintenance log" description="All maintenance openings and closures with staff ID." icon={<Wrench size={15} />}>
          <div className="crs-table-wrap crs-scroll-list">
            <table className="crs-table">
              <thead><tr><th>Date</th><th>Room</th><th>Transition</th><th>Note</th><th>Staff</th></tr></thead>
              <tbody>
                {maintenanceLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="crs-mono muted">{log.createdAt.slice(0, 10)}</td>
                    <td className="strong crs-mono">{log.roomNumber}</td>
                    <td><StatusBadge status={log.previousStatus} /> → <StatusBadge status={log.newStatus} /></td>
                    <td>{log.note ?? "—"}</td>
                    <td className="crs-mono">{log.staffId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!maintenanceLogs.length && <EmptyState>No maintenance events in the current register.</EmptyState>}
          </div>
        </Card>

        <Card title="Laundry charge ledger" description="Posted services and their folio status." icon={<WashingMachine size={15} />}>
          <div className="crs-scroll-list">
            {laundryCharges.map((charge) => (
              <div className="crs-kv" key={charge.id}>
                <span>{charge.roomNumber ?? "Walk-in"} · {charge.description}</span>
                <span>{ugx(charge.amount)} · <StatusBadge status={charge.status} /></span>
              </div>
            ))}
            {!laundryCharges.length && <EmptyState>No laundry charges have been posted.</EmptyState>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReceiptIcon() {
  return <ClipboardList size={14} />;
}
