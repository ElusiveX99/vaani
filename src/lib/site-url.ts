export const canonicalSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://vju.vercel.app"
).replace(/\/+$/, "");

const previewUrl =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;

// Use the deployment's own origin for generated invitation and preview metadata.
export const siteUrl = previewUrl || canonicalSiteUrl;
