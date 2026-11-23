import { ImageResponse } from "next/og";

export const alt = "Vaani — a shared space for Gaayan and Paath";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function SoundAndFolio() {
  return (
    <svg
      width="510"
      height="510"
      viewBox="0 0 620 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", right: 28, top: 54 }}
    >
      <rect x="28" y="22" width="564" height="516" rx="7" fill="#EDE5DE" stroke="#D3C3B9" />
      <rect x="43" y="37" width="534" height="486" rx="3" stroke="#C8B5AA" strokeOpacity=".7" />
      <path d="M82 82H538M82 478H538" stroke="#CDBBB0" strokeOpacity=".75" />
      <path d="M104 245C145 245 151 180 190 180C229 180 230 309 270 309C310 309 310 214 350 214C390 214 391 278 430 278C469 278 477 245 516 245" stroke="#593B53" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M104 264C145 264 151 218 190 218C229 218 230 289 270 289C310 289 310 239 350 239C390 239 391 260 430 260C469 260 477 264 516 264" stroke="#B98D91" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="190" cy="180" r="4.5" fill="#A98A5B" />
      <circle cx="350" cy="214" r="4.5" fill="#A98A5B" />
      <path d="M112 355C174 331 235 339 310 372C385 339 446 331 508 355V435C447 412 385 423 310 456C235 423 173 412 112 435V355Z" fill="#FFFCF7" stroke="#9D7D7A" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M310 372V456M135 374C187 356 237 365 285 385M135 394C184 378 233 385 282 405M135 414C181 400 230 406 280 425M335 385C383 365 433 356 485 374M338 405C387 385 436 378 485 394M340 425C390 406 439 400 485 414" stroke="#BBA9A1" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M310 92V108M302 100H318" stroke="#A98A5B" strokeWidth="1.3" strokeLinecap="round" />
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
        padding: "70px 82px",
        background: "linear-gradient(112deg, #FBF8F3 0%, #F6F1EB 56%, #EFE5DF 100%)",
        color: "#593B53",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ position: "absolute", inset: 18, border: "1px solid rgba(169,138,91,.42)", display: "flex" }} />
      <div style={{ position: "absolute", inset: 27, border: "1px solid rgba(89,59,83,.12)", display: "flex" }} />
      <div style={{ position: "absolute", left: 18, top: 18, width: 5, height: 594, background: "#A98A5B", display: "flex" }} />
      <SoundAndFolio />
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", width: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#8B704E", fontSize: 18, letterSpacing: 5, fontWeight: 600 }}>
          <span style={{ width: 34, height: 1, background: "#A98A5B", display: "flex" }} />
          SHREE HARIVANSH
        </div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 112, fontWeight: 500, lineHeight: 1, letterSpacing: -5 }}>
          Vaani
        </div>
        <div style={{ display: "flex", marginTop: 22, color: "#98727B", fontSize: 19, letterSpacing: 4, fontWeight: 600 }}>
          GAAYAN &amp; PAATH
        </div>
        <div style={{ display: "flex", marginTop: 27, maxWidth: 510, color: "#574B54", fontSize: 28, lineHeight: 1.35 }}>
          A shared space for Sakhis to gather.
        </div>
      </div>
      <div style={{ position: "absolute", left: 83, bottom: 52, display: "flex", alignItems: "center", gap: 14, color: "#806A70", fontSize: 17, letterSpacing: 2 }}>
        <span style={{ width: 28, height: 1, background: "#A98A5B", display: "flex" }} />
        जय जय श्री हित हरिवंश
      </div>
    </div>,
    size,
  );
}
