import { ImageResponse } from "next/og";

export const alt = "Vaani — Gaayan and Vaani Paath, together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{display:"flex",position:"relative",width:"100%",height:"100%",overflow:"hidden",background:"#f5f2ec",color:"#3f2d3b",fontFamily:"Georgia, serif"}}>
      <div style={{position:"absolute",right:-220,top:-280,width:760,height:760,borderRadius:380,background:"#593b53",display:"flex"}} />
      <div style={{position:"absolute",left:-180,bottom:-330,width:560,height:560,borderRadius:280,background:"#ead9d0",display:"flex"}} />
      <div style={{display:"flex",flexDirection:"column",width:"53%",padding:"62px 0 48px 76px",zIndex:2}}>
        <div style={{display:"flex",alignItems:"center",gap:13,color:"#8b5d70",fontFamily:"Arial",fontSize:14,fontWeight:700,letterSpacing:4}}>
          <div style={{width:38,height:2,background:"#b78a5e",display:"flex"}} /> SAKHI SANG
        </div>
        <div style={{display:"flex",marginTop:24,fontSize:84,lineHeight:.9,fontWeight:500,letterSpacing:-4}}>Vaani</div>
        <div style={{display:"flex",marginTop:26,fontSize:42,lineHeight:1.03,color:"#593b53",fontWeight:500}}>
          Gaayan and Vaani Paath,<br/><span style={{color:"#ad6875",fontStyle:"italic"}}>together.</span>
        </div>
        <div style={{display:"flex",marginTop:21,maxWidth:520,fontFamily:"Arial",fontSize:16,lineHeight:1.42,color:"#71676d"}}>
          A shared place for Sakhis to meet live, sing, and follow the same Vaani.
        </div>
        <div style={{display:"flex",marginTop:29,gap:20,fontFamily:"Arial",fontSize:12,fontWeight:700,color:"#593b53"}}>
          <span>LIVE GATHERINGS</span><span style={{color:"#b78a5e"}}>•</span><span>SHARED READING</span><span style={{color:"#b78a5e"}}>•</span><span>CHAT</span>
        </div>
      </div>
      <div style={{display:"flex",position:"absolute",right:43,top:68,width:535,height:494,borderRadius:25,background:"#241f25",border:"1px solid #5b4658",boxShadow:"0 28px 80px rgba(44,27,40,.28)",flexDirection:"column",overflow:"hidden",zIndex:3,fontFamily:"Arial"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 21px",borderBottom:"1px solid #40363f"}}>
          <div style={{display:"flex",flexDirection:"column"}}><span style={{color:"#f6f0e8",fontFamily:"Georgia",fontSize:23}}>Vaani</span><span style={{color:"#a69aa4",fontSize:10,marginTop:5}}>Live session</span></div>
          <div style={{display:"flex",padding:"7px 11px",borderRadius:999,background:"#3b2938",color:"#e9d9de",fontSize:10,fontWeight:700}}>LIVE · TOGETHER</div>
        </div>
        <div style={{display:"flex",flex:1,padding:15,gap:12}}>
          <div style={{display:"flex",flex:1,borderRadius:13,background:"#312a33",padding:13,flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",color:"#968b94",fontSize:9,fontWeight:700,letterSpacing:1.3}}><span>SHARED READING</span><span>PAGE 18</span></div>
            <div style={{display:"flex",flex:1,marginTop:12,borderRadius:10,background:"#f8f1e7",padding:"20px 22px",flexDirection:"column",color:"#4c3a43"}}>
              <div style={{width:105,height:5,borderRadius:4,background:"#b89b8e",display:"flex"}} />
              <div style={{display:"flex",marginTop:20,fontSize:17,lineHeight:1.7}}>Shared Vaani<br/>reading position</div>
              <div style={{height:1,background:"#d8c9bd",marginTop:14,display:"flex"}} />
              <div style={{display:"flex",marginTop:12,fontSize:10,color:"#786a70"}}>Everyone follows the same place.</div>
            </div>
          </div>
          <div style={{display:"flex",width:132,flexDirection:"column",gap:9}}>
            <div style={{display:"flex",gap:7}}><div style={{width:62,height:48,borderRadius:8,background:"#584c58",display:"flex"}}/><div style={{width:62,height:48,borderRadius:8,background:"#443a45",display:"flex"}}/></div>
            <div style={{display:"flex",gap:7}}><div style={{width:62,height:48,borderRadius:8,background:"#514650",display:"flex"}}/><div style={{width:62,height:48,borderRadius:8,background:"#3e353f",display:"flex"}}/></div>
            <div style={{display:"flex",flex:1,borderRadius:10,background:"#312a33",padding:11,flexDirection:"column"}}><span style={{color:"#968b94",fontSize:9,fontWeight:700}}>CHAT</span><span style={{marginTop:13,color:"#ded4dc",fontSize:10}}>Reading together.</span><span style={{marginTop:9,color:"#bdaeb9",fontSize:10}}>Jai Shri Krishna</span></div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 17px",borderTop:"1px solid #40363f",fontSize:9,color:"#9c9199"}}><span>Audio · Video · Chat · Reader</span><span style={{color:"#d8b2bb"}}>Vaani</span></div>
      </div>
    </div>,
    size,
  );
}
