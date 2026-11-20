"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // Create the browser client only after a user action. Client Components
      // are prerendered on the server during the build, where browser auth
      // initialization must not run.
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your recovery session is invalid or has expired. Request a new recovery email."
        );
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("Your password has been updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Choose a new password
        </h1>

        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter and confirm your new password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-[var(--ink)]"
            >
              New password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-3 text-sm outline-none focus:border-stone-600"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-[var(--ink)]"
            >
              Confirm new password
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-3 text-sm outline-none focus:border-stone-600"
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

          {message && (
            <button
              type="button"
              onClick={() => router.replace("/account")}
              className="w-full rounded-lg bg-[var(--plum)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--plum-deep)]"
            >
              Continue to account
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--plum)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--plum-deep)] disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
