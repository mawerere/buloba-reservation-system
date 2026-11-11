"use client";

import { useState } from "react";
import { Building2, Check, ClipboardList, ExternalLink, Save, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { Button, Card, Field, StatCard } from "@/components/ui";
import type { ModuleProps } from "@/components/types";
import { ROLES, ugx, vatLabel, type Role, type SettingsView, type StaffApplicationView } from "@/lib/crs";

type Tab = "applications" | "staff" | "settings";

export default function Admin(props: ModuleProps) {
  const { state, session, busy, run, openReports } = props;
  const [tab, setTab] = useState<Tab>("applications");
  const [settingsDraft, setSettingsDraft] = useState<SettingsView | null>(null);
  const settings = settingsDraft ?? state.settings;
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    email: "",
    staffCode: "",
    role: "Reception" as Role,
    password: "",
  });
  const pending = state.applications.filter((application) => application.status === "Pending");
  const updateSettings = (key: keyof SettingsView, value: string | number) =>
    setSettingsDraft((current) => ({ ...(current ?? state.settings), [key]: value }));

  const saveSettings = async () => {
    const result = await run({ url: "/api/admin/settings", method: "PATCH", body: { ...settings } });
    if (result) setSettingsDraft(null);
  };

  const createStaff = async () => {
    const result = await run({ url: "/api/admin/staff", body: { ...staffForm } });
    if (result) setStaffForm({ fullName: "", email: "", staffCode: "", role: "Reception", password: "" });
  };

  const toggleStaff = (id: number, active: boolean) => run({ url: "/api/admin/staff", method: "PATCH", body: { id, active } });

  const reviewApplication = (id: number, action: "approve" | "reject") =>
    run({ url: "/api/admin/applications", method: "PATCH", body: { id, action } });

  return (
    <div className="crs-section-grid">
      <div className="crs-page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="crs-eyebrow">Administration · {session.staffName}</div>
          <h1 className="crs-h1">Staff, Recruitment & System Settings</h1>
          <p className="crs-subtle">Approve recruited employees, create accounts directly, manage room rates, VAT and property details.</p>
        </div>
        <div className="crs-inline">
          <a className="crs-btn ghost small" href="/onboard" target="_blank" rel="noreferrer"><ExternalLink /> Public onboarding form</a>
          <Button variant="gold" onClick={() => openReports("all", "monthly")}><ShieldCheck /> Monthly executive audit</Button>
        </div>
      </div>

      <div className="crs-stats" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Pending recruits" value={pending.length} hint={`${state.applications.length} total applications`} icon={<ClipboardList size={13} />} tone="gold" />
        <StatCard label="Active staff" value={state.staff.filter((item) => item.active).length} hint={`${state.staff.length} total accounts`} icon={<Users size={13} />} tone="teal" />
        <StatCard label="VAT rate" value={vatLabel(state.settings.vatBps)} hint="Applied to official receipts" icon={<ShieldCheck size={13} />} />
        <StatCard label="Collected today" value={ugx(state.stats.collectedToday)} hint={`${state.stats.receiptsToday} receipts`} icon={<Save size={13} />} />
      </div>

      <div className="crs-card">
        <div className="crs-tabs no-print">
          <button className={`crs-tab ${tab === "applications" ? "active" : ""}`} onClick={() => setTab("applications")}><ClipboardList size={13} /> Recruitment applications ({pending.length})</button>
          <button className={`crs-tab ${tab === "staff" ? "active" : ""}`} onClick={() => setTab("staff")}><Users size={13} /> Staff management</button>
          <button className={`crs-tab ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}><Building2 size={13} /> Rates & system settings</button>
        </div>

        {tab === "applications" && (
          <div className="crs-card-body">
            <div className="crs-note" style={{ marginBottom: 14 }}>
              New recruits apply at <a className="crs-file-link" href="/onboard" target="_blank" rel="noreferrer">/onboard</a>. Approval creates an active staff account using the email, staff code and password they supplied; no password is shown to administrators.
            </div>
            <div className="crs-table-wrap">
              <table className="crs-table">
                <thead><tr><th>Applicant</th><th>Staff code</th><th>Requested role</th><th>Reason</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead>
                <tbody>
                  {state.applications.map((application) => <ApplicationRow key={application.id} application={application} busy={busy} onReview={reviewApplication} />)}
                </tbody>
              </table>
              {!state.applications.length && <div className="crs-empty">No recruitment applications yet. Share the public onboarding link with a new hire.</div>}
            </div>
          </div>
        )}

        {tab === "staff" && (
          <div className="crs-card-body">
            <div className="crs-two-col">
              <Card title="Create employee account directly" description="Use this for an immediate hire; passwords are salted scrypt hashes." icon={<UserPlus size={15} />}>
                <div className="crs-form-grid">
                  <Field label="Full name"><input className="crs-input" value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })} /></Field>
                  <Field label="Staff email"><input className="crs-input" type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></Field>
                  <Field label="Staff code"><input className="crs-input crs-mono" value={staffForm.staffCode} onChange={(e) => setStaffForm({ ...staffForm, staffCode: e.target.value.toUpperCase() })} placeholder="FD-021" /></Field>
                  <Field label="Department role"><select className="crs-select" value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as Role })}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></Field>
                  <Field label="Temporary password" hint="Minimum 8 characters"><input className="crs-input" type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} /></Field>
                </div>
                <Button block loading={busy} onClick={createStaff} style={{ marginTop: 14 }}><UserPlus /> Create active employee account</Button>
              </Card>
              <Card title="Staff register" description="Deactivate accounts instantly; active status is checked on every request." icon={<Users size={15} />}>
                <div className="crs-table-wrap crs-scroll-list">
                  <table className="crs-table">
                    <thead><tr><th>Name</th><th>Code</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {state.staff.map((item) => (
                        <tr key={item.id}>
                          <td><div className="strong">{item.fullName}</div><div className="muted">{item.email}</div></td>
                          <td className="crs-mono">{item.staffCode}</td><td>{item.role}</td>
                          <td><span className={`crs-chip ${item.active ? "chip-paid" : "chip-cancelled"}`}>{item.active ? "Active" : "Inactive"}</span></td>
                          <td><Button small variant={item.active ? "danger" : "primary"} loading={busy} disabled={item.id === session.staffDbId} onClick={() => toggleStaff(item.id, !item.active)}>{item.active ? "Deactivate" : "Reactivate"}</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="crs-card-body">
            <div className="crs-two-col">
              <Card title="Property & tax settings" description="Contact details appear on receipt headers; VAT is stored per receipt." icon={<Building2 size={15} />}>
                <div className="crs-form-grid">
                  <Field label="Hotel name"><input className="crs-input" value={settings.hotelName} onChange={(e) => updateSettings("hotelName", e.target.value)} /></Field>
                  <Field label="Location"><input className="crs-input" value={settings.location} onChange={(e) => updateSettings("location", e.target.value)} /></Field>
                  <Field label="Contact phone"><input className="crs-input" value={settings.contactPhone} onChange={(e) => updateSettings("contactPhone", e.target.value)} /></Field>
                  <Field label="Contact email"><input className="crs-input" value={settings.contactEmail} onChange={(e) => updateSettings("contactEmail", e.target.value)} /></Field>
                  <Field label="VAT basis points" hint="1800 = 18.00%"><input className="crs-input crs-mono" type="number" min={0} max={10000} value={settings.vatBps} onChange={(e) => updateSettings("vatBps", Number(e.target.value))} /></Field>
                  <Field label="Service charge basis points"><input className="crs-input crs-mono" type="number" min={0} max={10000} value={settings.serviceChargeBps} onChange={(e) => updateSettings("serviceChargeBps", Number(e.target.value))} /></Field>
                </div>
                <div className="crs-divider" />
                <div className="crs-eyebrow">Category nightly rates (UGX)</div>
                <div className="crs-form-grid three" style={{ marginTop: 10 }}>
                  <Field label="Standard"><input className="crs-input crs-mono" type="number" value={settings.standardRate} onChange={(e) => updateSettings("standardRate", Number(e.target.value))} /></Field>
                  <Field label="Deluxe"><input className="crs-input crs-mono" type="number" value={settings.deluxeRate} onChange={(e) => updateSettings("deluxeRate", Number(e.target.value))} /></Field>
                  <Field label="Suite"><input className="crs-input crs-mono" type="number" value={settings.suiteRate} onChange={(e) => updateSettings("suiteRate", Number(e.target.value))} /></Field>
                </div>
                <Button block variant="gold" loading={busy} onClick={saveSettings} style={{ marginTop: 14 }}><Save /> Save settings & update 100 room rates</Button>
              </Card>
              <Card title="System health" description="Deployment and offline-readiness overview." icon={<ShieldCheck size={15} />}>
                <div className="crs-scroll-list">
                  <div className="crs-kv"><span>Interface preview</span><span>One-click signed demo session</span></div>
                  <div className="crs-kv"><span>Employee onboarding</span><span>Public application + admin approval</span></div>
                  <div className="crs-kv"><span>Local store</span><span>Dexie / IndexedDB</span></div>
                  <div className="crs-kv"><span>Service worker</span><span>Workbox runtime + background sync</span></div>
                  <div className="crs-kv"><span>Database</span><span>PostgreSQL / Drizzle ORM</span></div>
                  <div className="crs-kv"><span>Current VAT</span><span>{vatLabel(settings.vatBps)}</span></div>
                  <div className="crs-kv"><span>Signed in as</span><span>{session.staffName} ({session.staffId})</span></div>
                </div>
                <div className="crs-note" style={{ marginTop: 14 }}>Rate changes apply to future reservations. Existing booking nightly rates and issued receipts remain unchanged for audit integrity.</div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationRow({
  application,
  busy,
  onReview,
}: {
  application: StaffApplicationView;
  busy: boolean;
  onReview: (id: number, action: "approve" | "reject") => void;
}) {
  const chip = application.status === "Pending" ? "chip-reserved" : application.status === "Approved" ? "chip-paid" : "chip-cancelled";
  return (
    <tr>
      <td><div className="strong">{application.fullName}</div><div className="muted">{application.email}</div></td>
      <td className="crs-mono">{application.staffCode}</td>
      <td>{application.requestedRole}</td>
      <td>{application.reason ?? "—"}</td>
      <td className="crs-mono muted">{application.createdAt.slice(0, 10)}</td>
      <td><span className={`crs-chip ${chip}`}>{application.status}</span>{application.reviewedBy && <div className="muted crs-mono">{application.reviewedBy}</div>}</td>
      <td>
        <div className="crs-inline">
          <Button small loading={busy} disabled={application.status !== "Pending"} onClick={() => onReview(application.id, "approve")}><Check /> Approve</Button>
          <Button small variant="danger" loading={busy} disabled={application.status !== "Pending"} onClick={() => onReview(application.id, "reject")}><X /> Reject</Button>
        </div>
      </td>
    </tr>
  );
}
