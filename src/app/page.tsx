import Link from "next/link";
import styles from "./landing.module.css";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 10H16M10.5 4.5L16 10L10.5 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Wordmark() {
  return (
    <Link href="/" className={styles.wordmark} aria-label="Vaani home">
      Vaani<span aria-hidden="true">.</span>
    </Link>
  );
}

function ReaderPreview() {
  return (
    <div className={styles.preview} aria-label="Illustrative view of a Vaani gathering">
      <div className={styles.previewTopbar}>
        <div className={styles.previewBrand}>
          <span className={styles.previewBrandDot} />
          <span>VAANI GATHERING</span>
        </div>
        <span className={styles.previewLive}><span /> In progress</span>
      </div>

      <div className={styles.previewBody}>
        <div className={styles.readerPanel}>
          <div className={styles.readerHeading}>
            <div>
              <span className={styles.previewOverline}>SHARED READER</span>
              <p>Vaani Paath</p>
            </div>
            <span className={styles.pageCount}>Page <strong>—</strong></span>
          </div>
          <div className={styles.paper}>
            <span className={styles.paperRule} />
            <span className={styles.paperTitle}>श्री हित चतुरासी जी</span>
            <span className={styles.paperRuleShort} />
            <span className={styles.paperLine} />
            <span className={styles.paperLine} />
            <span className={styles.paperLineNarrow} />
            <span className={styles.paperGap} />
            <span className={styles.paperLine} />
            <span className={styles.paperLineNarrow} />
            <span className={styles.paperLine} />
            <span className={styles.paperFooter} />
          </div>
          <div className={styles.readerStatus}>
            <span className={styles.readerStatusDot} />
            Shared reading position
          </div>
        </div>

        <div className={styles.gatheringPanel}>
          <div className={styles.gatheringPanelHead}>
            <span className={styles.previewOverline}>GATHERING</span>
            <span className={styles.moreDots} aria-hidden="true">•••</span>
          </div>
          <div className={styles.participantTiles} aria-hidden="true">
            <div className={styles.participantTile}><span className={styles.participantAvatar}>S</span><span /></div>
            <div className={styles.participantTile}><span className={styles.participantAvatar}>S</span><span /></div>
            <div className={styles.participantTile}><span className={styles.participantAvatar}>S</span><span /></div>
          </div>
          <div className={styles.gatheringDivider} />
          <div className={styles.gatheringTool}><span className={styles.toolGlyph}>◖</span><span>Audio &amp; video</span></div>
          <div className={styles.gatheringTool}><span className={styles.toolGlyph}>▤</span><span>Shared reader</span></div>
          <div className={styles.gatheringTool}><span className={styles.toolGlyph}>▱</span><span>Gathering chat</span></div>
        </div>
      </div>
      <p className={styles.previewCaption}>An illustrative view of the shared gathering experience</p>
    </div>
  );
}

const capabilities = [
  {
    number: "01",
    title: "Plan a gathering",
    body: "Schedule a future gathering or save a draft. Set its duration, repeat schedule, participant limit, and instructions.",
  },
  {
    number: "02",
    title: "Choose who can join",
    body: "Make a gathering available to Vaani members or share an invitation link. Add a waiting room when organizer approval is needed.",
  },
  {
    number: "03",
    title: "Meet in one place",
    body: "Gather with live audio and video, chat, membership tools, join requests, and organizer or session-admin controls.",
  },
  {
    number: "04",
    title: "Follow the Vaani",
    body: "Read from a shared PDF reader. The organizer or an authorized reader can guide the shared page while participants keep local reading control.",
  },
];

