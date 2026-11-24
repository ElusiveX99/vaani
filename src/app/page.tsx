import Link from "next/link";
import styles from "./landing.module.css";

const capabilities = [
  {
    title: "Create a gathering",
    text: "Save a gathering as a draft or publish it for a future time. Set its time, duration, access, participant limit, waiting room, and other instructions.",
  },
  {
    title: "Invite people",
    text: "Share a gathering with Vaani members or send a secure invitation link to the people you want to join.",
  },
  {
    title: "Welcome everyone",
    text: "Use a waiting room when you want participants to wait for approval before entering the gathering.",
  },
  {
    title: "Gather live",
    text: "Meet with live audio and video, organizer and session controls, and gathering chat in the same room.",
  },
  {
    title: "Read Vaani together",
    text: "Follow a synchronized PDF reader during Vaani Paath. A shared reading position keeps the gathering oriented while each person can navigate locally.",
  },
] as const;

const gatheringFlow = [
  {
    title: "Set it up",
    text: "Create the gathering, choose when it happens, and decide how people will enter.",
  },
  {
    title: "Bring the Sakhis in",
    text: "Use Vaani membership access or a secure invitation link. If a waiting room is enabled, the organizer approves entry.",
  },
  {
    title: "Meet",
    text: "Everyone enters the same gathering for live audio and video, chat, and session controls.",
  },
  {
    title: "Open the Vaani",
    text: "Use the shared reader during Paath so the common reading position can be followed without taking away each person's local navigation.",
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
            <a href="#what-you-can-do">What you can do</a>
            <a href="#gathering">How a gathering works</a>
            <a href="#reader">Shared reader</a>
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
            <p className={styles.heroKicker}>Vaani</p>

            <h1 id="hero-title" className={styles.heroTitle}>
              Gather for Gaayan
              <br />
              and Vaani Paath.
            </h1>

            <div className={styles.heroLower}>
              <p className={styles.heroDescription}>
                Vaani gives Sakhis a place to create, join, and take part in
                live gatherings centered on Shree Hit Chaturasi Ji Gaayan,
                pada Gaayan, and Vaani Paath — with the gathering and shared
                reading kept together.
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
          </div>
        </section>

        <section id="what-you-can-do" className={styles.capabilitiesSection}>
          <div className={styles.sectionShell}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionLabel}>What you can do</p>
              <h2>Everything needed to hold the gathering in one place.</h2>
            </div>

            <div className={styles.capabilityList}>
              {capabilities.map((item) => (
                <article className={styles.capability} key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="gathering" className={styles.gatheringSection}>
          <div className={styles.sectionShell}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionLabel}>How a gathering works</p>
              <h2>From creating the gathering to reading together.</h2>
            </div>

            <div className={styles.flow}>
              {gatheringFlow.map((item) => (
                <article className={styles.flowItem} key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="reader" className={styles.readerSection}>
          <div className={styles.sectionShell}>
            <div className={styles.readerGrid}>
              <div className={styles.sectionHeading}>
                <p className={styles.sectionLabel}>Shared reader</p>
                <h2>Read from the same Vaani, together.</h2>
                <p className={styles.supportingText}>
                  During Vaani Paath, the reader can keep everyone oriented to
                  a common reading position. Each participant still has local
                  control of their document view.
                </p>
              </div>

              <div className={styles.readerExplanation}>
                <div className={styles.readerPath}>
                  <div>
                    <strong>Shared position</strong>
                    <span>Organizer or authorized reader guides the common reading.</span>
                  </div>
                  <div className={styles.readerArrow} aria-hidden="true">
                    →
                  </div>
                  <div>
                    <strong>Local reading</strong>
                    <span>Each participant can move through the document on their own device.</span>
                  </div>
                </div>

                <p className={styles.readerNote}>
                  The point is simple: the gathering can move through the
                  Vaani together without forcing every participant into the
                  same local view.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.roomSection}>
          <div className={styles.sectionShell}>
            <div className={styles.roomGrid}>
              <div className={styles.sectionHeading}>
                <p className={styles.sectionLabel}>Inside the gathering</p>
                <h2>The live room handles the rest.</h2>
              </div>

              <div className={styles.roomList}>
                <p>
                  <strong>Live audio and video</strong>
                  <span>Meet the Sakhis in the same live session.</span>
                </p>
                <p>
                  <strong>Gathering chat</strong>
                  <span>Keep messages with the gathering instead of moving to another service.</span>
                </p>
                <p>
                  <strong>Organizer controls</strong>
                  <span>Manage the session and the people entering it.</span>
                </p>
                <p>
                  <strong>Membership and access</strong>
                  <span>Use member access, join requests, or invitation links as appropriate for the gathering.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.closingSection}>
          <div className={styles.closingInner}>
            <p className={styles.sectionLabel}>Join Vaani</p>
            <h2>Create or join your next gathering.</h2>
            <p>
              Vaani is built for Sakhis who want to gather for Gaayan and
              Vaani Paath together.
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
          <p className={styles.footerText}>Gather for Gaayan and Vaani Paath.</p>
          <div className={styles.footerLinks}>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Join Vaani</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
