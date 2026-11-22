import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import Link from "next/link";

import {
  joinCommunitySession,
  respondToInvitation,
  leaveSession,
  markSessionNotificationRead,
} from "./actions";

type SessionsPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

type Session = {
  id: string;
  title: string;
  description: string | null;
  access_type: "community" | "invitation_only" | "link";
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduled_start_at: string | null;
  ended_at?: string | null;
  created_by: string;
  is_draft?: boolean;
};

type Membership = {
  session_id: string;
  role: string;
  status: string;
};

const successMessages: Record<string, string> = {
  created: "Your gathering has been scheduled.",
  draft_saved: "Your gathering draft has been saved.",
  joined: "You have joined the session.",
  invitation_updated: "Your invitation response has been saved.",
  left: "You have left the session.",
  join_request_sent: "Your request has been sent to the organizer.",
  notification_read: "Notification marked as read.",
  session_deleted: "The ended gathering was permanently deleted.",
};

const errorMessages: Record<string, string> = {
  invalid_input: "Check your session title and description.",
  invalid_access: "Select a valid access setting.",
  invalid_options: "Check the duration, time zone, and participant limit.",
  invalid_schedule: "Choose a future start date and time.",
  create_failed: "The session could not be created.",
  join_failed: "You could not join this session.",
  invitation_failed: "Your invitation response could not be saved.",
  leave_failed: "You could not leave this session.",
  notification_failed: "The notification could not be updated.",
};

