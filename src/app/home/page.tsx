import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SessionRealtimeRefresh from "@/components/session-realtime-refresh";

function HomeLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="page-shell py-16">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface-soft)]" />
        <div className="mt-8 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
      </div>
    </main>
  );
}

async function HomeContent() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/login");

  const [{ data: authUser }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles")
      .select("display_name, avatar_url, avatar_path")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const email = authUser.user?.email || "";
  const name = profile?.display_name ||
    authUser.user?.user_metadata?.full_name ||
    authUser.user?.user_metadata?.name ||
    email.split("@")[0] ||
    "Sakhi";
  const avatarUrl = profile?.avatar_url ||
    (profile?.avatar_path
      ? (profile.avatar_path.startsWith("http")
        ? profile.avatar_path
        : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl)
      : null) ||
    authUser.user?.user_metadata?.avatar_url ||
    authUser.user?.user_metadata?.picture ||
    null;

  const [{ data: sessions }, { data: memberships }] = await Promise.all([
    supabase.from("sessions")
      .select("id, title, status, scheduled_start_at, access_type")
      .eq("is_draft", false)
      .in("status", ["scheduled", "live"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("session_members")
      .select("session_id")
      .eq("user_id", userId)
      .eq("status", "accepted"),
  ]);

  const joined = new Set((memberships ?? []).map((item) => item.session_id));
  const relevantSessions = (sessions ?? [])
    .filter((item) => item.access_type === "community" || joined.has(item.id))
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <SessionRealtimeRefresh />
      <SiteHeader name={name} email={email} avatarUrl={avatarUrl} />
      <div className="page-shell py-10 sm:py-14">
        <section className="flex flex-col gap-5 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Your Vaani</p>
            <h1 className="font-display mt-2 text-4xl text-[var(--plum)] sm:text-5xl">
              Shree Harivansh, {name.split(" ")[0]}.
            </h1>
          </div>
          
        </section>

        <section className="mt-9">
          <h2 className="font-display text-3xl text-[var(--plum)]">Your gatherings</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Gatherings you can join or are already part of.</p>

          {relevantSessions.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {relevantSessions.map((session) => (
                <Link
                  key={session.id}
                  href={session.status === "live" && joined.has(session.id)
                    ? `/sessions/${session.id}/conference`
                    : `/sessions/${session.id}`}
                  className="surface-card group p-5 transition hover:border-[var(--rose)]"
                >
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    {session.status === "live" && <span className="h-2 w-2 rounded-full bg-[#6d916f]" />}
                    {session.status === "live" ? "Live now" : "Upcoming"}
                  </div>
                  <h3 className="mt-4 font-display text-2xl text-[var(--plum)]">{session.title}</h3>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {session.scheduled_start_at
                      ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(session.scheduled_start_at))
                      : "Time not set"}
                  </p>
                  {session.status === "live" && joined.has(session.id) && (
                    <p className="mt-4 text-xs font-semibold text-[var(--plum)]">Join gathering →</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="surface-card mt-5 p-7">
              <p className="text-sm text-[var(--muted)]">No gatherings are available here just now.</p>
              <Link href="/sessions#discover-sessions" className="button-secondary mt-4">Find a session</Link>
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link href="/sessions#discover-sessions" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 transition hover:border-[var(--rose)]">
            <h2 className="font-display text-2xl text-[var(--plum)]">Find a gathering</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">See gatherings open to all Vaani members.</p>
          </Link>
          <Link href="/sessions/new" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 transition hover:border-[var(--rose)]">
            <h2 className="font-display text-2xl text-[var(--plum)]">Create a gathering</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Arrange a gathering and invite Sakhis.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}

export default function HomePage() {
  return <Suspense fallback={<HomeLoading />}><HomeContent /></Suspense>;
}
