"use client";

import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useTranslations } from "next-intl";

export function InstallPrompt() {
  const t = useTranslations("pwa");
  const { canInstall, isIOS, isStandalone, promptInstall, dismiss } = useInstallPrompt();

  if (!canInstall || isStandalone) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80">
      <div className="rounded-lg border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t("installPrompt.title")}</p>
            {isIOS ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("installPrompt.iosDescription")}{" "}
                <Share className="inline h-3.5 w-3.5 text-primary" />
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("installPrompt.androidDescription")}
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
            aria-label={t("installPrompt.fermer")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!isIOS && (
          <button
            onClick={promptInstall}
            className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            {t("installPrompt.installer")}
          </button>
        )}
      </div>
    </div>
  );
}
