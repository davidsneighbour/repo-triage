import * as Sentry from "@sentry/react";

const TRUE_RE = /^(1|true|yes|on)$/i;

export function telemetryDisabled(env = import.meta.env) {
  return TRUE_RE.test(
    String(env.NO_TELEMETRY || env.VITE_NO_TELEMETRY || "").trim(),
  );
}

export function sentryDsn(env = import.meta.env) {
  return String(env.VITE_SENTRY_DSN || "").trim();
}

export function shouldInitSentry(env = import.meta.env) {
  return Boolean(sentryDsn(env)) && !telemetryDisabled(env);
}

export function initSentry(env = import.meta.env) {
  if (!shouldInitSentry(env)) return false;

  Sentry.init({
    dsn: sentryDsn(env),
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  return true;
}

export function reactRootErrorHandlers(enabled) {
  if (!enabled) return undefined;
  return {
    onUncaughtError: Sentry.reactErrorHandler(),
    onCaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
  };
}
