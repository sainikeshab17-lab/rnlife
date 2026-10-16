"use client";

import React, { useState } from "react";
import { Plus, MapPin, Check, Trash2, Edit3, X } from "lucide-react";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { useAuth } from "@/context/auth-context";
import { Address } from "@/types";

export default function AccountAddressesPage() {
  const { user, addAddress, deleteAddress, setDefaultAddress } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [form, setForm] = useState<Omit<Address, "id">>({
    fullName: user?.name || "",
    phone: user?.phone || "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pinCode: "",
    isDefault: false,
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.addressLine1 || !form.city || !form.pinCode) {
      alert("Please fill required address fields.");
      return;
    }
    addAddress(form);
    setIsAddModalOpen(false);
    setForm({
      fullName: user?.name || "",
      phone: user?.phone || "",
      addressLine1: "",
      addressLine2: "",
      landmark: "",
      city: "",
      state: "",
      pinCode: "",
      isDefault: false,
    });
  };

  return (
    <AccountLayout
      title="Saved Addresses"
      subtitle="Manage your primary delivery locations for seamless one-click checkout."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-xs uppercase tracking-wider font-bold text-neutral-500">
            {user?.addresses.length || 0} Registered Addresses
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Address</span>
          </button>
        </div>

        {/* Address Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {user?.addresses.map((addr) => (
            <div
              key={addr.id}
              className={`p-5 border bg-white flex flex-col justify-between shadow-sm transition-all ${
                addr.isDefault ? "border-black ring-1 ring-black" : "border-neutral-200"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-black" />
                    <span className="font-bold text-xs uppercase text-black">{addr.fullName}</span>
                  </div>
                  {addr.isDefault && (
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-black text-[#B8FF3B]">
                      Default
                    </span>
                  )}
                </div>

                <div className="text-xs text-neutral-600 space-y-1">
                  <p>{addr.addressLine1}</p>
                  {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                  {addr.landmark && <p className="text-neutral-400">Near: {addr.landmark}</p>}
                  <p className="font-medium text-black">
                    {addr.city}, {addr.state} – {addr.pinCode}
                  </p>
                  <p className="font-mono text-neutral-500 text-[11px] pt-1">
                    Phone: {addr.phone}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between text-xs">
                {!addr.isDefault ? (
                  <button
                    onClick={() => setDefaultAddress(addr.id)}
                    className="text-neutral-600 hover:text-black font-semibold underline"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                    <Check className="w-3 h-3" /> Default Shipping
                  </span>
                )}

                <button
                  onClick={() => deleteAddress(addr.id)}
                  className="text-neutral-400 hover:text-red-600 p-1 transition-colors"
                  aria-label="Delete address"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Address Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-neutral-200 shadow-2xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
                <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                  Add New Delivery Location
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-neutral-400 hover:text-black"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-700">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-700">
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.addressLine1}
                    onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    placeholder="House / Flat / Studio No."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-700">
                      Area / Street
                    </label>
                    <input
                      type="text"
                      value={form.addressLine2 || ""}
                      onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-700">
                      Landmark
                    </label>
                    <input
                      type="text"
                      value={form.landmark || ""}
                      onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-700">City *</label>
                    <input
                      type="text"
                      required
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-700">State *</label>
                    <input
                      type="text"
                      required
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-700">PIN Code *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={form.pinCode}
                      onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-neutral-700 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="w-4 h-4 accent-black"
                  />
                  <span>Set as default delivery address</span>
                </label>

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
                    Save Address
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