export default function LandingPage() {
  return (
    <main className={styles.site}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Wordmark />
          <nav className={styles.nav} aria-label="Main navigation">
            <a href="#practices">Gaayan &amp; Paath</a>
            <a href="#reader">Shared reading</a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <div className={styles.headerActions}>
            <Link href="/login" className={styles.signIn}>Sign in</Link>
            <Link href="/signup" className={styles.headerJoin}>Join Vaani <ArrowIcon /></Link>
          </div>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}><span /> SAKHI SANG <span className={styles.kickerDivider}>/</span> SHREE HARIVANSH</p>
            <h1 id="hero-title">Come together<br />for the <em>Vaani.</em></h1>
            <p className={styles.heroText}>
              A shared space for Sakhis to gather for Shree Hit Chaturasi Ji Gaayan and Vaani Paath—with live audio and video, and a reader that follows the gathering.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={styles.primaryButton}>Join Vaani <ArrowIcon /></Link>
              <Link href="/login" className={styles.secondaryButton}>Already a member? Sign in</Link>
            </div>
            <p className={styles.heroFootnote}>GAAYAN <span>·</span> PAATH <span>·</span> SAKHI SANG</p>
          </div>
          <div className={styles.heroVisual}>
            <ReaderPreview />
          </div>
        </div>
        <div className={styles.heroBottom}>
          <span>MADE FOR SHARED GATHERINGS</span>
          <span className={styles.heroBottomLine} />
          <a href="#gathering">Explore Vaani <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section id="gathering" className={styles.intro}>
        <div className={styles.sectionIndex}>01 <span /> THE GATHERING</div>
        <div className={styles.introContent}>
          <p className={styles.kicker}>A PLACE TO COME TOGETHER</p>
          <h2>The gathering comes first.<br /><em>The tools follow.</em></h2>
          <p>
            Vaani brings the practical parts of a gathering into one place: arranging a time, sharing an invitation, meeting together, and following the Vaani as it is read.
          </p>
        </div>
        <div className={styles.introAside}>
          <span className={styles.asideRule} />
          <p>One shared space for Gaayan, Paath, and the Sakhis who gather for them.</p>
        </div>
      </section>

      <section id="practices" className={styles.practices}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>THE PRACTICES</p>
            <h2>Two ways to gather.<br /><em>One shared space.</em></h2>
          </div>
          <p>Whether the gathering is for singing or reading, Vaani keeps the people and the practice together.</p>
        </div>
        <div className={styles.practiceGrid}>
          <article className={styles.practice}>
            <span className={styles.practiceNumber}>01 / GAAYAN</span>
            <div className={styles.practiceArtwork} aria-hidden="true">
              <svg viewBox="0 0 440 150" fill="none">
                <path d="M4 77H77L102 40L132 112L166 20L201 130L235 48L265 91L293 61H436" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 94H436" stroke="currentColor" strokeOpacity=".16" />
              </svg>
            </div>
            <h3>Vaani Gaayan</h3>
            <p>Come together for pada gaayan. Live audio and video bring the gathering into one shared space.</p>
          </article>
          <article className={styles.practice}>
            <span className={styles.practiceNumber}>02 / PAATH</span>
            <div className={styles.practiceArtwork} aria-hidden="true">
              <svg viewBox="0 0 440 150" fill="none">
                <path d="M35 31C91 10 151 20 220 53C289 20 349 10 405 31V123C349 102 289 112 220 145C151 112 91 102 35 123V31Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M220 53V145M64 49C112 34 158 43 190 61M64 73C112 58 158 67 190 85M64 97C112 82 158 91 190 109M250 61C282 43 328 34 376 49M250 85C282 67 328 58 376 73M250 109C282 91 328 82 376 97" stroke="currentColor" strokeOpacity=".58" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Vaani Paath</h3>
            <p>Follow the Vaani as it is read, with a shared PDF reader that keeps the group's reading position in view.</p>
          </article>
        </div>
      </section>

      <section id="reader" className={styles.readerSection}>
        <div className={styles.readerCopy}>
          <p className={styles.kicker}>BUILT AROUND SHARED READING</p>
          <h2>Read together.<br /><em>Stay in step.</em></h2>
          <p>
            The Vaani Reader is part of the gathering—not a separate screen to keep track of. An organizer or authorized reader can guide the shared page. Participants can move through the document on their own and return to the shared position when they are ready.
          </p>
          <ul className={styles.readerPoints}>
            <li><span>01</span> A shared PDF reader inside the conference</li>
            <li><span>02</span> A reading position synchronized for the gathering</li>
            <li><span>03</span> Local page navigation with a way back to the shared position</li>
          </ul>
        </div>
        <div className={styles.readerVisual}>
          <div className={styles.readerVisualTop}><span>THE VAANI READER</span><span>SHARED DOCUMENT</span></div>
          <div className={styles.openBook}>
            <div className={styles.bookPage}>
              <span className={styles.bookPageLabel}>SHREE HIT CHATURASI JI</span>
              <span className={styles.bookHeading}>श्री हित चतुरासी जी</span>
              <span className={styles.bookLine} /><span className={styles.bookLine} /><span className={styles.bookLineShort} />
              <span className={styles.bookSpace} />
              <span className={styles.bookLine} /><span className={styles.bookLineShort} /><span className={styles.bookLine} />
              <span className={styles.bookPageNumber}>—</span>
            </div>
            <div className={styles.bookPage}>
              <span className={styles.bookPageLabel}>SHARED READING</span>
              <span className={styles.bookLine} /><span className={styles.bookLineShort} /><span className={styles.bookLine} />
              <span className={styles.bookSpace} />
              <span className={styles.bookLine} /><span className={styles.bookLine} /><span className={styles.bookLineShort} />
              <span className={styles.bookSpace} />
              <span className={styles.bookLine} /><span className={styles.bookLineShort} />
              <span className={styles.bookPageNumber}>—</span>
            </div>
          </div>
          <div className={styles.readerVisualFoot}><span className={styles.syncDot} /> Shared position <span className={styles.readerVisualFootDivider} /> Follow along at your pace</div>
        </div>
      </section>

      <section id="how-it-works" className={styles.workflow}>
        <div className={styles.workflowHeading}>
          <p className={styles.kicker}>HOW A GATHERING WORKS</p>
          <h2>From invitation<br /><em>to togetherness.</em></h2>
          <p>Each gathering has a clear path from planning to joining in.</p>
        </div>
        <div className={styles.workflowSteps}>
          <article className={styles.workflowStep}>
            <span className={styles.workflowNumber}>01</span>
            <div><h3>Make a gathering</h3><p>Create one for a future time or save it as a draft. Add the details Sakhis need before they join.</p></div>
          </article>
          <article className={styles.workflowStep}>
            <span className={styles.workflowNumber}>02</span>
            <div><h3>Share the invitation</h3><p>Open it to Vaani members or share an invitation link. A waiting room lets the organizer approve participants before they enter.</p></div>
          </article>
          <article className={styles.workflowStep}>
            <span className={styles.workflowNumber}>03</span>
            <div><h3>Gather and take part</h3><p>Meet with live audio and video, and follow the shared Vaani Reader during Paath.</p></div>
          </article>
        </div>
      </section>

      <section className={styles.capabilities}>
        <div className={styles.capabilitiesHeading}>
          <p className={styles.kicker}>THOUGHT THROUGH, FROM START TO FINISH</p>
          <h2>Everything a gathering<br /><em>needs around it.</em></h2>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilities.map((item) => (
            <article className={styles.capability} key={item.number}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <p className={styles.kicker}>VAANI · SAKHI SANG</p>
        <h2>Make room<br />for a <em>gathering.</em></h2>
        <p>Join the Sakhis who come together for Gaayan and Paath.</p>
        <div className={styles.closingActions}>
          <Link href="/signup" className={styles.primaryButton}>Join Vaani <ArrowIcon /></Link>
          <Link href="/login" className={styles.closingSignIn}>Already a member? Sign in</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Wordmark />
          <p>जय जय श्री हित हरिवंश</p>
          <div><Link href="/login">Sign in</Link><Link href="/signup">Join Vaani</Link></div>
          <span className={styles.copyright}>© 2026 Vaani</span>
        </div>
      </footer>
    </main>
  );
}
