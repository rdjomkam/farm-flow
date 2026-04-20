"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const LOCALE_CONFIG: Record<Locale, { flag: string; label: string }> = {
  fr: { flag: "FR", label: "Français" },
  en: { flag: "EN", label: "English" },
};

const FLAG_EMOJI: Record<Locale, string> = {
  fr: "\u{1F1EB}\u{1F1F7}",
  en: "\u{1F1EC}\u{1F1E7}",
};

interface LanguageSwitcherProps {
  currentLocale?: Locale;
  className?: string;
}

export function LanguageSwitcher({ currentLocale = "fr", className }: LanguageSwitcherProps) {
  const tLayout = useTranslations("layout.languageSwitcher");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeLocale, setActiveLocale] = useState<Locale>(currentLocale);

  async function handleLocaleChange(locale: Locale) {
    if (locale === activeLocale) return;

    // Always set the NEXT_LOCALE cookie client-side (works for unauthenticated users too)
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;

    // Attempt to persist to session via API (requires auth — gracefully ignore 401)
    try {
      await fetch("/api/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
    } catch {
      // Silencieux — fonctionne sans auth via cookie
    }

    setActiveLocale(locale);

    startTransition(() => {
      router.refresh();
    });
  }

  const current = LOCALE_CONFIG[activeLocale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={tLayout("ariaLabel", { label: current.label })}
          disabled={isPending}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium",
            "min-h-[44px] min-w-[44px]",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "transition-colors disabled:opacity-50",
            className
          )}
        >
          <span aria-hidden="true" className="text-base leading-none">
            {FLAG_EMOJI[activeLocale]}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">
            {current.flag}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={cn(
              "cursor-pointer gap-2",
              activeLocale === locale && "text-primary font-medium"
            )}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {FLAG_EMOJI[locale]}
            </span>
            <span>{LOCALE_CONFIG[locale].label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
