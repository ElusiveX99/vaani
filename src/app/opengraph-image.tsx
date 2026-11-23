import { ImageResponse } from "next/og";

export const alt = "Vaani — a shared space for Gaayan and Paath";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mark = "M48 46 C78 73 93 166 124 203 C132 213 142 213 150 202 C183 158 199 73 232 37 C242 26 253 33 246 46 C218 99 203 174 164 225 C149 245 126 246 109 228 C72 188 63 91 38 61 C30 51 38 39 48 46 Z";

function VaaniEmblem() {
  return (
    <svg width="510" height="510" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", right: 66, top: 64 }}>
      <rect width="256" height="256" rx="52" fill="#173F4A" />
      <path d={mark} transform="translate(10 5) scale(.94)" fill="#F7F0E3" />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", overflow: "hidden", flexDirection: "column", justifyContent: "center", padding: "70px 82px", background: "linear-gradient(112deg, #FBF7ED 0%, #F6F0E3 58%, #EFE2CC 100%)", color: "#173F4A", fontFamily: "Georgia, serif" }}>
      <div style={{ position: "absolute", inset: 18, border: "1px solid rgba(197,141,50,.48)", display: "flex" }} />
      <div style={{ position: "absolute", inset: 27, border: "1px solid rgba(23,63,74,.12)", display: "flex" }} />
      <div style={{ position: "absolute", left: 18, top: 18, width: 5, height: 594, background: "#B64E36", display: "flex" }} />
      <VaaniEmblem />
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", width: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#B64E36", fontSize: 18, letterSpacing: 5, fontWeight: 600 }}>
          <span style={{ width: 34, height: 2, background: "#C58D32", display: "flex" }} />
          SHREE HARIVANSH
        </div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 112, fontWeight: 500, lineHeight: 1, letterSpacing: -5 }}>Vaani</div>
        <div style={{ display: "flex", marginTop: 22, color: "#B64E36", fontSize: 19, letterSpacing: 4, fontWeight: 600 }}>GAAYAN &amp; PAATH</div>
        <div style={{ display: "flex", marginTop: 27, maxWidth: 510, color: "#284C54", fontSize: 28, lineHeight: 1.35 }}>A shared space for Sakhis to gather.</div>
      </div>
      <div style={{ position: "absolute", left: 83, bottom: 52, display: "flex", alignItems: "center", gap: 14, color: "#A05B43", fontSize: 17, letterSpacing: 2 }}>
        <span style={{ width: 28, height: 2, background: "#C58D32", display: "flex" }} />
        जय जय श्री हित हरिवंश
      </div>
    </div>,
    size,
  );
}
