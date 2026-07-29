// Sentry for the edge runtime (src/proxy.ts runs there), loaded from
// src/instrumentation.ts. Same DSN gate as the server config.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Error monitoring only — performance tracing is off.
    tracesSampleRate: 0,
  });
}