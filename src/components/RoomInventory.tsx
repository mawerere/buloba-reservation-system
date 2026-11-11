"use client";

import { useMemo, useState } from "react";
import { Filter, Grid3X3 } from "lucide-react";
import { Card, StatusBadge } from "@/components/ui";
import {
  deriveRoomDisplayStatus,
  roomDisplayClass,
  ROOM_CATEGORIES,
  ROOM_DISPLAY_STATUSES,
  ugx,
  type CrsState,
  type RoomDisplayStatus,
  type RoomView,
} from "@/lib/crs";

export default function RoomInventory({
  state,
  onInspect,
}: {
  state: CrsState;
  onInspect?: (room: RoomView) => void;
}) {
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const rooms = useMemo(
    () =>
      state.rooms.map((room) => ({
        room,
        display: deriveRoomDisplayStatus(room, state.bookings, state.stats.today),
      })),
    [state.rooms, state.bookings, state.stats.today],
  );
  const filtered = rooms.filter(
    (item) =>
      (category === "All" || item.room.category === category) &&
      (status === "All" || item.display === status),
  );
  const counts = ROOM_DISPLAY_STATUSES.reduce<Record<string, number>>((acc, item) => {
    acc[item] = rooms.filter((entry) => entry.display === item).length;
    return acc;
  }, {});

  return (
    <Card
      title="Interactive room inventory · 101–200"
      description="Filter by category and live operational status. Click a room to inspect it."
      icon={<Grid3X3 size={15} />}
      actions={<div className="crs-legend">{ROOM_DISPLAY_STATUSES.map((item) => <span key={item}><i className="crs-swatch" style={{ background: statusColor(item) }} /> {item} {counts[item]}</span>)}</div>}
    >
      <div className="crs-inline" style={{ marginBottom: 14, justifyContent: "space-between" }}>
        <div className="crs-toggle">
          {["All", ...ROOM_CATEGORIES].map((item) => (
            <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
        <label className="crs-inline" style={{ gap: 7 }}>
          <Filter size={13} />
          <select className="crs-select" style={{ width: 190 }} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>All</option>
            {ROOM_DISPLAY_STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="crs-inline" style={{ marginBottom: 12 }}>
        <strong className="crs-mono">{filtered.length}</strong>
        <span className="crs-subtle">matching rooms</span>
        {status !== "All" && <StatusBadge status={status} />}
      </div>
      <div className="crs-room-grid">
        {filtered.map(({ room, display }) => (
          <button
            key={room.number}
            className={`crs-room-tile display-${roomDisplayClass(display)}`}
            title={`Room ${room.number} · ${room.category} · ${display} · ${ugx(room.rate)}/night`}
            onClick={() => onInspect?.(room)}
          >
            {room.number}
          </button>
        ))}
      </div>
      {!filtered.length && <div className="crs-empty">No rooms match the selected filters.</div>}
    </Card>
  );
}

function statusColor(status: RoomDisplayStatus): string {
  const colors: Record<RoomDisplayStatus, string> = {
    Available: "#8ad3b5",
    Occupied: "#5b8fd8",
    Reserved: "#d3a343",
    "Under Maintenance": "#e8837b",
    "Cleaning Needed": "#e8c46a",
  };
  return colors[status];
}
