// Runs in the browser before hydration. Without NEXT_PUBLIC_SENTRY_DSN the SDK
// is never initialized and nothing is sent.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Error monitoring only — performance tracing is off.
    tracesSampleRate: 0,
  });
}

// Attributes client-side navigations to the errors reported during them.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;