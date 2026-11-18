import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function AccountLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-stone-500">
          Loading your account...
        </p>
      </div>
    </main>
  );
}

async function AccountContent() {
  await connection();

  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  async function signOut() {
    "use server";

    const supabase = await createClient();
    await supabase.auth.signOut();

    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string"
      ? data.claims.email
      : "Your account";

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-stone-900">
          Welcome to Vaani
        </h1>

        <p className="mt-3 text-stone-600">
          You are successfully signed in.
        </p>

        <div className="mt-8 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Signed-in account
          </p>

          <p className="mt-2 break-all text-sm text-stone-900">
            {email}
          </p>
        </div>

        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="w-full rounded-lg bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountLoading />}>
      <AccountContent />
    </Suspense>
  );
}
