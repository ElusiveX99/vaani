import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SessionMembers from "./session-members";
import SessionRealtimeRefresh from "@/components/session-realtime-refresh";
import SiteHeader from "@/components/site-header";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import CopyInviteLink from "./copy-invite-link";
import InlineFeedback from "@/components/inline-feedback";
import RecurrenceFields from "@/components/recurrence-fields";

import {
  joinCommunitySession,
  leaveSession,
  startSession,
  endSession,
  cancelSession,
  createInviteLink,
  publishSessionDraft,
  updateSessionDetails,
  approveJoinRequest,
  rejectJoinRequest,
  revokeInviteLink,
  resumeSession,
  cancelJoinRequest,
  deleteEndedSession,
  deleteCancelledSession,
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
  access_type: "community" | "link";
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
  left: "You have left the session.",
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
  delete_cancelled_failed: "This cancelled gathering could not be permanently deleted.",
  draft_delete_failed: "This draft could not be deleted.",
  draft_update_failed: "The draft could not be saved. Please try again.",
  resume_failed: "The gathering could not be resumed.",

  invalid_invite_link: "The invitation link could not be created.",
  invite_link_failed: "The invitation link is invalid, expired, or could not be used.",
  publish_failed: "The draft could not be published. Check that its start time is in the future.",
  invalid_edit: "Check the title, access, and future start time.",
  update_failed: "The gathering could not be updated.",
  invalid_options: "Check the time zone, duration, and participant limit.",
  invalid_recurrence: "Choose a valid repeat pattern and end date within one year.",
  join_request_action_failed: "The join request could not be updated.",
  conference_access_denied: "You do not currently have access to this conference.",
  conference_not_live: "This conference is not live yet.",
  join_failed: "You could not join this gathering. Please try again.",
  joined_by_invite: "You have joined the gathering.",
  created: "Your gathering has been created.",
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

  const [{data:authUser},{data:ownProfile},{data:sessionData,error:sessionError}]=await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name,avatar_url,avatar_path").eq("id",userId).maybeSingle(),
    supabase.from("sessions").select("id,title,description,access_type,status,scheduled_start_at,started_at,ended_at,created_by,is_draft,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,recurrence_rule,recurrence_until,recurrence_parent_id").eq("id",sessionId).maybeSingle(),
  ]);
  const email=authUser.user?.email||"";
  const displayName=ownProfile?.display_name||authUser.user?.user_metadata?.full_name||authUser.user?.user_metadata?.name||email.split("@")[0]||"Sakhi";
  const avatarUrl=ownProfile?.avatar_url||(ownProfile?.avatar_path?(ownProfile.avatar_path.startsWith("http")?ownProfile.avatar_path:supabase.storage.from("profile-avatars").getPublicUrl(ownProfile.avatar_path).data.publicUrl):null)||authUser.user?.user_metadata?.avatar_url||authUser.user?.user_metadata?.picture||null;

  if (sessionError || !sessionData) {
    notFound();
  }

  const session = sessionData as Session;

  const [ownMembershipResult,ownJoinRequestResult]=await Promise.all([
    supabase.from("session_members").select("user_id,role,status").eq("session_id",session.id).eq("user_id",userId).maybeSingle(),
    session.waiting_room_enabled
      ? supabase.from("session_join_requests").select("id").eq("session_id",session.id).eq("user_id",userId).eq("status","pending").maybeSingle()
      : Promise.resolve({data:null,error:null}),
  ]);
  const ownMembership=ownMembershipResult.data as Membership|null;
  const ownJoinRequest=ownJoinRequestResult.data;

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

          <section className="surface-card mt-6 p-6 sm:p-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-3xl text-[var(--plum)] sm:text-4xl">Edit draft</h1>
              <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">Draft</span>
            </div>
            <form action={updateSessionDetails} className="mt-8 grid gap-5 sm:grid-cols-2">
              <input type="hidden" name="session_id" value={session.id} />
              <input type="hidden" name="time_zone" value={session.time_zone || "Asia/Kolkata"} />
              {paramsData.error && errorMessages[paramsData.error] && <InlineFeedback tone="error" className="sm:col-span-2">{errorMessages[paramsData.error]}</InlineFeedback>}
              {paramsData.success && successMessages[paramsData.success] && <InlineFeedback tone="success" className="sm:col-span-2">{successMessages[paramsData.success]}</InlineFeedback>}
              <div className="sm:col-span-2"><label className="field-label mb-2" htmlFor="draft-title">Gathering title</label><input id="draft-title" name="title" required maxLength={120} defaultValue={session.title} className="field-input" /></div>
              <div className="sm:col-span-2"><label className="field-label mb-2" htmlFor="draft-description">Description</label><textarea id="draft-description" name="description" rows={3} maxLength={2000} defaultValue={session.description || ""} className="field-input resize-y" /></div>
              <div><label className="field-label mb-2" htmlFor="draft-start">Start date and time</label><input id="draft-start" name="scheduled_start_local" type="datetime-local" defaultValue={dateTimeInputValue(session.scheduled_start_at, session.time_zone || "Asia/Kolkata")} className="field-input" /></div>
              <div><label className="field-label mb-2" htmlFor="draft-duration">Expected duration</label><select id="draft-duration" name="duration_minutes" defaultValue={session.duration_minutes ?? ""} className="field-input"><option value="">Not specified</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1 hour 30 minutes</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option></select></div>
              <div><label className="field-label mb-2" htmlFor="draft-access">Who can join?</label><select id="draft-access" name="access_type" defaultValue={session.access_type} className="field-input"><option value="community">All Vaani members</option><option value="link">Anyone with an invitation link</option></select></div>
              <div><label className="field-label mb-2" htmlFor="draft-limit">Participant limit</label><input id="draft-limit" name="participant_limit" type="number" min="2" max="500" placeholder="No limit" defaultValue={session.participant_limit ?? ""} className="field-input" /></div>
              <RecurrenceFields initialRule={session.recurrence_rule || ""} initialUntil={dateInputValue(session.recurrence_until, session.time_zone || "Asia/Kolkata")} />
              <div className="sm:col-span-2"><label className="field-label mb-2" htmlFor="draft-instructions">Instructions for participants</label><textarea id="draft-instructions" name="instructions" rows={2} maxLength={2000} defaultValue={session.instructions || ""} className="field-input resize-y" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="waiting_room_enabled" defaultChecked={session.waiting_room_enabled} /> Use waiting room</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_participant_invites" defaultChecked={session.allow_participant_invites} /> Allow participant invitations</label>
              <div className="sm:col-span-2 flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <ConfirmSubmitButton
                  formAction={deleteSessionDraft}
                  name="session_id"
                  value={session.id}
                  message="Permanently delete this draft? This cannot be undone."
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#e7c8c7] px-5 py-2.5 text-sm font-medium text-[#a34e56] transition hover:bg-[#fbefed]"
                >
                  Delete draft
                </ConfirmSubmitButton>
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

  const canJoin =
    session.access_type === "community" &&
    session.status !== "ended" &&
    session.status !== "cancelled" &&
    (!ownMembership ||
      ownMembership.status === "removed") && !ownJoinRequest;

  const isAdmin =
    ownMembership?.role === "admin" &&
    ownMembership.status === "accepted";

  const canManage = isOrganizer || isInCharge || isAdmin;

  let members: Membership[] = [];
  let profiles: Profile[] = [];
  let joinRequests: { id: string; user_id: string; created_at: string }[] = [];
  let joinRequestLookupFailed = false;

  if (isAccepted || canManage) {
    const { data: memberData, error: memberError } = await supabase
      .from("session_members")
      .select("user_id, role, status")
      .eq("session_id", session.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: true });
    if (memberError) {
      console.error("Gathering member lookup failed:", memberError);
    } else {
      members = (memberData ?? []) as Membership[];
    }
  }
  if (canManage && session.waiting_room_enabled) {
    const { data: requests, error: requestError } = await supabase.from("session_join_requests")
      .select("id, user_id, created_at").eq("session_id", session.id)
      .eq("status", "pending").order("created_at", { ascending: true });
    if (requestError) {
      joinRequestLookupFailed = true;
      console.error("Gathering join-request lookup failed:", requestError);
    } else {
      joinRequests = requests ?? [];
    }
  }
  const memberIds = [...new Set([...members.map((member) => member.user_id), ...joinRequests.map((request) => request.user_id)])];
  if (memberIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase.rpc(
      "get_session_member_profiles",
      { p_session_id: session.id }
    );
    if (profileError) {
      console.error("Gathering member profile RPC failed:", profileError);
    } else {
      profiles = (profileData ?? []) as Profile[];
    }
  }

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      { display_name: profile.display_name, avatar_url: profile.avatar_url || (profile.avatar_path ? (profile.avatar_path.startsWith("http") ? profile.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl) : null) },
    ])
  );

  const canViewInviteLinks=canManage||(isAccepted&&session.allow_participant_invites);
  const canCreateInvite=canViewInviteLinks&&session.status!=="ended"&&session.status!=="cancelled";
  const {data:inviteLinks}=canViewInviteLinks?await supabase.from("session_invite_links").select("id,short_code,created_by,label,max_uses,use_count,expires_at,revoked_at,created_at").eq("session_id",session.id).order("created_at",{ascending:false}):{data:[]};
  const inviteOrigin=process.env.NEXT_PUBLIC_SITE_URL||"https://vaaniju.vercel.app";


  const acceptedCount = members.filter(
    (member) => member.status === "accepted"
  ).length;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <SessionRealtimeRefresh sessionId={session.id} />
      <SiteHeader name={displayName} email={email} avatarUrl={avatarUrl} />
      <div className="page-shell py-8 sm:py-10">





        <section className="surface-card mt-8 p-6 sm:p-9">

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--ink)]">
              {session.access_type === "community" ? "All Vaani members" : "Invitation link"}
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
            {["start_failed","end_failed","cancel_failed","resume_failed","delete_failed"].includes(paramsData.error || "") && errorMessages[paramsData.error || ""] && (
              <div role="alert" className="w-full rounded-lg border border-red-200 bg-[#fbefed] p-4 text-sm text-red-800">{errorMessages[paramsData.error || ""]}</div>
            )}

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
                    Start conference
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

            {isOrganizer && session.status === "cancelled" && session.scheduled_start_at && new Date(session.scheduled_start_at).getTime() > Date.now() && (
              <form action={resumeSession}>
                <input type="hidden" name="session_id" value={session.id}/>
                <button className="button-primary">Resume gathering</button>
              </form>
            )}

            {isAccepted && session.status === "live" && (
              <Link
                href={`/sessions/${session.id}/conference`}
                className="button-primary"
              >
                Enter Conference
              </Link>
            )}

            {canJoin && (
              <form action={joinCommunitySession}>
                <input type="hidden" name="session_id" value={session.id} />
                <button type="submit" className="button-primary">
                  Join Gathering
                </button>
              </form>
            )}

            {ownJoinRequest && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-[var(--muted)]">Your request is waiting for approval.</span>
                <form action={cancelJoinRequest}>
                  <input type="hidden" name="session_id" value={session.id} />
                  <input type="hidden" name="request_id" value={ownJoinRequest.id} />
                  <button type="submit" className="button-secondary">Cancel Request</button>
                </form>
              </div>
            )}

            {isAccepted && !isOrganizer && (
              <form action={leaveSession}>
                <input type="hidden" name="session_id" value={session.id} />
                <button type="submit" className="button-secondary">Leave Gathering</button>
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

            </div>
          </section>

          {isOrganizer && session.status === "live" && (
            <section className="surface-card mt-7 border border-red-200 bg-red-50/60 p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-red-900">End this conference</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-red-800">
                This ends the live conference for everyone. Keep this action separate from entering the conference.
              </p>
              <form action={endSession} className="mt-4">
                <input type="hidden" name="session_id" value={session.id} />
                <ConfirmSubmitButton
                  message="End this live conference for everyone? Participants will no longer be able to continue in this conference. This action cannot be undone."
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
                >
                  End conference…
                </ConfirmSubmitButton>
              </form>
            </section>
          )}

          {session.status === "ended" && (
            <section className="surface-card mt-7 border border-[var(--line)] p-6">
              <p className="text-sm font-medium text-[var(--ink)]">
                This gathering has ended.
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
            </section>
          )}

          {session.status === "cancelled" && (
            <section className="surface-card mt-7 border border-red-200 bg-[#fbefed] p-6">
              <p className="text-sm font-medium text-red-900">
                This gathering was cancelled.
              </p>
              {isOrganizer && (
                <form action={deleteCancelledSession} className="mt-4">
                  <input type="hidden" name="session_id" value={session.id} />
                  <ConfirmSubmitButton
                    message="Permanently delete this cancelled gathering and its associated records? This cannot be undone."
                    className="rounded-lg border border-[#e7c8c7] px-4 py-2 text-sm font-medium text-[#a34e56] hover:bg-white"
                  >
                    Permanently delete gathering
                  </ConfirmSubmitButton>
                </form>
              )}
            </section>
          )}

        {canViewInviteLinks&&(
          <section className="surface-card mt-7 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Invitation links</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">Share a link with someone you would like to join this gathering. Links can be reused until they expire, reach their use limit, or are revoked. Your existing active link is returned when you request it again.</p>
            {canCreateInvite?(<form action={createInviteLink} className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--background)] p-4">
              <input type="hidden" name="session_id" value={session.id}/><h3 className="text-sm font-semibold">Get an invitation link</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Choose the expiry and use limit. If you already have an active link, Vaani will show it again.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="field-label">Link expiry<select name="expiry_hours" defaultValue="168" className="field-input mt-2"><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option><option value="720">30 days</option><option value="0">No expiry</option></select></label>
                <label className="field-label">Maximum uses<input name="max_uses" type="number" min="1" max="500" placeholder="Unlimited" className="field-input mt-2"/></label>
              </div><button className="button-primary mt-4">Get invitation link</button>
            </form>            ):<p className="mt-5 text-sm text-[var(--muted)]">This gathering is no longer accepting new invitations. Existing links are shown below for reference and cleanup.</p>}
            {paramsData.invite&&<div className="mt-4 rounded-xl border border-[var(--line)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Your link is ready</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input readOnly value={paramsData.invite} className="field-input min-w-0 flex-1 text-sm" aria-label="Invitation link"/><CopyInviteLink value={paramsData.invite}/></div></div>}
            <div className="mt-5"><h3 className="text-sm font-semibold">Existing links</h3>{!inviteLinks?.length?<p className="mt-2 text-sm text-[var(--muted)]">No invitation links have been created for this gathering yet.</p>:<div className="mt-3 divide-y divide-[var(--line)]">{inviteLinks.map(link=>{const url=`${inviteOrigin}/sessions/join/${link.short_code}`;const expired=!!link.expires_at&&new Date(link.expires_at).getTime()<=Date.now();const exhausted=link.max_uses!==null&&link.use_count>=link.max_uses;const state=link.revoked_at?"Revoked":expired?"Expired":exhausted?"Use limit reached":"Active";const active=state==="Active";return <div key={link.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{link.created_by===userId?"Your invitation link":"Participant invitation link"}</p><span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] text-[var(--muted)]">{state}</span></div><p className="mt-1 break-all text-xs text-[var(--muted)]">{url}</p><p className="mt-1 text-xs text-[var(--muted)]">{link.use_count} {link.use_count===1?"use":"uses"}{link.max_uses===null?" · No use limit":` of ${link.max_uses}`}{link.expires_at?` · Expires ${formatDate(link.expires_at,session.time_zone)}`:" · No expiry"}</p></div><div className="flex shrink-0 flex-wrap gap-2">{active&&<CopyInviteLink value={url} />}{active&&(canManage||link.created_by===userId)&&<form action={revokeInviteLink}><input type="hidden" name="session_id" value={session.id}/><input type="hidden" name="link_id" value={link.id}/><button className="button-secondary !min-h-10 !px-3 text-xs">Revoke</button></form>}</div></div>})}</div>}</div>
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
        {joinRequestLookupFailed && canManage && (
          <p role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Join requests could not be loaded. Please refresh the page.
          </p>
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
                {session.access_type === "community" ? "All Vaani members" : "Invitation link"}
              </dd>
            </div>

            <div>
              <dt className="text-[var(--muted)]">
                Created by
              </dt>

              <dd className="mt-1 text-[var(--ink)]">
                {session.created_by === userId
                  ? "You"
                  : profileMap.get(session.created_by)?.display_name || "Vaani member"}
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
