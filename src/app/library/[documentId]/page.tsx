import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LibraryPdfViewer from "./library-pdf-viewer";

export const instant = false;
export default async function LibraryDocumentPage({params}:{params:Promise<{documentId:string}>}){await connection();const{documentId}=await params;const supabase=await createClient();const{data,error}=await supabase.auth.getClaims();if(error||typeof data?.claims?.sub!=="string")redirect("/login");const{data:doc}=await supabase.from("library_documents").select("id,title").eq("id",documentId).eq("is_published",true).eq("is_archived",false).maybeSingle();if(!doc)notFound();return <main className="min-h-screen bg-[var(--conference-bg)] text-white"><header className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--conference-line)] px-3 sm:px-5"><Link href="/library" className="text-xs font-semibold text-white/75 hover:text-white">← Library</Link><h1 className="min-w-0 truncate text-sm font-semibold">{doc.title}</h1><span className="w-12"/></header><LibraryPdfViewer documentId={doc.id} title={doc.title}/></main>;}
