"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tErrors = useTranslations("errors.page");
  const tCommon = useTranslations("common.buttons");
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger text-2xl">
        !
      </div>
      <div>
        <h2 className="text-lg font-semibold">{tErrors("errorOccurred")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || tErrors("somethingWentWrong")}
        </p>
      </div>
      <Button onClick={reset} variant="secondary">
        {tCommon("retry")}
      </Button>
    </div>
  );
}
