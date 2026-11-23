import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SessionMembers from "./session-members";
import SessionRealtimeRefresh from "@/components/session-realtime-refresh";
import SiteHeader from "@/components/site-header";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import CustomSelect from "@/components/custom-select";
import DateTimePicker from "@/components/date-time-picker";
import CopyInviteLink from "./copy-invite-link";
import InlineFeedback from "@/components/inline-feedback";
import RecurrenceFields from "@/components/recurrence-fields";
import DisclosureSection from "@/components/disclosure-section";

import {
  joinCommunitySession,
  leaveSession,
  startSession,
  endSession,
  cancelSession,
  publishSessionDraft,
  updateSessionDetails,
  approveJoinRequest,
  rejectJoinRequest,
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
  public_slug: string;
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
    supabase.from("sessions").select("id,title,description,access_type,status,scheduled_start_at,started_at,ended_at,created_by,is_draft,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,recurrence_rule,recurrence_until,recurrence_parent_id,public_slug").eq("id",sessionId).maybeSingle(),
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
              <div><label className="field-label mb-2" htmlFor="draft-start">Start date and time</label><DateTimePicker id="draft-start" name="scheduled_start_local" defaultValue={dateTimeInputValue(session.scheduled_start_at, session.time_zone || "Asia/Kolkata")} className="field-input" /></div>
              <div><label className="field-label mb-2" htmlFor="draft-duration">Expected duration</label><CustomSelect id="draft-duration" name="duration_minutes" defaultValue={String(session.duration_minutes ?? "")} options={[{value:"",label:"Not specified"},{value:"30",label:"30 minutes"},{value:"45",label:"45 minutes"},{value:"60",label:"1 hour"},{value:"90",label:"1 hour 30 minutes"},{value:"120",label:"2 hours"},{value:"180",label:"3 hours"},{value:"240",label:"4 hours"}]} /></div>
              <div><label className="field-label mb-2" htmlFor="draft-access">Who can join?</label><CustomSelect id="draft-access" name="access_type" defaultValue={session.access_type} options={[{value:"community",label:"All Vaani members"},{value:"link",label:"Anyone with an invitation link"}]} /></div>
              <div><label className="field-label mb-2" htmlFor="draft-limit">Participant limit</label><input id="draft-limit" name="participant_limit" type="number" min="2" max="500" placeholder="No limit" defaultValue={session.participant_limit ?? ""} className="field-input" /></div>
              <div className="sm:col-span-2"><DisclosureSection title="Recurrence" summary={session.recurrence_rule ? "This draft has a repeat schedule" : "Set this gathering to repeat"} contentClassName="mt-3"><RecurrenceFields initialRule={session.recurrence_rule || ""} initialUntil={dateInputValue(session.recurrence_until, session.time_zone || "Asia/Kolkata")} /></DisclosureSection></div>
              <div className="sm:col-span-2"><DisclosureSection title="Participant instructions" summary="Optional information for participants" contentClassName="mt-3"><label className="field-label mb-2" htmlFor="draft-instructions">Instructions for participants</label><textarea id="draft-instructions" name="instructions" rows={2} maxLength={2000} defaultValue={session.instructions || ""} className="field-input resize-y" /></DisclosureSection></div>
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

  const canShareGatheringLink =
    session.status !== "ended" &&
    session.status !== "cancelled" &&
    (session.access_type === "community"
      ? isAccepted || canManage
      : canManage || (isAccepted && session.allow_participant_invites));
  const gatheringUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://vaaniju.vercel.app"}/g/${session.public_slug}`;


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

            {isOrganizer && session.status === "ended" && (
              <form action={deleteEndedSession} className="inline-flex">
                <input type="hidden" name="session_id" value={session.id} />
                <ConfirmSubmitButton
                  message="Permanently delete this ended gathering and its associated history? This cannot be undone."
                  className="text-sm font-medium text-[#a34e56] underline-offset-4 hover:underline"
                >
                  Delete gathering
                </ConfirmSubmitButton>
              </form>
            )}

            {isOrganizer && session.status === "cancelled" && (
              <form action={deleteCancelledSession} className="inline-flex">
                <input type="hidden" name="session_id" value={session.id} />
                <ConfirmSubmitButton
                  message="Permanently delete this cancelled gathering and its associated records? This cannot be undone."
                  className="text-sm font-medium text-[#a34e56] underline-offset-4 hover:underline"
                >
                  Delete gathering
                </ConfirmSubmitButton>
              </form>
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

        {canShareGatheringLink && (
          <section className="surface-card mt-7 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Gathering link</h2>
              <p className="mt-1 truncate text-sm text-[var(--muted)]">{gatheringUrl}</p>
            </div>
            <CopyInviteLink value={gatheringUrl} />
          </section>
        )}
        {canManage && session.waiting_room_enabled && (
          <section className="surface-card mt-7 p-6 sm:p-8">
            <DisclosureSection title="Join requests" summary={`${joinRequests.length} pending · Review members waiting for approval`} defaultOpen={joinRequests.length > 0} contentClassName="mt-4">
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
            </DisclosureSection>
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
          <h2 className="text-lg font-semibold text-[var(--ink)]">Session information</h2>
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
