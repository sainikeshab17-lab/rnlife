"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Mail,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [error, setError] = useState("");
  const [resendSuccess, setResendSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { login } = useAuth();

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError("");
    setResendSuccess("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await login(normalizedEmail);

      if (success) {
        setEmail(normalizedEmail);
        setStep("verify");
        setCooldown(60);
      } else {
        setError("We couldn't send your verification link. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendLink = async () => {
    if (isResending || cooldown > 0 || !email) return;

    setError("");
    setResendSuccess("");
    setIsResending(true);

    try {
      const success = await login(email);

      if (success) {
        setResendSuccess("A new verification link has been sent to your email.");
        setCooldown(60);
      } else {
        setError("We couldn't resend the verification link. Please try again later.");
      }
    } catch {
      setError("Unable to resend the verification link. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <StoreLayout>
      <div className="flex min-h-[75vh] items-center justify-center bg-[#F5F4F0] px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 border border-neutral-200 bg-white p-8 shadow-lg sm:p-10">
          <div className="space-y-1 text-center">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              ACCOUNT ACCESS
            </span>

            <h1 className="font-editorial text-2xl font-black uppercase tracking-tight sm:text-3xl">
              {step === "email"
                ? "SIGN IN TO YOUR ACCOUNT"
                : "CHECK YOUR INBOX"}
            </h1>

            <p className="text-xs text-neutral-500">
              {step === "email"
                ? "Access your orders, account, and saved preferences."
                : "We’ve sent a verification link to your email address. Please check your inbox and click the link to verify your email."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resendSuccess && (
            <div
              role="status"
              className="flex items-start gap-2 border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{resendSuccess}</span>
            </div>
          )}

          {step === "email" ? (
            <>
              <div className="flex items-start gap-3 border border-neutral-200 bg-neutral-100 p-3 text-xs text-neutral-700">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Sign in securely using a verification link sent to your email. No password required.
                </p>
              </div>

              <form onSubmit={handleSendLink} className="space-y-4">
                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="text-[11px] font-bold uppercase tracking-wider text-neutral-800"
                  >
                    Email Address
                  </label>

                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-neutral-300 py-2.5 pl-9 pr-3 text-xs font-medium outline-none focus:border-black"
                      placeholder="name@example.com"
                    />

                    <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 bg-[#111111] py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-black disabled:opacity-60"
                >
                  <span>
                    {isSubmitting ? "Sending Link..." : "Send Verification Link"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-[#111111]">
                <Inbox className="h-8 w-8" />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium leading-relaxed text-neutral-800">
                  We’ve sent a verification link to:
                  <strong className="mt-1 block font-mono font-bold text-black">
                    {email}
                  </strong>
                </p>
                <p className="text-xs leading-relaxed text-neutral-500">
                  Please check your inbox and click the link to verify your email and sign in. If you don&apos;t see it within a couple of minutes, check your spam or promotions folder.
                </p>
              </div>

              <div className="space-y-2 border border-neutral-200 bg-neutral-50 p-4 text-left text-xs text-neutral-600">
                <div className="flex items-center gap-2 font-bold text-neutral-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Next steps</span>
                </div>
                <ol className="list-inside list-decimal space-y-1 text-[11px] text-neutral-600">
                  <li>Open the email sent from RightNowLife</li>
                  <li>Click <strong>Sign in to RightNowLife</strong> or the verification link</li>
                  <li>You will be redirected and signed in automatically</li>
                </ol>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleResendLink}
                  disabled={isResending || cooldown > 0}
                  className="flex w-full items-center justify-center gap-2 border border-neutral-300 bg-neutral-100 py-3 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-neutral-200 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isResending ? "animate-spin" : ""}`}
                  />
                  <span>
                    {isResending
                      ? "Sending..."
                      : cooldown > 0
                        ? `Resend verification email (${cooldown}s)`
                        : "Resend verification email"}
                  </span>
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setError("");
                      setResendSuccess("");
                    }}
                    className="text-neutral-600 underline hover:text-black"
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setError("");
                      setResendSuccess("");
                    }}
                    className="font-bold text-black underline hover:text-neutral-700"
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-neutral-200 pt-4 text-center text-xs text-neutral-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold uppercase text-black hover:underline"
            >
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
