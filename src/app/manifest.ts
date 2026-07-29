import type { MetadataRoute } from "next";

// Colors come from the globals.css light palette (--background #fafaf9); a
// manifest has a single set of colors and can't express the dark variant
// (#0c0a09), so the install splash always uses the light one.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "In House Mixers",
    short_name: "In House Mixers",
    description:
      "Build your bar and instantly see which cocktails you can make from what you have on hand.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Full-bleed variants for platforms that mask the icon to their own
      // shape (Android adaptive icons).
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}