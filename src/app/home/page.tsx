import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const navigation = [
  { label: "Home", href: "/home" },
  { label: "Sessions", href: "/sessions" },
  { label: "Account", href: "/account" },
];

function HomeLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f5] text-[#292b25]">
      <p className="text-sm text-[#858477]">
        Loading your Vaani dashboard...
      </p>
    </main>
  );
}

async function HomeContent() {
  await connection();

  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string"
      ? data.claims.email
      : "Member";

  return (
    <main className="min-h-screen bg-[#faf9f5] text-[#292b25]">
      <header className="border-b border-[#e9e6dc] bg-white/80">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link
            href="/home"
            className="text-2xl font-semibold tracking-[0.12em] text-[#344b3d]"
          >
            VAANI
          </Link>

          <div className="flex items-center gap-6">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[#68695e] transition hover:text-[#344b3d]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#927b50]">
            Your community space
          </p>

          <h1 className="mt-4 font-serif text-4xl text-[#344b3d] sm:text-5xl">
            Welcome to Vaani.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-8 text-[#68695e]">
            A place to come together for Chaturasi Ji gaayan, pada
            gaayan, guided reading, and meaningful conversations.
          </p>

          <p className="mt-3 text-sm text-[#858477]">
            Signed in as {email}
          </p>
        </section>

        <section className="mt-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#927b50]">
              Gather together
            </p>

            <h2 className="mt-3 font-serif text-3xl text-[#344b3d]">
              Your sessions
            </h2>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Link
              href="/sessions"
              className="group rounded-2xl border border-[#e5e1d5] bg-white p-8 transition hover:-translate-y-1 hover:border-[#b7bba7] hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a895f]">
                Participate
              </p>

              <h3 className="mt-5 text-2xl font-semibold text-[#344b3d]">
                Join a session
              </h3>

              <p className="mt-3 text-sm leading-7 text-[#68695e]">
                Enter a gathering and join the community in shared
                devotional activities.
              </p>

              <span className="mt-8 inline-block text-sm font-semibold text-[#536b52] group-hover:underline">
                Explore sessions →
              </span>
            </Link>

            <Link
              href="/sessions"
              className="group rounded-2xl border border-[#e5e1d5] bg-white p-8 transition hover:-translate-y-1 hover:border-[#b7bba7] hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a895f]">
                Organize
              </p>

              <h3 className="mt-5 text-2xl font-semibold text-[#344b3d]">
                Host a gathering
              </h3>

              <p className="mt-3 text-sm leading-7 text-[#68695e]">
                Bring Sakhis together for a gathering with integrated
                video conferencing and guided devotional reading.
              </p>

              <span className="mt-8 inline-block text-sm font-semibold text-[#536b52] group-hover:underline">
                Manage sessions →
              </span>
            </Link>
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-[#e5e1d5] bg-[#f3f1e8] p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#927b50]">
            The Vaani experience
          </p>

          <h2 className="mt-4 max-w-xl font-serif text-3xl leading-tight text-[#344b3d]">
            Together in devotion. Connected through Vaani.
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#68695e]">
            Our gatherings bring together live participation and a
            shared reading experience, where the designated in-charge
            guides the document while everyone follows along.
          </p>
        </section>

        <footer className="mt-16 border-t border-[#e9e6dc] pt-6 text-xs text-[#858477]">
          Vaani — A shared space for devotion, learning, and togetherness.
        </footer>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
