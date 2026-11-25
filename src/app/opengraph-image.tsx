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
          <svg width="54" height="54" viewBox="0 0 160 160" fill="none">
            <path d="M80 13C61.8 30.4 54.1 47.3 61.8 64.7 66.1 74.5 73.1 81 80 85.2c6.9-4.2 13.9-10.7 18.2-20.5C105.9 47.3 98.2 30.4 80 13Z" fill="#593b53"/>
            <path d="M66.2 72.1C42.8 52.2 23.2 52.7 18.4 68.2c-5 16.1 10.1 30.7 36.1 29.8 7.4-.3 12.7-5.9 14.1-12.8" fill="#ad7d83"/>
            <path d="M93.8 72.1c23.4-19.9 43-19.4 47.8-3.9 5 16.1-10.1 30.7-36.1 29.8-7.4-.3-12.7-5.9-14.1-12.8" fill="#ad7d83"/>
            <path d="M64.7 91.2c-19.1-9.3-34.8-5.3-36.4 8.7-1.7 14.5 14.2 25.7 35.8 17.7 7.2-2.7 10.5-9.5 8.6-16.4" fill="#e7d4d0"/>
            <path d="M95.3 91.2c19.1-9.3 34.8-5.3 36.4 8.7 1.7 14.5-14.2 25.7-35.8 17.7-7.2-2.7-10.5-9.5-8.6-16.4" fill="#e7d4d0"/>
            <path d="M80 88.8c-15.9 12.4-19.1 28.5 0 57.1 19.1-28.6 15.9-44.7 0-57.1Z" fill="#593b53"/>
            <circle cx="80" cy="83" r="4.5" fill="#c5a07d"/>
          </svg>
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
