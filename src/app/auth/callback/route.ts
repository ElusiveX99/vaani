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
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user) {
        const metadata = user.user_metadata ?? {};
        const displayName =
          String(metadata.full_name ?? metadata.name ?? user.email?.split("@")[0] ?? "Sakhi")
            .trim()
            .slice(0, 80) || "Sakhi";
        const avatarUrl =
          typeof metadata.avatar_url === "string"
            ? metadata.avatar_url
            : typeof metadata.picture === "string"
              ? metadata.picture
              : null;

        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          display_name: displayName,
          ...(avatarUrl ? { avatar_url: avatarUrl, avatar_path: avatarUrl } : {}),
        }, { onConflict: "id" });

        if (profileError) {
          console.error("Could not initialize member profile:", profileError);
        }
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_error", requestUrl.origin)
  );
}
