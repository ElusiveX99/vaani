import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");

  let next = "/home";

  if (requestedNext) {
    try {
      const destination = new URL(requestedNext, requestUrl.origin);

      if (
        destination.origin === requestUrl.origin &&
        destination.pathname.startsWith("/") &&
        !destination.pathname.startsWith("//")
      ) {
        next = `${destination.pathname}${destination.search}${destination.hash}`;
      }
    } catch {
      next = "/account";
    }
  }

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_error", requestUrl.origin)
  );
}
