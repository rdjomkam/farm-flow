import Link from "next/link";
import { ShieldX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

export async function AccessDenied() {
  const t = await getTranslations("common");
  return (
    <>
      <Header title={t("accessDenied.title")} />
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[60vh]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">{t("accessDenied.title")}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("accessDenied.description")}
        </p>
        <Link href="/">
          <Button>{t("accessDenied.backButton")}</Button>
        </Link>
      </div>
    </>
  );
}
