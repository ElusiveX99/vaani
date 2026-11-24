import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
const SIGNED_URL_LIFETIME = 6 * 60 * 60;
function isUuid(v:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);}
export async function GET(_request:Request,context:{params:Promise<{documentId:string}>}) {
 const {documentId}=await context.params;
 if(!isUuid(documentId)) return NextResponse.json({error:"Invalid document ID."},{status:400});
 const supabase=await createClient();
 const {data:claims,error:authError}=await supabase.auth.getClaims();
 if(authError||typeof claims?.claims?.sub!=="string") return NextResponse.json({error:"Unauthorized."},{status:401});
 const {data:doc,error}=await supabase.from("library_documents").select("id,title,mime_type,size_bytes,storage_path")
  .eq("id",documentId).eq("is_published",true).eq("is_archived",false).maybeSingle();
 if(error) return NextResponse.json({error:"Unable to load the PDF."},{status:500});
 if(!doc) return NextResponse.json({error:"PDF not found."},{status:404});
 const {data:signed,error:signedError}=await supabase.storage.from("vaani-library-pdfs").createSignedUrl(doc.storage_path,SIGNED_URL_LIFETIME);
 if(signedError||!signed?.signedUrl) return NextResponse.json({error:"Unable to access the PDF."},{status:500});
 return NextResponse.json({document:{id:doc.id,title:doc.title,mimeType:doc.mime_type,sizeBytes:doc.size_bytes,url:signed.signedUrl}},{headers:{"Cache-Control":"no-store, max-age=0"}});
}
