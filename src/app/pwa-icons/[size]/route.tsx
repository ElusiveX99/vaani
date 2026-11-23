import { ImageResponse } from "next/og";

const mark = "M57 76 C79 48 118 35 154 41 C191 47 211 72 210 101 C209 130 185 151 157 170 C131 188 111 205 117 220";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: requestedSize } = await params;
  const size = Number(requestedSize);

  if (![180, 192, 512].includes(size)) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#173F5F", borderRadius: "22%" }}>
      <svg viewBox="0 0 256 256" width={size * 0.82} height={size * 0.82}>
        <path d={mark} fill="none" stroke="#F5EBD7" strokeWidth="25" strokeLinecap="round" />
      </svg>
    </div>,
    { width: size, height: size }
  );
}
