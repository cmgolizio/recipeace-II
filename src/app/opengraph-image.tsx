import { ImageResponse } from "next/og";

// Branded default Open Graph image for routes without their own — recipe
// detail pages with an image_url override this via generateMetadata.
export const alt = "In House Mixers — what can I make?";
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
          <path d="M116 132h280L256 290z" />
          <path d="M256 290v104" />
          <path d="M172 394h168" />
          <path d="M312 180 356 118" strokeWidth="12" />
          <circle cx="312" cy="180" r="26" fill="#b45309" stroke="none" />
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
            In House Mixers
          </div>
          <div style={{ fontSize: 32, color: "#a8a29e" }}>
            See which cocktails you can mix from what you have in house
          </div>
        </div>
      </div>
    ),
    size,
  );
}