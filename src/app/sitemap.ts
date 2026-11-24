import type { MetadataRoute } from "next";
import { canonicalSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.VERCEL_ENV === "preview") return [];

  return ["/", "/login", "/signup"].map((path) => ({
    url: new URL(path, canonicalSiteUrl).toString(),
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.35,
  }));
}
