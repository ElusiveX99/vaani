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
  createInviteLink,
  inviteMemberByEmail,
  revokeMemberInvitation,
  publishSessionDraft,
  updateSessionDetails,
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
  invite_link_created: "Invitation link created. Copy it below.",
  member_invited: "The Vaani member has been invited.",
  invitation_revoked: "The invitation has been revoked.",
  joined_by_invite: "You have joined the gathering.",
  draft_saved: "Your draft has been saved.",
  published: "Your gathering has been published.",
  session_updated: "Gathering details updated.",
};

const errorMessages: Record<string, string> = {
  start_failed: "The session could not be started.",
  end_failed: "The session could not be ended.",
  cancel_failed: "The session could not be cancelled.",
  invalid_invitee: "Enter a valid member email address.",
  invite_member_failed: "That member could not be invited.",
  invalid_invite_link: "The invitation link could not be created.",
  invite_link_failed: "The invitation link is invalid, expired, or could not be used.",
  revoke_invitation_failed: "The invitation could not be revoked.",\n  publish_failed: "The draft could not be published. Check that its start time is in the future.",\n  invalid_edit: "Check the title, access, and future start time.",\n  update_failed: "The gathering could not be updated.",
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
      "id, title, description, access_type, status, scheduled_start_at, started_at, ended_at, created_by, is_draft, time_zone, duration_minutes, instructions, participant_limit, waiting_room_enabled, allow_participant_invites, recurrence_rule, recurrence_until"
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


        {canManage && session.is_draft && (
          <section className="surface-card mt-7 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Finish this draft</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Add a future start time, then publish it so invited members can see it.</p>
            <form action={updateSessionDetails} className="mt-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="session_id" value={session.id}/>
              <input type="hidden" name="time_zone" value={session.time_zone || "Asia/Kolkata"}/>
              <div><label className="field-label mb-2" htmlFor="draft-title">Title</label><input id="draft-title" name="title" required maxLength={120} defaultValue={session.title} className="field-input"/></div>
              <div><label className="field-label mb-2" htmlFor="draft-start">Start date and time</label><input id="draft-start" name="scheduled_start_at" type="datetime-local" required defaultValue={session.scheduled_start_at ? new Date(session.scheduled_start_at).toISOString().slice(0,16) : ""} className="field-input"/></div>
              <div className="sm:col-span-2"><label className="field-label mb-2" htmlFor="draft-description">Description</label><textarea id="draft-description" name="description" rows={3} defaultValue={session.description || ""} className="field-input"/></div>
              <input type="hidden" name="access_type" value={session.access_type}/>
              <input type="hidden" name="duration_minutes" value={session.duration_minutes ?? ""}/>
              <input type="hidden" name="participant_limit" value={session.participant_limit ?? ""}/>
              <input type="hidden" name="waiting_room_enabled" value={session.waiting_room_enabled ? "on" : ""}/>
              <input type="hidden" name="allow_participant_invites" value={session.allow_participant_invites ? "on" : ""}/>
              <input type="hidden" name="instructions" value={session.instructions || ""}/>
              <input type="hidden" name="recurrence_rule" value={session.recurrence_rule || ""}/>
              <input type="hidden" name="recurrence_until" value={session.recurrence_until ? new Date(session.recurrence_until).toISOString() : ""}/>
              <div className="sm:col-span-2 flex flex-wrap gap-3"><button className="button-secondary">Save draft details</button></div>
            </form>
            <form action={publishSessionDraft} className="mt-3"><input type="hidden" name="session_id" value={session.id}/><button className="button-primary">Publish gathering</button></form>
          </section>
        )}
\n        {canManage && session.status !== "ended" && session.status !== "cancelled" && !session.is_draft && (
          <section className="surface-card mt-7 p-6 sm:p-8">
            <div>
              <h2 className="text-xl font-semibold">Invite Sakhis</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Invite a Vaani member directly or create a secure link. The link does not expose the internal session ID.
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
                        {link.expires_at ? ` · expires ${formatDate(link.expires_at)}` : " · no expiry"}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--muted)]">Active</span>
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
