"use client";

import React, { useState } from "react";
import { UserPlus, Shield, Check, X, ShieldAlert, Key } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DEMO_STAFF } from "@/data/mock-data";
import { StaffMember } from "@/types";
import { useToast } from "@/context/toast-context";

export default function AdminStaffPage() {
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<StaffMember[]>(DEMO_STAFF);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Catalog Lead" as StaffMember["role"],
    permissions: ["manage_catalog"],
  });

  const toggleStatus = (id: string) => {
    setStaffList((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const newStatus = s.status === "active" ? "inactive" : "active";
          toast({
            type: "info",
            title: `Account ${newStatus === "active" ? "Activated" : "Deactivated"}`,
            message: `${s.name} is now ${newStatus}.`,
          });
          return { ...s, status: newStatus };
        }
        return s;
      })
    );
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    const newStaff: StaffMember = {
      id: `stf-${Date.now()}`,
      name: form.name,
      email: form.email,
      role: form.role,
      permissions: form.permissions,
      status: "active",
      lastActive: "Just now",
    };

    setStaffList([...staffList, newStaff]);
    setIsAddModalOpen(false);
    setForm({ name: "", email: "", role: "Catalog Lead", permissions: ["manage_catalog"] });
    toast({
      type: "success",
      title: "Staff Account Created",
      message: `${newStaff.name} added as ${newStaff.role}.`,
    });
  };

  return (
    <AdminLayout
      title="Staff & Role Permissions"
      subtitle="Manage internal RightNowLife staff accounts, role assignments, and catalog permissions."
      actions={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Staff Account</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Security Notice */}
        <div className="p-4 bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
          <div>
            <strong>RBAC Security Note:</strong> This staff directory is a Phase 1 frontend interface. In Phase 2, permissions will be verified server-side with JWT access tokens and database role-guards in the NestJS backend.
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Granted Permissions</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Account Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-medium">
              {staffList.map((st) => (
                <tr key={st.id} className="hover:bg-neutral-50">
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-black uppercase">{st.name}</p>
                    <p className="text-[11px] text-neutral-500 font-mono">{st.email}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-black">{st.role}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {st.permissions.map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 bg-neutral-100 text-neutral-700 text-[10px] font-mono"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-neutral-500 font-mono text-[11px]">
                    {st.lastActive}
                  </td>
                  <td className="py-3.5 px-4">
                    {st.status === "active" ? (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-bold">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 border border-neutral-200 text-[10px] uppercase font-bold">
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => toggleStatus(st.id)}
                      className={`text-xs uppercase font-bold tracking-wider underline ${
                        st.status === "active"
                          ? "text-red-600 hover:text-red-800"
                          : "text-emerald-700 hover:text-emerald-900"
                      }`}
                    >
                      {st.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Staff Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-neutral-200 shadow-2xl p-6 sm:p-8 max-w-md w-full space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
                <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                  Authorize New Staff Account
                </h3>
                <button onClick={() => setIsAddModalOpen(false)}>
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

              <form onSubmit={handleAddStaff} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    placeholder="e.g. Vikram Joshi"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Company Email (@rightnowlife.in)
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    placeholder="vikram@rightnowlife.in"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Staff Role Assignment
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold uppercase bg-white cursor-pointer"
                  >
                    <option value="Store Admin">Store Admin (Full Governance)</option>
                    <option value="Catalog Lead">Catalog Lead (Publishing & Matrix)</option>
                    <option value="Fulfillment Lead">Fulfillment Lead (Shipments & Courier)</option>
                    <option value="Support Agent">Support Agent (Orders & Inquiries)</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border border-neutral-300 text-xs uppercase font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-black text-white text-xs uppercase tracking-widest font-bold"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
