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
        <defs>
          <linearGradient id="folio-paper" x1="310" y1="30" x2="310" y2="530" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFCF7" />
            <stop offset="1" stopColor="#EDE4DC" />
          </linearGradient>
          <linearGradient id="voice-line" x1="105" y1="210" x2="512" y2="305" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A77D82" />
            <stop offset=".52" stopColor="#593B53" />
            <stop offset="1" stopColor="#A98A5B" />
          </linearGradient>
        </defs>
        <rect x="28" y="22" width="564" height="516" rx="7" fill="#EDE5DE" stroke="#D3C3B9" />
        <rect x="43" y="37" width="534" height="486" rx="3" stroke="#C8B5AA" strokeOpacity=".7" />
        <path d="M82 82H538" stroke="#CDBBB0" strokeOpacity=".75" />
        <path d="M82 478H538" stroke="#CDBBB0" strokeOpacity=".75" />
        <circle cx="82" cy="82" r="3" fill="#A98A5B" />
        <circle cx="538" cy="82" r="3" fill="#A98A5B" />
        <circle cx="82" cy="478" r="3" fill="#A98A5B" />
        <circle cx="538" cy="478" r="3" fill="#A98A5B" />

        <g stroke="#BDA9A0" strokeWidth="1.2" strokeLinecap="round" opacity=".65">
          <path d="M110 126H230" />
          <path d="M110 139H190" />
          <path d="M390 126H510" />
          <path d="M430 139H510" />
        </g>

        <path
          d="M104 245C145 245 151 180 190 180C229 180 230 309 270 309C310 309 310 214 350 214C390 214 391 278 430 278C469 278 477 245 516 245"
          stroke="url(#voice-line)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M104 264C145 264 151 218 190 218C229 218 230 289 270 289C310 289 310 239 350 239C390 239 391 260 430 260C469 260 477 264 516 264"
          stroke="#B98D91"
          strokeOpacity=".38"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="190" cy="180" r="4.5" fill="#A98A5B" />
        <circle cx="350" cy="214" r="4.5" fill="#A98A5B" />

        <path
          d="M112 355C174 331 235 339 310 372C385 339 446 331 508 355V435C447 412 385 423 310 456C235 423 173 412 112 435V355Z"
          fill="url(#folio-paper)"
          stroke="#9D7D7A"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M310 372V456" stroke="#BDA69C" strokeWidth="1.2" />
        <path d="M135 374C187 356 237 365 285 385M135 394C184 378 233 385 282 405M135 414C181 400 230 406 280 425" stroke="#BBA9A1" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M335 385C383 365 433 356 485 374M338 405C387 385 436 378 485 394M340 425C390 406 439 400 485 414" stroke="#BBA9A1" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M112 355C174 331 235 339 310 372C385 339 446 331 508 355" stroke="#593B53" strokeOpacity=".45" strokeWidth="1.5" />
        <path d="M112 435C173 412 235 423 310 456C385 423 447 412 508 435" stroke="#593B53" strokeOpacity=".35" strokeWidth="1.5" />

        <path d="M310 92V108M302 100H318" stroke="#A98A5B" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M294 492H326" stroke="#A98A5B" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="landing-artwork__halo landing-artwork__halo--one" />
      <span className="landing-artwork__halo landing-artwork__halo--two" />
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
