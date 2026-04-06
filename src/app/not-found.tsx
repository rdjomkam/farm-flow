import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const tErrors = await getTranslations("errors.page");
  const tCommon = await getTranslations("common.accessDenied");
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="text-5xl font-bold text-muted-foreground">404</div>
      <div>
        <h2 className="text-lg font-semibold">{tErrors("notFoundTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tErrors("notFoundDescription")}
        </p>
      </div>
      <Button variant="secondary" asChild>
        <Link href="/">{tCommon("backButton")}</Link>
      </Button>
    </div>
  );
}
