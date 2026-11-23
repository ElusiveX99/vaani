import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vaani",
    short_name: "Vaani",
    description: "A quiet space for Sakhis to gather for Chaturasi Ji gaayan, pada gaayan, and Vaani paath.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f6f3ee",
    theme_color: "#f6f3ee",
    icons: [
      { src: "/pwa-icons/192?v=20261123-brand02", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/512?v=20261123-brand02", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg?v=20261123-brand02", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
