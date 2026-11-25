import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Sessions",
    text: "Set the time, access, participant limit, and waiting room before people arrive.",
  },
  {
    number: "02",
    title: "Live room",
    text: "Keep audio, video, chat, and organizer controls together instead of switching between tools.",
  },
  {
    number: "03",
    title: "Shared reading",
    text: "Give everyone a common reading position during Vaani Paath while each person stays on their own device.",
  },
];

const steps = [
  ["Create", "Set the details for the session."],
  ["Invite", "Share it with the people who should join."],
  ["Meet", "Open the live room and bring everyone in."],
  ["Read", "Follow the Vaani from the shared position."],
];

export default function LandingPage() {
  return (
    <main className="h-dvh snap-y snap-proximity overflow-y-auto overscroll-contain bg-[#f6f3ee] text-[#29242a]">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-24 rounded-lg bg-[#392a39] px-4 py-3 text-sm font-semibold text-white transition focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="site-header sticky top-0 z-40">
        <div className="site-nav">
          <Link href="/" className="brand-lockup" aria-label="Vaani home">
            <span className="brand-word">Vaani</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            <a href="#features" className="nav-link text-sm font-medium text-[#756d73] transition hover:text-[#29242a]">
              What Vaani does
            </a>
            <a href="#how-it-works" className="nav-link text-sm font-medium text-[#756d73] transition hover:text-[#29242a]">
              How it works
            </a>
            <a href="#reader" className="nav-link text-sm font-medium text-[#756d73] transition hover:text-[#29242a]">
              Shared reader
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-[#756d73] transition hover:text-[#29242a]">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-10 items-center rounded-lg bg-[#593b53] px-4 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#392a39]"
            >
              Join Vaani
            </Link>
          </div>
        </div>
      </header>

      <div id="main-content">
        <section className="snap-start overflow-hidden border-b border-[#e5ddd5] bg-[#fffdf9]">
          <div className="mx-auto grid w-[min(100%-2rem,1440px)] items-center gap-9 px-0 py-10 sm:py-12 lg:grid-cols-[1fr_.9fr] lg:gap-14 lg:py-14 xl:py-16">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#80613f]">
                <span className="h-px w-8 bg-[#a98a5b]" />
                Gaayan & Vaani Paath
              </div>

              <h1 className="font-display text-[clamp(3.3rem,7vw,6.4rem)] font-medium leading-[0.9] tracking-[-0.055em] text-[#593b53]">
                Gaayan and
                <br />
                <span className="text-[#ad7d83]">Vaani Paath,</span>
                <br />
                together.
              </h1>

              <p className="mt-6 max-w-xl text-[1rem] leading-7 text-[#756d73] sm:text-[1.05rem]">
                A shared place for Sakhis to meet live, sing, and follow the same Vaani — from the invitation to the reading.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-5">
                <Link
                  href="/signup"
                  className="inline-flex min-h-11 items-center rounded-lg bg-[#593b53] px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(57,42,57,.14)] transition hover:-translate-y-0.5 hover:bg-[#392a39]"
                >
                  Join Vaani
                  <span className="ml-3 text-base">→</span>
                </Link>
                <a
                  href="#features"
                  className="text-sm font-semibold text-[#593b53] underline decoration-[#593b53]/25 underline-offset-8 transition hover:decoration-[#593b53]"
                >
                  Explore Vaani
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-[#756d73]">
                <span>Live audio & video</span>
                <span>Chat</span>
                <span>Shared reading</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[600px]">
              <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#f0e5e2] blur-3xl" aria-hidden="true" />
              <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-[#eee8e1] blur-3xl" aria-hidden="true" />

              <div className="relative overflow-hidden rounded-2xl border border-[#e5ddd5] bg-white shadow-[0_20px_70px_rgba(48,35,45,.10)]">
                <div className="flex items-center justify-between border-b border-[#e5ddd5] px-4 py-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#80613f]">Live session</p>
                    <p className="mt-1 text-sm font-semibold text-[#29242a]">Evening Vaani Paath</p>
                  </div>
                  <span className="rounded-full bg-[#f0e5e2] px-3 py-1 text-[10px] font-semibold text-[#593b53]">
                    12 joined
                  </span>
                </div>

                <div className="grid gap-3 bg-[#241f25] p-3 sm:grid-cols-[1.25fr_.75fr]">
                  <div className="min-h-[255px] rounded-xl border border-white/10 bg-[#312a33] p-3">
                    <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50">
                      <span>Shared reader</span>
                      <span>Page 18</span>
                    </div>
                    <div className="mt-4 rounded-lg bg-[#f8f4ee] p-5 shadow-sm">
                      <div className="h-2 w-20 rounded bg-[#c9b8aa]" />
                      <div className="mt-4 space-y-2">
                        <div className="h-2 w-full rounded bg-[#e4ddd5]" />
                        <div className="h-2 w-[92%] rounded bg-[#e4ddd5]" />
                        <div className="h-2 w-[85%] rounded bg-[#e4ddd5]" />
                      </div>
                      <div className="mt-5 h-px bg-[#d9d0c7]" />
                      <div className="mt-4 space-y-2">
                        <div className="h-2 w-[94%] rounded bg-[#e4ddd5]" />
                        <div className="h-2 w-[78%] rounded bg-[#e4ddd5]" />
                      </div>
                      <div className="mt-5 rounded-md border border-[#d8c7c0] bg-[#f1e5e2] px-3 py-2 text-[9px] font-semibold text-[#593b53]">
                        Shared position · Page 18
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="aspect-video rounded-lg bg-[#4a414d]" />
                      <div className="aspect-video rounded-lg bg-[#514851]" />
                      <div className="aspect-video rounded-lg bg-[#3e3742]" />
                      <div className="aspect-video rounded-lg bg-[#49414b]" />
                    </div>
                    <div className="mt-auto rounded-xl border border-white/10 bg-[#312a33] p-3">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">Chat</p>
                      <p className="mt-2 text-[11px] leading-4 text-white/70">Everyone is reading together.</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#e5ddd5] px-4 py-2.5">
                  <span className="text-[10px] text-[#756d73]">Organizer controls active</span>
                  <span className="text-[10px] font-semibold text-[#593b53]">In progress</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="snap-start border-b border-[#e5ddd5] bg-[#f6f3ee]">
          <div className="mx-auto w-[min(100%-2rem,1280px)] py-14 sm:py-16 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end lg:gap-16">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#80613f]">What Vaani brings together</p>
                <h2 className="mt-3 max-w-lg font-display text-[clamp(2.5rem,5vw,4.4rem)] font-medium leading-[0.96] tracking-[-0.045em] text-[#593b53]">
                  Everything around the Vaani, in one place.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#756d73] lg:pb-1">
                The practical parts stay together: setting up a session, bringing people into the room, and keeping everyone with the same reading.
              </p>
            </div>

            <div className="mt-9 grid gap-px overflow-hidden rounded-xl border border-[#e5ddd5] bg-[#e5ddd5] md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.number} className="bg-[#fffdf9] px-6 py-7 sm:px-8 sm:py-8">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs font-semibold tracking-[0.14em] text-[#80613f]">{feature.number}</span>
                    <span className="text-xl text-[#ad7d83]" aria-hidden="true">↗</span>
                  </div>
                  <h3 className="mt-10 font-display text-2xl font-medium tracking-[-0.03em] text-[#593b53]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#756d73]">{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="snap-start border-b border-[#e5ddd5] bg-[#eee8e1]">
          <div className="mx-auto grid w-[min(100%-2rem,1280px)] gap-10 py-14 sm:py-16 lg:grid-cols-[.7fr_1.3fr] lg:gap-20 lg:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#80613f]">From invitation to reading</p>
              <h2 className="mt-3 max-w-md font-display text-[clamp(2.5rem,5vw,4.4rem)] font-medium leading-[0.96] tracking-[-0.045em] text-[#593b53]">
                A short path from plan to Paath.
              </h2>
            </div>

            <div className="border-t border-[#593b53]/15">
              {steps.map(([title, text], index) => (
                <div key={title} className="grid grid-cols-[3rem_1fr] gap-5 border-b border-[#593b53]/15 py-5 sm:grid-cols-[4.5rem_1fr] sm:gap-7 sm:py-6">
                  <span className="pt-1 text-xs font-semibold tracking-[0.12em] text-[#80613f]">0{index + 1}</span>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
                    <h3 className="font-display text-2xl font-medium tracking-[-0.03em] text-[#593b53]">{title}</h3>
                    <p className="max-w-lg text-sm leading-6 text-[#756d73]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="reader" className="snap-start bg-[#211d24] text-white">
          <div className="mx-auto grid w-[min(100%-2rem,1280px)] gap-9 py-14 sm:py-16 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:gap-20 lg:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c5a07d]">The shared reader</p>
              <h2 className="mt-3 max-w-xl font-display text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[0.96] tracking-[-0.045em]">
                One reading position. Everyone can follow.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-white/60">
                During Vaani Paath, the shared position gives the room a common place to continue from, while every participant still reads on their own device.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
              <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#c5a07d]">Shared position</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">The authorized reader guides the common reading.</p>
                </div>
                <span className="hidden text-2xl text-[#a98a5b] sm:block">→</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#c5a07d]">Your device</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">Each participant follows from their own screen.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="snap-start bg-[#fffdf9]">
          <div className="mx-auto w-[min(100%-2rem,1100px)] py-16 text-center sm:py-20 lg:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#80613f]">Start with Vaani</p>
            <h2 className="mx-auto mt-3 max-w-3xl font-display text-[clamp(2.8rem,6vw,5.5rem)] font-medium leading-[0.92] tracking-[-0.055em] text-[#593b53]">
              Ready when your next session is.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#756d73]">
              Create a session, invite the people you need, and meet in one shared room.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center rounded-lg bg-[#593b53] px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#392a39]"
              >
                Join Vaani
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-lg border border-[#e5ddd5] px-6 text-sm font-semibold text-[#593b53] transition hover:border-[#593b53]/30 hover:bg-[#f6f3ee]"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="snap-start border-t border-[#e5ddd5] bg-[#f6f3ee]">
        <div className="site-nav flex-wrap py-6">
          <Link href="/" className="brand-lockup" aria-label="Vaani home">
            <span className="brand-word text-[30px]">Vaani</span>
          </Link>
          <p className="text-xs text-[#756d73]">Gaayan and Vaani Paath, together.</p>
          <div className="flex gap-5 text-xs font-semibold text-[#756d73]">
            <Link href="/login" className="transition hover:text-[#29242a]">Sign in</Link>
            <Link href="/signup" className="transition hover:text-[#29242a]">Join Vaani</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
