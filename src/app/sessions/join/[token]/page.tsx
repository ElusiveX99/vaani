import { Suspense } from "react";\nimport { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redeemInviteLink } from "../../actions";

type Props = { params: Promise<{ token: string }> };

async function InviteJoinContent({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || typeof data?.claims?.sub !== "string") {
    redirect(`/login?next=/sessions/join/${encodeURIComponent(token)}`);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--ink)]">
      <div className="mx-auto max-w-xl pt-12">
        <section className="surface-card p-7 sm:p-9">
          <p className="eyebrow">Gathering invitation</p>
          <h1 className="mt-2 font-display text-4xl text-[var(--plum)]">Join this gathering</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            This secure invitation link will add your Vaani account to the gathering.
          </p>
          <form action={redeemInviteLink} className="mt-7">
            <input type="hidden" name="token" value={token} />
            <button className="button-primary w-full">Join gathering</button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function InviteJoinPage(props: Props) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--background)]" />}>
      <InviteJoinContent params={props.params} />
    </Suspense>
  );
}
