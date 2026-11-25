import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const alt = "Vaani gathering invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let title = "A gathering on Vaani";
  let description = "You are invited to gather, sing, and follow the same Vaani.";

  if (/^[a-z0-9]{10}$/.test(slug)) {
    const s = await createClient();
    const { data } = await s.rpc("preview_session_invite_link", { p_code: slug });
    if (data && typeof data === "object") {
      if (typeof data.title === "string") title = data.title;
      if (typeof data.description === "string" && data.description.trim()) description = data.description.trim();
    }
  } else if (/^[a-f0-9]{32}$/.test(slug)) {
    const s = await createClient();
    const { data } = await s.rpc("preview_gathering_by_slug", { p_slug: slug });
    if (Array.isArray(data) && data[0]) {
      if (typeof data[0].title === "string") title = data[0].title;
      if (typeof data[0].description === "string" && data[0].description.trim()) description = data[0].description.trim();
    }
  }

  return new ImageResponse(
    <div style={{display:"flex",position:"relative",width:"100%",height:"100%",overflow:"hidden",background:"#f7f1e8",color:"#593b53",fontFamily:"Georgia, serif"}}>
      <div style={{position:"absolute",right:-170,top:-210,width:620,height:620,borderRadius:310,background:"#4a263f",display:"flex"}} />
      <div style={{position:"absolute",left:-130,bottom:-260,width:440,height:440,borderRadius:220,background:"#ead7d0",display:"flex"}} />
      <div style={{display:"flex",flexDirection:"column",width:"56%",padding:"62px 0 50px 74px",zIndex:2}}>
        <div style={{display:"flex",alignItems:"center",gap:13,color:"#80613f",fontFamily:"Arial",fontSize:15,fontWeight:700,letterSpacing:4}}>
          <div style={{width:38,height:2,background:"#b58a57",display:"flex"}} /> VAANI
        </div>
        <div style={{display:"flex",marginTop:30,fontSize:58,lineHeight:1.02,fontWeight:500}}>
          You're invited
        </div>
        <div style={{display:"flex",marginTop:17,fontSize:43,lineHeight:1.05,color:"#ad6875",fontStyle:"italic"}}>
          {title.length > 48 ? title.slice(0,45)+"…" : title}
        </div>
        <div style={{display:"flex",marginTop:22,maxWidth:570,fontFamily:"Arial",fontSize:18,lineHeight:1.4,color:"#756d73"}}>
          {description.length > 110 ? description.slice(0,107)+"…" : description}
        </div>
        <div style={{display:"flex",marginTop:30,alignItems:"center",gap:14,fontFamily:"Arial",fontSize:14,fontWeight:700}}>
          <div style={{display:"flex",padding:"11px 18px",borderRadius:7,background:"#593b53",color:"#fff"}}>Join gathering</div>
          <div style={{display:"flex",color:"#593b53"}}>Vaani Paath together →</div>
        </div>
      </div>
      <div style={{position:"absolute",right:42,top:72,width:500,height:486,borderRadius:24,border:"1px solid #70566a",background:"#241f25",boxShadow:"0 24px 70px rgba(42,24,36,.3)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:3,fontFamily:"Arial"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px",borderBottom:"1px solid #40363f"}}>
          <div style={{display:"flex",flexDirection:"column"}}><span style={{fontFamily:"Georgia",fontSize:23,color:"#f7f0e8"}}>Vaani gathering</span><span style={{marginTop:4,fontSize:10,color:"#a69aa4"}}>Shared reading · live room</span></div>
          <div style={{display:"flex",gap:7,alignItems:"center",padding:"7px 11px",borderRadius:999,background:"#3b2938",color:"#e9d9de",fontSize:10,fontWeight:700}}><span style={{width:7,height:7,borderRadius:7,background:"#c95b67"}} /> LIVE</div>
        </div>
        <div style={{display:"flex",flex:1,padding:14,gap:12}}>
          <div style={{display:"flex",flex:1,flexDirection:"column",borderRadius:12,background:"#312a33",padding:13}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,fontWeight:700,letterSpacing:1.3,color:"#8f848e"}}><span>SHARED READER</span><span>PAGE 18</span></div>
            <div style={{display:"flex",flex:1,flexDirection:"column",marginTop:12,borderRadius:9,background:"#f8f1e7",padding:"19px 20px",color:"#4c3a43"}}>
              <div style={{width:80,height:5,borderRadius:5,background:"#b89b8e",display:"flex"}} />
              <div style={{display:"flex",marginTop:17,fontSize:17,lineHeight:1.7}}>Shared Vaani<br/>reading position</div>
              <div style={{height:1,background:"#d8c9bd",marginTop:12,display:"flex"}} />
              <div style={{display:"flex",marginTop:12,fontSize:10,color:"#786a70"}}>Everyone can follow the same place.</div>
            </div>
          </div>
          <div style={{display:"flex",width:130,flexDirection:"column",gap:9}}>
            <div style={{display:"flex",gap:7}}><div style={{width:61,height:48,borderRadius:8,background:"#584c58",display:"flex"}} /><div style={{width:61,height:48,borderRadius:8,background:"#443a45",display:"flex"}} /></div>
            <div style={{display:"flex",gap:7}}><div style={{width:61,height:48,borderRadius:8,background:"#514650",display:"flex"}} /><div style={{width:61,height:48,borderRadius:8,background:"#3e353f",display:"flex"}} /></div>
            <div style={{display:"flex",flex:1,flexDirection:"column",borderRadius:9,background:"#312a33",padding:11}}>
              <span style={{fontSize:9,fontWeight:700,color:"#8f848e"}}>CHAT</span>
              <span style={{marginTop:12,fontSize:10,color:"#ded4dc"}}>A shared gathering, not just a call.</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 17px",borderTop:"1px solid #40363f",fontSize:9,color:"#9c9199"}}><span>Audio · Video · Chat · Reader</span><span style={{color:"#d8b2bb"}}>Vaani</span></div>
      </div>
    </div>,
    size,
  );
}
