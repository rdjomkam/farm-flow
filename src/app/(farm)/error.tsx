"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function FarmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[FarmError]", error);

  const tErrors = useTranslations("errors.page");
  const tCommon = useTranslations("common.buttons");
  const tNav = useTranslations("navigation.items");

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger text-2xl">
        !
      </div>
      <div>
        <h2 className="text-lg font-semibold">{tErrors("errorOccurred")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tErrors("somethingWentWrong")}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="secondary">
          {tCommon("retry")}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">{tNav("dashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
