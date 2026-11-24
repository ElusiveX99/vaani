import { ImageResponse } from "next/og";

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
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#593b53",
          borderRadius: "22%",
        }}
      >
        <svg viewBox="0 0 64 64" width={size * 0.76} height={size * 0.76}>
          <path
            d="M12 13C20 13 24 23 32 49C40 23 44 13 52 13"
            fill="none"
            stroke="#fffaf7"
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M40 25C44 28 46 32 46 37M44 18C51 23 54 30 54 38"
            fill="none"
            stroke="#d9b88b"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="50" cy="48" r="2.2" fill="#d9b88b" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
