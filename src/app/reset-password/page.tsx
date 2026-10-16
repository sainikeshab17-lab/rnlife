"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { useToast } from "@/context/toast-context";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSuccess(true);
    toast({
      type: "success",
      title: "Password Updated",
      message: "Your prototype password has been updated.",
    });
  };

  return (
    <StoreLayout>
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F5F4F0]">
        <div className="max-w-md w-full bg-white border border-neutral-200 p-8 sm:p-10 shadow-lg space-y-6">
          <div className="text-center space-y-1">
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold">
              SECURITY
            </span>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
              SET NEW PASSWORD
            </h1>
            <p className="text-xs text-neutral-500">
              Create a new secure password for your RightNowLife account.
            </p>
          </div>

          {isSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-3 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold">Password Reset Successfully</p>
              <p className="text-neutral-600">
                You can now sign in using your updated credentials.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="px-6 py-2.5 bg-black text-white text-xs uppercase tracking-widest font-bold inline-block"
                >
                  Sign In Now
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-800">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    placeholder="••••••••"
                  />
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-800">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    placeholder="••••••••"
                  />
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2"
              >
                <span>Update Password</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </StoreLayout>
  );
}
