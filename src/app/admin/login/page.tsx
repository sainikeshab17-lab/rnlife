"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed. Check your credentials.");
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("An unexpected network error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block mb-4">
          <span className="font-mono font-black text-2xl tracking-widest text-[#111111]">
            RIGHTNOWLIFE
          </span>
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#111111] text-[#B8FF3B] text-[10px] uppercase font-bold tracking-widest mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Restricted Admin Portal</span>
        </div>
        <h2 className="text-xl font-bold uppercase tracking-tight text-[#111111]">
          Sign In to Administration
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Authorized personnel only. All access attempts are recorded in the audit log.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 border border-[#E5E5E5] shadow-sm">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase font-bold text-neutral-700 tracking-wider mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@rightnowlife.in"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black focus:ring-0 outline-none font-medium bg-white"
                />
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-neutral-700 tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black focus:ring-0 outline-none font-medium bg-white"
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#111111] hover:bg-neutral-800 text-white text-xs uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Enter Control Center</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-neutral-200 text-center">
            <p className="text-[11px] text-neutral-500">
              Need access? Initial setup requires running{" "}
              <code className="bg-neutral-100 px-1 py-0.5 text-[#111111] font-mono text-[10px]">
                npm run setup-admin
              </code>{" "}
              on the secure server console.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs font-bold text-neutral-600 hover:text-black uppercase tracking-wider"
          >
            &larr; Return to Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
