import { ImageResponse } from "next/og";

export const alt = "Vaani — a gathering space for Gaayan and Vaani Paath";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 88px",
        background: "#F5F2EC",
        color: "#272722",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 42, height: 2, background: "#805347", display: "flex" }} />
        <div style={{ color: "#805347", fontSize: 19, fontWeight: 600, letterSpacing: 5 }}>
          SAKHI SANG
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 42, fontSize: 112, fontWeight: 500, lineHeight: 1, letterSpacing: -5 }}>
        Vaani
      </div>
      <div style={{ display: "flex", marginTop: 26, color: "#805347", fontSize: 27, letterSpacing: 1 }}>
        Gaayan &amp; Paath
      </div>
      <div style={{ display: "flex", marginTop: 30, maxWidth: 900, color: "#68675F", fontSize: 25, lineHeight: 1.4 }}>
        A place for Sakhis to gather for Shree Hit Chaturasi Ji Gaayan and Vaani Paath.
      </div>
      <div style={{ display: "flex", marginTop: 44, width: 100, height: 1, background: "#DCD6CC" }} />
      <div style={{ display: "flex", marginTop: 22, color: "#68675F", fontSize: 19 }}>
        Shree Hit Chaturasi Ji · Vaani Paath
      </div>
    </div>,
    size,
  );
}
