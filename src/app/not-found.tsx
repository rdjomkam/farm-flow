import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FishLoader } from "@/components/ui/fish-loader";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors.page");
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <FishLoader size="lg" />
      <div className="text-7xl font-bold" style={{ color: "var(--primary)", opacity: 0.15 }}>
        404
      </div>
      <div className="max-w-xs">
        <h1 className="text-xl font-semibold text-foreground">
          {t("notFoundTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("notFoundDescription")}
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/">{t("backToHome")}</Link>
      </Button>
    </div>
  );
}
