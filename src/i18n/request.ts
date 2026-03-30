import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * Detect locale from:
 * 1. Cookie NEXT_LOCALE (explicit user preference or session-stored locale)
 * 2. Accept-Language header
 * 3. Fallback to defaultLocale ("fr")
 */
async function detectLocale(): Promise<Locale> {
  // 1. Read from cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  // 2. Read from Accept-Language header
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    // Parse Accept-Language: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
    const preferred = acceptLanguage
      .split(",")
      .map((part) => part.split(";")[0].trim().substring(0, 2).toLowerCase())
      .find((lang) => locales.includes(lang as Locale));
    if (preferred) {
      return preferred as Locale;
    }
  }

  // 3. Fallback to default
  return defaultLocale;
}

/**
 * Load messages for a given locale.
 * Each namespace is a separate JSON file under src/messages/{locale}/.
 * If a file doesn't exist yet, it is silently skipped.
 */
async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const namespaces = ["common", "format", "navigation", "permissions", "abonnements", "settings", "analytics", "errors", "stock", "ventes", "vagues", "releves", "alevins", "users", "commissions", "activites", "admin", "alertes", "backoffice", "bacs", "besoins", "calibrage", "config-elevage", "dashboard", "depenses", "ingenieur", "layout", "notes", "observations", "packs", "planning", "pwa", "remises", "sites"];
  const messages: Record<string, unknown> = {};

  for (const ns of namespaces) {
    try {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      messages[ns] = mod.default ?? mod;
    } catch {
      // File doesn't exist yet — skip gracefully
    }
  }

  return messages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Use the locale passed by the caller (e.g. explicit getTranslations({locale}))
  // or fall back to cookie/Accept-Language detection
  const resolvedRequestLocale = await requestLocale;
  const locale: Locale =
    resolvedRequestLocale && locales.includes(resolvedRequestLocale as Locale)
      ? (resolvedRequestLocale as Locale)
      : await detectLocale();

  const messages = await loadMessages(locale);

  return {
    locale,
    messages,
  };
});
