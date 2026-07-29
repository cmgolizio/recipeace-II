import * as Sentry from "@sentry/nextjs";

// Runs once per server instance, in each runtime Next.js starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Reports errors thrown while rendering on the server.
export const onRequestError = Sentry.captureRequestError;