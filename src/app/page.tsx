import Link from "next/link";
import { BrandMark } from "@/components/brand-lockup";

const practices = [
  {
    number: "01",
    title: "Vaani Gaayan",
    detail: "Sing the padas of Shree Hit Chaturasi Ji together.",
    tone: "gaayan",
  },
  {
    number: "02",
    title: "Vaani Paath",
    detail: "Read from the Vaani together, following each page at an unhurried pace.",
    tone: "paath",
  },
] as const;

function HeroArtwork() {
  return (
    <div className="landing-artwork" aria-hidden="true">
      <svg className="landing-artwork__svg" viewBox="0 0 620 560" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="74" y="72" width="472" height="416" rx="236" fill="#F5EBD7" opacity=".82" />
        <path d="M160 194 C198 147 264 125 326 135 C390 145 427 188 426 238 C425 289 384 326 334 360 C287 392 255 421 268 456" fill="none" stroke="#173F5F" strokeWidth="34" strokeLinecap="round" />
        <path d="M268 456 C245 472 218 464 205 441 C188 411 201 382 229 363 C257 344 293 337 328 327 C369 315 399 298 409 267 C420 236 409 208 385 185" fill="none" stroke="#C68B35" strokeWidth="14" strokeLinecap="round" />
        <path d="M160 194 C190 159 224 144 258 138" fill="none" stroke="#B54A3B" strokeWidth="14" strokeLinecap="round" />
        <path d="M148 468 C228 493 360 500 470 468" fill="none" stroke="#B54A3B" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="landing-hero__visual-caption">जय जय श्री हित हरिवंश</span>
    </div>
  );
}
function ScrollCue() {
  return (
    <a className="landing-scroll-cue" href="#gatherings" aria-label="Scroll to explore Vaani">
      <span>Scroll to explore</span>
      <svg viewBox="0 0 16 20" fill="none" aria-hidden="true">
        <path d="M8 1V17M2 11L8 17L14 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

function PracticeMark({ kind }: { kind: "gaayan" | "paath" }) {
  if (kind === "gaayan") {
    return (
      <svg viewBox="0 0 88 88" fill="none" aria-hidden="true">
        <path d="M12 44H22L29 27L39 61L49 19L59 55L66 38H76" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 70H76" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true">
      <path d="M12 25C25 19 36 22 44 29C52 22 63 19 76 25V66C63 60 52 63 44 70C36 63 25 60 12 66V25Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M44 29V70M20 34C28 31 34 33 38 36M50 36C54 33 60 31 68 34M20 45C28 42 34 44 38 47M50 47C54 44 60 42 68 45" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <nav className="landing-nav" aria-label="Main navigation">
          <BrandMark />
          <div className="landing-nav__links">
            <a className="landing-nav__quiet" href="#gatherings">Sakhi Sang</a>
            <a className="landing-nav__quiet" href="#practices">Gaayan &amp; Paath</a>
            <a className="landing-nav__quiet" href="#experience">How it works</a>
            <Link href="/login" className="landing-nav__quiet">Sign in</Link>
            <Link href="/signup" className="landing-nav__join">Join Vaani</Link>
          </div>
          <div className="landing-nav__mobile">
            <Link href="/login" className="landing-nav__quiet">Sign in</Link>
            <Link href="/signup" className="landing-nav__join">Join Vaani</Link>
          </div>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__ambient landing-hero__ambient--left" />
        <div className="landing-hero__ambient landing-hero__ambient--right" />
        <div className="landing-shell landing-hero__grid">
          <div className="landing-hero__copy">
            <p className="landing-eyebrow landing-reveal">Shree Harivansh · Sakhi Sang</p>
            <h1 id="landing-title" className="landing-title landing-reveal">
              A shared space for <em>Gaayan &amp; Paath.</em>
            </h1>
            <p className="landing-hero__description landing-reveal">
              A quiet place for Sakhis to gather for Shree Hit Chaturasi Ji gaayan and Vaani paath.
            </p>
            <div className="landing-hero__actions landing-reveal">
              <Link href="/signup" className="landing-button landing-button--primary">
                Join Vaani
                <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M3 9H14M9 4L14 9L9 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/sessions" className="landing-button landing-button--text">View Sessions</Link>
            </div>
            <p className="landing-hero__note landing-reveal">Vaani · Gaayan · Paath</p>
          </div>
          <div className="landing-hero__visual">
            <HeroArtwork />
            <span className="landing-hero__visual-caption">जय जय श्री हित हरिवंश</span>
          </div>
        </div>
        <div className="landing-shell landing-hero__foot">
          <span className="landing-hero__rule" />
          <ScrollCue />
          <span className="landing-hero__rule" />
        </div>
      </section>

      <section id="gatherings" className="landing-gathering landing-section">
        <div className="landing-shell landing-gathering__layout">
          <div className="landing-gathering__index landing-reveal">
            <span>01</span>
            <span className="landing-index-line" />
            <span>SAKHI SANG</span>
          </div>
          <div className="landing-gathering__content landing-reveal">
            <p className="landing-eyebrow">Together in Vaani</p>
            <h2 className="landing-section-title">A shared space for <em>Gaayan</em> and <em>Paath.</em></h2>
            <p className="landing-body-copy">
              Come together quietly for pada gaayan and reading.
            </p>
          </div>
          <div className="landing-gathering__ornament" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      <section id="practices" className="landing-practices landing-section">
        <div className="landing-shell">
          <div className="landing-practices__heading landing-reveal">
            <p className="landing-eyebrow">The practices</p>
            <h2 className="landing-section-title">Two ways to be <em>together.</em></h2>
          </div>
          <div className="landing-practices__grid">
            {practices.map((item) => (
              <article className={`landing-practice landing-practice--${item.tone} landing-reveal`} key={item.number}>
                <div className="landing-practice__top">
                  <span className="landing-practice__number">{item.number}</span>
                  <span className="landing-practice__mark" aria-hidden="true">
                    <PracticeMark kind={item.tone} />
                  </span>
                </div>
                <div className="landing-practice__bottom">
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="experience" className="landing-experience landing-section">
        <div className="landing-shell">
          <div className="landing-experience__heading landing-reveal">
            <p className="landing-eyebrow">A gathering, together</p>
            <h2 className="landing-section-title">From finding a space to <em>joining in.</em></h2>
            <p className="landing-body-copy">Vaani brings the practical parts of gathering into one shared place.</p>
          </div>
          <div className="landing-experience__steps">
            <article className="landing-experience__step landing-reveal">
              <span className="landing-experience__number">01</span>
              <div>
                <h3>Find a gathering</h3>
                <p>Explore gatherings open to Vaani members and see what is coming up.</p>
                <Link href="/sessions" className="landing-experience__link">View sessions <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8H13M8 3L13 8L8 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
              </div>
            </article>
            <article className="landing-experience__step landing-reveal">
              <span className="landing-experience__number">02</span>
              <div>
                <h3>Create a gathering</h3>
                <p>Arrange a gathering and invite Sakhis to join you.</p>
                <Link href="/sessions/new" className="landing-experience__link">Create a session <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8H13M8 3L13 8L8 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
              </div>
            </article>
            <article className="landing-experience__step landing-reveal">
              <span className="landing-experience__number">03</span>
              <div>
                <h3>Come together</h3>
                <p>Join the conference when it is time for gaayan and Vaani paath.</p>
                <Link href="/login" className="landing-experience__link">Sign in to Vaani <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8H13M8 3L13 8L8 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-closing landing-section">
        <div className="landing-closing__ornament" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="landing-closing__content landing-reveal">
          <p className="landing-eyebrow">Vaani</p>
          <h2 className="landing-section-title">A place to gather.</h2>
          <p className="landing-body-copy">Join the Sakhi Sang.</p>
          <Link href="/signup" className="landing-button landing-button--primary">
            Join Vaani
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 9H14M9 4L14 9L9 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__inner">
          <BrandMark />
          <p>जय जय श्री हित हरिवंश</p>
          <div className="landing-footer__links">
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Join Vaani</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
