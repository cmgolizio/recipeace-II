import { ImageResponse } from "next/og";

// Branded default Open Graph image for routes without their own — recipe
// detail pages with an image_url override this via generateMetadata.
export const alt = "RecipeAce — what can I make?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: "#1c1917",
        }}
      >
        <svg
          width="176"
          height="176"
          viewBox="0 0 512 512"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="26"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M120 116v84M170 116v84M220 116v84" />
          <path d="M120 200h100" />
          <path d="M170 200v196" />
          <path d="M292 140h136l-68 92z" />
          <path d="M360 232v128" />
          <path d="M316 396h88" />
        </svg>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 76, fontWeight: 600, color: "#fafaf9" }}>
            RecipeAce
          </div>
          <div style={{ fontSize: 32, color: "#a8a29e" }}>
            Add what you have. Discover what you can make.
          </div>
        </div>
      </div>
    ),
    size,
  );
}