import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Gather",
    text: "Create a gathering with its time, access, participant limit, waiting room, and instructions already in place.",
  },
  {
    number: "02",
    title: "Meet",
    text: "Bring everyone into one live room for audio, video, chat, and simple organizer controls.",
  },
  {
    number: "03",
    title: "Read together",
    text: "Keep Vaani Paath aligned with a shared reading position while each person uses their own device.",
  },
];

const steps = [
  ["Create", "Set up the gathering and choose who can enter."],
  ["Invite", "Share it with Vaani members or invited guests."],
  ["Gather", "Welcome everyone into the live room."],
  ["Read", "Move through the Vaani together."],
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-24 rounded-lg bg-[#392a39] px-4 py-3 text-sm font-semibold text-white transition focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="site-header">
        <div className="site-nav">
          <Link href="/" className="brand-lockup" aria-label="Vaani home">
            <span className="brand-word">Vaani</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            <a href="#features" className="nav-link text-sm font-medium text-muted transition hover:text-foreground">
              What Vaani does
            </a>
            <a href="#how-it-works" className="nav-link text-sm font-medium text-muted transition hover:text-foreground">
              How it works
            </a>
            <a href="#reader" className="nav-link text-sm font-medium text-muted transition hover:text-foreground">
              Shared reader
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-muted transition hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-10 items-center rounded-lg bg-plum px-4 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-plum-deep"
            >
              Join Vaani
            </Link>
          </div>
        </div>
      </header>

      <div id="main-content">
        <section className="overflow-hidden border-b border-line bg-surface">
          <div className="mx-auto grid w-[min(100%-2rem,1440px)] items-center gap-12 px-0 py-16 sm:py-20 lg:grid-cols-[1.02fr_.98fr] lg:gap-20 lg:py-28">
            <div className="max-w-2xl">
              <div className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold-ink">
                <span className="h-px w-10 bg-gold" />
                A place to gather
              </div>

              <h1 className="font-display text-[clamp(3.6rem,8vw,7.3rem)] font-medium leading-[0.92] tracking-[-0.055em] text-plum">
                Gather.
                <br />
                <span className="text-rose">Sing.</span>
                <br />
                Read together.
              </h1>

              <p className="mt-8 max-w-xl text-[1.02rem] leading-8 text-muted sm:text-[1.08rem]">
                Vaani brings live Gaayan and Vaani Paath gatherings into one
                shared space for Sakhis — from the invitation to the live room
                to the reading itself.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Link
                  href="/signup"
                  className="inline-flex min-h-12 items-center rounded-lg bg-plum px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(57,42,57,.14)] transition hover:-translate-y-0.5 hover:bg-plum-deep"
                >
                  Join Vaani
                  <span className="ml-3 text-base">→</span>
                </Link>
                <a
                  href="#how-it-works"
                  className="text-sm font-semibold text-plum underline decoration-plum/25 underline-offset-8 transition hover:decoration-plum"
                >
                  See how it works
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-xs font-medium text-muted">
                <span>Live audio & video</span>
                <span>•</span>
                <span>Gathering chat</span>
                <span>•</span>
                <span>Shared reading</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px]">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-rose-soft blur-3xl" aria-hidden="true" />
              <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-surface-soft blur-3xl" aria-hidden="true" />

              <div className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_80px_rgba(48,35,45,.10)]">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-ink">
                      Live gathering
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      Evening Vaani Paath
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-soft px-3 py-1 text-xs font-semibold text-plum">
                    12 joined
                  </span>
                </div>

                <div className="grid gap-4 bg-[#241f25] p-4 sm:grid-cols-[1.25fr_.75fr]">
                  <div className="min-h-[300px] rounded-xl border border-white/10 bg-[#312a33] p-4">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                      <span>Shared reader</span>
                      <span>Page 18</span>
                    </div>

                    <div className="mt-5 rounded-lg bg-[#f8f4ee] p-6 shadow-sm">
                      <div className="h-2 w-20 rounded bg-[#c9b8aa]" />
                      <div className="mt-5 space-y-2">
                        <div className="h-2 w-full rounded bg-[#e4ddd5]" />
                        <div className="h-2 w-[92%] rounded bg-[#e4ddd5]" />
                        <div className="h-2 w-[85%] rounded bg-[#e4ddd5]" />
                      </div>
                      <div className="mt-7 h-px bg-[#d9d0c7]" />
                      <div className="mt-5 space-y-2">
                        <div className="h-2 w-[94%] rounded bg-[#e4ddd5]" />
                        <div className="h-2 w-[78%] rounded bg-[#e4ddd5]" />
                      </div>
                      <div className="mt-7 rounded-md border border-[#d8c7c0] bg-[#f1e5e2] px-3 py-2 text-[10px] font-semibold text-[#593b53]">
                        Shared position · Page 18
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="aspect-video rounded-xl bg-[#4a414d]" />
                      <div className="aspect-video rounded-xl bg-[#514851]" />
                      <div className="aspect-video rounded-xl bg-[#3e3742]" />
                      <div className="aspect-video rounded-xl bg-[#49414b]" />
                    </div>
                    <div className="mt-auto rounded-xl border border-white/10 bg-[#312a33] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        Gathering chat
                      </p>
                      <p className="mt-3 text-xs leading-5 text-white/70">
                        Everyone is reading together.
                      </p>
                      <div className="mt-3 h-8 rounded-lg bg-white/5" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line px-5 py-3">
                  <span className="text-xs text-muted">Organizer controls active</span>
                  <span className="text-xs font-semibold text-plum">In progress</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-line bg-background">
          <div className="mx-auto w-[min(100%-2rem,1280px)] py-20 sm:py-24 lg:py-32">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-ink">
                One place for the gathering
              </p>
              <h2 className="mt-4 font-display text-[clamp(2.6rem,5vw,4.8rem)] font-medium leading-[0.98] tracking-[-0.045em] text-plum">
                Simple when you are gathering. Capable when you need it.
              </h2>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.number} className="bg-surface px-7 py-8 sm:px-9 sm:py-10">
                  <span className="text-xs font-semibold tracking-[0.14em] text-gold-ink">
                    {feature.number}
                  </span>
                  <h3 className="mt-12 font-display text-3xl font-medium tracking-[-0.035em] text-plum">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-muted">{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-line bg-surface-soft">
          <div className="mx-auto grid w-[min(100%-2rem,1280px)] gap-14 py-20 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:gap-24 lg:py-32">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-ink">
                How it works
              </p>
              <h2 className="mt-4 max-w-lg font-display text-[clamp(2.7rem,5vw,4.7rem)] font-medium leading-[0.98] tracking-[-0.045em] text-plum">
                Four steps. One gathering.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-muted">
                The flow stays focused on the people gathering, rather than
                making everyone piece together several different tools.
              </p>
            </div>

            <div className="border-t border-plum/15">
              {steps.map(([title, text], index) => (
                <div
                  key={title}
                  className="grid grid-cols-[3rem_1fr] gap-5 border-b border-plum/15 py-6 sm:grid-cols-[4.5rem_1fr] sm:gap-7 sm:py-7"
                >
                  <span className="pt-1 text-xs font-semibold tracking-[0.12em] text-gold-ink">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-medium tracking-[-0.03em] text-plum sm:text-3xl">
                      {title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="reader" className="bg-conference-bg text-white">
          <div className="mx-auto grid w-[min(100%-2rem,1280px)] gap-12 py-20 sm:py-24 lg:grid-cols-[.85fr_1.15fr] lg:gap-24 lg:py-32">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c5a07d]">
                The shared reader
              </p>
              <h2 className="mt-4 max-w-xl font-display text-[clamp(2.7rem,5vw,4.8rem)] font-medium leading-[0.98] tracking-[-0.045em]">
                Everyone can stay with the Vaani.
              </h2>
              <p className="mt-6 max-w-lg text-sm leading-7 text-white/60">
                Vaani keeps a common reading position visible during Vaani
                Paath. Participants can still navigate their own document
                without losing the shared place.
              </p>
            </div>

            <div className="self-center rounded-xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <div className="grid gap-7 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#c5a07d]">
                    Shared position
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    The authorized reader guides the common reading.
                  </p>
                </div>
                <span className="hidden text-2xl text-[#a98a5b] sm:block">→</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#c5a07d]">
                    Your device
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Each participant reads from their own screen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface">
          <div className="mx-auto w-[min(100%-2rem,1100px)] py-24 text-center sm:py-32">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-ink">
              Begin with the gathering
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-[clamp(3rem,6vw,6rem)] font-medium leading-[0.92] tracking-[-0.055em] text-plum">
              Bring everyone together.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted">
              Create your next gathering or join Vaani when you are ready.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-5">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center rounded-lg bg-plum px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-plum-deep"
              >
                Join Vaani
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center rounded-lg border border-line px-6 text-sm font-semibold text-plum transition hover:border-plum/30 hover:bg-background"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-line bg-background">
        <div className="site-nav flex-wrap py-7">
          <Link href="/" className="brand-lockup" aria-label="Vaani home">
            <span className="brand-word text-[30px]">Vaani</span>
          </Link>
          <p className="text-xs text-muted">Gather for Gaayan and Vaani Paath.</p>
          <div className="flex gap-5 text-xs font-semibold text-muted">
            <Link href="/login" className="transition hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="transition hover:text-foreground">Join Vaani</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
