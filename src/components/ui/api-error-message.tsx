"use client";

import { useTranslations } from "next-intl";

interface ApiErrorMessageProps {
  /** i18n key within the "errors" namespace (e.g. "notFound.plan") */
  errorKey?: string;
  /** Fallback French message returned by the API — always shown when errorKey is absent */
  message?: string;
  className?: string;
}

/**
 * Displays an API error in the user's locale.
 *
 * Resolution order:
 *   1. Translate `errorKey` via next-intl useTranslations("errors").
 *   2. If the key is missing or invalid, fall back to the raw `message` string.
 *   3. If neither is provided, show nothing.
 *
 * Backward-compatible: works even when `errorKey` is absent (old API routes).
 */
export function ApiErrorMessage({ errorKey, message, className }: ApiErrorMessageProps) {
  const t = useTranslations("errors");

  let text: string | undefined;

  if (errorKey) {
    try {
      // next-intl throws when a key doesn't exist; we catch and fall back.
      text = t(errorKey as Parameters<typeof t>[0]);
    } catch {
      text = message;
    }
  } else {
    text = message;
  }

  if (!text) return null;

  return (
    <p role="alert" className={className ?? "text-sm text-destructive"}>
      {text}
    </p>
  );
}
