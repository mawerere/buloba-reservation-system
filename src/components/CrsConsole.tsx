"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BedDouble, Building2, CheckCircle2,
  Clock, CreditCard, DoorOpen, FileBarChart, LayoutDashboard, Lock, LogOut, MapPin,
  Receipt, RefreshCw, Search, ShieldCheck, Sparkles, Terminal, TrendingUp, UserRound,
  Users, Utensils, Wallet, WashingMachine, Wrench, type LucideIcon,
} from "lucide-react";
import CommandConsole, { type ConsoleLine } from "@/components/CommandConsole";
import OfflineBanner from "@/components/OfflineBanner";
import PageTransition from "@/components/PageTransition";
import RoomInventory from "@/components/RoomInventory";
import Admin from "@/components/modules/Admin";
import Finance from "@/components/modules/Finance";
import FoodBeverage from "@/components/modules/FoodBeverage";
import FrontDesk from "@/components/modules/FrontDesk";
import Housekeeping from "@/components/modules/Housekeeping";
import ReportsPanel from "@/components/modules/ReportsPanel";
import { Button, Card, EmptyState, ReceiptModal, StatCard, StatusBadge, Toast } from "@/components/ui";
import type { ActionResult, CommandIntent, ModuleProps, ReportRequest, RunAction } from "@/components/types";
import {
  applyOptimisticAction, cacheState, getCachedState, getPendingCount, queueOfflineAction,
  requestBackgroundSync, syncOutbox,
} from "@/lib/offline";
import {
  compactUgx, dateRangeForPeriod, dateTimeKampala, deriveRoomDisplayStatus, HOTEL,
  isDateKey, isRoomAvailable, parseRoomNumber, ROLE_DEFAULT_MODULE, shortDate, ugx,
  type CrsState, type ModuleId, type PaymentComponent, type ReceiptDetail, type Role,
  type RoomView, type SessionInfo,
} from "@/lib/crs";

type NavItem = { id: ModuleId; label: string; short: string; icon: LucideIcon; roles: readonly Role[] };

function subscribeConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  window.addEventListener("bh:connectivity", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
    window.removeEventListener("bh:connectivity", onChange);
  };
}

function getConnectivitySnapshot() {
  return navigator.onLine;
}

function getServerConnectivitySnapshot() {
  return true;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Command Dashboard", short: "ALL", icon: LayoutDashboard, roles: ["Admin/Manager", "Reception", "Restaurant", "Bar", "Laundry", "Housekeeping", "Finance"] },
  { id: "front-desk", label: "Reception / Front Desk", short: "FD", icon: BedDouble, roles: ["Reception", "Admin/Manager"] },
  { id: "food-beverage", label: "Restaurant & Bar POS", short: "POS", icon: Utensils, roles: ["Restaurant", "Bar", "Admin/Manager"] },
  { id: "housekeeping", label: "Housekeeping & Laundry", short: "HK", icon: WashingMachine, roles: ["Housekeeping", "Laundry", "Reception", "Admin/Manager"] },
  { id: "finance", label: "Finance & Analytics", short: "FIN", icon: Wallet, roles: ["Finance", "Admin/Manager"] },
  { id: "admin", label: "System Administration", short: "ADM", icon: ShieldCheck, roles: ["Admin/Manager"] },
  { id: "reports", label: "Reporting Engine", short: "RPT", icon: FileBarChart, roles: ["Admin/Manager", "Reception", "Restaurant", "Bar", "Laundry", "Housekeeping", "Finance"] },
  { id: "receipts", label: "Receipt Archive", short: "RCP", icon: Receipt, roles: ["Admin/Manager", "Reception", "Restaurant", "Bar", "Finance"] },
];

const REPORT_ALLOWED: Record<Role, string[]> = {
  "Admin/Manager": ["occupancy", "revenue", "cashier", "maintenance", "all"],
  Reception: ["occupancy"],
  Restaurant: ["revenue"],
  Bar: ["revenue"],
  Laundry: ["revenue"],
  Housekeeping: ["maintenance"],
  Finance: ["occupancy", "revenue", "cashier", "maintenance", "all"],
};

