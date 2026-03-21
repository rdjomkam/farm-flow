import { getLocale as getNextIntlLocale } from "next-intl/server";
import type { Locale } from "./config";

/**
 * Returns the current locale in Server Components.
 * Wraps next-intl's getLocale and casts to our Locale union type.
 */
export async function getLocale(): Promise<Locale> {
  const locale = await getNextIntlLocale();
  return locale as Locale;
}
