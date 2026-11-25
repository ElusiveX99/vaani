import { ImageResponse } from "next/og";

export const alt = "Vaani";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#fffdf9" }}>
      <svg width="380" height="380" viewBox="0 0 160 160" fill="none">
        <g stroke="#593B53" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M80 13C61.8 30.4 54.1 47.3 61.8 64.7 66.1 74.5 73.1 81 80 85.2c6.9-4.2 13.9-10.7 18.2-20.5C105.9 47.3 98.2 30.4 80 13Z" fill="#593B53"/>
          <path d="M66.2 72.1C42.8 52.2 23.2 52.7 18.4 68.2c-5 16.1 10.1 30.7 36.1 29.8 7.4-.3 12.7-5.9 14.1-12.8" fill="#ad7d83"/>
          <path d="M93.8 72.1c23.4-19.9 43-19.4 47.8-3.9 5 16.1-10.1 30.7-36.1 29.8-7.4-.3-12.7-5.9-14.1-12.8" fill="#ad7d83"/>
          <path d="M64.7 91.2c-19.1-9.3-34.8-5.3-36.4 8.7-1.7 14.5 14.2 25.7 35.8 17.7 7.2-2.7 10.5-9.5 8.6-16.4" fill="#e7d4d0"/>
          <path d="M95.3 91.2c19.1-9.3 34.8-5.3 36.4 8.7 1.7 14.5-14.2 25.7-35.8 17.7-7.2-2.7-10.5-9.5-8.6-16.4" fill="#e7d4d0"/>
          <path d="M80 88.8c-15.9 12.4-19.1 28.5 0 57.1 19.1-28.6 15.9-44.7 0-57.1Z" fill="#593b53"/>
        </g>
        <circle cx="80" cy="83" r="4.5" fill="#c5a07d" stroke="#593b53" strokeWidth="1.4"/>
      </svg>
    </div>,
    size,
  );
}
