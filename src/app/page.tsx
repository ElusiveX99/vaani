import Link from "next/link";

const features = [
  {
    title: "Chaturasi Ji Gaayan",
    description:
      "A space for Sakhis to come together in Chaturasi Ji gaayan, sharing the joy of collective singing and keeping a cherished tradition alive through togetherness.",
  },
  {
    title: "Pada Gaayan",
    description:
      "Come together in pada gaayan, giving each composition its place through shared singing, attentive listening, and a deeper appreciation of its meaning.",
  },
  {
    title: "Guided Reading",
    description:
      "Follow devotional texts together during a gathering. The designated in-charge guides the reading, while every participant sees the same pages unfold in real time.",
  },
  {
    title: "Vaani Reader",
    description:
      "A dedicated home for devotional texts and PDFs, where Sakhis can independently explore, read, and revisit available material at their own pace.",
  },
  {
    title: "Sakhi Samvaad",
    description:
      "A place for questions, thoughtful conversations, and the sharing of understanding, where every voice can contribute to a connected community.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#faf9f5] text-[#292b25]">
      <header className="relative z-10 border-b border-[#e9e6dc]">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-[0.12em] text-[#344b3d]"
          >
            VAANI
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-[#55594e] transition hover:text-[#344b3d]"
            >
              Sign in
            </Link>

            <Link
              href="/login"
              className="rounded-full bg-[#344b3d] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#26392e]"
            >
              Enter Vaani
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-[#e8e9d9] opacity-50 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-36">
          <div>
            <p className="mb-7 text-xs font-semibold uppercase tracking-[0.28em] text-[#8b7952]">
              A space for devotion and togetherness
            </p>

            <h1 className="max-w-3xl text-5xl font-medium leading-[1.12] tracking-tight text-[#344b3d] sm:text-6xl lg:text-7xl">
              Where Vaani
              <br />
              brings us
              <br />
              <span className="font-serif italic text-[#927b50]">
                together.
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-base leading-8 text-[#68695e] sm:text-lg">
              A shared space for Sakhis to come together in Chaturasi Ji
              gaayan, pada gaayan, devotional reading, and meaningful
              conversations.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="rounded-full bg-[#344b3d] px-8 py-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#26392e]"
              >
                Enter Vaani
              </Link>

              <a
                href="#about"
                className="rounded-full border border-[#d8d5c9] px-8 py-4 text-sm font-medium text-[#55594e] transition hover:border-[#9b9a83]"
              >
                Discover Vaani
              </a>
            </div>
          </div>

          <div className="relative mx-auto flex aspect-[4/5] w-full max-w-md items-center justify-center overflow-hidden rounded-[48%_48%_42%_42%] border border-[#dedccf] bg-gradient-to-br from-[#e8e8d9] via-[#f0eee2] to-[#d9dfd2] p-10">
            <div className="absolute inset-5 rounded-[48%_48%_42%_42%] border border-white/70" />

            <div className="relative text-center">
              <div className="mx-auto mb-8 h-px w-16 bg-[#a28b5e]" />

              <p className="font-serif text-5xl italic tracking-wide text-[#53634c]">
                Vaani
              </p>

              <p className="mt-4 text-xs uppercase tracking-[0.3em] text-[#817b62]">
                Together in devotion
              </p>

              <div className="mx-auto mt-8 h-px w-16 bg-[#a28b5e]" />
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="border-y border-[#e9e6dc] bg-[#f3f1e8]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#927b50]">
              The purpose
            </p>

            <h2 className="mt-5 font-serif text-4xl leading-tight text-[#344b3d] sm:text-5xl">
              A shared space for devotion, learning, and togetherness.
            </h2>

            <p className="mt-6 text-base leading-8 text-[#68695e]">
              Vaani brings together Chaturasi Ji gaayan, pada gaayan,
              guided devotional reading, and meaningful community
              interaction in one connected space. Built around the
              needs of our Sakhis, it aims to make every gathering
              more accessible, connected, and enriching.
            </p>
          </div>

          <div className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className="border-t border-[#d6d2c4] pt-6"
              >
                <p className="text-xs tracking-[0.2em] text-[#9a895f]">
                  {String(index + 1).padStart(2, "0")}
                </p>

                <h3 className="mt-5 text-xl font-semibold text-[#344b3d]">
                  {feature.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-[#68695e]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-xs text-[#858477] sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <p className="font-semibold tracking-[0.2em] text-[#52634f]">
          VAANI
        </p>

        <p>A shared space for devotion, learning, and togetherness.</p>
      </footer>
    </main>
  );
}
