"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { BarChart3, CalendarDays, Download, FileBarChart, FileDown, Lock, Printer, Receipt, ShieldCheck, Wrench } from "lucide-react";
import { Button, Card, DownloadTextButton, EmptyState, Field, PrintButton, StatusBadge } from "@/components/ui";
import type { ReportRequest } from "@/components/types";
import {
  dateRangeForPeriod,
  dateTimeKampala,
  HOTEL,
  ROOM_CATEGORIES,
  shortDate,
  ugx,
  type CrsState,
  type ReportData,
  type Role,
} from "@/lib/crs";

type Props = {
  role: Role;
  state: CrsState;
  request: ReportRequest;
  setRequest: (request: ReportRequest) => void;
  openReceipt: (id: number) => void;
};

const SECTIONS = [
  { id: "occupancy", label: "Occupancy & Bookings", icon: BarChart3 },
  { id: "revenue", label: "Departmental Revenue", icon: FileBarChart },
  { id: "cashier", label: "Cashier Reconciliation", icon: Receipt },
  { id: "maintenance", label: "Maintenance Log", icon: Wrench },
  { id: "all", label: "Consolidated Audit", icon: ShieldCheck },
] as const;

const ALLOWED: Record<Role, string[]> = {
  "Admin/Manager": ["occupancy", "revenue", "cashier", "maintenance", "all"],
  Reception: ["occupancy"],
  Restaurant: ["revenue"],
  Bar: ["revenue"],
  Laundry: ["revenue"],
  Housekeeping: ["maintenance"],
  Finance: ["occupancy", "revenue", "cashier", "maintenance", "all"],
};

const DEPARTMENTS = ["All", "Accommodation", "Restaurant", "Bar", "Laundry"];

