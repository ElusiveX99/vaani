"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleEmailAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/home");
          return;
        }

        setMessage("Registration successful. Check your email to verify your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace("/home");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Vaani
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            A space for devotion, learning, and togetherness.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
            className={`rounded-md py-2 text-sm font-medium ${
              mode === "login"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500"
            }`}
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
            className={`rounded-md py-2 text-sm font-medium ${
              mode === "signup"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500"
            }`}
          >
            Create account
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 px-4 py-3 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:opacity-50"
        >
          <span className="font-bold text-base">G</span>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-xs text-stone-400">OR</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-stone-700"
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
              className="w-full rounded-lg border border-stone-300 px-3 py-3 text-sm outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-stone-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-3 text-sm outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600"
              placeholder="Enter your password"
            />
          </div>

          {mode === "login" && (
            <div className="text-right">
              <a
                href="/login/forgot-password"
                className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
              >
                Forgot password?
              </a>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-stone-400">
          By continuing, you agree to use Vaani respectfully and responsibly.
        </p>
      </div>
    </main>
  );
}
