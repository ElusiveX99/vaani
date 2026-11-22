import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SessionMembers from "./session-members";
import SessionRealtimeRefresh from "@/components/session-realtime-refresh";
import SiteHeader from "@/components/site-header";
import ConfirmSubmitButton from "@/components/confirm-submit-button";

import {
  joinCommunitySession,
  respondToInvitation,
  leaveSession,
  startSession,
  endSession,
  cancelSession,
  createInviteLink,
  inviteMemberByEmail,
  revokeMemberInvitation,
  publishSessionDraft,
  updateSessionDetails,
  approveJoinRequest,
  rejectJoinRequest,
  revokeInviteLink,
  resumeSession,
  cancelJoinRequest,
  deleteEndedSession,
  deleteSessionDraft,
  updateSessionDraft,
} from "../actions";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{
    success?: string;
    error?: string;
    invite?: string;
  }>;
};

type Session = {
  id: string;
  title: string;
  description: string | null;
  access_type: "community" | "invitation_only" | "link";
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduled_start_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_by: string;
  is_draft: boolean;
  time_zone: string;
  duration_minutes: number | null;
  instructions: string | null;
  participant_limit: number | null;
  waiting_room_enabled: boolean;
  allow_participant_invites: boolean;
  recurrence_rule: string | null;
  recurrence_until: string | null;
  recurrence_parent_id: string | null;
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
  session_resumed: "The gathering has been resumed.",
  joined: "You have joined the session.",
  invitation_updated: "Your invitation response has been saved.",
  left: "You have left the session.",
  invite_link_created: "Invitation link created. Copy it below.",
  member_invited: "The Vaani member has been invited.",
  invitation_revoked: "The invitation has been revoked.",
  joined_by_invite: "You have joined the gathering.",
  draft_saved: "Your draft has been saved.",
  published: "Your gathering has been published.",
  session_updated: "Gathering details updated.",
  join_request_sent: "Your request has been sent to the organizer.",
  join_request_cancelled: "Your join request has been cancelled.",
  join_request_approved: "The join request was approved.",
  join_request_rejected: "The join request was declined.",
};

const errorMessages: Record<string, string> = {
  start_failed: "The session could not be started.",
  end_failed: "The session could not be ended.",
  cancel_failed: "The session could not be cancelled.",
  delete_failed: "This ended gathering could not be permanently deleted.",
  draft_delete_failed: "This draft could not be deleted.",
  draft_update_failed: "The draft could not be saved. Please try again.",
  resume_failed: "The gathering could not be resumed.",
  invalid_invitee: "Enter a valid member email address.",
  invite_member_failed: "That member could not be invited.",
  invalid_invite_link: "The invitation link could not be created.",
  invite_link_failed: "The invitation link is invalid, expired, or could not be used.",
  revoke_invitation_failed: "The invitation could not be revoked.",
  publish_failed: "The draft could not be published. Check that its start time is in the future.",
  invalid_edit: "Check the title, access, and future start time.",
  update_failed: "The gathering could not be updated.",
  invalid_options: "Check the time zone, duration, and participant limit.",
  invalid_recurrence: "Choose a valid repeat pattern and end date within one year.",
  join_request_action_failed: "The join request could not be updated.",
};


