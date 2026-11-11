"use client";

import { useMemo, useState } from "react";
import { CreditCard, Receipt, Utensils, Wine } from "lucide-react";
import { Button, Card, EmptyState, Field, StatusBadge } from "@/components/ui";
import type { ModuleProps } from "@/components/types";
import {
  kampalaDateKey,
  PAYMENT_COMPONENTS,
  ugx,
  type PaymentAllocation,
  type PaymentComponent,
} from "@/lib/crs";

const MENU: Record<string, { name: string; price: number }[]> = {
  Restaurant: [
    { name: "Grilled tilapia plate", price: 45_000 },
    { name: "Chicken luombo with matooke", price: 38_000 },
    { name: "Beef steak & chips", price: 52_000 },
    { name: "Breakfast buffet", price: 30_000 },
    { name: "Vegetable curry", price: 28_000 },
    { name: "Fresh juice", price: 8_000 },
  ],
  Bar: [
    { name: "Local beer", price: 10_000 },
    { name: "House wine (glass)", price: 18_000 },
    { name: "Uganda gin & tonic", price: 22_000 },
    { name: "Mineral water", price: 5_000 },
    { name: "Espresso", price: 7_000 },
  ],
};

export default function FoodBeverage(props: ModuleProps) {
  const { state, role, busy, run, openReceipt } = props;
  const lockedDepartment: "Restaurant" | "Bar" | null = role === "Bar" ? "Bar" : role === "Restaurant" ? "Restaurant" : null;
  const initialDepartment: "Restaurant" | "Bar" = lockedDepartment ?? "Restaurant";
  const inHouse = useMemo(
    () => state.bookings.filter((booking) => booking.status === "Checked In"),
    [state.bookings],
  );
  const [mode, setMode] = useState<"room" | "walkin">("room");
  const [department, setDepartment] = useState<"Restaurant" | "Bar">(initialDepartment);
  const [preset, setPreset] = useState("0");
  const [description, setDescription] = useState(MENU[initialDepartment][0].name);
  const [unitPrice, setUnitPrice] = useState(MENU[initialDepartment][0].price);
  const [quantity, setQuantity] = useState(1);
  const [roomNumber, setRoomNumber] = useState(inHouse[0]?.roomNumber ?? 112);
  const [guestName, setGuestName] = useState("Walk-in Guest");
  const [paymentMethod, setPaymentMethod] = useState<PaymentComponent>("Cash");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitMethod, setSplitMethod] = useState<PaymentComponent>("MTN Mobile Money");
  const [splitFirstAmount, setSplitFirstAmount] = useState(0);

  const departmentCharges = state.charges.filter(
    (charge) => charge.department === "Restaurant" || charge.department === "Bar",
  );
  const today = state.stats.today;
  const paidReceiptIdsToday = new Set(
    state.receipts
      .filter((receipt) => !receipt.voided && kampalaDateKey(new Date(receipt.issuedAt)) === today)
      .map((receipt) => receipt.id),
  );
  const postedToday = departmentCharges
    .filter((charge) => kampalaDateKey(new Date(charge.createdAt)) === today)
    .reduce((sum, charge) => sum + charge.amount, 0);
  const paidToday = departmentCharges
    .filter(
      (charge) =>
        charge.status === "Paid" &&
        charge.receiptId !== null &&
        paidReceiptIdsToday.has(charge.receiptId),
    )
    .reduce((sum, charge) => sum + charge.amount, 0);

  const changeDepartment = (next: "Restaurant" | "Bar") => {
    if (lockedDepartment && next !== lockedDepartment) return;
    setDepartment(next);
    setPreset("0");
    setDescription(MENU[next][0].name);
    setUnitPrice(MENU[next][0].price);
  };

  const changePreset = (value: string) => {
    setPreset(value);
    if (value === "custom") {
      setDescription("");
      return;
    }
    const item = MENU[department][Number(value)];
    setDescription(item.name);
    setUnitPrice(item.price);
  };

  const paymentAllocations = (total: number): PaymentAllocation[] => {
    if (!splitEnabled || total <= 0) return [{ method: paymentMethod, amount: total }];
    const first = Math.max(0, Math.min(total, Math.round(splitFirstAmount)));
    if (first <= 0 || first >= total) return [{ method: paymentMethod, amount: total }];
    return [{ method: paymentMethod, amount: first }, { method: splitMethod, amount: total - first }];
  };

  const submit = async () => {
    const result = await run({
      url: "/api/charges",
      body: {
        mode,
        department,
        description,
        quantity,
        unitPrice,
        roomNumber: mode === "room" ? roomNumber : null,
        guestName: mode === "walkin" ? guestName : null,
        paymentMethod: mode === "walkin" ? paymentMethod : null,
        payments: mode === "walkin" ? paymentAllocations(quantity * unitPrice) : undefined,
      },
    });
    if (result) setQuantity(1);
  };

  return (
    <div className="crs-section-grid">
      <div className="crs-page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="crs-eyebrow">Departmental module · Restaurant & Bar</div>
          <h1 className="crs-h1">Food & Beverage Point of Sale</h1>
          <p className="crs-subtle">Post meals and drinks to in-room folios, or take immediate walk-in payments.</p>
        </div>
        <span className="crs-chip chip-inhouse">{inHouse.length} rooms with open folios</span>
      </div>

      <div className="crs-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <div className="crs-stat teal"><div className="crs-stat-label"><Utensils size={13} /> Menu items</div><div className="crs-stat-value">{MENU.Restaurant.length + MENU.Bar.length}</div><div className="crs-stat-hint">Restaurant + Bar catalogue</div></div>
        <div className="crs-stat"><div className="crs-stat-label"><Receipt size={13} /> F&B value posted today</div><div className="crs-stat-value" style={{ fontSize: 19 }}>{ugx(postedToday)}</div><div className="crs-stat-hint">Restaurant + Bar charges created today</div></div>
        <div className="crs-stat gold"><div className="crs-stat-label"><CreditCard size={13} /> F&B collected today</div><div className="crs-stat-value" style={{ fontSize: 19 }}>{ugx(paidToday)}</div><div className="crs-stat-hint">F&B items on receipts issued today</div></div>
      </div>

      <div className="crs-two-col">
        <Card title="New F&B transaction" description="Every paid transaction generates an official receipt." icon={<Utensils size={15} />}>
          <div className="crs-inline" style={{ justifyContent: "space-between", marginBottom: 15 }}>
            <div className="crs-toggle">
              <button className={mode === "room" ? "active" : ""} onClick={() => setMode("room")}>Charge to room folio</button>
              <button className={mode === "walkin" ? "active" : ""} onClick={() => setMode("walkin")}>Direct walk-in payment</button>
            </div>
            <div className="crs-toggle">
              <button disabled={Boolean(lockedDepartment && lockedDepartment !== "Restaurant")} className={department === "Restaurant" ? "active" : ""} onClick={() => changeDepartment("Restaurant")}><Utensils size={12} /> Restaurant</button>
              <button disabled={Boolean(lockedDepartment && lockedDepartment !== "Bar")} className={department === "Bar" ? "active" : ""} onClick={() => changeDepartment("Bar")}><Wine size={12} /> Bar</button>
            </div>
          </div>
          <div className="crs-form-grid">
            <Field label="Menu item / service">
              <select className="crs-select" value={preset} onChange={(e) => changePreset(e.target.value)}>
                {MENU[department].map((item, index) => (
                  <option key={item.name} value={String(index)}>{item.name} — {ugx(item.price)}</option>
                ))}
                <option value="custom">Custom item…</option>
              </select>
            </Field>
            <Field label="Description">
              <input className="crs-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Service description" />
            </Field>
            <Field label="Quantity">
              <input className="crs-input crs-mono" type="number" min={1} max={100} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </Field>
            <Field label="Unit price (UGX)">
              <input className="crs-input crs-mono" type="number" min={100} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
            </Field>
            {mode === "room" ? (
              <Field label="In-house room (101–200)">
                <select className="crs-select" value={roomNumber} onChange={(e) => setRoomNumber(Number(e.target.value))}>
                  {inHouse.map((booking) => (
                    <option key={booking.id} value={booking.roomNumber}>
                      Room {booking.roomNumber} · {booking.guestName}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Walk-in guest name">
                <input className="crs-input" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </Field>
            )}
            {mode === "walkin" && (
              <>
                <Field label="Primary payment method">
                  <select className="crs-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentComponent)}>
                    {PAYMENT_COMPONENTS.map((method) => <option key={method}>{method}</option>)}
                  </select>
                </Field>
                {splitEnabled && <Field label="Secondary method"><select className="crs-select" value={splitMethod} onChange={(e) => setSplitMethod(e.target.value as PaymentComponent)}>{PAYMENT_COMPONENTS.filter((method) => method !== paymentMethod).map((method) => <option key={method}>{method}</option>)}</select></Field>}
                {splitEnabled && <Field label="Primary amount (UGX)"><input className="crs-input crs-mono" type="number" min={0} max={quantity * unitPrice} value={splitFirstAmount} onChange={(e) => setSplitFirstAmount(Number(e.target.value))} /></Field>}
              </>
            )}
          </div>
          {mode === "walkin" && (
            <div className="crs-note" style={{ margin: "14px 0" }}>
              <div className="crs-inline" style={{ justifyContent: "space-between" }}>
                <span>Split payment: secondary receives <strong>{ugx(Math.max(0, quantity * unitPrice - Math.min(quantity * unitPrice, Math.round(splitFirstAmount))))}</strong></span>
                <div className="crs-toggle"><button className={!splitEnabled ? "active" : ""} onClick={() => setSplitEnabled(false)}>Single</button><button className={splitEnabled ? "active" : ""} onClick={() => setSplitEnabled(true)}>Split</button></div>
              </div>
            </div>
          )}
          <div className="crs-note" style={{ margin: "14px 0" }}>
            {mode === "room"
              ? "The charge will be added to the guest folio. Front Desk or Finance collects it at settlement."
              : "A paid charge and official receipt will be created immediately; no room folio is required."}
          </div>
          <div className="crs-inline" style={{ justifyContent: "space-between" }}>
            <strong>Line total: {ugx(quantity * unitPrice)}</strong>
            <Button variant={mode === "walkin" ? "gold" : "primary"} loading={busy} onClick={submit}>
              {mode === "walkin" ? <><Receipt /> Take payment & print receipt</> : <><CreditCard /> Post charge to room</>}
            </Button>
          </div>
        </Card>

        <Card title="Open room folios" description="Only checked-in rooms accept charges." icon={<Receipt size={15} />}>
          <div className="crs-scroll-list">
            {inHouse.map((booking) => (
              <div className="crs-kv" key={booking.id}>
                <span>Room {booking.roomNumber} · {booking.guestName}</span>
                <span>{ugx(booking.folioBalance)}</span>
              </div>
            ))}
            {!inHouse.length && <EmptyState>No in-house guests available for room charges.</EmptyState>}
          </div>
        </Card>
      </div>

      <Card title="Recent F&B charge ledger" description="Paid items link directly to their official receipt." icon={<Receipt size={15} />}>
        <div className="crs-table-wrap">
          <table className="crs-table">
            <thead><tr><th>Date</th><th>Department</th><th>Guest / room</th><th>Item</th><th className="num">Amount</th><th>Status</th><th>Receipt</th></tr></thead>
            <tbody>
              {departmentCharges.slice(0, 12).map((charge) => (
                <tr key={charge.id}>
                  <td className="crs-mono muted">{charge.createdAt.slice(0, 10)}</td>
                  <td>{charge.department}</td>
                  <td>{charge.guestName}{charge.roomNumber ? ` · ${charge.roomNumber}` : " · Walk-in"}</td>
                  <td className="strong">{charge.quantity} × {charge.description}</td>
                  <td className="num strong">{ugx(charge.amount)}</td>
                  <td><StatusBadge status={charge.status} /></td>
                  <td>
                    {charge.receiptId ? (
                      <Button small variant="ghost" onClick={() => openReceipt(charge.receiptId!)}><Receipt /> View</Button>
                    ) : <span className="muted">Folio</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!departmentCharges.length && <EmptyState>No restaurant or bar charges recorded.</EmptyState>}
        </div>
      </Card>
    </div>
  );
}
