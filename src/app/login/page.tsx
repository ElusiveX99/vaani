"use client";

import InlineFeedback from "@/components/inline-feedback";

import Link from "next/link";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function getNextPath() { const value = new URLSearchParams(window.location.search).get("next"); return value && value.startsWith("/") && !value.startsWith("//") ? value : "/home"; }

export default function LoginPage({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const client = supabase;

    async function initializeAuth() {
      const { data, error } = await client.auth.getSession();

      if (!active) return;

      if (data.session) {
        router.replace(getNextPath());
        return;
      }

      if (error) {
        const message = error.message.toLowerCase();

        if (
          message.includes("invalid refresh token") ||
          message.includes("refresh token not found")
        ) {
          // Only clear this browser's session. Never use the default global
          // signOut here because it would revoke sessions on other devices.
          await client.auth.signOut({ scope: "local" });
        }
      }

      setAuthReady(true);
    }

    void initializeAuth();

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace(getNextPath());
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);

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
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNextPath())}`,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace(getNextPath());
          return;
        }

        setMessage("Registration successful. Check your email to verify your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace(getNextPath());
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
      if (!supabase) throw new Error("Authentication is still initializing. Please try again.");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNextPath())}`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  }

  if (!authReady) {
    return <main className="grid min-h-screen place-items-center bg-[var(--background)]"><span className="text-sm text-[var(--muted)]">Loading…</span></main>;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-8 sm:px-8">
      <div className="soft-orb -left-40 -top-40 h-[34rem] w-[34rem] bg-[#a97887]/25 blur-3xl" />
      <div className="soft-orb -bottom-40 -right-40 h-[34rem] w-[34rem] bg-[#b18b55]/15 blur-3xl" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--surface)] shadow-2xl lg:grid-cols-[.9fr_1.1fr]">
        <aside className="relative hidden min-h-[660px] flex-col justify-between overflow-hidden bg-[var(--plum-deep)] p-12 text-white lg:flex">
          <div className="absolute -right-28 top-20 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-16 top-32 h-56 w-56 rounded-full border border-white/10" />
          <Link href="/" className="brand-lockup relative !text-white"><span className="brand-word !text-white">Vaani</span></Link>
          <div className="relative">
            <p className="eyebrow !text-[#d9b88b]">Shree Harivansh</p>
            <h1 className="font-display mt-6 text-6xl leading-[1.03]">Vaani</h1>
            <p className="mt-6 max-w-sm text-sm leading-7 text-white/70">For Sakhis to gather for Chaturasi Ji gaayan, pada gaayan, and shared Vaani reading.</p>
          </div>
        </aside>

        <section className="px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="brand-lockup"><span className="brand-word">Vaani</span></Link>
          </div>
          <div className="mb-8">
            <p className="eyebrow">{mode === "login" ? "Welcome back" : "Create account"}</p>
            <h2 className="font-display mt-3 text-4xl text-[var(--plum)] sm:text-5xl">{mode === "login" ? "Sign in" : "Create your account"}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Sign in to view your gatherings and join a session.</p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-full bg-[var(--surface-soft)] p-1">
            <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} className={`rounded-full py-2.5 text-sm font-bold transition ${mode === "login" ? "bg-white text-[var(--plum)] shadow-sm" : "text-[var(--muted)]"}`}>Sign in</button>
            <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className={`rounded-full py-2.5 text-sm font-bold transition ${mode === "signup" ? "bg-white text-[var(--plum)] shadow-sm" : "text-[var(--muted)]"}`}>Create account</button>
          </div>

          <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-full border border-[var(--line)] bg-white px-4 py-3.5 text-sm font-bold text-[var(--ink)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-[var(--line)] font-bold text-base">G</span>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-4"><div className="h-px flex-1 bg-[var(--line)]" /><span className="text-[10px] font-bold tracking-[.18em] text-[var(--muted)]">OR EMAIL</span><div className="h-px flex-1 bg-[var(--line)]" /></div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <label className="field-label">Email address
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field-input mt-2" placeholder="you@example.com" />
            </label>
            <label className="field-label">Password
              <input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="field-input mt-2" placeholder="Enter your password" />
            </label>
            {mode === "login" && <div className="text-right"><a href="/login/forgot-password" className="text-xs font-semibold text-[var(--plum)] hover:underline">Forgot password?</a></div>}
            {error && <InlineFeedback tone="error">{error}</InlineFeedback>}
            {message && <InlineFeedback tone="success">{message}</InlineFeedback>}
            <button type="submit" disabled={loading} className="button-primary mt-2 w-full">{loading ? "Please wait…" : mode === "login" ? "Sign in to Vaani" : "Create your account"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
