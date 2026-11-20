import Link from "next/link";

const gatherings = [
  { title: "Chaturasi Ji gaayan", detail: "Sing together, with attention and feeling." },
  { title: "Pada gaayan", detail: "Let the padas be heard and remembered together." },
  { title: "Vaani reading", detail: "Read together, slowly enough to stay with the bhaav." },
];

export default async function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <header className="site-header relative z-20">
        <nav className="site-nav">
          <Link href="/" className="brand-lockup" aria-label="Vaani">
            <span className="brand-word">Vaani</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login" className="nav-link">Sign in</Link>
            <Link href="/signup" className="button-primary !min-h-10 !px-5 !py-2 text-xs sm:text-sm">Create account</Link>
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="page-shell grid min-h-[520px] items-center gap-12 py-16 sm:py-20 lg:min-h-[620px] lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">Radha Vallabh Sampradaya</p>
            <h1 className="font-display mt-6 max-w-xl text-5xl leading-[1.04] text-[var(--plum)] sm:text-6xl lg:text-7xl">
              Chaturasi Ji gaayan.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
              A place for Sakhis to gather in the sweetness of shared singing, Vaani reading, and conversation.
            </p>
            <a href="#gatherings" className="mt-8 inline-flex text-sm font-semibold text-[var(--plum)] underline decoration-[var(--gold)] underline-offset-4">
              Explore gatherings
            </a>
          </div>

          <div aria-hidden="true" className="relative mx-auto hidden aspect-[5/4] w-full max-w-[480px] items-center justify-center md:flex">
            <div className="absolute inset-[8%] rotate-[-8deg] rounded-[46%_54%_52%_48%] border border-[#d9c9bd]" />
            <div className="absolute inset-[15%] rounded-[48%_52%_45%_55%] bg-[linear-gradient(145deg,#eee2dc,#e6ded0_55%,#d7c5c5)]" />
            <div className="absolute inset-[25%] rounded-[45%_55%_55%_45%] border border-white/80" />
            <div className="relative text-center">
              <span className="font-display text-5xl text-[var(--plum)]">Vaani</span>
              <span className="mx-auto mt-4 block h-px w-14 bg-[var(--gold)]" />
            </div>
          </div>
        </div>
      </section>

      <section id="gatherings" className="border-y border-[var(--line)] bg-[var(--surface)] py-14 sm:py-20">
        <div className="page-shell">
          <div className="max-w-xl">
            <p className="eyebrow">Radha Vallabh Sampradaya</p>
            <h2 className="font-display mt-3 text-4xl text-[var(--plum)] sm:text-5xl">Gatherings</h2>
          </div>
          <div className="mt-9 grid gap-3 md:grid-cols-3">
            {gatherings.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-6 sm:p-7">
                <h3 className="font-display text-2xl text-[var(--plum)]">{item.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="page-shell flex flex-col gap-2 py-7 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="brand-lockup"><span className="brand-word">Vaani</span></Link>
        <p className="text-xs text-[var(--muted)]">Radha Vallabh Sampradaya</p>
      </footer>
    </main>
  );
}
