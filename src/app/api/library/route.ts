import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data: documents, error: dbError } = await supabase.from("library_documents")
    .select("id,title,description,size_bytes,created_at,display_order")
    .eq("is_published", true).eq("is_archived", false)
    .order("display_order", { ascending: true }).order("created_at", { ascending: true });
  if (dbError) return NextResponse.json({ error: "Unable to load the Library." }, { status: 500 });
  return NextResponse.json({ documents: documents ?? [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
