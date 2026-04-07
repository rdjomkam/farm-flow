"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { RELEVES_PAGE_LIMIT } from "@/lib/releve-search-params";

interface Props {
  offset: number;
  total: number;
}

export function LoadMoreButton({ offset, total }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("releves");
  const tCommon = useTranslations("common");

  const limit = RELEVES_PAGE_LIMIT;
  const shown = offset + limit;
  const remaining = total - shown;

  if (remaining <= 0) return null;

  function handleLoadMore() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("offset", String(shown));
    startTransition(() => {
      router.push(`/releves?${params.toString()}`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleLoadMore}
      disabled={isPending}
      className="w-full flex items-center justify-center gap-2 rounded-md border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
    >
      <ChevronDown className="h-4 w-4" />
      {isPending
        ? tCommon("loading.text")
        : `${t("global.chargerPlus", { count: Math.min(limit, remaining) })} ${t("global.restants", { count: remaining })}`}
    </button>
  );
}