export default function ReportsPanel({ role, state, request, setRequest, openReceipt }: Props) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeSection = ALLOWED[role].includes(request.section) ? request.section : ALLOWED[role][0];

  const loadReport = useEffectEvent(async (signal: AbortSignal) => {
    if (signal.aborted) return;
    setLoading(true); setError("");
    const params = new URLSearchParams({
      section: activeSection,
      period: request.period,
      from: request.from,
      to: request.to,
      department: request.department,
      category: request.category,
    });
    try {
      const response = await fetch(`/api/reports?${params.toString()}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Report generation failed.");
      if (!signal.aborted) setReport(data.report as ReportData);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "Report generation failed.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadReport(controller.signal));
    return () => controller.abort();
  }, [request.nonce, role, activeSection]);

  const patch = (values: Partial<ReportRequest>) => setRequest({ ...request, ...values });
  const changePeriod = (period: string) => {
    const range = dateRangeForPeriod(period, request.from, request.to, state.stats.today);
    patch({ period, from: range.from, to: range.to });
  };
  const generate = () => patch({ nonce: request.nonce + 1 });
  const reportText = report ? buildReportText(report, activeSection) : "";
  const reportCsv = report ? buildReportCsv(report, activeSection) : "";
  const filename = report ? `Buloba-${activeSection}-${report.meta.from}-${report.meta.to}` : "Buloba-report";

  return (
    <div className="crs-section-grid">
      <div className="crs-page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="crs-eyebrow">Reporting engine · {role}</div>
          <h1 className="crs-h1">Sales, Occupancy & Financial Reports</h1>
          <p className="crs-subtle">Daily, weekly, monthly or custom-date reports filtered by department and room category.</p>
        </div>
        <span className="crs-chip chip-clean"><ShieldCheck size={12} /> Session-authorized</span>
      </div>

      <Card title="Report builder" description="Generate a report, then print, download CSV or export a standalone A4 PDF." icon={<CalendarDays size={15} />} className="no-print">
        <div className="crs-form-grid four">
          <Field label="Period"><select className="crs-select" value={request.period} onChange={(e) => changePeriod(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></Field>
          <Field label="From"><input className="crs-input" type="date" value={request.from} disabled={request.period !== "custom"} onChange={(e) => patch({ from: e.target.value })} /></Field>
          <Field label="To"><input className="crs-input" type="date" value={request.to} disabled={request.period !== "custom"} onChange={(e) => patch({ to: e.target.value })} /></Field>
          <Field label="Department"><select className="crs-select" value={request.department} onChange={(e) => patch({ department: e.target.value })}>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <div className="crs-form-grid four" style={{ marginTop: 12 }}>
          <Field label="Room category"><select className="crs-select" value={request.category} onChange={(e) => patch({ category: e.target.value })}><option>All</option>{ROOM_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <div style={{ gridColumn: "span 3", display: "flex", alignItems: "flex-end" }}><Button block onClick={generate}><BarChart3 /> Generate report</Button></div>
        </div>
        <div className="crs-divider" />
        <div className="crs-tabs" style={{ border: 0, padding: 0 }}>
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const allowed = ALLOWED[role].includes(section.id);
            return <button key={section.id} className={`crs-tab ${activeSection === section.id ? "active" : ""}`} disabled={!allowed} onClick={() => patch({ section: section.id, nonce: request.nonce + 1 })}><Icon size={13} /> {section.label} {!allowed && <Lock size={11} />}</button>;
          })}
        </div>
      </Card>

      {error && <div className="crs-note danger no-print">{error}</div>}
      {loading && <Card title="Generating report"><div className="crs-empty">Querying bookings, folios, receipts and room logs…</div></Card>}

      {report && !loading && (
        <Card
          id="crs-report-print"
          title={`${SECTIONS.find((section) => section.id === activeSection)?.label ?? "Report"} · ${report.meta.period.toUpperCase()}`}
          description={`${report.meta.from} → ${report.meta.to} · ${report.meta.department} department · ${report.meta.category} rooms · generated ${dateTimeKampala(report.meta.generatedAt)} EAT`}
          icon={<Printer size={15} />}
          actions={<><PrintButton targetId="crs-report-print" label="Print / PDF" /><DownloadCsvButton text={reportCsv} filename={filename} /><DownloadPdfButton text={reportText} filename={filename} /><DownloadTextButton text={reportText} filename={filename} label="Text" /></>}
        >
          <div className="crs-report-head">
            <div><div className="crs-report-title">{HOTEL.name.toUpperCase()}</div><p>{state.settings.location} · {state.settings.contactPhone}</p><p>{SECTIONS.find((section) => section.id === activeSection)?.label} — {report.meta.period} report</p></div>
            <div style={{ textAlign: "right" }}><p><strong>Period:</strong> {report.meta.from} → {report.meta.to}</p><p><strong>Department:</strong> {report.meta.department}</p><p><strong>Category:</strong> {report.meta.category}</p><p><strong>Generated:</strong> {dateTimeKampala(report.meta.generatedAt)} EAT</p></div>
          </div>
          {activeSection === "occupancy" && <OccupancySection report={report} />}
          {activeSection === "revenue" && <RevenueSection report={report} />}
          {activeSection === "cashier" && <CashierSection report={report} openReceipt={openReceipt} />}
          {activeSection === "maintenance" && <MaintenanceSection report={report} state={state} />}
          {activeSection === "all" && <><AuditSection report={report} /><OccupancySection report={report} /><RevenueSection report={report} /><CashierSection report={report} openReceipt={openReceipt} /><MaintenanceSection report={report} state={state} /></>}
          <div className="crs-report-section"><h3>Structured text export</h3><details className="no-print"><summary className="crs-file-link" style={{ cursor: "pointer", marginBottom: 8 }}>Open plain-text report block</summary><div className="crs-report-text">{reportText}</div></details></div>
        </Card>
      )}
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) { return <section className="crs-report-section"><h3>{title}</h3>{children}</section>; }
function MiniStats({ items }: { items: { label: string; value: string | number }[] }) { return <div className="crs-report-mini">{items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>; }
function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return <div className="crs-table-wrap"><table className="crs-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <EmptyState>No records in the selected period.</EmptyState>}</div>; }

function OccupancySection({ report }: { report: ReportData }) { const o = report.occupancy; return <ReportSection title="1 · Occupancy & booking summary"><MiniStats items={[{ label: "Occupancy rate", value: `${o.occupancyRate}%` }, { label: "Room-nights sold", value: o.occupiedRoomNights }, { label: "Available room-nights", value: o.availableRoomNights }, { label: "Arrivals / departures", value: `${o.arrivals} / ${o.departures}` }]} /><DataTable headers={["Date", "Occupied", "Available", "Rate"]} rows={o.daily.map((d) => [d.date, d.occupied, d.available, `${d.rate}%`])} /><div style={{ height: 14 }} /><DataTable headers={["Category", "Rooms", "Room-nights", "Rate"]} rows={o.byCategory.map((c) => [c.category, c.rooms, c.occupiedRoomNights, `${c.rate}%`])} /><div style={{ height: 14 }} /><DataTable headers={["Booking", "Guest", "Room / category", "Stay", "Nights", "Status"]} rows={o.bookings.map((b) => [`#${b.id}`, b.guestName, `${b.roomNumber} · ${b.category}`, `${b.checkIn} → ${b.checkOut}`, b.nights, <StatusBadge key="s" status={b.status} />])} /></ReportSection>; }
function RevenueSection({ report }: { report: ReportData }) { const r = report.revenue; return <ReportSection title="2 · Departmental sales & revenue"><MiniStats items={[{ label: "Collected revenue", value: ugx(r.collected) }, { label: "Posted charges", value: ugx(r.posted) }, { label: "Paid line items", value: r.items.length }, { label: "Departments", value: r.byDepartment.length }]} /><DataTable headers={["Department", "Posted", "Collected", "Paid items"]} rows={r.byDepartment.map((d) => [d.department, ugx(d.posted), ugx(d.collected), d.transactions])} /><div style={{ height: 14 }} /><DataTable headers={["Date", "Collected"]} rows={r.byDate.map((d) => [d.date, ugx(d.amount)])} /><div style={{ height: 14 }} /><DataTable headers={["Date", "Receipt", "Department", "Item / service", "Amount"]} rows={r.items.map((i) => [i.date, i.receiptNo, i.department, i.description, ugx(i.amount)])} /></ReportSection>; }
function CashierSection({ report, openReceipt }: { report: ReportData; openReceipt: (id: number) => void }) { const c = report.cashier; return <ReportSection title="3 · Cashier / payment reconciliation"><MiniStats items={[{ label: "Total collected", value: ugx(c.total) }, { label: "Receipts", value: c.count }, { label: "Payment methods", value: c.byMethod.length }, { label: "Cashiers", value: c.byStaff.length }]} /><DataTable headers={["Payment method", "Transactions", "Total"]} rows={c.byMethod.map((m) => [m.method, m.count, ugx(m.total)])} /><div style={{ height: 14 }} /><DataTable headers={["Staff / cashier", "Transactions", "Total"]} rows={c.byStaff.map((s) => [s.staffId, s.count, ugx(s.total)])} /><div style={{ height: 14 }} /><DataTable headers={["Receipt ID", "Date", "Guest / room", "Method", "Staff", "Amount", ""]} rows={c.receipts.map((r) => [r.receiptNo, shortDate(r.issuedAt), `${r.guestName}${r.roomNumber ? ` / ${r.roomNumber}` : ""}`, r.paymentMethod, r.staffId, ugx(r.totalAmount), <Button key="v" small variant="ghost" className="no-print" onClick={() => openReceipt(r.id)}>Receipt</Button>])} /></ReportSection>; }
function MaintenanceSection({ report, state }: { report: ReportData; state: CrsState }) { const m = report.maintenance; return <ReportSection title="4 · Out-of-order / maintenance log"><MiniStats items={[{ label: "Out of order", value: m.currentOutOfOrder }, { label: "Dirty rooms", value: m.dirtyRooms }, { label: "Log events", value: m.events.length }, { label: "Open exceptions", value: m.openEvents }]} /><DataTable headers={["Date", "Room", "Transition", "Note", "Staff", "Current status"]} rows={m.events.map((e) => [e.createdAt.slice(0, 10), e.roomNumber, `${e.previousStatus} → ${e.newStatus}`, e.note ?? "—", e.staffId, <StatusBadge key="s" status={state.rooms.find((r) => r.number === e.roomNumber)?.status ?? e.newStatus} />])} /></ReportSection>; }
function AuditSection({ report }: { report: ReportData }) { const a = report.audit; return <ReportSection title="0 · Daily audit sign-off"><MiniStats items={[{ label: "Collected", value: ugx(a.collected) }, { label: "Receipts", value: a.receipts }, { label: "Open folio", value: ugx(a.openFolio) }, { label: "Occupancy", value: `${a.occupancyRate}%` }]} /><div className="crs-note warning">{a.flags.map((f) => <div key={f}>• {f}</div>)}</div></ReportSection>; }

function buildReportText(report: ReportData, section: string): string {
  const line = "=".repeat(64), thin = "-".repeat(64);
  const row = (l: string, r: string) => `${l.padEnd(44, " ")}${r.padStart(20, " ")}`;
  const should = (name: string) => section === "all" || section === name;
  const rows = [line, HOTEL.name.toUpperCase(), HOTEL.location, line, `REPORT: ${section.toUpperCase()} / ${report.meta.period.toUpperCase()}`, `PERIOD: ${report.meta.from} to ${report.meta.to}`, `FILTERS: department=${report.meta.department}; category=${report.meta.category}`, `GENERATED: ${dateTimeKampala(report.meta.generatedAt)} EAT`, thin];
  if (should("occupancy")) { rows.push("OCCUPANCY & BOOKING SUMMARY", thin, row("Occupancy rate", `${report.occupancy.occupancyRate}%`), row("Room-nights sold", String(report.occupancy.occupiedRoomNights)), row("Arrivals / departures", `${report.occupancy.arrivals} / ${report.occupancy.departures}`), ...report.occupancy.daily.map((d) => row(`  ${d.date}`, `${d.occupied} rooms / ${d.rate}%`)), thin); }
  if (should("revenue")) { rows.push("DEPARTMENTAL REVENUE (UGX)", thin, ...report.revenue.byDepartment.flatMap((d) => [row(`  ${d.department} posted`, d.posted.toLocaleString("en-UG")), row(`  ${d.department} collected`, d.collected.toLocaleString("en-UG"))]), row("TOTAL COLLECTED", report.revenue.collected.toLocaleString("en-UG")), thin); }
  if (should("cashier")) { rows.push("CASHIER RECONCILIATION", thin, ...report.cashier.byMethod.map((m) => row(`  ${m.method} (${m.count})`, m.total.toLocaleString("en-UG"))), ...report.cashier.receipts.map((r) => `  ${r.receiptNo}  ${shortDate(r.issuedAt)}  ${r.staffId}  ${r.totalAmount.toLocaleString("en-UG")} UGX`), thin); }
  if (should("maintenance")) { rows.push("OUT-OF-ORDER / MAINTENANCE LOG", thin, ...report.maintenance.events.map((e) => `  Room ${e.roomNumber}: ${e.previousStatus} -> ${e.newStatus} · ${e.staffId} · ${e.note ?? "No note"}`), row("CURRENT OUT OF ORDER", String(report.maintenance.currentOutOfOrder)), thin); }
  if (section === "all") rows.push("DAILY AUDIT FLAGS", thin, ...report.audit.flags.map((f) => `  • ${f}`), thin);
  rows.push("END OF REPORT · BULOBA HOTEL CRS", line);
  return rows.join("\n");
}

function buildReportCsv(report: ReportData, section: string): string {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows: unknown[][] = [["Buloba Hotel", report.meta.period, report.meta.from, report.meta.to, `department=${report.meta.department}`, `category=${report.meta.category}`], []];
  if (section === "occupancy" || section === "all") rows.push(["OCCUPANCY"], ["Date", "Occupied", "Available", "Rate %"], ...report.occupancy.daily.map((d) => [d.date, d.occupied, d.available, d.rate]), []);
  if (section === "revenue" || section === "all") rows.push(["REVENUE"], ["Department", "Posted UGX", "Collected UGX", "Paid items"], ...report.revenue.byDepartment.map((d) => [d.department, d.posted, d.collected, d.transactions]), [], ["SALES LOG"], ["Date", "Receipt", "Department", "Item", "Amount UGX"], ...report.revenue.items.map((i) => [i.date, i.receiptNo, i.department, i.description, i.amount]), []);
  if (section === "cashier" || section === "all") rows.push(["CASHIER RECONCILIATION"], ["Method", "Transactions", "Total UGX"], ...report.cashier.byMethod.map((m) => [m.method, m.count, m.total]), [], ["Receipt ID", "Date", "Guest", "Room", "Method", "Staff", "Total UGX"], ...report.cashier.receipts.map((r) => [r.receiptNo, r.issuedAt, r.guestName, r.roomNumber ?? "", r.paymentMethod, r.staffId, r.totalAmount]), []);
  if (section === "maintenance" || section === "all") rows.push(["MAINTENANCE LOG"], ["Date", "Room", "From", "To", "Note", "Staff"], ...report.maintenance.events.map((e) => [e.createdAt, e.roomNumber, e.previousStatus, e.newStatus, e.note ?? "", e.staffId]));
  return rows.map((row) => row.map(quote).join(",")).join("\n");
}

function downloadFile(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
function DownloadCsvButton({ text, filename }: { text: string; filename: string }) { return <Button small variant="ghost" className="no-print" onClick={() => downloadFile("\uFEFF" + text, `${filename}.csv`, "text/csv;charset=utf-8")}><Download /> CSV</Button>; }
function DownloadPdfButton({ text, filename }: { text: string; filename: string }) {
  const run = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("courier", "normal"); doc.setFontSize(8);
    const lines = doc.splitTextToSize(text, 180) as string[];
    const pageHeight = doc.internal.pageSize.getHeight(); let y = 16;
    for (const line of lines) { if (y > pageHeight - 14) { doc.addPage(); y = 16; } doc.text(line, 15, y); y += 4; }
    doc.save(`${filename}.pdf`);
  };
  return <Button small variant="gold" className="no-print" onClick={() => void run()}><FileDown /> PDF</Button>;
}
