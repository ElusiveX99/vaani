import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import CreateSessionForm from "../create-session-form";
import { createSession } from "../actions";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

async function NewSessionContent({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") redirect("/login");

  const [{ data: authUser }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, avatar_url, avatar_path").eq("id", userId).maybeSingle(),
  ]);

  const email = authUser.user?.email || "";
  const name = profile?.display_name || authUser.user?.user_metadata?.full_name || authUser.user?.user_metadata?.name || email.split("@")[0] || "Sakhi";
  const avatarUrl = profile?.avatar_url ||
    (profile?.avatar_path
      ? (profile.avatar_path.startsWith("http") ? profile.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl)
      : null) ||
    authUser.user?.user_metadata?.avatar_url ||
    authUser.user?.user_metadata?.picture ||
    null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <SiteHeader name={name} email={email} avatarUrl={avatarUrl} />
      <div className="page-shell max-w-4xl py-8 sm:py-12">
        <Link href="/sessions" className="text-sm font-semibold text-[var(--plum)] hover:underline">← Back to gatherings</Link>
        <header className="mb-8 mt-6">
          <p className="eyebrow">Gathering setup</p>
          <h1 className="font-display mt-2 text-4xl text-[var(--plum)] sm:text-5xl">Create a Gathering</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Set the details and schedule. You can save a draft and publish it later. A scheduled gathering only becomes live when you start it.</p>
        </header>
        <section className="surface-card p-5 sm:p-8">
          <CreateSessionForm action={createSession} error={params.error} />
        </section>
      </div>
    </main>
  );
}


function NewSessionLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="h-10 w-56 animate-pulse rounded bg-[var(--surface-soft)]" />
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
      </div>
    </main>
  );
}

export default function NewSessionPage(props: Props) {
  return (
    <Suspense fallback={<NewSessionLoading />}>
      <NewSessionContent searchParams={props.searchParams} />
    </Suspense>
  );
}
