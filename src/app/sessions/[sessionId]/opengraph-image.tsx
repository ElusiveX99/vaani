import { ImageResponse } from "next/og";

export const alt = "Vaani session";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{display:"flex",position:"relative",width:"100%",height:"100%",overflow:"hidden",background:"#211d24",fontFamily:"Arial",color:"#fff"}}>
      <div style={{position:"absolute",left:-120,top:-180,width:520,height:520,borderRadius:260,background:"#4a263f",display:"flex"}} />
      <div style={{display:"flex",flexDirection:"column",width:"39%",padding:"70px 0 50px 72px",zIndex:2}}>
        <div style={{display:"flex",fontFamily:"Georgia",fontSize:72,color:"#f8f1e7"}}>Vaani</div>
        <div style={{display:"flex",marginTop:25,fontFamily:"Georgia",fontSize:39,lineHeight:1.08,color:"#e2c0c5"}}>A shared<br/>gathering.</div>
        <div style={{display:"flex",marginTop:24,fontSize:17,lineHeight:1.45,color:"#b8adb5"}}>Meet live, keep the conversation close, and follow the same Vaani together.</div>
      </div>
      <div style={{position:"absolute",right:42,top:55,width:700,height:520,borderRadius:24,border:"1px solid #4a3c47",background:"#2b252d",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:3,boxShadow:"0 26px 70px rgba(0,0,0,.28)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"17px 20px",borderBottom:"1px solid #443b43"}}>
          <span style={{fontFamily:"Georgia",fontSize:22,color:"#f7f0e8"}}>Vaani conference</span>
          <span style={{display:"flex",padding:"7px 11px",borderRadius:999,background:"#3c2937",color:"#e8d5da",fontSize:10,fontWeight:700}}>LIVE SESSION</span>
        </div>
        <div style={{display:"flex",flex:1,padding:13,gap:12}}>
          <div style={{display:"flex",width:190,flexDirection:"column",gap:10}}>
            <div style={{display:"flex",height:103,borderRadius:11,background:"#514650"}} />
            <div style={{display:"flex",height:103,borderRadius:11,background:"#443a45"}} />
            <div style={{display:"flex",height:103,borderRadius:11,background:"#584c58"}} />
          </div>
          <div style={{display:"flex",flex:1,flexDirection:"column",gap:10}}>
            <div style={{display:"flex",flex:1,borderRadius:13,background:"#f8f1e7",color:"#4c3a43",padding:22,flexDirection:"column"}}>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:"#8b704e"}}>SHARED READER</span>
              <span style={{fontFamily:"Georgia",fontSize:28,marginTop:25}}>Vaani Paath</span>
              <span style={{fontSize:12,marginTop:15,color:"#786a70"}}>Page 18 · shared position</span>
              <div style={{display:"flex",marginTop:23,height:4,width:210,background:"#d8c9bd",borderRadius:4}} />
              <div style={{display:"flex",marginTop:10,height:4,width:165,background:"#e4ddd5",borderRadius:4}} />
              <div style={{display:"flex",marginTop:10,height:4,width:190,background:"#e4ddd5",borderRadius:4}} />
            </div>
            <div style={{display:"flex",height:76,borderRadius:11,background:"#312a33",padding:"13px 16px",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:"#b9aeb6"}}>Audio · Video · Chat · Reader</span>
              <span style={{fontSize:11,fontWeight:700,color:"#d8b2bb"}}>12 joined</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
