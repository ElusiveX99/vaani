import Link from "next/link";
import styles from "./landing.module.css";

const gatheringSteps = [
  {
    number: "01",
    title: "Prepare",
    text: "Set the time, duration, and access before the gathering begins.",
  },
  {
    number: "02",
    title: "Invite",
    text: "Bring the Sakhis in through their Vaani membership or an invitation link.",
  },
  {
    number: "03",
    title: "Gather",
    text: "Enter the room together, with the call, chat, and shared reading in one place.",
  },
] as const;

export default function LandingPage() {
  return (
    <main className={styles.site}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.wordmark} aria-label="Vaani home">
            Vaani
          </Link>

          <nav className={styles.navigation} aria-label="Main navigation">
            <a href="#gathering">The gathering</a>
            <a href="#reader">Shared reading</a>
            <a href="#about">About Vaani</a>
          </nav>

          <div className={styles.headerActions}>
            <Link href="/login" className={styles.signIn}>
              Sign in
            </Link>
            <Link href="/signup" className={styles.headerJoin}>
              Join Vaani
            </Link>
          </div>
        </div>
      </header>

      <div id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>For Sakhi Sang</p>

            <h1 id="hero-title" className={styles.heroTitle}>
              Come together.
              <br />
              <em>Stay with the Vaani.</em>
            </h1>

            <div className={styles.heroLower}>
              <p className={styles.heroDescription}>
                Vaani is a place for Sakhis to gather for Shree Hit Chaturasi
                Ji gaayan, pada gaayan, and Vaani Paath — together, wherever
                they are.
              </p>

              <div className={styles.heroActions}>
                <Link href="/signup" className={styles.primaryButton}>
                  Join Vaani
                </Link>
                <Link href="/login" className={styles.secondaryButton}>
                  Sign in
                </Link>
              </div>
            </div>

            <div className={styles.heroRule} aria-hidden="true">
              <span>GAAYAN</span>
              <span>PAATH</span>
              <span>SANG</span>
            </div>
          </div>
        </section>

        <section id="gathering" className={styles.gatheringSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>The gathering</p>
            <h2>
              Before the first word is sung, the gathering already has a
              place.
            </h2>
            <p>
              Vaani keeps the path from planning to presence simple. The
              technology stays in the background so the gathering can stay in
              the foreground.
            </p>
          </div>

          <div className={styles.stepList}>
            {gatheringSteps.map((step) => (
              <article className={styles.step} key={step.number}>
                <span className={styles.stepNumber}>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="reader" className={styles.readerSection}>
          <div className={styles.readerInner}>
            <div className={styles.readerCopy}>
              <p className={styles.eyebrow}>Shared Vaani</p>
              <h2>
                One gathering.
                <br />
                <em>One shared position.</em>
              </h2>
              <p>
                When the reading moves, everyone can stay oriented to the same
                Vaani. Each person can still move through the document on
                their own device and return to the shared position when ready.
              </p>
            </div>

            <div className={styles.readerPrinciple}>
              <div className={styles.readerLine} aria-hidden="true">
                <span />
              </div>
              <div className={styles.readerStatement}>
                <p className={styles.readerLabel}>The idea</p>
                <p className={styles.readerQuote}>
                  The gathering moves together. The reading remains personal.
                </p>
              </div>
              <div className={styles.readerDetails}>
                <div>
                  <span>Shared</span>
                  <p>The organizer or an authorized reader can guide the common reading position.</p>
                </div>
                <div>
                  <span>Personal</span>
                  <p>Every participant keeps local control of their own document view.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className={styles.aboutSection}>
          <div className={styles.aboutInner}>
            <div className={styles.aboutHeading}>
              <p className={styles.eyebrow}>The room around the Vaani</p>
              <h2>Everything needed for the gathering, without making the gathering about the technology.</h2>
            </div>

            <div className={styles.aboutText}>
              <p>
                Organizers can schedule and manage gatherings, control who
                enters, and welcome participants through a waiting room.
                Inside, live audio and video, gathering chat, and session
                controls are kept together.
              </p>
              <p>
                The shared reader then gives the room a common point of
                reference — without asking everyone to give up their own way
                of reading.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.closingSection}>
          <div className={styles.closingInner}>
            <p className={styles.eyebrow}>Begin a gathering</p>
            <h2>Make a place for the next Vaani.</h2>
            <p>
              Join Vaani and take part in gatherings centered on Gaayan and
              Vaani Paath.
            </p>
            <div className={styles.closingActions}>
              <Link href="/signup" className={styles.primaryButton}>
                Join Vaani
              </Link>
              <Link href="/login" className={styles.closingSignIn}>
                Already a member? Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Link href="/" className={styles.footerWordmark}>
            Vaani
          </Link>
          <p className={styles.footerInvocation}>जय जय श्री हित हरिवंश</p>
          <div className={styles.footerLinks}>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Join Vaani</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
