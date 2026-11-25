import Link from "next/link";

const capabilities = [
  {
    title: "Create a gathering",
    text: "Set the time, duration, access, participant limit, waiting room, and instructions before you publish.",
  },
  {
    title: "Invite people",
    text: "Share with Vaani members or send a secure invitation link to the people you want to join.",
  },
  {
    title: "Welcome everyone",
    text: "Use a waiting room when you want participants to wait for approval before entering.",
  },
  {
    title: "Gather live",
    text: "Meet with live audio and video, organizer controls, and gathering chat in the same room.",
  },
];

const flow = [
  ["01", "Set it up", "Create the gathering and decide when and how people will enter."],
  ["02", "Bring the Sakhis in", "Use membership access or a secure invitation link."],
  ["03", "Meet", "Gather in one live room for audio, video, chat, and controls."],
  ["04", "Open the Vaani", "Follow the shared reading position during Vaani Paath."],
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#292725]">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-24 rounded-md bg-[#292725] px-4 py-3 text-sm font-medium text-white transition focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="border-b border-black/10 bg-[#f7f4ee]/95">
        <div className="mx-auto flex min-h-[76px] w-[min(100%-2rem,1280px)] items-center gap-8">
          <Link
            href="/"
            aria-label="Vaani home"
            className="font-serif text-[2rem] font-semibold tracking-[-0.07em]"
          >
            Vaani
          </Link>

          <nav className="ml-auto hidden items-center gap-8 text-[0.8rem] font-semibold text-[#6f6a62] md:flex">
            <a className="transition hover:text-[#765047]" href="#what-you-can-do">
              What you can do
            </a>
            <a className="transition hover:text-[#765047]" href="#gathering">
              How it works
            </a>
            <a className="transition hover:text-[#765047]" href="#reader">
              Shared reader
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-4 md:ml-0">
            <Link
              href="/login"
              className="text-[0.82rem] font-semibold text-[#625e58] transition hover:text-[#765047]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-10 items-center rounded-sm bg-[#765047] px-5 text-[0.8rem] font-semibold text-white transition hover:bg-[#5f3e36]"
            >
              Join Vaani
            </Link>
          </div>
        </div>
      </header>

      <div id="main-content">
        <section className="border-b border-black/10 bg-[#fbf9f5]">
          <div className="mx-auto w-[min(100%-2rem,1280px)] py-20 sm:py-28 lg:py-36">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#8b654f]">
              Vaani
            </p>

            <h1 className="mt-5 max-w-6xl font-serif text-[clamp(3.5rem,9vw,8.5rem)] font-medium leading-[0.88] tracking-[-0.075em] text-[#292725]">
              Gather for
              <br />
              <span className="text-[#765047]">Gaayan</span> and Vaani Paath.
            </h1>

            <div className="mt-10 flex flex-col gap-8 lg:mt-14 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-2xl text-[1.02rem] leading-8 text-[#706b64] sm:text-[1.1rem]">
                A place for Sakhis to create, join, and take part in live
                gatherings centered on Shree Hit Chaturasi Ji Gaayan, pada
                Gaayan, and Vaani Paath — with the gathering and shared
                reading kept together.
              </p>

              <div className="flex shrink-0 items-center gap-6">
                <Link
                  href="/signup"
                  className="inline-flex min-h-12 items-center rounded-sm bg-[#765047] px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(89,60,52,.12)] transition hover:-translate-y-0.5 hover:bg-[#5f3e36]"
                >
                  Join Vaani
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-[#292725] underline decoration-black/20 underline-offset-8 transition hover:text-[#765047] hover:decoration-[#765047]"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="mt-20 flex items-center gap-4 text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-[#9a9288]">
              <span className="h-px w-16 bg-[#b8aa9c]" />
              Gather · Sing · Read
            </div>
          </div>
        </section>

        <section id="what-you-can-do" className="border-b border-black/10 bg-[#f7f4ee]">
          <div className="mx-auto w-[min(100%-2rem,1280px)] py-20 sm:py-28 lg:py-36">
            <div className="max-w-3xl">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#8b654f]">
                What you can do
              </p>
              <h2 className="mt-4 font-serif text-[clamp(2.8rem,5.5vw,5.2rem)] font-medium leading-[0.96] tracking-[-0.06em]">
                Everything needed to hold the gathering in one place.
              </h2>
            </div>

            <div className="mt-14 border-t border-black/15">
              {capabilities.map((item, index) => (
                <article
                  key={item.title}
                  className="grid gap-3 border-b border-black/15 py-7 md:grid-cols-[minmax(220px,.65fr)_1fr] md:gap-16 md:py-8"
                >
                  <div className="flex items-start gap-4">
                    <span className="pt-1 text-[0.65rem] font-bold tracking-[0.15em] text-[#a18c7b]">
                      0{index + 1}
                    </span>
                    <h3 className="font-serif text-[1.8rem] font-medium leading-tight tracking-[-0.04em] sm:text-[2.1rem]">
                      {item.title}
                    </h3>
                  </div>
                  <p className="max-w-2xl text-[0.95rem] leading-7 text-[#706b64] md:pt-1">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="gathering" className="border-b border-black/10 bg-[#e9e2d8]">
          <div className="mx-auto w-[min(100%-2rem,1280px)] py-20 sm:py-28 lg:py-36">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.7fr] lg:gap-24">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#8b654f]">
                  How a gathering works
                </p>
                <h2 className="mt-4 max-w-xl font-serif text-[clamp(2.8rem,5.5vw,5.2rem)] font-medium leading-[0.96] tracking-[-0.06em]">
                  From creating the gathering to reading together.
                </h2>
              </div>

              <div className="grid border-t border-black/20 sm:grid-cols-2">
                {flow.map(([number, title, text], index) => (
                  <article
                    key={number}
                    className={[
                      "py-7 sm:py-8",
                      index % 2 === 1 ? "sm:border-l sm:border-black/20 sm:pl-8" : "",
                      index > 1 ? "border-t border-black/20" : "",
                      index % 2 === 0 ? "sm:pr-8" : "",
                    ].join(" ")}
                  >
                    <span className="text-[0.65rem] font-bold tracking-[0.15em] text-[#9a806d]">
                      {number}
                    </span>
                    <h3 className="mt-5 font-serif text-[1.9rem] font-medium tracking-[-0.04em]">
                      {title}
                    </h3>
                    <p className="mt-3 max-w-sm text-[0.9rem] leading-7 text-[#706962]">
                      {text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="reader" className="bg-[#302a2d] text-[#f7f2eb]">
          <div className="mx-auto w-[min(100%-2rem,1280px)] py-20 sm:py-28 lg:py-36">
            <div className="grid gap-14 lg:grid-cols-[.85fr_1.15fr] lg:gap-24">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#c5a07d]">
                  Shared reader
                </p>
                <h2 className="mt-4 max-w-2xl font-serif text-[clamp(2.8rem,5.5vw,5.2rem)] font-medium leading-[0.96] tracking-[-0.06em]">
                  Read from the same Vaani, together.
                </h2>
                <p className="mt-6 max-w-xl text-[0.96rem] leading-8 text-[#c5bdb8]">
                  During Vaani Paath, the reader keeps everyone oriented to a
                  common reading position while each participant can still
                  navigate their document locally.
                </p>
              </div>

              <div className="lg:pt-5">
                <div className="border-y border-white/15 py-7">
                  <div className="grid gap-7 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <div>
                      <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#c5a07d]">
                        Shared position
                      </p>
                      <p className="mt-2 text-[0.9rem] leading-7 text-[#c5bdb8]">
                        The organizer or authorized reader guides the common
                        reading.
                      </p>
                    </div>
                    <span className="hidden font-serif text-2xl text-[#b99577] sm:block">
                      →
                    </span>
                    <div>
                      <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#c5a07d]">
                        Local reading
                      </p>
                      <p className="mt-2 text-[0.9rem] leading-7 text-[#c5bdb8]">
                        Each participant can move through the document on their
                        own device.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-7 max-w-2xl text-[0.88rem] leading-7 text-[#a9a09c]">
                  The point is simple: the gathering can move through the Vaani
                  together without forcing every participant into the same
                  local view.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-[#f7f4ee]">
          <div className="mx-auto w-[min(100%-2rem,1280px)] py-20 sm:py-28 lg:py-36">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#8b654f]">
                  Inside the gathering
                </p>
                <h2 className="mt-4 font-serif text-[clamp(2.8rem,5vw,4.8rem)] font-medium leading-[0.96] tracking-[-0.06em]">
                  The live room handles the rest.
                </h2>
              </div>

              <div className="border-t border-black/15">
                {[
                  ["Live audio and video", "Meet the Sakhis in the same live session."],
                  ["Gathering chat", "Keep messages with the gathering instead of moving to another service."],
                  ["Organizer controls", "Manage the session and the people entering it."],
                  ["Membership and access", "Use member access, join requests, or invitation links as appropriate."],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="grid gap-2 border-b border-black/15 py-6 sm:grid-cols-[.65fr_1fr] sm:gap-8"
                  >
                    <strong className="text-[0.9rem]">{title}</strong>
                    <span className="text-[0.9rem] leading-7 text-[#706b64]">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#e9e2d8]">
          <div className="mx-auto w-[min(100%-2rem,1120px)] py-24 text-center sm:py-32 lg:py-40">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#8b654f]">
              Join Vaani
            </p>
            <h2 className="mx-auto mt-4 max-w-4xl font-serif text-[clamp(3rem,6vw,6rem)] font-medium leading-[0.92] tracking-[-0.07em]">
              Create or join your next gathering.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[0.96rem] leading-7 text-[#706962]">
              Vaani is built for Sakhis who want to gather for Gaayan and Vaani
              Paath together.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center rounded-sm bg-[#765047] px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#5f3e36]"
              >
                Join Vaani
              </Link>
              <Link
                href="/login"
                className="text-sm font-semibold text-[#292725] underline decoration-black/20 underline-offset-8 transition hover:text-[#765047]"
              >
                Already a member? Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="bg-[#fbf9f5]">
        <div className="mx-auto flex min-h-28 w-[min(100%-2rem,1280px)] flex-wrap items-center justify-between gap-5 py-7">
          <Link
            href="/"
            className="font-serif text-[1.7rem] font-semibold tracking-[-0.07em]"
          >
            Vaani
          </Link>
          <p className="text-center text-[0.78rem] text-[#8a837b]">
            Gather for Gaayan and Vaani Paath.
          </p>
          <div className="flex gap-5 text-[0.78rem] font-semibold text-[#6f6a62]">
            <Link className="hover:text-[#765047]" href="/login">
              Sign in
            </Link>
            <Link className="hover:text-[#765047]" href="/signup">
              Join Vaani
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
