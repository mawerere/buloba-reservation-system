"use client";

import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  FileBarChart,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button, Card, EmptyState, StatCard, StatusBadge } from "@/components/ui";
import type { ModuleProps } from "@/components/types";
import { shortDate, ugx } from "@/lib/crs";

export default function Finance(props: ModuleProps) {
  const { state, openReceipt, openReports } = props;
  const paidCharges = state.charges.filter((charge) => charge.status === "Paid");
  const departments = ["Accommodation", "Restaurant", "Bar", "Laundry"] as const;
  const departmentRevenue = departments.map((department) => ({
    department,
    collected: paidCharges
      .filter((charge) => charge.department === department)
      .reduce((sum, charge) => sum + charge.amount, 0),
    posted: state.charges
      .filter((charge) => charge.department === department && charge.status !== "Cancelled")
      .reduce((sum, charge) => sum + charge.amount, 0),
  }));
  const openFolioBookings = state.bookings
    .filter((booking) => booking.folioBalance > 0)
    .sort((a, b) => b.folioBalance - a.folioBalance);
  const paymentMix = state.receipts.reduce<Record<string, number>>((acc, receipt) => {
    acc[receipt.paymentMethod] = (acc[receipt.paymentMethod] ?? 0) + receipt.totalAmount;
    return acc;
  }, {});
  const auditChecks = [
    { label: "Cashier receipts issued today", value: state.stats.receiptsToday, ok: true },
    { label: "Open guest folio value", value: ugx(state.stats.openFolio), ok: state.stats.openFolio < 5_000_000 },
    { label: "Rooms out of order", value: state.stats.outOfOrder, ok: state.stats.outOfOrder === 0 },
    { label: "Occupancy (sellable rooms)", value: `${state.stats.occupancyRate}%`, ok: true },
  ];

  return (
    <div className="crs-section-grid">
      <div className="crs-page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="crs-eyebrow">Departmental module · Accounts / Finance</div>
          <h1 className="crs-h1">Finance Control & Daily Audit</h1>
          <p className="crs-subtle">Consolidated revenue, cashier reconciliation, unsettled folios and statutory-ready reports.</p>
        </div>
        <Button variant="gold" onClick={() => openReports("all", "daily")}><ShieldCheck /> Run daily audit</Button>
      </div>

      <div className="crs-stats" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Collected today" value={ugx(state.stats.collectedToday)} hint={`${state.stats.receiptsToday} official receipts`} icon={<Wallet size={13} />} tone="gold" />
        <StatCard label="All-time collected" value={ugx(state.receipts.reduce((sum, receipt) => sum + receipt.totalAmount, 0))} hint="Paid transactions, all departments" icon={<BarChart3 size={13} />} tone="teal" />
        <StatCard label="Open folio value" value={ugx(state.stats.openFolio)} hint={`${openFolioBookings.length} guest folios`} icon={<Receipt size={13} />} />
        <StatCard label="Out-of-order rooms" value={state.stats.outOfOrder} hint="Excluded from sellable inventory" icon={<AlertTriangle size={13} />} />
      </div>

      <div className="crs-two-col">
        <Card title="Departmental revenue position" description="Posted charges versus settled / collected value." icon={<Building2 size={15} />}>
          <div className="crs-table-wrap">
            <table className="crs-table">
              <thead><tr><th>Department</th><th className="num">Posted</th><th className="num">Collected</th><th className="num">Outstanding</th></tr></thead>
              <tbody>
                {departmentRevenue.map((row) => (
                  <tr key={row.department}>
                    <td className="strong">{row.department}</td>
                    <td className="num">{ugx(row.posted)}</td>
                    <td className="num">{ugx(row.collected)}</td>
                    <td className="num strong">{ugx(Math.max(0, row.posted - row.collected))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="crs-divider" />
          <div className="crs-eyebrow">Payment method mix</div>
          <div className="crs-inline" style={{ marginTop: 10 }}>
            {Object.entries(paymentMix).map(([method, amount]) => (
              <span className="crs-chip chip-neutral" key={method}>{method}: {ugx(amount)}</span>
            ))}
          </div>
        </Card>

        <Card title="Daily audit checklist" description="Finance sign-off uses the consolidated report engine." icon={<ShieldCheck size={15} />}>
          <div className="crs-scroll-list">
            {auditChecks.map((check) => (
              <div className="crs-kv" key={check.label}>
                <span>{check.ok ? <CheckCircle2 size={12} color="#14705a" /> : <AlertTriangle size={12} color="#b7831c" />} {check.label}</span>
                <span>{check.value}</span>
              </div>
            ))}
          </div>
          <div className="crs-note" style={{ margin: "14px 0" }}>
            The consolidated audit contains occupancy, departmental revenue, cashier reconciliation and maintenance exceptions in one printable document.
          </div>
          <div className="crs-inline">
            <Button small variant="gold" onClick={() => openReports("all", "daily")}><FileBarChart /> Consolidated daily audit</Button>
            <Button small variant="ghost" onClick={() => openReports("cashier", "daily")}>Cashier reconciliation</Button>
            <Button small variant="ghost" onClick={() => openReports("revenue", "weekly")}>Weekly revenue</Button>
          </div>
        </Card>
      </div>

      <div className="crs-two-col">
        <Card title="Unsettled guest folios" description="Outstanding accommodation and departmental charges." icon={<Receipt size={15} />}>
          <div className="crs-table-wrap">
            <table className="crs-table">
              <thead><tr><th>Folio</th><th>Guest / room</th><th>Status</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {openFolioBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="crs-mono strong">#{booking.id}</td>
                    <td>{booking.guestName} · Room {booking.roomNumber}</td>
                    <td><StatusBadge status={booking.status} /></td>
                    <td className="num strong">{ugx(booking.folioBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!openFolioBookings.length && <EmptyState>All guest folios are settled.</EmptyState>}
          </div>
        </Card>

        <Card title="Receipt register" description="Reprint any official receipt for audit." icon={<Receipt size={15} />}>
          <div className="crs-scroll-list">
            {state.receipts.map((receipt) => (
              <div className="crs-kv" key={receipt.id}>
                <span><strong className="crs-mono">{receipt.receiptNo}</strong><br /><span className="crs-subtle">{shortDate(receipt.issuedAt)} · {receipt.guestName} · {receipt.paymentMethod}</span></span>
                <span style={{ textAlign: "right" }}>{ugx(receipt.totalAmount)}<br /><Button small variant="ghost" onClick={() => openReceipt(receipt.id)} style={{ marginTop: 5 }}>View / reprint</Button></span>
              </div>
            ))}
            {!state.receipts.length && <EmptyState>No payments recorded.</EmptyState>}
          </div>
        </Card>
      </div>
    </div>
  );
}
