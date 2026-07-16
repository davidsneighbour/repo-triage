import * as Sentry from "@sentry/node";

const TRUE_RE = /^(1|true|yes|on)$/i;

let sentryInitialized = false;

export function telemetryDisabled(env = process.env) {
  return TRUE_RE.test(String(env.NO_TELEMETRY || "").trim());
}

export function sentryDsn(env = process.env) {
  return String(env.SENTRY_DSN || "").trim();
}

export function shouldInitSentry(env = process.env) {
  return Boolean(sentryDsn(env)) && !telemetryDisabled(env);
}

export function initSentry(env = process.env) {
  if (!shouldInitSentry(env)) {
    sentryInitialized = false;
    return false;
  }

  Sentry.init({
    dsn: sentryDsn(env),
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  sentryInitialized = true;
  return true;
}

export function captureException(error, context) {
  if (!sentryInitialized) return;
  Sentry.captureException(error, context);
}

export function isSentryInitialized() {
  return sentryInitialized;
}
