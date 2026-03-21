"use client";

/**
 * Re-export useLocale from next-intl for Client Components.
 * Returns the current locale as a string matching our Locale type.
 *
 * Usage in Client Components:
 *   import { useLocale } from "@/i18n/use-locale";
 *   const locale = useLocale(); // "fr" | "en"
 */
export { useLocale } from "next-intl";
