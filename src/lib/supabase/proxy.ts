import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
      });
    }
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    }
  );

  // The proxy is the single server-side place responsible for refreshing
  // Supabase sessions. Do not refresh the same session again in a page.
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    const message = error.message.toLowerCase();

    // A stale/revoked refresh token should not poison every subsequent
    // request. Clear the browser's Supabase auth cookies and let the user
    // continue as signed out.
    if (
      message.includes("invalid refresh token") ||
      message.includes("refresh token not found")
    ) {
      clearAuthCookies(supabaseResponse, request);
    }

    return supabaseResponse;
  }
  return supabaseResponse;
}
