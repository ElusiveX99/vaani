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
      <svg className="landing-artwork__svg" viewBox="0 0 640 640" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="landing-core" cx="0" cy="0" r="1" gradientTransform="translate(320 306) rotate(90) scale(212)">
            <stop stopColor="#F8EEE8" />
            <stop offset=".62" stopColor="#EBDCD7" />
            <stop offset="1" stopColor="#DCC9C8" />
          </radialGradient>
          <linearGradient id="landing-ribbon" x1="106" y1="126" x2="526" y2="520" gradientUnits="userSpaceOnUse">
            <stop stopColor="#B78D91" />
            <stop offset=".48" stopColor="#E4D4C8" />
            <stop offset="1" stopColor="#A98A5B" />
          </linearGradient>
          <linearGradient id="landing-petal" x1="320" y1="154" x2="320" y2="486" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF9F3" />
            <stop offset="1" stopColor="#D8C1C1" />
          </linearGradient>
        </defs>
        <circle cx="320" cy="320" r="276" stroke="#CDBBB0" strokeOpacity=".68" />
        <circle cx="320" cy="320" r="244" stroke="#BCA49D" strokeOpacity=".42" strokeDasharray="2 9" />
        <ellipse cx="320" cy="320" rx="204" ry="250" stroke="#A98A5B" strokeOpacity=".34" transform="rotate(31 320 320)" />
        <ellipse cx="320" cy="320" rx="204" ry="250" stroke="#A98A5B" strokeOpacity=".34" transform="rotate(-31 320 320)" />
        <circle cx="320" cy="320" r="184" fill="url(#landing-core)" />
        <g className="landing-artwork__petals" fill="url(#landing-petal)" stroke="#A77D82" strokeOpacity=".6" strokeWidth="1.4">
          <path d="M320 160C278 207 282 255 320 302C358 255 362 207 320 160Z" />
          <path d="M480 320C433 278 385 282 338 320C385 358 433 362 480 320Z" />
          <path d="M320 480C362 433 358 385 320 338C282 385 278 433 320 480Z" />
          <path d="M160 320C207 362 255 358 302 320C255 282 207 278 160 320Z" />
          <path d="M207 207C216 267 253 296 310 310C296 253 267 216 207 207Z" />
          <path d="M433 207C373 216 344 253 330 310C387 296 424 267 433 207Z" />
          <path d="M433 433C424 373 387 344 330 330C344 387 373 424 433 433Z" />
          <path d="M207 433C267 424 296 387 310 330C253 344 216 373 207 433Z" />
        </g>
        <circle cx="320" cy="320" r="67" stroke="#A98A5B" strokeOpacity=".8" />
        <circle cx="320" cy="320" r="48" fill="#F8F2EA" stroke="#593B53" strokeOpacity=".36" />
        <g fill="#E8D6D1" stroke="#593B53" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M320 282C302 270 298 254 309 248C319 243 327 256 320 282Z" />
          <path d="M326 285C338 267 354 263 360 274C365 284 352 292 326 285Z" />
          <path d="M329 326C347 314 363 318 362 330C361 342 345 345 329 326Z" />
          <path d="M317 329C329 347 325 363 313 362C301 361 299 345 317 329Z" />
          <path d="M311 319C293 331 277 327 278 315C279 303 295 300 311 319Z" />
          <path d="M312 288C300 270 284 266 278 277C273 287 286 295 312 288Z" />
        </g>
        <circle cx="320" cy="310" r="9" fill="#A98A5B" />
        <circle cx="320" cy="310" r="3" fill="#FFF9F3" />
        <path d="M320 44V82M320 558V596M44 320H82M558 320H596" stroke="#A98A5B" strokeOpacity=".7" strokeLinecap="round" />
        <circle cx="320" cy="44" r="4" fill="#A98A5B" />
        <circle cx="596" cy="320" r="4" fill="#A98A5B" />
        <circle cx="320" cy="596" r="4" fill="#A98A5B" />
        <circle cx="44" cy="320" r="4" fill="#A98A5B" />
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
            <p className="landing-eyebrow landing-reveal">Shree Harivansh</p>
            <h1 id="landing-title" className="landing-title landing-reveal">
              Vaani <em>Gaayan</em>
            </h1>
            <p className="landing-hero__description landing-reveal">
              A quiet space for Sakhis to gather for Shree Hit Chaturasi Ji gaayan and Vaani paath.
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
            <p className="landing-hero__note landing-reveal">Sakhi Sang · Gaayan · Paath</p>
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
                    {item.tone === "gaayan" ? (
                      <svg viewBox="0 0 72 72" fill="none">
                        <path d="M36 8C25 21 25 32 36 40C47 32 47 21 36 8Z" />
                        <path d="M64 36C51 25 40 25 32 36C40 47 51 47 64 36Z" />
                        <path d="M36 64C47 51 47 40 36 32C25 40 25 51 36 64Z" />
                        <path d="M8 36C21 47 32 47 40 36C32 25 21 25 8 36Z" />
                        <circle cx="36" cy="36" r="7" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 72 72" fill="none">
                        <path d="M14 18C25 13 35 16 36 25V58C34 50 25 47 14 51V18Z" />
                        <path d="M58 18C47 13 37 16 36 25V58C38 50 47 47 58 51V18Z" />
                        <path d="M36 25V58" />
                        <path d="M20 25C25 23 29 24 31 27M52 25C47 23 43 24 41 27" />
                      </svg>
                    )}
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
