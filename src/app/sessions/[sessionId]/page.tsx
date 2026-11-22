import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SessionMembers from "./session-members";
import SessionRealtimeRefresh from "@/components/session-realtime-refresh";
import SiteHeader from "@/components/site-header";

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
  avatar_url: string | null;
  avatar_path: string | null;
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

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
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
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-soft)]" />
        <div className="mt-8 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
        <div className="mt-5 h-40 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
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

  const [{ data: authUser }, { data: ownProfile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, avatar_url, avatar_path").eq("id", userId).maybeSingle(),
  ]);
  const email = authUser.user?.email || "";
  const displayName = ownProfile?.display_name || authUser.user?.user_metadata?.full_name || authUser.user?.user_metadata?.name || email.split("@")[0] || "Sakhi";
  const avatarUrl = ownProfile?.avatar_url || (ownProfile?.avatar_path ? (ownProfile.avatar_path.startsWith("http") ? ownProfile.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(ownProfile.avatar_path).data.publicUrl) : null) || authUser.user?.user_metadata?.avatar_url || authUser.user?.user_metadata?.picture || null;

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

  const isAdmin =
    ownMembership?.role === "admin" &&
    ownMembership.status === "accepted";

  const canManage = isOrganizer || isInCharge || isAdmin;

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
        .select("id, display_name, avatar_url, avatar_path")
        .in("id", memberIds);

      profiles = (profileData ?? []) as Profile[];
    }
  }

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      { display_name: profile.display_name, avatar_url: profile.avatar_url || (profile.avatar_path ? (profile.avatar_path.startsWith("http") ? profile.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl) : null) },
    ])
  );

  const acceptedCount = members.filter(
    (member) => member.status === "accepted"
  ).length;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <SessionRealtimeRefresh sessionId={session.id} />
      <SiteHeader name={displayName} email={email} avatarUrl={avatarUrl} />
      <div className="page-shell py-8 sm:py-10">



        {paramsData.success &&
          successMessages[paramsData.success] && (
            <div className="mt-6 rounded-lg border border-[#d4e1d1] bg-[#edf3eb] p-4 text-sm text-[var(--forest)]">
              {successMessages[paramsData.success]}
            </div>
          )}

        {paramsData.error &&
          errorMessages[paramsData.error] && (
            <div className="mt-6 rounded-lg border border-red-200 bg-[#fbefed] p-4 text-sm text-red-800">
              {errorMessages[paramsData.error]}
            </div>
          )}

        <section className="surface-card mt-8 p-6 sm:p-9">

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ink)]">
              {session.access_type === "community"
                ? "Community session"
                : "Invitation only"}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                session.status === "live"
                  ? "bg-[#e6eee5] text-[var(--forest)]"
                  : session.status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : session.status === "ended"
                      ? "bg-[var(--surface-soft)] text-[var(--ink)]"
                      : "bg-[var(--surface-soft)] text-[var(--ink)]"
              }`}
            >
              {statusLabel(session.status)}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            {session.title}
          </h1>

          {session.description && (
            <p className="mt-4 whitespace-pre-wrap leading-7 text-[var(--muted)]">
              {session.description}
            </p>
          )}

          <div className="mt-7 grid gap-5 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Scheduled for
              </p>

              <p className="mt-2 text-sm font-medium text-[var(--ink)]">
                {formatDate(session.scheduled_start_at)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Participants
              </p>

              <p className="mt-2 text-sm font-medium text-[var(--ink)]">
                {isAccepted || canManage
                  ? `${acceptedCount} accepted`
                  : "Join to view participants"}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-6">

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
                    className="rounded-lg bg-[var(--plum)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--plum-deep)]"
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
                    className="rounded-lg border border-[#e7c8c7] px-5 py-2.5 text-sm font-medium text-[#a34e56] hover:bg-[#fbefed]"
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
              <span className="text-sm font-medium text-[var(--forest)]">
                You are the organizer.
              </span>
            )}

            {isInCharge && (
              <span className="text-sm font-medium text-[var(--forest)]">
                You are an in-charge member.
              </span>
            )}

            {isAdmin && (
              <span className="text-sm font-medium text-blue-800">
                You are a session admin.
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
                    className="rounded-lg bg-[var(--plum)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--plum-deep)]"
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
                    className="rounded-lg border border-[var(--line)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--background)]"
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
                  className="rounded-lg bg-[var(--plum)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--plum-deep)]"
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
                    className="rounded-lg border border-[var(--line)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--background)]"
                  >
                    Leave session
                  </button>
                </form>
              )}

            {/* Conference placeholder */}

            {isAccepted && session.status === "scheduled" && (
              <div className="w-full rounded-lg border border-[var(--line)] bg-[var(--background)] p-4">
                <p className="text-sm font-medium text-[var(--ink)]">
                  Conference room
                </p>

                <p className="mt-1 text-sm text-[var(--muted)]">
                  The conference room will become available when the
                  organizer starts the session.
                </p>
              </div>
            )}

            {isAccepted && session.status === "live" && (
              <div className="w-full rounded-lg border border-[#d4e1d1] bg-[#edf3eb] p-4">
                <p className="text-sm font-medium text-[var(--forest)]">
                  Session is live
                </p>

                <p className="mt-1 text-sm text-[var(--forest)]">
                  The conference room is ready.
                </p>

                <Link
                  href={`/sessions/${session.id}/conference`}
                  className="mt-4 inline-flex rounded-lg bg-[var(--plum)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--plum-deep)]"
                >
                  Enter conference
                </Link>
              </div>
            )}

            {session.status === "ended" && (
              <div className="w-full rounded-lg border border-[var(--line)] bg-[var(--background)] p-4">
                <p className="text-sm font-medium text-[var(--ink)]">
                  This session has ended.
                </p>
              </div>
            )}

            {session.status === "cancelled" && (
              <div className="w-full rounded-lg border border-red-200 bg-[#fbefed] p-4">
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
                <p className="text-sm text-[var(--muted)]">
                  This session is not currently available for joining.
                </p>
              )}
          </div>
        </section>

        {(isAccepted || canManage) && (
          <SessionMembers
            sessionId={session.id}
            currentUserId={userId}
            initialMembers={members.map((member) => ({
              ...member,
              display_name: profileMap.get(member.user_id)?.display_name ?? "Vaani member",
              avatar_url: profileMap.get(member.user_id)?.avatar_url ?? null,
            }))}
          />
        )}

        {/* Session information */}

        <section className="surface-card mt-7 p-6">
          <h2 className="text-sm font-semibold text-[var(--ink)]">
            Session information
          </h2>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">

            <div>
              <dt className="text-[var(--muted)]">
                Session ID
              </dt>

              <dd className="mt-1 break-all font-mono text-xs text-[var(--ink)]">
                {session.id}
              </dd>
            </div>

            <div>
              <dt className="text-[var(--muted)]">
                Created by
              </dt>

              <dd className="mt-1 text-[var(--ink)]">
                {session.created_by === userId
                  ? "You"
                  : "Session organizer"}
              </dd>
            </div>

            {session.started_at && (
              <div>
                <dt className="text-[var(--muted)]">
                  Started
                </dt>

                <dd className="mt-1 text-[var(--ink)]">
                  {formatDate(session.started_at)}
                </dd>
              </div>
            )}

            {session.ended_at && (
              <div>
                <dt className="text-[var(--muted)]">
                  Ended
                </dt>

                <dd className="mt-1 text-[var(--ink)]">
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
