"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Shield, ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useToast } from "@/context/toast-context";

type Staff = { id:string; name:string; email:string; role:string; status:"active"|"inactive"; created_at:string; updated_at:string };

export default function AdminStaffPage() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/staff", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load staff accounts.");
      setStaff(Array.isArray(data.staff) ? data.staff : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load staff accounts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggleStatus = async (member: Staff) => {
    setBusyId(member.id);
    try {
      const response = await fetch("/api/admin/staff", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:member.id,is_active:member.status !== "active"}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update staff account.");
      setStaff(prev => prev.map(s => s.id === member.id ? data.staff : s));
      toast({ type:"success", title:"Staff account updated", message:`${member.name} is now ${data.staff.status}.` });
    } catch(e) { toast({ type:"error", title:"Update failed", message:e instanceof Error ? e.message : "Unable to update staff account." }); }
    finally { setBusyId(null); }
  };

  return <AdminLayout title="Staff & Role Permissions" subtitle="Live staff accounts from the administration database; changes are saved server-side." actions={<button onClick={() => void load()} className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2" disabled={loading}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</button>}>
    <div className="space-y-5">
      <div className="p-4 bg-purple-50 border border-purple-200 text-xs text-purple-900 flex gap-3"><ShieldAlert className="w-4 h-4 shrink-0"/><p><strong>Account provisioning:</strong> New staff accounts must be created through the secure server-side admin setup process. This page intentionally does not create fake staff or expose temporary passwords.</p></div>
      {error && <div role="alert" className="p-4 border border-red-200 bg-red-50 text-sm text-red-800">{error}<button onClick={() => void load()} className="ml-3 underline font-bold">Retry</button></div>}
      <div className="bg-white border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse"><thead><tr className="border-b bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]"><th className="py-3 px-4">Staff member</th><th className="py-3 px-4">Role</th><th className="py-3 px-4">Account created</th><th className="py-3 px-4">Status</th><th className="py-3 px-4 text-right">Account control</th></tr></thead>
          <tbody className="divide-y divide-neutral-200">{loading ? <tr><td colSpan={5} className="p-8 text-center text-neutral-500">Loading real staff accounts…</td></tr> : staff.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-neutral-500">No staff accounts found in the database.</td></tr> : staff.map(member => <tr key={member.id} className="hover:bg-neutral-50"><td className="py-4 px-4"><p className="font-bold uppercase text-black">{member.name}</p><p className="text-[11px] text-neutral-500 font-mono">{member.email}</p></td><td className="px-4"><span className="inline-flex items-center gap-1"><Shield className="w-3.5 h-3.5"/>{member.role}</span></td><td className="px-4 text-neutral-500">{member.created_at ? new Date(member.created_at).toLocaleDateString() : "—"}</td><td className="px-4"><span className={`px-2 py-1 border text-[10px] uppercase font-bold ${member.status === "active" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{member.status}</span></td><td className="px-4 text-right"><button disabled={busyId === member.id} onClick={() => void toggleStatus(member)} className={`font-bold underline disabled:opacity-50 ${member.status === "active" ? "text-red-600" : "text-emerald-700"}`}>{busyId === member.id ? "Saving…" : member.status === "active" ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </AdminLayout>;
}
