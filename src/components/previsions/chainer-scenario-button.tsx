"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";

interface ChainerScenarioButtonProps {
  scenarioId: string;
}

export function ChainerScenarioButton({ scenarioId }: ChainerScenarioButtonProps) {
  const t = useTranslations("previsions");
  const router = useRouter();
  const { post } = usePrevisionsApi();
  const [loading, setLoading] = useState(false);

  async function handleChainer() {
    setLoading(true);
    try {
      const result = await post(
        `/api/previsions/scenarios/${scenarioId}/chainer`,
        {}
      );
      if (result.ok && result.data?.id) {
        router.push(`/previsions/scenarios/${result.data.id}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleChainer}
      disabled={loading}
    >
      <Link2 className="mr-2 h-4 w-4" />
      {loading ? t("chainer.enCours") : t("chainer.bouton")}
    </Button>
  );
}
