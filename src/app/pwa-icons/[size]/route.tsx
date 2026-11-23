import { ImageResponse } from "next/og";

const mark = "M48 46 C78 73 93 166 124 203 C132 213 142 213 150 202 C183 158 199 73 232 37 C242 26 253 33 246 46 C218 99 203 174 164 225 C149 245 126 246 109 228 C72 188 63 91 38 61 C30 51 38 39 48 46 Z";

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
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#173F4A", borderRadius: "22%" }}>
      <svg viewBox="0 0 256 256" width={size * 0.82} height={size * 0.82}>
        <path d={mark} transform="translate(10 5) scale(.94)" fill="#F7F0E3" />
      </svg>
    </div>,
    { width: size, height: size }
  );
}
