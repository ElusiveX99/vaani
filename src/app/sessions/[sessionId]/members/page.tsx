import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SessionMembers from "../session-members";

export const instant = false;

type PageProps = { params: Promise<{ sessionId: string }> };

export default async function SessionMembersPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const [{ data: claims, error: claimsError }, { data: authUser }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);
  const userId = claims?.claims?.sub;
  if (claimsError || typeof userId !== "string") redirect("/login");

  const [{ data: profile }, { data: session }] = await Promise.all([
    supabase.from("profiles").select("display_name,avatar_url,avatar_path").eq("id", userId).maybeSingle(),
    supabase.from("sessions").select("id,title,status,is_draft").eq("id", sessionId).maybeSingle(),
  ]);
  if (!session || session.is_draft) notFound();

  const { data: membership } = await supabase
    .from("session_members")
    .select("role,status")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const canViewMembers = membership?.status === "accepted";
  if (!canViewMembers) notFound();

  const { data: memberRows, error: memberError } = await supabase
    .from("session_members")
    .select("user_id,role,status,can_control_reader")
    .eq("session_id", sessionId)
    .eq("status", "accepted")
    .order("created_at", { ascending: true });
  if (memberError) throw new Error("Could not load session members.");

  const { data: profiles, error: profilesError } = await supabase.rpc(
    "get_session_member_profiles",
    { p_session_id: sessionId }
  );
  if (profilesError) throw new Error("Could not load session member profiles.");

  const profileMap = new Map<string, { display_name: string; avatar_url: string | null }>((profiles ?? []).map((item: {
    id: string; display_name: string; avatar_url: string | null; avatar_path: string | null;
  }) => [item.id, {
    display_name: item.display_name || "Vaani member",
    avatar_url: item.avatar_url || (item.avatar_path
      ? (item.avatar_path.startsWith("http")
        ? item.avatar_path
        : supabase.storage.from("profile-avatars").getPublicUrl(item.avatar_path).data.publicUrl)
      : null),
  }]));

  const email = authUser.user?.email || "";
  const name = profile?.display_name || authUser.user?.user_metadata?.full_name ||
    authUser.user?.user_metadata?.name || email.split("@")[0] || "Vaani member";
  const avatarUrl = profile?.avatar_url || (profile?.avatar_path
    ? (profile.avatar_path.startsWith("http")
      ? profile.avatar_path
      : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl)
    : null) || authUser.user?.user_metadata?.avatar_url ||
    authUser.user?.user_metadata?.picture || null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <SiteHeader name={name} email={email} avatarUrl={avatarUrl} />
      <div className="page-shell py-8 sm:py-10">
        <Link href={`/sessions/${sessionId}`} className="text-sm font-medium text-[var(--plum)] hover:underline">
          Back to gathering
        </Link>
        <div className="mt-6">
          <p className="eyebrow">Gathering directory</p>
          <h1 className="mt-2 font-display text-3xl text-[var(--plum)] sm:text-4xl">{session.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Everyone who has joined this gathering.</p>
        </div>
        <SessionMembers
          sessionId={sessionId}
          currentUserId={userId}
          initialMembers={(memberRows ?? []).map((member) => ({
            ...member,
            display_name: profileMap.get(member.user_id)?.display_name ?? "Vaani member",
            avatar_url: profileMap.get(member.user_id)?.avatar_url ?? null,
            can_control_reader: member.can_control_reader === true,
          }))}
          showAll
          localRole={membership?.role ?? "participant"}
        />
      </div>
    </main>
  );
}