const DEFAULT_REPORT_SECTION: Record<Role, string> = {
  "Admin/Manager": "all",
  Reception: "occupancy",
  Restaurant: "revenue",
  Bar: "revenue",
  Laundry: "revenue",
  Housekeeping: "maintenance",
  Finance: "all",
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

async function sendJson<T>(url: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Transaction failed.");
  return data as T;
}

function paymentFromAlias(value?: string): PaymentComponent {
  const alias = (value ?? "CASH").toUpperCase();
  if (alias.startsWith("MTN")) return "MTN Mobile Money";
  if (alias.startsWith("AIRTEL")) return "Airtel Money";
  if (alias.startsWith("VISA")) return "Visa";
  if (alias.startsWith("MASTER")) return "Mastercard";
  return "Cash";
}

function moduleFromAlias(value?: string): ModuleId | null {
  const aliases: Record<string, ModuleId> = {
    DASH: "dashboard", DASHBOARD: "dashboard", HOME: "dashboard", FRONT: "front-desk", FD: "front-desk", RECEPTION: "front-desk",
    FNB: "food-beverage", RESTAURANT: "food-beverage", BAR: "food-beverage", POS: "food-beverage",
    HK: "housekeeping", HOUSEKEEPING: "housekeeping", LAUNDRY: "housekeeping", FINANCE: "finance", FIN: "finance",
    ADMIN: "admin", REPORTS: "reports", REPORT: "reports", RECEIPTS: "receipts", RECEIPT: "receipts",
  };
  return aliases[(value ?? "").toUpperCase()] ?? null;
}

function sectionFromAlias(value?: string): string {
  const aliases: Record<string, string> = { OCCUPANCY: "occupancy", BOOKINGS: "occupancy", REVENUE: "revenue", SALES: "revenue", CASHIER: "cashier", RECONCILIATION: "cashier", MAINTENANCE: "maintenance", MAINT: "maintenance", AUDIT: "all", ALL: "all" };
  return aliases[(value ?? "OCCUPANCY").toUpperCase()] ?? "occupancy";
}

function initialLines(state: CrsState, session: SessionInfo): ConsoleLine[] {
  return [
    { id: 1, tone: "ok", text: `BULOBA HOTEL CRS v3.0 ONLINE · ${HOTEL.location} · 100-room inventory ready` },
    { id: 2, tone: "info", text: `Authenticated: ${session.staffName} · ${session.role} · ${session.staffId} · ${dateTimeKampala(state.generatedAt)} EAT` },
    { id: 3, tone: "info", text: `LIVE: ${state.stats.inHouse} in-house · ${state.stats.reservations} reserved · ${state.stats.outOfOrder} out of order · ${ugx(state.stats.collectedToday)} collected today` },
    { id: 4, tone: "cmd", text: "Offline cache: Dexie/IndexedDB · Workbox background sync ready. Type HELP for commands." },
  ];
}

export default function CrsConsole({ initialState, session }: { initialState: CrsState; session: SessionInfo }) {
  const router = useRouter();
  const role = session.role;
  const staffId = session.staffId;
  const [state, setState] = useState(initialState);
  const [module, setModule] = useState<ModuleId>(ROLE_DEFAULT_MODULE[role]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [lines, setLines] = useState<ConsoleLine[]>(() => initialLines(initialState, session));
  const lineIdRef = useRef(10);
  const [intent, setIntent] = useState<CommandIntent>(null);
  const [clock, setClock] = useState(initialState.generatedAt);
  const [receiptSearch, setReceiptSearch] = useState("");
  const online = useSyncExternalStore(subscribeConnectivity, getConnectivitySnapshot, getServerConnectivitySnapshot);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [reportRequest, setReportRequest] = useState<ReportRequest>({
    period: "daily",
    section: DEFAULT_REPORT_SECTION[role],
    department: "All",
    category: "All",
    from: initialState.stats.today,
    to: initialState.stats.today,
    nonce: 1,
  });

  const notify = (message: string, type: "success" | "error" = "success") => setToast({ message, type });
  const pushLines = (texts: string[], tone: ConsoleLine["tone"] = "info") => setLines((current) => [...current, ...texts.map((text) => ({ id: lineIdRef.current++, text, tone }))].slice(-140));
  const pushLine = (text: string, tone: ConsoleLine["tone"] = "info") => pushLines([text], tone);

  const refresh = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = await getCachedState();
      if (cached) setState(cached);
      return;
    }
    const data = await fetchJson<{ state: CrsState }>("/api/state");
    setState(data.state);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date().toISOString()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => { void cacheState(state); }, [state]);
  useEffect(() => {
    let mounted = true;
    void getPendingCount().then((count) => { if (mounted) setPending(count); });
    if (!navigator.onLine) void getCachedState().then((cached) => { if (mounted && cached) setState(cached); });
    const syncUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ pending?: number; synced?: number }>).detail;
      if (typeof detail?.pending === "number") setPending(detail.pending);
      if (detail?.synced) setLastSync(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    };
    const refreshEvent = () => { void refresh(); };
    window.addEventListener("bh:sync-update", syncUpdate);
    window.addEventListener("bh:refresh", refreshEvent);
    return () => { mounted = false; window.removeEventListener("bh:sync-update", syncUpdate); window.removeEventListener("bh:refresh", refreshEvent); };
  }, []);

  const openReceipt = async (id: number) => {
    if (!navigator.onLine) { notify("Receipts will be available after the offline queue syncs.", "error"); return; }
    try {
      const data = await fetchJson<{ receipt: ReceiptDetail }>(`/api/receipts/${id}`);
      setReceipt(data.receipt);
      pushLine(`RECEIPT ${data.receipt.receiptNo} loaded · ${ugx(data.receipt.totalAmount)}`, "ok");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Receipt unavailable.", "error");
    }
  };

  const run: RunAction = async (payload) => {
    const body = { ...payload.body, role, staffId };
    setBusy(true);
    try {
      if (!navigator.onLine) {
        const action = {
          clientRef: globalThis.crypto.randomUUID(),
          url: payload.url,
          method: payload.method ?? "POST" as "POST" | "PATCH",
          body,
          createdAt: new Date().toISOString(),
          status: "pending" as const,
        };
        await queueOfflineAction(action);
        setState((current) => applyOptimisticAction(current, action));
        const count = await getPendingCount();
        setPending(count);
        await requestBackgroundSync();
        const message = `OFFLINE · ${payload.method ?? "POST"} ${payload.url} saved to IndexedDB and queued for background sync.`;
        notify(message, "success"); pushLine(message, "ok");
        return { ok: true, message, receiptId: null };
      }
      const result = await sendJson<ActionResult>(payload.url, payload.method ?? "POST", body);
      await refresh();
      const message = payload.success ?? result.message;
      if (!payload.quiet) { notify(message, "success"); pushLine(`OK · ${message}`, "ok"); }
      if (result.receiptId && payload.openReceipt !== false) await openReceipt(result.receiptId);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaction failed.";
      notify(message, "error"); pushLine(`ERROR · ${message}`, "err");
      return null;
    } finally { setBusy(false); }
  };

  const goTo = (target: ModuleId) => {
    const item = NAV.find((nav) => nav.id === target);
    if (!item || !item.roles.includes(role)) {
      notify(`${role} is not authorized for ${item?.label ?? target}.`, "error");
      pushLine(`ACCESS DENIED · ${role} cannot open ${target}.`, "err");
      return;
    }
    setModule(target);
    pushLine(`MODULE ${target.toUpperCase()} · ${item.label}`, "info");
  };

  const openReports = (section: string, period?: string) => {
    if (!REPORT_ALLOWED[role].includes(section)) { notify(`${role} is not authorized to generate this report.`, "error"); return; }
    const nextPeriod = period ?? reportRequest.period;
    const range = dateRangeForPeriod(nextPeriod, reportRequest.from, reportRequest.to, state.stats.today);
    setReportRequest({ period: nextPeriod, section, department: reportRequest.department, category: reportRequest.category, from: range.from, to: range.to, nonce: reportRequest.nonce + 1 });
    setModule("reports");
    pushLine(`REPORT ${nextPeriod.toUpperCase()} / ${section.toUpperCase()} · ${range.from} → ${range.to}`, "ok");
  };

  const manualSync = async () => {
    if (!navigator.onLine) { notify("Still offline. Transactions remain queued locally.", "error"); return; }
    setSyncing(true);
    try {
      const result = await syncOutbox();
      setPending(result.pending);
      if (result.synced) setLastSync(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      await refresh();
      pushLine(`SYNC · ${result.synced} uploaded, ${result.failed} failed, ${result.pending} still queued.`, result.failed ? "err" : "ok");
      notify(`Sync complete: ${result.synced} transaction(s) uploaded.`, result.failed ? "error" : "success");
    } finally { setSyncing(false); }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login"); router.refresh();
  };

  const executeCommand = async (raw: string) => {
    const trimmed = raw.trim(); if (!trimmed) return;
    pushLine(`crs@${staffId}:~$ ${trimmed}`, "cmd");
    const [command, ...args] = trimmed.split(/\s+/);
    const cmd = command.toUpperCase();
    try {
      switch (cmd) {
        case "HELP": pushLines(["COMMAND INDEX", "  STATUS | ROOMS [CLEAN|DIRTY|MAINT] | ROOM <101-200>", "  AVAIL <YYYY-MM-DD> <YYYY-MM-DD> | BOOK <room> | FOLIO <room>", "  CHECKIN <id> | CHECKOUT <id> <method> | SETTLE <id> <method> | CANCEL <id>", "  CLEAN|DIRTY <room> [note] | MAINT <room> <reason>", "  RECEIPT <id> | RECEIPTS | REPORT <DAILY|WEEKLY|MONTHLY> <section>", "  REPORT CUSTOM <from> <to> <section> | AUDIT | GOTO <alias> | REFRESH | CLEAR", "  Payment aliases: CASH, MTN, AIRTEL, VISA, MASTERCARD"]); break;
        case "CLEAR": setLines([{ id: lineIdRef.current++, text: "Console cleared. Type HELP for commands.", tone: "info" }]); break;
        case "STATUS": pushLines([`BULOBA HOTEL · ${state.stats.today} · ${state.stats.totalRooms} rooms`, `In-house ${state.stats.inHouse} | Reserved ${state.stats.reservations} | Ready ${state.stats.readyRooms} | Cleaning ${state.stats.dirtyRooms} | Out-of-order ${state.stats.outOfOrder}`, `Collected today ${ugx(state.stats.collectedToday)} | Open folios ${ugx(state.stats.openFolio)} | Pending offline ${pending}`], "ok"); break;
        case "ROOMS": { const filter = (args[0] ?? "ALL").toUpperCase(); const rooms = state.rooms.filter((room) => { const d = deriveRoomDisplayStatus(room, state.bookings, state.stats.today).toUpperCase(); return filter === "ALL" || d.includes(filter.replace("MAINT", "MAINTENANCE")) || (filter === "OCCUPIED" && d === "OCCUPIED"); }); pushLines([`${rooms.length} rooms match ${filter}.`, rooms.slice(0, 30).map((r) => String(r.number)).join("  ") || "None"]); break; }
        case "ROOM": { const number = parseRoomNumber(args[0]); const room = state.rooms.find((r) => r.number === number); if (!room) throw new Error(`Room ${number} not found.`); pushLines([`ROOM ${number} · ${room.category} · ${deriveRoomDisplayStatus(room, state.bookings, state.stats.today)} · ${ugx(room.rate)}/night`, `Note: ${room.statusNote ?? "—"}`], "ok"); break; }
        case "AVAIL": { if (!isDateKey(args[0]) || !isDateKey(args[1])) throw new Error("Usage: AVAIL <from> <to>"); if (args[0] >= args[1]) throw new Error("Check-out must be after check-in."); const available = state.rooms.filter((r) => isRoomAvailable(r, state.bookings, args[0], args[1])); pushLines([`${available.length} rooms available ${args[0]} → ${args[1]}.`, available.slice(0, 30).map((r) => String(r.number)).join("  ")], "ok"); break; }
        case "BOOK": case "FOLIO": { if (role !== "Reception" && role !== "Admin/Manager") throw new Error("Reception credentials required."); const roomNumber = parseRoomNumber(args[0]); setIntent((current) => ({ kind: cmd === "BOOK" ? "book" : "folio", roomNumber, nonce: (current?.nonce ?? 0) + 1 })); goTo("front-desk"); break; }
        case "CHECKIN": { if (role !== "Reception" && role !== "Admin/Manager") throw new Error("Reception credentials required."); await run({ url: `/api/bookings/${Number(args[0])}`, method: "PATCH", body: { action: "check-in" } }); break; }
        case "CHECKOUT": { if (role !== "Reception" && role !== "Admin/Manager") throw new Error("Reception credentials required."); await run({ url: `/api/bookings/${Number(args[0])}`, method: "PATCH", body: { action: "check-out", paymentMethod: paymentFromAlias(args[1]) } }); break; }
        case "SETTLE": { if (!["Reception", "Admin/Manager", "Finance"].includes(role)) throw new Error("Reception or Finance credentials required."); await run({ url: "/api/payments", body: { bookingId: Number(args[0]), paymentMethod: paymentFromAlias(args[1]) } }); break; }
        case "CANCEL": { if (role !== "Reception" && role !== "Admin/Manager") throw new Error("Reception credentials required."); await run({ url: `/api/bookings/${Number(args[0])}`, method: "PATCH", body: { action: "cancel" } }); break; }
        case "CLEAN": case "DIRTY": case "MAINT": { if (!["Housekeeping", "Reception", "Admin/Manager"].includes(role)) throw new Error("Housekeeping/Reception credentials required."); const number = parseRoomNumber(args[0]); const note = args.slice(1).join(" "); const status = cmd === "CLEAN" ? "Clean" : cmd === "DIRTY" ? "Dirty" : "Under Maintenance"; if (status === "Under Maintenance" && !note) throw new Error("Usage: MAINT <room> <reason>"); await run({ url: `/api/rooms/${number}`, method: "PATCH", body: { status, note: note || undefined } }); break; }
        case "RECEIPT": await openReceipt(Number(args[0])); break;
        case "RECEIPTS": pushLines([`Latest ${Math.min(5, state.receipts.length)} receipts:`, ...state.receipts.slice(0, 5).map((r) => `#${r.id} ${r.receiptNo} · ${r.guestName} · ${ugx(r.totalAmount)}`)]); break;
        case "REPORT": { const period = (args[0] ?? "DAILY").toLowerCase(); if (period === "custom" && isDateKey(args[1]) && isDateKey(args[2])) { const section = sectionFromAlias(args[3]); if (!REPORT_ALLOWED[role].includes(section)) throw new Error(`${role} is not authorized for ${section} reports.`); setReportRequest({ period: "custom", section, department: reportRequest.department, category: reportRequest.category, from: args[1], to: args[2], nonce: reportRequest.nonce + 1 }); setModule("reports"); } else { const section = ["daily", "weekly", "monthly", "custom"].includes(period) ? sectionFromAlias(args[1]) : sectionFromAlias(args[0]); openReports(section, ["daily", "weekly", "monthly", "custom"].includes(period) ? period : "daily"); } break; }
        case "AUDIT": openReports("all", "daily"); break;
        case "GOTO": { const target = moduleFromAlias(args[0]); if (!target) throw new Error("Unknown module alias."); goTo(target); break; }
        case "REFRESH": await manualSync(); await refresh(); break;
        default: pushLine(`UNKNOWN COMMAND "${command}". Type HELP.`, "err");
      }
    } catch (error) { pushLine(`ERROR · ${error instanceof Error ? error.message : "Command failed."}`, "err"); notify(error instanceof Error ? error.message : "Command failed.", "error"); }
  };

  const activeNav = NAV.find((item) => item.id === module);
  const hasAccess = activeNav?.roles.includes(role) ?? false;
  const moduleProps: ModuleProps = { state, session, role, staffId, busy, run, openReceipt, openReports, goTo, intent };

  const renderDashboard = () => {
    const arrivals = state.bookings.filter((b) => b.checkIn === state.stats.today && b.status !== "Cancelled");
    const departures = state.bookings.filter((b) => b.checkOut === state.stats.today && b.status !== "Cancelled");
    const quick: { label: string; icon: LucideIcon; target: ModuleId }[] = [
      { label: "Room allocation", icon: Search, target: "front-desk" },
      { label: "Department POS", icon: Utensils, target: "food-beverage" },
      { label: "Room status", icon: Sparkles, target: "housekeeping" },
      { label: "Executive analytics", icon: TrendingUp, target: "reports" },
    ];
    return (
      <div className="crs-section-grid">
        <section className="crs-hero"><div className="crs-hero-grid"><div><div className="crs-eyebrow" style={{ color: "#e6bd61" }}>Offline-first property operations · CRS v3.0</div><h2>Buloba Hotel, Kiwesa</h2><p>Welcome back, {session.staffName}. A unified 100-room reservation, POS, housekeeping and finance platform with signed sessions, Workbox caching and Dexie background sync.</p><div className="crs-hero-badges"><span className="crs-hero-badge"><span className="crs-online-dot" /> {online ? "LIVE SYNC ONLINE" : "OFFLINE OUTBOX ACTIVE"}</span><span className="crs-hero-badge">ROOMS 101–200</span><span className="crs-hero-badge">MTN / AIRTEL / CARD / CASH</span><span className="crs-hero-badge">VAT {state.settings.vatBps / 100}%</span></div></div><div className="crs-occupancy-ring" style={{ background: `conic-gradient(#d3a343 ${state.stats.occupancyRate}%, rgba(255,255,255,.12) 0)` }}><div><strong>{state.stats.occupancyRate}%</strong><span>Occupancy</span></div></div></div></section>
        <div className="crs-page-head" style={{ marginBottom: 0 }}><div><div className="crs-eyebrow">Live property snapshot</div><h1 className="crs-h1">Command Dashboard</h1><p className="crs-subtle">Signed in as {session.staffName} · {session.role} · {session.staffId}</p></div><span className="crs-chip chip-clean"><Activity size={12} /> Synced {dateTimeKampala(state.generatedAt)} EAT</span></div>
        <div className="crs-stats"><StatCard label="In-house" value={state.stats.inHouse} hint="Checked-in rooms" icon={<BedDouble size={13} />} tone="teal" /><StatCard label="Ready rooms" value={state.stats.readyRooms} hint="Clean & unoccupied" icon={<DoorOpen size={13} />} /><StatCard label="Reservations" value={state.stats.reservations} hint="Pending arrivals" icon={<Users size={13} />} /><StatCard label="Collected today" value={compactUgx(state.stats.collectedToday)} hint={`${state.stats.receiptsToday} receipts`} icon={<Wallet size={13} />} tone="gold" /><StatCard label="Open folios" value={compactUgx(state.stats.openFolio)} hint="Unsettled charges" icon={<CreditCard size={13} />} /><StatCard label="Out of order" value={state.stats.outOfOrder} hint="Under maintenance" icon={<Wrench size={13} />} /></div>
        <Card title="Quick departmental actions" description="Available targets respect your authenticated role." icon={<ArrowRight size={15} />} bodyClass="tight"><div className="crs-quick-grid">{quick.map((action) => { const Icon = action.icon; return <button key={action.label} className="crs-quick" onClick={() => goTo(action.target)}><Icon size={15} /> {action.label}<ArrowRight size={13} style={{ marginLeft: "auto" }} /></button>; })}</div></Card>
        <RoomInventory state={state} onInspect={(room: RoomView) => pushLine(`ROOM ${room.number} · ${room.category} · ${deriveRoomDisplayStatus(room, state.bookings, state.stats.today)} · ${ugx(room.rate)}/night`)} />
        <div className="crs-two-col"><Card title="Today's operations queue" icon={<Clock size={15} />}><div className="crs-eyebrow">Arrivals ({arrivals.length})</div>{arrivals.slice(0, 4).map((b) => <div className="crs-kv" key={`a${b.id}`}><span>{b.guestName} · {b.roomNumber}</span><span><StatusBadge status={b.status} /></span></div>)}{!arrivals.length && <div className="crs-subtle">No arrivals.</div>}<div className="crs-eyebrow" style={{ marginTop: 14 }}>Departures ({departures.length})</div>{departures.slice(0, 4).map((b) => <div className="crs-kv" key={`d${b.id}`}><span>{b.guestName} · {b.roomNumber}</span><span>{ugx(b.folioBalance)}</span></div>)}{!departures.length && <div className="crs-subtle">No departures.</div>}</Card><Card title="System audit trail" icon={<Terminal size={15} />}><div className="crs-table-wrap"><table className="crs-table"><thead><tr><th>Time</th><th>Action</th><th>Details</th><th>Staff</th></tr></thead><tbody>{state.audits.slice(0, 8).map((a) => <tr key={a.id}><td className="crs-mono muted">{shortDate(a.createdAt)}</td><td className="strong">{a.action}</td><td>{a.details}</td><td className="crs-mono">{a.staffId}</td></tr>)}</tbody></table></div></Card></div>
      </div>
    );
  };

  const renderReceipts = () => {
    const query = receiptSearch.trim().toLowerCase();
    const filtered = state.receipts.filter((r) => [r.receiptNo, r.guestName, r.paymentMethod, r.department, r.staffName, String(r.roomNumber ?? "")].join(" ").toLowerCase().includes(query));
    return <div className="crs-section-grid"><div className="crs-page-head" style={{ marginBottom: 0 }}><div><div className="crs-eyebrow">Financial documents</div><h1 className="crs-h1">Official Receipt Archive</h1><p className="crs-subtle">VAT, room category, staff name and split-payment allocations are persisted on each receipt.</p></div><span className="crs-chip chip-clean"><Receipt size={12} /> {state.receipts.length} receipts</span></div><Card title="Search & reprint" icon={<Receipt size={15} />}><div className="crs-inline" style={{ marginBottom: 14 }}><input className="crs-input" style={{ maxWidth: 440 }} value={receiptSearch} onChange={(e) => setReceiptSearch(e.target.value)} placeholder="Search receipt, guest, room, method or staff…" /><Button variant="ghost" onClick={() => setReceiptSearch("")}>Clear</Button></div><div className="crs-table-wrap"><table className="crs-table"><thead><tr><th>Receipt ID</th><th>Guest / room</th><th>Category</th><th>Method</th><th>VAT</th><th>Staff</th><th className="num">Total</th><th /></tr></thead><tbody>{filtered.map((r) => <tr key={r.id}><td className="crs-mono strong">{r.receiptNo}</td><td>{r.guestName}{r.roomNumber ? ` · ${r.roomNumber}` : " · Walk-in"}</td><td>{r.roomCategory ?? "—"}</td><td>{r.paymentMethod}</td><td>{ugx(r.vatAmount)}</td><td>{r.staffName}</td><td className="num strong">{ugx(r.totalAmount)}</td><td><Button small variant="gold" onClick={() => openReceipt(r.id)}>Open</Button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState>No receipts match this search.</EmptyState>}</div></Card></div>;
  };

  const renderModule = (): ReactNode => {
    if (!hasAccess) return <Card title="Access restricted" icon={<Lock size={15} />} className="crs-access"><div style={{ padding: 22, textAlign: "center" }}><ShieldCheck size={32} color="#0d6e64" /><h2 style={{ margin: "12px 0 6px" }}>{activeNav?.label}</h2><p className="crs-subtle">Your authenticated role <strong>{role}</strong> is not authorized for this module. Sign in with an authorized staff account to continue.</p><Button onClick={() => goTo("dashboard")} style={{ marginTop: 14 }}>Return to dashboard</Button></div></Card>;
    switch (module) {
      case "dashboard": return renderDashboard();
      case "front-desk": return <FrontDesk key={intent?.nonce ?? "default"} {...moduleProps} />;
      case "food-beverage": return <FoodBeverage {...moduleProps} />;
      case "housekeeping": return <Housekeeping {...moduleProps} />;
      case "finance": return <Finance {...moduleProps} />;
      case "admin": return <Admin {...moduleProps} />;
      case "reports": return <ReportsPanel role={role} state={state} request={reportRequest} setRequest={setReportRequest} openReceipt={openReceipt} />;
      case "receipts": return renderReceipts();
      default: return renderDashboard();
    }
  };

  return (
    <div className="crs-shell">
      <aside className="crs-sidebar"><div className="crs-brand"><div className="crs-brand-mark">BH</div><div><div className="crs-brand-name">BULOBA HOTEL</div><div className="crs-brand-sub">CRS · Kiwesa Wakiso</div></div></div><div><div className="crs-nav-label">Authenticated modules</div><nav className="crs-nav">{NAV.map((item) => { const Icon = item.icon; const allowed = item.roles.includes(role); return <button key={item.id} className={`crs-nav-item ${module === item.id ? "active" : ""}`} disabled={!allowed} onClick={() => goTo(item.id)}><Icon size={16} /> {item.label}<span className="nav-tail">{allowed ? item.short : <Lock size={11} />}</span></button>; })}</nav></div><div className="crs-sidebar-foot"><div><span className="crs-online-dot" /> Signed session · {session.staffId}</div><div>{session.staffName}</div><div>{session.role}</div><div>Dexie cache · Workbox SW</div></div></aside>
      <div className="crs-main"><header className="crs-topbar"><div><div className="crs-topbar-title">{activeNav?.label ?? "Buloba Hotel CRS"}</div><div className="crs-topbar-sub"><MapPin size={11} /> {HOTEL.location} · <Clock size={11} /> {dateTimeKampala(clock)} EAT</div></div><div className="crs-topbar-controls"><span className="crs-chip chip-neutral"><UserRound size={12} /> {session.staffName} · {session.role}</span><button className="crs-icon-btn" onClick={() => void manualSync()} disabled={syncing || !online} title="Sync offline outbox"><RefreshCw size={14} /></button><span className={`crs-chip ${online ? "chip-clean" : "chip-dirty"}`}><CheckCircle2 size={12} /> {online ? "ONLINE" : "OFFLINE"}</span><Button variant="ghost" small onClick={logout}><LogOut /> Sign out</Button></div></header><main className="crs-content"><OfflineBanner online={online} pending={pending} syncing={syncing} lastSync={lastSync} onSync={() => void manualSync()} /><PageTransition transitionKey={module}>{renderModule()}</PageTransition><div style={{ marginTop: 20 }}><CommandConsole lines={lines} onCommand={executeCommand} role={role} staffId={staffId} /></div></main></div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
