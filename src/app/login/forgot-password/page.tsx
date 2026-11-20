"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      // Create the browser client only after submission; this page is prerendered during builds.
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/account/update-password`,
      });

      if (error) throw error;

      setMessage(
        "If an account exists for this email, you will receive password recovery instructions."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to request password recovery."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Reset your password
        </h1>

        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Enter your registered email address. If an account exists, we will send
          you instructions to reset its password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-[var(--ink)]"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[var(--line)] px-3 py-3 text-sm outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="rounded-lg bg-[#edf3eb] p-3 text-sm text-[var(--forest)]">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--plum)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--plum-deep)] disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send recovery email"}
          </button>
        </form>

        <a
          href="/login"
          className="mt-6 block text-center text-sm text-[var(--muted)] underline underline-offset-4"
        >
          Back to sign in
        </a>
      </div>
    </main>
  );
}
