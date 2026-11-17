"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2, KeyRound, LockKeyhole, MapPin, UserPlus,
} from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { HOTEL } from "@/lib/crs";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nextPath = () => {
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    return next.startsWith("/") ? next : "/";
  };

  const signIn = async (loginEmail: string, loginPassword: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Login failed.");
      router.push(nextPath());
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed.");
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void signIn(email, password);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1c27] px-5 py-10 text-white">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full border-[70px] border-[#d3a343]/10" />
      <div className="pointer-events-none absolute -bottom-52 -right-40 h-[560px] w-[560px] rounded-full border-[80px] border-[#0d6e64]/20" />
      <div className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
        <motion.section initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5 }}>
          <div className="mb-8 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-400 font-black text-slate-950">BH</div><div><div className="text-sm font-extrabold tracking-[.16em]">BULOBA HOTEL</div><div className="text-[10px] uppercase tracking-[.18em] text-slate-400">Management & CRS</div></div></div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-[.22em] text-amber-300">Offline-first property operations</p>
          <h1 className="max-w-xl text-5xl font-black leading-[1.03] tracking-[-.05em] md:text-6xl">Access your workspace.</h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-slate-300">Employees can sign in with their own credentials, and new recruits can request an account for manager approval.</p>
          <div className="mt-9 flex items-center gap-2 text-xs text-slate-400"><MapPin size={13} /> {HOTEL.location} · 100 rooms · Rooms 101–200</div>
        </motion.section>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .12 }}>
          <Card className="border-white/10 bg-white/95 text-slate-950 shadow-2xl">
            <CardHeader className="pb-4">
              <CardTitle>Buloba CRS access</CardTitle>
              <CardDescription>Sign in as staff or start a new employee application.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <Button asChild variant="outline" className="w-full"><Link href="/onboard"><UserPlus size={15} /> New employee? Create account</Link></Button>
              </div>
              <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">or staff sign in</span><div className="h-px flex-1 bg-slate-200" /></div>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="email">Staff email</Label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></div>
                <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div>
                {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
                <Button type="submit" className="w-full" disabled={loading}><KeyRound size={15} /> Sign in with credentials</Button>
              </form>
              <p className="mt-4 flex items-center gap-2 text-[10px] leading-4 text-slate-500"><Building2 size={12} /> Recruit applications are reviewed in Admin → Recruitment applications.</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
