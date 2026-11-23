import { ImageResponse } from "next/og";

export const alt = "Vaani — A shared space for Gaayan and Paath";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function LotusArtwork() {
  return (
    <svg
      width="540"
      height="540"
      viewBox="0 0 540 540"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", right: 42, top: 44 }}
    >
      <defs>
        <radialGradient id="lotus-core" cx="0" cy="0" r="1" gradientTransform="translate(270 270) rotate(90) scale(218)">
          <stop stopColor="#FFF9F3" />
          <stop offset=".7" stopColor="#EEDFD9" />
          <stop offset="1" stopColor="#DCC8C7" />
        </radialGradient>
        <linearGradient id="lotus-stroke" x1="86" y1="72" x2="454" y2="468" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A98A5B" />
          <stop offset=".52" stopColor="#A77D82" />
          <stop offset="1" stopColor="#593B53" />
        </linearGradient>
      </defs>
      <circle cx="270" cy="270" r="248" stroke="#BCA49D" strokeOpacity=".55" />
      <circle cx="270" cy="270" r="229" stroke="#A98A5B" strokeOpacity=".42" strokeDasharray="1.5 8" />
      <circle cx="270" cy="270" r="202" stroke="#593B53" strokeOpacity=".15" />
      <ellipse cx="270" cy="270" rx="154" ry="211" stroke="#A98A5B" strokeOpacity=".42" transform="rotate(30 270 270)" />
      <ellipse cx="270" cy="270" rx="154" ry="211" stroke="#A98A5B" strokeOpacity=".42" transform="rotate(-30 270 270)" />
      <circle cx="270" cy="270" r="172" fill="url(#lotus-core)" stroke="#A77D82" strokeOpacity=".5" />
      {Array.from({ length: 12 }, (_, index) => (
        <g key={index} transform={`rotate(${index * 30} 270 270)`}>
          <path
            d="M270 79C226 127 229 181 270 229C311 181 314 127 270 79Z"
            fill="#FBF5EF"
            fillOpacity=".88"
            stroke="url(#lotus-stroke)"
            strokeWidth="1.3"
          />
          <path d="M270 101C255 145 257 190 270 216C283 190 285 145 270 101Z" stroke="#A98A5B" strokeOpacity=".6" />
          <circle cx="270" cy="65" r="3" fill="#A98A5B" />
        </g>
      ))}
      <circle cx="270" cy="270" r="102" stroke="#A98A5B" strokeOpacity=".78" />
      <circle cx="270" cy="270" r="82" fill="#F9F3EC" stroke="#593B53" strokeOpacity=".34" />
      <g stroke="#A77D82" strokeWidth="1.6" strokeLinejoin="round" fill="#E8D6D1">
        <path d="M270 208C246 226 247 250 270 270C293 250 294 226 270 208Z" />
        <path d="M332 270C314 246 290 247 270 270C290 293 314 294 332 270Z" />
        <path d="M270 332C294 314 293 290 270 270C247 290 246 314 270 332Z" />
        <path d="M208 270C226 294 250 293 270 270C250 247 226 246 208 270Z" />
        <path d="M226 226C228 250 246 266 270 270C266 246 250 228 226 226Z" />
        <path d="M314 226C290 228 274 246 270 270C294 266 312 250 314 226Z" />
        <path d="M314 314C312 290 294 274 270 270C274 294 290 312 314 314Z" />
        <path d="M226 314C250 312 266 294 270 270C246 274 228 290 226 314Z" />
      </g>
      <circle cx="270" cy="270" r="8" fill="#A98A5B" />
      <circle cx="270" cy="270" r="3" fill="#FFF9F3" />
      <path d="M270 8V29M270 511V532M8 270H29M511 270H532" stroke="#A98A5B" strokeWidth="1.2" />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 84px",
        background:
          "radial-gradient(ellipse at 77% 49%, rgba(225,207,201,.68) 0%, rgba(246,243,238,0) 44%), linear-gradient(118deg, #FBF8F3 0%, #F6F1EB 57%, #EFE5DF 100%)",
        color: "#593B53",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ position: "absolute", inset: 18, border: "1px solid rgba(169,138,91,.4)", display: "flex" }} />
      <div style={{ position: "absolute", inset: 27, border: "1px solid rgba(89,59,83,.1)", display: "flex" }} />
      <div style={{ position: "absolute", left: 18, top: 18, width: 5, height: 594, background: "linear-gradient(180deg, #A98A5B 0%, #A77D82 52%, #593B53 100%)", display: "flex" }} />
      <LotusArtwork />
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", width: 620 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, color: "#8B704E", fontSize: 19, letterSpacing: 6, fontWeight: 600 }}>
          <span style={{ width: 38, height: 1, background: "#A98A5B", display: "flex" }} />
          SHREE HARIVANSH
        </div>
        <div style={{ display: "flex", marginTop: 27, fontSize: 130, fontWeight: 500, lineHeight: 1, letterSpacing: -6 }}>
          Vaani
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 17, marginTop: 24 }}>
          <span style={{ width: 58, height: 2, background: "#A98A5B", display: "flex" }} />
          <span style={{ color: "#98727B", fontSize: 19, letterSpacing: 5, fontWeight: 600 }}>GAAYAN &amp; PAATH</span>
        </div>
        <div style={{ display: "flex", marginTop: 25, maxWidth: 520, color: "#574B54", fontSize: 29, lineHeight: 1.35 }}>
          A shared space for Sakhis to gather.
        </div>
      </div>
      <div style={{ position: "absolute", left: 85, bottom: 54, display: "flex", alignItems: "center", gap: 14, color: "#806A70", fontSize: 18, letterSpacing: 2 }}>
        <span style={{ width: 28, height: 1, background: "#A98A5B", display: "flex" }} />
        जय जय श्री हित हरिवंश
      </div>
      <div style={{ position: "absolute", right: 79, bottom: 58, display: "flex", color: "#987B58", fontSize: 12, letterSpacing: 4 }}>
        SAKHI SANG
      </div>
    </div>,
    size,
  );
}
