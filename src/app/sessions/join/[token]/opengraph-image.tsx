import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const alt = "A Vaani gathering invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mark = "M57 76 C79 48 118 35 154 41 C191 47 211 72 210 101 C209 130 185 151 157 170 C131 188 111 205 117 220";

function VaaniSymbol() {
  return (
    <svg viewBox="0 0 256 256" width="54" height="54">
      <rect width="256" height="256" rx="52" fill="#173F4A" />
      <path d={mark} transform="translate(10 5) scale(.94)" fill="#F7F0E3" />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let title = "A gathering on Vaani";

  if (/^[a-z0-9]{10}$/.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("preview_session_invite_link", { p_code: token });
    if (data && typeof data.title === "string") title = data.title;
  }

  return new ImageResponse(
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", flexDirection: "column", justifyContent: "center", padding: "76px 82px", overflow: "hidden", background: "linear-gradient(112deg, #FBF7ED 0%, #F6F0E3 58%, #EFE2CC 100%)", color: "#173F4A", fontFamily: "Georgia, serif" }}>
      <div style={{ position: "absolute", inset: 18, border: "1px solid rgba(197,141,50,.48)", display: "flex" }} />
      <div style={{ position: "absolute", inset: 27, border: "1px solid rgba(23,63,74,.12)", display: "flex" }} />
      <div style={{ position: "absolute", right: -105, top: -135, width: 560, height: 560, border: "1px solid rgba(197,141,50,.25)", borderRadius: 280, display: "flex" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#173F4A", fontSize: 32, fontWeight: 600, letterSpacing: -1 }}>
        <VaaniSymbol />
        <span>Vaani</span>
        <span style={{ width: 34, height: 2, background: "#C58D32", display: "flex" }} />
        <span style={{ color: "#B64E36", fontSize: 15, letterSpacing: 4 }}>SAKHI SANG</span>
      </div>
      <div style={{ marginTop: 46, fontSize: 20, letterSpacing: 6, color: "#B64E36", fontWeight: 600 }}>YOU ARE INVITED</div>
      <div style={{ marginTop: 28, fontSize: 82, lineHeight: 1.04, fontWeight: 500, maxWidth: 990 }}>{title.length > 58 ? title.slice(0, 55) + "…" : title}</div>
      <div style={{ marginTop: 30, width: 96, height: 2, background: "#C58D32", display: "flex" }} />
      <div style={{ marginTop: 25, fontSize: 32, color: "#284C54" }}>Join this gathering on Vaani</div>
      <div style={{ position: "absolute", right: 80, bottom: 58, fontSize: 22, color: "#A05B43" }}>जय जय श्री हित हरिवंश</div>
    </div>,
    size,
  );
}
