"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RecommendationCardProps {
  recommandation: string | null;
}

export function RecommendationCard({ recommandation }: RecommendationCardProps) {
  if (!recommandation) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3">
        <div className="flex gap-2">
          <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary mb-1">Recommandation</p>
            <p className="text-sm text-foreground leading-relaxed">{recommandation}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
