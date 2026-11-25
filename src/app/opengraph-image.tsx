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
          right: -74,
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
          right: 6,
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
          right: 47,
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
          right: 90,
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
          right: 144,
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
          right: 186,
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
          right: 225,
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
          right: 112,
          top: 178,
          borderRadius: 5,
          backgroundColor: "#ad7d83",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 8,
          height: 8,
          right: 426,
          top: 434,
          borderRadius: 4,
          backgroundColor: "#c5a07d",
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
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 2.2,
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
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 3,
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
              width: 650,
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
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 82,
          bottom: 13,
          color: "#9a8588",
          fontSize: 13,
          letterSpacing: 1.4,
          fontWeight: 600,
        }}
      >
        VAANI
      </div>
    </div>,
    size,
  );
}
