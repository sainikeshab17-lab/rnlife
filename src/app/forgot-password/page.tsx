"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, CheckCircle2 } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
      if (resetError) throw resetError;
      setIsSent(true);
    } catch {
      setError("We couldn't request a password reset right now. Please try again or contact support.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StoreLayout>
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F5F4F0]">
        <div className="max-w-md w-full bg-white border border-neutral-200 p-8 sm:p-10 shadow-lg space-y-6">
          <div className="text-center space-y-1">
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold">
              ACCOUNT RECOVERY
            </span>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
              RESET YOUR PASSWORD
            </h1>
            <p className="text-xs text-neutral-500">
              Enter your email and we&apos;ll send a password reset link if an account matches.
            </p>
          </div>

          {isSent ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Check your email</span>
              </div>
              <p>
                If an account matches <strong>{email}</strong>, Supabase will send a password reset link. Follow the link to choose a new password.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-block font-bold text-black underline uppercase tracking-wider"
                >
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-800">
                  Registered Email
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>{isSubmitting ? "Sending…" : "Send Reset Link"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-neutral-200 text-center">
            <Link
              href="/login"
              className="text-xs text-neutral-600 hover:text-black font-semibold inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
