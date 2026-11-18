import ConferenceRoom from "./conference-room";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

type Session = {
  id: string;
  title: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
};

type Membership = {
  role: string;
  status: string;
};

function ConferenceLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111111] text-white">
      Loading conference...
    </main>
  );
}

async function ConferenceContent({ params }: PageProps) {
  await connection();

  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.getClaims();

  const userId = authData?.claims?.sub;

  if (authError || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select("id, title, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !sessionData) {
    notFound();
  }

  const session = sessionData as Session;

  const { data: membershipData } = await supabase
    .from("session_members")
    .select("role, status")
    .eq("session_id", session.id)
    .eq("user_id", userId)
    .maybeSingle();

  const membership = membershipData as Membership | null;

  if (membership?.status !== "accepted") {
    redirect(`/sessions/${session.id}?error=conference_access_denied`);
  }

  if (session.status !== "live") {
    redirect(`/sessions/${session.id}?error=conference_not_live`);
  }

  const canManageDocuments =
    membership.role === "organizer" ||
    membership.role === "in_charge";

  return (
    <ConferenceRoom
      sessionId={session.id}
      title={session.title}
      canManageDocuments={canManageDocuments}
    />
  );
}

export default function ConferencePage(props: PageProps) {
  return (
    <Suspense fallback={<ConferenceLoading />}>
      <ConferenceContent params={props.params} />
    </Suspense>
  );
}
