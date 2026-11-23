import Link from "next/link";
import { BrandMark } from "@/components/brand-lockup";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinGatheringBySlug } from "@/app/sessions/actions";
import InviteJoinPage, { generateMetadata as generateInviteMetadata } from "@/app/sessions/join/[token]/page";


export const instant = false;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ requested?: string; error?: string }>;
};

type Preview = {
  session_id: string;
  title: string;
  description: string | null;
  access_type: "community" | "link";
  status: "scheduled" | "live";
  scheduled_start_at: string | null;
  time_zone: string;
  duration_minutes: number | null;
  participant_count: number;
  participant_limit: number | null;
  waiting_room_enabled: boolean;
};

function dateLabel(value: string | null, zone: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: zone,
  }).format(date);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (/^[a-z0-9]{10}$/.test(slug)) {
    const query = await searchParams;
    return generateInviteMetadata({
      params: Promise.resolve({ token: slug }),
      searchParams: Promise.resolve({ error: query.error }),
    });
  }
  return { title: "Gathering | Vaani", robots: { index: false, follow: false } };
}

export default async function ShortGatheringPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  if (/^[a-z0-9]{10}$/.test(slug)) {
    return (
      <InviteJoinPage
        params={Promise.resolve({ token: slug })}
        searchParams={Promise.resolve({ error: query.error })}
      />
    );
  }
  if (!/^[a-f0-9]{32}$/.test(slug)) notFound();

  const supabase = await createClient();
  const [{ data: rows, error }, { data: claims }] = await Promise.all([
    supabase.rpc("preview_gathering_by_slug", { p_slug: slug }),
    supabase.auth.getClaims(),
  ]);
  if (error || !Array.isArray(rows) || rows.length === 0) notFound();

  const gathering = rows[0] as Preview;
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  let membershipStatus: string | null = null;
  let hasPendingRequest = false;

  if (userId) {
    const [{ data: membership }, { data: request }] = await Promise.all([
      supabase.from("session_members").select("status")
        .eq("session_id", gathering.session_id).eq("user_id", userId).maybeSingle(),
      supabase.from("session_join_requests").select("id")
        .eq("session_id", gathering.session_id).eq("user_id", userId)
        .eq("status", "pending").maybeSingle(),
    ]);
    membershipStatus = membership?.status ?? null;
    hasPendingRequest = !!request;
  }

  const isAccepted = membershipStatus === "accepted";
  const next = `/g/${slug}`;
  const full = gathering.participant_limit !== null &&
    gathering.participant_count >= gathering.participant_limit;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--ink)]">
      <div className="mx-auto max-w-2xl pt-6 sm:pt-12">
        <BrandMark />
        <section className="surface-card mt-7 overflow-hidden">
          <div className="border-b border-[var(--line)] bg-[var(--surface-soft)] px-6 py-5 sm:px-9">
            <p className="eyebrow">Vaani gathering</p>
            <h1 className="mt-2 font-display text-3xl text-[var(--plum)] sm:text-4xl">{gathering.title}</h1>
            {gathering.description && <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{gathering.description}</p>}
          </div>
          <div className="p-6 sm:p-9">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">When</dt><dd className="mt-1 text-sm font-medium">{dateLabel(gathering.scheduled_start_at, gathering.time_zone)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Gathering</dt><dd className="mt-1 text-sm font-medium">{gathering.status === "live" ? "In progress" : "Scheduled"}</dd></div>
              {gathering.duration_minutes && <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Duration</dt><dd className="mt-1 text-sm font-medium">{gathering.duration_minutes} minutes</dd></div>}
              {gathering.participant_limit !== null && <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Participants</dt><dd className="mt-1 text-sm font-medium">{gathering.participant_count} of {gathering.participant_limit}</dd></div>}
              <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Access</dt><dd className="mt-1 text-sm font-medium">{gathering.access_type === "community" ? "All Vaani members" : "Invitation link"}</dd></div>
            </dl>

            {query.error === "join_failed" && <p role="alert" className="mt-6 text-sm text-[#a34e56]">Could not join this gathering. It may be full or no longer available.</p>}
            {query.requested === "1" || hasPendingRequest ? (
              <p role="status" className="mt-7 rounded-lg bg-[var(--surface-soft)] p-4 text-sm">Your request is waiting for the organizer.</p>
            ) : isAccepted ? (
              <Link href={`/sessions/${gathering.session_id}`} className="button-primary mt-7 inline-flex">Open gathering</Link>
            ) : userId ? (
              <form action={joinGatheringBySlug} className="mt-7">
                <input type="hidden" name="slug" value={slug} />
                <button type="submit" disabled={full} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
                  {full ? "Gathering full" : "Join gathering"}
                </button>
                {gathering.waiting_room_enabled && <p className="mt-3 text-center text-xs text-[var(--muted)]">Your request will be sent to the organizer for approval.</p>}
              </form>
            ) : (
              <div className="mt-7 flex flex-col gap-3">
                <Link href={`/login?next=${encodeURIComponent(next)}`} className="button-primary text-center">Sign in to join</Link>
                <Link href={`/signup?next=${encodeURIComponent(next)}`} className="button-secondary text-center">Create a Vaani account</Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
