
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, AlertCircle, ShieldCheck } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, verifyOtp } = useAuth();
  const router = useRouter();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
        setStep("otp");
      } else {
        setError("We couldn't send your code. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(token)) {
      setError("Enter the six-digit code from your email.");
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await verifyOtp(email, token);

      if (success) {
        router.replace("/account");
      } else {
        setError("Verification failed. Check the code and try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      const success = await login(email);

      if (success) {
        setToken("");
      } else {
        setError("We couldn't resend the code. Please try again later.");
      }
    } catch {
      setError("Unable to resend the code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
              {step === "email"
                ? "SIGN IN TO YOUR ACCOUNT"
                : "VERIFY YOUR EMAIL"}
            </h1>

            <p className="text-xs text-neutral-500">
              {step === "email"
                ? "Access your order tracking, saved addresses, and wishlist."
                : `Enter the six-digit code sent to ${email}.`}
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 bg-neutral-100 border border-neutral-200 text-xs text-neutral-700">
            {step === "email" ? (
              <Mail className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            )}

            <p>
              {step === "email"
                ? "Sign in securely using a one-time verification code sent to your email. No password required."
                : "Your account will be accessible after the verification code is confirmed."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs border border-red-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
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
                    placeholder="name@example.com"
                  />

                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
              >
                <span>
                  {isSubmitting ? "Sending Code..." : "Send Verification Code"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="otp"
                  className="text-[11px] uppercase tracking-wider font-bold text-neutral-800"
                >
                  Six-Digit Verification Code
                </label>

                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={token}
                  onChange={(e) =>
                    setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full px-3 py-3 text-center text-xl tracking-[0.5em] border border-neutral-300 focus:border-black outline-none font-bold"
                  placeholder="000000"
                  aria-describedby="otp-help"
                />

                <p id="otp-help" className="text-[11px] text-neutral-500">
                  Check your inbox and spam folder.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || token.length !== 6}
                className="w-full py-3.5 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
              >
                <span>
                  {isSubmitting ? "Verifying..." : "Verify & Sign In"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setStep("email");
                    setToken("");
                    setError("");
                  }}
                  className="text-neutral-600 underline hover:text-black disabled:opacity-60"
                >
                  Change email
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleResendCode}
                  className="font-bold text-black underline disabled:opacity-60"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-neutral-200 text-center text-xs text-neutral-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-black hover:underline uppercase"
            >
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
