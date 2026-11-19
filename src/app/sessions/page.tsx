import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateSessionForm from "./create-session-form";

import {
  createSession,
  joinCommunitySession,
  respondToInvitation,
  leaveSession,
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
  access_type: "community" | "invitation_only";
  status: "scheduled" | "live";
  scheduled_start_at: string | null;
  created_by: string;
};

type Membership = {
  session_id: string;
  role: string;
  status: string;
};

const successMessages: Record<string, string> = {
  created: "Your session has been created.",
  joined: "You have joined the session.",
  invitation_updated: "Your invitation response has been saved.",
  left: "You have left the session.",
};

const errorMessages: Record<string, string> = {
  invalid_input: "Check your session title and description.",
  invalid_access: "Select a valid session access type.",
  create_failed: "The session could not be created.",
  join_failed: "You could not join this session.",
  invitation_failed: "Your invitation response could not be saved.",
  leave_failed: "You could not leave this session.",
};

function formatSchedule(value: string | null) {
  if (!value) return "Time not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
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
    session.access_type === "community" &&
    (!membership ||
      membership.status === "declined" ||
      membership.status === "removed");

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">
            {session.title}
          </h3>

          {session.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
              {session.description}
            </p>
          )}
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            session.status === "live"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-stone-100 text-stone-700"
          }`}
        >
          {session.status === "live" ? "Live now" : "Upcoming"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
        <span className="rounded-full bg-stone-100 px-3 py-1">
          {session.access_type === "community"
            ? "Community"
            : "Invitation only"}
        </span>

        <span className="rounded-full bg-stone-100 px-3 py-1">
          {formatSchedule(session.scheduled_start_at)}
        </span>

        {membership && (
          <span className="rounded-full bg-stone-100 px-3 py-1">
            {membership.role.replace("_", " ")}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
	<a
	  href={`/sessions/${session.id}`}
	  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
	>
	  View details
	</a>
        {isOrganizer && (
          <span className="text-sm font-medium text-emerald-800">
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
              <button className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
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
              <button className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50">
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
            <button className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Join session
            </button>
          </form>
        )}

        {isAccepted && !isOrganizer && (
          <form action={leaveSession}>
            <input
              type="hidden"
              name="session_id"
              value={session.id}
            />
            <button className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50">
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
    <section className="mt-10">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-stone-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {description}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-7 text-center">
          <p className="text-sm text-stone-600">{emptyMessage}</p>
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
    <main className="min-h-screen bg-stone-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="h-10 w-48 animate-pulse rounded bg-stone-200" />
        <div className="mt-8 h-40 animate-pulse rounded-2xl bg-stone-200" />
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

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      "id, title, description, access_type, status, scheduled_start_at, created_by"
    )
    .in("status", ["scheduled", "live"])
    .order("created_at", { ascending: false });

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

  const liveCount = visibleSessions.filter(
    (session) => session.status === "live"
  ).length;

  const upcomingCount = visibleSessions.filter(
    (session) => session.status === "scheduled"
  ).length;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 text-stone-900 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-wide text-emerald-800">
              VAANI
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Sessions
            </h1>
            <p className="mt-2 text-stone-600">
              Discover gatherings, participate, and connect with the community.
            </p>
          </div>

          <a
            href="/home"
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-white"
          >
            Back to home
          </a>
        </header>

        {params.success && successMessages[params.success] && (
          <div className="mt-7 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {successMessages[params.success]}
          </div>
        )}

        {params.error && errorMessages[params.error] && (
          <div className="mt-7 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errorMessages[params.error]}
          </div>
        )}

        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {liveCount}
            </p>
            <p className="mt-1 text-xs text-stone-600">Live</p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {upcomingCount}
            </p>
            <p className="mt-1 text-xs text-stone-600">Upcoming</p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {invitations.length}
            </p>
            <p className="mt-1 text-xs text-stone-600">Invitations</p>
          </div>
        </div>

        {sessionsError || membershipError ? (
          <p className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            We could not load your sessions. Please refresh the page.
          </p>
        ) : (
          <>
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

            <SessionSection
              title="Discover sessions"
              description="Community sessions available for all Vaani members."
              sessions={discoverSessions}
              membershipMap={membershipMap}
              emptyMessage="There are no other community sessions available right now."
            />
          </>
        )}

        <section className="mt-12 border-t border-stone-200 pt-8">
          <details className="group rounded-2xl border border-stone-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6">
              <div>
                <h2 className="text-xl font-semibold">
                  Organize a session
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Create a new Chaturasi Ji gaayan, Pada gaayan, or discussion session.
                </p>
              </div>

              <span className="text-2xl text-stone-500 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>

            <div className="border-t border-stone-200 p-6">
              <CreateSessionForm action={createSession} />
            </div>
          </details>
        </section>
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
