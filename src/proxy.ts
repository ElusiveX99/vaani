import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // The public landing page must remain available even when Preview
  // deployments do not have working Supabase credentials. Authenticated
  // routes continue through the normal session-refresh flow below.
  if (request.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
