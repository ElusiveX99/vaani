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
  };
}
