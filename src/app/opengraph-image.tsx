import { ImageResponse } from "next/og";

export const alt = "Vaani — Gaayan and Vaani Paath, together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#fffdf9",
        color: "#29242a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 610,
          height: 610,
          right: -220,
          top: 10,
          borderRadius: 305,
          backgroundColor: "#f6f3ee",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 452,
          height: 452,
          right: -140,
          top: 89,
          borderRadius: 226,
          border: "1px solid #e4d8d3",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 370,
          height: 370,
          right: -100,
          top: 130,
          borderRadius: 185,
          border: "1px solid #d9c6c2",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 284,
          height: 284,
          right: -60,
          top: 173,
          borderRadius: 142,
          border: "1px solid #c9a99f",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 176,
          height: 176,
          right: -20,
          top: 227,
          borderRadius: 88,
          backgroundColor: "#eadbd6",
          border: "1px solid #d8c2bc",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 92,
          height: 92,
          right: 22,
          top: 269,
          borderRadius: 46,
          backgroundColor: "#593b53",
          opacity: 0.94,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 14,
          height: 14,
          right: 61,
          top: 308,
          borderRadius: 7,
          backgroundColor: "#c5a07d",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 10,
          height: 10,
          right: -52,
          top: 178,
          borderRadius: 5,
          backgroundColor: "#ad7d83",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 82,
          top: 52,
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="54" height="54" viewBox="0 0 160 160" fill="none" aria-hidden="true">
<g stroke="#593B53" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
<path d="M80 13 C63 29 59 45 68 61 C72 68 77 73 80 76 C83 73 88 68 92 61 C101 45 97 29 80 13 Z" fill="#593B53"/><path d="M68 69 C48 49 29 49 20 63 C10 79 24 95 43 96 C54 97 63 89 71 80 C70 76 69 72 68 69 Z" fill="#AD7D83"/><path d="M92 69 C112 49 131 49 140 63 C150 79 136 95 117 96 C106 97 97 89 89 80 C90 76 91 72 92 69 Z" fill="#AD7D83"/>
<path d="M70 84 C53 75 38 80 34 94 C30 108 43 120 59 117 C69 115 75 106 77 96 C75 91 73 87 70 84 Z" fill="#E7D4D0"/><path d="M90 84 C107 75 122 80 126 94 C130 108 117 120 101 117 C91 115 85 106 83 96 C85 91 87 87 90 84 Z" fill="#E7D4D0"/><path d="M80 91 C67 103 68 118 80 145 C92 118 93 103 80 91 Z" fill="#593B53"/>
<path d="M76 82 C69 85 66 92 68 101 C69 108 73 114 78 117 C80 118 81 116 81 112 L81 89 C81 84 79 81 76 82 Z" fill="#FFFDF9" stroke="none"/><path d="M84 82 C91 85 94 92 92 101 C91 108 87 114 82 117 C80 118 79 116 79 112 L79 89 C79 84 81 81 84 82 Z" fill="#FFFDF9" stroke="none"/>
<path d="M80 26 C73 37 72 48 80 59 C88 48 87 37 80 26Z" fill="none" stroke="#F8EEE9" strokeWidth="1.6"/>
<path d="M28 69 C39 64 51 69 61 80 M132 69 C121 64 109 69 99 80" fill="none" stroke="#F8EEE9" strokeWidth="1.6"/>
<path d="M80 101 C77 106 77 111 80 116 C83 111 83 106 80 101Z" fill="none" stroke="#C5A07D" strokeWidth="1.6"/>
</g></svg>
          <span
            style={{
              color: "#593b53",
              fontFamily: "Georgia, serif",
              fontSize: 48,
              fontWeight: 500,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            Vaani
          </span>
          <div
            style={{
              display: "flex",
              width: 1,
              height: 38,
              backgroundColor: "#d9c9c2",
            }}
          />
          <span
            style={{
              color: "#80613f",
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            GAAYAN & VAANI PAATH
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 55,
            width: 690,
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#80613f",
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 2.6,
              marginBottom: 18,
            }}
          >
            A SHARED SPACE FOR SAKHIS
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              color: "#593b53",
              fontFamily: "Georgia, serif",
              fontSize: 69,
              fontWeight: 500,
              letterSpacing: -2.8,
              lineHeight: 1.02,
            }}
          >
            <div>Gaayan and</div>
            <div style={{ display: "flex", color: "#ad7d83" }}>Vaani Paath,</div>
            <div>together.</div>
          </div>

          <div
            style={{
              display: "flex",
              width: 630,
              marginTop: 25,
              color: "#756d73",
              fontSize: 23,
              lineHeight: 1.42,
              letterSpacing: 0.05,
            }}
          >
            A shared place for Sakhis to meet live, sing, and follow the same
            Vaani — from the invitation to the reading.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 82,
          right: 82,
          bottom: 35,
          height: 1,
          backgroundColor: "#e5ddd5",
        }}
      />
    </div>,
    size,
  );
}
