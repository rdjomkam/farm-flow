"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";

export default function OfflinePage() {
  const tErrors = useTranslations("errors.page");
  const tCommon = useTranslations("common.buttons");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-full bg-muted p-6">
        <WifiOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{tErrors("offlineTitle")}</h1>
        <p className="text-muted-foreground max-w-sm">
          {tErrors("offlineDescription")}
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
      >
        {tCommon("retry")}
      </button>
    </div>
  );
}
