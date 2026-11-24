import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const alt = "A Vaani gathering invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let title = "A gathering on Vaani";

  if (/^[a-z0-9]{10}$/.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("preview_session_invite_link", { p_code: token });
    if (data && typeof data.title === "string") title = data.title;
  }

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "center",
        padding: "76px 82px",
        overflow: "hidden",
        background: "linear-gradient(112deg, #FBF8F3 0%, #F6F1EB 56%, #EFE5DF 100%)",
        color: "#593B53",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ position: "absolute", inset: 18, border: "1px solid rgba(169,138,91,.42)", display: "flex" }} />
      <div style={{ position: "absolute", inset: 27, border: "1px solid rgba(89,59,83,.12)", display: "flex" }} />
      <div style={{ position: "absolute", right: -105, top: -135, width: 560, height: 560, border: "1px solid rgba(169,138,91,.25)", borderRadius: 280, display: "flex" }} />
      <div style={{ position: "absolute", right: -55, top: -85, width: 460, height: 460, border: "1px solid rgba(89,59,83,.13)", borderRadius: 230, display: "flex" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#593B53", fontSize: 32, fontWeight: 600, letterSpacing: -1 }}>
        <span>vaani</span>
        <span style={{ width: 34, height: 1, background: "#A98A5B", display: "flex" }} />
        <span style={{ color: "#8B704E", fontSize: 15, letterSpacing: 4 }}>SAKHI SANG</span>
      </div>
      <div style={{ marginTop: 46, fontSize: 20, letterSpacing: 6, color: "#8B704E", fontWeight: 600 }}>
        YOU ARE INVITED
      </div>
      <div style={{ marginTop: 28, fontSize: 82, lineHeight: 1.04, fontWeight: 500, maxWidth: 990 }}>
        {title.length > 58 ? title.slice(0, 55) + "…" : title}
      </div>
      <div style={{ marginTop: 30, width: 96, height: 2, background: "#A98A5B", display: "flex" }} />
      <div style={{ marginTop: 25, fontSize: 32, color: "#493B45" }}>Join this gathering on Vaani</div>
      <div style={{ position: "absolute", right: 80, bottom: 58, fontSize: 22, color: "#8C7A82" }}>जय जय श्री हित हरिवंश</div>
    </div>,
    size,
  );
}
