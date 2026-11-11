"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, CheckCircle2, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { HOTEL, ROLES } from "@/lib/crs";

const ROLE_OPTIONS = ROLES.filter((role) => role !== "Admin/Manager");

export default function OnboardingPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    staffCode: "",
    requestedRole: "Reception",
    password: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Application failed.");
      setSuccess(data.message);
      setForm({ fullName: "", email: "", staffCode: "", requestedRole: "Reception", password: "", reason: "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Application failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1c27] px-5 py-10 text-white">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full border-[70px] border-[#0d6e64]/20" />
      <div className="relative mx-auto grid max-w-5xl items-center gap-10 py-8 lg:grid-cols-[.8fr_1.2fr]">
        <motion.section initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white"><ArrowLeft size={14} /> Back to sign in</Link>
          <div className="mb-6 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-400 font-black text-slate-950">BH</div><div><div className="text-sm font-extrabold tracking-[.16em]">BULOBA HOTEL</div><div className="text-[10px] uppercase tracking-[.18em] text-slate-400">Employee onboarding</div></div></div>
          <h1 className="text-4xl font-black leading-tight tracking-[-.05em]">Create a new employee account.</h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">Recruits submit their details and choose a temporary password. An Admin/Manager reviews the request in the System Administration module; approval immediately activates the staff sign-in.</p>
          <div className="mt-7 space-y-3 text-xs text-slate-300"><div className="flex items-center gap-2"><UserPlus size={14} /> Self-service recruitment application</div><div className="flex items-center gap-2"><ShieldCheck size={14} /> Manager approval before system access</div><div className="flex items-center gap-2"><Building2 size={14} /> {HOTEL.location}</div></div>
          <Link href="/login?demo=1" className="mt-8 inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10">Open demo workspace instantly</Link>
        </motion.section>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }}>
          <Card className="border-white/10 bg-white/95 text-slate-950 shadow-2xl">
            <CardHeader><div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-teal-800"><UserPlus size={12} /> New recruit</div><CardTitle>Employee onboarding form</CardTitle><CardDescription>Use a unique work email and staff code. Admin/Manager accounts cannot be requested here.</CardDescription></CardHeader>
            <CardContent>
              {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"><CheckCircle2 className="mb-2" size={20} /><strong>Application submitted.</strong><p className="mt-2 leading-6">{success}</p><Button asChild className="mt-4"><Link href="/login">Return to sign in</Link></Button></div>
              ) : (
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="fullName">Full name</Label><Input id="fullName" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Rebecca Nalwoga" /></div>
                  <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@bulobahotel.ug" /></div>
                  <div className="space-y-1.5"><Label htmlFor="staffCode">Staff code</Label><Input id="staffCode" required value={form.staffCode} onChange={(e) => setForm({ ...form, staffCode: e.target.value.toUpperCase() })} placeholder="FD-021" /></div>
                  <div className="space-y-1.5"><Label htmlFor="requestedRole">Department role</Label><select id="requestedRole" className="crs-select" value={form.requestedRole} onChange={(e) => setForm({ ...form, requestedRole: e.target.value })}>{ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}</select></div>
                  <div className="space-y-1.5"><Label htmlFor="password">Choose password</Label><Input id="password" type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="reason">Recruitment note (optional)</Label><textarea id="reason" className="crs-textarea" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Role, shift, hiring manager or start date…" /></div>
                  {error && <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
                  <div className="sm:col-span-2"><Button type="submit" className="w-full" disabled={loading}><UserPlus size={15} /> {loading ? "Submitting application…" : "Submit for manager approval"}</Button></div>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
