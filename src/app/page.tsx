import Link from "next/link";
import styles from "./landing.module.css";

const gatheringStages = [
  {
    title: "Prepare",
    description:
      "Create a gathering, save it as a draft, or publish it for a future time. Set the duration, access, and other details before sharing it.",
  },
  {
    title: "Invite",
    description:
      "Share it with Vaani members or send a secure invitation link. A waiting room lets the organizer review requests before anyone enters.",
  },
  {
    title: "Gather",
    description:
      "Meet with live audio and video, use the gathering chat, and follow the Vaani together in the shared reader.",
  },
] as const;

const gatheringTools = [
  {
    title: "Scheduling",
    detail:
      "Drafts, future start times, duration, time zone, repeat schedules, and participant instructions.",
  },
  {
    title: "Access",
    detail:
      "Member gatherings, secure invitation links, participant limits, waiting rooms, and approval of join requests.",
  },
  {
    title: "In the room",
    detail:
      "Live audio and video, gathering chat, organizer and session-admin controls, and membership management.",
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
            <a href="#shared-reader">Shared reading</a>
            <a href="#tools">What Vaani includes</a>
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
            <p className={styles.eyebrow}>A place for Sakhi Sang</p>

            <h1 id="hero-title" className={styles.heroTitle}>
              Come together for
              <br />
              <em>Gaayan &amp; Paath.</em>
            </h1>

            <div className={styles.heroLower}>
              <p className={styles.heroDescription}>
                Vaani brings Sakhis together for Shree Hit Chaturasi Ji gaayan,
                pada gaayan, and shared Vaani paath—online, in one place.
              </p>

              <div className={styles.heroActions}>
                <Link href="/signup" className={styles.primaryButton}>
                  Join Vaani
                </Link>
                <Link href="/login" className={styles.secondaryButton}>
                  Sign in to your account
                </Link>
              </div>
            </div>
          </div>

          <div className={styles.heroFooter} aria-label="Vaani at a glance">
            <span>Arrange a gathering</span>
            <span>Meet with audio and video</span>
            <span>Follow the shared Vaani</span>
          </div>
        </section>

        <section id="gathering" className={styles.gatheringSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>From planning to presence</p>
            <h2>
              Everything around a gathering,
              <br />
              in one considered place.
            </h2>
            <p>
              The practical steps stay connected, so the focus can stay on the
              time Sakhis have come together to share.
            </p>
          </div>

          <div className={styles.stageList}>
            {gatheringStages.map((stage) => (
              <article className={styles.stage} key={stage.title}>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="shared-reader" className={styles.readerSection}>
          <div className={styles.readerInner}>
            <div className={styles.readerHeading}>
              <p className={styles.eyebrow}>The shared reader</p>
              <h2>
                Follow the same Vaani.
                <br />
                Read at your own pace.
              </h2>
              <p>
                The shared reader keeps everyone oriented to the same document
                without taking away each person’s ability to read comfortably.
              </p>
            </div>

            <div className={styles.readerDetails}>
              <article>
                <h3>One shared position</h3>
                <p>
                  The organizer or an authorized reader can control the shared
                  document page and reading position.
                </p>
              </article>
              <article>
                <h3>Your own navigation</h3>
                <p>
                  Participants can move through the document locally, then
                  return to the shared position whenever they are ready.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="tools" className={styles.toolsSection}>
          <div className={styles.toolsHeading}>
            <p className={styles.eyebrow}>Made for the whole session</p>
            <h2>The details are taken care of.</h2>
            <p>
              From the first invitation to the last page, the tools needed to
              organize and take part in a gathering are kept together.
            </p>
          </div>

          <div className={styles.toolList}>
            {gatheringTools.map((tool) => (
              <article className={styles.toolRow} key={tool.title}>
                <h3>{tool.title}</h3>
                <p>{tool.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.closingSection}>
          <div className={styles.closingInner}>
            <p className={styles.eyebrow}>Vaani · Sakhi Sang</p>
            <h2>Make room for the next gathering.</h2>
            <p>
              Join Vaani and take part in shared Gaayan and Vaani Paath.
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
