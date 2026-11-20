import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import ProfileEditor from "./profile-editor";

function AccountLoading() {
  return <main className="page-shell py-16"><div className="h-64 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /></main>;
}

async function AccountContent() {
  await connection();
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
  const avatarUrl = profile?.avatar_url || (profile?.avatar_path ? (profile.avatar_path.startsWith("http") ? profile.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl) : null) || authUser.user?.user_metadata?.avatar_url || authUser.user?.user_metadata?.picture || null;

  async function signOut() {
    "use server";
    const client = await createClient();
    await client.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <SiteHeader name={name} email={email} avatarUrl={avatarUrl} />
      <div className="page-shell py-12 sm:py-16">
        <div className="mb-9"><p className="eyebrow">Your Vaani</p><h1 className="font-display mt-3 text-5xl text-[var(--plum)] sm:text-6xl">Your profile</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">Your name and photo appear to other members in Vaani.</p></div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <ProfileEditor userId={userId} initialName={name} initialAvatarUrl={avatarUrl} initialAvatarPath={profile?.avatar_path ?? null} email={email} />
          <aside className="surface-card p-6">
            <p className="eyebrow">Your account</p>
            <p className="mt-4 break-all text-sm font-semibold text-[var(--ink)]">{email}</p>
            <p className="mt-2 text-xs leading-6 text-[var(--muted)]">Your account email is used for sign-in and cannot be changed here.</p>
            <form action={signOut} className="mt-8 border-t border-[var(--line)] pt-5">
              <button type="submit" className="button-secondary w-full">Sign out</button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function AccountPage() {
  return <Suspense fallback={<AccountLoading />}><AccountContent /></Suspense>;
}
