import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redeemInviteLink } from "../../actions";

type Props = { params: Promise<{ token: string }> };
type Preview = {
  state: "valid" | "invalid" | "expired" | "revoked" | "limit_reached" | "unavailable" | "full";
  title?: string; description?: string | null; scheduled_start_at?: string | null;
  time_zone?: string; duration_minutes?: number | null; status?: "scheduled" | "live";
  participants?: number; participant_limit?: number | null;
};

const states: Record<string, { title: string; body: string }> = {
  invalid: { title: "This invitation link isn't recognized", body: "Check that the link was copied completely and try again." },
  expired: { title: "This invitation has expired", body: "Ask the organizer to share a current invitation." },
  revoked: { title: "This invitation is no longer active", body: "The person who created this link has withdrawn it." },
  limit_reached: { title: "This invitation has reached its use limit", body: "The link can no longer be used to join." },
  unavailable: { title: "This gathering is no longer available", body: "It may have been cancelled, ended, or unpublished." },
  full: { title: "This gathering is full", body: "The participant limit has been reached." },
};

function formatDate(value: string | null | undefined, zone = "Asia/Kolkata") {
  if (!value) return "Start time not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Start time not scheduled";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: zone }).format(date);
}

async function InviteJoinContent({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: auth }, { data: previewData, error: previewError }] = await Promise.all([
    supabase.auth.getClaims(),
    /^[a-z0-9]{10}$/.test(token)
      ? supabase.rpc("preview_session_invite_link", { p_code: token })
      : Promise.resolve({ data: { state: "invalid" }, error: null }),
  ]);
  const userId = auth?.claims?.sub;
  const preview = (previewError ? { state: "invalid" } : previewData) as Preview;
  const valid = preview.state === "valid";

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--ink)]">
      <div className="mx-auto max-w-xl pt-8">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-6 sm:px-8">
            <p className="eyebrow">Gathering invitation</p>
            <h1 className="mt-2 font-display text-3xl text-[var(--plum)]">{valid ? "You're invited" : states[preview.state]?.title ?? "Invitation unavailable"}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{valid ? "Review the gathering details before joining." : states[preview.state]?.body ?? "This invitation cannot be used."}</p>
          </div>
          {valid ? (
            <div className="px-6 py-6 sm:px-8">
              <h2 className="text-2xl font-semibold">{preview.title}</h2>
              {preview.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{preview.description}</p>}
              <dl className="mt-6 grid gap-4 border-t border-[var(--line)] pt-5 text-sm sm:grid-cols-2">
                <div><dt className="text-[var(--muted)]">When</dt><dd className="mt-1 font-medium">{formatDate(preview.scheduled_start_at, preview.time_zone)}</dd></div>
                <div><dt className="text-[var(--muted)]">Status</dt><dd className="mt-1 font-medium">{preview.status === "live" ? "Live now" : "Scheduled"}</dd></div>
                {preview.duration_minutes && <div><dt className="text-[var(--muted)]">Expected duration</dt><dd className="mt-1 font-medium">{preview.duration_minutes} minutes</dd></div>}
                <div><dt className="text-[var(--muted)]">Participants</dt><dd className="mt-1 font-medium">{preview.participants}{preview.participant_limit ? ` of ${preview.participant_limit}` : ""}</dd></div>
              </dl>
              {typeof userId === "string" ? (
                <form action={redeemInviteLink} className="mt-7"><input type="hidden" name="token" value={token}/><button className="button-primary w-full">Join gathering</button></form>
              ) : (
                <Link href={`/login?next=/sessions/join/${encodeURIComponent(token)}`} className="button-primary mt-7 flex w-full justify-center">Sign in to join</Link>
              )}
            </div>
          ) : (
            <div className="px-6 py-7 sm:px-8">
              <Link href="/sessions" className="button-secondary inline-flex">Back to Gatherings</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function InviteJoinPage(props: Props) {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--background)] px-4 py-10"><div className="mx-auto max-w-xl animate-pulse rounded-2xl bg-[var(--surface-soft)] p-10"/></main>}><InviteJoinContent params={props.params}/></Suspense>;
}
