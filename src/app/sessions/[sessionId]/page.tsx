import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import {
  joinCommunitySession,
  respondToInvitation,
  leaveSession,
  startSession,
  endSession,
  cancelSession,
} from "../actions";

type PageProps = {
  params: Promise<{ sessionId: string }>;
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
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduled_start_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_by: string;
};

type Membership = {
  user_id: string;
  role: string;
  status: string;
};

type Profile = {
  id: string;
  display_name: string;
};

const successMessages: Record<string, string> = {
  session_started: "The session has started.",
  session_ended: "The session has ended.",
  session_cancelled: "The session has been cancelled.",
  joined: "You have joined the session.",
  invitation_updated: "Your invitation response has been saved.",
  left: "You have left the session.",
};

const errorMessages: Record<string, string> = {
  start_failed: "The session could not be started.",
  end_failed: "The session could not be ended.",
  cancel_failed: "The session could not be cancelled.",
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: Session["status"]) {
  switch (status) {
    case "live":
      return "Live now";
    case "scheduled":
      return "Upcoming";
    case "ended":
      return "Ended";
    case "cancelled":
      return "Cancelled";
  }
}

function SessionLoading() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="h-5 w-32 animate-pulse rounded bg-stone-200" />
        <div className="mt-8 h-48 animate-pulse rounded-2xl bg-stone-200" />
        <div className="mt-5 h-40 animate-pulse rounded-2xl bg-stone-200" />
      </div>
    </main>
  );
}

