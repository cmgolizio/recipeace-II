import type { MetadataRoute } from "next";

// Colors come from the globals.css light palette (--background #ffffff on
// --foreground #171717); a manifest can't express the dark variant (#0a0a0a).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "In House Mixers",
    short_name: "In House Mixers",
    description:
      "Build your bar and instantly see which cocktails you can make from what you have on hand.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}