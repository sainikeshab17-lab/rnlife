"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("arjun@streetwear.in");
  const [password, setPassword] = useState("••••••••");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    await login(email);
    setIsSubmitting(false);
    router.push("/account");
  };

  return (
    <StoreLayout>
      <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F5F4F0]">
        <div className="max-w-md w-full bg-white border border-neutral-200 p-8 sm:p-10 shadow-lg space-y-6">
          <div className="text-center space-y-1">
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold">
              CUSTOMER ACCESS
            </span>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
              SIGN IN TO YOUR ACCOUNT
            </h1>
            <p className="text-xs text-neutral-500">
              Access your order tracking, saved addresses, and wishlist.
            </p>
          </div>

          {/* Prototype Notice */}
          <div className="p-3 bg-neutral-100 border border-neutral-200 text-xs text-neutral-700">
            <strong>Prototype Fixture:</strong> Pre-filled with demo customer <em>Arjun Verma</em>. Click Sign In to activate the demo session.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-800">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                  placeholder="name@example.com"
                />
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-800">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-neutral-500 hover:text-black underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                  placeholder="••••••••"
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{isSubmitting ? "Signing In..." : "Sign In to Account"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-neutral-200 text-center text-xs text-neutral-600">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-bold text-black hover:underline uppercase">
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