async function SessionContent({ params, searchParams }: PageProps) {
  await connection();

  const { sessionId } = await params;
  const paramsData = await searchParams;

  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.getClaims();

  const userId = authData?.claims?.sub;

  if (authError || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select(
      "id, title, description, access_type, status, scheduled_start_at, started_at, ended_at, created_by"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !sessionData) {
    notFound();
  }

  const session = sessionData as Session;

  const { data: ownMembershipData } = await supabase
    .from("session_members")
    .select("user_id, role, status")
    .eq("session_id", session.id)
    .eq("user_id", userId)
    .maybeSingle();

  const ownMembership = ownMembershipData as Membership | null;

  const isOrganizer =
    ownMembership?.role === "organizer" &&
    ownMembership.status === "accepted";

  const isInCharge =
    ownMembership?.role === "in_charge" &&
    ownMembership.status === "accepted";

  const isAccepted = ownMembership?.status === "accepted";
  const isInvited = ownMembership?.status === "invited";

  const canJoin =
    session.access_type === "community" &&
    session.status !== "ended" &&
    session.status !== "cancelled" &&
    (!ownMembership ||
      ownMembership.status === "declined" ||
      ownMembership.status === "removed");

  const canManage = isOrganizer || isInCharge;

  let members: Membership[] = [];
  let profiles: Profile[] = [];

  if (isAccepted || canManage) {
    const { data: memberData } = await supabase
      .from("session_members")
      .select("user_id, role, status")
      .eq("session_id", session.id)
      .in("status", ["accepted", "invited"])
      .order("created_at", { ascending: true });

    members = (memberData ?? []) as Membership[];

    const memberIds = [
      ...new Set(members.map((member) => member.user_id)),
    ];

    if (memberIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds);

      profiles = (profileData ?? []) as Profile[];
    }
  }

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      profile.display_name,
    ])
  );

  const acceptedCount = members.filter(
    (member) => member.status === "accepted"
  ).length;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 text-stone-900 sm:px-8">
      <div className="mx-auto max-w-4xl">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <a
            href="/sessions"
            className="text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            ← Back to sessions
          </a>

          <span className="text-sm font-semibold tracking-wide text-emerald-800">
            VAANI
          </span>
        </header>

        {paramsData.success &&
          successMessages[paramsData.success] && (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              {successMessages[paramsData.success]}
            </div>
          )}

        {paramsData.error &&
          errorMessages[paramsData.error] && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {errorMessages[paramsData.error]}
            </div>
          )}

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
              {session.access_type === "community"
                ? "Community session"
                : "Invitation only"}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                session.status === "live"
                  ? "bg-emerald-100 text-emerald-800"
                  : session.status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : session.status === "ended"
                      ? "bg-stone-200 text-stone-700"
                      : "bg-stone-100 text-stone-700"
              }`}
            >
              {statusLabel(session.status)}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            {session.title}
          </h1>

          {session.description && (
            <p className="mt-4 whitespace-pre-wrap leading-7 text-stone-600">
              {session.description}
            </p>
          )}

          <div className="mt-7 grid gap-5 border-t border-stone-200 pt-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Scheduled for
              </p>

              <p className="mt-2 text-sm font-medium text-stone-900">
                {formatDate(session.scheduled_start_at)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Participants
              </p>

              <p className="mt-2 text-sm font-medium text-stone-900">
                {isAccepted || canManage
                  ? `${acceptedCount} accepted`
                  : "Join to view participants"}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-6">

            {/* Organizer lifecycle controls */}

            {isOrganizer && session.status === "scheduled" && (
              <>
                <form action={startSession}>
                  <input
                    type="hidden"
                    name="session_id"
                    value={session.id}
                  />

                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Start session
                  </button>
                </form>

                <form action={cancelSession}>
                  <input
                    type="hidden"
                    name="session_id"
                    value={session.id}
                  />

                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Cancel session
                  </button>
                </form>
              </>
            )}

            {isOrganizer && session.status === "live" && (
              <form action={endSession}>
                <input
                  type="hidden"
                  name="session_id"
                  value={session.id}
                />

                <button
                  type="submit"
                  className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600"
                >
                  End session
                </button>
              </form>
            )}

            {/* Role information */}

            {isOrganizer && (
              <span className="text-sm font-medium text-emerald-800">
                You are the organizer.
              </span>
            )}

            {isInCharge && (
              <span className="text-sm font-medium text-emerald-800">
                You are an in-charge member.
              </span>
            )}

            {/* Invitation controls */}

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

                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
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

                  <button
                    type="submit"
                    className="rounded-lg border border-stone-300 px-5 py-2.5 text-sm font-medium hover:bg-stone-50"
                  >
                    Decline
                  </button>
                </form>
              </>
            )}

            {/* Community join */}

            {canJoin && (
              <form action={joinCommunitySession}>
                <input
                  type="hidden"
                  name="session_id"
                  value={session.id}
                />

                <button
                  type="submit"
                  className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Join session
                </button>
              </form>
            )}

            {/* Leave */}

            {isAccepted &&
              !isOrganizer &&
              session.status !== "ended" &&
              session.status !== "cancelled" && (
                <form action={leaveSession}>
                  <input
                    type="hidden"
                    name="session_id"
                    value={session.id}
                  />

                  <button
                    type="submit"
                    className="rounded-lg border border-stone-300 px-5 py-2.5 text-sm font-medium hover:bg-stone-50"
                  >
                    Leave session
                  </button>
                </form>
              )}

            {/* Conference placeholder */}

            {isAccepted && session.status === "scheduled" && (
              <div className="w-full rounded-lg border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-medium text-stone-900">
                  Conference room
                </p>

                <p className="mt-1 text-sm text-stone-600">
                  The conference room will become available when the
                  organizer starts the session.
                </p>
              </div>
            )}

            {isAccepted && session.status === "live" && (
              <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-900">
                  Session is live
                </p>

                <p className="mt-1 text-sm text-emerald-800">
                  The conference room is ready.
                </p>

                <a
                  href={`/sessions/${session.id}/conference`}
                  className="mt-4 inline-flex rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Enter conference
                </a>
              </div>
            )}

            {session.status === "ended" && (
              <div className="w-full rounded-lg border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-medium text-stone-900">
                  This session has ended.
                </p>
              </div>
            )}

            {session.status === "cancelled" && (
              <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-900">
                  This session was cancelled.
                </p>
              </div>
            )}

            {!isAccepted &&
              !isInvited &&
              !canJoin &&
              session.status !== "ended" &&
              session.status !== "cancelled" && (
                <p className="text-sm text-stone-600">
                  This session is not currently available for joining.
                </p>
              )}
          </div>
        </section>

        {/* Members */}

        {(isAccepted || canManage) && (
          <section className="mt-7 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  Session members
                </h2>

                <p className="mt-1 text-sm text-stone-600">
                  Members and their current session roles.
                </p>
              </div>

              <span className="text-sm text-stone-500">
                {acceptedCount} accepted
              </span>
            </div>

            {members.length === 0 ? (
              <p className="mt-6 text-sm text-stone-600">
                No member information is currently available.
              </p>
            ) : (
              <div className="mt-5 divide-y divide-stone-100">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {profileMap.get(member.user_id) ??
                          "Vaani member"}

                        {member.user_id === userId
                          ? " (You)"
                          : ""}
                      </p>

                      <p className="mt-1 text-xs capitalize text-stone-500">
                        {member.role.replace("_", " ")}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        member.status === "accepted"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {member.status === "accepted"
                        ? "Accepted"
                        : "Invited"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Session information */}

        <section className="mt-7 rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-900">
            Session information
          </h2>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">

            <div>
              <dt className="text-stone-500">
                Session ID
              </dt>

              <dd className="mt-1 break-all font-mono text-xs text-stone-700">
                {session.id}
              </dd>
            </div>

            <div>
              <dt className="text-stone-500">
                Created by
              </dt>

              <dd className="mt-1 text-stone-700">
                {session.created_by === userId
                  ? "You"
                  : "Session organizer"}
              </dd>
            </div>

            {session.started_at && (
              <div>
                <dt className="text-stone-500">
                  Started
                </dt>

                <dd className="mt-1 text-stone-700">
                  {formatDate(session.started_at)}
                </dd>
              </div>
            )}

            {session.ended_at && (
              <div>
                <dt className="text-stone-500">
                  Ended
                </dt>

                <dd className="mt-1 text-stone-700">
                  {formatDate(session.ended_at)}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </main>
  );
}

export default function SessionPage(props: PageProps) {
  return (
    <Suspense fallback={<SessionLoading />}>
      <SessionContent
        params={props.params}
        searchParams={props.searchParams}
      />
    </Suspense>
  );
}
