// Sentry for the Node.js server runtime, loaded from src/instrumentation.ts.
// Without NEXT_PUBLIC_SENTRY_DSN the SDK is never initialized, so local and CI
// builds report nothing.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Error monitoring only — performance tracing is off.
    tracesSampleRate: 0,
  });
}