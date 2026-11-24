import type { MetadataRoute } from "next";
import { canonicalSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const isPreview = process.env.VERCEL_ENV === "preview";

  return {
    rules: [
      {
        userAgent: "*",
        allow: isPreview ? [] : ["/", "/sessions/join/"],
        disallow: isPreview
          ? ["/"]
          : ["/home", "/sessions/", "/account", "/api", "/auth"],
      },
    ],
    sitemap: `${canonicalSiteUrl}/sitemap.xml`,
    host: canonicalSiteUrl,
  };
}
