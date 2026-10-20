
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SellerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (signInError || !data.user) {
        setError("Invalid email or password.");
        return;
      }

      if (data.user.app_metadata?.role !== "seller") {
        await supabase.auth.signOut();
        setError("This account does not have seller access.");
        return;
      }

      router.replace("/seller");
      router.refresh();
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-8"
      >
        <div>
          <h1 className="text-3xl font-bold">Seller Login</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Sign in to manage your RIGHTNOWLIFE store.
          </p>
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-white"
            placeholder="seller@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-white"
            placeholder="Enter your password"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in as Seller"}
        </button>

        <p className="text-center text-sm text-neutral-400">
          Customer account?{" "}
          <a href="/login" className="text-white underline">
            Customer login
          </a>
        </p>
      </form>
    </main>
  );
}