function dateTimeInputValue(value: string | null, timeZone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
function dateInputValue(value: string | null, timeZone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(value: string | null, timeZone = "Asia/Kolkata") {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
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
      "id, title, description, access_type, status, scheduled_start_at, started_at, ended_at, created_by, is_draft, time_zone, duration_minutes, instructions, participant_limit, waiting_room_enabled, allow_participant_invites, recurrence_rule, recurrence_until, recurrence_parent_id"
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
  const { data: ownJoinRequest } = session.waiting_room_enabled && ownMembership?.status !== "accepted"
    ? await supabase.from("session_join_requests").select("id").eq("session_id", session.id).eq("user_id", userId).eq("status", "pending").maybeSingle()
    : { data: null };

  const isOrganizer =
    ownMembership?.role === "organizer" &&
    ownMembership.status === "accepted";



  if (session.is_draft) {
    if (!isOrganizer || session.created_by !== userId) notFound();

    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
        <SiteHeader name={displayName} email={email} avatarUrl={avatarUrl} />
        <div className="page-shell py-8 sm:py-10">
          <Link href="/sessions" className="text-sm font-medium text-[var(--plum)] hover:underline">
            ← Back to Gatherings
          </Link>

          {paramsData.error && errorMessages[paramsData.error] && (
            <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-[#fbefed] p-4 text-sm text-red-800">
              {errorMessages[paramsData.error]}
            </div>
          )}
          {paramsData.success && successMessages[paramsData.success] && (
            <div role="status" className="mt-6 rounded-lg border border-[#d4e1d1] bg-[#edf3eb] p-4 text-sm text-[var(--forest)]">
              {successMessages[paramsData.success]}
            </div>
          )}

          <section className="surface-card mt-6 p-6 sm:p-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-3xl text-[var(--plum)] sm:text-4xl">Edit draft</h1>
              <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">Draft</span>
            </div>
            <form action={updateSessionDraft} className="mt-8 grid gap-5">
              <input type="hidden" name="session_id" value={session.id} />
              <input type="hidden" name="time_zone" value={session.time_zone || "Asia/Kolkata"} />
              <div>
                <label className="field-label mb-2" htmlFor="draft-title">Gathering title</label>
                <input id="draft-title" name="title" required maxLength={120} defaultValue={session.title} className="field-input" />
              </div>
              <div>
                <label className="field-label mb-2" htmlFor="draft-description">Description</label>
                <textarea id="draft-description" name="description" rows={4} maxLength={2000} defaultValue={session.description || ""} className="field-input resize-y" />
              </div>
              <div className="max-w-md">
                <label className="field-label mb-2" htmlFor="draft-start">Start date and time</label>
                <input id="draft-start" name="scheduled_start_local" type="datetime-local" defaultValue={dateTimeInputValue(session.scheduled_start_at, session.time_zone || "Asia/Kolkata")} className="field-input" />
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  formAction={deleteSessionDraft}
                  formNoValidate
                  onClick={(event) => {
                    if (!window.confirm("Permanently delete this draft? This cannot be undone.")) event.preventDefault();
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#e7c8c7] px-5 py-2.5 text-sm font-medium text-[#a34e56] transition hover:bg-[#fbefed]"
                >
                  Delete draft
                </button>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="submit" name="intent" value="save" className="button-secondary">Save draft</button>
                  <button formAction={publishSessionDraft} formMethod="post" name="session_id" value={session.id} className="button-primary">Publish gathering</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }


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
      ownMembership.status === "removed") && !ownJoinRequest;

  const isAdmin =
    ownMembership?.role === "admin" &&
    ownMembership.status === "accepted";

  const canManage = isOrganizer || isInCharge || isAdmin;

  let members: Membership[] = [];
  let profiles: Profile[] = [];
  let joinRequests: { id: string; user_id: string; created_at: string }[] = [];

  if (isAccepted || canManage) {
    const { data: memberData } = await supabase
      .from("session_members")
      .select("user_id, role, status")
      .eq("session_id", session.id)
      .in("status", ["accepted", "invited"])
      .order("created_at", { ascending: true });
    members = (memberData ?? []) as Membership[];
  }
  if (canManage && session.waiting_room_enabled) {
    const { data: requests } = await supabase.from("session_join_requests")
      .select("id, user_id, created_at").eq("session_id", session.id)
      .eq("status", "pending").order("created_at", { ascending: true });
    joinRequests = requests ?? [];
  }
  const memberIds = [...new Set([...members.map((member) => member.user_id), ...joinRequests.map((request) => request.user_id)])];
  if (memberIds.length > 0) {
    const { data: profileData } = await supabase.from("profiles")
      .select("id, display_name, avatar_url, avatar_path").in("id", memberIds);
    profiles = (profileData ?? []) as Profile[];
  }

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      { display_name: profile.display_name, avatar_url: profile.avatar_url || (profile.avatar_path ? (profile.avatar_path.startsWith("http") ? profile.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl) : null) },
    ])
  );

  const { data: inviteLinks } = canManage ? await supabase
    .from("session_invite_links")
    .select("id, label, max_uses, use_count, expires_at, revoked_at, created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false }) : { data: [] };

  const { data: invitations } = canManage ? await supabase
    .from("session_invitations")
    .select("id, user_id, email, status, created_at, responded_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false }) : { data: [] };

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
              {session.access_type === "community" ? "Community session" : session.access_type === "link" ? "Invitation link" : "Invitation only"}
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
              {session.is_draft ? "Draft" : statusLabel(session.status)}
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
                {formatDate(session.scheduled_start_at, session.time_zone)}
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

            {isOrganizer && session.status === "scheduled" && !session.is_draft && (
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

            {isOrganizer && session.status === "cancelled" && session.scheduled_start_at && new Date(session.scheduled_start_at).getTime() > Date.now() && (
              <form action={resumeSession}>
                <input type="hidden" name="session_id" value={session.id}/>
                <button className="button-primary">Resume gathering</button>
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

            {ownJoinRequest && !isAccepted && (
              <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">Your request is awaiting approval.</p>
                <p className="mt-1 text-sm text-amber-800">The organizer will review your request before you can enter.</p>
                <form action={cancelJoinRequest} className="mt-3"><input type="hidden" name="session_id" value={session.id}/><input type="hidden" name="request_id" value={ownJoinRequest.id}/><button className="text-sm font-semibold text-amber-900 underline">Cancel request</button></form>
              </div>
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
                {isOrganizer && (
                  <form action={deleteEndedSession} className="mt-4">
                    <input type="hidden" name="session_id" value={session.id} />
                    <ConfirmSubmitButton
                      message="Permanently delete this ended gathering and its associated history? This cannot be undone."
                      className="rounded-lg border border-[#e7c8c7] px-4 py-2 text-sm font-medium text-[#a34e56] hover:bg-[#fbefed]"
                    >
                      Permanently delete gathering
                    </ConfirmSubmitButton>
                  </form>
                )}
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


        {canManage && session.status !== "ended" && session.status !== "cancelled" && !session.is_draft && (
          <section className="surface-card mt-7 p-6 sm:p-8">
            <div>
              <h2 className="text-xl font-semibold">Invite Sakhis</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Find an existing Vaani member by email or create a secure invitation link. Members receive an in-app notification.
              </p>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] p-5">
                <h3 className="font-semibold">Invite by email</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  The email must belong to an existing Vaani account.
                </p>
                <form action={inviteMemberByEmail} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input type="hidden" name="session_id" value={session.id} />
                  <input name="email" type="email" required placeholder="member@example.com" className="field-input min-w-0 flex-1" />
                  <button className="button-primary !min-h-10 !px-4 !py-2 text-sm">Invite</button>
                </form>
              </div>

              <div className="rounded-xl border border-[var(--line)] p-5">
                <h3 className="font-semibold">Create invitation link</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Anyone with the link can use it while it is valid. They still need a Vaani account.
                </p>
                <form action={createInviteLink} className="mt-4 space-y-3">
                  <input type="hidden" name="session_id" value={session.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select name="expiry_hours" defaultValue="168" className="field-input">
                      <option value="24">Expires in 24 hours</option>
                      <option value="72">Expires in 3 days</option>
                      <option value="168">Expires in 7 days</option>
                      <option value="720">Expires in 30 days</option>
                      <option value="0">No expiry</option>
                    </select>
                    <input name="max_uses" type="number" min="1" max="500" placeholder="Uses: unlimited" className="field-input" />
                  </div>
                  <input name="label" maxLength={80} placeholder="Optional label, e.g. Sakhi Sang" className="field-input" />
                  <button className="button-primary !min-h-10 !px-4 !py-2 text-sm">Create link</button>
                </form>
              </div>
            </div>

            {paramsData.success === "invite_link_created" && paramsData.invite && (
              <div className="mt-5 rounded-xl border border-[#d4e1d1] bg-[#edf3eb] p-5">
                <p className="text-sm font-medium text-[var(--forest)]">Invitation link</p>
                <input readOnly value={paramsData.invite} className="field-input mt-3 text-xs" onFocus={(event) => event.currentTarget.select()} />
                <p className="mt-2 text-xs text-[var(--muted)]">Copy this link and share it with the intended participants.</p>
              </div>
            )}

            {((inviteLinks ?? []).length > 0 || (invitations ?? []).length > 0) && (
              <div className="mt-6 space-y-5">
                {(inviteLinks ?? []).filter((link: any) => !link.revoked_at).map((link: any) => (
                  <div key={link.id} className="flex flex-col gap-2 rounded-xl border border-[var(--line)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{link.label || "Invitation link"}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {link.max_uses ? `${link.use_count} of ${link.max_uses} uses` : `${link.use_count} uses · no limit`}
                        {link.expires_at ? ` · expires ${formatDate(link.expires_at, session.time_zone)}` : " · no expiry"}
                      </p>
                    </div>
                    <form action={revokeInviteLink}><input type="hidden" name="session_id" value={session.id}/><input type="hidden" name="link_id" value={link.id}/><button className="button-secondary !min-h-9 !px-3 !py-1.5 text-xs">Revoke link</button></form>
                  </div>
                ))}

                {(invitations ?? []).map((invitation: any) => (
                  <div key={invitation.id} className="flex flex-col gap-3 rounded-xl border border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{invitation.email}</p>
                      <p className="mt-1 text-xs capitalize text-[var(--muted)]">{invitation.status}</p>
                    </div>
                    {invitation.status === "pending" && invitation.user_id && (
                      <form action={revokeMemberInvitation}>
                        <input type="hidden" name="session_id" value={session.id} />
                        <input type="hidden" name="user_id" value={invitation.user_id} />
                        <button className="button-secondary !min-h-9 !px-3 !py-1.5 text-xs">Revoke</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {canManage && session.waiting_room_enabled && (
          <section className="surface-card mt-7 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Join requests</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Review members waiting for approval.</p>
            {joinRequests.length === 0 ? <p className="mt-5 text-sm text-[var(--muted)]">No pending requests.</p> : (
              <div className="mt-5 divide-y divide-[var(--line)]">
                {joinRequests.map((request) => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div><p className="font-medium">{profileMap.get(request.user_id)?.display_name ?? "Vaani member"}</p><p className="text-xs text-[var(--muted)]">Requested {formatDate(request.created_at, session.time_zone)}</p></div>
                    <div className="flex gap-2">
                      <form action={approveJoinRequest}><input type="hidden" name="session_id" value={session.id}/><input type="hidden" name="request_id" value={request.id}/><button className="button-primary !min-h-9 !px-3 !py-1.5 text-xs">Approve</button></form>
                      <form action={rejectJoinRequest}><input type="hidden" name="session_id" value={session.id}/><input type="hidden" name="request_id" value={request.id}/><button className="button-secondary !min-h-9 !px-3 !py-1.5 text-xs">Decline</button></form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {isOrganizer && session.status === "scheduled" && !session.is_draft && (
          <section className="surface-card mt-7 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Edit gathering</h2>
            <form action={updateSessionDetails} className="mt-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="session_id" value={session.id}/>
              <input type="hidden" name="time_zone" value={session.time_zone || "Asia/Kolkata"}/>
              <div><label className="field-label mb-2" htmlFor="edit-title">Title</label><input id="edit-title" name="title" required maxLength={120} defaultValue={session.title} className="field-input"/></div>
              <div><label className="field-label mb-2" htmlFor="edit-start">Start date and time</label><input id="edit-start" name="scheduled_start_at" type="datetime-local" required defaultValue={dateTimeInputValue(session.scheduled_start_at, session.time_zone || "Asia/Kolkata")} className="field-input"/></div>
              <div className="sm:col-span-2"><label className="field-label mb-2" htmlFor="edit-description">Description</label><textarea id="edit-description" name="description" rows={3} defaultValue={session.description || ""} className="field-input"/></div>
              <div><label className="field-label mb-2" htmlFor="edit-access">Access</label><select id="edit-access" name="access_type" defaultValue={session.access_type} className="field-input"><option value="community">All Vaani members</option><option value="invitation_only">Invite-only</option><option value="link">Anyone with an invitation link</option></select></div>
              <div><label className="field-label mb-2" htmlFor="edit-duration">Duration (minutes)</label><input id="edit-duration" name="duration_minutes" type="number" min="15" max="480" defaultValue={session.duration_minutes ?? ""} className="field-input"/></div>
              <div><label className="field-label mb-2" htmlFor="edit-limit">Participant limit</label><input id="edit-limit" name="participant_limit" type="number" min="2" max="500" defaultValue={session.participant_limit ?? ""} className="field-input"/></div>
              <div><label className="field-label mb-2" htmlFor="edit-repeat">Repeat</label><select id="edit-repeat" name="recurrence_rule" defaultValue={session.recurrence_rule || ""} className="field-input"><option value="">Does not repeat</option><option value="DAILY">Every day</option><option value="WEEKLY">Every week</option><option value="BIWEEKLY">Every two weeks</option><option value="EVERY_3_WEEKS">Every three weeks</option><option value="EVERY_4_WEEKS">Every four weeks</option><option value="MONTHLY">Every month</option></select></div>
              <div><label className="field-label mb-2" htmlFor="edit-repeat-until">Repeat until</label><input id="edit-repeat-until" name="recurrence_until" type="date" defaultValue={dateInputValue(session.recurrence_until, session.time_zone || "Asia/Kolkata")} className="field-input"/></div>
              <div className="sm:col-span-2"><label className="field-label mb-2" htmlFor="edit-instructions">Participant instructions</label><textarea id="edit-instructions" name="instructions" rows={2} defaultValue={session.instructions || ""} className="field-input"/></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="waiting_room_enabled" defaultChecked={session.waiting_room_enabled}/> Use waiting room</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_participant_invites" defaultChecked={session.allow_participant_invites}/> Allow participant invitations</label>
              
              <div className="sm:col-span-2"><button className="button-primary">Save changes</button></div>
            </form>
          </section>
        )}

        {isAccepted && session.allow_participant_invites && !canManage && session.status !== "ended" && session.status !== "cancelled" && (
          <section className="surface-card mt-7 p-6">
            <h2 className="text-lg font-semibold">Invite someone</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">The organizer has allowed participants to share invitation links.</p>
            <form action={createInviteLink} className="mt-4 space-y-3">
              <input type="hidden" name="session_id" value={session.id}/>
              <div className="grid gap-3 sm:grid-cols-2">
                <select name="expiry_hours" defaultValue="168" className="field-input"><option value="24">Expires in 24 hours</option><option value="72">Expires in 3 days</option><option value="168">Expires in 7 days</option><option value="720">Expires in 30 days</option><option value="0">No expiry</option></select>
                <input name="max_uses" type="number" min="1" max="500" placeholder="Uses: unlimited" className="field-input"/>
              </div>
              <button className="button-primary">Create invitation link</button>
            </form>
            {paramsData.success === "invite_link_created" && paramsData.invite && <div className="mt-4"><input readOnly value={paramsData.invite} className="field-input text-xs" onFocus={(event)=>event.currentTarget.select()}/><p className="mt-2 text-xs text-[var(--muted)]">Copy and share this link.</p></div>}
          </section>
        )}

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
                Access
              </dt>

              <dd className="mt-1 text-[var(--ink)]">
                {session.access_type === "community" ? "All Vaani members" : session.access_type === "link" ? "Invitation link" : "Invite-only"}
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


            <div>
              <dt className="text-[var(--muted)]">Time zone</dt>
              <dd className="mt-1 text-[var(--ink)]">{session.time_zone}</dd>
            </div>
            {session.duration_minutes && <div><dt className="text-[var(--muted)]">Expected duration</dt><dd className="mt-1 text-[var(--ink)]">{session.duration_minutes} minutes</dd></div>}
            {session.instructions && <div className="sm:col-span-2"><dt className="text-[var(--muted)]">Participant instructions</dt><dd className="mt-1 whitespace-pre-wrap text-[var(--ink)]">{session.instructions}</dd></div>}
            {session.recurrence_parent_id && <div><dt className="text-[var(--muted)]">Series</dt><dd className="mt-1 text-[var(--ink)]">This is one occurrence in a recurring gathering.</dd></div>}
            {session.recurrence_rule && <div><dt className="text-[var(--muted)]">Repeats</dt><dd className="mt-1 text-[var(--ink)]">{session.recurrence_rule === "DAILY" ? "Every day" : session.recurrence_rule === "WEEKLY" ? "Every week" : session.recurrence_rule === "BIWEEKLY" ? "Every two weeks" : session.recurrence_rule === "EVERY_3_WEEKS" ? "Every three weeks" : session.recurrence_rule === "EVERY_4_WEEKS" ? "Every four weeks" : "Every month"} until {formatDate(session.recurrence_until, session.time_zone)}</dd></div>}

            {session.started_at && (
              <div>
                <dt className="text-[var(--muted)]">
                  Started
                </dt>

                <dd className="mt-1 text-[var(--ink)]">
                  {formatDate(session.started_at, session.time_zone)}
                </dd>
              </div>
            )}

            {session.ended_at && (
              <div>
                <dt className="text-[var(--muted)]">
                  Ended
                </dt>

                <dd className="mt-1 text-[var(--ink)]">
                  {formatDate(session.ended_at, session.time_zone)}
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
