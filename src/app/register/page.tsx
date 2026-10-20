"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  User,
  Mail,
  Phone,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { useAuth } from "@/context/auth-context";

function RegisterContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"register" | "verify">("register");
  const [error, setError] = useState("");
  const [resendSuccess, setResendSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { register, resendVerificationEmail } = useAuth();
  const searchParams = useSearchParams();

  // Check for expired or failed link query params
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "verification_failed") {
      setError(
        "Your email verification link is invalid, expired, or has already been used. Please request a new verification email below."
      );
    }
  }, [searchParams]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError("");
    setResendSuccess("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!name.trim() || !normalizedEmail || !phone.trim()) {
      setError("Please fill out all registration fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!/^[+\d\s()-]{7,20}$/.test(phone.trim())) {
      setError("Please enter a valid mobile number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await register(
        name.trim(),
        normalizedEmail,
        phone.trim()
      );

      if (res.success) {
        setEmail(normalizedEmail);
        setStep("verify");
        setCooldown(60); // 60s cooldown for resend
      } else {
        setError(res.error || "We couldn't process your registration. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isResending || cooldown > 0 || !email) return;

    setError("");
    setResendSuccess("");
    setIsResending(true);

    try {
      const res = await resendVerificationEmail(email);
      if (res.success) {
        setResendSuccess("A new verification link has been sent to your email.");
        setCooldown(60);
      } else {
        setError(res.error || "Unable to resend verification email. Please try again later.");
      }
    } catch {
      setError("Unable to resend verification email. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <StoreLayout>
      <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F5F4F0]">
        <div className="max-w-md w-full bg-white border border-neutral-200 p-8 sm:p-10 shadow-lg space-y-6">
          <div className="text-center space-y-1">
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold">
              JOIN RIGHTNOWLIFE
            </span>

            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
              {step === "register" ? "CREATE YOUR ACCOUNT" : "CHECK YOUR INBOX"}
            </h1>

            <p className="text-xs text-neutral-500">
              {step === "register"
                ? "Get drop notifications, save addresses, and track shipments."
                : "We’ve sent a verification link to your email address. Please check your inbox and click the link to verify your email."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 bg-red-50 text-red-700 text-xs border border-red-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resendSuccess && (
            <div
              role="status"
              className="flex items-start gap-2 p-3 bg-emerald-50 text-emerald-800 text-xs border border-emerald-200"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{resendSuccess}</span>
            </div>
          )}

          {step === "register" ? (
            <>
              <div className="flex items-start gap-3 p-3 bg-neutral-100 border border-neutral-200 text-xs text-neutral-700">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Create your customer account using your details. We will send an email verification link to activate your account.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1">
                  <label
                    htmlFor="name"
                    className="text-[11px] uppercase tracking-wider font-bold text-neutral-800"
                  >
                    Full Name
                  </label>

                  <div className="relative">
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                      placeholder="Your full name"
                    />
                    <User className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="text-[11px] uppercase tracking-wider font-bold text-neutral-800"
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
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                      placeholder="you@example.com"
                    />
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="phone"
                    className="text-[11px] uppercase tracking-wider font-bold text-neutral-800"
                  >
                    Mobile Number
                  </label>

                  <div className="relative">
                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                      placeholder="+91 98765 00000"
                    />
                    <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                >
                  <span>
                    {isSubmitting ? "Creating Account..." : "Create Account"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* DEDICATED EMAIL VERIFICATION SCREEN — NO OTP INPUT */
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto text-[#111111]">
                <Inbox className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-neutral-800 font-medium leading-relaxed">
                  We’ve sent a verification link to{" "}
                  <strong className="text-black font-mono font-bold block mt-1">
                    {email}
                  </strong>
                </p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Please check your inbox and click the link to verify your email. If you don&apos;t see it within a couple of minutes, please check your spam or promotions folder.
                </p>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-none text-left space-y-2 text-xs text-neutral-600">
                <div className="flex items-center gap-2 font-bold text-neutral-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Next steps</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-600">
                  <li>Check your inbox for the RightNowLife confirmation email</li>
                  <li>Click <strong>Confirm your email</strong> inside the message</li>
                  <li>You will be redirected and signed into your account automatically</li>
                </ol>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || cooldown > 0}
                  className="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-black border border-neutral-300 text-xs uppercase tracking-wider font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                  <span>
                    {isResending
                      ? "Sending..."
                      : cooldown > 0
                      ? `Resend verification email (${cooldown}s)`
                      : "Resend verification email"}
                  </span>
                </button>

                <div className="flex items-center justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("register");
                      setError("");
                      setResendSuccess("");
                    }}
                    className="text-neutral-600 underline hover:text-black"
                  >
                    Edit details
                  </button>

                  <Link
                    href="/login"
                    className="font-bold text-black underline hover:text-neutral-700"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-neutral-200 text-center text-xs text-neutral-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-black hover:underline uppercase"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <RegisterContent />
    </Suspense>
  );
}