function formatSchedule(value: string | null) {
  if (!value) return "Time not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function SessionCard({
  session,
  membership,
}: {
  session: Session;
  membership?: Membership;
}) {
  const isOrganizer = membership?.role === "organizer";
  const isInvited = membership?.status === "invited";
  const isAccepted = membership?.status === "accepted";

  const canJoin =
    session.status !== "ended" &&
    session.access_type === "community" &&
    (!membership ||
      membership.status === "declined" ||
      membership.status === "removed");

  return (
    <article className="surface-card p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-[var(--plum)]">
            {session.title}
          </h3>

          {session.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
              {session.description}
            </p>
          )}
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            session.status === "live"
              ? "bg-[#e6eee5] text-[var(--forest)]"
              : "bg-[var(--surface-soft)] text-[var(--ink)]"
          }`}
        >
          {session.is_draft ? "Draft" : session.status === "live" ? "Live now" : session.status === "ended" ? "Concluded" : session.status === "cancelled" ? "Cancelled" : "Scheduled"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1">
          {session.access_type === "community" ? "Open to all members" : session.access_type === "link" ? "Invitation link" : "Invitation only"}
        </span>

        <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1">
          {formatSchedule(session.scheduled_start_at)}
        </span>

        {membership && (
          <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1">
            {membership.role.replace("_", " ")}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
	<a
	  href={`/sessions/${session.id}`}
	  className="button-secondary !min-h-10 !px-4 !py-2 text-xs"
	>
	  View details
	</a>
        {isOrganizer && (
          <span className="text-sm font-medium text-[var(--forest)]">
            You organize this session.
          </span>
        )}

        {isInvited && (
          <>
            <form action={respondToInvitation}>
              <input
                type="hidden"
                name="session_id"
                value={session.id}
              />
              <input
                type="hidden"
                name="accept"
                value="true"
              />
              <button className="button-primary !min-h-10 !px-4 !py-2 text-xs">
                Accept invitation
              </button>
            </form>

            <form action={respondToInvitation}>
              <input
                type="hidden"
                name="session_id"
                value={session.id}
              />
              <input
                type="hidden"
                name="accept"
                value="false"
              />
              <button className="button-secondary !min-h-9 !px-4 !py-1.5 text-xs">
                Decline
              </button>
            </form>
          </>
        )}

        {canJoin && (
          <form action={joinCommunitySession}>
            <input
              type="hidden"
              name="session_id"
              value={session.id}
            />
            <button className="button-primary !min-h-9 !px-4 !py-1.5 text-xs">
              Join session
            </button>
          </form>
        )}

        {isAccepted && !isOrganizer && session.status !== "ended" && (
          <form action={leaveSession}>
            <input
              type="hidden"
              name="session_id"
              value={session.id}
            />
            <button className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-medium hover:bg-[var(--background)]">
              Leave session
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

function SessionSection({
  title,
  description,
  sessions,
  membershipMap,
  emptyMessage,
}: {
  title: string;
  description: string;
  sessions: Session[];
  membershipMap: Map<string, Membership>;
  emptyMessage: string;
}) {
  return (
    <section id={title === "Discover sessions" ? "discover-sessions" : undefined} className="mt-10">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[var(--ink)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {description}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-7 text-center">
          <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              membership={membershipMap.get(session.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SessionsLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="h-10 w-48 animate-pulse rounded bg-[var(--surface-soft)]" />
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
      </div>
    </main>
  );
}

async function SessionsContent({
  searchParams,
}: SessionsPageProps) {
  await connection();

  const params = await searchParams;
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.getClaims();

  const userId = authData?.claims?.sub;

  if (authError || typeof userId !== "string") {
    redirect("/login");
  }

  const [{ data: authUser }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, avatar_url, avatar_path").eq("id", userId).maybeSingle(),
  ]);
  const email = authUser.user?.email || "";
  const displayName = profile?.display_name || authUser.user?.user_metadata?.full_name || authUser.user?.user_metadata?.name || email.split("@")[0] || "Sakhi";
  const avatarUrl = profile?.avatar_url || (profile?.avatar_path ? (profile.avatar_path.startsWith("http") ? profile.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl) : null) || authUser.user?.user_metadata?.avatar_url || authUser.user?.user_metadata?.picture || null;

  const { data: notifications } = await supabase.from("session_notifications")
    .select("id, session_id, type, title, body, read_at, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(8);

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      "id, title, description, access_type, status, scheduled_start_at, created_by, is_draft"
    )
    .eq("is_draft", false)
    .in("status", ["scheduled", "live"])
    .order("created_at", { ascending: false });

  const { data: drafts, error: draftsError } = await supabase
    .from("sessions")
    .select("id, title, description, access_type, status, scheduled_start_at, created_by, is_draft")
    .eq("created_by", userId)
    .eq("is_draft", true)
    .order("updated_at", { ascending: false });

  const { data: memberships, error: membershipError } = await supabase
    .from("session_members")
    .select("session_id, role, status")
    .eq("user_id", userId);

  const visibleSessions = (sessions ?? []) as Session[];

  const membershipMap = new Map<string, Membership>(
    ((memberships ?? []) as Membership[]).map((membership) => [
      membership.session_id,
      membership,
    ])
  );

  const invitations = visibleSessions.filter(
    (session) => membershipMap.get(session.id)?.status === "invited"
  );

  const yourSessions = visibleSessions.filter((session) => {
    const membership = membershipMap.get(session.id);

    return (
      session.created_by === userId ||
      membership?.status === "accepted"
    );
  });

  const discoverSessions = visibleSessions.filter((session) => {
    const membership = membershipMap.get(session.id);

    return (
      session.access_type === "community" &&
      membership?.status !== "accepted" &&
      membership?.status !== "invited"
    );
  });

  const acceptedSessionIds = [...membershipMap.entries()]
    .filter(([, membership]) => membership.status === "accepted")
    .map(([sessionId]) => sessionId);

  const [ownedHistoryResult, joinedHistoryResult] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, title, description, access_type, status, scheduled_start_at, ended_at, created_by")
      .in("status", ["ended", "cancelled"])
      .eq("created_by", userId)
      .order("ended_at", { ascending: false })
      .limit(20),
    acceptedSessionIds.length
      ? supabase
          .from("sessions")
          .select("id, title, description, access_type, status, scheduled_start_at, ended_at, created_by")
          .in("status", ["ended", "cancelled"])
          .in("id", acceptedSessionIds)
          .order("ended_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const historyError = ownedHistoryResult.error || joinedHistoryResult.error;
  const historySessions = [...new Map<string, Session>(
    [...(ownedHistoryResult.data ?? []), ...(joinedHistoryResult.data ?? [])]
      .map((session): [string, Session] => [session.id, session as Session])
  ).values()].sort((a, b) => {
    const aTime = a.ended_at ? new Date(a.ended_at).getTime() : 0;
    const bTime = b.ended_at ? new Date(b.ended_at).getTime() : 0;
    return bTime - aTime;
  });

  const liveCount = visibleSessions.filter(
    (session) => session.status === "live"
  ).length;

  const upcomingCount = visibleSessions.filter(
    (session) => session.status === "scheduled"
  ).length;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <SiteHeader name={displayName} email={email} avatarUrl={avatarUrl} />
      <div className="page-shell py-8 sm:py-10">
        <header className="mb-8 flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl text-[var(--plum)] sm:text-5xl">Gatherings</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Plan, join, and manage gatherings with Sakhis.</p>
          </div>
          <a href="/sessions/new" className="button-primary w-fit">Create a Gathering</a>
        </header>

        {params.success && successMessages[params.success] && (
          <div className="mt-7 rounded-lg border border-[#d4e1d1] bg-[#edf3eb] p-4 text-sm text-[var(--forest)]">
            {successMessages[params.success]}
          </div>
        )}

        {params.error && errorMessages[params.error] && (
          <div className="mt-7 rounded-lg border border-red-200 bg-[#fbefed] p-4 text-sm text-red-800">
            {errorMessages[params.error]}
          </div>
        )}


        {notifications && notifications.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Updates</h2><span className="text-xs text-[var(--muted)]">{notifications.filter((item) => !item.read_at).length} unread</span></div>
            <div className="mt-3 divide-y divide-[var(--line)]">
              {notifications.map((item) => (
                <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}{!item.read_at && <span className="ml-2 inline-block size-2 rounded-full bg-[var(--plum)] align-middle"/>}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{formatSchedule(item.created_at)}</p>
                    {item.session_id && <Link href={`/sessions/${item.session_id}`} className="mt-2 inline-block text-xs font-semibold text-[var(--plum)] hover:underline">Open gathering</Link>}
                  </div>
                  {!item.read_at && <form action={markSessionNotificationRead}><input type="hidden" name="notification_id" value={item.id}/><button className="text-xs font-semibold text-[var(--plum)] hover:underline">Mark read</button></form>}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="surface-card p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {liveCount}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Live</p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {upcomingCount}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Upcoming</p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {invitations.length}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Invitations</p>
          </div>
        </div>

        {sessionsError || membershipError || historyError || draftsError ? (
          <p className="mt-8 rounded-lg border border-red-200 bg-[#fbefed] p-4 text-sm text-red-800">
            We could not load your sessions. Please refresh the page.
          </p>
        ) : (
          <>
            {((drafts ?? []) as Session[]).length > 0 && (
              <SessionSection
                title="Your drafts"
                description="Gatherings you have saved but not published."
                sessions={(drafts ?? []) as Session[]}
                membershipMap={membershipMap}
                emptyMessage="You have no saved drafts."
              />
            )}

            <SessionSection
              title="Your invitations"
              description="Sessions you have been personally invited to."
              sessions={invitations}
              membershipMap={membershipMap}
              emptyMessage="You have no pending invitations."
            />

            <SessionSection
              title="Your sessions"
              description="Sessions you organize or have joined."
              sessions={yourSessions}
              membershipMap={membershipMap}
              emptyMessage="You have not joined or organized any sessions yet."
            />

            {historySessions.length > 0 && (
              <SessionSection
                title="Past gatherings"
                description="Gatherings you have been part of."
                sessions={historySessions}
                membershipMap={membershipMap}
                emptyMessage="No past gatherings yet."
              />
            )}

            <SessionSection
              title="Discover sessions"
              description="Open sessions available to members."
              sessions={discoverSessions}
              membershipMap={membershipMap}
              emptyMessage="There are no other open gatherings available right now."
            />
          </>
        )}


      </div>
    </main>
  );
}

export default function SessionsPage(props: SessionsPageProps) {
  return (
    <Suspense fallback={<SessionsLoading />}>
      <SessionsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
